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

import { can, type Capability } from '../services/authorization'

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

    if (!can(tenancy.role, capability)) {
      return reply.status(403).send({
        error: 'Forbidden',
        code: 'CAPABILITY_REQUIRED',
        capability,
        role: tenancy.role,
      })
    }
  }
}
