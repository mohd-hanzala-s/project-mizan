import { Sparkles } from "lucide-react";
import { useSettingsStore } from "@/app/settingsStore";
import { cn } from "@/utils/cn";

export function SampleDataStep() {
  const sampleDataRequested = useSettingsStore(
    (s) => s.settings?.sampleDataRequested ?? false,
  );
  const update = useSettingsStore((s) => s.update);

  return (
    <div className="flex flex-col items-center gap-24 text-center">
      <div className="flex size-64 items-center justify-center rounded-full bg-income-subtle text-income">
        <Sparkles className="size-32" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-8">
        <h2 className="text-h1 text-text-primary">You're all set</h2>
        <p className="max-w-[380px] text-body text-text-secondary">
          Start with a blank slate, or explore with a few sample transactions
          you can delete anytime.
        </p>
      </div>

      <label
        className={cn(
          "flex min-h-touch max-w-[380px] cursor-pointer items-center gap-12 rounded-md border px-16 text-left",
          sampleDataRequested
            ? "border-income bg-income-subtle"
            : "border-border bg-surface-card",
        )}
      >
        <input
          type="checkbox"
          checked={sampleDataRequested}
          onChange={(e) => update({ sampleDataRequested: e.target.checked })}
          className="size-16 accent-income"
        />
        <span className="text-body-sm text-text-primary">
          Load sample data so I can explore the app (arrives once Transactions
          is built in Phase 1)
        </span>
      </label>
    </div>
  );
}
