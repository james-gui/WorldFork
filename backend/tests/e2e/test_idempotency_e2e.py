"""End-to-end idempotency test (PRD §16.7 + §27.3 #1 implicit).

Two scopes are covered:

* **HTTP idempotency** — `POST /api/runs` with the same `Idempotency-Key`
  twice must NOT create two run rows; the second call returns the existing
  run record.

* **Job idempotency** — `simulate_universe_tick`'s `idempotency_key` is a
  Redis SETNX guard. Calling `already_running(key)` twice with the same
  key must claim it once and return True for subsequent attempts.
"""
from __future__ import annotations

import pytest
from sqlalchemy import func, select

from backend.app.models.runs import BigBangRunModel

pytestmark = [pytest.mark.asyncio, pytest.mark.e2e]


async def test_post_runs_with_same_idempotency_key_dedupes(
    e2e_client,
    db_session,
):
    """Two POST /api/runs with the same Idempotency-Key share the same run."""
    body = {
        "display_name": "Idempotent test",
        "scenario_text": "Idempotent scenario.",
        "time_horizon_label": "1 day",
        "tick_duration_minutes": 60,
        "max_ticks": 3,
        "max_schedule_horizon_ticks": 2,
        "uploaded_doc_ids": [],
        "provider_snapshot_id": None,
    }
    headers = {"Idempotency-Key": "wf-test-idem-001"}

    res1 = await e2e_client.post("/api/runs", json=body, headers=headers)
    assert res1.status_code == 202, res1.text
    run_id_1 = res1.json()["run_id"]

    res2 = await e2e_client.post("/api/runs", json=body, headers=headers)
    assert res2.status_code == 202, res2.text
    run_id_2 = res2.json()["run_id"]

    assert run_id_1 == run_id_2

    # DB should contain exactly one row.
    count_stmt = select(func.count(BigBangRunModel.big_bang_id)).where(
        BigBangRunModel.big_bang_id == run_id_1
    )
    count = (await db_session.execute(count_stmt)).scalar_one()
    assert count == 1


async def test_already_running_returns_true_on_second_call(
    monkeypatch,
    redis_client,
):
    """`already_running(key)` claims the key on first call, reports
    True on second call."""
    from backend.app.workers import scheduler as sched

    # Patch the redis_client getter to use our fake.
    monkeypatch.setattr(
        "backend.app.core.redis_client.get_redis_client",
        lambda: redis_client,
    )

    key = "sim:run-x:U-001:t1:a1"
    first = await sched.already_running(key)
    second = await sched.already_running(key)
    assert first is False  # first claim succeeded
    assert second is True  # second call sees existing claim


async def test_mark_done_caches_result_path(monkeypatch, redis_client):
    """`mark_done` + `get_done_result` round-trip the cached result path."""
    from backend.app.workers import scheduler as sched

    monkeypatch.setattr(
        "backend.app.core.redis_client.get_redis_client",
        lambda: redis_client,
    )

    key = "sim:run-y:U-002:t2:a1"
    await sched.mark_done(key, result_path="runs/BB_test/U002/tick_002")
    cached = await sched.get_done_result(key)
    assert cached == "runs/BB_test/U002/tick_002"
