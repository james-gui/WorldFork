import { z } from 'zod';

const controlsSchema = z.object({
  branchTriggerThreshold: z.number().min(0).max(1),
  cooldownPeriod: z.number().min(0).max(20),
  stagnationCleanup: z.number().min(0).max(1),
  divergenceDetectionThreshold: z.number().min(0).max(1),
  coolPeriod: z.number().min(0).max(30),
  storageLimit: z.number().min(0).max(200),
  perSandboxLimit: z.number().min(0).max(20),
  storageMultiplier: z.number().min(0.1).max(5),
  heatMode: z.number().min(0).max(1),
  tradeRoutes: z.number().min(0).max(1),
  autoRouting: z.number().min(0).max(1),
  eclipseReduction: z.number().min(0).max(1),
  killThreshold: z.number().min(0).max(1),
  lateMode: z.number().min(0).max(1),
});

const enabledSchema = z.object({
  branchTriggerThreshold: z.boolean(),
  cooldownPeriod: z.boolean(),
  stagnationCleanup: z.boolean(),
  divergenceDetectionThreshold: z.boolean(),
  coolPeriod: z.boolean(),
  storageLimit: z.boolean(),
  perSandboxLimit: z.boolean(),
  storageMultiplier: z.boolean(),
  heatMode: z.boolean(),
  tradeRoutes: z.boolean(),
  autoRouting: z.boolean(),
  eclipseReduction: z.boolean(),
  killThreshold: z.boolean(),
  lateMode: z.boolean(),
});

const conditionSchema = z.object({
  id: z.string(),
  trigger: z.string(),
  metric: z.string(),
  operator: z.string(),
  threshold: z.number(),
  action: z.string(),
});

export const branchPolicySchema = z.object({
  controls: controlsSchema,
  enabled: enabledSchema,
  conditions: z.array(conditionSchema),
});

export type BranchPolicyFormValues = z.infer<typeof branchPolicySchema>;

// Defaults mirror PRD §13.5 Branch Explosion Controls (normalized for UI sliders).
export const DEFAULT_BRANCH_POLICY: BranchPolicyFormValues = {
  controls: {
    branchTriggerThreshold: 0.45,
    cooldownPeriod: 3,
    stagnationCleanup: 0.3,
    divergenceDetectionThreshold: 0.35,
    coolPeriod: 5,
    storageLimit: 50,
    perSandboxLimit: 5,
    storageMultiplier: 1.0,
    heatMode: 0.4,
    tradeRoutes: 0.5,
    autoRouting: 0.6,
    eclipseReduction: 0.3,
    killThreshold: 0.2,
    lateMode: 0.25,
  },
  enabled: {
    branchTriggerThreshold: true,
    cooldownPeriod: true,
    stagnationCleanup: true,
    divergenceDetectionThreshold: true,
    coolPeriod: true,
    storageLimit: true,
    perSandboxLimit: true,
    storageMultiplier: false,
    heatMode: true,
    tradeRoutes: true,
    autoRouting: false,
    eclipseReduction: true,
    killThreshold: true,
    lateMode: false,
  },
  conditions: [
    {
      id: 'cond_1',
      trigger: 'Mobilization Spike',
      metric: 'mobilization',
      operator: '>',
      threshold: 0.7,
      action: 'spawn_candidate',
    },
    {
      id: 'cond_2',
      trigger: 'Polarization Drift',
      metric: 'polarization',
      operator: '>',
      threshold: 0.6,
      action: 'spawn_candidate',
    },
    {
      id: 'cond_3',
      trigger: 'Trust Collapse',
      metric: 'trust',
      operator: '<',
      threshold: 0.2,
      action: 'freeze',
    },
    {
      id: 'cond_4',
      trigger: 'Volatility Stagnation',
      metric: 'volatility',
      operator: '<',
      threshold: 0.05,
      action: 'kill',
    },
  ],
};
