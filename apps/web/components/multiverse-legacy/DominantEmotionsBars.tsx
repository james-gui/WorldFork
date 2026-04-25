'use client';

import * as React from 'react';

interface EmotionEntry {
  label: string;
  value: number; // 0–100
  color: string;
}

const DEFAULT_EMOTIONS: EmotionEntry[] = [
  { label: 'Anger', value: 72, color: '#ef4444' },
  { label: 'Hope', value: 45, color: '#22c55e' },
  { label: 'Distrust', value: 60, color: '#f97316' },
  { label: 'Sadness', value: 38, color: '#6366f1' },
];

interface DominantEmotionsBarsProps {
  emotions?: EmotionEntry[];
}

export function DominantEmotionsBars({
  emotions = DEFAULT_EMOTIONS,
}: DominantEmotionsBarsProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Dominant Emotions
      </p>
      {emotions.map((e) => (
        <div key={e.label} className="flex items-center gap-2">
          <span className="w-16 text-xs text-right text-muted-foreground shrink-0">
            {e.label}
          </span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${e.value}%`, backgroundColor: e.color }}
            />
          </div>
          <span className="w-8 text-xs text-right tabular-nums">{e.value}</span>
        </div>
      ))}
    </div>
  );
}
