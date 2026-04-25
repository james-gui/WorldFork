'use client';

import * as React from 'react';
import { Loader2, GitFork } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useForceDeviation } from '@/lib/api/universes';

const DEFAULT_DELTA = JSON.stringify(
  {
    type: 'parameter_shift',
    target: 'operator_forced_deviation',
    delta: { strength: 1 },
  },
  null,
  2,
);

export function ForceDeviationDialog({
  universeId,
  tick,
  trigger,
}: {
  universeId: string;
  tick: number;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [selectedTick, setSelectedTick] = React.useState(tick);
  const [mode, setMode] = React.useState<'god_prompt' | 'structured_delta'>('god_prompt');
  const [prompt, setPrompt] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [deltaText, setDeltaText] = React.useState(DEFAULT_DELTA);
  const [autoStart, setAutoStart] = React.useState(true);
  const forceDeviation = useForceDeviation();

  React.useEffect(() => {
    if (!open) return;
    setSelectedTick(tick);
  }, [open, tick]);

  const submit = async () => {
    let delta: Record<string, unknown> | null = null;
    if (mode === 'structured_delta') {
      try {
        delta = JSON.parse(deltaText) as Record<string, unknown>;
      } catch {
        toast.error('Structured delta is not valid JSON.');
        return;
      }
    }
    try {
      const result = await forceDeviation.mutateAsync({
        uid: universeId,
        tick: selectedTick,
        mode,
        prompt: mode === 'god_prompt' ? prompt : null,
        delta,
        reason,
        auto_start: autoStart,
      });
      toast.success('Forced deviation committed', {
        description: result.child_universe_id ?? result.job_id,
      });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Forced deviation failed.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <GitFork className="h-3.5 w-3.5" />
            Force Deviation
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Force Deviation</DialogTitle>
          <DialogDescription>
            Branch this universe from a historical tick.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
            <Label htmlFor="force-tick">Tick</Label>
            <Input
              id="force-tick"
              type="number"
              min={0}
              value={selectedTick}
              onChange={(event) => setSelectedTick(Number(event.target.value))}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="god_prompt">God prompt</SelectItem>
                <SelectItem value="structured_delta">Structured delta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="force-reason">Reason</Label>
            <Input
              id="force-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Operator-forced counterfactual"
            />
          </div>

          {mode === 'god_prompt' ? (
            <div className="grid gap-2">
              <Label htmlFor="force-prompt">Prompt</Label>
              <Textarea
                id="force-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={7}
                placeholder="At this tick, create a branch where the whistleblower evidence is verified early and official channels acknowledge it."
              />
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="force-delta">BranchDelta JSON</Label>
              <Textarea
                id="force-delta"
                value={deltaText}
                onChange={(event) => setDeltaText(event.target.value)}
                rows={9}
                className="font-mono text-xs"
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="force-auto-start">Auto-start child tick</Label>
              <p className="text-xs text-muted-foreground">Queue the first child tick after committing the branch.</p>
            </div>
            <Switch id="force-auto-start" checked={autoStart} onCheckedChange={setAutoStart} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={forceDeviation.isPending}>
            {forceDeviation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitFork className="mr-2 h-4 w-4" />}
            Commit Branch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
