import React from 'react';
import { Check } from 'lucide-react';

interface AuthProgressStepsProps {
  currentStep: 1 | 2 | 3;
}

const STEPS = [
  { id: 1, label: 'Email' },
  { id: 2, label: 'Verify' },
  { id: 3, label: 'New password' },
];

export function AuthProgressSteps({ currentStep }: AuthProgressStepsProps) {
  return (
    <nav aria-label="Password reset progress" className="w-full pb-0.5">
      <ol className="flex items-center justify-between w-full max-w-[320px] mx-auto text-xs font-medium">
        {STEPS.map((step, idx) => {
          const isComplete = currentStep > step.id;
          const isCurrent = currentStep === step.id;

          return (
            <React.Fragment key={step.id}>
              {/* Step indicator */}
              <li
                className="flex items-center gap-1.5"
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-mono font-bold transition-all ${
                    isComplete
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : isCurrent
                      ? 'bg-gradient-to-r from-accent-from to-accent-to text-accent-foreground shadow-sm shadow-accent/25 ring-2 ring-brand/30'
                      : 'bg-surface-elevated text-muted-foreground border border-border'
                  }`}
                >
                  {isComplete ? <Check className="w-3 h-3 stroke-[3]" /> : step.id}
                </div>
                <span
                  className={`text-[11px] font-medium hidden sm:inline ${
                    isCurrent
                      ? 'text-foreground font-semibold'
                      : isComplete
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/60'
                  }`}
                >
                  {step.label}
                </span>
              </li>

              {/* Connecting line */}
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-[2px] mx-2 rounded-full transition-colors ${
                    currentStep > step.id ? 'bg-emerald-500/80' : 'bg-border'
                  }`}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
