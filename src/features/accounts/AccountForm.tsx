import { useState } from 'react'
import { AccountService } from '@/services/AccountService'
import { CurrencyInput } from '@/components/forms/CurrencyInput'
import { DynamicIcon } from '@/components/common/DynamicIcon'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'
import type { Account, AccountType } from '@/types/entities'

const TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Account' },
  { value: 'creditCard', label: 'Credit Card' },
  { value: 'upiWallet', label: 'UPI Wallet' },
  { value: 'emergencyFund', label: 'Emergency Fund' },
  { value: 'other', label: 'Other' },
]

const ICON_CHOICES = [
  'Banknote',
  'Landmark',
  'CreditCard',
  'Smartphone',
  'ShieldCheck',
  'Wallet',
  'PiggyBank',
  'Briefcase',
  'TrendingUp',
  'Coins',
]

const COLOR_CHOICES = [
  '#16A34A',
  '#2563EB',
  '#9333EA',
  '#0D9488',
  '#CA8A04',
  '#DC2626',
  '#EA580C',
  '#4F46E5',
  '#DB2777',
  '#78716C',
]

interface AccountFormProps {
  existing?: Account
  onSaved: () => void
  onCancel: () => void
}

export function AccountForm({ existing, onSaved, onCancel }: AccountFormProps) {
  const [name, setName] = useState(existing?.name ?? '')
  const [type, setType] = useState<AccountType>(existing?.type ?? 'bank')
  const [icon, setIcon] = useState(existing?.icon ?? 'Wallet')
  const [color, setColor] = useState(existing?.color ?? COLOR_CHOICES[0])
  const [openingBalance, setOpeningBalance] = useState<number | null>(existing?.openingBalance ?? 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (existing) {
        await AccountService.update(existing.id, { name, icon, color })
      } else {
        await AccountService.create({
          name,
          type,
          icon,
          color,
          openingBalance: openingBalance ?? 0,
        })
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this account.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-24">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Account name"
        autoFocus
        aria-label="Account name"
        className="min-h-touch rounded-md border border-border bg-surface-card px-16 text-body text-text-primary outline-none placeholder:text-text-tertiary"
      />

      {!existing && (
        <div className="flex flex-col gap-8">
          <span className="text-overline text-text-tertiary">Type</span>
          <div role="radiogroup" aria-label="Account type" className="flex flex-wrap gap-8">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={type === opt.value}
                onClick={() => setType(opt.value)}
                className={cn(
                  'min-h-touch rounded-full border px-16 text-body-sm font-medium transition-colors duration-fast',
                  type === opt.value
                    ? 'border-income bg-income-subtle text-income'
                    : 'border-border bg-surface-card text-text-secondary'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">Icon</span>
        <div className="flex flex-wrap gap-8">
          {ICON_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={icon === choice}
              onClick={() => setIcon(choice)}
              className={cn(
                'flex size-40 items-center justify-center rounded-full border transition-colors duration-fast',
                icon === choice ? 'border-income bg-income-subtle' : 'border-border bg-surface-card'
              )}
            >
              <DynamicIcon name={choice} className="size-24" style={{ color }} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">Color</span>
        <div className="flex flex-wrap gap-8">
          {COLOR_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={color === choice}
              onClick={() => setColor(choice)}
              className={cn(
                'size-32 rounded-full border-2',
                color === choice ? 'border-text-primary' : 'border-transparent'
              )}
              style={{ backgroundColor: choice }}
              aria-label={choice}
            />
          ))}
        </div>
      </div>

      {!existing && (
        <div className="flex flex-col gap-8">
          <span className="text-overline text-text-tertiary">Opening Balance</span>
          <CurrencyInput value={openingBalance} onChange={setOpeningBalance} />
        </div>
      )}

      {error && <p className="text-body-sm text-expense">{error}</p>}

      <div className="flex justify-end gap-8">
        <Button variant="tertiary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!name.trim()} loading={saving}>
          {existing ? 'Save Changes' : 'Add Account'}
        </Button>
      </div>
    </div>
  )
}
