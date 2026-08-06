import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { db } from "@/database/db";
import { TransactionService } from "@/services/TransactionService";
import { App } from "@/App";

describe("Dashboard with data", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await db.settings.update("active", { onboardingCompleted: true });
    await TransactionService.create({
      amount: 45000,
      description: "Salary",
      type: "income",
      categoryId: "cat-salary",
      accountId: "acc-bank",
      transactionDate: new Date().toISOString(),
    });
    await TransactionService.create({
      amount: 250,
      description: "Tea",
      type: "expense",
      categoryId: "cat-food",
      accountId: "acc-cash",
      transactionDate: new Date().toISOString(),
    });
  });

  it("shows metric cards, recent activity, and the month-end forecast card", async () => {
    render(<App />);

    await waitFor(
      () => {
        expect(screen.getByText("This Month's Income")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(screen.queryByText(/no activity yet/i)).not.toBeInTheDocument();
    expect(screen.getByText("This Month's Expense")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.getByText("Tea")).toBeInTheDocument();

    expect(screen.getByText("Month-End Forecast")).toBeInTheDocument();
    expect(screen.getByText("Projected balance")).toBeInTheDocument();
    expect(screen.getByText(/confidence/i)).toBeInTheDocument();
  });
});
