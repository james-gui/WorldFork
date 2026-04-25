'use client';

import * as React from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type OnNodesChange,
  type OnEdgesChange,
  type ReactFlowInstance,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useMultiverseUIStore } from '@/lib/state/multiverseUiStore';
import {
  STATUS_COLORS,
  type MultiverseNodeData,
  type MultiverseTreePayload,
} from '@/lib/mocks/multiverse';
import { layoutLR, NODE_H, NODE_W } from './multiverseLayout';
import { UniverseNode, type UniverseNodePayload } from './UniverseNode';

const nodeTypes = { universe: UniverseNode };

interface MultiverseTreeImplProps {
  tree: MultiverseTreePayload;
}

interface FilterState {
  statuses: Set<string>;
  searchTerm: string;
  depthRange: [number, number];
  showInactiveCollapsed: boolean;
}

function buildAncestorSet(
  tree: MultiverseTreePayload,
  uid: string | undefined,
): Set<string> {
  const out = new Set<string>();
  if (!uid) return out;
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  let cur: MultiverseNodeData | undefined = byId.get(uid);
  while (cur) {
    out.add(cur.id);
    if (!cur.parentId) break;
    cur = byId.get(cur.parentId);
  }
  return out;
}

function buildDescendantSet(
  tree: MultiverseTreePayload,
  rootId: string,
): Set<string> {
  const out = new Set<string>();
  const childMap = new Map<string, string[]>();
  for (const e of tree.edges) {
    if (!childMap.has(e.source)) childMap.set(e.source, []);
    childMap.get(e.source)!.push(e.target);
  }
  function dfs(id: string) {
    const kids = childMap.get(id) ?? [];
    for (const k of kids) {
      if (!out.has(k)) {
        out.add(k);
        dfs(k);
      }
    }
  }
  dfs(rootId);
  return out;
}

/**
 * Inner content (must be inside ReactFlowProvider so we can call useReactFlow).
 */
function MultiverseTreeContent({ tree }: MultiverseTreeImplProps) {
  const selectedUniverseId = useMultiverseUIStore((s) => s.selectedUniverseId);
  const setSelectedUniverseId = useMultiverseUIStore(
    (s) => s.setSelectedUniverseId,
  );
  const collapsedIds = useMultiverseUIStore((s) => s.collapsedIds);
  const toggleCollapsed = useMultiverseUIStore((s) => s.toggleCollapsed);
  const setCollapsedIds = useMultiverseUIStore((s) => s.setCollapsedIds);
  const compareSelection = useMultiverseUIStore((s) => s.compareSelection);
  const toggleCompare = useMultiverseUIStore((s) => s.toggleCompare);
  const highlightLineage = useMultiverseUIStore((s) => s.highlightLineage);
  const setZoom = useMultiverseUIStore((s) => s.setZoom);

  // Auto-collapse heavy subtrees on first sight of the tree.
  const seededRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (seededRef.current === tree.etag) return;
    seededRef.current = tree.etag;
    const next = new Set(collapsedIds);
    let changed = false;
    for (const n of tree.nodes) {
      if (n.descendant_count > 50 && !next.has(n.id)) {
        next.add(n.id);
        changed = true;
      }
    }
    if (changed) setCollapsedIds(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.etag]);

  // Compute hidden ids (descendants of any collapsed node).
  const hiddenIds = React.useMemo(() => {
    const hidden = new Set<string>();
    for (const id of collapsedIds) {
      const ds = buildDescendantSet(tree, id);
      for (const d of ds) hidden.add(d);
    }
    return hidden;
  }, [tree, collapsedIds]);

  // Highlight lineage = set of ancestors (incl. self) of selected.
  const ancestors = React.useMemo(
    () =>
      highlightLineage
        ? buildAncestorSet(tree, selectedUniverseId)
        : new Set<string>(),
    [highlightLineage, tree, selectedUniverseId],
  );

  // Build initial nodes/edges (filtered by hidden) and layout once per etag+filters.
  const layouted = React.useMemo(() => {
    const visibleNodes: Node[] = tree.nodes
      .filter((n) => !hiddenIds.has(n.id))
      .map((u) => {
        const payload: UniverseNodePayload = {
          universe: u,
          highlighted: ancestors.has(u.id),
          selected: u.id === selectedUniverseId,
          inCompare: compareSelection.includes(u.id),
          isCollapsed: collapsedIds.has(u.id),
          onToggleCollapsed: (id) => toggleCollapsed(id),
        };
        return {
          id: u.id,
          type: 'universe',
          position: { x: 0, y: 0 },
          data: payload as unknown as Record<string, unknown>,
          width: NODE_W,
          height: NODE_H,
        } satisfies Node;
      });
    const visibleEdges: Edge[] = tree.edges
      .filter((e) => !hiddenIds.has(e.source) && !hiddenIds.has(e.target))
      .map((e) => {
        const targetNode = tree.nodes.find((n) => n.id === e.target);
        const color = targetNode
          ? STATUS_COLORS[targetNode.status]
          : 'hsl(var(--muted-foreground))';
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'smoothstep',
          animated: targetNode?.status === 'active',
          style: { stroke: color, strokeWidth: 1.5, opacity: 0.8 },
        } satisfies Edge;
      });
    return layoutLR(visibleNodes, visibleEdges);
  }, [
    tree,
    hiddenIds,
    ancestors,
    selectedUniverseId,
    compareSelection,
    collapsedIds,
    toggleCollapsed,
  ]);

  // Local React Flow node/edge state so users can pan / select / drag.
  const [nodes, setNodes] = React.useState<Node[]>(layouted.nodes);
  const [edges, setEdges] = React.useState<Edge[]>(layouted.edges);

  // Re-sync local state whenever the layout result changes.
  React.useEffect(() => {
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [layouted]);

  const onNodesChange: OnNodesChange = React.useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );
  const onEdgesChange: OnEdgesChange = React.useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  // Click handlers — Cmd/Ctrl-click toggles compare; plain click selects.
  const onNodeClick = React.useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (event.metaKey || event.ctrlKey) {
        toggleCompare(node.id);
        return;
      }
      setSelectedUniverseId(node.id);
    },
    [setSelectedUniverseId, toggleCompare],
  );

  // LOD: flip a CSS attribute on each node element when zoom < 0.5.
  const rfRef = React.useRef<ReactFlowInstance | null>(null);
  const onMove = React.useCallback(
    (_e: unknown, viewport: { x: number; y: number; zoom: number }) => {
      setZoom(viewport.zoom);
      const lod = viewport.zoom < 0.5 ? 'tiny' : 'full';
      // Apply data-lod to all rendered nodes in the DOM.
      if (typeof document !== 'undefined') {
        const els = document.querySelectorAll<HTMLElement>(
          '.react-flow__node-universe [data-lod]',
        );
        els.forEach((el) => {
          el.setAttribute('data-lod', lod);
        });
      }
    },
    [setZoom],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onInit={(inst) => {
        rfRef.current = inst;
      }}
      onMove={onMove}
      onlyRenderVisibleElements
      proOptions={{ hideAttribution: true }}
      fitView
      minZoom={0.1}
      maxZoom={2}
      nodesDraggable={false}
      defaultEdgeOptions={{ type: 'smoothstep' }}
    >
      <Background gap={24} size={1} />
      <Controls position="bottom-left" />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => {
          const payload = n.data as unknown as UniverseNodePayload | undefined;
          return payload?.universe
            ? STATUS_COLORS[payload.universe.status]
            : '#94a3b8';
        }}
        maskColor="rgba(15,23,42,0.6)"
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
        }}
      />
    </ReactFlow>
  );
}

export default function MultiverseTreeImpl({ tree }: MultiverseTreeImplProps) {
  return (
    <ReactFlowProvider>
      <div className="size-full">
        <MultiverseTreeContent tree={tree} />
      </div>
    </ReactFlowProvider>
  );
}
