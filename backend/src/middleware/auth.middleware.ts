// ============================================
// backend/src/middleware/auth.ts
// ============================================

import { FastifyRequest, FastifyReply } from 'fastify'
import { supabase } from '../db'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization
  if (!authHeader) {
    return reply.status(401).send({ error: 'Missing authorization header' })
  }

  const token = authHeader.replace('Bearer ', '')

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return reply.status(401).send({ error: 'Invalid or expired token' })
  }

  ;(request as any).user = user
  ;(request as any).userId = user.id
}

// برای راحتی، به عنوان preHandler هم کار می‌کنه
export const authPreHandler = authenticate