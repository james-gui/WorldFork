'use client';

import * as React from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { usePatchRateLimits, useRateLimits } from '@/lib/api/settings';
import type { RateLimitResponse } from '@/lib/api/types';

type RateLimitRow = Pick<
  RateLimitResponse,
  | 'provider'
  | 'enabled'
  | 'rpm_limit'
  | 'tpm_limit'
  | 'max_concurrency'
  | 'burst_multiplier'
  | 'retry_policy'
  | 'jitter'
  | 'daily_budget_usd'
  | 'branch_reserved_capacity_pct'
  | 'healthcheck_enabled'
  | 'payload'
>;

function NumberInput({
  label,
  value,
  min = 0,
  step = 1,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  min?: number;
  step?: number;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <Input
        type="number"
        value={value ?? ''}
        min={min}
        step={step}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === '' ? null : Number(raw));
        }}
        className="h-7 text-xs font-mono"
      />
    </label>
  );
}

function rowToPayload(row: RateLimitRow) {
  return {
    provider: row.provider,
    enabled: row.enabled,
    rpm_limit: row.rpm_limit,
    tpm_limit: row.tpm_limit,
    max_concurrency: row.max_concurrency,
    burst_multiplier: row.burst_multiplier,
    retry_policy: row.retry_policy,
    jitter: row.jitter,
    daily_budget_usd: row.daily_budget_usd,
    branch_reserved_capacity_pct: row.branch_reserved_capacity_pct,
    healthcheck_enabled: row.healthcheck_enabled,
    payload: row.payload ?? {},
  };
}

export function GlobalRoutingSettingsCard() {
  const { data } = useRateLimits();
  const patchRateLimits = usePatchRateLimits();
  const [rows, setRows] = React.useState<RateLimitRow[]>([]);

  React.useEffect(() => {
    setRows(data?.rate_limits ?? []);
  }, [data]);

  const updateRow = <K extends keyof RateLimitRow>(
    provider: string,
    field: K,
    value: RateLimitRow[K],
  ) => {
    setRows((prev) =>
      prev.map((row) => (row.provider === provider ? { ...row, [field]: value } : row)),
    );
  };

  const handleSave = async () => {
    try {
      await patchRateLimits.mutateAsync({
        rate_limits: rows.map(rowToPayload),
      });
      toast.success('Rate limit settings saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save rate limits.');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm">Provider Rate Limits</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Provider-wide limits used by workers and routing health checks.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleSave}
            disabled={patchRateLimits.isPending || rows.length === 0}
          >
            <Save className="h-3.5 w-3.5" />
            Save Limits
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={row.provider} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{row.provider}</p>
                <p className="text-xs text-muted-foreground">{row.retry_policy}</p>
              </div>
              <div className="flex items-center gap-4">
                <Label className="flex items-center gap-2 text-xs">
                  Enabled
                  <Switch
                    checked={row.enabled}
                    onCheckedChange={(checked) => updateRow(row.provider, 'enabled', checked)}
                  />
                </Label>
                <Label className="flex items-center gap-2 text-xs">
                  Healthcheck
                  <Switch
                    checked={row.healthcheck_enabled}
                    onCheckedChange={(checked) => updateRow(row.provider, 'healthcheck_enabled', checked)}
                  />
                </Label>
                <Label className="flex items-center gap-2 text-xs">
                  Jitter
                  <Switch
                    checked={row.jitter}
                    onCheckedChange={(checked) => updateRow(row.provider, 'jitter', checked)}
                  />
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-3">
              <NumberInput
                label="RPM"
                value={row.rpm_limit}
                onChange={(value) => updateRow(row.provider, 'rpm_limit', value ?? 0)}
              />
              <NumberInput
                label="TPM"
                value={row.tpm_limit}
                onChange={(value) => updateRow(row.provider, 'tpm_limit', value ?? 0)}
              />
              <NumberInput
                label="Concurrency"
                value={row.max_concurrency}
                onChange={(value) => updateRow(row.provider, 'max_concurrency', value ?? 0)}
              />
              <NumberInput
                label="Burst"
                value={row.burst_multiplier}
                step={0.1}
                onChange={(value) => updateRow(row.provider, 'burst_multiplier', value ?? 1)}
              />
              <NumberInput
                label="Daily USD"
                value={row.daily_budget_usd}
                step={0.01}
                onChange={(value) => updateRow(row.provider, 'daily_budget_usd', value)}
              />
              <NumberInput
                label="Branch Reserve %"
                value={row.branch_reserved_capacity_pct}
                onChange={(value) => updateRow(row.provider, 'branch_reserved_capacity_pct', value ?? 0)}
              />
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            No provider rate limits returned by the API.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
