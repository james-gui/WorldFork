'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProTipBar } from './ProTipBar';
import { cn } from '@/lib/utils';

interface WizardFooterProps {
  currentStep: number; // 0-indexed
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  isLastStep: boolean;
  isSubmitting?: boolean;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  proTip?: string;
  className?: string;
}

export function WizardFooter({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  isLastStep,
  isSubmitting,
  backDisabled,
  nextDisabled,
  proTip,
  className,
}: WizardFooterProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 border-t border-border bg-background/80 backdrop-blur px-6 py-3',
        className
      )}
    >
      {/* Pro tip — left */}
      <div className="flex-1">
        <ProTipBar tip={proTip} />
      </div>

      {/* Get help — center */}
      <a
        href="#"
        className="text-xs text-brand-600 hover:underline flex-shrink-0"
        tabIndex={0}
        onClick={(e) => e.preventDefault()}
      >
        Get help
      </a>

      {/* Page indicator */}
      <span className="text-xs text-muted-foreground flex-shrink-0">
        Page {currentStep + 1} of {totalSteps}
      </span>

      {/* Navigation buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          disabled={backDisabled || currentStep === 0}
        >
          Back
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onNext}
          disabled={nextDisabled || isSubmitting}
          className="gap-2"
        >
          {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isLastStep ? 'Generate Big Bang' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
