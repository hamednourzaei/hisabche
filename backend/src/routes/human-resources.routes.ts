// ============================================
// backend/src/routes/human-resources.routes.ts
// ============================================

import { sendFailure } from '../errors/http-failure'
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
import { HumanResourcesService } from '../services/human-resources.service'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { cacheMiddleware, clearCache } from '../middleware/cache.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

export async function humanResourcesRoutes(fastify: FastifyInstance) {
  const humanResourcesService = new HumanResourcesService()

  // ═══════════════════════════════════════════════════════════
  // DEPARTMENTS
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/departments ─────────────────────────────────
  fastify.get(
    '/api/departments',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 120, keyPrefix: 'departments' }),
      ],
      schema: {
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const depts = await humanResourcesService.listDepartments(request.tenancy)
        return reply.send(depts)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch departments' })
      }
    },
  )

  // ─── POST /api/departments ────────────────────────────────
  fastify.post(
    '/api/departments',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        body: toJsonSchema(createDepartmentSchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createDepartmentSchema.parse(request.body)
        const dept = await humanResourcesService.createDepartment(request.tenancy, data)
        await clearCache('departments:*')
        return reply.code(201).send(dept)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to create department' })
      }
    },
  )

  // ─── PATCH /api/departments/:id ───────────────────────────
  fastify.patch(
    '/api/departments/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(updateDepartmentSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const data = updateDepartmentSchema.parse(request.body)
        const dept = await humanResourcesService.updateDepartment(request.tenancy, id, data)
        await clearCache(`department:${id}`)
        await clearCache('departments:*')
        return reply.send(dept)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to update department' })
      }
    },
  )

  // ═══════════════════════════════════════════════════════════
  // EMPLOYEES
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/employees ───────────────────────────────────
  fastify.get(
    '/api/employees',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'employees' }),
      ],
      schema: {
        querystring: toJsonSchema(z.object({ departmentId: z.string().uuid().optional() })),
        response: {
          200: toJsonSchema(z.object({ employees: z.array(z.any()), total: z.number() })),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { departmentId } = request.query as { departmentId?: string }
        const employees = (await humanResourcesService.listEmployees(
          request.tenancy,
          departmentId,
        )) as unknown[]
        return reply.send({ employees, total: employees.length })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to fetch employees')
      }
    },
  )

  // ─── POST /api/employees ──────────────────────────────────
  fastify.post(
    '/api/employees',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        body: toJsonSchema(createEmployeeSchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createEmployeeSchema.parse(request.body)
        const emp = await humanResourcesService.createEmployee(request.tenancy, data)
        await clearCache('employees:*')
        return reply.code(201).send(emp)
      } catch (err) {
        // A known refusal (branch not in this workspace, validation) keeps its
        // own status; a database failure says which code it was.
        return sendFailure(reply, fastify.log, err, 'Failed to create employee')
      }
    },
  )

  // ─── GET /api/employees/:id ───────────────────────────────
  fastify.get(
    '/api/employees/:id',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 120, keyPrefix: 'employee' }),
      ],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const emp = await humanResourcesService.getEmployee(id, request.tenancy)
        return reply.send(emp)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch employee' })
      }
    },
  )

  // ─── PATCH /api/employees/:id ─────────────────────────────
  fastify.patch(
    '/api/employees/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(updateEmployeeSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const data = updateEmployeeSchema.parse(request.body)
        const emp = await humanResourcesService.updateEmployee(request.tenancy, id, data)
        await clearCache(`employee:${id}`)
        await clearCache('employees:*')
        return reply.send(emp)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to update employee' })
      }
    },
  )

  // ═══════════════════════════════════════════════════════════
  // ATTENDANCE
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/attendance/:employeeId ──────────────────────
  fastify.get(
    '/api/attendance/:employeeId',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'attendance' }),
      ],
      schema: {
        params: toJsonSchema(z.object({ employeeId: z.string().uuid() })),
        querystring: toJsonSchema(z.object({ month: z.string().optional() })),
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { employeeId } = request.params as { employeeId: string }
        const { month } = request.query as { month?: string }
        const records = await humanResourcesService.listAttendance(
          request.tenancy,
          employeeId,
          month,
        )
        return reply.send(records)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch attendance' })
      }
    },
  )

  // ─── POST /api/attendance ─────────────────────────────────
  fastify.post(
    '/api/attendance',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        body: toJsonSchema(createAttendanceSchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createAttendanceSchema.parse(request.body)
        const att = await humanResourcesService.createAttendance(request.tenancy, data)
        await clearCache('attendance:*')
        return reply.code(201).send(att)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to record attendance' })
      }
    },
  )

  // ─── PATCH /api/attendance/:id ────────────────────────────
  fastify.patch(
    '/api/attendance/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(updateAttendanceSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const data = updateAttendanceSchema.parse(request.body)
        const att = await humanResourcesService.updateAttendance(request.tenancy, id, data)
        await clearCache('attendance:*')
        return reply.send(att)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to update attendance' })
      }
    },
  )

  // ═══════════════════════════════════════════════════════════
  // PAYROLL
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/payrolls/summary ─────────────────────────────
  fastify.get(
    '/api/payrolls/summary',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'payrolls-summary' }),
      ],
      schema: {
        response: {
          200: toJsonSchema(z.object({ total: z.number(), byEmployee: z.record(z.number()) })),
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const summary = await humanResourcesService.getPayrollSummary(request.tenancy)
        return reply.send(summary)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch payroll summary' })
      }
    },
  )

  // ─── GET /api/payrolls ────────────────────────────────────
  fastify.get(
    '/api/payrolls',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'payrolls' }),
      ],
      schema: {
        querystring: toJsonSchema(z.object({ employeeId: z.string().uuid().optional() })),
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { employeeId } = request.query as { employeeId?: string }
        const payrolls = await humanResourcesService.listPayrolls(request.tenancy, employeeId)
        return reply.send(payrolls)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch payrolls' })
      }
    },
  )

  // ─── POST /api/payrolls ───────────────────────────────────
  fastify.post(
    '/api/payrolls',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        body: toJsonSchema(createPayrollSchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createPayrollSchema.parse(request.body)
        const payroll = await humanResourcesService.createPayroll(request.tenancy, data)
        await clearCache('payrolls:*')
        return reply.code(201).send(payroll)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to create payroll' })
      }
    },
  )

  // ─── PATCH /api/payrolls/:id ──────────────────────────────
  fastify.patch(
    '/api/payrolls/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(updatePayrollSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const data = updatePayrollSchema.parse(request.body)
        const payroll = await humanResourcesService.updatePayrollStatus(request.tenancy, id, data)
        await clearCache('payrolls:*')
        return reply.send(payroll)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to update payroll' })
      }
    },
  )

  // ═══════════════════════════════════════════════════════════
  // LEAVES
  // ═══════════════════════════════════════════════════════════

  // ─── GET /api/leaves ──────────────────────────────────────
  fastify.get(
    '/api/leaves',
    {
      // Same omission as `/api/boms`: a workspace-scoped cache with no
      // workspace resolved, so the route answered 500 on every call.
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        cacheMiddleware({ scope: 'workspace', ttl: 60, keyPrefix: 'leaves' }),
      ],
      schema: {
        querystring: toJsonSchema(z.object({ employeeId: z.string().uuid().optional() })),
        response: { 200: toJsonSchema(z.array(z.any())) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { employeeId } = request.query as { employeeId?: string }
        const leaves = await humanResourcesService.listLeaves(request.tenancy, employeeId)
        return reply.send(leaves)
      } catch (err) {
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to fetch leaves' })
      }
    },
  )

  // ─── POST /api/leaves ─────────────────────────────────────
  fastify.post(
    '/api/leaves',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        body: toJsonSchema(createLeaveSchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createLeaveSchema.parse(request.body)
        const leave = await humanResourcesService.createLeave(request.tenancy, data)
        await clearCache('leaves:*')
        return reply.code(201).send(leave)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to create leave' })
      }
    },
  )

  // ─── PATCH /api/leaves/:id ────────────────────────────────
  fastify.patch(
    '/api/leaves/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(updateLeaveSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const data = updateLeaveSchema.parse(request.body)
        const leave = await humanResourcesService.updateLeaveStatus(request.tenancy, id, data)
        await clearCache('leaves:*')
        return reply.send(leave)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        fastify.log.error(err)
        return reply.code(500).send({ error: 'Failed to update leave' })
      }
    },
  )

  // ─── DELETE /api/employees/:id ───────────────────────────
  //
  // A soft delete. The verb is DELETE because that is what the person clicking
  // means; the effect is `is_active = false` because payroll, leave and
  // timesheet rows point at this employee and orphaning them would put a hole
  // in the books. Was in KNOWN_MISSING — the client called it and it 404'd.
  fastify.delete(
    '/api/employees/:id',
    { preHandler: [authenticate, requireWorkspaceContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        return reply.send(await humanResourcesService.deactivateEmployee(request.tenancy, id))
      } catch (err) {
        fastify.log.error(err)
        const status = (err as { statusCode?: number })?.statusCode ?? 500
        return reply.code(status).send({ error: 'Failed to deactivate the employee' })
      }
    },
  )
}
