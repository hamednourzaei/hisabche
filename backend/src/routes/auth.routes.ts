// ============================================
// backend/src/routes/auth.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  loginSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema
} from '@hisabche/validation'
import { AuthService } from '../services/auth.service'
import { AuthError } from '../errors/auth.error'
import { authenticate } from '../middleware/auth.middleware'
import { passwordResetService } from '../services/password-reset.service'
import { cacheMiddleware } from '../middleware/cache.middleware'

type JsonSchema = Record<string, unknown>

// ✅ راه‌حل نهایی - بدون استفاده از zodToJsonSchema
function toJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  // تبدیل دستی به JSON Schema
  return {
    type: 'object',
    properties: Object.fromEntries(
      Object.entries((schema as any).shape || {}).map(([key, value]: [string, any]) => [
        key,
        {
          type: value._def?.typeName === 'ZodString' ? 'string' :
                value._def?.typeName === 'ZodNumber' ? 'number' :
                value._def?.typeName === 'ZodBoolean' ? 'boolean' :
                value._def?.typeName === 'ZodArray' ? 'array' :
                value._def?.typeName === 'ZodObject' ? 'object' : 'string',
          ...(value._def?.typeName === 'ZodString' && value._def?.checks?.some((c: any) => c.kind === 'email') ? { format: 'email' } : {}),
        }
      ])
    ),
    required: Object.keys((schema as any).shape || {}),
  };
}

export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService()

  // ─── POST /api/auth/login ──────────────────────────────
  fastify.post('/api/auth/login', {
    schema: {
      body: toJsonSchema(loginSchema),
      response: {
        200: toJsonSchema(z.object({
          user: z.object({
            id: z.string().uuid(),
            email: z.string().email(),
            fullName: z.string(),
            businessName: z.string().optional(),
            createdAt: z.string().datetime(),
          }),
          token: z.string(),
        })),
        400: toJsonSchema(z.object({ error: z.string(), details: z.any().optional() })),
        401: toJsonSchema(z.object({ error: z.string() })),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = loginSchema.parse(request.body)
      const result = await authService.login(body)
      return reply.send(result)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      if (err instanceof AuthError) {
        return reply.code(401).send({ error: err.message })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ─── POST /api/auth/signup ─────────────────────────────
  fastify.post('/api/auth/signup', {
    schema: {
      body: toJsonSchema(signUpSchema),
      response: {
        201: toJsonSchema(z.object({
          user: z.object({
            id: z.string().uuid(),
            email: z.string().email(),
            fullName: z.string(),
            businessName: z.string().optional(),
            createdAt: z.string().datetime(),
          }),
          token: z.string(),
        })),
        400: toJsonSchema(z.object({ error: z.string(), details: z.any().optional() })),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = signUpSchema.parse(request.body)
      const result = await authService.signup(body)
      return reply.code(201).send(result)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      if (err instanceof AuthError) {
        return reply.code(400).send({ error: err.message })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ─── POST /api/auth/logout ─────────────────────────────
  fastify.post('/api/auth/logout', {
    preHandler: [authenticate],
    schema: {
      response: { 200: toJsonSchema(z.object({ success: z.boolean() })) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId
      await authService.logout(userId)
      return reply.send({ success: true })
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ─── GET /api/auth/me ──────────────────────────────────
  fastify.get('/api/auth/me', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 60, keyPrefix: 'auth-me' })],
    schema: {
      response: {
        200: toJsonSchema(z.object({
          user: z.object({
            id: z.string().uuid(),
            email: z.string().email(),
            fullName: z.string(),
            businessName: z.string().optional(),
            createdAt: z.string().datetime(),
          }),
        })),
        401: toJsonSchema(z.object({ error: z.string() })),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId
      const user = await authService.getMe(userId)
      return reply.send({ user })
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(401).send({ error: err.message })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ─── POST /api/auth/forgot-password ────────────────────
  fastify.post('/api/auth/forgot-password', {
    schema: {
      body: toJsonSchema(forgotPasswordSchema),
      response: { 200: toJsonSchema(z.object({ message: z.string() })) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.body as { email: string }
    const ip = request.ip
    const userAgent = request.headers['user-agent'] || ''

    const result = await passwordResetService.requestReset(email, ip, userAgent)

    return reply.send({ message: result.message })
  })

  // ─── POST /api/auth/reset-password ─────────────────────
  fastify.post('/api/auth/reset-password', {
    schema: {
      body: toJsonSchema(resetPasswordSchema),
      response: {
        200: toJsonSchema(z.object({ message: z.string() })),
        400: toJsonSchema(z.object({ message: z.string() })),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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
  })

  // ─── PATCH /api/auth/profile ───────────────────────────
  fastify.patch('/api/auth/profile', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(updateProfileSchema),
      response: {
        200: toJsonSchema(z.object({
          user: z.object({
            id: z.string().uuid(),
            email: z.string().email(),
            fullName: z.string(),
            businessName: z.string().optional(),
            avatarUrl: z.string().optional(),
            createdAt: z.string().datetime(),
          }),
        })),
        400: toJsonSchema(z.object({ error: z.string() })),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId
      const body = updateProfileSchema.parse(request.body)
      const updateData: { fullName?: string; businessName?: string; avatarUrl?: string } = {}
      if (body.fullName !== undefined) updateData.fullName = body.fullName
      if (body.businessName !== undefined) updateData.businessName = body.businessName
      if (body.avatarUrl !== undefined) updateData.avatarUrl = body.avatarUrl
      const user = await authService.updateProfile(userId, updateData)
      return reply.send({ user })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      if (err instanceof AuthError) {
        return reply.code(400).send({ error: err.message })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}