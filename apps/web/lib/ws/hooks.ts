'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wsClient } from './client';

// Backend WS endpoints:
//   WS /ws/runs/{run_id}        → channel run:{run_id}
//   WS /ws/universes/{uid}      → channel universe:{uid}
//   WS /ws/jobs                 → channel jobs:global
//
// Backend event envelope: { type: string, ts: string, payload: {...} }
// Event types emitted by websockets_publishers.py:
//   tick.completed, tick.started
//   branch.created, branch.frozen, branch.killed
//   run.status_changed, metrics.updated
//   social_post.created, event.scheduled
//   cohort.split, cohort.merge
//   god.decision
//   job.enqueued, job.started, job.completed, job.failed
//   queue.depth, worker.status

type Channel = 'runs' | 'universes' | 'jobs';

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000';

/**
 * Map backend event type → TanStack Query invalidations.
 */
function applyTopicEffect(
  qc: ReturnType<typeof useQueryClient>,
  msg: Record<string, unknown>
) {
  // Backend envelope shape: { type, ts, payload }
  const eventType = (msg.type ?? '') as string;
  const payload = (msg.payload ?? msg) as Record<string, unknown>;

  switch (eventType) {
    case 'tick.completed':
    case 'tick.started': {
      const uid = payload.universe_id as string | undefined;
      const runId = payload.run_id as string | undefined;
      if (uid) {
        qc.invalidateQueries({ queryKey: ['ticks', uid] });
        qc.invalidateQueries({ queryKey: ['universe', uid] });
      }
      if (runId) {
        qc.invalidateQueries({ queryKey: ['run', runId] });
      }
      break;
    }

    case 'metrics.updated': {
      const uid = payload.universe_id as string | undefined;
      const runId = payload.run_id as string | undefined;
      if (uid) qc.invalidateQueries({ queryKey: ['universe', uid] });
      if (runId) qc.invalidateQueries({ queryKey: ['run', runId] });
      break;
    }

    case 'branch.created':
    case 'branch.frozen':
    case 'branch.killed': {
      const uid =
        (payload.universe_id as string | undefined) ??
        (payload.parent_universe_id as string | undefined) ??
        (payload.child_universe_id as string | undefined);
      const runId = payload.run_id as string | undefined;
      if (uid) qc.invalidateQueries({ queryKey: ['lineage', uid] });
      if (runId) qc.invalidateQueries({ queryKey: ['multiverseTree', runId] });
      qc.invalidateQueries({ queryKey: ['multiverseTree'] });
      break;
    }

    case 'run.status_changed': {
      const runId = payload.run_id as string | undefined;
      if (runId) {
        qc.invalidateQueries({ queryKey: ['run', runId] });
        qc.invalidateQueries({ queryKey: ['runs'] });
        qc.invalidateQueries({ queryKey: ['multiverseTree', runId] });
      }
      break;
    }

    case 'cohort.split':
    case 'cohort.merge': {
      const uid = payload.universe_id as string | undefined;
      if (uid) qc.invalidateQueries({ queryKey: ['universe', uid] });
      break;
    }

    case 'god.decision': {
      const uid = payload.universe_id as string | undefined;
      const runId = payload.run_id as string | undefined;
      if (uid) {
        qc.invalidateQueries({ queryKey: ['universe', uid] });
        qc.invalidateQueries({ queryKey: ['ticks', uid] });
      }
      if (runId) qc.invalidateQueries({ queryKey: ['run', runId] });
      break;
    }

    case 'job.enqueued':
    case 'job.started':
    case 'job.completed':
    case 'job.failed': {
      const jobId = payload.job_id as string | undefined;
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['queues'] });
      if (jobId) qc.invalidateQueries({ queryKey: ['job', jobId] });
      break;
    }

    case 'queue.depth':
    case 'worker.status': {
      qc.invalidateQueries({ queryKey: ['queues'] });
      qc.invalidateQueries({ queryKey: ['workers'] });
      break;
    }

    // ping heartbeat — ignore
    case 'ping':
      break;

    default:
      break;
  }
}

export function useWebSocketSubscription(channel: Channel, id?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!wsClient) return;

    let url: string;
    if (channel === 'jobs') {
      url = `${WS_BASE}/ws/jobs`;
    } else if (channel === 'runs' && id) {
      url = `${WS_BASE}/ws/runs/${id}`;
    } else if (channel === 'universes' && id) {
      url = `${WS_BASE}/ws/universes/${id}`;
    } else {
      return;
    }

    wsClient.connect(url);

    const unsubscribe = wsClient.subscribe('*', (msg: unknown) => {
      applyTopicEffect(qc, msg as Record<string, unknown>);
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, id]);
}
