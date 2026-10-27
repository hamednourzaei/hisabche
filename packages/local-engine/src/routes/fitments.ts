// ============================================
// packages/local-engine/src/routes/fitments.ts
//
// Local Engine handlers for Auto Fitments and Vehicles (Option 25 / Dealerships)
// Vehicles store attributes in vehicle_attributes linked to stock_serials.
// ============================================

import { validateVin } from '@hisabche/validation'
import { ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface RowRecord {
  [key: string]: any
}

export function registerFitmentsRoutes(router: Router) {
  // ─── Fitments ───────────────────────────────────────────────
  router.get('/products/:id/fitments', async (c: RouteHandlerContext) => {
    const { db, ctx, params } = c
    const productId = params.id
    const rows = db.all<RowRecord>(
      `SELECT * FROM auto_fitments
       WHERE workspace_id = ? AND product_id = ? AND deleted_at IS NULL`,
      [ctx.workspaceId, productId],
    )

    return {
      status: 200,
      data: rows.map((r: RowRecord) => ({
        id: r.id,
        productId: r.product_id,
        make: r.make,
        model: r.model,
        yearStart: r.year_start,
        yearEnd: r.year_end,
        notes: r.notes,
      })),
    }
  })

  router.post('/products/:id/fitments', async (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const productId = params.id
    const payload = body as any
    if (!payload?.make || !payload?.model || !payload?.yearStart || !payload?.yearEnd) {
      throw new ValidationError('make, model, yearStart, and yearEnd are required')
    }

    const id = payload.id || `fit-${Date.now()}`
    const now = new Date().toISOString()

    db.run(
      `INSERT INTO auto_fitments
       (id, workspace_id, product_id, make, model, year_start, year_end, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        ctx.workspaceId,
        productId,
        payload.make,
        payload.model,
        payload.yearStart,
        payload.yearEnd,
        payload.notes || null,
        now,
        now,
      ],
    )

    return {
      status: 201,
      data: {
        id,
        productId,
        make: payload.make,
        model: payload.model,
        yearStart: payload.yearStart,
        yearEnd: payload.yearEnd,
        notes: payload.notes || null,
      },
    }
  })

  // ─── Vehicles (linked to stock_serials) ─────────────────────
  router.get('/vehicles', async (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const rows = db.all<RowRecord>(
      `SELECT va.*, ss.serial_number, ss.unit_cost_minor, ss.received_on, ss.status AS stock_status
       FROM vehicle_attributes va
       LEFT JOIN stock_serials ss ON ss.id = va.serial_id
       WHERE va.workspace_id = ? AND va.deleted_at IS NULL`,
      [ctx.workspaceId],
    )

    return {
      status: 200,
      data: rows.map((r: RowRecord) => ({
        id: r.id,
        serialId: r.serial_id,
        vin: r.serial_number,
        make: r.make,
        model: r.model,
        year: r.year,
        colour: r.colour,
        odometer: r.odometer,
        receivedDate: r.received_on,
        basePurchaseCostMinor: r.unit_cost_minor,
        status: r.stock_status || 'in_stock',
      })),
    }
  })

  router.post('/vehicles', async (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const payload = body as any
    if (!payload?.vin || !payload?.make || !payload?.model || !payload?.year) {
      throw new ValidationError('vin, make, model, and year are required')
    }
    if (!validateVin(payload.vin)) {
      throw new ValidationError('INVALID_VIN')
    }

    const serialId = payload.serialId || `ser-${Date.now()}`
    const id = payload.id || `veh-${Date.now()}`
    const now = new Date().toISOString()

    // 1. Insert into stock_serials
    try {
      db.run(
        `INSERT INTO stock_serials
         (id, workspace_id, product_id, serial_number, unit_cost_minor, received_on, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'in_stock', ?)`,
        [
          serialId,
          ctx.workspaceId,
          payload.productId || '',
          payload.vin.toUpperCase(),
          payload.basePurchaseCostMinor || 0,
          payload.receivedDate || now.slice(0, 10),
          now,
        ],
      )
    } catch {}

    // 2. Insert into vehicle_attributes
    db.run(
      `INSERT INTO vehicle_attributes
       (id, workspace_id, serial_id, make, model, year, colour, odometer, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        ctx.workspaceId,
        serialId,
        payload.make,
        payload.model,
        payload.year,
        payload.colour || '',
        payload.odometer || 0,
        now,
        now,
      ],
    )

    return {
      status: 201,
      data: {
        id,
        serialId,
        vin: payload.vin.toUpperCase(),
        make: payload.make,
        model: payload.model,
        year: payload.year,
        colour: payload.colour || '',
        odometer: payload.odometer || 0,
        status: 'in_stock',
      },
    }
  })
}
