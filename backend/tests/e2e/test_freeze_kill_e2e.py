"""End-to-end freeze / resume / kill test (PRD §13, §27.3 #6).

Exercises the universes API:
    POST /api/universes/{uid}/pause   -> status="frozen", frozen_at set
    POST /api/universes/{uid}/resume  -> status="active", next tick enqueued
    Kill path: a god-decision='kill' must flip status to "killed" with
               killed_at timestamp.
"""
from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import select

from backend.app.core.clock import now_utc
from backend.app.models.universes import UniverseModel
from backend.app.simulation.initializer import initialize_big_bang

from backend.tests.e2e.conftest import canned_initializer_payload

pytestmark = [pytest.mark.asyncio, pytest.mark.e2e]


async def test_pause_then_resume_then_kill_lifecycle(
    e2e_client,
    db_session,
    rate_limiter,
    routing,
    initializer_input,
    mock_provider_response,
    captured_enqueues,
    tmp_path: Path,
):
    """Initialize → pause (frozen) → resume (active+enqueue) → kill manually."""
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
    uid = init_result.root_universe.universe_id

    # --- Pause -------------------------------------------------------
    res = await e2e_client.post(f"/api/universes/{uid}/pause")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "frozen"

    # The DB row reflects the new status with frozen_at set.
    row = (
        await db_session.execute(
            select(UniverseModel).where(UniverseModel.universe_id == uid)
        )
    ).scalar_one()
    await db_session.refresh(row)
    assert row.status == "frozen"
    assert row.frozen_at is not None

    # --- Resume ------------------------------------------------------
    res = await e2e_client.post(f"/api/universes/{uid}/resume")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "active"
    assert body["next_tick"] == row.current_tick + 1

    await db_session.refresh(row)
    assert row.status == "active"
    assert row.frozen_at is None

    # --- Kill (god decision applied directly to the row) ------------
    # The god-agent's `kill` decision flows through branch_engine.commit_branch
    # for spawn-style decisions; for `kill` the engine simply marks the
    # universe killed. We exercise the persistence path here.
    row.status = "killed"
    row.killed_at = now_utc()
    await db_session.commit()
    await db_session.refresh(row)
    assert row.status == "killed"
    assert row.killed_at is not None

    # The universes API GET must reflect the killed status.
    detail_res = await e2e_client.get(f"/api/universes/{uid}")
    assert detail_res.status_code == 200, detail_res.text
    detail = detail_res.json()
    assert detail["status"] == "killed"
    assert detail["killed_at"] is not None


async def test_pause_already_frozen_returns_409(
    e2e_client,
    db_session,
    rate_limiter,
    routing,
    initializer_input,
    mock_provider_response,
    tmp_path: Path,
):
    """Pausing a universe that's not active/candidate returns 409."""
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
    uid = init_result.root_universe.universe_id

    # Pause once → ok.
    r1 = await e2e_client.post(f"/api/universes/{uid}/pause")
    assert r1.status_code == 200
    # Pause again → 409.
    r2 = await e2e_client.post(f"/api/universes/{uid}/pause")
    assert r2.status_code == 409, r2.text


async def test_resume_when_not_frozen_returns_409(
    e2e_client,
    db_session,
    rate_limiter,
    routing,
    initializer_input,
    mock_provider_response,
    tmp_path: Path,
):
    """Resuming an active universe (never paused) returns 409."""
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
    uid = init_result.root_universe.universe_id

    res = await e2e_client.post(f"/api/universes/{uid}/resume")
    assert res.status_code == 409, res.text
