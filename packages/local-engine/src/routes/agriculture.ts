// ============================================
// packages/local-engine/src/routes/agriculture.ts
//
// Offline crop cycles and livestock groups register backed by local SQLite.
// ============================================

import { buildEnqueue } from '@hisabche/app-bridge'
import { requireCapability } from '../auth'
import { ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'
import { newId, nowIso } from './people-common'

export function registerAgricultureRoutes(router: Router): void {
  router.get('/local-ops/crop-cycles', (c: RouteHandlerContext) => {
    const rows = c.db.all(
      `SELECT * FROM local_crop_cycles WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY planting_date DESC`,
      [c.ctx.workspaceId],
    )
    return { data: rows }
  })

  router.post('/local-ops/crop-cycles', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const raw = (c.body || {}) as Record<string, unknown>
    const landUnitId = typeof raw.landUnitId === 'string' ? raw.landUnitId.trim() : ''
    const cropName = typeof raw.cropName === 'string' ? raw.cropName.trim() : ''
    const plantingDate = typeof raw.plantingDate === 'string' ? raw.plantingDate.trim() : ''
    const expectedHarvestDate =
      typeof raw.expectedHarvestDate === 'string' && raw.expectedHarvestDate.trim()
        ? raw.expectedHarvestDate.trim()
        : null
    if (!landUnitId || !cropName || plantingDate.length < 8) {
      throw new ValidationError('LOCAL_CROP_CYCLE_INPUT_INVALID')
    }
    const id = newId()
    const now = nowIso()
    c.db.run(
      `INSERT INTO local_crop_cycles
       (id, workspace_id, land_unit_id, crop_name, planting_date, expected_harvest_date, status, created_at, updated_at, origin, sync_state)
       VALUES (?, ?, ?, ?, ?, ?, 'planted', ?, ?, 'local', 'local_only')`,
      [id, c.ctx.workspaceId, landUnitId, cropName, plantingDate, expectedHarvestDate, now, now],
    )
    if (c.headers?.['x-hisabche-queue'] === '1') {
      const enq = buildEnqueue({
        entity: 'local_crop_cycles',
        operation: 'create',
        clientId: id,
        payload: {
          id,
          landUnitId,
          cropName,
          plantingDate,
          ...(expectedHarvestDate ? { expectedHarvestDate } : {}),
        },
        userId: c.headers?.['x-hisabche-user-id'] ?? c.ctx.userId,
        workspaceId: c.ctx.workspaceId,
      })
      c.db.run(enq.sql, enq.params)
    }
    return {
      __status: 201,
      __data: { data: c.db.get('SELECT * FROM local_crop_cycles WHERE id = ?', [id]) },
    }
  })

  router.get('/local-ops/livestock-groups', (c: RouteHandlerContext) => {
    const rows = c.db.all(
      `SELECT * FROM local_livestock_groups WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
      [c.ctx.workspaceId],
    )
    return { data: rows }
  })

  router.post('/local-ops/livestock-groups', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const raw = (c.body || {}) as Record<string, unknown>
    const category = typeof raw.category === 'string' ? raw.category.trim() : ''
    const headCount = Number(raw.headCount)
    const acquisitionDate =
      typeof raw.birthOrAcquisitionDate === 'string' ? raw.birthOrAcquisitionDate.trim() : ''
    const locationBarn =
      typeof raw.locationBarn === 'string' && raw.locationBarn.trim()
        ? raw.locationBarn.trim()
        : null
    if (
      !category ||
      !Number.isSafeInteger(headCount) ||
      headCount < 0 ||
      acquisitionDate.length < 8
    ) {
      throw new ValidationError('LOCAL_LIVESTOCK_INPUT_INVALID')
    }
    const id = newId()
    const now = nowIso()
    c.db.run(
      `INSERT INTO local_livestock_groups
       (id, workspace_id, category, head_count, birth_or_acquisition_date, location_barn, status, created_at, updated_at, origin, sync_state)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, 'local', 'local_only')`,
      [id, c.ctx.workspaceId, category, headCount, acquisitionDate, locationBarn, now, now],
    )
    if (c.headers?.['x-hisabche-queue'] === '1') {
      const enq = buildEnqueue({
        entity: 'local_livestock_groups',
        operation: 'create',
        clientId: id,
        payload: {
          id,
          category,
          headCount,
          birthOrAcquisitionDate: acquisitionDate,
          ...(locationBarn ? { locationBarn } : {}),
        },
        userId: c.headers?.['x-hisabche-user-id'] ?? c.ctx.userId,
        workspaceId: c.ctx.workspaceId,
      })
      c.db.run(enq.sql, enq.params)
    }
    return {
      __status: 201,
      __data: { data: c.db.get('SELECT * FROM local_livestock_groups WHERE id = ?', [id]) },
    }
  })
}
