// ============================================
// backend/src/middleware/entitlement.middleware.ts
//
// Route guard for feature entitlement (plan / subscription).
//
// Answers through EntitlementService and the pure resolver:
//   - AVAILABLE: request proceeds
//   - EXHAUSTED: 402 PLAN_LIMIT_REACHED
//   - EXPIRED: 402 SUBSCRIPTION_EXPIRED
//   - REQUIRES_ONLINE: 403 REQUIRES_ONLINE
//   - REQUIRES_UPGRADE: 403 FEATURE_NOT_ENTITLED (with requiredPlan)
//   - NOT_ENTITLED: 403 FEATURE_NOT_ENTITLED
// ============================================

import type { FastifyReply, FastifyRequest } from 'fastify'
import type { FeatureKey } from '@hisabche/validation'
import { EntitlementService } from '../services/entitlement.service'

const entitlementService = new EntitlementService()

export function requireEntitlement(feature: FeatureKey) {
  return async function checkEntitlement(request: FastifyRequest, reply: FastifyReply) {
    const tenancy = request.tenancy

    if (!tenancy) {
      request.log.error(
        { feature, url: request.url },
        'requireEntitlement ran without a tenancy context',
      )
      return reply.status(500).send({ error: 'Internal Server Error' })
    }

    const verdict = await entitlementService.resolveWorkspaceEntitlement(
      tenancy.workspaceId,
      feature,
    )

    if (verdict.kind === 'AVAILABLE') {
      return
    }

    if (verdict.kind === 'EXHAUSTED') {
      return reply.status(402).send({
        error: 'Payment Required',
        code: 'PLAN_LIMIT_REACHED',
        feature,
      })
    }

    if (verdict.kind === 'EXPIRED') {
      return reply.status(402).send({
        error: 'Payment Required',
        code: 'SUBSCRIPTION_EXPIRED',
        feature,
      })
    }

    if (verdict.kind === 'REQUIRES_ONLINE') {
      return reply.status(403).send({
        error: 'Forbidden',
        code: 'REQUIRES_ONLINE',
        feature,
      })
    }

    if (verdict.kind === 'REQUIRES_UPGRADE') {
      return reply.status(403).send({
        error: 'Forbidden',
        code: 'FEATURE_NOT_ENTITLED',
        feature,
        requiredPlan: verdict.plan,
      })
    }

    return reply.status(403).send({
      error: 'Forbidden',
      code: 'FEATURE_NOT_ENTITLED',
      feature,
    })
  }
}
