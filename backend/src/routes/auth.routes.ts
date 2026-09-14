// ============================================
// backend/src/routes/auth.routes.ts
// FIXED: TypeScript error — signOut پارامتر string قبول نمی‌کند
// ============================================

import { createHash } from 'node:crypto'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  loginSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '@hisabche/validation'
import { createAuthClient, supabase } from '../db'
import { authenticate, invalidateAuthToken } from '../middleware/auth.middleware'
import { passwordResetService } from '../services/password-reset.service'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'
import {
  clearRefreshCookie,
  readRefreshCookie,
  sessionBody,
  wantsCookieTransport,
} from '../utils/refresh-cookie'

// ─── Types ──────────────────────────────────────────────────
type JsonSchema = Record<string, unknown>

interface SanitizedUser {
  id: string
  email: string
  /**
   * The caller's role in their workspace, or `null`.
   *
   * ⚠️ `null` MEANS «NOT UNAMBIGUOUS», NOT «NO ROLE». A user with several
   * memberships has several roles, and picking one here would be the same
   * fail-open guess `auth.middleware.ts` was fixed for. The client uses this
   * to colour a label and to decide whether to offer a settings link — never
   * to authorize anything, which the server does per request from
   * `request.tenancy.role`.
   */
  role: string | null
  fullName: string | null
  businessName: string | null
  avatarUrl: string | null
  createdAt: string
  onboardingCompleted: boolean
  businessTypes: string[]
  storeSize: string | null
  businessNote: string | null
}

// ─── Helper: toJsonSchema (دستی) ────────────────────────────

/**
 * Strip the wrappers that make a field optional so the inner type can be read.
 *
 * `z.any().optional()` is a ZodOptional around a ZodAny — without unwrapping,
 * the typeName is `ZodOptional` and every such field was typed as `string`.
 */
function unwrap(schema: any): { inner: any; optional: boolean; nullable: boolean } {
  let inner = schema
  let optional = false
  let nullable = false

  // `ZodEffects` wraps a schema carrying `.transform()`. Without unwrapping it,
  // the typeName is `ZodEffects`, `jsonTypeOf` returns undefined and the field
  // ends up unconstrained — harmless, but it also hid the union underneath, so
  // a nullable field was typed `string` and ajv rejected `null` with a 400
  // before the handler ever ran.
  while (
    inner?._def?.typeName === 'ZodOptional' ||
    inner?._def?.typeName === 'ZodNullable' ||
    inner?._def?.typeName === 'ZodDefault' ||
    inner?._def?.typeName === 'ZodEffects'
  ) {
    if (inner._def.typeName === 'ZodEffects') {
      inner = inner._def.schema
      continue
    }

    // A field with a default is always present in the output, so it is not
    // optional for serialization purposes — but it must still be unwrapped.
    // ⚠️ NULLABLE IS NOT OPTIONAL, AND THE DIFFERENCE IS VISIBLE ON THE WIRE.
    // fast-json-stringify serializes `null` against `{ type: 'string' }` as
    // `""` — it does not fail, it substitutes. So `businessName: null` («this
    // account never set one») reached the client as an empty string, which is
    // «they set it to nothing». The header could not tell the two apart, and
    // neither could the prompt that asks the owner to fill it in.
    if (inner._def.typeName === 'ZodNullable') nullable = true
    else if (inner._def.typeName !== 'ZodDefault') optional = true
    inner = inner._def.innerType
  }

  return { inner, optional, nullable }
}

function jsonTypeOf(typeName: string | undefined): string | undefined {
  switch (typeName) {
    case 'ZodString':
      return 'string'
    case 'ZodNumber':
      return 'number'
    case 'ZodBoolean':
      return 'boolean'
    case 'ZodArray':
      return 'array'
    case 'ZodObject':
      return 'object'
    // ZodAny/ZodUnknown deliberately get no `type` — constraining them to
    // `string` is what made `details` (an arbitrary validation payload)
    // unserializable.
    default:
      return undefined
  }
}

/**
 * ⚠️ IT RECURSES. IT DID NOT, AND THAT EMPTIED EVERY USER OBJECT.
 *
 * A nested `z.object()` used to produce `{ type: 'object' }` with NO
 * `properties`. Fastify hands the result to fast-json-stringify, which
 * serializes strictly from the schema and DROPS every field the schema does
 * not declare — so `{ user: { id, email, fullName, … } }` went out as
 *
 *     { "user": {} }
 *
 * from `POST /auth/login`, `GET /auth/me` and `PATCH /auth/profile` alike.
 *
 * Nothing failed. The token is a sibling of `user`, so sign-in worked, the
 * session persisted, and every request authenticated — while the client's
 * cached user had no id, no email and no name. The visible symptom was an
 * account menu with nothing in it but «خروج», and a header that could not show
 * which business you were in.
 *
 * ⚠️ THE SAME APPLIES TO ARRAYS. `z.array(z.object(...))` without `items`
 * serializes as `[]`, which is the identical failure wearing an empty list.
 */
function toJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  return describe(schema)
}

/** One zod node, as JSON Schema. Recursive — see `toJsonSchema`. */
function describe(schema: unknown): JsonSchema {
  const { inner, nullable } = unwrap(schema)
  const typeName = (inner as any)?._def?.typeName as string | undefined
  const type = jsonTypeOf(typeName)

  if (typeName === 'ZodObject') {
    const shape = ((inner as any).shape || {}) as Record<string, unknown>
    const required: string[] = []

    const properties = Object.fromEntries(
      Object.entries(shape).map(([key, value]) => {
        const { optional } = unwrap(value)
        // A key with a `.default()` is always present in the output, so it is
        // not optional for serialization even though it is for input.
        if (!optional) required.push(key)
        return [key, describe(value)]
      }),
    )

    return {
      type: 'object',
      properties,
      // Previously every key was listed as required, including `.optional()`
      // ones. On a response schema that made fast-json-stringify throw when an
      // optional field was absent — so a 400 validation error was serialized as
      // a 500, hiding the real status and the validation details from clients.
      required,
    }
  }

  if (typeName === 'ZodArray') {
    // Without `items` the array serializes as empty — the same defect as a
    // property-less object, one container out.
    return { type: 'array', items: describe((inner as any)._def?.type) }
  }

  const isEmail =
    typeName === 'ZodString' && (inner as any)._def?.checks?.some((c: any) => c.kind === 'email')

  // `ZodAny`/`ZodUnknown` deliberately get no `type`: constraining them to
  // `string` is what made `details` (an arbitrary validation payload)
  // unserializable.
  // A nullable field is declared as a union so `null` survives as `null`.
  // No `type` at all (ZodAny) stays unconstrained — adding 'null' there would
  // constrain it.
  const declared = type ? (nullable ? [type, 'null'] : type) : undefined

  return { ...(declared ? { type: declared } : {}), ...(isEmail ? { format: 'email' } : {}) }
}

// ─── Helper: Get profile from public.profiles ───────────────
async function getProfile(userId: string): Promise<{
  full_name: string | null
  business_name: string | null
  avatar_url: string | null
  onboarding_completed_at?: string | null
  business_types?: string[] | null
  store_size?: string | null
  business_note?: string | null
} | null> {
  const { data } = await supabase
    .from('profiles')
    // The onboarding columns come from docs/onboarding-server-state-migration.sql.
    // Selected together so a single round-trip answers 'has this account
    // finished setup', which the dashboard gate asks on every load.
    .select(
      'full_name, business_name, avatar_url, onboarding_completed_at, business_types, store_size, business_note',
    )
    .eq('id', userId)
    .single()

  return data
}

// ─── Helper: Sanitize user (ترکیب auth.users + profiles) ──
function sanitizeUser(
  authUser: any,
  profile?: {
    full_name: string | null
    business_name: string | null
    avatar_url: string | null
    onboarding_completed_at?: string | null
    business_types?: string[] | null
    store_size?: string | null
    business_note?: string | null
  } | null,
  // ⚠️ LAST, AND DEFAULTED. Four call sites pass `(user, profile)`; adding a
  // parameter anywhere but the end would have silently bound `profile` to it.
  role: string | null = null,
): SanitizedUser {
  return {
    id: authUser.id,
    email: authUser.email,
    role,
    fullName: profile?.full_name || authUser.user_metadata?.full_name || '',
    businessName: profile?.business_name || authUser.user_metadata?.business_name || null,
    avatarUrl: profile?.avatar_url || null,
    createdAt: authUser.created_at,
    // Authoritative onboarding state. The client used to keep this in
    // localStorage only, so clearing site data replayed the wizard.
    onboardingCompleted: Boolean(profile?.onboarding_completed_at),
    businessTypes: profile?.business_types ?? [],
    storeSize: profile?.store_size ?? null,
    businessNote: profile?.business_note ?? null,
  }
}

/**
 * The caller's role, ONLY when it is unambiguous.
 *
 * ⚠️ THIS IS FOR DISPLAY. It colours the «پنل مدیریت» label and decides whether
 * the sidebar offers a settings link. It authorizes NOTHING: every request is
 * authorized server-side from `request.tenancy.role`, resolved against the
 * workspace that request actually names. A role sent to a client is a claim the
 * client can edit.
 *
 * The rules are copied from `auth.middleware.ts` deliberately, because they are
 * the rules that matter: revoked and suspended memberships are excluded, and a
 * user with several memberships gets `null` rather than the first row — picking
 * one would be the arbitrary-choice defect that middleware was fixed for.
 */
async function resolveSoleRole(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('user_id', userId)
    .eq('has_access', true)
    .is('suspended_at', null)
    .order('joined_at', { ascending: true })

  // A failed lookup is «unknown», not «no role». Returning a role here on an
  // error would be a fail-open guess.
  if (error) return null

  return data?.length === 1 ? ((data[0] as any).role ?? null) : null
}

// ─── Routes ─────────────────────────────────────────────────
export async function authRoutes(fastify: FastifyInstance) {
  // ═══════════════════════════════════════════════════════
  // POST /api/auth/signup
  // ═══════════════════════════════════════════════════════
  fastify.post(
    '/api/auth/signup',
    {
      schema: {
        body: toJsonSchema(signUpSchema),
        response: {
          201: toJsonSchema(
            z.object({
              user: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                // ⚠️ DECLARED, OR IT IS DROPPED. fast-json-stringify emits
                // only what the schema names — this is the same omission that
                // sent `{ "user": {} }`.
                role: z.string().nullable(),
                fullName: z.string(),
                businessName: z.string().nullable(),
                createdAt: z.string().datetime(),
              }),
              token: z.string(),
              // ⚠️ DECLARED, OR DROPPED: without these two the login answer
              // never carried a refresh token, so renewal after an hour had
              // nothing to renew with and the session died with a 401.
              refreshToken: z.string().optional(),
              expiresAt: z.number().nullable().optional(),
            }),
          ),
          400: toJsonSchema(
            z.object({
              error: z.string(),
              details: z.any().optional(),
            }),
          ),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = signUpSchema.parse(request.body)

        // ۱. ایجاد کاربر در Supabase Auth
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: body.email,
          password: body.password,
          email_confirm: true,
          user_metadata: {
            full_name: body.fullName,
            business_name: body.businessName || null,
          },
        })

        if (createError || !newUser.user) {
          fastify.log.error(createError)
          if (createError?.message?.includes('already')) {
            return reply.code(400).send({ error: 'Email already registered' })
          }
          return reply.code(500).send({ error: 'Failed to create account' })
        }

        // ۲. اطمینان از وجود رکورد در profiles
        await supabase.from('profiles').upsert(
          {
            id: newUser.user.id,
            full_name: body.fullName,
            business_name: body.businessName || null,
          },
          { onConflict: 'id' },
        )

        // ۳. لاگین خودکار — دریافت توکن
        const { data: session, error: loginError } =
          await createAuthClient().auth.signInWithPassword({
            email: body.email,
            password: body.password,
          })

        if (loginError || !session.session) {
          fastify.log.error(loginError)
          return reply.code(500).send({ error: 'Account created but login failed' })
        }

        // ۴. برگشت user + token
        const profile = await getProfile(newUser.user.id)

        return reply.code(201).send({
          user: sanitizeUser(newUser.user, profile),
          ...sessionBody(request, reply, session.session),
        })
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Internal server error' })
      }
    },
  )

  // ═══════════════════════════════════════════════════════
  // POST /api/auth/refresh
  //
  // ⚠️ THERE WAS NO RENEWAL. Sign-in handed the browser a Supabase access token
  // (one hour) and nothing else, so an hour after login every request answered
  // 401 «Invalid or expired token» and the user was dropped to the login page
  // mid-work — the stream of 401s on billing, invoices, conflicts, analytics.
  // The refresh token is exchanged here for a new pair. Unauthenticated by
  // design: the refresh token IS the credential, and Supabase rotates it (a
  // used one cannot be replayed).
  // ═══════════════════════════════════════════════════════
  fastify.post(
    '/api/auth/refresh',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
          // ⚠️ NOT by IP. The server has no `trustProxy`, so behind the host's
          // proxy every user shares one address and an IP key would make 30
          // refreshes a minute the limit for EVERYONE — the hour mark of a busy
          // morning would lock people out. Keyed by a hash of the token itself:
          // one session cannot hammer the endpoint, and sessions do not share a
          // budget. The token is never used as the key in the clear.
          keyGenerator: (request: FastifyRequest) => {
            const token =
              (request.body as { refreshToken?: unknown } | undefined)?.refreshToken ??
              readRefreshCookie(request)
            return typeof token === 'string' && token.length > 0
              ? `refresh:${createHash('sha256').update(token).digest('hex').slice(0, 32)}`
              : `refresh:anonymous:${request.ip}`
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Body first: a web session from before the cookie existed still holds
      // its token in storage, sends it once, and is moved onto the cookie by
      // this very answer. After that the body is empty and the cookie speaks.
      const fromBody = (request.body as { refreshToken?: unknown } | undefined)?.refreshToken
      const candidate =
        typeof fromBody === 'string' && fromBody.length > 0
          ? fromBody
          : wantsCookieTransport(request)
            ? readRefreshCookie(request)
            : null
      const parsed = z.string().min(10).max(4096).safeParse(candidate)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Validation failed', code: 'REFRESH_TOKEN_REQUIRED' })
      }

      try {
        const { data, error } = await createAuthClient().auth.refreshSession({
          refresh_token: parsed.data,
        })
        if (error || !data.session) {
          // A dead cookie is removed rather than resent on every attempt.
          if (wantsCookieTransport(request)) clearRefreshCookie(reply)
          return reply.code(401).send({ error: 'Session expired', code: 'REFRESH_TOKEN_INVALID' })
        }
        return reply.send(sessionBody(request, reply, data.session))
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to refresh the session' })
      }
    },
  )

  // ═══════════════════════════════════════════════════════
  // POST /api/auth/login
  // ═══════════════════════════════════════════════════════
  fastify.post(
    '/api/auth/login',
    {
      schema: {
        body: toJsonSchema(loginSchema),
        response: {
          200: toJsonSchema(
            z.object({
              user: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                // ⚠️ DECLARED, OR IT IS DROPPED. fast-json-stringify emits
                // only what the schema names — this is the same omission that
                // sent `{ "user": {} }`.
                role: z.string().nullable(),
                fullName: z.string(),
                businessName: z.string().nullable(),
                createdAt: z.string().datetime(),
              }),
              token: z.string(),
              // ⚠️ DECLARED, OR DROPPED: the login answer never carried a
              // refresh token, so renewal had nothing to renew with.
              refreshToken: z.string().optional(),
              expiresAt: z.number().nullable().optional(),
            }),
          ),
          400: toJsonSchema(
            z.object({
              error: z.string(),
              details: z.any().optional(),
            }),
          ),
          401: toJsonSchema(z.object({ error: z.string() })),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = loginSchema.parse(request.body)

        const { data, error } = await createAuthClient().auth.signInWithPassword({
          email: body.email,
          password: body.password,
        })

        if (error || !data.session) {
          return reply.code(401).send({ error: 'Invalid email or password' })
        }

        // Resolved at sign-in too, so the header is right on the first paint
        // instead of correcting itself when /auth/me lands.
        const [profile, role] = await Promise.all([
          getProfile(data.user.id),
          resolveSoleRole(data.user.id),
        ])

        return reply.send({
          user: sanitizeUser(data.user, profile, role),
          ...sessionBody(request, reply, data.session),
        })
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Internal server error' })
      }
    },
  )

  // ═══════════════════════════════════════════════════════
  // POST /api/auth/logout
  // ═══════════════════════════════════════════════════════
  fastify.post(
    '/api/auth/logout',
    {
      // The cookie is cleared in onRequest — before the global auth hook and
      // `authenticate` — so it goes even when an expired access token is
      // refused: logging out must never leave the long-lived credential behind.
      onRequest: async (_request: FastifyRequest, reply: FastifyReply) => {
        clearRefreshCookie(reply)
      },
      preHandler: [authenticate],
      schema: {
        response: {
          200: toJsonSchema(z.object({ success: z.boolean() })),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // ═══════════════════════════════════════════════════════════════
        // ⚠️ LOGOUT USED TO REVOKE NOTHING AT ALL.
        //
        // It called `supabase.auth.signOut()` on the SERVICE-ROLE client —
        // a client that has never signed anyone in and holds no session, so
        // there was nothing for it to sign out of. The call succeeded and did
        // nothing. The user's access token stayed valid until it expired on
        // its own.
        //
        // Two things made that worse than it sounds:
        //
        //   1. `auth.middleware.ts` caches a verified token for up to an hour
        //      (`AUTH_CACHE_MAX_TTL_SECONDS`). Even a token revoked upstream
        //      kept being accepted from this backend's own cache.
        //   2. «Log out» on a shared or borrowed computer is exactly the
        //      moment a person believes they are safe.
        //
        // Both halves are now closed: the session is revoked at the identity
        // provider, AND this backend's memory of having verified that token is
        // dropped so the next request re-checks rather than trusting the cache.
        // ═══════════════════════════════════════════════════════════════
        const token = request.accessToken
        const userId = request.userId

        // `admin.signOut(jwt)` takes the caller's own token and revokes the
        // session behind it. Failure is logged, never fatal — a logout that
        // reports an error leaves people clicking it again on a machine they
        // are trying to walk away from.
        if (token) {
          const { error } = await supabase.auth.admin.signOut(token)
          if (error) fastify.log.error({ err: error }, 'signOut failed to revoke the session')

          // The gate this backend actually enforces. Keyed by token, exactly
          // as `authenticate` writes it.
          await invalidateAuthToken(token)
        }

        if (userId) {
          await clearCache(`user:${userId}`)
          await clearCache(`auth-me:${userId}:*`)
        }

        return reply.send({ success: true })
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Internal server error' })
      }
    },
  )

  // ═══════════════════════════════════════════════════════
  // GET /api/auth/me
  // ═══════════════════════════════════════════════════════
  fastify.get(
    '/api/auth/me',
    {
      preHandler: [authenticate, cacheMiddleware({ scope: 'user', ttl: 60, keyPrefix: 'auth-me' })],
      schema: {
        response: {
          200: toJsonSchema(
            z.object({
              user: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                // ⚠️ DECLARED, OR IT IS DROPPED. fast-json-stringify emits
                // only what the schema names — this is the same omission that
                // sent `{ "user": {} }`.
                role: z.string().nullable(),
                fullName: z.string(),
                businessName: z.string().nullable(),
                createdAt: z.string().datetime(),
              }),
            }),
          ),
          401: toJsonSchema(z.object({ error: z.string() })),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).userId

        const { data, error } = await supabase.auth.admin.getUserById(userId)

        if (error || !data.user) {
          return reply.code(401).send({ error: 'User not found' })
        }

        const [profile, role] = await Promise.all([getProfile(userId), resolveSoleRole(userId)])

        return reply.send({
          user: sanitizeUser(data.user, profile, role),
        })
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Internal server error' })
      }
    },
  )

  // ═══════════════════════════════════════════════════════
  // POST /api/auth/forgot-password
  // ═══════════════════════════════════════════════════════
  fastify.post(
    '/api/auth/forgot-password',
    {
      schema: {
        body: toJsonSchema(forgotPasswordSchema),
        response: {
          200: toJsonSchema(z.object({ message: z.string() })),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email } = request.body as { email: string }
      const ip = request.ip
      const userAgent = request.headers['user-agent'] || ''

      const result = await passwordResetService.requestReset(email, ip, userAgent)

      return reply.send({ message: result.message })
    },
  )

  // ═══════════════════════════════════════════════════════
  // POST /api/auth/reset-password
  // ═══════════════════════════════════════════════════════
  fastify.post(
    '/api/auth/reset-password',
    {
      schema: {
        body: toJsonSchema(resetPasswordSchema),
        response: {
          200: toJsonSchema(z.object({ message: z.string() })),
          400: toJsonSchema(z.object({ message: z.string() })),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = resetPasswordSchema.parse(request.body)
        const ip = request.ip

        const result = await passwordResetService.resetPassword(body.token, body.password, ip)

        if (!result.success) {
          return reply.code(400).send({ message: result.message })
        }

        return reply.send({ message: result.message })
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ message: 'Validation failed' })
        }
        fastify.log.error(err)
        return reply.code(500).send({ message: 'Internal server error' })
      }
    },
  )

  // ═══════════════════════════════════════════════════════
  // PATCH /api/auth/profile
  // ═══════════════════════════════════════════════════════
  fastify.patch(
    '/api/auth/profile',
    {
      preHandler: [authenticate],
      schema: {
        body: toJsonSchema(updateProfileSchema),
        response: {
          200: toJsonSchema(
            z.object({
              user: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
                // ⚠️ DECLARED, OR IT IS DROPPED. fast-json-stringify emits
                // only what the schema names — this is the same omission that
                // sent `{ "user": {} }`.
                role: z.string().nullable(),
                fullName: z.string(),
                businessName: z.string().nullable(),
                avatarUrl: z.string().nullable(),
                createdAt: z.string().datetime(),
              }),
            }),
          ),
          400: toJsonSchema(z.object({ error: z.string() })),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).userId
        const body = updateProfileSchema.parse(request.body)

        // ۱. به‌روزرسانی user_metadata
        const metadataUpdate: Record<string, any> = {}
        if (body.fullName !== undefined) metadataUpdate.full_name = body.fullName
        if (body.businessName !== undefined) metadataUpdate.business_name = body.businessName

        if (Object.keys(metadataUpdate).length > 0) {
          await supabase.auth.admin.updateUserById(userId, {
            user_metadata: metadataUpdate,
          })
        }

        // ۲. به‌روزرسانی جدول profiles
        const profileUpdate: Record<string, any> = {
          updated_at: new Date().toISOString(),
        }
        if (body.fullName !== undefined) profileUpdate.full_name = body.fullName
        if (body.businessName !== undefined) profileUpdate.business_name = body.businessName
        if (body.avatarUrl !== undefined) profileUpdate.avatar_url = body.avatarUrl

        // ─── Onboarding ───
        // Written once and never cleared: `onboardingCompleted: false` is not a
        // request to replay the wizard, and treating it as one would undo the
        // whole point of moving this off localStorage.
        if (body.onboardingCompleted === true) {
          profileUpdate.onboarding_completed_at = new Date().toISOString()
        }
        if (body.businessTypes !== undefined) profileUpdate.business_types = body.businessTypes
        if (body.storeSize !== undefined) profileUpdate.store_size = body.storeSize
        if (body.businessNote !== undefined) profileUpdate.business_note = body.businessNote

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({ id: userId, ...profileUpdate }, { onConflict: 'id' })

        // Until the migration runs these columns do not exist. Retry without
        // them so an ordinary name/avatar edit still saves, rather than failing
        // with a bare "ذخیره نشد".
        if (
          profileError &&
          (profileError.code === '42703' || /column/.test(profileError.message || ''))
        ) {
          const {
            onboarding_completed_at: _a,
            business_types: _b,
            store_size: _c,
            business_note: _d,
            ...withoutOnboarding
          } = profileUpdate

          await supabase
            .from('profiles')
            .upsert({ id: userId, ...withoutOnboarding }, { onConflict: 'id' })
        } else if (profileError) {
          throw profileError
        }

        // ۳. گرفتن user به‌روزشده
        const { data: authUser } = await supabase.auth.admin.getUserById(userId)
        const [profile, role] = await Promise.all([getProfile(userId), resolveSoleRole(userId)])

        // ۴. پاک کردن کش
        await clearCache(`auth-me:${userId}:*`)

        return reply.send({
          user: sanitizeUser(authUser?.user || (request as any).user, profile, role),
        })
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Internal server error' })
      }
    },
  )
}
