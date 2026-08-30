// ============================================
// backend/src/routes/finance-ops.routes.ts
//
// Registered with prefix '/api/finance' in index.ts.
//
// The four back-office finance capabilities that have no daily till or sales
// screen behind them: fixed assets, bank reconciliation, exchange rates and
// accounting dimensions.
//
// Grouped in one file because they share an audience — the person who closes
// the month — and because four route files of six endpoints each would spread
// one job across four places.
//
// Every write here needs at least `manager`. None of it is a clerk's work:
// capitalising an expense, matching a bank line and revaluing a currency all
// change reported profit.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { AssetsService } from '../services/assets'
import { BankingService } from '../services/banking'
import { CurrencyService } from '../services/currency'
import { DimensionsService } from '../services/dimensions'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const assetSchema = z.object({
  name: z.string().min(1).max(200),
  costMinor: z.number().int().positive(),
  salvageMinor: z.number().int().min(0).default(0),
  method: z.enum(['straight_line', 'declining', 'declining_then_straight']),
  periods: z.number().int().min(1).max(600),
  periodMonths: z.number().int().min(1).max(12).default(1),
  decliningFactor: z.number().positive().optional(),
  firstPeriodOn: z.string().min(8),
  prorataFrom: z.string().nullable().optional(),
  acquiredOn: z.string().min(8),
  assetAccountId: z.string().uuid().nullable().optional(),
  expenseAccountId: z.string().uuid().nullable().optional(),
  accumulatedAccountId: z.string().uuid().nullable().optional(),
  sourceInvoiceId: z.string().uuid().nullable().optional(),
})

const disposeSchema = z.object({
  onDate: z.string().min(8),
  proceedsMinor: z.number().int().min(0),
})

const statementSchema = z.object({
  accountId: z.string().uuid(),
  statementDate: z.string().min(8),
  openingBalanceMinor: z.number().int(),
  closingBalanceMinor: z.number().int(),
  lines: z
    .array(
      z.object({
        externalRef: z.string().max(200).nullable().optional(),
        onDate: z.string().min(8),
        amountMinor: z.number().int(),
        description: z.string().max(500),
      }),
    )
    .min(1)
    .max(5000),
})

const reconcileSchema = z.object({
  statementLineId: z.string().uuid(),
  bookEntryId: z.string().uuid(),
  differenceReason: z.string().max(300).optional(),
})

const rateSchema = z.object({
  currency: z.string().min(2).max(8),
  rate: z.number().positive(),
  onDate: z.string().min(8),
})

const revalueSchema = z.object({
  asOf: z.string().min(8),
  baseCurrency: z.string().max(8).optional(),
  rates: z.record(z.number().positive()).optional(),
})

const dimensionSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1).max(40),
  labelKey: z.string().min(1).max(120),
  allowsHierarchy: z.boolean().optional(),
})

const dimensionValueSchema = z.object({
  id: z.string().uuid().optional(),
  dimensionId: z.string().uuid(),
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  parentId: z.string().uuid().nullable().optional(),
})

const requirementSchema = z.object({
  dimensionId: z.string().uuid(),
  accountTypes: z.array(z.enum(['asset', 'liability', 'equity', 'revenue', 'expense'])).optional(),
  accountIds: z.array(z.string().uuid()).optional(),
  exceptAccountIds: z.array(z.string().uuid()).optional(),
})

export async function financeOpsRoutes(fastify: FastifyInstance) {
  const assetsService = new AssetsService()
  const bankingService = new BankingService()
  const currencyService = new CurrencyService()
  const dimensionsService = new DimensionsService()

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

  const read = [authenticate, requireWorkspaceContext, requireCapability('report.financial.read')]
  const write = [authenticate, requireWorkspaceContext, requireCapability('ledger.post')]
  const configure = [authenticate, requireWorkspaceContext, requireCapability('account.manage')]

  // ══════════════════════════════════════════ FIXED ASSETS

  fastify.get(
    '/assets',
    { preHandler: read, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await assetsService.list(request.tenancy))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch assets')
      }
    },
  )

  fastify.post(
    '/assets',
    {
      preHandler: configure,
      schema: { body: toJsonSchema(assetSchema), response: { 201: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = assetSchema.parse(request.body)
        return reply.code(201).send(await assetsService.create(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to create the asset')
      }
    },
  )

  // The whole schedule, dated. Not a monthly formula — this is what makes a
  // missed run recoverable rather than a month of depreciation that vanished.
  fastify.get(
    '/assets/:id/schedule',
    { preHandler: read, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await assetsService.getSchedule(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch the schedule')
      }
    },
  )

  // Posts every entry it owes. Running it twice posts nothing the second time.
  fastify.post(
    '/assets/depreciation/run',
    { preHandler: write, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { asOf } = request.body as { asOf?: string }
        return reply.send(await assetsService.postDue(request.tenancy, asOf))
      } catch (err) {
        return fail(reply, err, 'Failed to run depreciation')
      }
    },
  )

  fastify.post(
    '/assets/:id/dispose',
    {
      preHandler: configure,
      schema: { body: toJsonSchema(disposeSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = disposeSchema.parse(request.body)
        return reply.send(await assetsService.dispose(request.tenancy, id, body))
      } catch (err) {
        return fail(reply, err, 'Failed to dispose of the asset')
      }
    },
  )

  // ══════════════════════════════════════════ BANK RECONCILIATION

  fastify.post(
    '/bank/statements',
    {
      preHandler: write,
      schema: { body: toJsonSchema(statementSchema), response: { 201: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = statementSchema.parse(request.body)
        return reply.code(201).send(await bankingService.importStatement(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to import the statement')
      }
    },
  )

  // The statements themselves. Every other bank endpoint is keyed by an id,
  // so without this list a reconciliation screen has no way in.
  fastify.get(
    '/bank/statements',
    { preHandler: read, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { accountId } = request.query as { accountId?: string }
        return reply.send(await bankingService.listStatements(request.tenancy, accountId))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch statements')
      }
    },
  )

  // Candidates with their scores and REASONS. A person confirms every one.
  fastify.get(
    '/bank/statements/:id/suggestions',
    { preHandler: read, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await bankingService.getSuggestions(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to build suggestions')
      }
    },
  )

  fastify.post(
    '/bank/reconcile',
    {
      preHandler: write,
      schema: { body: toJsonSchema(reconcileSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = reconcileSchema.parse(request.body)
        return reply.send(await bankingService.reconcile(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to reconcile')
      }
    },
  )

  fastify.post(
    '/bank/lines/:id/unmatch',
    { preHandler: write, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        await bankingService.unmatch(request.tenancy, id)
        return reply.send({ unmatched: id })
      } catch (err) {
        return fail(reply, err, 'Failed to unmatch')
      }
    },
  )

  // The difference ENUMERATED, not just stated.
  fastify.get(
    '/bank/statements/:id/reconciliation',
    { preHandler: read, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await bankingService.getReconciliation(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to build the reconciliation')
      }
    },
  )

  // ══════════════════════════════════════════ CURRENCY

  fastify.get(
    '/currency/rates',
    { preHandler: read, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { currency } = request.query as { currency?: string }
        return reply.send(await currencyService.listRates(request.tenancy, currency))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch rates')
      }
    },
  )

  fastify.put(
    '/currency/rates',
    {
      preHandler: configure,
      schema: { body: toJsonSchema(rateSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = rateSchema.parse(request.body)
        return reply.send(await currencyService.setRate(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to save the rate')
      }
    },
  )

  // Reverses the previous run before booking its own: last period's opinion
  // about a rate must not sit in the books underneath this one.
  fastify.post(
    '/currency/revalue',
    {
      preHandler: write,
      schema: { body: toJsonSchema(revalueSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = revalueSchema.parse(request.body)
        return reply.send(await currencyService.revalue(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to revalue')
      }
    },
  )

  fastify.get(
    '/currency/revaluations',
    { preHandler: read, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await currencyService.listRevaluations(request.tenancy))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch revaluations')
      }
    },
  )

  // ══════════════════════════════════════════ DIMENSIONS

  fastify.get(
    '/dimensions',
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
        const [dimensions, values, requirements] = await Promise.all([
          dimensionsService.listDimensions(request.tenancy),
          dimensionsService.listValues(request.tenancy),
          dimensionsService.listRequirements(request.tenancy),
        ])
        return reply.send({ dimensions, values, requirements })
      } catch (err) {
        return fail(reply, err, 'Failed to fetch dimensions')
      }
    },
  )

  fastify.put(
    '/dimensions',
    {
      preHandler: configure,
      schema: { body: toJsonSchema(dimensionSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = dimensionSchema.parse(request.body)
        return reply.send(await dimensionsService.upsertDimension(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to save the dimension')
      }
    },
  )

  fastify.put(
    '/dimensions/values',
    {
      preHandler: configure,
      schema: {
        body: toJsonSchema(dimensionValueSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = dimensionValueSchema.parse(request.body)
        return reply.send(await dimensionsService.upsertValue(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to save the dimension value')
      }
    },
  )

  fastify.put(
    '/dimensions/requirements',
    {
      preHandler: configure,
      schema: { body: toJsonSchema(requirementSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = requirementSchema.parse(request.body)
        await dimensionsService.setRequirement(request.tenancy, body)
        return reply.send({ saved: true })
      } catch (err) {
        return fail(reply, err, 'Failed to save the requirement')
      }
    },
  )

  // Totals per value, INCLUDING an `unassigned` bucket — dropping untagged
  // postings hides exactly the ones somebody forgot to tag.
  fastify.get(
    '/dimensions/:dimensionId/totals',
    { preHandler: read, schema: { response: { 200: toJsonSchema(z.any()) } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { dimensionId } = request.params as { dimensionId: string }
        const { from, to, accountId, valueId } = request.query as Record<string, string | undefined>

        return reply.send(
          await dimensionsService.getTotals(request.tenancy, {
            dimensionId,
            from: from ?? new Date().toISOString().slice(0, 10),
            to: to ?? new Date().toISOString().slice(0, 10),
            ...(accountId ? { accountId } : {}),
            ...(valueId ? { valueId } : {}),
          }),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to build the dimension totals')
      }
    },
  )
}
