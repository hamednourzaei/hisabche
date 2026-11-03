// ============================================
// backend/src/middleware/profile-capability.middleware.ts
//
// The SECOND half of an authorization for an optional capability.
//
//   requireCapability('product.write')         — may this PERSON do it?      (role)
//   requireProfileCapability('variants')       — is it ON in this BUSINESS?  (profile)
//
// Both must hold (owner decision D4 = B). The profile never grants a
// permission, and a permission never switches a capability on.
//
// A workspace that has not declared a profile is never restricted: this is
// what keeps every existing business working. The check reads the SERVER's
// copy of the profile — nothing the device or the browser sent.
//
// Runs AFTER `requireWorkspaceContext`.
// ============================================

import type { FastifyReply, FastifyRequest } from 'fastify'
import type { CapabilityKey } from '@hisabche/validation'

import { workspaceProfileOf } from '../services/workspace-profile'

export function requireProfileCapability(capability: CapabilityKey) {
  return async function requireCapabilityOn(request: FastifyRequest, reply: FastifyReply) {
    const tenancy = request.tenancy
    if (!tenancy) {
      request.log.error(
        { capability, url: request.url },
        'requireProfileCapability ran without a tenancy context',
      )
      return reply.status(500).send({ error: 'Internal Server Error' })
    }

    const workspace = await workspaceProfileOf(tenancy.workspaceId)
    if (!workspace.declared) return
    if (workspace.profile.capabilities.includes(capability)) return

    return reply.status(403).send({
      error: 'CAPABILITY_NOT_ENABLED',
      code: 'CAPABILITY_NOT_ENABLED',
      capability,
    })
  }
}
