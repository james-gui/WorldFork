'use client';

import * as React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface SliderRowProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number) => void;
  formatValue?: (v: number) => string;
  className?: string;
}

export function SliderRow({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onValueChange,
  formatValue,
  className,
}: SliderRowProps) {
  const display = formatValue ? formatValue(value) : value.toFixed(2);

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-mono font-medium tabular-nums">{display}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onValueChange(v)}
        className="w-full"
      />
    </div>
  );
}
