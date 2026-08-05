import { SettingsRepository } from "@/repositories/SettingsRepository";
import { TransactionService } from "@/services/TransactionService";
import { SAMPLE_TRANSACTIONS } from "@/constants/sample-transactions";

export const SampleDataService = {
  /** Called once on app startup (see App.tsx). Idempotent — the flag is
   * cleared immediately after seeding, so this is a no-op on every
   * subsequent launch. */
  async fulfillIfRequested(): Promise<void> {
    const settings = await SettingsRepository.get();
    if (!settings.sampleDataRequested) return;

    for (const sample of SAMPLE_TRANSACTIONS) {
      await TransactionService.create(sample);
    }

    await SettingsRepository.update({ sampleDataRequested: false });
  },
};
