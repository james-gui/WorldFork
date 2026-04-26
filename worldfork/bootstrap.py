"""Parent-sim bootstrap (Phase 3.5).

Programmatically takes a scenario YAML + seed document and produces a parent
simulation in READY state, ready to be branched. Wraps MiroShark's existing
6-step pipeline:

  1. POST /api/graph/ontology/generate (multipart)  → project_id + ontology
  2. POST /api/graph/build               (JSON)     → task_id
  3. GET  /api/graph/task/<task_id>      (poll)     → graph_id (in result)
  4. POST /api/simulation/create         (JSON)     → simulation_id
  5. POST /api/simulation/prepare        (JSON)     → task_id
  6. POST /api/simulation/prepare/status (poll)     → READY

This is what the MiroShark UI does when you drop a document into the
simulation setup wizard. We do it via API so the orchestrator can run
end-to-end without manual UI interaction.
"""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from typing import Any

import httpx
import yaml


DEFAULT_BACKEND = "http://localhost:5001"
DEFAULT_POLL_INTERVAL = 5
DEFAULT_GRAPH_TIMEOUT = 600   # 10 min for graph build
DEFAULT_PREPARE_TIMEOUT = 1200  # 20 min for profile generation


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

async def bootstrap_parent(
    scenario_path: str | Path,
    *,
    backend_url: str = DEFAULT_BACKEND,
    poll_interval: int = DEFAULT_POLL_INTERVAL,
    graph_timeout: int = DEFAULT_GRAPH_TIMEOUT,
    prepare_timeout: int = DEFAULT_PREPARE_TIMEOUT,
    enable_reddit: bool = True,
    enable_twitter: bool = False,
    enable_polymarket: bool = False,
    project_name: str | None = None,
) -> str:
    """Run the full bootstrap pipeline. Returns the prepared parent simulation_id.

    Reads from scenario YAML:
      - seed_document (path, relative to YAML)
      - description     (used as simulation_requirement)
      - simulation.platform (used to decide which flags to enable, if not overridden)
    """
    scenario_path = Path(scenario_path)
    with open(scenario_path) as f:
        cfg = yaml.safe_load(f)

    # Resolve paths
    seed_doc_rel = cfg.get("seed_document")
    if not seed_doc_rel:
        raise ValueError(f"scenario {scenario_path} has no seed_document")
    seed_doc_path = (scenario_path.parent / seed_doc_rel).resolve()
    if not seed_doc_path.exists():
        raise FileNotFoundError(f"seed document not found: {seed_doc_path}")

    sim_requirement = (
        cfg.get("description")
        or cfg.get("name")
        or "Probabilistic ensemble simulation"
    ).strip()

    # Auto-pick platform flags from scenario if not overridden via kwargs
    platform_choice = (cfg.get("simulation") or {}).get("platform", "reddit")
    # Allow caller to override; otherwise enable only the chosen platform.
    if platform_choice == "reddit" and enable_reddit and not enable_twitter and not enable_polymarket:
        pass  # reddit-only as configured
    elif platform_choice == "twitter":
        enable_reddit, enable_twitter, enable_polymarket = False, True, False
    elif platform_choice == "polymarket":
        enable_reddit, enable_twitter, enable_polymarket = False, False, True

    project_name = project_name or cfg.get("name", "WorldFork bootstrap")

    print(f"[bootstrap] scenario={cfg.get('name')} seed={seed_doc_path.name}")
    print(f"[bootstrap] backend={backend_url} platform={platform_choice}")

    async with httpx.AsyncClient(timeout=120.0) as client:
        # ---------------- Step 1: ontology / project creation ----------------
        print("[bootstrap] step 1/6: uploading document + generating ontology...")
        with open(seed_doc_path, "rb") as fh:
            files = {"files": (seed_doc_path.name, fh.read(), "text/plain")}
        data = {
            "simulation_requirement": sim_requirement,
            "project_name": project_name,
        }
        r = await client.post(
            f"{backend_url}/api/graph/ontology/generate",
            files=files,
            data=data,
            timeout=300.0,
        )
        r.raise_for_status()
        body = r.json()
        if not body.get("success"):
            raise RuntimeError(f"ontology/generate failed: {body.get('error')}")
        project_id = body["data"]["project_id"]
        ontology = body["data"]["ontology"]
        print(f"  → project_id={project_id} "
              f"(entity_types={len(ontology.get('entity_types', []))})")

        # ---------------- Step 2: kick off graph build ----------------
        print("[bootstrap] step 2/6: starting graph build...")
        r = await client.post(
            f"{backend_url}/api/graph/build",
            json={"project_id": project_id},
        )
        r.raise_for_status()
        body = r.json()
        if not body.get("success"):
            raise RuntimeError(f"graph/build failed: {body.get('error')}")
        graph_task_id = body["data"]["task_id"]
        print(f"  → task_id={graph_task_id}")

        # ---------------- Step 3: poll graph build to completion ----------------
        print("[bootstrap] step 3/6: polling graph build...")
        graph_id = await _poll_task(
            client, backend_url, graph_task_id,
            timeout=graph_timeout, interval=poll_interval,
            log_prefix="  graph_build",
        )
        if not graph_id:
            raise RuntimeError("graph build completed but no graph_id returned")
        print(f"  → graph_id={graph_id}")

        # ---------------- Step 4: create simulation entity ----------------
        print("[bootstrap] step 4/6: creating simulation...")
        r = await client.post(
            f"{backend_url}/api/simulation/create",
            json={
                "project_id": project_id,
                "graph_id": graph_id,
                "enable_reddit": enable_reddit,
                "enable_twitter": enable_twitter,
                "enable_polymarket": enable_polymarket,
            },
        )
        r.raise_for_status()
        body = r.json()
        if not body.get("success"):
            raise RuntimeError(f"simulation/create failed: {body.get('error')}")
        sim_id = body["data"]["simulation_id"]
        print(f"  → simulation_id={sim_id}")

        # ---------------- Step 5: kick off prepare ----------------
        print("[bootstrap] step 5/6: starting prepare (profile generation + sim config)...")
        r = await client.post(
            f"{backend_url}/api/simulation/prepare",
            json={"simulation_id": sim_id, "use_llm_for_profiles": True,
                  "parallel_profile_count": 15},
        )
        r.raise_for_status()
        body = r.json()
        if not body.get("success"):
            raise RuntimeError(f"simulation/prepare failed: {body.get('error')}")
        prepare_data = body["data"]
        if prepare_data.get("already_prepared"):
            print(f"  → already prepared, skipping wait")
            return sim_id
        prepare_task_id = prepare_data.get("task_id")
        print(f"  → task_id={prepare_task_id}")

        # ---------------- Step 6: poll prepare/status until ready ----------------
        print("[bootstrap] step 6/6: polling prepare status...")
        await _poll_prepare(
            client, backend_url, sim_id,
            task_id=prepare_task_id,
            timeout=prepare_timeout,
            interval=poll_interval,
        )
        print(f"[bootstrap] DONE — parent ready: {sim_id}")
        return sim_id


# ---------------------------------------------------------------------------
# Polling helpers
# ---------------------------------------------------------------------------

async def _poll_task(
    client: httpx.AsyncClient,
    backend_url: str,
    task_id: str,
    *,
    timeout: int,
    interval: int,
    log_prefix: str,
) -> str | None:
    """Poll /api/graph/task/<task_id>. Returns graph_id from result on success."""
    start = time.time()
    last_progress = -1
    while time.time() - start < timeout:
        try:
            r = await client.get(f"{backend_url}/api/graph/task/{task_id}", timeout=15.0)
            r.raise_for_status()
            data = r.json().get("data", {})
            status = data.get("status", "?")
            progress = data.get("progress", 0)
            message = data.get("message", "")

            if progress != last_progress:
                print(f"{log_prefix}: {status} {progress}% — {message[:80]}")
                last_progress = progress

            if status == "completed":
                return (data.get("result") or {}).get("graph_id")
            if status == "failed":
                raise RuntimeError(
                    f"task {task_id} failed: {data.get('error') or message}"
                )
        except httpx.RequestError as e:
            print(f"{log_prefix}: poll error (will retry): {e}")
        await asyncio.sleep(interval)
    raise TimeoutError(f"task {task_id} did not complete within {timeout}s")


async def _poll_prepare(
    client: httpx.AsyncClient,
    backend_url: str,
    simulation_id: str,
    *,
    task_id: str | None,
    timeout: int,
    interval: int,
) -> None:
    """Poll /api/simulation/prepare/status until ready."""
    start = time.time()
    last_progress = -1
    while time.time() - start < timeout:
        payload: dict[str, Any] = {"simulation_id": simulation_id}
        if task_id:
            payload["task_id"] = task_id
        try:
            r = await client.post(
                f"{backend_url}/api/simulation/prepare/status",
                json=payload,
                timeout=15.0,
            )
            r.raise_for_status()
            data = r.json().get("data", {})
            status = data.get("status", "?")
            progress = data.get("progress", 0)
            message = data.get("message", "")

            if progress != last_progress:
                print(f"  prepare: {status} {progress}% — {message[:80]}")
                last_progress = progress

            if status in ("completed", "ready") or data.get("already_prepared"):
                return
            if status == "failed":
                raise RuntimeError(
                    f"prepare failed for {simulation_id}: {data.get('error') or message}"
                )
        except httpx.RequestError as e:
            print(f"  prepare: poll error (will retry): {e}")
        await asyncio.sleep(interval)
    raise TimeoutError(f"prepare did not complete within {timeout}s")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _main():
    import argparse
    p = argparse.ArgumentParser(description="Bootstrap a parent simulation for WorldFork.")
    p.add_argument("scenario", help="Path to scenario YAML")
    p.add_argument("--backend", default=DEFAULT_BACKEND)
    p.add_argument("--graph-timeout", type=int, default=DEFAULT_GRAPH_TIMEOUT)
    p.add_argument("--prepare-timeout", type=int, default=DEFAULT_PREPARE_TIMEOUT)
    p.add_argument("--poll-interval", type=int, default=DEFAULT_POLL_INTERVAL)
    args = p.parse_args()

    sim_id = asyncio.run(bootstrap_parent(
        scenario_path=args.scenario,
        backend_url=args.backend,
        poll_interval=args.poll_interval,
        graph_timeout=args.graph_timeout,
        prepare_timeout=args.prepare_timeout,
    ))
    print(f"\nparent_sim_id={sim_id}")


if __name__ == "__main__":
    _main()
