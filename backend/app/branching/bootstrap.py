"""Bootstrap hooks for the branching engine.

This module is intentionally a placeholder so future startup hooks
(e.g. priming the lineage cache, registering Celery tasks, materialising
SQL views like ``v_universe_state``) have a single home and consumers do
not need to touch ``__init__.py`` or other modules.
"""
from __future__ import annotations


async def bootstrap_branching() -> None:
    """No-op bootstrap; hook future warm-up work here."""
    return None
