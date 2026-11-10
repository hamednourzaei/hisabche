// ============================================
// backend/src/services/user-state.service.ts
//
// What a person keeps on the server (user-state-01): invoice drafts (per
// person AND workspace) and preferences (per person). Every read and write is
// keyed by the caller's own userId — never an id from the body — and drafts by
// the workspace they are in (BUG-101 rule).
//
// Before the migration runs, reads answer `configured: false` and writes are
// refused with a code the client shows («not set up yet»), not a 500.
// ============================================

import {
  MAX_INVOICE_DRAFT_BYTES,
  MAX_INVOICE_DRAFTS,
  THEME_PREFERENCES,
  type InvoiceDraftKind,
  type InvoiceDraftSaveInput,
  type ThemePreference,
} from '@hisabche/validation'

import { supabase } from '../db'
import { ConflictError, DatabaseError, NotFoundError } from '../errors/database.error'
import { ValidationError } from '../errors/validation.error'

/** The table is missing until the migration runs: «not configured», not 500. */
const isMissing = (code: string | undefined) =>
  code === '42P01' || code === 'PGRST205' || code === 'PGRST204'

export interface InvoiceDraftRecord {
  id: string
  kind: InvoiceDraftKind
  title: string
  payload: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

interface DraftRow {
  id: string
  kind: InvoiceDraftKind
  title: string | null
  payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

const DRAFT_COLUMNS = 'id, kind, title, payload, created_at, updated_at'

const toRecord = (row: DraftRow): InvoiceDraftRecord => ({
  id: row.id,
  kind: row.kind,
  title: row.title ?? '',
  payload: row.payload ?? {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export async function listInvoiceDrafts(
  userId: string,
  workspaceId: string,
): Promise<{ configured: boolean; drafts: InvoiceDraftRecord[] }> {
  const { data, error } = await supabase
    .from('invoice_drafts')
    .select(DRAFT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(MAX_INVOICE_DRAFTS)
  if (error) {
    if (isMissing(error.code)) return { configured: false, drafts: [] }
    throw new DatabaseError('Failed to read the invoice drafts', error)
  }
  return { configured: true, drafts: ((data ?? []) as DraftRow[]).map(toRecord) }
}

export async function saveInvoiceDraft(
  userId: string,
  workspaceId: string,
  input: InvoiceDraftSaveInput,
): Promise<InvoiceDraftRecord> {
  const size = Buffer.byteLength(JSON.stringify(input.payload), 'utf8')
  if (size > MAX_INVOICE_DRAFT_BYTES) throw new ValidationError('INVOICE_DRAFT_TOO_LARGE')

  const now = new Date().toISOString()
  const values = { kind: input.kind, title: input.title, payload: input.payload, updated_at: now }

  if (input.id) {
    const { data, error } = await supabase
      .from('invoice_drafts')
      .update(values)
      .eq('id', input.id)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .select(DRAFT_COLUMNS)
      .maybeSingle()
    if (error) {
      if (isMissing(error.code)) throw new ConflictError('INVOICE_DRAFTS_NOT_CONFIGURED')
      throw new DatabaseError('Failed to save the invoice draft', error)
    }
    // A draft opened on another device and deleted there is saved anew below,
    // so the person's work is never dropped.
    if (data) return toRecord(data as DraftRow)
  }

  const { count, error: countError } = await supabase
    .from('invoice_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
  if (countError) {
    if (isMissing(countError.code)) throw new ConflictError('INVOICE_DRAFTS_NOT_CONFIGURED')
    throw new DatabaseError('Failed to count the invoice drafts', countError)
  }
  if ((count ?? 0) >= MAX_INVOICE_DRAFTS) throw new ConflictError('INVOICE_DRAFTS_FULL')

  const { data, error } = await supabase
    .from('invoice_drafts')
    .insert({ ...values, workspace_id: workspaceId, user_id: userId })
    .select(DRAFT_COLUMNS)
    .single()
  if (error) {
    if (isMissing(error.code)) throw new ConflictError('INVOICE_DRAFTS_NOT_CONFIGURED')
    throw new DatabaseError('Failed to save the invoice draft', error)
  }
  return toRecord(data as DraftRow)
}

export async function deleteInvoiceDraft(
  userId: string,
  workspaceId: string,
  id: string,
): Promise<{ deleted: true }> {
  const { data, error } = await supabase
    .from('invoice_drafts')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .select('id')
  if (error) {
    if (isMissing(error.code)) throw new ConflictError('INVOICE_DRAFTS_NOT_CONFIGURED')
    throw new DatabaseError('Failed to delete the invoice draft', error)
  }
  if (!data || data.length === 0) throw new NotFoundError('INVOICE_DRAFT_NOT_FOUND')
  return { deleted: true }
}

export interface UserPreferencesRecord {
  configured: boolean
  /** null = never chosen on the server; the device keeps its own. */
  theme: ThemePreference | null
}

const KNOWN_THEMES = new Set<string>(THEME_PREFERENCES)

export async function readUserPreferences(userId: string): Promise<UserPreferencesRecord> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('theme')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    if (isMissing(error.code)) return { configured: false, theme: null }
    throw new DatabaseError('Failed to read the preferences', error)
  }
  const theme = (data as { theme?: string } | null)?.theme
  return {
    configured: true,
    theme: theme && KNOWN_THEMES.has(theme) ? (theme as ThemePreference) : null,
  }
}

export async function saveUserPreferences(
  userId: string,
  theme: ThemePreference,
): Promise<UserPreferencesRecord> {
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, theme, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (error) {
    if (isMissing(error.code)) throw new ConflictError('USER_PREFERENCES_NOT_CONFIGURED')
    throw new DatabaseError('Failed to save the preferences', error)
  }
  return { configured: true, theme }
}
