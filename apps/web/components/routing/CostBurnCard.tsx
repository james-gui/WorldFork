'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useLogs } from '@/lib/api/logs';
import { useRouting } from '@/lib/api/settings';

export function CostBurnCard() {
  const { data: logs = [] } = useLogs({ limit: 1000 });
  const { data: routing } = useRouting();

  const spentToday = React.useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return logs.reduce((sum, row) => {
      const createdAt = new Date(row.created_at);
      if (Number.isNaN(createdAt.getTime()) || createdAt < start) return sum;
      return sum + (row.cost_usd ?? 0);
    }, 0);
  }, [logs]);

  const dailyBudget = React.useMemo(() => {
    return (routing?.entries ?? []).reduce((sum, row) => sum + (row.daily_budget_usd ?? 0), 0);
  }, [routing]);

  const percent = dailyBudget > 0 ? Math.min(100, Math.round((spentToday / dailyBudget) * 100)) : 0;
  const remaining = dailyBudget > 0 ? Math.max(0, dailyBudget - spentToday) : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Cost Burn</CardTitle>
        <p className="text-xs text-muted-foreground">USD spent today vs daily budget</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-1.5">
          <span className="text-2xl font-bold tabular-nums">
            ${spentToday.toFixed(2)}
          </span>
          <span className="text-xs text-muted-foreground mb-1">
            {dailyBudget > 0 ? `/ $${dailyBudget.toFixed(2)} budget` : '/ no budget set'}
          </span>
        </div>

        <Progress
          value={percent}
          className="h-2"
        />

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{percent}% used</span>
          <span
            className={
              percent >= 90
                ? 'text-red-600 font-medium'
                : percent >= 75
                ? 'text-yellow-600 font-medium'
                : ''
            }
          >
            {remaining === null ? 'Set per-job budgets' : `$${remaining.toFixed(2)} remaining`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
