"""Clock helpers — timezone-aware UTC datetimes, freezable for tests."""
from __future__ import annotations

import os
from datetime import UTC, datetime


def now_utc() -> datetime:
    """Return the current UTC datetime (timezone-aware).

    In tests, set the environment variable ``FREEZE_TIME`` to an ISO-8601
    string (e.g. ``2024-01-01T00:00:00Z``) to pin the clock. The
    ``freezegun`` library provides a more ergonomic alternative.
    """
    freeze_raw = os.environ.get("FREEZE_TIME")
    if freeze_raw:
        return datetime.fromisoformat(freeze_raw.replace("Z", "+00:00"))
    return datetime.now(UTC)
