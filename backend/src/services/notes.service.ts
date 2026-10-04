// ============================================
// backend/src/services/notes.service.ts
//
// Capability #103 — notes on a customer, supplier, product or employee.
//
// A LOG: a note is added and stays as written. No edit, no delete (the
// database refuses both — docs/entity-notes-01-migration.sql).
//
// ⚠️ THE ENTITY IS CHECKED AGAINST THE WORKSPACE BEFORE READING OR WRITING. An
// id is not proof of membership: without the check, anyone could read or leave
// notes on another business's customer by guessing an id.
//
// What may carry a note is the domain's list (`validateNote`), narrowed to the
// kinds that have a table in this product today.
// ============================================

import { supabase } from '../db'
import { BaseError } from '../errors/base.error'
import { DatabaseError, NotFoundError } from '../errors/database.error'
import { ValidationError } from '../errors/validation.error'
import { selectAllPages } from '../utils/fetch-all-pages'
import { validateNote } from './customers/attendance.domain'
import type { TenancyContext } from './tenancy.service'

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])

/** Entity kind → the table that proves it belongs to the workspace. */
export const NOTE_ENTITY_TABLES = {
  customer: 'customers',
  supplier: 'suppliers',
  product: 'products',
  employee: 'employees',
} as const
export type NoteEntityType = keyof typeof NOTE_ENTITY_TABLES

export class NotesNotConfiguredError extends BaseError {
  constructor() {
    super('NOTES_MIGRATION_PENDING', 503)
    this.name = 'NotesNotConfiguredError'
  }
}

export interface EntityNote {
  id: string
  body: string
  createdAt: string
  /** Written by the person asking. Who else wrote a note is not exposed by id. */
  mine: boolean
}

interface NoteRow {
  id: string
  body: string
  created_at: string
  created_by: string
}

export class NotesService {
  private async assertOwned(ctx: TenancyContext, entityType: NoteEntityType, entityId: string) {
    const { data, error } = await supabase
      .from(NOTE_ENTITY_TABLES[entityType])
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', entityId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to read the record', error)
    if (!data) throw new NotFoundError('Record')
  }

  async list(
    ctx: TenancyContext,
    entityType: NoteEntityType,
    entityId: string,
  ): Promise<EntityNote[]> {
    await this.assertOwned(ctx, entityType, entityId)
    const { data, error } = await selectAllPages<NoteRow, { message: string; code?: string }>(
      (from, to) =>
        supabase
          .from('entity_notes')
          .select('id, body, created_at, created_by')
          .eq('workspace_id', ctx.workspaceId)
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to),
    )
    if (error) {
      if (MISSING_SCHEMA.has(error.code ?? '')) throw new NotesNotConfiguredError()
      throw new DatabaseError('Failed to read notes', error)
    }
    return (data ?? []).map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      mine: row.created_by === ctx.userId,
    }))
  }

  async add(
    ctx: TenancyContext,
    input: { entityType: NoteEntityType; entityId: string; body: string },
  ): Promise<EntityNote> {
    const problems = validateNote(input)
    if (problems.length > 0) throw new ValidationError(`NOTE_${problems[0]}`)
    await this.assertOwned(ctx, input.entityType, input.entityId)

    const { data, error } = await supabase
      .from('entity_notes')
      .insert({
        workspace_id: ctx.workspaceId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        body: input.body.trim(),
        created_by: ctx.userId,
      })
      .select('id, body, created_at, created_by')
      .single()
    if (error) {
      if (MISSING_SCHEMA.has(error.code ?? '')) throw new NotesNotConfiguredError()
      throw new DatabaseError('Failed to save the note', error)
    }
    const row = data as NoteRow
    return { id: row.id, body: row.body, createdAt: row.created_at, mine: true }
  }
}

export const notesService = new NotesService()
