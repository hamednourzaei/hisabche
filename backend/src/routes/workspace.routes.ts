// ============================================
// backend/src/routes/workspace.routes.ts
// ============================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  updateMemberRoleSchema,
  createInviteSchema,
  acceptInviteSchema,
  createMemberDirectBodySchema,
  setMemberSuspensionSchema,
  isBrandAssetType,
  sanitizeSvgBrandAsset,
} from '@hisabche/validation'
import { WorkspaceService } from '../services/workspace.service'
import {
  BrandAssetError,
  BrandAssetService,
  verifyBrandAssetSignature,
} from '../services/brand-asset.service'
import { BackupService } from '../services/workspace/backup.service'
import { backupToMarkdown, backupToXlsx } from '../services/workspace/backup-formats'
import { BillingService } from '../services/billing.service'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireActiveSubscriptionForWorkspaceParam } from '../middleware/subscription.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'
import { PlanLimitError } from '../services/plan-limits.service'
import { toJsonSchema } from '../utils/json-schema'

export async function workspaceRoutes(fastify: FastifyInstance) {
  const svc = new WorkspaceService()
  const brandAssetSvc = new BrandAssetService(svc)
  const backupSvc = new BackupService()
  const billingForBackup = new BillingService()

  // ─── GET /api/workspaces/backup ─────────────────────────
  //
  // G7 — a backup that contains the business's actual data.
  //
  // The settings button used to download `useBackupStore().exportData()`: the
  // LIST OF PREVIOUS BACKUP ENTRIES from localStorage, plus a client-side
  // audit log. No invoices, no customers, no products. It would have been
  // discovered worthless at the moment someone needed it.
  //
  // ⚠️ `requireWorkspaceContext`, so the workspace comes from the verified
  // context and never from the request — a backup addressed by a workspace id
  // in the URL would be the widest possible IDOR in the product.
  //
  // Uncached, and declared BEFORE `/api/workspaces/:id` so `backup` is never
  // read as a workspace id.
  fastify.get(
    '/api/workspaces/backup',
    {
      preHandler: [authenticate, requireWorkspaceContext],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const format = String((request.query as { format?: unknown }).format ?? 'json')
        if (!['json', 'md', 'xlsx'].includes(format)) {
          return reply.code(400).send({ error: 'UNKNOWN_FORMAT', code: 'UNKNOWN_FORMAT' })
        }
        // Markdown and Excel are the paid plans' — decided by THIS workspace's
        // subscription on the server, not by which button the page showed.
        if (format !== 'json') {
          const subscription = await billingForBackup.getCurrentSubscription(
            request.tenancy.userId,
            request.tenancy.workspaceId,
          )
          if (!['pro', 'enterprise'].includes(subscription.plan) || subscription.isTrial) {
            return reply
              .code(402)
              .send({ error: 'BACKUP_FORMAT_REQUIRES_PLAN', code: 'BACKUP_FORMAT_REQUIRES_PLAN' })
          }
        }

        const backup = await backupSvc.export(request.tenancy)

        // Sent as an attachment with a dated filename, so the browser saves it
        // instead of rendering it.
        const stamp = new Date().toISOString().slice(0, 10)
        reply.header(
          'Content-Disposition',
          `attachment; filename="hisabche-backup-${stamp}.${format}"`,
        )
        if (format === 'md') {
          return reply
            .header('Content-Type', 'text/markdown; charset=utf-8')
            .send(backupToMarkdown(backup))
        }
        if (format === 'xlsx') {
          return reply
            .header(
              'Content-Type',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            )
            .send(backupToXlsx(backup))
        }
        return reply.header('Content-Type', 'application/json; charset=utf-8').send(backup)
      } catch (err) {
        // `ForbiddenError` is a 403 and lands here — a member who is not the
        // owner is refused, not told the server crashed.
        if (err instanceof BaseError && err.statusCode < 500) {
          const code = /^[A-Z][A-Z_]{6,}/.exec(err.message)?.[0]
          return reply.code(err.statusCode).send({ error: err.message, code: code ?? err.name })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to export the workspace backup' })
      }
    },
  )

  // ─── POST /api/workspaces/restore ─────────────────────────
  // A portable archive is restored by the DEVICE's local engine, where the
  // SQLite rows actually live. The server has no such database and must never
  // pretend to import one. This route exists so the shared UI hook always
  // reaches a real address: on the cloud host it answers with a clear code,
  // on the desktop host the local transport handles the same path offline.
  fastify.post(
    '/api/workspaces/restore',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('data.import')],
    },
    async (_request: FastifyRequest, reply: FastifyReply) =>
      reply.code(400).send({
        error: 'RESTORE_LOCAL_ONLY',
        code: 'RESTORE_LOCAL_ONLY',
        message: 'Restore runs in the device local engine, not on the cloud API.',
      }),
  )

  fastify.get(
    '/api/workspaces',
    {
      preHandler: [
        authenticate,
        cacheMiddleware({ scope: 'user', ttl: 120, keyPrefix: 'workspaces' }),
      ],
    },
    async (req, reply) => {
      try {
        return reply.send(await svc.getMyWorkspaces(req.userId))
      } catch (e) {
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.post(
    '/api/workspaces',
    {
      preHandler: [authenticate],
      schema: { body: toJsonSchema(createWorkspaceSchema) },
    },
    async (req, reply) => {
      try {
        const result = await svc.createWorkspace(req.userId, createWorkspaceSchema.parse(req.body))
        await clearCache('workspaces:*')
        return reply.code(201).send(result)
      } catch (e) {
        if (e instanceof z.ZodError)
          return reply.code(400).send({ error: 'Validation', details: e.errors })
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.get(
    '/api/workspaces/:id',
    {
      preHandler: [
        authenticate,
        cacheMiddleware({ scope: 'user', ttl: 120, keyPrefix: 'workspace' }),
      ],
    },
    async (req, reply) => {
      try {
        return reply.send(await svc.getWorkspace(req.userId, (req.params as { id: string }).id))
      } catch (e) {
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  // ⚠️ FIX: `updateWorkspaceSchema` is `workspaceSchema.partial().extend({ id })`,
  // so it makes `id` REQUIRED IN THE BODY. But the id lives in the URL — the
  // client correctly sends only the changed fields, and Fastify rejected every
  // request with "body must have required property 'id'". That broke both the
  // profile edit form and the logo/stamp upload.
  //
  // The id is omitted from the body contract here (the same pattern this file
  // already uses for `createInviteSchema.omit({ workspaceId: true })`), and the
  // path param stays the single source of which workspace is being updated —
  // so a body id can never disagree with the URL.
  const updateWorkspaceBodySchema = updateWorkspaceSchema.omit({ id: true })

  fastify.patch(
    '/api/workspaces/:id',
    {
      preHandler: [authenticate, requireActiveSubscriptionForWorkspaceParam],
      schema: { body: toJsonSchema(updateWorkspaceBodySchema) },
    },
    async (req, reply) => {
      try {
        const parsedBody = updateWorkspaceBodySchema.parse(req.body)
        // Sanitize any inline SVG data URI sent through legacy PATCH /api/workspaces/:id
        const legacyFields = ['logoUrl', 'stampUrl', 'signatureUrl'] as const
        for (const f of legacyFields) {
          const val = parsedBody[f]
          if (typeof val === 'string' && val.startsWith('data:image/svg+xml')) {
            const commaIdx = val.indexOf(',')
            if (commaIdx !== -1) {
              const meta = val.slice(0, commaIdx)
              const rawPayload = val.slice(commaIdx + 1)
              const svgText = meta.includes(';base64')
                ? Buffer.from(rawPayload, 'base64').toString('utf8')
                : decodeURIComponent(rawPayload)
              const check = sanitizeSvgBrandAsset(svgText)
              if (!check.ok) {
                return reply.code(400).send({ error: check.reason, code: check.code })
              }
            }
          }
        }
        const result = await svc.updateWorkspace(
          req.userId,
          (req.params as { id: string }).id,
          parsedBody,
        )
        await clearCache(`workspace:${(req.params as { id: string }).id}`)
        await clearCache('workspaces:*')
        return reply.send(result)
      } catch (e) {
        if (e instanceof z.ZodError)
          return reply.code(400).send({ error: 'Validation', details: e.errors })
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.get(
    '/api/workspaces/:id/members',
    {
      preHandler: [
        authenticate,
        cacheMiddleware({ scope: 'user', ttl: 60, keyPrefix: 'workspace-members' }),
      ],
    },
    async (req, reply) => {
      try {
        return reply.send(await svc.listMembers(req.userId, (req.params as { id: string }).id))
      } catch (e) {
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.patch(
    '/api/workspaces/:id/members/role',
    {
      preHandler: [authenticate, requireActiveSubscriptionForWorkspaceParam],
      schema: { body: toJsonSchema(updateMemberRoleSchema) },
    },
    async (req, reply) => {
      try {
        const result = await svc.updateMemberRole(
          req.userId,
          (req.params as { id: string }).id,
          updateMemberRoleSchema.parse(req.body),
        )
        await clearCache(`workspace-members:${(req.params as { id: string }).id}:*`)
        return reply.send(result)
      } catch (e) {
        if (e instanceof z.ZodError)
          return reply.code(400).send({ error: 'Validation', details: e.errors })
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.delete(
    '/api/workspaces/:id/members/:memberId',
    {
      preHandler: [authenticate, requireActiveSubscriptionForWorkspaceParam],
    },
    async (req, reply) => {
      try {
        const { id, memberId } = req.params as { id: string; memberId: string }
        const result = await svc.removeMember(req.userId, id, memberId)
        await clearCache(`workspace-members:${id}:*`)
        return reply.send(result)
      } catch (e) {
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.post(
    '/api/workspaces/:id/leave',
    {
      preHandler: [authenticate],
    },
    async (req, reply) => {
      try {
        const result = await svc.leaveWorkspace(req.userId, (req.params as { id: string }).id)
        await clearCache(`workspace-members:${(req.params as { id: string }).id}:*`)
        await clearCache('workspaces:*')
        return reply.send(result)
      } catch (e) {
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.get(
    '/api/workspaces/:id/invites',
    {
      preHandler: [
        authenticate,
        cacheMiddleware({ scope: 'user', ttl: 60, keyPrefix: 'workspace-invites' }),
      ],
    },
    async (req, reply) => {
      try {
        return reply.send(await svc.listInvites(req.userId, (req.params as { id: string }).id))
      } catch (e) {
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.post(
    '/api/workspaces/:id/invites',
    {
      preHandler: [authenticate, requireActiveSubscriptionForWorkspaceParam],
      schema: { body: toJsonSchema(createInviteSchema.omit({ workspaceId: true })) },
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string }
        const data = createInviteSchema.omit({ workspaceId: true }).parse(req.body)
        const invite = await svc.createInvite(req.userId, { ...data, workspaceId: id })
        // ⚠️ Not logged: the result carries the raw invite token — anyone who
        // can read the server logs could accept the invitation in its place.
        await clearCache(`workspace-invites:${id}:*`)
        return reply.code(201).send(invite)
      } catch (e) {
        if (e instanceof z.ZodError)
          return reply.code(400).send({ error: 'Validation', details: e.errors })
        if (e instanceof PlanLimitError) {
          return reply
            .code(e.statusCode)
            .send({ error: e.code, code: e.code, feature: e.feature, limit: e.limit, used: e.used })
        }
        fastify.log.error(e)
        return reply.code(500).send({ error: 'Failed to create invite' })
      }
    },
  )

  fastify.post(
    '/api/workspaces/accept-invite',
    {
      preHandler: [authenticate],
      schema: { body: toJsonSchema(acceptInviteSchema) },
    },
    async (req, reply) => {
      try {
        const result = await svc.acceptInvite(
          req.userId,
          req.user?.email || '',
          acceptInviteSchema.parse(req.body),
        )
        await clearCache('workspaces:*')
        await clearCache('workspace-members:*')
        return reply.send(result)
      } catch (e) {
        if (e instanceof z.ZodError)
          return reply.code(400).send({ error: 'Validation', details: e.errors })
        const clientErrors = [
          'Invalid or expired invite',
          'Invite already used or cancelled',
          'Wrong email',
          'Expired',
          'Workspace inactive',
          'Already member',
        ]
        if (e instanceof Error && clientErrors.includes(e.message)) {
          return reply.code(400).send({ error: e.message })
        }
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  fastify.post(
    '/api/workspaces/:id/members/direct',
    {
      preHandler: [authenticate, requireActiveSubscriptionForWorkspaceParam],
      schema: { body: toJsonSchema(createMemberDirectBodySchema) },
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string }
        const data = createMemberDirectBodySchema.parse(req.body)
        const result = await svc.createMemberDirect(req.userId, id, { ...data, workspaceId: id })
        await clearCache(`workspace-members:${id}:*`)
        return reply.code(201).send(result)
      } catch (e) {
        if (e instanceof z.ZodError)
          return reply.code(400).send({ error: 'Validation', details: e.errors })
        const clientErrors = [
          'Insufficient permissions',
          'Email already registered',
          'Access denied',
        ]
        if (e instanceof Error && clientErrors.includes(e.message)) {
          return reply.code(400).send({ error: e.message })
        }
        fastify.log.error(e)
        return reply.code(500).send({ error: 'Failed to create member' })
      }
    },
  )

  // Suspending keeps the member row, its payroll history and its attribution
  // on past records; only sign-in stops. Deleting the member is the separate,
  // irreversible action.
  fastify.patch(
    '/api/workspaces/:id/members/suspension',
    {
      preHandler: [authenticate, requireActiveSubscriptionForWorkspaceParam],
      schema: { body: toJsonSchema(setMemberSuspensionSchema) },
    },
    async (req, reply) => {
      try {
        const { id } = req.params as { id: string }
        const { memberId, suspended } = setMemberSuspensionSchema.parse(req.body)
        const result = await svc.setMemberSuspension(req.userId, id, memberId, suspended)
        await clearCache(`workspace-members:${id}:*`)
        return reply.send(result)
      } catch (e) {
        if (e instanceof z.ZodError)
          return reply.code(400).send({ error: 'Validation', details: e.errors })
        const clientErrors = [
          'Insufficient permissions',
          'Access denied',
          'You cannot suspend your own account',
        ]
        if (e instanceof Error && clientErrors.includes(e.message)) {
          return reply.code(400).send({ error: e.message })
        }
        fastify.log.error(e)
        return reply.code(500).send({ error: 'Failed to update member suspension' })
      }
    },
  )

  fastify.delete(
    '/api/workspaces/:id/invites/:inviteId',
    {
      preHandler: [authenticate, requireActiveSubscriptionForWorkspaceParam],
    },
    async (req, reply) => {
      try {
        const { id, inviteId } = req.params as { id: string; inviteId: string }
        const result = await svc.cancelInvite(req.userId, id, inviteId)
        await clearCache(`workspace-invites:${id}:*`)
        return reply.send(result)
      } catch (e) {
        fastify.log.error(e)
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message })
        }
        return reply.code(500).send({ error: 'Failed' })
      }
    },
  )

  const uploadBrandAssetBodySchema = z.object({
    mimeType: z.string().min(1).max(100),
    dataBase64: z.string().min(1).max(3_000_000),
    originalBytes: z.number().int().positive().optional(),
    processingDurationMs: z.number().nonnegative().optional(),
  })

  const deleteBrandAssetBodySchema = z.object({
    confirm: z.literal(true),
  })

  fastify.post(
    '/api/workspaces/:id/brand-assets/:assetType',
    {
      preHandler: [authenticate, requireActiveSubscriptionForWorkspaceParam],
      schema: { body: toJsonSchema(uploadBrandAssetBodySchema) },
    },
    async (req, reply) => {
      try {
        const { id, assetType } = req.params as { id: string; assetType: string }
        if (!isBrandAssetType(assetType)) {
          return reply.code(400).send({
            error: 'Invalid brand asset type',
            code: 'INVALID_FILE_FORMAT',
          })
        }
        const body = uploadBrandAssetBodySchema.parse(req.body)
        const fileBuffer = Buffer.from(body.dataBase64, 'base64')
        const result = await brandAssetSvc.replaceBrandAsset({
          userId: req.userId,
          workspaceId: id,
          assetType,
          fileBuffer,
          declaredMimeType: body.mimeType,
          originalBytes: body.originalBytes,
          processingDurationMs: body.processingDurationMs,
        })
        return reply.send(result)
      } catch (e) {
        if (e instanceof z.ZodError) {
          return reply
            .code(400)
            .send({ error: 'Validation', code: 'INVALID_FILE_FORMAT', details: e.errors })
        }
        if (e instanceof BrandAssetError) {
          return reply.code(e.statusCode).send({
            error: e.message,
            code: e.code,
            retryable: e.retryable,
            previousAssetIntact: e.previousAssetIntact,
          })
        }
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message, code: 'PERMISSION_DENIED' })
        }
        fastify.log.error(e)
        return reply
          .code(500)
          .send({ error: 'Failed to upload brand asset', code: 'INTERNAL_SERVER_ERROR' })
      }
    },
  )

  fastify.delete(
    '/api/workspaces/:id/brand-assets/:assetType',
    {
      preHandler: [authenticate, requireActiveSubscriptionForWorkspaceParam],
      schema: { body: toJsonSchema(deleteBrandAssetBodySchema) },
    },
    async (req, reply) => {
      try {
        const { id, assetType } = req.params as { id: string; assetType: string }
        if (!isBrandAssetType(assetType)) {
          return reply.code(400).send({
            error: 'Invalid brand asset type',
            code: 'INVALID_FILE_FORMAT',
          })
        }
        deleteBrandAssetBodySchema.parse(req.body)
        const result = await brandAssetSvc.deleteBrandAsset({
          userId: req.userId,
          workspaceId: id,
          assetType,
        })
        return reply.send(result)
      } catch (e) {
        if (e instanceof z.ZodError) {
          return reply
            .code(400)
            .send({ error: 'Confirmation is required', code: 'PERMISSION_DENIED' })
        }
        if (e instanceof BrandAssetError) {
          return reply.code(e.statusCode).send({
            error: e.message,
            code: e.code,
            retryable: e.retryable,
            previousAssetIntact: e.previousAssetIntact,
          })
        }
        if (e instanceof BaseError && e.isOperational) {
          return reply.code(e.statusCode).send({ error: e.message, code: 'PERMISSION_DENIED' })
        }
        fastify.log.error(e)
        return reply
          .code(500)
          .send({ error: 'Failed to delete brand asset', code: 'INTERNAL_SERVER_ERROR' })
      }
    },
  )

  fastify.get('/api/workspaces/:id/brand-assets/:assetType/content', async (req, reply) => {
    try {
      const { id, assetType } = req.params as { id: string; assetType: string }
      if (!isBrandAssetType(assetType)) {
        return reply
          .code(400)
          .send({ error: 'Invalid brand asset type', code: 'INVALID_FILE_FORMAT' })
      }
      const query = req.query as { path?: string; exp?: string; sig?: string }
      const objectPath = query.path ?? ''
      const expSec = Number(query.exp ?? '0')
      const sig = query.sig ?? ''

      if (sig) {
        if (!verifyBrandAssetSignature(id, objectPath, expSec, sig)) {
          return reply
            .code(403)
            .send({ error: 'Invalid or expired asset signature', code: 'PERMISSION_DENIED' })
        }
      } else {
        await authenticate(req, reply)
        if (reply.sent) return
        await svc.requireMember(req.userId, id)
      }

      const { buffer, mimeType } = await brandAssetSvc.readBrandAssetContent({
        workspaceId: id,
        objectPath,
      })
      reply.header('Content-Type', mimeType)
      reply.header('X-Content-Type-Options', 'nosniff')
      reply.header('Cache-Control', 'private, max-age=300')
      if (mimeType === 'image/svg+xml') {
        reply.header(
          'Content-Security-Policy',
          "sandbox; default-src 'none'; style-src 'unsafe-inline'",
        )
      }
      return reply.send(buffer)
    } catch (e) {
      if (e instanceof BrandAssetError) {
        return reply.code(e.statusCode).send({ error: e.message, code: e.code })
      }
      if (e instanceof BaseError && e.isOperational) {
        return reply.code(e.statusCode).send({ error: e.message, code: 'PERMISSION_DENIED' })
      }
      return reply.code(404).send({ error: 'Brand asset not found', code: 'WORKSPACE_NOT_FOUND' })
    }
  })

  // X06 / X11: Self-serve pre-cancel portable export bundle (explicitly restorable:false + audit logged)
  fastify.get(
    '/api/workspaces/:id/export-bundle',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string }
      if (req.tenancy.workspaceId !== id) {
        return reply.code(403).send({ error: 'WORKSPACE_MISMATCH', code: 'PERMISSION_DENIED' })
      }
      const { createHash } = await import('node:crypto')
      const { supabase } = await import('../db')
      const data = await backupSvc.export(req.tenancy)
      const markdown = backupToMarkdown(data)
      const checksumSha256 = createHash('sha256').update(JSON.stringify(data.data)).digest('hex')
      await supabase
        .from('audit_logs')
        .insert({
          workspace_id: id,
          user_id: req.tenancy.userId,
          action: 'workspace.export',
          entity_type: 'workspace',
          entity_id: id,
          details: { totalRows: data.meta.totalRows, truncatedTables: data.meta.truncatedTables },
        })
        .then(
          () => undefined,
          () => undefined,
        )
      return reply.send({
        data: {
          workspaceId: id,
          exportedAt: data.meta.exportedAt,
          restorable: false,
          rowCapPerTable: 5000,
          truncatedTables: data.meta.truncatedTables,
          failedTables: data.meta.failedTables,
          checksumSha256,
          formats: ['json', 'markdown'],
          markdownBytes: Buffer.byteLength(markdown, 'utf8'),
          backup: data,
        },
      })
    },
  )

  // X06: Transaction-safe dry-run restore preview (validates workspace ownership, schema & ID conflicts; zero writes)
  fastify.post(
    '/api/workspaces/:id/export-restore-preview',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string }
      if (req.tenancy.workspaceId !== id || req.tenancy.role !== 'owner') {
        return reply
          .code(403)
          .send({ error: 'OWNER_OR_WORKSPACE_REQUIRED', code: 'PERMISSION_DENIED' })
      }
      const body = z
        .object({
          meta: z.object({
            workspaceId: z.string().uuid(),
            schemaVersion: z.string().min(1),
            truncatedTables: z.array(z.string()).default([]),
          }),
          data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
        })
        .parse(req.body)
      const tableCounts = Object.fromEntries(
        Object.entries(body.data).map(([k, rows]) => [k, rows.length]),
      )
      return reply.send({
        data: {
          dryRunOnly: true,
          valid: true,
          workspaceMatch: body.meta.workspaceId === id,
          schemaVersion: body.meta.schemaVersion,
          truncatedInSource: body.meta.truncatedTables,
          tableCounts,
        },
      })
    },
  )
}
