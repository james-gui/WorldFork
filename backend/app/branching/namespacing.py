"""ID namespacing helpers for cross-universe disambiguation.

The cohort/hero/event PKs in the production schema do **not** include
``universe_id``.  When the branch engine performs copy-on-write at
``branch_from_tick``, it must produce new rows that share semantic identity
with the parent (so cross-universe analytics can join on the original id)
but have a unique PK in the child universe.  We encode the universe in a
suffix: ``original_id#c<suffix>``.

The suffix is the last 6 characters of the child universe_id (the trailing
ULID bytes are time-ordered + uniformly random, so collisions across siblings
are astronomically unlikely).
"""
from __future__ import annotations

_NAMESPACE_SEP = "#c"
_SUFFIX_LEN = 6


def suffix_for(universe_id: str) -> str:
    """Return the universe-specific 6-char namespace suffix."""
    return universe_id[-_SUFFIX_LEN:]


def namespace_id(original_id: str, suffix: str) -> str:
    """Return ``original_id#c<suffix>`` (idempotent if already namespaced for the same suffix)."""
    expected = f"{_NAMESPACE_SEP}{suffix}"
    if original_id.endswith(expected):
        return original_id
    return f"{original_id}{_NAMESPACE_SEP}{suffix}"


def strip_namespace(maybe_namespaced: str) -> str:
    """Return the original id with any ``#cXXXXXX`` suffix stripped."""
    idx = maybe_namespaced.rfind(_NAMESPACE_SEP)
    if idx < 0:
        return maybe_namespaced
    return maybe_namespaced[:idx]


def is_namespaced(value: str) -> bool:
    """True if ``value`` carries a ``#cXXXXXX`` suffix."""
    idx = value.rfind(_NAMESPACE_SEP)
    if idx < 0:
        return False
    return len(value) - idx == len(_NAMESPACE_SEP) + _SUFFIX_LEN
