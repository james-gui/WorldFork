"""Unit tests for backend.app.branching.divergence."""
from __future__ import annotations

from backend.app.branching.divergence import compute_divergence_estimate
from backend.app.schemas.branching import (
    ActorStateOverrideDelta,
    CounterfactualEventRewriteDelta,
    HeroDecisionOverrideDelta,
    ParameterShiftDelta,
)


# ---------------------------------------------------------------------------
# Per-delta-type sanity
# ---------------------------------------------------------------------------


class TestCounterfactualEventRewrite:
    def test_baseline_is_half(self):
        delta = CounterfactualEventRewriteDelta(
            type="counterfactual_event_rewrite",
            target_event_id="evt_1",
            parent_version="defensive statement",
            child_version="apology + audit",
        )
        assert compute_divergence_estimate([], delta) == 0.5

    def test_volatile_history_nudges_upward(self):
        delta = CounterfactualEventRewriteDelta(
            type="counterfactual_event_rewrite",
            target_event_id="evt_1",
            parent_version="a",
            child_version="b",
        )
        history = [
            {"divergence_score": 0.1},
            {"divergence_score": 0.5},
            {"divergence_score": 0.2},
        ]
        score = compute_divergence_estimate(history, delta)
        assert score > 0.5
        assert score <= 1.0


class TestParameterShift:
    def test_baseline_with_empty_delta(self):
        delta = ParameterShiftDelta(
            type="parameter_shift",
            target="news_channel.local_press.bias",
            delta={},
        )
        # Empty delta returns the bare baseline (0.4) — no history nudge.
        assert compute_divergence_estimate([], delta) == 0.4

    def test_small_magnitude_low_score(self):
        delta = ParameterShiftDelta(
            type="parameter_shift",
            target="x",
            delta={"k": 0.1},
        )
        score = compute_divergence_estimate([], delta)
        # baseline 0.4 + min(0.5, 0.05) = 0.45
        assert 0.4 < score < 0.5

    def test_large_magnitude_saturates(self):
        delta = ParameterShiftDelta(
            type="parameter_shift",
            target="x",
            delta={"a": 1.0, "b": -2.0, "c": 5.0},
        )
        score = compute_divergence_estimate([], delta)
        # baseline 0.4 + 0.5 (saturated) = 0.9
        assert 0.85 <= score <= 1.0

    def test_negative_values_scale_by_absolute(self):
        delta = ParameterShiftDelta(
            type="parameter_shift",
            target="x",
            delta={"k": -0.6},
        )
        # baseline 0.4 + 0.3 = 0.7
        score = compute_divergence_estimate([], delta)
        assert abs(score - 0.7) < 1e-6


class TestActorStateOverride:
    def test_emotion_field_weight(self):
        delta = ActorStateOverrideDelta(
            type="actor_state_override",
            actor_id="cohort_a",
            field="emotion",
            new_value=8.5,
        )
        score = compute_divergence_estimate([], delta)
        assert abs(score - 0.6) < 1e-6

    def test_stance_field_weight(self):
        delta = ActorStateOverrideDelta(
            type="actor_state_override",
            actor_id="cohort_a",
            field="issue_stance",
            new_value=-0.5,
        )
        score = compute_divergence_estimate([], delta)
        assert abs(score - 0.7) < 1e-6

    def test_unknown_field_falls_back_to_baseline(self):
        delta = ActorStateOverrideDelta(
            type="actor_state_override",
            actor_id="cohort_a",
            field="some_unknown_field_xyz",
            new_value=1,
        )
        score = compute_divergence_estimate([], delta)
        assert abs(score - 0.45) < 1e-6  # baseline for actor_state_override

    def test_dotted_leaf_match(self):
        delta = ActorStateOverrideDelta(
            type="actor_state_override",
            actor_id="cohort_a",
            field="self_ratings.willingness_to_speak",
            new_value=0.0,
        )
        score = compute_divergence_estimate([], delta)
        assert abs(score - 0.5) < 1e-6


class TestHeroDecisionOverride:
    def test_baseline_is_55(self):
        delta = HeroDecisionOverrideDelta(
            type="hero_decision_override",
            hero_id="hero_1",
            tick=5,
            new_decision={"public_actions": []},
        )
        score = compute_divergence_estimate([], delta)
        assert abs(score - 0.55) < 1e-6


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


class TestEdges:
    def test_none_delta_returns_zero(self):
        assert compute_divergence_estimate([], None) == 0.0

    def test_score_is_clamped_to_1(self):
        delta = ParameterShiftDelta(
            type="parameter_shift",
            target="x",
            delta={"a": 100.0, "b": 100.0, "c": 100.0},
        )
        # Big magnitudes + history volatility — must stay <= 1.0
        history = [
            {"divergence_score": 0.0},
            {"divergence_score": 1.0},
            {"divergence_score": 0.0},
        ]
        score = compute_divergence_estimate(history, delta)
        assert 0.0 <= score <= 1.0

    def test_dict_delta_is_validated(self):
        score = compute_divergence_estimate(
            [],
            {
                "type": "counterfactual_event_rewrite",
                "target_event_id": "e1",
                "parent_version": "a",
                "child_version": "b",
            },
        )
        assert score == 0.5

    def test_invalid_dict_returns_baseline(self):
        score = compute_divergence_estimate(
            [],
            {"type": "counterfactual_event_rewrite", "missing": "fields"},
        )
        # Validation should fail and we fall back to 0.4.
        assert score == 0.4

    def test_history_with_no_numeric_scores(self):
        delta = HeroDecisionOverrideDelta(
            type="hero_decision_override",
            hero_id="h",
            tick=0,
            new_decision={},
        )
        history = [{"some_other_metric": "n/a"}, {"another": True}]
        score = compute_divergence_estimate(history, delta)
        assert abs(score - 0.55) < 1e-6
