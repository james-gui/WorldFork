'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import type { WizardFormValues } from './BigBangWizard';

const MODELS = [
  { value: 'openai/gpt-4o', label: 'GPT-4o', badge: 'Default' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', badge: 'Fast' },
  { value: 'anthropic/claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', badge: 'High quality' },
  { value: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku', badge: 'Fast' },
  { value: 'mistralai/mistral-large', label: 'Mistral Large', badge: null },
];

const JOB_TYPES = [
  { id: 'initializer' as const, label: 'Initializer', description: 'Creates archetypes, heroes, channels' },
  { id: 'cohortDecision' as const, label: 'Cohort decision', description: 'Per-cohort tick deliberation' },
  { id: 'heroDecision' as const, label: 'Hero decision', description: 'Per-hero tick deliberation' },
  { id: 'godReview' as const, label: 'God review', description: 'Branch/freeze/kill decisions' },
];

export function Step3Models() {
  const { watch, setValue } = useFormContext<WizardFormValues>();
  const models = watch('modelRouting');
  const temperature = watch('temperature');
  const maxTokens = watch('maxTokens');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold">Model routing</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Assign models per job type. Uses your default provider from Step 1.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {JOB_TYPES.map((job) => (
          <div key={job.id} className="flex items-center gap-4 rounded-lg border border-border p-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{job.label}</p>
              <p className="text-xs text-muted-foreground">{job.description}</p>
            </div>
            <Select
              value={models?.[job.id] ?? 'openai/gpt-4o'}
              onValueChange={(v) =>
                setValue('modelRouting', { ...models, [job.id]: v })
              }
            >
              <SelectTrigger className="h-8 w-52 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <div className="flex items-center gap-2">
                      <span>{m.label}</span>
                      {m.badge && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {m.badge}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {/* Temperature */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Temperature</Label>
          <span className="text-sm font-semibold tabular-nums">{(temperature ?? 0.7).toFixed(1)}</span>
        </div>
        <Slider
          min={0}
          max={2}
          step={0.1}
          value={[temperature ?? 0.7]}
          onValueChange={([v]) => setValue('temperature', v)}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Deterministic (0)</span>
          <span>Creative (2)</span>
        </div>
      </div>

      {/* Max tokens */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Max tokens per call</Label>
          <span className="text-sm font-semibold tabular-nums">
            {(maxTokens ?? 2048).toLocaleString()}
          </span>
        </div>
        <Slider
          min={256}
          max={8192}
          step={256}
          value={[maxTokens ?? 2048]}
          onValueChange={([v]) => setValue('maxTokens', v)}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>256</span>
          <span>8,192</span>
        </div>
      </div>
    </div>
  );
}
