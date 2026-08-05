import { useState } from "react";
import { Lock } from "lucide-react";
import { useSettingsStore } from "@/app/settingsStore";
import { SettingsService } from "@/services/SettingsService";
import { PinInput } from "@/components/forms/PinInput";
import { Button } from "@/components/ui/button";

export function AppLockSettings() {
  const settings = useSettingsStore((s) => s.settings);
  const load = useSettingsStore((s) => s.load);
  const [settingUp, setSettingUp] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!settings) return null;

  async function handleToggle() {
    if (settings!.appLockEnabled) {
      await SettingsService.disableAppLock();
      await load();
    } else {
      setSettingUp(true);
    }
  }

  async function handleSavePin() {
    setError(null);
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs don\u2019t match.");
      return;
    }
    await SettingsService.setPin(pin);
    await load();
    setSettingUp(false);
    setPin("");
    setConfirmPin("");
  }

  return (
    <div className="rounded-lg border border-border bg-surface-card p-16">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-12">
          <Lock className="size-24 text-text-secondary" aria-hidden="true" />
          <div>
            <p className="text-body font-medium text-text-primary">App Lock</p>
            <p className="text-body-sm text-text-secondary">
              Require a PIN to open Nexus Finance.
            </p>
          </div>
        </div>
        <Button
          variant={settings.appLockEnabled ? "secondary" : "primary"}
          size="sm"
          onClick={handleToggle}
        >
          {settings.appLockEnabled ? "Disable" : "Enable"}
        </Button>
      </div>

      {settingUp && (
        <div className="mt-16 flex flex-col items-center gap-16 border-t border-border-subtle pt-16">
          <PinInput value={pin} onChange={setPin} label="New PIN" autoFocus />
          <PinInput
            value={confirmPin}
            onChange={setConfirmPin}
            label="Confirm PIN"
          />
          {error && <p className="text-body-sm text-expense">{error}</p>}
          <div className="flex gap-8">
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => setSettingUp(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSavePin}>
              Save PIN
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
