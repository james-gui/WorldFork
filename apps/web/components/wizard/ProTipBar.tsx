'use client';

import * as React from 'react';
import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProTipBarProps {
  tip?: string;
  className?: string;
}

export function ProTipBar({ tip, className }: ProTipBarProps) {
  const defaultTip =
    'Be specific about time scale and stakeholder groups for richer simulations.';
  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <Lightbulb className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
      <span>
        <strong className="font-semibold text-foreground">Pro tip:</strong> {tip ?? defaultTip}
      </span>
    </div>
  );
}
