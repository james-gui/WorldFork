"""End-to-end Zep outage / fallback test (PRD §17.7, §27.3 #5).

The `ZepMemoryProvider` must:

* track failures in a 60-second sliding window,
* mark itself `degraded=True` after 3 failures,
* route all subsequent calls to its `LocalMemoryProvider` fallback,
* never propagate Zep errors to the simulation engine.

We simulate the outage by patching `AsyncZep` so all client methods raise.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

pytestmark = [pytest.mark.asyncio, pytest.mark.e2e]


def _make_failing_zep_client() -> MagicMock:
    """Return a mock AsyncZep instance whose every method raises."""
    client = MagicMock()
    client.user.add = AsyncMock(side_effect=RuntimeError("zep down"))
    client.thread = MagicMock()
    client.thread.create = AsyncMock(side_effect=RuntimeError("zep down"))
    client.thread.add_messages = AsyncMock(side_effect=RuntimeError("zep down"))
    client.thread.list_all = AsyncMock(side_effect=RuntimeError("zep down"))
    client.thread.get_user_context = AsyncMock(side_effect=RuntimeError("zep down"))
    client.graph = MagicMock()
    client.graph.search = AsyncMock(side_effect=RuntimeError("zep down"))
    return client


async def test_zep_three_failures_triggers_degraded_and_local_fallback(
    monkeypatch,
):
    """Three consecutive Zep failures must flip `degraded=True` and route
    further calls through `LocalMemoryProvider`."""
    from backend.app.memory import zep_adapter
    from backend.app.memory.local import LocalMemoryProvider
    from backend.app.memory.zep_adapter import ZepMemoryProvider

    failing_client = _make_failing_zep_client()
    monkeypatch.setattr(
        zep_adapter, "AsyncZep", lambda **kwargs: failing_client
    )

    local = LocalMemoryProvider()
    provider = ZepMemoryProvider(api_key="dummy", local_fallback=local)
    assert provider.degraded is False

    # 3 user.add calls — each fails — by the third the provider should flip.
    for i in range(3):
        await provider.ensure_user(
            actor_id=f"coh-{i}", actor_kind="cohort", metadata={}
        )
    assert provider.degraded is True, "expected degraded after 3 failures"

    # After degradation, all subsequent calls must route to the local fallback
    # without contacting Zep again.
    pre_calls = failing_client.user.add.call_count
    await provider.ensure_user(
        actor_id="coh-after", actor_kind="cohort", metadata={}
    )
    assert failing_client.user.add.call_count == pre_calls, (
        "Zep was contacted after degradation"
    )
    # The local fallback recorded the user.
    assert "coh-after" in local._users


async def test_zep_add_episode_after_outage_uses_local(monkeypatch):
    """`add_episode` after Zep degrades must succeed via LocalMemoryProvider."""
    from backend.app.memory import zep_adapter
    from backend.app.memory.local import LocalMemoryProvider
    from backend.app.memory.zep_adapter import ZepMemoryProvider

    failing_client = _make_failing_zep_client()
    monkeypatch.setattr(
        zep_adapter, "AsyncZep", lambda **kwargs: failing_client
    )

    local = LocalMemoryProvider()
    provider = ZepMemoryProvider(api_key="dummy", local_fallback=local)

    # Force degradation manually so we can observe add_episode behavior.
    provider.degraded = True

    session_id = await local.ensure_session(
        actor_id="coh-1", universe_id="U-test", metadata={}
    )
    await provider.add_episode(
        session_id=session_id,
        role="cohort_speaker",
        role_type="user",
        content="Tick 1: workers vote to walk out.",
        metadata=None,
    )

    # The local deque should have exactly one episode.
    deque = local._episodes[session_id]
    assert len(deque) == 1
    assert deque[0]["content"].startswith("Tick 1")

    # Zep client must NOT have been called at all.
    failing_client.thread.add_messages.assert_not_awaited()


async def test_zep_disabled_uses_local_only(monkeypatch):
    """When `ZEP_API_KEY` is absent, the factory returns LocalMemoryProvider
    directly — no degraded provider needed."""
    monkeypatch.delenv("ZEP_API_KEY", raising=False)
    monkeypatch.setattr(
        "backend.app.core.config.settings.zep_api_key", "", raising=False
    )

    from backend.app.memory import factory
    from backend.app.memory.local import LocalMemoryProvider

    factory._provider_singleton = None
    provider = factory.get_memory()
    assert isinstance(provider, LocalMemoryProvider)
