// ============================================
// backend/src/services/guide-progress.service.ts
//
// Which in-app guide steps a PERSON has seen (user-guide-progress-01). Read and
// written only for `request.userId` itself — the row's owner, never a tenancy
// filter on business data (CLAUDE.md §1: user_id is not the boundary for
// SHARED data; this is the person's own).
//
// Append-only: a step once seen stays seen. «Read the guide again» is a
// device-side replay and never deletes a row here.
// ============================================

import { supabase } from '../db'
import { DatabaseError } from '../errors/database.error'

export interface GuideStepSeen {
  stepId: string
  routeId: string
  seenAt: string
}

/** The table is missing until the migration runs: «not configured», not 500. */
const isMissing = (code: string | undefined) =>
  code === '42P01' || code === 'PGRST205' || code === 'PGRST204'

export async function readGuideProgress(
  userId: string,
): Promise<{ configured: boolean; steps: GuideStepSeen[] }> {
  const { data, error } = await supabase
    .from('user_guide_progress')
    .select('step_id, route_id, seen_at')
    .eq('user_id', userId)
  if (error) {
    if (isMissing(error.code)) return { configured: false, steps: [] }
    throw new DatabaseError('Failed to read guide progress', error)
  }
  const rows = (data ?? []) as { step_id: string; route_id: string; seen_at: string }[]
  return {
    configured: true,
    steps: rows.map((row) => ({ stepId: row.step_id, routeId: row.route_id, seenAt: row.seen_at })),
  }
}

/** Idempotent: a step already recorded keeps its first time. */
export async function markGuideStepsSeen(
  userId: string,
  steps: readonly { stepId: string; routeId: string }[],
): Promise<{ configured: boolean }> {
  if (steps.length === 0) return { configured: true }
  const { error } = await supabase.from('user_guide_progress').upsert(
    steps.map((step) => ({ user_id: userId, step_id: step.stepId, route_id: step.routeId })),
    { onConflict: 'user_id,step_id', ignoreDuplicates: true },
  )
  if (error) {
    if (isMissing(error.code)) return { configured: false }
    throw new DatabaseError('Failed to save guide progress', error)
  }
  return { configured: true }
}
