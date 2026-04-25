'use client';

import Link from 'next/link';
import { GitBranch, Network, BookOpen, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useRuns } from '@/lib/api/runs';
import type { RunRow } from '@/components/runs/RunsTable';

type AnalysisMode = 'network' | 'multiverse' | 'review';

const MODE_META: Record<
  AnalysisMode,
  {
    title: string;
    description: string;
    icon: typeof Network;
    action: string;
    href: (run: RunRow) => string;
  }
> = {
  network: {
    title: 'Network Graph View',
    description: 'Choose a Big Bang run to inspect its current multiplex cohort graph.',
    icon: Network,
    action: 'Open Network',
    href: (run) => `/runs/${run.id}/network`,
  },
  multiverse: {
    title: 'Recursive Multiverse Explorer',
    description: 'Choose a Big Bang run to inspect branches, lineage, and branch controls.',
    icon: GitBranch,
    action: 'Open Multiverse',
    href: (run) => `/runs/${run.id}/multiverse`,
  },
  review: {
    title: 'Review Mode',
    description: 'Choose a Big Bang run to replay tick artifacts for its root universe.',
    icon: BookOpen,
    action: 'Open Review',
    href: (run) => `/runs/${run.id}/universes/${run.rootUniverseId}/review`,
  },
};

export function RunAnalysisPicker({ mode }: { mode: AnalysisMode }) {
  const meta = MODE_META[mode];
  const Icon = meta.icon;
  const { data, error, isLoading } = useRuns({ limit: 50 });
  const rows = data ?? [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 grid h-10 w-10 place-items-center rounded-md border bg-card text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {meta.description}
          </p>
        </div>
        <Button asChild>
          <Link href="/runs/new">
            <Plus className="mr-2 h-4 w-4" />
            New Big Bang
          </Link>
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          Backend run history is unavailable.
        </div>
      ) : null}
      {isLoading && !data ? (
        <div className="text-sm text-muted-foreground">Loading runs...</div>
      ) : null}
      {!isLoading && !error && rows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No Big Bang runs have been created yet.
        </Card>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((run) => (
          <Card key={run.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <div className="truncate font-medium">{run.name}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{run.id}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                {run.universeCount} universes - {run.status}
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={meta.href(run)}>{meta.action}</Link>
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
