import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { PinInput } from '@/components/forms/PinInput'
import { SettingsService } from '@/services/SettingsService'
import { useSettingsStore } from '@/app/settingsStore'

export function AppLockStep() {
  const settings = useSettingsStore((s) => s.settings)
  const load = useSettingsStore((s) => s.load)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  const enabled = settings?.appLockEnabled ?? false

  async function handleSetPin() {
    setError(null)
    if (pin.length < 4) return setError('PIN must be at least 4 digits.')
    if (pin !== confirmPin) return setError('PINs don\u2019t match.')
    await SettingsService.setPin(pin)
    await load()
  }

  async function handleDisable() {
    await SettingsService.disableAppLock()
    await load()
    setPin('')
    setConfirmPin('')
  }

  return (
    <div className="flex flex-col items-center gap-24 text-center">
      <div className="flex size-64 items-center justify-center rounded-full bg-income-subtle text-income">
        <ShieldCheck className="size-32" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-8">
        <h2 className="text-h1 text-text-primary">Protect your data</h2>
        <p className="max-w-[380px] text-body text-text-secondary">
          Optional: set a PIN so only you can open Nexus Finance. You can change this anytime in
          Settings.
        </p>
      </div>

      {enabled ? (
        <div className="flex flex-col items-center gap-8">
          <p className="text-body-sm text-income">PIN set ✓</p>
          <button
            type="button"
            onClick={handleDisable}
            className="text-body-sm text-text-secondary underline"
          >
            Remove PIN
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-12">
          <PinInput value={pin} onChange={setPin} label="Choose a PIN" autoFocus />
          <PinInput value={confirmPin} onChange={setConfirmPin} label="Confirm PIN" />
          {error && <p className="text-body-sm text-expense">{error}</p>}
          <button
            type="button"
            onClick={handleSetPin}
            disabled={pin.length < 4}
            className="text-body-sm font-medium text-income disabled:opacity-40"
          >
            Set PIN
          </button>
        </div>
      )}
    </div>
  )
}
