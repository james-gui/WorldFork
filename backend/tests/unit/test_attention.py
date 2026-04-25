"""Unit tests for backend.app.sociology.attention."""
from __future__ import annotations

import numpy as np
import pytest

from backend.app.schemas.actors import CohortState
from backend.app.schemas.sociology import SociologyParams
from backend.app.sociology.attention import (
    update_attention,
    update_attention_batch,
)


def _make_cohort(attention: float = 0.5) -> CohortState:
    return CohortState(
        cohort_id="coh-1",
        universe_id="u-1",
        tick=0,
        archetype_id="a-1",
        represented_population=500,
        population_share_of_archetype=0.5,
        expression_level=0.4,
        mobilization_mode="dormant",
        speech_mode="silent",
        attention=attention,
        fatigue=0.1,
        prompt_temperature=0.7,
        representation_mode="population",
    )


def test_decay_alone_reduces_attention():
    params = SociologyParams()
    c = _make_cohort(attention=0.8)
    a = update_attention(
        cohort=c,
        event_salience=0.0,
        feed_salience=0.0,
        personal_impact=0.0,
        identity_threat=0.0,
        params=params,
    )
    assert a < c.attention
    assert a == pytest.approx(0.8 * (1.0 - params.attention.default_decay_rate))


def test_salience_increases_attention():
    params = SociologyParams()
    c = _make_cohort(attention=0.3)
    a_decay = update_attention(
        cohort=c,
        event_salience=0.0,
        feed_salience=0.0,
        personal_impact=0.0,
        identity_threat=0.0,
        params=params,
    )
    a_event = update_attention(
        cohort=c,
        event_salience=0.5,
        feed_salience=0.0,
        personal_impact=0.0,
        identity_threat=0.0,
        params=params,
    )
    assert a_event > a_decay


def test_attention_clamps_to_max():
    params = SociologyParams()
    c = _make_cohort(attention=0.9)
    a = update_attention(
        cohort=c,
        event_salience=10.0,
        feed_salience=10.0,
        personal_impact=10.0,
        identity_threat=10.0,
        params=params,
    )
    assert a == pytest.approx(params.attention.max_attention)


def test_attention_clamps_to_zero():
    """Negative scenario shouldn't push attention below zero."""
    params = SociologyParams()
    c = _make_cohort(attention=0.05)
    # No salience signal -> just decay; should remain non-negative.
    a = update_attention(
        cohort=c,
        event_salience=0.0,
        feed_salience=0.0,
        personal_impact=0.0,
        identity_threat=0.0,
        params=params,
    )
    assert a >= 0.0


def test_batch_matches_scalar():
    params = SociologyParams()
    states = np.array([0.3, 0.5, 0.8])
    salience = np.array(
        [
            [0.1, 0.2, 0.0, 0.0],
            [0.0, 0.0, 0.0, 0.0],
            [0.4, 0.4, 0.4, 0.4],
        ]
    )
    out = update_attention_batch(states, salience, params)
    assert out.shape == (3,)
    assert (out >= 0.0).all()
    assert (out <= params.attention.max_attention).all()
    # Row 1 (no salience) should equal pure decay
    assert out[1] == pytest.approx(0.5 * (1 - params.attention.default_decay_rate))


def test_batch_rejects_bad_shape():
    params = SociologyParams()
    states = np.array([0.3, 0.5])
    bad = np.zeros((2, 3))
    with pytest.raises(ValueError):
        update_attention_batch(states, bad, params)
