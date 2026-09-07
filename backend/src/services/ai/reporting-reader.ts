// ============================================
// backend/src/services/ai/reporting-reader.ts
//
// T13 — the ONLY way the AI layer touches data.
//
// ---------------------------------------------------------------------------
// ⛔ RAW SQL IS FORBIDDEN. THIS FILE IS WHY THAT RULE IS ENFORCEABLE.
//
// The model never composes a query, never names a table, never supplies a
// workspace. It picks from a fixed list of four questions; this file answers
// them; the answers go back as data. There is no path from model output to a
// query, so there is nothing for a prompt injection to steer.
//
// That matters because the text the model reads is not trustworthy: customer
// notes, supplier names, product descriptions and imported CSVs are all
// written by people who are not the user. Give the model a WHERE clause and
// you have given it to whoever writes your invoice notes.
//
// ---------------------------------------------------------------------------
// ⚠️ EVERY READ GOES THROUGH A USER-SCOPED CLIENT. NEVER THE SERVICE CLIENT.
//
// The reporting views isolate by calling `auth_workspace_ids()`, which reads
// `auth.uid()` from the session. The backend's shared `supabase` client is the
// service role and BYPASSES RLS — reading a view through it returns every
// workspace in the database, and the views cannot defend themselves because
// they deliberately expose no `workspace_id` column to filter on afterwards.
//
// So this takes an access token and nothing else. There is no overload that
// accepts a workspace id, because a workspace id passed as an argument is the
// exact shape Phase O was designed to eliminate.
// ============================================

import { createUserScopedClient } from '../../db'

/**
 * The questions the AI may ask of the data.
 *
 * ⚠️ A CLOSED SET, AND IT MUST STAY CLOSED. Adding a member means adding a
 * reviewed view — see the checklist in `docs/ai-integration-readme.md`. A
 * question these cannot answer is a new view, not an escape hatch.
 */
export const REPORTING_VIEWS = [
  'inventory_summary',
  'customer_balance',
  'sales_summary',
  'outstanding_invoices',
] as const

export type ReportingView = (typeof REPORTING_VIEWS)[number]

export function isReportingView(name: string): name is ReportingView {
  return (REPORTING_VIEWS as readonly string[]).includes(name)
}

/** How many rows any one view may contribute to a prompt. */
const ROW_CAP = 200

export interface ReportingResult {
  view: ReportingView
  rows: Record<string, unknown>[]
  /** True when the view had more rows than the cap — the answer must say so. */
  truncated: boolean
}

export class ReportingReader {
  private readonly client: ReturnType<typeof createUserScopedClient>

  /**
   * @param accessToken the caller's own token. RLS resolves the workspace from
   * it, so this class never needs — and never accepts — a workspace id.
   */
  constructor(accessToken: string) {
    this.client = createUserScopedClient(accessToken)
  }

  async read(view: string): Promise<ReportingResult> {
    // ⚠️ Validated against the closed set BEFORE it reaches the query builder.
    // Without this a model could name `public.users` and PostgREST would try
    // it — the string would have come from model output, which is the one
    // place a table name must never come from.
    if (!isReportingView(view)) {
      throw new Error(`AI_VIEW_NOT_ALLOWED: ${view}`)
    }

    const { data, error } = await this.client
      .schema('reporting')
      .from(view)
      .select('*')
      .limit(ROW_CAP + 1)

    if (error) throw new Error(`AI_REPORTING_READ_FAILED: ${error.message}`)

    const rows = (data ?? []) as Record<string, unknown>[]
    const truncated = rows.length > ROW_CAP

    return { view, rows: truncated ? rows.slice(0, ROW_CAP) : rows, truncated }
  }

  /** Read several views for one question. */
  async readMany(views: readonly string[]): Promise<ReportingResult[]> {
    const unique = [...new Set(views)]
    return Promise.all(unique.map((view) => this.read(view)))
  }
}
