// Typed Run interface used by Session Detail and other run pages.

export type RunStatus =
  | 'active'
  | 'running'
  | 'paused'
  | 'frozen'
  | 'killed'
  | 'completed'
  | 'failed'
  | 'pending';

export interface Run {
  id: string;
  display_name: string;
  big_bang_id: string;
  root_universe_id?: string;
  status: RunStatus;
  scenario_type: string;
  scenario_text: string;
  description?: string;
  tags: string[];
  created_at: string;        // ISO-8601
  updated_at: string;
  time_horizon: string;      // e.g. "6 months"
  max_ticks: number;
  current_tick: number;
  universe_count: number;
  initial_archetype_count: number;
  snapshot_sha: string;
  snapshot_id: string;
  provider: string;          // e.g. "openrouter"
  model: string;             // e.g. "openai/gpt-4o"
  zep_status: 'healthy' | 'degraded' | 'disabled';
  favorited: boolean;
  archived: boolean;
  summary?: string;
  goal?: string;
}
