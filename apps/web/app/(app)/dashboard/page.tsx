'use client';

import Link from 'next/link';
import { Activity, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RunsTable, type RunRow } from '@/components/runs/RunsTable';
import { useRuns } from '@/lib/api/runs';

export default function DashboardPage() {
  const { data, isLoading, error } = useRuns({ limit: 25 });
  const rows: RunRow[] = data ?? [];
  const activeRuns = rows.filter((row) => row.status === 'running').length;
  const totalUniverses = rows.reduce((sum, row) => sum + row.universeCount, 0);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 grid h-10 w-10 place-items-center rounded-md border bg-card text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Simulation Dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Inspect active Big Bang runs, branch counts, and recent run state.
          </p>
        </div>
        <Button asChild>
          <Link href="/runs/new">
            <Plus className="mr-2 h-4 w-4" />
            New Big Bang
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Runs</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active Runs</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{activeRuns}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Universes</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{totalUniverses}</p>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          Backend dashboard data is unavailable.
        </div>
      ) : null}
      {isLoading && !data ? (
        <div className="text-sm text-muted-foreground">Loading runs...</div>
      ) : null}
      {!isLoading && !error && rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No Big Bang runs have been created yet.
          </CardContent>
        </Card>
      ) : (
        <RunsTable rows={rows} />
      )}
    </div>
  );
}
