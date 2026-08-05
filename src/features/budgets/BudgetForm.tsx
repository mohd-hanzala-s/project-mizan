import { useEffect, useState } from 'react'
import { Landmark } from 'lucide-react'
import { db } from '@/database/db'
import { BudgetRepository } from '@/repositories/BudgetRepository'
import { BudgetService } from '@/services/BudgetService'
import { GLOBAL_BUDGET_CATEGORY_ID, type Budget, type Category } from '@/types/entities'
import { CurrencyInput } from '@/components/forms/CurrencyInput'
import { DynamicIcon } from '@/components/common/DynamicIcon'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

interface BudgetFormProps {
  editing?: Budget
  onSaved: () => void
  onCancel: () => void
}

export function BudgetForm({ editing, onSaved, onCancel }: BudgetFormProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [budgetedCategoryIds, setBudgetedCategoryIds] = useState<Set<string>>(new Set())
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId ?? null)
  const [monthlyLimit, setMonthlyLimit] = useState<number | null>(editing?.monthlyLimit ?? null)
  const [rolloverEnabled, setRolloverEnabled] = useState(editing?.rolloverEnabled ?? false)
  const [warningThreshold, setWarningThreshold] = useState(editing?.warningThreshold ?? 80)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    db.categories.toArray().then((all) => setCategories(all.filter((c) => !c.isArchived)))
    BudgetRepository.getAll().then((all) =>
      setBudgetedCategoryIds(new Set(all.map((b) => b.categoryId)))
    )
  }, [])

  const canSave = Boolean(categoryId && monthlyLimit && monthlyLimit > 0)

  async function handleSave() {
    if (!canSave || !categoryId || !monthlyLimit) return
    setSaving(true)
    setError(null)
    try {
      if (editing) {
        await BudgetService.update(editing.id, { monthlyLimit, rolloverEnabled, warningThreshold })
      } else {
        await BudgetService.create({ categoryId, monthlyLimit, rolloverEnabled, warningThreshold })
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this budget.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-24">
      {!editing && (
        <div className="flex flex-col gap-8">
          <span className="text-overline text-text-tertiary">Category</span>
          <div role="radiogroup" aria-label="Category" className="grid grid-cols-4 gap-8">
            <button
              type="button"
              role="radio"
              aria-checked={categoryId === GLOBAL_BUDGET_CATEGORY_ID}
              disabled={budgetedCategoryIds.has(GLOBAL_BUDGET_CATEGORY_ID)}
              onClick={() => setCategoryId(GLOBAL_BUDGET_CATEGORY_ID)}
              className={cn(
                'flex min-h-touch flex-col items-center gap-4 rounded-md border p-8 text-center disabled:opacity-40',
                categoryId === GLOBAL_BUDGET_CATEGORY_ID
                  ? 'border-income bg-income-subtle'
                  : 'border-border bg-surface-card hover:bg-neutral-100 dark:hover:bg-neutral-800'
              )}
            >
              <span className="flex size-32 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                <Landmark className="size-16" aria-hidden="true" />
              </span>
              <span className="text-caption text-text-secondary">Overall</span>
            </button>
            {categories.map((category) => {
              const disabled = budgetedCategoryIds.has(category.id)
              const selected = categoryId === category.id
              return (
                <button
                  key={category.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => setCategoryId(category.id)}
                  className={cn(
                    'flex min-h-touch flex-col items-center gap-4 rounded-md border p-8 text-center disabled:opacity-40',
                    selected
                      ? 'border-income bg-income-subtle'
                      : 'border-border bg-surface-card hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  )}
                >
                  <span
                    className="flex size-32 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${category.color}22`, color: category.color }}
                  >
                    <DynamicIcon name={category.icon} className="size-16" />
                  </span>
                  <span className="text-caption text-text-secondary">{category.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-8">
        <span className="text-overline text-text-tertiary">Monthly Limit</span>
        <CurrencyInput value={monthlyLimit} onChange={setMonthlyLimit} autoFocus={!editing} />
      </div>

      <label className="flex min-h-touch items-center justify-between rounded-md border border-border bg-surface-card px-16">
        <span className="text-body-sm text-text-primary">Roll over unused budget next month</span>
        <input
          type="checkbox"
          checked={rolloverEnabled}
          onChange={(e) => setRolloverEnabled(e.target.checked)}
          className="size-16 accent-income"
        />
      </label>

      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <span className="text-overline text-text-tertiary">Warn me at</span>
          <span className="text-body-sm font-medium tabular-nums text-text-primary">
            {warningThreshold}%
          </span>
        </div>
        <input
          type="range"
          min={50}
          max={95}
          step={5}
          value={warningThreshold}
          onChange={(e) => setWarningThreshold(Number(e.target.value))}
          aria-label="Warning threshold percentage"
          className="accent-income"
        />
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
          {editing ? 'Save' : 'Create Budget'}
        </Button>
      </div>
    </div>
  )
}
