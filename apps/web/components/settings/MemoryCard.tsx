'use client';

import * as React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Brain } from 'lucide-react';
import { SettingsCard } from './SettingsCard';
import { SliderRow } from './SliderRow';
import { Badge } from '@/components/ui/badge';
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

export function MemoryCard() {
  const form = useFormContext();
  const cacheTtl = useWatch({ control: form.control, name: 'memoryCacheTtl' });

  return (
    <SettingsCard
      id="memory"
      title="Memory"
      description="Configure the memory provider and caching behavior."
      icon={<Brain className="h-4 w-4" />}
    >
      <FormField
        control={form.control}
        name="memoryProvider"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Provider</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="local_ledger">Local ledger</SelectItem>
                <SelectItem value="zep" disabled>Zep disabled</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="memoryMode"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Mode</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="local">local</SelectItem>
                <SelectItem value="run">run</SelectItem>
                <SelectItem value="cohort">cohort</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <SliderRow
        label="Cache TTL (minutes)"
        value={cacheTtl ?? 30}
        min={1}
        max={180}
        step={1}
        formatValue={(v) => `${v}m`}
        onValueChange={(v) => form.setValue('memoryCacheTtl', v, { shouldDirty: true })}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Healthcheck</span>
        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Healthy
        </Badge>
      </div>
    </SettingsCard>
  );
}
