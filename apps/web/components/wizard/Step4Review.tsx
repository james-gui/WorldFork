'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { WizardFormValues } from './BigBangWizard';

const TICK_LABELS: Record<string, string> = {
  '1m': '1 minute',
  '5m': '5 minutes',
  '15m': '15 minutes',
  '1h': '1 hour',
  '4h': '4 hours',
  '1d': '1 day',
};

const PROVIDER_LABELS: Record<string, string> = {
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  ollama: 'Ollama (local)',
};

interface ReviewRowProps {
  label: string;
  value: React.ReactNode;
}

function ReviewRow({ label, value }: ReviewRowProps) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm text-muted-foreground min-w-[160px] flex-shrink-0">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export function Step4Review() {
  const { watch } = useFormContext<WizardFormValues>();
  const values = watch();

  const activeSources = Object.entries(values.sources ?? {})
    .filter(([, v]) => v)
    .map(([k]) => {
      const map: Record<string, string> = {
        useWeb: 'Web search',
        useZep: 'Zep memory',
        useSotSnapshot: 'SoT snapshot',
        useUploadedDocs: 'Uploaded docs',
      };
      return map[k] ?? k;
    });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-semibold">Review your configuration</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Confirm the settings below before launching your Big Bang simulation.
        </p>
      </div>

      {/* Scenario */}
      <div className="rounded-lg border border-border p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scenario</p>
        <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground max-h-[120px] overflow-y-auto">
          {values.scenarioText || <em>No scenario text provided</em>}
        </div>
      </div>

      <Separator />

      {/* Timing */}
      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timing</p>
        <ReviewRow label="Tick duration" value={TICK_LABELS[values.tickDuration ?? '1d'] ?? values.tickDuration} />
        <ReviewRow label="Number of ticks" value={values.numberOfTicks?.toLocaleString()} />
        <ReviewRow
          label="Default provider"
          value={
            <Badge variant="secondary">
              {PROVIDER_LABELS[values.provider ?? 'openrouter'] ?? values.provider}
            </Badge>
          }
        />
      </div>

      <Separator />

      {/* Sources */}
      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data sources</p>
        {activeSources.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {activeSources.map((s) => (
              <Badge key={s} variant="outline">{s}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No additional sources selected.</p>
        )}
      </div>

      <Separator />

      {/* Model routing */}
      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Model routing</p>
        {values.modelRouting && Object.entries(values.modelRouting).map(([job, model]) => (
          <ReviewRow
            key={job}
            label={job.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
            value={<code className="text-xs">{model}</code>}
          />
        ))}
        <ReviewRow label="Temperature" value={values.temperature?.toFixed(1)} />
        <ReviewRow label="Max tokens" value={values.maxTokens?.toLocaleString()} />
      </div>

      <Separator />

      {/* Advanced */}
      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Advanced</p>
        <ReviewRow label="QSA mode" value={values.qsaMode ? 'Enabled' : 'Disabled'} />
        <ReviewRow label="Auto-fanout" value={values.autoFanout ? 'Enabled' : 'Disabled'} />
        <ReviewRow label="Launch ticks" value={values.estimatedLaunchTicks} />
      </div>
    </div>
  );
}
