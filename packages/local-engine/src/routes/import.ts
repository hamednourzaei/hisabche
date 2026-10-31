// ============================================
// packages/local-engine/src/routes/import.ts
//
// Migration inspect and commit handlers for offline mode.
// Inspects CSV/TSV data and commits validated records into local SQLite tables.
// Enqueues mutations to sync_queue when in queuing mode.
// ============================================

import {
  looksLikeWorkbook,
  readXlsx,
  round2,
  XlsxError,
  type XlsxSheet,
} from '@hisabche/validation'
import { buildEnqueue } from '@hisabche/app-bridge'
import { requireCapability } from '../auth'
import { recordOpeningStock } from './products'
import { ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function parseCsvLines(text: string, delimiter = ','): string[][] {
  const lines: string[][] = []
  const rawLines = text.split(/\r?\n/)
  for (const raw of rawLines) {
    if (!raw.trim()) continue
    const cells = raw.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''))
    lines.push(cells)
  }
  return lines
}

export function registerImportRoutes(router: Router): void {
  // ─── POST /migrations/inspect ────────────────────────────────
  router.post('/migrations/inspect', (c: RouteHandlerContext) => {
    const b = (c.body || {}) as {
      filename?: string
      content?: string
      contentBase64?: string
    }

    let text = b.content || ''
    let workbookRows: string[][] | null = null
    if (!text && b.contentBase64) {
      let bytes: Uint8Array
      try {
        bytes = Uint8Array.from(atob(b.contentBase64.replace(/\s+/g, '')), (ch) => ch.charCodeAt(0))
      } catch {
        throw new ValidationError('MIGRATION_INSPECT_INVALID_BASE64')
      }
      if (looksLikeWorkbook(bytes)) {
        let sheets: XlsxSheet[]
        try {
          sheets = readXlsx(bytes)
        } catch (error) {
          if (error instanceof XlsxError) throw new ValidationError(`MIGRATION_${error.code}`)
          throw error
        }
        const sheet = sheets.find((candidate) => candidate.rows.length > 0) ?? sheets[0]!
        workbookRows = sheet.rows
      } else {
        text = new TextDecoder('utf-8').decode(bytes)
      }
    }

    if (!text && !workbookRows) {
      throw new ValidationError('MIGRATION_INSPECT_NO_CONTENT')
    }

    const filename = b.filename || 'import.csv'
    const delimiter = /\.tsv$/i.test(filename) ? '\t' : text.includes('\t') ? '\t' : ','
    const rows = workbookRows ?? parseCsvLines(text, delimiter)

    const headers = rows[0] || []
    const dataRows = rows.slice(1)
    const sampleRows = dataRows.slice(0, 5)

    const fn = filename.toLowerCase()
    let likelyEntity = 'customers'
    if (fn.includes('prod') || fn.includes('kala') || fn.includes('جنس') || fn.includes('کالا')) {
      likelyEntity = 'products'
    } else if (fn.includes('inv') || fn.includes('factor') || fn.includes('فاکتور')) {
      likelyEntity = 'invoices'
    }

    return {
      entity: likelyEntity,
      sourceType: delimiter === '\t' ? 'tsv' : 'csv',
      delimiter,
      headers,
      sampleRows,
      rowCount: dataRows.length,
      totalRows: dataRows.length,
      estimatedRows: dataRows.length,
      sheets: [],
    }
  })

  // ─── POST /migrations/commit ─────────────────────────────────
  router.post('/migrations/commit', (c: RouteHandlerContext) => {
    const { db, ctx, body, headers } = c
    requireCapability(ctx, 'data.import')

    const b = (body || {}) as {
      entity?: string
      records?: Array<Record<string, unknown>>
    }

    const entity = b.entity || 'customers'
    const records = Array.isArray(b.records) ? b.records : []
    const ws = ctx.workspaceId
    const now = new Date().toISOString()
    const isQueued = headers?.['x-hisabche-queue'] === '1'

    let imported = 0
    let skipped = 0
    let failed = 0
    const warnings: string[] = []

    db.transaction(() => {
      if (entity === 'customers' || entity === 'customer') {
        for (const r of records) {
          const name = String(r.name || r['نام'] || '').trim()
          if (!name) {
            skipped++
            continue
          }
          const id = String(r.id || generateUuid())
          const phone = r.phone ? String(r.phone).trim() : null
          const email = r.email ? String(r.email).trim() : null
          const address = r.address ? String(r.address).trim() : null

          // Duplicate detection by id or non-empty phone
          const existing = db.get<{ id: string }>(
            `SELECT id FROM customer
             WHERE workspace_id = ? AND deleted_at IS NULL AND (id = ? ${phone ? 'OR phone = ?' : ''})
             LIMIT 1`,
            phone ? [ws, id, phone] : [ws, id],
          )

          if (existing) {
            skipped++
            continue
          }

          try {
            db.run(
              `INSERT INTO customer (
                id, workspace_id, full_name, phone, email, address, opening_balance,
                is_active, created_at, updated_at, deleted_at, origin, sync_state
              ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, NULL, 'local', ?)`,
              [id, ws, name, phone, email, address, now, now, isQueued ? 'queued' : 'local_only'],
            )

            if (isQueued) {
              const enqueue = buildEnqueue({
                entity: 'customer',
                operation: 'create',
                clientId: id,
                payload: {
                  id,
                  fullName: name,
                  phone,
                  email,
                  address,
                  openingBalance: 0,
                },
                userId: headers?.['x-hisabche-user-id'] ?? ctx.userId,
                workspaceId: ws,
              })
              db.run(enqueue.sql, enqueue.params)
            }

            imported++
          } catch {
            failed++
          }
        }
      } else if (entity === 'products' || entity === 'product') {
        for (const r of records) {
          const name = String(r.name || r['نام'] || '').trim()
          if (!name) {
            skipped++
            continue
          }
          const id = String(r.id || generateUuid())
          const barcode = r.barcode ? String(r.barcode).trim() : null
          const sellPrice = round2(Number(r.sellPrice || r.sell_price || 0))
          const buyPrice = round2(Number(r.buyPrice || r.buy_price || 0))
          const unit = r.unit ? String(r.unit) : 'piece'
          const qty = Number(r.quantity || r.qty || r['موجودی'] || 0)

          // Duplicate detection by id or non-empty barcode
          const existing = db.get<{ id: string }>(
            `SELECT id FROM product
             WHERE workspace_id = ? AND deleted_at IS NULL AND (id = ? ${barcode ? 'OR barcode = ?' : ''})
             LIMIT 1`,
            barcode ? [ws, id, barcode] : [ws, id],
          )

          if (existing) {
            skipped++
            continue
          }

          try {
            db.run(
              `INSERT INTO product (
                id, workspace_id, name, barcode, sell_price, buy_price,
                unit, quantity, min_stock_level, is_active,
                created_at, updated_at, deleted_at, origin, sync_state
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, NULL, 'local', ?)`,
              [
                id,
                ws,
                name,
                barcode,
                sellPrice,
                buyPrice,
                unit,
                qty,
                now,
                now,
                isQueued ? 'queued' : 'local_only',
              ],
            )

            // The same opening-stock write the product form makes: a movement, the
            // warehouse figure and (price known) a cost layer — not a bare quantity.
            recordOpeningStock(db, {
              workspaceId: ws,
              productId: id,
              quantity: qty,
              buyPrice,
              warehouseId: null,
              baseCurrency: ctx.baseCurrency,
              now,
            })

            if (isQueued) {
              const enqueue = buildEnqueue({
                entity: 'product',
                operation: 'create',
                clientId: id,
                payload: {
                  id,
                  name,
                  barcode,
                  sellPrice,
                  buyPrice,
                  unit,
                  quantity: qty,
                },
                userId: headers?.['x-hisabche-user-id'] ?? ctx.userId,
                workspaceId: ws,
              })
              db.run(enqueue.sql, enqueue.params)
            }

            imported++
          } catch {
            failed++
          }
        }
      }
    })

    return {
      entity,
      imported,
      skipped,
      failed,
      warnings,
    }
  })
}
