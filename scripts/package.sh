#!/usr/bin/env bash
# Build a Chrome Web Store / sideload-ready .zip (manifest at archive root).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(grep -m1 '"version"' manifest.json | sed -E 's/.*"version": "([^"]+)".*/\1/')"
OUT="dist/toggleplay-v${VERSION}.zip"

required=(
  manifest.json
  assets/icon.png
  src/background/service-worker.js
  src/popup/popup.html
  src/privacy/privacy.html
)

for path in "${required[@]}"; do
  if [[ ! -e "$path" ]]; then
    echo "Missing required file: $path" >&2
    exit 1
  fi
done

mkdir -p dist
rm -f "$OUT"

zip -r "$OUT" \
  manifest.json \
  assets \
  src \
  -x "**/.DS_Store" \
  -x "**/*~"

echo "Created $OUT ($(du -h "$OUT" | cut -f1))"
