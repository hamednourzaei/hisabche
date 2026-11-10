// ============================================
// backend/src/routes/user-state.routes.ts
//
//   GET    /api/me/invoice-drafts        { configured, drafts }
//   PUT    /api/me/invoice-drafts        { id?, kind, title, payload } → draft
//   DELETE /api/me/invoice-drafts/:id    { deleted: true }
//   GET    /api/me/preferences           { configured, theme }
//   PUT    /api/me/preferences           { theme }
//
// The PERSON's own state (user-state-01). Rows are keyed by request.userId —
// never an id from the body — and drafts by request.tenancy.workspaceId
// (BUG-101 rule). Preferences belong to the person, not to a workspace, so
// they need only a signed-in caller and touch nothing but that caller's row.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { invoiceDraftSaveSchema, userPreferencesSchema } from '@hisabche/validation'
import { z } from 'zod'

import { sendFailure } from '../errors/http-failure'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import {
  deleteInvoiceDraft,
  listInvoiceDrafts,
  readUserPreferences,
  saveInvoiceDraft,
  saveUserPreferences,
} from '../services/user-state.service'

const idParams = z.object({ id: z.string().uuid() })

const rateLimit = (prefix: string, max: number) => ({
  rateLimit: {
    max,
    timeWindow: '1 minute',
    keyGenerator: (request: FastifyRequest) => `${prefix}:${request.userId ?? request.ip}`,
  },
})

export async function userStateRoutes(fastify: FastifyInstance) {
  const inWorkspace = [authenticate, requireWorkspaceContext]

  fastify.get(
    '/api/me/invoice-drafts',
    { preHandler: inWorkspace },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await listInvoiceDrafts(request.userId, request.tenancy.workspaceId))
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to read the invoice drafts')
      }
    },
  )

  fastify.put(
    '/api/me/invoice-drafts',
    { preHandler: inWorkspace, config: rateLimit('invdraft', 60), bodyLimit: 300_000 },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = invoiceDraftSaveSchema.parse(request.body)
        return reply.send(await saveInvoiceDraft(request.userId, request.tenancy.workspaceId, body))
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to save the invoice draft')
      }
    },
  )

  fastify.delete(
    '/api/me/invoice-drafts/:id',
    { preHandler: inWorkspace, config: rateLimit('invdraft-del', 60) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = idParams.parse(request.params)
        return reply.send(await deleteInvoiceDraft(request.userId, request.tenancy.workspaceId, id))
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to delete the invoice draft')
      }
    },
  )

  fastify.get(
    '/api/me/preferences',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await readUserPreferences(request.userId))
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to read the preferences')
      }
    },
  )

  fastify.put(
    '/api/me/preferences',
    { preHandler: [authenticate], config: rateLimit('prefs', 30) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = userPreferencesSchema.parse(request.body)
        return reply.send(await saveUserPreferences(request.userId, body.theme))
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to save the preferences')
      }
    },
  )
}
