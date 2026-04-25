import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, ScrollText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Run } from '@/lib/types/run';

interface SessionLogsTabProps {
  run: Run;
}

export function SessionLogsTab({ run }: SessionLogsTabProps) {
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
          <p className="mb-1 text-foreground font-semibold text-[11px]">Quick stats (placeholder)</p>
          <p>Total calls: —</p>
          <p>Total tokens: —</p>
          <p>Estimated cost: —</p>
          <p>Avg latency: —</p>
        </div>
      </CardContent>
    </Card>
  );
}
