'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface ProviderQuota {
  name: string;
  used: number; // percentage 0–100
  color: string;
}

const QUOTA_DATA: ProviderQuota[] = [
  { name: 'OpenRouter', used: 68, color: 'bg-blue-500' },
  { name: 'OpenAI', used: 12, color: 'bg-green-500' },
  { name: 'Anthropic', used: 5, color: 'bg-purple-500' },
  { name: 'Ollama', used: 0, color: 'bg-gray-400' },
];

export function QuotaPressureCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Quota Pressure</CardTitle>
        <p className="text-xs text-muted-foreground">Daily token budget used per provider</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {QUOTA_DATA.map((p) => (
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
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
