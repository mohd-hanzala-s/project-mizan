import { BudgetRepository } from "@/repositories/BudgetRepository";
import {
  getCurrentPeriod,
  getPreviousPeriod,
  type DateRange,
  type DashboardAlert,
} from "@/services/DashboardService";
import {
  GLOBAL_BUDGET_CATEGORY_ID,
  type Budget,
  type Category,
  type Transaction,
} from "@/types/entities";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WARNING_THRESHOLD = 80;

function inRange(dateStr: string, range: DateRange): boolean {
  const t = new Date(dateStr).getTime();
  return t >= range.start.getTime() && t < range.end.getTime();
}

/** §6: Expense reduces budget headroom; Income "does not consume budget";
 * Transfer "never affects spending" — both excluded. Refund isn't
 * addressed explicitly, but it's money coming back from a purchase, so it
 * reduces effective spend the same way it reduces account balance
 * elsewhere in this codebase (not creatable through any UI yet, but this
 * stays correct once it is). */
function sumSpent(
  transactions: Transaction[],
  categoryId: string,
  range: DateRange,
): number {
  return transactions
    .filter((t) => !t.isDeleted && inRange(t.transactionDate, range))
    .filter(
      (t) =>
        categoryId === GLOBAL_BUDGET_CATEGORY_ID || t.categoryId === categoryId,
    )
    .reduce((sum, t) => {
      if (t.type === "expense") return sum + t.amount;
      if (t.type === "refund") return sum - t.amount;
      return sum;
    }, 0);
}

export interface BudgetStatus {
  budget: Budget;
  period: DateRange;
  /** monthlyLimit, plus the rollover from last period if enabled. Can be
   * less than monthlyLimit if last period was overspent and rollover is
   * on — a genuine rolling balance, not floored at 0. */
  allocated: number;
  spent: number;
  remaining: number;
  /** 0-100+; not capped, so "150" is a meaningful over-budget signal. */
  percentUsed: number;
  /** Naive linear projection: spent-per-day-so-far × days in the period. */
  forecastEndOfPeriod: number;
  severity: "ok" | "warning" | "over";
}

export function computeBudgetStatus(
  budget: Budget,
  transactions: Transaction[],
  budgetMonthStart: number,
  reference = new Date(),
): BudgetStatus {
  const period = getCurrentPeriod(budgetMonthStart, reference);
  const spent = sumSpent(transactions, budget.categoryId, period);

  const rollover = budget.rolloverEnabled
    ? budget.monthlyLimit -
      sumSpent(
        transactions,
        budget.categoryId,
        getPreviousPeriod(budgetMonthStart, reference),
      )
    : 0;
  const allocated = budget.monthlyLimit + rollover;
  const remaining = allocated - spent;
  const percentUsed =
    allocated > 0 ? (spent / allocated) * 100 : spent > 0 ? 100 : 0;

  const daysInPeriod = Math.max(
    1,
    Math.round((period.end.getTime() - period.start.getTime()) / DAY_MS),
  );
  const daysElapsed = Math.min(
    daysInPeriod,
    Math.max(
      1,
      Math.floor((reference.getTime() - period.start.getTime()) / DAY_MS) + 1,
    ),
  );
  const forecastEndOfPeriod = (spent / daysElapsed) * daysInPeriod;

  const warningThreshold = budget.warningThreshold || DEFAULT_WARNING_THRESHOLD;
  const severity: BudgetStatus["severity"] =
    percentUsed >= 100
      ? "over"
      : percentUsed >= warningThreshold
        ? "warning"
        : "ok";

  return {
    budget,
    period,
    allocated,
    spent,
    remaining,
    percentUsed,
    forecastEndOfPeriod,
    severity,
  };
}

export interface CreateBudgetInput {
  categoryId: string;
  monthlyLimit: number;
  rolloverEnabled: boolean;
  warningThreshold: number;
}

export const BudgetService = {
  computeStatus: computeBudgetStatus,

  /** One alert per over-budget item (§6's 90/100/110% ladder collapses to
   * "over" here — see CHANGELOG for why a persisted, dedup'd notification
   * log isn't implemented). Warning-band budgets aren't surfaced as
   * Dashboard alerts — that would be exactly the "reduces cognitive load"
   * rule working against itself; they're visible on the Budgets page
   * itself via color. */
  getAlerts(
    statuses: BudgetStatus[],
    categories: Category[],
  ): DashboardAlert[] {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    return statuses
      .filter((s) => s.severity === "over")
      .map((s) => {
        const name =
          s.budget.categoryId === GLOBAL_BUDGET_CATEGORY_ID
            ? "Overall"
            : (categoryById.get(s.budget.categoryId)?.name ?? "Uncategorized");
        return {
          id: `budget-over-${s.budget.id}`,
          message: `${name} budget is over by ₹${Math.abs(s.remaining).toLocaleString("en-IN")} this period.`,
          severity: "warning" as const,
        };
      });
  },

  async create(input: CreateBudgetInput): Promise<Budget> {
    if (!(input.monthlyLimit > 0))
      throw new Error("Monthly limit must be greater than 0.");
    const existing = await BudgetRepository.findByCategory(input.categoryId);
    if (existing) throw new Error("A budget for this category already exists.");

    const now = new Date().toISOString();
    const budget: Budget = {
      id: crypto.randomUUID(),
      categoryId: input.categoryId,
      monthlyLimit: input.monthlyLimit,
      rolloverEnabled: input.rolloverEnabled,
      warningThreshold: input.warningThreshold,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    await BudgetRepository.add(budget);
    return budget;
  },

  async update(
    id: string,
    input: Omit<CreateBudgetInput, "categoryId">,
  ): Promise<void> {
    if (!(input.monthlyLimit > 0))
      throw new Error("Monthly limit must be greater than 0.");
    await BudgetRepository.update(id, {
      monthlyLimit: input.monthlyLimit,
      rolloverEnabled: input.rolloverEnabled,
      warningThreshold: input.warningThreshold,
    });
  },

  async deactivate(id: string): Promise<void> {
    await BudgetRepository.update(id, { active: false });
  },
};
