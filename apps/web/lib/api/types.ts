/**
 * Hand-written TypeScript types mirroring backend/app/schemas/api.py.
 * This is the single source of truth for all frontend API types.
 * types.gen.ts re-exports from here so existing imports keep working.
 */

// ---------------------------------------------------------------------------
// Runs §20.1
// ---------------------------------------------------------------------------

export interface CreateRunRequest {
  display_name: string;
  scenario_text: string;
  time_horizon_label?: string;
  tick_duration_minutes?: number;
  max_ticks?: number;
  max_schedule_horizon_ticks?: number;
  uploaded_doc_ids?: string[];
  provider_snapshot_id?: string | null;
}

export interface CreateRunResponse {
  run_id: string;
  root_universe_id: string;
  status: string;
  job_id?: string | null;
  enqueued?: boolean;
  degraded?: boolean;
  error?: string | null;
}

export interface RunListItem {
  run_id: string;
  display_name: string;
  status: string;
  scenario_text: string;
  time_horizon_label: string;
  tick_duration_minutes: number;
  max_ticks: number;
  created_at: string;
  updated_at: string;
  favorite: boolean;
  archived: boolean;
  root_universe_id: string;
  active_universe_count: number;
  total_universe_count: number;
}

export interface RunListResponse {
  items: RunListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface RunDetail {
  run_id: string;
  display_name: string;
  description?: string | null;
  status: string;
  scenario_text: string;
  time_horizon_label: string;
  tick_duration_minutes: number;
  max_ticks: number;
  max_schedule_horizon_ticks: number;
  root_universe_id: string;
  run_folder_path?: string | null;
  source_of_truth_version?: string | null;
  provider_snapshot_id?: string | null;
  created_at: string;
  updated_at: string;
  active_universe_count: number;
  total_universe_count: number;
  latest_metrics: Record<string, unknown>;
  safe_edit_metadata: Record<string, unknown>;
}

export interface PatchRunRequest {
  display_name?: string | null;
  description?: string | null;
  tags?: string[] | null;
  favorite?: boolean | null;
  archived?: boolean | null;
}

export interface RunResultsResponse {
  run_id: string;
  status: string;
  generated_at?: string | null;
  provider?: string | null;
  model_used?: string | null;
  summary?: string | null;
  classifications: Record<string, unknown>;
  branch_clusters: Record<string, unknown>[];
  universe_outcomes: Record<string, unknown>[];
  timeline_highlights: Record<string, unknown>[];
  metrics: Record<string, unknown>;
  artifact_path?: string | null;
  error?: string | null;
  job_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RunResultsRegenerateResponse {
  run_id: string;
  job_id: string;
  status: string;
  enqueued: boolean;
}

export interface SoTBundleResponse {
  version: string;
  emotions: Record<string, unknown>;
  behavior_axes: Record<string, unknown>;
  ideology_axes: Record<string, unknown>;
  expression_scale: Record<string, unknown>;
  issue_stance_axes: Record<string, unknown>;
  event_types: Record<string, unknown>;
  social_action_tools: Record<string, unknown>;
  channel_types: Record<string, unknown>;
  actor_types: Record<string, unknown>;
  sociology_parameters: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Universes §20.2
// ---------------------------------------------------------------------------

export interface UniverseDetail {
  universe_id: string;
  big_bang_id: string;
  parent_universe_id?: string | null;
  child_universe_ids: string[];
  branch_from_tick: number;
  branch_depth: number;
  lineage_path: string[];
  status: string;
  branch_reason: string;
  current_tick: number;
  latest_metrics: Record<string, unknown>;
  created_at: string;
  frozen_at?: string | null;
  killed_at?: string | null;
  completed_at?: string | null;
  active_cohort_count: number;
  branch_summary: Record<string, unknown>;
}

export interface BranchPreviewRequest {
  delta?: Record<string, unknown>;
  reason?: string;
}

export interface BranchPreviewResponse {
  approved: boolean;
  downgraded: boolean;
  rejection_reason?: string | null;
  policy_checks: Record<string, unknown>[];
  note: string;
}

export interface BranchRequest {
  delta?: Record<string, unknown>;
  reason?: string;
}

export interface BranchResponse {
  candidate_universe_id: string;
  job_id: string;
  note: string;
}

export interface StepRequest {
  tick?: number | null;
}

export interface LineageResponse {
  lineage_path: string[];
  parent?: string | null;
  depth: number;
  branch_from_tick?: number | null;
}

export interface DescendantsResponse {
  universe_id: string;
  status: string;
  depth: number;
  current_tick: number;
  children: DescendantsResponse[];
}

export interface TickArtifactResponse {
  universe_id: string;
  tick: number;
  parsed_decisions: Record<string, unknown>[];
  social_posts: Record<string, unknown>[];
  state_after: Record<string, unknown>;
  god_decision?: Record<string, unknown> | null;
  metrics: Record<string, unknown>;
  prompt_summary: {
    promptHash: string;
    model: string;
    cost: number;
    tokens: { prompt: number; completion: number };
    toolCalls: number;
    provider: string;
    traceId: string;
  };
  tool_calls: Array<{
    id: string;
    name: string;
    status: 'success' | 'error' | 'skipped';
    args: Record<string, unknown>;
  }>;
  emotion_trends: Array<Record<string, number>>;
}

export interface TickTraceActor {
  actor_id: string;
  actor_kind: string;
  call_id?: string | null;
  provider?: string | null;
  model_used?: string | null;
  job_type?: string | null;
  prompt_packet?: Record<string, unknown> | null;
  visible_feed: Record<string, unknown>[];
  visible_events: Record<string, unknown>[];
  retrieved_memory?: Record<string, unknown> | null;
  raw_response?: Record<string, unknown> | string | null;
  parsed_json?: Record<string, unknown> | null;
  tool_calls: Record<string, unknown>[];
  rationale?: Record<string, unknown> | string | null;
  self_ratings: Record<string, unknown>;
  state_before?: Record<string, unknown> | null;
  state_after?: Record<string, unknown> | null;
  state_delta: Record<string, unknown>;
}

export interface TickTraceResponse {
  universe_id: string;
  tick: number;
  include_raw: boolean;
  actors: TickTraceActor[];
  state_before: Record<string, unknown>;
  state_after: Record<string, unknown>;
  god_decision?: Record<string, unknown> | null;
  redactions_applied: boolean;
  missing_artifacts: string[];
}

export interface ForceDeviationRequest {
  tick: number;
  mode: 'god_prompt' | 'structured_delta';
  prompt?: string | null;
  delta?: Record<string, unknown> | null;
  reason?: string;
  auto_start?: boolean;
}

export interface ForceDeviationResponse {
  run_id: string;
  parent_universe_id: string;
  child_universe_id?: string | null;
  tick: number;
  mode: string;
  job_id: string;
  status: string;
  enqueued: boolean;
  generated_delta?: Record<string, unknown> | null;
  audit_artifact_path?: string | null;
  note: string;
}

// ---------------------------------------------------------------------------
// Multiverse §20.3
// ---------------------------------------------------------------------------

export interface MultiverseTreeNode {
  universe_id: string;
  parent_universe_id?: string | null;
  depth: number;
  branch_from_tick?: number | null;
  status: string;
  current_tick: number;
  latest_metrics: Record<string, unknown>;
  branch_reason: string;
  branch_delta: Record<string, unknown>;
  lineage_path: string[];
  descendant_count: number;
  created_at?: string | null;
}

export interface MultiverseEdge {
  source: string;
  target: string;
  branch_tick?: number | null;
}

export interface MultiverseTreeResponse {
  big_bang_id: string;
  max_ticks: number;
  nodes: MultiverseTreeNode[];
  edges: MultiverseEdge[];
}

export interface MultiverseDagResponse {
  big_bang_id: string;
  nodes: MultiverseTreeNode[];
  edges: MultiverseEdge[];
}

export interface MultiverseMetricsResponse {
  big_bang_id: string;
  active_universes: number;
  total_branches: number;
  max_depth: number;
  candidate_branches: number;
  branch_budget_pct: number;
  branch_budget_used: number;
  branch_budget_limit: number;
  active_branches_per_tick: number;
}

export interface PruneRequest {
  min_value?: number;
  dry_run?: boolean;
}

export interface PruneResponse {
  dry_run: boolean;
  pruned_universe_ids: string[];
  pruned_count: number;
}

export interface FocusBranchRequest {
  universe_id: string;
}

export interface CompareRequest {
  universe_ids: string[];
  aspect?: string;
}

export interface CompareResponse {
  aspect: string;
  comparison: Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Settings §20.4
// ---------------------------------------------------------------------------

export interface SettingsResponse {
  setting_id: string;
  default_tick_duration_minutes: number;
  default_max_ticks: number;
  default_max_schedule_horizon_ticks: number;
  log_level: string;
  display_timezone: string;
  theme: string;
  enable_oasis_adapter: boolean;
  branching_defaults: Record<string, unknown>;
  payload: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PatchSettingsRequest {
  default_tick_duration_minutes?: number | null;
  default_max_ticks?: number | null;
  default_max_schedule_horizon_ticks?: number | null;
  log_level?: string | null;
  display_timezone?: string | null;
  theme?: string | null;
  enable_oasis_adapter?: boolean | null;
  branching_defaults?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
}

export interface ProviderSettingResponse {
  provider: string;
  base_url: string;
  api_key_env: string;
  default_model: string;
  fallback_model?: string | null;
  json_mode_required: boolean;
  tool_calling_enabled: boolean;
  enabled: boolean;
  extra_headers: Record<string, unknown>;
  payload: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProvidersResponse {
  providers: ProviderSettingResponse[];
}

export interface ProviderSettingIn {
  provider: string;
  base_url: string;
  api_key_env: string;
  default_model: string;
  fallback_model?: string | null;
  json_mode_required?: boolean;
  tool_calling_enabled?: boolean;
  enabled?: boolean;
  extra_headers?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

export interface PatchProvidersRequest {
  providers: ProviderSettingIn[];
}

export interface RoutingEntryResponse {
  job_type: string;
  preferred_provider: string;
  preferred_model: string;
  fallback_provider?: string | null;
  fallback_model?: string | null;
  temperature: number;
  top_p: number;
  max_tokens: number;
  max_concurrency: number;
  requests_per_minute: number;
  tokens_per_minute: number;
  timeout_seconds: number;
  retry_policy: string;
  daily_budget_usd?: number | null;
  payload: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RoutingResponse {
  entries: RoutingEntryResponse[];
}

export interface RoutingEntryIn {
  job_type: string;
  preferred_provider: string;
  preferred_model: string;
  fallback_provider?: string | null;
  fallback_model?: string | null;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  max_concurrency?: number;
  requests_per_minute?: number;
  tokens_per_minute?: number;
  timeout_seconds?: number;
  retry_policy?: string;
  daily_budget_usd?: number | null;
  payload?: Record<string, unknown>;
}

export interface PatchRoutingRequest {
  entries: RoutingEntryIn[];
}

export interface RateLimitResponse {
  provider: string;
  enabled: boolean;
  rpm_limit: number;
  tpm_limit: number;
  max_concurrency: number;
  burst_multiplier: number;
  retry_policy: string;
  jitter: boolean;
  daily_budget_usd?: number | null;
  branch_reserved_capacity_pct: number;
  healthcheck_enabled: boolean;
  payload: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RateLimitsResponse {
  rate_limits: RateLimitResponse[];
}

export interface RateLimitIn {
  provider: string;
  enabled?: boolean;
  rpm_limit: number;
  tpm_limit: number;
  max_concurrency: number;
  burst_multiplier?: number;
  retry_policy?: string;
  jitter?: boolean;
  daily_budget_usd?: number | null;
  branch_reserved_capacity_pct?: number;
  healthcheck_enabled?: boolean;
  payload?: Record<string, unknown>;
}

export interface PatchRateLimitsRequest {
  rate_limits: RateLimitIn[];
}

export interface BranchPolicyResponse {
  policy_id: string;
  max_active_universes: number;
  max_total_branches: number;
  max_depth: number;
  max_branches_per_tick: number;
  branch_cooldown_ticks: number;
  min_divergence_score: number;
  auto_prune_low_value: boolean;
  payload: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PatchBranchPolicyRequest {
  max_active_universes?: number | null;
  max_total_branches?: number | null;
  max_depth?: number | null;
  max_branches_per_tick?: number | null;
  branch_cooldown_ticks?: number | null;
  min_divergence_score?: number | null;
  auto_prune_low_value?: boolean | null;
  payload?: Record<string, unknown> | null;
}

export interface TestProviderRequest {
  provider: string;
  model?: string | null;
}

export interface TestProviderResponse {
  ok: boolean;
  latency_ms?: number | null;
  provider: string;
  model?: string | null;
  error?: string | null;
}

// ---------------------------------------------------------------------------
// Jobs §20.5
// ---------------------------------------------------------------------------

export interface QueueInfo {
  name: string;
  active_task_count: number;
  reserved_count: number;
  scheduled_count: number;
  paused: boolean;
}

export interface QueuesResponse {
  queues: QueueInfo[];
  degraded: boolean;
  error?: string | null;
}

export interface WorkerInfo {
  hostname: string;
  pool?: string | null;
  processed?: number | null;
  active?: number | null;
}

export interface WorkersResponse {
  workers: WorkerInfo[];
  degraded: boolean;
  error?: string | null;
}

export interface JobInfo {
  job_id: string;
  job_type: string;
  priority: string;
  run_id: string;
  universe_id?: string | null;
  tick?: number | null;
  attempt_number: number;
  status: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
  enqueued_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  error?: string | null;
  result_summary?: Record<string, unknown> | null;
  artifact_path?: string | null;
  created_at?: string | null;
}

export interface JobsListResponse {
  jobs: JobInfo[];
  total: number;
  limit: number;
  offset: number;
}

export interface RetryRequest {
  queue?: string | null;
}

export interface RetryResponse {
  new_task_id: string;
  job_id: string;
  attempt_number: number;
}

export interface CancelResponse {
  job_id: string;
  status: string;
}

export interface QueuePauseResponse {
  queue: string;
  paused: boolean;
}

// ---------------------------------------------------------------------------
// Logs §20.6
// ---------------------------------------------------------------------------

export interface RequestLogItem {
  call_id: string;
  provider: string;
  model_used: string;
  job_type: string;
  run_id: string;
  universe_id?: string | null;
  tick?: number | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd?: number | null;
  latency_ms: number;
  status: string;
  error?: string | null;
  repaired_once: boolean;
  created_at: string;
}

export interface WebhookLogItem {
  id: string;
  run_id?: string | null;
  event_type: string;
  target_url: string;
  status: string;
  attempts: number;
  last_delivered_at?: string | null;
  error?: string | null;
  created_at: string;
}

export interface ErrorLogItem {
  source: string;
  id: string;
  job_type?: string | null;
  provider?: string | null;
  run_id?: string | null;
  status: string;
  error?: string | null;
  created_at?: string | null;
}

export interface AuditLogItem {
  id: string;
  actor?: string | null;
  action: string;
  resource: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface TraceResponse {
  trace_id: string;
  llm_calls: RequestLogItem[];
  jobs: JobInfo[];
}

// ---------------------------------------------------------------------------
// Integrations / Zep §20.7
// ---------------------------------------------------------------------------

export interface ZepSettingResponse {
  setting_id: string;
  enabled: boolean;
  mode: string;
  api_key_env: string;
  cache_ttl_seconds: number;
  degraded: boolean;
  payload: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PatchZepRequest {
  enabled?: boolean | null;
  mode?: string | null;
  api_key_env?: string | null;
  cache_ttl_seconds?: number | null;
  payload?: Record<string, unknown> | null;
}

export interface ZepTestResponse {
  ok: boolean;
  latency_ms?: number | null;
  error?: string | null;
}

export interface ZepSyncResponse {
  enqueued: boolean;
  task_id?: string | null;
  run_id: string;
}

export interface ZepMappingItem {
  actor_id: string;
  actor_kind: string;
  zep_user_id: string;
  universe_id?: string | null;
}

export interface ZepMappingsResponse {
  mappings: ZepMappingItem[];
}

export interface PatchZepMappingItem {
  actor_id: string;
  zep_user_id: string;
}

export interface PatchZepMappingsRequest {
  mappings: PatchZepMappingItem[];
}

export interface ZepStatusResponse {
  enabled: boolean;
  mode: string;
  degraded: boolean;
  last_healthcheck_at?: string | null;
  last_latency_ms?: number | null;
  error?: string | null;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export interface WebhookTestRequest {
  url: string;
  secret: string;
  payload?: Record<string, unknown>;
  event_type?: string;
}

export interface WebhookTestResponse {
  ok: boolean;
  status_code?: number | null;
  latency_ms?: number | null;
  attempts?: number | null;
  delivered_at?: string | null;
  error?: string | null;
}

export interface WebhookReplayRequest {
  event_id: string;
  target_url?: string | null;
}
