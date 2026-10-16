#!/usr/bin/env bash
# Downloads Satoshi from Fontshare into assets/fonts/satoshi.
# The ITF Free Font License allows embedding in the app but not hosting the
# files in a public repo, so they're git-ignored and fetched here instead.
# Runs on `npm install` (postinstall). Pass --strict to fail on errors.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/assets/fonts/satoshi"
WEIGHTS=(Light Regular Medium Bold Black)
STRICT=${1:-}

have_all() {
  for w in "${WEIGHTS[@]}"; do [[ -f "$DEST/Satoshi-$w.ttf" ]] || return 1; done
}

ANDROID_FONTS="$ROOT/android/app/src/main/assets/fonts"

sync_android() {
  [[ -d "$ROOT/android/app/src/main" ]] || return 0
  mkdir -p "$ANDROID_FONTS"
  for w in "${WEIGHTS[@]}"; do cp "$DEST/Satoshi-$w.ttf" "$ANDROID_FONTS/"; done
}

if have_all; then sync_android; exit 0; fi

fail() {
  echo "fetch-fonts: $1" >&2
  [[ "$STRICT" == "--strict" ]] && exit 1
  echo "fetch-fonts: continuing without Satoshi; run 'npm run fonts' when online." >&2
  exit 0
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL -o "$TMP/satoshi.zip" "https://api.fontshare.com/v2/fonts/download/satoshi" \
  || fail "download failed"
unzip -q "$TMP/satoshi.zip" -d "$TMP" || fail "unzip failed"

SRC="$(find "$TMP" -type d -path '*WEB/fonts' | head -1)"
[[ -n "$SRC" ]] || fail "unexpected archive layout"

mkdir -p "$DEST"
for w in "${WEIGHTS[@]}"; do
  cp "$SRC/Satoshi-$w.ttf" "$DEST/" || fail "missing Satoshi-$w.ttf"
done
cp "$(find "$TMP" -name 'FFL.txt' | head -1)" "$DEST/LICENSE.txt" 2>/dev/null || true
sync_android
echo "fetch-fonts: Satoshi installed to assets/fonts/satoshi"
