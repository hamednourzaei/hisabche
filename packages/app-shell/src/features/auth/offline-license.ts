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
// · The public key: the build's `VITE_OFFLINE_LICENSE_PUBLIC_KEY` if it has
//   one; otherwise the backend makes the key pair and keeps it in the database
//   (offline-licence-keys-01), and the device fetches the PUBLIC half once from
//   `/public/offline/licence-key` and keeps it in the secure store. Without a
//   key — no build key, never online — every licence is refused, never opened
//   unchecked.
// · Not checked here: the workspace. The licence names a business that the
//   device creates after accepting it, and a device already in use keeps its
//   data (owner decision, 21 Oct 2026).
// ============================================

import { parseLicenseCode, verifyOfflineLicense, type LicenseVerdict } from '@hisabche/validation'

import { API_BASE_URL, OFFLINE_LICENSE_PUBLIC_KEY } from '@/shared/lib/api'
import { bridge } from '@/shared/lib/bridge'

const DEVICE_KEY = 'hisabche.licence.device-id'
const CODE_KEY = 'hisabche.licence.code'
/** The latest time a licence check saw — the clock may not go back past it. */
const SEEN_KEY = 'hisabche.licence.seen-at'
/** The server's public key, kept after the first fetch: { keyId, publicKey }. */
const PUBLIC_KEY_KEY = 'hisabche.licence.public-key'

export type LicenceCheck =
  | { ok: true; expiresAt: string }
  | {
      ok: false
      reason: 'NOT_CONFIGURED' | 'MISSING' | 'INVALID_CODE' | 'STORE_ERROR' | LicenseVerdict
    }

async function read(key: string): Promise<{ value: string | null; error?: boolean }> {
  try {
    const val = await bridge()?.secure.get(key)
    return { value: val ?? null }
  } catch {
    return { value: null, error: true }
  }
}

async function write(key: string, value: string): Promise<void> {
  await bridge()?.secure.set(key, value)
}

/** This install's licence id, created the first time it is asked for. */
export async function deviceLicenceId(): Promise<string> {
  const existing = await read(DEVICE_KEY)
  if (existing.value) return existing.value
  const created = crypto.randomUUID()
  await write(DEVICE_KEY, created)
  return created
}

type StoredKey = { keyId: string; publicKey: string }

function asStoredKey(value: unknown): StoredKey | null {
  if (typeof value !== 'object' || value === null) return null
  const { keyId, publicKey } = value as Record<string, unknown>
  return typeof keyId === 'string' &&
    typeof publicKey === 'string' &&
    /^[0-9a-f]{64}$/i.test(publicKey)
    ? { keyId, publicKey }
    : null
}

async function storedKey(): Promise<StoredKey | null> {
  const raw = await read(PUBLIC_KEY_KEY)
  if (!raw.value) return null
  try {
    return asStoredKey(JSON.parse(raw.value))
  } catch {
    return null
  }
}

async function fetchServerKey(): Promise<StoredKey | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/public/offline/licence-key`)
    if (!response.ok) return null
    const key = asStoredKey(await response.json())
    if (key) await write(PUBLIC_KEY_KEY, JSON.stringify(key))
    return key
  } catch {
    return null
  }
}

/** The key that verifies a licence signed with `keyId` (null = none known here). */
async function publicKeyFor(keyId: string | undefined): Promise<string | null> {
  const built = OFFLINE_LICENSE_PUBLIC_KEY?.trim()
  if (built) return built
  const kept = await storedKey()
  if (kept && (!keyId || kept.keyId === keyId)) return kept.publicKey
  const fetched = await fetchServerKey()
  return fetched && (!keyId || fetched.keyId === keyId) ? fetched.publicKey : null
}

async function verify(code: string): Promise<LicenceCheck> {
  const license = parseLicenseCode(code)
  if (!license) return { ok: false, reason: 'INVALID_CODE' }

  const key = await publicKeyFor(license.payload.key_id)
  if (!key) return { ok: false, reason: 'NOT_CONFIGURED' }

  const seenRes = await read(SEEN_KEY)
  if (seenRes.error) return { ok: false, reason: 'STORE_ERROR' }
  const seen = seenRes.value

  // Query latest invoice timestamp as additional high-water mark (GAP-NEW-003 / 03B)
  let dbLatest: string | null = null
  try {
    // Newest row by the column the query builder really orders on (an unknown
    // column name falls back to updated_at), and the later of its two stamps.
    const inv = await bridge()?.db.query({
      table: 'invoice',
      orderBy: 'updated_at',
      direction: 'desc',
      limit: 1,
    })
    const rows = (
      inv as { rows?: Array<{ created_at?: unknown; updated_at?: unknown }> } | undefined
    )?.rows
    const stamps = [rows?.[0]?.created_at, rows?.[0]?.updated_at].filter(
      (v): v is string => typeof v === 'string' && v !== '',
    )
    dbLatest = stamps.sort().reverse()[0] ?? null
  } catch {
    // best-effort read
  }

  const effectiveHighWater =
    [seen, dbLatest]
      .filter((v): v is string => Boolean(v))
      .sort()
      .reverse()[0] ?? null

  const result = verifyOfflineLicense({
    license,
    publicKey: key,
    deviceId: await deviceLicenceId(),
    highestSeenAt: effectiveHighWater,
  })
  if (!result.valid) return { ok: false, reason: result.verdict }

  // Move the high-water mark forward only: a clock set back later is caught.
  const now = new Date().toISOString()
  if (!seen || now > seen) await write(SEEN_KEY, now)
  return { ok: true, expiresAt: license.payload.expires_at }
}

/** The licence this device already accepted, checked again (every entry, every start). */
export async function checkStoredLicence(): Promise<LicenceCheck> {
  const codeRes = await read(CODE_KEY)
  if (codeRes.error) return { ok: false, reason: 'STORE_ERROR' }
  const code = codeRes.value
  if (!code) return { ok: false, reason: 'MISSING' }
  return verify(code)
}

/** A pasted code: kept only when it verifies for this device. */
export async function activateLicence(code: string): Promise<LicenceCheck> {
  const result = await verify(code)
  if (result.ok) await write(CODE_KEY, code.replace(/\s+/g, ''))
  return result
}
