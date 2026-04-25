'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Users,
  ShoppingCart,
  Building2,
  Newspaper,
  Heart,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Stepper } from './Stepper';
import { WizardFooter } from './WizardFooter';
import { Step1Scenario } from './Step1Scenario';
import { Step2Sources } from './Step2Sources';
import { Step3Models } from './Step3Models';
import { Step4Review } from './Step4Review';
import { ArchetypeCard, type ArchetypeCardData } from './ArchetypeCard';
import { HeroCard, type HeroCardData } from './HeroCard';
import { useCreateRun } from '@/lib/api/runs';

// ---------- Zod schema ----------
const wizardSchema = z.object({
  scenarioText: z
    .string()
    .min(20, 'Please provide at least 20 characters describing your scenario.')
    .max(5000, 'Scenario must be under 5,000 characters.'),
  tickDuration: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('1d'),
  numberOfTicks: z.number().int().min(10).max(1000).default(8),
  provider: z.string().default('openrouter'),
  qsaMode: z.boolean().default(true),
  autoFanout: z.boolean().default(true),
  estimatedLaunchTicks: z.number().int().min(1).max(100).default(3),
  sources: z.object({
    useWeb: z.boolean().default(false),
    useZep: z.boolean().default(false),
    useSotSnapshot: z.boolean().default(true),
    useUploadedDocs: z.boolean().default(false),
  }).default({}),
  modelRouting: z.object({
    initializer: z.string().default('openai/gpt-4o'),
    cohortDecision: z.string().default('openai/gpt-4o'),
    heroDecision: z.string().default('openai/gpt-4o'),
    godReview: z.string().default('openai/gpt-4o'),
  }).default({}),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(256).max(8192).default(2048),
});

export type WizardFormValues = z.infer<typeof wizardSchema>;

// ---------- Mock preview data ----------
const PREVIEW_ARCHETYPES: ArchetypeCardData[] = [
  {
    id: 'workers',
    label: 'Workers',
    population: 42000,
    icon: <Users className="h-4 w-4" />,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  {
    id: 'customers',
    label: 'Customers',
    population: 180000,
    icon: <ShoppingCart className="h-4 w-4" />,
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  {
    id: 'competitors',
    label: 'Competitors',
    population: 8000,
    icon: <Building2 className="h-4 w-4" />,
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  {
    id: 'press',
    label: 'Press',
    population: 1200,
    icon: <Newspaper className="h-4 w-4" />,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  {
    id: 'ngos',
    label: 'NGOs',
    population: 3400,
    icon: <Heart className="h-4 w-4" />,
    color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  },
];

const PREVIEW_HEROES: HeroCardData[] = [
  {
    id: 'h1',
    name: 'Maria Torres',
    role: 'Union organizer',
    initials: 'MT',
    avatarColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  {
    id: 'h2',
    name: 'James Cooper',
    role: 'Platform CEO',
    initials: 'JC',
    avatarColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
];

// ---------- Step definitions ----------
const WIZARD_STEPS = [
  { label: 'Scenario' },
  { label: 'Sources' },
  { label: 'Models' },
  { label: 'Review' },
];

const PRO_TIPS: Record<number, string> = {
  0: 'Be specific about time scale and stakeholder groups for richer simulations.',
  1: 'Enabling SoT snapshot pins the taxonomy version for reproducibility.',
  2: 'Use GPT-4o Mini for cohort decisions to reduce cost while keeping quality for God review.',
  3: 'Review all settings before launching — you can duplicate and reconfigure later.',
};

// ---------- Simulation preview sidebar ----------
function SimulationPreviewPanel() {
  return (
    <aside className="flex flex-col gap-5 w-72 flex-shrink-0 border-l border-border bg-card p-5 overflow-y-auto">
      <div>
        <h3 className="text-sm font-semibold">Simulation preview</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Preview based on your scenario description.
        </p>
      </div>

      {/* Archetypes */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Archetypes ({PREVIEW_ARCHETYPES.length})
          </p>
          <Button variant="ghost" size="sm" className="h-6 text-xs text-brand-600 hover:text-brand-700 p-0">
            <ExternalLink className="h-3 w-3 mr-1" />
            View all
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PREVIEW_ARCHETYPES.slice(0, 4).map((arch) => (
            <ArchetypeCard key={arch.id} archetype={arch} />
          ))}
        </div>
        {PREVIEW_ARCHETYPES.length > 4 && (
          <p className="text-xs text-muted-foreground text-center">
            +{PREVIEW_ARCHETYPES.length - 4} more archetypes
          </p>
        )}
      </div>

      <Separator />

      {/* Heroes */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Heroes
        </p>
        <div className="flex flex-col gap-2">
          {PREVIEW_HEROES.map((hero) => (
            <HeroCard key={hero.id} hero={hero} />
          ))}
        </div>
      </div>

      <Separator />

      {/* Status chip */}
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
          Looks good — you can launch when ready.
        </p>
      </div>
    </aside>
  );
}

// ---------- Step content map ----------
const STEP_COMPONENTS = [Step1Scenario, Step2Sources, Step3Models, Step4Review];

// ---------- Main wizard ----------
export function BigBangWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(0);
  const createRun = useCreateRun();

  const form = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      scenarioText: '',
      tickDuration: '1d',
      numberOfTicks: 8,
      provider: 'openrouter',
      qsaMode: true,
      autoFanout: true,
      estimatedLaunchTicks: 3,
      sources: {
        useWeb: false,
        useZep: false,
        useSotSnapshot: true,
        useUploadedDocs: false,
      },
      modelRouting: {
        initializer: 'openai/gpt-4o',
        cohortDecision: 'openai/gpt-4o',
        heroDecision: 'openai/gpt-4o',
        godReview: 'openai/gpt-4o',
      },
      temperature: 0.7,
      maxTokens: 2048,
    },
    mode: 'onTouched',
  });

  async function handleNext() {
    if (currentStep === 0) {
      const valid = await form.trigger('scenarioText');
      if (!valid) return;
    }
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
      return;
    }
    // Submit on last step
    form.handleSubmit(async (values) => {
      try {
        const result = await createRun.mutateAsync({
          ...values,
          idempotencyKey: `wizard-${Date.now()}`,
        });
        const runId = (result as any)?.run_id ?? `run_${Date.now()}`;
        toast.success('Big Bang created! Simulation initializing…');
        router.push(`/runs/${runId}/dashboard`);
      } catch {
        toast.error('Failed to create simulation. Please try again.');
      }
    })();
  }

  function handleBack() {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }

  const StepComponent = STEP_COMPONENTS[currentStep];

  return (
    <FormProvider {...form}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex flex-col gap-4 px-6 pt-6 pb-4 border-b border-border bg-background">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create New Big Bang</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Define the conditions and parameters for your new simulation.
            </p>
          </div>
          <Stepper steps={WIZARD_STEPS} currentStep={currentStep} />
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Step content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="max-w-2xl">
              {StepComponent && <StepComponent />}
            </div>
          </div>

          {/* Simulation preview panel */}
          <SimulationPreviewPanel />
        </div>

        {/* Footer */}
        <WizardFooter
          currentStep={currentStep}
          totalSteps={WIZARD_STEPS.length}
          onBack={handleBack}
          onNext={handleNext}
          isLastStep={currentStep === WIZARD_STEPS.length - 1}
          isSubmitting={createRun.isPending}
          backDisabled={currentStep === 0}
          proTip={PRO_TIPS[currentStep]}
        />
      </div>
    </FormProvider>
  );
}
