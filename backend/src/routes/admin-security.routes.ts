// ============================================
// backend/src/routes/admin-security.routes.ts
//
// Admin Security & RBAC Routes:
// - Roles and Permissions catalogue
// - Admin Accounts management
// - Admin Sessions list and revocation
// - Security Events audit trail
// - Audit Logs with filters and before/after diffs
// - Step-Up verification (MFA TOTP)
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'
import { requireAdminPermission, requireAdminStepUp } from '../middleware/admin-rbac.middleware'
import {
  ADMIN_ROLES,
  permissionsForRole,
  ADMIN_PERMISSIONS,
} from '../services/admin/admin-rbac.domain'
import { AdminSecurityService, verifiedTokenClaims } from '../services/admin/admin-security.service'
import { adminIpAllowlistService } from '../services/admin/admin-ip-allowlist.service'
import { AdminBillingService } from '../services/admin/admin-billing.service'
import {
  AdminActionTypeNotInstalledError,
  isUnknownActionType,
} from '../services/admin/admin-deletions'
import { AdminPostureService } from '../services/admin/admin-posture.service'
import { isValidCidrEntry } from '../utils/ip-cidr'

const roleEnum = z.enum(ADMIN_ROLES)

const allowlistEntryBody = z.object({
  cidr: z.string().min(2).max(64),
  label: z.string().max(80).optional(),
})

const upsertAccountBody = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  role: roleEnum,
  isActive: z.boolean().optional(),
})

const securityEventsQuery = z.object({
  eventType: z.string().optional(),
  adminEmail: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export default async function adminSecurityRoutes(fastify: FastifyInstance) {
  // Helper for error envelopes
  const handle = async (reply: FastifyReply, fn: () => Promise<unknown>) => {
    try {
      const data = await fn()
      return reply.send(data)
    } catch (err: unknown) {
      fastify.log.error(err)
      const e = err as { statusCode?: number; code?: string; message?: string } | undefined
      const status = typeof e?.statusCode === 'number' ? e.statusCode : 500
      const message = status < 500 && e?.message ? e.message : 'Internal server error'
      const code =
        e?.code || (status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'ERROR')
      return reply.code(status).send({ error: message, code })
    }
  }

  // ─── GET /api/admin/roles ────────────────────────────────────
  fastify.get(
    '/api/admin/roles',
    {
      preHandler: [authenticate, platformAdminGuard, requireAdminPermission('security.roles.read')],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      return handle(reply, async () => {
        const roles = ADMIN_ROLES.map((role) => ({
          role,
          permissions: permissionsForRole(role),
        }))
        return {
          roles,
          allPermissions: ADMIN_PERMISSIONS,
        }
      })
    },
  )

  // ─── GET /api/admin/accounts ─────────────────────────────────
  fastify.get(
    '/api/admin/accounts',
    {
      preHandler: [authenticate, platformAdminGuard, requireAdminPermission('security.roles.read')],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      return handle(reply, async () => {
        const accounts = await AdminSecurityService.listAdminAccounts()
        return { accounts }
      })
    },
  )

  // ─── POST /api/admin/accounts ────────────────────────────────
  fastify.post(
    '/api/admin/accounts',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('security.roles.write'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = upsertAccountBody.parse(req.body)
      return handle(reply, async () => {
        const account = await AdminSecurityService.upsertAdminAccount(body)
        const actor = req.user?.email
        await AdminSecurityService.logSecurityEvent({
          eventType: 'ADMIN_ROLE_UPDATED',
          adminEmail: actor,
          details: { targetEmail: body.email, assignedRole: body.role },
        })
        return { account }
      })
    },
  )

  // ─── GET /api/admin/sessions ─────────────────────────────────
  fastify.get(
    '/api/admin/sessions',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('security.sessions.read'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      return handle(reply, async () => {
        const sessions = await AdminSecurityService.listAdminSessions()
        return { sessions }
      })
    },
  )

  // ─── POST /api/admin/sessions/:userId/revoke ─────────────────
  fastify.post(
    '/api/admin/sessions/:userId/revoke',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('security.sessions.revoke'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = req.params as { userId: string }
      return handle(reply, async () => {
        const actor = req.user?.email ?? 'admin'
        await AdminSecurityService.revokeAdminSession(userId, actor)
        return { success: true }
      })
    },
  )

  // ─── GET /api/admin/security-events ──────────────────────────
  fastify.get(
    '/api/admin/security-events',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('security.events.read'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const query = securityEventsQuery.parse(req.query)
      return handle(reply, async () => {
        return AdminSecurityService.listSecurityEvents(query)
      })
    },
  )

  // ─── POST /api/admin/security/step-up ────────────────────────
  fastify.post(
    '/api/admin/security/step-up',
    { preHandler: [authenticate, platformAdminGuard] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      // The admin ran `mfa.challengeAndVerify` in the browser; the refreshed
      // token now carries the TOTP time. Nothing here can mint a step-up.
      const claims = verifiedTokenClaims(req.headers.authorization)
      if (!AdminSecurityService.isStepUpFresh(claims)) {
        return reply.code(403).send({
          error: 'Fresh TOTP verification required',
          code: 'ADMIN_STEP_UP_REQUIRED',
        })
      }
      const timestamp = AdminSecurityService.lastTotpAt(claims) as number
      return handle(reply, async () => {
        const actor = req.user?.email
        await AdminSecurityService.logSecurityEvent({
          eventType: 'STEP_UP_PASSED',
          adminEmail: actor,
          details: { timestamp },
        })
        return {
          stepUpTimestamp: String(timestamp),
          expiresInSeconds: 300,
        }
      })
    },
  )

  // ─── GET /api/admin/security/posture ─────────────────────────
  //
  // V63 · S-6. Facts + evidence. `unknown` is a real answer here and the screen
  // renders it as one, so this route never swallows a failed read.
  fastify.get(
    '/api/admin/security/posture',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('security.posture.read'),
      ],
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      return handle(reply, async () => AdminPostureService.report())
    },
  )

  // ─── GET /api/admin/security/ip-allowlist ────────────────────
  //
  // V63 · S-5. This is the route the break-glass path reaches by definition:
  // the list is edited here, so an admin locked out by a wrong entry can still
  // fix it from an unlisted network.
  fastify.get(
    '/api/admin/security/ip-allowlist',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('security.ip_allowlist.read'),
      ],
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      return handle(reply, async () => {
        const entries = await adminIpAllowlistService.listEntries()
        return {
          entries,
          // The screen must be able to say «off» instead of showing an empty
          // table as if the console were protected.
          enforcement: entries.length > 0 ? 'enforced' : 'disabled',
        }
      })
    },
  )

  // ─── POST /api/admin/security/ip-allowlist ───────────────────
  fastify.post(
    '/api/admin/security/ip-allowlist',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('security.ip_allowlist.write'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = allowlistEntryBody.parse(req.body)
      if (!isValidCidrEntry(body.cidr)) {
        return reply.code(400).send({
          error: 'This is not an IP address or CIDR range',
          code: 'INVALID_CIDR',
        })
      }

      return handle(reply, async () => {
        const actor = req.user?.email ?? 'admin'
        const entry = await adminIpAllowlistService.addEntry({
          cidr: body.cidr,
          label: body.label ?? '',
          actorEmail: actor,
        })
        await AdminSecurityService.logSecurityEvent({
          eventType: 'ADMIN_IP_ALLOWLIST_ADDED',
          adminEmail: actor,
          ipAddress: req.ip,
          details: { cidr: entry.cidr, label: entry.label },
        })
        return { entry }
      })
    },
  )

  // ─── DELETE /api/admin/security/ip-allowlist/:id ─────────────
  fastify.delete(
    '/api/admin/security/ip-allowlist/:id',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('security.ip_allowlist.write'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string }
      // Owner request (12 Nov 2026): a deletion needs a SECOND admin. This
      // click only PROPOSES; the entry is removed by `decideActionRequest`
      // when a different admin approves (ADMIN_IP_ALLOWLIST_REMOVED is logged
      // then, by the approver).
      return handle(reply, async () => {
        if (!z.string().uuid().safeParse(id).success) {
          throw Object.assign(new Error('Invalid id'), { statusCode: 400, code: 'INVALID_PARAM' })
        }
        try {
          const proposal = await AdminBillingService.proposeActionRequest({
            actionType: 'IP_ALLOWLIST_REMOVE',
            payload: { id },
            diffPreview: { ipAllowlistEntryId: id, remove: true },
            proposedBy: req.user?.email ?? req.userId,
          })
          return { pending: true, requestId: proposal.id }
        } catch (err) {
          if (isUnknownActionType(err)) throw new AdminActionTypeNotInstalledError()
          throw err
        }
      })
    },
  )
}
