// ============================================
// backend/src/services/mcp/own-route.ts
//
// Sending a request through the server's OWN router.
//
// The MCP gateway and the in-app AI pipeline both act by calling the route a
// person would have used, with a real credential — so authentication, the
// workspace, capabilities, validation, idempotency, caches and business events
// are that route's, not a copy of them. This is the one place that call is
// made.
// ============================================

import type { FastifyInstance } from 'fastify'

import type { McpHttpCall } from './mcp-tools'

export interface RouteAnswer {
  httpStatus: number
  body: unknown
}

/** A route's answer as JSON; a non-JSON answer is not passed on as if it were data. */
function parseJson(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** Send one request through the server's own router. */
export async function runRoute(
  fastify: FastifyInstance,
  call: McpHttpCall,
  authorization: string,
  /**
   * Which business, when `authorization` is a PERSON's session. An API key
   * carries its own workspace and needs none; a session does not, and a
   * person with two workspaces (a sandbox is one) is refused without it.
   */
  workspaceId?: string,
): Promise<RouteAnswer> {
  const response = await fastify.inject({
    method: call.method,
    url: call.url,
    headers: {
      authorization,
      ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
      ...(call.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(call.idempotencyKey ? { 'idempotency-key': call.idempotencyKey } : {}),
    },
    ...(call.body !== undefined ? { payload: JSON.stringify(call.body) } : {}),
  })
  return { httpStatus: response.statusCode, body: parseJson(response.body) }
}

export const isOk = (answer: RouteAnswer): boolean =>
  answer.httpStatus >= 200 && answer.httpStatus < 300
