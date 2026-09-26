// ============================================
// backend/src/middleware/workspace.middleware.ts
//
// The preHandler that turns an authenticated identity into an AUTHORIZED
// WORKSPACE. Any route that reads or writes invoices, customers, products or
// transactions must run it, and must then scope its queries with
// `request.tenancy.workspaceId`.
//
// ---------------------------------------------------------------------------
// WHY A PREHANDLER AND NOT A CALL INSIDE EACH SERVICE
//
// Because forgetting is the failure mode. A service that resolves its own
// tenancy can be called from a new route that never thought about it, and the
// omission looks like ordinary code. Here the route either declares
// `requireWorkspaceContext` and gets a `request.tenancy`, or it does not and
// has nothing to pass to the service — the service signatures take a
// `TenancyContext`, so a route that skipped this step does not compile.
//
// ---------------------------------------------------------------------------
// THE REQUESTED WORKSPACE
//
// A client may name the workspace it wants, via the `x-workspace-id` header or
// a `workspaceId` query parameter. That is a REQUEST, never an authorization:
// `requireWorkspace` verifies it against `workspace_members` and rejects it if
// the caller is not an active member. There is no path from a client-supplied
// id to a query.
//
// The request BODY is deliberately not consulted. A body-borne workspace id
// would travel with mutations and read as if it were part of the record.
// ============================================

import { roleCapabilities } from '../services/authorization/role-capabilities.service'
import { memberModuleBlocks } from '../services/authorization/member-module-blocks.service'
import { restrictByModuleBlocks } from '../services/authorization/authorization.domain'
import { FastifyReply, FastifyRequest } from 'fastify'

import { requireWorkspace, type TenancyContext } from '../services/tenancy.service'
import { BaseError } from '../errors/base.error'
import { rejectIfSubscriptionExpired } from './subscription.middleware'

declare module 'fastify' {
  interface FastifyRequest {
    /** Present only on routes that ran `requireWorkspaceContext`. */
    tenancy: TenancyContext
  }
}

/** The workspace the client is asking for, if any. Unverified by definition. */
function requestedWorkspaceId(request: FastifyRequest): string | null {
  const header = request.headers['x-workspace-id']
  if (typeof header === 'string' && header.trim()) return header.trim()

  const query = request.query as Record<string, unknown> | undefined
  const fromQuery = query?.workspaceId
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim()

  return null
}

/**
 * Must run AFTER `authenticate`, which sets `request.userId`.
 *
 * Sends 403 rather than 404 or an empty list when the user has no access: an
 * empty list is indistinguishable from "this business has no customers yet"
 * and would hide a real authorization failure from both the user and the logs.
 */
export async function requireWorkspaceContext(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.userId

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
  }

  try {
    const resolved = await requireWorkspace(userId, requestedWorkspaceId(request))
    request.tenancy = {
      ...resolved,
      // The role's set, minus any modules the owner took away from THIS person.
      // Only ever a subset; never applied to the owner (restrictByModuleBlocks).
      capabilities: restrictByModuleBlocks(
        resolved.role,
        await roleCapabilities.effective(resolved.workspaceId, resolved.role),
        await memberModuleBlocks.forMember(resolved.workspaceId, userId),
      ),
    }
  } catch (error) {
    const status = error instanceof BaseError ? error.statusCode : 500
    const message = error instanceof Error ? error.message : 'Workspace resolution failed'

    if (status >= 500) {
      request.log.error({ err: error, userId }, 'workspace resolution failed')
      return reply.status(500).send({ error: 'Internal Server Error' })
    }

    return reply.status(status).send({ error: message, code: 'WORKSPACE_FORBIDDEN' })
  }

  // The expired-subscription lock (402 SUBSCRIPTION_EXPIRED on writes). Here,
  // not per route, so every workspace-scoped write is covered by construction.
  if (await rejectIfSubscriptionExpired(request, reply, request.tenancy.workspaceId)) return reply
}
