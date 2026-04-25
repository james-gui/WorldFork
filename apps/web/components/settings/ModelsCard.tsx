'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Cpu } from 'lucide-react';
import { SettingsCard } from './SettingsCard';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const MODELS = [
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'anthropic/claude-3-5-sonnet',
  'anthropic/claude-3-haiku',
  'google/gemini-pro',
] as const;

interface ToggleRowProps {
  label: string;
  description?: string;
  name: string;
}

function ToggleRow({ label, description, name }: ToggleRowProps) {
  const form = useFormContext();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-medium">{label}</Label>
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </div>
        </FormItem>
      )}
    />
  );
}

export function ModelsCard() {
  const form = useFormContext();

  return (
    <SettingsCard
      id="models"
      title="Models"
      description="Default and fallback model configuration."
      icon={<Cpu className="h-4 w-4" />}
    >
      <FormField
        control={form.control}
        name="defaultModel"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Default Model</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="fallbackModel"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Fallback Model</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select fallback model" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-3 pt-1">
        <ToggleRow
          name="capabilityTest"
          label="Add capability test"
          description="Run a 1-token probe before first use"
        />
        <ToggleRow
          name="toolCalling"
          label="Tool calling"
          description="Enable structured tool call mode"
        />
        <ToggleRow
          name="structuredOutput"
          label="Structured output"
          description="Use json_schema response format"
        />
      </div>
    </SettingsCard>
  );
}
