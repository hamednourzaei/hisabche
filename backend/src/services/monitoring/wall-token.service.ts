// ============================================
// backend/src/services/monitoring/wall-token.service.ts
//
// V63 · M-6 — a television cannot hold an admin session with MFA.
//
// A wall token is:
//   - random (32 bytes), shown ONCE when it is created;
//   - stored only as its SHA-256 hash;
//   - scoped to the aggregated monitor stream by ROUTE (not by a permission
//     the token never carries) — it cannot reach any other admin route;
//   - optionally bound to one IP range;
//   - expiring and revocable.
//
// ⚠️ The token is not a weaker admin session. It is a read-only credential for
// one screen, and every route it can reach contains aggregate counts only.
// ============================================

import { createHash, randomBytes } from 'node:crypto'

import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { ipInCidr, isValidCidrEntry } from '../../utils/ip-cidr'
import { AdminSecurityService } from '../admin/admin-security.service'

export interface WallTokenRow {
  id: string
  token_hash: string
  label: string
  ip_cidr: string | null
  expires_at: string
  revoked_at: string | null
  created_by: string | null
  created_at: string
  last_used_at: string | null
}

export interface WallTokenItem {
  id: string
  label: string
  ipCidr: string | null
  expiresAt: string
  revokedAt: string | null
  createdBy: string | null
  createdAt: string
  lastUsedAt: string | null
  state: 'active' | 'expired' | 'revoked'
}

export interface CreatedWallToken {
  /** The only moment this value exists outside the television. */
  token: string
  item: WallTokenItem
}

const MIN_LIFETIME_MS = 60 * 60 * 1000
const MAX_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000

export function hashWallToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function stateOf(row: WallTokenRow, now: Date = new Date()): WallTokenItem['state'] {
  if (row.revoked_at) return 'revoked'
  if (new Date(row.expires_at).getTime() <= now.getTime()) return 'expired'
  return 'active'
}

function toItem(row: WallTokenRow, now: Date = new Date()): WallTokenItem {
  return {
    id: row.id,
    label: row.label,
    ipCidr: row.ip_cidr,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    state: stateOf(row, now),
  }
}

export const WallTokenService = {
  async create(input: {
    label: string
    expiresAt: string
    ipCidr?: string | undefined
    actorEmail: string
  }): Promise<CreatedWallToken> {
    const label = input.label.trim()
    if (label.length === 0 || label.length > 80) {
      throw new ValidationError('A wall token needs a label of at most 80 characters')
    }

    const expiresAt = new Date(input.expiresAt)
    if (Number.isNaN(expiresAt.getTime())) {
      throw new ValidationError('The expiry is not a valid date')
    }
    const lifetime = expiresAt.getTime() - Date.now()
    if (lifetime < MIN_LIFETIME_MS || lifetime > MAX_LIFETIME_MS) {
      throw new ValidationError('A wall token must expire between one hour and one year from now')
    }

    const ipCidr = input.ipCidr?.trim() ?? ''
    if (ipCidr !== '' && !isValidCidrEntry(ipCidr)) {
      throw new ValidationError('The IP binding is not an address or CIDR range')
    }

    const token = randomBytes(32).toString('base64url')
    const { data, error } = await supabase
      .from('admin_wall_tokens')
      .insert({
        token_hash: hashWallToken(token),
        label,
        ip_cidr: ipCidr === '' ? null : ipCidr,
        expires_at: expiresAt.toISOString(),
        created_by: input.actorEmail,
      })
      .select(
        'id, token_hash, label, ip_cidr, expires_at, revoked_at, created_by, created_at, last_used_at',
      )
      .single()

    if (error) throw new DatabaseError('Failed to create the wall token', error)

    await AdminSecurityService.logSecurityEvent({
      eventType: 'WALL_TOKEN_CREATED',
      adminEmail: input.actorEmail,
      details: { label, ipCidr: ipCidr === '' ? null : ipCidr, expiresAt: expiresAt.toISOString() },
    })

    return { token, item: toItem(data as WallTokenRow) }
  },

  async list(): Promise<WallTokenItem[]> {
    const { data, error } = await supabase
      .from('admin_wall_tokens')
      .select(
        'id, token_hash, label, ip_cidr, expires_at, revoked_at, created_by, created_at, last_used_at',
      )
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw new DatabaseError('Failed to read the wall tokens', error)
    return (data as WallTokenRow[]).map((row) => toItem(row))
  },

  async revoke(id: string, actorEmail: string): Promise<void> {
    const { data, error } = await supabase
      .from('admin_wall_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .is('revoked_at', null)
      .select('id, label')
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to revoke the wall token', error)
    if (!data) throw new NotFoundError('Wall token')

    await AdminSecurityService.logSecurityEvent({
      eventType: 'WALL_TOKEN_REVOKED',
      adminEmail: actorEmail,
      details: { id, label: (data as { label: string }).label },
    })
  },

  /**
   * Verify a presented token. Returns the row when it is active, not expired,
   * not revoked, and — when an IP was bound — presented from that range.
   *
   * A refusal is logged with the reason; the token value never appears in the
   * event.
   */
  async verify(token: string, ipAddress: string): Promise<WallTokenRow | null> {
    if (!token || token.length < 20) return null
    const hash = hashWallToken(token)

    const { data, error } = await supabase
      .from('admin_wall_tokens')
      .select(
        'id, token_hash, label, ip_cidr, expires_at, revoked_at, created_by, created_at, last_used_at',
      )
      .eq('token_hash', hash)
      .maybeSingle()

    if (error || !data) return null
    const row = data as WallTokenRow

    const state = stateOf(row)
    if (state !== 'active') {
      await AdminSecurityService.logSecurityEvent({
        eventType: 'WALL_TOKEN_REFUSED',
        ipAddress,
        details: { id: row.id, reason: state },
      })
      return null
    }

    if (row.ip_cidr && !ipInCidr(ipAddress, row.ip_cidr)) {
      await AdminSecurityService.logSecurityEvent({
        eventType: 'WALL_TOKEN_REFUSED',
        ipAddress,
        details: { id: row.id, reason: 'ip_mismatch' },
      })
      return null
    }

    void supabase
      .from('admin_wall_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', row.id)
      .then(
        () => undefined,
        () => undefined,
      )

    return row
  },
}
