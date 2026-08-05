import { useSettingsStore } from '@/app/settingsStore'
import { ThemeToggle } from '@/features/settings/ThemeToggle'
import type { Settings } from '@/types/entities'
import { cn } from '@/utils/cn'

const DISPLAY_OPTIONS: { value: Settings['currencyDisplay']; label: string; example: string }[] = [
  { value: 'lakh-crore', label: 'Lakh / Crore', example: '₹1,00,000' },
  { value: 'international', label: 'International', example: '₹100,000' },
]

export function WelcomeStep() {
  const currencyDisplay = useSettingsStore((s) => s.settings?.currencyDisplay ?? 'lakh-crore')
  const update = useSettingsStore((s) => s.update)

  return (
    <div className="flex flex-col items-center gap-32 text-center">
      <div className="flex flex-col gap-8">
        <h1 className="text-display text-text-primary">Welcome to Nexus Finance</h1>
        <p className="max-w-[420px] text-body-lg text-text-secondary">
          Know exactly where every rupee goes, in under thirty seconds. Everything stays on this
          device — no cloud, no account.
        </p>
      </div>

      <div className="flex flex-col items-center gap-12">
        <span className="text-overline text-text-tertiary">Theme</span>
        <ThemeToggle />
      </div>

      <div className="flex flex-col items-center gap-12">
        <span className="text-overline text-text-tertiary">Number format</span>
        <div role="radiogroup" aria-label="Number format" className="flex gap-8">
          {DISPLAY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={currencyDisplay === opt.value}
              onClick={() => update({ currencyDisplay: opt.value })}
              className={cn(
                'min-h-touch rounded-md border px-16 text-left transition-colors duration-fast',
                currencyDisplay === opt.value
                  ? 'border-income bg-income-subtle'
                  : 'border-border bg-surface-card hover:bg-neutral-100 dark:hover:bg-neutral-800'
              )}
            >
              <p className="text-body-sm font-medium text-text-primary">{opt.label}</p>
              <p className="font-mono text-caption tabular-nums text-text-secondary">
                {opt.example}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
