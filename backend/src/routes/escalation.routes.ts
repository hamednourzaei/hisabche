// ============================================
// backend/src/routes/escalation.routes.ts
//
// Capability #68 — the escalation policy of a workflow, and what escalation did.
//
//   reads    any member — the same as the approvals themselves
//   writes   manager and up. There is no workflow capability in the
//            authorization model yet (the workflow routes check membership
//            only), so the role is checked directly: deciding who ELSE may
//            approve is not something a seller sets for their own documents.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireRole } from '../services/tenancy.service'
import { escalationService } from '../services/workflow/escalation.service'

const idParams = z.object({ id: z.string().uuid() })

/** `afterHours: null` switches escalation off; then the role is not needed. */
const policySchema = z.object({
  afterHours: z
    .number()
    .positive()
    .max(24 * 90)
    .nullable(),
  toRole: z.enum(['manager', 'owner']).nullable(),
  maxTimes: z.number().int().min(1).max(5).default(1),
})

function fail(fastify: FastifyInstance, reply: FastifyReply, err: unknown, fallback: string) {
  if (err instanceof z.ZodError) {
    return reply.code(400).send({
      error: 'Bad Request',
      message: err.errors[0]?.message ?? 'Validation failed',
      details: err.errors.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    })
  }
  if (err instanceof BaseError && (err.statusCode < 500 || err.statusCode === 503)) {
    return reply.code(err.statusCode).send({ error: err.name, message: err.message })
  }
  fastify.log.error(err)
  return reply.code(500).send({ error: 'Internal Server Error', message: fallback })
}

export async function escalationRoutes(fastify: FastifyInstance) {
  const READ = [authenticate, requireWorkspaceContext]
  const MANAGER_WRITE = [authenticate, requireWorkspaceContext]

  fastify.get(
    '/api/v1/workflows/:id/escalation',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        return reply.send(await escalationService.getPolicy(request.tenancy, id))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read the escalation policy')
      }
    },
  )

  fastify.put(
    '/api/v1/workflows/:id/escalation',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('workflow.manage')] },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        requireRole(request.tenancy, 'manager')
        const input = policySchema.parse(request.body)
        return reply.send(await escalationService.setPolicy(request.tenancy, id, input))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to save the escalation policy')
      }
    },
  )

  fastify.get(
    '/api/v1/workflow-escalations',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        return reply.send({ escalations: await escalationService.recent(request.tenancy) })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read escalations')
      }
    },
  )

  // X08: Customer-facing support / incident SLA ticket lifecycle (persistent, workspace-scoped)
  fastify.get(
    '/api/v1/support-tickets',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const { supabase } = await import('../db')
        const { data, error } = await supabase
          .from('support_tickets')
          .select('*')
          .eq('workspace_id', request.tenancy.workspaceId)
          .order('created_at', { ascending: false })
        if (error) throw error
        const nowMs = Date.now()
        const enriched = (data ?? []).map((row: Record<string, unknown>) => {
          const status = String(row.status ?? '')
          const dueMs = new Date(String(row.response_due_at ?? '')).getTime()
          const slaBreached =
            status !== 'resolved' && status !== 'closed' && Number.isFinite(dueMs) && nowMs > dueMs
          return { ...row, slaBreached }
        })
        return reply.send({ data: enriched })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to list support tickets')
      }
    },
  )

  fastify.post(
    '/api/v1/support-tickets',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const body = z
          .object({
            subject: z.string().trim().min(3).max(160),
            priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
            category: z.enum(['billing', 'sync', 'accounting', 'pos', 'other']).default('other'),
            description: z.string().trim().min(5).max(2000),
          })
          .strict()
          .parse(request.body)
        const { supabase } = await import('../db')
        const { readClientRequestId } = await import('../utils/client-request')
        const idemKey = readClientRequestId(request)
        if (idemKey) {
          const { data: existing } = await supabase
            .from('support_tickets')
            .select('*')
            .eq('workspace_id', request.tenancy.workspaceId)
            .eq('idempotency_key', idemKey)
            .maybeSingle()
          if (existing) return reply.code(200).send({ data: existing, replay: true })
        }

        const slaHoursByPriority = { critical: 2, high: 4, normal: 24, low: 48 } as const
        const slaHours = slaHoursByPriority[body.priority]
        const responseDueAt = new Date(Date.now() + slaHours * 3600_000).toISOString()
        const ticketCode = `HSB-${Date.now().toString(36).toUpperCase()}`
        const { data: created, error } = await supabase
          .from('support_tickets')
          .insert({
            workspace_id: request.tenancy.workspaceId,
            ticket_code: ticketCode,
            subject: body.subject,
            priority: body.priority,
            category: body.category,
            description: body.description,
            sla_hours: slaHours,
            response_due_at: responseDueAt,
            status: 'open',
            escalation_level: 0,
            idempotency_key: idemKey ?? null,
            created_by: request.tenancy.userId,
          })
          .select()
          .single()
        if (error) throw error

        const createdId = String((created as { id?: unknown })?.id ?? '')
        if (createdId) {
          const { error: evErr } = await supabase.from('support_ticket_events').insert({
            workspace_id: request.tenancy.workspaceId,
            ticket_id: createdId,
            actor_id: request.tenancy.userId,
            action: 'created',
            from_status: null,
            to_status: 'open',
            note: body.priority,
          })
          if (evErr) throw evErr
        }

        return reply.code(201).send({
          data: {
            ...created,
            ticketCode,
            workspaceId: request.tenancy.workspaceId,
            priority: body.priority,
            category: body.category,
            slaHours,
            responseDueAt,
            status: 'open',
          },
        })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to create support ticket')
      }
    },
  )

  const SUPPORT_TICKET_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
    open: ['acknowledged', 'escalated', 'resolved'],
    acknowledged: ['escalated', 'resolved'],
    escalated: ['acknowledged', 'resolved'],
    resolved: ['closed', 'acknowledged'],
    closed: ['acknowledged'],
  }

  fastify.patch(
    '/api/v1/support-tickets/:id/status',
    { preHandler: MANAGER_WRITE },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        const body = z
          .object({
            status: z.enum(['acknowledged', 'escalated', 'resolved', 'closed']),
            rcaSummary: z.string().trim().max(2000).optional(),
            reason: z.string().trim().min(3).max(500).optional(),
          })
          .strict()
          .parse(request.body)
        const { supabase } = await import('../db')
        const { ConflictError } = await import('../errors/database.error')

        const { data: existing, error: exErr } = await supabase
          .from('support_tickets')
          .select('*')
          .eq('id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .maybeSingle()
        if (exErr) throw exErr
        if (!existing)
          return reply.code(404).send({ error: 'TICKET_NOT_FOUND', code: 'TICKET_NOT_FOUND' })

        const currentStatus = String((existing as { status?: unknown }).status ?? 'open')
        const isReopen =
          (currentStatus === 'resolved' || currentStatus === 'closed') &&
          body.status === 'acknowledged'
        if (isReopen && !body.reason) {
          return reply
            .code(400)
            .send({ error: 'REOPEN_REASON_REQUIRED', code: 'REOPEN_REASON_REQUIRED' })
        }
        if (
          currentStatus !== body.status &&
          !(SUPPORT_TICKET_TRANSITIONS[currentStatus] ?? []).includes(body.status)
        ) {
          throw new ConflictError(
            `Cannot transition support ticket from ${currentStatus} to ${body.status}`,
          )
        }

        const now = new Date().toISOString()
        const currentEscalation = Number(
          (existing as { escalation_level?: unknown }).escalation_level ?? 0,
        )
        const patch: Record<string, unknown> = {
          status: body.status,
          updated_at: now,
          ...(body.rcaSummary !== undefined ? { rca_summary: body.rcaSummary } : {}),
          ...(body.status === 'escalated'
            ? { escalated_at: now, escalation_level: currentEscalation + 1 }
            : {}),
          ...(body.status === 'resolved' ? { resolved_at: now } : {}),
          ...(body.status === 'closed' ? { closed_at: now } : {}),
          ...(isReopen ? { reopened_at: now } : {}),
        }
        const { data: updated, error } = await supabase
          .from('support_tickets')
          .update(patch)
          .eq('id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .select()
          .maybeSingle()
        if (error) throw error
        if (!updated)
          return reply.code(404).send({ error: 'TICKET_NOT_FOUND', code: 'TICKET_NOT_FOUND' })

        const action = isReopen
          ? 'reopened'
          : body.status === 'closed'
            ? 'closed'
            : 'status_changed'
        const { error: evErr } = await supabase.from('support_ticket_events').insert({
          workspace_id: request.tenancy.workspaceId,
          ticket_id: id,
          actor_id: request.tenancy.userId,
          action,
          from_status: currentStatus,
          to_status: body.status,
          note: body.reason ?? body.rcaSummary ?? null,
        })
        if (evErr) throw evErr

        return reply.send({ data: updated })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to update support ticket')
      }
    },
  )

  fastify.post(
    '/api/v1/support-tickets/:id/assign',
    { preHandler: MANAGER_WRITE },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = idParams.parse(request.params)
        const { assigneeId } = z
          .object({ assigneeId: z.string().uuid().nullable() })
          .strict()
          .parse(request.body)
        const { supabase } = await import('../db')

        if (assigneeId) {
          const { data: member, error: memErr } = await supabase
            .from('workspace_members')
            .select('user_id')
            .eq('workspace_id', request.tenancy.workspaceId)
            .eq('user_id', assigneeId)
            .eq('has_access', true)
            .is('suspended_at', null)
            .maybeSingle()
          if (memErr) throw memErr
          if (!member) {
            return reply
              .code(404)
              .send({ error: 'ASSIGNEE_NOT_WORKSPACE_MEMBER', code: 'ASSIGNEE_NOT_FOUND' })
          }
        }

        const now = new Date().toISOString()
        const { data: updated, error } = await supabase
          .from('support_tickets')
          .update({ assigned_to: assigneeId, updated_at: now })
          .eq('id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .select()
          .maybeSingle()
        if (error) throw error
        if (!updated)
          return reply.code(404).send({ error: 'TICKET_NOT_FOUND', code: 'TICKET_NOT_FOUND' })

        const { error: evErr } = await supabase.from('support_ticket_events').insert({
          workspace_id: request.tenancy.workspaceId,
          ticket_id: id,
          actor_id: request.tenancy.userId,
          action: 'assigned',
          from_status: String((updated as { status?: unknown }).status ?? 'open'),
          to_status: String((updated as { status?: unknown }).status ?? 'open'),
          note: assigneeId,
        })
        if (evErr) throw evErr

        return reply.send({ data: updated })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to assign support ticket')
      }
    },
  )

  fastify.get(
    '/api/v1/support-tickets/:id/events',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        const { supabase } = await import('../db')
        const { data: ticket, error: tErr } = await supabase
          .from('support_tickets')
          .select('id')
          .eq('id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .maybeSingle()
        if (tErr) throw tErr
        if (!ticket)
          return reply.code(404).send({ error: 'TICKET_NOT_FOUND', code: 'TICKET_NOT_FOUND' })

        const { data, error } = await supabase
          .from('support_ticket_events')
          .select('*')
          .eq('ticket_id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .order('created_at', { ascending: true })
        if (error) throw error
        return reply.send({ data: data ?? [] })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read support ticket events')
      }
    },
  )

  fastify.get(
    '/api/v1/support-tickets/:id/comments',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        const { supabase } = await import('../db')
        const { data: ticket, error: tErr } = await supabase
          .from('support_tickets')
          .select('id')
          .eq('id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .maybeSingle()
        if (tErr) throw tErr
        if (!ticket)
          return reply.code(404).send({ error: 'TICKET_NOT_FOUND', code: 'TICKET_NOT_FOUND' })

        const { data, error } = await supabase
          .from('support_ticket_comments')
          .select('*')
          .eq('ticket_id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .order('created_at', { ascending: true })
        if (error) throw error

        const canViewInternal =
          request.tenancy.role === 'owner' || request.tenancy.role === 'manager'
        const rows = (data ?? []).filter(
          (c: Record<string, unknown>) => canViewInternal || c.is_internal !== true,
        )
        return reply.send({ data: rows })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read support ticket comments')
      }
    },
  )

  fastify.post(
    '/api/v1/support-tickets/:id/comments',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        const body = z
          .object({
            body: z.string().trim().min(1).max(2000),
            isInternal: z.boolean().default(false),
          })
          .strict()
          .parse(request.body)
        if (body.isInternal) requireRole(request.tenancy, 'manager')

        const { supabase } = await import('../db')
        const { data: ticket, error: tErr } = await supabase
          .from('support_tickets')
          .select('id, status')
          .eq('id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .maybeSingle()
        if (tErr) throw tErr
        if (!ticket)
          return reply.code(404).send({ error: 'TICKET_NOT_FOUND', code: 'TICKET_NOT_FOUND' })

        const { data: created, error } = await supabase
          .from('support_ticket_comments')
          .insert({
            workspace_id: request.tenancy.workspaceId,
            ticket_id: id,
            author_id: request.tenancy.userId,
            is_internal: body.isInternal,
            body: body.body,
          })
          .select()
          .single()
        if (error) throw error

        const { error: evErr } = await supabase.from('support_ticket_events').insert({
          workspace_id: request.tenancy.workspaceId,
          ticket_id: id,
          actor_id: request.tenancy.userId,
          action: 'comment_added',
          from_status: String((ticket as { status?: unknown }).status ?? 'open'),
          to_status: String((ticket as { status?: unknown }).status ?? 'open'),
          note: body.isInternal ? 'internal_note' : 'external_reply',
        })
        if (evErr) throw evErr

        return reply.code(201).send({ data: created })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to create support ticket comment')
      }
    },
  )

  // X08 SLA breach sweep: escalates overdue open/acknowledged tickets atomically + writes immutable audit event
  fastify.post(
    '/api/v1/support-tickets/evaluate-sla',
    { preHandler: MANAGER_WRITE },
    async (request: FastifyRequest, reply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { supabase } = await import('../db')
        const nowIso = new Date().toISOString()
        const nowMs = Date.now()
        const { data: openTickets, error: listErr } = await supabase
          .from('support_tickets')
          .select('id, ticket_code, subject, status, response_due_at, escalation_level')
          .eq('workspace_id', request.tenancy.workspaceId)
        if (listErr) throw listErr
        const overdue = (openTickets ?? []).filter((t: Record<string, unknown>) => {
          const st = String(t.status ?? '')
          const dueMs = new Date(String(t.response_due_at ?? '')).getTime()
          return (st === 'open' || st === 'acknowledged') && Number.isFinite(dueMs) && dueMs < nowMs
        }) as Array<{ id: string; status: string; escalation_level?: number; subject?: string }>
        const escalatedTicketIds: string[] = []
        let notificationFailures = 0
        for (const t of overdue) {
          const prevStatus = String(t.status ?? 'open')
          const nextLevel = Number(t.escalation_level ?? 0) + 1
          const { data: updated, error: upErr } = await supabase
            .from('support_tickets')
            .update({
              status: 'escalated',
              escalation_level: nextLevel,
              escalated_at: nowIso,
              updated_at: nowIso,
            })
            .eq('id', t.id)
            .eq('workspace_id', request.tenancy.workspaceId)
            .in('status', ['open', 'acknowledged'])
            .select('id')
            .maybeSingle()
          if (upErr) throw upErr
          if (updated) {
            escalatedTicketIds.push(t.id)
            const { error: evErr } = await supabase.from('support_ticket_events').insert({
              workspace_id: request.tenancy.workspaceId,
              ticket_id: t.id,
              actor_id: request.tenancy.userId,
              action: 'sla_breached',
              from_status: prevStatus,
              to_status: 'escalated',
              note: `SLA due passed before ${nowIso}`,
            })
            if (evErr) throw evErr
            const { error: actErr } = await supabase.from('activities').insert({
              workspace_id: request.tenancy.workspaceId,
              user_id: request.tenancy.userId,
              entity_type: 'support_ticket',
              entity_id: t.id,
              action: 'sla_breached',
              title: t.subject ? `SLA breach: ${t.subject}` : 'Support ticket SLA breached',
            })
            if (actErr) notificationFailures += 1
          }
        }
        return reply.send({
          data: {
            evaluatedCount: (openTickets ?? []).length,
            escalatedTicketIds,
            notificationFailures,
            checkedAt: nowIso,
          },
        })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to evaluate support SLA breaches')
      }
    },
  )
}
