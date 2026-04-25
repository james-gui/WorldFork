"""End-to-end population-conservation test (PRD §12.7, §27.3 #3).

The cohort split engine MUST conserve population at the DB level. This test
initializes 1 archetype (population=1000), commits a split proposal that
divides the seed cohort into 2 children at tick 1, and asserts:

* sum(children.represented_population) == 1000
* parent cohort flagged inactive
* `audit_population_conservation` returns no errors
"""
from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import select

from backend.app.models.cohorts import (
    CohortStateModel,
    PopulationArchetypeModel,
)
from backend.app.schemas.sociology import (
    ChildSplitSpec,
    SociologyParams,
    SplitProposal,
)
from backend.app.simulation.initializer import initialize_big_bang
from backend.app.sociology.split_merge import (
    audit_population_conservation,
    commit_split,
    evaluate_split_validity,
)

from backend.tests.e2e.conftest import canned_initializer_payload

pytestmark = [pytest.mark.asyncio, pytest.mark.e2e]


async def test_split_conserves_population_end_to_end(
    db_session,
    rate_limiter,
    routing,
    initializer_input,
    mock_provider_response,
    tmp_path: Path,
):
    """Initialize → propose split at tick 1 → assert conservation + audit clean."""
    # 1. The default canned payload has 1 archetype with population_total=1000.
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
    parent_cohort = init_result.initial_cohort_states[0]
    archetype = init_result.archetypes[0]
    assert parent_cohort.represented_population == 1000
    assert archetype.population_total == 1000

    # 2. Build a split proposal: 600 / 400 across 2 children.
    proposal = SplitProposal(
        parent_cohort_id=parent_cohort.cohort_id,
        children=[
            ChildSplitSpec(
                archetype_id=archetype.archetype_id,
                represented_population=600,
                issue_stance={"economic": -0.3},
                expression_level=0.6,
                mobilization_mode="active",
                speech_mode="vocal",
                seed_emotions={"anger": 4.5},
                interpretation_note="more vocal half",
            ),
            ChildSplitSpec(
                archetype_id=archetype.archetype_id,
                represented_population=400,
                issue_stance={"economic": -0.5},
                expression_level=0.3,
                mobilization_mode="dormant",
                speech_mode="silent",
                seed_emotions={"anger": 1.5},
                interpretation_note="quieter half",
            ),
        ],
        split_distance=0.4,
        rationale="Material grievance bifurcates the cohort.",
    )

    # 3. Validate (pure function — no DB writes).
    params = SociologyParams()
    ok, err = evaluate_split_validity(
        parent=parent_cohort,
        proposal=proposal,
        archetype=archetype,
        params=params,
    )
    assert ok, f"split validity failed: {err}"

    # 4. Commit the split inside a transaction, at tick 1.
    parent_row = (
        await db_session.execute(
            select(CohortStateModel).where(
                CohortStateModel.cohort_id == parent_cohort.cohort_id
            )
        )
    ).scalar_one()
    children = await commit_split(
        db_session,
        parent=parent_row,
        proposal=proposal,
        current_tick=1,
        archetype=archetype,
        params=params,
    )
    await db_session.commit()

    # 5. Children sum must equal parent population (HARD invariant).
    total = sum(c.represented_population for c in children)
    assert total == 1000, f"population not conserved: {total} != 1000"
    assert len(children) == 2

    # Parent must be flagged inactive after split commit.
    await db_session.refresh(parent_row)
    assert parent_row.is_active is False

    # 6. Auditor at tick 1 must report no errors.
    # The PopulationArchetype row must exist for audit to find the archetype.
    arch_row = (
        await db_session.execute(
            select(PopulationArchetypeModel).where(
                PopulationArchetypeModel.archetype_id == archetype.archetype_id
            )
        )
    ).scalar_one()
    assert arch_row.population_total == 1000

    errors = await audit_population_conservation(db_session, root_uid, current_tick=1)
    assert errors == [], f"audit reported errors: {errors}"


async def test_split_with_wrong_total_is_rejected(
    db_session,
    rate_limiter,
    routing,
    initializer_input,
    mock_provider_response,
    tmp_path: Path,
):
    """A split whose children sum to anything other than the parent
    population MUST be rejected at validation time."""
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
    parent_cohort = init_result.initial_cohort_states[0]
    archetype = init_result.archetypes[0]

    # Split sum = 999 (off by one) — must be rejected.
    bad_proposal = SplitProposal(
        parent_cohort_id=parent_cohort.cohort_id,
        children=[
            ChildSplitSpec(
                archetype_id=archetype.archetype_id,
                represented_population=600,
                expression_level=0.6,
                mobilization_mode="active",
                speech_mode="vocal",
            ),
            ChildSplitSpec(
                archetype_id=archetype.archetype_id,
                represented_population=399,  # WRONG — should be 400
                expression_level=0.3,
                mobilization_mode="dormant",
                speech_mode="silent",
            ),
        ],
        split_distance=0.4,
        rationale="off-by-one on purpose",
    )
    ok, err = evaluate_split_validity(
        parent=parent_cohort,
        proposal=bad_proposal,
        archetype=archetype,
        params=SociologyParams(),
    )
    assert ok is False
    assert err is not None and "conservation" in err.lower() or "represented_population" in err.lower()
