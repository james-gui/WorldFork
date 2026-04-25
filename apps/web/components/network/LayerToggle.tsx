'use client';

import * as React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import {
  useNetworkUIStore,
  type NetworkLayer,
} from '@/lib/state/networkUiStore';
import { LAYER_COLORS } from '@/lib/network/seededDataset';

const LAYERS: { key: NetworkLayer; label: string }[] = [
  { key: 'exposure', label: 'Exposure' },
  { key: 'trust', label: 'Trust' },
  { key: 'dependency', label: 'Dependency' },
  { key: 'mobilization', label: 'Mobilization' },
  { key: 'identity', label: 'Identity' },
];

export function LayerToggle() {
  const activeLayer = useNetworkUIStore((s) => s.activeLayer);
  const setActiveLayer = useNetworkUIStore((s) => s.setActiveLayer);

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        Layers
      </span>
      <ToggleGroup
        type="single"
        size="sm"
        value={activeLayer}
        onValueChange={(v) => v && setActiveLayer(v as NetworkLayer)}
        className="rounded-full bg-muted/50 p-1 gap-1"
      >
        {LAYERS.map((l) => {
          const active = activeLayer === l.key;
          return (
            <ToggleGroupItem
              key={l.key}
              value={l.key}
              aria-label={l.label}
              className={cn(
                'rounded-full px-3 text-xs font-medium border-transparent',
                active && 'bg-white shadow-sm border border-border',
              )}
            >
              <span
                className="mr-2 inline-block size-2 rounded-full"
                style={{ background: LAYER_COLORS[l.key] }}
              />
              {l.label}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
}
