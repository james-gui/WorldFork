'use client';

import * as React from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import { NodeHoverCard } from './NodeHoverCard';
import { MinimapInset } from './MinimapInset';
import {
  useNetworkUIStore,
} from '@/lib/state/networkUiStore';
import type { NetworkDataset, NetworkNodeAttrs } from '@/lib/network/types';

interface Props {
  data: NetworkDataset;
}

interface HoverInfo {
  attrs: NetworkNodeAttrs;
  x: number;
  y: number;
}

export default function NetworkGraphImpl({ data }: Props) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const sigmaRef = React.useRef<Sigma | null>(null);
  const graphRef = React.useRef<Graph | null>(null);
  const [hover, setHover] = React.useState<HoverInfo | null>(null);

  // Subscribe to filter & layer state.
  const activeLayer = useNetworkUIStore((s) => s.activeLayer);
  const showEdgesThreshold = useNetworkUIStore((s) => s.showEdgesThreshold);
  const sliderFilters = useNetworkUIStore((s) => s.sliderFilters);
  const cohortStanceRange = useNetworkUIStore((s) => s.cohortStanceRange);
  const computeNeighbors = useNetworkUIStore((s) => s.computeNeighbors);
  const selectedNodeId = useNetworkUIStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useNetworkUIStore((s) => s.setSelectedNodeId);

  // Build the graph once per dataset change.
  React.useEffect(() => {
    if (!containerRef.current) return;

    const graph = new Graph({ multi: true, type: 'directed' });

    for (const n of data.nodes) {
      graph.addNode(n.id, {
        ...n.attrs,
        // Sigma requires x, y, size, color at the top level — already present.
      });
    }
    for (const e of data.edges) {
      try {
        graph.addEdgeWithKey(e.id, e.source, e.target, {
          ...e.attrs,
          type: 'arrow',
        });
      } catch {
        // Ignore duplicate edge keys; multi-graph should accept them but be safe.
      }
    }

    // Run a small synchronous ForceAtlas2 pass for nicer placement.
    // The API returns stable coordinates; a light synchronous pass keeps the
    // graph readable without a worker dependency during SSR hydration.
    try {
      forceAtlas2.assign(graph, {
        iterations: 60,
        settings: {
          gravity: 0.6,
          scalingRatio: 8,
          slowDown: 4,
          barnesHutOptimize: true,
          barnesHutTheta: 0.6,
          adjustSizes: true,
        },
      });
    } catch {
      // FA2 sometimes complains about isolated nodes; keep the API coordinates.
    }

    const sigma = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: false,
      defaultEdgeType: 'arrow',
      labelDensity: 0.07,
      labelGridCellSize: 100,
      labelRenderedSizeThreshold: 9,
      minCameraRatio: 0.1,
      maxCameraRatio: 4,
    });

    sigma.on('clickNode', ({ node }) => setSelectedNodeId(node));
    sigma.on('clickStage', () => setSelectedNodeId(undefined));

    sigma.on('enterNode', ({ node }) => {
      const attrs = graph.getNodeAttributes(node) as NetworkNodeAttrs;
      const display = sigma.getNodeDisplayData(node);
      if (!display) return;
      const { x, y } = sigma.graphToViewport({ x: display.x, y: display.y });
      setHover({ attrs, x, y });
    });
    sigma.on('leaveNode', () => setHover(null));

    graphRef.current = graph;
    sigmaRef.current = sigma;

    return () => {
      sigma.kill();
      graphRef.current = null;
      sigmaRef.current = null;
    };
  }, [data, setSelectedNodeId]);

  // Re-apply reducers whenever filters / layer / selection change.
  React.useEffect(() => {
    const sigma = sigmaRef.current;
    const graph = graphRef.current;
    if (!sigma || !graph) return;

    const neighborIds = new Set<string>();
    if (computeNeighbors && selectedNodeId && graph.hasNode(selectedNodeId)) {
      neighborIds.add(selectedNodeId);
      graph.forEachNeighbor(selectedNodeId, (neighbor) => neighborIds.add(neighbor));
    }

    sigma.setSetting('nodeReducer', (node, attrs) => {
      const a = attrs as unknown as NetworkNodeAttrs;
      const passes =
        a.analyticalDepth >= sliderFilters.analyticalDepth - 0.5 &&
        a.trust >= sliderFilters.trust - 0.5 &&
        a.expressionLevel >= sliderFilters.expressionLevel - 0.5 &&
        a.mobilizationCapacity >=
          sliderFilters.mobilizationCapacity - 0.5 &&
        a.cohortStance >= cohortStanceRange.min &&
        a.cohortStance <= cohortStanceRange.max;
      const isSelected = node === selectedNodeId;
      const outsideNeighborhood = neighborIds.size > 0 && !neighborIds.has(node);
      return {
        ...attrs,
        hidden: !passes || outsideNeighborhood,
        size: isSelected ? a.size * 1.6 : a.size,
        zIndex: isSelected ? 2 : 1,
        highlighted: isSelected || undefined,
        color: isSelected ? '#111827' : a.color,
      };
    });

    sigma.setSetting('edgeReducer', (edge, attrs) => {
      const layer = (attrs as { layer?: string }).layer;
      const weight = (attrs as { weight?: number }).weight ?? 0;
      const outsideNeighborhood =
        neighborIds.size > 0 &&
        (!neighborIds.has(graph.source(edge)) || !neighborIds.has(graph.target(edge)));
      return {
        ...attrs,
        hidden: layer !== activeLayer || weight < showEdgesThreshold || outsideNeighborhood,
      };
    });

    sigma.refresh();
  }, [
    activeLayer,
    showEdgesThreshold,
    sliderFilters,
    cohortStanceRange,
    computeNeighbors,
    selectedNodeId,
  ]);

  return (
    <div className="relative size-full overflow-hidden rounded-lg border bg-gradient-to-br from-slate-50 to-white">
      <div ref={containerRef} className="size-full" />
      {hover && (
        <NodeHoverCard attrs={hover.attrs} x={hover.x} y={hover.y} />
      )}
      <div className="pointer-events-none absolute right-4 bottom-4">
        <MinimapInset data={data} />
      </div>
    </div>
  );
}
