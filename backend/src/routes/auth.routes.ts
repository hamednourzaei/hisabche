// ============================================
// backend/src/routes/auth.routes.ts
// FIXED: TypeScript error — signOut پارامتر string قبول نمی‌کند
// ============================================

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
import { supabase } from '../db'
import { authenticate } from '../middleware/auth.middleware'
import { passwordResetService } from '../services/password-reset.service'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'

// ─── Types ──────────────────────────────────────────────────
type JsonSchema = Record<string, unknown>

interface SanitizedUser {
  id: string
  email: string
  fullName: string | null
  businessName: string | null
  avatarUrl: string | null
  createdAt: string
}

// ─── Helper: toJsonSchema (دستی) ────────────────────────────

/**
 * Strip the wrappers that make a field optional so the inner type can be read.
 *
 * `z.any().optional()` is a ZodOptional around a ZodAny — without unwrapping,
 * the typeName is `ZodOptional` and every such field was typed as `string`.
 */
function unwrap(schema: any): { inner: any; optional: boolean } {
  let inner = schema
  let optional = false

  while (
    inner?._def?.typeName === 'ZodOptional' ||
    inner?._def?.typeName === 'ZodNullable' ||
    inner?._def?.typeName === 'ZodDefault'
  ) {
    // A field with a default is always present in the output, so it is not
    // optional for serialization purposes — but it must still be unwrapped.
    if (inner._def.typeName !== 'ZodDefault') optional = true
    inner = inner._def.innerType
  }

  return { inner, optional }
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

function toJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  const shape = ((schema as any).shape || {}) as Record<string, unknown>
  const required: string[] = []

  const properties = Object.fromEntries(
    Object.entries(shape).map(([key, value]) => {
      const { inner, optional } = unwrap(value)
      if (!optional) required.push(key)

      const type = jsonTypeOf(inner?._def?.typeName)
      const isEmail =
        inner?._def?.typeName === 'ZodString' &&
        inner._def?.checks?.some((c: any) => c.kind === 'email')

      return [key, { ...(type ? { type } : {}), ...(isEmail ? { format: 'email' } : {}) }]
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

// ─── Helper: Get profile from public.profiles ───────────────
async function getProfile(userId: string): Promise<{
  full_name: string | null
  business_name: string | null
  avatar_url: string | null
} | null> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, business_name, avatar_url')
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
  } | null,
): SanitizedUser {
  return {
    id: authUser.id,
    email: authUser.email,
    fullName: profile?.full_name || authUser.user_metadata?.full_name || '',
    businessName: profile?.business_name || authUser.user_metadata?.business_name || null,
    avatarUrl: profile?.avatar_url || null,
    createdAt: authUser.created_at,
  }
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
                fullName: z.string(),
                businessName: z.string().nullable(),
                createdAt: z.string().datetime(),
              }),
              token: z.string(),
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
        const { data: session, error: loginError } = await supabase.auth.signInWithPassword({
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
          token: session.session.access_token,
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
                fullName: z.string(),
                businessName: z.string().nullable(),
                createdAt: z.string().datetime(),
              }),
              token: z.string(),
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

        const { data, error } = await supabase.auth.signInWithPassword({
          email: body.email,
          password: body.password,
        })

        if (error || !data.session) {
          return reply.code(401).send({ error: 'Invalid email or password' })
        }

        const profile = await getProfile(data.user.id)

        return reply.send({
          user: sanitizeUser(data.user, profile),
          token: data.session.access_token,
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
      preHandler: [authenticate],
      schema: {
        response: {
          200: toJsonSchema(z.object({ success: z.boolean() })),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // ✅ FIX: supabase.auth.signOut() بدون پارامتر
        // سرور-ساید session رو invalidate می‌کند
        await supabase.auth.signOut().catch(() => {
          // حتی اگر خطا داد، cache رو پاک کن
        })

        // پاک کردن کش کاربر
        const userId = (request as any).userId
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
      preHandler: [authenticate, cacheMiddleware({ ttl: 60, keyPrefix: 'auth-me' })],
      schema: {
        response: {
          200: toJsonSchema(
            z.object({
              user: z.object({
                id: z.string().uuid(),
                email: z.string().email(),
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

        const profile = await getProfile(userId)

        return reply.send({
          user: sanitizeUser(data.user, profile),
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

        await supabase
          .from('profiles')
          .upsert({ id: userId, ...profileUpdate }, { onConflict: 'id' })

        // ۳. گرفتن user به‌روزشده
        const { data: authUser } = await supabase.auth.admin.getUserById(userId)
        const profile = await getProfile(userId)

        // ۴. پاک کردن کش
        await clearCache(`auth-me:${userId}:*`)

        return reply.send({
          user: sanitizeUser(authUser?.user || (request as any).user, profile),
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
