#!/usr/bin/env bash
# Stop both servers cleanly.

set -euo pipefail
LOG_DIR="$(cd "$(dirname "$0")" && pwd)/logs"

for name in miroshark wf; do
    pidfile="$LOG_DIR/$name.pid"
    if [[ -f "$pidfile" ]]; then
        pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            echo "[stop] killed $name (pid=$pid)"
        fi
        rm -f "$pidfile"
    fi
done

# Belt-and-suspenders: free the ports if anything else is squatting.
for port in 5001 5055; do
    pids=$(lsof -ti:$port 2>/dev/null || true)
    [[ -n "$pids" ]] && kill $pids 2>/dev/null && echo "[stop] freed :$port" || true
done
