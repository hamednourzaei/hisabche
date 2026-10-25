// ============================================
// packages/local-engine/src/routes/people-common.ts
//
// The few helpers the people-side routes (employees, payroll, leaves, shifts,
// attendance, budgets) share. Nothing here is a business rule — those are in
// @hisabche/validation and are the SAME functions the server calls.
// ============================================

import type { z } from 'zod'
import type { LocalDb } from '../db'
import { NotFoundError, ValidationError } from '../errors'

export function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function nowIso(): string {
  return new Date().toISOString()
}

/** Parse with the SAME zod schema the server's route uses; a miss is a 400 naming the fields. */
export function parseWith<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
    )
  }
  return parsed.data
}

export function bodyOf(body: unknown): Record<string, unknown> {
  return body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {}
}

/** The employee must be this business's — an id is not proof of membership. */
export function requireEmployee(db: LocalDb, workspaceId: string, employeeId: string): void {
  const row = db.get<{ id: string }>(
    'SELECT id FROM employee WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
    [employeeId, workspaceId],
  )
  if (!row) throw new NotFoundError('Employee')
}
