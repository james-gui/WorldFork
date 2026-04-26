#!/usr/bin/env bash
# WorldFork launcher — DGX / Linux host edition.
#
# Boots the MiroShark backend (:5001) then the WorldFork server (:5055),
# tailing each into deploy/logs/. Idempotent: re-running kills any
# existing instances first.
#
# Layout assumed:
#   <parent>/
#   ├── WorldFork/    ← this repo (script lives in deploy/)
#   └── MiroShark/    ← sibling clone, with backend/.venv set up
#
# Both venvs must already be uv-synced. The WorldFork orchestrator
# subprocess runs from MiroShark's venv (it needs httpx + yaml at
# minimum and reuses the MiroShark client libs).

set -euo pipefail

WF_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MS_ROOT="$(cd "$WF_ROOT/../MiroShark" && pwd)"
LOG_DIR="$WF_ROOT/deploy/logs"
mkdir -p "$LOG_DIR"

if [[ ! -x "$MS_ROOT/backend/.venv/bin/python" ]]; then
    echo "error: MiroShark venv not found at $MS_ROOT/backend/.venv" >&2
    echo "run:  cd $MS_ROOT/backend && uv sync" >&2
    exit 1
fi
if [[ ! -x "$WF_ROOT/.venv/bin/python" ]]; then
    echo "error: WorldFork venv not found at $WF_ROOT/.venv" >&2
    echo "run:  cd $WF_ROOT && uv sync" >&2
    exit 1
fi

# Kill any prior instances, free the ports.
pkill -f "MiroShark/backend.*python.*run\.py" 2>/dev/null || true
pkill -f "worldfork/server\.py" 2>/dev/null || true
for port in 5001 5055; do
    pids=$(lsof -ti:$port 2>/dev/null || true)
    [[ -n "$pids" ]] && kill $pids 2>/dev/null || true
done
sleep 2

# --- MiroShark backend ---
cd "$MS_ROOT/backend"
nohup ./.venv/bin/python run.py > "$LOG_DIR/miroshark-backend.log" 2>&1 &
MIRO_PID=$!
echo "$MIRO_PID" > "$LOG_DIR/miroshark.pid"
echo "[launch] MiroShark backend started (pid=$MIRO_PID)"

# Wait for :5001/health
until curl -sf http://localhost:5001/health > /dev/null 2>&1; do
    if ! kill -0 "$MIRO_PID" 2>/dev/null; then
        echo "error: MiroShark backend died during startup — see $LOG_DIR/miroshark-backend.log" >&2
        exit 1
    fi
    sleep 2
done
echo "[launch] MiroShark backend healthy on :5001"

# --- WorldFork server ---
cd "$WF_ROOT"
WF_ORCHESTRATOR_PYTHON="$MS_ROOT/backend/.venv/bin/python" \
    nohup ./.venv/bin/python worldfork/server.py > "$LOG_DIR/wf-server.log" 2>&1 &
WF_PID=$!
echo "$WF_PID" > "$LOG_DIR/wf.pid"
echo "[launch] WorldFork server started (pid=$WF_PID)"

until curl -sf http://localhost:5055/ > /dev/null 2>&1; do
    if ! kill -0 "$WF_PID" 2>/dev/null; then
        echo "error: WorldFork server died during startup — see $LOG_DIR/wf-server.log" >&2
        exit 1
    fi
    sleep 1
done
echo "[launch] WorldFork ready at http://localhost:5055"
