// ============================================
// backend/src/middleware/mfa.middleware.ts
//
// OPTION 47: CUSTOMER MFA & STEP-UP ENFORCEMENT
//
// Requires TOTP AAL2 verification for high-risk actions
// (e.g. period lock changes, API key creation) when MFA is enabled.
// ============================================

import type { FastifyReply, FastifyRequest } from 'fastify'

export interface MfaTokenClaims {
  aal?: 'aal1' | 'aal2' | string
  [key: string]: unknown
}

export function requireStepUpMfa(
  req: FastifyRequest,
  reply: FastifyReply,
  done: (err?: Error) => void,
) {
  // Check if session token claims contain AAL2
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) {
    return reply.status(401).send({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
  }

  // In test environment without Supabase MFA active, allow step-up bypass if explicitly marked
  if (process.env.NODE_ENV === 'test' && !req.headers['x-require-mfa']) {
    return done()
  }

  try {
    const parts = token.split('.')
    if (parts.length >= 2) {
      const payload = JSON.parse(
        Buffer.from(parts[1]!, 'base64').toString('utf8'),
      ) as MfaTokenClaims
      if (payload.aal === 'aal2') {
        return done()
      }
    }
  } catch {
    // Ignore parse error, treat as unverified
  }

  return reply.status(403).send({
    error: 'Two-step authentication verification required for this action (AAL2)',
    code: 'MFA_STEP_UP_REQUIRED',
  })
}
