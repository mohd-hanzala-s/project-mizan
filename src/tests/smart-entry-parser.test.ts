import { describe, it, expect } from "vitest";
import { SmartEntryParser } from "@/services/SmartEntryParser";

describe("SmartEntryParser", () => {
  it('parses "250 tea" (§3 example)', () => {
    expect(SmartEntryParser.parse("250 tea")).toEqual({
      amount: 250,
      description: "tea",
      type: "expense",
    });
  });

  it('parses "900 petrol" (§3 example)', () => {
    expect(SmartEntryParser.parse("900 petrol")).toEqual({
      amount: 900,
      description: "petrol",
      type: "expense",
    });
  });

  it('parses "8000 EMI" (§3 example)', () => {
    expect(SmartEntryParser.parse("8000 EMI")).toEqual({
      amount: 8000,
      description: "EMI",
      type: "expense",
    });
  });

  it("infers income from keywords", () => {
    expect(SmartEntryParser.parse("45000 salary received").type).toBe("income");
  });

  it("handles a ₹ prefix and thousands separators", () => {
    expect(SmartEntryParser.parse("₹1,250 groceries").amount).toBe(1250);
  });

  it("returns null amount for text with no number", () => {
    expect(SmartEntryParser.parse("just some notes").amount).toBeNull();
  });

  it("rejects a zero or negative amount", () => {
    expect(SmartEntryParser.parse("0 tea").amount).toBeNull();
  });

  it("trims and collapses whitespace in the description", () => {
    expect(SmartEntryParser.parse("  250   tea  ").description).toBe("tea");
  });
});
