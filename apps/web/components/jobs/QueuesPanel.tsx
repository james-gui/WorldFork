'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QueueCard, type QueueInfo } from './QueueCard';

interface QueuesPanelProps {
  queues?: QueueInfo[];
  onTogglePause?: (name: string, paused: boolean) => void;
}

export function QueuesPanel({ queues = [], onTogglePause }: QueuesPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Queues</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        {queues.length > 0 ? (
          queues.map((q) => (
            <QueueCard key={q.name} queue={q} onTogglePause={onTogglePause} />
          ))
        ) : (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No queue activity reported.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
