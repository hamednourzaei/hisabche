// ============================================
// backend/src/routes/customer.routes.ts
// FIXED: Removed phone and email from filters
// ============================================

import { invalidateMoneyCaches } from '../utils/money-cache'
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { createCustomerSchema, updateCustomerSchema } from '@hisabche/validation'
import { CustomerService } from '../services/customer.service'
import { BaseError } from '../errors/base.error'
import {
  IdempotencyUnavailableError,
  readClientRequestId,
  sendCreated,
} from '../utils/client-request'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'

// ✅ تنظیمات برای حذف $schema از خروجی
const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

import { requireCapability } from '../middleware/authorize.middleware'

export async function customerRoutes(fastify: FastifyInstance) {
  const customerService = new CustomerService()

  // ─── GET /api/customers ─────────────────────────────────
  // ✅ FIX: حذف schema validation برای querystring
  fastify.get(
    '/api/customers',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('customer.read'),
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'customers' }),
      ],
      // ❌ حذف: schema: { querystring: ... }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as any

        // ✅ تبدیل دستی با default values
        const page = query.page ? parseInt(query.page, 10) : 1
        const limit = query.limit ? parseInt(query.limit, 10) : 20
        const search = query.search || ''
        const sortBy = query.sortBy || 'created_at'
        const sortDirection = query.sortDirection || 'desc'

        // requireWorkspaceContext has already rejected an unauthenticated or
        // non-member caller with 401/403, so `tenancy` is present here.
        const result = await customerService.list(request.tenancy, {
          page: Math.max(1, page),
          limit: Math.min(100, Math.max(1, limit)),
          search,
          sortBy,
          sortDirection,
          isActive:
            query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined,
          type: query.type === 'cash' ? 'cash' : query.type === 'credit' ? 'credit' : undefined,
          hasBalance:
            query.hasBalance === 'true' ? true : query.hasBalance === 'false' ? false : undefined,
          // ❌ حذف: phone و email (در CustomerFilters وجود ندارند)
        })

        return reply.send(result)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({
          error: 'Failed to fetch customers',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    },
  )

  // ─── GET /api/customers/:id ─────────────────────────────
  fastify.get(
    '/api/customers/:id',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('customer.read'),
        cacheMiddleware({ scope: 'workspace', ttl: 120, keyPrefix: 'customer' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const customer = await customerService.getById(id, request.tenancy)
        return reply.send(customer)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(404).send({ error: 'Customer not found' })
      }
    },
  )

  // ─── POST /api/customers ────────────────────────────────
  fastify.post(
    '/api/customers',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('customer.write')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as any
        const customer = await customerService.create(request.tenancy, body, {
          clientRequestId: readClientRequestId(request),
        })
        await clearCache('customers:*')
        await clearCache('customer:*')
        return sendCreated(reply, customer)
      } catch (err) {
        if (err instanceof IdempotencyUnavailableError) {
          return reply.code(503).send({ error: err.message, code: err.code })
        }
        fastify.log.error(err)
        return reply.code(500).send({
          error: 'Failed to create customer',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    },
  )

  // ─── PATCH /api/customers/:id ───────────────────────────
  fastify.patch(
    '/api/customers/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('customer.write')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        // `expectedUpdatedAt` is not a field of the customer: it is the
        // condition of the write (see CustomerService.update).
        const { expectedUpdatedAt, ...body } = (request.body ?? {}) as Parameters<
          CustomerService['update']
        >[2] & { expectedUpdatedAt?: unknown }
        const customer = await customerService.update(
          id,
          request.tenancy,
          body,
          typeof expectedUpdatedAt === 'string' || expectedUpdatedAt === null
            ? { expectedUpdatedAt }
            : {},
        )
        // `customer:${id}` matched no key (the route cache is keyed
        // `customer:<workspace>:<url>`), so an edited customer stayed stale.
        await invalidateMoneyCaches(request.tenancy.workspaceId)
        return reply.send(customer)
      } catch (err) {
        // A refusal (not allowed, changed meanwhile) is said as one; only a
        // fault is a 500.
        if (err instanceof BaseError && err.statusCode < 500) {
          return reply
            .code(err.statusCode)
            .send({ error: err.name, code: err.message, message: err.message })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to update customer' })
      }
    },
  )

  // ─── DELETE /api/customers/:id ──────────────────────────
  fastify.delete(
    '/api/customers/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('customer.write')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        await customerService.delete(id, request.tenancy)
        // `customer:${id}` matched no key (the route cache is keyed
        // `customer:<workspace>:<url>`), so an edited customer stayed stale.
        await invalidateMoneyCaches(request.tenancy.workspaceId)
        return reply.code(204).send()
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to delete customer' })
      }
    },
  )

  // ─── GET /api/customers/:id/balance ────────────────────
  fastify.get(
    '/api/customers/:id/balance',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('customer.read'),
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'customer-balance' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const balance = await customerService.getBalance(id, request.tenancy)
        return reply.send(balance)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch balance' })
      }
    },
  )
}

export default customerRoutes
