'use client';

import * as React from 'react';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  FormControl,
  FormField,
  FormItem,
} from '@/components/ui/form';

const schema = z.object({
  usePrivateFeed: z.boolean().default(false),
  autoFallback: z.boolean().default(true),
  suspendedFallback: z.boolean().default(true),
  branchReservedCapacity: z.number().min(0).max(100).default(20),
  healthCheckEnabled: z.boolean().default(true),
  autoReloadSettings: z.boolean().default(false),
});

type GlobalRoutingValues = z.infer<typeof schema>;

interface ToggleFieldProps {
  name: keyof GlobalRoutingValues;
  label: string;
}

function ToggleField({ name, label }: ToggleFieldProps) {
  const form = useFormContext<GlobalRoutingValues>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center justify-between py-1">
          <Label className="text-xs font-medium">{label}</Label>
          <FormControl>
            <Switch
              checked={field.value as boolean}
              onCheckedChange={field.onChange}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

export function GlobalRoutingSettingsCard() {
  const form = useForm<GlobalRoutingValues>({
    resolver: zodResolver(schema),
    defaultValues: schema.parse({}),
  });

  const capacity = form.watch('branchReservedCapacity');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Global Routing Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form className="space-y-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <ToggleField name="usePrivateFeed" label="Use private feed" />
              <ToggleField name="autoFallback" label="Auto fallback" />
              <ToggleField name="suspendedFallback" label="Suspended fallback" />
              <ToggleField name="healthCheckEnabled" label="Health check enabled" />
              <ToggleField name="autoReloadSettings" label="Auto-reload settings on change" />
            </div>

            <div className="space-y-1.5 pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Branch reserved capacity</Label>
                <span className="text-xs font-mono tabular-nums">{capacity}%</span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[capacity]}
                onValueChange={([v]) =>
                  form.setValue('branchReservedCapacity', v, { shouldDirty: true })
                }
              />
            </div>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
