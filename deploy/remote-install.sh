#!/usr/bin/env bash
# Install the standalone Next.js server and point nginx at it.
# Requires the SSH deploy user to be root, or to have passwordless sudo.
# Node.js 22.13+ is installed into /opt/read/node when the system Node is older.
set -euo pipefail

APP_ROOT=/var/lib/read
PORT=3210
NODE_VERSION=v22.23.4
DEPLOY_DIR=${DEPLOY_DIR:-/tmp/read-deploy}
OWNER=$(id -un)
GROUP=$(id -gn)

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    sudo -n "$@"
  else
    echo "root or passwordless sudo is required to run: $*" >&2
    exit 1
  fi
}

node_ok() {
  local bin=$1
  [ -x "$bin" ] || return 1
  "$bin" -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1)'
}

install_node() {
  local arch tarball url tmp
  case "$(uname -m)" in
    x86_64) arch=x64 ;;
    aarch64 | arm64) arch=arm64 ;;
    *)
      echo "unsupported architecture: $(uname -m)" >&2
      exit 1
      ;;
  esac
  tarball="node-${NODE_VERSION}-linux-${arch}.tar.xz"
  url="https://nodejs.org/dist/${NODE_VERSION}/${tarball}"
  tmp=$(mktemp -d)
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required to install Node.js ${NODE_VERSION}" >&2
    exit 1
  fi
  curl -fsSL "$url" -o "$tmp/$tarball"
  as_root mkdir -p /opt/read
  as_root tar -xJf "$tmp/$tarball" -C /opt/read
  as_root rm -rf /opt/read/node
  as_root mv "/opt/read/node-${NODE_VERSION}-linux-${arch}" /opt/read/node
  rm -rf "$tmp"
  echo /opt/read/node/bin/node
}

NODE_BIN=""
if command -v node >/dev/null 2>&1 && node_ok "$(command -v node)"; then
  NODE_BIN=$(command -v node)
elif node_ok /opt/read/node/bin/node; then
  NODE_BIN=/opt/read/node/bin/node
else
  NODE_BIN=$(install_node)
fi

as_root mkdir -p "$APP_ROOT/data" "$APP_ROOT/uploads"
as_root chown -R "$OWNER:$GROUP" "$APP_ROOT"
rm -rf "$APP_ROOT/app"
mkdir -p "$APP_ROOT/app"
tar -xzf "$DEPLOY_DIR/read-standalone.tgz" -C "$APP_ROOT/app"

unit=$(mktemp)
sed \
  -e "s|__NODE__|${NODE_BIN}|g" \
  -e "s|__USER__|${OWNER}|g" \
  -e "s|__GROUP__|${GROUP}|g" \
  "$DEPLOY_DIR/read.service" >"$unit"
as_root cp "$unit" /etc/systemd/system/read.service
rm -f "$unit"
as_root systemctl daemon-reload
as_root systemctl enable read.service
as_root systemctl restart read.service

healthy=0
for _ in $(seq 1 20); do
  if "$NODE_BIN" -e "fetch('http://127.0.0.1:${PORT}/login').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"; then
    healthy=1
    break
  fi
  sleep 1
done

if [ "$healthy" != 1 ]; then
  echo "read.service did not answer on 127.0.0.1:${PORT}" >&2
  as_root systemctl status read.service --no-pager || true
  as_root journalctl -u read.service -n 80 --no-pager || true
  exit 1
fi

sites=()
while IFS= read -r line; do
  [ -n "$line" ] && sites+=("$line")
done < <(as_root grep -RIl "read.coming.js.cn" /etc/nginx 2>/dev/null || true)

if [ "${#sites[@]}" -eq 0 ]; then
  cp "$DEPLOY_DIR/read.coming.js.cn.conf" "$APP_ROOT/nginx.read.coming.js.cn.conf"
  echo "Node is listening on 127.0.0.1:${PORT}."
  echo "No nginx server block for read.coming.js.cn was found."
  echo "Merge $APP_ROOT/nginx.read.coming.js.cn.conf with the existing TLS config and reload nginx."
  exit 0
fi

backup=$(mktemp -d)
manifest="$backup/manifest"
: >"$manifest"
index=0
for site in "${sites[@]}"; do
  index=$((index + 1))
  as_root cp "$site" "$backup/$index"
  printf '%s %s\n' "$index" "$site" >>"$manifest"
  as_root "$NODE_BIN" "$DEPLOY_DIR/migrate-nginx-config.mjs" "$site"
done

if ! as_root nginx -t; then
  echo "nginx -t failed; restoring the previous site files" >&2
  while read -r hash site; do
    as_root cp "$backup/$hash" "$site"
  done <"$manifest"
  exit 1
fi

as_root systemctl reload nginx
echo "nginx proxies read.coming.js.cn to 127.0.0.1:${PORT}"
