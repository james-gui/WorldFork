'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { ChevronDown, ChevronUp, UploadCloud, X, FileText } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { WizardFormValues } from './BigBangWizard';

const SAMPLE_SCENARIO = `A gig-worker labor dispute unfolds in the Bay Area after a major platform company announces a 20% commission increase. Workers organize online and plan city-wide strikes. Local press, NGOs, competing platforms, and customers all respond. Government officials weigh intervention. The scenario spans 6 months with escalating tensions and potential regulatory action.`;

const TICK_OPTIONS = [
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: '1d', label: '1 day' },
];

const PROVIDER_OPTIONS = [
  { value: 'openrouter', label: 'OpenRouter' },
];

const TICK_DURATION_MINUTES: Record<string, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
};

interface AttachedFile {
  name: string;
  sizeKb: number;
  type: string;
}

function formatFileSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function deriveTimeHorizon(ticks: number, tickDuration: string): string {
  const totalMinutes = ticks * (TICK_DURATION_MINUTES[tickDuration] ?? 1440);
  if (totalMinutes < 60) return `${totalMinutes} minutes`;
  if (totalMinutes < 1440) return `${Math.round(totalMinutes / 60)} hours`;
  if (totalMinutes < 43200) return `${Math.round(totalMinutes / 1440)} days`;
  if (totalMinutes < 525600) return `${Math.round(totalMinutes / 43200)} months`;
  return `${(totalMinutes / 525600).toFixed(1)} years`;
}

export function Step1Scenario() {
  const { register, watch, setValue, formState: { errors } } = useFormContext<WizardFormValues>();
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [attachedFiles, setAttachedFiles] = React.useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const dropRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const scenarioText = watch('scenarioText');
  const tickDuration = watch('tickDuration');
  const numberOfTicks = watch('numberOfTicks');
  const provider = watch('provider');
  const qsaMode = watch('qsaMode');
  const autoFanout = watch('autoFanout');
  const estimatedLaunchTicks = watch('estimatedLaunchTicks');

  const charCount = scenarioText?.length ?? 0;
  const timeHorizon = deriveTimeHorizon(numberOfTicks ?? 8, tickDuration ?? '1d');

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      ['.pdf', '.csv', '.md', 'application/pdf', 'text/csv', 'text/markdown'].some(
        (ext) => f.name.endsWith(ext.replace('.', '')) || f.type === ext
      )
    );
    addFiles(files);
  }

  function addFiles(files: File[]) {
    const newFiles = files.map((f): AttachedFile => ({
      name: f.name,
      sizeKb: Math.round(f.size / 1024),
      type: f.name.split('.').pop()?.toUpperCase() ?? 'FILE',
    }));
    setAttachedFiles((prev) => [...prev, ...newFiles]);
  }

  function removeFile(idx: number) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Scenario text area */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="scenarioText" className="text-sm font-medium">
            Describe your scenario
          </Label>
          <span
            className={cn(
              'text-xs tabular-nums',
              charCount > 4000 ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {charCount.toLocaleString()} / 5,000
          </span>
        </div>
        <Textarea
          id="scenarioText"
          {...register('scenarioText')}
          placeholder="Describe the scenario, stakeholders, and context. Be specific about time scale, geography, and triggering events. e.g. 'A gig-worker labor dispute in the Bay Area...'"
          className={cn(
            'min-h-[140px] resize-y text-sm',
            errors.scenarioText && 'border-destructive focus-visible:ring-destructive'
          )}
          maxLength={5000}
        />
        {errors.scenarioText && (
          <p className="text-xs text-destructive">{errors.scenarioText.message}</p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start text-xs h-7"
          onClick={() => setValue('scenarioText', SAMPLE_SCENARIO, { shouldValidate: true })}
        >
          Try as example
        </Button>
      </div>

      {/* Attach reference materials */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">
          Attach reference materials{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <div
          ref={dropRef}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors',
            isDragging
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20'
              : 'border-border hover:border-brand-400 hover:bg-muted/40'
          )}
        >
          <UploadCloud className="h-7 w-7 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-0.5">PDF, CSV, MD — up to 20 MB each</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.csv,.md"
            multiple
            onChange={(e) => {
              if (e.target.files) addFiles(Array.from(e.target.files));
              e.target.value = '';
            }}
          />
        </div>

        {/* Attached file chips */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {attachedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs"
              >
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground">({formatFileSize(file.sizeKb)})</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Timing configuration */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Tick duration */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="tickDuration" className="text-sm font-medium">
            Tick duration
          </Label>
          <Select
            value={tickDuration}
            onValueChange={(v) => setValue('tickDuration', v as WizardFormValues['tickDuration'], { shouldValidate: true })}
          >
            <SelectTrigger id="tickDuration" className="h-9">
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              {TICK_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Number of ticks */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="numberOfTicks" className="text-sm font-medium">
              Number of ticks
            </Label>
            <span className="text-sm font-semibold tabular-nums">{numberOfTicks}</span>
          </div>
          <Slider
            id="numberOfTicks"
            min={10}
            max={1000}
            step={10}
            value={[numberOfTicks ?? 8]}
            onValueChange={([v]) => setValue('numberOfTicks', v, { shouldValidate: true })}
            className="mt-1"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>10</span>
            <span>1,000</span>
          </div>
        </div>

        {/* Time horizon (auto-derived) */}
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Time horizon</Label>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs py-1">
              {numberOfTicks} ticks × {TICK_OPTIONS.find((o) => o.value === tickDuration)?.label ?? tickDuration} = {timeHorizon}
            </Badge>
          </div>
        </div>

        {/* Default model provider */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="provider" className="text-sm font-medium">
            Default model provider
          </Label>
          <Select
            value={provider}
            onValueChange={(v) => setValue('provider', v, { shouldValidate: true })}
          >
            <SelectTrigger id="provider" className="h-9">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Advanced options collapsible */}
      <div className="rounded-lg border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium bg-muted/30 hover:bg-muted/50 transition-colors"
          aria-expanded={advancedOpen}
        >
          <span>Advanced options</span>
          {advancedOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {advancedOpen && (
          <div className="flex flex-col gap-4 p-4 border-t border-border">
            {/* Standard QSA mode */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Standard QSA mode</p>
                <p className="text-xs text-muted-foreground">
                  Question-Stance-Action structured prompt format
                </p>
              </div>
              <Switch
                aria-label="Standard QSA mode"
                checked={qsaMode ?? true}
                onCheckedChange={(v) => setValue('qsaMode', v)}
              />
            </div>

            {/* Auto-fanout */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-fanout enabled</p>
                <p className="text-xs text-muted-foreground">
                  Automatically branch universes at high-divergence ticks
                </p>
              </div>
              <Switch
                aria-label="Auto-fanout enabled"
                checked={autoFanout ?? true}
                onCheckedChange={(v) => setValue('autoFanout', v)}
              />
            </div>

            {/* Estimated launch ticks */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="estimatedLaunchTicks" className="text-sm font-medium">
                Estimated launch ticks
              </Label>
              <input
                id="estimatedLaunchTicks"
                type="number"
                min={1}
                max={100}
                value={estimatedLaunchTicks ?? 3}
                onChange={(e) => setValue('estimatedLaunchTicks', parseInt(e.target.value, 10) || 3)}
                className="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Ticks to run before auto-launching the first branch
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
