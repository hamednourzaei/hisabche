// ============================================
// backend/src/routes/exchange.routes.ts
//
// Money changer / صرافی (exchange-01; QA document §10, 10 Nov 2026).
// Reading needs payment.read; a trade, a rate or a remittance moves money
// and needs payment.record; the identity threshold is a business rule and
// needs workspace.manage. Creating a trade or remittance honours
// Idempotency-Key.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  REMITTANCE_STATUSES,
  fxRateBoardSchema,
  fxSettingsSchema,
  fxTradeCreateSchema,
  fxVoidSchema,
  remittanceCreateSchema,
  remittanceMoveSchema,
  type RemittanceStatus,
} from '@hisabche/validation'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { sendFailure } from '../errors/http-failure'
import { readClientRequestId } from '../utils/client-request'
import { ExchangeService } from '../services/exchange/exchange.service'

const idOf = (request: FastifyRequest) => (request.params as { id: string }).id
const isUuid = (v: string) => z.string().uuid().safeParse(v).success

export async function exchangeRoutes(fastify: FastifyInstance) {
  const service = new ExchangeService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('payment.read')]
  const record = [authenticate, requireWorkspaceContext, requireCapability('payment.record')]
  const manage = [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')]

  const handle =
    (what: string, run: (request: FastifyRequest) => Promise<unknown>, status = 200) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.code(status).send({ data: await run(request) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, what)
      }
    }
  const withId =
    (what: string, run: (request: FastifyRequest, id: string) => Promise<unknown>) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!isUuid(idOf(request))) return reply.code(400).send({ error: 'Invalid id' })
      return handle(what, (r) => run(r, idOf(r)))(request, reply)
    }

  fastify.get(
    '/api/fx/settings',
    { preHandler: read },
    handle('Failed to read the exchange settings', (r) => service.settings(r.tenancy)),
  )
  fastify.put(
    '/api/fx/settings',
    { preHandler: manage },
    handle('Failed to save the exchange settings', (r) =>
      service.saveSettings(r.tenancy, fxSettingsSchema.parse(r.body)),
    ),
  )

  fastify.get(
    '/api/fx/rates',
    { preHandler: read },
    handle('Failed to read the rate board', (r) => service.board(r.tenancy)),
  )
  fastify.post(
    '/api/fx/rates',
    { preHandler: record },
    handle(
      'Failed to set the rate',
      (r) => service.setRate(r.tenancy, fxRateBoardSchema.parse(r.body)),
      201,
    ),
  )

  fastify.get(
    '/api/fx/trades',
    { preHandler: read },
    handle('Failed to read the trades', (r) => {
      const { currency } = r.query as { currency?: string }
      return service.trades(
        r.tenancy,
        currency && /^[A-Za-z]{3}$/.test(currency) ? { currency } : {},
      )
    }),
  )
  fastify.post(
    '/api/fx/trades',
    { preHandler: record },
    handle(
      'Failed to record the trade',
      (r) =>
        service.createTrade(r.tenancy, fxTradeCreateSchema.parse(r.body), readClientRequestId(r)),
      201,
    ),
  )
  fastify.post(
    '/api/fx/trades/:id/void',
    { preHandler: record },
    withId('Failed to void the trade', (r, id) =>
      service.voidTrade(r.tenancy, id, fxVoidSchema.parse(r.body).reason),
    ),
  )
  fastify.get(
    '/api/fx/positions',
    { preHandler: read },
    handle('Failed to read the positions', (r) => service.positions(r.tenancy)),
  )

  fastify.get(
    '/api/fx/remittances',
    { preHandler: read },
    handle('Failed to read the remittances', (r) => {
      const { status } = r.query as { status?: string }
      const wanted =
        status === 'open'
          ? 'open'
          : REMITTANCE_STATUSES.find((s): s is RemittanceStatus => s === status)
      return service.remittances(r.tenancy, wanted ? { status: wanted } : {})
    }),
  )
  fastify.get(
    '/api/fx/remittances/balances',
    { preHandler: read },
    handle('Failed to read the partner balances', (r) => service.partnerBalances(r.tenancy)),
  )
  fastify.post(
    '/api/fx/remittances',
    { preHandler: record },
    handle(
      'Failed to record the remittance',
      (r) =>
        service.createRemittance(
          r.tenancy,
          remittanceCreateSchema.parse(r.body),
          readClientRequestId(r),
        ),
      201,
    ),
  )
  fastify.post(
    '/api/fx/remittances/:id/status',
    { preHandler: record },
    withId('Failed to move the remittance', (r, id) =>
      service.moveRemittance(r.tenancy, id, remittanceMoveSchema.parse(r.body)),
    ),
  )
}
