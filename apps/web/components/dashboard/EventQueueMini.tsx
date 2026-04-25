'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import type { QueueEvent } from '@/lib/dashboard/types';

interface EventQueueMiniProps {
  events: QueueEvent[];
  max?: number;
}

const KIND_COLORS: Record<string, string> = {
  institutional: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  mobilization: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  media: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

export function EventQueueMini({ events, max = 5 }: EventQueueMiniProps) {
  const items = events.slice(0, max);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Event Queue</h3>
        <span className="text-xs text-muted-foreground">
          {events.length} pending
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card overflow-hidden">
        {items.map((evt) => (
          <li
            key={evt.id}
            className="px-3 py-2 flex items-center gap-3 text-sm hover:bg-muted/40"
          >
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 border-0 ${KIND_COLORS[evt.kind] ?? 'bg-muted text-muted-foreground'}`}
            >
              {evt.kind}
            </Badge>
            <span className="flex-1 truncate text-foreground">{evt.title}</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              T+{evt.inTicks}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
