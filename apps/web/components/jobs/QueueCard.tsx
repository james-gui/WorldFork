'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface QueueInfo {
  name: string;
  priority: string;
  depth: number;
  workers: number;
  paused: boolean;
}

interface QueueCardProps {
  queue: QueueInfo;
  onTogglePause?: (name: string, paused: boolean) => void;
}

const QUEUE_COLORS: Record<string, string> = {
  P0: 'bg-red-500',
  P1: 'bg-orange-500',
  P2: 'bg-yellow-500',
  P3: 'bg-green-500',
  Dead: 'bg-gray-500',
};

export function QueueCard({ queue, onTogglePause }: QueueCardProps) {
  const [paused, setPaused] = useState(queue.paused);

  useEffect(() => {
    setPaused(queue.paused);
  }, [queue.paused]);

  function handleToggle() {
    const next = !paused;
    setPaused(next);
    onTogglePause?.(queue.name, next);
  }

  return (
    <Card className="mb-2 last:mb-0">
      <CardContent className="p-3 flex items-center gap-3">
        {/* Priority dot */}
        <div
          className={cn(
            'h-2 w-2 rounded-full flex-shrink-0',
            QUEUE_COLORS[queue.priority] ?? 'bg-gray-400',
          )}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{queue.name}</span>
            <Badge variant="secondary" className="text-[10px] px-1 py-0">
              {queue.priority}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {queue.depth} in queue · {queue.workers} worker{queue.workers !== 1 ? 's' : ''}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={handleToggle}
          title={paused ? 'Resume' : 'Pause'}
        >
          {paused ? (
            <Play className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Pause className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
