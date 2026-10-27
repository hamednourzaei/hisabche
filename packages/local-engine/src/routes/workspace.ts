// ============================================
// packages/local-engine/src/routes/workspace.ts
//
// Local workspace management and member queries.
// ============================================

import { createWorkspaceSchema, updateWorkspaceSchema } from '@hisabche/validation'
import { NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

export interface LocalWorkspaceRow {
  id: string
  name: string
  base_currency: string
  time_zone: string
  business_types: string | null
  business_types_updated_at: string | null
  logo_url: string | null
  stamp_url: string | null
  signature_url: string | null
  created_at: string
  updated_at: string
}

/** The stored comma-separated value as the catalogue's ids. */
export function splitBusinessTypes(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

function joinBusinessTypes(values: readonly string[] | null | undefined): string {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].join(',')
}

export interface LocalUserRow {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: string
  created_at: string
  updated_at: string
}

function mapWorkspace(row: LocalWorkspaceRow, ownerId: string) {
  return {
    id: row.id,
    name: row.name,
    slug: row.id,
    description: null,
    baseCurrency: row.base_currency,
    base_currency: row.base_currency,
    timeZone: row.time_zone,
    time_zone: row.time_zone,
    businessTypes: splitBusinessTypes(row.business_types),
    business_types: splitBusinessTypes(row.business_types),
    businessTypesUpdatedAt: row.business_types_updated_at,
    business_types_updated_at: row.business_types_updated_at,
    logoUrl: row.logo_url,
    logo_url: row.logo_url,
    stampUrl: row.stamp_url,
    stamp_url: row.stamp_url,
    signatureUrl: row.signature_url,
    signature_url: row.signature_url,
    ownerId,
    owner_id: ownerId,
    isActive: true,
    is_active: true,
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at,
    myRole: 'owner',
  }
}

export function registerWorkspaceRoutes(router: Router): void {
  // ─── GET /workspaces ─────────────────────────────────────────
  router.get('/workspaces', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const ws = db.get<LocalWorkspaceRow>('SELECT * FROM local_workspace LIMIT 1')
    if (!ws) {
      return []
    }
    return [mapWorkspace(ws, ctx.userId)]
  })

  // ─── GET /workspaces/:id ─────────────────────────────────────
  router.get('/workspaces/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const id = params.id
    const ws = db.get<LocalWorkspaceRow>('SELECT * FROM local_workspace WHERE id = ? LIMIT 1', [id])
    if (!ws) {
      throw new NotFoundError('Workspace', id)
    }
    return mapWorkspace(ws, ctx.userId)
  })

  // ─── PATCH /workspaces/:id ───────────────────────────────────
  router.patch('/workspaces/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const id = params.id

    const ws = db.get<LocalWorkspaceRow>('SELECT * FROM local_workspace WHERE id = ? LIMIT 1', [id])
    if (!ws) throw new NotFoundError('Workspace', id)

    const raw = (body || {}) as Record<string, unknown>
    const parsed = updateWorkspaceSchema.safeParse({ id, ...raw })
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      throw new ValidationError(msg)
    }
    const b = parsed.data as Record<string, unknown>

    const name = typeof b.name === 'string' ? b.name : ws.name
    const timeZone =
      typeof b.timeZone === 'string'
        ? b.timeZone
        : typeof b.time_zone === 'string'
          ? b.time_zone
          : ws.time_zone
    const logoUrl =
      'logoUrl' in b
        ? (b.logoUrl as string | null)
        : 'logo_url' in b
          ? (b.logo_url as string | null)
          : ws.logo_url
    const stampUrl =
      'stampUrl' in b
        ? (b.stampUrl as string | null)
        : 'stamp_url' in b
          ? (b.stamp_url as string | null)
          : ws.stamp_url
    const signatureUrl =
      'signatureUrl' in b
        ? (b.signatureUrl as string | null)
        : 'signature_url' in b
          ? (b.signature_url as string | null)
          : ws.signature_url

    // The industry list. An explicit write always carries a timestamp so the
    // sync conflict rule («latest explicit write wins») has something to compare.
    const businessTypesTouched = 'businessTypes' in b || 'business_types' in b
    const businessTypes = businessTypesTouched
      ? joinBusinessTypes(
          ('businessTypes' in b ? b.businessTypes : b.business_types) as
            string[] | null | undefined,
        )
      : (ws.business_types ?? '')
    const businessTypesUpdatedAt = businessTypesTouched
      ? typeof b.businessTypesUpdatedAt === 'string'
        ? b.businessTypesUpdatedAt
        : new Date().toISOString()
      : ws.business_types_updated_at

    const now = new Date().toISOString()

    db.run(
      `UPDATE local_workspace SET
        name = ?,
        time_zone = ?,
        business_types = ?,
        business_types_updated_at = ?,
        logo_url = ?,
        stamp_url = ?,
        signature_url = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        name,
        timeZone,
        businessTypes,
        businessTypesUpdatedAt,
        logoUrl,
        stampUrl,
        signatureUrl,
        now,
        ws.id,
      ],
    )

    const updated = db.get<LocalWorkspaceRow>(
      'SELECT * FROM local_workspace WHERE id = ? LIMIT 1',
      [ws.id],
    )
    return mapWorkspace(updated ?? ws, ctx.userId)
  })

  // ─── POST /workspaces ────────────────────────────────────────
  router.post('/workspaces', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c

    const parsed = createWorkspaceSchema.safeParse(body)
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      throw new ValidationError(msg)
    }
    const b = parsed.data as {
      name?: string
      baseCurrency?: string
      timeZone?: string
      businessTypes?: string[]
    }
    const name = b.name?.trim() || 'Hisabche Workspace'

    const existing = db.get<LocalWorkspaceRow>('SELECT * FROM local_workspace LIMIT 1')
    if (existing) {
      return mapWorkspace(existing, ctx.userId)
    }

    // ⚠️ THE BOOKS CURRENCY IS ASKED, NEVER ASSUMED.
    //
    // This route used to fall back to 'AFN' when the body carried no
    // currency, and the body could not carry one at all: the shared schema
    // had no `baseCurrency` field, so zod stripped it. The person's books
    // were therefore in Afghani whatever they chose — the currency question
    // was decorative, and every amount in the offline edition was wrong for
    // a shop that prices in dollars.
    //
    // A creation without a currency is refused (400), not completed in a
    // default. The first run asks; this route records the answer.
    const baseCurrency = b.baseCurrency
    if (!baseCurrency) {
      throw new ValidationError('BASE_CURRENCY_REQUIRED')
    }

    // The business time zone. The device sends its own («today» is midnight
    // in the BUSINESS's zone); the workspace's zone wins when it already
    // exists, which is the case for every request but the first.
    const timeZone = b.timeZone || ctx.timeZone

    const now = new Date().toISOString()
    const id = ctx.workspaceId

    // ⚠️ THE WORKSPACE AND ITS OWNER ARE ONE WRITE.
    //
    // `local_workspace` and `local_user` are written in the same transaction:
    // a workspace whose owner row is missing is a workspace nobody owns, and
    // every later read of the owner falls back to a synthetic id. Half a
    // first run is worse than none.
    db.transaction(() => {
      db.run(
        `INSERT INTO local_workspace (
          id, name, base_currency, time_zone, business_types, business_types_updated_at,
          logo_url, stamp_url, signature_url, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
        [
          id,
          name,
          baseCurrency,
          timeZone,
          joinBusinessTypes(b.businessTypes),
          b.businessTypes && b.businessTypes.length > 0 ? now : null,
          now,
          now,
        ],
      )

      const owner = db.get<LocalUserRow>('SELECT id FROM local_user LIMIT 1')
      if (!owner) {
        // The local owner: this device's person. The name typed here is the
        // BUSINESS's name — the only thing the first run asks for — and the
        // session shows the localized «local user» beside it.
        db.run(
          `INSERT INTO local_user (id, email, full_name, phone, role, created_at, updated_at)
           VALUES (?, ?, ?, NULL, 'owner', ?, ?)`,
          [ctx.userId, 'local@hisabche.local', name, now, now],
        )
      }
    })

    const created = db.get<LocalWorkspaceRow>(
      'SELECT * FROM local_workspace WHERE id = ? LIMIT 1',
      [id],
    )
    return mapWorkspace(created!, ctx.userId)
  })

  // ─── GET /workspaces/:id/members ─────────────────────────────
  router.get('/workspaces/:id/members', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const user = db.get<LocalUserRow>('SELECT * FROM local_user LIMIT 1')
    const ws = db.get<LocalWorkspaceRow>('SELECT created_at FROM local_workspace LIMIT 1')

    return [
      {
        id: ctx.userId,
        user_id: ctx.userId,
        userId: ctx.userId,
        email: user?.email || 'local@hisabche.local',
        fullName: user?.full_name || 'کاربر آفلاین',
        full_name: user?.full_name || 'کاربر آفلاین',
        phone: user?.phone || null,
        role: 'owner',
        joinedAt: ws?.created_at || new Date().toISOString(),
        joined_at: ws?.created_at || new Date().toISOString(),
      },
    ]
  })
}
