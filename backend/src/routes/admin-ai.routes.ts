// ============================================
// backend/src/routes/admin-ai.routes.ts
//
// V63 · A — the AI tab's reads and writes.
//
//   GET    /api/admin/ai/fallbacks        ordered fallback list
//   PUT    /api/admin/ai/fallbacks        replace it (step-up)
//   GET    /api/admin/ai/prices           per-model price table
//   PUT    /api/admin/ai/prices           upsert one price (step-up)
//   DELETE /api/admin/ai/prices/:id       remove one price (step-up)
//   GET    /api/admin/ai/usage            usage/cost over a window
//   GET    /api/admin/ai/budgets          ceilings + month-to-date spend
//   PUT    /api/admin/ai/budgets          the platform-wide ceiling (step-up)
//   PUT    /api/admin/ai/budgets/workspace/:workspaceId
//                                         one workspace's ceiling (step-up)
//   DELETE /api/admin/ai/budgets/:id      remove one ceiling (step-up)
//   GET    /api/admin/ai/prompts          append-only prompt history
//   GET    /api/admin/ai/audit            AI configuration audit trail
//
// ⚠️ NO ROUTE HERE READS, RETURNS OR ACCEPTS THE PROVIDER KEY. The key is
// still configured through `/api/ai/config` (S-1 chain) and lives in Vault;
// this file deals with what the key produces — order, price, spend, history.
//
// ⚠️ MONEY IS INTEGER MICROS. A ceiling or a price arrives as an integer and
// is stored as one. There is no `/100` anywhere on this path and no float.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { adminRoute } from '../middleware/admin-rbac.middleware'
import { AdminSecurityService } from '../services/admin/admin-security.service'
import {
  AI_USAGE_RANGES,
  AiAdminService,
  usageWindow,
  type AiUsageRange,
} from '../services/admin/admin-ai.service'

const providerSchema = z.enum(['anthropic', 'openai'])
const currencySchema = z.string().regex(/^[A-Za-z]{3}$/, 'a three-letter currency code')
const microsSchema = z.number().int().min(0)

const fallbacksBody = z.object({
  entries: z
    .array(
      z.object({
        position: z.number().int().min(1).max(9),
        provider: providerSchema,
        model: z.string().trim().min(1).max(120),
        baseUrl: z.string().trim().max(300).nullable().optional(),
        timeoutMs: z.number().int().min(1000).max(300000),
        isEnabled: z.boolean(),
      }),
    )
    .max(9),
})

const priceBody = z.object({
  provider: providerSchema,
  model: z.string().trim().min(1).max(120),
  currency: currencySchema,
  inputMicrosPerMillion: microsSchema,
  outputMicrosPerMillion: microsSchema,
})

const usageQuery = z.object({
  range: z.enum(AI_USAGE_RANGES).default('7d'),
})

const budgetBody = z.object({
  currency: currencySchema,
  monthlyLimitMicros: z.number().int().positive(),
  alertPercent: z.number().int().min(1).max(100).default(80),
})

const idParam = z.object({ id: z.string().uuid() })
const workspaceParam = z.object({ workspaceId: z.string().uuid() })

function handleError(reply: FastifyReply, err: unknown): FastifyReply {
  const e = err as { statusCode?: number; code?: string; message?: string } | undefined
  const status = typeof e?.statusCode === 'number' ? e.statusCode : 500
  const message = status < 500 && e?.message ? e.message : 'Internal server error'
  return reply.code(status).send({ error: message, code: e?.code ?? 'ERROR' })
}

/**
 * Record the change, not the content.
 *
 * ⚠️ Details carry counts, positions, models and currencies — never a key,
 * never a base URL (which can embed a token), never the prompt text.
 */
async function audit(
  request: FastifyRequest,
  eventType: string,
  details: Record<string, unknown>,
): Promise<void> {
  await AdminSecurityService.logSecurityEvent({
    eventType,
    adminEmail: request.user?.email ?? null,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'] ?? null,
    details,
  })
}

export default async function adminAiRoutes(fastify: FastifyInstance) {
  const read = adminRoute('product.ai.read')
  const write = adminRoute('product.ai.write', { stepUp: true })

  // ─── Fallback ──────────────────────────────────────────────────────
  fastify.get('/api/admin/ai/fallbacks', { preHandler: read }, async (_req, reply) => {
    try {
      return reply.send({ fallbacks: await AiAdminService.listFallbacks() })
    } catch (err) {
      return handleError(reply, err)
    }
  })

  fastify.put('/api/admin/ai/fallbacks', { preHandler: write }, async (req, reply) => {
    const body = fallbacksBody.parse(req.body)
    try {
      const fallbacks = await AiAdminService.replaceFallbacks(
        body.entries.map((entry) => ({
          position: entry.position,
          provider: entry.provider,
          model: entry.model,
          baseUrl: entry.baseUrl ?? null,
          timeoutMs: entry.timeoutMs,
          isEnabled: entry.isEnabled,
        })),
        req.user?.email ?? 'admin',
      )
      await audit(req, 'AI_FALLBACKS_UPDATED', {
        entries: fallbacks.map((entry) => ({
          position: entry.position,
          provider: entry.provider,
          model: entry.model,
          isEnabled: entry.isEnabled,
        })),
      })
      return reply.send({ fallbacks })
    } catch (err) {
      return handleError(reply, err)
    }
  })

  // ─── Prices ────────────────────────────────────────────────────────
  fastify.get('/api/admin/ai/prices', { preHandler: read }, async (_req, reply) => {
    try {
      return reply.send({ prices: await AiAdminService.listPrices() })
    } catch (err) {
      return handleError(reply, err)
    }
  })

  fastify.put('/api/admin/ai/prices', { preHandler: write }, async (req, reply) => {
    const body = priceBody.parse(req.body)
    try {
      const prices = await AiAdminService.savePrice(body, req.user?.email ?? 'admin')
      await audit(req, 'AI_PRICE_SAVED', {
        provider: body.provider,
        model: body.model,
        currency: body.currency.toUpperCase(),
      })
      return reply.send({ prices })
    } catch (err) {
      return handleError(reply, err)
    }
  })

  fastify.delete('/api/admin/ai/prices/:id', { preHandler: write }, async (req, reply) => {
    const { id } = idParam.parse(req.params)
    try {
      await AiAdminService.deletePrice(id)
      await audit(req, 'AI_PRICE_DELETED', { id })
      return reply.send({ success: true })
    } catch (err) {
      return handleError(reply, err)
    }
  })

  // ─── Usage ─────────────────────────────────────────────────────────
  fastify.get('/api/admin/ai/usage', { preHandler: read }, async (req, reply) => {
    const { range } = usageQuery.parse(req.query)
    try {
      const window = usageWindow(range as AiUsageRange)
      return reply.send({
        range,
        since: window.since.toISOString(),
        until: window.until.toISOString(),
        rows: await AiAdminService.usage(window.since, window.until),
      })
    } catch (err) {
      return handleError(reply, err)
    }
  })

  // ─── Budgets ───────────────────────────────────────────────────────
  fastify.get('/api/admin/ai/budgets', { preHandler: read }, async (_req, reply) => {
    try {
      return reply.send({ budgets: await AiAdminService.listBudgets() })
    } catch (err) {
      return handleError(reply, err)
    }
  })

  fastify.put('/api/admin/ai/budgets', { preHandler: write }, async (req, reply) => {
    const body = budgetBody.parse(req.body)
    try {
      const budgets = await AiAdminService.saveBudget(
        {
          scope: 'platform',
          workspaceId: null,
          currency: body.currency,
          monthlyLimitMicros: body.monthlyLimitMicros,
          alertPercent: body.alertPercent,
        },
        req.user?.email ?? 'admin',
      )
      await audit(req, 'AI_BUDGET_SAVED', {
        scope: 'platform',
        currency: body.currency.toUpperCase(),
        alertPercent: body.alertPercent,
      })
      return reply.send({ budgets })
    } catch (err) {
      return handleError(reply, err)
    }
  })

  // ⚠️ The workspace comes from the PATH, not from the body. A workspace id in
  // a body is how a tenancy filter gets bypassed (constitution-guards), and the
  // console's other tenant-scoped admin routes take it the same way.
  fastify.put(
    '/api/admin/ai/budgets/workspace/:workspaceId',
    { preHandler: write },
    async (req, reply) => {
      const { workspaceId } = workspaceParam.parse(req.params)
      const body = budgetBody.parse(req.body)
      try {
        const budgets = await AiAdminService.saveBudget(
          {
            scope: 'workspace',
            workspaceId,
            currency: body.currency,
            monthlyLimitMicros: body.monthlyLimitMicros,
            alertPercent: body.alertPercent,
          },
          req.user?.email ?? 'admin',
        )
        await audit(req, 'AI_BUDGET_SAVED', {
          scope: 'workspace',
          workspaceId,
          currency: body.currency.toUpperCase(),
          alertPercent: body.alertPercent,
        })
        return reply.send({ budgets })
      } catch (err) {
        return handleError(reply, err)
      }
    },
  )

  fastify.delete('/api/admin/ai/budgets/:id', { preHandler: write }, async (req, reply) => {
    const { id } = idParam.parse(req.params)
    try {
      await AiAdminService.deleteBudget(id)
      await audit(req, 'AI_BUDGET_DELETED', { id })
      return reply.send({ success: true })
    } catch (err) {
      return handleError(reply, err)
    }
  })

  // ─── Prompt history and audit ──────────────────────────────────────
  fastify.get('/api/admin/ai/prompts', { preHandler: read }, async (_req, reply) => {
    try {
      return reply.send({ versions: await AiAdminService.listPromptVersions() })
    } catch (err) {
      return handleError(reply, err)
    }
  })

  fastify.get('/api/admin/ai/audit', { preHandler: read }, async (_req, reply) => {
    try {
      return reply.send({ events: await AiAdminService.listAudit() })
    } catch (err) {
      return handleError(reply, err)
    }
  })
}
