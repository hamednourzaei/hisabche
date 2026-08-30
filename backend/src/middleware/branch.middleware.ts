// ============================================
// backend/src/middleware/branch.middleware.ts
//
// The preHandler that resolves WHICH BRANCH a request acts in.
//
// It runs after `requireWorkspaceContext` and narrows it. The branch id
// travels on the `x-branch-id` header, which — like the workspace header — is
// a REQUEST and never an authorization: it is checked against the member's
// branch assignments and rejected if they do not hold it.
//
// A workspace with no branches resolves to `null`, which means "the business
// as a whole" and is the correct answer for the overwhelming majority of
// Hisabche users. Nothing about this middleware changes their behaviour.
// ============================================

import { FastifyReply, FastifyRequest } from 'fastify'

import { branches } from '../services/branch'
import { BaseError } from '../errors/base.error'

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * The branch this request acts in, or null for the whole workspace.
     * Present only on routes that ran `resolveBranchContext`.
     */
    branchId: string | null
  }
}

/** The branch the client is asking for, if any. Unverified by definition. */
function requestedBranchId(request: FastifyRequest): string | null {
  const header = request.headers['x-branch-id']
  if (typeof header === 'string' && header.trim()) return header.trim()

  const query = request.query as Record<string, unknown> | undefined
  const fromQuery = query?.branchId
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim()

  return null
}

/**
 * Must run AFTER `requireWorkspaceContext`.
 *
 * Refuses rather than falling back to "the whole workspace" when a branch is
 * requested and denied: silently widening a restricted member's scope to
 * everything is the opposite of what the restriction is for.
 */
export async function resolveBranchContext(request: FastifyRequest, reply: FastifyReply) {
  if (!request.tenancy) {
    request.log.error({ url: request.url }, 'resolveBranchContext ran without a tenancy context')
    return reply.status(500).send({ error: 'Internal Server Error' })
  }

  try {
    request.branchId = await branches.resolveActive(request.tenancy, requestedBranchId(request))
  } catch (error) {
    const status = error instanceof BaseError ? error.statusCode : 500
    const message = error instanceof Error ? error.message : 'Branch resolution failed'

    if (status >= 500) {
      request.log.error({ err: error }, 'branch resolution failed')
      return reply.status(500).send({ error: 'Internal Server Error' })
    }

    return reply.status(403).send({ error: message, code: message })
  }
}
