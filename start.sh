#!/usr/bin/env bash
# start.sh — launch PePe-Fren port (GUI test harness + optional AnythingLLM frontend)
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "=== PePe-Fren Port ==="
echo "Modules: $(ls ported/utils/*.js 2>/dev/null | wc -l) ported .js files"
echo ""

# 1. GUI test harness (static server on :8080)
if [ -f gui.html ]; then
  echo "Starting GUI test harness on http://localhost:8080/gui.html"
  python3 -m http.server 8080 --directory "$ROOT" >/tmp/pepe-gui.log 2>&1 &
  GUI_PID=$!
  echo "  GUI PID: $GUI_PID"
fi

# 2. AnythingLLM frontend (if deps installed)
FE_DIR="$ROOT/../anythingllm-archive/anything-llm-master/frontend"
if [ -d "$FE_DIR/node_modules" ]; then
  echo "Starting AnythingLLM frontend (npm run dev)..."
  cd "$FE_DIR"
  npm run dev &
  FE_PID=$!
  echo "  Frontend PID: $FE_PID"
  cd "$ROOT"
else
  echo "AnythingLLM frontend deps not installed. To install:"
  echo "  cd $FE_DIR && npm install && npm run dev"
fi

echo ""
echo "GUI test harness: http://localhost:8080/gui.html"
echo "Press Ctrl+C to stop."
wait