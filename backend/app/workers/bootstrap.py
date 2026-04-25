"""Worker bootstrap — called at application startup.

B6 will expand this to include Zep client initialisation, connection pool
warm-up, and any other async setup that workers need before accepting tasks.
"""
from __future__ import annotations


async def setup_workers() -> None:
    """Async startup hook for the worker process.

    Currently a no-op placeholder.  Attach Zep / DB / Redis warm-up here
    when those integrations are wired in B6.
    """
