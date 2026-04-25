'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BrainCircuit, ArrowRight } from 'lucide-react';

export type MemoryMode = 'perpetual' | 'session' | 'message_window';

interface ZepMemoryMapCardProps {
  mode?: MemoryMode;
  onModeChange?: (mode: MemoryMode) => void;
}

const MODE_DIAGRAMS: Record<MemoryMode, { from: string; to: string; label: string }[]> = {
  perpetual: [
    { from: 'Cohort', to: 'Zep User', label: 'user_id' },
    { from: 'Hero', to: 'Zep User', label: 'user_id' },
    { from: 'Run', to: 'Thread', label: 'thread_id' },
  ],
  session: [
    { from: 'Cohort', to: 'Session', label: 'session_id' },
    { from: 'Hero', to: 'Session', label: 'session_id' },
    { from: 'Run', to: 'Thread', label: 'thread_id' },
  ],
  message_window: [
    { from: 'Cohort', to: 'Window', label: 'window(N)' },
    { from: 'Hero', to: 'Window', label: 'window(N)' },
    { from: 'Run', to: 'Session', label: 'session_id' },
  ],
};

export function ZepMemoryMapCard({ mode = 'perpetual', onModeChange }: ZepMemoryMapCardProps) {
  const mappings = MODE_DIAGRAMS[mode];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-muted-foreground" />
          Memory Map
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Memory mode</Label>
          <Select value={mode} onValueChange={(v) => onModeChange?.(v as MemoryMode)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="perpetual">Perpetual (graph + summaries)</SelectItem>
              <SelectItem value="session">Session-scoped</SelectItem>
              <SelectItem value="message_window">Message window</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mapping diagram */}
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          {mappings.map((m) => (
            <div key={m.from} className="flex items-center gap-2 text-xs">
              <span className="w-16 font-medium text-foreground text-right">{m.from}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {m.label}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-brand-600 dark:text-brand-400">{m.to}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
