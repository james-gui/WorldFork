'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { useErrorLogs, useLogs } from '@/lib/api/logs';

interface Alert {
  id: string;
  provider: string;
  message: string;
  time: string;
  severity: 'warning' | 'error';
}

function timeAgo(value?: string | null) {
  if (!value) return 'time unavailable';
  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) return 'time unavailable';
  const minutes = Math.max(0, Math.round((Date.now() - createdAt) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function AlertsCard() {
  const { data: errors = [] } = useErrorLogs({ limit: 20 });
  const { data: logs = [] } = useLogs({ limit: 200 });

  const alerts = React.useMemo<Alert[]>(() => {
    const llmFailures = logs
      .filter((log) => log.status !== 'success' || log.error)
      .slice(0, 5)
      .map((log) => ({
        id: log.call_id,
        provider: log.provider,
        message: log.error || `${log.job_type} returned ${log.status}`,
        time: timeAgo(log.created_at),
        severity: log.error ? 'error' as const : 'warning' as const,
      }));

    const jobErrors = errors.slice(0, 5).map((error) => ({
      id: `${error.source}:${error.id}`,
      provider: error.provider || error.job_type || error.source,
      message: error.error || `${error.source} ${error.status}`,
      time: timeAgo(error.created_at),
      severity: 'error' as const,
    }));

    return [...jobErrors, ...llmFailures].slice(0, 5);
  }, [errors, logs]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">Alerts</CardTitle>
          <Badge variant="destructive" className="text-xs">
            {alerts.length}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">Recent rate-limit events</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start gap-2 rounded-md border border-border p-2"
          >
            <AlertTriangle
              className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${
                alert.severity === 'error' ? 'text-red-500' : 'text-yellow-500'
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium leading-snug">{alert.provider}</p>
              <p className="text-xs text-muted-foreground leading-snug">{alert.message}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{alert.time}</p>
            </div>
          </div>
        ))}

        {alerts.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No recent alerts.</p>
        )}
      </CardContent>
    </Card>
  );
}
