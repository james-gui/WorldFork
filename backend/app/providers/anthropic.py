"""Anthropic provider — direct adapter intentionally disabled.

Anthropic's SDK shape is different (Messages API; system prompt is a top-level
field, not the first message). For B2-B we expose the Protocol surface and
delegate to OpenRouter when the user has the OpenRouter key — most teams will
just route Anthropic models through OpenRouter (`anthropic/claude-3-5-sonnet`).

This deployment routes all Anthropic-family model IDs through OpenRouter.
"""
from __future__ import annotations

from datetime import UTC, datetime

from backend.app.providers.base import BaseProvider
from backend.app.providers.errors import ProviderError
from backend.app.schemas.llm import (
    EmbeddingConfig,
    EmbeddingResult,
    LLMResult,
    ModelConfig,
    PromptPacket,
    ProviderHealth,
)


class AnthropicProvider(BaseProvider):
    """Direct Anthropic adapter that reports unavailable unless explicitly implemented."""

    name = "anthropic"

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = "https://api.anthropic.com",
        default_model: str = "claude-3-5-sonnet-latest",
        fallback_model: str | None = "claude-3-5-haiku-latest",
        request_timeout: float = 120.0,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self.default_model = default_model
        self.fallback_model = fallback_model
        self._request_timeout = request_timeout

    async def generate_structured(
        self, prompt: PromptPacket, config: ModelConfig
    ) -> LLMResult:
        raise ProviderError(
            "AnthropicProvider direct generate_structured is not implemented; "
            "route Claude models through OpenRouter (e.g. anthropic/claude-3-5-sonnet) "
            "or implement the AsyncAnthropic shape."
        )

    async def generate_text(
        self, prompt: PromptPacket, config: ModelConfig
    ) -> LLMResult:
        raise ProviderError("AnthropicProvider direct generate_text is not implemented.")

    async def embed(
        self, texts: list[str], config: EmbeddingConfig
    ) -> EmbeddingResult:
        raise ProviderError("Anthropic does not currently expose an embeddings endpoint.")

    async def healthcheck(self) -> ProviderHealth:
        return ProviderHealth(
            provider=self.name,
            ok=False,
            latency_ms=0,
            details={"note": "Route Anthropic models through OpenRouter for this deployment."},
        )

    @staticmethod
    def _make_unsupported_result(model: str) -> LLMResult:  # pragma: no cover
        return LLMResult(
            call_id=BaseProvider._make_call_id("llm"),
            provider="anthropic",
            model_used=model,
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            cost_usd=None,
            latency_ms=0,
            parsed_json=None,
            tool_calls=[],
            raw_response={},
            created_at=datetime.now(UTC),
            repaired_once=False,
        )
