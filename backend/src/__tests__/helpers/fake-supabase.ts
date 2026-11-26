// ============================================
// backend/src/__tests__/helpers/fake-supabase.ts
//
// An in-memory stand-in for the PostgREST query builder, so integration tests
// can drive REAL HTTP through the real routes, the real guards and the real
// services, and then read back the rows that were actually written.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS FOR, AND WHAT IT IS NOT
//
// It exists because the domain suites never touch a database and therefore
// cannot see: a route that forgot a guard, a service that wrote to the wrong
// workspace, an idempotency key that does not actually deduplicate, or two
// concurrent requests that both succeed when only one should.
//
// It is NOT a Postgres. It does not enforce RLS, foreign keys, constraints or
// transactions, and a test passing here is not evidence that the SQL is right.
// Row Level Security is a database feature and can only be proven against a
// database — `scripts/verify-rls.mjs` is where that belongs, and this file
// does not pretend to replace it.
//
// ---------------------------------------------------------------------------
// UNSUPPORTED OPERATIONS THROW
//
// Deliberately. A fake that silently returns `[]` for a filter it does not
// understand turns a real defect into a passing test — the exact failure this
// harness was built to catch. If a service uses something not implemented
// here, the test fails loudly and this file grows.
// ============================================

export type Row = Record<string, unknown>

/** What a finished query resolves to — the shape supabase-js hands its callers. */
export interface FakeResult {
  data: unknown
  error: { code?: string; message: string } | null
  count?: number | undefined
}

/**
 * A cell compared with `<`/`>` the way JavaScript compares the values the fake stores
 * (numbers, ISO strings). The cast names that; the comparison itself is unchanged.
 */
type Comparable = string | number

type Filter = (row: Row) => boolean

/**
 * A column, or a dotted path into an embedded resource (`journal_entries.date`
 * on a row seeded with a nested `journal_entries` object) — how PostgREST
 * filters on an `!inner` embed.
 */
function valueAt(row: Row, column: string): unknown {
  if (column in row) return row[column]
  const [head, ...rest] = column.split('.')
  if (!head || rest.length === 0) return undefined
  const nested = row[head]
  const target = Array.isArray(nested) ? nested[0] : nested
  return target == null ? undefined : valueAt(target as Row, rest.join('.'))
}

interface OrderSpec {
  column: string
  ascending: boolean
}

/**
 * A write the services made, as the fake applied it: the rows carry the ids the fake
 * handed out, so a later update or delete names the same rows on the real database.
 */
export interface MirrorWrite {
  kind: 'insert' | 'upsert' | 'update' | 'delete'
  table: string
  rows: Row[]
  /** Ids the FAKE generated (the service sent none): dropped where the real table has no `id`. */
  generatedIds: string[]
  /** For an update: only the columns the service set. */
  values?: Row | undefined
  conflict?: string[] | null | undefined
  ignoreDuplicates?: boolean | undefined
}

/**
 * WRITE-THROUGH to a real PostgreSQL (opt-in, see `journey-retail.pg.test.ts`).
 *
 * With a mirror, every write and every rpc the services make ALSO runs on a real
 * database, in the same order, and the REAL answer is what the service gets back:
 * an error the real schema raises fails the route right there. Reads still come
 * from the fake, which the mirror refreshes from the real database after each change.
 */
export interface DatabaseMirror {
  write: (write: MirrorWrite) => Promise<FakeResult['error']>
  rpc: (name: string, args: Row) => Promise<FakeResult>
}

/** A uniqueness rule, so `onConflict` can behave like a real upsert. */
export interface UniqueIndex {
  table: string
  columns: string[]
}

export class FakeDatabase {
  readonly tables = new Map<string, Row[]>()
  readonly uniques: UniqueIndex[] = []
  readonly rpcs = new Map<string, (args: Row) => unknown>()

  /** Null for every suite except the write-through journey. */
  mirror: DatabaseMirror | null = null

  constructor() {
    this.registerDefaultRpcs()
  }

  private registerDefaultRpcs() {
    this.rpc('invoice_write_document', (args: Row) => {
      const pHeader = args.p_header as Row | null
      const pHeaderPatch = args.p_header_patch as Row | null
      const pItems = (args.p_items as Row[]) ?? []
      const pDetails = (args.p_details as Row[]) ?? []
      const pMovements = (args.p_movements as Row[]) ?? []
      const pReplaceItems = args.p_replace_items === true
      const pInvoiceId = String(args.p_invoice_id)
      const pWorkspaceId = String(args.p_workspace_id)

      if (pHeader) {
        this.ensure('invoices').push({ ...pHeader, id: pInvoiceId, workspace_id: pWorkspaceId })
      }
      if (pHeaderPatch) {
        const invs = this.ensure('invoices')
        const target = invs.find((i) => i.id === pInvoiceId && i.workspace_id === pWorkspaceId)
        if (target) Object.assign(target, pHeaderPatch)
      }
      if (pReplaceItems) {
        const remainingItems = this.ensure('invoice_items').filter(
          (i) => i.invoice_id !== pInvoiceId,
        )
        this.tables.set('invoice_items', remainingItems)
      }
      if (pItems.length > 0) {
        this.ensure('invoice_items').push(...pItems)
      }
      if (pDetails.length > 0) {
        this.ensure('invoice_item_details').push(...pDetails)
      }
      if (pMovements.length > 0) {
        this.ensure('stock_movements').push(...pMovements)
      }
      return { ok: true }
    })

    this.rpc('apply_payment_gateway_event', (args: Row) => {
      const paymentId = String(args.p_payment_id)
      const gatewayName = String(args.p_gateway_name)
      const eventId = args.p_event_id ? String(args.p_event_id) : null
      const eventType = args.p_event_type ? String(args.p_event_type) : 'payment.state_changed'
      const toState = String(args.p_to_state)
      const externalRef = args.p_external_ref ? String(args.p_external_ref) : ''
      const feeMinor = Number(args.p_fee_minor ?? 0)
      const amountMinor =
        args.p_amount_minor !== undefined && args.p_amount_minor !== null
          ? Number(args.p_amount_minor)
          : null
      const currency = args.p_currency ? String(args.p_currency).toUpperCase() : null
      const scale = Number(args.p_scale ?? 1)
      const payloadSha256 = args.p_payload_sha256 ? String(args.p_payload_sha256) : null
      const reason = args.p_reason ? String(args.p_reason) : null
      const actorId = args.p_actor_id ? String(args.p_actor_id) : null

      const payment = this.ensure('payments').find((p) => p.id === paymentId)
      if (!payment) throw new Error('PAYMENT_NOT_FOUND')

      const payCurrency = String(payment.currency ?? '').toUpperCase()
      if (currency && currency !== payCurrency) throw new Error('GATEWAY_CURRENCY_MISMATCH')
      const expectedMinor = Math.round(Number(payment.amount ?? 0) * scale)
      if (amountMinor !== null && amountMinor !== expectedMinor) {
        throw new Error('GATEWAY_AMOUNT_MISMATCH')
      }

      const wsId = String(payment.workspace_id)
      const events = this.ensure('payment_gateway_events')
      const replay = events.find(
        (ev) =>
          ev.workspace_id === wsId &&
          ((eventId && ev.gateway_name === gatewayName && ev.event_id === eventId) ||
            (ev.payment_id === paymentId &&
              externalRef &&
              ev.external_ref === externalRef &&
              ev.to_state === toState)),
      )
      const states = this.ensure('payment_gateway_states')
      const existing = states.find((s) => s.workspace_id === wsId && s.payment_id === paymentId)

      if (replay && existing) {
        replay.delivery_attempts = Number(replay.delivery_attempts ?? 1) + 1
        return {
          workspaceId: wsId,
          paymentId: existing.payment_id,
          processorState: existing.processor_state,
          externalRef: existing.external_ref,
          eventId: eventId ?? replay.event_id,
          currency: payCurrency,
          signatureVerified: true,
          replay: true,
        }
      }

      const fsm: Record<string, string[]> = {
        queued_offline: ['pending_capture', 'captured', 'declined', 'voided'],
        pending_capture: ['captured', 'declined', 'voided'],
        captured: ['voided'],
        declined: ['pending_capture'],
        voided: [],
      }
      const current = String(
        existing?.processor_state ?? (payment.method === 'cash' ? 'captured' : 'queued_offline'),
      )
      if (current !== toState && !(fsm[current] ?? []).includes(toState)) {
        throw new Error('PROCESSOR_STATE_TRANSITION_NOT_ALLOWED')
      }

      const now = new Date().toISOString()
      if (existing) {
        Object.assign(existing, {
          processor_state: toState,
          gateway_name: gatewayName,
          external_ref: externalRef,
          fee_minor: feeMinor,
          currency: payCurrency,
          reason,
          updated_by: actorId,
          updated_at: now,
        })
      } else {
        states.push({
          id: `pgs-${states.length + 1}`,
          workspace_id: wsId,
          payment_id: paymentId,
          processor_state: toState,
          gateway_name: gatewayName,
          external_ref: externalRef,
          fee_minor: feeMinor,
          currency: payCurrency,
          reason,
          updated_by: actorId,
          created_at: now,
          updated_at: now,
        })
      }

      events.push({
        id: `pge-${events.length + 1}`,
        workspace_id: wsId,
        payment_id: paymentId,
        from_state: current,
        to_state: toState,
        gateway_name: gatewayName,
        external_ref: externalRef,
        fee_minor: feeMinor,
        signature_verified: true,
        reason,
        actor_id: actorId,
        event_id: eventId,
        event_type: eventType,
        amount_minor: amountMinor,
        currency: payCurrency,
        payload_sha256: payloadSha256,
        processing_status: 'processed',
        delivery_attempts: 1,
        created_at: now,
      })

      return {
        workspaceId: wsId,
        paymentId,
        processorState: toState,
        externalRef,
        eventId,
        currency: payCurrency,
        signatureVerified: true,
        replay: false,
      }
    })

    this.rpc('create_project_change_order', (args: Row) => {
      const wsId = String(args.p_workspace_id)
      const projId = String(args.p_project_id)
      const actorId = String(args.p_actor_id)
      const title = String(args.p_title)
      const deltaMinor = Number(args.p_delta_minor)
      const estCostMinor = Number(args.p_estimated_cost_delta_minor ?? 0)
      const approved = args.p_approved === true
      const scale = Number(args.p_scale ?? 1)
      const idemKey = args.p_idempotency_key ? String(args.p_idempotency_key) : null
      const expectedVersion =
        args.p_expected_version !== undefined && args.p_expected_version !== null
          ? Number(args.p_expected_version)
          : null
      const reason = args.p_reason ? String(args.p_reason) : null

      if (![1, 10, 100, 1000].includes(scale)) throw new Error('INVALID_CURRENCY_SCALE')
      const orders = this.ensure('project_change_orders')
      if (idemKey) {
        const existing = orders.find(
          (o) => o.workspace_id === wsId && o.idempotency_key === idemKey,
        )
        if (existing) return existing
      }

      const proj = this.ensure('projects').find((p) => p.id === projId && p.workspace_id === wsId)
      if (!proj) throw new Error('PROJECT_NOT_FOUND')

      const curVer = Number(proj.budget_version ?? 1)
      if (expectedVersion !== null && curVer !== expectedVersion) {
        throw new Error('STALE_PROJECT_VERSION_CONFLICT')
      }

      const origMinor = Math.round(Number(proj.budget ?? 0) * scale)
      const revMinor = origMinor + deltaMinor
      if (revMinor < 0) throw new Error('REVISED_BUDGET_CANNOT_BE_NEGATIVE')

      const projWriteFail = this.writeFailures.get('projects')
      const orderWriteFail = this.writeFailures.get('project_change_orders')
      const auditWriteFail = this.writeFailures.get('audit_logs')
      if (projWriteFail && approved) throw new Error(projWriteFail.message)
      if (orderWriteFail) throw new Error(orderWriteFail.message)
      if (auditWriteFail) throw new Error(auditWriteFail.message)

      const now = new Date().toISOString()
      const newVer = approved ? curVer + 1 : curVer
      if (approved) {
        proj.budget = revMinor / scale
        proj.budget_version = newVer
        proj.updated_at = now
      }

      const created: Row = {
        id: fakeId('pco'),
        workspace_id: wsId,
        project_id: projId,
        title,
        original_budget_minor: origMinor,
        delta_minor: deltaMinor,
        revised_budget_minor: revMinor,
        estimated_cost_delta_minor: estCostMinor,
        net_margin_delta_minor: deltaMinor - estCostMinor,
        status: approved ? 'approved' : 'pending_approval',
        idempotency_key: idemKey,
        created_by: actorId,
        decided_by: approved ? actorId : null,
        decided_at: approved ? now : null,
        decision_reason: approved ? reason : null,
        project_version_at_decision: newVer,
        created_at: now,
        updated_at: now,
      }
      orders.push(created)

      this.ensure('audit_logs').push({
        id: fakeId('audit'),
        workspace_id: wsId,
        user_id: actorId,
        action: approved ? 'project.change_order.create_approved' : 'project.change_order.created',
        entity_type: 'project_change_order',
        entity_id: created.id,
        old_data: { budgetMinor: origMinor, version: curVer },
        new_data: { budgetMinor: revMinor, version: newVer, status: created.status },
        reason: reason ?? title,
        created_at: now,
      })

      return created
    })

    this.rpc('decide_project_change_order_v2', (args: Row) => {
      const wsId = String(args.p_workspace_id)
      const projId = String(args.p_project_id)
      const orderId = String(args.p_order_id)
      const decision = String(args.p_decision)
      const actorId = String(args.p_actor_id)
      const scale = Number(args.p_scale ?? 1)
      const expectedOrigMinor =
        args.p_expected_original_budget_minor !== undefined &&
        args.p_expected_original_budget_minor !== null
          ? Number(args.p_expected_original_budget_minor)
          : null
      const expectedVersion =
        args.p_expected_version !== undefined && args.p_expected_version !== null
          ? Number(args.p_expected_version)
          : null
      const reason = args.p_reason ? String(args.p_reason) : null

      if (decision !== 'approved' && decision !== 'rejected') throw new Error('INVALID_DECISION')
      if (![1, 10, 100, 1000].includes(scale)) throw new Error('INVALID_CURRENCY_SCALE')

      const proj = this.ensure('projects').find((p) => p.id === projId && p.workspace_id === wsId)
      if (!proj) throw new Error('PROJECT_NOT_FOUND')

      const curVer = Number(proj.budget_version ?? 1)
      if (expectedVersion !== null && curVer !== expectedVersion) {
        throw new Error('STALE_PROJECT_VERSION_CONFLICT')
      }

      const liveMinor = Math.round(Number(proj.budget ?? 0) * scale)
      if (expectedOrigMinor !== null && liveMinor !== expectedOrigMinor) {
        throw new Error('STALE_PROJECT_BUDGET_CONFLICT')
      }

      const order = this.ensure('project_change_orders').find(
        (o) => o.id === orderId && o.project_id === projId && o.workspace_id === wsId,
      )
      if (!order) throw new Error('CHANGE_ORDER_NOT_FOUND')
      if (order.status !== 'pending_approval') throw new Error('CHANGE_ORDER_NOT_PENDING')

      const deltaMinor = Number(order.delta_minor ?? 0)
      const revMinor = decision === 'approved' ? liveMinor + deltaMinor : liveMinor
      if (decision === 'approved' && revMinor < 0) {
        throw new Error('REVISED_BUDGET_CANNOT_BE_NEGATIVE')
      }

      const projWriteFail = this.writeFailures.get('projects')
      const orderWriteFail = this.writeFailures.get('project_change_orders')
      const auditWriteFail = this.writeFailures.get('audit_logs')
      if (projWriteFail && decision === 'approved') throw new Error(projWriteFail.message)
      if (orderWriteFail) throw new Error(orderWriteFail.message)
      if (auditWriteFail) throw new Error(auditWriteFail.message)

      const now = new Date().toISOString()
      const newVer = decision === 'approved' ? curVer + 1 : curVer
      if (decision === 'approved') {
        proj.budget = revMinor / scale
        proj.budget_version = newVer
        proj.updated_at = now
      }

      Object.assign(order, {
        status: decision,
        original_budget_minor: liveMinor,
        revised_budget_minor: revMinor,
        decided_by: actorId,
        decided_at: now,
        decision_reason: reason,
        project_version_at_decision: newVer,
        updated_at: now,
      })

      this.ensure('audit_logs').push({
        id: fakeId('audit'),
        workspace_id: wsId,
        user_id: actorId,
        action: `project.change_order.${decision}`,
        entity_type: 'project_change_order',
        entity_id: orderId,
        old_data: { budgetMinor: liveMinor, version: curVer, status: 'pending_approval' },
        new_data: { budgetMinor: revMinor, version: newVer, status: decision },
        reason,
        created_at: now,
      })

      return order
    })

    this.rpc('transition_support_ticket', (args: Row) => {
      const wsId = String(args.p_workspace_id)
      const ticketId = String(args.p_ticket_id)
      const actorId = String(args.p_actor_id)
      const nextStatus = String(args.p_next_status)
      const rcaSummary = args.p_rca_summary ? String(args.p_rca_summary) : null
      const reason = args.p_reason ? String(args.p_reason) : null
      const correlationId = args.p_correlation_id ? String(args.p_correlation_id) : null

      if (!['acknowledged', 'escalated', 'resolved', 'closed'].includes(nextStatus)) {
        throw new Error('INVALID_TICKET_STATUS')
      }

      const ticket = this.ensure('support_tickets').find(
        (t) => t.id === ticketId && t.workspace_id === wsId,
      )
      if (!ticket) throw new Error('TICKET_NOT_FOUND')

      const cur = String(ticket.status ?? 'open')
      const isReopen = (cur === 'resolved' || cur === 'closed') && nextStatus === 'acknowledged'
      if (isReopen && (!reason || !reason.trim())) throw new Error('REOPEN_REASON_REQUIRED')

      const transitions: Record<string, string[]> = {
        open: ['acknowledged', 'escalated', 'resolved'],
        acknowledged: ['escalated', 'resolved'],
        escalated: ['acknowledged', 'resolved'],
        resolved: ['closed', 'acknowledged'],
        closed: ['acknowledged'],
      }
      if (cur !== nextStatus && !(transitions[cur] ?? []).includes(nextStatus)) {
        throw new Error('INVALID_TICKET_TRANSITION')
      }

      const tFail = this.writeFailures.get('support_tickets')
      const evFail = this.writeFailures.get('support_ticket_events')
      if (tFail) throw new Error(tFail.message)
      if (evFail) throw new Error(evFail.message)

      const now = new Date().toISOString()
      Object.assign(ticket, {
        status: nextStatus,
        updated_at: now,
        ...(rcaSummary !== null ? { rca_summary: rcaSummary } : {}),
        ...(nextStatus === 'escalated'
          ? { escalated_at: now, escalation_level: Number(ticket.escalation_level ?? 0) + 1 }
          : {}),
        ...(nextStatus === 'resolved' ? { resolved_at: now } : {}),
        ...(nextStatus === 'closed' ? { closed_at: now } : {}),
        ...(isReopen ? { reopened_at: now } : {}),
      })

      const action = isReopen ? 'reopened' : nextStatus === 'closed' ? 'closed' : 'status_changed'
      this.ensure('support_ticket_events').push({
        id: fakeId('ste'),
        workspace_id: wsId,
        ticket_id: ticketId,
        actor_id: actorId,
        action,
        from_status: cur,
        to_status: nextStatus,
        note: reason ?? rcaSummary ?? null,
        correlation_id: correlationId,
        notification_status: 'not_applicable',
        created_at: now,
      })

      return ticket
    })

    this.rpc('add_support_ticket_comment', (args: Row) => {
      const wsId = String(args.p_workspace_id)
      const ticketId = String(args.p_ticket_id)
      const authorId = String(args.p_author_id)
      const isInternal = args.p_is_internal === true
      const body = String(args.p_body)
      const correlationId = args.p_correlation_id ? String(args.p_correlation_id) : null

      const ticket = this.ensure('support_tickets').find(
        (t) => t.id === ticketId && t.workspace_id === wsId,
      )
      if (!ticket) throw new Error('TICKET_NOT_FOUND')

      const cFail = this.writeFailures.get('support_ticket_comments')
      const evFail = this.writeFailures.get('support_ticket_events')
      if (cFail) throw new Error(cFail.message)
      if (evFail) throw new Error(evFail.message)

      const now = new Date().toISOString()
      const created: Row = {
        id: fakeId('stc'),
        workspace_id: wsId,
        ticket_id: ticketId,
        author_id: authorId,
        is_internal: isInternal,
        body,
        created_at: now,
      }
      this.ensure('support_ticket_comments').push(created)

      this.ensure('support_ticket_events').push({
        id: fakeId('ste'),
        workspace_id: wsId,
        ticket_id: ticketId,
        actor_id: authorId,
        action: 'comment_added',
        from_status: ticket.status,
        to_status: ticket.status,
        note: isInternal ? 'internal_note' : 'external_reply',
        correlation_id: correlationId,
        notification_status: 'not_applicable',
        created_at: now,
      })

      return created
    })

    this.rpc('sweep_support_ticket_slas', (args: Row) => {
      const wsFilter = args.p_workspace_id ? String(args.p_workspace_id) : null
      const actorId = args.p_actor_id ? String(args.p_actor_id) : null
      const correlationId = args.p_correlation_id ? String(args.p_correlation_id) : null

      const nowIso = new Date().toISOString()
      const nowMs = Date.now()
      const all = this.ensure('support_tickets').filter(
        (t) => !wsFilter || t.workspace_id === wsFilter,
      )
      const overdue = all.filter((t) => {
        const st = String(t.status ?? '')
        const dueMs = new Date(String(t.response_due_at ?? '')).getTime()
        return (st === 'open' || st === 'acknowledged') && Number.isFinite(dueMs) && dueMs < nowMs
      })

      const escalatedTicketIds: string[] = []
      let notificationFailures = 0

      for (const t of overdue) {
        const evFail = this.writeFailures.get('support_ticket_events')
        if (evFail) throw new Error(evFail.message)

        const prevStatus = String(t.status ?? 'open')
        Object.assign(t, {
          status: 'escalated',
          escalation_level: Number(t.escalation_level ?? 0) + 1,
          escalated_at: nowIso,
          updated_at: nowIso,
        })
        escalatedTicketIds.push(String(t.id))

        const actFail = this.writeFailures.get('activities')
        if (actFail) {
          notificationFailures += 1
        } else {
          this.ensure('activities').push({
            id: fakeId('act'),
            workspace_id: t.workspace_id,
            user_id: actorId ?? t.created_by,
            entity_type: 'support_ticket',
            entity_id: t.id,
            action: 'sla_breached',
            title: t.subject ? `SLA breach: ${String(t.subject)}` : 'Support ticket SLA breached',
            created_at: nowIso,
          })
        }

        this.ensure('support_ticket_events').push({
          id: fakeId('ste'),
          workspace_id: t.workspace_id,
          ticket_id: t.id,
          actor_id: actorId ?? t.created_by,
          action: 'sla_breached',
          from_status: prevStatus,
          to_status: 'escalated',
          note: `SLA due passed before ${nowIso}`,
          correlation_id: correlationId,
          notification_status: actFail ? 'failed' : 'pending',
          created_at: nowIso,
        })
      }

      return {
        evaluatedCount: all.length,
        escalatedTicketIds,
        notificationFailures,
        checkedAt: nowIso,
      }
    })
  }

  /**
   * PostgREST's `max-rows`. When set, every select returns at most this many
   * rows whatever `.limit()` asked for — silently, exactly like production.
   * `null` (the default) keeps the older suites unchanged.
   */
  maxRows: number | null = null

  /** Tables whose selects fail, so a test can prove an error is not swallowed. */
  readonly failures = new Map<string, { code?: string; message: string }>()

  fail(table: string, error: { code?: string; message: string }) {
    this.failures.set(table, error)
    return this
  }

  /** Tables whose writes fail, so tests can verify atomic rollback or downstream warning handling. */
  readonly writeFailures = new Map<string, { code?: string; message: string }>()

  failWrite(table: string, error: { code?: string; message: string }) {
    this.writeFailures.set(table, error)
    return this
  }

  /** Every query that ran, in order. Lets a test assert on tenant scoping. */
  readonly queries: Array<{ table: string; op: string; filters: string[] }> = []

  seed(table: string, rows: Row[]) {
    this.tables.set(table, [...(this.tables.get(table) ?? []), ...rows.map((row) => ({ ...row }))])
    return this
  }

  unique(table: string, columns: string[]) {
    this.uniques.push({ table, columns })
    return this
  }

  rpc(name: string, handler: (args: Row) => unknown) {
    this.rpcs.set(name, handler)
    return this
  }

  rows(table: string): Row[] {
    return this.tables.get(table) ?? []
  }

  private ensure(table: string): Row[] {
    let rows = this.tables.get(table)
    if (!rows) {
      rows = []
      this.tables.set(table, rows)
    }
    if (table === 'invoice_outstanding' && rows.length === 0) {
      const invoices = this.tables.get('invoices') ?? []
      return invoices.map((row) => ({
        invoice_id: row.id,
        workspace_id: row.workspace_id,
        invoice_number: row.invoice_number,
        total: row.total,
        allocated: row.paid_amount ?? 0,
        outstanding: (Number(row.total) || 0) - (Number(row.paid_amount) || 0),
        due_date: row.due_date,
        invoice_date: row.date,
        type: row.type,
        customer_id: row.customer_id,
        supplier_id: row.supplier_id,
        currency: row.currency,
      }))
    }
    return rows
  }

  /** The one entry point the services see. */
  from(table: string) {
    return new QueryBuilder(this, this.ensure(table), table)
  }

  /**
   * The real function answers. The fake's own handlers do not run: the mirror refreshes
   * the fake's rows from the real database after each change, so later reads see what
   * the function really wrote.
   */
  async callRpcMirrored(mirror: DatabaseMirror, name: string, args: Row): Promise<FakeResult> {
    return mirror.rpc(name, args ?? {})
  }

  callRpc(name: string, args: Row) {
    const handler = this.rpcs.get(name)
    if (!handler) {
      // The code real PostgREST returns for a function that does not exist, so
      // a service's «not installed yet» fallback behaves here as in production.
      return {
        data: null,
        error: { code: 'PGRST202', message: `RPC ${name} is not registered in the fake` },
      }
    }

    try {
      return { data: handler(args ?? {}), error: null }
    } catch (err) {
      // Services parse a SCREAMING_CASE code out of the message, exactly as
      // they do with a real `RAISE EXCEPTION`. Preserving that shape is what
      // makes the conflict paths testable at all.
      return { data: null, error: { message: (err as Error).message } }
    }
  }
}

let idCounter = 0

/**
 * A deterministic id in real UUID SHAPE.
 *
 * It has to be a valid uuid, not a readable label: the zod schemas on the
 * routes use `uuidSchema`, so an id like `account-00000001` is rejected at the
 * boundary and the test never reaches the code it is about — which looks
 * exactly like a validation bug in the service.
 *
 * The prefix survives as a hex-encoded tag in the first block, so a row is
 * still traceable to what created it while remaining a legal uuid.
 */
export function fakeId(prefix = 'row'): string {
  idCounter += 1

  const tag = [...prefix]
    .map((character) => character.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 8)
    .padEnd(8, '0')

  const counter = String(idCounter).padStart(12, '0')

  // Version 4 nibble and a valid variant, so anything that inspects the shape
  // rather than just the format still sees a well-formed uuid.
  return `${tag}-0000-4000-8000-${counter}`
}

class QueryBuilder implements PromiseLike<FakeResult> {
  private filters: Filter[] = []
  private describedFilters: string[] = []
  private orderSpecs: OrderSpec[] = []
  private limitCount: number | null = null
  private rangeFrom = 0
  private mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private payload: Row[] = []
  private conflictColumns: string[] | null = null
  private ignoreDuplicates = false
  private returning = false
  private singleMode: 'one' | 'maybe' | null = null
  private countMode: string | null = null
  private generatedIds: string[] = []

  constructor(
    private readonly db: FakeDatabase,
    private readonly store: Row[],
    private readonly table: string,
  ) {}

  // ─── Projection ───────────────────────────────────────────────────────────

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (this.mode === 'select') this.mode = 'select'
    else this.returning = true
    if (options?.count) this.countMode = options.count
    return this
  }

  // ─── Writes ───────────────────────────────────────────────────────────────

  insert(values: Row | Row[]) {
    this.mode = 'insert'
    this.payload = Array.isArray(values) ? values : [values]
    return this
  }

  upsert(values: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.mode = 'upsert'
    this.payload = Array.isArray(values) ? values : [values]
    this.conflictColumns = options?.onConflict
      ? options.onConflict.split(',').map((column) => column.trim())
      : null
    this.ignoreDuplicates = options?.ignoreDuplicates ?? false
    return this
  }

  update(values: Row) {
    this.mode = 'update'
    this.payload = [values]
    return this
  }

  delete() {
    this.mode = 'delete'
    return this
  }

  // ─── Filters ──────────────────────────────────────────────────────────────

  private push(description: string, filter: Filter) {
    this.describedFilters.push(description)
    this.filters.push(filter)
    return this
  }

  eq(column: string, value: unknown) {
    return this.push(`eq:${column}`, (row) => valueAt(row, column) === value)
  }

  neq(column: string, value: unknown) {
    return this.push(`neq:${column}`, (row) => valueAt(row, column) !== value)
  }

  gt(column: string, value: unknown) {
    return this.push(
      `gt:${column}`,
      (row) => (valueAt(row, column) as Comparable) > (value as Comparable),
    )
  }

  gte(column: string, value: unknown) {
    return this.push(
      `gte:${column}`,
      (row) => (valueAt(row, column) as Comparable) >= (value as Comparable),
    )
  }

  lt(column: string, value: unknown) {
    return this.push(
      `lt:${column}`,
      (row) => (valueAt(row, column) as Comparable) < (value as Comparable),
    )
  }

  lte(column: string, value: unknown) {
    return this.push(
      `lte:${column}`,
      (row) => (valueAt(row, column) as Comparable) <= (value as Comparable),
    )
  }

  /**
   * `is` is NOT `eq`.
   *
   * `.eq('deleted_at', null)` matches nothing in PostgREST, which is how
   * `listWarehouses` came to always return empty. The fake keeps the two
   * distinct so that bug would fail here too.
   */
  is(column: string, value: null | boolean) {
    return this.push(`is:${column}`, (row) =>
      value === null ? valueAt(row, column) == null : valueAt(row, column) === value,
    )
  }

  in(column: string, values: unknown[]) {
    const set = new Set(values)
    return this.push(`in:${column}`, (row) => set.has(valueAt(row, column)))
  }

  /**
   * PostgREST's `or`: top-level commas are OR branches, `and(...)` is one
   * branch that must satisfy all of its conditions, and a condition is
   * `col.op.value` — `eq`, `gt`/`gte`/`lt`/`lte` (compared as text, like the
   * window it was written for), `neq` (a status that is still open) or `is.null`. Anything else throws, so a new filter cannot
   * pass here by being silently ignored.
   */
  or(filter: string) {
    const parseCondition = (text: string): ((row: Record<string, unknown>) => boolean) => {
      const [column, operator, ...rest] = text.trim().split('.')
      const value = rest.join('.')
      if (operator === 'gte') return (row) => String(valueAt(row, column!) ?? '') >= value
      if (operator === 'gt') return (row) => String(valueAt(row, column!) ?? '') > value
      if (operator === 'lte') return (row) => String(valueAt(row, column!) ?? '') <= value
      if (operator === 'lt') return (row) => String(valueAt(row, column!) ?? '') < value
      if (operator === 'eq') {
        return (row) => {
          const cell = valueAt(row, column!)
          return cell != null && String(cell) === value
        }
      }
      if (operator === 'neq') {
        return (row) => {
          const cell = valueAt(row, column!)
          return cell != null && String(cell) !== value
        }
      }
      if (operator === 'is' && value === 'null') {
        return (row) => valueAt(row, column!) == null
      }
      throw new Error(`fake-supabase: .or(${text}) is not implemented`)
    }

    const branches: string[] = []
    let depth = 0
    let current = ''
    for (const char of filter) {
      if (char === '(') depth += 1
      if (char === ')') depth -= 1
      if (char === ',' && depth === 0) {
        branches.push(current)
        current = ''
        continue
      }
      current += char
    }
    if (current !== '') branches.push(current)

    const test = (row: Record<string, unknown>): boolean =>
      branches.some((branch) => {
        const group = /^and\((.*)\)$/.exec(branch.trim())
        if (group) return group[1]!.split(',').every((part) => parseCondition(part)(row))
        return parseCondition(branch)(row)
      })

    return this.push(`or:${filter}`, test)
  }

  not(column: string, operator: string, value: unknown) {
    if (operator === 'in') {
      // '("paid","cancelled")' → NOT IN; a NULL cell is not a match, as in SQL.
      const values = String(value)
        .replace(/^\(|\)$/g, '')
        .split(',')
        .map((item) => item.trim().replace(/^"|"$/g, ''))
      return this.push(`not.in:${column}`, (row) => {
        const cell = valueAt(row, column)
        return cell != null && !values.includes(String(cell))
      })
    }
    if (operator !== 'is') {
      throw new Error(`fake-supabase: .not(${operator}) is not implemented`)
    }
    return this.push(`not.is:${column}`, (row) =>
      value === null ? valueAt(row, column) != null : valueAt(row, column) !== value,
    )
  }

  like(column: string, pattern: string) {
    const regex = new RegExp(`^${pattern.replace(/%/g, '.*')}$`)
    return this.push(`like:${column}`, (row) => regex.test(String(valueAt(row, column) ?? '')))
  }

  ilike(column: string, pattern: string) {
    const regex = new RegExp(`^${pattern.replace(/%/g, '.*')}$`, 'i')
    return this.push(`ilike:${column}`, (row) => regex.test(String(valueAt(row, column) ?? '')))
  }

  // ─── Shaping ──────────────────────────────────────────────────────────────

  order(column: string, options?: { ascending?: boolean }) {
    this.orderSpecs.push({ column, ascending: options?.ascending ?? true })
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  /** supabase-js `.returns<T>()` only re-types the result; it never changes rows. */
  returns() {
    return this
  }

  range(from: number, to: number) {
    this.rangeFrom = from
    this.limitCount = to - from + 1
    return this
  }

  maybeSingle() {
    this.singleMode = 'maybe'
    return this
  }

  // ─── Execution ────────────────────────────────────────────────────────────

  private matching(): Row[] {
    return this.store.filter((row) => this.filters.every((filter) => filter(row)))
  }

  private conflictKey(row: Row, columns: string[]): string {
    return columns.map((column) => String(row[column])).join(' ')
  }

  private run(): FakeResult {
    this.db.queries.push({
      table: this.table,
      op: this.mode,
      filters: [...this.describedFilters],
    })

    let result: Row[] = []

    if (this.mode === 'select') {
      const failure = this.db.failures.get(this.table)
      if (failure) return { data: null, error: failure }

      result = this.matching()

      if (this.orderSpecs.length > 0) {
        result = [...result].sort((a, b) => {
          for (const { column, ascending } of this.orderSpecs) {
            const left = valueAt(a, column) as Comparable
            const right = valueAt(b, column) as Comparable
            if (left === right) continue
            return (left > right ? 1 : -1) * (ascending ? 1 : -1)
          }
          return 0
        })
      }

      const cap = [this.limitCount, this.db.maxRows].filter((n): n is number => n != null)
      const count = cap.length > 0 ? Math.min(...cap) : result.length
      result = result.slice(this.rangeFrom, this.rangeFrom + count)
    }

    if (this.mode === 'insert' || this.mode === 'upsert') {
      const writeFailure = this.db.writeFailures.get(this.table)
      if (writeFailure) return { data: null, error: writeFailure }

      const written: Row[] = []

      for (const value of this.payload) {
        const row: Row = { id: value.id ?? fakeId(this.table), ...value }
        if (value.id === undefined) this.generatedIds.push(String(row.id))

        const columns =
          this.conflictColumns ??
          this.db.uniques.find((index) => index.table === this.table)?.columns ??
          null

        if (columns) {
          const key = this.conflictKey(row, columns)
          const existing = this.store.find(
            (candidate) => this.conflictKey(candidate, columns) === key,
          )

          if (existing) {
            if (this.mode === 'insert') {
              // A real unique violation, with the code services look for.
              return {
                data: null,
                error: { code: '23505', message: `duplicate key value violates unique constraint` },
              }
            }

            if (!this.ignoreDuplicates) Object.assign(existing, value)
            written.push(existing)
            continue
          }
        }

        this.store.push(row)
        written.push(row)
      }

      result = written
    }

    if (this.mode === 'update') {
      const writeFailure = this.db.writeFailures.get(this.table)
      if (writeFailure) return { data: null, error: writeFailure }

      const target = this.matching()
      for (const row of target) Object.assign(row, this.payload[0])
      result = target
    }

    if (this.mode === 'delete') {
      const target = this.matching()
      for (const row of target) {
        const index = this.store.indexOf(row)
        if (index >= 0) this.store.splice(index, 1)
      }
      result = target
    }

    const data = result.map((row) => ({ ...row }))

    if (this.singleMode === 'maybe') {
      return { data: data[0] ?? null, error: null, count: data.length }
    }

    if (this.singleMode === 'one') {
      if (data.length !== 1) {
        return {
          data: null,
          // PGRST116 is what PostgREST returns when `.single()` matches none.
          error: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
          },
        }
      }
      return { data: data[0], error: null }
    }

    return { data, error: null, count: this.countMode ? data.length : undefined }
  }

  /** Run on the fake; with a mirror, a write then runs on the real database and its error wins. */
  private async settle(): Promise<FakeResult> {
    const result = this.run()
    const mirror = this.db.mirror
    if (!mirror || this.mode === 'select' || result.error) return result
    const rows = Array.isArray(result.data)
      ? (result.data as Row[])
      : result.data
        ? [result.data as Row]
        : []
    const error = await mirror.write({
      kind: this.mode,
      table: this.table,
      rows,
      generatedIds: this.generatedIds,
      values: this.mode === 'update' ? this.payload[0] : undefined,
      conflict: this.conflictColumns,
      ignoreDuplicates: this.ignoreDuplicates,
    })
    return error ? { data: null, error } : result
  }

  /** Both a modifier and a terminator: it resolves immediately. */
  async single() {
    this.singleMode = 'one'
    return this.db.mirror ? this.settle() : this.run()
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    try {
      return (this.db.mirror ? this.settle() : Promise.resolve(this.run())).then(
        onfulfilled,
        onrejected,
      )
    } catch (err) {
      return Promise.reject(err).then(onfulfilled, onrejected)
    }
  }
}

/** The module shape `src/db.ts` exports, backed by the fake. */
export function createFakeDb(db: FakeDatabase, users: Map<string, { id: string; email?: string }>) {
  const supabase = {
    auth: {
      getUser: async (token: string) => {
        const user = users.get(token)
        return user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: { message: 'invalid token' } }
      },
    },
    from: (table: string) => db.from(table),
    rpc: async (name: string, args: Row) =>
      db.mirror ? db.callRpcMirrored(db.mirror, name, args) : db.callRpc(name, args),
  }

  return {
    supabase,
    default: supabase,
    checkDatabaseConnection: async () => true,
    dbStats: { queries: 0, errors: 0 },
    withConnection: async <T>(fn: () => Promise<T>) => fn(),
  }
}
