"""Live state assembler — turns an in-flight orchestrator run into a snapshot
that the tree renderer can paint.

Inputs:
  - the orchestrator's stdout log file (parses progress phases)
  - MiroShark backend's /api/simulation/<id>/run-status (current_round per child)
  - each child's events.jsonl + sqlite (per-round intensity data, polled cheaply)
  - the final manifest file (only present after the run completes)

Output: a dict that mirrors what render_tree_page expects, but with per-branch
`status` and `live_round` fields so the renderer knows how much of each branch
to fill in.

Phases:
  initializing       — orchestrator just started, no log content yet
  perturbations_pending — log shows "verifying parent" or "generating perturbations"
  perturbations_ready   — perturbations generated; no branches created yet
  branches_creating  — some branches have been forked
  branches_starting  — runners are spawning
  running            — sim loops in flight; track current_round per child
  classifying        — runners done, classifier sweeping
  complete           — manifest written
  failed             — runner exited with error
"""

from __future__ import annotations

import json
import re
import sqlite3
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any


# Patterns in the orchestrator log
RX_VERIFY_PARENT = re.compile(r"verifying parent (\S+)")
RX_PERTURB_GEN = re.compile(r"generating (\d+) perturbations")
RX_PERTURB_LOAD = re.compile(r"loaded (\d+) perturbations")
RX_BRANCH_CREATED = re.compile(r"\[(\S+)\] → (sim_\S+)")
RX_BRANCH_STARTED = re.compile(r"\[(\S+)\] started \(pid=(\d+)\)")
RX_BRANCH_PROGRESS = re.compile(r"\[(\S+)\] (running|completed) (?:at round )?(\d+)/(\d+)")
RX_CLASSIFIED = re.compile(r"\[(\S+)\] classified: ({.*})")
RX_INVALID = re.compile(r"\[(\S+)\] INVALID: (.+)")
RX_MANIFEST = re.compile(r"wrote manifest → (\S+)")


def _read_log(path: Path) -> str:
    if not path.exists():
        return ""
    try:
        return path.read_text()
    except Exception:
        return ""


def _detect_phase(log: str, manifest_path: str | None, manifest_exists: bool) -> str:
    if manifest_exists:
        return "complete"
    if "validating + classifying" in log:
        return "classifying"
    if RX_BRANCH_PROGRESS.search(log):
        return "running"
    if "starting " in log and "runners" in log:
        return "branches_starting"
    if "creating " in log and "branches" in log:
        return "branches_creating"
    if "perturbations" in log and ("loaded" in log or "got " in log):
        return "perturbations_ready"
    if "verifying parent" in log:
        return "perturbations_pending"
    return "initializing"


# ---------------------------------------------------------------------------
# Per-branch live state
# ---------------------------------------------------------------------------

def _query_run_status(backend_url: str, sim_id: str) -> dict | None:
    """Hit MiroShark's /run-status endpoint (sync, short timeout)."""
    try:
        url = f"{backend_url.rstrip('/')}/api/simulation/{sim_id}/run-status"
        with urllib.request.urlopen(url, timeout=3) as resp:
            data = json.loads(resp.read())
        if data.get("success"):
            return data.get("data") or {}
    except Exception:
        return None
    return None


def _read_intensity_so_far(
    sim_dir: Path,
    platform: str,
    horizon_rounds: int,
    current_round: int,
) -> dict[int, dict]:
    """Cheap per-round intensity from sqlite. Buckets activity into rounds 0..current_round."""
    timeline = {r: {"round": r, "posts": 0, "decisions": 0, "comments": 0, "intensity": 0}
                for r in range(horizon_rounds)}
    db_path = sim_dir / f"{platform}_simulation.db"
    if not db_path.exists() or current_round <= 0:
        return timeline
    try:
        conn = sqlite3.connect(str(db_path))
        posts = conn.execute("SELECT created_at FROM post").fetchall()
        comments = conn.execute("SELECT created_at FROM comment").fetchall()
        conn.close()
    except Exception:
        return timeline

    def _bucket(rows, key):
        ts = []
        for (s,) in rows:
            if not s:
                continue
            try:
                dt = datetime.strptime(s, "%Y-%m-%d %H:%M:%S.%f")
            except ValueError:
                try:
                    dt = datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    continue
            ts.append(dt.timestamp())
        if not ts or current_round == 0:
            return
        ts.sort()
        t0, t1 = ts[0], ts[-1]
        span = max(1.0, t1 - t0)
        # Map across CURRENT visible window (0..current_round), since the rest
        # of horizon_rounds isn't reached yet.
        for x in ts:
            bucket = min(max(0, current_round - 1),
                         int((x - t0) / span * max(1, current_round)))
            timeline[bucket][key] += 1

    _bucket(posts, "posts")
    _bucket(comments, "comments")
    for r, row in timeline.items():
        row["intensity"] = row["decisions"] + row["posts"] * 3 + row["comments"]
    return timeline


def assemble_live_state(
    rec: dict,
    *,
    backend_url: str,
    uploads_root: Path,
    horizon_rounds: int,
    platform: str,
    fork_round: int,
) -> dict:
    """Return a dict that the live tree renderer consumes."""
    log_path = Path(rec.get("log_path", ""))
    log = _read_log(log_path)

    # -------- branch table --------
    # Build a dict keyed by label that we fill in as we walk through log/file state
    branch_table: dict[str, dict] = {}

    for label, sim_id in RX_BRANCH_CREATED.findall(log):
        branch_table.setdefault(label, {})
        branch_table[label]["label"] = label
        branch_table[label]["child_sim_id"] = sim_id
        branch_table[label]["status"] = "created"

    for label, _pid in RX_BRANCH_STARTED.findall(log):
        if label in branch_table:
            branch_table[label]["status"] = "started"

    # Latest progress per label
    last_progress: dict[str, dict] = {}
    for label, status, cur, tot in RX_BRANCH_PROGRESS.findall(log):
        last_progress[label] = {
            "status_word": status,
            "current_round": int(cur),
            "total_rounds": int(tot),
        }
    for label, p in last_progress.items():
        if label in branch_table:
            branch_table[label]["current_round"] = p["current_round"]
            branch_table[label]["total_rounds"] = p["total_rounds"]
            if p["status_word"] == "completed":
                branch_table[label]["status"] = "completed"
            else:
                branch_table[label]["status"] = "running"

    # Classified outcomes
    for label, payload_str in RX_CLASSIFIED.findall(log):
        try:
            outcomes = eval(payload_str, {"__builtins__": {}}, {"True": True, "False": False, "None": None})
        except Exception:
            outcomes = None
        if label in branch_table:
            branch_table[label]["outcomes"] = outcomes
            branch_table[label]["status"] = "classified"

    for label, reason in RX_INVALID.findall(log):
        if label in branch_table:
            branch_table[label]["status"] = "invalid"
            branch_table[label]["invalid_reason"] = reason

    # Live polling for branches that are running (current_round may be stale in log)
    for label, br in list(branch_table.items()):
        if br.get("status") in ("running", "started") and br.get("child_sim_id"):
            live = _query_run_status(backend_url, br["child_sim_id"])
            if live:
                br["current_round"] = live.get("current_round", br.get("current_round", 0))
                br["total_rounds"] = live.get("total_rounds", br.get("total_rounds", horizon_rounds))
                if live.get("runner_status") == "completed":
                    br["status"] = "completed"

    # Perturbation text + mood mapping is only available after the manifest
    # exists; in the meantime the labels are enough to draw placeholder lines
    # and the user can hover for "(awaiting outcomes)".

    # If manifest exists, override branch_table with the rich version
    manifest = None
    mp_str = rec.get("manifest_path")
    if not mp_str:
        m = RX_MANIFEST.search(log)
        if m:
            mp_str = m.group(1)
    if mp_str and Path(mp_str).exists():
        try:
            manifest = json.loads(Path(mp_str).read_text())
            for b in manifest["branches"]:
                label = b.get("label", "")
                merged = branch_table.get(label, {})
                merged.update({
                    "label": label,
                    "child_sim_id": b.get("child_sim_id"),
                    "perturbation_text": b.get("perturbation_text"),
                    "mood_modifier": b.get("mood_modifier"),
                    "outcomes": b.get("outcomes"),
                    "valid": b.get("valid"),
                    "invalid_reason": b.get("invalid_reason"),
                    "classifier_reasoning": b.get("classifier_reasoning"),
                    "final_round": b.get("final_round"),
                    "total_rounds": b.get("total_rounds"),
                    "posts_count": b.get("posts_count"),
                    "status": "classified" if b.get("valid") else "invalid",
                })
                branch_table[label] = merged
        except Exception:
            pass

    # Phase
    phase = _detect_phase(log, mp_str, manifest is not None)
    if rec.get("status") == "failed":
        phase = "failed"

    # Order branches: prefer the order they were created in (already in dict insertion order)
    branches = list(branch_table.values())

    # Per-branch timelines (intensity per round so far)
    timelines: dict[str, dict[int, dict]] = {}
    for br in branches:
        sim_id = br.get("child_sim_id")
        if not sim_id:
            continue
        cr = br.get("current_round", 0)
        sim_dir = uploads_root / "simulations" / sim_id
        timelines[br["label"]] = _read_intensity_so_far(sim_dir, platform, horizon_rounds, cr)

    return {
        "run_id": rec.get("run_id"),
        "phase": phase,
        "status": rec.get("status"),
        "started_at": rec.get("started_at"),
        "log_tail": "\n".join(log.splitlines()[-30:]),
        "branches": branches,
        "timelines": timelines,
        "manifest": manifest,
        "manifest_path": mp_str,
        "fork_round": fork_round,
        "horizon_rounds": horizon_rounds,
    }
