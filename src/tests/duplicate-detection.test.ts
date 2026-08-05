import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/database/db";
import { TransactionService } from "@/services/TransactionService";
import { DuplicateDetectionService } from "@/services/DuplicateDetectionService";

describe("DuplicateDetectionService", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await TransactionService.create({
      amount: 250,
      description: "Tea",
      type: "expense",
      categoryId: "cat-food",
      accountId: "acc-cash",
      transactionDate: new Date().toISOString(),
    });
  });

  it("flags a same amount + description + account within the date window", async () => {
    const match = await DuplicateDetectionService.findPossibleDuplicate({
      amount: 250,
      description: "tea", // case-insensitive
      transactionDate: new Date().toISOString(),
      accountId: "acc-cash",
    });
    expect(match).not.toBeNull();
  });

  it("does not flag a different amount", async () => {
    const match = await DuplicateDetectionService.findPossibleDuplicate({
      amount: 300,
      description: "Tea",
      transactionDate: new Date().toISOString(),
      accountId: "acc-cash",
    });
    expect(match).toBeNull();
  });

  it("does not flag a different account", async () => {
    const match = await DuplicateDetectionService.findPossibleDuplicate({
      amount: 250,
      description: "Tea",
      transactionDate: new Date().toISOString(),
      accountId: "acc-bank",
    });
    expect(match).toBeNull();
  });

  it("does not flag something outside the date window", async () => {
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 10);
    const match = await DuplicateDetectionService.findPossibleDuplicate({
      amount: 250,
      description: "Tea",
      transactionDate: farFuture.toISOString(),
      accountId: "acc-cash",
    });
    expect(match).toBeNull();
  });

  it("excludes the transaction itself when editing", async () => {
    const existing = await db.transactions.toArray();
    const match = await DuplicateDetectionService.findPossibleDuplicate(
      {
        amount: 250,
        description: "Tea",
        transactionDate: new Date().toISOString(),
        accountId: "acc-cash",
      },
      existing[0].id,
    );
    expect(match).toBeNull();
  });
});
