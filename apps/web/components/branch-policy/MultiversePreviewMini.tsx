'use client';

import * as React from 'react';
import {
  ReactFlow,
  Background,
  type Node,
  type Edge,
  type ReactFlowProps,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';

interface MultiversePreviewMiniProps {
  // Effective branching budget — used to compute decorative node count.
  branchTriggerThreshold: number;
  perSandboxLimit: number;
  height?: number;
}

const COL = 140;
const ROW = 64;

function buildTree(
  branchTriggerThreshold: number,
  perSandboxLimit: number
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Root universe
  nodes.push({
    id: 'u0',
    position: { x: 0, y: 4 * ROW },
    data: { label: 'World 0' },
    style: {
      borderRadius: 8,
      padding: 4,
      width: 110,
      fontSize: 11,
      background: '#eef2ff',
      border: '1px solid #c7d2fe',
      color: '#312e81',
    },
  });

  // Active branches scale loosely with policy looseness.
  const looseness = Math.max(0, 1 - branchTriggerThreshold);
  const childCount = Math.max(1, Math.min(perSandboxLimit, Math.round(2 + looseness * 3)));
  for (let i = 0; i < childCount; i++) {
    const id = `u1_${i}`;
    const y = (i + 0.5) * ROW * (8 / childCount);
    nodes.push({
      id,
      position: { x: COL, y },
      data: { label: `World ${i + 1}` },
      style: {
        borderRadius: 8,
        padding: 4,
        width: 100,
        fontSize: 11,
        background: '#dbeafe',
        border: '1px solid #93c5fd',
        color: '#1e3a8a',
      },
    });
    edges.push({
      id: `e_root_${id}`,
      source: 'u0',
      target: id,
      animated: false,
      style: { stroke: '#a5b4fc', strokeWidth: 1.4 },
    });

    // Optional grandchild
    if (looseness > 0.3 && i < 2) {
      const gid = `u2_${i}`;
      nodes.push({
        id: gid,
        position: { x: COL * 2, y: y - 14 },
        data: { label: `Branch ${i + 1}.a` },
        style: {
          borderRadius: 8,
          padding: 4,
          width: 100,
          fontSize: 11,
          background: '#fef3c7',
          border: '1px solid #fcd34d',
          color: '#78350f',
        },
      });
      edges.push({
        id: `e_${id}_${gid}`,
        source: id,
        target: gid,
        style: { stroke: '#fcd34d', strokeWidth: 1.4 },
      });
    }
  }

  return { nodes, edges };
}

export function MultiversePreviewMini({
  branchTriggerThreshold,
  perSandboxLimit,
  height = 260,
}: MultiversePreviewMiniProps) {
  const { nodes, edges } = React.useMemo(
    () => buildTree(branchTriggerThreshold, perSandboxLimit),
    [branchTriggerThreshold, perSandboxLimit]
  );

  const flowProps: ReactFlowProps = {
    nodes,
    edges,
    fitView: true,
    nodesDraggable: false,
    nodesConnectable: false,
    elementsSelectable: false,
    panOnDrag: false,
    zoomOnScroll: false,
    zoomOnPinch: false,
    zoomOnDoubleClick: false,
    proOptions: { hideAttribution: true },
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs font-semibold">Multiverse Preview</p>
        <p className="text-[10px] text-muted-foreground">
          Sample branch shape under current policy
        </p>
      </div>
      <div style={{ height }} className="bg-slate-50/40 dark:bg-slate-900/20">
        <ReactFlow {...flowProps}>
          <Background gap={16} size={1} color="#e2e8f0" />
        </ReactFlow>
      </div>
    </div>
  );
}
