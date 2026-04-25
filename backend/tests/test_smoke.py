"""Smoke tests — verify the scaffolding loads correctly."""
from __future__ import annotations


def test_settings_loads() -> None:
    from backend.app.core.config import settings

    assert settings.openrouter_api_key.startswith("sk-or-")
