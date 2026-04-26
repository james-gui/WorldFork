"""Cheapest-possible CI smoke test: every public worldfork module imports.

Catches packaging mistakes (missing files, broken imports, typos) without
needing an OpenRouter key or a running MiroShark backend. The LLM-driven
suite in layer2_synthetic.py is opt-in via env (OPENROUTER_API_KEY).
"""

from __future__ import annotations

import importlib

import pytest


MODULES = [
    "worldfork",
    "worldfork.bootstrap",
    "worldfork.classifier",
    "worldfork.mood_perturbator",
    "worldfork.orchestrator",
    "worldfork.perturbation_generator",
    "worldfork.server",
]


@pytest.mark.parametrize("name", MODULES)
def test_import(name):
    importlib.import_module(name)


def test_server_app_constructed():
    from worldfork import server
    assert server.app is not None
    rules = {r.rule for r in server.app.url_map.iter_rules()}
    assert "/" in rules
    assert "/api/runs" in rules
    assert "/api/start" in rules
    assert "/api/run/<run_id>/lineage" in rules
    assert "/api/run/<run_id>/graph" in rules
