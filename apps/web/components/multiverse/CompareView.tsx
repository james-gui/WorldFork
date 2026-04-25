'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { GitCompare, ArrowLeft } from 'lucide-react';
import { useMultiverseUIStore } from '@/lib/state/multiverseUiStore';
import { STATUS_BADGE_CLS, type MultiverseNodeData } from '@/lib/multiverse/types';
import { useMultiverseTree } from '@/lib/api/multiverse';
import { cn } from '@/lib/utils';
import {
  CompareMetricChart,
  type OverlayMetric,
} from '@/components/multiverse/CompareMetricChart';

function MiniDivergenceTrend({ node }: { node: MultiverseNodeData }) {
  const data = node.divergence_series.map((pt) => ({
    tick: pt.i,
    value: +(pt.v * 100).toFixed(1),
  }));
  return (
    <div className="mt-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Divergence trend
      </p>
      <ResponsiveContainer width="100%" height={64}>
        <LineChart data={data} margin={{ top: 2, right: 4, bottom: 2, left: 0 }}>
          <XAxis dataKey="tick" hide />
          <YAxis hide domain={[0, 100]} />
          <Tooltip
            contentStyle={{ fontSize: 10 }}
            formatter={(v: number | string) =>
              typeof v === 'number' ? [`${v.toFixed(1)}`, 'score'] : [v, 'score']
            }
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#10b981"
            dot={false}
            strokeWidth={1.5}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface UniverseCardProps {
  node: MultiverseNodeData;
}

function UniverseCard({ node }: UniverseCardProps) {
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-mono text-sm">{node.id}</CardTitle>
          <Badge
            variant="outline"
            className={cn('h-5 text-[10px] uppercase', STATUS_BADGE_CLS[node.status])}
          >
            {node.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 text-xs">
        {/* Key attributes */}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">Branch from tick</dt>
          <dd className="text-right tabular-nums">T{node.branch_from_tick}</dd>
          <dt className="text-muted-foreground">Divergence</dt>
          <dd className="text-right tabular-nums">{node.divergence_score.toFixed(2)}</dd>
          <dt className="text-muted-foreground">Depth</dt>
          <dd className="text-right tabular-nums">D{node.depth}</dd>
          <dt className="text-muted-foreground">Confidence</dt>
          <dd className="text-right tabular-nums">{node.confidence.toFixed(2)}</dd>
        </dl>

        <Separator />

        {/* Latest metrics (5 KPIs) */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Latest metrics
          </p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
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
            <dt className="text-muted-foreground">Children</dt>
            <dd className="text-right tabular-nums">{node.child_count}</dd>
          </dl>
        </div>

        <MiniDivergenceTrend node={node} />
      </CardContent>
    </Card>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyCompareState({ runId }: { runId: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <GitCompare className="h-12 w-12 text-muted-foreground/40" />
      <h2 className="text-lg font-semibold">Nothing to compare yet</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Select at least 2 universes from the multiverse explorer to compare.
      </p>
      <Button asChild variant="outline">
        <Link href={`/runs/${runId}/multiverse`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Open Multiverse Explorer
        </Link>
      </Button>
    </div>
  );
}

// ── Main compare view ─────────────────────────────────────────────────────────

interface CompareViewProps {
  runId: string;
  initialUniverseIds?: string[];
}

export function CompareView({ runId, initialUniverseIds = [] }: CompareViewProps) {
  const compareSelection = useMultiverseUIStore((s) => s.compareSelection);
  const [metric, setMetric] = React.useState<OverlayMetric>('dominant_emotion');
  const { data: tree, isLoading, error } = useMultiverseTree(runId);
  const selectedIds = compareSelection.length >= 2 ? compareSelection : initialUniverseIds;

  const selectedNodes = React.useMemo(
    () =>
      selectedIds
        .map((id) => tree?.nodes.find((n) => n.id === id))
        .filter((n): n is MultiverseNodeData => Boolean(n)),
    [selectedIds, tree?.nodes],
  );

  if (selectedIds.length < 2) {
    return <EmptyCompareState runId={runId} />;
  }

  if (!tree) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 p-6 text-center">
        <h2 className="text-lg font-semibold">
          {isLoading ? 'Loading branches' : 'Branch data unavailable'}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {error ? 'The compare view could not load the persisted multiverse tree.' : 'No persisted multiverse tree is available yet.'}
        </p>
      </div>
    );
  }

  if (selectedNodes.length < 2) {
    return <EmptyCompareState runId={runId} />;
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compare Branches</h1>
          <p className="text-sm text-muted-foreground">
            Comparing {selectedNodes.length} universe
            {selectedNodes.length !== 1 ? 's' : ''} from run{' '}
            <span className="font-mono">{runId}</span>.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/runs/${runId}/multiverse`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Open Multiverse Explorer
          </Link>
        </Button>
      </div>

      {/* Side-by-side universe cards (1–4) */}
      <div
        className={cn(
          'grid gap-4',
          selectedNodes.length === 1 && 'grid-cols-1 max-w-sm',
          selectedNodes.length === 2 && 'grid-cols-1 sm:grid-cols-2',
          selectedNodes.length === 3 && 'grid-cols-1 sm:grid-cols-3',
          selectedNodes.length >= 4 && 'grid-cols-2 xl:grid-cols-4',
        )}
      >
        {selectedNodes.map((node) => (
          <UniverseCard key={node.id} node={node} />
        ))}
      </div>

      <Separator />

      {/* Combined overlay chart */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Overlay chart</h2>
          <div className="flex items-center gap-2">
            <Label htmlFor="metric-select" className="text-xs">
              Compare metric
            </Label>
            <Select
              value={metric}
              onValueChange={(v) => setMetric(v as OverlayMetric)}
            >
              <SelectTrigger id="metric-select" className="h-8 w-52 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dominant_emotion">Dominant Emotion Score</SelectItem>
                <SelectItem value="polarization">Polarization Index</SelectItem>
                <SelectItem value="mobilization_risk">Mobilization Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <CompareMetricChart nodes={selectedNodes} metric={metric} />
      </div>
    </div>
  );
}
