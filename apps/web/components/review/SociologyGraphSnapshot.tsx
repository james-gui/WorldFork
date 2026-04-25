'use client';

import * as React from 'react';

interface SociologyGraphSnapshotProps {
  tick: number;
  height?: number;
}

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f97316', '#f43f5e', '#8b5cf6', '#f59e0b'];

interface Node {
  id: string;
  x: number;
  y: number;
  r: number;
  color: string;
}

interface Edge {
  s: string;
  t: string;
}

function seedRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildGraph(seed: number, count = 28) {
  const rng = seedRandom(seed * 1009 + 13);
  const nodes: Node[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      id: `n${i}`,
      x: 30 + rng() * 340,
      y: 20 + rng() * 200,
      r: 4 + rng() * 7,
      color: COLORS[Math.floor(rng() * COLORS.length)],
    });
  }
  const edges: Edge[] = [];
  for (let i = 1; i < count; i++) {
    const target = Math.floor(rng() * i);
    edges.push({ s: `n${i}`, t: `n${target}` });
    if (rng() < 0.35) {
      edges.push({ s: `n${i}`, t: `n${Math.floor(rng() * count)}` });
    }
  }
  return { nodes, edges };
}

/**
 * Decorative SVG snapshot of a network at a given tick.
 * Stable per tick via deterministic seed. Replace with real Sigma render later.
 */
export function SociologyGraphSnapshot({ tick, height = 240 }: SociologyGraphSnapshotProps) {
  const { nodes, edges } = React.useMemo(() => buildGraph(tick + 7, 30), [tick]);
  const nodeMap = React.useMemo(() => {
    const m = new Map<string, Node>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">
          Sociology Graph at Tick {tick}
        </p>
        <span className="text-[10px] text-muted-foreground font-mono">
          {nodes.length} nodes / {edges.length} edges
        </span>
      </div>
      <svg
        width="100%"
        height={height}
        viewBox="0 0 400 240"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {edges.map((e, i) => {
          const a = nodeMap.get(e.s);
          const b = nodeMap.get(e.t);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#cbd5e1"
              strokeWidth={0.6}
              opacity={0.55}
            />
          );
        })}
        {nodes.map((n) => (
          <circle
            key={n.id}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={n.color}
            opacity={0.85}
            stroke="white"
            strokeWidth={0.8}
          />
        ))}
      </svg>
    </div>
  );
}
