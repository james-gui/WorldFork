// Seeded mock data for the Recursive Multiverse Explorer (page 17).
// Deterministic given a seed string so the page renders consistently
// across SSR/CSR and reloads. Used until backend wiring lands.

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
  // Relative time string for display.
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

// mulberry32 PRNG (deterministic).
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stringToSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

const STATUSES: UniverseStatus[] = [
  'active',
  'active',
  'active',
  'candidate',
  'frozen',
  'killed',
  'completed',
  'merged',
];

const TRIGGERS: BranchTrigger[] = [
  'policy_change',
  'tech_breakthrough',
  'social_movement',
  'economic_crisis',
  'media_event',
  'godagent_decision',
];

const TRIGGER_LABELS: Record<BranchTrigger, string> = {
  policy_change: 'Policy Change',
  tech_breakthrough: 'Tech Breakthrough',
  social_movement: 'Social Movement',
  economic_crisis: 'Economic Crisis',
  media_event: 'Media Event',
  godagent_decision: 'God-Agent Decision',
};

export function triggerLabel(t: BranchTrigger): string {
  return TRIGGER_LABELS[t];
}

const STATUS_TOPICS: Record<UniverseStatus, MultiverseEvent['topic']> = {
  active: 'tick.completed',
  candidate: 'branch.created',
  frozen: 'branch.frozen',
  killed: 'branch.killed',
  completed: 'branch.completed',
  merged: 'universe.status_changed',
};

function buildSparkline(rng: () => number, count: number, base: number): DivergencePoint[] {
  let v = base;
  const out: DivergencePoint[] = [];
  for (let i = 0; i < count; i++) {
    v += (rng() - 0.5) * 0.18;
    v = Math.max(0, Math.min(1, v));
    out.push({ i, v: +v.toFixed(3) });
  }
  return out;
}

function buildBranchDelta(
  rng: () => number,
  trigger: BranchTrigger,
): Record<string, unknown> {
  switch (trigger) {
    case 'policy_change':
      return {
        type: 'parameter_shift',
        target: 'policy.tax_reform.intensity',
        delta: { intensity: +(rng() * 0.5 + 0.2).toFixed(2) },
      };
    case 'tech_breakthrough':
      return {
        type: 'event_injection',
        event: {
          kind: 'breakthrough',
          impact: +(rng() * 0.6 + 0.3).toFixed(2),
        },
      };
    case 'social_movement':
      return {
        type: 'cohort_mobilization',
        target_cohort: 'union_organizers',
        delta: { mobilization: +(rng() * 0.6).toFixed(2) },
      };
    case 'economic_crisis':
      return {
        type: 'parameter_shift',
        target: 'macro.unemployment',
        delta: { rate: +(rng() * 0.04 + 0.02).toFixed(3) },
      };
    case 'media_event':
      return {
        type: 'counterfactual_event_rewrite',
        target_event_id: 'event_press_briefing_t' + Math.floor(rng() * 12),
        parent_version: 'measured statement',
        child_version: 'aggressive denial',
      };
    case 'godagent_decision':
      return {
        type: 'godagent_intervention',
        decision: 'spawn_active_branch',
        rationale: 'Divergence threshold exceeded; preserving counterfactual.',
      };
  }
}

function isoDaysAgo(rng: () => number): { iso: string; ago: string } {
  const minutes = Math.floor(rng() * 4320); // up to 3 days
  const ms = Date.now() - minutes * 60_000;
  const iso = new Date(ms).toISOString();
  let ago: string;
  if (minutes < 60) ago = `${minutes}m ago`;
  else if (minutes < 1440) ago = `${Math.floor(minutes / 60)}h ago`;
  else ago = `${Math.floor(minutes / 1440)}d ago`;
  return { iso, ago };
}

export interface BuildMultiverseTreeOpts {
  bbId: string;
  // Approximate target node count. Default 30.
  targetCount?: number;
  // Max depth (0 = root). Default 4.
  maxDepth?: number;
}

export function buildMultiverseTree(
  opts: BuildMultiverseTreeOpts,
): MultiverseTreePayload {
  const targetCount = opts.targetCount ?? 30;
  const maxDepth = opts.maxDepth ?? 4;
  const seed = stringToSeed(opts.bbId || 'demo-bb');
  const rng = mulberry32(seed);

  const nodes: MultiverseNodeData[] = [];
  const edges: { id: string; source: string; target: string }[] = [];

  // Root universe (Big Bang)
  const rootId = 'U000';
  const rootSpark = buildSparkline(rng, 18, 0.5);
  const { iso: rootIso } = isoDaysAgo(rng);
  nodes.push({
    id: rootId,
    parentId: null,
    label: rootId,
    depth: 0,
    status: 'active',
    branch_trigger: 'policy_change',
    branch_from_tick: 0,
    branch_tick: 0,
    divergence_score: 0,
    confidence: 1,
    child_count: 0,
    descendant_count: 0,
    collapsed_children_count: 0,
    divergence_series: rootSpark,
    lineage_path: [rootId],
    branch_delta: { type: 'root', note: 'Big Bang root universe.' },
    metrics: {
      population: 50000 + Math.floor(rng() * 10000),
      posts: 1000 + Math.floor(rng() * 4000),
      events: 30 + Math.floor(rng() * 30),
      tickProgress: 1,
    },
    created_at: rootIso,
  });

  // Frontier of nodes that may still spawn children.
  const frontier: string[] = [rootId];
  let nextSerial = 1;

  while (nodes.length < targetCount && frontier.length > 0) {
    // Pick a random parent from frontier.
    const parentIdx = Math.floor(rng() * frontier.length);
    const parentId = frontier[parentIdx];
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) {
      frontier.splice(parentIdx, 1);
      continue;
    }
    if (parent.depth + 1 > maxDepth) {
      frontier.splice(parentIdx, 1);
      continue;
    }

    // Branch count for this parent (1-3, biased smaller as depth grows).
    const branchCount = 1 + Math.floor(rng() * (parent.depth === 0 ? 3 : 2));
    for (let b = 0; b < branchCount && nodes.length < targetCount; b++) {
      const id = `U${String(nextSerial).padStart(3, '0')}`;
      nextSerial += 1;
      const status = pick(rng, STATUSES);
      const trigger = pick(rng, TRIGGERS);
      const series = buildSparkline(
        rng,
        18,
        Math.max(0, Math.min(1, parent.divergence_series.at(-1)?.v ?? 0.5)),
      );
      const divergenceScore = +(rng() * 0.6 + 0.2).toFixed(2);
      const confidence = +(rng() * 0.5 + 0.45).toFixed(2);
      const branchFromTick = Math.floor(rng() * 12) + parent.branch_tick;
      const { iso } = isoDaysAgo(rng);
      const lineage = [...parent.lineage_path, id];
      nodes.push({
        id,
        parentId,
        label: id,
        depth: parent.depth + 1,
        status,
        branch_trigger: trigger,
        branch_from_tick: branchFromTick,
        branch_tick: branchFromTick + 1,
        divergence_score: divergenceScore,
        confidence,
        child_count: 0,
        descendant_count: 0,
        collapsed_children_count: 0,
        divergence_series: series,
        lineage_path: lineage,
        branch_delta: buildBranchDelta(rng, trigger),
        metrics: {
          population: parent.metrics.population + Math.floor((rng() - 0.5) * 4000),
          posts: 100 + Math.floor(rng() * 2400),
          events: 5 + Math.floor(rng() * 40),
          tickProgress: +(rng() * 0.9 + 0.05).toFixed(2),
        },
        created_at: iso,
      });
      edges.push({ id: `e-${parentId}-${id}`, source: parentId, target: id });
      // Status-active children join the frontier.
      if (status !== 'killed' && status !== 'frozen' && status !== 'merged') {
        frontier.push(id);
      }
    }

    // Drop parent if deep enough or random eviction.
    if (parent.depth + 1 >= maxDepth || rng() > 0.5) {
      const idx = frontier.indexOf(parentId);
      if (idx >= 0) frontier.splice(idx, 1);
    }
  }

  // Recompute child / descendant counts.
  const childMap = new Map<string, string[]>();
  for (const e of edges) {
    if (!childMap.has(e.source)) childMap.set(e.source, []);
    childMap.get(e.source)!.push(e.target);
  }
  function descendants(id: string): number {
    const kids = childMap.get(id) ?? [];
    let total = kids.length;
    for (const k of kids) total += descendants(k);
    return total;
  }
  for (const n of nodes) {
    const kids = childMap.get(n.id) ?? [];
    n.child_count = kids.length;
    n.descendant_count = descendants(n.id);
    n.collapsed_children_count = 0;
  }

  // Choose a few nodes to mark as having collapsed children pills (>0 only when child_count > 1).
  for (const n of nodes) {
    if (n.child_count > 1 && rng() < 0.3) {
      n.collapsed_children_count = Math.min(n.descendant_count, n.child_count);
    }
  }

  // Build a compact event log.
  const events: MultiverseEvent[] = [];
  const sampleSize = Math.min(nodes.length, 24);
  for (let i = 0; i < sampleSize; i++) {
    const n = nodes[Math.floor(rng() * nodes.length)];
    const topic = STATUS_TOPICS[n.status];
    const { iso, ago } = isoDaysAgo(rng);
    let message = '';
    switch (topic) {
      case 'branch.created':
        message = `Candidate branch ${n.id} spawned from ${n.parentId ?? 'root'}.`;
        break;
      case 'branch.frozen':
        message = `Branch ${n.id} was frozen by policy.`;
        break;
      case 'branch.killed':
        message = `Branch ${n.id} killed; below divergence threshold.`;
        break;
      case 'branch.completed':
        message = `Universe ${n.id} reached terminal tick.`;
        break;
      case 'tick.completed':
        message = `Universe ${n.id} completed tick ${n.branch_tick + Math.floor(rng() * 8)}.`;
        break;
      case 'universe.status_changed':
        message = `Universe ${n.id} merged with sibling.`;
        break;
    }
    events.push({
      id: `evt-${i}-${n.id}`,
      universeId: n.id,
      topic,
      message,
      timestamp: iso,
      ago,
    });
  }
  // Sort newest first.
  events.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  // KPIs.
  const activeCount = nodes.filter((n) => n.status === 'active').length;
  const maxDepthReached = nodes.reduce((m, n) => Math.max(m, n.depth), 0);
  const branchBudgetLimit = 500;
  const branchBudgetUsed = nodes.length;
  const branchBudgetPct = +((branchBudgetUsed / branchBudgetLimit) * 100).toFixed(1);
  const activeBranchesPerTick = +(activeCount / Math.max(1, maxDepthReached)).toFixed(2);

  // Compute etag from a hash over node ids + statuses.
  let etagHash = 5381 >>> 0;
  for (const n of nodes) {
    const s = `${n.id}:${n.status}:${n.depth}:${n.divergence_score}`;
    for (let i = 0; i < s.length; i++) {
      etagHash = (Math.imul(etagHash, 33) + s.charCodeAt(i)) >>> 0;
    }
  }

  return {
    bbId: opts.bbId,
    generatedAt: new Date().toISOString(),
    etag: etagHash.toString(16),
    nodes,
    edges,
    events,
    kpis: {
      activeUniverses: activeCount,
      totalBranches: nodes.length - 1,
      maxDepth: maxDepthReached,
      branchBudgetPct,
      activeBranchesPerTick,
      branchBudgetUsed,
      branchBudgetLimit,
    },
  };
}

export const STATUS_COLORS: Record<UniverseStatus, string> = {
  active: '#10b981', // emerald-500
  candidate: '#f59e0b', // amber-500
  frozen: '#64748b', // slate-500
  killed: '#ef4444', // red-500
  completed: '#3b82f6', // blue-500
  merged: '#8b5cf6', // violet-500
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
