"""Unit tests for backend.app.sociology.trust."""
from __future__ import annotations

import pytest

from backend.app.schemas.actors import CohortState
from backend.app.sociology.trust import TrustGraph


def _cohort(cid: str, summary: dict) -> CohortState:
    return CohortState(
        cohort_id=cid,
        universe_id="u-1",
        tick=0,
        archetype_id="a-1",
        represented_population=500,
        population_share_of_archetype=0.25,
        expression_level=0.5,
        mobilization_mode="dormant",
        speech_mode="silent",
        attention=0.5,
        fatigue=0.1,
        prompt_temperature=0.7,
        representation_mode="population",
        visible_trust_summary=summary,
    )


def test_add_edge_and_get_trust():
    g = TrustGraph()
    g.add_or_update_edge(
        "a",
        "b",
        ingroup_affinity=0.8,
        recent_alignment=0.6,
        exposure_count=2,
    )
    val = g.current_trust("a", "b")
    # Cold-start trust = 0.5 * 0.8 + 0.5 * 0.6 = 0.7
    assert val == pytest.approx(0.7)


def test_get_trust_missing_edge_returns_zero():
    g = TrustGraph()
    assert g.current_trust("a", "b") == 0.0


def test_ewma_blend_on_repeat_update():
    g = TrustGraph(alpha=0.5)
    g.add_or_update_edge(
        "a",
        "b",
        ingroup_affinity=0.5,
        recent_alignment=0.5,
        exposure_count=1,
    )
    g.add_or_update_edge(
        "a",
        "b",
        ingroup_affinity=1.0,
        recent_alignment=1.0,
        exposure_count=1,
    )
    # Cold start = 0.5; second update: 0.5 * 0.5 + 0.5 * 1.0 = 0.75
    assert g.current_trust("a", "b") == pytest.approx(0.75)


def test_to_matrix_correctness():
    g = TrustGraph()
    g.add_or_update_edge(
        "a", "b", ingroup_affinity=0.4, recent_alignment=0.4, exposure_count=0
    )
    g.add_or_update_edge(
        "b", "c", ingroup_affinity=0.6, recent_alignment=0.6, exposure_count=0
    )
    m = g.to_matrix(["a", "b", "c"])
    assert m.shape == (3, 3)
    assert m[0, 1] == pytest.approx(0.4)
    assert m[1, 2] == pytest.approx(0.6)
    # Reverse direction unset
    assert m[1, 0] == 0.0
    assert m[2, 0] == 0.0


def test_neighbors_above_threshold():
    g = TrustGraph()
    g.add_or_update_edge(
        "a", "b", ingroup_affinity=0.9, recent_alignment=0.9, exposure_count=0
    )
    g.add_or_update_edge(
        "a", "c", ingroup_affinity=0.1, recent_alignment=0.1, exposure_count=0
    )
    out = g.neighbors_above("a", threshold=0.5)
    assert out == {"b"}


def test_from_cohort_states():
    a = _cohort("a", {"b": 0.6, "c": -0.2})
    b = _cohort("b", {"a": 0.3})
    g = TrustGraph.from_cohort_states([a, b])
    assert g.current_trust("a", "b") == pytest.approx(0.6)
    assert g.current_trust("a", "c") == pytest.approx(-0.2)
    assert g.current_trust("b", "a") == pytest.approx(0.3)


def test_to_jsonl_rows_serializable():
    g = TrustGraph()
    g.add_or_update_edge(
        "a", "b", ingroup_affinity=0.5, recent_alignment=0.5, exposure_count=3
    )
    rows = g.to_jsonl_rows()
    assert isinstance(rows, list)
    assert len(rows) == 1
    row = rows[0]
    assert row["src"] == "a"
    assert row["dst"] == "b"
    assert "trust" in row
    assert row["exposure"] == 3
