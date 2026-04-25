'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GitCompare, Play, Loader2 } from 'lucide-react';
import { useMultiverseUIStore } from '@/lib/state/multiverseUiStore';
import { useSimulateNextTick } from '@/lib/api/multiverse';
import { toast } from 'sonner';

interface MultiverseControlsProps {
  bbId: string;
  onCompare?: () => void;
}

export function MultiverseControls({ bbId, onCompare }: MultiverseControlsProps) {
  const compareSelection = useMultiverseUIStore((s) => s.compareSelection);
  const [autoplay, setAutoplay] = React.useState(false);
  const sim = useSimulateNextTick();

  const compareDisabled = compareSelection.length < 2;

  React.useEffect(() => {
    if (!autoplay) return;
    const timer = window.setInterval(() => {
      if (!sim.isPending) {
        sim.mutate(
          { bbId },
          {
            onError: () => toast.error('Autoplay failed to queue simulation'),
          },
        );
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [autoplay, bbId, sim]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5">
        <Switch
          id="autoplay"
          checked={autoplay}
          onCheckedChange={setAutoplay}
          aria-label="Autoplay"
        />
        <Label htmlFor="autoplay" className="text-xs cursor-pointer">
          Autoplay
        </Label>
      </div>
      {compareDisabled ? (
        <Button
          variant="outline"
          size="sm"
          disabled
          title="Select 2+ universes (Cmd-click) to compare"
        >
          <GitCompare className="mr-2 h-4 w-4" />
          Compare {compareSelection.length > 0 ? `(${compareSelection.length})` : ''}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          asChild
          title={`Compare ${compareSelection.length} universes`}
        >
          <Link href={`/runs/${bbId}/multiverse/compare`} onClick={() => onCompare?.()}>
            <GitCompare className="mr-2 h-4 w-4" />
            Compare ({compareSelection.length})
          </Link>
        </Button>
      )}
      <Button
        size="sm"
        onClick={() => {
          sim.mutate(
            { bbId },
            {
              onSuccess: () =>
                toast.success('Queued next tick simulation', {
                  description: `Run ${bbId} will advance one tick.`,
                }),
              onError: () => toast.error('Failed to queue simulation'),
            },
          );
        }}
        disabled={sim.isPending}
      >
        {sim.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Play className="mr-2 h-4 w-4" />
        )}
        Simulate Next Tick
      </Button>
    </div>
  );
}
