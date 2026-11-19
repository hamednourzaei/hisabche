// ============================================
// backend/src/middleware/onboarding.middleware.ts
//
// PART 7 — HARD ONBOARDING ACCESS GATE (server side).
//
// A signed-in account that has not finished onboarding must not be able to
// read the business dashboard, even by calling the API directly, refreshing,
// or navigating by URL. This is a SERVER decision: the completion timestamp
// lives on `profiles` and is written only by the authoritative activation
// gate (PATCH /api/auth/profile). A client claim is never consulted here.
//
// Fail closed: an unreadable state (database error, missing migration column)
// is NOT treated as «completed». It answers 428 ONBOARDING_REQUIRED so the
// client resumes the wizard, or 503 when the database itself is unavailable.
// ============================================

import type { FastifyReply, FastifyRequest } from 'fastify'
import { supabase } from '../db'

export const ONBOARDING_REQUIRED = 'ONBOARDING_REQUIRED'
export const ONBOARDING_STATE_UNAVAILABLE = 'ONBOARDING_STATE_UNAVAILABLE'

const isMissingColumn = (code: string | undefined): boolean =>
  code === '42703' || code === 'PGRST204'

/** True only when the profile row positively carries a completion timestamp. */
export async function onboardingIsComplete(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    // The onboarding columns migration has not run: there is no proof of
    // completion. Report it as «not complete», never as «done».
    if (isMissingColumn(error.code)) return false
    throw new Error(`ONBOARDING_STATE_READ_FAILED: ${error.message}`)
  }
  const row = data as { onboarding_completed_at?: string | null } | null
  return typeof row?.onboarding_completed_at === 'string' && row.onboarding_completed_at.length > 0
}

export async function requireOnboardingComplete(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void | FastifyReply> {
  const userId = request.userId
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' })
  }

  let complete: boolean
  try {
    complete = await onboardingIsComplete(userId)
  } catch (error) {
    request.log.error({ err: error, userId }, 'onboarding gate: state unreadable')
    return reply.status(503).send({
      error: 'Onboarding state is unavailable',
      code: ONBOARDING_STATE_UNAVAILABLE,
    })
  }

  if (!complete) {
    return reply.status(428).send({
      error: 'Onboarding must be completed before accessing the business dashboard',
      code: ONBOARDING_REQUIRED,
    })
  }
}
