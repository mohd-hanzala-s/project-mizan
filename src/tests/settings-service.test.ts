import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/database/db'
import { SettingsService } from '@/services/SettingsService'

describe('SettingsService app lock', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('rejects PINs that are not 4-6 digits', async () => {
    await expect(SettingsService.setPin('12')).rejects.toThrow()
    await expect(SettingsService.setPin('abcdef')).rejects.toThrow()
  })

  it('hashes the PIN — never stores it in plaintext', async () => {
    const settings = await SettingsService.setPin('4242')
    expect(settings.appLockEnabled).toBe(true)
    expect(settings.appLockPinHash).not.toBe('4242')
    expect(settings.appLockPinHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('verifies a correct PIN and rejects an incorrect one', async () => {
    const settings = await SettingsService.setPin('1357')
    const hash = settings.appLockPinHash!
    await expect(SettingsService.verifyPin('1357', hash)).resolves.toBe(true)
    await expect(SettingsService.verifyPin('0000', hash)).resolves.toBe(false)
  })

  it('disableAppLock clears the stored hash', async () => {
    await SettingsService.setPin('9999')
    const settings = await SettingsService.disableAppLock()
    expect(settings.appLockEnabled).toBe(false)
    expect(settings.appLockPinHash).toBeNull()
  })
})
