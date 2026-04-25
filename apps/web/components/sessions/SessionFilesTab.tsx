import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileTree, type FileNode } from './FileTree';
import type { Run } from '@/lib/types/run';

interface SessionFilesTabProps {
  run: Run;
}

// Placeholder canonical run-ledger file tree structure per §19
const buildPlaceholderTree = (runId: string): FileNode[] => [
  {
    name: 'config/',
    type: 'dir',
    children: [
      { name: 'run_config.json', type: 'file' },
      { name: 'branch_policy.json', type: 'file' },
      { name: 'model_routing.json', type: 'file' },
    ],
  },
  {
    name: 'source_of_truth_snapshot/',
    type: 'dir',
    children: [
      { name: 'emotions.json', type: 'file' },
      { name: 'behavior_axes.json', type: 'file' },
      { name: 'ideology_axes.json', type: 'file' },
      { name: 'expression_scale.json', type: 'file' },
      { name: 'event_types.json', type: 'file' },
      { name: 'social_action_tools.json', type: 'file' },
      { name: 'sociology_parameters.json', type: 'file' },
    ],
  },
  {
    name: 'universes/',
    type: 'dir',
    children: [
      {
        name: 'U000/',
        type: 'dir',
        children: [
          {
            name: 'ticks/',
            type: 'dir',
            children: [
              { name: 'T001/', type: 'dir', children: [
                { name: 'cohort_packets.jsonl', type: 'file' },
                { name: 'hero_packets.jsonl', type: 'file' },
                { name: 'llm_calls/', type: 'dir', children: [] },
                { name: 'state_snapshot.json', type: 'file' },
              ]},
              { name: 'T002/', type: 'dir', children: [] },
              { name: '... T024/', type: 'dir', children: [] },
            ],
          },
          { name: 'actors/', type: 'dir', children: [
            { name: 'archetypes.json', type: 'file' },
            { name: 'heroes.json', type: 'file' },
            { name: 'cohorts.jsonl', type: 'file' },
          ]},
          { name: 'graphs/', type: 'dir', children: [
            { name: 'exposure.jsonl', type: 'file' },
            { name: 'trust.jsonl', type: 'file' },
          ]},
        ],
      },
      {
        name: 'U001/',
        type: 'dir',
        children: [
          { name: 'ticks/', type: 'dir', children: [] },
          { name: 'actors/', type: 'dir', children: [] },
        ],
      },
    ],
  },
  { name: 'manifest.json', type: 'file' },
  { name: 'checksums.sha256', type: 'file' },
];

export function SessionFilesTab({ run }: SessionFilesTabProps) {
  const tree = buildPlaceholderTree(run.id);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Run Ledger</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          All artifacts are write-once. Modify-time and SHA-256 are tracked in{' '}
          <span className="font-mono">checksums.sha256</span>.
        </p>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto">
          <FileTree nodes={tree} />
        </div>
      </CardContent>
    </Card>
  );
}
