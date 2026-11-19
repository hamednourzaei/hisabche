// ============================================
// packages/local-engine/src/routes/fx-trade-drafts.ts
//
// WP-07 — OFFLINE FX TRADE DRAFTS.
//
// A currency-exchange agent writes a draft with a LOCKED rate while offline.
// No cash moves, no currency position changes, no journal is posted here.
// Submitting only marks it `pending`: the server /api/exchange/trades still
// decides KYC, position and accounting. A repeated Idempotency-Key returns
// the SAME draft; a queued sell with a short server position is reviewable.
// ============================================

import {
  fxDraftBookAmountMinor,
  fxDraftNeedsReview,
  fxDraftTransitionAllowed,
  parseRate,
  type FxDraftStatus,
} from '@hisabche/validation'
import { requireCapability } from '../auth'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface DraftRow {
  id: string
  workspace_id: string
  trade_number: string | null
  side: string
  currency: string
  amount_minor: number
  rate: string
  rate_micro: string
  book_currency: string
  book_amount_minor: number
  customer_id: string | null
  identity_name: string | null
  note: string | null
  status: FxDraftStatus
  needs_review: number
  client_request_id: string | null
  submitted_at: string | null
  server_confirmed_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function uuid(): string {
  return crypto.randomUUID()
}

function getDraft(
  db: RouteHandlerContext['db'],
  ctx: RouteHandlerContext['ctx'],
  id: string,
): DraftRow {
  const row = db.get<DraftRow>(
    `SELECT * FROM fx_trade_drafts WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, ctx.workspaceId],
  )
  if (!row) throw new NotFoundError('FX trade draft', id)
  return row
}

export function registerFxTradeDraftRoutes(router: Router): void {
  // ─── List drafts ─────────────────────────────────────────────────
  router.get('/local-fx/trade-drafts', (c: RouteHandlerContext) => {
    const rows = c.db.all<DraftRow>(
      `SELECT * FROM fx_trade_drafts WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
      [c.ctx.workspaceId],
    )
    return { data: rows }
  })

  // ─── Read one draft ──────────────────────────────────────────────
  router.get('/local-fx/trade-drafts/:id', (c: RouteHandlerContext) => {
    return getDraft(c.db, c.ctx, c.params.id ?? '')
  })

  // ─── Create (idempotent by Idempotency-Key or id) ───────────────
  router.post('/local-fx/trade-drafts', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const body = (c.body || {}) as Record<string, unknown>
    const side = trim(body.side).toLowerCase()
    if (side !== 'buy' && side !== 'sell') throw new ValidationError('FX_DRAFT_SIDE_INVALID')
    const currency = trim(body.currency).toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) throw new ValidationError('FX_DRAFT_CURRENCY_INVALID')
    const bookCurrency = trim(body.bookCurrency).toUpperCase()
    if (!/^[A-Z]{3}$/.test(bookCurrency))
      throw new ValidationError('FX_DRAFT_BOOK_CURRENCY_INVALID')
    const amountMinor = Number(body.amountMinor)
    const rate = trim(body.rate)
    const bookAmountMinor = fxDraftBookAmountMinor({ amountMinor, rate, currency, bookCurrency })
    const rateMicro = parseRate(rate)
    if (bookAmountMinor === null || rateMicro === null)
      throw new ValidationError('FX_DRAFT_RATE_INVALID')

    const clientRequestId = trim(c.headers?.['idempotency-key']) || trim(body.id)
    const now = new Date().toISOString()
    return c.db.transaction(() => {
      if (clientRequestId) {
        const existing = c.db.get<DraftRow>(
          `SELECT * FROM fx_trade_drafts WHERE workspace_id = ? AND client_request_id = ?`,
          [c.ctx.workspaceId, clientRequestId],
        )
        if (existing) return { __status: 200, __data: existing }
      }
      const id = trim(body.id) || uuid()
      if (c.db.get<{ id: string }>('SELECT id FROM fx_trade_drafts WHERE id = ?', [id])) {
        throw new ConflictError('FX_TRADE_DRAFT_ID_CONFLICT')
      }
      c.db.run(
        `INSERT INTO fx_trade_drafts
          (id, workspace_id, trade_number, side, currency, amount_minor, rate, rate_micro,
           book_currency, book_amount_minor, customer_id, identity_name, note, status,
           needs_review, client_request_id, created_at, updated_at, origin, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'quoted', 0, ?, ?, ?, 'local', 'local_only')`,
        [
          id,
          c.ctx.workspaceId,
          trim(body.tradeNumber) || null,
          side,
          currency,
          amountMinor,
          rate,
          String(rateMicro),
          bookCurrency,
          bookAmountMinor,
          trim(body.customerId) || null,
          trim(body.identityName) || null,
          trim(body.note) || null,
          clientRequestId || null,
          now,
          now,
        ],
      )
      return { __status: 201, __data: getDraft(c.db, c.ctx, id) }
    })
  })

  // ─── Submit: pending, NO money moved ────────────────────────────
  router.post('/local-fx/trade-drafts/:id/submit', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const draft = getDraft(c.db, c.ctx, c.params.id ?? '')
    if (!fxDraftTransitionAllowed(draft.status, 'pending')) {
      throw new ConflictError('FX_DRAFT_TRANSITION_NOT_ALLOWED')
    }
    // A queued sell whose server position is unknown cannot be assumed funded.
    const review = draft.side === 'sell' && fxDraftNeedsReview(null, draft.amount_minor)
    const now = new Date().toISOString()
    c.db.run(
      `UPDATE fx_trade_drafts SET status = 'pending', needs_review = ?, submitted_at = ?, updated_at = ?
       WHERE id = ? AND workspace_id = ?`,
      [review ? 1 : 0, now, now, draft.id, c.ctx.workspaceId],
    )
    return { ...getDraft(c.db, c.ctx, draft.id) }
  })

  // ─── Cancel while still a draft ─────────────────────────────────
  router.post('/local-fx/trade-drafts/:id/cancel', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const draft = getDraft(c.db, c.ctx, c.params.id ?? '')
    if (!fxDraftTransitionAllowed(draft.status, 'cancelled')) {
      throw new ConflictError('FX_DRAFT_TRANSITION_NOT_ALLOWED')
    }
    const now = new Date().toISOString()
    c.db.run(
      `UPDATE fx_trade_drafts SET status = 'cancelled', updated_at = ? WHERE id = ? AND workspace_id = ?`,
      [now, draft.id, c.ctx.workspaceId],
    )
    return getDraft(c.db, c.ctx, draft.id)
  })
}
