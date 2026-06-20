// ============================================
// backend/src/routes/customer.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerFiltersSchema
} from '@hisabche/validation'
import { CustomerService } from '../services/customer.service'
import { authenticate } from '../middleware/auth.middleware'

export async function customerRoutes(fastify: FastifyInstance) {
  const customerService = new CustomerService()

  // ─── GET /api/customers ─────────────────────────────────
  fastify.get('/api/customers', {
    preHandler: [authenticate],
    schema: {
      querystring: customerFiltersSchema,
      response: {
        200: z.object({
          customers: z.array(z.any()),
          total: z.number(),
          page: z.number(),
          limit: z.number(),
        }),
        400: z.object({ error: z.string(), details: z.any().optional() }),
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
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: z.object({
          id: z.string().uuid(),
          fullName: z.string(),
          phone: z.string().optional(),
          email: z.string().optional(),
          address: z.any().optional(),
          notes: z.string().optional(),
          openingBalance: z.number(),
          isActive: z.boolean(),
          createdAt: z.string().datetime(),
          updatedAt: z.string().datetime().optional(),
          balance: z.number(),
        }),
        404: z.object({ error: z.string() }),
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
      body: createCustomerSchema,
      response: {
        201: z.any(),
        400: z.object({ error: z.string(), details: z.any().optional() }),
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
      params: z.object({ id: z.string().uuid() }),
      body: updateCustomerSchema,
      response: {
        200: z.any(),
        400: z.object({ error: z.string(), details: z.any().optional() }),
        404: z.object({ error: z.string() }),
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
      params: z.object({ id: z.string().uuid() }),
      response: {
        204: z.undefined(),
        404: z.object({ error: z.string() }),
      },
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
      params: z.object({ id: z.string().uuid() }),
      response: {
        200: z.object({
          customerId: z.string().uuid(),
          balance: z.number(),
          isDebtor: z.boolean(),
        }),
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