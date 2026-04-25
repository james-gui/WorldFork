'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RunsTable, type RunRow } from '@/components/runs/RunsTable';
import { useRuns } from '@/lib/api/runs';

export default function RunsPage() {
  const { data, isLoading, error } = useRuns({ limit: 100 });
  const rows: RunRow[] = data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Run History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse active Big Bang runs, inspect branches, and resume review.
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
        <div className="rounded-lg border bg-card px-4 py-8 text-sm text-muted-foreground">
          No Big Bang runs have been created yet.
        </div>
      ) : null}
      <RunsTable rows={rows} />
    </div>
  );
}
