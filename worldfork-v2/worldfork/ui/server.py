"""WorldFork v2 UI server.

Serves the Claude-Design-derived single-page app (React via UMD/Babel from
WorldFork.html). The data layer currently uses the mock SCENARIOS in
data.js so the redesign is fully demoable without a live MiroShark
backend; once we wire it to the real /api/run/<id>/lineage endpoint, this
file will proxy /api/* through to the v1 backend on port 5001.

Run:
    /Users/james/Documents/WorldFork/short/MiroShark/backend/.venv/bin/python \
      /Users/james/Documents/WorldFork/short/WorldFork-v2/worldfork/ui/server.py
"""

from __future__ import annotations

import os
from pathlib import Path

from flask import Flask, send_from_directory, abort, request, jsonify
import urllib.request as _urllib_request
import urllib.parse as _urllib_parse


HERE = Path(__file__).resolve().parent
STATIC_DIR = HERE / "static"
TEMPLATES_DIR = HERE / "templates"

app = Flask(__name__, static_folder=None)

# v2's /api/* gets proxied here. v1 UI on :5050 owns /api/runs, /api/run/<id>/lineage,
# /api/start (run registry, lineage adapter, orchestrator launch). The MiroShark
# backend on :5001 owns the raw simulation/* endpoints — but v2 doesn't call those
# directly; everything goes through v1's curated wrapper.
V1_BACKEND = os.environ.get("WF_V1_BACKEND", "http://localhost:5050")


@app.route("/")
def index():
    return (TEMPLATES_DIR / "WorldFork.html").read_text(encoding="utf-8")


@app.route("/static/<path:fname>")
def static_assets(fname):
    p = STATIC_DIR / fname
    if not p.is_file() or not p.resolve().is_relative_to(STATIC_DIR.resolve()):
        abort(404)
    # Help Babel find .jsx files: serve them as text so the in-browser Babel
    # transform picks them up.
    if fname.endswith(".jsx"):
        return p.read_text(encoding="utf-8"), 200, {"Content-Type": "application/javascript"}
    return send_from_directory(str(STATIC_DIR), fname)


# ---- API proxy ----------------------------------------------------------
# Once the v2 UI starts pulling real data, every fetch("/api/...") in the
# browser hits this proxy and we forward to the v1 MiroShark/WorldFork-v1
# backend on port 5001 (which already exposes /api/simulation/.../lineage,
# /api/simulation/.../fork-now, etc.). For now, used only if the JS opts
# into live data; the design's mock data still works without it.
@app.route("/api/<path:rest>", methods=["GET", "POST"])
def api_proxy(rest):
    target = f"{V1_BACKEND.rstrip('/')}/api/{rest}"
    qs = request.query_string.decode()
    if qs:
        target += "?" + qs
    try:
        if request.method == "GET":
            with _urllib_request.urlopen(target, timeout=10) as r:
                body = r.read()
                ct = r.headers.get("Content-Type", "application/json")
                return body, r.status, {"Content-Type": ct}
        else:
            data = request.get_data() or b""
            req = _urllib_request.Request(
                target, data=data, method="POST",
                headers={"Content-Type": request.headers.get("Content-Type", "application/json")},
            )
            with _urllib_request.urlopen(req, timeout=30) as r:
                body = r.read()
                ct = r.headers.get("Content-Type", "application/json")
                return body, r.status, {"Content-Type": ct}
    except Exception as e:
        return jsonify({"success": False, "error": f"v2 proxy: {e}"}), 502


if __name__ == "__main__":
    # Avoid Chrome-unsafe ports (5060=SIP, 6000=X11, 6665-9=IRC, etc.).
    # 5055 is safe and easy to remember alongside v1's 5050.
    port = int(os.environ.get("WF_V2_PORT", "5055"))
    print(f"[worldfork-v2-ui] starting on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
