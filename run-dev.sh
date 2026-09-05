#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo 'Node.js 22+ is required for the current development build.'; exit 1; }
echo 'Study Bible Creator: http://127.0.0.1:4173'
node src/server.mjs
