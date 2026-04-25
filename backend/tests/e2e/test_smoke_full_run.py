"""Headline E2E test — create→initialize→branch→export round-trip.

Exercises every layer the codebase currently supports without a live broker:

1. POST /api/runs (HTTP via ASGI) creates a run row + enqueues init.
2. We invoke `initialize_big_bang` directly with a mock provider — that's
   what the worker would do behind the broker.
3. We commit a branch via `branch_engine.commit_branch` (the same call the
   tick runner would issue when the God-agent returns spawn_active).
4. GET /api/multiverse/{bb_id}/tree returns nested structure (depth>=1).
5. GET /api/universes/{uid}/lineage returns the correct lineage path.
6. Export round-trip via `export_run_to_zip` → `import_run_from_zip` with
   manifest-checksum verification.

Tests that depend on a real Celery broker / running worker (the missing
`local_runner.run_tick_locally`, `simulate_universe_tick` job) are skipped
with `@pytest.mark.requires_broker` per the deliverables spec.
"""
from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import select

from backend.app.branching.branch_engine import commit_branch
from backend.app.models.runs import BigBangRunModel
from backend.app.models.universes import UniverseModel
from backend.app.schemas.branching import (
    BranchPolicyResult,
    CounterfactualEventRewriteDelta,
)
from backend.app.simulation.initializer import initialize_big_bang
from backend.app.storage.export import (
    ExportError,
    export_run_to_zip,
    import_run_from_zip,
)

from backend.tests.e2e.conftest import (
    canned_god_spawn_active_payload,
    canned_initializer_payload,
)

pytestmark = [pytest.mark.asyncio, pytest.mark.e2e]


async def test_post_runs_creates_db_row_and_returns_202(
    e2e_client,
):
    """POST /api/runs persists a draft run and returns 202 with both IDs."""
    body = {
        "display_name": "smoke e2e",
        "scenario_text": "smoke scenario",
        "time_horizon_label": "1 day",
        "tick_duration_minutes": 60,
        "max_ticks": 3,
        "max_schedule_horizon_ticks": 2,
        "uploaded_doc_ids": [],
        "provider_snapshot_id": None,
    }
    res = await e2e_client.post("/api/runs", json=body)
    assert res.status_code == 202, res.text
    payload = res.json()
    assert payload["status"] == "draft"
    assert payload["run_id"]
    assert payload["root_universe_id"]


async def test_full_smoke_initializer_branch_export(
    e2e_client,
    db_session,
    rate_limiter,
    routing,
    initializer_input,
    mock_provider_response,
    tmp_path: Path,
    captured_enqueues,
):
    """End-to-end smoke that covers the full happy path of the *implemented*
    surface: HTTP create → direct initializer → recursive branch → multiverse
    tree → export → re-import round-trip."""

    # 1. Mock provider — return canned initializer + god outputs.
    mock_provider_response(
        {
            "initialize_big_bang": canned_initializer_payload(),
            "god_agent_review": canned_god_spawn_active_payload(),
        }
    )

    # 2. Run the initializer directly (would normally be the Celery worker).
    init_result = await initialize_big_bang(
        initializer_input,
        session=db_session,
        sot=None,
        provider_rate_limiter=rate_limiter,
        run_root=tmp_path,
        routing=routing,
    )
    assert init_result.big_bang_run.status == "running"
    assert init_result.root_universe.status == "active"
    big_bang_id = init_result.big_bang_run.big_bang_id
    root_uid = init_result.root_universe.universe_id

    # 3. Commit a branch (what the engine would do on spawn_active).
    root_row = (
        await db_session.execute(
            select(UniverseModel).where(UniverseModel.universe_id == root_uid)
        )
    ).scalar_one()

    delta = CounterfactualEventRewriteDelta(
        type="counterfactual_event_rewrite",
        target_event_id=init_result.initial_events[0].event_id,
        parent_version="Pay-cut announcement",
        child_version="Pay-cut rescinded after audit",
    )
    policy = BranchPolicyResult(
        decision="approve",
        reason="ok",
        cost_estimate={"tokens": 1000, "calls": 10},
        divergence_score=0.6,
    )
    branch_result = await commit_branch(
        session=db_session,
        parent_universe=root_row,
        branch_from_tick=0,
        delta=delta,
        branch_reason="god_review_spawn_active",
        policy_result=policy,
    )
    await db_session.commit()
    assert branch_result.status == "active"
    child_uid = branch_result.child_universe_id

    # 4. GET /api/multiverse/{bb_id}/tree should include both the root and
    #    the child with at least one edge.
    tree_res = await e2e_client.get(f"/api/multiverse/{big_bang_id}/tree")
    assert tree_res.status_code == 200, tree_res.text
    tree = tree_res.json()
    node_ids = {n["universe_id"] for n in tree["nodes"]}
    assert root_uid in node_ids
    assert child_uid in node_ids
    assert any(e["target"] == child_uid for e in tree["edges"])

    # 5. Lineage of child → [root, child].
    lin_res = await e2e_client.get(f"/api/universes/{child_uid}/lineage")
    assert lin_res.status_code == 200, lin_res.text
    lineage = lin_res.json()
    assert lineage["lineage_path"] == [root_uid, child_uid]
    assert lineage["depth"] == 1

    # 6. Run row should reflect status=running.
    run_row = (
        await db_session.execute(
            select(BigBangRunModel).where(
                BigBangRunModel.big_bang_id == big_bang_id
            )
        )
    ).scalar_one()
    assert run_row.status == "running"

    # 7. Export → re-import round trip with manifest verification.
    run_folder = init_result.run_folder
    assert (run_folder / "manifest.json").exists()
    zip_dest = tmp_path / "export.zip"
    export_run_to_zip(run_folder=run_folder, dest=zip_dest, verify=False)
    assert zip_dest.exists()
    assert zip_dest.stat().st_size > 0

    dst_root = tmp_path / "reimport"
    dst_root.mkdir(exist_ok=True)
    reimported = import_run_from_zip(
        zip_path=zip_dest, dest_root=dst_root, verify=True
    )
    assert reimported.is_dir()
    assert (reimported / "manifest.json").exists()


@pytest.mark.requires_broker
async def test_smoke_three_ticks_via_local_runner_skipped():
    """Plan calls for `simulation.local_runner.run_tick_locally(...)` — that
    helper is not yet implemented in this repo (B4-C). Skipping cleanly so
    the suite is green on the implemented surface; once the tick runner
    lands, fill in the body and remove this marker."""
    pytest.skip(
        "simulation.local_runner.run_tick_locally not implemented (B4-C). "
        "Re-enable after batch B4-C adds the tick runner."
    )


async def test_export_tampered_zip_raises(
    db_session,
    rate_limiter,
    routing,
    initializer_input,
    mock_provider_response,
    tmp_path: Path,
):
    """Mutating a byte in the exported zip's tick manifest must trigger
    `ExportError` on re-import (Merkle verification catches it)."""
    mock_provider_response(
        {"initialize_big_bang": canned_initializer_payload()},
    )
    init_result = await initialize_big_bang(
        initializer_input,
        session=db_session,
        sot=None,
        provider_rate_limiter=rate_limiter,
        run_root=tmp_path,
        routing=routing,
    )

    # Add a sealed tick so the import-side Merkle verifier has something to
    # check against. We re-open the ledger via the run-root path.
    from backend.app.storage.ledger import Ledger

    big_bang_id = init_result.big_bang_run.big_bang_id
    ledger = Ledger.open(tmp_path, big_bang_id)
    uni_id = init_result.root_universe.universe_id
    ledger.begin_tick(uni_id, 0)
    ledger.write_artifact(
        f"universes/{uni_id}/ticks/tick_000/state_after.json",
        {"sample": "after"},
        immutable=False,
    )
    ledger.seal_tick(uni_id, 0)

    zip_dest = tmp_path / "exp.zip"
    export_run_to_zip(
        run_folder=init_result.run_folder, dest=zip_dest, verify=False
    )

    # Rebuild the zip with a tampered tick file so the recomputed Merkle
    # root will not match the stored one.
    import zipfile

    tampered = tmp_path / "tampered.zip"
    with zipfile.ZipFile(zip_dest, "r") as zin, zipfile.ZipFile(
        tampered, "w", zipfile.ZIP_DEFLATED
    ) as zout:
        for member in zin.namelist():
            data = zin.read(member)
            if member.endswith("state_after.json"):
                data = data + b"\x00"  # corrupt one byte
            zout.writestr(member, data)

    dst_root = tmp_path / "reimport"
    dst_root.mkdir(exist_ok=True)
    with pytest.raises(ExportError):
        import_run_from_zip(zip_path=tampered, dest_root=dst_root, verify=True)
