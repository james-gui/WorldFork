export type UniverseStatus =
  | 'active'
  | 'candidate'
  | 'frozen'
  | 'killed'
  | 'completed'
  | 'merged';

export type BranchTrigger =
  | 'policy_change'
  | 'tech_breakthrough'
  | 'social_movement'
  | 'economic_crisis'
  | 'media_event'
  | 'godagent_decision';

export interface DivergencePoint {
  i: number;
  v: number;
}

export interface MultiverseNodeData {
  id: string;
  parentId: string | null;
  label: string;
  depth: number;
  status: UniverseStatus;
  current_tick: number;
  branch_trigger: BranchTrigger;
  branch_from_tick: number;
  branch_tick: number;
  divergence_score: number;
  confidence: number;
  child_count: number;
  descendant_count: number;
  collapsed_children_count: number;
  divergence_series: DivergencePoint[];
  lineage_path: string[];
  branch_delta: Record<string, unknown>;
  metrics: {
    population: number;
    posts: number;
    events: number;
    tickProgress: number;
  };
  created_at: string;
}

export interface MultiverseEvent {
  id: string;
  universeId: string;
  topic:
    | 'branch.created'
    | 'branch.frozen'
    | 'branch.killed'
    | 'branch.completed'
    | 'tick.completed'
    | 'universe.status_changed';
  message: string;
  timestamp: string;
  ago: string;
}

export interface MultiverseTreePayload {
  bbId: string;
  generatedAt: string;
  etag: string;
  nodes: MultiverseNodeData[];
  edges: { id: string; source: string; target: string }[];
  events: MultiverseEvent[];
  kpis: {
    activeUniverses: number;
    totalBranches: number;
    maxDepth: number;
    branchBudgetPct: number;
    activeBranchesPerTick: number;
    branchBudgetUsed: number;
    branchBudgetLimit: number;
  };
}

const TRIGGER_LABELS: Record<BranchTrigger, string> = {
  policy_change: 'Policy Change',
  tech_breakthrough: 'Tech Breakthrough',
  social_movement: 'Social Movement',
  economic_crisis: 'Economic Crisis',
  media_event: 'Media Event',
  godagent_decision: 'God-Agent Decision',
};

export function triggerLabel(trigger: BranchTrigger): string {
  return TRIGGER_LABELS[trigger];
}

export const STATUS_COLORS: Record<UniverseStatus, string> = {
  active: '#10b981',
  candidate: '#f59e0b',
  frozen: '#64748b',
  killed: '#ef4444',
  completed: '#3b82f6',
  merged: '#8b5cf6',
};

export const STATUS_BADGE_CLS: Record<UniverseStatus, string> = {
  active:
    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  candidate:
    'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  frozen: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
  killed: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30',
  completed: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30',
  merged:
    'bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30',
};
