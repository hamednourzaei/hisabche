// ============================================
// backend/src/routes/project.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  createProjectSchema,
  updateProjectSchema,
  createProjectTaskSchema,
  updateProjectTaskSchema,
  createProjectMemberSchema,
  createTimeEntrySchema,
  updateTimeEntrySchema,
} from '@hisabche/validation'
import { ProjectService } from '../services/project.service'
import { authenticate } from '../middleware/auth.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function projectRoutes(fastify: FastifyInstance) {
  const projectService = new ProjectService()

  // ═══════════════════════════════════════════════════════════
  // PROJECTS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/projects ────────────────────────────────────
  fastify.get('/api/projects', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 60, keyPrefix: 'projects' })],
    schema: {
      querystring: toJsonSchema(z.object({
        status: z.enum(['planning', 'in_progress', 'on_hold', 'completed', 'cancelled']).optional()
      })),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { status } = request.query as { status?: string }
      const projects = await projectService.listProjects(request.userId, status)
      return reply.send(projects)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch projects' })
    }
  })

  // ─── POST /api/projects ───────────────────────────────────
  fastify.post('/api/projects', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createProjectSchema),
      response: { 201: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createProjectSchema.parse(request.body)
      const project = await projectService.createProject(request.userId, data)
      await clearCache('projects:*')
      return reply.code(201).send(project)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create project' })
    }
  })

  // ─── GET /api/projects/:id ────────────────────────────────
  fastify.get('/api/projects/:id', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 120, keyPrefix: 'project' })],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const project = await projectService.getProject(id, request.userId)
      return reply.send(project)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch project' })
    }
  })

  // ─── PATCH /api/projects/:id ──────────────────────────────
  fastify.patch('/api/projects/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      body: toJsonSchema(updateProjectSchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const data = updateProjectSchema.parse(request.body)
      const project = await projectService.updateProject(request.userId, id, data)
      await clearCache(`project:${id}`)
      await clearCache('projects:*')
      return reply.send(project)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update project' })
    }
  })

  // ─── DELETE /api/projects/:id ─────────────────────────────
  fastify.delete('/api/projects/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const result = await projectService.deleteProject(request.userId, id)
      await clearCache(`project:${id}`)
      await clearCache('projects:*')
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to delete project' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // TASKS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/projects/:projectId/tasks ───────────────────
  fastify.get('/api/projects/:projectId/tasks', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 60, keyPrefix: 'project-tasks' })],
    schema: {
      params: toJsonSchema(z.object({ projectId: z.string().uuid() })),
      querystring: toJsonSchema(z.object({
        status: z.enum(['todo', 'in_progress', 'review', 'done', 'cancelled']).optional()
      })),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string }
      const { status } = request.query as { status?: string }
      const tasks = await projectService.listTasks(request.userId, projectId, status)
      return reply.send(tasks)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch tasks' })
    }
  })

  // ─── POST /api/projects/:projectId/tasks ──────────────────
  fastify.post('/api/projects/:projectId/tasks', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ projectId: z.string().uuid() })),
      body: toJsonSchema(createProjectTaskSchema),
      response: { 201: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createProjectTaskSchema.parse(request.body)
      const task = await projectService.createTask(request.userId, data)
      // ✅ اصلاح: data.projectId (با camelCase)
      await clearCache(`project-tasks:${data.projectId}:*`)
      return reply.code(201).send(task)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create task' })
    }
  })

// ─── PATCH /api/tasks/:id ─────────────────────────────────
fastify.patch('/api/tasks/:id', {
  preHandler: [authenticate],
  schema: {
    params: toJsonSchema(z.object({ id: z.string().uuid() })),
    body: toJsonSchema(updateProjectTaskSchema),
    response: { 200: toJsonSchema(z.any()) },
  },
}, async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string }
    const data = updateProjectTaskSchema.parse(request.body)
    const task = await projectService.updateTask(request.userId, id, data)
    await clearCache(`task:${id}`)
    // ✅ اصلاح: task.project_id (با underscore - چون خروجی سرویس است)
    await clearCache(`project-tasks:${task.project_id}:*`)
    return reply.send(task)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: 'Failed to update task' })
  }
})


  // ─── DELETE /api/tasks/:id ────────────────────────────────
  fastify.delete('/api/tasks/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const result = await projectService.deleteTask(request.userId, id)
      await clearCache(`task:${id}`)
      await clearCache('project-tasks:*')
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to delete task' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // MEMBERS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/projects/:projectId/members ─────────────────
  fastify.get('/api/projects/:projectId/members', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 60, keyPrefix: 'project-members' })],
    schema: {
      params: toJsonSchema(z.object({ projectId: z.string().uuid() })),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string }
      const members = await projectService.listMembers(request.userId, projectId)
      return reply.send(members)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch members' })
    }
  })

  // ─── POST /api/projects/:projectId/members ────────────────
  fastify.post('/api/projects/:projectId/members', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createProjectMemberSchema),
      response: { 201: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createProjectMemberSchema.parse(request.body)
      const member = await projectService.addMember(request.userId, data)
      // ✅ اصلاح: data.projectId (با camelCase)
      await clearCache(`project-members:${data.projectId}:*`)
      return reply.code(201).send(member)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to add member' })
    }
  })

  // ─── DELETE /api/projects/:projectId/members/:memberId ────
  fastify.delete('/api/projects/:projectId/members/:memberId', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ projectId: z.string().uuid(), memberId: z.string().uuid() })),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId, memberId } = request.params as { projectId: string; memberId: string }
      const result = await projectService.removeMember(request.userId, projectId, memberId)
      await clearCache(`project-members:${projectId}:*`)
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to remove member' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // TIME ENTRIES
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/projects/:projectId/time-entries ────────────
  fastify.get('/api/projects/:projectId/time-entries', {
    preHandler: [authenticate, cacheMiddleware({ ttl: 60, keyPrefix: 'project-time-entries' })],
    schema: {
      params: toJsonSchema(z.object({ projectId: z.string().uuid() })),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string }
      const entries = await projectService.listTimeEntries(request.userId, projectId)
      return reply.send(entries)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch time entries' })
    }
  })

  // ─── POST /api/projects/:projectId/time-entries ───────────
  fastify.post('/api/projects/:projectId/time-entries', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createTimeEntrySchema),
      response: { 201: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createTimeEntrySchema.parse(request.body)
      const entry = await projectService.createTimeEntry(request.userId, data)
      // ✅ اصلاح: data.projectId (با camelCase)
      await clearCache(`project-time-entries:${data.projectId}:*`)
      return reply.code(201).send(entry)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create time entry' })
    }
  })

// ─── PATCH /api/time-entries/:id ──────────────────────────
fastify.patch('/api/time-entries/:id', {
  preHandler: [authenticate],
  schema: {
    params: toJsonSchema(z.object({ id: z.string().uuid() })),
    body: toJsonSchema(updateTimeEntrySchema),
    response: { 200: toJsonSchema(z.any()) },
  },
}, async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string }
    const data = updateTimeEntrySchema.parse(request.body)
    const entry = await projectService.updateTimeEntry(request.userId, id, data)
    await clearCache(`time-entry:${id}`)
    // ✅ اصلاح: entry.project_id (با underscore - چون خروجی سرویس است)
    await clearCache(`project-time-entries:${entry.project_id}:*`)
    return reply.send(entry)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: 'Failed to update time entry' })
  }
})

  // ─── DELETE /api/time-entries/:id ─────────────────────────
  fastify.delete('/api/time-entries/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const result = await projectService.deleteTimeEntry(request.userId, id)
      await clearCache(`time-entry:${id}`)
      await clearCache('project-time-entries:*')
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to delete time entry' })
    }
  })
}