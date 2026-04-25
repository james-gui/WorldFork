'use client';

import * as React from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type RunStatus = 'running' | 'paused' | 'completed' | 'failed' | 'archived';

export interface RunRow {
  id: string;
  name: string;
  bigBangId: string;
  rootUniverseId: string;
  createdAt: string;
  durationSeconds: number;
  universeCount: number;
  status: RunStatus;
  provider: string;
  tags: string[];
  scenarioType: string;
  starred: boolean;
}

const STATUS_CLASS: Record<RunStatus, string> = {
  running: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  paused: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  completed: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  failed: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  archived: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'new';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

export function RunsTable({
  rows,
  onFilterChange,
}: {
  rows: RunRow[];
  onFilterChange?: (value: string) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<RunRow | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.id,
        row.name,
        row.bigBangId,
        row.rootUniverseId,
        row.provider,
        row.scenarioType,
        ...row.tags,
      ].some((part) => part.toLowerCase().includes(q)),
    );
  }, [query, rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            onFilterChange?.(event.target.value);
          }}
          placeholder="Search runs"
          className="max-w-sm"
        />
        <p className="text-xs text-muted-foreground">
          {filtered.length} of {rows.length} runs
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Scenario</TableHead>
              <TableHead>Universes</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => setSelected(row)}
              >
                <TableCell>
                  {row.starred ? (
                    <Star className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Star className="h-4 w-4 text-muted-foreground opacity-30" />
                  )}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{row.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {row.id}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn('capitalize', STATUS_CLASS[row.status])}>
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell>{row.scenarioType || 'General simulation'}</TableCell>
                <TableCell>{row.universeCount}</TableCell>
                <TableCell>
                  <div>{formatDate(row.createdAt)}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDuration(row.durationSeconds)}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline" onClick={(event) => event.stopPropagation()}>
                    <Link href={`/runs/${row.id}`}>Open</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          {selected ? (
            <div className="space-y-5">
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>{selected.bigBangId}</SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Summary label="Status" value={selected.status} />
                <Summary label="Provider" value={selected.provider || 'OpenRouter'} />
                <Summary label="Universes" value={selected.universeCount} />
                <Summary label="Created" value={formatDate(selected.createdAt)} />
              </div>
              <div className="flex gap-2">
                <Button asChild>
                  <Link href={`/runs/${selected.id}`}>Session</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/runs/${selected.id}/dashboard`}>Dashboard</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/runs/${selected.id}/multiverse`}>Multiverse</Link>
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
