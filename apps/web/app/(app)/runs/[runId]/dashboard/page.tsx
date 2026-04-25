'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { LiveSocialFeed } from '@/components/dashboard/LiveSocialFeed';
import { EmotionTrendChart } from '@/components/dashboard/EmotionTrendChart';
import { TickScrubber } from '@/components/dashboard/TickScrubber';
import {
  EMOTIONS,
  EMOTION_COLORS,
  type EmotionTrendPoint,
  type SocialPost,
} from '@/lib/dashboard/types';
import { useExportRun, useRun } from '@/lib/api/runs';
import { useStepUniverse, useTickArtifact, useUniverse } from '@/lib/api/universes';
import { BarChart3, Play } from 'lucide-react';
import { toast } from 'sonner';

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function metricValue(metrics: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return fallback;
}

function toEmotionPoint(row: Record<string, number>, index: number): EmotionTrendPoint {
  return {
    tick: asNumber(row.tick, index + 1),
    Hope: asNumber(row.Hope ?? row.hope),
    Fear: asNumber(row.Fear ?? row.fear),
    Anger: asNumber(row.Anger ?? row.anger),
    Joy: asNumber(row.Joy ?? row.joy),
    Sadness: asNumber(row.Sadness ?? row.sadness),
    Trust: asNumber(row.Trust ?? row.trust),
    Disgust: asNumber(row.Disgust ?? row.disgust),
    Surprise: asNumber(row.Surprise ?? row.surprise),
  };
}

function emotionDonutData(trends: EmotionTrendPoint[]) {
  if (!trends.length) return undefined;
  const last = trends[trends.length - 1];
  return EMOTIONS.map((emotion) => ({
    name: emotion,
    value: +last[emotion].toFixed(2),
    color: EMOTION_COLORS[emotion],
  }));
}

function postFromRaw(raw: Record<string, unknown>, index: number): SocialPost {
  const reactions = raw.reactions && typeof raw.reactions === 'object'
    ? Object.entries(raw.reactions as Record<string, unknown>).map(([kind, count]) => ({
        kind,
        count: asNumber(count),
      }))
    : [];
  const actor = String(raw.author_actor_id ?? raw.author_id ?? 'unknown-actor');
  return {
    id: String(raw.post_id ?? `post-${index}`),
    authorName: actor,
    authorRole: actor.startsWith('hero') ? 'hero' : 'cohort',
    archetype: String(raw.author_avatar_id ?? raw.platform ?? 'simulation'),
    avatarColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444'][index % 4],
    timestamp: `T${String(raw.tick_created ?? '')}`,
    content: String(raw.content ?? ''),
    reactions,
  };
}

export default function RunDashboardPage({
  params,
}: {
  params: { runId: string };
}) {
  const { data: run } = useRun(params.runId);
  const exportRun = useExportRun();
  const [tick, setTick] = React.useState(0);
  const step = useStepUniverse();
  const rootUniverseId = run?.root_universe_id;
  const { data: rootUniverse } = useUniverse(rootUniverseId);
  const { data: tickArtifact } = useTickArtifact(rootUniverseId, tick);
  const latestMetrics = rootUniverse?.latest_metrics ?? run?.latest_metrics ?? {};
  const emotionTrends = React.useMemo(
    () => (tickArtifact?.emotion_trends ?? []).map(toEmotionPoint),
    [tickArtifact],
  );
  const posts = React.useMemo(
    () => (tickArtifact?.social_posts ?? []).map(postFromRaw),
    [tickArtifact],
  );
  const emotionDonut = React.useMemo(
    () => emotionDonutData(emotionTrends),
    [emotionTrends],
  );

  React.useEffect(() => {
    if (rootUniverse) setTick(rootUniverse.current_tick);
  }, [rootUniverse]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Simulation Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {run?.display_name ?? 'Live multiverse run'} - {params.runId}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/runs/${params.runId}/results`}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Results
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              exportRun.mutate(params.runId, {
                onSuccess: (result) =>
                  toast.success('Export queued', {
                    description: `Job ${result.job_id}`,
                  }),
                onError: (err) =>
                  toast.error('Export failed to queue', {
                    description: err.message,
                  }),
              })
            }
            disabled={exportRun.isPending}
          >
            Export Run
          </Button>
          <Button
            onClick={() => {
              if (!rootUniverseId) return;
              step.mutate({ uid: rootUniverseId, tick: tick + 1 }, {
                onSuccess: (result) => setTick(result.tick),
              });
            }}
            disabled={step.isPending || !rootUniverseId}
          >
            <Play className="mr-2 h-4 w-4" />
            Step Tick
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Active Cohorts"
          value={rootUniverse?.active_cohort_count ?? '-'}
          subtitle="Current root universe"
          sparkColor="#10b981"
        />
        <KpiCard
          title="Current Tick"
          value={rootUniverse?.current_tick ?? tick}
          subtitle={`${run?.max_ticks ?? '-'} max ticks`}
          sparkColor="#f59e0b"
        />
        <KpiCard
          title="Universes"
          value={run?.total_universe_count ?? '-'}
          subtitle={`${run?.active_universe_count ?? 0} active`}
          sparkColor="#6366f1"
        />
        <KpiCard
          title="Volatility"
          value={metricValue(latestMetrics, ['volatility', 'divergence_vs_parent', 'mobilization_risk']).toFixed(2)}
          subtitle="Latest root metric"
          donut={emotionDonut}
          donutCenterLabel="EM"
        />
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Emotion Trends</h2>
                <p className="text-xs text-muted-foreground">
                  Cohort average emotional state over recent ticks.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Tick</span>
                <span className="font-mono text-foreground">{tick}</span>
              </div>
            </div>
            <EmotionTrendChart data={emotionTrends} height={300} />
          </Card>

          <Card className="p-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tick
            </div>
            <TickScrubber totalTicks={run?.max_ticks ?? 1} currentTick={tick} onChange={setTick} />
          </Card>
        </div>

        <LiveSocialFeed posts={posts} height={560} />
      </div>
    </div>
  );
}
