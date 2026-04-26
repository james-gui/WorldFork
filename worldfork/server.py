"""WorldFork server — Flask app serving the v2 UI and the API it talks to.

Single port (default :5055). The browser loads `/` (templates/WorldFork.html
+ static assets) and the in-page React calls back to the JSON endpoints
defined here. Those endpoints in turn talk to MiroShark on :5001 for live
simulation data and to the orchestrator subprocess for run control.

Routes:
  GET  /                          → SPA shell (templates/WorldFork.html)
  GET  /static/<path>             → static assets (jsx, css, js)
  POST /api/start                 → kicks off an orchestrator subprocess; returns run_id
  GET  /api/runs                  → past completed runs (registry + standalone manifests)
  GET  /api/run/<id>/lineage      → tree from MiroShark + manifest decoration

Configuration via env vars:
  WF_PORT                  Port to bind (default 5055).
  WF_BACKEND               MiroShark backend URL (default http://localhost:5001).
  WF_ORCHESTRATOR_PYTHON   Python interpreter to run the orchestrator subprocess
                           (must have httpx + yaml available). Default: sys.executable.
  WF_DEMO_SCENARIO         Path to the scenario YAML used by /api/start
                           (default: <repo>/samples/ftx_collapse_scenario.yaml).
  WF_DEMO_NUM_BRANCHES     Branch count for /api/start (default 8).
"""

from __future__ import annotations

import glob
import json
import os
import re
import shlex
import subprocess
import sys
import threading
import uuid
from datetime import datetime
from pathlib import Path

import yaml
from flask import Flask, abort, jsonify, request, send_from_directory
import urllib.parse as _urllib_parse
import urllib.request as _urllib_request


PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

UI_DIR = Path(__file__).resolve().parent / "ui"
STATIC_DIR = UI_DIR / "static"
TEMPLATES_DIR = UI_DIR / "templates"

RUNS_DIR = PROJECT_ROOT / "runs"
REGISTRY_PATH = RUNS_DIR / "_demo_registry.json"

DEMO_SCENARIO = Path(os.environ.get(
    "WF_DEMO_SCENARIO",
    str(PROJECT_ROOT / "samples" / "godagent_v07_scenario.yaml"),
))
DEMO_NUM_BRANCHES = int(os.environ.get("WF_DEMO_NUM_BRANCHES", "6"))
BACKEND_URL = os.environ.get("WF_BACKEND", "http://localhost:5001").rstrip("/")
ORCHESTRATOR_PYTHON = os.environ.get("WF_ORCHESTRATOR_PYTHON", sys.executable)
ORCHESTRATOR_SCRIPT = PROJECT_ROOT / "worldfork" / "orchestrator.py"


app = Flask(__name__, static_folder=None)


# ---------------------------------------------------------------------------
# Registry helpers (track in-flight + completed runs)
# ---------------------------------------------------------------------------

_registry_lock = threading.Lock()
_FILE_CACHE: dict = {}  # path → (mtime_ns, size, parsed_value)


def _load_cached(path: str, parser):
    try:
        st = os.stat(path)
    except OSError:
        return None
    key = str(path)
    entry = _FILE_CACHE.get(key)
    if entry and entry[0] == st.st_mtime_ns and entry[1] == st.st_size:
        return entry[2]
    try:
        with open(path, "r", encoding="utf-8") as f:
            value = parser(f)
    except Exception:
        _FILE_CACHE.pop(key, None)
        return None
    _FILE_CACHE[key] = (st.st_mtime_ns, st.st_size, value)
    return value


def _load_json_cached(path: str):
    return _load_cached(path, json.load)


def _load_yaml_cached(path: str):
    return _load_cached(path, yaml.safe_load)


def _load_registry() -> dict:
    if not REGISTRY_PATH.exists():
        return {}
    try:
        return json.loads(REGISTRY_PATH.read_text())
    except Exception:
        return {}


def _save_registry(reg: dict) -> None:
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    REGISTRY_PATH.write_text(json.dumps(reg, indent=2))


def _update_run(run_id: str, **patch) -> dict:
    with _registry_lock:
        reg = _load_registry()
        rec = reg.get(run_id, {})
        rec.update(patch)
        reg[run_id] = rec
        _save_registry(reg)
        return rec


def _get_run(run_id: str) -> dict | None:
    return _load_registry().get(run_id)


def _read_log_tail(path: Path, n_lines: int = 80) -> str:
    if not path.exists():
        return ""
    try:
        with open(path, "rb") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            chunk = min(size, 200_000)
            f.seek(size - chunk)
            data = f.read().decode("utf-8", errors="replace")
        lines = data.splitlines()
        return "\n".join(lines[-n_lines:])
    except Exception:
        return ""


def _extract_manifest_path(log_text: str) -> str | None:
    m = re.search(r"wrote manifest:\s*(\S+)", log_text)
    if m:
        return m.group(1)
    # Orchestrator can also write `wrote manifest → /path/to/manifest.json`
    m = re.search(r"wrote manifest\s*[→>]+\s*(\S+)", log_text)
    return m.group(1) if m else None


def _pid_alive(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except (OSError, ProcessLookupError):
        return False


def _reconcile_registry() -> None:
    """Heal the registry on startup. If a run is marked status=running but its
    PID is dead, scan its log for `wrote manifest → <path>` and either flip it
    to completed (manifest present) or failed. This fixes the case where the
    server was restarted while orchestrators were running — the in-process
    _watcher thread that normally updates status died with the old server.
    """
    reg = _load_registry()
    changed = False
    for run_id, rec in reg.items():
        if rec.get("status") != "running":
            continue
        if _pid_alive(rec.get("pid")):
            continue
        log_path = Path(rec.get("log_path", ""))
        log_text = _read_log_tail(log_path, 500) if log_path.exists() else ""
        mp = _extract_manifest_path(log_text)
        if mp and Path(mp).exists():
            rec["status"] = "completed"
            rec["manifest_path"] = mp
            rec["finished_at"] = rec.get("finished_at") or datetime.utcnow().isoformat() + "Z"
            print(f"[reconcile] {run_id} → completed (manifest={mp})")
        else:
            rec["status"] = "failed"
            rec["finished_at"] = rec.get("finished_at") or datetime.utcnow().isoformat() + "Z"
            print(f"[reconcile] {run_id} → failed (PID {rec.get('pid')} dead, no manifest)")
        changed = True
    if changed:
        _save_registry(reg)


# ---------------------------------------------------------------------------
# UI: SPA shell + static assets
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return (TEMPLATES_DIR / "WorldFork.html").read_text(encoding="utf-8")


@app.route("/static/<path:fname>")
def static_assets(fname):
    p = STATIC_DIR / fname
    if not p.is_file() or not p.resolve().is_relative_to(STATIC_DIR.resolve()):
        abort(404)
    # Babel needs .jsx as text/javascript so its in-browser transform picks it up.
    if fname.endswith(".jsx"):
        return p.read_text(encoding="utf-8"), 200, {"Content-Type": "application/javascript"}
    return send_from_directory(str(STATIC_DIR), fname)


# ---------------------------------------------------------------------------
# API: start an orchestrator
# ---------------------------------------------------------------------------

@app.route("/api/start", methods=["POST"])
def api_start():
    if not DEMO_SCENARIO.exists():
        return jsonify({"success": False, "error": f"scenario not found: {DEMO_SCENARIO}"}), 500
    if not Path(ORCHESTRATOR_PYTHON).exists():
        return jsonify({
            "success": False,
            "error": f"WF_ORCHESTRATOR_PYTHON not found: {ORCHESTRATOR_PYTHON}",
        }), 500

    run_id = "demo_" + datetime.utcnow().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:6]
    log_path = RUNS_DIR / f"{run_id}.log"
    RUNS_DIR.mkdir(parents=True, exist_ok=True)

    cmd = [
        str(ORCHESTRATOR_PYTHON),
        str(ORCHESTRATOR_SCRIPT),
        str(DEMO_SCENARIO),
        "--num-branches", str(DEMO_NUM_BRANCHES),
        "--branch-timeout", "1800",
        "--poll-interval", "15",
        "--backend", BACKEND_URL,
    ]

    log_file = open(log_path, "w")
    proc = subprocess.Popen(
        cmd, stdout=log_file, stderr=subprocess.STDOUT,
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )

    _update_run(
        run_id,
        started_at=datetime.utcnow().isoformat() + "Z",
        pid=proc.pid,
        status="running",
        phase="initializing",
        log_path=str(log_path),
        manifest_path=None,
        cmd=" ".join(shlex.quote(c) for c in cmd),
        scenario_path=str(DEMO_SCENARIO),
    )

    def _watcher():
        try:
            proc.wait()
            log_file.close()
            tail = _read_log_tail(log_path, 200)
            mp = _extract_manifest_path(tail)
            status = "completed" if (mp and Path(mp).exists() and proc.returncode == 0) else "failed"
            _update_run(run_id, status=status, manifest_path=mp,
                        finished_at=datetime.utcnow().isoformat() + "Z",
                        return_code=proc.returncode)
        except Exception as e:
            _update_run(run_id, status="failed", error=str(e))

    threading.Thread(target=_watcher, daemon=True).start()
    return jsonify({"success": True, "run_id": run_id})


# ---------------------------------------------------------------------------
# API: list runs
# ---------------------------------------------------------------------------

@app.route("/api/runs")
def api_runs():
    items = []
    reg = _load_registry()
    for run_id, rec in sorted(reg.items(), key=lambda kv: kv[1].get("started_at", ""), reverse=True):
        mp = rec.get("manifest_path")
        if rec.get("status") == "completed" and mp and Path(mp).exists():
            try:
                m = json.loads(Path(mp).read_text())
                items.append({
                    "run_id": run_id,
                    "scenario": m.get("scenario_name", "?"),
                    "n_total": m.get("summary", {}).get("n_total", "?"),
                    "n_valid": m.get("summary", {}).get("n_valid", "?"),
                    "timestamp": rec.get("finished_at", "?")[:19].replace("T", " "),
                    "url": f"/run/{run_id}",
                })
            except Exception:
                pass
    seen_paths = {rec.get("manifest_path") for rec in reg.values()}
    for mp_str in sorted(glob.glob(str(RUNS_DIR / "run_*.json")), reverse=True):
        if mp_str in seen_paths:
            continue
        try:
            m = json.loads(Path(mp_str).read_text())
            base = Path(mp_str).stem
            items.append({
                "run_id": base,
                "scenario": m.get("scenario_name", "?"),
                "n_total": m.get("summary", {}).get("n_total", "?"),
                "n_valid": m.get("summary", {}).get("n_valid", "?"),
                "timestamp": m.get("finished_at", "")[:19].replace("T", " "),
                "url": f"/existing/{base}",
            })
        except Exception:
            pass
    return jsonify({"runs": items})


# ---------------------------------------------------------------------------
# API: lineage
# ---------------------------------------------------------------------------

@app.route("/api/run/<run_id>/lineage")
def api_run_lineage(run_id: str):
    """Live lineage tree for a run.

    Discovers the parent_sim_id by scraping the orchestrator log, then proxies
    MiroShark's /api/simulation/<root>/lineage (with a since= filter pinned to
    the run's started_at so we only see this run's children). Decorates the
    tree with per-branch outcomes from the manifest if it's been written.
    """
    rec = _get_run(run_id)
    if not rec:
        # Standalone-manifest fallback: historical runs whose orchestrator
        # never wrote a registry entry still leave a runs/<id>.json manifest.
        # Synthesize enough of a rec from it to feed the rest of the pipeline.
        standalone = RUNS_DIR / f"{run_id}.json"
        if standalone.exists():
            try:
                m = _load_json_cached(str(standalone)) or {}
                rec = {
                    "manifest_path": str(standalone),
                    "status": "completed",
                    "started_at": m.get("started_at"),
                    "finished_at": m.get("finished_at"),
                    "log_path": "",
                    "scenario_path": None,
                }
            except Exception:
                rec = None
        if not rec:
            return jsonify({"error": "unknown run_id"}), 404

    log_path = Path(rec.get("log_path", ""))
    log_text = _read_log_tail(log_path, 5000) if log_path.exists() else ""

    root_sim_id = None
    for rx in [
        r"verifying parent (sim_[a-zA-Z0-9]+)",
        r"starting parent (sim_[a-zA-Z0-9]+)",
        r"parent_sim_id[\"':= ]+(sim_[a-zA-Z0-9]+)",
        # Surface the parent sim_id during bootstrap (step 4 prints
        # "→ simulation_id=sim_xxx" several minutes before "verifying
        # parent" appears). Without this the v2 root node is unclickable
        # for the entire ~3-min bootstrap phase.
        r"simulation_id=(sim_[a-zA-Z0-9]+)",
    ]:
        m = re.search(rx, log_text)
        if m:
            root_sim_id = m.group(1)
            break

    # Standalone runs have no log to scrape — pull parent_sim_id from manifest.
    if not root_sim_id:
        mp = rec.get("manifest_path")
        if mp and Path(mp).exists():
            try:
                m = _load_json_cached(mp) or {}
                root_sim_id = m.get("parent_sim_id")
            except Exception:
                pass

    phase = "initializing"
    if rec.get("status") == "completed":
        phase = "complete"
    elif rec.get("status") == "failed":
        phase = "failed"
    elif "wrote manifest" in log_text:
        phase = "complete"
    elif "validating + classifying" in log_text:
        phase = "classifying"
    elif "[primary fork]" in log_text or "[nested fork]" in log_text or "branches via" in log_text:
        phase = "running"
    elif "verifying parent" in log_text or "starting parent" in log_text:
        phase = "perturbations_pending"

    if not root_sim_id:
        return jsonify({"run_id": run_id, "phase": phase, "tree": None})

    # Pass started_at AS-IS. MiroShark uses the trailing Z to know the
    # timestamp is UTC; stripping it would make MiroShark treat UTC as local.
    started_at = rec.get("started_at") or ""
    qs = _urllib_parse.urlencode({"since": started_at}) if started_at else ""
    url = f"{BACKEND_URL}/api/simulation/{root_sim_id}/lineage" + (f"?{qs}" if qs else "")
    try:
        with _urllib_request.urlopen(url, timeout=5) as resp:
            body = json.loads(resp.read())
    except Exception as e:
        return jsonify({
            "run_id": run_id, "phase": phase, "root_sim_id": root_sim_id,
            "tree": None, "lineage_error": str(e),
        })

    if not body.get("success"):
        return jsonify({
            "run_id": run_id, "phase": phase, "root_sim_id": root_sim_id,
            "tree": None, "lineage_error": body.get("error"),
        })

    tree = body["data"]

    manifest_path = rec.get("manifest_path") or _extract_manifest_path(log_text)
    manifest = _load_json_cached(manifest_path) if manifest_path and Path(manifest_path).exists() else None

    outcome_schema = []
    distributions = {}
    if manifest:
        sim_to_outcomes = {}
        for b in manifest.get("branches") or []:
            sid = b.get("child_sim_id")
            if sid:
                sim_to_outcomes[sid] = {
                    "outcomes": b.get("outcomes") or {},
                    "valid": b.get("valid"),
                    "invalid_reason": b.get("invalid_reason"),
                    "perturbation_text": b.get("perturbation_text"),
                }

        def _decorate(node):
            extra = sim_to_outcomes.get(node.get("sim_id"))
            if extra:
                node["outcomes"] = extra["outcomes"]
                node["valid"] = extra["valid"]
                node["invalid_reason"] = extra["invalid_reason"]
                node["perturbation_text"] = extra["perturbation_text"]
            for c in node.get("children") or []:
                _decorate(c)
        _decorate(tree)

        scen_path = rec.get("scenario_path")
        if not scen_path:
            scen_name = manifest.get("scenario_name")
            if scen_name:
                for p in (PROJECT_ROOT / "samples").glob("*.yaml"):
                    try:
                        cand = yaml.safe_load(p.read_text())
                        if cand.get("name") == scen_name:
                            scen_path = str(p)
                            break
                    except Exception:
                        continue
        if not scen_path:
            scen_path = str(DEMO_SCENARIO)

        scen = _load_yaml_cached(scen_path)
        if scen:
            outcome_schema = scen.get("outcomes") or []

        if not outcome_schema and manifest:
            seen_keys: dict[str, str] = {}
            for b in manifest.get("branches") or []:
                for k, v in (b.get("outcomes") or {}).items():
                    if k in seen_keys:
                        continue
                    if isinstance(v, bool): seen_keys[k] = "bool"
                    elif isinstance(v, float): seen_keys[k] = "float"
                    elif isinstance(v, int): seen_keys[k] = "int"
                    else: seen_keys[k] = "string"
            outcome_schema = [
                {"name": k, "type": t,
                 "description": "(inferred — original scenario YAML not on disk)"}
                for k, t in seen_keys.items()
            ]

        leaf_outcomes = list(sim_to_outcomes.values())
        for var in outcome_schema:
            name = var["name"]
            t = (var.get("type") or "").lower()
            if t not in ("float", "int", "number"):
                continue
            vals = []
            for lo in leaf_outcomes:
                v = (lo.get("outcomes") or {}).get(name)
                if isinstance(v, (int, float)) and v is not None:
                    vals.append(float(v))
            if not vals:
                continue
            vals_sorted = sorted(vals)
            n = len(vals_sorted)
            mean = sum(vals_sorted) / n
            median = vals_sorted[n // 2] if n % 2 else (vals_sorted[n // 2 - 1] + vals_sorted[n // 2]) / 2

            def _pct(p, v=vals_sorted, n=n):
                k = max(0, min(n - 1, int(round(p * (n - 1)))))
                return v[k]
            distributions[name] = {
                "values": vals_sorted, "mean": mean, "median": median,
                "q25": _pct(0.25), "q75": _pct(0.75),
                "min": vals_sorted[0], "max": vals_sorted[-1],
                "n": n, "range": var.get("range"),
                "description": (var.get("description") or "").strip(),
            }

    return jsonify({
        "run_id": run_id, "phase": phase, "root_sim_id": root_sim_id,
        "tree": tree, "manifest_present": manifest is not None,
        "outcome_schema": outcome_schema, "distributions": distributions,
        "scenario_name": (manifest or {}).get("scenario_name"),
    })


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# API: knowledge graph for a run
# ---------------------------------------------------------------------------

@app.route("/api/run/<run_id>/graph")
def api_run_graph(run_id: str):
    """Per-branch agent interaction network — proxies MiroShark's
    /api/simulation/<sim_id>/interaction-network.

    Nodes are agents (with degree, influence, stance, primary_platform);
    edges are aggregated interactions (likes, comments, follows, reposts)
    with weight + per-type counts. While a branch is running MiroShark
    recomputes from actions.jsonl every call (no cache), so polling shows
    the network evolving over rounds. Once the branch finishes, the cache
    locks the final state.

    Caller passes `?sim=<sim_id>` for the branch to inspect; without it
    we default to the run's root parent sim.
    """
    sim_id = request.args.get("sim")

    if not sim_id:
        # Default to the root parent sim, scraped from the orchestrator log.
        rec = _get_run(run_id)
        if not rec:
            standalone = RUNS_DIR / f"{run_id}.json"
            if standalone.exists():
                try:
                    m = _load_json_cached(str(standalone)) or {}
                    sim_id = m.get("parent_sim_id")
                except Exception:
                    sim_id = None
            if not sim_id:
                return jsonify({"error": "unknown run_id"}), 404
        else:
            log_path = Path(rec.get("log_path", ""))
            log_text = _read_log_tail(log_path, 5000) if log_path.exists() else ""
            for rx in [
                r"verifying parent (sim_[a-zA-Z0-9]+)",
                r"starting parent (sim_[a-zA-Z0-9]+)",
            ]:
                m = re.search(rx, log_text)
                if m:
                    sim_id = m.group(1)
                    break
            if not sim_id:
                mp = rec.get("manifest_path")
                if mp and Path(mp).exists():
                    try:
                        sim_id = (_load_json_cached(mp) or {}).get("parent_sim_id")
                    except Exception:
                        pass
        if not sim_id:
            return jsonify({"run_id": run_id, "sim_id": None, "graph": None,
                            "error": "couldn't resolve sim_id for run"})

    url = f"{BACKEND_URL}/api/simulation/{sim_id}/interaction-network"
    try:
        with _urllib_request.urlopen(url, timeout=10) as resp:
            body = json.loads(resp.read())
    except Exception as e:
        return jsonify({"run_id": run_id, "sim_id": sim_id, "graph": None,
                        "error": str(e)})

    if not body.get("success"):
        return jsonify({"run_id": run_id, "sim_id": sim_id, "graph": None,
                        "error": body.get("error") or body.get("message") or "unknown error"})

    data = body.get("data") or {}
    nodes = [
        {
            "id": n.get("id") or n.get("name"),
            "name": n.get("name"),
            "type": n.get("primary_platform") or "agent",
            "stance": n.get("stance"),
            "platforms": n.get("platforms") or [],
            "in_degree": n.get("in_degree", 0),
            "out_degree": n.get("out_degree", 0),
            "total_degree": n.get("total_degree", 0),
            "influence_score": n.get("influence_score", 0),
            "rank": n.get("rank"),
        }
        for n in (data.get("nodes") or [])
    ]
    edges = [
        {
            "source": e.get("source"),
            "target": e.get("target"),
            "type": ", ".join((e.get("types") or {}).keys()) or "INTERACTION",
            "weight": e.get("weight", 1),
            "is_cross_platform": e.get("is_cross_platform", False),
        }
        for e in (data.get("edges") or [])
        if e.get("source") and e.get("target")
    ]
    return jsonify({
        "run_id": run_id, "sim_id": sim_id,
        "node_count": len(nodes), "edge_count": len(edges),
        "insights": data.get("insights") or {},
        "graph": {"nodes": nodes, "edges": edges},
    })


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("WF_PORT", "5055"))
    _reconcile_registry()
    print(f"[worldfork] starting on http://localhost:{port}  (backend={BACKEND_URL})")
    app.run(host="0.0.0.0", port=port, debug=False)
