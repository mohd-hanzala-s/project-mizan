import { describe, it, expect, beforeEach } from "vitest";
import { format } from "date-fns";
import { db } from "@/database/db";
import {
  RecurringService,
  addOccurrence,
  computeNextExecution,
  getRecurringAlerts,
  getUpcomingObligations,
} from "@/services/RecurringService";
import { RecurringRepository } from "@/repositories/RecurringRepository";
import { TransactionService } from "@/services/TransactionService";
import { AccountRepository } from "@/repositories/AccountRepository";
import type { RecurringFrequency, RecurringRule } from "@/types/entities";

const iso = (y: number, m: number, d: number) =>
  new Date(y, m, d).toISOString();
const fmt = (d: Date) => format(d, "yyyy-MM-dd");

async function makeRule(
  overrides: Partial<RecurringRule> = {},
): Promise<RecurringRule> {
  return RecurringService.create({
    title: "Rent",
    amount: 10000,
    type: "expense",
    categoryId: "cat-utilities",
    accountId: "acc-cash",
    frequency: "monthly",
    startDate: "2030-01-01",
    endDate: null,
    autoGenerate: true,
    reminderDays: 3,
    ...overrides,
  });
}

describe("computeNextExecution (schedule math)", () => {
  it("returns the start date itself when it is on/after the anchor", () => {
    const next = computeNextExecution(
      "2026-04-10",
      "monthly",
      undefined,
      new Date(2026, 2, 15),
    );
    expect(fmt(next)).toBe("2026-04-10");
  });

  it("daily advances by one day", () => {
    const next = computeNextExecution(
      "2026-03-01",
      "daily",
      undefined,
      new Date(2026, 2, 3),
    );
    expect(fmt(next)).toBe("2026-03-03");
  });

  it("weekly advances in 7-day steps", () => {
    const next = computeNextExecution(
      "2026-03-02",
      "weekly",
      undefined,
      new Date(2026, 2, 15),
    );
    expect(fmt(next)).toBe("2026-03-16");
  });

  it("monthly clamps day-of-month to month-end (§10 month-end transitions)", () => {
    // Jan 31 + monthly, anchored mid-Feb → Feb 28 (2026 is not a leap year).
    const next = computeNextExecution(
      "2026-01-31",
      "monthly",
      undefined,
      new Date(2026, 1, 15),
    );
    expect(fmt(next)).toBe("2026-02-28");
  });

  it("quarterly / half-yearly / yearly use month multiples", () => {
    expect(
      fmt(
        computeNextExecution(
          "2026-03-01",
          "quarterly",
          undefined,
          new Date(2026, 8, 15),
        ),
      ),
    ).toBe("2026-12-01");
    expect(
      fmt(
        computeNextExecution(
          "2026-03-01",
          "halfYearly",
          undefined,
          new Date(2026, 7, 15),
        ),
      ),
    ).toBe("2026-09-01");
    expect(
      fmt(
        computeNextExecution(
          "2026-03-01",
          "yearly",
          undefined,
          new Date(2026, 8, 15),
        ),
      ),
    ).toBe("2027-03-01");
  });

  it("custom uses the day interval", () => {
    const next = computeNextExecution(
      "2026-03-01",
      "custom",
      5,
      new Date(2026, 2, 12),
    );
    expect(fmt(next)).toBe("2026-03-16");
  });

  it("a start date years in the past fast-paths instead of iterating every day", () => {
    const next = computeNextExecution(
      "2020-01-01",
      "daily",
      undefined,
      new Date(2026, 2, 15),
    );
    expect(fmt(next)).toBe("2026-03-15");
  });
});

describe("addOccurrence", () => {
  it("adds one full period to a given date", () => {
    const base = new Date(2026, 0, 31);
    expect(fmt(addOccurrence(base, "monthly"))).toBe("2026-02-28");
    expect(fmt(addOccurrence(base, "weekly"))).toBe("2026-02-07");
    expect(fmt(addOccurrence(base, "custom", 10))).toBe("2026-02-10");
  });
});

describe("RecurringService CRUD", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("rejects a zero amount, a blank title, and a custom rule without an interval", async () => {
    await expect(makeRule({ amount: 0 })).rejects.toThrow();
    await expect(makeRule({ title: "   " })).rejects.toThrow();
    await expect(
      makeRule({ frequency: "custom" as RecurringFrequency }),
    ).rejects.toThrow();
    await expect(
      makeRule({ frequency: "custom", customIntervalDays: 7 }),
    ).resolves.toBeDefined();
  });

  it("rejects a missing account and an archived category", async () => {
    await expect(makeRule({ accountId: "acc-nonexistent" })).rejects.toThrow();
    await db.categories.update("cat-utilities", { isArchived: true });
    await expect(makeRule({ categoryId: "cat-utilities" })).rejects.toThrow();
  });

  it("creates an active rule with a computed next execution", async () => {
    const rule = await makeRule();
    expect(rule.active).toBe(true);
    expect(new Date(rule.nextExecution).getTime()).toBeGreaterThanOrEqual(
      Date.now(),
    );
    expect((await RecurringRepository.getAll()).length).toBe(1);
  });

  it("update recomputes nextExecution only when the schedule changes", async () => {
    const rule = await makeRule();
    const originalNext = rule.nextExecution;

    await RecurringService.update(rule.id, {
      title: "Rent (new)", // schedule unchanged
      amount: 12000,
      type: "expense",
      categoryId: "cat-utilities",
      accountId: "acc-cash",
      frequency: "monthly",
      startDate: "2030-01-01",
      endDate: null,
      autoGenerate: true,
      reminderDays: 5,
    });
    const afterTitleEdit = await RecurringRepository.getById(rule.id);
    expect(afterTitleEdit?.nextExecution).toBe(originalNext);

    await RecurringService.update(rule.id, {
      title: "Rent (new)",
      amount: 12000,
      type: "expense",
      categoryId: "cat-utilities",
      accountId: "acc-cash",
      frequency: "weekly",
      startDate: "2026-01-01",
      endDate: null,
      autoGenerate: true,
      reminderDays: 5,
    });
    const afterScheduleEdit = await RecurringRepository.getById(rule.id);
    expect(afterScheduleEdit?.nextExecution).not.toBe(originalNext);
    expect(afterScheduleEdit?.frequency).toBe("weekly");
  });
});

describe("RecurringService.generateDue", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("creates one pending entry per missed occurrence and advances nextExecution", async () => {
    const rule = await makeRule();
    // Simulate the app being closed across four monthly cycles.
    await RecurringRepository.update(rule.id, {
      nextExecution: iso(2026, 2, 1),
    });

    const generated = await RecurringService.generateDue(new Date(2026, 5, 10));

    expect(generated).toHaveLength(4);
    const dates = generated.map((t) => fmt(new Date(t.transactionDate))).sort();
    expect(dates).toEqual([
      "2026-03-01",
      "2026-04-01",
      "2026-05-01",
      "2026-06-01",
    ]);

    for (const t of generated) {
      expect(t.status).toBe("pending");
      expect(t.source).toBe("auto");
      expect(t.recurringRuleId).toBe(rule.id);
      expect(t.amount).toBe(10000);
    }

    const after = await RecurringRepository.getById(rule.id);
    expect(fmt(new Date(after!.nextExecution))).toBe("2026-07-01");
  });

  it("pending entries never touch account balances until marked paid", async () => {
    const rule = await makeRule();
    await RecurringRepository.update(rule.id, {
      nextExecution: iso(2026, 2, 1),
    });
    await RecurringService.generateDue(new Date(2026, 2, 10));
    const cash = await AccountRepository.getById("acc-cash");
    expect(cash?.currentBalance).toBe(0);
  });

  it("does not generate for autoGenerate=false rules, but still advances the schedule", async () => {
    const rule = await makeRule({ autoGenerate: false });
    await RecurringRepository.update(rule.id, {
      nextExecution: iso(2026, 2, 1),
    });
    const generated = await RecurringService.generateDue(new Date(2026, 2, 10));
    expect(generated).toHaveLength(0);
    const after = await RecurringRepository.getById(rule.id);
    expect(fmt(new Date(after!.nextExecution))).toBe("2026-04-01");
  });

  it("ignores paused rules entirely", async () => {
    const rule = await makeRule();
    await RecurringService.pause(rule.id);
    await RecurringRepository.update(rule.id, {
      nextExecution: iso(2026, 2, 1),
    });
    const generated = await RecurringService.generateDue(new Date(2026, 2, 10));
    expect(generated).toHaveLength(0);
    const after = await RecurringRepository.getById(rule.id);
    expect(fmt(new Date(after!.nextExecution))).toBe("2026-03-01");
  });

  it("skips generating into an archived account but keeps the schedule moving", async () => {
    const rule = await makeRule();
    await AccountRepository.update("acc-cash", { isArchived: true });
    await RecurringRepository.update(rule.id, {
      nextExecution: iso(2026, 2, 1),
    });
    const generated = await RecurringService.generateDue(new Date(2026, 2, 10));
    expect(generated).toHaveLength(0);
    const after = await RecurringRepository.getById(rule.id);
    expect(fmt(new Date(after!.nextExecution))).toBe("2026-04-01");
  });

  it("does nothing when no occurrence is due", async () => {
    const rule = await makeRule();
    await RecurringRepository.update(rule.id, {
      nextExecution: iso(2031, 0, 1),
    });
    const generated = await RecurringService.generateDue(new Date(2026, 2, 10));
    expect(generated).toHaveLength(0);
    const after = await RecurringRepository.getById(rule.id);
    expect(fmt(new Date(after!.nextExecution))).toBe("2031-01-01");
  });
});

describe("RecurringService pause / resume / skipNext / remove", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("skipNext advances past the next occurrence without generating an entry", async () => {
    const rule = await makeRule();
    const original = new Date(rule.nextExecution);
    await RecurringService.skipNext(rule.id);
    const after = await RecurringRepository.getById(rule.id);
    expect(fmt(new Date(after!.nextExecution))).toBe(
      fmt(addOccurrence(original, "monthly")),
    );

    // Generating at the old date creates nothing — that cycle was skipped.
    const generated = await RecurringService.generateDue(original);
    expect(generated).toHaveLength(0);
  });

  it("pause stops generation and resume re-arms from today (no backfill)", async () => {
    const rule = await makeRule();
    await RecurringService.pause(rule.id);
    expect((await RecurringRepository.getAll()).length).toBe(0);
    expect((await RecurringRepository.getAllIncludingInactive()).length).toBe(
      1,
    );

    // Leave nextExecution years in the past, then resume.
    await RecurringRepository.update(rule.id, {
      nextExecution: iso(2020, 0, 1),
    });
    await RecurringService.resume(rule.id);

    const after = await RecurringRepository.getById(rule.id);
    expect(after?.active).toBe(true);
    // The years-in-the-past nextExecution is discarded, not back-filled.
    expect(new Date(after!.nextExecution).getTime()).toBeGreaterThan(
      Date.now(),
    );

    const generated = await RecurringService.generateDue();
    expect(generated).toHaveLength(0);
  });

  it("remove deletes the rule and leaves generated transactions intact", async () => {
    const rule = await makeRule();
    const t = await TransactionService.createScheduled({
      amount: 10000,
      description: "Rent",
      type: "expense",
      categoryId: "cat-utilities",
      accountId: "acc-cash",
      transactionDate: iso(2026, 2, 1),
      recurringRuleId: rule.id,
    });
    await RecurringService.remove(rule.id);
    expect(await RecurringRepository.getById(rule.id)).toBeUndefined();
    const surviving = await db.transactions.get(t.id);
    expect(surviving?.recurringRuleId).toBe(rule.id);
  });
});

describe("getRecurringAlerts", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("flags past-due pending auto entries as missed (warning)", async () => {
    const t = await TransactionService.createScheduled({
      amount: 10000,
      description: "Rent",
      type: "expense",
      categoryId: "cat-utilities",
      accountId: "acc-cash",
      transactionDate: iso(2026, 2, 1),
      recurringRuleId: "rule-1",
    });
    const alerts = getRecurringAlerts([], [t], new Date(2026, 2, 15));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("warning");
    expect(alerts[0].message).toContain("Rent");
  });

  it("does not flag a pending entry that is not yet due", async () => {
    const t = await TransactionService.createScheduled({
      amount: 10000,
      description: "Rent",
      type: "expense",
      categoryId: "cat-utilities",
      accountId: "acc-cash",
      transactionDate: iso(2026, 2, 20),
      recurringRuleId: "rule-1",
    });
    const alerts = getRecurringAlerts([], [t], new Date(2026, 2, 15));
    expect(alerts).toHaveLength(0);
  });

  it("surfaces an upcoming reminder within reminderDays", async () => {
    const rule = await makeRule();
    await RecurringRepository.update(rule.id, {
      nextExecution: iso(2026, 2, 17),
    });
    const fresh = await RecurringRepository.getById(rule.id);
    const alerts = getRecurringAlerts([fresh!], [], new Date(2026, 2, 15));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("info");
    expect(alerts[0].message).toContain("in 2 days");
  });

  it("reminds on the day with reminderDays = 0 and stays silent beyond the window", async () => {
    const today = await makeRule();
    await RecurringRepository.update(today.id, {
      nextExecution: iso(2026, 2, 15),
      reminderDays: 0,
    });
    const freshToday = await RecurringRepository.getById(today.id);
    expect(
      getRecurringAlerts([freshToday!], [], new Date(2026, 2, 15)),
    ).toHaveLength(1);

    const late = await makeRule();
    await RecurringRepository.update(late.id, {
      nextExecution: iso(2026, 2, 20),
    });
    const freshLate = await RecurringRepository.getById(late.id);
    expect(
      getRecurringAlerts([freshLate!], [], new Date(2026, 2, 15)),
    ).toHaveLength(0);
  });

  it("never flags paid transactions as missed", async () => {
    await TransactionService.create({
      amount: 250,
      description: "Tea",
      type: "expense",
      categoryId: "cat-food",
      accountId: "acc-cash",
      transactionDate: iso(2026, 2, 1),
    });
    const alerts = getRecurringAlerts(
      [],
      await allTransactions(),
      new Date(2026, 2, 15),
    );
    expect(alerts).toHaveLength(0);
  });
});

describe("getUpcomingObligations", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("returns the next occurrence per active rule, soonest first", async () => {
    const a = await makeRule();
    await RecurringRepository.update(a.id, { nextExecution: iso(2026, 2, 20) });
    const b = await makeRule();
    await RecurringRepository.update(b.id, { nextExecution: iso(2026, 2, 17) });

    const obligations = getUpcomingObligations(
      await RecurringRepository.getAll(),
      30,
      new Date(2026, 2, 15),
    );
    expect(obligations).toHaveLength(2);
    // b (Mar 17) sorts before a (Mar 20).
    expect(obligations[0].title).toBe("Rent");
    expect(obligations[0].date.getTime()).toBeLessThan(
      obligations[1].date.getTime(),
    );
    expect(obligations.every((o) => o.type === "expense")).toBe(true);
  });

  it("excludes paused rules and occurrences beyond the horizon", async () => {
    const paused = await makeRule();
    await RecurringService.pause(paused.id);
    const far = await makeRule();
    await RecurringRepository.update(far.id, {
      nextExecution: iso(2026, 6, 1),
    });

    const obligations = getUpcomingObligations(
      await RecurringRepository.getAllIncludingInactive(),
      30,
      new Date(2026, 2, 15),
    );
    expect(obligations).toHaveLength(0);
  });
});

async function allTransactions() {
  return db.transactions.toArray();
}
