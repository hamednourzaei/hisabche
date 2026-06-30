// ============================================
// backend/src/middleware/auth.ts
// ============================================

import { FastifyRequest, FastifyReply } from 'fastify'
import { supabase } from '../db'

// ✅ Declaration merging برای تایپ‌دهی صحیح
declare module 'fastify' {
  interface FastifyRequest {
    user: any // بعداً با تایپ واقعی جایگزین می‌شود
    userId: string
  }
}

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

  // ✅ بدون any
  request.user = user
  request.userId = user.id
}

export const authPreHandler = authenticate