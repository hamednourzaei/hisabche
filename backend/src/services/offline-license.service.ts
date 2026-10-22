// ============================================
// backend/src/services/offline-license.service.ts
// Offline Licence Issuance, Revocation, Seats & Two-Tier Enforcement
// ============================================

import { randomUUID } from 'node:crypto'
import {
  generateOfflineLicenseKeyPair,
  hexToBytes,
  offlineLicensePublicKeyOf,
  signOfflineLicense,
  type DeviceSeat,
  type OfflineLicensePayload,
  type SignedOfflineLicense,
  type Tier1EvidenceType,
  type Tier2SignalType,
} from '@hisabche/validation'
import { supabase } from '../db'
import { BaseError } from '../errors/base.error'
import { DatabaseError, NotFoundError } from '../errors/database.error'

export class LicenseSigningNotConfiguredError extends BaseError {
  public readonly code = 'LICENSE_SIGNING_NOT_CONFIGURED'

  constructor(message = 'License signing is not configured on this server') {
    super(message, 503)
    this.name = 'LicenseSigningNotConfiguredError'
  }
}

export class OfflinePlanRequiredError extends BaseError {
  public readonly code = 'OFFLINE_PLAN_REQUIRED'

  constructor(message = 'An active OFFLINE plan is required to issue offline licences') {
    super(message, 403)
    this.name = 'OfflinePlanRequiredError'
  }
}

export class LicenseSeatsFullError extends BaseError {
  public readonly code = 'LICENSE_SEATS_FULL'

  constructor(seat: DeviceSeat) {
    super(
      `Active ${seat} seat is already occupied. Transfer seat or release old device to proceed.`,
      409,
    )
    this.name = 'LicenseSeatsFullError'
  }
}

export class LicenseTransfersExceededError extends BaseError {
  public readonly code = 'LICENSE_TRANSFERS_EXCEEDED'

  constructor(
    message = 'Maximum 3 seat transfers per calendar year reached. Admin override required.',
  ) {
    super(message, 409)
    this.name = 'LicenseTransfersExceededError'
  }
}

export class LicenseBannedError extends BaseError {
  public readonly code = 'LICENSE_BANNED'

  constructor(reason?: string) {
    super(
      `Licence is permanently banned due to policy violation: ${reason ?? 'unspecified'}. Operational writes are disabled.`,
      403,
    )
    this.name = 'LicenseBannedError'
  }
}

export class LicenseRevokedError extends BaseError {
  public readonly code = 'LICENSE_REVOKED'

  constructor(message = 'Licence has been revoked by workspace administrator') {
    super(message, 403)
    this.name = 'LicenseRevokedError'
  }
}

export interface IssueOfflineLicenseParams {
  workspaceId: string
  accountId: string
  deviceId?: string | undefined
  label?: string | null | undefined
  features?: string[] | undefined
  periodDays?: number | undefined
}

export interface ActivateSeatParams {
  workspaceId: string
  licenseId: string
  seat: DeviceSeat
  stableId: string
  devicePublicKey: string
  label?: string | null | undefined
  ipAddress?: string | undefined
  allowTransfer?: boolean | undefined
  adminOverride?: boolean | undefined
}

export interface DeviceRecord {
  device_id: string
  workspace_id: string
  license_id?: string | null
  seat?: DeviceSeat | null
  stable_id?: string | null
  public_key?: string | null
  ip_address?: string | null
  is_active?: boolean
  label: string | null
  activated_at: string
  released_at: string | null
  last_verified_at: string | null
  created_at: string
  updated_at: string
}

export interface OfflineLicenseRecord {
  license_id: string
  workspace_id: string
  account_id: string
  plan: string
  status?: 'active' | 'revoked' | 'banned'
  banned_at?: string | null
  ban_reason?: string | null
  transfer_count?: number
  transfer_year?: number
  issued_at: string
  expires_at: string
  device_id: string | null
  features: string[]
  version: number
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export interface LicenseLogEntry {
  license_id: string
  workspace_id: string
  event:
    | 'activation'
    | 'rejected_activation'
    | 'reinstall'
    | 'transfer'
    | 'connection'
    | 'ban'
    | 'unban'
    | 'tier2_flagged'
  device_seat?: DeviceSeat | undefined
  device_id?: string | undefined
  stable_id?: string | undefined
  ip_address?: string | undefined
  reason?: string | undefined
  evidence?: Record<string, unknown> | undefined
}

/**
 * Strict privacy filter for licence logs:
 * NEVER writes invoice IDs, customer names or amounts to the licence log.
 */
export function sanitizeLicenseLogEvidence(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null
  const forbiddenPatterns = [
    'invoice',
    'customer',
    'amount',
    'total',
    'price',
    'money',
    'revenue',
    'debt',
  ]
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase()
    const isForbidden = forbiddenPatterns.some((pattern) => lowerKey.includes(pattern))
    if (!isForbidden) {
      sanitized[key] = value
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null
}

export class OfflineLicenseService {
  /**
   * The signing key. The backend makes it the first time it is needed and
   * keeps it in `offline_license_signing_keys` (offline-licence-keys-01) —
   * no environment file to set (owner, 22 Oct 2026). Only service_role can
   * read that table. `OFFLINE_LICENSE_PRIVATE_KEY`, when set, still wins:
   * that is how tests sign with a known pair.
   * Returns null only when the table is missing (migration not run yet).
   */
  async getSigningKey(): Promise<{
    secretKey: Uint8Array
    keyId: string
    publicKey: string
  } | null> {
    const rawKey = process.env.OFFLINE_LICENSE_PRIVATE_KEY?.trim()
    if (rawKey && /^[0-9a-f]{64}$/i.test(rawKey)) {
      const secretKey = hexToBytes(rawKey)
      return {
        secretKey,
        keyId: process.env.OFFLINE_LICENSE_KEY_ID?.trim() || 'v1',
        publicKey: offlineLicensePublicKeyOf(secretKey),
      }
    }

    const active = await this.readActiveKey()
    if (active === 'MISSING_TABLE') return null
    if (active) return active

    const created = generateOfflineLicenseKeyPair()
    const { error } = await supabase.from('offline_license_signing_keys').insert({
      key_id: `k-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`,
      private_key_hex: created.secretKeyHex,
      public_key_hex: created.publicKeyHex,
    })
    // 23505: another request made the key at the same moment — use that one.
    if (error && error.code !== '23505') {
      throw new DatabaseError('Failed to store the licence signing key', error)
    }
    const stored = await this.readActiveKey()
    return stored === 'MISSING_TABLE' ? null : stored
  }

  private async readActiveKey(): Promise<
    { secretKey: Uint8Array; keyId: string; publicKey: string } | null | 'MISSING_TABLE'
  > {
    const { data, error } = await supabase
      .from('offline_license_signing_keys')
      .select('key_id, private_key_hex, public_key_hex')
      .is('retired_at', null)
      .maybeSingle()
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        console.warn(
          '[offline-licence] offline_license_signing_keys is missing — run offline-licence-keys-01',
        )
        return 'MISSING_TABLE'
      }
      throw new DatabaseError('Failed to read the licence signing key', error)
    }
    if (!data) return null
    return {
      secretKey: hexToBytes(data.private_key_hex as string),
      keyId: data.key_id as string,
      publicKey: data.public_key_hex as string,
    }
  }

  /**
   * Appends an event to the append-only license_logs table.
   * Enforces privacy by ensuring evidence never contains invoices, customer names or amounts.
   */
  async logEvent(entry: LicenseLogEntry): Promise<void> {
    const evidence = sanitizeLicenseLogEvidence(entry.evidence)
    await supabase.from('license_logs').insert({
      license_id: entry.license_id,
      workspace_id: entry.workspace_id,
      event: entry.event,
      device_seat: entry.device_seat ?? null,
      device_id: entry.device_id ?? null,
      stable_id: entry.stable_id ?? null,
      ip_address: entry.ip_address ?? null,
      reason: entry.reason ?? null,
      evidence: evidence ? JSON.stringify(evidence) : null,
      created_at: new Date().toISOString(),
    })
  }

  /**
   * Issues a cryptographically signed offline licence for a workspace and device.
   * Fails with 503 LICENSE_SIGNING_NOT_CONFIGURED if private key is missing.
   * Fails with 403 OFFLINE_PLAN_REQUIRED if workspace does not have an active OFFLINE plan.
   */
  async issueOfflineLicense(params: IssueOfflineLicenseParams): Promise<SignedOfflineLicense> {
    const keyInfo = await this.getSigningKey()
    if (!keyInfo) {
      throw new LicenseSigningNotConfiguredError()
    }

    const { workspaceId, accountId } = params

    // 1. Check workspace subscription for active OFFLINE plan
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('plan, status, period_end')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (subError) {
      throw new DatabaseError('Failed to read workspace subscription', subError)
    }

    const isOfflinePlan = sub && (sub.plan === 'OFFLINE' || sub.plan === 'offline')
    const isActive = sub && sub.status === 'active'

    if (!isOfflinePlan || !isActive) {
      throw new OfflinePlanRequiredError()
    }

    const now = new Date()
    const targetDeviceId = params.deviceId ?? randomUUID()
    const licenseId = randomUUID()

    // 2. Register/activate device in devices table
    const { error: deviceError } = await supabase.from('devices').upsert({
      device_id: targetDeviceId,
      workspace_id: workspaceId,
      label: params.label ?? null,
      activated_at: now.toISOString(),
      released_at: null,
      last_verified_at: now.toISOString(),
      updated_at: now.toISOString(),
    })

    if (deviceError) {
      throw new DatabaseError('Failed to register device', deviceError)
    }

    // 3. Compute expiration (from subscription period_end or default period)
    let expiresAtStr: string
    if (sub.period_end) {
      expiresAtStr = new Date(sub.period_end).toISOString()
    } else {
      const days = params.periodDays ?? 365
      const exp = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
      expiresAtStr = exp.toISOString()
    }

    const features =
      params.features && params.features.length > 0
        ? params.features
        : ['invoice.create', 'reports.view', 'export.all']

    const payload: OfflineLicensePayload = {
      license_id: licenseId,
      workspace_id: workspaceId,
      account_id: accountId,
      plan: 'OFFLINE',
      issued_at: now.toISOString(),
      expires_at: expiresAtStr,
      device_id: targetDeviceId,
      features,
      version: 1,
      key_id: keyInfo.keyId,
    }

    // 4. Sign payload with Ed25519
    const signed = signOfflineLicense(payload, keyInfo.secretKey, keyInfo.keyId)

    // 5. Insert record into offline_licenses table
    const { error: licError } = await supabase.from('offline_licenses').insert({
      license_id: payload.license_id,
      workspace_id: workspaceId,
      account_id: accountId,
      plan: 'OFFLINE',
      status: 'active',
      issued_at: payload.issued_at,
      expires_at: payload.expires_at,
      device_id: payload.device_id,
      features: payload.features,
      version: 1,
      revoked_at: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })

    if (licError) {
      throw new DatabaseError('Failed to store offline licence', licError)
    }

    // 6. Record events & logs
    await supabase.from('subscription_events').insert({
      workspace_id: workspaceId,
      event: 'licence_issued',
    })

    await this.logEvent({
      license_id: payload.license_id,
      workspace_id: workspaceId,
      event: 'activation',
      device_id: targetDeviceId,
      reason: 'Initial licence issuance and activation',
    })

    return signed
  }

  /**
   * A licence the platform admin issues for ONE DEVICE and a business that
   * does not exist yet (owner decision, 21 Oct 2026).
   *
   * The offline edition is sold to people who may never open an online
   * account, so there is no subscription to check: the admin's issuing IS
   * the sale. The business and its owner are new ids — the device creates the
   * business after the licence is accepted. Bound to the device id the app
   * shows on its licence screen; another device rejects it (WRONG_DEVICE).
   */
  async issueDeviceLicense(params: {
    deviceId: string
    label?: string | undefined
    periodDays: number
  }): Promise<SignedOfflineLicense> {
    const keyInfo = await this.getSigningKey()
    if (!keyInfo) throw new LicenseSigningNotConfiguredError()

    const now = new Date()
    const workspaceId = randomUUID()
    const payload: OfflineLicensePayload = {
      license_id: randomUUID(),
      workspace_id: workspaceId,
      account_id: randomUUID(),
      plan: 'OFFLINE',
      issued_at: now.toISOString(),
      expires_at: new Date(now.getTime() + params.periodDays * 24 * 60 * 60 * 1000).toISOString(),
      device_id: params.deviceId,
      features: ['invoice.create', 'reports.view', 'export.all'],
      version: 1,
      key_id: keyInfo.keyId,
    }
    const signed = signOfflineLicense(payload, keyInfo.secretKey, keyInfo.keyId)

    // The record first: a licence the admin cannot later find cannot be revoked.
    const { error: licError } = await supabase.from('offline_licenses').insert({
      license_id: payload.license_id,
      workspace_id: workspaceId,
      account_id: payload.account_id,
      plan: 'OFFLINE',
      status: 'active',
      issued_at: payload.issued_at,
      expires_at: payload.expires_at,
      device_id: payload.device_id,
      features: payload.features,
      version: 1,
      revoked_at: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    if (licError) throw new DatabaseError('Failed to store offline licence', licError)

    const { error: deviceError } = await supabase.from('devices').upsert({
      device_id: payload.device_id,
      workspace_id: workspaceId,
      label: params.label ?? null,
      activated_at: now.toISOString(),
      released_at: null,
      last_verified_at: null,
      updated_at: now.toISOString(),
    })
    if (deviceError) throw new DatabaseError('Failed to register device', deviceError)

    await this.logEvent({
      license_id: payload.license_id,
      workspace_id: workspaceId,
      event: 'activation',
      device_id: payload.device_id,
      reason: 'Issued by the platform admin for one device',
    })

    return signed
  }

  /**
   * Activates a device seat on the licence (1 computer + 1 mobile).
   * - 2nd computer or 2nd mobile -> LICENSE_SEATS_FULL (refused, dashboard locked).
   * - Reinstall on same device (matching stableId) -> free forever, rebinds seat.
   * - Transfer: max 3 per calendar year, admin override allowed.
   */
  async activateSeat(params: ActivateSeatParams): Promise<{
    device: DeviceRecord
    seat: DeviceSeat
    isReinstall: boolean
    isTransfer: boolean
  }> {
    const {
      workspaceId,
      licenseId,
      seat,
      stableId,
      devicePublicKey,
      label,
      ipAddress,
      allowTransfer,
      adminOverride,
    } = params

    // 1. Fetch licence record
    const { data: lic, error: licError } = await supabase
      .from('offline_licenses')
      .select('*')
      .eq('license_id', licenseId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (licError || !lic) {
      throw new NotFoundError('Offline licence')
    }

    if (lic.status === 'banned' || lic.banned_at != null) {
      await this.logEvent({
        license_id: licenseId,
        workspace_id: workspaceId,
        event: 'rejected_activation',
        device_seat: seat,
        stable_id: stableId,
        ip_address: ipAddress,
        reason: 'LICENSE_BANNED',
      })
      throw new LicenseBannedError(lic.ban_reason ?? 'Banned licence cannot activate seats')
    }

    if (lic.status === 'revoked' || lic.revoked_at != null) {
      await this.logEvent({
        license_id: licenseId,
        workspace_id: workspaceId,
        event: 'rejected_activation',
        device_seat: seat,
        stable_id: stableId,
        ip_address: ipAddress,
        reason: 'LICENSE_REVOKED',
      })
      throw new LicenseRevokedError()
    }

    const now = new Date()
    const currentYear = now.getFullYear()

    // 2. Check current active device for this seat
    const { data: activeDevices, error: devQueryError } = await supabase
      .from('devices')
      .select('*')
      .eq('license_id', licenseId)
      .eq('seat', seat)
      .eq('is_active', true)

    if (devQueryError) {
      throw new DatabaseError('Failed to query device seats', devQueryError)
    }

    const existingDevice = activeDevices && activeDevices.length > 0 ? activeDevices[0] : null

    // Case A: Seat is vacant -> activate immediately
    if (!existingDevice) {
      const newDeviceId = randomUUID()
      const newDevice: DeviceRecord = {
        device_id: newDeviceId,
        workspace_id: workspaceId,
        license_id: licenseId,
        seat,
        stable_id: stableId,
        public_key: devicePublicKey,
        ip_address: ipAddress ?? null,
        label: label ?? null,
        is_active: true,
        activated_at: now.toISOString(),
        released_at: null,
        last_verified_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      }

      const { error: insertErr } = await supabase.from('devices').insert(newDevice)
      if (insertErr) throw new DatabaseError('Failed to register device seat', insertErr)

      await this.logEvent({
        license_id: licenseId,
        workspace_id: workspaceId,
        event: 'activation',
        device_seat: seat,
        device_id: newDeviceId,
        stable_id: stableId,
        ip_address: ipAddress,
        reason: `Initial activation for ${seat} seat`,
      })

      return { device: newDevice, seat, isReinstall: false, isTransfer: false }
    }

    // Case B: Seat is occupied
    // Sub-case B1: Reinstall on the same device (stable_id matches)
    if (existingDevice.stable_id === stableId) {
      const updatedFields = {
        public_key: devicePublicKey,
        label: label ?? existingDevice.label,
        ip_address: ipAddress ?? existingDevice.ip_address,
        last_verified_at: now.toISOString(),
        updated_at: now.toISOString(),
      }

      await supabase.from('devices').update(updatedFields).eq('device_id', existingDevice.device_id)

      await this.logEvent({
        license_id: licenseId,
        workspace_id: workspaceId,
        event: 'reinstall',
        device_seat: seat,
        device_id: existingDevice.device_id,
        stable_id: stableId,
        ip_address: ipAddress,
        reason: `Reinstall on same device for ${seat} seat (free forever)`,
      })

      return {
        device: { ...existingDevice, ...updatedFields },
        seat,
        isReinstall: true,
        isTransfer: false,
      }
    }

    // Sub-case B2: Different physical device (stable_id differs)
    if (!allowTransfer) {
      // 2nd computer or 2nd mobile -> refused!
      await this.logEvent({
        license_id: licenseId,
        workspace_id: workspaceId,
        event: 'rejected_activation',
        device_seat: seat,
        stable_id: stableId,
        ip_address: ipAddress,
        reason: 'LICENSE_SEATS_FULL',
      })
      throw new LicenseSeatsFullError(seat)
    }

    // Transfer requested: verify yearly quota (max 3/year unless adminOverride)
    const transfersThisYear = lic.transfer_year === currentYear ? (lic.transfer_count ?? 0) : 0
    if (transfersThisYear >= 3 && !adminOverride) {
      await this.logEvent({
        license_id: licenseId,
        workspace_id: workspaceId,
        event: 'rejected_activation',
        device_seat: seat,
        stable_id: stableId,
        ip_address: ipAddress,
        reason: 'LICENSE_TRANSFERS_EXCEEDED',
      })
      throw new LicenseTransfersExceededError()
    }

    // Execute transfer: deactivate old device, activate new device
    await supabase
      .from('devices')
      .update({ is_active: false, released_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('device_id', existingDevice.device_id)

    const newDeviceId = randomUUID()
    const newDevice: DeviceRecord = {
      device_id: newDeviceId,
      workspace_id: workspaceId,
      license_id: licenseId,
      seat,
      stable_id: stableId,
      public_key: devicePublicKey,
      ip_address: ipAddress ?? null,
      label: label ?? null,
      is_active: true,
      activated_at: now.toISOString(),
      released_at: null,
      last_verified_at: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }

    await supabase.from('devices').insert(newDevice)

    // Increment transfer counter
    await supabase
      .from('offline_licenses')
      .update({
        transfer_year: currentYear,
        transfer_count: transfersThisYear + 1,
        updated_at: now.toISOString(),
      })
      .eq('license_id', licenseId)

    await this.logEvent({
      license_id: licenseId,
      workspace_id: workspaceId,
      event: 'transfer',
      device_seat: seat,
      device_id: newDeviceId,
      stable_id: stableId,
      ip_address: ipAddress,
      reason: `Transferred ${seat} seat (${transfersThisYear + 1}/3 this year, adminOverride: ${Boolean(adminOverride)})`,
    })

    return { device: newDevice, seat, isReinstall: false, isTransfer: true }
  }

  /**
   * TIER 1 ENFORCEMENT: Definitive cryptographic evidence
   * Immediately issues an automatic permanent ban on the licence,
   * deactivates all active seats, and logs the event with the cryptographic evidence.
   */
  async reportTier1Violation(params: {
    workspaceId: string
    licenseId: string
    violation: Tier1EvidenceType
    evidence: Record<string, unknown>
    deviceSeat?: DeviceSeat | undefined
    stableId?: string | undefined
    ipAddress?: string | undefined
  }): Promise<{ banned: true; reason: string; banned_at: string }> {
    const now = new Date().toISOString()
    const { workspaceId, licenseId, violation, evidence, deviceSeat, stableId, ipAddress } = params

    // 1. Mark licence as permanently banned
    await supabase
      .from('offline_licenses')
      .update({
        status: 'banned',
        banned_at: now,
        ban_reason: violation,
        updated_at: now,
      })
      .eq('license_id', licenseId)
      .eq('workspace_id', workspaceId)

    // 2. Deactivate all devices for this licence
    await supabase
      .from('devices')
      .update({ is_active: false, released_at: now, updated_at: now })
      .eq('license_id', licenseId)

    // 3. Log ban with cryptographic evidence (sanitizer ensures no customer/invoice data)
    await this.logEvent({
      license_id: licenseId,
      workspace_id: workspaceId,
      event: 'ban',
      device_seat: deviceSeat,
      stable_id: stableId,
      ip_address: ipAddress,
      reason:
        violation === 'admin_confirmed_review'
          ? 'Abuse confirmed by an admin after review'
          : `Tier-1 cryptographic violation: ${violation}`,
      evidence,
    })

    await supabase.from('subscription_events').insert({
      workspace_id: workspaceId,
      event: 'licence_banned',
    })

    return { banned: true, reason: violation, banned_at: now }
  }

  /**
   * TIER 2 ENFORCEMENT: Heuristic signals
   * NEVER auto-bans. Enqueues the event into the review queue for administrator investigation.
   */
  async reportTier2Signal(params: {
    workspaceId: string
    licenseId: string
    signalType: Tier2SignalType
    details: Record<string, unknown>
    deviceSeat?: DeviceSeat | undefined
    stableId?: string | undefined
    ipAddress?: string | undefined
  }): Promise<{ queued: true; status: 'pending'; signalType: Tier2SignalType }> {
    const { workspaceId, licenseId, signalType, details, deviceSeat, stableId, ipAddress } = params
    const sanitizedDetails = sanitizeLicenseLogEvidence(details)

    // 1. Insert into review queue
    await supabase.from('license_review_queue').insert({
      license_id: licenseId,
      workspace_id: workspaceId,
      signal_type: signalType,
      details: sanitizedDetails ? JSON.stringify(sanitizedDetails) : null,
      status: 'pending',
      created_at: new Date().toISOString(),
    })

    // 2. Log tier2_flagged event in license_logs (licence is NOT banned)
    await this.logEvent({
      license_id: licenseId,
      workspace_id: workspaceId,
      event: 'tier2_flagged',
      device_seat: deviceSeat,
      stable_id: stableId,
      ip_address: ipAddress,
      reason: `Tier-2 heuristic signal detected: ${signalType}`,
      evidence: sanitizedDetails ?? undefined,
    })

    return { queued: true, status: 'pending', signalType }
  }

  /**
   * Admin-only unban: lifts a permanent ban on a licence.
   */
  async unbanLicense(params: {
    workspaceId: string
    licenseId: string
    adminId: string
    reason: string
  }): Promise<{ unbanned: true }> {
    const now = new Date().toISOString()
    const { workspaceId, licenseId, adminId, reason } = params

    await supabase
      .from('offline_licenses')
      .update({
        status: 'active',
        banned_at: null,
        ban_reason: null,
        updated_at: now,
      })
      .eq('license_id', licenseId)
      .eq('workspace_id', workspaceId)

    await this.logEvent({
      license_id: licenseId,
      workspace_id: workspaceId,
      event: 'unban',
      reason: `Ban lifted by admin: ${reason}`,
      evidence: { unbanned_by: adminId },
    })

    await supabase.from('subscription_events').insert({
      workspace_id: workspaceId,
      event: 'licence_unbanned',
    })

    return { unbanned: true }
  }

  /**
   * Device connection / heartbeat:
   * Records last_verified_at and informs offline device of ban status upon next connection.
   */
  async connectDevice(params: {
    workspaceId: string
    licenseId: string
    deviceId: string
    ipAddress?: string | undefined
  }): Promise<{
    status: 'active' | 'banned' | 'revoked'
    banned_at?: string | null | undefined
    ban_reason?: string | null | undefined
  }> {
    const { workspaceId, licenseId, deviceId, ipAddress } = params
    const now = new Date().toISOString()

    const { data: lic } = await supabase
      .from('offline_licenses')
      .select('status, banned_at, ban_reason')
      .eq('license_id', licenseId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    await supabase
      .from('devices')
      .update({ last_verified_at: now, ip_address: ipAddress ?? null })
      .eq('device_id', deviceId)

    await this.logEvent({
      license_id: licenseId,
      workspace_id: workspaceId,
      event: 'connection',
      device_id: deviceId,
      ip_address: ipAddress,
      reason: 'Heartbeat connection',
    })

    if (lic?.status === 'banned') {
      return {
        status: 'banned',
        banned_at: lic.banned_at,
        ban_reason: lic.ban_reason,
      }
    }

    if (lic?.status === 'revoked') {
      return { status: 'revoked' }
    }

    return { status: 'active' }
  }

  /** The workspace a licence belongs to — read from the row, never taken from a request. */
  async workspaceOfLicense(licenseId: string): Promise<string> {
    const { data, error } = await supabase
      .from('offline_licenses')
      .select('workspace_id')
      .eq('license_id', licenseId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read licence', error)
    if (!data) throw new NotFoundError('Offline licence')
    return (data as { workspace_id: string }).workspace_id
  }

  /** The workspace a device belongs to — read from the row, never taken from a request. */
  async workspaceOfDevice(deviceId: string): Promise<string> {
    const { data, error } = await supabase
      .from('devices')
      .select('workspace_id')
      .eq('device_id', deviceId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read device', error)
    if (!data) throw new NotFoundError('Device')
    return (data as { workspace_id: string }).workspace_id
  }

  /** Revokes an offline licence for the workspace. */
  async revokeLicense(
    workspaceId: string,
    licenseId: string,
  ): Promise<{ success: boolean; revoked_at: string }> {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('offline_licenses')
      .update({ status: 'revoked', revoked_at: now, updated_at: now })
      .eq('license_id', licenseId)
      .eq('workspace_id', workspaceId)

    if (error) {
      throw new DatabaseError('Failed to revoke licence', error)
    }

    await supabase.from('subscription_events').insert({
      workspace_id: workspaceId,
      event: 'licence_revoked',
    })

    await this.logEvent({
      license_id: licenseId,
      workspace_id: workspaceId,
      event: 'rejected_activation',
      reason: 'Licence manually revoked',
    })

    return { success: true, revoked_at: now }
  }

  /** Activates a device for the workspace. */
  async activateDevice(
    workspaceId: string,
    deviceId: string,
    label?: string | null | undefined,
  ): Promise<DeviceRecord> {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('devices')
      .upsert({
        device_id: deviceId,
        workspace_id: workspaceId,
        label: label ?? null,
        is_active: true,
        activated_at: now,
        released_at: null,
        last_verified_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (error || !data) {
      throw new DatabaseError('Failed to activate device', error)
    }

    return data as DeviceRecord
  }

  /** Releases a device from the workspace (e.g. from web portal or migration). */
  async releaseDevice(
    workspaceId: string,
    deviceId: string,
  ): Promise<{ success: boolean; released_at: string }> {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('devices')
      .update({ is_active: false, released_at: now, updated_at: now })
      .eq('device_id', deviceId)
      .eq('workspace_id', workspaceId)

    if (error) {
      throw new DatabaseError('Failed to release device', error)
    }

    await supabase.from('subscription_events').insert({
      workspace_id: workspaceId,
      event: 'device_released',
    })

    return { success: true, released_at: now }
  }

  /** Lists offline licences issued for the workspace. */
  async listLicenses(workspaceId: string): Promise<OfflineLicenseRecord[]> {
    const { data, error } = await supabase
      .from('offline_licenses')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new DatabaseError('Failed to list offline licences', error)
    }

    return (data ?? []) as OfflineLicenseRecord[]
  }

  /** Lists devices registered for the workspace. */
  async listDevices(workspaceId: string): Promise<DeviceRecord[]> {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new DatabaseError('Failed to list devices', error)
    }

    return (data ?? []) as DeviceRecord[]
  }

  /** Lists revoked licence ids for the workspace. */
  async listRevocations(workspaceId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('offline_licenses')
      .select('license_id')
      .eq('workspace_id', workspaceId)
      .not('revoked_at', 'is', null)

    if (error) {
      throw new DatabaseError('Failed to list licence revocations', error)
    }

    return (data ?? []).map((row: { license_id: string }) => row.license_id)
  }

  /** Lists licence logs for the workspace. */
  async listLogs(
    workspaceId: string,
    licenseId?: string | undefined,
  ): Promise<Record<string, unknown>[]> {
    let query = supabase
      .from('license_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (licenseId) {
      query = query.eq('license_id', licenseId)
    }

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to list licence logs', error)
    return data ?? []
  }

  /** Lists pending items in the tier-2 review queue. */
  async listReviewQueue(workspaceId: string): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
      .from('license_review_queue')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to list review queue', error)
    return data ?? []
  }
}

export const offlineLicenseService = new OfflineLicenseService()
