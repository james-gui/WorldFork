'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { TimelineEvent } from './EventMarker';

interface CohortRow {
  id: string;
  name: string;
  population: number;
  dominantEmotion: string;
  stance: string;
}

interface SocialPost {
  id: string;
  author: string;
  content: string;
  tick: number;
  amplification: number;
}

interface LogEntry {
  id: string;
  tick: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

interface TimelineTabsProps {
  events: TimelineEvent[];
  cohorts: CohortRow[];
  posts: SocialPost[];
  logs: LogEntry[];
}

const LEVEL_CLASS: Record<string, string> = {
  info: 'text-blue-600',
  warn: 'text-yellow-600',
  error: 'text-rose-600',
};

export function TimelineTabs({ events, cohorts, posts, logs }: TimelineTabsProps) {
  return (
    <Tabs defaultValue="events" className="w-full">
      <TabsList className="h-8">
        <TabsTrigger value="events" className="text-xs">Events</TabsTrigger>
        <TabsTrigger value="cohorts" className="text-xs">Cohorts</TabsTrigger>
        <TabsTrigger value="feed" className="text-xs">Social Feed</TabsTrigger>
        <TabsTrigger value="logs" className="text-xs">Logs</TabsTrigger>
        <TabsTrigger value="memory" className="text-xs">Memory</TabsTrigger>
      </TabsList>

      {/* Events */}
      <TabsContent value="events" className="mt-2">
        <div className="rounded-md border overflow-auto max-h-56">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-12">Tick</TableHead>
                <TableHead className="text-xs w-24">Kind</TableHead>
                <TableHead className="text-xs">Label</TableHead>
                <TableHead className="text-xs">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id} className="text-xs">
                  <TableCell>T-{e.tick}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {e.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{e.label}</TableCell>
                  <TableCell className="text-muted-foreground">{e.detail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* Cohorts */}
      <TabsContent value="cohorts" className="mt-2">
        <div className="rounded-md border overflow-auto max-h-56">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Cohort</TableHead>
                <TableHead className="text-xs">Population</TableHead>
                <TableHead className="text-xs">Dominant Emotion</TableHead>
                <TableHead className="text-xs">Stance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cohorts.map((c) => (
                <TableRow key={c.id} className="text-xs">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.population.toLocaleString()}</TableCell>
                  <TableCell>{c.dominantEmotion}</TableCell>
                  <TableCell>{c.stance}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* Social Feed */}
      <TabsContent value="feed" className="mt-2">
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {posts.map((p) => (
            <div key={p.id} className="rounded-md border p-2.5 text-xs">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">{p.author}</span>
                <Badge variant="outline" className="text-xs">T-{p.tick}</Badge>
                <span className="text-muted-foreground ml-auto">
                  ×{p.amplification} amp
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">{p.content}</p>
            </div>
          ))}
        </div>
      </TabsContent>

      {/* Logs */}
      <TabsContent value="logs" className="mt-2">
        <div className="rounded-md border overflow-auto max-h-56">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-12">Tick</TableHead>
                <TableHead className="text-xs w-14">Level</TableHead>
                <TableHead className="text-xs">Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id} className="text-xs">
                  <TableCell>T-{l.tick}</TableCell>
                  <TableCell>
                    <span className={`font-medium uppercase ${LEVEL_CLASS[l.level]}`}>
                      {l.level}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono">{l.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* Memory */}
      <TabsContent value="memory" className="mt-2">
        <div className="rounded-md border p-3 text-xs text-muted-foreground max-h-56 overflow-y-auto">
          <p className="font-medium text-foreground mb-2">Zep Memory Snapshot</p>
          <p>Context retrieved at current tick. Memory provider: Zep Cloud.</p>
          <pre className="mt-2 bg-muted rounded p-2 whitespace-pre-wrap break-all">
            {JSON.stringify(
              {
                session_id: 'wf:universe:mock',
                context:
                  'Cohort A has shifted toward higher distrust following the tech regulation event. Hero agent H1 expressed solidarity. The media coverage from TechWatch amplified the narrative by 3x.',
                token_count: 128,
              },
              null,
              2
            )}
          </pre>
        </div>
      </TabsContent>
    </Tabs>
  );
}
