"""Pytest fixtures for the WorldFork backend test suite."""
from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def event_loop_policy():
    """Use the default asyncio event loop policy (session-scoped)."""
    import asyncio
    return asyncio.DefaultEventLoopPolicy()


@pytest.fixture
def tmp_run_root(tmp_path: Path) -> Path:
    """Return a temporary directory that mimics the RUN_ROOT layout."""
    run_root = tmp_path / "runs"
    run_root.mkdir()
    return run_root


# TODO B2-A: replace this stub with a real transactional DB session fixture.
@pytest.fixture
async def db_session():
    """Async DB session fixture — TODO B2-A to implement with transactional rollback."""
    raise NotImplementedError("db_session fixture not yet implemented (TODO B2-A)")
