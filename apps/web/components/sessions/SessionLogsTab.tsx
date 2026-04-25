'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, ScrollText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Run } from '@/lib/types/run';
import { useLogs } from '@/lib/api/logs';

interface SessionLogsTabProps {
  run: Run;
}

export function SessionLogsTab({ run }: SessionLogsTabProps) {
  const { data: logs = [] } = useLogs({ runId: run.id, limit: 1000 });
  const stats = React.useMemo(() => {
    const totalTokens = logs.reduce((sum, log) => sum + log.total_tokens, 0);
    const totalCost = logs.reduce((sum, log) => sum + (log.cost_usd ?? 0), 0);
    const avgLatency = logs.length
      ? Math.round(logs.reduce((sum, log) => sum + log.latency_ms, 0) / logs.length)
      : 0;
    return { totalTokens, totalCost, avgLatency };
  }, [logs]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            LLM Call Logs
          </CardTitle>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={`/logs?run_id=${run.id}`}>
              Open full log explorer
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          All LLM calls, tool invocations, costs, and latencies for this run are available in the
          full log explorer. Click{' '}
          <Link
            href={`/logs?run_id=${run.id}`}
            className="text-brand-600 hover:underline font-medium"
          >
            Open full log explorer
          </Link>{' '}
          to filter, search, and inspect every provider call.
        </p>
        <div className="mt-4 rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground font-mono">
          <p className="mb-1 text-foreground font-semibold text-[11px]">Quick stats</p>
          <p>Total calls: {logs.length.toLocaleString()}</p>
          <p>Total tokens: {stats.totalTokens.toLocaleString()}</p>
          <p>Estimated cost: ${stats.totalCost.toFixed(4)}</p>
          <p>Avg latency: {stats.avgLatency.toLocaleString()}ms</p>
        </div>
      </CardContent>
    </Card>
  );
}
