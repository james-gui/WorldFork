'use client';

import * as React from 'react';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const SCENARIOS = [
  { value: 'global-policy', label: 'Global Policy Debate' },
  { value: 'climate-accord', label: 'Climate Accord' },
  { value: 'ai-governance', label: 'AI Governance Crisis' },
  { value: 'labor-dispute', label: 'Bay Area Labor Dispute' },
];

interface LegacyControlsProps {
  zoom: number;
  onZoomChange: (z: number) => void;
  selectedScenario: string;
  onScenarioChange: (s: string) => void;
}

export function LegacyControls({
  zoom,
  onZoomChange,
  selectedScenario,
  onScenarioChange,
}: LegacyControlsProps) {
  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">
          Zoom
        </Label>
        <Slider
          min={50}
          max={200}
          step={10}
          value={[zoom]}
          onValueChange={([v]) => onZoomChange(v)}
          className="w-28"
        />
        <span className="text-xs tabular-nums w-8">{zoom}%</span>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">
          Selected scenario
        </Label>
        <Select value={selectedScenario} onValueChange={onScenarioChange}>
          <SelectTrigger className="h-8 text-xs w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCENARIOS.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
