'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

interface Alert {
  id: string;
  provider: string;
  message: string;
  time: string;
  severity: 'warning' | 'error';
}

const STUB_ALERTS: Alert[] = [
  {
    id: '1',
    provider: 'OpenRouter',
    message: 'RPM limit hit on cohort_decision (429)',
    time: '3 min ago',
    severity: 'warning',
  },
  {
    id: '2',
    provider: 'OpenRouter',
    message: 'TPM quota at 95% — auto-fallback triggered',
    time: '12 min ago',
    severity: 'error',
  },
  {
    id: '3',
    provider: 'OpenRouter',
    message: 'God-review job queued behind rate limit',
    time: '28 min ago',
    severity: 'warning',
  },
];

export function AlertsCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">Alerts</CardTitle>
          <Badge variant="destructive" className="text-xs">
            {STUB_ALERTS.length}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">Recent rate-limit events</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {STUB_ALERTS.map((alert) => (
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

        {STUB_ALERTS.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No recent alerts.</p>
        )}
      </CardContent>
    </Card>
  );
}
