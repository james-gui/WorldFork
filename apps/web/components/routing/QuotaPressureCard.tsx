'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useLogs } from '@/lib/api/logs';
import { useRateLimits } from '@/lib/api/settings';

interface ProviderQuota {
  name: string;
  used: number; // percentage 0–100
  tokens: number;
  capacity: number;
}

export function QuotaPressureCard() {
  const { data: logs = [] } = useLogs({ limit: 1000 });
  const { data: rateLimits } = useRateLimits();

  const rows = React.useMemo<ProviderQuota[]>(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const tokensByProvider = new Map<string, number>();
    for (const log of logs) {
      const createdAt = new Date(log.created_at);
      if (Number.isNaN(createdAt.getTime()) || createdAt < start) continue;
      tokensByProvider.set(log.provider, (tokensByProvider.get(log.provider) ?? 0) + log.total_tokens);
    }

    return (rateLimits?.rate_limits ?? []).map((limit) => {
      const tokens = tokensByProvider.get(limit.provider) ?? 0;
      const capacity = Math.max(0, limit.tpm_limit * 60 * 24);
      const used = capacity > 0 ? Math.min(100, Math.round((tokens / capacity) * 100)) : 0;
      return {
        name: limit.provider,
        used,
        tokens,
        capacity,
      };
    });
  }, [logs, rateLimits]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Quota Pressure</CardTitle>
        <p className="text-xs text-muted-foreground">Tokens used today vs configured TPM capacity</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((p) => (
          <div key={p.name} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{p.name}</span>
              <span
                className={`font-mono font-medium ${
                  p.used >= 80
                    ? 'text-red-600'
                    : p.used >= 60
                    ? 'text-yellow-600'
                    : 'text-foreground'
                }`}
              >
                {p.used}%
              </span>
            </div>
            <Progress
              value={p.used}
              className="h-1.5"
            />
            <p className="text-[10px] text-muted-foreground font-mono">
              {p.tokens.toLocaleString()} / {p.capacity.toLocaleString()} tokens
            </p>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No provider rate limits have been configured.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
