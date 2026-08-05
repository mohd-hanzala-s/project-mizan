import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/database/db";
import { AccountService } from "@/services/AccountService";
import { AccountRepository } from "@/repositories/AccountRepository";

describe("AccountService", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("creates an account with currentBalance equal to openingBalance", async () => {
    const account = await AccountService.create({
      name: "Savings",
      type: "other",
      icon: "PiggyBank",
      color: "#000000",
      openingBalance: 1000,
    });
    expect(account.currentBalance).toBe(1000);
    expect(account.openingBalance).toBe(1000);
    expect(account.isDefault).toBe(false);
  });

  it("rejects an empty name", async () => {
    await expect(
      AccountService.create({
        name: "  ",
        type: "other",
        icon: "Wallet",
        color: "#000",
        openingBalance: 0,
      }),
    ).rejects.toThrow();
  });

  it("update only touches name/icon/color, not type or balances", async () => {
    await AccountService.update("acc-cash", {
      name: "Wallet Cash",
      icon: "Wallet",
      color: "#111111",
    });
    const account = await AccountRepository.getById("acc-cash");
    expect(account!.name).toBe("Wallet Cash");
    expect(account!.type).toBe("cash");
  });

  it("archives an account when others remain active", async () => {
    await AccountService.archive("acc-credit-card");
    const account = await AccountRepository.getById("acc-credit-card");
    expect(account!.isArchived).toBe(true);
    const active = await AccountRepository.getAll();
    expect(active.find((a) => a.id === "acc-credit-card")).toBeUndefined();
  });

  it("refuses to archive the last remaining active account", async () => {
    const active = await AccountRepository.getAll();
    for (const a of active.slice(1)) {
      await AccountService.archive(a.id);
    }
    const remaining = await AccountRepository.getAll();
    expect(remaining).toHaveLength(1);

    await expect(AccountService.archive(remaining[0].id)).rejects.toThrow();
  });

  it("unarchive brings an account back into getAll()", async () => {
    await AccountService.archive("acc-credit-card");
    await AccountService.unarchive("acc-credit-card");
    const active = await AccountRepository.getAll();
    expect(active.find((a) => a.id === "acc-credit-card")).toBeDefined();
  });
});
