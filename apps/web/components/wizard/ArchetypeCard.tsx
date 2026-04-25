'use client';

import * as React from 'react';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ArchetypeCardData {
  id: string;
  label: string;
  population: number;
  icon?: React.ReactNode;
  color?: string;
}

interface ArchetypeCardProps {
  archetype: ArchetypeCardData;
  className?: string;
}

export function ArchetypeCard({ archetype, className }: ArchetypeCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card p-3 text-center',
        className
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full',
          archetype.color ?? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
        )}
      >
        {archetype.icon ?? <Users className="h-4 w-4" />}
      </div>
      <span className="text-xs font-medium leading-tight">{archetype.label}</span>
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
        {archetype.population.toLocaleString()}
      </span>
    </div>
  );
}
