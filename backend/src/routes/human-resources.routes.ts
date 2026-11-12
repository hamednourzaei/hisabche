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
  createLeavePolicySchema,
  updateLeavePolicySchema,
} from '@hisabche/validation'
import { HumanResourcesService } from '../services/human-resources.service'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
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
        requireCapability('employee.read'),
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
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('employee.write')],
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
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('employee.write')],
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
        requireCapability('employee.read'),
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
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('employee.write')],
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
        requireCapability('employee.read'),
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
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('employee.write')],
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
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('employee.write')],
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
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('employee.write')],
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
        requireCapability('payroll.read'),
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
        requireCapability('payroll.read'),
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
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('payroll.write')],
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
        return sendFailure(reply, fastify.log, err, 'Failed to create payroll')
      }
    },
  )

  // ─── PATCH /api/payrolls/:id ──────────────────────────────
  fastify.patch(
    '/api/payrolls/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('payroll.write')],
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
        return sendFailure(reply, fastify.log, err, 'Failed to update payroll')
      }
    },
  )

  // ─── POST /api/payrolls/:id/book ──────────────────────────
  fastify.post(
    '/api/payrolls/:id/book',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('payroll.post')],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const result = await humanResourcesService.bookPayrollRetry(request.tenancy, id)
        await clearCache('payrolls:*')
        return reply.send(result)
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to book payroll')
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
        requireCapability('leave.read'),
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
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('leave.write')],
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
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('leave.write')],
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
        return sendFailure(reply, fastify.log, err, 'Failed to update leave')
      }
    },
  )

  // ═══════════════════════════════════════════════════════
  // LEAVE POLICIES, BALANCE, ACCRUAL — V58 (leave-policy-01)
  //
  // The entitlement is policy; the consumption is the approved leave. The
  // RPCs are backend-only (revoked from anon/authenticated), so these routes
  // are the only door, and `leave.write` gates everything that writes.
  // ═══════════════════════════════════════════════════════

  // ─── GET /api/leave-policies ──────────────
  fastify.get(
    '/api/leave-policies',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('leave.read')],
      schema: { response: { 200: toJsonSchema(z.array(z.any())) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await humanResourcesService.listLeavePolicies(request.tenancy))
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to fetch leave policies')
      }
    },
  )

  // ─── POST /api/leave-policies ─────────────
  fastify.post(
    '/api/leave-policies',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('leave.write')],
      schema: {
        body: toJsonSchema(createLeavePolicySchema),
        response: { 201: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = createLeavePolicySchema.parse(request.body)
        const policy = await humanResourcesService.createLeavePolicy(request.tenancy, data)
        return reply.code(201).send(policy)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        return sendFailure(reply, fastify.log, err, 'Failed to create the leave policy')
      }
    },
  )

  // ─── PATCH /api/leave-policies/:id ────────
  fastify.patch(
    '/api/leave-policies/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('leave.write')],
      schema: {
        params: toJsonSchema(z.object({ id: z.string().uuid() })),
        body: toJsonSchema(updateLeavePolicySchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const data = updateLeavePolicySchema.parse(request.body)
        return reply.send(await humanResourcesService.updateLeavePolicy(request.tenancy, id, data))
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to update the leave policy')
      }
    },
  )

  // ─── GET /api/leaves/balance ─────────────
  // Registered BEFORE nothing depends on order: Fastify prefers the static
  // segment `balance` over `/api/leaves/:id`, so this never lands in the id
  // route.
  fastify.get(
    '/api/leaves/balance',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('leave.read')],
      schema: {
        querystring: toJsonSchema(
          z.object({ employeeId: z.string().uuid(), leaveType: z.string().min(1).max(20) }),
        ),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { employeeId, leaveType } = request.query as {
          employeeId: string
          leaveType: string
        }
        return reply.send(
          await humanResourcesService.leaveBalance(request.tenancy, employeeId, leaveType),
        )
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to read the leave balance')
      }
    },
  )

  // ─── POST /api/leaves/accrue ─────────────
  // One month, every active employee × active policy. Idempotent inside the
  // function, so a double-click writes once — the return value says what
  // changed, not who was looked at.
  fastify.post(
    '/api/leaves/accrue',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('leave.write')],
      schema: {
        body: toJsonSchema(z.object({ period: z.string().regex(/^\d{4}-\d{2}-01$/) })),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { period } = z.object({ period: z.string() }).parse(request.body)
        const result = await humanResourcesService.runLeaveAccrual(request.tenancy, period)
        await clearCache('leaves:*')
        return reply.send(result)
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(400).send({ error: 'Validation failed', details: err.errors })
        }
        return sendFailure(reply, fastify.log, err, 'Failed to run the leave accrual')
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
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('employee.write')] },
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

  // ─── V61 B.2.18: EXPENSE CLAIMS ────────────────────────────────────────
  fastify.get(
    '/api/expense-claims',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('employee.read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { status } = request.query as { status?: string }
        const { expenseClaimsService } =
          await import('../services/human-resources/expense-claims.service')
        return reply.send({ data: await expenseClaimsService.list(request.tenancy, status) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to list expense claims')
      }
    },
  )

  fastify.post(
    '/api/expense-claims',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('employee.write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = z
          .object({
            employee_id: z.string().uuid(),
            title: z.string().min(1).max(200),
            submit: z.boolean().optional(),
            lines: z
              .array(
                z.object({
                  category: z.string().min(1),
                  amount_minor: z.number().int().positive(),
                  currency: z.string().min(3).max(8),
                  receipt_url: z.string().optional(),
                  notes: z.string().optional(),
                }),
              )
              .min(1),
          })
          .parse(request.body)
        const { expenseClaimsService } =
          await import('../services/human-resources/expense-claims.service')
        return reply
          .code(201)
          .send({ data: await expenseClaimsService.createAndSubmit(request.tenancy, body) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to create expense claim')
      }
    },
  )

  fastify.post(
    '/api/expense-claims/:id/approve',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('payroll.write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const { expenseClaimsService } =
          await import('../services/human-resources/expense-claims.service')
        return reply.send({ data: await expenseClaimsService.approve(request.tenancy, id) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to approve expense claim')
      }
    },
  )

  fastify.post(
    '/api/expense-claims/:id/reject',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('payroll.write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const { reason } = z.object({ reason: z.string().min(1).max(400) }).parse(request.body)
        const { expenseClaimsService } =
          await import('../services/human-resources/expense-claims.service')
        return reply.send({ data: await expenseClaimsService.reject(request.tenancy, id, reason) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to reject expense claim')
      }
    },
  )

  fastify.post(
    '/api/expense-claims/:id/reimburse',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('payment.record')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const { currency } = z.object({ currency: z.string().min(3).max(8) }).parse(request.body)
        const { expenseClaimsService } =
          await import('../services/human-resources/expense-claims.service')
        return reply.send({
          data: await expenseClaimsService.reimburse(request.tenancy, id, currency),
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to reimburse expense claim')
      }
    },
  )

  // ─── V61 B.2.17: EMPLOYEE FILE, ORG CHART & APPRAISALS ─────────────────
  fastify.get(
    '/api/employees/org-chart',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('employee.read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { hrOrgAppraisalService } =
          await import('../services/human-resources/hr-org-appraisal.service')
        return reply.send({ data: await hrOrgAppraisalService.getOrgChart(request.tenancy) })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to load org chart')
      }
    },
  )

  fastify.patch(
    '/api/employees/:id/reports-to',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('employee.write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const { reports_to } = z
          .object({ reports_to: z.string().uuid().nullable() })
          .parse(request.body)
        const { hrOrgAppraisalService } =
          await import('../services/human-resources/hr-org-appraisal.service')
        return reply.send({
          data: await hrOrgAppraisalService.setReportsTo(request.tenancy, id, reports_to),
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to update reporting manager')
      }
    },
  )

  fastify.get(
    '/api/employees/:id/documents',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('employee.read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const { hrOrgAppraisalService } =
          await import('../services/human-resources/hr-org-appraisal.service')
        return reply.send({
          data: await hrOrgAppraisalService.listDocuments(request.tenancy, id),
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to list employee documents')
      }
    },
  )

  fastify.post(
    '/api/employees/:id/documents',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('employee.write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const { addEmployeeDocumentSchema } = await import('@hisabche/validation')
        const body = addEmployeeDocumentSchema.parse(request.body)
        const { hrOrgAppraisalService } =
          await import('../services/human-resources/hr-org-appraisal.service')
        return reply.code(201).send({
          data: await hrOrgAppraisalService.addDocument(request.tenancy, id, body),
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to add employee document')
      }
    },
  )

  fastify.get(
    '/api/employees/:id/appraisals',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('employee.read')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const { hrOrgAppraisalService } =
          await import('../services/human-resources/hr-org-appraisal.service')
        return reply.send({
          data: await hrOrgAppraisalService.listAppraisals(request.tenancy, id),
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to list appraisals')
      }
    },
  )

  fastify.post(
    '/api/employees/:id/appraisals',
    { preHandler: [authenticate, requireWorkspaceContext, requireCapability('employee.write')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
        const { createAppraisalSchema } = await import('@hisabche/validation')
        const body = createAppraisalSchema.parse(request.body)
        const { hrOrgAppraisalService } =
          await import('../services/human-resources/hr-org-appraisal.service')
        return reply.code(201).send({
          data: await hrOrgAppraisalService.createAppraisal(request.tenancy, id, body),
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to record appraisal')
      }
    },
  )
}
