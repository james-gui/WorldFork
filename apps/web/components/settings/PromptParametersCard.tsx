'use client';

import * as React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { SlidersHorizontal } from 'lucide-react';
import { SettingsCard } from './SettingsCard';
import { SliderRow } from './SliderRow';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function PromptParametersCard() {
  const form = useFormContext();
  const temperature = useWatch({ control: form.control, name: 'temperature' });
  const topP = useWatch({ control: form.control, name: 'topP' });

  return (
    <SettingsCard
      id="prompt-parameters"
      title="Prompt Parameters"
      description="Controls for LLM generation behavior."
      icon={<SlidersHorizontal className="h-4 w-4" />}
    >
      <SliderRow
        label="Temperature"
        value={temperature ?? 0.7}
        min={0}
        max={1}
        step={0.01}
        onValueChange={(v) => form.setValue('temperature', v, { shouldDirty: true })}
      />

      <SliderRow
        label="Top-p"
        value={topP ?? 1}
        min={0}
        max={1}
        step={0.01}
        onValueChange={(v) => form.setValue('topP', v, { shouldDirty: true })}
      />

      <FormField
        control={form.control}
        name="maxOutputTokens"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Max Output Tokens</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="number"
                placeholder="4096"
                className="h-8 text-xs"
                onChange={(e) => field.onChange(Number(e.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="contextWindowTokens"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Context Window Tokens</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="number"
                placeholder="128000"
                className="h-8 text-xs"
                onChange={(e) => field.onChange(Number(e.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <Button type="button" size="sm" className="h-8 text-xs w-full" onClick={() => form.handleSubmit(() => {})()}>
        Save and apply
      </Button>
    </SettingsCard>
  );
}
