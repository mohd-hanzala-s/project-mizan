import {
  addDays,
  addMonths,
  addYears,
  differenceInDays,
  differenceInMonths,
  startOfDay,
} from 'date-fns'
import { db } from '@/database/db'
import { AccountRepository } from '@/repositories/AccountRepository'
import { RecurringRepository } from '@/repositories/RecurringRepository'
import { TransactionService } from '@/services/TransactionService'
import type { DashboardAlert } from '@/services/DashboardService'
import type { RecurringFrequency, RecurringRule, Transaction } from '@/types/entities'

const DAY_MS = 24 * 60 * 60 * 1000

/** Safety valve on the catch-up loop. A rule that fell years behind while
 * the app was closed should still catch up in bounded batches (see §4
 * "background processing") rather than stamping out hundreds of rows at
 * once — roughly a year of daily entries per rule, per generation pass. */
const MAX_CATCH_UP = 366

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  halfYearly: 'Half-Yearly',
  yearly: 'Yearly',
  custom: 'Custom',
}

/** Next occurrence after `date` for a rule's frequency. `addMonths` clamps
 * day-of-month to month-end (§10 "month-end transitions"), so a rule that
 * starts on the 31st lands on the 28th/29th/30th in shorter months. */
export function addOccurrence(
  date: Date,
  frequency: RecurringFrequency,
  customIntervalDays?: number
): Date {
  switch (frequency) {
    case 'daily':
      return addDays(date, 1)
    case 'weekly':
      return addDays(date, 7)
    case 'monthly':
      return addMonths(date, 1)
    case 'quarterly':
      return addMonths(date, 3)
    case 'halfYearly':
      return addMonths(date, 6)
    case 'yearly':
      return addYears(date, 1)
    case 'custom':
      return addDays(date, customIntervalDays ?? 0)
  }
}

/**
 * First scheduled occurrence on or after `after`, starting from
 * `startDate`. Uses a difference-based fast path so a rule with a
 * startDate years in the past isn't a loop over every single day/week.
 */
export function computeNextExecution(
  startDate: string,
  frequency: RecurringFrequency,
  customIntervalDays: number | undefined,
  after: Date
): Date {
  let next = startOfDay(new Date(`${startDate}T00:00:00`))
  const anchor = startOfDay(after)

  if (next < anchor) {
    if (frequency === 'daily' || frequency === 'weekly' || frequency === 'custom') {
      const days =
        frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : (customIntervalDays ?? 0)
      if (days > 0) {
        const skip = Math.floor(differenceInDays(anchor, next) / days) * days
        next = addDays(next, skip)
      }
    } else {
      const months =
        frequency === 'monthly'
          ? 1
          : frequency === 'quarterly'
            ? 3
            : frequency === 'halfYearly'
              ? 6
              : 12
      const skip = Math.floor(differenceInMonths(anchor, next) / months) * months
      next = addMonths(next, skip)
    }
    while (next < anchor) next = addOccurrence(next, frequency, customIntervalDays)
  }

  return next
}

export interface CreateRecurringRuleInput {
  title: string
  amount: number
  type: 'expense' | 'income'
  categoryId: string
  accountId: string
  frequency: RecurringFrequency
  /** ISO date (yyyy-mm-dd). */
  startDate: string
  /** ISO date (yyyy-mm-dd) or null for no end. */
  endDate: string | null
  autoGenerate: boolean
  reminderDays: number
  customIntervalDays?: number
}

export type UpdateRecurringRuleInput = CreateRecurringRuleInput

export interface UpcomingObligation {
  ruleId: string
  title: string
  amount: number
  type: 'expense' | 'income'
  date: Date
}

/** Phase 5's contribution to the future ForecastService (§6 Forecasts:
 * "upcoming obligations … combining … recurring rules"): the next scheduled
 * occurrence of each active rule within `horizonDays`, soonest first. Pure
 * and deterministic so Phase 8 can reuse it directly. */
export function getUpcomingObligations(
  rules: RecurringRule[],
  horizonDays = 30,
  reference = new Date()
): UpcomingObligation[] {
  const today = startOfDay(reference)
  const horizon = addDays(today, horizonDays)

  return rules
    .filter((r) => r.active)
    .map((r) => ({ rule: r, next: new Date(r.nextExecution) }))
    .filter(({ next }) => next >= today && next <= horizon)
    .map(({ rule, next }) => ({
      ruleId: rule.id,
      title: rule.title,
      amount: rule.amount,
      type: rule.type,
      date: next,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

/**
 * Dashboard alerts for the recurring engine, derived on demand (not
 * persisted — same decision as Budget's threshold notifications: there is
 * no NotificationLog yet, so reminders are recomputed each render instead
 * of being written somewhere and synced):
 * - **Missed** (warning): a `pending` auto-generated entry whose due date
 *   has passed unacknowledged (§6 "missed-expense detection").
 * - **Upcoming** (info): the next occurrence of an active rule falls
 *   within its `reminderDays` window (0 = today).
 * Both are naturally deduplicated — one row/rule each — so they can't spam
 * the feed, which is exactly what a real notification log would be for.
 */
export function getRecurringAlerts(
  rules: RecurringRule[],
  transactions: Transaction[],
  reference = new Date()
): DashboardAlert[] {
  const today = startOfDay(reference)
  const alerts: DashboardAlert[] = []

  for (const t of transactions) {
    if (t.isDeleted || t.status !== 'pending' || t.source !== 'auto') continue
    const due = startOfDay(new Date(t.transactionDate))
    if (due >= today) continue
    alerts.push({
      id: `recurring-missed-${t.id}`,
      message: `"${t.description}" of ₹${t.amount.toLocaleString('en-IN')} due ${due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} hasn't been paid yet.`,
      severity: 'warning',
    })
  }

  for (const rule of rules) {
    if (!rule.active) continue
    const daysUntil = Math.round(
      (startOfDay(new Date(rule.nextExecution)).getTime() - today.getTime()) / DAY_MS
    )
    if (daysUntil < 0 || daysUntil > rule.reminderDays) continue
    const when = daysUntil === 0 ? 'today' : `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`
    alerts.push({
      id: `recurring-upcoming-${rule.id}`,
      message: `${rule.title} of ₹${rule.amount.toLocaleString('en-IN')} is due ${when}.`,
      severity: 'info',
    })
  }

  return alerts
}

async function validateInput(input: CreateRecurringRuleInput): Promise<void> {
  if (!input.title.trim()) throw new Error('Rule title is required.')
  if (!(input.amount > 0)) throw new Error('Amount is required and must be greater than 0.')
  if (input.frequency === 'custom' && !(input.customIntervalDays && input.customIntervalDays > 0)) {
    throw new Error('Custom frequency needs a positive day interval.')
  }
  if (!Number.isFinite(new Date(`${input.startDate}T00:00:00`).getTime())) {
    throw new Error('Start date is required.')
  }
  if (input.endDate && new Date(input.endDate) < new Date(input.startDate)) {
    throw new Error('End date must be on or after the start date.')
  }

  // §6: "recurring rules can't reference deleted categories." Same guard
  // for accounts — an archived account is still a valid target (its history
  // persists), but a missing one means generation would silently post into
  // nowhere.
  const [category, account] = await Promise.all([
    db.categories.get(input.categoryId),
    AccountRepository.getById(input.accountId),
  ])
  if (!category || category.isArchived) throw new Error('Choose a category that exists.')
  if (!account) throw new Error('Account not found.')
}

/** Single-flight guard so concurrent callers (AppShell startup + the
 * Recurring page's store) can't both read the same `nextExecution` and
 * stamp out duplicate pending entries. */
let generationInFlight: Promise<Transaction[]> | null = null

export const RecurringService = {
  computeNextExecution,
  addOccurrence,

  async create(input: CreateRecurringRuleInput): Promise<RecurringRule> {
    await validateInput(input)

    const now = new Date().toISOString()
    const rule: RecurringRule = {
      id: crypto.randomUUID(),
      title: input.title.trim(),
      amount: input.amount,
      type: input.type,
      categoryId: input.categoryId,
      accountId: input.accountId,
      frequency: input.frequency,
      startDate: input.startDate,
      endDate: input.endDate,
      nextExecution: computeNextExecution(input.startDate, input.frequency, input.customIntervalDays, new Date()).toISOString(),
      autoGenerate: input.autoGenerate,
      reminderDays: input.reminderDays,
      active: true,
      customIntervalDays: input.frequency === 'custom' ? input.customIntervalDays : undefined,
      createdAt: now,
      updatedAt: now,
    }
    await RecurringRepository.add(rule)
    return rule
  },

  /** Full replace of the editable fields. When a schedule-affecting field
   * changes (frequency, start date, custom interval), `nextExecution` is
   * recomputed from today so the rule starts fresh under its new schedule —
   * it doesn't try to back-fill periods that never existed. */
  async update(id: string, input: UpdateRecurringRuleInput): Promise<void> {
    const existing = await RecurringRepository.getById(id)
    if (!existing) throw new Error('Recurring rule not found.')
    await validateInput(input)

    const scheduleChanged =
      input.frequency !== existing.frequency ||
      input.startDate !== existing.startDate ||
      input.customIntervalDays !== existing.customIntervalDays

    await RecurringRepository.update(id, {
      title: input.title.trim(),
      amount: input.amount,
      type: input.type,
      categoryId: input.categoryId,
      accountId: input.accountId,
      frequency: input.frequency,
      startDate: input.startDate,
      endDate: input.endDate,
      autoGenerate: input.autoGenerate,
      reminderDays: input.reminderDays,
      customIntervalDays: input.frequency === 'custom' ? input.customIntervalDays : undefined,
      nextExecution: scheduleChanged
        ? computeNextExecution(input.startDate, input.frequency, input.customIntervalDays, new Date()).toISOString()
        : existing.nextExecution,
    })
  },

  /** §9 Phase 5 "pause/resume". Pausing keeps the rule (and its history)
   * but stops generation; `nextExecution` is left untouched so the pause is
   * fully reversible. */
  async pause(id: string): Promise<void> {
    const existing = await RecurringRepository.getById(id)
    if (!existing) throw new Error('Recurring rule not found.')
    await RecurringRepository.update(id, { active: false })
  },

  /** Re-arms a paused rule from today — deliberately does NOT back-fill the
   * periods it was paused through (the pause was intentional), so
   * `nextExecution` is recomputed as the first occurrence on/after now. */
  async resume(id: string): Promise<void> {
    const existing = await RecurringRepository.getById(id)
    if (!existing) throw new Error('Recurring rule not found.')
    await RecurringRepository.update(id, {
      active: true,
      nextExecution: computeNextExecution(
        existing.startDate,
        existing.frequency,
        existing.customIntervalDays,
        new Date()
      ).toISOString(),
    })
  },

  /** §9 Phase 5 "skip": advance past the next occurrence without generating
   * an entry for it. Applies whether or not that occurrence has already come
   * due — skipping a due-but-unpaid cycle is exactly the point. */
  async skipNext(id: string): Promise<void> {
    const existing = await RecurringRepository.getById(id)
    if (!existing) throw new Error('Recurring rule not found.')
    const next = addOccurrence(
      new Date(existing.nextExecution),
      existing.frequency,
      existing.customIntervalDays
    )
    await RecurringRepository.update(id, { nextExecution: next.toISOString() })
  },

  /** Hard-removes the rule. Generated transactions are independent records
   * and keep `recurringRuleId` (§10 edge case: "deleted … recurring rules"
   * must not break existing data) — deleting a rule only stops future
   * generation; its history stays. */
  async remove(id: string): Promise<void> {
    const existing = await RecurringRepository.getById(id)
    if (!existing) throw new Error('Recurring rule not found.')
    await RecurringRepository.delete(id)
  },

  /**
   * §6/§9 Phase 5 auto-generation. For every active rule whose
   * `nextExecution` has arrived, creates a `pending` entry per occurrence
   * (`autoGenerate` only — rules set to remind-only just advance their
   * schedule without writing transactions) and advances `nextExecution` past
   * `reference`. Catch-up is bounded (MAX_CATCH_UP) and single-flight
   * (callers can't race each other into duplicate rows). Entries never touch
   * account balances — that only happens when the user marks one Paid.
   */
  async generateDue(reference = new Date()): Promise<Transaction[]> {
    if (generationInFlight) return generationInFlight
    generationInFlight = this.runGeneration(reference).finally(() => {
      generationInFlight = null
    })
    return generationInFlight
  },

  async runGeneration(reference = new Date()): Promise<Transaction[]> {
    const rules = await RecurringRepository.getAll()
    const generated: Transaction[] = []

    for (const rule of rules) {
      let next = new Date(rule.nextExecution)
      if (next > reference) continue

      const account = rule.autoGenerate ? await AccountRepository.getById(rule.accountId) : undefined
      let previous: Date | null = null
      let iterations = 0
      let advanced = false

      while (next <= reference && iterations < MAX_CATCH_UP) {
        // Belt-and-suspenders against a schedule that can't advance (e.g. a
        // custom interval validated at 0 elsewhere): never create two rows
        // for the same occurrence.
        if (previous && next.getTime() <= previous.getTime()) break

        if (rule.autoGenerate && account && !account.isArchived) {
          generated.push(
            await TransactionService.createScheduled({
              amount: rule.amount,
              description: rule.title,
              type: rule.type,
              categoryId: rule.categoryId,
              accountId: rule.accountId,
              transactionDate: next.toISOString(),
              recurringRuleId: rule.id,
            })
          )
        }

        previous = next
        next = addOccurrence(next, rule.frequency, rule.customIntervalDays)
        iterations++
        advanced = true
      }

      if (advanced) {
        await RecurringRepository.update(rule.id, { nextExecution: next.toISOString() })
      }
    }

    return generated
  },
}
