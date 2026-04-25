"""Provider-layer exceptions.

All exceptions raised by the provider layer derive from :class:`ProviderError`
so callers can write a single ``except ProviderError`` block and still inspect
specific subclasses for retry / fallback decisions.
"""
from __future__ import annotations


class ProviderError(Exception):
    """Base class for any provider-layer error."""


class RateLimitError(ProviderError):
    """Provider returned a rate-limit (429) response.

    ``retry_after`` is the number of seconds the caller should wait before
    retrying, parsed from the ``Retry-After`` header when available, or
    suggested by the local token bucket otherwise.
    """

    def __init__(self, message: str = "rate limited", retry_after: float | None = None) -> None:
        super().__init__(message)
        self.retry_after: float | None = retry_after


class ProviderTimeoutError(ProviderError):
    """The upstream provider did not return within the configured timeout."""


class InvalidJSONError(ProviderError):
    """The model emitted text that failed JSON validation, even after one repair attempt."""

    def __init__(self, message: str, raw_text: str = "", validator_message: str = "") -> None:
        super().__init__(message)
        self.raw_text: str = raw_text
        self.validator_message: str = validator_message


class BudgetExceededError(ProviderError):
    """The per-provider daily budget cap has been reached.

    Raised before the call is dispatched so no spend occurs.
    """

    def __init__(
        self,
        message: str,
        *,
        provider: str,
        daily_spent: float,
        cap: float,
    ) -> None:
        super().__init__(message)
        self.provider: str = provider
        self.daily_spent: float = daily_spent
        self.cap: float = cap


class FallbackExhaustedError(ProviderError):
    """Both the primary and fallback model failed all retry attempts."""
