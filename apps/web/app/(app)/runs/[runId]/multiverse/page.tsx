'use client';

import * as React from 'react';
import { BranchInspector } from '@/components/multiverse/BranchInspector';
import { KpiStrip } from '@/components/multiverse/KpiStrip';
import { MultiverseControls } from '@/components/multiverse/MultiverseControls';
import { MultiverseFilters } from '@/components/multiverse/MultiverseFilters';
import { MultiverseLiveFeed } from '@/components/multiverse/MultiverseLiveFeed';
import { MultiverseTree } from '@/components/multiverse/MultiverseTree';
import {
  type MultiverseTreePayload,
  type UniverseStatus,
} from '@/lib/multiverse/types';
import { useMultiverseTree } from '@/lib/api/multiverse';

const ALL_STATUSES: UniverseStatus[] = [
  'active',
  'candidate',
  'frozen',
  'killed',
  'completed',
  'merged',
];

function filterTree(
  tree: MultiverseTreePayload,
  statusFilter: Set<UniverseStatus>,
  depthRange: [number, number],
  searchTerm: string,
  collapseInactive: boolean,
): MultiverseTreePayload {
  const q = searchTerm.trim().toLowerCase();
  const childMap = new Map<string, string[]>();
  for (const edge of tree.edges) {
    const children = childMap.get(edge.source) ?? [];
    children.push(edge.target);
    childMap.set(edge.source, children);
  }
  const hiddenDescendants = new Set<string>();
  if (collapseInactive) {
    const inactive = new Set(
      tree.nodes
        .filter((node) => !['active', 'candidate'].includes(node.status))
        .map((node) => node.id),
    );
    const visit = (id: string) => {
      for (const childId of childMap.get(id) ?? []) {
        hiddenDescendants.add(childId);
        visit(childId);
      }
    };
    inactive.forEach(visit);
  }
  const nodes = tree.nodes.filter((node) => {
    if (hiddenDescendants.has(node.id)) return false;
    if (!statusFilter.has(node.status)) return false;
    if (node.depth < depthRange[0] || node.depth > depthRange[1]) return false;
    if (q && !node.id.toLowerCase().includes(q) && !node.label.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
  const ids = new Set(nodes.map((node) => node.id));
  const edges = tree.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
  return { ...tree, nodes, edges };
}

export default function MultiversePage({
  params,
}: {
  params: { runId: string };
}) {
  const { data: tree, error, isLoading } = useMultiverseTree(params.runId);

  const [statusFilter, setStatusFilter] = React.useState<Set<UniverseStatus>>(
    () => new Set(ALL_STATUSES),
  );
  const [depthRange, setDepthRange] = React.useState<[number, number]>([0, 1]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [collapseInactive, setCollapseInactive] = React.useState(false);

  React.useEffect(() => {
    if (tree) {
      setDepthRange((current) => [current[0], Math.max(current[1], tree.kpis.maxDepth)]);
    }
  }, [tree]);

  const visibleTree = React.useMemo(
    () => (tree ? filterTree(tree, statusFilter, depthRange, searchTerm, collapseInactive) : null),
    [tree, statusFilter, depthRange, searchTerm, collapseInactive],
  );

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Recursive Multiverse Explorer
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Branch tree, branch budget, and recursive universe controls for {params.runId}.
          </p>
        </div>
        <MultiverseControls bbId={params.runId} />
      </div>

      {tree ? <KpiStrip kpis={tree.kpis} /> : null}

      {tree && visibleTree ? (
        <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_380px] gap-4">
          <MultiverseFilters
            tree={tree}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            depthRange={depthRange}
            onDepthRangeChange={setDepthRange}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            collapseInactive={collapseInactive}
            onCollapseInactiveChange={setCollapseInactive}
          />

          <div className="flex min-h-0 flex-col gap-3">
            <div className="text-xs text-muted-foreground">
              {visibleTree.nodes.length}/{tree.nodes.length} visible
            </div>
            <div className="min-h-[560px] flex-1 overflow-hidden rounded-lg border bg-card">
              <MultiverseTree tree={visibleTree} bbId={params.runId} />
            </div>
            <MultiverseLiveFeed events={tree.events} height={180} />
          </div>

          <BranchInspector tree={tree} />
        </div>
      ) : (
        <div className="flex min-h-[560px] items-center justify-center rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          {isLoading ? 'Loading multiverse...' : error ? 'Multiverse data is unavailable.' : 'No multiverse data is available yet.'}
        </div>
      )}
    </div>
  );
}
