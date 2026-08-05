import { startOfDay } from "date-fns";
import { isTransferCreditLeg } from "@/utils/transactions";
import {
  addOccurrence,
  computeNextExecution,
} from "@/services/RecurringService";
import { nextDueDate } from "@/services/LoanService";
import type {
  Loan,
  LoanPayment,
  RecurringRule,
  Transaction,
} from "@/types/entities";

/**
 * §9 Phase 7 — Calendar & Timeline. A derived "financial event" timeline:
 * every financial calendar is the union of (a) actual transaction activity,
 * (b) upcoming recurring-rule occurrences, and (c) loan EMI due dates plus
 * recorded EMI payments. Nothing here is persisted — §8 defers a
 * user-editable "financial events" entity to v1.2 (P2), so like the alert
 * feeds (Phases 4–6) these events are computed on demand from the data
 * stores that already exist.
 */

export type CalendarEventKind = "transaction" | "recurring" | "loan";

export interface CalendarEvent {
  /** Stable id: `tx-<id>` / `rec-<ruleId>-<yyyy-mm-dd>` / `loan-due-<id>` /
   * `loan-pay-<id>`. */
  id: string;
  /** Start-of-day the event lands on. */
  date: Date;
  kind: CalendarEventKind;
  title: string;
  /** Signed: positive is money in (income/refund), negative is money out
   * (expense, EMI dues, EMI payments). */
  amount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Defensive cap on per-rule occurrence expansion — a daily rule yields at
 * most one event per day in the month, so this only guards pathological
 * rules while keeping the derivation O(rules × days-in-month). */
const MAX_RECURRING_OCCURRENCES = 62;

function signedAmount(t: Transaction): number {
  return t.type === "expense" ? -t.amount : t.amount;
}

/** Transaction events exclude soft-deleted rows and transfer legs entirely —
 * transfers move money between the user's own accounts and are not income or
 * expense (§10 "transfers never affect income/expense totals"). Generated
 * recurring entries are included as transaction events (they're real money
 * movement once paid); recurring *schedule* events are future-only (see
 * below), so the two never double count. */
function transactionEvents(
  transactions: Transaction[],
  start: Date,
  end: Date,
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const t of transactions) {
    if (t.isDeleted || t.type === "transfer" || isTransferCreditLeg(t))
      continue;
    const date = startOfDay(new Date(`${t.transactionDate}T00:00:00`));
    if (date.getTime() < start.getTime() || date.getTime() >= end.getTime())
      continue;
    out.push({
      id: `tx-${t.id}`,
      date,
      kind: "transaction",
      title: t.description.trim() || "Transaction",
      amount: signedAmount(t),
    });
  }
  return out;
}

/** Recurring *schedule* events are strictly future occurrences of active
 * rules (paused rules generate nothing). Once an occurrence becomes due it
 * materialises as a generated transaction entry, which shows up under the
 * transaction kind instead — so schedule events never double count actual
 * money movement. */
function recurringEvents(
  rules: RecurringRule[],
  start: Date,
  end: Date,
  today: Date,
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    let occ = computeNextExecution(
      rule.startDate,
      rule.frequency,
      rule.customIntervalDays,
      today,
    );
    if (occ.getTime() <= today.getTime()) {
      occ = addOccurrence(occ, rule.frequency, rule.customIntervalDays);
    }
    let guard = 0;
    while (occ.getTime() < end.getTime() && guard < MAX_RECURRING_OCCURRENCES) {
      if (occ.getTime() >= start.getTime()) {
        out.push({
          id: `rec-${rule.id}-${occ.toISOString().slice(0, 10)}`,
          date: occ,
          kind: "recurring",
          title: rule.title,
          amount: rule.type === "income" ? rule.amount : -rule.amount,
        });
      }
      occ = addOccurrence(occ, rule.frequency, rule.customIntervalDays);
      guard++;
    }
  }
  return out;
}

/** Loan events are the next EMI due date per active loan (future-only —
 * `nextDueDate` returns strictly-after-today) and every recorded EMI payment
 * (past/current), so a paid EMI and its pending next due are both visible. */
function loanEvents(
  loans: Loan[],
  payments: LoanPayment[],
  start: Date,
  end: Date,
  today: Date,
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const nameById = new Map(loans.map((l) => [l.id, l.loanName]));
  const name = (id: string) => nameById.get(id) ?? "Loan";

  for (const loan of loans) {
    if (loan.status !== "active" || loan.currentBalance <= 0) continue;
    const due = nextDueDate(loan, today);
    if (
      due &&
      due.getTime() >= start.getTime() &&
      due.getTime() < end.getTime()
    ) {
      out.push({
        id: `loan-due-${loan.id}`,
        date: due,
        kind: "loan",
        title: `EMI due · ${loan.loanName}`,
        amount: -loan.monthlyEMI,
      });
    }
  }

  for (const p of payments) {
    const date = startOfDay(new Date(`${p.paymentDate}T00:00:00`));
    if (date.getTime() < start.getTime() || date.getTime() >= end.getTime())
      continue;
    out.push({
      id: `loan-pay-${p.id}`,
      date,
      kind: "loan",
      title: `EMI paid · ${name(p.loanId)}`,
      amount: -p.amountPaid,
    });
  }
  return out;
}

/** Every derived event in a calendar month, newest-first (the calendar
 * reads as a timeline). `reference` is the "today" used to decide what is a
 * future scheduled occurrence — inject it in tests, default to now. */
export function getMonthEvents(
  year: number,
  monthIndex: number,
  transactions: Transaction[],
  recurringRules: RecurringRule[],
  loans: Loan[],
  loanPayments: LoanPayment[],
  reference: Date = new Date(),
): CalendarEvent[] {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 1);
  const today = startOfDay(reference);

  return [
    ...transactionEvents(transactions, start, end),
    ...recurringEvents(recurringRules, start, end, today),
    ...loanEvents(loans, loanPayments, start, end, today),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function getDayEvents(
  events: CalendarEvent[],
  date: Date,
): CalendarEvent[] {
  const day = startOfDay(date).getTime();
  return events.filter((e) => e.date.getTime() === day);
}

export function getWeekEvents(
  events: CalendarEvent[],
  weekStart: Date,
): CalendarEvent[] {
  const start = startOfDay(weekStart).getTime();
  return events.filter(
    (e) => e.date.getTime() >= start && e.date.getTime() < start + 7 * DAY_MS,
  );
}

export interface DaySummary {
  count: number;
  income: number;
  expense: number;
  net: number;
}

export function getDaySummary(events: CalendarEvent[]): DaySummary {
  let income = 0;
  let expense = 0;
  for (const e of events) {
    if (e.amount > 0) income += e.amount;
    else expense += -e.amount;
  }
  return { count: events.length, income, expense, net: income - expense };
}

/** Kind + free-text filter. An empty `kinds` array means all kinds; `query`
 * matches the event title, case-insensitively. */
export function filterEvents(
  events: CalendarEvent[],
  query: string,
  kinds: CalendarEventKind[],
): CalendarEvent[] {
  const q = query.trim().toLowerCase();
  return events.filter((e) => {
    if (kinds.length > 0 && !kinds.includes(e.kind)) return false;
    if (q && !e.title.toLowerCase().includes(q)) return false;
    return true;
  });
}

export const CalendarService = {
  getMonthEvents,
  getDayEvents,
  getWeekEvents,
  getDaySummary,
  filterEvents,
};
