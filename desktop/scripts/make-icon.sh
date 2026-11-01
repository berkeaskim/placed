#!/bin/sh
# Renders desktop/build/icon.svg into desktop/build/icon.icns (macOS only: sips, iconutil).
# sips, not qlmanage: qlmanage thumbnails flatten the SVG onto white, which would put white corners on the icon.
# Usage: sh desktop/scripts/make-icon.sh
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
svg="$here/build/icon.svg"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

png="$work/icon.png"
sips -s format png "$svg" --out "$png" >/dev/null
[ -f "$png" ] || { echo "make-icon: sips did not render $svg" >&2; exit 1; }
[ "$(sips -g pixelWidth "$png" | awk '/pixelWidth/ {print $2}')" = 1024 ] || { echo "make-icon: render is not 1024px" >&2; exit 1; }

set_dir="$work/icon.iconset"
mkdir "$set_dir"
for s in 16 32 128 256 512; do
  sips -z "$s" "$s" "$png" --out "$set_dir/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2))
  sips -z "$d" "$d" "$png" --out "$set_dir/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$set_dir" -o "$here/build/icon.icns"
echo "make-icon: wrote $here/build/icon.icns"
