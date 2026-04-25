'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

interface TimelineHeaderProps {
  runId: string;
  universeId: string;
  worldLabel: string;
  bigBang: string;
  activeCohorts: number;
  branchTriggers: string[];
  timeHorizon: string;
  currentTick: number;
  maxTick: number;
  onTickChange: (tick: number) => void;
  onOpenReplay: () => void;
}

export function TimelineHeader({
  runId,
  universeId,
  worldLabel,
  bigBang,
  activeCohorts,
  branchTriggers,
  timeHorizon,
  currentTick,
  maxTick,
  onTickChange,
  onOpenReplay,
}: TimelineHeaderProps) {
  return (
    <div className="space-y-3 border-b pb-4">
      {/* Top row: heading + breadcrumbs + replay button */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Universe Timeline Detail</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Time of events, cohort shifts, and agent actions across ticks
          </p>
          <Breadcrumb className="mt-2">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/runs">Runs</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={`/runs/${runId}`}>Run {runId.slice(0, 8)}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{worldLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <button
          onClick={onOpenReplay}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-indigo-500 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 px-3 py-1.5 text-sm font-medium transition-colors"
        >
          ▷ Open Replay Mode
        </button>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Big Bang</span>
          <span className="font-medium truncate max-w-48">{bigBang}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">World ID</span>
          <span className="font-mono text-xs bg-muted rounded px-1.5 py-0.5">{universeId.slice(0, 12)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Active Cohorts</span>
          <Badge variant="secondary">{activeCohorts}</Badge>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground">Branch Triggers</span>
          {branchTriggers.map((t) => (
            <Badge key={t} variant="outline" className="text-xs">
              {t}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Time horizon</span>
          <span className="font-medium">{timeHorizon}</span>
        </div>
      </div>

      {/* Tick scrubber */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-10 shrink-0">Tick</span>
        <Slider
          min={1}
          max={maxTick}
          step={1}
          value={[currentTick]}
          onValueChange={([v]) => onTickChange(v)}
          className="flex-1"
        />
        <span className="text-xs tabular-nums font-medium w-14 shrink-0 text-right">
          {currentTick} / {maxTick}
        </span>
      </div>
    </div>
  );
}
