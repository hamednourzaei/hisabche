// ============================================
// packages/local-engine/src/routes/courier-deliveries.ts
//
// WP-19 — COURIER DELIVERIES, POD & COD (LOCAL ENGINE)
// Local Engine handlers for courier deliveries, proof of delivery, and COD.
// Mirrors the shared rules in @hisabche/validation (delivery-logistics.domain.ts).
// ============================================

import {
  decideDeliveryAttempt,
  dispatchIssues,
  vehicleServiceState,
  type CodStage,
  type CourierDeliverySnapshot,
  type DeliveryPodMethod,
  type DeliveryStatus,
} from '@hisabche/validation'
import { buildEnqueue } from '@hisabche/app-bridge'
import { requireCapability } from '../auth'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface CourierDeliveryRow {
  id: string
  workspace_id: string
  tracking_number: string
  customer_name: string
  destination_address: string
  driver_employee_id: string | null
  status: string
  cod_amount_minor: number
  cod_stage: string
  planned_on: string | null
  vehicle_id: string | null
  pod_method: string | null
  pod_recipient_name: string | null
  pod_photo_ref: string | null
  pod_code: string | null
  pod_recorded_at: string | null
  pod_actor_user_id: string | null
  delivery_timestamp: string | null
  failure_reason: string | null
  attempt_count: number
  last_attempt_at: string | null
  client_request_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  origin: string
  sync_state: string
}

interface DeliveryVehicleRow {
  id: string
  workspace_id: string
  name: string
  plate_number: string | null
  asset_id: string | null
  capacity_parcels: number | null
  active: number
  last_service_on: string | null
  next_service_due_on: string | null
  odometer_km: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

function randomUuid(): string {
  return crypto.randomUUID()
}

/** Trims any value; non-strings become ''. Accepts `unknown` from the wire. */
const trim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

export function registerCourierDeliveryRoutes(router: Router): void {
  // ─── 1. GET /deliveries/courier ───────────────────────────────────
  router.get('/deliveries/courier', (c: RouteHandlerContext) => {
    const status = trim(c.query.status)
    const vehicleId = trim(c.query.vehicleId)
    const plannedOn = trim(c.query.plannedOn)

    let sql = `SELECT * FROM courier_deliveries WHERE workspace_id = ? AND deleted_at IS NULL`
    const params: unknown[] = [c.ctx.workspaceId]

    if (status) {
      sql += ` AND status = ?`
      params.push(status)
    }
    if (vehicleId) {
      sql += ` AND vehicle_id = ?`
      params.push(vehicleId)
    }
    if (plannedOn) {
      sql += ` AND planned_on = ?`
      params.push(plannedOn)
    }

    sql += ` ORDER BY created_at DESC`

    const rows = c.db.all<CourierDeliveryRow>(sql, params)
    return { data: rows }
  })

  // ─── 2. POST /deliveries/courier ──────────────────────────────────
  router.post('/deliveries/courier', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const body = (c.body || {}) as {
      id?: unknown
      trackingNumber?: unknown
      customerName?: unknown
      destinationAddress?: unknown
      codAmountMinor?: unknown
      driverEmployeeId?: unknown
    }

    const trackingNumber = trim(body.trackingNumber)
    const customerName = trim(body.customerName)
    const destinationAddress = trim(body.destinationAddress)

    if (!trackingNumber) throw new ValidationError('TRACKING_NUMBER_REQUIRED')
    if (!customerName) throw new ValidationError('CUSTOMER_NAME_REQUIRED')
    if (!destinationAddress) throw new ValidationError('DESTINATION_ADDRESS_REQUIRED')

    const codAmountMinor = Number.isInteger(body.codAmountMinor) ? Number(body.codAmountMinor) : 0
    if (codAmountMinor < 0) throw new ValidationError('COD_AMOUNT_INVALID')

    const id = trim(body.id) || randomUuid()
    const driverEmployeeId = trim(body.driverEmployeeId) || null
    const now = new Date().toISOString()

    return c.db.transaction(() => {
      // Idempotency: same clientRequestId (or id) returns existing row
      const clientRequestId = trim(c.headers?.['idempotency-key']) || id
      const existing = c.db.get<CourierDeliveryRow>(
        `SELECT * FROM courier_deliveries WHERE client_request_id = ? AND workspace_id = ?`,
        [clientRequestId, c.ctx.workspaceId],
      )
      if (existing) {
        if (
          existing.tracking_number !== trackingNumber ||
          existing.customer_name !== customerName ||
          existing.destination_address !== destinationAddress
        ) {
          throw new ConflictError('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH')
        }
        return { __status: 200, __data: existing }
      }

      c.db.run(
        `INSERT INTO courier_deliveries (
           id, workspace_id, tracking_number, customer_name, destination_address,
           driver_employee_id, status, cod_amount_minor, cod_stage, client_request_id,
           created_at, updated_at, origin, sync_state
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          c.ctx.workspaceId,
          trackingNumber,
          customerName,
          destinationAddress,
          driverEmployeeId,
          'unassigned',
          codAmountMinor,
          'to_collect',
          clientRequestId,
          now,
          now,
          'local',
          'local_only',
        ],
      )

      const row = c.db.get<CourierDeliveryRow>(
        `SELECT * FROM courier_deliveries WHERE id = ? AND workspace_id = ?`,
        [id, c.ctx.workspaceId],
      )
      if (!row) throw new Error('FAILED_TO_CREATE_COURIER_DELIVERY')

      if (c.headers?.['x-hisabche-queue'] === '1') {
        enqueueCourierDelivery(c, id, 'create', { ...row })
      }

      return { __status: 201, __data: row }
    })
  })

  // ─── 3. GET /deliveries/fleet ─────────────────────────────────────
  router.get('/deliveries/fleet', (c: RouteHandlerContext) => {
    const onDate = trim(c.query.onDate) || new Date().toISOString().slice(0, 10)

    const vehicles = c.db.all<DeliveryVehicleRow>(
      `SELECT * FROM delivery_vehicles WHERE workspace_id = ? AND active = 1 ORDER BY name`,
      [c.ctx.workspaceId],
    )

    const assigned = c.db.all<{ vehicle_id: string }>(
      `SELECT vehicle_id FROM courier_deliveries
         WHERE workspace_id = ? AND planned_on = ? AND status IN ('assigned', 'picked_up') AND vehicle_id IS NOT NULL`,
      [c.ctx.workspaceId, onDate],
    )

    const assignedByVehicle = new Map<string, number>()
    for (const row of assigned) {
      const vid = row.vehicle_id
      if (vid) assignedByVehicle.set(vid, (assignedByVehicle.get(vid) ?? 0) + 1)
    }

    return {
      data: vehicles.map((vehicle) => ({
        ...vehicle,
        active: vehicle.active === 1,
        service_state: vehicleServiceState(
          (vehicle.next_service_due_on as string | null) ?? null,
          onDate,
        ),
        assigned_on_date: assignedByVehicle.get(vehicle.id) ?? 0,
      })),
    }
  })

  // ─── 4. POST /deliveries/fleet ────────────────────────────────────
  router.post('/deliveries/fleet', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const body = (c.body || {}) as {
      id?: unknown
      name?: unknown
      plateNumber?: unknown
      assetId?: unknown
      capacityParcels?: unknown
      nextServiceDueOn?: unknown
      odometerKm?: unknown
      notes?: unknown
    }

    const name = trim(body.name)
    if (!name) throw new ValidationError('VEHICLE_NAME_REQUIRED')

    const plateNumber = trim(body.plateNumber) || null
    const assetId = trim(body.assetId) || null
    const capacityParcels = typeof body.capacityParcels === 'number' ? body.capacityParcels : null
    const nextServiceDueOn = trim(body.nextServiceDueOn) || null
    const odometerKm = typeof body.odometerKm === 'number' ? body.odometerKm : null
    const notes = trim(body.notes) || null

    const id = trim(body.id) || randomUuid()
    const now = new Date().toISOString()

    return c.db.transaction(() => {
      const existing = c.db.get<DeliveryVehicleRow>(
        `SELECT * FROM delivery_vehicles WHERE id = ? AND workspace_id = ?`,
        [id, c.ctx.workspaceId],
      )
      if (existing) {
        if (existing.name !== name || existing.plate_number !== plateNumber) {
          throw new ConflictError('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH')
        }
        return { __status: 200, __data: existing }
      }

      c.db.run(
        `INSERT INTO delivery_vehicles (
           id, workspace_id, name, plate_number, asset_id, capacity_parcels,
           active, next_service_due_on, odometer_km, notes,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
        [
          id,
          c.ctx.workspaceId,
          name,
          plateNumber,
          assetId,
          capacityParcels,
          nextServiceDueOn,
          odometerKm,
          notes,
          now,
          now,
        ],
      )

      const row = c.db.get<DeliveryVehicleRow>(
        `SELECT * FROM delivery_vehicles WHERE id = ? AND workspace_id = ?`,
        [id, c.ctx.workspaceId],
      )
      if (!row) throw new Error('FAILED_TO_CREATE_DELIVERY_VEHICLE')

      if (c.headers?.['x-hisabche-queue'] === '1') {
        enqueueVehicle(c, id, 'create', { ...row })
      }

      return { __status: 201, __data: row }
    })
  })

  // ─── 5. POST /deliveries/fleet/:id/service ────────────────────────
  router.post('/deliveries/fleet/:id/service', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const vehicleId = c.params.id
    if (!vehicleId) throw new ValidationError('VEHICLE_ID_REQUIRED')

    const body = (c.body || {}) as {
      serviceOn?: unknown
      nextServiceDueOn?: unknown
      odometerKm?: unknown
      notes?: unknown
    }

    const serviceOn = trim(body.serviceOn)
    if (!serviceOn) throw new ValidationError('SERVICE_DATE_REQUIRED')

    const nextServiceDueOn = trim(body.nextServiceDueOn) || null
    const odometerKm = typeof body.odometerKm === 'number' ? body.odometerKm : null
    const notes = trim(body.notes) || null

    return c.db.transaction(() => {
      const vehicle = c.db.get<DeliveryVehicleRow>(
        `SELECT * FROM delivery_vehicles WHERE id = ? AND workspace_id = ?`,
        [vehicleId, c.ctx.workspaceId],
      )
      if (!vehicle) throw new NotFoundError('Delivery vehicle', vehicleId)

      if (nextServiceDueOn && nextServiceDueOn < serviceOn) {
        throw new ValidationError('SERVICE_DUE_BEFORE_SERVICE')
      }
      if (
        odometerKm !== null &&
        typeof vehicle.odometer_km === 'number' &&
        odometerKm < vehicle.odometer_km
      ) {
        throw new ValidationError('ODOMETER_BACKWARDS')
      }

      const now = new Date().toISOString()

      c.db.run(
        `UPDATE delivery_vehicles
            SET last_service_on = ?,
                next_service_due_on = COALESCE(?, next_service_due_on),
                odometer_km = COALESCE(?, odometer_km),
                notes = COALESCE(?, notes),
                updated_at = ?
          WHERE id = ? AND workspace_id = ?`,
        [serviceOn, nextServiceDueOn, odometerKm, notes, now, vehicleId, c.ctx.workspaceId],
      )

      const updated = c.db.get<DeliveryVehicleRow>(
        `SELECT * FROM delivery_vehicles WHERE id = ? AND workspace_id = ?`,
        [vehicleId, c.ctx.workspaceId],
      )
      if (!updated) throw new Error('FAILED_TO_UPDATE_DELIVERY_VEHICLE')

      if (c.headers?.['x-hisabche-queue'] === '1') {
        enqueueVehicle(c, `${vehicleId}-service`, 'update', {
          ...updated,
          serviceOn,
          nextServiceDueOn,
          odometerKm,
          notes,
        })
      }

      return { __status: 200, __data: updated }
    })
  })

  // ─── 6. POST /deliveries/courier/:id/assign ───────────────────────
  router.post('/deliveries/courier/:id/assign', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const deliveryId = c.params.id
    if (!deliveryId) throw new ValidationError('DELIVERY_ID_REQUIRED')

    const body = (c.body || {}) as {
      vehicleId?: unknown
      driverEmployeeId?: unknown
      plannedOn?: unknown
    }

    const vehicleId = trim(body.vehicleId) || null
    const driverEmployeeId = trim(body.driverEmployeeId) || null
    const plannedOn = trim(body.plannedOn)

    if (!plannedOn) throw new ValidationError('PLANNED_DATE_REQUIRED')
    if (!vehicleId && !driverEmployeeId) {
      throw new ValidationError('DISPATCH_DRIVER_OR_VEHICLE_REQUIRED')
    }

    return c.db.transaction(() => {
      const delivery = c.db.get<CourierDeliveryRow>(
        `SELECT * FROM courier_deliveries WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
        [deliveryId, c.ctx.workspaceId],
      )
      if (!delivery) throw new NotFoundError('Courier delivery', deliveryId)

      const status = delivery.status as DeliveryStatus
      if (status === 'delivered' || status === 'returned') {
        throw new ConflictError('DELIVERY_ALREADY_CLOSED')
      }

      if (vehicleId) {
        const vehicle = c.db.get<DeliveryVehicleRow>(
          `SELECT * FROM delivery_vehicles WHERE id = ? AND workspace_id = ?`,
          [vehicleId, c.ctx.workspaceId],
        )
        if (!vehicle) throw new NotFoundError('Delivery vehicle', vehicleId)

        const assignedCountRow = c.db.get<{ cnt: number }>(
          `SELECT COUNT(*) as cnt FROM courier_deliveries
             WHERE workspace_id = ? AND vehicle_id = ? AND planned_on = ?
               AND status IN ('assigned', 'picked_up') AND id <> ?`,
          [c.ctx.workspaceId, vehicleId, plannedOn, deliveryId],
        )
        const assignedCount = assignedCountRow?.cnt ?? 0

        const issues = dispatchIssues({
          vehicle: {
            active: vehicle.active === 1,
            capacityParcels: vehicle.capacity_parcels === null ? null : vehicle.capacity_parcels,
            nextServiceDueOn: vehicle.next_service_due_on,
          },
          assignedOnDate: assignedCount,
          asOf: plannedOn,
        })

        if (issues.length > 0) throw new ValidationError(issues[0]!)
      }

      const now = new Date().toISOString()

      c.db.run(
        `UPDATE courier_deliveries
            SET vehicle_id = ?, driver_employee_id = ?, planned_on = ?,
                status = ?, updated_at = ?
          WHERE id = ? AND workspace_id = ? AND status = ? AND updated_at = ?`,
        [
          vehicleId,
          driverEmployeeId,
          plannedOn,
          status === 'picked_up' ? 'picked_up' : 'assigned',
          now,
          deliveryId,
          c.ctx.workspaceId,
          delivery.status,
          delivery.updated_at,
        ],
      )

      const updated = c.db.get<CourierDeliveryRow>(
        `SELECT * FROM courier_deliveries WHERE id = ? AND workspace_id = ?`,
        [deliveryId, c.ctx.workspaceId],
      )
      if (!updated) throw new ConflictError('SESSION_CHANGED')

      if (c.headers?.['x-hisabche-queue'] === '1') {
        enqueueCourierDelivery(c, deliveryId, 'update', { ...updated })
      }

      return { __status: 200, __data: updated }
    })
  })

  // ─── 7. POST /deliveries/courier/:id/close ────────────────────────
  router.post('/deliveries/courier/:id/close', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const deliveryId = c.params.id
    if (!deliveryId) throw new ValidationError('DELIVERY_ID_REQUIRED')

    const body = (c.body || {}) as {
      outcome?: unknown
      pod?: unknown
      collectedMinor?: unknown
      failureReason?: unknown
      clientRequestId?: unknown
    }

    const outcome = trim(body.outcome)
    const clientRequestId = trim(body.clientRequestId) || `close-${deliveryId}`

    const existingClose = c.db.get<CourierDeliveryRow>(
      `SELECT * FROM courier_deliveries WHERE client_request_id = ? AND workspace_id = ?`,
      [clientRequestId, c.ctx.workspaceId],
    )
    if (existingClose) return { __status: 200, __data: existingClose }

    return c.db.transaction(() => {
      const delivery = c.db.get<CourierDeliveryRow>(
        `SELECT * FROM courier_deliveries WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
        [deliveryId, c.ctx.workspaceId],
      )
      if (!delivery) throw new NotFoundError('Courier delivery', deliveryId)

      const snapshot: CourierDeliverySnapshot = {
        status: delivery.status as DeliveryStatus,
        codStage: delivery.cod_stage as CodStage,
        codAmountMinor: Number(delivery.cod_amount_minor ?? 0),
        podCode: delivery.pod_code,
      }

      const now = new Date().toISOString()
      let decision

      if (outcome === 'delivered') {
        const pod = (body.pod || {}) as Record<string, unknown>
        const method = trim(pod.method)
        const recipientName = trim(pod.recipientName)
        if (!method || !recipientName) {
          throw new ValidationError('POD_RECIPIENT_REQUIRED')
        }
        decision = decideDeliveryAttempt(
          snapshot,
          {
            outcome: 'delivered',
            pod: {
              method: method as DeliveryPodMethod,
              recipientName,
              code: trim(pod.code) || undefined,
              photoRef: trim(pod.photoRef) || undefined,
              capturedAt: trim(pod.capturedAt) || undefined,
              notes: trim(pod.notes) || undefined,
            },
            collectedMinor:
              typeof body.collectedMinor === 'number' ? body.collectedMinor : undefined,
          },
          now,
        )
      } else if (outcome === 'failed') {
        const failureReason = trim(body.failureReason)
        if (!failureReason) throw new ValidationError('FAILURE_REASON_REQUIRED')
        decision = decideDeliveryAttempt(snapshot, { outcome: 'failed', failureReason }, now)
      } else {
        throw new ValidationError('INVALID_OUTCOME')
      }

      if (!decision.ok) throw new ValidationError(decision.issues[0]!)

      const close = decision.close
      const podRecordedAt = close.pod ? now : null

      c.db.run(
        `UPDATE courier_deliveries
            SET status = ?, cod_stage = ?, delivery_timestamp = ?,
                pod_method = ?, pod_recipient_name = ?, pod_photo_ref = ?,
                pod_code = ?, pod_recorded_at = ?, pod_actor_user_id = ?,
                failure_reason = ?, cod_collected_minor = ?, cod_shortfall_minor = ?,
                attempt_count = attempt_count + 1, last_attempt_at = ?,
                client_request_id = ?, updated_at = ?
          WHERE id = ? AND workspace_id = ?`,
        [
          close.status,
          close.codStage,
          close.deliveredAt,
          close.pod?.method ?? null,
          close.pod?.recipientName ?? null,
          close.pod?.photoRef ?? null,
          close.pod?.code ?? null,
          podRecordedAt,
          close.pod ? (c.ctx.userId ?? null) : null,
          close.failureReason,
          close.status === 'delivered' ? close.collectedMinor : null,
          close.shortfallMinor,
          now,
          clientRequestId,
          now,
          deliveryId,
          c.ctx.workspaceId,
        ],
      )

      // The local table stores cod_collected_minor / cod_shortfall_minor through
      // the upsert columns; add them to the CREATE for completeness.
      const updated = c.db.get<CourierDeliveryRow>(
        `SELECT * FROM courier_deliveries WHERE id = ? AND workspace_id = ?`,
        [deliveryId, c.ctx.workspaceId],
      )
      if (!updated) throw new Error('FAILED_TO_CLOSE_COURIER_DELIVERY')

      if (c.headers?.['x-hisabche-queue'] === '1') {
        enqueueCourierDelivery(c, deliveryId, 'update', { ...updated })
      }

      return { __status: 200, __data: updated }
    })
  })
}

function enqueueCourierDelivery(
  c: RouteHandlerContext,
  clientId: string,
  operation: 'create' | 'update',
  payload: Record<string, unknown>,
): void {
  const enqueue = buildEnqueue({
    entity: 'courier_deliveries',
    operation,
    clientId,
    payload,
    userId: c.ctx.userId ?? null,
    workspaceId: c.ctx.workspaceId,
  })
  c.db.run(enqueue.sql, enqueue.params)
}

function enqueueVehicle(
  c: RouteHandlerContext,
  clientId: string,
  operation: 'create' | 'update',
  payload: Record<string, unknown>,
): void {
  const enqueue = buildEnqueue({
    entity: 'delivery_vehicles',
    operation,
    clientId,
    payload,
    userId: c.ctx.userId ?? null,
    workspaceId: c.ctx.workspaceId,
  })
  c.db.run(enqueue.sql, enqueue.params)
}
