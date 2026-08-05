import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/database/db";
import { SettingsRepository } from "@/repositories/SettingsRepository";
import { SampleDataService } from "@/services/SampleDataService";
import { SAMPLE_TRANSACTIONS } from "@/constants/sample-transactions";

describe("SampleDataService", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("does nothing if sampleDataRequested is false", async () => {
    await SampleDataService.fulfillIfRequested();
    expect(await db.transactions.count()).toBe(0);
  });

  it("seeds all sample transactions and clears the flag when requested", async () => {
    await SettingsRepository.update({ sampleDataRequested: true });
    await SampleDataService.fulfillIfRequested();

    expect(await db.transactions.count()).toBe(SAMPLE_TRANSACTIONS.length);
    const settings = await SettingsRepository.get();
    expect(settings.sampleDataRequested).toBe(false);
  });

  it("is idempotent — running it again after fulfillment does nothing", async () => {
    await SettingsRepository.update({ sampleDataRequested: true });
    await SampleDataService.fulfillIfRequested();
    await SampleDataService.fulfillIfRequested();

    expect(await db.transactions.count()).toBe(SAMPLE_TRANSACTIONS.length);
  });
});
