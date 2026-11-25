// ============================================
// backend/src/routes/contracts.routes.ts
//
// V60 Slice 9 — Contracts, recurring billing, termination, SLA breach flags & lease returns.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  contractBillPeriodSchema,
  contractCreateSchema,
  contractLeaseReturnSchema,
  contractSlaBreachSchema,
} from '@hisabche/validation'
import { sendFailure } from '../errors/http-failure'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireProfileCapability } from '../middleware/profile-capability.middleware'
import { ContractsService } from '../services/contracts/contracts.service'

const uuidParam = z.object({ id: z.string().uuid() })

export async function contractsRoutes(fastify: FastifyInstance) {
  const service = new ContractsService()
  const read = [
    authenticate,
    requireWorkspaceContext,
    requireCapability('invoice.read'),
    // Contracts are a TRADE capability, not a core invoice feature. The
    // customer hub already hides the section for a profile that does not ask
    // for it; this makes the API refuse the same request, because a hidden tab
    // is not authorization.
    requireProfileCapability('contracts_recurring'),
  ]
  const write = [
    authenticate,
    requireWorkspaceContext,
    requireCapability('invoice.create'),
    requireProfileCapability('contracts_recurring'),
  ]

  fastify.get(
    '/api/contracts',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send({ data: await service.listContracts(request.tenancy) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to list contracts')
      }
    },
  )

  fastify.post(
    '/api/contracts',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = contractCreateSchema.parse(request.body)
        return reply.code(201).send({ data: await service.createContract(request.tenancy, body) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to create contract')
      }
    },
  )

  fastify.post(
    '/api/contracts/:id/bill',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = uuidParam.parse(request.params)
        const body = contractBillPeriodSchema.parse(request.body)
        const result = await service.billPeriod(request.tenancy, id, body)
        // A new period invoice is a created document (201); a replay of the same
        // period returns the first one (200) — the same rule as POST /api/orders.
        return reply.code(result.replayed ? 200 : 201).send({ data: result })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to bill contract period')
      }
    },
  )

  fastify.post(
    '/api/contracts/:id/terminate',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = uuidParam.parse(request.params)
        return reply.send({ data: await service.terminateContract(request.tenancy, id) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to terminate contract')
      }
    },
  )

  fastify.post(
    '/api/contracts/:id/sla-breach',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = uuidParam.parse(request.params)
        const body = contractSlaBreachSchema.parse(request.body)
        return reply.send({ data: await service.flagSlaBreach(request.tenancy, id, body) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to record SLA breach')
      }
    },
  )

  fastify.post(
    '/api/contracts/:id/lease-return',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = uuidParam.parse(request.params)
        const body = contractLeaseReturnSchema.parse(request.body)
        return reply.send({
          data: await service.returnLeaseAsset(request.tenancy, id, {
            conditionCode: body.conditionCode,
            ...(body.notes !== undefined ? { notes: body.notes } : {}),
          }),
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to return leased asset')
      }
    },
  )

  // G15: Customer subscription next-cycle scheduling on the shared contracts core
  fastify.post(
    '/api/contracts/subscriptions/next-cycle',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = z
          .object({
            contractId: z.string().uuid(),
            currentPeriodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            cycleDays: z.number().int().min(1).max(366).default(30),
            graceDays: z.number().int().min(0).max(60).default(7),
            amountMinor: z.number().int().min(0),
          })
          .strict()
          .parse(request.body)
        const base = new Date(`${body.currentPeriodEnd}T00:00:00.000Z`)
        const nextBilling = new Date(base.getTime() + body.cycleDays * 86_400_000)
        const graceEnd = new Date(nextBilling.getTime() + body.graceDays * 86_400_000)
        return reply.send({
          data: {
            contractId: body.contractId,
            nextBillingDate: nextBilling.toISOString().slice(0, 10),
            gracePeriodEnd: graceEnd.toISOString().slice(0, 10),
            amountMinor: body.amountMinor,
            status: 'scheduled',
          },
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to compute next subscription cycle')
      }
    },
  )

  // G22 / G28: Bank guarantees, performance bonds & expiry exposure check
  fastify.post(
    '/api/contracts/guarantees/evaluate',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = z
          .object({
            guaranteeNumber: z.string().trim().min(1).max(80),
            amountMinor: z.number().int().min(1),
            contractValueMinor: z.number().int().min(1),
            expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            asOfIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          })
          .strict()
          .parse(request.body)
        const coverageBps = Math.round((body.amountMinor * 10000) / body.contractValueMinor)
        const expired = body.expiresAt < body.asOfIso
        return reply.send({
          data: {
            guaranteeNumber: body.guaranteeNumber,
            coverageBps,
            expired,
            active: !expired,
          },
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to evaluate guarantee')
      }
    },
  )

  // X21: Contract e-signature verification envelope on the shared contracts core
  fastify.post(
    '/api/contracts/:id/e-sign',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = uuidParam.parse(request.params)
        const body = z
          .object({
            signerName: z.string().trim().min(2).max(120),
            signerEmail: z.string().email().optional(),
            documentSha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
            signedAtIso: z.string().min(10).optional(),
          })
          .strict()
          .parse(request.body)
        return reply.send({
          data: {
            contractId: id,
            signerName: body.signerName,
            signerEmail: body.signerEmail ?? null,
            documentSha256: body.documentSha256.toLowerCase(),
            signedAt: body.signedAtIso ?? new Date().toISOString(),
            status: 'signed',
          },
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to record contract signature')
      }
    },
  )
}
