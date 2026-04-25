'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { cn } from '@/lib/utils';

// Generate 24h * 12 5-min buckets mock data
function generateHeatmapData() {
  const now = Date.now();
  const BUCKET = 5 * 60 * 1000; // 5 min
  const COLS = 288; // 24h / 5min
  return Array.from({ length: COLS }, (_, i) => ({
    ts: now - (COLS - i) * BUCKET,
    value: Math.round(Math.random() * 100),
  }));
}

const DATA = generateHeatmapData();
const MAX_VAL = Math.max(...DATA.map((d) => d.value));

function colorForValue(v: number, max: number): string {
  const ratio = v / max;
  if (ratio < 0.2) return 'bg-blue-100 dark:bg-blue-950';
  if (ratio < 0.4) return 'bg-blue-300 dark:bg-blue-800';
  if (ratio < 0.6) return 'bg-indigo-400 dark:bg-indigo-700';
  if (ratio < 0.8) return 'bg-indigo-600 dark:bg-indigo-500';
  return 'bg-indigo-800 dark:bg-indigo-300';
}

function formatHour(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

interface JobsHeatmapProps {
  className?: string;
}

export function JobsHeatmap({ className }: JobsHeatmapProps) {
  const [byQueue, setByQueue] = useState(false);

  // For display we only show every 4th column label (hourly)
  const hourLabels: { idx: number; label: string }[] = [];
  DATA.forEach((d, i) => {
    if (i % 12 === 0) {
      hourLabels.push({ idx: i, label: formatHour(d.ts) });
    }
  });

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Job Tasks per Minute</CardTitle>
        <div className="flex items-center gap-2">
          <Label htmlFor="heatmap-queue-toggle" className="text-xs text-muted-foreground">
            By queue
          </Label>
          <Switch
            id="heatmap-queue-toggle"
            checked={byQueue}
            onCheckedChange={setByQueue}
            className="scale-75"
          />
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {/* Heatmap strip */}
        <div className="overflow-x-auto">
          <div className="flex gap-px" style={{ minWidth: DATA.length * 5 }}>
            {DATA.map((d, i) => (
              <div
                key={i}
                title={`${formatHour(d.ts)}: ${d.value} tasks`}
                className={cn(
                  'h-8 flex-1 rounded-[1px] cursor-pointer hover:opacity-80 transition-opacity',
                  colorForValue(d.value, MAX_VAL),
                )}
              />
            ))}
          </div>
          {/* Hour labels */}
          <div className="flex mt-1" style={{ minWidth: DATA.length * 5 }}>
            {hourLabels.map(({ idx, label }) => (
              <div
                key={idx}
                className="text-[9px] text-muted-foreground"
                style={{
                  position: 'relative',
                  left: `${(idx / DATA.length) * 100}%`,
                  transform: 'translateX(-50%)',
                  flexShrink: 0,
                  width: 0,
                  overflow: 'visible',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-2 mt-4">
          <span className="text-[10px] text-muted-foreground">Low</span>
          <div className="flex gap-px">
            {['bg-blue-100', 'bg-blue-300', 'bg-indigo-400', 'bg-indigo-600', 'bg-indigo-800'].map((c) => (
              <div key={c} className={cn('h-3 w-6 rounded-[1px]', c)} />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">High</span>
        </div>
      </CardContent>
    </Card>
  );
}
