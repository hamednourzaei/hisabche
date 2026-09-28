// ============================================
// backend/src/routes/oauth.routes.ts
//
// Publisher   (workspace.manage)  /api/developer/apps …
// Installer   (workspace.manage)  GET|POST /api/oauth/authorize, /api/developer/installed-apps
// Anyone in a workspace           GET /api/marketplace/apps
// The app's server — PUBLIC       POST /api/oauth/token   (RFC 6749 §4.1.3 + PKCE)
// Platform admin                  /api/admin/oauth-apps …
//
// ⚠️ None of these is open to an API key (API_ROUTE_SCOPES): a key cannot
// register apps, approve its own installation, or mint tokens.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  OAUTH_APP_STATUSES,
  oauthAppCreateSchema,
  oauthAppUpdateSchema,
} from '@hisabche/validation'

import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'
import { NotConfiguredError } from '../services/developer/developer.repository'
import { OAuthError, oauthService, type OAuthService } from '../services/oauth/oauth.service'

const idParams = z.object({ id: z.string().uuid() })
const authorizeQuery = z.object({
  client_id: z.string().min(1).max(100),
  redirect_uri: z.string().min(1).max(500),
  scope: z.string().min(1).max(500),
})
const approveBody = z
  .object({
    client_id: z.string().min(1).max(100),
    redirect_uri: z.string().min(1).max(500),
    scope: z.string().min(1).max(500),
    state: z.string().max(500).optional(),
    code_challenge: z.string().min(1).max(200),
    code_challenge_method: z.literal('S256'),
  })
  .strict()
const tokenBody = z.object({
  grant_type: z.string(),
  code: z.string().min(1).max(200),
  redirect_uri: z.string().min(1).max(500),
  client_id: z.string().min(1).max(100),
  client_secret: z.string().min(1).max(200),
  code_verifier: z.string().min(1).max(200),
})
const reviewBody = z
  .object({
    decision: z.enum(['published', 'rejected', 'suspended']),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
const reviewQuery = z.object({ status: z.enum(OAUTH_APP_STATUSES).default('in_review') })

export function buildOAuthRoutes(oauth: OAuthService) {
  return async function oauthRoutes(fastify: FastifyInstance) {
    // OAuth clients send the token request form-encoded (RFC 6749 §4.1.3).
    // Parsed here only — this plugin is encapsulated, the rest of the API is
    // untouched.
    fastify.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string' },
      (_req, body, done) => {
        done(null, Object.fromEntries(new URLSearchParams(String(body))))
      },
    )

    const manage = [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')]
    const member = [authenticate, requireWorkspaceContext]
    const admin = [authenticate, platformAdminGuard]

    const fail = (reply: FastifyReply, err: unknown) => {
      if (err instanceof z.ZodError)
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      if (err instanceof OAuthError)
        return reply.code(err.statusCode).send({ error: err.code, code: err.code })
      if (err instanceof NotConfiguredError) {
        return reply.code(503).send({ error: 'OAUTH_NOT_CONFIGURED', code: 'OAUTH_NOT_CONFIGURED' })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Internal Server Error' })
    }
    const handle =
      (fn: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>) =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          return await fn(request, reply)
        } catch (err) {
          return fail(reply, err)
        }
      }

    // ─── publisher ───────────────────────────────────────────────────────────

    fastify.get(
      '/api/developer/apps',
      { preHandler: manage },
      handle(async (request, reply) => reply.send({ data: await oauth.listApps(request.tenancy) })),
    )

    fastify.post(
      '/api/developer/apps',
      { preHandler: manage },
      handle(async (request, reply) =>
        reply
          .code(201)
          .send(await oauth.createApp(request.tenancy, oauthAppCreateSchema.parse(request.body))),
      ),
    )

    fastify.patch(
      '/api/developer/apps/:id',
      { preHandler: manage },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        return reply.send(
          await oauth.updateApp(request.tenancy, id, oauthAppUpdateSchema.parse(request.body)),
        )
      }),
    )

    fastify.post(
      '/api/developer/apps/:id/submit',
      { preHandler: manage },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        return reply.send(await oauth.submitApp(request.tenancy, id))
      }),
    )

    fastify.post(
      '/api/developer/apps/:id/rotate-secret',
      { preHandler: manage },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        return reply.send(await oauth.rotateSecret(request.tenancy, id))
      }),
    )

    fastify.delete(
      '/api/developer/apps/:id',
      { preHandler: manage },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        await oauth.deleteApp(request.tenancy, id)
        return reply.code(204).send()
      }),
    )

    // ─── installer ───────────────────────────────────────────────────────────

    fastify.get(
      '/api/oauth/authorize',
      { preHandler: manage },
      handle(async (request, reply) => {
        const q = authorizeQuery.parse(request.query)
        return reply.send(
          await oauth.consentPreview(request.tenancy, {
            clientId: q.client_id,
            redirectUri: q.redirect_uri,
            scope: q.scope,
          }),
        )
      }),
    )

    fastify.post(
      '/api/oauth/authorize',
      { preHandler: manage },
      handle(async (request, reply) => {
        const b = approveBody.parse(request.body)
        return reply.send(
          await oauth.approve(request.tenancy, {
            clientId: b.client_id,
            redirectUri: b.redirect_uri,
            scope: b.scope,
            state: b.state,
            codeChallenge: b.code_challenge,
          }),
        )
      }),
    )

    fastify.get(
      '/api/developer/installed-apps',
      { preHandler: manage },
      handle(async (request, reply) =>
        reply.send({ data: await oauth.installedApps(request.tenancy) }),
      ),
    )

    fastify.get(
      '/api/marketplace/apps',
      { preHandler: member },
      handle(async (_request, reply) => reply.send({ data: await oauth.marketplace() })),
    )

    // ─── the app's server: PUBLIC ────────────────────────────────────────────

    fastify.post(
      '/api/oauth/token',
      { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
      async (request: FastifyRequest, reply: FastifyReply) => {
        // RFC 6749 §5.1: a token response is never cached.
        reply.header('Cache-Control', 'no-store').header('Pragma', 'no-cache')
        const parsed = tokenBody.safeParse(request.body)
        if (!parsed.success) {
          return reply
            .code(400)
            .send({ error: 'invalid_request', error_description: 'missing or malformed parameter' })
        }
        const b = parsed.data
        try {
          return reply.send(
            await oauth.exchange({
              grantType: b.grant_type,
              code: b.code,
              redirectUri: b.redirect_uri,
              clientId: b.client_id,
              clientSecret: b.client_secret,
              codeVerifier: b.code_verifier,
            }),
          )
        } catch (err) {
          if (err instanceof OAuthError && err.oauth) {
            return reply
              .code(err.statusCode)
              .send({ error: err.oauth, error_description: err.code })
          }
          return fail(reply, err)
        }
      },
    )

    // ─── platform review ─────────────────────────────────────────────────────

    fastify.get(
      '/api/admin/oauth-apps',
      { preHandler: admin },
      handle(async (request, reply) => {
        const { status } = reviewQuery.parse(request.query)
        return reply.send({ data: await oauth.listForReview(status) })
      }),
    )

    fastify.post(
      '/api/admin/oauth-apps/:id/review',
      { preHandler: admin },
      handle(async (request, reply) => {
        const { id } = idParams.parse(request.params)
        const { decision, note } = reviewBody.parse(request.body)
        return reply.send(await oauth.review(request.userId, id, decision, note ?? null))
      }),
    )
  }
}

export const oauthRoutes = buildOAuthRoutes(oauthService)
