"""Branch orchestrator (Phase 3).

Takes a scenario YAML + a parent simulation that already has profiles ready,
and produces N completed sibling branches plus a results manifest.

Pipeline:

  1. Generate N perturbations  (Phase 2 — perturbation_generator)
  2. For each perturbation, POST /api/simulation/branch-counterfactual
     → collect N child sim_ids
  3. For each child, POST /api/simulation/start
  4. Async-poll /api/simulation/<id>/run-status until each child reaches
     a terminal status (COMPLETED / FAILED / STOPPED) or hits timeout
  5. For each completed valid child, run the Phase 1 classifier
  6. Write a results manifest JSON ready for Phase 4 (aggregator)

Why parent_sim_id is passed in (vs bootstrapped):
  Bootstrapping a fresh parent requires a project + graph build + profile
  generation pipeline, which is multiple async endpoints with their own
  polling. For v0 we sidestep that by reusing an existing parent. Adding
  bootstrap is straightforward extension work for v0.5.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
import yaml


# Make the worldfork package importable when running as a script
sys.path.insert(0, str(Path(__file__).parent.parent))

from worldfork.classifier import classify  # noqa: E402
from worldfork.perturbation_generator import (  # noqa: E402
    generate_perturbations,
    load_scenario,
)
from worldfork.bootstrap import bootstrap_parent  # noqa: E402
from worldfork.mood_perturbator import apply_mood_modifier  # noqa: E402


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

DEFAULT_BACKEND = "http://localhost:5001"
DEFAULT_POLL_INTERVAL_SEC = 10
DEFAULT_BRANCH_TIMEOUT_SEC = 1800  # 30 minutes max wall-clock per branch

# Terminal runner_status values (poll loop stops when one of these is reached)
TERMINAL_STATUSES = {"completed", "failed", "stopped"}


# ---------------------------------------------------------------------------
# Branch state
# ---------------------------------------------------------------------------

@dataclass
class BranchResult:
    """Per-branch result row."""
    label: str
    perturbation_text: str
    parent_sim_id: str
    mood_modifier: str | None = None
    child_sim_id: str | None = None
    runner_status: str | None = None
    valid: bool = False
    invalid_reason: str | None = None
    final_round: int | None = None
    total_rounds: int | None = None
    posts_count: int | None = None
    mood_applied_counts: dict | None = None
    outcomes: dict | None = None
    classifier_reasoning: str | None = None
    classifier_meta: dict | None = None
    duration_sec: float | None = None


# ---------------------------------------------------------------------------
# Backend client (thin wrappers over httpx)
# ---------------------------------------------------------------------------

class BackendClient:
    def __init__(self, base_url: str, timeout: float = 60.0):
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(timeout=timeout)

    async def aclose(self):
        await self._client.aclose()

    async def get_simulation(self, sim_id: str) -> dict:
        r = await self._client.get(f"{self.base_url}/api/simulation/{sim_id}")
        r.raise_for_status()
        body = r.json()
        if not body.get("success"):
            raise RuntimeError(f"GET /simulation/{sim_id} failed: {body.get('error')}")
        return body["data"]

    async def branch_counterfactual(
        self,
        parent_sim_id: str,
        injection_text: str,
        trigger_round: int,
        label: str | None = None,
    ) -> dict:
        payload = {
            "parent_simulation_id": parent_sim_id,
            "injection_text": injection_text,
            "trigger_round": trigger_round,
        }
        if label:
            payload["label"] = label
            payload["branch_id"] = label
        r = await self._client.post(
            f"{self.base_url}/api/simulation/branch-counterfactual",
            json=payload,
        )
        r.raise_for_status()
        body = r.json()
        if not body.get("success"):
            raise RuntimeError(f"branch-counterfactual failed: {body.get('error')}")
        return body["data"]

    async def start_simulation(
        self,
        sim_id: str,
        platform: str = "parallel",
        max_rounds: int | None = None,
    ) -> dict:
        payload: dict[str, Any] = {"simulation_id": sim_id, "platform": platform}
        if max_rounds is not None:
            payload["max_rounds"] = max_rounds
        r = await self._client.post(
            f"{self.base_url}/api/simulation/start",
            json=payload,
        )
        r.raise_for_status()
        body = r.json()
        if not body.get("success"):
            raise RuntimeError(f"start failed for {sim_id}: {body.get('error')}")
        return body["data"]

    async def get_run_status(self, sim_id: str) -> dict:
        r = await self._client.get(
            f"{self.base_url}/api/simulation/{sim_id}/run-status",
            timeout=15.0,
        )
        r.raise_for_status()
        body = r.json()
        if not body.get("success"):
            raise RuntimeError(f"run-status failed for {sim_id}: {body.get('error')}")
        return body["data"]


# ---------------------------------------------------------------------------
# Polling
# ---------------------------------------------------------------------------

async def _poll_one_to_completion(
    client: BackendClient,
    sim_id: str,
    label: str,
    poll_interval: int,
    timeout_sec: int,
) -> tuple[str, dict | None]:
    """Poll a single child sim until it reaches a terminal status or times out.

    Returns (final_status, last_run_state_dict_or_None).
    """
    start = time.time()
    last_state: dict | None = None
    while time.time() - start < timeout_sec:
        try:
            state = await client.get_run_status(sim_id)
        except Exception as e:
            print(f"  [{label}] poll error (will retry): {e}", flush=True)
            await asyncio.sleep(poll_interval)
            continue

        last_state = state
        status = (state.get("runner_status") or "").lower()
        cur = state.get("current_round", 0)
        tot = state.get("total_rounds", 0) or "?"

        if status in TERMINAL_STATUSES:
            print(f"  [{label}] {status} at round {cur}/{tot}", flush=True)
            return status, state

        # Quiet progress every poll
        progress = state.get("progress_percent")
        if progress is not None:
            print(f"  [{label}] {status} {cur}/{tot} ({progress:.0f}%)", flush=True)
        else:
            print(f"  [{label}] {status} round {cur}", flush=True)

        await asyncio.sleep(poll_interval)

    return "timeout", last_state


# ---------------------------------------------------------------------------
# Validity checks
# ---------------------------------------------------------------------------

def _check_validity(
    branch: BranchResult,
    scenario: dict,
    sim_dir: Path,
) -> tuple[bool, str | None]:
    """Return (is_valid, reason_if_invalid)."""
    checks = scenario.get("validity_checks") or {}

    if branch.runner_status != "completed":
        return False, f"runner_status={branch.runner_status} (expected completed)"

    if checks.get("completed_all_rounds"):
        if branch.final_round is None or branch.total_rounds is None:
            return False, "no run-status data"
        if branch.final_round < branch.total_rounds - 1:
            return False, f"only ran {branch.final_round}/{branch.total_rounds} rounds"

    min_posts = checks.get("min_posts_about_topic")
    if min_posts is not None:
        # We don't filter by topic here — that's the classifier's job.
        # Use raw post count as a proxy: a branch with very few posts almost
        # certainly didn't engage with the topic.
        if branch.posts_count is None or branch.posts_count < min_posts:
            return False, f"only {branch.posts_count} posts (< {min_posts} required)"

    return True, None


# ---------------------------------------------------------------------------
# Filesystem helpers
# ---------------------------------------------------------------------------

def _resolve_sim_dir(uploads_root: Path, sim_id: str) -> Path:
    return uploads_root / "simulations" / sim_id


def _count_posts(sim_dir: Path, platform: str) -> int:
    import sqlite3
    db = sim_dir / f"{platform}_simulation.db"
    if not db.exists():
        return 0
    try:
        conn = sqlite3.connect(str(db))
        n = conn.execute("SELECT COUNT(*) FROM post").fetchone()[0]
        conn.close()
        return int(n)
    except Exception:
        return 0


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

@dataclass
class OrchestratorRun:
    parent_sim_id: str
    scenario_name: str
    fork_round: int
    started_at: str
    finished_at: str | None = None
    branches: list[BranchResult] = field(default_factory=list)
    duration_sec: float | None = None


async def run_ensemble(
    scenario_path: str,
    parent_sim_id: str | None = None,
    *,
    backend_url: str = DEFAULT_BACKEND,
    num_branches: int | None = None,
    uploads_root: Path | None = None,
    poll_interval: int = DEFAULT_POLL_INTERVAL_SEC,
    branch_timeout: int = DEFAULT_BRANCH_TIMEOUT_SEC,
    out_path: str | Path | None = None,
    skip_classify: bool = False,
    perturbations_override: list[dict] | None = None,
    bootstrap_if_missing: bool = True,
) -> OrchestratorRun:
    """End-to-end ensemble run.

    If parent_sim_id is None and bootstrap_if_missing=True, the bootstrap
    pipeline will be run first to produce a fresh parent.
    """
    if parent_sim_id is None:
        if not bootstrap_if_missing:
            raise ValueError("parent_sim_id is required when bootstrap_if_missing=False")
        print("[orchestrator] no parent_sim_id given — running bootstrap…", flush=True)
        parent_sim_id = await bootstrap_parent(
            scenario_path=scenario_path,
            backend_url=backend_url,
        )
    cfg = load_scenario(scenario_path)
    branching = cfg.get("branching") or {}
    n = num_branches or branching.get("num_branches", 4)
    fork_round = branching.get("fork_round", 5)
    platform = (cfg.get("simulation") or {}).get("platform", "reddit")
    horizon_rounds = (cfg.get("simulation") or {}).get("horizon_rounds")

    if uploads_root is None:
        uploads_root = Path(
            "/Users/james/Documents/WorldFork/short/MiroShark/backend/uploads"
        )

    run = OrchestratorRun(
        parent_sim_id=parent_sim_id,
        scenario_name=cfg.get("name", "unnamed"),
        fork_round=fork_round,
        started_at=datetime.utcnow().isoformat() + "Z",
    )
    run_start = time.time()

    client = BackendClient(backend_url)
    try:
        # === Verify parent exists ===
        print(f"[orchestrator] verifying parent {parent_sim_id}…", flush=True)
        parent = await client.get_simulation(parent_sim_id)
        print(f"  parent status: {parent.get('status')}", flush=True)

        # === Phase 2: generate perturbations ===
        if perturbations_override is not None:
            perturbations = perturbations_override
            print(f"[orchestrator] using {len(perturbations)} pre-supplied perturbations",
                  flush=True)
        else:
            print(f"[orchestrator] generating {n} perturbations…", flush=True)
            seed_text = cfg.get("_seed_text", "")
            context_parts = []
            if cfg.get("description"):
                context_parts.append(f"Scenario goal: {cfg['description']}")
            outcomes = cfg.get("outcomes") or []
            if outcomes:
                context_parts.append("Outcome variables being tracked:")
                for o in outcomes:
                    context_parts.append(f"  - {o['name']}: {o['description']}")
            context_parts.append(
                f"\nThe perturbations will fire at simulation round {fork_round}."
            )
            perturbations = generate_perturbations(
                seed_text=seed_text,
                n=n,
                context="\n".join(context_parts),
            )
            print(f"  got {len(perturbations)} perturbations", flush=True)

        # Initialize branch records
        for p in perturbations:
            run.branches.append(BranchResult(
                label=p["label"],
                perturbation_text=p.get("event_text", ""),
                mood_modifier=p.get("mood_modifier"),
                parent_sim_id=parent_sim_id,
            ))

        # === Step C: branch_counterfactual N times ===
        print(f"[orchestrator] creating {len(run.branches)} branches via "
              f"branch-counterfactual…", flush=True)
        for br in run.branches:
            try:
                child_state = await client.branch_counterfactual(
                    parent_sim_id=parent_sim_id,
                    injection_text=br.perturbation_text,
                    trigger_round=fork_round,
                    label=br.label,
                )
                br.child_sim_id = child_state.get("simulation_id")
                print(f"  [{br.label}] → {br.child_sim_id}", flush=True)
            except Exception as e:
                br.invalid_reason = f"branch-counterfactual failed: {e}"
                print(f"  [{br.label}] FAILED: {e}", flush=True)

        # === Step C.5: apply mood modifier (Road B) ===
        # Modify each child's profile files BEFORE start fires so the runner
        # picks up the new persona text.
        if any(br.mood_modifier for br in run.branches):
            print(f"[orchestrator] applying mood modifiers (Road B)…", flush=True)
            for br in run.branches:
                if not br.child_sim_id or not br.mood_modifier:
                    continue
                try:
                    sim_dir = _resolve_sim_dir(uploads_root, br.child_sim_id)
                    counts = apply_mood_modifier(sim_dir, br.mood_modifier)
                    br.mood_applied_counts = counts
                    print(f"  [{br.label}] mood applied: {counts}", flush=True)
                except Exception as e:
                    print(f"  [{br.label}] mood apply FAILED: {e}", flush=True)
                    # Don't invalidate — just log; the branch can still run without mood
                    br.mood_applied_counts = {"error": str(e)}

        # === Step D: start each child ===
        print(f"[orchestrator] starting {len(run.branches)} runners…", flush=True)
        for br in run.branches:
            if not br.child_sim_id:
                continue
            try:
                start_data = await client.start_simulation(
                    sim_id=br.child_sim_id,
                    platform="parallel",
                    max_rounds=horizon_rounds,
                )
                print(f"  [{br.label}] started "
                      f"(pid={start_data.get('process_pid')})", flush=True)
                # Stagger slightly so the backend doesn't spawn all subprocesses simultaneously.
                await asyncio.sleep(1.0)
            except Exception as e:
                br.invalid_reason = f"start failed: {e}"
                print(f"  [{br.label}] start FAILED: {e}", flush=True)

        # === Step D continued: poll all children to terminal status ===
        running_branches = [b for b in run.branches if b.child_sim_id and not b.invalid_reason]
        print(f"[orchestrator] polling {len(running_branches)} runners "
              f"(timeout={branch_timeout}s)…", flush=True)
        poll_tasks = [
            asyncio.create_task(
                _poll_one_to_completion(
                    client, br.child_sim_id, br.label,
                    poll_interval, branch_timeout
                )
            )
            for br in running_branches
        ]
        results = await asyncio.gather(*poll_tasks, return_exceptions=True)

        for br, res in zip(running_branches, results):
            if isinstance(res, Exception):
                br.runner_status = "error"
                br.invalid_reason = f"polling exception: {res}"
                continue
            status, state = res
            br.runner_status = status
            if state:
                br.final_round = state.get("current_round")
                br.total_rounds = state.get("total_rounds")

        # === Step E: validity check + classify ===
        print(f"[orchestrator] validating + classifying branches…", flush=True)
        for br in run.branches:
            if not br.child_sim_id:
                continue
            sim_dir = _resolve_sim_dir(uploads_root, br.child_sim_id)
            br.posts_count = _count_posts(sim_dir, platform)

            valid, reason = _check_validity(br, cfg, sim_dir)
            br.valid = valid
            if not valid:
                br.invalid_reason = reason
                print(f"  [{br.label}] INVALID: {reason}", flush=True)
                continue

            if skip_classify:
                print(f"  [{br.label}] valid, classification skipped", flush=True)
                continue

            try:
                cls = classify(sim_dir, scenario_path)
                br.outcomes = cls.get("outcomes")
                br.classifier_reasoning = cls.get("reasoning")
                br.classifier_meta = cls.get("_meta")
                print(f"  [{br.label}] classified: {br.outcomes}", flush=True)
            except Exception as e:
                br.invalid_reason = f"classifier failed: {e}"
                br.valid = False
                print(f"  [{br.label}] classifier FAILED: {e}", flush=True)

    finally:
        await client.aclose()

    run.finished_at = datetime.utcnow().isoformat() + "Z"
    run.duration_sec = time.time() - run_start

    # Per-branch durations from start to terminal
    # (simple: not tracked precisely — could enhance later)
    # Write manifest
    manifest = {
        "parent_sim_id": run.parent_sim_id,
        "scenario_name": run.scenario_name,
        "fork_round": run.fork_round,
        "started_at": run.started_at,
        "finished_at": run.finished_at,
        "duration_sec": run.duration_sec,
        "branches": [asdict(b) for b in run.branches],
        "summary": {
            "n_total": len(run.branches),
            "n_valid": sum(1 for b in run.branches if b.valid),
            "n_invalid": sum(1 for b in run.branches if not b.valid),
        },
    }

    if out_path is None:
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        out_dir = Path(__file__).parent.parent / "runs"
        out_dir.mkdir(exist_ok=True)
        out_path = out_dir / f"run_{run.scenario_name}_{ts}.json"

    Path(out_path).write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    print(f"\n[orchestrator] wrote manifest → {out_path}", flush=True)
    print(f"[orchestrator] summary: {manifest['summary']}", flush=True)
    return run


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _main():
    import argparse
    p = argparse.ArgumentParser(description="WorldFork branch orchestrator (Phase 3)")
    p.add_argument("scenario", help="Path to scenario YAML")
    p.add_argument("parent_sim_id", nargs="?", default=None,
                   help="Existing parent simulation_id (READY). If omitted, the orchestrator bootstraps a fresh parent from the scenario's seed_document.")
    p.add_argument("--backend", default=DEFAULT_BACKEND)
    p.add_argument("-n", "--num-branches", type=int, default=None)
    p.add_argument("--poll-interval", type=int, default=DEFAULT_POLL_INTERVAL_SEC)
    p.add_argument("--branch-timeout", type=int, default=DEFAULT_BRANCH_TIMEOUT_SEC)
    p.add_argument("--out", default=None, help="Manifest output path")
    p.add_argument("--skip-classify", action="store_true",
                   help="Skip classification (just produce branches)")
    p.add_argument("--perturbations-file", default=None,
                   help="Use pre-generated perturbations from a JSON file (skip Phase 2)")
    args = p.parse_args()

    # Load env from common locations
    try:
        from dotenv import load_dotenv
        for env_path in [
            Path(__file__).parent.parent / ".env",
            Path("/Users/james/Documents/WorldFork/short/MiroShark/.env"),
        ]:
            if env_path.exists():
                load_dotenv(env_path)
                break
    except ImportError:
        pass

    perturbations_override = None
    if args.perturbations_file:
        with open(args.perturbations_file) as f:
            data = json.load(f)
        perturbations_override = data.get("perturbations") if isinstance(data, dict) else data
        print(f"[orchestrator] loaded {len(perturbations_override)} perturbations "
              f"from {args.perturbations_file}")

    asyncio.run(run_ensemble(
        scenario_path=args.scenario,
        parent_sim_id=args.parent_sim_id,
        backend_url=args.backend,
        num_branches=args.num_branches,
        poll_interval=args.poll_interval,
        branch_timeout=args.branch_timeout,
        out_path=args.out,
        skip_classify=args.skip_classify,
        perturbations_override=perturbations_override,
    ))


if __name__ == "__main__":
    _main()
