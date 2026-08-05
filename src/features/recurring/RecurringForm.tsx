import { useState } from 'react'
import { RecurringService, FREQUENCY_LABELS } from '@/services/RecurringService'
import type { RecurringFrequency, RecurringRule } from '@/types/entities'
import { CurrencyInput } from '@/components/forms/CurrencyInput'
import { CategorySelector } from '@/components/forms/CategorySelector'
import { AccountSelector } from '@/components/forms/AccountSelector'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

interface RecurringFormProps {
  editing?: RecurringRule
  onSaved: () => void
  onCancel: () => void
}

const FREQUENCIES: RecurringFrequency[] = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'halfYearly',
  'yearly',
  'custom',
]

export function RecurringForm({ editing, onSaved, onCancel }: RecurringFormProps) {
  const [title, setTitle] = useState(editing?.title ?? '')
  const [amount, setAmount] = useState<number | null>(editing?.amount ?? null)
  const [type, setType] = useState<'expense' | 'income'>(editing?.type ?? 'expense')
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId ?? null)
  const [accountId, setAccountId] = useState<string | null>(editing?.accountId ?? 'acc-cash')
  const [frequency, setFrequency] = useState<RecurringFrequency>(editing?.frequency ?? 'monthly')
  const [customIntervalDays, setCustomIntervalDays] = useState<number | null>(
    editing?.customIntervalDays ?? null
  )
  const [startDate, setStartDate] = useState(editing?.startDate ?? today())
  const [endDate, setEndDate] = useState(editing?.endDate ?? '')
  const [autoGenerate, setAutoGenerate] = useState(editing?.autoGenerate ?? true)
  const [reminderDays, setReminderDays] = useState(editing?.reminderDays ?? 3)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = Boolean(
    title.trim() &&
      amount &&
      amount > 0 &&
      categoryId &&
      accountId &&
      startDate &&
      (frequency !== 'custom' || (customIntervalDays && customIntervalDays > 0))
  )

  async function handleSave() {
    if (!canSave || !amount || !categoryId || !accountId) return
    setSaving(true)
    setError(null)
    const input = {
      title,
      amount,
      type,
      categoryId,
      accountId,
      frequency,
      startDate,
      endDate: endDate || null,
      autoGenerate,
      reminderDays,
      customIntervalDays: frequency === 'custom' ? customIntervalDays ?? undefined : undefined,
    }
    try {
      if (editing) {
        await RecurringService.update(editing.id, input)
      } else {
        await RecurringService.create(input)
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this rule.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-24">
      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Rent, Gym, Salary…"
          aria-label="Rule title"
          className="min-h-touch w-full rounded-md border border-border bg-surface-card px-12 text-body text-text-primary outline-none placeholder:text-text-tertiary focus:border-income"
        />
      </div>

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">Amount</span>
        <CurrencyInput value={amount} onChange={setAmount} autoFocus={!editing} />
      </div>

      <div
        role="radiogroup"
        aria-label="Transaction type"
        className="inline-flex self-start rounded-md bg-neutral-100 p-4 dark:bg-neutral-800"
      >
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => setType(t)}
            className={cn(
              'min-h-touch rounded-sm px-16 text-body-sm font-medium capitalize transition-colors duration-fast',
              type === t
                ? t === 'expense'
                  ? 'bg-surface-card text-expense shadow-card'
                  : 'bg-surface-card text-income shadow-card'
                : 'text-text-secondary'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">Account</span>
        <AccountSelector value={accountId} onChange={setAccountId} />
      </div>

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">Category</span>
        <CategorySelector value={categoryId} onChange={setCategoryId} />
      </div>

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">Frequency</span>
        <div role="radiogroup" aria-label="Frequency" className="grid grid-cols-4 gap-8">
          {FREQUENCIES.map((f) => {
            const selected = frequency === f
            return (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setFrequency(f)}
                className={cn(
                  'min-h-touch rounded-md border px-8 text-caption font-medium transition-colors duration-fast',
                  selected
                    ? 'border-income bg-income-subtle text-income'
                    : 'border-border bg-surface-card text-text-secondary'
                )}
              >
                {FREQUENCY_LABELS[f]}
              </button>
            )
          })}
        </div>
        {frequency === 'custom' && (
          <div className="flex items-center gap-12">
            <span className="text-body-sm text-text-secondary">Every</span>
            <input
              type="number"
              min={1}
              max={365}
              value={customIntervalDays ?? ''}
              onChange={(e) => setCustomIntervalDays(e.target.value ? Number(e.target.value) : null)}
              aria-label="Custom interval in days"
              className="w-24 rounded-md border border-border bg-surface-card px-12 py-8 text-body text-text-primary outline-none focus:border-income"
            />
            <span className="text-body-sm text-text-secondary">days</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-16">
        <div className="flex flex-col gap-8">
          <span className="text-overline text-text-tertiary">Starts</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Start date"
            className="min-h-touch rounded-md border border-border bg-surface-card px-12 text-body text-text-primary outline-none focus:border-income"
          />
        </div>
        <div className="flex flex-col gap-8">
          <span className="text-overline text-text-tertiary">Ends (optional)</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="End date"
            className="min-h-touch rounded-md border border-border bg-surface-card px-12 text-body text-text-primary outline-none focus:border-income"
          />
        </div>
      </div>

      <label className="flex min-h-touch items-center justify-between rounded-md border border-border bg-surface-card px-16">
        <span className="text-body-sm text-text-primary">Auto-generate a pending entry</span>
        <input
          type="checkbox"
          checked={autoGenerate}
          onChange={(e) => setAutoGenerate(e.target.checked)}
          className="size-16 accent-income"
        />
      </label>

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">Remind me</span>
        <div className="flex items-center gap-12">
          <input
            type="number"
            min={0}
            max={7}
            value={reminderDays}
            onChange={(e) =>
              setReminderDays(Math.min(7, Math.max(0, Number(e.target.value) || 0)))
            }
            aria-label="Days before the due date to remind"
            className="w-24 rounded-md border border-border bg-surface-card px-12 py-8 text-body text-text-primary outline-none focus:border-income"
          />
          <span className="text-body-sm text-text-secondary">
            day{reminderDays === 1 ? '' : 's'} before each due date
          </span>
        </div>
      </div>

      {error && <p className="text-body-sm text-expense">{error}</p>}

      <div className="flex gap-8">
        <Button variant="tertiary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!canSave}
          loading={saving}
          className="flex-1"
        >
          {editing ? 'Save' : 'Create Rule'}
        </Button>
      </div>
    </div>
  )
}

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
