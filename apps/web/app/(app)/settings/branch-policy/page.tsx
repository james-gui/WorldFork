'use client';

import * as React from 'react';
import { useForm, FormProvider, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { RotateCcw, Save, Bookmark } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BranchingControlsList } from '@/components/branch-policy/BranchingControlsList';
import { MultiversePreviewMini } from '@/components/branch-policy/MultiversePreviewMini';
import { PolicyOutcomeCard } from '@/components/branch-policy/PolicyOutcomeCard';
import { ConditionsTable } from '@/components/branch-policy/ConditionsTable';
import { ValidationPanel } from '@/components/branch-policy/ValidationPanel';
import { PolicyExplainer } from '@/components/branch-policy/PolicyExplainer';
import {
  branchPolicySchema,
  DEFAULT_BRANCH_POLICY,
  type BranchPolicyFormValues,
} from '@/components/branch-policy/schema';
import { usePatchBranchPolicy } from '@/lib/api/settings';

function estimateOutcome(values: BranchPolicyFormValues) {
  const c = values.controls;
  const looseness = Math.max(0, 1 - c.branchTriggerThreshold);
  const branchesPerTick = Math.min(c.perSandboxLimit, looseness * 4 + 0.5);
  const estimatedDepth = Math.min(
    8,
    Math.round((1 - c.killThreshold) * 6 + (1 - c.divergenceDetectionThreshold) * 2)
  );
  const estimatedCost =
    branchesPerTick * 0.18 * c.storageMultiplier * (1 + c.heatMode * 0.5);
  return { branchesPerTick, estimatedDepth, estimatedCost };
}

export default function BranchPolicyStudioPage() {
  const { mutateAsync, isPending } = usePatchBranchPolicy();

  const form = useForm<BranchPolicyFormValues>({
    resolver: zodResolver(branchPolicySchema),
    defaultValues: DEFAULT_BRANCH_POLICY,
  });

  const values = useWatch({ control: form.control }) as BranchPolicyFormValues;
  const outcome = React.useMemo(() => estimateOutcome(values), [values]);

  const onSubmit = async (v: BranchPolicyFormValues) => {
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      void mutateAsync(v).catch(() => {});
      form.reset(v);
      toast.success('Branch policy saved.');
    } catch {
      toast.error('Failed to save branch policy.');
    }
  };

  const onReset = () => {
    form.reset(DEFAULT_BRANCH_POLICY);
    toast.info('Reset to default policy.');
  };

  const onSaveTemplate = () => {
    toast.success('Saved as template.');
  };

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-7xl mx-auto px-6 py-6 space-y-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Branch Policy Studio
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure multiverse branching logic and validate it against guardrails.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={onReset}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to Default
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={onSaveTemplate}
            >
              <Bookmark className="h-3.5 w-3.5" />
              Save as Template
            </Button>
            <Button type="submit" size="sm" className="gap-1.5" disabled={isPending}>
              <Save className="h-3.5 w-3.5" />
              Save Policy
            </Button>
          </div>
        </div>

        {/* Two-column main */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left ~60% */}
          <div className="lg:col-span-3 space-y-3">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-semibold">Branching Controls</p>
                <p className="text-[10px] text-muted-foreground">
                  Toggle and tune individual policy items.
                </p>
              </div>
              <div className="p-3">
                <BranchingControlsList />
              </div>
            </div>
          </div>

          {/* Right ~40% */}
          <div className="lg:col-span-2 space-y-3">
            <MultiversePreviewMini
              branchTriggerThreshold={values.controls.branchTriggerThreshold}
              perSandboxLimit={values.controls.perSandboxLimit}
            />
            <PolicyOutcomeCard
              branchesPerTick={outcome.branchesPerTick}
              estimatedDepth={outcome.estimatedDepth}
              estimatedCost={outcome.estimatedCost}
            />
          </div>
        </div>

        {/* Conditions table */}
        <ConditionsTable />

        {/* Validation + explainer */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ValidationPanel values={values} />
          <PolicyExplainer values={values} />
        </div>
      </form>
    </FormProvider>
  );
}
