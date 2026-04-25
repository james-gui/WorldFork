"""ID generation helpers.

Uses python-ulid for lexicographically sortable, time-ordered IDs.
Falls back to uuid4 hex if ulid is unavailable.
"""
from __future__ import annotations


def new_id(prefix: str) -> str:
    """Return a prefixed unique ID, e.g. ``run_01ARZ3NDEKTSV4RRFFQ69G5FAV``.

    The suffix is a 26-character ULID (lexicographically sortable).
    """
    try:
        from ulid import ULID  # python-ulid package

        suffix = str(ULID()).lower()
    except ImportError:
        import uuid

        suffix = uuid.uuid4().hex[:16]
    return f"{prefix}_{suffix}"
