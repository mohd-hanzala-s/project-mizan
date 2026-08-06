import { SettingsRepository } from "@/repositories/SettingsRepository";
import type { Settings, ThemePreference } from "@/types/entities";

/** Fixed local salt — this is a device-local app-lock PIN, not an
 * account credential; the threat model is "someone picks up my tablet,"
 * not remote brute force. Never store the raw PIN either way. */
const PIN_SALT = "mizan-app-lock-v1";

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const SettingsService = {
  resolveTheme(preference: ThemePreference): "light" | "dark" {
    if (preference === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return preference;
  },

  /** Enable app lock with a 4–6 digit PIN. */
  async setPin(pin: string): Promise<Settings> {
    if (!/^\d{4,6}$/.test(pin)) {
      throw new Error("PIN must be 4–6 digits.");
    }
    const appLockPinHash = await sha256Hex(`${PIN_SALT}:${pin}`);
    return SettingsRepository.update({ appLockEnabled: true, appLockPinHash });
  },

  async disableAppLock(): Promise<Settings> {
    return SettingsRepository.update({
      appLockEnabled: false,
      appLockPinHash: null,
    });
  },

  async verifyPin(pin: string, storedHash: string): Promise<boolean> {
    const hash = await sha256Hex(`${PIN_SALT}:${pin}`);
    return hash === storedHash;
  },
};
