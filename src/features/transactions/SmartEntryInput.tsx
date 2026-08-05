import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { SmartEntryParser } from '@/services/SmartEntryParser'
import { CategorizationService } from '@/services/CategorizationService'
import { DuplicateDetectionService } from '@/services/DuplicateDetectionService'
import { TransactionService, type CreateTransactionInput } from '@/services/TransactionService'
import { CategorySelector } from '@/components/forms/CategorySelector'
import { AccountSelector } from '@/components/forms/AccountSelector'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'
import type { Transaction } from '@/types/entities'

/** Confidence bands, §7: >0.9 auto-assign, 0.7–0.89 assign + confirm (both
 * pre-select here — the difference in this UI is just that low-confidence
 * ones show the "Suggested" hint more prominently), <0.7 ask the user
 * outright (left unselected). */
const AUTO_ASSIGN_THRESHOLD = 0.7

interface SmartEntryInputProps {
  onSaved: (transaction: Transaction, wasEdit: boolean) => void
  /** Pre-fills from a Favorite (§3 quick re-entry) or from "edit" mode. */
  initial?: Partial<CreateTransactionInput>
  editingId?: string
}

export function SmartEntryInput({ onSaved, initial, editingId }: SmartEntryInputProps) {
  const [rawText, setRawText] = useState(
    initial ? `${initial.amount ?? ''} ${initial.description ?? ''}`.trim() : ''
  )
  const [manualType, setManualType] = useState<'expense' | 'income' | null>(initial?.type ?? null)
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null)
  const [accountId, setAccountId] = useState<string | null>(initial?.accountId ?? 'acc-cash')
  const [suggestion, setSuggestion] = useState<{ categoryId: string; confidence: number } | null>(
    null
  )
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoryTouched, setCategoryTouched] = useState(Boolean(initial?.categoryId))

  const parsed = useMemo(() => SmartEntryParser.parse(rawText), [rawText])
  // Inferred from parsing unless the user has manually toggled it — derived
  // at render time rather than synced via an effect (no need for one).
  const type = manualType ?? parsed.type
  // Gate display at the usage site rather than clearing `suggestion`/
  // `duplicateWarning` synchronously inside the effects below — that keeps
  // both effects "subscribe to an async result" instead of "setState in the
  // effect body," which is what react-hooks/set-state-in-effect wants.
  const activeSuggestion = parsed.description ? suggestion : null
  const activeDuplicateWarning =
    parsed.amount && parsed.description && accountId ? duplicateWarning : null

  // Live category suggestion as the description settles.
  useEffect(() => {
    if (!parsed.description) return
    let cancelled = false
    CategorizationService.suggest(parsed.description).then((result) => {
      if (cancelled || result.source === 'none') return
      setSuggestion({ categoryId: result.categoryId, confidence: result.confidence })
      if (!categoryTouched && result.confidence >= AUTO_ASSIGN_THRESHOLD) {
        setCategoryId(result.categoryId)
      }
    })
    return () => {
      cancelled = true
    }
    // categoryTouched intentionally excluded — this effect should only
    // react to the description changing, not to the user touching category.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.description])

  // Duplicate detection once we have enough to check.
  useEffect(() => {
    if (!parsed.amount || !parsed.description || !accountId) return
    let cancelled = false
    DuplicateDetectionService.findPossibleDuplicate(
      {
        amount: parsed.amount,
        description: parsed.description,
        transactionDate: new Date().toISOString(),
        accountId,
      },
      editingId
    ).then((match) => {
      if (cancelled) return
      setDuplicateWarning(
        match
          ? `Possible duplicate — ₹${match.amount} "${match.description}" already logged recently.`
          : null
      )
      setConfirmedDuplicate(false)
    })
    return () => {
      cancelled = true
    }
  }, [parsed.amount, parsed.description, accountId, editingId])

  const canSave = Boolean(parsed.amount && parsed.amount > 0 && categoryId && accountId)

  async function handleSave() {
    if (!canSave || !parsed.amount || !categoryId || !accountId) return
    if (activeDuplicateWarning && !confirmedDuplicate) {
      setConfirmedDuplicate(true)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const input: CreateTransactionInput = {
        amount: parsed.amount,
        description: parsed.description || (type === 'income' ? 'Income' : 'Expense'),
        type,
        categoryId,
        accountId,
        transactionDate: new Date().toISOString(),
      }

      const transaction = editingId
        ? await TransactionService.update(editingId, input)
        : await TransactionService.create(input)

      onSaved(transaction, Boolean(editingId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this transaction.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-24">
      <div>
        <input
          autoFocus
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder='Try "250 tea" or "8000 EMI"'
          aria-label="Transaction description and amount"
          className="w-full border-b border-border bg-transparent pb-8 text-h2 text-text-primary outline-none placeholder:text-text-tertiary"
        />
        {parsed.amount ? (
          <p className="mt-8 text-body-sm text-text-secondary">
            <span className="font-medium tabular-nums text-text-primary">₹{parsed.amount}</span>
            {parsed.description && <> · {parsed.description}</>}
          </p>
        ) : (
          <p className="mt-8 text-body-sm text-text-tertiary">Enter an amount to continue.</p>
        )}
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
            onClick={() => setManualType(t)}
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
        <div className="flex items-center justify-between">
          <span className="text-overline text-text-tertiary">Category</span>
          {activeSuggestion &&
            !categoryTouched &&
            activeSuggestion.confidence < AUTO_ASSIGN_THRESHOLD && (
              <span className="text-caption text-income">Suggested — tap to confirm</span>
            )}
        </div>
        <CategorySelector
          value={categoryId}
          onChange={(id) => {
            setCategoryId(id)
            setCategoryTouched(true)
          }}
          suggestedCategoryId={activeSuggestion?.categoryId}
        />
      </div>

      {activeDuplicateWarning && (
        <div className="flex items-start gap-8 rounded-md border border-warning/40 bg-warning-subtle p-12 text-body-sm text-text-primary">
          <AlertTriangle className="mt-4 size-16 shrink-0 text-warning" aria-hidden="true" />
          <span>{activeDuplicateWarning}</span>
        </div>
      )}

      {error && <p className="text-body-sm text-expense">{error}</p>}

      <Button variant="primary" size="lg" onClick={handleSave} disabled={!canSave} loading={saving}>
        {activeDuplicateWarning && !confirmedDuplicate ? 'Save Anyway' : 'Save'}
      </Button>
    </div>
  )
}
