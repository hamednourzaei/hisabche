// ============================================
// backend/src/routes/ai-chat.routes.ts
//
// T13 — the chat endpoint, and the admin configuration behind it.
//
// ---------------------------------------------------------------------------
// ⚠️ THE API KEY IS NEVER IN A RESPONSE BODY ON ANY ROUTE HERE.
//
// `GET /api/ai/config` returns `hasApiKey: boolean`. Not a masked key, not the
// last four characters. A masked key is still part of a secret plus proof the
// rest exists, and it invites a UI to render something it should not hold.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { AiChatService } from '../services/ai/ai-chat.service'
import { AiQuotaService } from '../services/ai/ai-quota.service'
import { AiSettingsService } from '../services/ai/ai-settings.service'

// instantiates recursively over the schema type; naming it `ZodTypeAny` makes
// the compiler unfold that and hit its depth limit. Every other route file in
// this repo takes the same escape for the same reason.
const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' }) as Record<string, unknown>
  delete result.$schema
  return result
}

const askSchema = z.object({
  // Capped: the question is concatenated into a prompt that is billed by the
  // token, and an unbounded field is a way to spend the owner's money.
  question: z.string().trim().min(1).max(2000),
})

const configSchema = z.object({
  provider: z.enum(['anthropic', 'openai']),
  baseUrl: z.string().url().nullable().optional(),
  model: z.string().trim().min(1).max(120),
  /**
   * ⚠️ Optional, and an ABSENT key keeps the stored one.
   *
   * The form cannot show the current key, so it submits an empty field
   * whenever the admin edits the model or the prompt. Writing that through
   * would erase the key on every unrelated edit.
   */
  apiKey: z.string().trim().min(1).optional(),
  systemPrompt: z.string().max(8000),
  topupContact: z.string().max(200),
  isEnabled: z.boolean(),
})

/**
 * ⚠️ THE WORKSPACE IS A URL PARAM, NOT A BODY FIELD.
 *
 * Law 8 — «client-supplied tenancy is never trusted» — bans a workspace id in
 * a request body, and a guard enforces it. The ban is about a TENANT operation
 * choosing its own tenancy; this is a platform admin acting ON a workspace,
 * which is a different thing and is why `admin.routes.ts` already takes
 * `/api/admin/workspaces/:workspaceId/members` as a param.
 *
 * Following that convention rather than exempting this route keeps the guard
 * meaningful: the day someone writes a real body-supplied tenancy, it still
 * fails.
 */
const testSchema = configSchema.pick({ provider: true, baseUrl: true, model: true, apiKey: true })

const quotaSchema = z.object({
  // Null clears the override and returns the workspace to its plan allowance.
  // 0 is a real value meaning «none» and is NOT the same as null.
  monthlyLimit: z.number().int().min(0).nullable(),
  note: z.string().max(500).default(''),
})

const workspaceParam = z.object({ workspaceId: z.string().uuid() })

export async function aiChatRoutes(fastify: FastifyInstance) {
  const chat = new AiChatService()
  const settings = new AiSettingsService()
  const quota = new AiQuotaService()

  const fail = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    if (err instanceof BaseError && err.statusCode < 500) {
      const code = /^[A-Z][A-Z_]{4,}/.exec(err.message)?.[0]
      return reply.code(err.statusCode).send({ error: err.message, code: code ?? err.name })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: fallback })
  }

  // ─── POST /api/ai/ask ────────────────────────────────────────────────
  fastify.post(
    '/api/ai/ask',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: { body: toJsonSchema(askSchema) },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { question } = askSchema.parse(request.body)

        // ⚠️ The caller's own token is what makes the reporting views return
        // only their workspace. Not `request.tenancy.workspaceId` — the views
        // take no workspace parameter, by design.
        const result = await chat.ask(request.tenancy, request.accessToken, question)
        return reply.send(result)
      } catch (err) {
        // Out of allowance is not an error to hide: the client shows the
        // top-up contact, so it needs that contact with the refusal.
        if (err instanceof BaseError && err.message.startsWith('AI_QUOTA_EXCEEDED')) {
          const status = await settings.getStatus()
          return reply.code(429).send({
            error: 'AI_QUOTA_EXCEEDED',
            code: 'AI_QUOTA_EXCEEDED',
            topupContact: status?.topupContact ?? '',
            quota: await quota.status(request.tenancy),
          })
        }
        return fail(reply, err, 'Failed to answer the question')
      }
    },
  )

  // ─── GET /api/ai/quota ───────────────────────────────────────────────
  fastify.get(
    '/api/ai/quota',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const status = await settings.getStatus()
        return reply.send({
          quota: await quota.status(request.tenancy),
          // Whether the button should appear at all.
          isConfigured: Boolean(status?.isEnabled && status.hasApiKey),
          topupContact: status?.topupContact ?? '',
        })
      } catch (err) {
        return fail(reply, err, 'Failed to read the AI quota')
      }
    },
  )

  // ─── Platform admin ──────────────────────────────────────────────────
  //
  // `platformAdminGuard` is the existing gate for owner-level operations.
  // A workspace role — even `owner` — must not reach these: the API key bills
  // the product owner, not the workspace, so `requireWorkspaceContext` plus a
  // role check would be the wrong boundary entirely.
  const adminOnly = [authenticate, platformAdminGuard]

  fastify.get(
    '/api/ai/config',
    { preHandler: adminOnly },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        // `getStatus`, never `getConfig`. The latter carries the key.
        return reply.send(await settings.getStatus())
      } catch (err) {
        return fail(reply, err, 'Failed to read the AI configuration')
      }
    },
  )

  fastify.put(
    '/api/ai/config',
    { preHandler: adminOnly, schema: { body: toJsonSchema(configSchema) } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = configSchema.parse(request.body)
        // Rebuilt rather than spread: `exactOptionalPropertyTypes` treats an
        // explicitly-undefined `baseUrl` as different from an absent one, and
        // the service's contract is «absent means null».
        return reply.send(
          await settings.save(request.userId, {
            provider: body.provider,
            baseUrl: body.baseUrl ?? null,
            model: body.model,
            ...(body.apiKey ? { apiKey: body.apiKey } : {}),
            systemPrompt: body.systemPrompt,
            topupContact: body.topupContact,
            isEnabled: body.isEnabled,
          }),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to save the AI configuration')
      }
    },
  )

  // The admin's «test» button: one tiny real call with what is in the form.
  // Nothing is saved. An empty key field means «the stored key», exactly as
  // on save.
  fastify.post(
    '/api/ai/config/test',
    { preHandler: adminOnly, schema: { body: toJsonSchema(testSchema) } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = testSchema.parse(request.body)
        const apiKey = body.apiKey ?? (await settings.getStoredApiKey())
        if (!apiKey) {
          return reply.code(400).send({ error: 'AI_KEY_MISSING', code: 'AI_KEY_MISSING' })
        }
        return reply.send(
          await chat.testConnection({
            provider: body.provider,
            baseUrl: body.baseUrl ?? null,
            model: body.model,
            apiKey,
            systemPrompt: '',
            topupContact: '',
            isEnabled: true,
          }),
        )
      } catch (err) {
        return fail(reply, err, 'Failed to test the AI configuration')
      }
    },
  )

  fastify.put(
    '/api/ai/quota/:workspaceId',
    { preHandler: adminOnly, schema: { body: toJsonSchema(quotaSchema) } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { workspaceId } = workspaceParam.parse(request.params)
        const body = quotaSchema.parse(request.body)
        await quota.setOverride(request.userId, workspaceId, body.monthlyLimit, body.note)
        return reply.send({ ok: true })
      } catch (err) {
        return fail(reply, err, 'Failed to save the AI quota')
      }
    },
  )
}
