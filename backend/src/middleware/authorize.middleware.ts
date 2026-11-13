// ============================================
// backend/src/middleware/authorize.middleware.ts
//
// The preHandler that turns an authorized WORKSPACE into an authorized
// OPERATION.
//
// `requireWorkspaceContext` answers "which books may this request open".
// This answers "may this person do this to them". Both are needed: a seller is
// a legitimate member of the workspace and still may not close a period.
//
// It must run AFTER `requireWorkspaceContext` — the role it checks comes from
// the verified TenancyContext, never from anything the client sent.
// ============================================

import { FastifyReply, FastifyRequest } from 'fastify'

import { holds, minRoleFor, type Capability } from '../services/authorization'
import { isFreshStepUp, isStepUpCapability } from '../services/authorization/step-up.domain'
import { workspace2faService } from '../services/authorization/workspace-2fa.service'
import { verifiedTokenClaims } from '../services/admin/admin-security.service'

/**
 * Refuse the request unless the caller's workspace role holds `capability`.
 *
 * 403 with the capability name, not 404 and not an empty result: a member who
 * is refused should be told what they lack, and a silent empty list hides an
 * authorization failure from the user and from the logs alike.
 */
export function requireCapability(capability: Capability) {
  return async function authorize(request: FastifyRequest, reply: FastifyReply) {
    const tenancy = request.tenancy

    if (!tenancy) {
      // The route forgot requireWorkspaceContext. Fail closed and say so —
      // continuing here would authorize against a role nobody established.
      request.log.error(
        { capability, url: request.url },
        'requireCapability ran without a tenancy context',
      )
      return reply.status(500).send({ error: 'Internal Server Error' })
    }

    if (!holds(tenancy, capability)) {
      return reply.status(403).send({
        error: 'Forbidden',
        code: 'CAPABILITY_REQUIRED',
        capability,
        role: tenancy.role,
        // ⚠️ THE ONE FIELD A PERSON CAN ACT ON.
        //
        // `capability` is an internal name — nobody outside this codebase
        // knows what `ledger.post` is, and a name they cannot act on is not an
        // explanation. `minRoleFor` is exported from the domain for exactly
        // this purpose (see its docstring) and had no caller: the refusal
        // could say "a manager can do this", and instead the client rendered
        // the literal string «ForbiddenError».
        requiredRole: minRoleFor(capability),
      })
    }

    // ─── Two-step verification (V61 B.2.25) ──────────────────────────────────
    // Only the closed set of sensitive capabilities can be put behind a fresh
    // authenticator code, and only when the workspace's policy says so. Every
    // other capability returns above without touching the database.
    if (!isStepUpCapability(capability)) return

    let required: boolean
    try {
      required = await workspace2faService.requiresStepUp(tenancy.workspaceId, capability)
    } catch (err) {
      // Fail CLOSED: an unreadable policy is not "no policy".
      request.log.error({ err, capability }, 'two-step policy unavailable')
      return reply.status(503).send({
        error: 'Two-step policy unavailable',
        code: 'TWO_FACTOR_POLICY_UNAVAILABLE',
      })
    }
    if (!required) return

    // A key cannot type a code: a protected action needs a person.
    if (request.apiKey) {
      return reply.status(403).send({
        error: 'This action needs a person with two-step verification',
        code: 'STEP_UP_NOT_AVAILABLE_FOR_API_KEYS',
        capability,
      })
    }

    // `authenticate` verified this very token with Supabase before we got here,
    // so its claims are not forged.
    const claims = verifiedTokenClaims(request.headers.authorization)
    if (!isFreshStepUp(claims, Date.now())) {
      return reply.status(403).send({
        error: 'Enter the code from your authenticator app to continue',
        code: 'WORKSPACE_STEP_UP_REQUIRED',
        capability,
      })
    }
  }
}
