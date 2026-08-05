import { useEffect } from 'react'
import { useAccountsStore } from '@/features/accounts/accountsStore'
import { DynamicIcon } from '@/components/common/DynamicIcon'
import { cn } from '@/utils/cn'

interface AccountSelectorProps {
  value: string | null
  onChange: (accountId: string) => void
  excludeId?: string
  label?: string
}

export function AccountSelector({
  value,
  onChange,
  excludeId,
  label = 'Account',
}: AccountSelectorProps) {
  const accounts = useAccountsStore((s) => s.accounts)
  const load = useAccountsStore((s) => s.load)

  useEffect(() => {
    load()
  }, [load])

  const visible = excludeId ? accounts.filter((a) => a.id !== excludeId) : accounts

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-8">
      {visible.map((account) => {
        const selected = value === account.id
        return (
          <button
            key={account.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(account.id)}
            className={cn(
              'flex min-h-touch items-center gap-8 rounded-md border px-12 text-body-sm font-medium transition-colors duration-fast',
              selected
                ? 'border-income bg-income-subtle text-income'
                : 'border-border bg-surface-card text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800'
            )}
          >
            <DynamicIcon
              name={account.icon}
              className="size-16"
              style={{ color: selected ? undefined : account.color }}
            />
            {account.name}
          </button>
        )
      })}
    </div>
  )
}
