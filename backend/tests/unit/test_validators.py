"""Unit tests for backend.app.simulation.validators."""
from __future__ import annotations

import pytest

from backend.app.simulation.validators import ValidationContext
from backend.app.storage.sot_loader import load_sot


@pytest.fixture(scope="module")
def sot():
    return load_sot()


@pytest.fixture
def ctx(sot):
    return ValidationContext(
        sot,
        cohort_or_hero=None,
        allowed_tool_ids={
            "create_social_post",
            "comment_on_post",
            "stay_silent",
            "queue_event",
            "self_rate_emotions",
            "self_rate_issue_stance",
            "support_event",
        },
    )


# ---------------------------------------------------------------------------


class TestValidateToolCall:
    def test_rejects_unknown_tool_id(self, ctx):
        ok, reason = ctx.validate_tool_call(
            {"tool_id": "magical_thinking_tool", "args": {}}
        )
        assert not ok
        assert "unknown tool_id" in reason

    def test_rejects_disallowed_tool(self, sot):
        ctx = ValidationContext(sot, None, allowed_tool_ids={"stay_silent"})
        ok, reason = ctx.validate_tool_call(
            {"tool_id": "queue_event", "args": {"event_type": "protest", "title": "x", "scheduled_tick": 5}}
        )
        assert not ok
        assert "not in actor's allowed_tools" in reason

    def test_rejects_unknown_event_type(self, ctx):
        ok, reason = ctx.validate_tool_call(
            {"tool_id": "queue_event", "args": {
                "event_type": "intergalactic_war", "title": "x", "scheduled_tick": 5
            }}
        )
        assert not ok
        assert "unknown event_type" in reason

    def test_accepts_known_event_type(self, ctx):
        ok, _ = ctx.validate_tool_call(
            {"tool_id": "queue_event", "args": {
                "event_type": "protest", "title": "March", "scheduled_tick": 5
            }}
        )
        assert ok

    def test_rejects_unknown_emotion_key(self, ctx):
        ok, reason = ctx.validate_tool_call(
            {"tool_id": "self_rate_emotions",
             "args": {"emotions": {"anger": 5.0, "schadenfreude": 8.0}}}
        )
        assert not ok
        assert "schadenfreude" in reason

    def test_rejects_overlong_post_content(self, ctx):
        ok, reason = ctx.validate_tool_call(
            {"tool_id": "create_social_post",
             "args": {"platform": "twitter_like", "content": "x" * 2500}}
        )
        assert not ok
        # JSONSchema maxLength catches it first.
        assert "create_social_post" in reason or "2000" in reason


# ---------------------------------------------------------------------------


class TestSanitizeDecision:
    def test_drops_invalid_keeps_valid(self, ctx):
        decision = {
            "social_actions": [
                {"tool_id": "stay_silent", "args": {"reason": "fatigue"}},
                {"tool_id": "made_up_tool", "args": {}},
                {"tool_id": "comment_on_post", "args": {"post_id": "p1", "content": "ok"}},
            ],
            "event_actions": [
                {"tool_id": "queue_event", "args": {
                    "event_type": "protest", "title": "March", "scheduled_tick": 5
                }},
                {"tool_id": "queue_event", "args": {
                    "event_type": "fictitious_type", "title": "x", "scheduled_tick": 5
                }},
            ],
            "public_actions": [],
        }
        sanitized = ctx.sanitize_decision(decision)
        social_ids = [c["tool_id"] for c in sanitized["social_actions"]]
        event_ids = [c["tool_id"] for c in sanitized["event_actions"]]
        assert "made_up_tool" not in social_ids
        assert "stay_silent" in social_ids
        assert "comment_on_post" in social_ids
        assert len(event_ids) == 1
        assert event_ids[0] == "queue_event"
