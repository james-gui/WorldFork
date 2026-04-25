'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronRight,
  GitCompare,
  GitFork,
  Snowflake,
  Skull,
  Repeat,
  Loader2,
} from 'lucide-react';
import { ForceDeviationDialog } from '@/components/branching/ForceDeviationDialog';
import { Virtuoso } from 'react-virtuoso';
import { JsonViewer } from '@/components/code/JsonViewer';
import { cn } from '@/lib/utils';
import { useMultiverseUIStore } from '@/lib/state/multiverseUiStore';
import {
  STATUS_BADGE_CLS,
  triggerLabel,
  type MultiverseEvent,
  type MultiverseTreePayload,
} from '@/lib/multiverse/types';
import {
  useFreezeUniverse,
  useKillUniverse,
  useReplayFromBranch,
} from '@/lib/api/multiverse';
import { toast } from 'sonner';

interface BranchInspectorProps {
  tree: MultiverseTreePayload;
}

export function BranchInspector({ tree }: BranchInspectorProps) {
  const selectedUniverseId = useMultiverseUIStore((s) => s.selectedUniverseId);
  const setSelectedUniverseId = useMultiverseUIStore(
    (s) => s.setSelectedUniverseId,
  );
  const compareSelection = useMultiverseUIStore((s) => s.compareSelection);
  const toggleCompare = useMultiverseUIStore((s) => s.toggleCompare);

  const freeze = useFreezeUniverse();
  const kill = useKillUniverse();
  const replay = useReplayFromBranch();

  const node = React.useMemo(
    () =>
      selectedUniverseId
        ? tree.nodes.find((n) => n.id === selectedUniverseId)
        : tree.nodes[0],
    [selectedUniverseId, tree.nodes],
  );

  const events = React.useMemo<MultiverseEvent[]>(() => {
    if (!node) return tree.events;
    const direct = tree.events.filter((e) => e.universeId === node.id);
    return direct.length ? direct : tree.events.slice(0, 8);
  }, [tree.events, node]);

  const inCompare = node ? compareSelection.includes(node.id) : false;

  if (!node) {
    return (
      <Card className="flex h-full flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Select a universe to inspect.
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Branch Inspector
            </p>
            <h2 className="font-mono text-base font-semibold">{node.label}</h2>
          </div>
          <Badge
            variant="outline"
            className={cn('h-6 text-[10px]', STATUS_BADGE_CLS[node.status])}
          >
            {node.status}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="summary" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="m-3 grid grid-cols-4">
          <TabsTrigger value="summary" className="text-[11px]">
            Summary
          </TabsTrigger>
          <TabsTrigger value="delta" className="text-[11px]">
            Branch Delta
          </TabsTrigger>
          <TabsTrigger value="lineage" className="text-[11px]">
            Lineage
          </TabsTrigger>
          <TabsTrigger value="feed" className="text-[11px]">
            Live Feed
          </TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3">
          <TabsContent value="summary" className="mt-0 h-full">
            <ScrollArea className="h-full pr-2">
              <SummaryTab tree={tree} nodeId={node.id} onPick={setSelectedUniverseId} />
            </ScrollArea>
          </TabsContent>
          <TabsContent value="delta" className="mt-0 h-full">
            <div className="h-full overflow-hidden rounded border">
              <JsonViewer
                value={JSON.stringify(node.branch_delta, null, 2)}
                height="100%"
              />
            </div>
          </TabsContent>
          <TabsContent value="lineage" className="mt-0 h-full">
            <ScrollArea className="h-full pr-2">
              <LineageTab tree={tree} nodeId={node.id} onPick={setSelectedUniverseId} />
            </ScrollArea>
          </TabsContent>
          <TabsContent value="feed" className="mt-0 h-full">
            <FeedTab events={events} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Action buttons */}
      <div className="border-t bg-muted/30 px-3 py-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={inCompare ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleCompare(node.id)}
          >
            <GitCompare className="mr-1.5 h-3.5 w-3.5" />
            {inCompare ? 'In Compare' : 'Compare'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              freeze.mutate(node.id, {
                onSuccess: () =>
                  toast.success(`Freeze requested for ${node.id}`),
              });
            }}
            disabled={freeze.isPending}
          >
            {freeze.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Snowflake className="mr-1.5 h-3.5 w-3.5" />
            )}
            Freeze
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              kill.mutate(node.id, {
                onSuccess: () => toast.success(`Kill requested for ${node.id}`),
              });
            }}
            disabled={kill.isPending}
          >
            {kill.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Skull className="mr-1.5 h-3.5 w-3.5" />
            )}
            Kill
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              replay.mutate(node.id, {
                onSuccess: () =>
                  toast.success(`Replay-from-branch queued for ${node.id}`),
              });
            }}
            disabled={replay.isPending}
          >
            {replay.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Repeat className="mr-1.5 h-3.5 w-3.5" />
            )}
            Replay
          </Button>
          <ForceDeviationDialog
            universeId={node.id}
            tick={node.current_tick}
            trigger={
              <Button variant="outline" size="sm" className="col-span-2">
                <GitFork className="mr-1.5 h-3.5 w-3.5" />
                Force Deviation
              </Button>
            }
          />
        </div>
      </div>
    </Card>
  );
}

// ── Summary tab ──────────────────────────────────────────────────────────────

function SummaryTab({
  tree,
  nodeId,
  onPick,
}: {
  tree: MultiverseTreePayload;
  nodeId: string;
  onPick: (id: string | undefined) => void;
}) {
  const node = tree.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const parent = node.parentId
    ? tree.nodes.find((n) => n.id === node.parentId)
    : null;
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
      <dt className="text-muted-foreground">Status</dt>
      <dd className="text-right">
        <Badge
          variant="outline"
          className={cn('h-5 text-[10px]', STATUS_BADGE_CLS[node.status])}
        >
          {node.status}
        </Badge>
      </dd>
      <dt className="text-muted-foreground">Parent</dt>
      <dd className="text-right">
        {parent ? (
          <button
            type="button"
            onClick={() => onPick(parent.id)}
            className="font-mono text-xs text-primary underline-offset-2 hover:underline"
          >
            {parent.id}
          </button>
        ) : (
          <span className="text-muted-foreground">root</span>
        )}
      </dd>
      <dt className="text-muted-foreground">Depth</dt>
      <dd className="text-right tabular-nums">D{node.depth}</dd>
      <dt className="text-muted-foreground">Branch trigger</dt>
      <dd className="text-right">{triggerLabel(node.branch_trigger)}</dd>
      <dt className="text-muted-foreground">Branch from tick</dt>
      <dd className="text-right tabular-nums">T{node.branch_from_tick}</dd>
      <dt className="text-muted-foreground">Branch tick</dt>
      <dd className="text-right tabular-nums">T{node.branch_tick}</dd>
      <dt className="text-muted-foreground">Divergence</dt>
      <dd className="text-right tabular-nums">{node.divergence_score.toFixed(2)}</dd>
      <dt className="text-muted-foreground">Confidence</dt>
      <dd className="text-right tabular-nums">{node.confidence.toFixed(2)}</dd>
      <dt className="text-muted-foreground">Children</dt>
      <dd className="text-right tabular-nums">{node.child_count}</dd>
      <dt className="text-muted-foreground">Descendants</dt>
      <dd className="text-right tabular-nums">{node.descendant_count}</dd>

      <dt className="col-span-2 mt-2 border-t pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Latest metrics
      </dt>
      <dt className="text-muted-foreground">Population</dt>
      <dd className="text-right tabular-nums">
        {node.metrics.population.toLocaleString()}
      </dd>
      <dt className="text-muted-foreground">Posts</dt>
      <dd className="text-right tabular-nums">
        {node.metrics.posts.toLocaleString()}
      </dd>
      <dt className="text-muted-foreground">Events</dt>
      <dd className="text-right tabular-nums">{node.metrics.events}</dd>
      <dt className="text-muted-foreground">Tick progress</dt>
      <dd className="text-right tabular-nums">
        {(node.metrics.tickProgress * 100).toFixed(0)}%
      </dd>
      <dt className="text-muted-foreground">Created</dt>
      <dd className="text-right tabular-nums text-[11px]">
        {new Date(node.created_at).toLocaleString()}
      </dd>
    </dl>
  );
}

// ── Lineage tab ──────────────────────────────────────────────────────────────

function LineageTab({
  tree,
  nodeId,
  onPick,
}: {
  tree: MultiverseTreePayload;
  nodeId: string;
  onPick: (id: string | undefined) => void;
}) {
  const node = tree.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const lineageNodes = node.lineage_path
    .map((id) => tree.nodes.find((n) => n.id === id))
    .filter(Boolean) as typeof tree.nodes;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Lineage chain ({lineageNodes.length})
      </p>
      <ol className="flex flex-col gap-1">
        {lineageNodes.map((n, i) => (
          <li key={n.id} className="flex items-center gap-1.5">
            {i > 0 ? (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            ) : (
              <span className="inline-block w-3" />
            )}
            <button
              type="button"
              onClick={() => onPick(n.id)}
              className={cn(
                'flex flex-1 items-center justify-between gap-2 rounded border bg-muted/30 px-2 py-1.5 text-xs hover:bg-muted',
                n.id === node.id && 'border-primary/50 bg-primary/5',
              )}
            >
              <span className="font-mono">{n.label}</span>
              <span className="flex items-center gap-1">
                <Badge
                  variant="outline"
                  className={cn('h-4 text-[9px]', STATUS_BADGE_CLS[n.status])}
                >
                  {n.status}
                </Badge>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  D{n.depth}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <Separator className="my-2" />
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Children ({node.child_count})
      </p>
      <ul className="flex flex-col gap-1">
        {tree.edges
          .filter((e) => e.source === node.id)
          .map((e) => {
            const child = tree.nodes.find((n) => n.id === e.target);
            if (!child) return null;
            return (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() => onPick(child.id)}
                  className="flex w-full items-center justify-between gap-2 rounded border bg-muted/30 px-2 py-1.5 text-xs hover:bg-muted"
                >
                  <span className="font-mono">{child.label}</span>
                  <span className="flex items-center gap-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        'h-4 text-[9px]',
                        STATUS_BADGE_CLS[child.status],
                      )}
                    >
                      {child.status}
                    </Badge>
                  </span>
                </button>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

// ── Feed tab ─────────────────────────────────────────────────────────────────

function FeedTab({ events }: { events: MultiverseEvent[] }) {
  return (
    <div className="h-full">
      <Virtuoso
        data={events}
        itemContent={(_idx, ev) => (
          <div className="border-b px-1 py-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wide text-primary">
                {ev.topic}
              </span>
              <span className="text-[10px] text-muted-foreground">{ev.ago}</span>
            </div>
            <p className="mt-0.5 text-foreground">{ev.message}</p>
          </div>
        )}
      />
    </div>
  );
}
