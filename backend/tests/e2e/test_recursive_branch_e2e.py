"""End-to-end recursive-branching test (PRD §13, §27.3 #1).

Validates: root universe -> child branch -> grandchild branch, all wired
through the `branch_engine.commit_branch` orchestrator and verified via
the public `/api/universes/{uid}/lineage` API endpoint.

Acceptance:
    GET /api/universes/{grandchild}/lineage  -> 3-element path
    grandchild.branch_depth == 2
"""
from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import select

from backend.app.branching.branch_engine import commit_branch
from backend.app.models.universes import UniverseModel
from backend.app.schemas.branching import (
    BranchPolicyResult,
    CounterfactualEventRewriteDelta,
    ParameterShiftDelta,
)
from backend.app.simulation.initializer import initialize_big_bang

from backend.tests.e2e.conftest import canned_initializer_payload

pytestmark = [pytest.mark.asyncio, pytest.mark.e2e]


def _approve(divergence: float = 0.6) -> BranchPolicyResult:
    return BranchPolicyResult(
        decision="approve",
        reason="ok",
        cost_estimate={"tokens": 1000, "calls": 10},
        divergence_score=divergence,
    )


async def test_recursive_branching_depth_2_lineage(
    e2e_client,
    db_session,
    rate_limiter,
    routing,
    initializer_input,
    mock_provider_response,
    tmp_path: Path,
):
    """Initialize → branch root → branch child → assert depth-2 lineage."""
    mock_provider_response(
        {"initialize_big_bang": canned_initializer_payload()}
    )

    init_result = await initialize_big_bang(
        initializer_input,
        session=db_session,
        sot=None,
        provider_rate_limiter=rate_limiter,
        run_root=tmp_path,
        routing=routing,
    )
    root_uid = init_result.root_universe.universe_id
    big_bang_id = init_result.big_bang_run.big_bang_id

    # --- Branch #1: root → child --------------------------------------
    root_row = (
        await db_session.execute(
            select(UniverseModel).where(UniverseModel.universe_id == root_uid)
        )
    ).scalar_one()

    child_delta = CounterfactualEventRewriteDelta(
        type="counterfactual_event_rewrite",
        target_event_id=init_result.initial_events[0].event_id,
        parent_version="Pay-cut announcement",
        child_version="Pay-cut paused pending review",
    )
    child_result = await commit_branch(
        session=db_session,
        parent_universe=root_row,
        branch_from_tick=0,
        delta=child_delta,
        branch_reason="god_review_spawn_active_lvl1",
        policy_result=_approve(),
    )
    await db_session.commit()
    child_uid = child_result.child_universe_id
    assert child_result.lineage_path == [root_uid, child_uid]

    # --- Branch #2: child → grandchild --------------------------------
    child_row = (
        await db_session.execute(
            select(UniverseModel).where(UniverseModel.universe_id == child_uid)
        )
    ).scalar_one()

    grand_delta = ParameterShiftDelta(
        type="parameter_shift",
        target="cohort_global",
        delta={"attention": 0.1},
    )
    grand_result = await commit_branch(
        session=db_session,
        parent_universe=child_row,
        branch_from_tick=0,
        delta=grand_delta,
        branch_reason="god_review_spawn_active_lvl2",
        policy_result=_approve(0.55),
    )
    await db_session.commit()
    grand_uid = grand_result.child_universe_id

    # --- HTTP assertion: lineage of grandchild should be a 3-element path
    res = await e2e_client.get(f"/api/universes/{grand_uid}/lineage")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["lineage_path"] == [root_uid, child_uid, grand_uid]
    assert body["depth"] == 2
    assert body["parent"] == child_uid

    # The multiverse tree must report all three universes.
    tree_res = await e2e_client.get(f"/api/multiverse/{big_bang_id}/tree")
    assert tree_res.status_code == 200
    tree = tree_res.json()
    nodes = {n["universe_id"]: n for n in tree["nodes"]}
    assert {root_uid, child_uid, grand_uid} <= nodes.keys()
    assert nodes[grand_uid]["depth"] == 2
    assert nodes[child_uid]["depth"] == 1
    assert nodes[root_uid]["depth"] == 0
