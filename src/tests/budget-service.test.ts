import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/database/db";
import { computeBudgetStatus, BudgetService } from "@/services/BudgetService";
import {
  GLOBAL_BUDGET_CATEGORY_ID,
  type Budget,
  type Transaction,
} from "@/types/entities";

function makeBudget(overrides: Partial<Budget>): Budget {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    categoryId: "cat-food",
    monthlyLimit: 5000,
    rolloverEnabled: false,
    warningThreshold: 80,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<Transaction>): Transaction {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    transactionDate: now,
    type: "expense",
    amount: 100,
    currency: "INR",
    description: "test",
    categoryId: "cat-food",
    accountId: "acc-cash",
    recurringRuleId: null,
    loanId: null,
    budgetId: null,
    tags: [],
    notes: "",
    status: "paid",
    source: "manual",
    isFavorite: false,
    isDeleted: false,
    version: 1,
    linkedTransactionId: null,
    ...overrides,
  };
}

describe("computeBudgetStatus", () => {
  it("allocated − spent = remaining (§6)", () => {
    const reference = new Date(2026, 2, 15);
    const budget = makeBudget({ monthlyLimit: 5000 });
    const transactions = [
      makeTransaction({
        amount: 1200,
        transactionDate: new Date(2026, 2, 5).toISOString(),
      }),
    ];
    const status = computeBudgetStatus(budget, transactions, 1, reference);
    expect(status.allocated).toBe(5000);
    expect(status.spent).toBe(1200);
    expect(status.remaining).toBe(3800);
  });

  it("excludes income and transfers from spent (§6/§10)", () => {
    const reference = new Date(2026, 2, 15);
    const budget = makeBudget({ monthlyLimit: 5000 });
    const transactions = [
      makeTransaction({
        type: "income",
        amount: 9999,
        transactionDate: new Date(2026, 2, 5).toISOString(),
      }),
      makeTransaction({
        type: "transfer",
        amount: 9999,
        transactionDate: new Date(2026, 2, 5).toISOString(),
      }),
    ];
    const status = computeBudgetStatus(budget, transactions, 1, reference);
    expect(status.spent).toBe(0);
  });

  it("a refund reduces effective spend", () => {
    const reference = new Date(2026, 2, 15);
    const budget = makeBudget({ monthlyLimit: 5000 });
    const transactions = [
      makeTransaction({
        type: "expense",
        amount: 1000,
        transactionDate: new Date(2026, 2, 5).toISOString(),
      }),
      makeTransaction({
        type: "refund",
        amount: 200,
        transactionDate: new Date(2026, 2, 6).toISOString(),
      }),
    ];
    const status = computeBudgetStatus(budget, transactions, 1, reference);
    expect(status.spent).toBe(800);
  });

  it("a global budget sums spending across all categories", () => {
    const reference = new Date(2026, 2, 15);
    const budget = makeBudget({
      categoryId: GLOBAL_BUDGET_CATEGORY_ID,
      monthlyLimit: 10000,
    });
    const transactions = [
      makeTransaction({
        categoryId: "cat-food",
        amount: 1000,
        transactionDate: new Date(2026, 2, 5).toISOString(),
      }),
      makeTransaction({
        categoryId: "cat-fuel",
        amount: 500,
        transactionDate: new Date(2026, 2, 6).toISOString(),
      }),
    ];
    const status = computeBudgetStatus(budget, transactions, 1, reference);
    expect(status.spent).toBe(1500);
  });

  it("rollover adds unused budget from the previous period", () => {
    const reference = new Date(2026, 2, 15);
    const budget = makeBudget({ monthlyLimit: 5000, rolloverEnabled: true });
    const transactions = [
      // Previous period (Feb): spent only 3000 of 5000 → 2000 unused
      makeTransaction({
        amount: 3000,
        transactionDate: new Date(2026, 1, 10).toISOString(),
      }),
    ];
    const status = computeBudgetStatus(budget, transactions, 1, reference);
    expect(status.allocated).toBe(7000); // 5000 + 2000 rollover
  });

  it("rollover can go negative if the previous period was overspent", () => {
    const reference = new Date(2026, 2, 15);
    const budget = makeBudget({ monthlyLimit: 5000, rolloverEnabled: true });
    const transactions = [
      // Previous period: overspent by 1000
      makeTransaction({
        amount: 6000,
        transactionDate: new Date(2026, 1, 10).toISOString(),
      }),
    ];
    const status = computeBudgetStatus(budget, transactions, 1, reference);
    expect(status.allocated).toBe(4000); // 5000 - 1000
  });

  it("severity bands: ok / warning / over", () => {
    const reference = new Date(2026, 2, 15);
    const okBudget = makeBudget({ monthlyLimit: 1000, warningThreshold: 80 });
    const warningBudget = makeBudget({
      monthlyLimit: 1000,
      warningThreshold: 80,
    });
    const overBudget = makeBudget({ monthlyLimit: 1000, warningThreshold: 80 });

    const ok = computeBudgetStatus(
      okBudget,
      [
        makeTransaction({
          amount: 500,
          transactionDate: reference.toISOString(),
        }),
      ],
      1,
      reference,
    );
    const warning = computeBudgetStatus(
      warningBudget,
      [
        makeTransaction({
          amount: 850,
          transactionDate: reference.toISOString(),
        }),
      ],
      1,
      reference,
    );
    const over = computeBudgetStatus(
      overBudget,
      [
        makeTransaction({
          amount: 1200,
          transactionDate: reference.toISOString(),
        }),
      ],
      1,
      reference,
    );

    expect(ok.severity).toBe("ok");
    expect(warning.severity).toBe("warning");
    expect(over.severity).toBe("over");
  });

  it("forecast projects current pace across the full period", () => {
    // 10 days into a 28-day period (Feb 2026, budgetMonthStart=1), spent 1000 total.
    const reference = new Date(2026, 1, 10);
    const budget = makeBudget({ monthlyLimit: 5000 });
    const transactions = [
      makeTransaction({
        amount: 1000,
        transactionDate: new Date(2026, 1, 5).toISOString(),
      }),
    ];
    const status = computeBudgetStatus(budget, transactions, 1, reference);
    // daysElapsed = 10, daysInPeriod = 28 → forecast = (1000/10)*28 = 2800
    expect(status.forecastEndOfPeriod).toBeCloseTo(2800, 0);
  });
});

describe("BudgetService CRUD", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("rejects a zero or negative monthly limit", async () => {
    await expect(
      BudgetService.create({
        categoryId: "cat-food",
        monthlyLimit: 0,
        rolloverEnabled: false,
        warningThreshold: 80,
      }),
    ).rejects.toThrow();
  });

  it("rejects a second budget for the same category", async () => {
    await BudgetService.create({
      categoryId: "cat-food",
      monthlyLimit: 5000,
      rolloverEnabled: false,
      warningThreshold: 80,
    });
    await expect(
      BudgetService.create({
        categoryId: "cat-food",
        monthlyLimit: 3000,
        rolloverEnabled: false,
        warningThreshold: 80,
      }),
    ).rejects.toThrow();
  });

  it("allows one global budget alongside per-category budgets", async () => {
    await BudgetService.create({
      categoryId: "cat-food",
      monthlyLimit: 5000,
      rolloverEnabled: false,
      warningThreshold: 80,
    });
    await expect(
      BudgetService.create({
        categoryId: GLOBAL_BUDGET_CATEGORY_ID,
        monthlyLimit: 20000,
        rolloverEnabled: false,
        warningThreshold: 80,
      }),
    ).resolves.toBeDefined();
  });

  it("deactivate removes a budget from getAll()", async () => {
    const budget = await BudgetService.create({
      categoryId: "cat-food",
      monthlyLimit: 5000,
      rolloverEnabled: false,
      warningThreshold: 80,
    });
    await BudgetService.deactivate(budget.id);
    const { BudgetRepository } =
      await import("@/repositories/BudgetRepository");
    expect(await BudgetRepository.getAll()).toHaveLength(0);
  });
});
