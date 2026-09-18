// ============================================
// backend/src/routes/operations.routes.ts
//
// Registered with prefix '/api/operations' in index.ts.
//
// Budgets, batch/serial traceability, and timesheet billing — the three
// capabilities that constrain or describe day-to-day work rather than
// recording money directly.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { BudgetService } from '../services/budgeting'
import { TraceabilityService } from '../services/traceability'
import { TimesheetsService } from '../services/timesheets'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

const budgetSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  dimensionValueId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  period: z.enum(['monthly', 'quarterly', 'yearly']),
  startsOn: z.string().min(8),
  amountMinor: z.number().int().min(0),
  action: z.enum(['block', 'warn', 'approval', 'track']),
  warnAtPercent: z.number().int().min(0).max(100).default(80),
  isActive: z.boolean().default(true),
  name: z.string().trim().max(120).nullable().optional(),
  type: z.enum(['expense', 'revenue']).default('expense'),
  /** The currency the amount is entered in. The server converts to base. */
  currency: z.enum(['AFN', 'USD', 'PKR', 'IRR']).default('AFN'),
  notes: z.string().max(2000).nullable().optional(),
  /** Basis points per sub-period, summing to 10 000. */
  distributionWeightsBp: z.array(z.number().int().min(0).max(10_000)).max(12).nullable().optional(),
  /** Explicit minor units per sub-period, summing to amountMinor. */
  distributionMinor: z.array(z.number().int().min(0)).max(12).nullable().optional(),
})

const reviseSchema = z.object({
  expectedVersion: z.number().int().min(1),
  amountMinor: z.number().int().min(0),
  distributionMinor: z.array(z.number().int().min(0)).max(12).nullable().optional(),
  action: z.enum(['block', 'warn', 'approval', 'track']).optional(),
  warnAtPercent: z.number().int().min(0).max(100).optional(),
  reason: z.string().trim().min(3).max(1000),
})

const reportQuerySchema = z.object({
  onDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  type: z.enum(['expense', 'revenue']).optional(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'archived']).optional(),
  branchId: z.string().uuid().optional(),
})

const checkSpendSchema = z.object({
  accountId: z.string().uuid(),
  dimensionValueId: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  amountMinor: z.number().int(),
  onDate: z.string().min(8),
})

const receiveBatchSchema = z.object({
  productId: z.string().uuid(),
  batchNumber: z.string().min(1).max(80),
  quantity: z.number().positive(),
  expiryDate: z.string().nullable().optional(),
  manufacturedDate: z.string().nullable().optional(),
  costLayerId: z.string().uuid().nullable().optional(),
  warehouseId: z.string().uuid().nullable().optional(),
  receivedOn: z.string().optional(),
})

const receiveSerialsSchema = z.object({
  productId: z.string().uuid(),
  serialNumbers: z.array(z.string().min(1).max(120)).min(1).max(1000),
  unitCostMinor: z.number().int().min(0),
  batchId: z.string().uuid().nullable().optional(),
  costLayerId: z.string().uuid().nullable().optional(),
  warehouseId: z.string().uuid().nullable().optional(),
})

const planIssueSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  strategy: z.enum(['fifo', 'fefo', 'manual']).optional(),
  asOf: z.string().optional(),
  manual: z
    .array(z.object({ batchId: z.string().uuid(), quantity: z.number().positive() }))
    .optional(),
})

const logTimeSchema = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().uuid().nullable().optional(),
  employeeId: z.string().uuid(),
  onDate: z.string().min(8),
  minutes: z.number().int().positive(),
  billable: z.boolean().optional(),
  rateMinor: z.number().int().min(0).nullable().optional(),
  description: z.string().max(500).optional(),
})

const billingConfigSchema = z.object({
  projectId: z.string().uuid(),
  method: z.enum(['hourly', 'fixed', 'non_billable']),
  defaultRateMinor: z.number().int().min(0),
  budgetCapMinor: z.number().int().min(0).nullable().optional(),
})

export async function operationsRoutes(fastify: FastifyInstance) {
  const budgetService = new BudgetService()
  const traceabilityService = new TraceabilityService()
  const timesheetsService = new TimesheetsService()

  const fail = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    if (err instanceof BaseError && err.statusCode < 500) {
      const code = /^[A-Z][A-Z_]{6,}/.exec(err.message)?.[0]
      return reply.code(err.statusCode).send({ error: err.message, code: code ?? err.name })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: fallback })
  }

  const financeRead = [
    authenticate,
    requireWorkspaceContext,
    requireCapability('report.financial.read'),
  ]
  const stockRead = [authenticate, requireWorkspaceContext, requireCapability('inventory.read')]
  const stockWrite = [authenticate, requireWorkspaceContext, requireCapability('product.write')]
  const configure = [authenticate, requireWorkspaceContext, requireCapability('account.manage')]
  const budgetRead = [authenticate, requireWorkspaceContext, requireCapability('budget.read')]
  const budgetManage = [authenticate, requireWorkspaceContext, requireCapability('budget.manage')]
  const budgetApprove = [authenticate, requireWorkspaceContext, requireCapability('budget.approve')]

  // ══════════════════════════════════════════ BUDGETS

  fastify.get(
    '/budgets',
    { preHandler: budgetRead, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await budgetService.list(request.tenancy))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch budgets')
      }
    },
  )

  fastify.put(
    '/budgets/:id',
    {
      preHandler: budgetManage,
      // ⚠️ The id is in the URL, not the body. The body schema used to require it,
      // so every save from the client (which sends `{ id, ...body }` split) was a
      // 400 «body must have required property 'id'» before any code ran.
      schema: {
        body: toJsonSchema(budgetSchema.omit({ id: true })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = budgetSchema.parse({ ...(request.body as object), id })
        return reply.send(await budgetService.upsert(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to save the budget')
      }
    },
  )

  // The whole budgets page in one call: performance per budget, totals and
  // the sub-period series. Registered before `/budgets/:id/*`.
  fastify.get(
    '/budgets/report',
    { preHandler: budgetRead, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = reportQuerySchema.parse(request.query ?? {})
        return reply.send(
          await budgetService.performanceReport(
            request.tenancy,
            query.onDate ?? new Date().toISOString().slice(0, 10),
            { type: query.type, status: query.status, branchId: query.branchId },
          ),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to build the budget report')
      }
    },
  )

  fastify.post(
    '/budgets/:id/submit',
    { preHandler: budgetManage, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        return reply.send(await budgetService.submit(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to submit the budget')
      }
    },
  )

  fastify.post(
    '/budgets/:id/approve',
    { preHandler: budgetApprove, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const body = z
          .object({ override: z.object({ reason: z.string().trim().min(3).max(500) }).optional() })
          .parse(request.body ?? {})
        return reply.send(await budgetService.approve(request.tenancy, id, body.override))
      } catch (err) {
        return fail(reply, err, 'Failed to approve the budget')
      }
    },
  )

  fastify.post(
    '/budgets/:id/archive',
    { preHandler: budgetApprove, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        return reply.send(await budgetService.archive(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to archive the budget')
      }
    },
  )

  fastify.post(
    '/budgets/:id/revise',
    {
      preHandler: budgetApprove,
      schema: { body: toJsonSchema(reviseSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const body = reviseSchema.parse(request.body)
        return reply.send(await budgetService.revise(request.tenancy, id, body))
      } catch (err) {
        return fail(reply, err, 'Failed to revise the budget')
      }
    },
  )

  fastify.get(
    '/budgets/:id/revisions',
    { preHandler: budgetRead, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        return reply.send(await budgetService.revisions(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch budget revisions')
      }
    },
  )

  // Asked BEFORE the money is committed. That is what makes it a control
  // rather than a report.
  fastify.post(
    '/budgets/check',
    {
      preHandler: financeRead,
      schema: { body: toJsonSchema(checkSpendSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = checkSpendSchema.parse(request.body)
        return reply.send(await budgetService.checkSpend(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to check the budget')
      }
    },
  )

  fastify.get(
    '/budgets/variance',
    { preHandler: budgetRead, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { onDate } = request.query as { onDate?: string }
        return reply.send(
          await budgetService.getVariance(
            request.tenancy,
            onDate ?? new Date().toISOString().slice(0, 10),
          ),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to build the variance report')
      }
    },
  )

  // ══════════════════════════════════════════ TRACEABILITY

  fastify.get(
    '/batches',
    { preHandler: stockRead, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { productId } = request.query as { productId?: string }
        return reply.send(
          await traceabilityService.listBatches(request.tenancy, {
            ...(productId ? { productId } : {}),
          }),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to fetch batches')
      }
    },
  )

  fastify.post(
    '/batches',
    {
      preHandler: stockWrite,
      schema: { body: toJsonSchema(receiveBatchSchema), response: { 201: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = receiveBatchSchema.parse(request.body)
        return reply.code(201).send(await traceabilityService.receiveBatch(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to receive the batch')
      }
    },
  )

  // Which batches an issue WOULD take. FEFO by default; consumes nothing.
  // ─── PATCH /batches/:id ────────────────────────────────
  // Correcting the expiry someone typed. Dates only — see the service.
  fastify.patch(
    '/batches/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('product.write')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const body = z
          .object({
            expiryDate: z.string().nullable().optional(),
            manufacturedDate: z.string().nullable().optional(),
          })
          .strict()
          .parse(request.body)
        return reply.send(await traceabilityService.updateBatchDates(request.tenancy, id, body))
      } catch (err) {
        return fail(reply, err, 'Failed to update the batch')
      }
    },
  )

  fastify.post(
    '/batches/plan-issue',
    {
      preHandler: stockRead,
      schema: { body: toJsonSchema(planIssueSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = planIssueSchema.parse(request.body)
        return reply.send(await traceabilityService.planIssue(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to plan the issue')
      }
    },
  )

  fastify.post(
    '/serials',
    {
      preHandler: stockWrite,
      schema: {
        body: toJsonSchema(receiveSerialsSchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = receiveSerialsSchema.parse(request.body)
        return reply.code(201).send(await traceabilityService.receiveSerials(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to receive the serial numbers')
      }
    },
  )

  fastify.get(
    '/serials',
    { preHandler: stockRead, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { productId, status } = request.query as { productId?: string; status?: string }
        return reply.send(
          await traceabilityService.listSerials(request.tenancy, {
            ...(productId ? { productId } : {}),
            ...(status ? { status } : {}),
          }),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to fetch serial numbers')
      }
    },
  )

  // Expired, near-expiry, fresh — and what the expired stock is WORTH, which
  // is what a write-off decision actually needs.
  fastify.get(
    '/expiry',
    { preHandler: stockRead, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { asOf, nearExpiryDays } = request.query as Record<string, string | undefined>
        return reply.send(
          await traceabilityService.getExpiryReport(
            request.tenancy,
            asOf ?? new Date().toISOString().slice(0, 10),
            Number(nearExpiryDays) || 30,
          ),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to build the expiry report')
      }
    },
  )

  // The trail from a document back to the exact physical goods.
  fastify.get(
    '/lot-trail/:consumerType/:consumerId',
    { preHandler: stockRead, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { consumerType, consumerId } = request.params as {
          consumerType: string
          consumerId: string
        }
        return reply.send(
          await traceabilityService.getTrail(request.tenancy, consumerType, consumerId),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to fetch the lot trail')
      }
    },
  )

  // ══════════════════════════════════════════ TIMESHEETS

  fastify.get(
    '/timesheets/:projectId',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.operational.read'),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { projectId } = request.params as { projectId: string }
        return reply.send(await timesheetsService.getSummary(request.tenancy, projectId))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch the timesheet summary')
      }
    },
  )

  fastify.post(
    '/timesheets',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.operational.read'),
      ],
      schema: { body: toJsonSchema(logTimeSchema), response: { 201: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = logTimeSchema.parse(request.body)
        return reply.code(201).send(await timesheetsService.logTime(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to log time')
      }
    },
  )

  fastify.put(
    '/timesheets/config',
    {
      preHandler: configure,
      schema: { body: toJsonSchema(billingConfigSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = billingConfigSchema.parse(request.body)
        return reply.send(await timesheetsService.setConfig(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to save the billing config')
      }
    },
  )

  // The invoice lines this project's unbilled time would produce. Bills
  // nothing; `markBilled` is what takes the hours.
  fastify.get(
    '/timesheets/:projectId/billing-preview',
    { preHandler: financeRead, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { projectId } = request.params as { projectId: string }
        return reply.send(await timesheetsService.previewBilling(request.tenancy, projectId))
      } catch (err) {
        return fail(reply, err, 'Failed to preview the billing')
      }
    },
  )

  fastify.get(
    '/timesheets/:projectId/profitability',
    { preHandler: financeRead, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { projectId } = request.params as { projectId: string }
        return reply.send(await timesheetsService.getProfitability(request.tenancy, projectId))
      } catch (err) {
        return fail(reply, err, 'Failed to compute profitability')
      }
    },
  )
}
