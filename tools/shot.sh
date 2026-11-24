#!/usr/bin/env bash
# Headless screenshot of dev/shot.html: tools/shot.sh <out.png> "<query>" [WxH] [page]
# Needs the dev server (python -m http.server); port via SHOT_PORT (default 8765).
out="$(cygpath -w "$(realpath -m "$1")")"; q="$2"; size="${3:-1280x800}"; page="${4:-dev/shot.html}"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
prof="$(mktemp -d)"
timeout 90 "$EDGE" --headless=new --user-data-dir="$(cygpath -w "$prof")" --no-first-run --disable-extensions --hide-scrollbars --ignore-gpu-blocklist --enable-unsafe-swiftshader \
  --disable-features=msEdgeUpdate --window-size="${size/x/,}" --virtual-time-budget="${SHOT_MS:-5000}" --screenshot="$out" "http://localhost:${SHOT_PORT:-8765}/$page?$q" >/dev/null 2>&1
rm -rf "$prof" 2>/dev/null
[ -s "$1" ] && echo "ok $1" || echo "FAILED $1"
