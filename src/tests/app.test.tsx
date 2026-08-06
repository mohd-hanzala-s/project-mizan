import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { db } from "@/database/db";
import { App } from "@/App";

describe("App first launch", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("shows onboarding before the app shell on a fresh install", async () => {
    render(<App />);
    await waitFor(() => {
      expect(
        screen.getByText(/welcome to mizan by mikarsh/i),
      ).toBeInTheDocument();
    });
  });
});
