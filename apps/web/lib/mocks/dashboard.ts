// Seeded mock data for the Simulation Dashboard.
// Every helper here is deterministic given a seed string so the page
// renders consistently across SSR/CSR and reloads.

export const EMOTIONS = [
  'Hope',
  'Fear',
  'Anger',
  'Joy',
  'Sadness',
  'Trust',
  'Disgust',
  'Surprise',
] as const;

export type Emotion = (typeof EMOTIONS)[number];

// Index into the tailwind chart palette tokens (chart.1 .. chart.8).
export const EMOTION_COLORS: Record<Emotion, string> = {
  Hope: '#10b981', // emerald-500
  Fear: '#8b5cf6', // violet-500
  Anger: '#f43f5e', // rose-500
  Joy: '#f59e0b', // amber-500
  Sadness: '#0ea5e9', // sky-500
  Trust: '#6366f1', // indigo-500
  Disgust: '#64748b', // slate-500
  Surprise: '#d946ef', // fuchsia-500
};

// mulberry32 PRNG.
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

export function stringToSeed(s: string): number {
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

// ---- KPI sparkline series ----

export interface SparkPoint {
  i: number;
  v: number;
}

export function buildSparkline(
  seed: number,
  count: number,
  base: number,
  amplitude: number,
): SparkPoint[] {
  const rng = mulberry32(seed);
  const out: SparkPoint[] = [];
  let v = base;
  for (let i = 0; i < count; i++) {
    v += (rng() - 0.5) * amplitude;
    v = Math.max(0, v);
    out.push({ i, v: +v.toFixed(2) });
  }
  return out;
}

// ---- Emotion trends (50 ticks x 8 emotions) ----

export interface EmotionTrendPoint {
  tick: number;
  Hope: number;
  Fear: number;
  Anger: number;
  Joy: number;
  Sadness: number;
  Trust: number;
  Disgust: number;
  Surprise: number;
}

export function buildEmotionTrends(
  seed: number,
  ticks: number,
): EmotionTrendPoint[] {
  const rng = mulberry32(seed);
  // initialize each emotion with a different baseline level
  const levels: Record<Emotion, number> = {
    Hope: 6.4,
    Fear: 4.1,
    Anger: 3.6,
    Joy: 5.2,
    Sadness: 3.9,
    Trust: 5.7,
    Disgust: 2.8,
    Surprise: 3.2,
  };
  const out: EmotionTrendPoint[] = [];
  for (let t = 0; t < ticks; t++) {
    const point: EmotionTrendPoint = {
      tick: t,
      Hope: 0,
      Fear: 0,
      Anger: 0,
      Joy: 0,
      Sadness: 0,
      Trust: 0,
      Disgust: 0,
      Surprise: 0,
    };
    for (const e of EMOTIONS) {
      // small mean-reverting random walk within [0,10]
      const drift = (rng() - 0.5) * 0.7;
      const meanRev = (5.0 - levels[e]) * 0.04;
      levels[e] = Math.max(0, Math.min(10, levels[e] + drift + meanRev));
      point[e] = +levels[e].toFixed(2);
    }
    out.push(point);
  }
  return out;
}

export function dominantEmotion(trends: EmotionTrendPoint[]): Emotion {
  if (!trends.length) return 'Hope';
  const last = trends[trends.length - 1];
  let best: Emotion = 'Hope';
  let bestVal = -Infinity;
  for (const e of EMOTIONS) {
    if (last[e] > bestVal) {
      bestVal = last[e];
      best = e;
    }
  }
  return best;
}

export function emotionDonutData(trends: EmotionTrendPoint[]) {
  if (!trends.length) {
    return EMOTIONS.map((e) => ({ name: e, value: 1, color: EMOTION_COLORS[e] }));
  }
  const last = trends[trends.length - 1];
  return EMOTIONS.map((e) => ({
    name: e,
    value: +last[e].toFixed(2),
    color: EMOTION_COLORS[e],
  }));
}

// ---- Live social feed posts ----

export interface MockPost {
  id: string;
  authorName: string;
  authorRole: 'cohort' | 'hero';
  archetype: string;
  avatarColor: string;
  timestamp: string;
  content: string;
  reactions: { kind: string; count: number }[];
}

const POST_TEMPLATES = [
  'New polling data is out — the numbers are not what we expected.',
  'Heading to the rally tonight. Solidarity with everyone organizing.',
  "Council just voted. We need to regroup and assess what's next.",
  'Anyone else feel like the pace of change is too fast right now?',
  'Sharing this thread — read the whole thing before reacting.',
  'The leadership is ignoring the very people they claim to represent.',
  'Holding space for the families affected by this decision.',
  "I'm cautiously optimistic. The compromise might actually work.",
  'They keep moving the goalposts. We need to push harder.',
  'Quiet day — but momentum is building underground.',
];

const COHORT_NAMES = [
  'Urban Progressives',
  'Rural Traditionalists',
  'Tech Optimists',
  'Union Organizers',
  'Civic Pragmatists',
  'Libertarian Skeptics',
  'Climate Activists',
  'Small Business Owners',
];

const HERO_NAMES = [
  'Maya Park',
  'Daniel Reyes',
  'Aiyana Brooks',
  'Jonas Wexler',
  'Priya Shah',
];

const REACTION_KINDS = ['like', 'agree', 'disagree', 'amplify'];

const AVATAR_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#0ea5e9',
  '#f43f5e',
  '#64748b',
];

export function buildPosts(seed: number, count: number): MockPost[] {
  const rng = mulberry32(seed);
  const out: MockPost[] = [];
  for (let i = 0; i < count; i++) {
    const isHero = rng() < 0.25;
    const authorName = isHero ? pick(rng, HERO_NAMES) : pick(rng, COHORT_NAMES);
    const archetype = pick(rng, COHORT_NAMES);
    const reactCount = 1 + Math.floor(rng() * 3);
    const usedKinds = new Set<string>();
    const reactions: MockPost['reactions'] = [];
    while (reactions.length < reactCount) {
      const k = pick(rng, REACTION_KINDS);
      if (usedKinds.has(k)) continue;
      usedKinds.add(k);
      reactions.push({ kind: k, count: 1 + Math.floor(rng() * 48) });
    }
    out.push({
      id: `post-${i}`,
      authorName,
      authorRole: isHero ? 'hero' : 'cohort',
      archetype,
      avatarColor: pick(rng, AVATAR_COLORS),
      timestamp: `${Math.floor(rng() * 12) + 1}m ago`,
      content: pick(rng, POST_TEMPLATES),
      reactions,
    });
  }
  return out;
}

// ---- Event queue ----

export interface QueueEvent {
  id: string;
  title: string;
  kind: string;
  inTicks: number;
  intensity: number;
}

const EVENT_TEMPLATES: { title: string; kind: string }[] = [
  { title: 'Policy Announcement', kind: 'institutional' },
  { title: 'Strike Vote', kind: 'mobilization' },
  { title: 'Influencer Statement', kind: 'media' },
  { title: 'Council Meeting', kind: 'institutional' },
  { title: 'Local Protest', kind: 'mobilization' },
  { title: 'Press Briefing', kind: 'media' },
  { title: 'Court Ruling', kind: 'institutional' },
  { title: 'Viral Post', kind: 'media' },
];

export function buildEventQueue(seed: number, count: number): QueueEvent[] {
  const rng = mulberry32(seed);
  const out: QueueEvent[] = [];
  for (let i = 0; i < count; i++) {
    const tpl = EVENT_TEMPLATES[i % EVENT_TEMPLATES.length];
    out.push({
      id: `evt-${i}`,
      title: tpl.title,
      kind: tpl.kind,
      inTicks: 1 + Math.floor(rng() * 6),
      intensity: +(rng() * 0.7 + 0.2).toFixed(2),
    });
  }
  return out;
}

// ---- Cohort detail ----

export interface CohortMetrics {
  stance: number;
  mood: number;
  trust: number;
  mobilization: number;
  population: number;
  expression: number;
}

export interface CohortDetail {
  id: string;
  name: string;
  description: string;
  avatarColor: string;
  metrics: CohortMetrics;
  // Bar chart of recent activity / sub-issue stances.
  bars: { label: string; value: number }[];
}

export function buildCohorts(seed: number): CohortDetail[] {
  const descriptions = [
    'Highly active in metro areas. Pro-reform; sensitive to economic shocks.',
    'Skeptical of rapid institutional change. Strong identity bonds.',
    "Believes innovation outpaces regulation; high trust in private sector.",
    'Front-line workers organizing across platforms; high mobilization.',
    'Pragmatic centrists — high analytical depth, low expression.',
    'Wary of state overreach; values individual sovereignty.',
    'Driven by climate urgency; high coalition-building.',
    'Cost-sensitive operators; pragmatic, deal-oriented.',
  ];
  return COHORT_NAMES.map((name, i) => {
    const r = mulberry32(seed + i * 1009);
    return {
      id: `cohort-${i}`,
      name,
      description: descriptions[i],
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      metrics: {
        stance: +(r() * 2 - 1).toFixed(2),
        mood: +(r() * 10).toFixed(2),
        trust: +r().toFixed(2),
        mobilization: +r().toFixed(2),
        population: 1200 + Math.floor(r() * 60000),
        expression: +r().toFixed(2),
      },
      bars: [
        { label: 'Wages', value: +(r() * 100).toFixed(0) },
        { label: 'Climate', value: +(r() * 100).toFixed(0) },
        { label: 'Housing', value: +(r() * 100).toFixed(0) },
        { label: 'Trust Inst.', value: +(r() * 100).toFixed(0) },
        { label: 'Reform', value: +(r() * 100).toFixed(0) },
      ],
    };
  });
}

// ---- Aggregate dataset for the page ----

export interface DashboardMockData {
  emotionTrends: EmotionTrendPoint[];
  posts: MockPost[];
  events: QueueEvent[];
  cohorts: CohortDetail[];
  // KPI sparklines
  activeCohortsSpark: SparkPoint[];
  pendingEventsSpark: SparkPoint[];
  branchCountSpark: SparkPoint[];
  dominantEmotionSpark: SparkPoint[];
  // KPI scalars
  activeCohorts: number;
  pendingEvents: number;
  branchCount: number;
  dominant: Emotion;
  // Multiverse overview KPIs
  totalUniverses: number;
  branchesPerTick: number;
  multiverseDominant: Emotion;
}

export function buildDashboardMock(runId: string): DashboardMockData {
  const seed = stringToSeed(runId || 'demo-run');
  const trends = buildEmotionTrends(seed, 50);
  const posts = buildPosts(seed + 11, 14);
  const events = buildEventQueue(seed + 17, 6);
  const cohorts = buildCohorts(seed + 23);
  const dom = dominantEmotion(trends);
  return {
    emotionTrends: trends,
    posts,
    events,
    cohorts,
    activeCohortsSpark: buildSparkline(seed + 41, 20, 22, 1.2),
    pendingEventsSpark: buildSparkline(seed + 43, 20, 110, 12),
    branchCountSpark: buildSparkline(seed + 47, 20, 5, 0.8),
    dominantEmotionSpark: buildSparkline(seed + 53, 20, 6.5, 0.6),
    activeCohorts: 24,
    pendingEvents: 128,
    branchCount: 7,
    dominant: dom,
    totalUniverses: 12,
    branchesPerTick: 1.8,
    multiverseDominant: dom,
  };
}
