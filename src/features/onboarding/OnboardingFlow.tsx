import { useState } from "react";
import { useSettingsStore } from "@/app/settingsStore";
import { WelcomeStep } from "./WelcomeStep";
import { AppLockStep } from "./AppLockStep";
import { SampleDataStep } from "./SampleDataStep";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

const STEPS = [WelcomeStep, AppLockStep, SampleDataStep];

export function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const update = useSettingsStore((s) => s.update);
  const StepComponent = STEPS[step];
  const isLast = step === STEPS.length - 1;

  async function finish() {
    await update({ onboardingCompleted: true });
  }

  return (
    <div className="flex h-dvh w-full flex-col bg-surface">
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-24 py-48">
        <StepComponent />
      </div>

      <div className="flex flex-col items-center gap-24 px-24 pb-48">
        <div
          className="flex gap-8"
          role="tablist"
          aria-label="Onboarding progress"
        >
          {STEPS.map((_, i) => (
            <span
              key={i}
              role="tab"
              aria-selected={i === step}
              className={cn(
                "h-8 w-8 rounded-full",
                i === step ? "bg-income" : "bg-neutral-200 dark:bg-neutral-700",
              )}
            />
          ))}
        </div>

        <div className="flex w-full max-w-[380px] items-center justify-between gap-16">
          {step > 0 ? (
            <Button variant="tertiary" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          ) : (
            <span />
          )}

          {!isLast ? (
            <div className="flex items-center gap-16">
              <Button variant="tertiary" onClick={() => setStep((s) => s + 1)}>
                Skip
              </Button>
              <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            </div>
          ) : (
            <Button variant="primary" onClick={finish}>
              Get Started
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
