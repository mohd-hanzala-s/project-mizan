import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { db } from "@/database/db";
import { RecurringService } from "@/services/RecurringService";
import { RecurringPage } from "@/features/recurring/RecurringPage";
import { useRecurringStore } from "@/features/recurring/recurringStore";

describe("RecurringPage", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await db.settings.update("active", { onboardingCompleted: true });
  });

  it("shows the empty state before any rules exist", async () => {
    render(<RecurringPage />);
    await waitFor(() => {
      expect(screen.getByText(/no recurring rules yet/i)).toBeInTheDocument();
    });
    // Let the effect-driven store load settle so it never outlives the test.
    await waitFor(() => {
      expect(useRecurringStore.getState().isLoading).toBe(false);
    });
  });

  it("lists a created rule with its schedule", async () => {
    await RecurringService.create({
      title: "Gym Membership",
      amount: 1500,
      type: "expense",
      categoryId: "cat-health",
      accountId: "acc-bank",
      frequency: "monthly",
      startDate: "2030-01-01",
      endDate: null,
      autoGenerate: true,
      reminderDays: 3,
    });

    render(<RecurringPage />);

    await waitFor(() => {
      expect(screen.getByText("Gym Membership")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByText(/Monthly/)).toBeInTheDocument();
    await waitFor(() => {
      expect(useRecurringStore.getState().isLoading).toBe(false);
    });
  });
});
