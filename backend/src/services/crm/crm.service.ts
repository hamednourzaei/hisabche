// ============================================
// backend/src/services/crm/crm.service.ts
//
// CRM Core — orchestration. Rules live in crm.domain.ts, tables in
// crm.repository.ts. Other Cores and pages use CRM through crm.port.ts.
//
// ⚠️ CACHE. The old service cached lists in `memoryCache` under
// `crm:interactions:<workspace>:…` while status/outcome changes invalidated
// `crm:interactions:<USER id>` — so a task list kept showing the old status —
// and the routes then cleared `interactions:*` for EVERY workspace. There is now
// one layer (the route cache) and one invalidation, scoped to the workspace
// that owns the row, including changes made through a public task link.
// ============================================

import type { CreateInteraction, CreateOpportunity, UpdateOpportunity } from '@hisabche/validation'

import { NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { cacheService } from '../cache.service'
import { logBusinessEvent } from '../event-log.service'
import { NotificationService } from '../notification.service'
import type { TenancyContext } from '../tenancy.service'
import {
  CrmRuleError,
  appendStatus,
  concernsCustomer,
  distinctSubjects,
  isOpenStage,
  recordOutcome,
  summarizeCustomerCrm,
  toInteraction,
  toOpportunity,
  type CustomerCrmSummary,
  type CustomerOutcome,
  type Interaction,
  type InteractionStatus,
  type Opportunity,
  type StatusChange,
} from './crm.domain'
import { CrmRepository, type TaskLookup } from './crm.repository'

const notificationService = new NotificationService()

/** What a status is called in the notification the person actually reads. */
const STATUS_LABEL: Record<string, string> = {
  pending: 'در حال انتظار',
  in_progress: 'در حال انجام',
  completed: 'کامل شد',
}
/** Route-cache prefixes (cacheMiddleware keyPrefix) holding CRM responses. */
export const CRM_CACHE_PREFIXES = ['interactions', 'opportunities', 'crm'] as const

export class CrmService {
  constructor(private readonly repo: CrmRepository = new CrmRepository()) {}

  private async invalidate(workspaceId: string) {
    await Promise.all(
      CRM_CACHE_PREFIXES.map((prefix) => cacheService.delPattern(`${prefix}:${workspaceId}:*`)),
    )
  }

  /** Domain refusals keep the status codes the API always returned. */
  private rethrow(error: unknown): never {
    if (error instanceof CrmRuleError) {
      if (error.code === 'CRM_OUTCOME_CUSTOMER_NOT_ON_TASK') {
        throw new NotFoundError('Customer on this task')
      }
      throw new ValidationError(error.code)
    }
    throw error
  }

  // ─── Interactions (tasks) ─────────────────────────────────────────────────

  async listInteractions(
    ctx: TenancyContext,
    customerId?: string,
    options?: { limit?: number; page?: number },
  ) {
    const limit = Math.min(options?.limit || 50, 100)
    const page = options?.page || 1
    const { rows, total } = await this.repo.listInteractions(ctx.workspaceId, {
      customerId,
      offset: (page - 1) * limit,
      limit,
    })
    return {
      interactions: rows.map(toInteraction),
      total,
      page,
      limit,
      totalPages: total ? Math.ceil(total / limit) : 0,
    }
  }

  async createInteraction(ctx: TenancyContext, data: CreateInteraction): Promise<Interaction> {
    const customerIds =
      data.customerIds && data.customerIds.length > 0 ? data.customerIds : [data.customerId]
    const customers = await this.repo.customerSnapshot(ctx.workspaceId, customerIds.filter(Boolean))
    const snapshot = customers.map((c) => ({ id: c.id, name: c.full_name, phone: c.phone ?? null }))

    const now = new Date().toISOString()
    const base = {
      customer_id: data.customerId,
      type: data.type,
      subject: data.subject || '',
      content: data.content || '',
      interaction_date: data.interactionDate || now,
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
    }
    const row = await this.repo.insertInteraction(
      {
        ...base,
        status: 'pending',
        employee_id: data.employeeId || null,
        employee_name: data.employeeName || null,
        customers_snapshot: snapshot,
        status_history: appendStatus([], 'pending', 'owner', now),
      },
      base,
    )
    await this.invalidate(ctx.workspaceId)

    // «زمانی که این وظیفه جدید ثبت شد، برای هر کارمند به اون کارمند
    // نوتیفیکیشن بره که تسک جدید داره» (request #98-ج).
    if (data.employeeId) {
      await this.notifyEmployee(ctx.workspaceId, data.employeeId, {
        title: `وظیفه جدید: ${data.subject || ''}`.trim(),
        body: snapshot.length > 0 ? `${snapshot.length} مشتری` : null,
        entityId: row.id as string,
      })
    }

    return toInteraction(row)
  }

  async updateInteractionStatus(
    ctx: TenancyContext,
    id: string,
    status: InteractionStatus,
    changedBy = 'owner',
    assignee?: { employeeId: string; employeeName?: string | undefined } | undefined,
  ): Promise<Interaction> {
    return this.changeStatus({ id, workspaceId: ctx.workspaceId }, status, changedBy, assignee)
  }

  /**
   * ⚠️ By `public_token` (an unguessable uuid), never by id — looking up by id
   * would let anyone enumerate every task.
   */
  async getPublicTaskByToken(token: string): Promise<Interaction> {
    const row = await this.repo.findPublicTask(token)
    if (!row) throw new NotFoundError('Task')
    return toInteraction(row)
  }

  /** The assigned employee, no login: only this one task's status. */
  async updatePublicTaskStatus(token: string, status: 'in_progress' | 'completed') {
    return this.changeStatus({ publicToken: token }, status, 'employee')
  }

  async recordCustomerOutcome(
    lookup: TaskLookup,
    input: { customerId: string; outcome: 'done' | 'failed'; note?: string | undefined },
    recordedBy: 'owner' | 'employee',
  ): Promise<Interaction> {
    const task = await this.repo.findTask(lookup, 'customers_snapshot, customer_outcomes')
    if (!task) throw new NotFoundError('Task')
    try {
      const next = recordOutcome(
        Array.isArray(task.customers_snapshot) ? task.customers_snapshot : [],
        (Array.isArray(task.customer_outcomes) ? task.customer_outcomes : []) as CustomerOutcome[],
        input,
        recordedBy,
        new Date().toISOString(),
      )
      const row = await this.repo.updateTask(task.id, task.workspace_id, {
        customer_outcomes: next,
      })
      await this.invalidate(task.workspace_id)
      return toInteraction(row)
    } catch (error) {
      this.rethrow(error)
    }
  }

  async listSubjectSuggestions(ctx: TenancyContext, limit = 20): Promise<string[]> {
    return distinctSubjects(await this.repo.recentSubjects(ctx.workspaceId), limit)
  }

  private async changeStatus(
    lookup: TaskLookup,
    status: InteractionStatus,
    changedBy: string,
    assignee?: { employeeId: string; employeeName?: string | undefined } | undefined,
  ) {
    // `user_id` is the owner who created the task, `employee_id` the person it
    // was given to — both are needed to say who hears about this change.
    const task = await this.repo.findTask(
      lookup,
      'status_history, user_id, employee_id, subject, status',
    )
    if (!task) throw new NotFoundError('Task')
    const history = (
      Array.isArray(task.status_history) ? task.status_history : []
    ) as StatusChange[]
    const row = await this.repo.updateTask(task.id, task.workspace_id, {
      status,
      status_history: appendStatus(history, status, changedBy, new Date().toISOString()),
      // Reassignment travels with the status so the two can never disagree.
      ...(assignee
        ? {
            employee_id: assignee.employeeId,
            ...(assignee.employeeName ? { employee_name: assignee.employeeName } : {}),
          }
        : {}),
    })
    // The workspace comes from the row, so a change through a public link
    // clears the owner's cached list too.
    await this.invalidate(task.workspace_id)
    // The NEW owner of the task is the one who needs telling, not the old one.
    await this.notifyStatusChange(
      assignee ? { ...task, employee_id: assignee.employeeId } : task,
      status,
      changedBy,
    )
    return toInteraction(row)
  }

  /**
   * ⚠️ A NOTIFICATION MUST NOT BE ABLE TO UNDO THE WRITE.
   *
   * The status change has already been saved by the time these run. If the
   * notification insert fails — a row with no account behind it, a transient
   * error — the caller must still get their success, so the failure is logged
   * and swallowed here rather than thrown back over a change that did happen.
   */
  private async notifyEmployee(
    workspaceId: string,
    employeeId: string,
    input: { title: string; body: string | null; entityId: string },
  ) {
    try {
      const { userId } = await this.repo.employeeAccount(workspaceId, employeeId)
      // No account = no inbox. The employee works through the public link and
      // is told about the task by that link, not by a notification nobody
      // could ever read.
      if (!userId) return
      await notificationService.create(workspaceId, {
        user_id: userId,
        title: input.title,
        ...(input.body ? { body: input.body } : {}),
        type: 'info',
        entity_type: 'interaction',
        entity_id: input.entityId,
      })
    } catch (error) {
      console.error('[CrmService] task notification failed:', error)
    }
  }

  /**
   * «مثلا کارمند تسک رو از در حال انتظار کرد در حال انجام، به مالک نوتیف بره؛
   * بعد شد انجام شده، به مالک دوباره نوتیف بره» (request #98-ج).
   *
   * Symmetric: a change the OWNER makes is told to the employee instead, so
   * neither side learns about the task's state by going and looking.
   */
  private async notifyStatusChange(
    task: Record<string, unknown>,
    status: InteractionStatus,
    changedBy: string,
  ) {
    const workspaceId = task.workspace_id as string
    const subject = (task.subject as string) || ''
    const label = STATUS_LABEL[status] ?? status

    if (changedBy === 'employee') {
      const ownerId = task.user_id as string | null
      if (!ownerId) return
      try {
        await notificationService.create(workspaceId, {
          user_id: ownerId,
          title: `وضعیت وظیفه «${subject}» شد: ${label}`,
          type: status === 'completed' ? 'success' : 'info',
          entity_type: 'interaction',
          entity_id: task.id as string,
        })
      } catch (error) {
        console.error('[CrmService] owner notification failed:', error)
      }
      return
    }

    const employeeId = task.employee_id as string | null
    if (!employeeId) return
    await this.notifyEmployee(workspaceId, employeeId, {
      title: `وضعیت وظیفه «${subject}» شد: ${label}`,
      body: null,
      entityId: task.id as string,
    })
  }

  // ─── Opportunities ────────────────────────────────────────────────────────

  async listOpportunities(
    ctx: TenancyContext,
    customerId?: string,
    options?: { limit?: number; page?: number },
  ) {
    const limit = Math.min(options?.limit || 50, 100)
    const page = options?.page || 1
    const { rows, total } = await this.repo.listOpportunities(ctx.workspaceId, {
      customerId,
      offset: (page - 1) * limit,
      limit,
    })
    return {
      opportunities: rows.map(toOpportunity),
      total,
      page,
      limit,
      totalPages: total ? Math.ceil(total / limit) : 0,
    }
  }

  async createOpportunity(ctx: TenancyContext, data: CreateOpportunity): Promise<Opportunity> {
    const row = await this.repo.insertOpportunity({
      customer_id: data.customerId,
      title: data.title,
      description: data.description || '',
      stage: data.stage || 'lead',
      value: data.value || 0,
      expected_close_date: data.expectedCloseDate || null,
      probability: data.probability || 0,
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
    })
    await this.invalidate(ctx.workspaceId)
    const opportunity = toOpportunity(row)

    logBusinessEvent({
      userId: ctx.userId,
      entityType: 'opportunity',
      entityId: opportunity.id,
      action: 'created',
      title: `فرصت فروش جدید: ${opportunity.title}`,
      notify: false,
    }).catch((err) => console.error('[CrmService] logBusinessEvent failed:', err))

    return opportunity
  }

  async updateOpportunity(
    ctx: TenancyContext,
    id: string,
    data: UpdateOpportunity,
  ): Promise<Opportunity> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.title !== undefined) patch.title = data.title
    if (data.description !== undefined) patch.description = data.description
    if (data.stage !== undefined) patch.stage = data.stage
    if (data.value !== undefined) patch.value = data.value
    if (data.expectedCloseDate !== undefined) patch.expected_close_date = data.expectedCloseDate
    if (data.probability !== undefined) patch.probability = data.probability

    const row = await this.repo.updateOpportunity(ctx.workspaceId, id, patch)
    if (!row) throw new NotFoundError('Opportunity')
    await this.invalidate(ctx.workspaceId)
    const opportunity = toOpportunity(row)

    if (data.stage === 'won' || data.stage === 'lost') {
      logBusinessEvent({
        userId: ctx.userId,
        entityType: 'opportunity',
        entityId: opportunity.id,
        action: 'stage_changed',
        title:
          data.stage === 'won'
            ? `فرصت فروش «${opportunity.title}» برنده شد 🎉`
            : `فرصت فروش «${opportunity.title}» از دست رفت`,
        notifyType: data.stage === 'won' ? 'success' : 'warning',
        actionUrl: '/crm',
      }).catch((err) => console.error('[CrmService] logBusinessEvent failed:', err))
    }

    return opportunity
  }

  // ─── Pipeline activity (CrmPort) ──────────────────────────────────────────

  /**
   * Open opportunities with when they were last worked on. Closed deals (won /
   * lost) are not «stale»: the forecast used to list them among the neglected.
   */
  async listOpenOpportunityActivity(ctx: TenancyContext) {
    const rows = await this.repo.opportunityActivity(ctx.workspaceId)
    return rows.filter((row) => isOpenStage(row.stage))
  }

  // ─── Customer view (CrmPort) ──────────────────────────────────────────────

  /** Every task and opportunity for one customer, and what they add up to. */
  async getCustomerCrm(
    ctx: TenancyContext,
    customerId: string,
  ): Promise<{
    summary: CustomerCrmSummary
    interactions: Interaction[]
    opportunities: Opportunity[]
  }> {
    const [interactionRows, opportunityRows] = await Promise.all([
      this.repo.interactionsForCustomer(ctx.workspaceId, customerId),
      this.repo.opportunitiesForCustomer(ctx.workspaceId, customerId),
    ])
    const interactions = interactionRows
      .map(toInteraction)
      .filter((interaction) => concernsCustomer(interaction, customerId))
      .sort((a, b) =>
        String(b.interactionDate ?? '').localeCompare(String(a.interactionDate ?? '')),
      )
    const opportunities = opportunityRows.map(toOpportunity)
    return {
      summary: summarizeCustomerCrm(interactions, opportunities),
      interactions,
      opportunities,
    }
  }
}
