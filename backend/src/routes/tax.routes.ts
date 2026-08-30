// ============================================
// backend/src/routes/tax.routes.ts
//
// Registered with prefix '/api/tax' in index.ts.
//
// Configuration is owner-only: a rate change decides what every future
// document charges, which is the same weight as locking a period.
//
// There is deliberately no endpoint that re-rates an existing invoice. An
// invoice keeps the tax it was issued with; `GET /drift/:invoiceId` reports
// that the configuration has moved, and correcting the document is a decision
// with a credit note attached.
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { supabase } from '../db'
import { TaxService } from '../services/tax'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

const componentSchema = z.object({
  id: z.string().uuid(),
  labelKey: z.string().min(1).max(120),
  computation: z.enum(['percent', 'fixed_per_unit', 'fixed_per_line']),
  treatment: z.enum(['standard', 'zero_rated', 'exempt', 'not_applicable']),
  rate: z.number().min(0),
  includedInPrice: z.boolean().default(false),
  compoundsOn: z.array(z.string()).default([]),
  isWithholding: z.boolean().default(false),
  accountId: z.string().uuid().nullable().optional(),
})

const ruleSchema = z.object({
  id: z.string().uuid(),
  componentIds: z.array(z.string().uuid()).min(1),
  productId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  partyTaxCategory: z.string().max(60).nullable().optional(),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
  priority: z.number().int().min(0).max(10_000).default(100),
})

const periodSchema = z.object({ from: z.string().min(8), to: z.string().min(8) })

const previewSchema = z.object({
  date: z.string().min(8),
  partyTaxCategory: z.string().max(60).nullable().optional(),
  lines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        productId: z.string().uuid().nullable().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        quantity: z.number(),
        unitPrice: z.number(),
        discount: z.number().optional(),
      }),
    )
    .min(1)
    .max(500),
})

export async function taxRoutes(fastify: FastifyInstance) {
  const taxService = new TaxService()

  const fail = (reply: FastifyReply, err: unknown, fallback: string) => {
    if (err instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: err.errors })
    }
    if (err instanceof BaseError && err.statusCode < 500) {
      const code = /^[A-Z][A-Z_]{6,}/.exec(err.message)?.[0]
      return reply.code(err.statusCode).send({ error: err.message, code: code ?? err.name })
    }
    fastify.log.error(err)
    return reply.code(500).send({ error: fallback })
  }

  // ─── GET /config ───────────────────────────────────────
  fastify.get(
    '/config',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('invoice.read')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const [settings, components, rules] = await Promise.all([
          taxService.getSettings(request.tenancy.workspaceId),
          taxService.listComponents(request.tenancy.workspaceId, true),
          taxService.listRules(request.tenancy.workspaceId),
        ])
        return reply.send({ settings, components, rules })
      } catch (err) {
        return fail(reply, err, 'Failed to read the tax configuration')
      }
    },
  )

  // ─── PUT /components/:id ───────────────────────────────
  fastify.put(
    '/components/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')],
      schema: { body: toJsonSchema(componentSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = componentSchema.parse({ ...(request.body as object), id })
        return reply.send(await taxService.upsertComponent(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to save the tax component')
      }
    },
  )

  // ─── PUT /rules/:id ────────────────────────────────────
  fastify.put(
    '/rules/:id',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')],
      schema: { body: toJsonSchema(ruleSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string }
        const body = ruleSchema.parse({ ...(request.body as object), id })
        return reply.send(await taxService.upsertRule(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to save the tax rule')
      }
    },
  )

  // ─── POST /preview ─────────────────────────────────────
  // What a document WOULD be taxed. Computes and freezes nothing — the till
  // uses this to show a total before the sale is committed.
  fastify.post(
    '/preview',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('invoice.create')],
      schema: { body: toJsonSchema(previewSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = previewSchema.parse(request.body)
        const { computed, snapshot } = await taxService.computeAndFreeze(request.tenancy, body)
        return reply.send({ computed, snapshot })
      } catch (err) {
        return fail(reply, err, 'Failed to preview the tax')
      }
    },
  )

  // ─── GET /drift/:invoiceId ─────────────────────────────
  // Has the configuration moved since this invoice was written? Reports the
  // difference and changes nothing.
  fastify.get(
    '/drift/:invoiceId',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { invoiceId } = request.params as { invoiceId: string }

        const { data, error } = await supabase
          .from('invoices')
          .select('id, tax_snapshot')
          .eq('workspace_id', request.tenancy.workspaceId)
          .eq('id', invoiceId)
          .maybeSingle()

        if (error) throw error
        if (!data) return reply.code(404).send({ error: 'Invoice not found' })

        if (!data.tax_snapshot) {
          // Not an error: an invoice written before tax was configured, or in
          // a workspace that is not registered for it. Said plainly rather
          // than reported as "no drift", which would imply it was checked.
          return reply.send({ invoiceId, hasSnapshot: false, drift: [] })
        }

        const drift = await taxService.checkDrift(request.tenancy, data.tax_snapshot)
        return reply.send({ invoiceId, hasSnapshot: true, drift, isCurrent: drift.length === 0 })
      } catch (err) {
        return fail(reply, err, 'Failed to check for tax drift')
      }
    },
  )

  // ─── GET /return ───────────────────────────────────────
  // Output tax less input tax, per component. What a filing is built from.
  fastify.get(
    '/return',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.financial.read'),
      ],
      schema: { querystring: toJsonSchema(periodSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { from, to } = periodSchema.parse(request.query)
        return reply.send(await taxService.getTaxReturn(request.tenancy, from, to))
      } catch (err) {
        return fail(reply, err, 'Failed to build the tax return')
      }
    },
  )
}
