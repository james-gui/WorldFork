'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { ChevronRight, Search } from 'lucide-react';
import { useMultiverseUIStore } from '@/lib/state/multiverseUiStore';
import {
  STATUS_BADGE_CLS,
  type MultiverseTreePayload,
  type UniverseStatus,
} from '@/lib/mocks/multiverse';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: UniverseStatus[] = [
  'active',
  'candidate',
  'frozen',
  'killed',
  'completed',
  'merged',
];

interface MultiverseFiltersProps {
  tree: MultiverseTreePayload;
  statusFilter: Set<UniverseStatus>;
  onStatusFilterChange: (s: Set<UniverseStatus>) => void;
  depthRange: [number, number];
  onDepthRangeChange: (r: [number, number]) => void;
  searchTerm: string;
  onSearchTermChange: (s: string) => void;
  collapseInactive: boolean;
  onCollapseInactiveChange: (v: boolean) => void;
}

export function MultiverseFilters({
  tree,
  statusFilter,
  onStatusFilterChange,
  depthRange,
  onDepthRangeChange,
  searchTerm,
  onSearchTermChange,
  collapseInactive,
  onCollapseInactiveChange,
}: MultiverseFiltersProps) {
  const highlightLineage = useMultiverseUIStore((s) => s.highlightLineage);
  const setHighlightLineage = useMultiverseUIStore(
    (s) => s.setHighlightLineage,
  );
  const selectedUniverseId = useMultiverseUIStore((s) => s.selectedUniverseId);
  const setSelectedUniverseId = useMultiverseUIStore(
    (s) => s.setSelectedUniverseId,
  );

  const maxDepth = tree.kpis.maxDepth;
  const selectedNode = tree.nodes.find((n) => n.id === selectedUniverseId);

  const toggleStatus = (s: UniverseStatus) => {
    const next = new Set(statusFilter);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    onStatusFilterChange(next);
  };

  return (
    <Card className="flex h-full w-full flex-col p-3 gap-3 overflow-y-auto">
      <h3 className="text-sm font-semibold">Filters</h3>

      <div className="space-y-1.5">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Status
        </Label>
        <ToggleGroup
          type="multiple"
          value={Array.from(statusFilter)}
          onValueChange={(vals) =>
            onStatusFilterChange(new Set(vals as UniverseStatus[]))
          }
          className="flex flex-wrap gap-1 justify-start"
        >
          {STATUS_OPTIONS.map((s) => (
            <ToggleGroupItem
              key={s}
              value={s}
              size="sm"
              className={cn(
                'h-7 px-2 text-[10px] uppercase tracking-wide',
                statusFilter.has(s) && STATUS_BADGE_CLS[s],
              )}
            >
              {s}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Depth
          </Label>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            D{depthRange[0]} – D{depthRange[1]}
          </span>
        </div>
        <Slider
          min={0}
          max={Math.max(1, maxDepth)}
          step={1}
          value={[depthRange[0], depthRange[1]]}
          onValueChange={(v) =>
            onDepthRangeChange([v[0] ?? 0, v[1] ?? maxDepth])
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="universe-search"
          className="text-[11px] uppercase tracking-wide text-muted-foreground"
        >
          Search Universe ID
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="universe-search"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="U001"
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="highlight-lineage" className="text-xs">
          Highlight Lineage
        </Label>
        <Switch
          id="highlight-lineage"
          checked={highlightLineage}
          onCheckedChange={setHighlightLineage}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="collapse-inactive" className="text-xs">
          Collapse Inactive
        </Label>
        <Switch
          id="collapse-inactive"
          checked={collapseInactive}
          onCheckedChange={onCollapseInactiveChange}
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Lineage
        </Label>
        {selectedNode ? (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {selectedNode.lineage_path.map((id, i) => (
              <React.Fragment key={id}>
                {i > 0 ? (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                ) : null}
                <button
                  type="button"
                  className={cn(
                    'rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] hover:bg-muted',
                    id === selectedNode.id && 'bg-primary/10 border-primary/40',
                  )}
                  onClick={() => setSelectedUniverseId(id)}
                >
                  {id}
                </button>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Select a universe to see its lineage path.
          </p>
        )}
        {selectedNode ? (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Badge variant="outline" className="h-5 text-[10px]">
              D{selectedNode.depth}
            </Badge>
            <span>{selectedNode.descendant_count} descendants</span>
          </div>
        ) : null}
      </div>

      {searchTerm || statusFilter.size < STATUS_OPTIONS.length ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => {
            onStatusFilterChange(new Set(STATUS_OPTIONS));
            onSearchTermChange('');
            onDepthRangeChange([0, maxDepth]);
          }}
        >
          Reset filters
        </Button>
      ) : null}
    </Card>
  );
}
