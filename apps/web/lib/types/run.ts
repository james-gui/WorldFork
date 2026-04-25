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

// Minimal mock for SSR/placeholder render
export const MOCK_RUN: Run = {
  id: 'run_demo_001',
  display_name: 'Global Policy Debate',
  big_bang_id: 'BB_2024_01_15_global_policy',
  status: 'completed',
  scenario_type: 'Political',
  scenario_text:
    'A multinational policy summit on climate action triggers deep ideological fractures across global civil society. Media channels amplify divergent narratives as protest movements emerge.',
  description: 'Demo run — exploring policy debate dynamics.',
  tags: ['climate', 'policy', 'global', 'demo'],
  created_at: '2024-01-15T09:23:41Z',
  updated_at: '2024-01-16T14:12:07Z',
  time_horizon: '7 – 4 days',
  max_ticks: 24,
  current_tick: 24,
  universe_count: 4,
  initial_archetype_count: 6,
  snapshot_sha: 'a3f5c8d2e1b4f9a7c6d3e2f1a8b5c4d7',
  snapshot_id: 'SOT_v2.1.0',
  provider: 'openrouter',
  model: 'openai/gpt-4o',
  zep_status: 'healthy',
  favorited: false,
  archived: false,
  goal:
    'Understand how ideological fractures propagate through global civil society during a high-stakes climate policy summit.',
  summary:
    'The simulation traced 24 ticks of escalating media fragmentation and cross-archetype coalition formation. Three branching points were triggered by God-agent interventions on ticks 8, 14, and 20.',
};
