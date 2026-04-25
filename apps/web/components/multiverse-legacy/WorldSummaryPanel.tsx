'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KpiTile } from './KpiTile';
import { DominantEmotionsBars } from './DominantEmotionsBars';
import type { WorldNode } from './LegacyTreeSvg';
import { GitBranch, Play, BarChart2 } from 'lucide-react';

interface WorldSummaryPanelProps {
  world: WorldNode | null;
  onCompare?: () => void;
  onOpenTimeline?: () => void;
  onReplay?: () => void;
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  Active: 'bg-emerald-500 text-white',
  Candidate: 'bg-yellow-400 text-black',
  Frozen: 'bg-blue-400 text-white',
  Killed: 'bg-rose-500 text-white',
};

export function WorldSummaryPanel({
  world,
  onCompare,
  onOpenTimeline,
  onReplay,
}: WorldSummaryPanelProps) {
  if (!world) {
    return (
      <Card className="h-full flex items-center justify-center text-muted-foreground text-sm p-8">
        Select a world to see its summary.
      </Card>
    );
  }

  return (
    <Card className="h-full overflow-y-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{world.label}</CardTitle>
          <Badge
            className={`text-xs ${STATUS_BADGE_CLASS[world.status] ?? ''} border-0`}
          >
            {world.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">Summary</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-2">
          <KpiTile label="Active Cohorts" value={14} delta="+2" positive />
          <KpiTile label="Population" value="2.4M" delta="+1.2%" positive />
          <KpiTile label="Divergence" value="0.42" delta="+0.08" positive={false} />
          <KpiTile label="Tick" value={world.tickLabel} />
        </div>

        {/* Key Divergence Event callout */}
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-800 p-3">
          <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
            Key Divergence Event
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Global Carbon Accord Passed — Carbon pricing enacted, triggering
            economic disruption and reshaping political alliances.
          </p>
        </div>

        {/* Dominant Emotions */}
        <DominantEmotionsBars />

        {/* Action buttons */}
        <div className="flex flex-col gap-2 pt-1">
          <Button size="sm" variant="outline" className="w-full justify-start" onClick={onCompare}>
            <BarChart2 className="w-3.5 h-3.5 mr-2" />
            Compare
          </Button>
          <Button size="sm" variant="outline" className="w-full justify-start" onClick={onOpenTimeline}>
            <GitBranch className="w-3.5 h-3.5 mr-2" />
            Open Timeline
          </Button>
          <Button size="sm" variant="outline" className="w-full justify-start" onClick={onReplay}>
            <Play className="w-3.5 h-3.5 mr-2" />
            Replay
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
