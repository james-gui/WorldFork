'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const DAILY_BUDGET = 150; // USD
const SPENT_TODAY = 112.45; // USD stub
const PERCENT = Math.round((SPENT_TODAY / DAILY_BUDGET) * 100);

export function CostBurnCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Cost Burn</CardTitle>
        <p className="text-xs text-muted-foreground">USD spent today vs daily budget</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-1.5">
          <span className="text-2xl font-bold tabular-nums">
            ${SPENT_TODAY.toFixed(2)}
          </span>
          <span className="text-xs text-muted-foreground mb-1">
            / ${DAILY_BUDGET.toFixed(2)} budget
          </span>
        </div>

        <Progress
          value={PERCENT}
          className="h-2"
        />

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{PERCENT}% used</span>
          <span
            className={
              PERCENT >= 90
                ? 'text-red-600 font-medium'
                : PERCENT >= 75
                ? 'text-yellow-600 font-medium'
                : ''
            }
          >
            ${(DAILY_BUDGET - SPENT_TODAY).toFixed(2)} remaining
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
