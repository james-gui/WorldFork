"""Simulation-layer errors.

Errors raised by initializer / tick runner / branch orchestration code.
Kept in a small dedicated module so callers can `from backend.app.simulation
.errors import InitializerValidationError` without pulling in the heavier
modules.
"""
from __future__ import annotations


class InitializerValidationError(Exception):
    """Raised when the Big Bang initializer LLM output fails validation.

    This includes:
    - JSON-schema mismatch with ``initializer_schema.json``;
    - missing required PRD §9.3 / §9.5 fields on archetypes / heroes;
    - non-positive populations;
    - any post-parse semantic issue that should halt the initializer.

    The caller should catch this, persist a validation report, mark the
    BigBangRun as ``failed``, and surface the message to the operator.
    """

    def __init__(self, message: str, *, report: dict | None = None) -> None:
        super().__init__(message)
        self.report = report or {"error": message}


class InitializerProviderError(Exception):
    """Raised when the LLM provider call itself fails (after fallback).

    Distinguished from :class:`InitializerValidationError` so the API layer
    can return a different status code / retry suggestion.
    """
