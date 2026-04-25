"""Integration tests for /api/logs endpoints (B5-B)."""
from __future__ import annotations

from datetime import UTC, datetime

import pytest

from backend.app.models.jobs import JobModel
from backend.app.models.llm_calls import LLMCallModel


# ---------------------------------------------------------------------------
# Helper — seed rows
# ---------------------------------------------------------------------------

async def _seed_llm_call(db_session, *, call_id="call-001", provider="openrouter", status="succeeded", error=None, run_id="run-123"):
    row = LLMCallModel(
        call_id=call_id,
        provider=provider,
        model_used="openai/gpt-4o",
        job_type="god_agent_review",
        prompt_packet_path="/tmp/prompt.json",
        prompt_hash="deadbeef",
        response_path="/tmp/response.json",
        prompt_tokens=100,
        completion_tokens=200,
        total_tokens=300,
        cost_usd=0.001,
        latency_ms=250,
        repaired_once=False,
        status=status,
        error=error,
        created_at=datetime.now(UTC),
        run_id=run_id,
    )
    db_session.add(row)
    await db_session.commit()
    return row


async def _seed_failed_job(db_session, *, job_id="fail-job-001", run_id="run-123"):
    row = JobModel(
        job_id=job_id,
        idempotency_key=f"key:{job_id}",
        job_type="simulate_universe_tick",
        priority="p0",
        run_id=run_id,
        universe_id="u-001",
        tick=1,
        attempt_number=0,
        payload={},
        status="failed",
        error="Something went wrong",
        created_at=datetime.now(UTC),
        enqueued_at=datetime.now(UTC),
    )
    db_session.add(row)
    await db_session.commit()
    return row


# ---------------------------------------------------------------------------
# GET /api/logs/requests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_request_logs_empty(client):
    resp = await client.get("/api/logs/requests")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_get_request_logs_returns_data(client, db_session):
    await _seed_llm_call(db_session)
    resp = await client.get("/api/logs/requests")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    first = data[0]
    assert first["call_id"] == "call-001"
    assert first["provider"] == "openrouter"
    assert first["status"] == "succeeded"


@pytest.mark.asyncio
async def test_get_request_logs_filter_provider(client, db_session):
    await _seed_llm_call(db_session, call_id="call-p1", provider="openai", run_id="run-456")
    resp = await client.get("/api/logs/requests", params={"provider": "openai"})
    assert resp.status_code == 200
    data = resp.json()
    assert all(r["provider"] == "openai" for r in data)


@pytest.mark.asyncio
async def test_get_request_logs_filter_run_id(client, db_session):
    await _seed_llm_call(db_session, call_id="call-r1", run_id="specific-run")
    resp = await client.get("/api/logs/requests", params={"run_id": "specific-run"})
    assert resp.status_code == 200
    data = resp.json()
    assert all(r["run_id"] == "specific-run" for r in data)


@pytest.mark.asyncio
async def test_get_request_logs_filter_status(client, db_session):
    await _seed_llm_call(db_session, call_id="call-failed", status="failed", error="timeout", run_id="run-789")
    resp = await client.get("/api/logs/requests", params={"status": "failed"})
    assert resp.status_code == 200
    data = resp.json()
    assert all(r["status"] == "failed" for r in data)


@pytest.mark.asyncio
async def test_get_request_logs_pagination(client, db_session):
    for i in range(5):
        await _seed_llm_call(db_session, call_id=f"page-call-{i}", run_id="paged-run")
    resp = await client.get("/api/logs/requests", params={"limit": 2, "offset": 0, "run_id": "paged-run"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) <= 2


# ---------------------------------------------------------------------------
# GET /api/logs/webhooks
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_webhook_logs_returns_list(client):
    """Should return empty list (or real data if table exists)."""
    resp = await client.get("/api/logs/webhooks")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ---------------------------------------------------------------------------
# GET /api/logs/errors
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_error_logs_empty(client):
    resp = await client.get("/api/logs/errors")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_get_error_logs_includes_failed_jobs(client, db_session):
    await _seed_failed_job(db_session)
    resp = await client.get("/api/logs/errors")
    assert resp.status_code == 200
    data = resp.json()
    assert any(e["source"] == "job" and e["status"] == "failed" for e in data)


@pytest.mark.asyncio
async def test_get_error_logs_includes_llm_errors(client, db_session):
    await _seed_llm_call(db_session, call_id="call-err-1", status="failed", error="provider timeout", run_id="run-err")
    resp = await client.get("/api/logs/errors")
    assert resp.status_code == 200
    data = resp.json()
    assert any(e["source"] == "llm_call" and e["error"] == "provider timeout" for e in data)


@pytest.mark.asyncio
async def test_get_error_logs_filter_run_id(client, db_session):
    await _seed_failed_job(db_session, job_id="fail-filtered", run_id="filter-run")
    resp = await client.get("/api/logs/errors", params={"run_id": "filter-run"})
    assert resp.status_code == 200
    data = resp.json()
    assert all(e["run_id"] == "filter-run" for e in data)


# ---------------------------------------------------------------------------
# GET /api/logs/audit
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_audit_logs_placeholder(client):
    """Audit log returns lifecycle entries when jobs have been persisted."""
    resp = await client.get("/api/logs/audit")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert all(item["resource"].startswith("job:") for item in data)


# ---------------------------------------------------------------------------
# GET /api/logs/traces/{trace_id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_trace_returns_empty_for_unknown(client):
    resp = await client.get("/api/logs/traces/unknown-trace-id")
    assert resp.status_code == 200
    data = resp.json()
    assert data["trace_id"] == "unknown-trace-id"
    assert data["llm_calls"] == []
    assert data["jobs"] == []


@pytest.mark.asyncio
async def test_get_trace_joins_llm_calls_and_jobs(client, db_session):
    trace_id = "trace-run-xyz"
    await _seed_llm_call(db_session, call_id="trace-call-1", run_id=trace_id)
    await _seed_failed_job(db_session, job_id="trace-job-1", run_id=trace_id)

    resp = await client.get(f"/api/logs/traces/{trace_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["trace_id"] == trace_id
    assert len(data["llm_calls"]) >= 1
    assert len(data["jobs"]) >= 1
