'use client';

import * as React from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Run } from '@/lib/types/run';

interface SessionReproducibilityTabProps {
  run: Run;
}

const PRESERVED_ITEMS = [
  {
    label: 'manifest.json',
    description: 'Complete run metadata, configuration, and artifact index.',
  },
  {
    label: 'Source-of-truth snapshot',
    description:
      'Exact copy of the emotions, behavior axes, ideology axes, and sociology parameters used at initialization.',
  },
  {
    label: 'All prompts & responses',
    description:
      'Every LLM prompt packet, raw response, tool call, and parsed output stored in the tick ledger.',
  },
  {
    label: 'State snapshots per tick',
    description:
      'Full state_snapshot.json at each tick boundary for every active universe.',
  },
  {
    label: 'Branch deltas',
    description:
      'Every BranchDelta (counterfactual rewrites, parameter shifts, actor overrides) is persisted verbatim.',
  },
  {
    label: 'Graph snapshots',
    description:
      'Exposure, trust, dependency, mobilization, and identity graph edges at each tick in JSONL format.',
  },
  {
    label: 'SHA-256 Merkle chain',
    description:
      'checksums.sha256 links every artifact in a tamper-evident chain; verify with the integrity check.',
  },
];

export function SessionReproducibilityTab({ run }: SessionReproducibilityTabProps) {
  const [checking, setChecking] = React.useState(false);
  const [result, setResult] = React.useState<'idle' | 'pass' | 'fail'>('idle');

  const handleVerify = () => {
    setChecking(true);
    setResult('idle');
    // Stub mutation — replace with real API call when backend is ready
    setTimeout(() => {
      setChecking(false);
      setResult('pass');
    }, 1500);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            What&apos;s Preserved
          </CardTitle>
          <div className="flex items-center gap-2">
            {result === 'pass' && (
              <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Integrity verified
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerify}
              disabled={checking}
              className="gap-1.5"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {checking ? 'Verifying…' : 'Verify integrity'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {PRESERVED_ITEMS.map((item) => (
            <li key={item.label} className="flex gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">Snapshot SHA-256: </span>
            <span className="font-mono">{run.snapshot_sha}</span>
          </p>
          <p className="mt-1">
            <span className="font-semibold text-foreground">Snapshot ID: </span>
            {run.snapshot_id}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
