// ============================================
// backend/src/routes/billing.routes.ts
// Billing & Subscription Routes
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { BillingService, PLANS, PLAN_PRICING } from '../services/billing.service'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'
import { Plan, type Tier1EvidenceType, type Tier2SignalType } from '@hisabche/validation'
import { BaseError } from '../errors/base.error'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'
import { subscriptionUpgradeService } from '../services/subscription-upgrade.service'
import {
  cleanPatch,
  getWorkspaceOverride,
  listPlanSettings,
  savePlanSettings,
  saveWorkspaceOverride,
  type LimitPatch,
} from '../services/plan-limits.service'
import {
  offlineLicenseService,
  LicenseSigningNotConfiguredError,
  OfflinePlanRequiredError,
  LicenseSeatsFullError,
  LicenseTransfersExceededError,
  LicenseBannedError,
  LicenseRevokedError,
} from '../services/offline-license.service'
import { supabase } from '../db'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function billingRoutes(fastify: FastifyInstance) {
  const billingService = new BillingService()

  // ─── GET /api/billing/plans ──────────────────────────────────
  fastify.get(
    '/api/billing/plans',
    {
      schema: {
        response: {
          200: toJsonSchema(
            z.array(
              z.object({
                plan: z.enum(['free', 'pro', 'enterprise']), // ✅ اصلاح: اضافه کردن free
                name: z.string(),
                priceMonthly: z.number().nullable(),
                priceYearly: z.number().nullable(),
                /**
                 * ⚠️ MAKING AN EXISTING ASSUMPTION EXPLICIT, NOT A NEW DECISION.
                 *
                 * The prices below are bare numbers with no currency attached,
                 * and the pricing UI rendered them as `${plan.priceMonthly}` —
                 * a hardcoded dollar sign in the component. So the product has
                 * always charged in dollars; it just never said so anywhere a
                 * reader could check.
                 *
                 * Declaring it here means the client stops asserting a currency
                 * of its own. It does NOT change what is charged.
                 *
                 * ⚠️ The owner should confirm this is right. Everything else in
                 * this product prices in the workspace's own currency, and
                 * subscription pricing being in USD is a business decision that
                 * is nowhere written down.
                 */
                currency: z.string(),
                limits: z.any(),
                featureKeys: z.array(z.string()), // ✅ تغییر: features → featureKeys
              }),
            ),
          ),
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const plans = Object.entries(PLANS).map(([key, value]) => ({
        plan: key as Plan,
        name: value.name,
        // ⚠️ From `PLAN_PRICING`, not from a literal here. A second copy of
        // a price is how the pricing page and the referral commission come to
        // disagree about what someone paid.
        priceMonthly: PLAN_PRICING[key as Plan].monthly,
        priceYearly: PLAN_PRICING[key as Plan].yearly,
        currency: PLAN_PRICING[key as Plan].currency,
        limits: value.limits,
        featureKeys: value.featureKeys, // ✅ تغییر: features → featureKeys
      }))
      return reply.send(plans)
    },
  )

  // ─── GET /api/billing/subscription ───────────────────────────
  // A subscription belongs to the WORKSPACE (DECISION A), so the route resolves
  // one and the cache is keyed by it. Keyed by user, two members of the same
  // shop were served two different answers about the same subscription.
  fastify.get(
    '/api/billing/subscription',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'subscription' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const subscription = await billingService.getCurrentSubscription(
        request.userId,
        request.tenancy.workspaceId,
      )
      const trial = await billingService.checkTrialStatus(request.userId)
      // The same verdict the write guard enforces, so the client shows the lock
      // from the server's rule rather than recomputing expiry from dates.
      const access = await billingService.getWorkspaceAccess(request.tenancy.workspaceId)
      return reply.send({ ...subscription, trial, access })
    },
  )

  /** An HTTP error from the upgrade service keeps its status and its code. */
  const upgradeFail = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof BaseError) {
      return reply.code(err.statusCode).send({ error: err.message, code: err.message })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: fallback })
  }

  // ─── POST /api/billing/upgrade ──────────────────────────────
  //
  // ⚠️ A REQUEST, NOT AN ACTIVATION. This used to make the caller's
  // subscription pro/enterprise immediately, with no payment, for every
  // workspace they owned. It now records a request for THIS workspace; the
  // plan changes only when the platform admin approves it after the money
  // arrived (services/subscription-upgrade.service.ts).
  fastify.post(
    '/api/billing/upgrade',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        body: toJsonSchema(
          z.object({
            plan: z.enum(['pro', 'enterprise']),
            interval: z.enum(['month', 'year']).default('month'),
            paymentMethod: z.enum(['card_to_card', 'gateway', 'manual']).optional(),
            paymentReference: z.string().trim().max(120).optional(),
            note: z.string().trim().max(500).optional(),
          }),
        ),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Buying for the business is the owner's (or an admin's) decision.
      if (!['owner', 'admin'].includes(request.tenancy.role)) {
        return reply.code(403).send({ error: 'UPGRADE_FORBIDDEN', code: 'UPGRADE_FORBIDDEN' })
      }
      const body = request.body as {
        plan: 'pro' | 'enterprise'
        interval: 'month' | 'year'
        paymentMethod?: 'card_to_card' | 'gateway' | 'manual'
        paymentReference?: string
        note?: string
      }
      try {
        const current = await billingService.getCurrentSubscription(
          request.userId,
          request.tenancy.workspaceId,
        )
        if (current.plan === body.plan && !current.isTrial && current.status === 'active') {
          return reply.code(409).send({ error: 'ALREADY_ON_PLAN', code: 'ALREADY_ON_PLAN' })
        }
        const created = await subscriptionUpgradeService.request(request.tenancy, current.plan, {
          plan: body.plan,
          interval: body.interval,
          paymentMethod: body.paymentMethod,
          paymentReference: body.paymentReference,
          note: body.note,
        })
        return reply.code(201).send(created)
      } catch (err) {
        return upgradeFail(reply, err, 'Failed to request the upgrade')
      }
    },
  )

  // ─── GET /api/billing/upgrade-requests ──────────────────────
  // This workspace's requests and its subscription log (purchases,
  // activations, the period end of each).
  fastify.get(
    '/api/billing/upgrade-requests',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await subscriptionUpgradeService.history(request.tenancy))
      } catch (err) {
        return upgradeFail(reply, err, 'Failed to read upgrade requests')
      }
    },
  )

  // ─── POST /api/billing/upgrade-requests/:id/cancel ──────────
  fastify.post(
    '/api/billing/upgrade-requests/:id/cancel',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!['owner', 'admin'].includes(request.tenancy.role)) {
        return reply.code(403).send({ error: 'UPGRADE_FORBIDDEN', code: 'UPGRADE_FORBIDDEN' })
      }
      try {
        await subscriptionUpgradeService.cancel(
          request.tenancy,
          (request.params as { id: string }).id,
        )
        return reply.send({ success: true })
      } catch (err) {
        return upgradeFail(reply, err, 'Failed to cancel the upgrade request')
      }
    },
  )

  // ─── Platform admin: the queue ──────────────────────────────
  fastify.get(
    '/api/admin/upgrade-requests',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const status = z
        .enum(['pending', 'approved', 'rejected', 'cancelled', 'all'])
        .catch('pending')
        .parse((request.query as { status?: string }).status)
      try {
        return reply.send(await subscriptionUpgradeService.listForAdmin(status))
      } catch (err) {
        return upgradeFail(reply, err, 'Failed to read upgrade requests')
      }
    },
  )

  const decisionSchema = z.object({
    /** Minor units. Required for a plan the product does not price (enterprise). */
    amountMinor: z.number().int().nonnegative().nullable().optional(),
    note: z.string().trim().max(500).optional(),
  })

  fastify.post(
    '/api/admin/upgrade-requests/:id/approve',
    {
      preHandler: [authenticate, platformAdminGuard],
      schema: { body: toJsonSchema(decisionSchema) },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = decisionSchema.parse(request.body ?? {})
      try {
        const subscriptionId = await subscriptionUpgradeService.approve(
          request.userId,
          (request.params as { id: string }).id,
          body.amountMinor ?? null,
          body.note || null,
        )
        await billingService.afterApprovedUpgrade(subscriptionId)
        return reply.send({ success: true, subscriptionId })
      } catch (err) {
        return upgradeFail(reply, err, 'Failed to approve the upgrade')
      }
    },
  )

  fastify.post(
    '/api/admin/upgrade-requests/:id/reject',
    {
      preHandler: [authenticate, platformAdminGuard],
      schema: { body: toJsonSchema(decisionSchema) },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = decisionSchema.parse(request.body ?? {})
      try {
        await subscriptionUpgradeService.reject(
          request.userId,
          (request.params as { id: string }).id,
          body.note || null,
        )
        return reply.send({ success: true })
      } catch (err) {
        return upgradeFail(reply, err, 'Failed to reject the upgrade')
      }
    },
  )

  // ─── POST /api/billing/cancel ───────────────────────────────
  fastify.post(
    '/api/billing/cancel',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const subscription = await billingService.cancel(request.userId)
      await clearCache(`subscription:${request.userId}`)
      return reply.send(subscription)
    },
  )

  // ─── GET /api/billing/usage ──────────────────────────────────
  // Usage meters count WORKSPACE-owned rows (invoices, transactions, seats),
  // so the response is workspace-scoped data: membership is enforced and the
  // cache is keyed by the workspace, not by whichever member asked.
  fastify.get(
    '/api/billing/usage',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 120, keyPrefix: 'usage' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // ⚠️ The report IS the response: { usage, limits, plan, isTrial }. It was
      // wrapped again as { usage: report, limits }, so the page read
      // `usage.usage.invoices` → report.invoices → undefined and printed
      // «/ ∞» with no number in front (reported on /billing).
      const { workspaceId } = request.tenancy
      return reply.send(await billingService.getUsageReport(request.userId, workspaceId))
    },
  )

  // ─── GET /api/billing/trial-status ──────────────────────────
  fastify.get(
    '/api/billing/trial-status',
    {
      preHandler: [authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const status = await billingService.checkTrialStatus(request.userId)
      return reply.send(status)
    },
  )

  // ─── Platform admin: plan limits ────────────────────────────
  //
  //   GET /api/admin/plan-limits                    defaults, settings, effective — per plan
  //   PUT /api/admin/plan-limits/:plan              { invoices?, users?, aiMonthly? }
  //   GET /api/admin/workspace-limits/:workspaceId  this workspace's override
  //   PUT /api/admin/workspace-limits/:workspaceId  { limits, note }
  //
  // A key sent as null = unlimited; a key left out = inherit from the layer
  // below. AI questions cost money: null is refused for aiMonthly.
  const limitsFail = (reply: FastifyReply, err: unknown) => {
    if (err instanceof Error && err.message === 'PLAN_LIMITS_NOT_CONFIGURED') {
      return reply
        .code(503)
        .send({ error: 'PLAN_LIMITS_NOT_CONFIGURED', code: 'PLAN_LIMITS_NOT_CONFIGURED' })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: 'Failed to save the limits' })
  }
  const refuseUnlimitedAi = (patch: LimitPatch, reply: FastifyReply) =>
    'aiMonthly' in patch && patch.aiMonthly === null
      ? reply.code(400).send({ error: 'AI_LIMIT_REQUIRED', code: 'AI_LIMIT_REQUIRED' })
      : null

  fastify.get(
    '/api/admin/plan-limits',
    { preHandler: [authenticate, platformAdminGuard] },
    async () => listPlanSettings(),
  )

  fastify.put(
    '/api/admin/plan-limits/:plan',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const plan = (request.params as { plan: string }).plan
      if (!['free', 'pro', 'enterprise'].includes(plan)) {
        return reply.code(400).send({ error: 'UNKNOWN_PLAN', code: 'UNKNOWN_PLAN' })
      }
      const patch = cleanPatch(request.body)
      const refused = refuseUnlimitedAi(patch, reply)
      if (refused) return refused
      try {
        await savePlanSettings(plan, patch, request.userId)
        return reply.send({ success: true })
      } catch (err) {
        return limitsFail(reply, err)
      }
    },
  )

  fastify.get(
    '/api/admin/workspace-limits/:workspaceId',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest) =>
      getWorkspaceOverride((request.params as { workspaceId: string }).workspaceId),
  )

  fastify.put(
    '/api/admin/workspace-limits/:workspaceId',
    { preHandler: [authenticate, platformAdminGuard] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = (request.params as { workspaceId: string }).workspaceId
      if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) {
        return reply.code(400).send({ error: 'INVALID_WORKSPACE_ID', code: 'INVALID_WORKSPACE_ID' })
      }
      const body = (request.body ?? {}) as { limits?: unknown; note?: unknown }
      const patch = cleanPatch(body.limits)
      const refused = refuseUnlimitedAi(patch, reply)
      if (refused) return refused
      try {
        await saveWorkspaceOverride(
          workspaceId,
          patch,
          typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null,
          request.userId,
        )
        return reply.send({ success: true })
      } catch (err) {
        return limitsFail(reply, err)
      }
    },
  )

  // ─── POST /api/billing/offline-license ───────────────────────
  fastify.post(
    '/api/billing/offline-license',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const body = (request.body ?? {}) as {
        deviceId?: string
        device_id?: string
        label?: string
        features?: string[]
        periodDays?: number
      }
      const deviceId = body.deviceId ?? body.device_id
      try {
        const license = await offlineLicenseService.issueOfflineLicense({
          workspaceId,
          accountId: request.userId,
          deviceId,
          label: body.label,
          features: body.features,
          periodDays: body.periodDays,
        })
        return reply.code(201).send({ license })
      } catch (err: unknown) {
        if (err instanceof LicenseSigningNotConfiguredError) {
          return reply
            .code(err.statusCode)
            .send({ error: err.code, code: err.code, message: err.message })
        }
        if (err instanceof OfflinePlanRequiredError) {
          return reply
            .code(err.statusCode)
            .send({ error: err.code, code: err.code, message: err.message })
        }
        if (err instanceof BaseError) {
          return reply
            .code(err.statusCode)
            .send({ error: err.name, code: err.name, message: err.message })
        }
        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          code: 'INTERNAL_ERROR',
          message: 'Failed to issue licence',
        })
      }
    },
  )

  // ─── GET /api/billing/offline-license ────────────────────────
  fastify.get(
    '/api/billing/offline-license',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')],
    },
    async (request: FastifyRequest) => {
      const workspaceId = request.tenancy.workspaceId
      const licenses = await offlineLicenseService.listLicenses(workspaceId)
      return { licenses }
    },
  )

  // ─── POST /api/billing/offline-license/:licenseId/revoke ───────
  fastify.post(
    '/api/billing/offline-license/:licenseId/revoke',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const { licenseId } = request.params as { licenseId: string }
      if (!licenseId || !/^[0-9a-f-]{36}$/i.test(licenseId)) {
        return reply.code(400).send({ error: 'INVALID_LICENSE_ID', code: 'INVALID_LICENSE_ID' })
      }
      const result = await offlineLicenseService.revokeLicense(workspaceId, licenseId)
      return reply.send(result)
    },
  )

  // ─── GET /api/billing/offline-license/revocations ─────────────
  fastify.get(
    '/api/billing/offline-license/revocations',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest) => {
      const workspaceId = request.tenancy.workspaceId
      const revocations = await offlineLicenseService.listRevocations(workspaceId)
      return { revocations }
    },
  )

  // ─── POST /api/billing/offline-license/activate-seat ──────────
  fastify.post(
    '/api/billing/offline-license/activate-seat',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const body = (request.body ?? {}) as {
        licenseId?: string
        seat?: string
        stableId?: string
        devicePublicKey?: string
        label?: string
        allowTransfer?: boolean
      }

      if (!body.licenseId || !/^[0-9a-f-]{36}$/i.test(body.licenseId)) {
        return reply.code(400).send({ error: 'INVALID_LICENSE_ID', code: 'INVALID_LICENSE_ID' })
      }
      if (body.seat !== 'computer' && body.seat !== 'mobile') {
        return reply.code(400).send({
          error: 'INVALID_SEAT',
          code: 'INVALID_SEAT',
          message: 'Seat must be computer or mobile',
        })
      }
      if (!body.stableId || typeof body.stableId !== 'string') {
        return reply.code(400).send({ error: 'INVALID_STABLE_ID', code: 'INVALID_STABLE_ID' })
      }
      if (!body.devicePublicKey || typeof body.devicePublicKey !== 'string') {
        return reply.code(400).send({ error: 'INVALID_PUBLIC_KEY', code: 'INVALID_PUBLIC_KEY' })
      }

      // No override from a customer: the workspace OWNER is the customer, so
      // «owner may override» let any shop lift its own 3-transfers-a-year limit.
      // A broken device is handled by a Hisabche admin releasing the old seat
      // (POST /api/admin/offline/devices/:id/release, RBAC + fresh TOTP).

      try {
        const result = await offlineLicenseService.activateSeat({
          workspaceId,
          licenseId: body.licenseId,
          seat: body.seat,
          stableId: body.stableId,
          devicePublicKey: body.devicePublicKey,
          label: body.label,
          ipAddress: request.ip,
          allowTransfer: body.allowTransfer,
        })
        return reply.send({ success: true, ...result })
      } catch (err: unknown) {
        if (
          err instanceof LicenseSeatsFullError ||
          err instanceof LicenseTransfersExceededError ||
          err instanceof LicenseBannedError ||
          err instanceof LicenseRevokedError
        ) {
          return reply.code(err.statusCode).send({
            error: err.code,
            code: err.code,
            message: err.message,
          })
        }
        if (err instanceof BaseError) {
          return reply
            .code(err.statusCode)
            .send({ error: err.name, code: err.name, message: err.message })
        }
        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          code: 'INTERNAL_ERROR',
          message: 'Failed to activate seat',
        })
      }
    },
  )

  // ─── POST /api/billing/offline-license/connect ────────────────
  fastify.post(
    '/api/billing/offline-license/connect',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const body = (request.body ?? {}) as {
        licenseId?: string
        deviceId?: string
      }
      if (!body.licenseId || !/^[0-9a-f-]{36}$/i.test(body.licenseId)) {
        return reply.code(400).send({ error: 'INVALID_LICENSE_ID', code: 'INVALID_LICENSE_ID' })
      }
      if (!body.deviceId || !/^[0-9a-f-]{36}$/i.test(body.deviceId)) {
        return reply.code(400).send({ error: 'INVALID_DEVICE_ID', code: 'INVALID_DEVICE_ID' })
      }

      try {
        const result = await offlineLicenseService.connectDevice({
          workspaceId,
          licenseId: body.licenseId,
          deviceId: body.deviceId,
          ipAddress: request.ip,
        })
        return reply.send(result)
      } catch (err: unknown) {
        if (err instanceof BaseError) {
          return reply
            .code(err.statusCode)
            .send({ error: err.name, code: err.name, message: err.message })
        }
        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          code: 'INTERNAL_ERROR',
          message: 'Failed to connect device',
        })
      }
    },
  )

  // ─── POST /api/billing/offline-license/tier1-report ───────────
  //
  // ⚠️ A device's OWN report is a claim, not evidence. This route used to ban
  // the licence on whatever `violation` the body named — so any member of a
  // workspace could permanently ban that workspace's licence with one request,
  // and a patched app could simply never call it. A tier-1 ban needs evidence
  // the SERVER verified; a self-report goes to the admin review queue, where a
  // person decides (BUG-138).
  fastify.post(
    '/api/billing/offline-license/tier1-report',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const body = (request.body ?? {}) as {
        licenseId?: string
        violation?: Tier1EvidenceType
        evidence?: Record<string, unknown>
        deviceSeat?: 'computer' | 'mobile'
        stableId?: string
      }
      if (!body.licenseId || !/^[0-9a-f-]{36}$/i.test(body.licenseId)) {
        return reply.code(400).send({ error: 'INVALID_LICENSE_ID', code: 'INVALID_LICENSE_ID' })
      }
      const reportable: Tier1EvidenceType[] = [
        'unregistered_device_key',
        'invalid_signature',
        'seat_key_collision',
        'tampered_app_integrity',
      ]
      if (!body.violation || !reportable.includes(body.violation)) {
        return reply
          .code(400)
          .send({ error: 'INVALID_VIOLATION_TYPE', code: 'INVALID_VIOLATION_TYPE' })
      }

      try {
        const result = await offlineLicenseService.reportTier2Signal({
          workspaceId,
          licenseId: body.licenseId,
          signalType: 'device_self_report',
          details: { claimedViolation: body.violation, ...(body.evidence ?? {}) },
          deviceSeat: body.deviceSeat,
          stableId: body.stableId,
          ipAddress: request.ip,
        })
        return reply.send(result)
      } catch (err: unknown) {
        if (err instanceof BaseError) {
          return reply
            .code(err.statusCode)
            .send({ error: err.name, code: err.name, message: err.message })
        }
        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          code: 'INTERNAL_ERROR',
          message: 'Failed to record the report',
        })
      }
    },
  )

  // ─── POST /api/billing/offline-license/tier2-report ───────────
  fastify.post(
    '/api/billing/offline-license/tier2-report',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const body = (request.body ?? {}) as {
        licenseId?: string
        signalType?: Tier2SignalType
        details?: Record<string, unknown>
        deviceSeat?: 'computer' | 'mobile'
        stableId?: string
      }

      if (!body.licenseId || !/^[0-9a-f-]{36}$/i.test(body.licenseId)) {
        return reply.code(400).send({ error: 'INVALID_LICENSE_ID', code: 'INVALID_LICENSE_ID' })
      }
      const validSignals: Tier2SignalType[] = [
        'two_business_identities',
        'parallel_invoice_sequences',
        'disparate_cities',
      ]
      if (!body.signalType || !validSignals.includes(body.signalType)) {
        return reply.code(400).send({ error: 'INVALID_SIGNAL_TYPE', code: 'INVALID_SIGNAL_TYPE' })
      }

      try {
        const result = await offlineLicenseService.reportTier2Signal({
          workspaceId,
          licenseId: body.licenseId,
          signalType: body.signalType,
          details: body.details ?? {},
          deviceSeat: body.deviceSeat,
          stableId: body.stableId,
          ipAddress: request.ip,
        })
        return reply.send(result)
      } catch (err: unknown) {
        if (err instanceof BaseError) {
          return reply
            .code(err.statusCode)
            .send({ error: err.name, code: err.name, message: err.message })
        }
        return reply.code(500).send({
          error: 'INTERNAL_ERROR',
          code: 'INTERNAL_ERROR',
          message: 'Failed to report tier-2 signal',
        })
      }
    },
  )

  // ─── GET /api/billing/offline-license/logs ────────────────────
  fastify.get(
    '/api/billing/offline-license/logs',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest) => {
      const workspaceId = request.tenancy.workspaceId
      const query = (request.query ?? {}) as { licenseId?: string }
      const logs = await offlineLicenseService.listLogs(workspaceId, query.licenseId)
      return { logs }
    },
  )

  // ─── GET /api/billing/offline-license/review-queue ────────────
  fastify.get(
    '/api/billing/offline-license/review-queue',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest) => {
      const workspaceId = request.tenancy.workspaceId
      const queue = await offlineLicenseService.listReviewQueue(workspaceId)
      return { queue }
    },
  )

  // ─── POST /api/billing/devices/activate ───────────────────────
  fastify.post(
    '/api/billing/devices/activate',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const body = (request.body ?? {}) as { deviceId?: string; device_id?: string; label?: string }
      const deviceId = body.deviceId ?? body.device_id
      if (!deviceId || !/^[0-9a-f-]{36}$/i.test(deviceId)) {
        return reply.code(400).send({ error: 'INVALID_DEVICE_ID', code: 'INVALID_DEVICE_ID' })
      }
      const device = await offlineLicenseService.activateDevice(workspaceId, deviceId, body.label)
      return reply.send({ device })
    },
  )

  // ─── POST /api/billing/devices/:deviceId/release ──────────────
  fastify.post(
    '/api/billing/devices/:deviceId/release',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = request.tenancy.workspaceId
      const { deviceId } = request.params as { deviceId: string }
      if (!deviceId || !/^[0-9a-f-]{36}$/i.test(deviceId)) {
        return reply.code(400).send({ error: 'INVALID_DEVICE_ID', code: 'INVALID_DEVICE_ID' })
      }
      const result = await offlineLicenseService.releaseDevice(workspaceId, deviceId)
      return reply.send(result)
    },
  )

  // ─── GET /api/billing/devices ─────────────────────────────────
  fastify.get(
    '/api/billing/devices',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest) => {
      const workspaceId = request.tenancy.workspaceId
      const devices = await offlineLicenseService.listDevices(workspaceId)
      return { devices }
    },
  )

  // ─── GET /api/billing/upgrade-credit ─────────────────────────
  fastify.get(
    '/api/billing/upgrade-credit',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest) => {
      const workspaceId = request.tenancy.workspaceId
      const { toPlan } = (request.query ?? {}) as { toPlan?: string }

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle()

      const now = new Date()
      const currency = 'IRR'

      const defaultOfflinePaid = 120_000_000 // 12,000,000 Toman in IRR
      let amountPaid = defaultOfflinePaid
      let periodStart = now
      let periodEnd = new Date(now.getTime() + 365 * 24 * 3600 * 1000)

      if (sub?.period_start && sub?.period_end) {
        periodStart = new Date(sub.period_start)
        periodEnd = new Date(sub.period_end)
      }

      const { data: lastPaid } = await supabase
        .from('subscription_upgrade_requests')
        .select('amount_minor, currency')
        .eq('workspace_id', workspaceId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastPaid?.amount_minor) {
        amountPaid = lastPaid.amount_minor
      }

      const totalTermDays = Math.max(
        1,
        Math.round((periodEnd.getTime() - periodStart.getTime()) / (24 * 3600 * 1000)),
      )
      const unusedDays = Math.max(
        0,
        Math.round((periodEnd.getTime() - now.getTime()) / (24 * 3600 * 1000)),
      )
      const creditAmount = Math.min(
        amountPaid,
        Math.round((amountPaid * unusedDays) / totalTermDays),
      )

      const newPlanPrices: Record<string, number> = {
        ONLINE_500: 300_000_000,
        ONLINE_1000: 400_000_000,
        ONLINE_1500: 450_000_000,
        pro: 300_000_000,
      }
      const newPlanPrice = newPlanPrices[toPlan ?? 'ONLINE_500'] ?? 300_000_000
      const totalDue = Math.max(0, newPlanPrice - creditAmount)

      return {
        amountPaid,
        currency,
        termDays: totalTermDays,
        unusedDays,
        creditAmount,
        newPlanPrice,
        totalDue,
      }
    },
  )
}
