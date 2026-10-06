// ============================================
// backend/src/routes/governance.routes.ts
//
// Registered with prefix '/api/governance' in index.ts.
//
// Segregation of duties: what is enforced in this workspace, and every time
// somebody was allowed past it.
//
// The override LOG is readable by a manager on purpose. A control whose
// bypasses only the person who bypassed them can see is not a control.
// ============================================

import {
  CAPABILITIES,
  capabilitiesOf,
  explain,
  minRoleFor,
  wouldAHigherRoleHelp,
} from '../services/authorization'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { SOD_RULES, SoDService } from '../services/authorization'
import { BaseError } from '../errors/base.error'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { memberModuleBlocks } from '../services/authorization/member-module-blocks.service'
import { PERMISSION_MODULES } from '../services/authorization/authorization.domain'

const toJsonSchema = (schema: any) => {
  const result = zodToJsonSchema(schema, { target: 'jsonSchema7' })
  delete result.$schema
  return result
}

const settingsSchema = z.object({
  mode: z.enum(['off', 'warn', 'strict']).optional(),
  disabledRules: z.array(z.string()).optional(),
})

const whyNotSchema = z.object({
  refusal: z.enum([
    'MISSING_CAPABILITY',
    'OUT_OF_BRANCH_SCOPE',
    'NOT_OWN_RECORD',
    'SOD_CONFLICT',
    'PERIOD_LOCKED',
  ]),
  capability: z.enum(CAPABILITIES),
})

const memberBlocksSchema = z.object({ modules: z.array(z.string().regex(/^[a-z_]+$/)).max(50) })

export async function governanceRoutes(fastify: FastifyInstance) {
  const sodService = new SoDService()

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

  // ─── GET /sod ──────────────────────────────────────────
  // What is enforced right now, and the full catalogue so a workspace can see
  // what it is choosing between.
  fastify.get(
    '/sod',
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
        const described = await sodService.describe(request.tenancy)
        return reply.send({ ...described, catalogue: SOD_RULES })
      } catch (err) {
        return fail(reply, err, 'Failed to read the SoD settings')
      }
    },
  )

  // ─── PUT /sod ──────────────────────────────────────────
  fastify.put(
    '/sod',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')],
      schema: {
        body: toJsonSchema(settingsSchema),
        response: { 200: toJsonSchema(z.any()) },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = settingsSchema.parse(request.body)
        return reply.send(await sodService.setSettings(request.tenancy, body))
      } catch (err) {
        return fail(reply, err, 'Failed to save the SoD settings')
      }
    },
  )

  // ─── GET /sod/overrides ────────────────────────────────
  fastify.get(
    '/sod/overrides',
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
        const { limit } = request.query as { limit?: string }
        return reply.send(await sodService.listOverrides(request.tenancy, Number(limit) || 100))
      } catch (err) {
        return fail(reply, err, 'Failed to fetch SoD overrides')
      }
    },
  )

  // ─── POST /api/governance/why-not ────────────────────────
  //
  // §17 — "Why can't I do it?" answered in the shop's terms.
  //
  // A `403 MISSING_CAPABILITY` tells a shopkeeper nothing: they cannot tell
  // whether they clicked the wrong thing, whether it is broken, or whether
  // they need to ask somebody — and the third is almost always the answer.
  //
  // ⚠️ POST rather than GET because the body carries the action being asked
  // about, and ⚠️ it never explains a cross-workspace refusal: that case is a
  // 404 everywhere else precisely so an outsider cannot confirm a row exists,
  // and a helpful "that belongs to another workspace" would undo it in one
  // sentence.
  // ⚠️ Guarded with `report.operational.read` — the capability EVERY role holds,
  // sellers included.
  //
  // Requiring a capability in order to learn why you lack a capability is
  // circular, and the honest instinct is to leave this route unguarded. But
  // `vertical-slice-integration.test.ts` requires every governance route to
  // declare one, and that invariant is worth more than the exception: a route
  // with no capability line is indistinguishable from a route where somebody
  // forgot. So it declares the floor.
  //
  // Nothing here reads workspace data — the answer comes from the caller's OWN
  // role and the static capability table.
  //
  // (This sits above the registration rather than inside its options object:
  // the guard reads a bounded window between the route call and its
  // `preHandler`, so a long comment in between makes the route look unguarded.
  // It also avoids naming the route-registration call in prose — that guard
  // counts occurrences without stripping comments, so a mention becomes a
  // phantom fifth route.)
  // ─── GET /my-capabilities ───────────────────────────────────────────────
  // What the caller may do in THIS workspace, answered by the server's own
  // capability table — so a screen can skip a request that would only 403
  // (a seller's dashboard asking for exchange rates and the conflict queue)
  // without the client keeping a second copy of the table. A rendering hint:
  // every endpoint still enforces its capability. Guarded with the floor every
  // role holds, for the same reason as /why-not below.
  fastify.get(
    '/my-capabilities',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.operational.read'),
      ],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        role: request.tenancy.role,
        // Modules the owner took away from this person — the menus lock them.
        // A rendering hint like the set below; the capabilities are what the
        // server enforces.
        //
        // Two reasons a module is left out, one list: the owner blocked it for
        // this person, or their custom role does not include it («نمی‌بیند»).
        blockedModules:
          request.tenancy.role === 'owner'
            ? []
            : [
                ...new Set([
                  ...(await memberModuleBlocks.forMember(
                    request.tenancy.workspaceId,
                    request.tenancy.userId,
                  )),
                  ...(request.tenancy.hiddenModules ?? []),
                ]),
              ],
        // Modules this person's ROLE does not include at all («نمی‌بیند»). The
        // menus leave these out entirely; a per-person block above is drawn
        // locked instead, so the owner's one-off decision stays visible.
        hiddenModules:
          request.tenancy.role === 'owner' ? [] : [...(request.tenancy.hiddenModules ?? [])],
        // The EFFECTIVE set — defaults with this workspace's changes applied.
        capabilities: request.tenancy.capabilities
          ? [...request.tenancy.capabilities]
          : capabilitiesOf(request.tenancy.role),
      })
    },
  )

  fastify.post(
    '/why-not',
    {
      preHandler: [
        authenticate,
        requireWorkspaceContext,
        requireCapability('report.operational.read'),
      ],
      schema: { body: toJsonSchema(whyNotSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = whyNotSchema.parse(request.body)
        const role = request.tenancy.role

        const requiredRole = minRoleFor(body.capability)
        const explanation = explain(body.refusal, { requiredRole })

        return reply.send({
          ...explanation,
          actualRole: role,
          // The question a user actually asks: do I need more access, or is
          // this something else entirely?
          higherRoleWouldHelp: wouldAHigherRoleHelp(body.refusal, role, requiredRole),
        })
      } catch (err) {
        fastify.log.error(err)
        return reply.code(400).send({ error: 'Failed to explain the refusal' })
      }
    },
  )

  // ─── Per-member page blocks ─────────────────────────────────────────────
  // The owner takes whole modules away from ONE person ("invoices only").
  // Enforced in requireWorkspaceContext on every request; these two routes
  // only read and write the choice. Guarded by member.manage, and the service
  // refuses anyone but the owner and refuses to restrict the owner.
  fastify.get(
    '/member-blocks',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('member.manage')],
      schema: { response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send({
          modules: PERMISSION_MODULES.map((m) => ({ key: m.key, label: m.label })),
          blocks: await memberModuleBlocks.all(request.tenancy.workspaceId),
        })
      } catch (err) {
        return fail(reply, err, 'Failed to read page access')
      }
    },
  )

  fastify.put(
    '/member-blocks/:userId',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('member.manage')],
      schema: { body: toJsonSchema(memberBlocksSchema), response: { 200: toJsonSchema(z.any()) } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = request.params as { userId: string }
        const body = memberBlocksSchema.parse(request.body)
        const modules = await memberModuleBlocks.setForMember(request.tenancy, userId, body.modules)
        return reply.send({ userId, modules })
      } catch (err) {
        return fail(reply, err, 'Failed to save page access')
      }
    },
  )
}
