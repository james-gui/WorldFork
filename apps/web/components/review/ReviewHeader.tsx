'use client';

import * as React from 'react';
import Link from 'next/link';
import { LogOut, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface ReviewHeaderProps {
  runId: string;
  universeId: string;
  currentTick: number;
  maxTick: number;
  onTickChange: (tick: number) => void;
  onReload?: () => void;
}

export function ReviewHeader({
  runId,
  universeId,
  currentTick,
  maxTick,
  onTickChange,
  onReload,
}: ReviewHeaderProps) {
  return (
    <div className="border-b border-border bg-card">
      <div className="flex items-start justify-between gap-4 px-6 pt-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review Mode</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Replay and explainability tick-by-tick step.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href={`/runs/${runId}/universes/${universeId}`}>
            <LogOut className="h-3.5 w-3.5" />
            Exit review mode
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4 px-6 py-4">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Tick
          </span>
          <span className="text-base font-semibold font-mono tabular-nums">
            {currentTick}
          </span>
        </div>

        <div className="flex-1 min-w-0 max-w-xl">
          <Slider
            min={1}
            max={maxTick}
            step={1}
            value={[currentTick]}
            onValueChange={([v]) => onTickChange(v)}
            className={cn('w-full')}
          />
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Tick count</span>
            <span className="text-xs font-mono font-medium tabular-nums">
              {maxTick}
            </span>
          </div>
          <button
            type="button"
            onClick={onReload}
            className="flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Reload"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
