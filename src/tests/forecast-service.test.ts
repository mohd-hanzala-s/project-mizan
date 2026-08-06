import { describe, it, expect } from "vitest";
import {
  getForecast,
  getForecastAlerts,
  type Forecast,
  type ForecastObligation,
} from "@/services/ForecastService";
import type {
  Account,
  Loan,
  RecurringRule,
  Transaction,
} from "@/types/entities";

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

function makeAccount(overrides: Partial<Account>): Account {
  const now = new Date().toISOString();
  return {
    id: "acc-cash",
    name: "Cash",
    type: "cash",
    icon: "Banknote",
    color: "#000",
    openingBalance: 0,
    currentBalance: 0,
    isDefault: true,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeRule(overrides: Partial<RecurringRule>): RecurringRule {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "Rent",
    amount: 2000,
    type: "expense",
    categoryId: "cat-home",
    accountId: "acc-cash",
    frequency: "monthly",
    startDate: "2026-01-01",
    endDate: null,
    nextExecution: now,
    autoGenerate: true,
    reminderDays: 3,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeLoan(overrides: Partial<Loan>): Loan {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    loanName: "Car Loan",
    lender: "Bank",
    originalAmount: 50000,
    currentBalance: 50000,
    monthlyEMI: 5000,
    interestRate: null,
    startDate: "2026-01-25",
    endDate: null,
    dueDay: 25,
    status: "active",
    notes: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const base = {
  accounts: [makeAccount({ currentBalance: 10000 })],
  recurringRules: [] as RecurringRule[],
  loans: [] as Loan[],
  budgetMonthStart: 1,
};

describe("getForecast — period shape", () => {
  it("measures the budget period and remaining days from the reference", () => {
    const forecast = getForecast({
      ...base,
      transactions: [],
      reference: new Date(2026, 2, 15),
    });
    expect(forecast.daysInPeriod).toBe(31);
    expect(forecast.daysElapsed).toBe(15);
    expect(forecast.remainingDays).toBe(16);
    expect(forecast.period.start).toEqual(new Date(2026, 2, 1));
    expect(forecast.period.end).toEqual(new Date(2026, 3, 1));
  });
});

describe("getForecast — projection", () => {
  it("projects month-end income, expense, savings and balance", () => {
    const transactions = [
      makeTransaction({
        type: "income",
        amount: 15000,
        transactionDate: new Date(2026, 2, 5, 12).toISOString(),
      }),
      makeTransaction({
        type: "expense",
        amount: 3000,
        transactionDate: new Date(2026, 2, 10, 12).toISOString(),
      }),
    ];
    const recurringRules = [
      makeRule({ startDate: "2026-03-20", amount: 2000 }),
    ];
    const loans = [makeLoan({ dueDay: 25, startDate: "2026-03-25" })];

    const forecast = getForecast({
      ...base,
      transactions,
      recurringRules,
      loans,
      reference: new Date(2026, 2, 15),
    });

    expect(forecast.actualIncome).toBe(15000);
    expect(forecast.actualExpense).toBe(3000);

    // Certain obligations: rent on the 20th + EMI on the 25th.
    expect(forecast.obligations.map((o) => o.amount)).toEqual([-2000, -5000]);

    // Run-rate: 15000/15 = 1000 income, 3000/15 = 200 expense per day × 16.
    expect(forecast.futureIncome).toBeCloseTo(16000, 6);
    expect(forecast.futureExpense).toBeCloseTo(7000 + 200 * 16, 6);

    expect(forecast.monthEndIncome).toBeCloseTo(31000, 6);
    expect(forecast.monthEndExpense).toBeCloseTo(13200, 6);
    expect(forecast.expectedSavings).toBeCloseTo(17800, 6);
    expect(forecast.expectedBalance).toBeCloseTo(15800, 6);
  });

  it("flags high confidence once the month is well observed", () => {
    const transactions = [
      makeTransaction({
        type: "income",
        amount: 15000,
        transactionDate: new Date(2026, 2, 5, 12).toISOString(),
      }),
      makeTransaction({
        type: "expense",
        amount: 3000,
        transactionDate: new Date(2026, 2, 10, 12).toISOString(),
      }),
    ];
    const forecast = getForecast({
      ...base,
      transactions,
      reference: new Date(2026, 2, 20),
    });
    expect(forecast.confidence).toBe("high");
    expect(forecast.remainingDays).toBe(11);
  });

  it("bounds obligations to the current period end", () => {
    const transactions: Transaction[] = [];
    const recurringRules = [makeRule({ startDate: "2026-03-20" })];
    const loans = [makeLoan({ dueDay: 5, startDate: "2026-03-05" })];

    const forecast = getForecast({
      ...base,
      transactions,
      recurringRules,
      loans,
      budgetMonthStart: 15,
      reference: new Date(2026, 2, 20),
    });

    // Period runs Mar 15 → Apr 15. Rent Mar 20 qualifies; the next monthly
    // occurrence (Apr 20) is outside. The loan's next due is Apr 5.
    expect(forecast.obligations.map((o) => o.amount)).toEqual([-2000, -5000]);
    expect(forecast.obligations.map((o) => o.source)).toEqual([
      "recurring",
      "loan",
    ]);
  });
});

describe("getForecast — confidence", () => {
  it("is low with no activity and states why", () => {
    const forecast = getForecast({
      ...base,
      transactions: [],
      reference: new Date(2026, 2, 15),
    });
    expect(forecast.confidence).toBe("low");
    expect(forecast.confidenceReason).toMatch(/no activity/i);
  });

  it("is low with fewer than three elapsed days", () => {
    const transactions = [
      makeTransaction({
        amount: 200,
        transactionDate: new Date(2026, 2, 1, 12).toISOString(),
      }),
    ];
    const forecast = getForecast({
      ...base,
      transactions,
      reference: new Date(2026, 2, 2),
    });
    expect(forecast.confidence).toBe("low");
    expect(forecast.confidenceReason).toMatch(/too few days/i);
  });

  it("is medium mid-month", () => {
    const transactions = [
      makeTransaction({
        amount: 100,
        transactionDate: new Date(2026, 2, 5, 12).toISOString(),
      }),
    ];
    const forecast = getForecast({
      ...base,
      transactions,
      reference: new Date(2026, 2, 15),
    });
    expect(forecast.confidence).toBe("medium");
  });
});

describe("getForecast — obligations", () => {
  it("counts a manually entered pending payment as an obligation", () => {
    const transactions = [
      makeTransaction({
        status: "pending",
        source: "manual",
        description: "Internet bill",
        amount: 1500,
        transactionDate: new Date(2026, 2, 18, 12).toISOString(),
      }),
    ];
    const forecast = getForecast({
      ...base,
      transactions,
      reference: new Date(2026, 2, 15),
    });
    expect(forecast.obligations).toHaveLength(1);
    expect(forecast.obligations[0].source).toBe("pending");
    expect(forecast.obligations[0].amount).toBe(-1500);
    expect(forecast.futureExpense).toBeCloseTo(1500, 6);
  });

  it("does not double-count an auto pending row against its active rule", () => {
    const rule = makeRule({ id: "r1", startDate: "2026-03-15", amount: 2000 });
    const transactions = [
      makeTransaction({
        status: "pending",
        source: "auto",
        recurringRuleId: "r1",
        amount: 2000,
        transactionDate: new Date(2026, 2, 15, 9).toISOString(),
      }),
    ];
    const forecast = getForecast({
      ...base,
      transactions,
      recurringRules: [rule],
      reference: new Date(2026, 2, 15),
    });
    expect(forecast.obligations).toHaveLength(1);
    expect(forecast.obligations[0].amount).toBe(-2000);
    expect(forecast.futureExpense).toBeCloseTo(2000, 6);
  });

  it("keeps an auto pending row when its rule is paused", () => {
    const rule = makeRule({
      id: "r1",
      startDate: "2026-03-15",
      active: false,
    });
    const transactions = [
      makeTransaction({
        status: "pending",
        source: "auto",
        recurringRuleId: "r1",
        amount: 2000,
        transactionDate: new Date(2026, 2, 15, 9).toISOString(),
      }),
    ];
    const forecast = getForecast({
      ...base,
      transactions,
      recurringRules: [rule],
      reference: new Date(2026, 2, 15),
    });
    expect(forecast.obligations).toHaveLength(1);
    expect(forecast.obligations[0].source).toBe("pending");
    expect(forecast.futureExpense).toBeCloseTo(2000, 6);
  });

  it("does not project remind-only rules (their payments are ordinary)", () => {
    const rule = makeRule({
      startDate: "2026-03-20",
      autoGenerate: false,
    });
    const forecast = getForecast({
      ...base,
      transactions: [],
      recurringRules: [rule],
      reference: new Date(2026, 2, 15),
    });
    expect(forecast.obligations).toHaveLength(0);
  });

  it("counts scheduled income rules in future income", () => {
    const rule = makeRule({
      type: "income",
      amount: 5000,
      startDate: "2026-03-18",
    });
    const forecast = getForecast({
      ...base,
      transactions: [],
      recurringRules: [rule],
      reference: new Date(2026, 2, 15),
    });
    expect(forecast.obligations).toHaveLength(1);
    expect(forecast.obligations[0].amount).toBe(5000);
    expect(forecast.futureIncome).toBe(5000);
  });

  it("counts a loan EMI due today as upcoming", () => {
    const loans = [makeLoan({ dueDay: 15, startDate: "2026-03-15" })];
    const forecast = getForecast({
      ...base,
      transactions: [],
      loans,
      reference: new Date(2026, 2, 15),
    });
    expect(forecast.obligations).toHaveLength(1);
    expect(forecast.obligations[0].source).toBe("loan");
    expect(forecast.obligations[0].amount).toBe(-5000);
  });

  it("ignores paid-off loans", () => {
    const loans = [
      makeLoan({ dueDay: 20, currentBalance: 0, status: "completed" }),
    ];
    const forecast = getForecast({
      ...base,
      transactions: [],
      loans,
      reference: new Date(2026, 2, 15),
    });
    expect(forecast.obligations).toHaveLength(0);
  });
});

describe("getForecast — run-rate hygiene", () => {
  it("excludes transfers from actuals, obligations and the run-rate", () => {
    const transactions = [
      makeTransaction({
        type: "transfer",
        amount: 5000,
        transactionDate: new Date(2026, 2, 5, 12).toISOString(),
      }),
    ];
    const forecast = getForecast({
      ...base,
      transactions,
      reference: new Date(2026, 2, 15),
    });
    expect(forecast.actualIncome).toBe(0);
    expect(forecast.actualExpense).toBe(0);
    expect(forecast.obligations).toHaveLength(0);
    expect(forecast.futureIncome).toBe(0);
    expect(forecast.futureExpense).toBe(0);
    expect(forecast.expectedBalance).toBe(10000);
  });

  it("ignores unpaid entries in the run-rate", () => {
    const transactions = [
      makeTransaction({
        status: "pending",
        amount: 3000,
        transactionDate: new Date(2026, 2, 5, 12).toISOString(),
      }),
    ];
    const forecast = getForecast({
      ...base,
      transactions,
      reference: new Date(2026, 2, 15),
    });
    expect(forecast.actualExpense).toBe(0);
    expect(forecast.futureExpense).toBe(0);
    expect(forecast.expectedBalance).toBe(10000);
  });

  it("does not include recurring-generated payments in the run-rate", () => {
    const transactions = [
      makeTransaction({
        amount: 2000,
        recurringRuleId: "r1",
        transactionDate: new Date(2026, 2, 5, 12).toISOString(),
      }),
    ];
    const forecast = getForecast({
      ...base,
      transactions,
      reference: new Date(2026, 2, 15),
    });
    expect(forecast.actualExpense).toBe(2000); // still an actual
    expect(forecast.futureExpense).toBe(0); // but not extrapolated
  });
});

function makeForecast(overrides: Partial<Forecast>): Forecast {
  const obligations: ForecastObligation[] = [];
  return {
    period: { start: new Date(2026, 2, 1), end: new Date(2026, 3, 1) },
    today: new Date(2026, 2, 15),
    daysInPeriod: 31,
    daysElapsed: 15,
    remainingDays: 16,
    actualIncome: 0,
    actualExpense: 0,
    futureIncome: 0,
    futureExpense: 0,
    monthEndIncome: 0,
    monthEndExpense: 0,
    expectedSavings: 0,
    expectedBalance: 0,
    obligations,
    confidence: "medium",
    confidenceReason: "partial",
    ...overrides,
  };
}

describe("getForecastAlerts", () => {
  it("warns when the projected balance is negative", () => {
    const alerts = getForecastAlerts(makeForecast({ expectedBalance: -800 }));
    expect(alerts.some((a) => a.id === "forecast-negative-balance")).toBe(true);
    expect(alerts[0].severity).toBe("warning");
  });

  it("warns when the projected savings are negative", () => {
    const alerts = getForecastAlerts(makeForecast({ expectedSavings: -1200 }));
    expect(alerts.some((a) => a.id === "forecast-negative-savings")).toBe(true);
  });

  it("is silent when projections are healthy", () => {
    const alerts = getForecastAlerts(
      makeForecast({ expectedBalance: 5000, expectedSavings: 1200 }),
    );
    expect(alerts).toHaveLength(0);
  });
});
