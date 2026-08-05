import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { db } from "@/database/db";
import { App } from "@/App";

describe("App post-onboarding", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    // Skip onboarding for this test — it's covered separately.
    await db.settings.update("active", { onboardingCompleted: true });
  });

  it("renders the app shell with all 10 destinations, including Accounts", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
    });

    const labels = [
      "Dashboard",
      "Transactions",
      "Accounts",
      "Budgets",
      "Loans",
      "Recurring",
      "Calendar",
      "Reports",
      "Insights",
      "Settings",
    ];
    labels.forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
  });
});
