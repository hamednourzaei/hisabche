// ============================================
// backend/src/routes/accounting.routes.ts
//
// Registered with prefix '/api/accounting' in index.ts.
//
// EVERY route here now runs `requireWorkspaceContext` and passes
// `request.tenancy` to the service. Before this change the chart of accounts,
// the journal and all three statements were fetched with `request.userId`
// alone: a second member of the same shop saw an empty ledger, and the
// automatic entries the invoice poster wrote against the workspace were
// invisible to the very screens meant to show them.
//
// Cache scope moved with it. `scope: 'user'` on a workspace's books hands one
// member's cached statements to a request that should have produced another's.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  createAccountSchema,
  createJournalEntrySchema,
  periodLockSchema,
  reverseJournalEntrySchema,
  updateAccountSchema,
} from '@hisabche/validation'

import { AccountingService } from '../services/accounting'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { readClientRequestId } from '../utils/client-request'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { branches } from '../services/branch'
import { cacheMiddleware } from '../middleware/cache.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

const listQuerySchema = z.object({
  limit: z.string().optional(),
  status: z.enum(['draft', 'posted', 'reversed', 'cancelled']).optional(),
  cursor: z.string().optional(),
})

const dateQuerySchema = z.object({
  date: z.string().optional(),
  fromDate: z.string().optional(),
  limit: z.string().optional(),
})

const dateRangeQuerySchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
})

const incomeStatementQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
  limit: z.string().optional(),
})

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Which branches a statement covers.
 *
 * `null` is the consolidated business — what every request without a branch
 * asks for, and what a member with no branch restriction always gets. A
 * restricted member is narrowed to their own branches whether they asked to be
 * or not.
 */
async function reportingBranches(request: FastifyRequest): Promise<string[] | null> {
  const header = request.headers['x-branch-id']
  const query = (request.query as Record<string, unknown> | undefined)?.branchId
  const requested =
    typeof header === 'string' && header.trim()
      ? header.trim()
      : typeof query === 'string' && query.trim()
        ? query.trim()
        : null

  return branches.reportingScope(request.tenancy, requested)
}

const yearEndSchema = z.object({
  fromDate: z.string().min(8),
  toDate: z.string().min(8),
})

export async function accountingRoutes(fastify: FastifyInstance) {
  const accountingService = new AccountingService()

  /**
   * A refused posting is the user's problem to fix — an unbalanced entry, a
   * closed period, a group account — and it must say which. Collapsing all of
   * them into 500 "Failed to create journal entry" is what made the old ledger
   * impossible to work with.
   */
  const fail = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    if (err instanceof BaseError && err.statusCode < 500) {
      // The domain refuses with a CODE (JOURNAL_ENTRY_UNBALANCED,
      // ACCOUNTING_PERIOD_LOCKED, …), never with a sentence. The client turns
      // that code into a message in the user's own language; a string built
      // here would be untranslatable by the time it reached the screen.
      const domainCode = /^[A-Z][A-Z_]{6,}/.exec(err.message)?.[0]
      return reply
        .code(err.statusCode)
        .send({ error: err.message, code: domainCode ?? err.name, detail: err.message })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: fallback })
  }

  // ─── GET /accounts ─────────────────────────────────────
  fastify.get(
    '/accounts',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('ledger.read'),
        cacheMiddleware({ scope: 'workspace', ttl: 120, keyPrefix: 'accounts' }),
      ],
      schema: {
        querystring: toJsonSchema(listQuerySchema),
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await accountingService.listAccounts(request.tenancy))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch accounts')
      }
    },
  )

  // ─── POST /accounts ────────────────────────────────────
  fastify.post(
    '/accounts',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('account.manage')],
      schema: {
        body: toJsonSchema(createAccountSchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createAccountSchema.parse(request.body)
        const account = await accountingService.createAccount(request.tenancy, data)
        return reply.code(201).send(account)
      } catch (err) {
        return fail(reply, err, 'Failed to create account')
      }
    },
  )

  // ─── PATCH /accounts/:id ───────────────────────────────
  fastify.patch(
    '/accounts/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('account.manage')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const data = updateAccountSchema.parse({ ...(request.body as object), id })
        return reply.send(await accountingService.updateAccount(request.tenancy, id, data))
      } catch (err) {
        return fail(reply, err, 'Failed to update account')
      }
    },
  )

  // ─── GET /journal ──────────────────────────────────────
  fastify.get(
    '/journal',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('ledger.read'),
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'journal' }),
      ],
      schema: {
        querystring: toJsonSchema(listQuerySchema),
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { limit, status } = request.query as { limit?: string; status?: string }
        const entries = await accountingService.listJournalEntries(request.tenancy, {
          limit: limit ? Number(limit) : undefined,
          status,
        })
        return reply.send(entries)
      } catch (err) {
        return fail(reply, err, 'Failed to fetch journal entries')
      }
    },
  )

  // ─── GET /journal/:id ──────────────────────────────────
  fastify.get(
    '/journal/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('ledger.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await accountingService.getJournalEntry(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch journal entry')
      }
    },
  )

  // ─── POST /journal ─────────────────────────────────────
  fastify.post(
    '/journal',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('ledger.post')],
      schema: {
        body: toJsonSchema(createJournalEntrySchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createJournalEntrySchema.parse(request.body)
        const { status } = request.query as { status?: 'draft' | 'posted' }
        // A retried submit (lost response, double click) returns the same
        // entry instead of posting it twice — see createJournalEntry.
        const entry = await accountingService.createJournalEntry(request.tenancy, data, {
          status,
          idempotencyKey: readClientRequestId(request),
        })
        return reply.code(201).send(entry)
      } catch (err) {
        return fail(reply, err, 'Failed to create journal entry')
      }
    },
  )

  // ─── POST /journal/:id/post ────────────────────────────
  fastify.post(
    '/journal/:id/post',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('ledger.post')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await accountingService.postDraft(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to post journal entry')
      }
    },
  )

  // ─── POST /journal/:id/reverse ─────────────────────────
  // There is deliberately no PATCH or DELETE for a posted entry.
  fastify.post(
    '/journal/:id/reverse',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('ledger.reverse')],
      schema: {
        body: toJsonSchema(reverseJournalEntrySchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = reverseJournalEntrySchema.parse(request.body)
        const { sodOverrideReason } = (request.body ?? {}) as { sodOverrideReason?: string }
        const entry = await accountingService.reverseJournalEntry(request.tenancy, id, {
          ...body,
          ...(sodOverrideReason ? { override: { reason: sodOverrideReason } } : {}),
        })
        return reply.code(201).send(entry)
      } catch (err) {
        return fail(reply, err, 'Failed to reverse journal entry')
      }
    },
  )

  // ─── GET/PUT /period-lock ──────────────────────────────
  fastify.get(
    '/period-lock',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('ledger.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send((await accountingService.getPeriodLock(request.tenancy)) ?? null)
      } catch (err) {
        return fail(reply, err, 'Failed to read the period lock')
      }
    },
  )

  fastify.put(
    '/period-lock',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('ledger.lock_period')],
      schema: {
        body: toJsonSchema(periodLockSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { lockedUntil, reason } = periodLockSchema.parse(request.body)
        const lock = await accountingService.setPeriodLock(
          request.tenancy,
          lockedUntil,
          reason ?? '',
        )
        return reply.send(lock)
      } catch (err) {
        return fail(reply, err, 'Failed to set the period lock')
      }
    },
  )

  // ─── GET /trial-balance ────────────────────────────────
  fastify.get(
    '/trial-balance',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('ledger.read'),
        cacheMiddleware({ scope: 'workspace', ttl: 120, keyPrefix: 'trial-balance' }),
      ],
      schema: {
        querystring: toJsonSchema(dateQuerySchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { date, fromDate } = request.query as { date?: string; fromDate?: string }
        const result = await accountingService.getTrialBalance(request.tenancy, {
          fromDate,
          toDate: date ?? today(),
          branchIds: await reportingBranches(request),
        })
        return reply.send(result)
      } catch (err) {
        return fail(reply, err, 'Failed to fetch trial balance')
      }
    },
  )

  // ─── GET /balance-sheet ────────────────────────────────
  fastify.get(
    '/balance-sheet',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('ledger.read'),
        cacheMiddleware({ scope: 'workspace', ttl: 120, keyPrefix: 'balance-sheet' }),
      ],
      schema: {
        querystring: toJsonSchema(dateQuerySchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { date } = request.query as { date?: string }
        return reply.send(
          await accountingService.getBalanceSheet(
            request.tenancy,
            date ?? today(),
            await reportingBranches(request),
          ),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to fetch balance sheet')
      }
    },
  )

  // ─── GET /income-statement ─────────────────────────────
  fastify.get(
    '/income-statement',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('ledger.read'),
        cacheMiddleware({ scope: 'workspace', ttl: 120, keyPrefix: 'income-statement' }),
      ],
      schema: {
        querystring: toJsonSchema(incomeStatementQuerySchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { from, to } = request.query as { from: string; to: string }
        return reply.send(
          await accountingService.getIncomeStatement(
            request.tenancy,
            from,
            to,
            await reportingBranches(request),
          ),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to fetch income statement')
      }
    },
  )

  // ─── GET /profit-report ────────────────────────────────
  // Request #91. Not cached: the range and currency are the user's choice and
  // the figures move with every invoice.
  fastify.get(
    '/profit-report',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = z
          .object({
            from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            currency: z.string().min(3).max(8),
          })
          .parse(request.query)
        return reply.send(
          await accountingService.getProfitReport(
            request.tenancy,
            query.from,
            query.to,
            query.currency,
          ),
        )
      } catch (err) {
        if (err instanceof z.ZodError)
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        return fail(reply, err, 'Failed to build the profit report')
      }
    },
  )

  // ─── GET /profit-report/by-currency ─────────────────────
  // One report per currency with documents in the range (plus the primary
  // one), never summed across currencies. Not cached, like /profit-report.
  fastify.get(
    '/profit-report/by-currency',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = z
          .object({
            from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            currency: z.string().min(3).max(8),
          })
          .parse(request.query)
        return reply.send(
          await accountingService.getProfitReportsByCurrency(
            request.tenancy,
            query.from,
            query.to,
            query.currency,
          ),
        )
      } catch (err) {
        if (err instanceof z.ZodError)
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        return fail(reply, err, 'Failed to build the profit reports')
      }
    },
  )

  // ─── GET /cash-flow ────────────────────────────────────
  fastify.get(
    '/cash-flow',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
        cacheMiddleware({ scope: 'workspace', ttl: 120, keyPrefix: 'cash-flow' }),
      ],
      schema: {
        querystring: toJsonSchema(dateRangeQuerySchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { startDate, endDate } = request.query as { startDate: string; endDate: string }
        return reply.send(await accountingService.getCashFlow(request.tenancy, startDate, endDate))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch cash flow')
      }
    },
  )

  // ─── GET /customer-debt ────────────────────────────────
  fastify.get(
    '/customer-debt',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.operational.read'),
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'customer-debt' }),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await accountingService.getCustomerDebtReport(request.tenancy))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch customer debt report')
      }
    },
  )

  // ─── GET /general-ledger ─────────────────────────────────
  //
  // The lines behind one number. A trial balance that says an account holds
  // 412,900 is only half a report until you can ask "made up of what" — and
  // until now that meant opening the journal and filtering it by hand.
  fastify.get(
    '/general-ledger',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { accountId, fromDate, toDate } = request.query as {
          accountId?: string
          fromDate?: string
          toDate?: string
        }

        if (!accountId) return reply.code(400).send({ error: 'ACCOUNT_ID_REQUIRED' })

        return reply.send(
          await accountingService.generalLedger(
            request.tenancy,
            accountId,
            fromDate ?? null,
            toDate ?? null,
          ),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to read the general ledger')
      }
    },
  )

  // ─── GET /year-end/plan ──────────────────────────────────
  //
  // ─── GET /evidence/invoices/:id ──────────────────────────
  // «Why is this invoice's profit what it is?» — lines, the shared discount,
  // each cost with the layer and document it came from, the journal entry and
  // the payments (services/accounting/evidence.domain.ts). Same totals as the
  // profit report, by construction.
  fastify.get(
    '/evidence/invoices/:id',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await accountingService.explainInvoiceProfit(request.tenancy, id))
      } catch (err) {
        return fail(reply, err, 'Failed to explain the invoice')
      }
    },
  )

  // ─── GET /evidence/products/:id ──────────────────────────
  // A product's money journey in one currency: bought, sold, on hand, profit.
  fastify.get(
    '/evidence/products/:id',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const { fromDate, toDate, currency } = request.query as {
          fromDate?: string
          toDate?: string
          currency?: string
        }
        if (!fromDate || !toDate) return reply.code(400).send({ error: 'DATE_RANGE_REQUIRED' })
        if (!currency || !/^[A-Z]{3}$/.test(currency)) {
          return reply.code(400).send({ error: 'CURRENCY_REQUIRED' })
        }
        return reply.send(
          await accountingService.productJourney(request.tenancy, id, fromDate, toDate, currency),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to build the product journey')
      }
    },
  )

  // What closing the year WOULD post. GET, and free of side effects, so an
  // accountant can look as often as they like before approving it.
  fastify.get(
    '/year-end/plan',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { fromDate, toDate } = request.query as { fromDate?: string; toDate?: string }
        if (!fromDate || !toDate) return reply.code(400).send({ error: 'DATE_RANGE_REQUIRED' })

        return reply.send(
          await accountingService.planYearEndClose(request.tenancy, fromDate, toDate),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to plan the year-end close')
      }
    },
  )

  // ─── POST /year-end/close ────────────────────────────────
  //
  // ⚠️ Guarded with `ledger.lock_period`, not `ledger.post`.
  //
  // Closing a year is the same kind of act as locking a period: it decides
  // that a year's figures are final. A manager posts entries all day; only an
  // owner declares a year over.
  fastify.post(
    '/year-end/close',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('ledger.lock_period')],
      schema: { body: toJsonSchema(yearEndSchema), response: { 201: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = yearEndSchema.parse(request.body)
        return reply
          .code(201)
          .send(
            await accountingService.postYearEndClose(request.tenancy, body.fromDate, body.toDate),
          )
      } catch (err) {
        return fail(reply, err, 'Failed to close the year')
      }
    },
  )
}
