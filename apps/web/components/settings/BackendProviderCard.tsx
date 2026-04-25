'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Server, Plus } from 'lucide-react';
import { SettingsCard } from './SettingsCard';
import { KeyValueEditor } from './KeyValueEditor';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const PROVIDERS = ['OpenRouter'] as const;

export function BackendProviderCard() {
  const form = useFormContext();
  const [extraProviders, setExtraProviders] = React.useState<
    { key: string; value: string }[]
  >([]);

  return (
    <SettingsCard
      id="backend-provider"
      title="Backend Provider"
      description="Default LLM provider and API credentials."
      icon={<Server className="h-4 w-4" />}
    >
      <FormField
        control={form.control}
        name="provider"
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
                {PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p.toLowerCase()}>
                    {p}
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
        name="baseUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Base URL</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="https://openrouter.ai/api/v1"
                className="h-8 text-xs font-mono"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="apiKeyEnv"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">API Key Env Var</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="OPENROUTER_API_KEY"
                className="h-8 text-xs font-mono"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {extraProviders.length > 0 && (
        <KeyValueEditor
          label="Additional providers"
          pairs={extraProviders}
          onChange={setExtraProviders}
          keyPlaceholder="Provider name"
          valuePlaceholder="API Key Env"
        />
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1 text-muted-foreground"
        onClick={() =>
          setExtraProviders((prev) => [...prev, { key: '', value: '' }])
        }
      >
        <Plus className="h-3 w-3" />
        Add another provider
      </Button>
    </SettingsCard>
  );
}
