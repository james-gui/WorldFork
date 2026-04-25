'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QueueCard, type QueueInfo } from './QueueCard';

const MOCK_QUEUES: QueueInfo[] = [
  { name: 'simulate:p0', priority: 'P0', depth: 4, workers: 4, paused: false },
  { name: 'agent:p1',    priority: 'P1', depth: 18, workers: 8, paused: false },
  { name: 'memory:p2',   priority: 'P2', depth: 7, workers: 4, paused: false },
  { name: 'export:p3',   priority: 'P3', depth: 2, workers: 2, paused: false },
  { name: 'dead_letter', priority: 'Dead', depth: 32, workers: 0, paused: true },
];

interface QueuesPanelProps {
  queues?: QueueInfo[];
  onTogglePause?: (name: string, paused: boolean) => void;
}

export function QueuesPanel({ queues = MOCK_QUEUES, onTogglePause }: QueuesPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Queues</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        {queues.map((q) => (
          <QueueCard key={q.name} queue={q} onTogglePause={onTogglePause} />
        ))}
      </CardContent>
    </Card>
  );
}
