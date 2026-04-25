'use client';

import * as React from 'react';
import { KeyMetricsRow } from '@/components/review/KeyMetricsRow';
import { ParsedDecisionCard } from '@/components/review/ParsedDecisionCard';
import { PromptSummaryCard } from '@/components/review/PromptSummaryCard';
import { ReviewHeader } from '@/components/review/ReviewHeader';
import { ReviewPlaybackControls } from '@/components/review/ReviewPlaybackControls';
import { SociologyGraphSnapshot } from '@/components/review/SociologyGraphSnapshot';
import { TickTimelineRail } from '@/components/review/TickTimelineRail';
import { ToolCallsList } from '@/components/review/ToolCallsList';
import { EmotionTrendsReview } from '@/components/review/EmotionTrendsReview';
import { TracePanel } from '@/components/trace/TracePanel';
import { useTickArtifact, useUniverse } from '@/lib/api/universes';
import { useReviewUIStore } from '@/lib/state/reviewUiStore';

export default function ReviewPage({
  params,
}: {
  params: { runId: string; universeId: string };
}) {
  const tick = useReviewUIStore((s) => s.tick);
  const setTick = useReviewUIStore((s) => s.setTick);
  const paused = useReviewUIStore((s) => s.paused);
  const setPaused = useReviewUIStore((s) => s.setPaused);
  const togglePaused = useReviewUIStore((s) => s.togglePaused);
  const [speed, setSpeed] = React.useState(1);
  const initializedTickRef = React.useRef(false);
  const { data: universe } = useUniverse(params.universeId);
  const { data, error, isLoading, refetch } = useTickArtifact(params.universeId, tick);

  const maxTick = Math.max(universe?.current_tick ?? 0, tick, 0);
  const timeline = React.useMemo(
    () => Array.from({ length: maxTick + 1 }, (_, index) => ({
      tick: index,
      summary: `Tick ${index} artifact`,
      status: 'normal' as const,
    })),
    [maxTick],
  );

  React.useEffect(() => {
    if (initializedTickRef.current || !universe || universe.current_tick <= 0) {
      return;
    }
    initializedTickRef.current = true;
    if (useReviewUIStore.getState().tick === 0) {
      setTick(universe.current_tick);
      setPaused(true);
    }
  }, [setPaused, setTick, universe]);

  React.useEffect(() => {
    if (paused) return;
    if (tick >= maxTick) {
      setPaused(true);
      return;
    }

    const interval = window.setInterval(() => {
      const nextTick = Math.min(maxTick, useReviewUIStore.getState().tick + 1);
      setTick(nextTick);
      if (nextTick >= maxTick) {
        setPaused(true);
      }
    }, Math.max(250, 1000 / speed));

    return () => window.clearInterval(interval);
  }, [maxTick, paused, setPaused, setTick, speed, tick]);

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] flex-col">
      <ReviewHeader
        runId={params.runId}
        universeId={params.universeId}
        currentTick={tick}
        maxTick={maxTick}
        onTickChange={setTick}
        onReload={() => refetch()}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_320px] gap-4 p-4">
        <TickTimelineRail ticks={timeline} currentTick={tick} onSelect={setTick} />
        {data ? (
          <>
            <div className="min-h-0 space-y-4 overflow-y-auto">
              <KeyMetricsRow metrics={data.metrics} />
              <EmotionTrendsReview data={data.emotion_trends} currentTick={tick} />
              <SociologyGraphSnapshot tick={tick} />
            </div>
            <div className="min-h-0 space-y-4 overflow-y-auto">
              <PromptSummaryCard summary={data.prompt_summary} />
              <ToolCallsList toolCalls={data.tool_calls} />
              <ParsedDecisionCard decision={data.parsed_decisions?.[0] ?? {}} height="260px" />
              <TracePanel universeId={params.universeId} tick={tick} includeRaw compact />
            </div>
          </>
        ) : (
          <div className="col-span-2 flex items-center justify-center rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            {isLoading ? 'Loading tick artifact...' : error ? 'Tick artifact is unavailable.' : 'No tick artifact is available yet.'}
          </div>
        )}
      </div>

      <ReviewPlaybackControls
        paused={paused}
        onTogglePaused={togglePaused}
        onStepBack={() => setTick(Math.max(0, tick - 1))}
        onStepForward={() => setTick(Math.min(maxTick, tick + 1))}
        onJumpStart={() => setTick(0)}
        onJumpEnd={() => setTick(maxTick)}
        speed={speed}
        onSpeedChange={setSpeed}
      />
    </div>
  );
}
