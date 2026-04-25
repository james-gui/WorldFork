'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { JsonViewer } from '@/components/code/JsonViewer';
import { useTickTrace } from '@/lib/api/universes';

function json(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function TracePanel({
  universeId,
  tick,
  includeRaw = false,
  compact = false,
}: {
  universeId?: string;
  tick?: number;
  includeRaw?: boolean;
  compact?: boolean;
}) {
  const { data, isLoading } = useTickTrace(universeId, tick, includeRaw);
  const [actorId, setActorId] = React.useState<string>('');
  const actors = React.useMemo(() => data?.actors ?? [], [data?.actors]);

  React.useEffect(() => {
    if (!actors.length) {
      setActorId('');
      return;
    }
    if (!actorId || !actors.some((actor) => actor.actor_id === actorId)) {
      setActorId(actors[0].actor_id);
    }
  }, [actorId, actors]);

  const actor = actors.find((item) => item.actor_id === actorId) ?? actors[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm">Trace</CardTitle>
          {data?.redactions_applied && (
            <Badge variant="outline" className="text-[10px]">redacted</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading trace...</p>
        ) : !data || actors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trace artifacts found for this tick.</p>
        ) : (
          <>
            <Select value={actor?.actor_id ?? ''} onValueChange={setActorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select actor" />
              </SelectTrigger>
              <SelectContent>
                {actors.map((item) => (
                  <SelectItem key={`${item.actor_kind}:${item.actor_id}`} value={item.actor_id}>
                    {item.actor_kind}: {item.actor_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Tabs defaultValue="parsed">
              <TabsList className="grid grid-cols-4">
                <TabsTrigger value="parsed">Parsed</TabsTrigger>
                <TabsTrigger value="prompt">Prompt</TabsTrigger>
                <TabsTrigger value="tools">Tools</TabsTrigger>
                <TabsTrigger value="state">State</TabsTrigger>
              </TabsList>
              <TabsContent value="parsed" className="mt-3 overflow-hidden rounded border">
                <JsonViewer value={json({
                  parsed_json: actor?.parsed_json,
                  rationale: actor?.rationale,
                  self_ratings: actor?.self_ratings,
                  raw_response: includeRaw ? actor?.raw_response : undefined,
                })} height={compact ? '260px' : '360px'} />
              </TabsContent>
              <TabsContent value="prompt" className="mt-3 overflow-hidden rounded border">
                <JsonViewer value={json({
                  prompt_packet: actor?.prompt_packet,
                  visible_feed: actor?.visible_feed,
                  visible_events: actor?.visible_events,
                  retrieved_memory: actor?.retrieved_memory,
                })} height={compact ? '260px' : '360px'} />
              </TabsContent>
              <TabsContent value="tools" className="mt-3 overflow-hidden rounded border">
                <JsonViewer value={json(actor?.tool_calls ?? [])} height={compact ? '260px' : '360px'} />
              </TabsContent>
              <TabsContent value="state" className="mt-3 overflow-hidden rounded border">
                <JsonViewer value={json({
                  state_before: actor?.state_before,
                  state_after: actor?.state_after,
                  state_delta: actor?.state_delta,
                })} height={compact ? '260px' : '360px'} />
              </TabsContent>
            </Tabs>
            {!!data.missing_artifacts.length && (
              <p className="text-xs text-muted-foreground">
                Missing: {data.missing_artifacts.join(', ')}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
