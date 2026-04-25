export type NetworkLayer =
  | 'exposure'
  | 'trust'
  | 'dependency'
  | 'mobilization'
  | 'identity';

export interface NetworkNodeAttrs {
  label: string;
  archetype: string;
  representedPopulation: number;
  analyticalDepth: number;
  trust: number;
  expressionLevel: number;
  mobilizationCapacity: number;
  cohortStance: number;
  x: number;
  y: number;
  size: number;
  color: string;
  issueStances: Record<string, number>;
  ideology: {
    economic: number;
    social: number;
    institutional: number;
    cultural: number;
    international: number;
  };
  recentPosts: { id: string; text: string; tickAgo: number }[];
}

export interface NetworkEdgeAttrs {
  layer: NetworkLayer;
  weight: number;
  size: number;
  color: string;
}

export interface ArchetypeMeta {
  key: string;
  label: string;
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
  activeLayer?: NetworkLayer;
}

export const LAYER_COLORS: Record<NetworkLayer, string> = {
  exposure: '#94a3b8',
  trust: '#10b981',
  dependency: '#f59e0b',
  mobilization: '#ef4444',
  identity: '#a855f7',
};
