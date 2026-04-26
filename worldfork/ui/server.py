"""WorldFork demo server — Flask app exposing a start button + tree visualization.

Routes:
  GET /                      → start page with locked-input demo button
  POST /api/start            → kicks off an orchestrator subprocess; returns run_id
  GET /api/status/<run_id>   → polls progress (reads orchestrator output file)
  GET /api/runs              → lists past completed runs
  GET /run/<run_id>          → tree view of a completed run
  GET /existing/<manifest_basename> → tree view of a manifest file already in runs/
"""

from __future__ import annotations

import glob
import json
import os
import re
import shlex
import signal
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml
from flask import Flask, jsonify, request, redirect, url_for, abort

# Add project root to path so worldfork.* imports work
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from worldfork.tree_renderer import render_tree_page, render_tree_svg  # noqa: E402
from worldfork.per_round_extractor import extract_all_branches  # noqa: E402
from worldfork.aggregator import aggregate_variables  # noqa: E402
from worldfork.live_state import assemble_live_state  # noqa: E402


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# Locked demo inputs — the only scenario the demo can run.
DEMO_SCENARIO = PROJECT_ROOT / "samples" / "usdc_depeg_scenario.yaml"
DEMO_PARENT_SIM_ID = "sim_0038baece0f7"   # bootstrapped during the proof point
DEMO_NUM_BRANCHES = 8

RUNS_DIR = PROJECT_ROOT / "runs"
REGISTRY_PATH = RUNS_DIR / "_demo_registry.json"
UPLOADS_ROOT = Path("/Users/james/Documents/WorldFork/short/MiroShark/backend/uploads")
ORCHESTRATOR_VENV_PYTHON = Path(
    "/Users/james/Documents/WorldFork/short/MiroShark/backend/.venv/bin/python"
)
ORCHESTRATOR_SCRIPT = PROJECT_ROOT / "worldfork" / "orchestrator.py"


app = Flask(__name__)


# ---------------------------------------------------------------------------
# Registry helpers (track in-flight + completed runs)
# ---------------------------------------------------------------------------

_registry_lock = threading.Lock()


def _load_registry() -> dict:
    if not REGISTRY_PATH.exists():
        return {}
    try:
        return json.loads(REGISTRY_PATH.read_text())
    except Exception:
        return {}


def _save_registry(reg: dict) -> None:
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


# ---------------------------------------------------------------------------
# Start page
# ---------------------------------------------------------------------------

START_PAGE = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>WorldFork — demo</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      margin: 0; padding: 0; background: linear-gradient(180deg, #f9fafb 0%, #eef2ff 100%);
      color: #1f2937; min-height: 100vh; display: flex; flex-direction: column;
    }
    header { padding: 2.5em 2em 1em; max-width: 920px; margin: 0 auto; }
    header h1 { margin: 0 0 0.2em 0; font-size: 2.4em; letter-spacing: -0.02em; }
    header .tag { color: #4f46e5; font-weight: 600; font-size: 0.9em; letter-spacing: 0.06em; text-transform: uppercase; }
    header p { color: #4b5563; line-height: 1.6; font-size: 1.05em; }
    .container { max-width: 920px; margin: 0 auto; padding: 0 2em 3em; flex: 1; width: 100%; }
    .demo-card {
      background: white; border-radius: 12px; padding: 2em;
      box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06); border: 1px solid #e5e7eb;
      margin-bottom: 2em;
    }
    .demo-card h2 { margin: 0 0 0.6em 0; font-size: 1.3em; }
    .demo-card .scenario-summary {
      background: #f3f4f6; border-radius: 8px; padding: 1em 1.2em;
      font-size: 0.92em; line-height: 1.6; color: #374151; margin: 0.8em 0 1.2em;
    }
    .config-grid {
      display: grid; grid-template-columns: max-content 1fr; gap: 0.5em 1.2em;
      margin: 1em 0; font-size: 0.92em;
    }
    .config-grid .key { color: #6b7280; font-weight: 500; }
    .config-grid .val { font-family: ui-monospace, SFMono-Regular, monospace; color: #1f2937; }
    .lock-note {
      color: #92400e; background: #fef3c7; padding: 0.5em 0.8em; border-radius: 6px;
      font-size: 0.85em; margin-top: 0.8em; border-left: 3px solid #f59e0b;
    }
    button.start {
      background: #4f46e5; color: white; border: none; padding: 0.9em 2em;
      font-size: 1.05em; font-weight: 600; border-radius: 8px; cursor: pointer;
      transition: all 0.15s; margin-top: 1.2em;
    }
    button.start:hover { background: #4338ca; transform: translateY(-1px); }
    button.start:disabled { background: #9ca3af; cursor: not-allowed; transform: none; }
    .runs-section { margin-top: 2em; }
    .runs-section h2 { font-size: 1.15em; margin: 0 0 0.8em 0; color: #4b5563; }
    .runs-list { display: grid; gap: 0.5em; }
    .run-item {
      background: white; border: 1px solid #e5e7eb; padding: 0.7em 1em;
      border-radius: 6px; display: flex; justify-content: space-between;
      align-items: center; text-decoration: none; color: #1f2937; font-size: 0.92em;
      transition: all 0.12s;
    }
    .run-item:hover { border-color: #4f46e5; transform: translateX(2px); }
    .run-item .meta { color: #6b7280; font-size: 0.85em; }
    .progress {
      display: none; margin-top: 1.5em; padding: 1.2em; background: #f0f9ff;
      border-radius: 8px; border: 1px solid #bae6fd;
    }
    .progress.visible { display: block; }
    .progress-bar { width: 100%; height: 14px; background: #e0f2fe; border-radius: 7px;
                    overflow: hidden; margin: 0.7em 0; }
    .progress-fill { height: 100%; background: #0284c7; transition: width 0.4s; width: 0%; }
    .progress-log {
      font-family: ui-monospace, monospace; font-size: 0.8em; color: #475569;
      background: #f1f5f9; padding: 0.6em 0.8em; border-radius: 4px;
      max-height: 200px; overflow-y: auto; margin-top: 0.5em; white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <header>
    <div class="tag">Probabilistic agent-simulation forecasting</div>
    <h1>WorldFork demo</h1>
    <p>
      Click the button to run an N=8 ensemble simulation: 8 sibling branches
      forked from the same parent population, each pushed in a different direction
      by a God-LLM-generated event + persona perturbation. When complete, view the
      result as an interactive branch tree showing how the population diverges
      into different futures.
    </p>
  </header>

  <div class="container">
    <div class="demo-card">
      <h2>Demo scenario (locked)</h2>
      <div class="scenario-summary">
        <strong>USDC depeg cascade.</strong> Reuters reports Circle has lost
        a primary banking partner. USDC trades at $0.998, $180M in pending
        burns. Does the cascade break the $0.99 floor — or hold? Run 8
        branches to find out the probability distribution.
      </div>
      <div class="config-grid">
        <div class="key">scenario:</div><div class="val">usdc_depeg_v0</div>
        <div class="key">parent_sim_id:</div><div class="val">__PARENT_ID__</div>
        <div class="key">num_branches:</div><div class="val">__NUM_BRANCHES__</div>
        <div class="key">platform:</div><div class="val">reddit</div>
        <div class="key">horizon_rounds:</div><div class="val">20</div>
        <div class="key">fork_round:</div><div class="val">1</div>
      </div>
      <div class="lock-note">
        🔒 Inputs locked for the demo. In the production tool you'd be able to
        upload your own scenario document and configure perturbation strategy.
      </div>
      <button class="start" id="startBtn" onclick="kickoff()">▶ Start ensemble</button>
      <div id="progress" class="progress">
        <div class="status" id="statusLine">Initializing…</div>
        <div class="progress-bar"><div class="progress-fill" id="progressBar"></div></div>
        <div class="progress-log" id="progressLog"></div>
      </div>
    </div>

    <div class="runs-section">
      <h2>Past completed runs</h2>
      <div class="runs-list" id="runsList">Loading…</div>
    </div>
  </div>

<script>
const PROGRESS_RX = /running\\s+(\\d+)\\/(\\d+)/g;

async function kickoff() {
  const btn = document.getElementById('startBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Starting…';

  try {
    const res = await fetch('/api/start', { method: 'POST' });
    const data = await res.json();
    if (!data.success) {
      btn.textContent = '✗ Failed';
      alert('Error starting run: ' + (data.error || 'unknown'));
      btn.disabled = false;
      btn.textContent = '▶ Start ensemble';
      return;
    }
    // Immediately redirect to the live tree view — the tree fills in there.
    window.location = '/run/' + data.run_id + '/live';
  } catch (e) {
    btn.textContent = '✗ Network error';
    alert('Network error: ' + e.message);
    btn.disabled = false;
  }
}

async function loadRuns() {
  try {
    const res = await fetch('/api/runs');
    const data = await res.json();
    const list = document.getElementById('runsList');
    if (!data.runs.length) {
      list.innerHTML = '<div style="color:#9ca3af;font-style:italic;font-size:0.92em">No completed runs yet.</div>';
      return;
    }
    list.innerHTML = data.runs.map(r => `
      <a class="run-item" href="${r.url}">
        <span><strong>${r.scenario}</strong> &nbsp;<span class="meta">${r.n_valid}/${r.n_total} valid · ${r.timestamp}</span></span>
        <span class="meta">→</span>
      </a>
    `).join('');
  } catch (e) {
    document.getElementById('runsList').innerHTML =
      '<div style="color:#dc2626">Error loading runs: ' + e.message + '</div>';
  }
}

loadRuns();
</script>
</body>
</html>
""".replace("__PARENT_ID__", DEMO_PARENT_SIM_ID).replace("__NUM_BRANCHES__", str(DEMO_NUM_BRANCHES))


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return START_PAGE


@app.route("/favicon.ico")
def favicon():
    # Tiny inline-SVG favicon: stylized "W" mark
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
        '<rect width="32" height="32" rx="6" fill="#4f46e5"/>'
        '<text x="16" y="22" text-anchor="middle" fill="white" font-family="system-ui" '
        'font-weight="800" font-size="18">W</text></svg>'
    )
    return svg, 200, {"Content-Type": "image/svg+xml"}


@app.route("/api/start", methods=["POST"])
def api_start():
    """Kick off the orchestrator subprocess. Returns run_id."""
    if not DEMO_SCENARIO.exists():
        return jsonify({"success": False, "error": f"scenario not found: {DEMO_SCENARIO}"}), 500
    if not ORCHESTRATOR_VENV_PYTHON.exists():
        return jsonify({"success": False, "error": "venv python not found"}), 500

    run_id = "demo_" + datetime.utcnow().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:6]
    log_path = RUNS_DIR / f"{run_id}.log"
    RUNS_DIR.mkdir(parents=True, exist_ok=True)

    cmd = [
        str(ORCHESTRATOR_VENV_PYTHON),
        str(ORCHESTRATOR_SCRIPT),
        str(DEMO_SCENARIO),
        DEMO_PARENT_SIM_ID,
        "--num-branches", str(DEMO_NUM_BRANCHES),
        "--branch-timeout", "1800",
        "--poll-interval", "15",
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
    )

    # Background thread: wait for process to finish, find the manifest, update registry
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


@app.route("/api/status/<run_id>")
def api_status(run_id: str):
    rec = _get_run(run_id)
    if not rec:
        return jsonify({"error": "unknown run_id"}), 404
    log_path = Path(rec.get("log_path", ""))
    log_tail = _read_log_tail(log_path, 80) if log_path.exists() else ""
    return jsonify({
        "run_id": run_id,
        "status": rec.get("status"),
        "log_tail": log_tail,
        "manifest_path": rec.get("manifest_path"),
    })


@app.route("/api/runs")
def api_runs():
    """List past completed runs (from registry + manifest files in runs/)."""
    items = []
    # From registry first
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
    # Plus standalone manifests not in registry
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


@app.route("/run/<run_id>")
@app.route("/run/<run_id>/live")
def view_run_live(run_id: str):
    """Live tree page — minimal scaffold + JS poller. Works for in-flight + completed runs."""
    rec = _get_run(run_id)
    if not rec:
        abort(404)
    return _live_tree_page(run_id, rec.get("scenario_name") or "WorldFork ensemble")


@app.route("/api/run/<run_id>/state")
def api_run_state(run_id: str):
    """Return current SVG + summary for the live polling page."""
    rec = _get_run(run_id)
    if not rec:
        return jsonify({"error": "unknown run_id"}), 404

    with open(DEMO_SCENARIO) as f:
        scenario = yaml.safe_load(f)
    horizon = (scenario.get("simulation") or {}).get("horizon_rounds", 20)
    fork = (scenario.get("branching") or {}).get("fork_round", 1)
    platform = (scenario.get("simulation") or {}).get("platform", "reddit")

    state = assemble_live_state(
        rec,
        backend_url="http://localhost:5001",
        uploads_root=UPLOADS_ROOT,
        horizon_rounds=horizon,
        platform=platform,
        fork_round=fork,
    )

    pseudo_manifest = {
        "scenario_name": scenario.get("name"),
        "branches": state["branches"],
    }

    svg = render_tree_svg(
        pseudo_manifest, state["timelines"], scenario["outcomes"],
        horizon_rounds=horizon, fork_round=fork,
        expected_n_branches=DEMO_NUM_BRANCHES,
    )

    # Headline summary for the header
    summary_html = ""
    if state.get("manifest"):
        var_stats = aggregate_variables(state["manifest"], scenario["outcomes"])
        primary = (scenario.get("aggregation") or {}).get(
            "primary_split", scenario["outcomes"][0]["name"]
        )
        ps = var_stats.get(primary)
        if ps and ps.summary.get("probability") is not None:
            p = ps.summary["probability"]
            lo = ps.summary.get("ci_low") or 0
            hi = ps.summary.get("ci_high") or 1
            n_valid = sum(1 for b in state["manifest"]["branches"] if b.get("valid"))
            n_total = len(state["manifest"]["branches"])
            summary_html = (
                f"<strong>{n_valid}/{n_total} valid</strong> &nbsp;·&nbsp; "
                f"P({primary}) = <strong>{p*100:.1f}%</strong> "
                f"<span style='color:#6b7280'>[{lo*100:.1f}%, {hi*100:.1f}%]</span>"
            )
    elif state["phase"] in ("running", "branches_starting", "classifying"):
        active_n = sum(1 for b in state["branches"] if b.get("status") in ("running", "started"))
        done_n = sum(1 for b in state["branches"] if b.get("status") in ("completed", "classified"))
        summary_html = (
            f"<strong>phase:</strong> {state['phase']} &nbsp;·&nbsp; "
            f"{done_n}/{DEMO_NUM_BRANCHES} branches done, {active_n} running"
        )
    else:
        summary_html = f"<strong>phase:</strong> {state['phase']}"

    # Build per-branch payload for the side panel (some fields may be partial in live mode)
    payloads = []
    for b in state["branches"]:
        payloads.append({
            "label": b.get("label"),
            "child_sim_id": b.get("child_sim_id"),
            "status": b.get("status"),
            "current_round": b.get("current_round"),
            "total_rounds": b.get("total_rounds"),
            "valid": b.get("valid"),
            "invalid_reason": b.get("invalid_reason"),
            "outcomes": b.get("outcomes") or {},
            "perturbation_text": b.get("perturbation_text") or "",
            "mood_modifier": b.get("mood_modifier") or "",
            "classifier_reasoning": b.get("classifier_reasoning") or "",
        })

    return jsonify({
        "run_id": run_id,
        "phase": state["phase"],
        "status": rec.get("status"),
        "svg": svg,
        "summary_html": summary_html,
        "log_tail": state["log_tail"],
        "branches": payloads,
        "scenario_name": scenario.get("name"),
        "fork_round": fork,
        "horizon_rounds": horizon,
        "is_terminal": state["phase"] in ("complete", "failed"),
    })


@app.route("/existing/<basename>")
def view_existing(basename: str):
    """Synthesize a registry entry for a manifest already on disk, then redirect to the live page."""
    if not re.match(r"^[a-zA-Z0-9_\-]+$", basename):
        abort(400)
    mp = RUNS_DIR / f"{basename}.json"
    if not mp.exists():
        abort(404)
    run_id = "view_" + basename
    rec = _get_run(run_id)
    if not rec:
        _update_run(
            run_id,
            status="completed",
            phase="complete",
            manifest_path=str(mp),
            log_path=str(RUNS_DIR / f"{basename}.log"),
            scenario_name=basename,
            started_at=datetime.utcnow().isoformat() + "Z",
        )
    return redirect(url_for("view_run_live", run_id=run_id))


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------

def _read_log_tail(path: Path, n_lines: int = 80) -> str:
    try:
        with open(path, "r") as f:
            lines = f.readlines()
        return "".join(lines[-n_lines:])
    except Exception:
        return ""


def _extract_manifest_path(log_text: str) -> str | None:
    m = re.search(r"wrote manifest → (\S+)", log_text)
    return m.group(1) if m else None


def _live_tree_page(run_id: str, title: str) -> str:
    """HTML scaffold for the live tree view. JS polls /api/run/<id>/state every 3 sec
    and replaces the tree-pane innerHTML with the freshly-rendered SVG."""
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>WorldFork — {title}</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
            margin: 0; background: #f9fafb; color: #1f2937; }}
    header {{ background: white; border-bottom: 1px solid #e5e7eb; padding: 1.2em 2em;
              display: flex; justify-content: space-between; align-items: center; }}
    header h1 {{ margin: 0; font-size: 1.3em; }}
    header .meta {{ color: #6b7280; font-size: 0.9em; margin-top: 0.2em; }}
    header a.back {{ color: #4f46e5; text-decoration: none; font-size: 0.9em; }}
    header a.back:hover {{ text-decoration: underline; }}
    .summary-bar {{ background: #eef2ff; padding: 0.8em 2em; border-bottom: 1px solid #c7d2fe;
                     font-size: 0.95em; }}
    .summary-bar .phase-chip {{ background: white; padding: 0.2em 0.6em; border-radius: 4px;
                                 font-family: ui-monospace, monospace; font-size: 0.85em;
                                 margin-right: 0.6em; border: 1px solid #d1d5db; }}
    .summary-bar .pulse {{ display: inline-block; width: 8px; height: 8px; border-radius: 50%;
                            background: #10b981; margin-right: 0.4em; vertical-align: middle;
                            animation: pulse 1.6s infinite; }}
    @keyframes pulse {{ 0%, 100% {{ opacity: 1; }} 50% {{ opacity: 0.3; }} }}
    .layout {{ display: flex; gap: 1.5em; padding: 1.5em 2em; min-height: calc(100vh - 130px); }}
    .tree-pane {{ flex: 1; background: white; border: 1px solid #e5e7eb; border-radius: 8px;
                   padding: 1em; overflow: auto; }}
    .side {{ width: 360px; flex: 0 0 360px; background: white; border: 1px solid #e5e7eb;
              border-radius: 8px; padding: 1em; max-height: calc(100vh - 160px); overflow: auto; }}
    .side h3 {{ margin: 0 0 0.4em 0; font-size: 1.05em; }}
    .side .placeholder {{ color: #9ca3af; font-style: italic; }}
    .side .field {{ margin-top: 0.9em; }}
    .side .field-label {{ font-size: 0.78em; text-transform: uppercase; letter-spacing: 0.06em;
                           color: #6b7280; font-weight: 600; margin-bottom: 0.2em; }}
    .side .blockquote {{ background: #f3f4f6; border-radius: 4px; padding: 0.5em 0.7em;
                          font-size: 0.88em; color: #374151; line-height: 1.5; }}
    .side .outcome-grid {{ display: grid; grid-template-columns: max-content 1fr;
                            gap: 0.25em 0.7em; font-size: 0.9em; }}
    .side .outcome-grid .key {{ color: #6b7280; }}
    .side .outcome-grid .val {{ font-weight: 600; }}
    .wf-tooltip {{ position: fixed; pointer-events: none; background: #1f2937; color: white;
                    padding: 0.6em 0.8em; border-radius: 6px; font-size: 0.85em;
                    max-width: 360px; line-height: 1.45; opacity: 0; transition: opacity 0.12s;
                    z-index: 100; box-shadow: 0 8px 22px rgba(0,0,0,0.18); }}
    .wf-tooltip.visible {{ opacity: 1; }}
    .wf-branch:hover line {{ filter: brightness(1.15); }}
    .wf-branch.selected line {{ filter: brightness(1.4) drop-shadow(0 0 4px currentColor); }}
    .wf-running-marker {{ animation: marker-pulse 1.2s infinite; }}
    @keyframes marker-pulse {{ 0%, 100% {{ r: 4; opacity: 1; }} 50% {{ r: 6; opacity: 0.55; }} }}
    .log-pane {{ font-family: ui-monospace, monospace; font-size: 0.75em; color: #475569;
                  background: #f1f5f9; padding: 0.6em 0.8em; border-radius: 4px;
                  margin-top: 1em; max-height: 140px; overflow-y: auto; white-space: pre-wrap; }}
    .log-pane summary {{ cursor: pointer; color: #4f46e5; font-family: system-ui;
                          font-size: 1em; padding: 0.4em 0; }}
  </style>
</head>
<body>
  <header>
    <div>
      <h1>WorldFork — live ensemble</h1>
      <div class="meta">run id: <code>{run_id}</code></div>
    </div>
    <a class="back" href="/">← Back to start</a>
  </header>
  <div class="summary-bar" id="summaryBar">Initializing…</div>
  <div class="layout">
    <div class="tree-pane" id="treePane">
      <div style="padding: 2em; color: #9ca3af; text-align: center;">Loading tree…</div>
    </div>
    <div class="side" id="side">
      <h3>Branch detail</h3>
      <p class="placeholder">Hover or click a branch to see its details.<br><br>
         The tree fills in live as branches are created, run, and classified.</p>
    </div>
  </div>
  <details class="log-pane" style="margin: 0 2em 2em;">
    <summary>orchestrator log (live tail)</summary>
    <pre id="logPane" style="margin: 0; padding: 0.6em 0.8em; background: #f1f5f9; border-radius: 4px; max-height: 240px; overflow-y: auto;"></pre>
  </details>

  <script>
    const RUN_ID = {json.dumps(run_id)};
    const POLL_MS = 3000;
    let branchData = [];
    const byLabel = {{}};
    let pollTimer = null;
    let selectedLabel = null;

    const tooltip = document.createElement('div');
    tooltip.className = 'wf-tooltip';
    document.body.appendChild(tooltip);

    function showTooltip(e, html) {{
      tooltip.innerHTML = html;
      tooltip.classList.add('visible');
      positionTooltip(e);
    }}
    function positionTooltip(e) {{
      const x = Math.min(e.clientX + 14, window.innerWidth - tooltip.offsetWidth - 14);
      const y = Math.min(e.clientY + 14, window.innerHeight - tooltip.offsetHeight - 14);
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    }}
    function hideTooltip() {{ tooltip.classList.remove('visible'); }}

    function bindBranchHandlers() {{
      document.querySelectorAll('.wf-branch').forEach(g => {{
        g.addEventListener('mouseenter', e => showTooltip(e, g.dataset.tooltip));
        g.addEventListener('mousemove', e => positionTooltip(e));
        g.addEventListener('mouseleave', hideTooltip);
        g.addEventListener('click', () => {{
          document.querySelectorAll('.wf-branch.selected').forEach(x => x.classList.remove('selected'));
          g.classList.add('selected');
          selectedLabel = g.dataset.label;
          renderSidePanel(byLabel[selectedLabel]);
        }});
      }});
    }}

    function escapeHtml(s) {{
      if (!s) return '';
      return String(s).replace(/[&<>'"]/g,
        c => ({{ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }}[c]));
    }}

    function renderSidePanel(branch) {{
      const side = document.getElementById('side');
      if (!branch) {{
        side.innerHTML = "<h3>Branch detail</h3><p class='placeholder'>Hover or click a branch to see its details.<br><br>The tree fills in live as branches are created, run, and classified.</p>";
        return;
      }}
      const outcomes = branch.outcomes || {{}};
      const outcomeRows = Object.entries(outcomes).map(([k, v]) => {{
        let val = v;
        if (v === null || v === undefined) val = '—';
        else if (typeof v === 'boolean') val = v ? 'true' : 'false';
        else if (typeof v === 'number') val = Number.isInteger(v) ? v : v.toFixed(2);
        return `<div class='key'>${{k}}</div><div class='val'>${{val}}</div>`;
      }}).join('');
      const status = branch.status || 'pending';
      const statusColors = {{
        pending: '#9ca3af', created: '#6b7280', started: '#0891b2',
        running: '#0284c7', completed: '#059669', classified: '#16a34a', invalid: '#dc2626'
      }};
      const sc = statusColors[status] || '#374151';
      const cr = (branch.current_round !== null && branch.current_round !== undefined) ? `${{branch.current_round}}/${{branch.total_rounds || ''}}` : '—';
      side.innerHTML = `
        <h3>${{escapeHtml(branch.label)}}</h3>
        <div style='font-size:0.85em;margin-bottom:0.3em'>
          <span style='color:${{sc}};font-weight:700'>● ${{status}}</span>
          &nbsp;·&nbsp; <span style='color:#6b7280'>round ${{cr}}</span>
        </div>
        <div class='field'>
          <div class='field-label'>Outcomes</div>
          ${{Object.keys(outcomes).length
            ? `<div class='outcome-grid'>${{outcomeRows}}</div>`
            : "<div class='placeholder'>(awaiting classifier)</div>"}}
        </div>
        ${{branch.perturbation_text ? `
          <div class='field'>
            <div class='field-label'>Perturbation event</div>
            <div class='blockquote'>${{escapeHtml(branch.perturbation_text)}}</div>
          </div>` : ''}}
        ${{branch.mood_modifier ? `
          <div class='field'>
            <div class='field-label'>Mood modifier (private to agents)</div>
            <div class='blockquote'>${{escapeHtml(branch.mood_modifier)}}</div>
          </div>` : ''}}
        ${{branch.classifier_reasoning ? `
          <div class='field'>
            <div class='field-label'>Classifier reasoning</div>
            <div class='blockquote'>${{escapeHtml(branch.classifier_reasoning)}}</div>
          </div>` : ''}}
        ${{branch.invalid_reason ? `
          <div class='field'>
            <div class='field-label'>Invalid</div>
            <div class='blockquote' style='background:#fef2f2;color:#7f1d1d'>${{escapeHtml(branch.invalid_reason)}}</div>
          </div>` : ''}}
      `;
    }}

    async function pollState() {{
      try {{
        const res = await fetch('/api/run/' + RUN_ID + '/state');
        const data = await res.json();
        if (data.error) {{
          document.getElementById('summaryBar').textContent = 'Error: ' + data.error;
          return;
        }}
        // Replace tree
        document.getElementById('treePane').innerHTML = data.svg;
        bindBranchHandlers();
        // Refresh side panel if a branch was selected
        branchData = data.branches || [];
        Object.keys(byLabel).forEach(k => delete byLabel[k]);
        for (const b of branchData) byLabel[b.label] = b;
        if (selectedLabel && byLabel[selectedLabel]) {{
          renderSidePanel(byLabel[selectedLabel]);
        }}
        // Summary bar
        const isRunning = !data.is_terminal;
        const dot = isRunning ? '<span class="pulse"></span>' : '';
        document.getElementById('summaryBar').innerHTML =
          dot + '<span class="phase-chip">' + data.phase + '</span>' + (data.summary_html || '');
        // Log tail
        if (data.log_tail) {{
          const pane = document.getElementById('logPane');
          pane.textContent = data.log_tail;
          pane.scrollTop = pane.scrollHeight;
        }}
        // Stop polling once we hit a terminal phase
        if (data.is_terminal && pollTimer) {{
          clearInterval(pollTimer);
          pollTimer = null;
        }}
      }} catch (e) {{
        console.error('poll error', e);
      }}
    }}

    // Kick off polling immediately + at interval
    pollState();
    pollTimer = setInterval(pollState, POLL_MS);
  </script>
</body>
</html>"""


def _render_run(manifest_path: Path) -> str:
    manifest = json.loads(manifest_path.read_text())
    with open(DEMO_SCENARIO) as f:
        scenario = yaml.safe_load(f)
    horizon = (scenario.get("simulation") or {}).get("horizon_rounds", 20)
    fork = (scenario.get("branching") or {}).get("fork_round", 1)
    platform = (scenario.get("simulation") or {}).get("platform", "reddit")

    timelines = extract_all_branches(manifest, UPLOADS_ROOT,
                                      horizon_rounds=horizon, platform=platform)

    # Build aggregated summary on the fly so the header shows headline P
    var_stats = aggregate_variables(manifest, scenario["outcomes"])
    aggregated = {
        "scenario_name": manifest.get("scenario_name"),
        "n_total_branches": len(manifest["branches"]),
        "n_valid_branches": sum(1 for b in manifest["branches"] if b.get("valid")),
        "primary_split": (scenario.get("aggregation") or {}).get(
            "primary_split", scenario["outcomes"][0]["name"]
        ),
        "variables": {
            name: {**vs.summary, "type": vs.type}
            for name, vs in var_stats.items()
        },
    }

    return render_tree_page(
        manifest, timelines, scenario["outcomes"],
        horizon_rounds=horizon, fork_round=fork,
        title=f"WorldFork — {manifest.get('scenario_name')}",
        aggregated=aggregated,
    )


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("WF_PORT", 5050))
    print(f"[worldfork-ui] starting on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
