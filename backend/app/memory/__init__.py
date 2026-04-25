"""
WorldFork memory adapter layer.

Public surface:
  get_memory()        — returns the configured MemoryProvider singleton.
  MemoryProvider      — structural Protocol (runtime_checkable).
  LocalMemoryProvider — in-process dict-backed fallback.
  ZepMemoryProvider   — Zep Cloud v2 adapter.
  MemoryFailure       — exception raised on hard backend failures.
"""
from backend.app.memory.base import MemoryFailure, MemoryProvider
from backend.app.memory.factory import get_memory, reload_memory_provider
from backend.app.memory.local import LocalMemoryProvider
from backend.app.memory.zep_adapter import ZepMemoryProvider

__all__ = [
    "get_memory",
    "reload_memory_provider",
    "MemoryProvider",
    "LocalMemoryProvider",
    "ZepMemoryProvider",
    "MemoryFailure",
]
