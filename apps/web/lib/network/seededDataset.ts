// Deterministic seeded mock dataset for the Network Graph view.
// Uses a pure mulberry32 PRNG so the output is stable across renders,
// across reloads, and across server/client.

export type NetworkLayer =
  | 'exposure'
  | 'trust'
  | 'dependency'
  | 'mobilization'
  | 'identity';

export interface NetworkNodeAttrs {
  label: string;
  archetype: ArchetypeKey;
  representedPopulation: number;
  // Cohort attributes (0..1)
  analyticalDepth: number;
  trust: number;
  expressionLevel: number;
  mobilizationCapacity: number;
  // Dominant cohort stance on a representative axis (-1..1)
  cohortStance: number;
  // Coordinates pre-laid out (so we don't need ForceAtlas2 to render).
  x: number;
  y: number;
  // Sigma rendering attrs
  size: number;
  color: string;
  // Issue stances per a few PRD-style issue axes.
  issueStances: Record<string, number>;
  // Five ideology axes, -1..1 each.
  ideology: {
    economic: number;
    social: number;
    institutional: number;
    cultural: number;
    international: number;
  };
  // Recent posts (fake content snippets)
  recentPosts: { id: string; text: string; tickAgo: number }[];
}

export interface NetworkEdgeAttrs {
  layer: NetworkLayer;
  weight: number; // 0..1
  size: number;
  color: string;
}

export interface NetworkDataset {
  nodes: { id: string; attrs: NetworkNodeAttrs }[];
  edges: {
    id: string;
    source: string;
    target: string;
    attrs: NetworkEdgeAttrs;
  }[];
  archetypes: ArchetypeMeta[];
  issueAxes: string[];
}

export type ArchetypeKey =
  | 'civic_pragmatists'
  | 'tech_progressives'
  | 'traditional_conservatives'
  | 'union_organizers'
  | 'libertarian_skeptics';

export interface ArchetypeMeta {
  key: ArchetypeKey;
  label: string;
  color: string;
}

export const ARCHETYPES: ArchetypeMeta[] = [
  { key: 'civic_pragmatists', label: 'Civic Pragmatists', color: '#6366f1' },
  { key: 'tech_progressives', label: 'Tech Progressives', color: '#10b981' },
  {
    key: 'traditional_conservatives',
    label: 'Traditional Conservatives',
    color: '#f59e0b',
  },
  { key: 'union_organizers', label: 'Union Organizers', color: '#ef4444' },
  {
    key: 'libertarian_skeptics',
    label: 'Libertarian Skeptics',
    color: '#a855f7',
  },
];

const ISSUE_AXES = [
  'gig_worker_rights',
  'platform_regulation',
  'minimum_wage',
  'urban_housing',
  'climate_policy',
];

const LAYER_COLORS: Record<NetworkLayer, string> = {
  exposure: '#94a3b8',
  trust: '#10b981',
  dependency: '#f59e0b',
  mobilization: '#ef4444',
  identity: '#a855f7',
};

const POST_TEMPLATES = [
  'Anyone else feeling like the new policy is going to backfire?',
  'Heading to the rally tonight — see you all there.',
  'The data on this is being completely ignored by leadership.',
  'Solidarity with the gig workers organizing this week.',
  'Maybe we should pause and think before acting.',
  'This is exactly the kind of thing we warned about last quarter.',
  'Sharing the latest report — read carefully before reacting.',
  'I trust the process, but the timeline is too tight.',
];

// mulberry32 PRNG — deterministic 32-bit float generator.
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

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function rangeRand(rng: () => number, lo: number, hi: number): number {
  return lo + (hi - lo) * rng();
}

export function buildSeededNetwork(
  seed: number,
  nodeCount: number,
): NetworkDataset {
  const rng = mulberry32(seed);

  const nodes: NetworkDataset['nodes'] = [];
  const archetypeAngles = new Map<ArchetypeKey, number>();
  ARCHETYPES.forEach((a, i) => {
    archetypeAngles.set(a.key, (i / ARCHETYPES.length) * Math.PI * 2);
  });

  for (let i = 0; i < nodeCount; i++) {
    const archetype = ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)];
    const baseAngle = archetypeAngles.get(archetype.key) ?? 0;
    const angle = baseAngle + (rng() - 0.5) * 0.9; // jitter inside cluster
    const radius = 200 + rng() * 380;
    const x = Math.cos(angle) * radius + (rng() - 0.5) * 90;
    const y = Math.sin(angle) * radius + (rng() - 0.5) * 90;

    const representedPopulation = Math.floor(rangeRand(rng, 800, 80000));
    const issueStances = ISSUE_AXES.reduce<Record<string, number>>(
      (acc, axis) => {
        acc[axis] = +(rng() * 2 - 1).toFixed(2);
        return acc;
      },
      {},
    );

    const recentPosts = Array.from({ length: 3 }).map((_, k) => ({
      id: `p-${i}-${k}`,
      text: pick(rng, POST_TEMPLATES),
      tickAgo: Math.floor(rng() * 8) + 1,
    }));

    nodes.push({
      id: `c${i}`,
      attrs: {
        label: `${archetype.label} #${String(i).padStart(3, '0')}`,
        archetype: archetype.key,
        representedPopulation,
        analyticalDepth: +rng().toFixed(2),
        trust: +rng().toFixed(2),
        expressionLevel: +rng().toFixed(2),
        mobilizationCapacity: +rng().toFixed(2),
        cohortStance: +(rng() * 2 - 1).toFixed(2),
        x,
        y,
        size:
          4 +
          Math.min(
            16,
            Math.log10(Math.max(1, representedPopulation)) * 2.4,
          ),
        color: archetype.color,
        issueStances,
        ideology: {
          economic: +(rng() * 2 - 1).toFixed(2),
          social: +(rng() * 2 - 1).toFixed(2),
          institutional: +(rng() * 2 - 1).toFixed(2),
          cultural: +(rng() * 2 - 1).toFixed(2),
          international: +(rng() * 2 - 1).toFixed(2),
        },
        recentPosts,
      },
    });
  }

  const edges: NetworkDataset['edges'] = [];
  const layers: NetworkLayer[] = [
    'exposure',
    'trust',
    'dependency',
    'mobilization',
    'identity',
  ];
  // Per-layer edge density tuning so each layer reads differently.
  const layerDensity: Record<NetworkLayer, number> = {
    exposure: 2.4,
    trust: 1.6,
    dependency: 0.9,
    mobilization: 0.7,
    identity: 1.2,
  };

  for (const layer of layers) {
    const targetEdges = Math.floor(nodeCount * layerDensity[layer]);
    for (let e = 0; e < targetEdges; e++) {
      const a = Math.floor(rng() * nodeCount);
      let b = Math.floor(rng() * nodeCount);
      if (a === b) b = (b + 1) % nodeCount;
      const weight = +rng().toFixed(2);
      edges.push({
        id: `${layer}-${a}-${b}-${e}`,
        source: `c${a}`,
        target: `c${b}`,
        attrs: {
          layer,
          weight,
          size: 0.4 + weight * 1.6,
          color: LAYER_COLORS[layer] + '88',
        },
      });
    }
  }

  return { nodes, edges, archetypes: ARCHETYPES, issueAxes: ISSUE_AXES };
}

export { LAYER_COLORS, ISSUE_AXES };
