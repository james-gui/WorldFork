'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { JobInfo } from '@/lib/api/types';

function buildHeatmapData(jobs: JobInfo[] = [], now: number) {
  const BUCKET = 5 * 60 * 1000; // 5 min
  const COLS = 288; // 24h / 5min
  const buckets = Array.from({ length: COLS }, (_, i) => ({
    ts: now - (COLS - i - 1) * BUCKET,
    value: 0,
  }));
  const start = buckets[0]?.ts ?? now;
  for (const job of jobs) {
    const raw = job.created_at ?? job.enqueued_at ?? job.started_at;
    if (!raw) continue;
    const ts = new Date(raw).getTime();
    if (Number.isNaN(ts) || ts < start || ts > now) continue;
    const idx = Math.min(COLS - 1, Math.max(0, Math.floor((ts - start) / BUCKET)));
    buckets[idx].value += 1;
  }
  return buckets;
}

function colorForValue(v: number, max: number): string {
  const ratio = max <= 0 ? 0 : v / max;
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
  jobs?: JobInfo[];
}

export function JobsHeatmap({ className, jobs }: JobsHeatmapProps) {
  const [byQueue, setByQueue] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, []);

  const data = useMemo(
    () => (now === null ? [] : buildHeatmapData(jobs, now)),
    [jobs, now],
  );
  const maxValue = Math.max(1, ...data.map((d) => d.value));

  // For display we only show every 4th column label (hourly)
  const hourLabels: { idx: number; label: string }[] = [];
  data.forEach((d, i) => {
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
        {now === null ? (
          <div className="h-[49px] rounded-md bg-muted/50" aria-label="Loading job heatmap" />
        ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-px" style={{ minWidth: data.length * 5 }}>
            {data.map((d, i) => (
              <div
                key={i}
                title={`${formatHour(d.ts)}: ${d.value} tasks`}
                className={cn(
                  'h-8 flex-1 rounded-[1px] cursor-pointer hover:opacity-80 transition-opacity',
                  colorForValue(d.value, maxValue),
                )}
              />
            ))}
          </div>
          {/* Hour labels */}
          <div className="flex mt-1" style={{ minWidth: data.length * 5 }}>
            {hourLabels.map(({ idx, label }) => (
              <div
                key={idx}
                className="text-[9px] text-muted-foreground"
                style={{
                  position: 'relative',
                  left: `${(idx / data.length) * 100}%`,
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
        )}
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
