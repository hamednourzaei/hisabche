// ============================================
// backend/src/routes/loyalty-credit.routes.ts
//
// G01 (Gift Cards), G02 (Store Credit) & G65 (Loyalty Points)
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { loyaltyCreditService } from '../services/commerce/loyalty-credit.service'

const READ_INVOICE = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
const WRITE_INVOICE = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]
const READ_CRM = [authenticate, requireWorkspaceContext, requireCapability('customer.read')]
const WRITE_CRM = [authenticate, requireWorkspaceContext, requireCapability('customer.write')]
const customerParams = z.object({ customerId: z.string().uuid() })

function fail(fastify: FastifyInstance, reply: FastifyReply, err: unknown, fallback: string) {
  if (err instanceof z.ZodError) {
    return reply.code(400).send({
      error: 'Bad Request',
      message: err.errors[0]?.message ?? 'Validation failed',
      details: err.errors.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    })
  }
  if (err instanceof BaseError && (err.statusCode < 500 || err.statusCode === 503)) {
    return reply.code(err.statusCode).send({ error: err.name, message: err.message })
  }
  fastify.log.error(err)
  return reply.code(500).send({ error: 'Internal Server Error', message: fallback })
}

export async function loyaltyCreditRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/gift-cards',
    { preHandler: READ_INVOICE },
    async (req: FastifyRequest, reply) => {
      try {
        return reply.send({ giftCards: await loyaltyCreditService.listGiftCards(req.tenancy) })
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to list gift cards')
      }
    },
  )

  fastify.post(
    '/api/gift-cards',
    { preHandler: WRITE_INVOICE },
    async (req: FastifyRequest, reply) => {
      try {
        return reply.code(201).send(await loyaltyCreditService.issueGiftCard(req.tenancy, req.body))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to issue gift card')
      }
    },
  )

  fastify.post(
    '/api/gift-cards/redeem',
    { preHandler: WRITE_INVOICE },
    async (req: FastifyRequest, reply) => {
      try {
        return reply.send(await loyaltyCreditService.redeemGiftCard(req.tenancy, req.body))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to redeem gift card')
      }
    },
  )

  fastify.get(
    '/api/store-credit/:customerId',
    { preHandler: READ_CRM },
    async (req: FastifyRequest, reply) => {
      try {
        const { customerId } = customerParams.parse(req.params)
        return reply.send(
          await loyaltyCreditService.getStoreCreditBalances(req.tenancy, customerId),
        )
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read store credit')
      }
    },
  )

  fastify.post(
    '/api/store-credit',
    { preHandler: WRITE_INVOICE },
    async (req: FastifyRequest, reply) => {
      try {
        return reply
          .code(201)
          .send(await loyaltyCreditService.issueStoreCredit(req.tenancy, req.body))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to issue store credit')
      }
    },
  )

  fastify.get(
    '/api/loyalty/:customerId',
    { preHandler: READ_CRM },
    async (req: FastifyRequest, reply) => {
      try {
        const { customerId } = customerParams.parse(req.params)
        return reply.send(await loyaltyCreditService.getLoyaltyBalance(req.tenancy, customerId))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to read loyalty points')
      }
    },
  )

  fastify.post(
    '/api/loyalty/mutate',
    { preHandler: WRITE_CRM },
    async (req: FastifyRequest, reply) => {
      try {
        return reply
          .code(201)
          .send(await loyaltyCreditService.mutateLoyaltyPoints(req.tenancy, req.body))
      } catch (err) {
        return fail(fastify, reply, err, 'Failed to update loyalty points')
      }
    },
  )
}
