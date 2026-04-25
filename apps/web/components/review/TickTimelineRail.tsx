'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TickItem {
  tick: number;
  summary: string;
  status: 'normal' | 'branch' | 'warn' | 'error';
}

interface TickTimelineRailProps {
  ticks: TickItem[];
  currentTick: number;
  onSelect: (tick: number) => void;
}

const STATUS_DOT: Record<TickItem['status'], string> = {
  normal: 'bg-emerald-500',
  branch: 'bg-brand-500',
  warn: 'bg-amber-500',
  error: 'bg-red-500',
};

export function TickTimelineRail({ ticks, currentTick, onSelect }: TickTimelineRailProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Timeline
        </p>
      </div>
      <ul className="flex-1 overflow-y-auto divide-y divide-border">
        {ticks.map((t) => {
          const active = t.tick === currentTick;
          return (
            <li key={t.tick}>
              <button
                type="button"
                onClick={() => onSelect(t.tick)}
                className={cn(
                  'w-full text-left px-3 py-2 flex items-start gap-2 transition-colors hover:bg-accent/60',
                  active && 'bg-brand-50 dark:bg-brand-900/20'
                )}
              >
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 rounded-full shrink-0',
                    STATUS_DOT[t.status]
                  )}
                  aria-hidden="true"
                />
                <span className="flex-1 min-w-0">
                  <span
                    className={cn(
                      'flex items-center justify-between text-xs',
                      active ? 'text-brand-700 dark:text-brand-300 font-semibold' : 'text-foreground'
                    )}
                  >
                    <span>Tick {t.tick}</span>
                  </span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5 truncate">
                    {t.summary}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
