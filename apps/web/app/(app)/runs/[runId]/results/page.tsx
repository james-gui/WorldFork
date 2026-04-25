'use client';

import * as React from 'react';
import Link from 'next/link';
import { RefreshCcw, TableProperties } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRegenerateRunResults, useRun, useRunResults } from '@/lib/api/runs';

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'None';
  if (typeof value === 'number') return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(3);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function label(value: string) {
  return value.replaceAll('_', ' ');
}

function statusVariant(status?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'failed') return 'destructive';
  if (status === 'not_started' || status === 'pending') return 'outline';
  if (status === 'succeeded' || status === 'completed') return 'default';
  return 'secondary';
}

export default function RunResultsPage({ params }: { params: { runId: string } }) {
  const { data: run } = useRun(params.runId);
  const { data: results, isLoading } = useRunResults(params.runId);
  const regenerate = useRegenerateRunResults();

  const handleRegenerate = async () => {
    try {
      const response = await regenerate.mutateAsync(params.runId);
      toast.success('Results aggregation queued', { description: response.job_id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to queue results aggregation.');
    }
  };

  const metrics = Object.entries(results?.metrics ?? {}).slice(0, 8);
  const classifications = Object.entries(results?.classifications ?? {});
  const clusters = results?.branch_clusters ?? [];
  const outcomes = results?.universe_outcomes ?? [];
  const highlights = results?.timeline_highlights ?? [];

  return (
    <div className="mx-auto flex max-w-screen-xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Run Results</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {run?.display_name ?? params.runId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/runs/${params.runId}`}>Run Detail</Link>
          </Button>
          <Button type="button" size="sm" className="gap-1.5" onClick={handleRegenerate} disabled={regenerate.isPending}>
            <RefreshCcw className="h-3.5 w-3.5" />
            Regenerate
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading results...</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(results?.status)}>{results?.status ?? 'not_started'}</Badge>
                {results?.model_used && <Badge variant="outline">{results.provider}/{results.model_used}</Badge>}
                {results?.generated_at && (
                  <span className="text-xs text-muted-foreground">{new Date(results.generated_at).toLocaleString()}</span>
                )}
              </div>
              <p className="max-w-4xl text-sm leading-6">
                {results?.summary || 'No results aggregation has been generated for this run yet.'}
              </p>
              {results?.error && <p className="text-sm text-destructive">{results.error}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        {metrics.length ? metrics.map(([key, value]) => (
          <Card key={key}>
            <CardContent className="p-4">
              <p className="text-xs capitalize text-muted-foreground">{label(key)}</p>
              <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{formatValue(value)}</p>
            </CardContent>
          </Card>
        )) : (
          <Card className="md:col-span-4">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Metrics will appear after aggregation succeeds.
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="classifications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="classifications">Classifications</TabsTrigger>
          <TabsTrigger value="clusters">Branch Clusters</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="universes">Universes</TabsTrigger>
        </TabsList>

        <TabsContent value="classifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Outcome Classification</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {classifications.map(([key, value]) => (
                <div key={key} className="grid grid-cols-[220px_1fr] gap-4 py-3 text-sm">
                  <span className="capitalize text-muted-foreground">{label(key)}</span>
                  <span>{formatValue(value)}</span>
                </div>
              ))}
              {!classifications.length && <p className="text-sm text-muted-foreground">No classifications generated yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clusters" className="grid gap-3 md:grid-cols-2">
          {clusters.map((cluster, index) => (
            <Card key={String(cluster.cluster ?? index)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TableProperties className="h-4 w-4" />
                  {formatValue(cluster.cluster ?? `Cluster ${index + 1}`)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {Object.entries(cluster).map(([key, value]) => (
                  <p key={key}><span className="text-muted-foreground">{label(key)}:</span> {formatValue(value)}</p>
                ))}
              </CardContent>
            </Card>
          ))}
          {!clusters.length && <p className="text-sm text-muted-foreground">No branch clusters generated yet.</p>}
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Outcome Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {highlights.map((item, index) => (
                <div key={`${item.tick ?? index}-${item.title ?? index}`} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{formatValue(item.title ?? `Highlight ${index + 1}`)}</span>
                    <Badge variant="outline">T{formatValue(item.tick)}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{formatValue(item.description ?? item.summary)}</p>
                </div>
              ))}
              {!highlights.length && <p className="text-sm text-muted-foreground">No timeline highlights generated yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="universes" className="grid gap-3 lg:grid-cols-2">
          {outcomes.map((outcome, index) => (
            <Card key={String(outcome.universe_id ?? index)}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-mono">{formatValue(outcome.universe_id ?? `universe-${index + 1}`)}</span>
                  <Badge variant={statusVariant(String(outcome.status ?? ''))}>{formatValue(outcome.status)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p><span className="text-muted-foreground">Outcome:</span> {formatValue(outcome.outcome_label)}</p>
                <p><span className="text-muted-foreground">Tick:</span> {formatValue(outcome.current_tick)}</p>
                <p><span className="text-muted-foreground">Depth:</span> {formatValue(outcome.branch_depth)}</p>
                <Separator />
                <pre className="max-h-48 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
                  {JSON.stringify(outcome.metrics ?? {}, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
          {!outcomes.length && <p className="text-sm text-muted-foreground">No universe outcomes generated yet.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
