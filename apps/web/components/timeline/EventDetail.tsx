'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SubAgentRationale {
  influence: string;
  anchorSetup: string;
  effects: string[];
  rationale: string;
}

interface EventDetailProps {
  title: string;
  tick: number;
  type: string;
  description: string;
  subAgentRationale?: SubAgentRationale;
}

export function EventDetail({
  title,
  tick,
  type,
  description,
  subAgentRationale,
}: EventDetailProps) {
  return (
    <Card className="text-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {type}
          </Badge>
          <Badge variant="outline" className="text-xs ml-auto">
            T-{tick}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>

      {subAgentRationale && (
        <CardContent className="space-y-2 pt-0">
          <div className="rounded-md bg-muted/60 p-2 space-y-1.5">
            <p className="text-xs font-semibold text-foreground">
              God Agent Intervention
            </p>

            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
              <span className="text-muted-foreground font-medium">Influence</span>
              <span>{subAgentRationale.influence}</span>
              <span className="text-muted-foreground font-medium">Anchor Setup</span>
              <span>{subAgentRationale.anchorSetup}</span>
            </div>

            {subAgentRationale.effects.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-0.5">Effects</p>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  {subAgentRationale.effects.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Sub-agent rationale snippet */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Sub-agent Rationale
            </p>
            <pre className="text-xs bg-muted rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
              {JSON.stringify({ rationale: subAgentRationale.rationale }, null, 2)}
            </pre>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
