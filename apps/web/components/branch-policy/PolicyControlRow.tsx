'use client';

import * as React from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface PolicyControlRowProps {
  label: string;
  description?: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  formatValue?: (v: number) => string;
  onValueChange: (v: number) => void;
  className?: string;
}

export function PolicyControlRow({
  label,
  description,
  enabled,
  onEnabledChange,
  value,
  min,
  max,
  step = 0.01,
  unit,
  formatValue,
  onValueChange,
  className,
}: PolicyControlRowProps) {
  const display = formatValue ? formatValue(value) : value.toFixed(step >= 1 ? 0 : 2);
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card px-3 py-2.5 flex items-start gap-3',
        className
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <p className="text-xs font-medium truncate">{label}</p>
          <span className="text-[11px] font-mono tabular-nums text-foreground/80 shrink-0">
            {display}
            {unit && <span className="text-muted-foreground ml-0.5">{unit}</span>}
          </span>
        </div>
        <Slider
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={([v]) => onValueChange(v)}
          disabled={!enabled}
          className="w-full"
        />
        {description && (
          <p className="text-[10px] text-muted-foreground mt-1 truncate">{description}</p>
        )}
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onEnabledChange}
        className="mt-1 shrink-0"
        aria-label={`Toggle ${label}`}
      />
    </div>
  );
}
