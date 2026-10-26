#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .next/standalone/server.js ]; then
  echo "Missing .next/standalone/server.js. Run npm run build first." >&2
  exit 1
fi

rm -rf release
mkdir -p release/bundle
cp -a .next/standalone/. release/bundle/
mkdir -p release/bundle/.next
rm -rf release/bundle/public
cp -a .next/static release/bundle/.next/static
cp -a public release/bundle/public
cp deploy/remote-install.sh release/remote-install.sh
cp deploy/read.service release/read.service
cp deploy/nginx/migrate-nginx-config.mjs release/migrate-nginx-config.mjs
cp deploy/nginx/read.coming.js.cn.conf release/read.coming.js.cn.conf
tar -C release/bundle -czf release/read-standalone.tgz .
echo "Wrote release/read-standalone.tgz"
