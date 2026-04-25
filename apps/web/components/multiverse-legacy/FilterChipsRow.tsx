'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';

const BRANCH_TRIGGERS = [
  'Policy Change',
  'Tech-AI Breakthrough',
  'Social Movement',
  'Economic Crisis',
] as const;

const WORLD_STATUSES = ['Active', 'Candidate', 'Frozen', 'Killed'] as const;

type BranchTrigger = (typeof BRANCH_TRIGGERS)[number];
type WorldStatus = (typeof WORLD_STATUSES)[number];

interface FilterChipsRowProps {
  activeTriggers: BranchTrigger[];
  activeStatuses: WorldStatus[];
  onToggleTrigger: (t: BranchTrigger) => void;
  onToggleStatus: (s: WorldStatus) => void;
}

export function FilterChipsRow({
  activeTriggers,
  activeStatuses,
  onToggleTrigger,
  onToggleStatus,
}: FilterChipsRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground font-medium mr-1">
        Branch Triggers:
      </span>
      {BRANCH_TRIGGERS.map((t) => (
        <Badge
          key={t}
          variant={activeTriggers.includes(t) ? 'default' : 'outline'}
          className="cursor-pointer select-none"
          onClick={() => onToggleTrigger(t)}
        >
          {t}
        </Badge>
      ))}

      <span className="text-xs text-muted-foreground font-medium ml-4 mr-1">
        World Status:
      </span>
      {WORLD_STATUSES.map((s) => {
        const colorMap: Record<WorldStatus, string> = {
          Active: 'bg-emerald-500',
          Candidate: 'bg-yellow-400',
          Frozen: 'bg-blue-400',
          Killed: 'bg-rose-500',
        };
        return (
          <Badge
            key={s}
            variant={activeStatuses.includes(s) ? 'default' : 'outline'}
            className={`cursor-pointer select-none ${
              activeStatuses.includes(s) ? colorMap[s] + ' text-white border-transparent' : ''
            }`}
            onClick={() => onToggleStatus(s)}
          >
            {s}
          </Badge>
        );
      })}
    </div>
  );
}
