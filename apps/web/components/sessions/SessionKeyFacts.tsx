import * as React from 'react';
import type { Run } from '@/lib/types/run';

interface SessionKeyFactsProps {
  run: Run;
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function SessionKeyFacts({ run }: SessionKeyFactsProps) {
  const facts = [
    { label: 'Big Bang ID', value: run.big_bang_id },
    { label: 'Created at', value: formatDate(run.created_at) },
    { label: 'Universes count', value: String(run.universe_count) },
    { label: 'Initial archetypes', value: `≥ ${run.initial_archetype_count}` },
    { label: 'Time horizon', value: run.time_horizon },
    { label: 'Snapshot ID', value: run.snapshot_id },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-border/60 border border-border/60 rounded-lg overflow-hidden bg-muted/20">
      {facts.map((fact) => (
        <div key={fact.label} className="px-4 py-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            {fact.label}
          </p>
          <p className="text-sm font-semibold text-foreground truncate" title={fact.value}>
            {fact.value}
          </p>
        </div>
      ))}
    </div>
  );
}
