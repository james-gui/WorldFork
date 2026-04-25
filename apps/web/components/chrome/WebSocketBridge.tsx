'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useWebSocketSubscription } from '@/lib/ws/hooks';

/**
 * Mounts WebSocket subscription for the current run's universe updates.
 * Placed in the (app) layout so it activates whenever a runId is in the route.
 */
export function WebSocketBridge() {
  const params = useParams<{ runId?: string; uid?: string }>();
  const runId = params?.runId;
  const uid = params?.uid;

  useWebSocketSubscription('runs', runId);
  useWebSocketSubscription('universes', uid);

  return null;
}
