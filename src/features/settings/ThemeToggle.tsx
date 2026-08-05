import { Sun, Moon, Monitor } from 'lucide-react'
import { useSettingsStore } from '@/app/settingsStore'
import type { ThemePreference } from '@/types/entities'
import { cn } from '@/utils/cn'

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function ThemeToggle() {
  const theme = useSettingsStore((s) => s.settings?.theme ?? 'system')
  const update = useSettingsStore((s) => s.update)

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex rounded-md bg-neutral-100 p-4 dark:bg-neutral-800"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => update({ theme: value })}
          className={cn(
            'flex min-h-touch items-center gap-8 rounded-sm px-16 text-body-sm font-medium transition-colors duration-fast',
            theme === value
              ? 'bg-surface-card text-text-primary shadow-card'
              : 'text-text-secondary hover:text-text-primary'
          )}
        >
          <Icon className="size-16" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}
