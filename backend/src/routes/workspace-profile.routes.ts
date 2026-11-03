// ============================================
// backend/src/routes/workspace-profile.routes.ts
//
// The Business Profile of the workspace (owner decision D4 = B).
//
//   GET /api/workspace/profile   any member — what the business is, which
//                                capabilities are on, and why the rest are not.
//   PUT /api/workspace/profile   workspace.manage — declare or change it.
//
// Changing the profile writes the profile columns only. It grants nobody a
// permission, removes nobody's, and rewrites no historical row; a capability
// switching off does not delete what was recorded while it was on.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { sendFailure } from '../errors/http-failure'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { logBusinessEvent } from '../services/event-log.service'
import {
  setWorkspaceProfile,
  workspaceProfileOf,
  type WorkspaceProfile,
} from '../services/workspace-profile'

const putBody = z
  .object({ businessTypes: z.array(z.string().trim().min(1).max(64)).min(1).max(12) })
  .strict()

function view(workspace: WorkspaceProfile) {
  const { profile } = workspace
  return {
    declared: workspace.declared,
    configurable: workspace.configurable,
    businessTypes: workspace.types,
    capabilities: profile.capabilities,
    partialCapabilities: profile.partialCapabilities,
    unsupported: profile.unsupported,
    diagnostics: profile.diagnostics,
  }
}

export async function workspaceProfileRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/workspace/profile',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(view(await workspaceProfileOf(request.tenancy.workspaceId)))
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to read the business profile')
      }
    },
  )

  fastify.put(
    '/api/workspace/profile',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = putBody.parse(request.body)
        const { workspaceId, userId } = request.tenancy
        const before = await workspaceProfileOf(workspaceId)
        const after = await setWorkspaceProfile(workspaceId, userId, body.businessTypes)

        await logBusinessEvent({
          userId,
          workspaceId,
          entityType: 'workspace_profile',
          entityId: workspaceId,
          action: 'profile_changed',
          title: 'workspace business profile changed',
          metadata: { from: before.types, to: after.types },
          notify: false,
        })

        return reply.send(view(after))
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to store the business profile')
      }
    },
  )
}
