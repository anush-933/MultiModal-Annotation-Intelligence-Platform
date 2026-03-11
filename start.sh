#!/usr/bin/env bash
# ── MAIP Quick-Start Script ──────────────────────────────────────────────────
# Starts both backend and frontend in parallel.
# Run: bash start.sh

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   MAIP — MultiModal Annotation Intelligence Platform ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Backend ──────────────────────────────────────────────────
BACKEND="$ROOT/backend"

if [ ! -d "$BACKEND/venv" ]; then
  echo "▶  Creating Python virtual environment..."
  python -m venv "$BACKEND/venv"
fi

source "$BACKEND/venv/Scripts/activate" 2>/dev/null || source "$BACKEND/venv/bin/activate"

echo "▶  Installing backend dependencies..."
pip install -q -r "$BACKEND/requirements.txt"

if [ ! -f "$BACKEND/.env" ]; then
  cp "$BACKEND/.env.example" "$BACKEND/.env"
  echo "⚠  Created .env from example. Add your ANTHROPIC_API_KEY to enable Claude."
fi

echo "▶  Starting FastAPI backend on http://localhost:8000"
cd "$BACKEND"
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

# ── Frontend ─────────────────────────────────────────────────
FRONTEND="$ROOT/frontend"
cd "$FRONTEND"

if [ ! -d "node_modules" ]; then
  echo "▶  Installing frontend dependencies..."
  npm install
fi

echo "▶  Starting React frontend on http://localhost:5173"
npm run dev &
FRONTEND_PID=$!

# ── Wait ─────────────────────────────────────────────────────
echo ""
echo "✅  Both servers running."
echo "   Frontend : http://localhost:5173"
echo "   API Docs : http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo 'Stopped.'" SIGINT SIGTERM
wait
