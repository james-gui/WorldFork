'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Inbox } from 'lucide-react';

interface IngestionStatusCardProps {
  queueDepth?: number;
  lastSync?: string;
  successRate?: number;
}

export function IngestionStatusCard({
  queueDepth = 12,
  lastSync = '2 min ago',
  successRate = 98.4,
}: IngestionStatusCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          Ingestion Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Queue depth</span>
          <span className="font-semibold">{queueDepth}</span>
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Last sync</span>
          <span className="font-medium">{lastSync}</span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Success rate</span>
            <span className="font-medium">{successRate}%</span>
          </div>
          <Progress value={successRate} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  );
}
