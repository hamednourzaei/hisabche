// ============================================
// backend/src/services/crm/crm.repository.ts
//
// CRM Core — the only file that knows the `interactions` / `opportunities`
// tables and their columns. Every query is scoped by workspace_id.
//
// ⚠️ status / public_token / employee_id / employee_name / customers_snapshot /
// status_history come from docs/task-assignment-migration.sql and
// customer_outcomes from docs/task-customer-outcomes-migration.sql. Reads and
// inserts fall back to the legacy columns when Postgres reports 42703, so a
// database without those migrations still works.
// ============================================

import { supabase } from '../../db'
import { DatabaseError, isFailedRead } from '../../errors/database.error'

export const INTERACTION_COLUMNS =
  'id, workspace_id, customer_id, type, subject, content, interaction_date, created_at, status, public_token, employee_id, employee_name, customers_snapshot, status_history, customer_outcomes'
const INTERACTION_LEGACY_COLUMNS =
  'id, workspace_id, customer_id, type, subject, content, interaction_date, created_at'

const OPPORTUNITY_COLUMNS =
  'id, customer_id, title, description, stage, value, expected_close_date, probability, created_at, updated_at'

const PAGE = 1000

type Row = Record<string, any>

const isMissingColumn = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === '42703' || /column/.test(error.message || ''))

/** Reads every page of a query; stops on the first error. */
async function readAll(
  label: string,
  page: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: any }>,
): Promise<{ rows: Row[]; error: any }> {
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) return { rows, error }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return { rows, error: null }
  }
}

export type TaskLookup = { id: string; workspaceId: string } | { publicToken: string }

export class CrmRepository {
  // ─── Interactions ─────────────────────────────────────────────────────────

  async listInteractions(
    workspaceId: string,
    options: { customerId?: string | undefined; offset: number; limit: number },
  ): Promise<{ rows: Row[]; total: number }> {
    const run = (columns: string) => {
      let query = supabase
        .from('interactions')
        // Exact, not estimated: the total drives pagination people act on.
        .select(columns, { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .order('interaction_date', { ascending: false })
        .range(options.offset, options.offset + options.limit - 1)
      if (options.customerId) query = query.eq('customer_id', options.customerId)
      return query
    }
    let result = await run(INTERACTION_COLUMNS)
    if (isMissingColumn(result.error)) result = await run(INTERACTION_LEGACY_COLUMNS)
    if (result.error) throw new DatabaseError('Failed to fetch interactions', result.error)
    return { rows: (result.data ?? []) as unknown as Row[], total: result.count ?? 0 }
  }

  /**
   * Every task that concerns a customer — as its primary customer OR on its
   * snapshot. The list above matches `customer_id` only, so a task sent to ten
   * customers appeared on one customer's page and not the other nine.
   */
  async interactionsForCustomer(workspaceId: string, customerId: string): Promise<Row[]> {
    const primary = await readAll('customer interactions', (from, to) =>
      supabase
        .from('interactions')
        .select(INTERACTION_COLUMNS)
        .eq('workspace_id', workspaceId)
        .eq('customer_id', customerId)
        .order('interaction_date', { ascending: false })
        .range(from, to),
    )
    if (isMissingColumn(primary.error)) {
      const legacy = await readAll('customer interactions', (from, to) =>
        supabase
          .from('interactions')
          .select(INTERACTION_LEGACY_COLUMNS)
          .eq('workspace_id', workspaceId)
          .eq('customer_id', customerId)
          .order('interaction_date', { ascending: false })
          .range(from, to),
      )
      if (legacy.error)
        throw new DatabaseError('Failed to fetch customer interactions', legacy.error)
      return legacy.rows
    }
    if (primary.error)
      throw new DatabaseError('Failed to fetch customer interactions', primary.error)

    const onSnapshot = await readAll('customer interactions', (from, to) =>
      supabase
        .from('interactions')
        .select(INTERACTION_COLUMNS)
        .eq('workspace_id', workspaceId)
        .contains('customers_snapshot', [{ id: customerId }])
        .order('interaction_date', { ascending: false })
        .range(from, to),
    )
    if (onSnapshot.error) {
      throw new DatabaseError('Failed to fetch customer interactions', onSnapshot.error)
    }

    const byId = new Map<string, Row>()
    for (const row of [...primary.rows, ...onSnapshot.rows]) byId.set(row.id, row)
    return [...byId.values()]
  }

  /** Name and phone of the customers a task covers, from this workspace only. */
  async customerSnapshot(workspaceId: string, customerIds: string[]): Promise<Row[]> {
    if (customerIds.length === 0) return []
    const { data, error } = await supabase
      .from('customers')
      .select('id, full_name, phone')
      .in('id', customerIds)
      .eq('workspace_id', workspaceId)
    // This read used to be unchecked: a failure produced a task with an empty
    // customer list and no error.
    if (error) throw new DatabaseError('Failed to read task customers', error)
    return data ?? []
  }

  async insertInteraction(full: Row, legacy: Row): Promise<Row> {
    let result = await supabase
      .from('interactions')
      .insert(full)
      .select(INTERACTION_COLUMNS)
      .single()
    if (isMissingColumn(result.error)) {
      result = await supabase
        .from('interactions')
        .insert(legacy)
        .select(INTERACTION_LEGACY_COLUMNS)
        .single()
    }
    if (result.error || !result.data) {
      throw new DatabaseError('Failed to create interaction', result.error)
    }
    return result.data as unknown as Row
  }

  /** The task row for a status or outcome change, with its workspace. */
  async findTask(lookup: TaskLookup, columns: string): Promise<Row | null> {
    let query = supabase.from('interactions').select(`id, workspace_id, ${columns}`)
    query =
      'id' in lookup
        ? query.eq('id', lookup.id).eq('workspace_id', lookup.workspaceId)
        : query.eq('public_token', lookup.publicToken)
    const { data, error } = await query.maybeSingle()
    if (error) throw new DatabaseError('Failed to read task', error)
    return (data as Row | null) ?? null
  }

  async updateTask(id: string, workspaceId: string, patch: Row): Promise<Row> {
    const { data, error } = await supabase
      .from('interactions')
      .update(patch)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(INTERACTION_COLUMNS)
      .single()
    if (error) {
      if (isMissingColumn(error)) {
        throw new DatabaseError('This change requires the task CRM migrations', error)
      }
      throw new DatabaseError('Failed to update task', error)
    }
    return data as unknown as Row
  }

  async findPublicTask(token: string): Promise<Row | null> {
    const { data, error } = await supabase
      .from('interactions')
      .select(INTERACTION_COLUMNS)
      .eq('public_token', token)
      .maybeSingle()
    if (isFailedRead(error)) throw new DatabaseError('Failed to read task', error)
    return (data as Row | null) ?? null
  }

  async recentSubjects(workspaceId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('interactions')
      .select('subject, created_at')
      .eq('workspace_id', workspaceId)
      .not('subject', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200) // suggestions only: the 200 most recent are what anyone retypes
    if (error) throw new DatabaseError('Failed to load subject suggestions', error)
    return (data ?? []).map((row: Row) => row.subject)
  }

  // ─── Opportunities ────────────────────────────────────────────────────────

  async listOpportunities(
    workspaceId: string,
    options: { customerId?: string | undefined; offset: number; limit: number },
  ): Promise<{ rows: Row[]; total: number }> {
    let query = supabase
      .from('opportunities')
      .select(OPPORTUNITY_COLUMNS, { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(options.offset, options.offset + options.limit - 1)
    if (options.customerId) query = query.eq('customer_id', options.customerId)
    const { data, error, count } = await query
    if (error) throw new DatabaseError('Failed to fetch opportunities', error)
    return { rows: data ?? [], total: count ?? 0 }
  }

  async opportunitiesForCustomer(workspaceId: string, customerId: string): Promise<Row[]> {
    const { rows, error } = await readAll('customer opportunities', (from, to) =>
      supabase
        .from('opportunities')
        .select(OPPORTUNITY_COLUMNS)
        .eq('workspace_id', workspaceId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .range(from, to),
    )
    if (error) throw new DatabaseError('Failed to fetch customer opportunities', error)
    return rows
  }

  /**
   * Every opportunity with the time of its latest linked interaction.
   * Paged: the reads this replaced (intelligence/forecast) stopped at 2000
   * opportunities and 10000 interactions without saying so.
   */
  async opportunityActivity(
    workspaceId: string,
  ): Promise<
    Array<{
      id: string
      title: string
      stage: string | null
      createdAt: string
      lastActivityAt: string | null
    }>
  > {
    const opportunities = await readAll('opportunities', (from, to) =>
      supabase
        .from('opportunities')
        .select('id, title, stage, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })
        .range(from, to),
    )
    if (opportunities.error)
      throw new DatabaseError('Failed to read opportunities', opportunities.error)

    const activity = await readAll('opportunity activity', (from, to) =>
      supabase
        .from('interactions')
        .select('opportunity_id, created_at')
        .eq('workspace_id', workspaceId)
        .not('opportunity_id', 'is', null)
        .order('created_at', { ascending: false })
        .range(from, to),
    )
    // No `opportunity_id` column on an older database is a valid state: every
    // opportunity then measures from its creation date. Any other error is not.
    if (activity.error && !isMissingColumn(activity.error)) {
      throw new DatabaseError('Failed to read opportunity activity', activity.error)
    }
    const latest = new Map<string, string>()
    for (const row of activity.rows) {
      const id = String(row.opportunity_id)
      if (!latest.has(id)) latest.set(id, String(row.created_at))
    }

    return opportunities.rows.map((row) => ({
      id: String(row.id),
      title: String(row.title ?? ''),
      stage: row.stage ?? null,
      createdAt: String(row.created_at),
      lastActivityAt: latest.get(String(row.id)) ?? null,
    }))
  }

  async insertOpportunity(row: Row): Promise<Row> {
    const { data, error } = await supabase
      .from('opportunities')
      .insert(row)
      .select(OPPORTUNITY_COLUMNS)
      .single()
    if (error) throw new DatabaseError('Failed to create opportunity', error)
    return data
  }

  async updateOpportunity(workspaceId: string, id: string, patch: Row): Promise<Row | null> {
    const { data, error } = await supabase
      .from('opportunities')
      .update(patch)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(OPPORTUNITY_COLUMNS)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to update opportunity', error)
    return data
  }
}
