'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WarmingStep {
  label: string;
  done: boolean;
}

interface CycleWarmingCardProps {
  steps?: WarmingStep[];
}

const DEFAULT_STEPS: WarmingStep[] = [
  { label: 'Fetch run manifest', done: true },
  { label: 'Load cohort archetypes', done: true },
  { label: 'Use local ledger summaries', done: true },
  { label: 'Skip Zep cloud sync', done: true },
  { label: 'Index first-tick summaries', done: false },
];

export function CycleWarmingCard({ steps = DEFAULT_STEPS }: CycleWarmingCardProps) {
  const done = steps.filter((s) => s.done).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Cycle Warming
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {done}/{steps.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {steps.map((step) => (
            <li key={step.label} className="flex items-center gap-2 text-xs">
              {step.done ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              )}
              <span className={cn(step.done ? 'text-foreground' : 'text-muted-foreground')}>
                {step.label}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
