// ============================================
// backend/src/middleware/subscription.middleware.ts
//
// The server-side lock for an EXPIRED subscription.
//
// When a workspace's subscription has ended, the business may still open and
// read its books, but it may not change them. Every mutating request
// (POST/PUT/PATCH/DELETE) that resolves a workspace is refused with HTTP 402
// and the stable code SUBSCRIPTION_EXPIRED. The client shows a lock notice on
// that code; the UI explains, this module decides.
//
// ---------------------------------------------------------------------------
// WHERE IT RUNS
//
// Inside `requireWorkspaceContext`, straight after the workspace is resolved.
// Every workspace-scoped route already declares that preHandler (pinned by
// workspace-guard-order.test.ts), so no route can forget the lock. Routes that
// address a workspace by `:id` instead (workspace.routes.ts) use
// `requireActiveSubscriptionForWorkspaceParam`, which resolves membership the
// same way before checking.
//
// Decided per WORKSPACE (`tenancy.workspaceId`), never per user.
//
// ---------------------------------------------------------------------------
// LOOKUP FAILURE
//
// An unreadable subscription is neither a grant nor a lock. It is logged and
// the write fails with 500 SUBSCRIPTION_LOOKUP_FAILED — the same outcome as the
// entitlement quota checks, which throw DatabaseError on an unreadable count.
// The client does NOT show the lock notice for it: nobody is told their
// subscription ended on the strength of a database hiccup.
// ============================================

import type { FastifyReply, FastifyRequest } from 'fastify'

import { BillingService } from '../services/billing.service'
import { requireWorkspace } from '../services/tenancy.service'
import { BaseError } from '../errors/base.error'

export const SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED'

const billingService = new BillingService()

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Route prefixes that must keep working while expired.
 *
 * - `/api/auth/`    — signing in and out, session and profile: an expired
 *                      business must still be able to reach /billing.
 * - `/api/billing/` — renewing IS the way out of the lock.
 */
const ALLOWED_PREFIXES = ['/api/auth/', '/api/billing/'] as const

/**
 * POST routes that only READ. Each was checked to write nothing:
 *
 * - budgets/check        — budgetService.checkSpend, a what-if against a budget
 * - batches/plan-issue   — traceability planIssue, proposes an allocation
 * - permissions/check    — answers hasPermission
 * - governance/why-not   — explains a refusal
 * - intelligence/explain — explains a profit change for a report
 * - rules/dry-run        — evaluates an unsaved rule against facts
 * - rules/evaluate       — evaluates saved rules against facts
 *
 * Deliberately NOT here: tax/preview (runs under invoice.create, part of
 * entering an invoice), sync/lease (acquires an edit lock), ai/ask and
 * ai/query (consume paid AI quota).
 */
const READ_ONLY_POSTS = new Set([
  '/api/operations/budgets/check',
  '/api/operations/batches/plan-issue',
  '/api/permissions/check',
  '/api/governance/why-not',
  '/api/intelligence/explain',
  '/api/rules/dry-run',
  '/api/rules/evaluate',
])

/** True when this request may proceed regardless of subscription state. */
export function isExemptFromSubscriptionLock(method: string, routeUrl: string): boolean {
  if (!MUTATING_METHODS.has(method.toUpperCase())) return true
  if (ALLOWED_PREFIXES.some((prefix) => routeUrl.startsWith(prefix))) return true
  return method.toUpperCase() === 'POST' && READ_ONLY_POSTS.has(routeUrl)
}

/** The route PATTERN, so `/api/invoices/:id` is matched as declared. */
function routeUrlOf(request: FastifyRequest): string {
  return request.routeOptions?.url ?? request.url.split('?')[0] ?? ''
}

/**
 * Refuses a mutating request for an expired workspace. Returns true when the
 * reply has been sent and the caller must stop.
 */
export async function rejectIfSubscriptionExpired(
  request: FastifyRequest,
  reply: FastifyReply,
  workspaceId: string,
): Promise<boolean> {
  if (isExemptFromSubscriptionLock(request.method, routeUrlOf(request))) return false

  try {
    const access = await billingService.getWorkspaceAccess(workspaceId)
    if (!access.expired) return false

    await reply.status(402).send({
      error: 'Subscription expired',
      code: SUBSCRIPTION_EXPIRED,
      periodEnd: access.periodEnd,
    })
    return true
  } catch (error) {
    request.log.error({ err: error, workspaceId }, 'subscription lookup failed')
    await reply
      .status(500)
      .send({ error: 'Internal Server Error', code: 'SUBSCRIPTION_LOOKUP_FAILED' })
    return true
  }
}

/**
 * For routes that address a workspace by `:id` rather than by tenancy context.
 * Membership is verified first, exactly as requireWorkspaceContext does, so a
 * non-member learns nothing about another business's subscription.
 */
export async function requireActiveSubscriptionForWorkspaceParam(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userId = request.userId
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
  }

  const params = request.params as { id?: unknown } | undefined
  const workspaceId = typeof params?.id === 'string' ? params.id : null
  if (!workspaceId) {
    return reply.status(400).send({ error: 'Workspace id required', code: 'WORKSPACE_ID_REQUIRED' })
  }

  try {
    await requireWorkspace(userId, workspaceId)
  } catch (error) {
    const status = error instanceof BaseError ? error.statusCode : 500
    if (status >= 500) {
      request.log.error({ err: error, userId }, 'workspace resolution failed')
      return reply.status(500).send({ error: 'Internal Server Error' })
    }
    const message = error instanceof Error ? error.message : 'Forbidden'
    return reply.status(status).send({ error: message, code: 'WORKSPACE_FORBIDDEN' })
  }

  if (await rejectIfSubscriptionExpired(request, reply, workspaceId)) return reply
}
