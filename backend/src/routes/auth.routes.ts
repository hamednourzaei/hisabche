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


 type JsonSchema = Record<string, unknown>

function toJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' }) as JsonSchema
  delete result.$schema
  return result
}

export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService()

  // ─── POST /api/auth/login ───────────────────
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
        return reply.code(400).send({ 
          error: 'Validation failed',
          details: err.errors 
        })
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
        return reply.code(400).send({ 
          error: 'Validation failed',
          details: err.errors 
        })
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
      response: {
        200: toJsonSchema(z.object({ success: z.boolean() })),
      },
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
    preHandler: [authenticate],
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
      response: {
        200: toJsonSchema(z.object({ message: z.string() })),
        400: toJsonSchema(z.object({ error: z.string() })),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { email } = forgotPasswordSchema.parse(request.body)
      await authService.forgotPassword(email)
      return reply.send({ 
        message: 'If this email exists, we sent a reset link' 
      })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'Validation failed',
          details: err.errors 
        })
      }
      fastify.log.error(err)
      return reply.send({ 
        message: 'If this email exists, we sent a reset link' 
      })
    }
  })

  // ─── POST /api/auth/reset-password ─────────────────────
  fastify.post('/api/auth/reset-password', {
    schema: {
      body: toJsonSchema(resetPasswordSchema),
      response: {
        200: toJsonSchema(z.object({ message: z.string() })),
        400: toJsonSchema(z.object({ error: z.string() })),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = resetPasswordSchema.parse(request.body)
      await authService.resetPassword(body.token, body.password)
      return reply.send({ message: 'Password reset successfully' })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'Validation failed',
          details: err.errors 
        })
      }
      if (err instanceof AuthError) {
        return reply.code(400).send({ error: err.message })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // ─── PATCH /api/auth/profile ────────────────────────────
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
      
      // فیلتر کردن فیلدهایی که undefined هستند
      const updateData: {
        fullName?: string
        businessName?: string
        avatarUrl?: string
      } = {}
      
      if (body.fullName !== undefined) {
        updateData.fullName = body.fullName
      }
      if (body.businessName !== undefined) {
        updateData.businessName = body.businessName
      }
      if (body.avatarUrl !== undefined) {
        updateData.avatarUrl = body.avatarUrl
      }
      
      const user = await authService.updateProfile(userId, updateData)
      return reply.send({ user })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'Validation failed',
          details: err.errors 
        })
      }
      if (err instanceof AuthError) {
        return reply.code(400).send({ error: err.message })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })
}