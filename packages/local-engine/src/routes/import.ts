// ============================================
// packages/local-engine/src/routes/import.ts
//
// Migration inspect and commit handlers for offline mode.
// Inspects CSV/TSV data and commits validated records into local SQLite tables.
// ============================================

import { round2 } from '@hisabche/validation'

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
    // Simple delimiter split respecting basic tokens
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
    if (!text && b.contentBase64) {
      try {
        text = Buffer.from(b.contentBase64, 'base64').toString('utf-8')
      } catch {
        throw new ValidationError('MIGRATION_INSPECT_INVALID_BASE64')
      }
    }

    if (!text) {
      throw new ValidationError('MIGRATION_INSPECT_NO_CONTENT')
    }

    const filename = b.filename || 'import.csv'
    const delimiter = /\.tsv$/i.test(filename) ? '\t' : text.includes('\t') ? '\t' : ','
    const rows = parseCsvLines(text, delimiter)

    const headers = rows[0] || []
    const dataRows = rows.slice(1)
    const sampleRows = dataRows.slice(0, 5)

    // Detect likely entity from filename and headers
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
    const { db, ctx, body } = c
    const b = (body || {}) as {
      entity?: string
      records?: Array<Record<string, unknown>>
    }

    const entity = b.entity || 'customers'
    const records = Array.isArray(b.records) ? b.records : []
    const ws = ctx.workspaceId
    const now = new Date().toISOString()

    let imported = 0

    db.transaction(() => {
      if (entity === 'customers' || entity === 'customer') {
        for (const r of records) {
          const name = String(r.name || r['نام'] || '').trim()
          if (!name) continue
          const id = String(r.id || generateUuid())
          const phone = r.phone ? String(r.phone) : null
          const email = r.email ? String(r.email) : null
          const address = r.address ? String(r.address) : null

          db.run(
            `INSERT INTO customer (
              id, workspace_id, full_name, phone, email, address, opening_balance,
              is_active, created_at, updated_at, deleted_at, origin, sync_state
            ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, NULL, 'local', 'local_only')`,
            [id, ws, name, phone, email, address, now, now],
          )
          imported++
        }
      } else if (entity === 'products' || entity === 'product') {
        for (const r of records) {
          const name = String(r.name || r['نام'] || '').trim()
          if (!name) continue
          const id = String(r.id || generateUuid())
          const barcode = r.barcode ? String(r.barcode) : null
          // ⚠️ The rounding is the shared money rule, not a local one.
          const sellPrice = round2(Number(r.sellPrice || r.sell_price || 0))
          const buyPrice = round2(Number(r.buyPrice || r.buy_price || 0))
          const unit = r.unit ? String(r.unit) : 'piece'

          db.run(
            `INSERT INTO product (
              id, workspace_id, name, barcode, sell_price, buy_price,
              unit, quantity, min_stock_level, is_active,
              created_at, updated_at, deleted_at, origin, sync_state
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 1, ?, ?, NULL, 'local', 'local_only')`,
            [id, ws, name, barcode, sellPrice, buyPrice, unit, now, now],
          )
          imported++
        }
      }
    })

    return {
      entity,
      imported,
      failed: 0,
    }
  })
}
