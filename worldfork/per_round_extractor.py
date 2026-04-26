"""Extract per-round activity data from a finished branch.

The tree visualization paints a 'heat strip' along each branch — each
horizontal slice corresponds to one round. To compute it, we walk the
branch's events.jsonl + sqlite and bucket activity by round number.

For v0 we use simple proxies for "intensity":
  - posts_per_round (most stable; from sqlite)
  - decisions_per_round (from agent_decision events; agents that took action that round)

A future v0.5 could classify per-round sentiment via the classifier on each
round's text slice, but that's expensive (1 LLM call per round per branch
= 20 × 8 = 160 extra calls for an N=8 ensemble). Activity proxies are good
enough for the visual signal.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

# A round is roughly an hour of simulated time in MiroShark, but we don't
# trust that 1:1 across platforms. We extract the round_num field directly
# from events when present, falling back to time-bucketing if not.


def extract_branch_timeline(
    sim_dir: Path,
    platform: str = "reddit",
    horizon_rounds: int = 20,
) -> dict[int, dict]:
    """Return per-round activity dict: {round_num: {posts, decisions, ...}}.

    Always returns entries for rounds 0..horizon_rounds-1, even if some are zero.
    """
    sim_dir = Path(sim_dir)
    timeline: dict[int, dict] = {
        r: {"round": r, "posts": 0, "decisions": 0, "comments": 0}
        for r in range(horizon_rounds)
    }

    # ----- agent_decision counts per round -----
    events_path = sim_dir / "events.jsonl"
    if events_path.exists():
        # decisions are the per-round work units; we count by timestamp ordering
        # since round_num is null in current logging
        decisions_by_ts: list[float] = []
        for line in events_path.read_text().splitlines():
            try:
                e = json.loads(line)
            except Exception:
                continue
            if e.get("event_type") != "agent_decision":
                continue
            ts = e.get("timestamp")
            if not ts:
                continue
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                decisions_by_ts.append(dt.timestamp())
            except Exception:
                pass

        if decisions_by_ts:
            decisions_by_ts.sort()
            # Buckets: split events into horizon_rounds equal time slices.
            t0, t1 = decisions_by_ts[0], decisions_by_ts[-1]
            span = max(1.0, t1 - t0)
            for ts in decisions_by_ts:
                bucket = min(horizon_rounds - 1,
                             int((ts - t0) / span * horizon_rounds))
                timeline[bucket]["decisions"] += 1

    # ----- post + comment counts per round -----
    db_path = sim_dir / f"{platform}_simulation.db"
    if db_path.exists():
        try:
            conn = sqlite3.connect(str(db_path))
            posts = conn.execute("SELECT created_at FROM post").fetchall()
            comments = conn.execute("SELECT created_at FROM comment").fetchall()
            conn.close()
        except Exception:
            posts, comments = [], []

        def _bucket_by_time(rows: list[tuple], key: str):
            ts_list = []
            for (s,) in rows:
                if not s:
                    continue
                # Try sqlite "%Y-%m-%d %H:%M:%S(.%f)" format
                try:
                    dt = datetime.strptime(s, "%Y-%m-%d %H:%M:%S.%f")
                except ValueError:
                    try:
                        dt = datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
                    except ValueError:
                        continue
                ts_list.append(dt.timestamp())
            if not ts_list:
                return
            ts_list.sort()
            t0, t1 = ts_list[0], ts_list[-1]
            span = max(1.0, t1 - t0)
            for ts in ts_list:
                bucket = min(horizon_rounds - 1,
                             int((ts - t0) / span * horizon_rounds))
                timeline[bucket][key] += 1

        _bucket_by_time(posts, "posts")
        _bucket_by_time(comments, "comments")

    # Aggregate intensity = decisions + posts*3 + comments
    # (posts weighted higher because they signify someone actively contributing,
    # not just reacting)
    for r, row in timeline.items():
        row["intensity"] = row["decisions"] + row["posts"] * 3 + row["comments"]

    return timeline


def extract_all_branches(
    manifest: dict,
    uploads_root: Path,
    horizon_rounds: int = 20,
    platform: str = "reddit",
) -> dict[str, dict[int, dict]]:
    """Extract per-round timelines for every branch in a manifest.

    Returns: {branch_label: {round_num: row}}.
    """
    out: dict[str, dict[int, dict]] = {}
    for b in manifest["branches"]:
        if not b.get("child_sim_id"):
            continue
        sim_dir = uploads_root / "simulations" / b["child_sim_id"]
        out[b["label"]] = extract_branch_timeline(sim_dir, platform, horizon_rounds)
    return out
