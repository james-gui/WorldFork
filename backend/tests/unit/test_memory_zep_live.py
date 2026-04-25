"""
Live integration test for ZepMemoryProvider against the real Zep Cloud API.

Marked @pytest.mark.live_zep — skipped automatically if ZEP_API_KEY is not set.

Run explicitly with:
  pytest -m live_zep backend/tests/unit/test_memory_zep_live.py -v
"""
from __future__ import annotations

import os
import uuid

import pytest

from backend.app.memory.local import LocalMemoryProvider
from backend.app.memory.zep_adapter import ZepMemoryProvider

# ---------------------------------------------------------------------------
# Skip condition
# ---------------------------------------------------------------------------

ZEP_API_KEY = os.environ.get("ZEP_API_KEY", "")

pytestmark = pytest.mark.live_zep

skip_no_key = pytest.mark.skipif(
    not ZEP_API_KEY,
    reason="ZEP_API_KEY not set — skipping live Zep tests",
)


@pytest.fixture
def live_provider() -> ZepMemoryProvider:
    """Real ZepMemoryProvider backed by real Zep Cloud."""
    assert ZEP_API_KEY, "ZEP_API_KEY must be set for live tests"
    return ZepMemoryProvider(
        api_key=ZEP_API_KEY,
        mode="cohort_memory",
        local_fallback=LocalMemoryProvider(),
        request_timeout=30.0,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@skip_no_key
class TestZepLive:
    async def test_healthcheck_ok(self, live_provider: ZepMemoryProvider) -> None:
        """Zep healthcheck should return ok=True with a valid API key."""
        result = await live_provider.healthcheck()
        assert result["ok"] is True, f"Healthcheck failed: {result}"
        assert result["latency_ms"] >= 0

    async def test_ensure_user_round_trip(self, live_provider: ZepMemoryProvider) -> None:
        """ensure_user should not raise; Zep is idempotent on re-add."""
        actor_id = f"test-cohort-{uuid.uuid4().hex[:8]}"
        # Call twice to verify idempotency
        await live_provider.ensure_user(
            actor_id=actor_id,
            actor_kind="cohort",
            metadata={"test": True, "label": "Test Cohort"},
        )
        await live_provider.ensure_user(
            actor_id=actor_id,
            actor_kind="cohort",
            metadata={"test": True, "label": "Test Cohort"},
        )
        assert not live_provider.degraded

    async def test_ensure_session_round_trip(self, live_provider: ZepMemoryProvider) -> None:
        """ensure_session should return a consistent session_id."""
        actor_id = f"test-cohort-{uuid.uuid4().hex[:8]}"
        universe_id = f"U-{uuid.uuid4().hex[:8]}"

        # Create the user first
        await live_provider.ensure_user(
            actor_id=actor_id,
            actor_kind="cohort",
            metadata={"test": True},
        )

        sid1 = await live_provider.ensure_session(
            actor_id=actor_id,
            universe_id=universe_id,
            metadata={"actor_kind": "cohort"},
        )
        sid2 = await live_provider.ensure_session(
            actor_id=actor_id,
            universe_id=universe_id,
            metadata={"actor_kind": "cohort"},
        )
        assert sid1 == sid2
        assert not live_provider.degraded

    async def test_add_episode_and_get_context(self, live_provider: ZepMemoryProvider) -> None:
        """Full round-trip: ensure_user → ensure_session → add_episode → get_context."""
        actor_id = f"test-cohort-{uuid.uuid4().hex[:8]}"
        universe_id = f"U-{uuid.uuid4().hex[:8]}"

        await live_provider.ensure_user(
            actor_id=actor_id,
            actor_kind="cohort",
            metadata={"test": True},
        )
        sid = await live_provider.ensure_session(
            actor_id=actor_id,
            universe_id=universe_id,
            metadata={"actor_kind": "cohort"},
        )

        # Add a few episodes
        await live_provider.add_episode(
            session_id=sid,
            role="cohort_test",
            role_type="user",
            content="Workers are organizing a strike at the gig platform.",
            metadata={"tick": 1},
        )
        await live_provider.add_episode(
            session_id=sid,
            role="system",
            role_type="system",
            content="Management issued a response warning of layoffs.",
            metadata={"tick": 1},
        )

        # get_context may return empty until Zep processes the messages
        ctx = await live_provider.get_context(session_id=sid)
        assert isinstance(ctx, str)  # may be empty immediately after add
        assert not live_provider.degraded

    async def test_end_of_tick_summary(self, live_provider: ZepMemoryProvider) -> None:
        """end_of_tick_summary should not raise and write local fallback."""
        actor_id = f"test-cohort-{uuid.uuid4().hex[:8]}"
        universe_id = f"U-{uuid.uuid4().hex[:8]}"

        await live_provider.ensure_user(
            actor_id=actor_id,
            actor_kind="cohort",
            metadata={"test": True},
        )
        await live_provider.ensure_session(
            actor_id=actor_id,
            universe_id=universe_id,
            metadata={"actor_kind": "cohort"},
        )

        await live_provider.end_of_tick_summary(
            actor_id=actor_id,
            universe_id=universe_id,
            tick=1,
            summary_text="Cohort expressed strong opposition to new gig policy.",
        )
        # Local fallback must always be updated
        assert (
            live_provider.local_fallback._summaries.get(actor_id)
            == "Cohort expressed strong opposition to new gig policy."
        )
        assert not live_provider.degraded
