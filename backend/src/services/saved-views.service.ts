// ============================================
// backend/src/services/saved-views.service.ts
//
// Capabilities #87 (saved views) and #89 (shared views).
//
// A saved view is how one application table LOOKS — hidden columns, sort,
// search — under a name. It holds no rows and no selection.
//
// WHO SEES WHAT
//
//   · a person's own views, always;
//   · views another member SHARED, in the same workspace;
//   · nothing from another workspace — `workspace_id` is the boundary.
//
// Only the person who saved a view renames, re-shares or removes it. Sharing a
// view shares a LOOK, never data: whoever applies it still sees only the rows
// their own role may see, because the rows come from the list endpoint, not
// from here.
// ============================================

import {
  savedViewRecord,
  savedViewStateSchema,
  savedViewTableIdSchema,
  type SavedViewRecord,
  type SavedViewState,
} from '@hisabche/validation'

import { supabase } from '../db'
import { BaseError } from '../errors/base.error'
import { ConflictError, DatabaseError, NotFoundError } from '../errors/database.error'
import type { TenancyContext } from './tenancy.service'

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])

export class SavedViewsNotConfiguredError extends BaseError {
  constructor() {
    super('SAVED_VIEWS_MIGRATION_PENDING', 503)
    this.name = 'SavedViewsNotConfiguredError'
  }
}

// The contract (state, table id, record) is shared with the offline engine.
export { savedViewStateSchema, savedViewTableIdSchema, type SavedViewRecord, type SavedViewState }

const COLUMNS = 'id, table_id, name, state, shared, created_by, created_at'

interface Row {
  id: string
  table_id: string
  name: string
  state: unknown
  shared: boolean
  created_by: string
  created_at: string
}

export class SavedViewsService {
  private failure(message: string, error: { code?: string }): BaseError {
    if (MISSING_SCHEMA.has(error.code ?? '')) return new SavedViewsNotConfiguredError()
    return new DatabaseError(message, error)
  }

  /** The reader's own views of a table, then the ones others shared. */
  async list(ctx: TenancyContext, tableId: string): Promise<SavedViewRecord[]> {
    const { data, error } = await supabase
      .from('saved_views')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('table_id', tableId)
      .or(`created_by.eq.${ctx.userId},shared.eq.true`)
      .order('created_at', { ascending: true })
    if (error) throw this.failure('Failed to read saved views', error)

    const records = ((data ?? []) as unknown as Row[]).map((row) =>
      savedViewRecord(row, ctx.userId),
    )
    return [...records.filter((view) => view.mine), ...records.filter((view) => !view.mine)]
  }

  async create(
    ctx: TenancyContext,
    input: { tableId: string; name: string; state: SavedViewState; shared: boolean },
  ): Promise<SavedViewRecord> {
    const { data, error } = await supabase
      .from('saved_views')
      .insert({
        workspace_id: ctx.workspaceId,
        table_id: input.tableId,
        name: input.name.trim(),
        state: input.state,
        shared: input.shared,
        created_by: ctx.userId,
      })
      .select(COLUMNS)
      .single()
    if (error) {
      if (error.code === '23505') throw new ConflictError('SAVED_VIEW_NAME_TAKEN')
      throw this.failure('Failed to save the view', error)
    }
    return savedViewRecord(data as unknown as Row, ctx.userId)
  }

  /** Rename, re-share, or replace the look. Only its owner. */
  async update(
    ctx: TenancyContext,
    id: string,
    patch: {
      name?: string | undefined
      shared?: boolean | undefined
      state?: SavedViewState | undefined
    },
  ): Promise<SavedViewRecord> {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (patch.name !== undefined) updates.name = patch.name.trim()
    if (patch.shared !== undefined) updates.shared = patch.shared
    if (patch.state !== undefined) updates.state = patch.state

    const { data, error } = await supabase
      .from('saved_views')
      .update(updates)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      // The owner filter is the authorisation: a shared view someone else saved
      // matches no row, and reads as «not found» rather than «forbidden».
      .eq('created_by', ctx.userId)
      .select(COLUMNS)
      .maybeSingle()
    if (error) {
      if (error.code === '23505') throw new ConflictError('SAVED_VIEW_NAME_TAKEN')
      throw this.failure('Failed to update the view', error)
    }
    if (!data) throw new NotFoundError('Saved view')
    return savedViewRecord(data as unknown as Row, ctx.userId)
  }

  async remove(ctx: TenancyContext, id: string): Promise<void> {
    const { data, error } = await supabase
      .from('saved_views')
      .delete()
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .eq('created_by', ctx.userId)
      .select('id')
      .maybeSingle()
    if (error) throw this.failure('Failed to remove the view', error)
    if (!data) throw new NotFoundError('Saved view')
  }
}

export const savedViewsService = new SavedViewsService()
