// ============================================
// backend/src/middleware/auth.middleware.ts
// ============================================

import { FastifyRequest, FastifyReply } from 'fastify'
import { supabase } from '../db'

// ✅ Declaration merging برای تایپ‌دهی صحیح
declare module 'fastify' {
  interface FastifyRequest {
    user: any
    userId: string
    workspaceId: string
    userRole: string
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

  // ✅ Set user info on request
  request.user = user
  request.userId = user.id

  // ✅ Get workspace_id from user_workspaces or default
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  request.workspaceId = membership?.workspace_id || ''
  request.userRole = membership?.role || 'admin'
}

export const authPreHandler = authenticate