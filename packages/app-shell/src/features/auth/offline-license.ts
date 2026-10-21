// ============================================
// The offline edition opens only with a licence for THIS device.
//
// ⚠️ THE CHECK EXISTED AND NOTHING CALLED IT.
//
// `verifyOfflineLicense` (validation) was written and tested; the button
// «نسخه‌ی محلی» went straight to the local workspace, so the offline edition
// opened for anyone (owner report, 21 Oct 2026). Now the edition is entered
// only through `checkStoredLicence` / `activateLicence` here.
//
// · The device's licence id is a UUID made once and kept in the OS secure
//   store. It is what the admin types when issuing; a licence for another id
//   is refused (WRONG_DEVICE). The 6-character `device_id` in the local DB is
//   a label on temporary invoice numbers, never an identity.
// · The public key is part of the BUILD (`VITE_OFFLINE_LICENSE_PUBLIC_KEY`).
//   A build without it refuses every licence — it never opens unchecked.
// · Not checked here: the workspace. The licence names a business that the
//   device creates after accepting it, and a device already in use keeps its
//   data (owner decision, 21 Oct 2026).
// ============================================

import { parseLicenseCode, verifyOfflineLicense, type LicenseVerdict } from '@hisabche/validation'

import { OFFLINE_LICENSE_PUBLIC_KEY } from '@/shared/lib/api'
import { bridge } from '@/shared/lib/bridge'

const DEVICE_KEY = 'hisabche.licence.device-id'
const CODE_KEY = 'hisabche.licence.code'
/** The latest time a licence check saw — the clock may not go back past it. */
const SEEN_KEY = 'hisabche.licence.seen-at'

export type LicenceCheck =
  | { ok: true; expiresAt: string }
  | { ok: false; reason: 'NOT_CONFIGURED' | 'MISSING' | 'INVALID_CODE' | LicenseVerdict }

function publicKey(): string | null {
  const key = OFFLINE_LICENSE_PUBLIC_KEY
  return typeof key === 'string' && key.trim() !== '' ? key.trim() : null
}

async function read(key: string): Promise<string | null> {
  return (
    (await bridge()
      ?.secure.get(key)
      .catch(() => null)) ?? null
  )
}

async function write(key: string, value: string): Promise<void> {
  await bridge()?.secure.set(key, value)
}

/** This install's licence id, created the first time it is asked for. */
export async function deviceLicenceId(): Promise<string> {
  const existing = await read(DEVICE_KEY)
  if (existing) return existing
  const created = crypto.randomUUID()
  await write(DEVICE_KEY, created)
  return created
}

async function verify(code: string): Promise<LicenceCheck> {
  const key = publicKey()
  if (!key) return { ok: false, reason: 'NOT_CONFIGURED' }

  const license = parseLicenseCode(code)
  if (!license) return { ok: false, reason: 'INVALID_CODE' }

  const seen = await read(SEEN_KEY)
  const result = verifyOfflineLicense({
    license,
    publicKey: key,
    deviceId: await deviceLicenceId(),
    highestSeenAt: seen,
  })
  if (!result.valid) return { ok: false, reason: result.verdict }

  // Move the high-water mark forward only: a clock set back later is caught.
  const now = new Date().toISOString()
  if (!seen || now > seen) await write(SEEN_KEY, now)
  return { ok: true, expiresAt: license.payload.expires_at }
}

/** The licence this device already accepted, checked again (every entry, every start). */
export async function checkStoredLicence(): Promise<LicenceCheck> {
  const code = await read(CODE_KEY)
  if (!code)
    return publicKey() ? { ok: false, reason: 'MISSING' } : { ok: false, reason: 'NOT_CONFIGURED' }
  return verify(code)
}

/** A pasted code: kept only when it verifies for this device. */
export async function activateLicence(code: string): Promise<LicenceCheck> {
  const result = await verify(code)
  if (result.ok) await write(CODE_KEY, code.replace(/\s+/g, ''))
  return result
}
