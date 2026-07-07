// ============================================
// backend/src/routes/workspace.routes.ts
// ============================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { createWorkspaceSchema, updateWorkspaceSchema, updateMemberRoleSchema, createInviteSchema, acceptInviteSchema } from '@hisabche/validation'
import { WorkspaceService } from '../services/workspace.service'
import { authenticate } from '../middleware/auth.middleware'

const toJsonSchema = (schema: any) => { const r = zodToJsonSchema(schema, { target: 'jsonSchema7' }); delete r.$schema; return r }

export async function workspaceRoutes(fastify: FastifyInstance) {
  const svc = new WorkspaceService()

  fastify.get('/api/workspaces', { preHandler: [authenticate] }, async (req, reply) => {
    try { return reply.send(await svc.getMyWorkspaces(req.userId)) } catch (e) { fastify.log.error(e); return reply.code(500).send({ error: 'Failed' }) }
  })
  fastify.post('/api/workspaces', { preHandler: [authenticate], schema: { body: toJsonSchema(createWorkspaceSchema) } }, async (req, reply) => {
    try { return reply.code(201).send(await svc.createWorkspace(req.userId, createWorkspaceSchema.parse(req.body))) } catch (e) { if (e instanceof z.ZodError) return reply.code(400).send({ error: 'Validation', details: e.errors }); fastify.log.error(e); return reply.code(500).send({ error: 'Failed' }) }
  })
  fastify.get('/api/workspaces/:id', { preHandler: [authenticate] }, async (req, reply) => {
    try { return reply.send(await svc.getWorkspace(req.userId, (req.params as any).id)) } catch (e) { fastify.log.error(e); return reply.code(500).send({ error: 'Failed' }) }
  })
  fastify.patch('/api/workspaces/:id', { preHandler: [authenticate], schema: { body: toJsonSchema(updateWorkspaceSchema) } }, async (req, reply) => {
    try { return reply.send(await svc.updateWorkspace(req.userId, (req.params as any).id, updateWorkspaceSchema.parse(req.body))) } catch (e) { if (e instanceof z.ZodError) return reply.code(400).send({ error: 'Validation', details: e.errors }); fastify.log.error(e); return reply.code(500).send({ error: 'Failed' }) }
  })
  fastify.get('/api/workspaces/:id/members', { preHandler: [authenticate] }, async (req, reply) => {
    try { return reply.send(await svc.listMembers(req.userId, (req.params as any).id)) } catch (e) { fastify.log.error(e); return reply.code(500).send({ error: 'Failed' }) }
  })
  fastify.patch('/api/workspaces/:id/members/role', { preHandler: [authenticate], schema: { body: toJsonSchema(updateMemberRoleSchema) } }, async (req, reply) => {
    try { return reply.send(await svc.updateMemberRole(req.userId, (req.params as any).id, updateMemberRoleSchema.parse(req.body))) } catch (e) { if (e instanceof z.ZodError) return reply.code(400).send({ error: 'Validation', details: e.errors }); fastify.log.error(e); return reply.code(500).send({ error: 'Failed' }) }
  })
  fastify.delete('/api/workspaces/:id/members/:memberId', { preHandler: [authenticate] }, async (req, reply) => {
    try { const { id, memberId } = req.params as any; return reply.send(await svc.removeMember(req.userId, id, memberId)) } catch (e) { fastify.log.error(e); return reply.code(500).send({ error: 'Failed' }) }
  })
  fastify.post('/api/workspaces/:id/leave', { preHandler: [authenticate] }, async (req, reply) => {
    try { return reply.send(await svc.leaveWorkspace(req.userId, (req.params as any).id)) } catch (e) { fastify.log.error(e); return reply.code(500).send({ error: 'Failed' }) }
  })
  fastify.get('/api/workspaces/:id/invites', { preHandler: [authenticate] }, async (req, reply) => {
    try { return reply.send(await svc.listInvites(req.userId, (req.params as any).id)) } catch (e) { fastify.log.error(e); return reply.code(500).send({ error: 'Failed' }) }
  })
  fastify.post('/api/workspaces/:id/invites', { preHandler: [authenticate], schema: { body: toJsonSchema(createInviteSchema.omit({ workspaceId: true })) } }, async (req, reply) => {
    try {
      const { id } = req.params as any
      const data = createInviteSchema.omit({ workspaceId: true }).parse(req.body)
      const invite = await svc.createInvite(req.userId, { ...data, workspaceId: id })
      console.log('[route] createInvite result:', invite)
      return reply.code(201).send(invite)
    } catch (e) { if (e instanceof z.ZodError) return reply.code(400).send({ error: 'Validation', details: e.errors }); fastify.log.error(e); return reply.code(500).send({ error: 'Failed to create invite' }) }
  })
  fastify.post('/api/workspaces/accept-invite', { preHandler: [authenticate], schema: { body: toJsonSchema(acceptInviteSchema) } }, async (req, reply) => {
    try { return reply.send(await svc.acceptInvite(req.userId, (req.user as any)?.email || '', acceptInviteSchema.parse(req.body))) } catch (e) { if (e instanceof z.ZodError) return reply.code(400).send({ error: 'Validation', details: e.errors }); fastify.log.error(e); return reply.code(500).send({ error: 'Failed' }) }
  })
  fastify.delete('/api/workspaces/:id/invites/:inviteId', { preHandler: [authenticate] }, async (req, reply) => {
    try { const { id, inviteId } = req.params as any; return reply.send(await svc.cancelInvite(req.userId, id, inviteId)) } catch (e) { fastify.log.error(e); return reply.code(500).send({ error: 'Failed' }) }
  })
}