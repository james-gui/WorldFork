'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepDef {
  label: string;
}

interface StepperProps {
  steps: StepDef[];
  currentStep: number; // 0-indexed
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <nav aria-label="Wizard steps" className="flex items-center gap-0">
      {steps.map((step, i) => {
        const isCompleted = i < currentStep;
        const isActive = i === currentStep;

        return (
          <React.Fragment key={step.label}>
            <div className="flex items-center gap-2">
              {/* Circle indicator */}
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold border-2 flex-shrink-0 transition-colors',
                  isCompleted
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : isActive
                    ? 'border-brand-600 bg-background text-brand-600'
                    : 'border-border bg-background text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'text-sm font-medium',
                  isActive ? 'text-foreground' : isCompleted ? 'text-muted-foreground' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'h-px flex-1 mx-3 min-w-[24px] transition-colors',
                  i < currentStep ? 'bg-brand-600' : 'bg-border'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
