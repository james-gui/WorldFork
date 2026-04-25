import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';

export interface LayoutOpts {
  rankdir?: 'LR' | 'TB';
  nodesep?: number;
  ranksep?: number;
  width?: number;
  height?: number;
}

export const NODE_W = 220;
export const NODE_H = 80;

/**
 * Lays out a directed graph using dagre.
 * Returns a fresh array of nodes with `position`/`sourcePosition`/`targetPosition`
 * set. Edges are returned unchanged.
 *
 * Memoize calls to this on the source tree's etag.
 */
export function layoutLR<TNode extends Node = Node, TEdge extends Edge = Edge>(
  nodes: TNode[],
  edges: TEdge[],
  opts: LayoutOpts = {},
): { nodes: TNode[]; edges: TEdge[] } {
  const rankdir = opts.rankdir ?? 'LR';
  const nodesep = opts.nodesep ?? 24;
  const ranksep = opts.ranksep ?? 80;
  const w = opts.width ?? NODE_W;
  const h = opts.height ?? NODE_H;

  // Build a fresh graph each call so this function is pure / reentrant-safe.
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir, nodesep, ranksep });
  for (const n of nodes) g.setNode(n.id, { width: w, height: h });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);

  const positioned = nodes.map((n) => {
    const p = g.node(n.id);
    return {
      ...n,
      targetPosition: rankdir === 'LR' ? 'left' : 'top',
      sourcePosition: rankdir === 'LR' ? 'right' : 'bottom',
      position: { x: p.x - w / 2, y: p.y - h / 2 },
    } as TNode;
  });

  return { nodes: positioned, edges };
}
