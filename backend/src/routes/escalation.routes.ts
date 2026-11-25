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
  const WRITE = [authenticate, requireWorkspaceContext]

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
        return reply.send({ data: data ?? [] })
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

  fastify.patch(
    '/api/v1/support-tickets/:id/status',
    { preHandler: READ },
    async (request: FastifyRequest, reply) => {
      try {
        const { id } = idParams.parse(request.params)
        const body = z
          .object({
            status: z.enum(['acknowledged', 'escalated', 'resolved', 'closed']),
            rcaSummary: z.string().trim().max(2000).optional(),
          })
          .strict()
          .parse(request.body)
        const { supabase } = await import('../db')
        const now = new Date().toISOString()
        const patch: Record<string, unknown> = {
          status: body.status,
          updated_at: now,
          ...(body.rcaSummary !== undefined ? { rca_summary: body.rcaSummary } : {}),
          ...(body.status === 'escalated' ? { escalated_at: now, escalation_level: 1 } : {}),
          ...(body.status === 'resolved' || body.status === 'closed' ? { resolved_at: now } : {}),
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
        return reply.send({ data: updated })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to update support ticket')
      }
    },
  )
}
