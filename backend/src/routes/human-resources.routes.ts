// ============================================
// backend/src/routes/human-resources.routes.ts
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  createAttendanceSchema,
  updateAttendanceSchema,
  createPayrollSchema,
  updatePayrollSchema,
  createLeaveSchema,
  updateLeaveSchema,
} from '@hisabche/validation'
// ✅ اصلاح: import کلاس (با حرف بزرگ)
import { HumanResourcesService } from '../services/human-resources.service'
import { authenticate } from '../middleware/auth.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function humanResourcesRoutes(fastify: FastifyInstance) {
  // ✅ اصلاح: نمونه از کلاس (با حرف کوچک)
  const humanResourcesService = new HumanResourcesService()

  // ═══════════════════════════════════════════════════════════
  // DEPARTMENTS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/departments ─────────────────────────────────
  fastify.get('/api/departments', {
    preHandler: [authenticate],
    schema: {
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const depts = await humanResourcesService.listDepartments(request.userId)
      return reply.send(depts)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch departments' })
    }
  })

  // ─── POST /api/departments ────────────────────────────────
  fastify.post('/api/departments', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createDepartmentSchema),
      response: { 201: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createDepartmentSchema.parse(request.body)
      const dept = await humanResourcesService.createDepartment(request.userId, data)
      return reply.code(201).send(dept)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create department' })
    }
  })

  // ─── PATCH /api/departments/:id ───────────────────────────
  fastify.patch('/api/departments/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      body: toJsonSchema(updateDepartmentSchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const data = updateDepartmentSchema.parse(request.body)
      const dept = await humanResourcesService.updateDepartment(request.userId, id, data)
      return reply.send(dept)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update department' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // EMPLOYEES
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/employees ───────────────────────────────────
  fastify.get('/api/employees', {
    preHandler: [authenticate],
    schema: {
      querystring: toJsonSchema(z.object({ departmentId: z.string().uuid().optional() })),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { departmentId } = request.query as { departmentId?: string }
      const employees = await humanResourcesService.listEmployees(request.userId, departmentId)
      return reply.send(employees)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch employees' })
    }
  })

  // ─── POST /api/employees ──────────────────────────────────
  fastify.post('/api/employees', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createEmployeeSchema),
      response: { 201: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createEmployeeSchema.parse(request.body)
      const emp = await humanResourcesService.createEmployee(request.userId, data)
      return reply.code(201).send(emp)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create employee' })
    }
  })

  // ─── GET /api/employees/:id ───────────────────────────────
  fastify.get('/api/employees/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const emp = await humanResourcesService.getEmployee(id, request.userId)
      return reply.send(emp)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch employee' })
    }
  })

  // ─── PATCH /api/employees/:id ─────────────────────────────
  fastify.patch('/api/employees/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      body: toJsonSchema(updateEmployeeSchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const data = updateEmployeeSchema.parse(request.body)
      const emp = await humanResourcesService.updateEmployee(request.userId, id, data)
      return reply.send(emp)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update employee' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // ATTENDANCE
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/attendance/:employeeId ──────────────────────
  fastify.get('/api/attendance/:employeeId', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ employeeId: z.string().uuid() })),
      querystring: toJsonSchema(z.object({ month: z.string().optional() })),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { employeeId } = request.params as { employeeId: string }
      const { month } = request.query as { month?: string }
      const records = await humanResourcesService.listAttendance(request.userId, employeeId, month)
      return reply.send(records)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch attendance' })
    }
  })

  // ─── POST /api/attendance ─────────────────────────────────
  fastify.post('/api/attendance', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createAttendanceSchema),
      response: { 201: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createAttendanceSchema.parse(request.body)
      const att = await humanResourcesService.createAttendance(request.userId, data)
      return reply.code(201).send(att)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to record attendance' })
    }
  })

  // ─── PATCH /api/attendance/:id ────────────────────────────
  fastify.patch('/api/attendance/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      body: toJsonSchema(updateAttendanceSchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const data = updateAttendanceSchema.parse(request.body)
      const att = await humanResourcesService.updateAttendance(request.userId, id, data)
      return reply.send(att)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update attendance' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // PAYROLL
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/payrolls ────────────────────────────────────
  fastify.get('/api/payrolls', {
    preHandler: [authenticate],
    schema: {
      querystring: toJsonSchema(z.object({ employeeId: z.string().uuid().optional() })),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { employeeId } = request.query as { employeeId?: string }
      const payrolls = await humanResourcesService.listPayrolls(request.userId, employeeId)
      return reply.send(payrolls)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch payrolls' })
    }
  })

  // ─── POST /api/payrolls ───────────────────────────────────
  fastify.post('/api/payrolls', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createPayrollSchema),
      response: { 201: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createPayrollSchema.parse(request.body)
      const payroll = await humanResourcesService.createPayroll(request.userId, data)
      return reply.code(201).send(payroll)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create payroll' })
    }
  })

  // ─── PATCH /api/payrolls/:id ──────────────────────────────
  fastify.patch('/api/payrolls/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      body: toJsonSchema(updatePayrollSchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const data = updatePayrollSchema.parse(request.body)
      const payroll = await humanResourcesService.updatePayrollStatus(request.userId, id, data)
      return reply.send(payroll)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update payroll' })
    }
  })

  // ═══════════════════════════════════════════════════════════
  // LEAVES
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/leaves ──────────────────────────────────────
  fastify.get('/api/leaves', {
    preHandler: [authenticate],
    schema: {
      querystring: toJsonSchema(z.object({ employeeId: z.string().uuid().optional() })),
      response: { 200: toJsonSchema(z.array(z.any())) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { employeeId } = request.query as { employeeId?: string }
      const leaves = await humanResourcesService.listLeaves(request.userId, employeeId)
      return reply.send(leaves)
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch leaves' })
    }
  })

  // ─── POST /api/leaves ─────────────────────────────────────
  fastify.post('/api/leaves', {
    preHandler: [authenticate],
    schema: {
      body: toJsonSchema(createLeaveSchema),
      response: { 201: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createLeaveSchema.parse(request.body)
      const leave = await humanResourcesService.createLeave(request.userId, data)
      return reply.code(201).send(leave)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to create leave' })
    }
  })

  // ─── PATCH /api/leaves/:id ────────────────────────────────
  fastify.patch('/api/leaves/:id', {
    preHandler: [authenticate],
    schema: {
      params: toJsonSchema(z.object({ id: z.string().uuid() })),
      body: toJsonSchema(updateLeaveSchema),
      response: { 200: toJsonSchema(z.any()) },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string }
      const data = updateLeaveSchema.parse(request.body)
      const leave = await humanResourcesService.updateLeaveStatus(request.userId, id, data)
      return reply.send(leave)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: err.errors })
      }
      fastify.log.error(err)
      return reply.code(500).send({ error: 'Failed to update leave' })
    }
  })
}