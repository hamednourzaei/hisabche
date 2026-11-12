// ============================================
// packages/local-engine/src/routes/bookings.ts
//
// V61 §2.8 — Offline resource capacity bookings.
// Local bookings are recorded as `tentative` and checked against active local
// overlaps; on sync, a server 409 exclusion-constraint conflict transitions to
// `PENDING_REVIEW` rather than dropping or double-booking.
// ============================================

import { requireCapability } from '../auth'
import { ConflictError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface LocalBookingRow {
  id: string
  workspace_id: string
  resource_id: string
  start_at: string
  end_at: string
  status: string
  reference_type: string | null
  reference_id: string | null
  created_at: string
}

function ensureBookingsTable(db: RouteHandlerContext['db']): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS resource_bookings (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'tentative',
      reference_type TEXT,
      reference_id TEXT,
      created_at TEXT NOT NULL
    )
  `)
}

export function registerBookingsRoutes(router: Router): void {
  router.get('/resource-bookings', (c: RouteHandlerContext) => {
    ensureBookingsTable(c.db)
    const clauses = ['workspace_id = ?']
    const params: unknown[] = [c.ctx.workspaceId]
    if (c.query.resourceId) {
      clauses.push('resource_id = ?')
      params.push(c.query.resourceId)
    }
    return c.db.all<LocalBookingRow>(
      `SELECT * FROM resource_bookings WHERE ${clauses.join(' AND ')} ORDER BY start_at ASC`,
      params,
    )
  })

  router.post('/resource-bookings', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    ensureBookingsTable(c.db)
    const raw = (c.body || {}) as Record<string, unknown>
    const resourceId = typeof raw.resourceId === 'string' ? raw.resourceId : ''
    const startAt = typeof raw.startAt === 'string' ? raw.startAt : ''
    const endAt = typeof raw.endAt === 'string' ? raw.endAt : ''
    if (!resourceId || !startAt || !endAt || endAt <= startAt) {
      throw new ValidationError('RESOURCE_BOOKING_INVALID_RANGE')
    }

    return c.db.transaction(() => {
      const overlap = c.db.get<{ id: string }>(
        `SELECT id FROM resource_bookings
          WHERE workspace_id = ? AND resource_id = ? AND status IN ('tentative', 'confirmed')
            AND start_at < ? AND end_at > ?`,
        [c.ctx.workspaceId, resourceId, endAt, startAt],
      )
      if (overlap) throw new ConflictError('RESOURCE_SLOT_OVERLAP')

      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `bk-${Date.now()}`
      const now = new Date().toISOString()
      c.db.run(
        `INSERT INTO resource_bookings (id, workspace_id, resource_id, start_at, end_at, status, reference_type, reference_id, created_at)
         VALUES (?, ?, ?, ?, ?, 'tentative', ?, ?, ?)`,
        [
          id,
          c.ctx.workspaceId,
          resourceId,
          startAt,
          endAt,
          typeof raw.referenceType === 'string' ? raw.referenceType : null,
          typeof raw.referenceId === 'string' ? raw.referenceId : null,
          now,
        ],
      )
      return c.db.get<LocalBookingRow>('SELECT * FROM resource_bookings WHERE id = ?', [id])
    })
  })

  router.post('/resource-bookings/:id/release', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    ensureBookingsTable(c.db)
    c.db.run(`UPDATE resource_bookings SET status = 'released' WHERE id = ? AND workspace_id = ?`, [
      c.params.id,
      c.ctx.workspaceId,
    ])
    return { id: c.params.id, status: 'released' }
  })
}
