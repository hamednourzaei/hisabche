// ============================================
// backend/src/routes/project.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  createProjectSchema,
  updateProjectSchema,
  createProjectTaskSchema,
  updateProjectTaskSchema,
  createProjectMemberSchema,
  createTimeEntrySchema,
  updateTimeEntrySchema,
} from '@hisabche/validation'
import { ProjectService } from '../services/project.service'
import { InvoiceService } from '../services/invoice.service'
import { TimesheetsService } from '../services/timesheets'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { ValidationError } from '../errors/validation.error'
import { readClientRequestId } from '../utils/client-request'
import { invalidateMoneyCaches } from '../utils/money-cache'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'
import { sendFailure } from '../errors/http-failure'
import { requireRole } from '../services/tenancy.service'
import { baseCurrencyOf } from '../services/base-currency'
import { FRACTION_DIGITS, type KnownCurrency } from '@hisabche/formatting'
import { toJsonSchema } from '../utils/json-schema'

export async function projectRoutes(fastify: FastifyInstance) {
  const projectService = new ProjectService()

  // ═══════════════════════════════════════════════════════════
  // PROJECTS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/projects ────────────────────────────────────
  fastify.get(
    '/api/projects',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'projects' }),
      ],
      schema: {
        querystring: toJsonSchema(
          z.object({
            status: z
              .enum(['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'])
              .optional(),
          }),
        ),
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { status } = request.query as { status?: string }
        const projects = await projectService.listProjects(request.tenancy, status)
        return reply.send(projects)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to fetch projects')
      }
    },
  )

  // ─── POST /api/projects ───────────────────────────────────
  fastify.post(
    '/api/projects',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        body: toJsonSchema(createProjectSchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const data = createProjectSchema.parse(request.body)
        const project = await projectService.createProject(request.tenancy, data)
        await clearCache(`projects:${request.tenancy.workspaceId}:*`)
        return reply.code(201).send(project)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to create project')
      }
    },
  )

  // ─── GET /api/projects/:id ────────────────────────────────
  fastify.get(
    '/api/projects/:id',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 120, keyPrefix: 'project' }),
      ],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const project = await projectService.getProject(id, request.tenancy)
        return reply.send(project)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to fetch project')
      }
    },
  )

  // ─── PATCH /api/projects/:id ──────────────────────────────
  fastify.patch(
    '/api/projects/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(updateProjectSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = request.params as { id: string }
        const data = updateProjectSchema.parse(request.body)
        const project = await projectService.updateProject(request.tenancy, id, data)
        await clearCache(`project:${request.tenancy.workspaceId}:${id}`)
        await clearCache(`projects:${request.tenancy.workspaceId}:*`)
        return reply.send(project)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to update project')
      }
    },
  )

  // ─── DELETE /api/projects/:id ─────────────────────────────
  fastify.delete(
    '/api/projects/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id } = request.params as { id: string }
        const result = await projectService.deleteProject(request.tenancy, id)
        await clearCache(`project:${request.tenancy.workspaceId}:${id}`)
        await clearCache(`projects:${request.tenancy.workspaceId}:*`)
        return reply.send(result)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to delete project')
      }
    },
  )

  // ═══════════════════════════════════════════════════════════
  // TASKS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/projects/:projectId/tasks ───────────────────
  fastify.get(
    '/api/projects/:projectId/tasks',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'project-tasks' }),
      ],
      schema: {
        params: toJsonSchema(z.object({ projectId: z.string().uuid() })),
        querystring: toJsonSchema(
          z.object({
            status: z.enum(['todo', 'in_progress', 'review', 'done', 'cancelled']).optional(),
          }),
        ),
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { projectId } = request.params as { projectId: string }
        const { status } = request.query as { status?: string }
        const tasks = await projectService.listTasks(request.tenancy, projectId, status)
        return reply.send(tasks)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to fetch tasks')
      }
    },
  )

  // ─── POST /api/projects/:projectId/tasks ──────────────────
  fastify.post(
    '/api/projects/:projectId/tasks',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ projectId: z.string().uuid() })),
        body: toJsonSchema(createProjectTaskSchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { projectId } = request.params as { projectId: string }
        const body = (request.body as Record<string, unknown>) || {}
        const data = createProjectTaskSchema.parse({ ...body, projectId })
        const task = await projectService.createTask(request.tenancy, data)
        await clearCache(`project-tasks:${request.tenancy.workspaceId}:${data.projectId}:*`)
        return reply.code(201).send(task)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to create task')
      }
    },
  )

  // ─── PATCH /api/tasks/:id ─────────────────────────────────
  fastify.patch(
    '/api/tasks/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(updateProjectTaskSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const data = updateProjectTaskSchema.parse(request.body)
        const task = await projectService.updateTask(request.tenancy, id, data)
        await clearCache(`task:${request.tenancy.workspaceId}:${id}`)
        await clearCache(`project-tasks:${request.tenancy.workspaceId}:${task.project_id}:*`)
        return reply.send(task)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to update task')
      }
    },
  )

  // ─── DELETE /api/tasks/:id ────────────────────────────────
  fastify.delete(
    '/api/tasks/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const result = await projectService.deleteTask(request.tenancy, id)
        await clearCache(`task:${request.tenancy.workspaceId}:${id}`)
        await clearCache(`project-tasks:${request.tenancy.workspaceId}:*`)
        return reply.send(result)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to delete task')
      }
    },
  )

  // ═══════════════════════════════════════════════════════════
  // MEMBERS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/projects/:projectId/members ─────────────────
  fastify.get(
    '/api/projects/:projectId/members',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'project-members' }),
      ],
      schema: {
        params: toJsonSchema(z.object({ projectId: z.string().uuid() })),
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { projectId } = request.params as { projectId: string }
        const members = await projectService.listMembers(request.tenancy, projectId)
        return reply.send(members)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to fetch members')
      }
    },
  )

  // ─── POST /api/projects/:projectId/members ────────────────
  fastify.post(
    '/api/projects/:projectId/members',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ projectId: z.string().uuid() })),
        // projectId is the URL segment; the handler merges it before the full parse.
        body: toJsonSchema(createProjectMemberSchema.omit({ projectId: true })),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { projectId } = request.params as { projectId: string }
        const body = (request.body as Record<string, unknown>) || {}
        const data = createProjectMemberSchema.parse({ ...body, projectId })
        const member = await projectService.addMember(request.tenancy, data)
        await clearCache(`project-members:${request.tenancy.workspaceId}:${data.projectId}:*`)
        return reply.code(201).send(member)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to add member')
      }
    },
  )

  // ─── DELETE /api/projects/:projectId/members/:memberId ────
  fastify.delete(
    '/api/projects/:projectId/members/:memberId',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(
          z.object({ projectId: z.string().uuid(), memberId: z.string().uuid() }),
        ),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { projectId, memberId } = request.params as { projectId: string; memberId: string }
        const result = await projectService.removeMember(request.tenancy, projectId, memberId)
        await clearCache(`project-members:${request.tenancy.workspaceId}:${projectId}:*`)
        return reply.send(result)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to remove member')
      }
    },
  )

  // ═══════════════════════════════════════════════════════════
  // TIME ENTRIES
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/projects/:projectId/time-entries ────────────
  fastify.get(
    '/api/projects/:projectId/time-entries',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'project-time-entries' }),
      ],
      schema: {
        params: toJsonSchema(z.object({ projectId: z.string().uuid() })),
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { projectId } = request.params as { projectId: string }
        const entries = await projectService.listTimeEntries(request.tenancy, projectId)
        return reply.send(entries)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to fetch time entries')
      }
    },
  )

  // ─── POST /api/projects/:projectId/time-entries ───────────
  fastify.post(
    '/api/projects/:projectId/time-entries',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ projectId: z.string().uuid() })),
        body: toJsonSchema(createTimeEntrySchema.omit({ projectId: true })),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { projectId } = request.params as { projectId: string }
        const body = (request.body as Record<string, unknown>) || {}
        const data = createTimeEntrySchema.parse({ ...body, projectId })
        const entry = await projectService.createTimeEntry(request.tenancy, data)
        await clearCache(`project-time-entries:${request.tenancy.workspaceId}:${data.projectId}:*`)
        return reply.code(201).send(entry)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to create time entry')
      }
    },
  )

  // ─── PATCH /api/time-entries/:id ──────────────────────────
  fastify.patch(
    '/api/time-entries/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(updateTimeEntrySchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const data = updateTimeEntrySchema.parse(request.body)
        const entry = await projectService.updateTimeEntry(request.tenancy, id, data)
        await clearCache(`time-entry:${request.tenancy.workspaceId}:${id}`)
        await clearCache(
          `project-time-entries:${request.tenancy.workspaceId}:${entry.project_id}:*`,
        )
        return reply.send(entry)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to update time entry')
      }
    },
  )

  // ─── DELETE /api/time-entries/:id ─────────────────────────
  fastify.delete(
    '/api/time-entries/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const result = await projectService.deleteTimeEntry(request.tenancy, id)
        await clearCache(`time-entry:${request.tenancy.workspaceId}:${id}`)
        await clearCache(`project-time-entries:${request.tenancy.workspaceId}:*`)
        return reply.send(result)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to delete time entry')
      }
    },
  )

  // ─── POST /api/projects/:id/bill ──────────────────────────
  // V60 Slice 6: turn unbilled billable hours (`timesheets/billing.domain.ts`)
  // or an explicit milestone fee into a real sales invoice via `InvoiceService.create`,
  // locking billed time entries against the created invoice id.
  fastify.post(
    '/api/projects/:id/bill',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('invoice.create')],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = z
          .object({
            customerId: z.string().uuid().optional(),
            milestoneTitle: z.string().trim().min(1).max(200).optional(),
            milestoneAmount: z.number().positive().optional(),
            paymentMethod: z.enum(['cash', 'bank', 'credit']).optional(),
            date: z.string().trim().max(32).optional(),
          })
          .parse(request.body ?? {})

        const project = (await projectService.getProject(id, request.tenancy)) as {
          id: string
          name?: string | null
          client_id?: string | null
          currency?: string | null
        }

        const timesheets = new TimesheetsService()
        const preview = await timesheets.previewBilling(request.tenancy, id)
        const invoiceService = new InvoiceService()

        const currency = project.currency ?? undefined
        const items: Array<{ productName: string; quantity: number; unitPrice: number }> = []
        const entryIdsToLock: string[] = []

        if (preview.lines.length > 0) {
          for (const line of preview.lines) {
            entryIdsToLock.push(...line.entryIds)
            items.push({
              productName: line.description || project.name || 'Project services',
              quantity: 1,
              unitPrice: line.amountMinor / 100,
            })
          }
        } else if (body.milestoneAmount && body.milestoneAmount > 0) {
          items.push({
            productName: body.milestoneTitle ?? project.name ?? 'Project milestone',
            quantity: 1,
            unitPrice: body.milestoneAmount,
          })
        } else {
          throw new ValidationError(preview.problems[0] ?? 'PROJECT_NOTHING_TO_BILL')
        }

        const clientRequestId = readClientRequestId(request)
        const created = await invoiceService.create(request.tenancy, {
          type: 'sale',
          date: body.date ?? new Date().toISOString().slice(0, 10),
          customerId: body.customerId ?? project.client_id ?? undefined,
          currency,
          paymentMethod: body.paymentMethod ?? 'credit',
          paidAmount: 0,
          idempotencyKey: clientRequestId ? `${clientRequestId}:project-bill` : undefined,
          projectId: id,
          items,
        } as Parameters<InvoiceService['create']>[1])

        const invoiceId = (created as { id?: string }).id
        if (invoiceId && entryIdsToLock.length > 0) {
          await timesheets.markBilled(request.tenancy, entryIdsToLock, invoiceId)
        }
        await invalidateMoneyCaches(request.tenancy.workspaceId)
        return reply.code(201).send({ data: created, billedEntryIds: entryIdsToLock })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to bill project milestone')
      }
    },
  )

  // X16: Project change-orders with real DB persistence, workspace ownership check & manager approval
  fastify.get(
    '/api/projects/:id/change-orders',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('invoice.read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const { supabase } = await import('../db')
        const { data: proj, error: projErr } = await supabase
          .from('projects')
          .select('id')
          .eq('id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .maybeSingle()
        if (projErr) throw projErr
        if (!proj)
          return reply.code(404).send({ error: 'PROJECT_NOT_FOUND', code: 'PROJECT_NOT_FOUND' })
        const { data, error } = await supabase
          .from('project_change_orders')
          .select('*')
          .eq('workspace_id', request.tenancy.workspaceId)
          .eq('project_id', id)
          .order('created_at', { ascending: false })
        if (error) throw error
        return reply.send({ data: data ?? [] })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to list project change orders')
      }
    },
  )

  const budgetScaleForCurrency = (currency: string): number => {
    const digits = FRACTION_DIGITS[currency.toUpperCase() as KnownCurrency] ?? 2
    return 10 ** digits
  }

  fastify.post(
    '/api/projects/:id/change-orders',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('invoice.create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const body = z
          .object({
            title: z.string().trim().min(1).max(160),
            originalBudgetMinor: z.number().int().min(0).optional(),
            deltaMinor: z.number().int(),
            estimatedCostDeltaMinor: z.number().int().default(0),
            approved: z.boolean().default(false),
            expectedVersion: z.number().int().min(1).optional(),
            reason: z.string().trim().max(500).optional(),
          })
          .strict()
          .parse(request.body)
        if (body.approved) requireRole(request.tenancy, 'manager')
        const { supabase } = await import('../db')
        const { data: proj, error: projErr } = await supabase
          .from('projects')
          .select('id, budget, currency')
          .eq('id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .maybeSingle()
        if (projErr) throw projErr
        if (!proj)
          return reply.code(404).send({ error: 'PROJECT_NOT_FOUND', code: 'PROJECT_NOT_FOUND' })

        const projRecord = proj as { id: string; budget?: number | null; currency?: string | null }
        const projectCurrency =
          projRecord.currency || (await baseCurrencyOf(request.tenancy.workspaceId))
        const scale = budgetScaleForCurrency(projectCurrency)
        const idemKey = readClientRequestId(request)

        const rpcRes = await supabase.rpc('create_project_change_order_v2', {
          p_workspace_id: request.tenancy.workspaceId,
          p_project_id: id,
          p_actor_id: request.tenancy.userId,
          p_title: body.title,
          p_delta_minor: body.deltaMinor,
          p_estimated_cost_delta_minor: body.estimatedCostDeltaMinor,
          p_approved: body.approved,
          p_scale: scale,
          p_idempotency_key: idemKey ?? null,
          p_expected_version: body.expectedVersion ?? null,
          p_reason: body.reason ?? null,
        })
        if (rpcRes.error || !rpcRes.data) {
          const msg = String(rpcRes.error?.message ?? '')
          if (msg.includes('PROJECT_NOT_FOUND')) {
            return reply.code(404).send({ error: 'PROJECT_NOT_FOUND', code: 'PROJECT_NOT_FOUND' })
          }
          if (msg.includes('REVISED_BUDGET_CANNOT_BE_NEGATIVE')) {
            return reply
              .code(400)
              .send({ error: 'REVISED_BUDGET_CANNOT_BE_NEGATIVE', code: 'BUDGET_NEGATIVE' })
          }
          if (msg.includes('STALE_PROJECT_VERSION_CONFLICT')) {
            return reply.code(409).send({
              error: 'STALE_PROJECT_VERSION_CONFLICT',
              code: 'STALE_PROJECT_VERSION_CONFLICT',
            })
          }
          throw rpcRes.error ?? new Error('ATOMIC_CHANGE_ORDER_CREATE_FAILED')
        }

        const envelope = rpcRes.data as { order?: Record<string, unknown>; replay?: boolean }
        const created = (envelope.order ?? rpcRes.data) as Record<string, unknown>
        const wasReplay = Boolean(envelope.replay)
        return reply.code(wasReplay ? 200 : 201).send({
          data: {
            ...created,
            projectId: id,
            currency: projectCurrency,
            originalBudgetMinor: Number(created.original_budget_minor ?? 0),
            deltaMinor: Number(created.delta_minor ?? body.deltaMinor),
            revisedBudgetMinor: Number(created.revised_budget_minor ?? 0),
            netMarginDeltaMinor: Number(created.net_margin_delta_minor ?? 0),
            status: String(created.status ?? (body.approved ? 'approved' : 'pending_approval')),
            version: Number(created.project_version_at_decision ?? 1),
          },
          ...(wasReplay ? { replay: true } : {}),
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to record project change order')
      }
    },
  )

  fastify.post(
    '/api/projects/:id/change-orders/:orderId/decide',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('invoice.create')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        requireRole(request.tenancy, 'manager')
        const { id, orderId } = z
          .object({ id: z.string().uuid(), orderId: z.string().uuid() })
          .parse(request.params)
        const { decision, reason, expectedOriginalBudgetMinor, expectedVersion } = z
          .object({
            decision: z.enum(['approved', 'rejected']),
            reason: z.string().trim().max(500).optional(),
            expectedOriginalBudgetMinor: z.number().int().min(0).optional(),
            expectedVersion: z.number().int().min(1).optional(),
          })
          .strict()
          .parse(request.body)
        const { supabase } = await import('../db')
        const { data: proj, error: projErr } = await supabase
          .from('projects')
          .select('id, currency')
          .eq('id', id)
          .eq('workspace_id', request.tenancy.workspaceId)
          .maybeSingle()
        if (projErr) throw projErr
        if (!proj)
          return reply.code(404).send({ error: 'PROJECT_NOT_FOUND', code: 'PROJECT_NOT_FOUND' })
        const projRecord = proj as { id: string; currency?: string | null }
        const projectCurrency =
          projRecord.currency || (await baseCurrencyOf(request.tenancy.workspaceId))
        const scale = budgetScaleForCurrency(projectCurrency)

        // Single authoritative atomic database transaction (FOR UPDATE row lock + version + audit)
        const rpcRes = await supabase.rpc('decide_project_change_order_v2', {
          p_workspace_id: request.tenancy.workspaceId,
          p_project_id: id,
          p_order_id: orderId,
          p_decision: decision,
          p_actor_id: request.tenancy.userId,
          p_scale: scale,
          p_expected_original_budget_minor: expectedOriginalBudgetMinor ?? null,
          p_expected_version: expectedVersion ?? null,
          p_reason: reason ?? null,
        })
        if (rpcRes.error || !rpcRes.data) {
          const rpcMsg = String(rpcRes.error?.message ?? '')
          if (rpcMsg.includes('CHANGE_ORDER_NOT_FOUND')) {
            return reply
              .code(404)
              .send({ error: 'CHANGE_ORDER_NOT_FOUND', code: 'CHANGE_ORDER_NOT_FOUND' })
          }
          if (rpcMsg.includes('CHANGE_ORDER_NOT_PENDING')) {
            return reply
              .code(409)
              .send({ error: 'CHANGE_ORDER_NOT_PENDING', code: 'CHANGE_ORDER_NOT_PENDING' })
          }
          if (rpcMsg.includes('STALE_PROJECT_BUDGET_CONFLICT')) {
            return reply.code(409).send({
              error: 'STALE_PROJECT_BUDGET_CONFLICT',
              code: 'STALE_PROJECT_BUDGET_CONFLICT',
            })
          }
          if (rpcMsg.includes('STALE_PROJECT_VERSION_CONFLICT')) {
            return reply.code(409).send({
              error: 'STALE_PROJECT_VERSION_CONFLICT',
              code: 'STALE_PROJECT_VERSION_CONFLICT',
            })
          }
          if (rpcMsg.includes('REVISED_BUDGET_CANNOT_BE_NEGATIVE')) {
            return reply
              .code(400)
              .send({ error: 'REVISED_BUDGET_CANNOT_BE_NEGATIVE', code: 'BUDGET_NEGATIVE' })
          }
          if (rpcMsg.includes('PROJECT_NOT_FOUND')) {
            return reply.code(404).send({ error: 'PROJECT_NOT_FOUND', code: 'PROJECT_NOT_FOUND' })
          }
          throw rpcRes.error ?? new Error('ATOMIC_CHANGE_ORDER_DECIDE_FAILED')
        }

        const updated = rpcRes.data as Record<string, unknown>
        return reply.send({
          data: {
            ...updated,
            ...(reason ? { reason } : {}),
            currency: projectCurrency,
            version: Number(updated.project_version_at_decision ?? 1),
          },
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to decide change order')
      }
    },
  )
}
