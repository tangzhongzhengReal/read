#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .next/standalone/server.js ]; then
  echo "Missing .next/standalone/server.js. Run npm run build first." >&2
  exit 1
fi

mkdir -p .next/standalone/.next
rm -rf .next/standalone/public
cp -a .next/static .next/standalone/.next/static
cp -a public .next/standalone/public
exec node .next/standalone/server.js
