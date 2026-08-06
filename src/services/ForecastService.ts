import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { isTransferCreditLeg } from "@/utils/transactions";
import {
  getCurrentPeriod,
  type DashboardAlert,
  type DateRange,
} from "@/services/DashboardService";
import {
  addOccurrence,
  computeNextExecution,
} from "@/services/RecurringService";
import { nextDueDate } from "@/services/LoanService";
import type {
  Account,
  Loan,
  RecurringRule,
  Transaction,
} from "@/types/entities";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Defensive cap on per-rule occurrence expansion — a daily rule yields at
 * most one obligation per day in the period, so this only guards pathological
 * rules while keeping the derivation O(rules × days-in-period). */
const MAX_OBLIGATIONS_PER_RULE = 62;

function inRange(dateStr: string, range: DateRange): boolean {
  const t = new Date(dateStr).getTime();
  return t >= range.start.getTime() && t < range.end.getTime();
}

function toStartOfDay(dateStr: string): Date {
  return startOfDay(new Date(dateStr));
}

export type ForecastObligationSource = "pending" | "recurring" | "loan";

/** A money movement the forecast treats as certain: an unpaid pending
 * transaction, a scheduled recurring occurrence, or a loan EMI due date.
 * `amount` is signed (negative = money out). */
export interface ForecastObligation {
  /** Stable id: `pending-<txId>` / `recurring-<ruleId>-<yyyy-mm-dd>` /
   * `loan-<loanId>-<yyyy-mm-dd>`. */
  id: string;
  title: string;
  amount: number;
  date: Date;
  source: ForecastObligationSource;
}

export type ForecastConfidence = "high" | "medium" | "low";

export interface ForecastInput {
  transactions: Transaction[];
  accounts: Account[];
  recurringRules: RecurringRule[];
  loans: Loan[];
  budgetMonthStart: number;
  reference?: Date;
}

/**
 * §6 Forecasts (Phase 8): "month-end spending, expected balance, upcoming
 * obligations, expected savings — combining historical averages, recurring
 * rules, pending payments, current-month trend. State explicitly when
 * confidence is low."
 *
 * Model — each piece is deliberately computed so nothing double counts:
 * - **Actuals** (`actualIncome/Expense`) are *paid* transactions inside the
 *   current budget period, matching DashboardService.computeMetrics exactly.
 * - **Certain future cashflows** are the union of three mutually exclusive
 *   sets (see obligations below): unpaid pending transactions dated on/after
 *   today, active auto-generating recurring-rule occurrences on/after today,
 *   and loan EMIs due from today through the period end. Each scheduled
 *   occurrence is counted exactly once — an auto-generated pending row for a
 *   still-active rule is dropped in favour of its projected schedule entry,
 *   and remind-only rules project nothing (their manually-entered payments
 *   are ordinary spend, captured by the run-rate).
 * - **Run-rate** extrapolates the *uncertain* remainder from the current-month
 *   trend (spent-per-day-so-far × remaining days, the same shape §6's budget
 *   "current pace × remaining days" uses). Only paid, non-recurring-generated
 *   transactions count, so the trend never re-counts what the schedule
 *   already projects.
 *
 * Derived on demand (nothing persisted) — same decision as the alert feeds
 * and CalendarService: no forecast table exists in the schema, so the whole
 * forecast is recomputed each render from the stores that already exist.
 */
export function getForecast(input: ForecastInput): Forecast {
  const reference = input.reference ?? new Date();
  const period = getCurrentPeriod(input.budgetMonthStart, reference);
  const today = startOfDay(reference);

  const daysInPeriod = Math.max(
    1,
    Math.round((period.end.getTime() - period.start.getTime()) / DAY_MS),
  );
  const daysElapsed = Math.min(
    daysInPeriod,
    Math.max(1, differenceInCalendarDays(today, period.start) + 1),
  );
  const remainingDays = daysInPeriod - daysElapsed;

  const activeRuleIds = new Set(
    input.recurringRules.filter((r) => r.active).map((r) => r.id),
  );
  const obligations = [
    ...pendingObligations(input.transactions, activeRuleIds, today, period.end),
    ...recurringObligations(input.recurringRules, today, period.end),
    ...loanObligations(input.loans, today, period.end),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const actualIncome = sumActual(input.transactions, "income", period);
  const actualExpense = sumActual(input.transactions, "expense", period);

  const certainFutureIncome = obligations
    .filter((o) => o.amount > 0)
    .reduce((sum, o) => sum + o.amount, 0);
  const certainFutureExpense = obligations
    .filter((o) => o.amount < 0)
    .reduce((sum, o) => sum - o.amount, 0);

  const { incomeRate, expenseRate } = ordinaryRunRates(
    input.transactions,
    period,
    today,
  );
  const trendIncome = incomeRate * remainingDays;
  const trendExpense = expenseRate * remainingDays;

  const futureIncome = certainFutureIncome + trendIncome;
  const futureExpense = certainFutureExpense + trendExpense;

  const monthEndIncome = actualIncome + futureIncome;
  const monthEndExpense = actualExpense + futureExpense;
  const expectedSavings = monthEndIncome - monthEndExpense;

  const totalBalance = input.accounts
    .filter((a) => !a.isArchived)
    .reduce((sum, a) => sum + a.currentBalance, 0);
  const expectedBalance = totalBalance + futureIncome - futureExpense;

  const { confidence, confidenceReason } = assessConfidence(
    input.transactions,
    period,
    today,
    daysElapsed,
    daysInPeriod,
  );

  return {
    period,
    today,
    daysInPeriod,
    daysElapsed,
    remainingDays,
    actualIncome,
    actualExpense,
    futureIncome,
    futureExpense,
    monthEndIncome,
    monthEndExpense,
    expectedSavings,
    expectedBalance,
    obligations,
    confidence,
    confidenceReason,
  };
}

export interface Forecast {
  period: DateRange;
  today: Date;
  daysInPeriod: number;
  daysElapsed: number;
  remainingDays: number;
  /** Paid income within the period so far. */
  actualIncome: number;
  /** Paid expense within the period so far. */
  actualExpense: number;
  /** Projected income for the rest of the period (obligations + trend). */
  futureIncome: number;
  /** Projected expense for the rest of the period (obligations + trend). */
  futureExpense: number;
  /** actualIncome + futureIncome. */
  monthEndIncome: number;
  /** actualExpense + futureExpense. */
  monthEndExpense: number;
  /** monthEndIncome − monthEndExpense — the period's projected savings. */
  expectedSavings: number;
  /** Total current account balance + (futureIncome − futureExpense). */
  expectedBalance: number;
  obligations: ForecastObligation[];
  confidence: ForecastConfidence;
  confidenceReason: string;
}

/** Unpaid pending transactions dated on/after today. An auto-generated
 * pending row whose rule is still active is skipped — its occurrence is the
 * same economic event the schedule already projects, and counting both would
 * double-count it. Auto pendings for paused/missing rules are kept, since
 * nothing else projects them. */
function pendingObligations(
  transactions: Transaction[],
  activeRuleIds: Set<string>,
  start: Date,
  end: Date,
): ForecastObligation[] {
  const out: ForecastObligation[] = [];
  for (const t of transactions) {
    if (t.isDeleted || t.status !== "pending") continue;
    if (t.type === "transfer" || isTransferCreditLeg(t)) continue;
    if (t.type !== "expense" && t.type !== "income" && t.type !== "refund")
      continue;
    if (
      t.source === "auto" &&
      t.recurringRuleId &&
      activeRuleIds.has(t.recurringRuleId)
    ) {
      continue;
    }
    const date = toStartOfDay(t.transactionDate);
    if (date.getTime() < start.getTime() || date.getTime() >= end.getTime())
      continue;
    out.push({
      id: `pending-${t.id}`,
      title: t.description.trim() || "Pending payment",
      amount: t.type === "expense" ? -t.amount : t.amount,
      date,
      source: "pending",
    });
  }
  return out;
}

/** Future scheduled occurrences of active *auto-generating* rules, from today
 * through the period end. Remind-only rules (autoGenerate=false) project
 * nothing: their payments are entered by hand, appear in the run-rate as
 * ordinary spend, and would be double-counted if the schedule claimed them
 * too. */
function recurringObligations(
  rules: RecurringRule[],
  start: Date,
  end: Date,
): ForecastObligation[] {
  const out: ForecastObligation[] = [];
  for (const rule of rules) {
    if (!rule.active || !rule.autoGenerate) continue;
    let occ = computeNextExecution(
      rule.startDate,
      rule.frequency,
      rule.customIntervalDays,
      start,
    );
    let guard = 0;
    while (occ.getTime() < end.getTime() && guard < MAX_OBLIGATIONS_PER_RULE) {
      out.push({
        id: `recurring-${rule.id}-${occ.toISOString().slice(0, 10)}`,
        title: rule.title,
        amount: rule.type === "income" ? rule.amount : -rule.amount,
        date: occ,
        source: "recurring",
      });
      occ = addOccurrence(occ, rule.frequency, rule.customIntervalDays);
      guard++;
    }
  }
  return out;
}

/** Loan EMIs due from today through the period end. `nextDueDate` is anchored
 * one day back so an EMI due *today* still counts as upcoming; a period can
 * rarely span more than two EMIs, but the loop stays bounded defensively. */
function loanObligations(
  loans: Loan[],
  start: Date,
  end: Date,
): ForecastObligation[] {
  const out: ForecastObligation[] = [];
  for (const loan of loans) {
    if (loan.status !== "active" || loan.currentBalance <= 0) continue;
    let anchor = addDays(start, -1);
    let guard = 0;
    for (;;) {
      const due = nextDueDate(loan, anchor);
      if (!due) break;
      if (due.getTime() >= end.getTime()) break;
      if (due.getTime() >= start.getTime()) {
        out.push({
          id: `loan-${loan.id}-${due.toISOString().slice(0, 10)}`,
          title: `EMI · ${loan.loanName}`,
          amount: -loan.monthlyEMI,
          date: due,
          source: "loan",
        });
      }
      anchor = due;
      guard++;
      if (guard >= 6) break;
    }
  }
  return out;
}

function sumActual(
  transactions: Transaction[],
  type: "income" | "expense",
  range: DateRange,
): number {
  return transactions
    .filter(
      (t) =>
        !t.isDeleted &&
        t.status === "paid" &&
        t.type === type &&
        inRange(t.transactionDate, range),
    )
    .reduce((sum, t) => sum + t.amount, 0);
}

/** "Current-month trend" for the uncertain remainder. Only paid, ordinary
 * (non recurring-generated) activity counts, so unpaid entries and the
 * projected schedule never leak into the run-rate and get counted twice. */
function ordinaryRunRates(
  transactions: Transaction[],
  range: DateRange,
  today: Date,
): { incomeRate: number; expenseRate: number } {
  let expense = 0;
  let income = 0;
  for (const t of transactions) {
    if (t.isDeleted || t.status !== "paid") continue;
    if (t.type === "transfer" || isTransferCreditLeg(t)) continue;
    if (t.recurringRuleId) continue;
    const date = toStartOfDay(t.transactionDate);
    if (
      date.getTime() < range.start.getTime() ||
      date.getTime() > today.getTime()
    ) {
      continue;
    }
    if (t.type === "expense") expense += t.amount;
    else if (t.type === "income" || t.type === "refund") income += t.amount;
  }
  const daysElapsed = Math.max(
    1,
    differenceInCalendarDays(today, range.start) + 1,
  );
  return {
    incomeRate: income / daysElapsed,
    expenseRate: expense / daysElapsed,
  };
}

/** §6 "State explicitly when confidence is low." Confidence is about how much
 * observed trend the projection has to lean on — no activity yet, or barely
 * any elapsed days, makes the run-rate guess too weak to trust. */
function assessConfidence(
  transactions: Transaction[],
  range: DateRange,
  today: Date,
  daysElapsed: number,
  daysInPeriod: number,
): { confidence: ForecastConfidence; confidenceReason: string } {
  const hasActivity = transactions.some((t) => {
    if (t.isDeleted || t.type === "transfer" || isTransferCreditLeg(t))
      return false;
    const date = toStartOfDay(t.transactionDate);
    return (
      date.getTime() >= range.start.getTime() &&
      date.getTime() <= today.getTime()
    );
  });

  if (!hasActivity) {
    return {
      confidence: "low",
      confidenceReason:
        "No activity recorded yet this period — this projection is a placeholder, not a prediction.",
    };
  }
  if (daysElapsed < 3) {
    return {
      confidence: "low",
      confidenceReason:
        "Too few days of activity to project reliably — check back mid-month.",
    };
  }
  if (daysElapsed * 2 < daysInPeriod) {
    return {
      confidence: "medium",
      confidenceReason:
        "Based on a partial month — the projection firms up as the period progresses.",
    };
  }
  return {
    confidence: "high",
    confidenceReason: "Based on a well-observed month.",
  };
}

/** §6 critical priority list includes a "negative balance forecast" — surface
 * it (and a projected overspend) through the same derived Dashboard alert
 * feed as the other phases, since no notification log exists yet. */
export function getForecastAlerts(forecast: Forecast): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  if (forecast.expectedBalance < 0) {
    alerts.push({
      id: "forecast-negative-balance",
      message: `Your balance is projected to reach −₹${Math.abs(forecast.expectedBalance).toLocaleString("en-IN")} by the end of this period.`,
      severity: "warning",
    });
  }
  if (forecast.expectedSavings < 0) {
    alerts.push({
      id: "forecast-negative-savings",
      message: `You're projected to spend ₹${Math.abs(forecast.expectedSavings).toLocaleString("en-IN")} more than you earn this period.`,
      severity: "warning",
    });
  }
  return alerts;
}

export const ForecastService = {
  getForecast,
  getForecastAlerts,
};
