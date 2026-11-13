// ============================================
// backend/src/middleware/mfa.middleware.ts
//
// Customer-facing (and admin fallback) TOTP AAL2 enforcement for high-risk
// actions — period locks, API-key creation, and similar.
//
// ⚠️ V63 · S-2 — two changes, both security:
//
// 1. The test bypass is no longer `NODE_ENV === 'test'`. It is
//    `isTestRuntime()`: Vitest AND an explicitly test-built server. A
//    production process that inherited `NODE_ENV=test` used to skip MFA for
//    everyone; now it refuses to start (runtime/test-runtime.ts).
//
// 2. The claims come from `verifiedTokenClaims` — the same reader the admin
//    guard uses — instead of this file base64-decoding the JWT itself. One
//    reader means two guards can never disagree about a token's assurance
//    level.
// ============================================

import type { FastifyReply, FastifyRequest } from 'fastify'

import { verifiedTokenClaims } from '../services/admin/admin-security.service'
import { isTestRuntime } from '../runtime/test-runtime'

export interface MfaTokenClaims {
  aal?: 'aal1' | 'aal2' | string
  [key: string]: unknown
}

export function requireStepUpMfa(
  req: FastifyRequest,
  reply: FastifyReply,
  done: (err?: Error) => void,
) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) {
    return reply.status(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
  }

  // Only an explicitly test-built Vitest runtime may skip MFA, and only when
  // the test did not ask for the check.
  if (isTestRuntime() && !req.headers['x-require-mfa']) {
    return done()
  }

  const claims = verifiedTokenClaims(req.headers.authorization)
  if (claims.aal === 'aal2') {
    return done()
  }

  return reply.status(403).send({
    error: 'Two-step authentication verification required for this action (AAL2)',
    code: 'MFA_STEP_UP_REQUIRED',
  })
}
