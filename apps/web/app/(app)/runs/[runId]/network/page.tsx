'use client';

import { Card } from '@/components/ui/card';
import { CohortInspector } from '@/components/network/CohortInspector';
import { Filters } from '@/components/network/Filters';
import { LayerToggle } from '@/components/network/LayerToggle';
import { MinimapInset } from '@/components/network/MinimapInset';
import { NetworkGraph } from '@/components/network/NetworkGraph';
import { useNetwork } from '@/lib/api/universes';
import { useNetworkUIStore } from '@/lib/state/networkUiStore';
import { useRun } from '@/lib/api/runs';

export default function NetworkPage({
  params,
}: {
  params: { runId: string };
}) {
  const activeLayer = useNetworkUIStore((s) => s.activeLayer);
  const selectedTick = useNetworkUIStore((s) => s.selectedTick);
  const { data: run } = useRun(params.runId);
  const universeId = run?.root_universe_id;
  const { data: graph, error, isLoading } = useNetwork(universeId, activeLayer, selectedTick);

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Network Graph View
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Multiplex cohort graph for {params.runId}.
          </p>
        </div>
        <LayerToggle />
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <Filters />
        <Card className="relative min-h-[560px] flex-1 overflow-hidden">
          {graph ? (
            <>
              <NetworkGraph data={graph} />
              <div className="absolute left-3 top-3 rounded-md border bg-card/90 px-3 py-2 text-xs shadow-sm">
                {graph.nodes.length} cohorts - {graph.edges.length} links - {selectedTick}
              </div>
              <div className="absolute bottom-3 left-3">
                <MinimapInset data={graph} />
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[560px] items-center justify-center p-6 text-sm text-muted-foreground">
              {isLoading ? 'Loading network...' : error ? 'Network data is unavailable.' : 'No network data is available yet.'}
            </div>
          )}
        </Card>
        {graph ? <CohortInspector data={graph} /> : null}
      </div>
    </div>
  );
}
