// ============================================
// packages/local-engine/src/routes/approvals-local.ts
//
// Offline approval queue requests waiting for manager confirmation or sync.
// ============================================

import { buildEnqueue } from '@hisabche/app-bridge'
import { requireCapability } from '../auth'
import { ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'
import { newId, nowIso } from './people-common'

export function registerApprovalsLocalRoutes(router: Router): void {
  router.get('/local-ops/approvals', (c: RouteHandlerContext) => {
    const rows = c.db.all(
      `SELECT * FROM local_approval_queue WHERE workspace_id = ? ORDER BY created_at DESC`,
      [c.ctx.workspaceId],
    )
    return { data: rows }
  })

  router.post('/local-ops/approvals', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'invoice.create')
    const raw = (c.body || {}) as Record<string, unknown>
    const documentType = typeof raw.documentType === 'string' ? raw.documentType.trim() : ''
    const documentId = typeof raw.documentId === 'string' ? raw.documentId.trim() : ''
    const note = typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim() : null
    if (!documentType || !documentId) {
      throw new ValidationError('LOCAL_APPROVAL_INPUT_INVALID')
    }
    const id = newId()
    const now = nowIso()
    c.db.run(
      `INSERT INTO local_approval_queue (id, workspace_id, document_type, document_id, requested_by, status, note, created_at, updated_at, origin, sync_state)
       VALUES (?, ?, ?, ?, ?, 'pending_offline', ?, ?, ?, 'local', 'local_only')`,
      [id, c.ctx.workspaceId, documentType, documentId, c.ctx.userId, note, now, now],
    )
    if (c.headers?.['x-hisabche-queue'] === '1') {
      const enq = buildEnqueue({
        entity: 'local_approval_queue',
        operation: 'create',
        clientId: id,
        payload: { id, documentType, documentId, ...(note ? { note } : {}) },
        userId: c.headers?.['x-hisabche-user-id'] ?? c.ctx.userId,
        workspaceId: c.ctx.workspaceId,
      })
      c.db.run(enq.sql, enq.params)
    }
    return {
      __status: 201,
      __data: { data: c.db.get('SELECT * FROM local_approval_queue WHERE id = ?', [id]) },
    }
  })
}
