// ============================================
// packages/validation/src/schemas/saved-views.schema.ts
//
// Saved views (#87) and shared views (#89): how one application table LOOKS —
// hidden columns, sort, search — under a name. It holds no rows and no
// selection. One contract for the server's SavedViewsService and the device.
// ============================================

import { z } from 'zod'

/** The whole of what a view may carry. Closed: an unknown field is refused. */
export const savedViewStateSchema = z
  .object({
    hiddenIds: z.array(z.string().min(1).max(80)).max(100).default([]),
    sortId: z.string().min(1).max(80).nullable().default(null),
    sortDirection: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().max(200).default(''),
  })
  .strict()

export type SavedViewState = z.infer<typeof savedViewStateSchema>

export const savedViewTableIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_.-]{0,59}$/)

export const savedViewNameSchema = z.string().trim().min(1).max(60)

export const createSavedViewSchema = z.object({
  tableId: savedViewTableIdSchema,
  name: savedViewNameSchema,
  state: savedViewStateSchema,
  shared: z.boolean().default(false),
})

export const updateSavedViewSchema = z
  .object({
    name: savedViewNameSchema.optional(),
    shared: z.boolean().optional(),
    state: savedViewStateSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to change' })

export interface SavedViewRecord {
  id: string
  tableId: string
  name: string
  state: SavedViewState
  shared: boolean
  /** Whether the reader saved it — only then may they change or remove it. */
  mine: boolean
  createdAt: string
}

export interface SavedViewRow {
  id: string
  table_id: string
  name: string
  state: unknown
  shared: boolean | number
  created_by: string
  created_at: string
}

/**
 * A stored view as the reader sees it. A stored state that no longer fits the
 * contract becomes the default look rather than an error: a view must never be
 * able to break a table.
 */
export function savedViewRecord(row: SavedViewRow, userId: string): SavedViewRecord {
  const parsed = savedViewStateSchema.safeParse(row.state)
  return {
    id: row.id,
    tableId: row.table_id,
    name: row.name,
    state: parsed.success ? parsed.data : savedViewStateSchema.parse({}),
    shared: row.shared === true || row.shared === 1,
    mine: row.created_by === userId,
    createdAt: row.created_at,
  }
}
