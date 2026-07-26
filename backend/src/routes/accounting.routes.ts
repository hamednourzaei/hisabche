// ============================================
// backend/src/routes/accounting.routes.ts
// FIXED: Removed /api prefix — now registered with
// prefix: '/api/accounting' in index.ts, matching
// what the frontend hooks request.
// Also fixed query schemas to accept limit & date
// params that the frontend actually sends.
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  createAccountSchema,
  updateAccountSchema,
  createJournalEntrySchema,
} from '@hisabche/validation'
import { AccountingService } from '../services/accounting.service'
import { authenticate } from '../middleware/auth.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

// ✅ Common query params that frontend sends
const listQuerySchema = z.object({
  limit: z.string().optional(),
  cursor: z.string().optional(),
})

const dateQuerySchema = z.object({
  date: z.string().default(new Date().toISOString()),
  limit: z.string().optional(),
})

const dateRangeQuerySchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
})

const incomeStatementQuerySchema = z.object({
  fromDate: z.string(),
  toDate: z.string(),
})

export async function accountingRoutes(fastify: FastifyInstance) {
  const accountingService = new AccountingService()

  // ─── GET /accounts ─────────────────────────────────────
  fastify.get('/accounts', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 120, keyPrefix: 'accounts' })],
    schema: {
      querystring: toJsonSchema(listQuerySchema),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const accounts = await accountingService.listAccounts(request.userId)
      return reply.send(accounts)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch accounts' })
    }
  })

  // ─── POST /accounts ────────────────────────────────────
  fastify.post('/accounts', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createAccountSchema),
      response: { 201: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createAccountSchema.parse(request.body)
      const account = await accountingService.createAccount(request.userId, data)
      await clearCache('accounts:*')
      return reply.code(201).send(account)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create account' })
    }
  })

  // ─── GET /journal ──────────────────────────────────────
  fastify.get('/journal', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 60, keyPrefix: 'journal' })],
    schema: {
      querystring: toJsonSchema(listQuerySchema),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const entries = await accountingService.listJournalEntries(request.userId)
      return reply.send(entries)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch journal entries' })
    }
  })

  // ─── POST /journal ─────────────────────────────────────
  fastify.post('/journal', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createJournalEntrySchema),
      response: { 201: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createJournalEntrySchema.parse(request.body)
      const entry = await accountingService.createJournalEntry(request.userId, data)
      await clearCache('journal:*')
      return reply.code(201).send(entry)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create journal entry' })
    }
  })

  // ─── GET /trial-balance ────────────────────────────────
  fastify.get('/trial-balance', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 300, keyPrefix: 'trial-balance' })],
    schema: {
      querystring: toJsonSchema(dateQuerySchema),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { date } = request.query as { date: string }
      const trialBalance = await accountingService.getTrialBalance(request.userId, date)
      return reply.send(trialBalance)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch trial balance' })
    }
  })

  // ─── GET /balance-sheet ────────────────────────────────
  fastify.get('/balance-sheet', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 300, keyPrefix: 'balance-sheet' })],
    schema: {
      querystring: toJsonSchema(dateQuerySchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { date } = request.query as { date: string }
      const balanceSheet = await accountingService.getBalanceSheet(request.userId, date)
      return reply.send(balanceSheet)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch balance sheet' })
    }
  })

  // ─── GET /income-statement ─────────────────────────────
fastify.get('/income-statement', {
  preHandler: [authenticate, cacheMiddleware({ ttl: 300, keyPrefix: 'income-statement' })],
  schema: {
    querystring: toJsonSchema(z.object({
      from: z.string(),
      to: z.string(),
      limit: z.string().optional(),
    })),
    response: { 200: toJsonSchema(z.any()) },
  },
}, async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { from, to } = request.query as { from: string; to: string }
    const incomeStatement = await accountingService.getIncomeStatement(request.userId, from, to)
    return reply.send(incomeStatement)
  } catch (err) {
    fastify.log.error(err)
    return reply.code(500).send({ error: 'Failed to fetch income statement' })
  }
})

  // ─── GET /cash-flow ────────────────────────────────────
  fastify.get('/cash-flow', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 120, keyPrefix: 'cash-flow' })],
    schema: {
      querystring: toJsonSchema(dateRangeQuerySchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { startDate, endDate } = request.query as { startDate: string; endDate: string }
      const result = await accountingService.getCashFlow(request.userId, startDate, endDate)
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch cash flow' })
    }
  })

  // ─── GET /customer-debt ────────────────────────────────
  fastify.get('/customer-debt', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 60, keyPrefix: 'customer-debt' })],
    schema: {
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await accountingService.getCustomerDebtReport(request.userId)
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch customer debt report' })
    }
  })
}