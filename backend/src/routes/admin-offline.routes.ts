// ============================================
// backend/src/routes/admin-offline.routes.ts
//
// Admin Offline & Licences Routes:
// - Licences list, revoke, reissue, transfer
// - Devices (computer / mobile seats)
// - Append-only licence log (filters by licence/event/date)
// - Automatic bans (tier-1 evidence, lift-ban with Step-Up TOTP + mandatory reason)
// - Review queue (tier-2 signals: decide ban / not abuse)
// - Offline fleet health & key rotation status
//
// Uses E's OfflineLicenseService — NEVER writes licence tables directly.
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'
import { requireAdminPermission, requireAdminStepUp } from '../middleware/admin-rbac.middleware'
import { offlineLicenseService } from '../services/offline-license.service'
import { supabase } from '../db'
import { encodeLicenseCode } from '@hisabche/validation'
import { AdminSecurityService } from '../services/admin/admin-security.service'

const issueLicenceBody = z.object({
  deviceId: z.string().uuid(),
  label: z.string().trim().max(80).optional(),
  periodDays: z.number().int().min(1).max(3650),
})

const liftBanBody = z.object({
  reason: z.string().min(5),
})

const decideReviewBody = z.object({
  verdict: z.enum(['ban', 'not_abuse']),
  reason: z.string().min(5),
  licenseId: z.string().uuid(),
})

export default async function adminOfflineRoutes(fastify: FastifyInstance) {
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

  // ─── 1. TAB: LICENCES ─────────────────────────────────────────
  fastify.get(
    '/api/admin/offline/licences',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('offline.licences.read'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId } = req.query as { workspaceId?: string }
      return handle(reply, async () => {
        let query = supabase
          .from('offline_licenses')
          .select('*')
          .order('created_at', { ascending: false })

        if (workspaceId) {
          query = query.eq('workspace_id', workspaceId)
        }

        const { data, error } = await query.limit(100)
        if (error) throw error
        return { licences: data ?? [] }
      })
    },
  )

  // ─── Issue a licence for one device (the offline edition's sale) ──
  fastify.post(
    '/api/admin/offline/licences',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('offline.licences.issue'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = issueLicenceBody.safeParse(req.body)
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid licence request', code: 'VALIDATION_ERROR' })
      }
      const actorEmail = req.user?.email ?? 'admin'
      return handle(reply, async () => {
        const signed = await offlineLicenseService.issueDeviceLicense(parsed.data)
        await AdminSecurityService.logSecurityEvent({
          eventType: 'OFFLINE_LICENSE_ISSUED',
          adminEmail: actorEmail,
          details: {
            licenseId: signed.payload.license_id,
            deviceId: signed.payload.device_id,
            expiresAt: signed.payload.expires_at,
          },
        })
        // The code is shown once, in a dialog, to be pasted on the device.
        return { code: encodeLicenseCode(signed), expiresAt: signed.payload.expires_at }
      })
    },
  )

  fastify.post(
    '/api/admin/offline/licences/:id/revoke',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('offline.licences.revoke'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string }
      const actorEmail = req.user?.email ?? 'admin'

      return handle(reply, async () => {
        const workspaceId = await offlineLicenseService.workspaceOfLicense(id)
        const result = await offlineLicenseService.revokeLicense(workspaceId, id)
        await AdminSecurityService.logSecurityEvent({
          eventType: 'OFFLINE_LICENSE_REVOKED',
          adminEmail: actorEmail,
          details: { licenseId: id, workspaceId },
        })
        return result
      })
    },
  )

  // ─── 2. TAB: DEVICES (SEATS) ──────────────────────────────────
  fastify.get(
    '/api/admin/offline/devices',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('offline.devices.read'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId } = req.query as { workspaceId?: string }
      return handle(reply, async () => {
        let query = supabase
          .from('license_devices')
          .select('*')
          .order('created_at', { ascending: false })

        if (workspaceId) {
          query = query.eq('workspace_id', workspaceId)
        }

        const { data, error } = await query.limit(100)
        if (error) throw error
        return { devices: data ?? [] }
      })
    },
  )

  fastify.post(
    '/api/admin/offline/devices/:id/release',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('offline.devices.release'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string }
      const actorEmail = req.user?.email ?? 'admin'

      return handle(reply, async () => {
        const workspaceId = await offlineLicenseService.workspaceOfDevice(id)
        const result = await offlineLicenseService.releaseDevice(workspaceId, id)
        await AdminSecurityService.logSecurityEvent({
          eventType: 'OFFLINE_DEVICE_RELEASED',
          adminEmail: actorEmail,
          details: { deviceId: id, workspaceId },
        })
        return result
      })
    },
  )

  // ─── 3. TAB: LICENCE LOG (APPEND-ONLY) ─────────────────────────
  fastify.get(
    '/api/admin/offline/logs',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('offline.licences.read'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId, licenseId, event, fromDate, toDate } = req.query as {
        workspaceId?: string
        licenseId?: string
        event?: string
        fromDate?: string
        toDate?: string
      }

      return handle(reply, async () => {
        let query = supabase
          .from('license_logs')
          .select('*')
          .order('created_at', { ascending: false })

        if (workspaceId) query = query.eq('workspace_id', workspaceId)
        if (licenseId) query = query.eq('license_id', licenseId)
        if (event) query = query.eq('event', event)
        if (fromDate) query = query.gte('created_at', fromDate)
        if (toDate) query = query.lte('created_at', toDate)

        const { data, error } = await query.limit(100)
        if (error) throw error
        return { logs: data ?? [] }
      })
    },
  )

  // ─── 4. TAB: AUTOMATIC BANS (TIER-1) ──────────────────────────
  fastify.get(
    '/api/admin/offline/bans',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('offline.licences.read'),
      ],
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      return handle(reply, async () => {
        const { data, error } = await supabase
          .from('offline_licenses')
          .select('*')
          .eq('status', 'banned')
          .order('banned_at', { ascending: false })

        if (error) throw error
        return { bans: data ?? [] }
      })
    },
  )

  fastify.post(
    '/api/admin/offline/bans/:id/lift',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('offline.licences.revoke'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string }
      const body = liftBanBody.parse(req.body)
      const actorEmail = req.user?.email ?? 'admin'

      return handle(reply, async () => {
        const workspaceId = await offlineLicenseService.workspaceOfLicense(id)
        const result = await offlineLicenseService.unbanLicense({
          workspaceId,
          licenseId: id,
          reason: body.reason,
          adminId: actorEmail,
        })

        await AdminSecurityService.logSecurityEvent({
          eventType: 'OFFLINE_LICENSE_UNBANNED',
          adminEmail: actorEmail,
          details: { licenseId: id, workspaceId, reason: body.reason },
        })

        return result
      })
    },
  )

  // ─── 5. TAB: REVIEW QUEUE (TIER-2 SIGNALS) ────────────────────
  fastify.get(
    '/api/admin/offline/reviews',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('offline.licences.read'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId } = req.query as { workspaceId?: string }
      return handle(reply, async () => {
        let query = supabase
          .from('license_review_queue')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        if (workspaceId) query = query.eq('workspace_id', workspaceId)

        const { data, error } = await query
        if (error) throw error
        return { reviews: data ?? [] }
      })
    },
  )

  fastify.post(
    '/api/admin/offline/reviews/:id/decide',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('offline.licences.revoke'),
        requireAdminStepUp,
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string }
      const body = decideReviewBody.parse(req.body)
      const actorEmail = req.user?.email ?? 'admin'

      return handle(reply, async () => {
        if (body.verdict === 'ban') {
          // Report tier-1 violation to ban licence
          await offlineLicenseService.reportTier1Violation({
            workspaceId: await offlineLicenseService.workspaceOfLicense(body.licenseId),
            licenseId: body.licenseId,
            violation: 'admin_confirmed_review',
            evidence: { reviewId: id, reason: body.reason },
            ipAddress: req.ip,
          })
        }

        // Update review status
        const { data, error } = await supabase
          .from('license_review_queue')
          .update({
            status: body.verdict === 'ban' ? 'banned' : 'dismissed',
            decided_at: new Date().toISOString(),
            decided_by: actorEmail,
            decision_notes: body.reason,
          })
          .eq('id', id)
          .select()
          .single()

        if (error) throw error

        await AdminSecurityService.logSecurityEvent({
          eventType: `OFFLINE_REVIEW_${body.verdict.toUpperCase()}`,
          adminEmail: actorEmail,
          details: { reviewId: id, verdict: body.verdict, reason: body.reason },
        })

        return data
      })
    },
  )

  // ─── FLEET HEALTH & KEY ROTATION ──────────────────────────────
  fastify.get(
    '/api/admin/offline/fleet-health',
    {
      preHandler: [
        authenticate,
        platformAdminGuard,
        requireAdminPermission('offline.licences.read'),
      ],
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      return handle(reply, async () => {
        const { count: activeCount } = await supabase
          .from('offline_licenses')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active')

        const { count: bannedCount } = await supabase
          .from('offline_licenses')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'banned')

        const { count: devicesCount } = await supabase
          .from('license_devices')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)

        const signingKey = offlineLicenseService.getSigningKey()

        return {
          health: {
            activeLicences: activeCount ?? 0,
            bannedLicences: bannedCount ?? 0,
            activeDevices: devicesCount ?? 0,
            keyId: signingKey?.keyId ?? 'unconfigured',
            signingConfigured: Boolean(signingKey),
          },
        }
      })
    },
  )
}
