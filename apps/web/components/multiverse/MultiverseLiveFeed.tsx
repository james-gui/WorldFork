'use client';

import * as React from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MultiverseEvent } from '@/lib/multiverse/types';
import { useMultiverseUIStore } from '@/lib/state/multiverseUiStore';

interface MultiverseLiveFeedProps {
  events: MultiverseEvent[];
  height?: number;
}

const TOPIC_COLORS: Record<MultiverseEvent['topic'], string> = {
  'branch.created':
    'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  'branch.frozen':
    'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
  'branch.killed':
    'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30',
  'branch.completed':
    'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30',
  'tick.completed':
    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  'universe.status_changed':
    'bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30',
};

export function MultiverseLiveFeed({ events, height = 380 }: MultiverseLiveFeedProps) {
  const setSelectedUniverseId = useMultiverseUIStore(
    (s) => s.setSelectedUniverseId,
  );

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Live Feed</h3>
          <p className="text-xs text-muted-foreground">
            {events.length} recent multiverse events
          </p>
        </div>
        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>
      <div style={{ height }}>
        {events.length === 0 ? (
          <div className="grid h-full place-items-center text-xs text-muted-foreground">
            No events yet.
          </div>
        ) : (
          <Virtuoso
            data={events}
            itemContent={(_idx, ev) => (
              <button
                type="button"
                onClick={() => setSelectedUniverseId(ev.universeId)}
                className="flex w-full flex-col gap-0.5 border-b px-4 py-2 text-left text-xs hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'h-5 px-1.5 text-[10px] uppercase tracking-wide',
                      TOPIC_COLORS[ev.topic],
                    )}
                  >
                    {ev.topic}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{ev.ago}</span>
                </div>
                <p className="text-foreground">{ev.message}</p>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {ev.universeId}
                </span>
              </button>
            )}
            increaseViewportBy={200}
          />
        )}
      </div>
    </Card>
  );
}
