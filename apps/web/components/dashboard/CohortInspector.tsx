'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CohortDetailRow } from './CohortDetailRow';
import { CohortBarChart } from './CohortBarChart';
import type { CohortDetail } from '@/lib/dashboard/types';
import { formatNumber } from '@/lib/utils';

interface CohortInspectorProps {
  cohorts: CohortDetail[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function CohortInspector({
  cohorts,
  selectedId,
  onSelect,
}: CohortInspectorProps) {
  const selected =
    cohorts.find((c) => c.id === selectedId) ?? cohorts[0];
  if (!selected) return null;
  const initials = selected.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Cohort Inspector
        </h3>
        <Select value={selected.id} onValueChange={onSelect}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cohorts.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-xs">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarFallback
            className="text-sm font-semibold text-white"
            style={{ backgroundColor: selected.avatarColor }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-foreground truncate">
            {selected.name}
          </div>
          <div className="text-xs text-muted-foreground">
            ~{formatNumber(selected.metrics.population)} represented
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{selected.description}</p>

      <div className="flex flex-col gap-0 -mx-1 px-1 border-t border-border pt-2">
        <CohortDetailRow
          label="Stance"
          value={selected.metrics.stance.toFixed(2)}
          bar={selected.metrics.stance}
          symmetric
          color={selected.avatarColor}
        />
        <CohortDetailRow
          label="Mood"
          value={`${selected.metrics.mood.toFixed(1)}/10`}
          bar={selected.metrics.mood / 10}
          color="#10b981"
        />
        <CohortDetailRow
          label="Trust"
          value={selected.metrics.trust.toFixed(2)}
          bar={selected.metrics.trust}
          color="#0ea5e9"
        />
        <CohortDetailRow
          label="Mobilization"
          value={selected.metrics.mobilization.toFixed(2)}
          bar={selected.metrics.mobilization}
          color="#f43f5e"
        />
        <CohortDetailRow
          label="Population"
          value={formatNumber(selected.metrics.population)}
        />
        <CohortDetailRow
          label="Expression"
          value={selected.metrics.expression.toFixed(2)}
          bar={selected.metrics.expression}
          color="#f59e0b"
        />
      </div>

      <div>
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">
          Sub-issue stances
        </div>
        <CohortBarChart data={selected.bars} color={selected.avatarColor} />
      </div>

      <button
        type="button"
        className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300 self-start"
      >
        View profile →
      </button>
    </Card>
  );
}
