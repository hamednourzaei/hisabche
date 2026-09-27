// ============================================
// backend/src/services/migration/migration.service.ts
//
// The migration job: upload, scan, map, validate, dry run, commit, reconcile.
//
// ---------------------------------------------------------------------------
// THE FILE NEVER REACHES THE DATABASE
//
// What is committed are ordinary INSERTs and UPDATEs on `customers` and
// `products`, built from values the pure layer already parsed and validated.
// No user-supplied string ever becomes SQL, no dump is ever restored, and no
// column is written that the existing services do not write. The production
// database receives application-level mutations only — which is the whole
// point of §23.1.
//
// ---------------------------------------------------------------------------
// WHY THE COMMIT IS BATCHED AND NOT ONE TRANSACTION
//
// supabase-js has no transactions, and this capability does not get to invent
// one. So the commit is made SAFE TO REPEAT instead: every written row is
// recorded in `migration_records` under a unique (workspace, entity, source
// identity), and a re-run finds the identity already there and updates the
// existing target rather than creating a second one. A commit interrupted
// halfway is resumed by running it again — never by a compensating DELETE,
// which is forbidden and would delete rows a person may have edited since.
//
// ---------------------------------------------------------------------------
// EVERY QUERY IS SCOPED BY workspace_id
//
// `ctx.userId` appears only as `created_by`. A manager must be able to see and
// continue a migration a colleague started; filtering by the creator would
// make the history lie about what happened in the workspace.
// ============================================

import { selectAllPages } from '../../utils/fetch-all-pages'
import { createHash } from 'node:crypto'

import { supabase } from '../../db'
import {
  ConflictError,
  DatabaseError,
  NotFoundError,
  isFailedRead,
} from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'

import {
  checkIntake,
  checkParsed,
  parseDelimited,
  comparisonKey,
  normalizePhone,
  MIGRATION_ENTITIES,
  type MigrationEntity,
  type MigrationSourceType,
  type MigrationStatus,
} from './migration.domain'
import {
  ENTITY_FIELDS,
  detectSource,
  suggestMapping,
  type MappingSuggestion,
} from './migration.entities'
import {
  EXPORT_COLUMNS,
  applyProfile,
  planRollback,
  toCsvRow,
  toProfile,
  type ImportProfile,
  type ProfileFit,
  type RollbackCandidate,
  type RollbackPlan,
} from './migration.recovery'
import {
  dryRun,
  reconcile,
  validateRows,
  type ColumnMapping,
  type DryRunSummary,
  type Finding,
  type ReconciliationLine,
} from './migration.validate'

/* ─── Shapes the route and the UI share ───────────────────────────────────── */

export interface MigrationDiscovery {
  headers: string[]
  delimiter: string
  rowCount: number
  raggedRows: number[]
  source: ReturnType<typeof detectSource>
  suggestions: MappingSuggestion[]
  /** First few rows, so the user can see what they uploaded. */
  sample: string[][]
}

export interface MigrationJob {
  id: string
  entity: MigrationEntity
  sourceType: MigrationSourceType
  originalFilename: string
  byteSize: number
  status: MigrationStatus
  discovery: MigrationDiscovery | null
  mapping: ColumnMapping
  findings: Finding[]
  dryRun: DryRunSummary | null
  reconciliation: { lines: ReconciliationLine[]; matched: boolean } | null
  rowsScanned: number
  rowsCreated: number
  rowsUpdated: number
  rowsSkipped: number
  createdBy: string
  createdAt: string
  completedAt: string | null
  errorCode: string | null
}

const COLUMNS =
  'id, entity, source_type, original_filename, byte_size, status, discovery, mapping, findings, ' +
  'dry_run, reconciliation, rows_scanned, rows_created, rows_updated, rows_skipped, created_by, ' +
  'created_at, completed_at, error_code'

function mapJob(raw: Record<string, any>): MigrationJob {
  return {
    id: raw.id,
    entity: raw.entity,
    sourceType: raw.source_type,
    originalFilename: raw.original_filename,
    byteSize: Number(raw.byte_size) || 0,
    status: raw.status,
    discovery: raw.discovery && Object.keys(raw.discovery).length > 0 ? raw.discovery : null,
    mapping: raw.mapping ?? {},
    findings: raw.findings ?? [],
    dryRun: raw.dry_run ?? null,
    reconciliation: raw.reconciliation ?? null,
    rowsScanned: Number(raw.rows_scanned) || 0,
    rowsCreated: Number(raw.rows_created) || 0,
    rowsUpdated: Number(raw.rows_updated) || 0,
    rowsSkipped: Number(raw.rows_skipped) || 0,
    createdBy: raw.created_by,
    createdAt: raw.created_at,
    completedAt: raw.completed_at ?? null,
    errorCode: raw.error_code ?? null,
  }
}

/**
 * Sample rows shown back to the user, capped.
 *
 * Five is enough to recognise your own file and few enough that a customer
 * list is not casually re-displayed in full inside a progress screen.
 */
const SAMPLE_ROWS = 5

/** Rows written per round trip. Small enough that an interrupted commit leaves
 *  little to redo, large enough that fifty thousand rows is not fifty thousand
 *  requests. */
const BATCH_SIZE = 200

export class MigrationService {
  /* ─── Intake ────────────────────────────────────────────────────────────── */

  /**
   * Accept a file, parse it, and describe what is in it.
   *
   * The parse happens HERE, in the request, and the text is discarded when it
   * returns. Nothing hostile is persisted, so there is no quarantined blob to
   * secure, expire or accidentally serve — the isolation §23.1 asks for is
   * achieved by not keeping the thing at all.
   */
  async create(
    ctx: TenancyContext,
    input: {
      entity: MigrationEntity
      sourceType: MigrationSourceType
      filename: string
      content: string
    },
  ): Promise<MigrationJob> {
    this.assertMayImport(ctx)

    if (!MIGRATION_ENTITIES.includes(input.entity)) {
      throw new ValidationError('MIGRATION_ENTITY_UNSUPPORTED')
    }

    const rejection = checkIntake(input.content)
    if (rejection) throw new ValidationError(`MIGRATION_${rejection.code}`)

    const table = parseDelimited(input.content, input.sourceType === 'tsv' ? '\t' : undefined)
    const shape = checkParsed(table)
    if (shape) throw new ValidationError(`MIGRATION_${shape.code}`)

    const suggestions = suggestMapping(input.entity, table.headers)

    const discovery: MigrationDiscovery = {
      headers: table.headers,
      delimiter: table.delimiter,
      rowCount: table.rows.length,
      raggedRows: table.raggedRows.slice(0, 200),
      source: detectSource(table.headers),
      suggestions,
      sample: table.rows.slice(0, SAMPLE_ROWS),
    }

    // The mapping the wizard opens with: only the confident guesses. A
    // `needs_review` suggestion is shown but NOT pre-applied, so a user who
    // clicks through without reading imports nothing the importer guessed.
    const mapping: ColumnMapping = {}
    suggestions.forEach((suggestion, index) => {
      if (suggestion.status === 'matched' && suggestion.targetField) {
        mapping[suggestion.targetField] = index
      }
    })

    const { data, error } = await supabase
      .from('migration_jobs')
      .insert({
        workspace_id: ctx.workspaceId,
        created_by: ctx.userId,
        entity: input.entity,
        source_type: input.sourceType,
        original_filename: input.filename.slice(0, 260),
        byte_size: Buffer.byteLength(input.content, 'utf8'),
        content_digest: createHash('sha256').update(input.content).digest('hex'),
        status: 'scanned' satisfies MigrationStatus,
        discovery,
        mapping,
        rows_scanned: table.rows.length,
      })
      .select(COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create the migration job', error)
    return mapJob(data)
  }

  /* ─── Reading ───────────────────────────────────────────────────────────── */

  async list(ctx: TenancyContext): Promise<MigrationJob[]> {
    const { data, error } = await supabase
      .from('migration_jobs')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw new DatabaseError('Failed to fetch migrations', error)
    return (data ?? []).map(mapJob)
  }

  async get(ctx: TenancyContext, id: string): Promise<MigrationJob> {
    const { data, error } = await supabase
      .from('migration_jobs')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .single()

    if (isFailedRead(error)) throw new DatabaseError('Failed to read migration', error)
    if (!data) throw new NotFoundError('Migration')
    return mapJob(data)
  }

  /* ─── Mapping and validation ────────────────────────────────────────────── */

  /**
   * Replace the mapping.
   *
   * The mapping is re-checked against the file's OWN headers rather than
   * trusted: a client that posts `{ fullName: 99 }` for a nine-column file
   * would otherwise read undefined for every row and import blanks.
   */
  async setMapping(ctx: TenancyContext, id: string, mapping: ColumnMapping): Promise<MigrationJob> {
    this.assertMayImport(ctx)
    const job = await this.get(ctx, id)
    this.assertOpen(job)

    const headerCount = job.discovery?.headers.length ?? 0
    const fields = new Set(ENTITY_FIELDS[job.entity].map((spec) => spec.key))
    const clean: ColumnMapping = {}

    for (const [field, column] of Object.entries(mapping)) {
      if (!fields.has(field)) throw new ValidationError('MIGRATION_UNKNOWN_TARGET_FIELD')
      if (!Number.isInteger(column) || column < 0 || column >= headerCount) {
        throw new ValidationError('MIGRATION_COLUMN_OUT_OF_RANGE')
      }
      clean[field] = column
    }

    // One column may not feed two fields. Silently allowing it produces a
    // product whose buy and sell price are the same number, which reads as a
    // zero margin rather than as a mistake.
    const used = new Set(Object.values(clean))
    if (used.size !== Object.keys(clean).length) {
      throw new ValidationError('MIGRATION_COLUMN_MAPPED_TWICE')
    }

    return this.update(ctx, id, { mapping: clean, status: 'mapping', findings: [], dry_run: null })
  }

  /**
   * Validate and dry-run in one step, from the file the client still holds.
   *
   * The content is re-sent rather than stored between steps. That is the
   * trade this design makes: the user's export never rests on our disk, at the
   * cost of the browser keeping it in memory while the wizard is open. The
   * digest is compared so a DIFFERENT file cannot be slipped in between the
   * mapping step and the commit.
   */
  async validate(
    ctx: TenancyContext,
    id: string,
    content: string,
  ): Promise<{ job: MigrationJob; dryRun: DryRunSummary; findings: Finding[] }> {
    this.assertMayImport(ctx)
    const job = await this.get(ctx, id)
    this.assertOpen(job)
    await this.assertSameFile(ctx, id, content)

    const { candidates, findings } = this.parseAgainstJob(job, content)
    const existingKeys = await this.existingKeys(ctx, job.entity)
    const summary = dryRun(job.entity, candidates, existingKeys)

    const updated = await this.update(ctx, id, {
      status: summary.toCreate + summary.toUpdate > 0 ? 'ready' : 'validating',
      findings: findings.slice(0, 2000),
      dry_run: summary,
    })

    return { job: updated, dryRun: summary, findings }
  }

  /* ─── Commit ────────────────────────────────────────────────────────────── */

  /**
   * Write the rows, record what was written, then reconcile.
   *
   * `committed_at` is claimed with a conditional UPDATE before any row is
   * written, so two clicks on the confirm button cannot both start a commit.
   * The second gets `MIGRATION_ALREADY_COMMITTED` — which is a correct answer,
   * not an error to retry past.
   */
  async commit(ctx: TenancyContext, id: string, content: string): Promise<MigrationJob> {
    this.assertMayImport(ctx)
    const job = await this.get(ctx, id)
    this.assertOpen(job)

    if (!job.dryRun) throw new ConflictError('MIGRATION_NOT_SIMULATED')
    await this.assertSameFile(ctx, id, content)

    const claimed = await supabase
      .from('migration_jobs')
      .update({ status: 'importing', committed_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .is('committed_at', null)
      .select('id')

    if (claimed.error) throw new DatabaseError('Failed to start the import', claimed.error)
    if ((claimed.data ?? []).length === 0) throw new ConflictError('MIGRATION_ALREADY_COMMITTED')

    const { candidates } = this.parseAgainstJob(job, content)
    const importable = candidates.filter((candidate) => candidate.importable)

    let created = 0
    let updatedCount = 0
    let skipped = candidates.length - importable.length

    try {
      const alreadyMapped = await this.mappedIdentities(ctx, job.entity)

      for (let start = 0; start < importable.length; start += BATCH_SIZE) {
        const batch = importable.slice(start, start + BATCH_SIZE)

        for (const candidate of batch) {
          const identity = candidate.keys.find((key) => key.strength === 'strong')?.key ?? null

          // Already imported by an earlier run of this same source row: the
          // identity ledger says which Hisabche row it became, so this run
          // updates that one instead of creating a twin.
          const existingTarget = identity ? alreadyMapped.get(identity) : undefined

          const written = existingTarget
            ? await this.updateEntity(ctx, job.entity, existingTarget, candidate.values)
            : await this.createEntity(ctx, job.entity, candidate.values)

          if (written === null) {
            skipped += 1
            continue
          }

          if (existingTarget) updatedCount += 1
          else created += 1

          if (identity) {
            await this.recordIdentity(ctx, {
              migrationId: id,
              entity: job.entity,
              identity,
              row: candidate.row,
              targetId: written,
              outcome: existingTarget ? 'updated' : 'created',
            })
            alreadyMapped.set(identity, written)
          }
        }
      }
    } catch (error) {
      await this.update(ctx, id, {
        status: 'failed',
        error_code: error instanceof Error ? error.message.slice(0, 200) : 'UNKNOWN',
        rows_created: created,
        rows_updated: updatedCount,
        rows_skipped: skipped,
      })
      throw error
    }

    // ─── Reconcile ────────────────────────────────────────────────────────
    //
    // Counted from the ledger, not from the loop's own variables. A counter
    // incremented next to the write it is counting proves nothing: it says the
    // code reached that line, not that a row exists.
    const actual = await this.countLedger(ctx, id)
    const expected = {
      created: job.dryRun.toCreate,
      updated: job.dryRun.toUpdate,
    }
    const result = reconcile(expected, actual)

    return this.update(ctx, id, {
      status: result.matched ? 'completed' : 'completed_with_warnings',
      rows_created: created,
      rows_updated: updatedCount,
      rows_skipped: skipped,
      reconciliation: result,
      completed_at: new Date().toISOString(),
    })
  }

  /* ─── §39 Rollback ──────────────────────────────────────────────────────── */

  /**
   * What undoing this migration would do — WITHOUT doing it.
   *
   * The same preview-then-commit shape as the import itself. §39 forbids a
   * blanket delete, and the reason is visible in the plan: a row the import
   * created that a real business has since built on cannot go, and the plan
   * names it rather than deleting it and breaking the invoice that references
   * it.
   */
  async planRollback(ctx: TenancyContext, id: string): Promise<RollbackPlan> {
    this.assertMayImport(ctx)
    const job = await this.get(ctx, id)

    // The WHOLE ledger (27 Sep 2026): a rollback planned from the first 1000 records leaves the rest behind.
    const { data, error } = await selectAllPages((lo, hi) =>
      supabase
        .from('migration_records')
        .select('target_id, outcome')
        .eq('workspace_id', ctx.workspaceId)
        .eq('migration_id', id)
        .order('id', { ascending: true })
        .range(lo, hi),
    )

    if (error) throw new DatabaseError('Failed to read the migration ledger', error)

    const rows = data ?? []
    const createdIds = rows
      .filter((row) => row.outcome === 'created')
      .map((row) => row.target_id as string)

    const dependents = await this.dependentCounts(ctx, job.entity, createdIds)

    const candidates: RollbackCandidate[] = rows.map((row) => ({
      targetId: row.target_id as string,
      outcome: row.outcome as 'created' | 'updated' | 'skipped',
      dependentCount: dependents.get(row.target_id as string) ?? 0,
    }))

    return planRollback(job.entity, candidates)
  }

  /**
   * Delete exactly the rows the plan says are free, and nothing else.
   *
   * The plan is RECOMPUTED here rather than accepted from the client: a plan
   * posted back could name a row that has acquired an invoice in the seconds
   * since, and trusting it would delete a customer somebody is billing.
   */
  async rollback(ctx: TenancyContext, id: string): Promise<RollbackPlan> {
    this.assertMayImport(ctx)

    // Only the owner may undo an import. Creating rows and destroying them are
    // not the same act — this mirrors `invoice.delete` being owner-only.
    if (ctx.role !== 'owner') throw new ConflictError('MIGRATION_ROLLBACK_FORBIDDEN')

    const job = await this.get(ctx, id)
    const plan = await this.planRollback(ctx, id)

    if (plan.deletable.length > 0) {
      const { error } = await supabase
        .from(job.entity === 'customer' ? 'customers' : 'products')
        .delete()
        .eq('workspace_id', ctx.workspaceId)
        .in('id', plan.deletable)

      if (error) throw new DatabaseError('Failed to roll back the migration', error)

      // The ledger entries go with the rows. Leaving them would make a second
      // rollback try to delete ids that no longer exist, and would leave the
      // identity map claiming a source row still points somewhere.
      await supabase
        .from('migration_records')
        .delete()
        .eq('workspace_id', ctx.workspaceId)
        .eq('migration_id', id)
        .in('target_id', plan.deletable)
    }

    await this.update(ctx, id, {
      status: 'cancelled',
      rows_created: Math.max(0, job.rowsCreated - plan.deletable.length),
      completed_at: new Date().toISOString(),
    })

    return plan
  }

  /**
   * How many live rows point at each of these.
   *
   * ⚠️ A failed read counts as ONE dependent, not zero. Reporting zero because
   * the query broke would green-light a delete on the strength of a failure —
   * the quiet direction of wrong. "Cannot prove it is free" must behave like
   * "not free".
   */
  private async dependentCounts(
    ctx: TenancyContext,
    entity: MigrationEntity,
    ids: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>()
    if (ids.length === 0) return counts

    const sources =
      entity === 'customer'
        ? ([
            ['invoices', 'customer_id'],
            ['transactions', 'customer_id'],
          ] as const)
        : ([
            ['stock_movements', 'product_id'],
            ['invoice_items', 'product_id'],
          ] as const)

    for (const [table, column] of sources) {
      const { data, error } = await selectAllPages((lo, hi) =>
        supabase
          .from(table)
          .select(column)
          .eq('workspace_id', ctx.workspaceId)
          .in(column, ids)
          .order('id', { ascending: true })
          .range(lo, hi),
      )

      if (error) {
        for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
        continue
      }

      for (const row of data ?? []) {
        const id = (row as Record<string, string>)[column]
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
      }
    }

    return counts
  }

  /* ─── §40 Import profiles ───────────────────────────────────────────────── */

  async saveProfile(ctx: TenancyContext, id: string, name: string): Promise<ImportProfile> {
    this.assertMayImport(ctx)
    const job = await this.get(ctx, id)
    if (!job.discovery) throw new ConflictError('MIGRATION_NOT_SCANNED')

    const profile = toProfile(
      id,
      name.slice(0, 120),
      job.entity,
      job.discovery.headers,
      job.mapping,
    )

    const { data, error } = await supabase
      .from('migration_profiles')
      .upsert(
        {
          workspace_id: ctx.workspaceId,
          created_by: ctx.userId,
          name: profile.name,
          entity: profile.entity,
          columns_by_name: profile.columnsByName,
          signature: profile.signature,
        },
        { onConflict: 'workspace_id,entity,name' },
      )
      .select('id')
      .single()

    if (error) throw new DatabaseError('Failed to save the import profile', error)
    return { ...profile, id: (data?.id as string) ?? profile.id }
  }

  async listProfiles(ctx: TenancyContext, entity: MigrationEntity): Promise<ImportProfile[]> {
    const { data, error } = await supabase
      .from('migration_profiles')
      .select('id, name, entity, columns_by_name, signature')
      .eq('workspace_id', ctx.workspaceId)
      .eq('entity', entity)
      .limit(100)

    if (error) throw new DatabaseError('Failed to read import profiles', error)

    return (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      entity: row.entity as MigrationEntity,
      columnsByName: (row.columns_by_name as Record<string, string>) ?? {},
      signature: (row.signature as string[]) ?? [],
    }))
  }

  /**
   * Apply a saved profile to this job.
   *
   * A drifted profile is applied AND reported. §40 forbids applying a stale
   * mapping silently, so the caller receives the columns that have gone
   * missing and is expected to show them.
   */
  async useProfile(
    ctx: TenancyContext,
    id: string,
    profileId: string,
  ): Promise<{ job: MigrationJob; fit: ProfileFit }> {
    this.assertMayImport(ctx)
    const job = await this.get(ctx, id)
    this.assertOpen(job)
    if (!job.discovery) throw new ConflictError('MIGRATION_NOT_SCANNED')

    const profiles = await this.listProfiles(ctx, job.entity)
    const profile = profiles.find((candidate) => candidate.id === profileId)
    if (!profile) throw new NotFoundError('Import profile')

    const fit = applyProfile(profile, job.entity, job.discovery.headers)
    if (!fit.fits) return { job, fit }

    return { job: await this.setMapping(ctx, id, fit.mapping), fit }
  }

  /* ─── §41 Export symmetry ───────────────────────────────────────────────── */

  /**
   * Export in the shape this importer reads back.
   *
   * The first column is Hisabche's own id as `externalId`, which is what makes
   * a round trip MATCH existing rows instead of creating twins. Without it,
   * export-then-import is a duplication machine.
   */
  async exportCsv(ctx: TenancyContext, entity: MigrationEntity): Promise<string> {
    const columns = EXPORT_COLUMNS[entity]

    // The WHOLE table (27 Sep 2026): an export cut at PostgREST's 1000 rows lost the rest silently.
    const { data, error } = await selectAllPages((lo, hi) =>
      supabase
        .from(entity === 'customer' ? 'customers' : 'products')
        .select('*')
        .eq('workspace_id', ctx.workspaceId)
        .order('id', { ascending: true })
        .range(lo, hi),
    )

    if (error) throw new DatabaseError('Failed to export', error)

    const snake = (field: string) => field.replace(/[A-Z]/g, (letter) => '_' + letter.toLowerCase())

    const rows = (data ?? []).map((row: Record<string, unknown>) =>
      toCsvRow(
        columns.map((field) => {
          if (field === 'externalId') return String(row['id'] ?? '')
          const value = row[snake(field)]
          return value === null || value === undefined ? '' : String(value)
        }),
      ),
    )

    return [toCsvRow([...columns]), ...rows].join('\n')
  }

  async cancel(ctx: TenancyContext, id: string): Promise<MigrationJob> {
    this.assertMayImport(ctx)
    const job = await this.get(ctx, id)
    this.assertOpen(job)
    return this.update(ctx, id, { status: 'cancelled', completed_at: new Date().toISOString() })
  }

  /* ─── Internals ─────────────────────────────────────────────────────────── */

  /**
   * Importing is an owner/manager act.
   *
   * A seller creates customers one at a time at the counter; creating four
   * thousand at once, with opening balances, is a different operation with a
   * different blast radius. This mirrors `product.write`, which a seller also
   * does not hold.
   */
  private assertMayImport(ctx: TenancyContext) {
    if (ctx.role !== 'owner' && ctx.role !== 'manager') {
      throw new ConflictError('MIGRATION_FORBIDDEN')
    }
  }

  private assertOpen(job: MigrationJob) {
    const closed: MigrationStatus[] = [
      'completed',
      'completed_with_warnings',
      'cancelled',
      'failed',
    ]
    if (closed.includes(job.status)) throw new ConflictError('MIGRATION_CLOSED')
  }

  /** The file re-sent at a later step must be the file that was scanned. */
  private async assertSameFile(ctx: TenancyContext, id: string, content: string) {
    const { data, error } = await supabase
      .from('migration_jobs')
      .select('content_digest')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .single()

    if (isFailedRead(error)) throw new DatabaseError('Failed to read migration', error)
    if (!data) throw new NotFoundError('Migration')

    const digest = createHash('sha256').update(content).digest('hex')
    if (data.content_digest && data.content_digest !== digest) {
      throw new ConflictError('MIGRATION_FILE_CHANGED')
    }
  }

  private parseAgainstJob(job: MigrationJob, content: string) {
    const rejection = checkIntake(content)
    if (rejection) throw new ValidationError(`MIGRATION_${rejection.code}`)

    const table = parseDelimited(content, job.discovery?.delimiter)
    return validateRows(job.entity, table.headers, table.rows, job.mapping, {
      raggedRows: table.raggedRows,
    })
  }

  private async update(
    ctx: TenancyContext,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<MigrationJob> {
    const { data, error } = await supabase
      .from('migration_jobs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .select(COLUMNS)
      .single()

    if (error || !data) throw new DatabaseError('Failed to update the migration', error)
    return mapJob(data)
  }

  /**
   * The business keys already present in this workspace.
   *
   * Read once per validation rather than per row: four thousand rows against
   * four thousand single-row lookups is four thousand round trips, and the set
   * does not change while a dry run is computing.
   */
  private async existingKeys(ctx: TenancyContext, entity: MigrationEntity): Promise<Set<string>> {
    const keys = new Set<string>()

    if (entity === 'customer') {
      // EVERY existing key (27 Sep 2026): with only the first 1000, an import into a larger book created twins of the rest.
      const { data, error } = await selectAllPages((lo, hi) =>
        supabase
          .from('customers')
          .select('phone, email, full_name')
          .eq('workspace_id', ctx.workspaceId)
          .order('id', { ascending: true })
          .range(lo, hi),
      )

      if (error) throw new DatabaseError('Failed to read existing customers', error)

      for (const row of data ?? []) {
        const phone = normalizePhone(row.phone ?? '')
        if (phone) keys.add(`phone:${phone}`)
        const email = (row.email ?? '').trim().toLowerCase()
        if (email) keys.add(`email:${email}`)
        const name = comparisonKey(row.full_name ?? '')
        if (name) keys.add(`name:${name}`)
      }
    } else {
      const { data, error } = await selectAllPages((lo, hi) =>
        supabase
          .from('products')
          .select('sku, barcode, name')
          .eq('workspace_id', ctx.workspaceId)
          .order('id', { ascending: true })
          .range(lo, hi),
      )

      if (error) throw new DatabaseError('Failed to read existing products', error)

      for (const row of data ?? []) {
        const sku = comparisonKey(row.sku ?? '')
        if (sku) keys.add(`sku:${sku}`)
        const barcode = comparisonKey(row.barcode ?? '')
        if (barcode) keys.add(`barcode:${barcode}`)
        const name = comparisonKey(row.name ?? '')
        if (name) keys.add(`name:${name}`)
      }
    }

    return keys
  }

  /** Source identity → the Hisabche row it already became. */
  private async mappedIdentities(
    ctx: TenancyContext,
    entity: MigrationEntity,
  ): Promise<Map<string, string>> {
    const { data, error } = await selectAllPages((lo, hi) =>
      supabase
        .from('migration_records')
        .select('source_identity, target_id')
        .eq('workspace_id', ctx.workspaceId)
        .eq('source_entity_type', entity)
        .order('id', { ascending: true })
        .range(lo, hi),
    )

    if (error) throw new DatabaseError('Failed to read the migration ledger', error)

    const map = new Map<string, string>()
    for (const row of data ?? []) map.set(row.source_identity, row.target_id)
    return map
  }

  private async recordIdentity(
    ctx: TenancyContext,
    input: {
      migrationId: string
      entity: MigrationEntity
      identity: string
      row: number
      targetId: string
      outcome: 'created' | 'updated' | 'skipped'
    },
  ) {
    const { error } = await supabase.from('migration_records').upsert(
      {
        workspace_id: ctx.workspaceId,
        migration_id: input.migrationId,
        source_entity_type: input.entity,
        source_identity: input.identity,
        source_row: input.row,
        target_entity_type: input.entity,
        target_id: input.targetId,
        outcome: input.outcome,
      },
      { onConflict: 'workspace_id,source_entity_type,source_identity' },
    )

    if (error) throw new DatabaseError('Failed to record the migration identity', error)
  }

  private async countLedger(ctx: TenancyContext, migrationId: string) {
    const { data, error } = await selectAllPages((lo, hi) =>
      supabase
        .from('migration_records')
        .select('outcome')
        .eq('workspace_id', ctx.workspaceId)
        .eq('migration_id', migrationId)
        .order('id', { ascending: true })
        .range(lo, hi),
    )

    if (error) throw new DatabaseError('Failed to reconcile the migration', error)

    const counts = { created: 0, updated: 0 }
    for (const row of data ?? []) {
      if (row.outcome === 'created') counts.created += 1
      if (row.outcome === 'updated') counts.updated += 1
    }
    return counts
  }

  /* ─── Writing the actual business rows ──────────────────────────────────── */

  /**
   * Money crosses a unit boundary here, and only here.
   *
   * The parser works in integer minor units because that is the only way to
   * read `1.234,50` without a float. `customers.opening_balance` and the
   * `products` price columns are stored in MAJOR units by the services that
   * already own them. Dividing at this one seam keeps the importer's
   * arithmetic exact and keeps an imported product identical to a typed one —
   * changing the columns instead would be a schema change for every other
   * caller, which is not this capability's to make.
   */
  private toMajor(minor: unknown): number {
    return typeof minor === 'number' ? minor / 100 : 0
  }

  private async createEntity(
    ctx: TenancyContext,
    entity: MigrationEntity,
    values: Record<string, string | number | boolean>,
  ): Promise<string | null> {
    const row =
      entity === 'customer'
        ? {
            full_name: String(values['fullName'] ?? ''),
            phone: String(values['phone'] ?? ''),
            email: String(values['email'] ?? ''),
            address: values['address'] ? String(values['address']) : null,
            notes: String(values['notes'] ?? ''),
            opening_balance: this.toMajor(values['openingBalance']),
            // Imported customers are cash by default. Marking one `credit`
            // makes its opening balance a debt, and a guess that creates debts
            // is not a guess this importer gets to make.
            type: values['type'] === 'credit' ? 'credit' : 'cash',
            is_active: true,
          }
        : {
            name: String(values['name'] ?? ''),
            sku: String(values['sku'] ?? ''),
            barcode: String(values['barcode'] ?? ''),
            category: String(values['category'] ?? 'general'),
            unit: String(values['unit'] ?? 'piece'),
            quantity: typeof values['quantity'] === 'number' ? values['quantity'] : 0,
            min_stock_level:
              typeof values['minStockLevel'] === 'number' ? values['minStockLevel'] : 5,
            buy_price: this.toMajor(values['buyPrice']),
            sell_price: this.toMajor(values['sellPrice']),
            wholesale_price:
              values['wholesalePrice'] === undefined
                ? null
                : this.toMajor(values['wholesalePrice']),
            is_active: true,
          }

    const { data, error } = await supabase
      .from(entity === 'customer' ? 'customers' : 'products')
      .insert({ ...row, workspace_id: ctx.workspaceId, user_id: ctx.userId })
      .select('id')
      .single()

    // A single rejected row does not fail the migration. It is counted as
    // skipped and the run continues — failure isolation, so one bad address
    // does not cost the other 3,999 rows.
    if (error || !data) return null
    return data.id as string
  }

  private async updateEntity(
    ctx: TenancyContext,
    entity: MigrationEntity,
    targetId: string,
    values: Record<string, string | number | boolean>,
  ): Promise<string | null> {
    // Only fields the source actually supplied are written. A blank cell means
    // "the export did not say", not "set this to empty" — overwriting a phone
    // number the shopkeeper typed by hand with a blank from a partial export
    // is data loss dressed up as an update.
    const patch: Record<string, unknown> = {}
    const set = (column: string, value: unknown) => {
      if (value !== undefined && value !== '') patch[column] = value
    }

    if (entity === 'customer') {
      set('full_name', values['fullName'])
      set('phone', values['phone'])
      set('email', values['email'])
      set('address', values['address'])
      set('notes', values['notes'])
      // Opening balance is NEVER updated. It is the state of the account when
      // the books began; a second import restating it would silently rewrite
      // a balance that transactions have since moved.
    } else {
      set('name', values['name'])
      set('sku', values['sku'])
      set('barcode', values['barcode'])
      set('category', values['category'])
      set('unit', values['unit'])
      if (typeof values['quantity'] === 'number') patch['quantity'] = values['quantity']
      if (typeof values['buyPrice'] === 'number')
        patch['buy_price'] = this.toMajor(values['buyPrice'])
      if (typeof values['sellPrice'] === 'number') {
        patch['sell_price'] = this.toMajor(values['sellPrice'])
      }
    }

    if (Object.keys(patch).length === 0) return targetId

    const { data, error } = await supabase
      .from(entity === 'customer' ? 'customers' : 'products')
      .update(patch)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', targetId)
      .select('id')
      .single()

    if (error || !data) return null
    return data.id as string
  }
}
