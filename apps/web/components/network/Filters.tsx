'use client';

import * as React from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useNetworkUIStore } from '@/lib/state/networkUiStore';
import { RotateCcw } from 'lucide-react';

const COHORT_ATTRS: {
  key: 'analyticalDepth' | 'trust' | 'expressionLevel' | 'mobilizationCapacity';
  label: string;
}[] = [
  { key: 'analyticalDepth', label: 'Analytical depth' },
  { key: 'trust', label: 'Trust' },
  { key: 'expressionLevel', label: 'Expression level' },
  { key: 'mobilizationCapacity', label: 'Mobilization capacity' },
];

export function Filters() {
  const sliderFilters = useNetworkUIStore((s) => s.sliderFilters);
  const setSliderFilter = useNetworkUIStore((s) => s.setSliderFilter);
  const cohortStanceRange = useNetworkUIStore((s) => s.cohortStanceRange);
  const setCohortStanceRange = useNetworkUIStore(
    (s) => s.setCohortStanceRange,
  );
  const showEdgesThreshold = useNetworkUIStore((s) => s.showEdgesThreshold);
  const setShowEdgesThreshold = useNetworkUIStore(
    (s) => s.setShowEdgesThreshold,
  );
  const computeNeighbors = useNetworkUIStore((s) => s.computeNeighbors);
  const setComputeNeighbors = useNetworkUIStore((s) => s.setComputeNeighbors);
  const selectedTick = useNetworkUIStore((s) => s.selectedTick);
  const setSelectedTick = useNetworkUIStore((s) => s.setSelectedTick);
  const resetFilters = useNetworkUIStore((s) => s.resetFilters);

  return (
    <Card className="p-4 space-y-5 w-[200px] shrink-0">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
      </div>

      <div className="space-y-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Cohort attributes
        </p>
        {COHORT_ATTRS.map((a) => (
          <div key={a.key} className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <Label htmlFor={`f-${a.key}`}>{a.label}</Label>
              <span className="tabular-nums text-muted-foreground">
                {sliderFilters[a.key].toFixed(2)}
              </span>
            </div>
            <Slider
              id={`f-${a.key}`}
              value={[sliderFilters[a.key]]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={([v]) => setSliderFilter(a.key, v)}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Cohort stance
        </p>
        <div className="flex justify-between text-xs">
          <span className="tabular-nums">{cohortStanceRange.min.toFixed(2)}</span>
          <span className="tabular-nums">{cohortStanceRange.max.toFixed(2)}</span>
        </div>
        <Slider
          value={[cohortStanceRange.min, cohortStanceRange.max]}
          min={-1}
          max={1}
          step={0.01}
          onValueChange={([min, max]) =>
            setCohortStanceRange({ min, max })
          }
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Tick</Label>
        <Select value={selectedTick} onValueChange={setSelectedTick}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Latest</SelectItem>
            <SelectItem value="0-50">Ticks 0–50</SelectItem>
            <SelectItem value="50-100">Ticks 50–100</SelectItem>
            <SelectItem value="100-150">Ticks 100–150</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <Label>Show edges &gt;</Label>
          <span className="tabular-nums text-muted-foreground">
            {showEdgesThreshold.toFixed(2)}
          </span>
        </div>
        <Slider
          value={[showEdgesThreshold]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={([v]) => setShowEdgesThreshold(v)}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="compute-neighbors" className="text-xs">
          Compute neighbors
        </Label>
        <Switch
          id="compute-neighbors"
          checked={computeNeighbors}
          onCheckedChange={setComputeNeighbors}
        />
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={resetFilters}
      >
        <RotateCcw className="mr-1 size-3" /> Reset filters
      </Button>
    </Card>
  );
}
