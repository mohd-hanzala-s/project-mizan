import { useState } from "react";
import { Lock } from "lucide-react";
import { PinInput } from "@/components/forms/PinInput";
import { SettingsService } from "@/services/SettingsService";
import { Button } from "@/components/ui/button";

interface AppLockScreenProps {
  storedHash: string;
  onUnlock: () => void;
}

export function AppLockScreen({ storedHash, onUnlock }: AppLockScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setChecking(true);
    setError(false);
    const valid = await SettingsService.verifyPin(pin, storedHash);
    setChecking(false);
    if (valid) {
      onUnlock();
    } else {
      setError(true);
      setPin("");
    }
  }

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-24 bg-surface px-24">
      <div className="flex size-64 items-center justify-center rounded-full bg-income-subtle text-income">
        <Lock className="size-32" aria-hidden="true" />
      </div>
      <h1 className="text-h1 text-text-primary">Nexus Finance is locked</h1>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center gap-16"
      >
        <PinInput
          value={pin}
          onChange={setPin}
          label="Enter PIN"
          autoFocus
          error={error}
        />
        {error && (
          <p className="text-body-sm text-expense">Incorrect PIN. Try again.</p>
        )}
        <Button
          type="submit"
          variant="primary"
          loading={checking}
          disabled={pin.length < 4}
        >
          Unlock
        </Button>
      </form>
    </div>
  );
}
