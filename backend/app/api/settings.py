"""Settings API — PRD §20.4.

Endpoints:
  GET  /api/settings
  PATCH /api/settings
  GET  /api/settings/providers
  PATCH /api/settings/providers
  GET  /api/settings/model-routing
  PATCH /api/settings/model-routing
  GET  /api/settings/rate-limits
  PATCH /api/settings/rate-limits
  GET  /api/settings/branch-policy
  PATCH /api/settings/branch-policy
  POST /api/settings/providers/test
"""
from __future__ import annotations

import time
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.db import get_session
from backend.app.models.settings import (
    BranchPolicySettingModel,
    GlobalSettingModel,
    ModelRoutingEntryModel,
    ProviderSettingModel,
    RateLimitSettingModel,
)
from backend.app.schemas.api import (
    BranchPolicyResponse,
    PatchBranchPolicyRequest,
    PatchProvidersRequest,
    PatchRateLimitsRequest,
    PatchRoutingRequest,
    PatchSettingsRequest,
    ProviderSettingResponse,
    ProvidersResponse,
    RateLimitResponse,
    RateLimitsResponse,
    RoutingEntryResponse,
    RoutingResponse,
    SettingsResponse,
    TestProviderRequest,
    TestProviderResponse,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])

_SESSION = Annotated[AsyncSession, Depends(get_session)]


def _settings_to_response(row: GlobalSettingModel) -> SettingsResponse:
    return SettingsResponse(
        setting_id=row.setting_id,
        default_tick_duration_minutes=row.default_tick_duration_minutes,
        default_max_ticks=row.default_max_ticks,
        default_max_schedule_horizon_ticks=row.default_max_schedule_horizon_ticks,
        log_level=row.log_level,
        display_timezone=row.display_timezone,
        theme=row.theme,
        enable_oasis_adapter=row.enable_oasis_adapter,
        branching_defaults=dict(row.branching_defaults or {}),
        payload=dict(row.payload or {}),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _provider_to_response(row: ProviderSettingModel) -> ProviderSettingResponse:
    return ProviderSettingResponse(
        provider=row.provider,
        base_url=row.base_url,
        api_key_env=row.api_key_env,
        default_model=row.default_model,
        fallback_model=row.fallback_model,
        json_mode_required=row.json_mode_required,
        tool_calling_enabled=row.tool_calling_enabled,
        enabled=row.enabled,
        extra_headers=dict(row.extra_headers or {}),
        payload=dict(row.payload or {}),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _routing_to_response(row: ModelRoutingEntryModel) -> RoutingEntryResponse:
    return RoutingEntryResponse(
        job_type=row.job_type,
        preferred_provider=row.preferred_provider,
        preferred_model=row.preferred_model,
        fallback_provider=row.fallback_provider,
        fallback_model=row.fallback_model,
        temperature=row.temperature,
        top_p=row.top_p,
        max_tokens=row.max_tokens,
        max_concurrency=row.max_concurrency,
        requests_per_minute=row.requests_per_minute,
        tokens_per_minute=row.tokens_per_minute,
        timeout_seconds=row.timeout_seconds,
        retry_policy=row.retry_policy,
        daily_budget_usd=row.daily_budget_usd,
        payload=dict(row.payload or {}),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _rate_limit_to_response(row: RateLimitSettingModel) -> RateLimitResponse:
    return RateLimitResponse(
        provider=row.provider,
        enabled=row.enabled,
        rpm_limit=row.rpm_limit,
        tpm_limit=row.tpm_limit,
        max_concurrency=row.max_concurrency,
        burst_multiplier=row.burst_multiplier,
        retry_policy=row.retry_policy,
        jitter=row.jitter,
        daily_budget_usd=row.daily_budget_usd,
        branch_reserved_capacity_pct=row.branch_reserved_capacity_pct,
        healthcheck_enabled=row.healthcheck_enabled,
        payload=dict(row.payload or {}),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _branch_policy_to_response(row: BranchPolicySettingModel) -> BranchPolicyResponse:
    return BranchPolicyResponse(
        policy_id=row.policy_id,
        max_active_universes=row.max_active_universes,
        max_total_branches=row.max_total_branches,
        max_depth=row.max_depth,
        max_branches_per_tick=row.max_branches_per_tick,
        branch_cooldown_ticks=row.branch_cooldown_ticks,
        min_divergence_score=row.min_divergence_score,
        auto_prune_low_value=row.auto_prune_low_value,
        payload=dict(row.payload or {}),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


# ---------------------------------------------------------------------------
# Global settings
# ---------------------------------------------------------------------------


@router.get("", response_model=SettingsResponse, summary="Get global settings")
async def get_settings(session: _SESSION) -> SettingsResponse:
    result = await session.execute(select(GlobalSettingModel).where(GlobalSettingModel.setting_id == "default"))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Global settings not seeded — run make seed")
    return _settings_to_response(row)


@router.patch("", response_model=SettingsResponse, summary="Partial update global settings")
async def patch_settings(
    payload: PatchSettingsRequest,
    session: _SESSION,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> SettingsResponse:
    result = await session.execute(select(GlobalSettingModel).where(GlobalSettingModel.setting_id == "default"))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Global settings not seeded — run make seed")
    updates = payload.model_dump(exclude_none=True)
    for key, val in updates.items():
        setattr(row, key, val)
    await session.commit()
    await session.refresh(row)
    return _settings_to_response(row)


# ---------------------------------------------------------------------------
# Provider settings
# ---------------------------------------------------------------------------


@router.get("/providers", response_model=ProvidersResponse, summary="List provider settings")
async def get_providers(session: _SESSION) -> ProvidersResponse:
    result = await session.execute(select(ProviderSettingModel))
    rows = result.scalars().all()
    return ProvidersResponse(providers=[_provider_to_response(r) for r in rows])


@router.patch("/providers", response_model=ProvidersResponse, summary="Bulk-replace provider settings")
async def patch_providers(
    payload: PatchProvidersRequest,
    session: _SESSION,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> ProvidersResponse:
    # Upsert-per-row
    for p in payload.providers:
        result = await session.execute(select(ProviderSettingModel).where(ProviderSettingModel.provider == p.provider))
        row = result.scalar_one_or_none()
        if row is None:
            row = ProviderSettingModel(
                provider=p.provider,
                base_url=p.base_url,
                api_key_env=p.api_key_env,
                default_model=p.default_model,
                fallback_model=p.fallback_model,
                json_mode_required=p.json_mode_required,
                tool_calling_enabled=p.tool_calling_enabled,
                enabled=p.enabled,
                extra_headers=dict(p.extra_headers),
                payload=dict(p.payload),
            )
            session.add(row)
        else:
            row.base_url = p.base_url
            row.api_key_env = p.api_key_env
            row.default_model = p.default_model
            row.fallback_model = p.fallback_model
            row.json_mode_required = p.json_mode_required
            row.tool_calling_enabled = p.tool_calling_enabled
            row.enabled = p.enabled
            row.extra_headers = dict(p.extra_headers)
            row.payload = dict(p.payload)
    await session.commit()
    try:
        from backend.app.core.config import settings as runtime_settings
        from backend.app.providers import clear_registry, ensure_providers_in_loop

        clear_registry()
        await ensure_providers_in_loop(runtime_settings)
    except Exception:
        pass
    result2 = await session.execute(select(ProviderSettingModel))
    rows = result2.scalars().all()
    return ProvidersResponse(providers=[_provider_to_response(r) for r in rows])


# ---------------------------------------------------------------------------
# Model routing
# ---------------------------------------------------------------------------


@router.get("/model-routing", response_model=RoutingResponse, summary="List model routing entries")
async def get_model_routing(session: _SESSION) -> RoutingResponse:
    result = await session.execute(select(ModelRoutingEntryModel))
    rows = result.scalars().all()
    return RoutingResponse(entries=[_routing_to_response(r) for r in rows])


@router.patch("/model-routing", response_model=RoutingResponse, summary="Bulk-replace model routing")
async def patch_model_routing(
    payload: PatchRoutingRequest,
    session: _SESSION,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> RoutingResponse:
    for entry in payload.entries:
        providers = {entry.preferred_provider, entry.fallback_provider}
        if any(provider and provider != "openrouter" for provider in providers):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="This deployment only supports OpenRouter routing providers.",
            )
        result = await session.execute(
            select(ModelRoutingEntryModel).where(ModelRoutingEntryModel.job_type == entry.job_type)
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = ModelRoutingEntryModel(
                job_type=entry.job_type,
                preferred_provider=entry.preferred_provider,
                preferred_model=entry.preferred_model,
                fallback_provider=entry.fallback_provider,
                fallback_model=entry.fallback_model,
                temperature=entry.temperature,
                top_p=entry.top_p,
                max_tokens=entry.max_tokens,
                max_concurrency=entry.max_concurrency,
                requests_per_minute=entry.requests_per_minute,
                tokens_per_minute=entry.tokens_per_minute,
                timeout_seconds=entry.timeout_seconds,
                retry_policy=entry.retry_policy,
                daily_budget_usd=entry.daily_budget_usd,
                payload=dict(entry.payload),
            )
            session.add(row)
        else:
            row.preferred_provider = entry.preferred_provider
            row.preferred_model = entry.preferred_model
            row.fallback_provider = entry.fallback_provider
            row.fallback_model = entry.fallback_model
            row.temperature = entry.temperature
            row.top_p = entry.top_p
            row.max_tokens = entry.max_tokens
            row.max_concurrency = entry.max_concurrency
            row.requests_per_minute = entry.requests_per_minute
            row.tokens_per_minute = entry.tokens_per_minute
            row.timeout_seconds = entry.timeout_seconds
            row.retry_policy = entry.retry_policy
            row.daily_budget_usd = entry.daily_budget_usd
            row.payload = dict(entry.payload)
    await session.commit()
    result2 = await session.execute(select(ModelRoutingEntryModel))
    rows = result2.scalars().all()
    return RoutingResponse(entries=[_routing_to_response(r) for r in rows])


# ---------------------------------------------------------------------------
# Rate limits
# ---------------------------------------------------------------------------


@router.get("/rate-limits", response_model=RateLimitsResponse, summary="List rate limit settings")
async def get_rate_limits(session: _SESSION) -> RateLimitsResponse:
    result = await session.execute(select(RateLimitSettingModel))
    rows = result.scalars().all()
    return RateLimitsResponse(rate_limits=[_rate_limit_to_response(r) for r in rows])


@router.patch("/rate-limits", response_model=RateLimitsResponse, summary="Bulk-replace rate limit settings")
async def patch_rate_limits(
    payload: PatchRateLimitsRequest,
    session: _SESSION,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> RateLimitsResponse:
    for rl in payload.rate_limits:
        result = await session.execute(
            select(RateLimitSettingModel).where(RateLimitSettingModel.provider == rl.provider)
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = RateLimitSettingModel(
                provider=rl.provider,
                enabled=rl.enabled,
                rpm_limit=rl.rpm_limit,
                tpm_limit=rl.tpm_limit,
                max_concurrency=rl.max_concurrency,
                burst_multiplier=rl.burst_multiplier,
                retry_policy=rl.retry_policy,
                jitter=rl.jitter,
                daily_budget_usd=rl.daily_budget_usd,
                branch_reserved_capacity_pct=rl.branch_reserved_capacity_pct,
                healthcheck_enabled=rl.healthcheck_enabled,
                payload=dict(rl.payload),
            )
            session.add(row)
        else:
            row.enabled = rl.enabled
            row.rpm_limit = rl.rpm_limit
            row.tpm_limit = rl.tpm_limit
            row.max_concurrency = rl.max_concurrency
            row.burst_multiplier = rl.burst_multiplier
            row.retry_policy = rl.retry_policy
            row.jitter = rl.jitter
            row.daily_budget_usd = rl.daily_budget_usd
            row.branch_reserved_capacity_pct = rl.branch_reserved_capacity_pct
            row.healthcheck_enabled = rl.healthcheck_enabled
            row.payload = dict(rl.payload)
    await session.commit()
    result2 = await session.execute(select(RateLimitSettingModel))
    rows = result2.scalars().all()
    return RateLimitsResponse(rate_limits=[_rate_limit_to_response(r) for r in rows])


# ---------------------------------------------------------------------------
# Branch policy
# ---------------------------------------------------------------------------


@router.get("/branch-policy", response_model=BranchPolicyResponse, summary="Get branch policy")
async def get_branch_policy(session: _SESSION) -> BranchPolicyResponse:
    result = await session.execute(select(BranchPolicySettingModel).where(BranchPolicySettingModel.policy_id == "default"))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch policy not seeded — run make seed")
    return _branch_policy_to_response(row)


@router.patch("/branch-policy", response_model=BranchPolicyResponse, summary="Partial update branch policy")
async def patch_branch_policy(
    payload: PatchBranchPolicyRequest,
    session: _SESSION,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> BranchPolicyResponse:
    result = await session.execute(select(BranchPolicySettingModel).where(BranchPolicySettingModel.policy_id == "default"))
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch policy not seeded — run make seed")
    updates = payload.model_dump(exclude_none=True)
    for key, val in updates.items():
        setattr(row, key, val)
    await session.commit()
    await session.refresh(row)
    return _branch_policy_to_response(row)


# ---------------------------------------------------------------------------
# Provider healthcheck
# ---------------------------------------------------------------------------


@router.post("/providers/test", response_model=TestProviderResponse, summary="Test LLM provider connectivity")
async def test_provider(payload: TestProviderRequest) -> TestProviderResponse:
    try:
        from backend.app.providers import get_provider
        provider = get_provider(payload.provider)
    except KeyError:
        return TestProviderResponse(
            ok=False,
            provider=payload.provider,
            model=payload.model,
            error=f"Provider '{payload.provider}' not registered",
        )
    try:
        t0 = time.monotonic()
        health = await provider.healthcheck()
        latency_ms = int((time.monotonic() - t0) * 1000)
        health_payload = health.model_dump() if hasattr(health, "model_dump") else dict(health)
        ok = bool(health_payload.get("ok", False))
        return TestProviderResponse(
            ok=ok,
            latency_ms=latency_ms,
            provider=payload.provider,
            model=payload.model,
            error=None if ok else str(health_payload.get("error", "healthcheck failed")),
        )
    except Exception as exc:
        return TestProviderResponse(
            ok=False,
            provider=payload.provider,
            model=payload.model,
            error=str(exc),
        )
