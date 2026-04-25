"""Unit tests for backend.app.sociology.graphs (MultiplexGraph)."""
from __future__ import annotations

import pytest

from backend.app.sociology.graphs import MultiplexGraph


def test_layers_constant_has_5_layers():
    assert len(MultiplexGraph.LAYERS) == 5
    assert set(MultiplexGraph.LAYERS) == {
        "exposure",
        "trust",
        "dependency",
        "mobilization",
        "identity",
    }


def test_add_node_with_kind_and_label():
    g = MultiplexGraph()
    g.add_node("c1", kind="cohort", label="Workers", attrs={"region": "SF"})
    g.add_node("h1", kind="hero", label="Senator")
    assert "c1" in g.graph
    assert g.graph.nodes["c1"]["label"] == "Workers"
    assert g.graph.nodes["c1"]["kind"] == "cohort"


def test_add_node_rejects_unknown_kind():
    g = MultiplexGraph()
    with pytest.raises(ValueError):
        g.add_node("x", kind="alien", label="X")  # type: ignore[arg-type]


def test_add_edge_per_layer_and_get_layer_projection():
    g = MultiplexGraph()
    for nid in ("a", "b", "c"):
        g.add_node(nid, kind="cohort", label=nid.upper())

    g.add_edge("trust", "a", "b", weight=0.7)
    g.add_edge("exposure", "a", "b", weight=0.5)
    g.add_edge("mobilization", "b", "c", weight=0.3)

    trust_layer = g.get_layer("trust")
    exposure_layer = g.get_layer("exposure")
    mob_layer = g.get_layer("mobilization")

    # Each projection should contain only its own edges.
    assert trust_layer.has_edge("a", "b")
    assert not trust_layer.has_edge("b", "c")
    assert exposure_layer.has_edge("a", "b")
    assert not exposure_layer.has_edge("b", "c")
    assert mob_layer.has_edge("b", "c")
    assert not mob_layer.has_edge("a", "b")

    # Weights preserved
    assert trust_layer["a"]["b"]["weight"] == pytest.approx(0.7)
    assert exposure_layer["a"]["b"]["weight"] == pytest.approx(0.5)


def test_add_edge_rejects_unknown_layer():
    g = MultiplexGraph()
    with pytest.raises(ValueError):
        g.add_edge("nonsense", "a", "b", weight=1.0)


def test_to_jsonl_rows_per_layer():
    g = MultiplexGraph()
    g.add_node("a", kind="cohort", label="A")
    g.add_node("b", kind="cohort", label="B")
    g.add_edge("trust", "a", "b", weight=0.6)
    g.add_edge("identity", "a", "b", weight=0.9)
    rows = g.to_jsonl_rows("trust")
    assert len(rows) == 1
    assert rows[0]["src"] == "a"
    assert rows[0]["layer"] == "trust"
    assert rows[0]["weight"] == pytest.approx(0.6)


def test_from_state_bootstraps_nodes():
    class _Fake:
        def __init__(self, cohort_id, label):
            self.cohort_id = cohort_id
            self.label = label

    cohorts = [_Fake("c1", "Workers"), _Fake("c2", "Owners")]
    g = MultiplexGraph.from_state(cohorts=cohorts)
    assert "c1" in g.graph
    assert "c2" in g.graph
    assert g.graph.nodes["c1"]["kind"] == "cohort"
