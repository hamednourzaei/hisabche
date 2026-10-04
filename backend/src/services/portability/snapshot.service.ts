// ============================================
// backend/src/services/portability/snapshot.service.ts
//
// Capabilities #42–#46 — a snapshot: a marker of how many records the business
// held at a moment, and what has been added since.
//
// ⚠️ NOT A BACKUP. It copies no rows and nothing can be restored from it; the
// domain's `buildSnapshot` puts `restorable: false` and the list of what a
// marker cannot answer on every one, and both reach the client.
//
// ⚠️ COUNTS ARE EXACT (`count: 'exact', head: true`) — a marker built from the
// planner's estimate would be compared with another estimate, and the
// difference would be noise presented as «3 invoices added».
//
// ⚠️ A TABLE THAT COULD NOT BE COUNTED IS ABSENT, NOT ZERO. `counted: false`
// travels with it, so «unknown» is never read as «none».
//
// Markers are append-only (the database refuses UPDATE and DELETE).
// ============================================

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import type { TenancyContext } from '../tenancy.service'
import { SNAPSHOT_TABLES, buildSnapshot, checkReadable, type Snapshot } from './snapshot.domain'

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])
const COLUMNS = 'id, label, kind, taken_at, source_schema_version, counts'

/**
 * The shape the counted tables have today. Raised by hand when a migration
 * changes what one of them MEANS (not when a column is added), so an old
 * marker can say it was taken under an older shape.
 */
export const SNAPSHOT_SCHEMA_VERSION = '1.0.0'

export class SnapshotsNotConfiguredError extends BaseError {
  constructor() {
    super('SNAPSHOTS_MIGRATION_PENDING', 503)
    this.name = 'SnapshotsNotConfiguredError'
  }
}

export interface SnapshotView {
  id: string
  label: string
  takenAt: string
  restorable: false
  limitations: string[]
  /** One row per table the marker covers. `count: null` = it could not be counted then. */
  tables: Array<{ table: string; count: number | null }>
}

export interface SnapshotComparison extends SnapshotView {
  readable: boolean
  asOf: string
  /** `added: null` when either side is unknown — never a guessed difference. */
  changes: Array<{ table: string; then: number | null; now: number | null; added: number | null }>
}

interface SnapshotRow {
  id: string
  label: string
  kind: Snapshot['kind']
  taken_at: string
  source_schema_version: string
  counts: Record<string, number> | null
}

function fail(error: { code?: string; message: string }, what: string): never {
  if (MISSING_SCHEMA.has(error.code ?? '')) throw new SnapshotsNotConfiguredError()
  throw new DatabaseError(what, error)
}

export class SnapshotService {
  /** Exact row counts of this workspace, per table. A failed count is null. */
  private async countAll(workspaceId: string): Promise<Record<string, number | null>> {
    const counts: Record<string, number | null> = {}
    await Promise.all(
      SNAPSHOT_TABLES.map(async ({ table }) => {
        const { count, error } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
        counts[table] = error || typeof count !== 'number' ? null : count
      }),
    )
    return counts
  }

  private toSnapshot(workspaceId: string, row: SnapshotRow): Snapshot {
    return buildSnapshot({
      id: row.id,
      workspaceId,
      kind: row.kind,
      takenAt: row.taken_at,
      sourceSchemaVersion: row.source_schema_version,
      counts: row.counts ?? {},
    })
  }

  private toView(row: SnapshotRow, snapshot: Snapshot): SnapshotView {
    return {
      id: row.id,
      label: row.label,
      takenAt: snapshot.takenAt,
      restorable: snapshot.restorable,
      limitations: snapshot.limitations,
      tables: snapshot.tables.map((table) => ({ table, count: snapshot.counts[table] ?? null })),
    }
  }

  async list(ctx: TenancyContext): Promise<SnapshotView[]> {
    const { data, error } = await supabase
      .from('data_snapshots')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('taken_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(200)
    if (error) fail(error, 'Failed to read snapshots')
    return ((data ?? []) as SnapshotRow[]).map((row) =>
      this.toView(row, this.toSnapshot(ctx.workspaceId, row)),
    )
  }

  async take(ctx: TenancyContext, label: string): Promise<SnapshotView> {
    const counts = await this.countAll(ctx.workspaceId)
    const counted = Object.fromEntries(
      Object.entries(counts).filter(
        (entry): entry is [string, number] => typeof entry[1] === 'number',
      ),
    )
    const { data, error } = await supabase
      .from('data_snapshots')
      .insert({
        workspace_id: ctx.workspaceId,
        taken_by: ctx.userId,
        label: label.trim(),
        kind: 'full',
        source_schema_version: SNAPSHOT_SCHEMA_VERSION,
        counts: counted,
      })
      .select(COLUMNS)
      .single()
    if (error) fail(error, 'Failed to take the snapshot')
    const row = data as SnapshotRow
    return this.toView(row, this.toSnapshot(ctx.workspaceId, row))
  }

  /** What has been added since a marker was taken. */
  async compare(ctx: TenancyContext, id: string): Promise<SnapshotComparison> {
    const { data, error } = await supabase
      .from('data_snapshots')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .maybeSingle()
    if (error) fail(error, 'Failed to read the snapshot')
    if (!data) throw new NotFoundError('Snapshot')

    const row = data as SnapshotRow
    const snapshot = this.toSnapshot(ctx.workspaceId, row)
    const now = await this.countAll(ctx.workspaceId)
    const { readable } = checkReadable(snapshot, SNAPSHOT_SCHEMA_VERSION)

    return {
      ...this.toView(row, snapshot),
      readable,
      asOf: new Date().toISOString(),
      changes: snapshot.tables.map((table) => {
        const then = snapshot.counts[table] ?? null
        const current = now[table] ?? null
        return {
          table,
          then,
          now: current,
          // A marker the reader cannot interpret is not compared.
          added: readable && then !== null && current !== null ? current - then : null,
        }
      }),
    }
  }
}

export const snapshotService = new SnapshotService()
