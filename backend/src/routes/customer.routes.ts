// ============================================
// backend/src/routes/customer.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerFiltersSchema,
} from '@hisabche/validation'
import { CustomerService } from '../services/customer.service'
import { authenticate } from '../middleware/auth.middleware'

// ✅ تنظیمات برای حذف $schema از خروجی
const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function customerRoutes(fastify: FastifyInstance) {
  const customerService = new CustomerService()

  // ─── GET /api/customers ─────────────────────────────────
  fastify.get('/api/customers', {
    preHandler: [authenticate],
    schema: {
      querystring: toJsonSchema(customerFiltersSchema),
      response: {
        200: toJsonSchema(z.object({
          customers: z.array(z.unknown()),
          total: z.number(),
          page: z.number(),
          limit: z.number(),
        })),
        400: toJsonSchema(z.object({ error: z.string(), details: z.unknown().optional() })),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = customerFiltersSchema.parse(request.query)
      const userId = (request as any).userId
      const result = await customerService.list(userId, query)
      return reply.send(result)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: err.errors
        })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch customers' })
    }
  })

  // ─── GET /api/customers/:id ─────────────────────────────
  fastify.get('/api/customers/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      response: {
        200: toJsonSchema(z.object({
          id: z.string().uuid(),
          fullName: z.string(),
          phone: z.string().optional(),
          email: z.string().optional(),
          address: z.unknown().optional(),
          notes: z.string().optional(),
          openingBalance: z.number(),
          isActive: z.boolean(),
          createdAt: z.string().datetime(),
          updatedAt: z.string().datetime().optional(),
          balance: z.number(),
        })),
        404: toJsonSchema(z.object({ error: z.string() })),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const userId = (request as any).userId
      const customer = await customerService.getById(id, userId)
      return reply.send(customer)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(404).send({ error: 'Customer not found' })
    }
  })

  // ─── POST /api/customers ────────────────────────────────
  fastify.post('/api/customers', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createCustomerSchema),
      response: {
        201: toJsonSchema(z.object({
          id: z.string().uuid(),
          fullName: z.string(),
          phone: z.string().optional(),
          email: z.string().optional(),
          address: z.unknown().optional(),
          notes: z.string().optional(),
          openingBalance: z.number(),
          isActive: z.boolean(),
          createdAt: z.string().datetime(),
          updatedAt: z.string().datetime().optional(),
        })),
        400: toJsonSchema(z.object({ error: z.string(), details: z.unknown().optional() })),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = createCustomerSchema.parse(request.body)
      const userId = (request as any).userId
      const customer = await customerService.create(userId, body)
      return reply.code(201).send(customer)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: err.errors
        })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create customer' })
    }
  })

  // ─── PATCH /api/customers/:id ───────────────────────────
  fastify.patch('/api/customers/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      body: toJsonSchema(updateCustomerSchema),
      response: {
        200: toJsonSchema(z.object({
          id: z.string().uuid(),
          fullName: z.string(),
          phone: z.string().optional(),
          email: z.string().optional(),
          address: z.unknown().optional(),
          notes: z.string().optional(),
          openingBalance: z.number(),
          isActive: z.boolean(),
          createdAt: z.string().datetime(),
          updatedAt: z.string().datetime().optional(),
        })),
        400: toJsonSchema(z.object({ error: z.string(), details: z.unknown().optional() })),
        404: toJsonSchema(z.object({ error: z.string() })),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const body = updateCustomerSchema.parse(request.body)
      const userId = (request as any).userId
      const customer = await customerService.update(id, userId, body)
      return reply.send(customer)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: err.errors
        })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update customer' })
    }
  })

  // ─── DELETE /api/customers/:id ──────────────────────────
  fastify.delete('/api/customers/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const userId = (request as any).userId
      await customerService.delete(id, userId)
      return reply.code(204).send()
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to delete customer' })
    }
  })

  // ─── GET /api/customers/:id/balance ────────────────────
  fastify.get('/api/customers/:id/balance', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      response: {
        200: toJsonSchema(z.object({
          customerId: z.string().uuid(),
          balance: z.number(),
          isDebtor: z.boolean(),
        })),
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const userId = (request as any).userId
      const balance = await customerService.getBalance(id, userId)
      return reply.send(balance)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch balance' })
    }
  })
}
