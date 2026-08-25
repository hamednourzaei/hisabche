// backend/src/services/event-log.service.ts
// Shared helper so every module (customers, products, projects, purchasing,
// HR, CRM, manufacturing, warehouse, checkout, ...) can log a business event
// to BOTH the activity feed (/activities) and the notification bell with a
// single call, instead of only invoices/workflow doing it.
// Fire-and-forget from call sites — logging must never break the actual
// business operation.

import { supabase } from '../db'
import { ActivityService } from './activity.service'
import { NotificationService } from './notification.service'

const activityService = new ActivityService()
const notificationService = new NotificationService()

export interface LogBusinessEventInput {
  userId: string
  /**
   * The authorized workspace, from a TenancyContext. Optional only while the
   * remaining services are being converted; once passed it is used verbatim
   * and no lookup happens. It is never defaulted to `userId`.
   */
  workspaceId?: string | undefined
  entityType: string
  entityId: string
  action: string
  title: string
  description?: string | undefined
  metadata?: Record<string, unknown> | undefined
  importance?: number | undefined
  notifyType?: 'info' | 'success' | 'warning' | 'approval_required' | undefined
  actionUrl?: string | undefined
  /** Set to false to skip the bell notification and only log the activity. */
  notify?: boolean | undefined
}

async function getUserDisplayName(userId: string): Promise<string> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, display_name')
      .eq('id', userId)
      .maybeSingle()

    if (profile?.full_name) return profile.full_name
    if (profile?.display_name) return profile.display_name

    const { data: user } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle()

    return user?.full_name || user?.email || userId.slice(0, 8)
  } catch {
    return userId.slice(0, 8)
  }
}

/**
 * ⚠️ SECURITY — this used to end `?? userId`, returning the USER's id as a
 * workspace id: a fabricated tenancy boundary in the same UUID space as real
 * ones, written onto every activity and notification row.
 *
 * Now it returns null instead. A caller that cannot establish a workspace does
 * not get a made-up one, and the event is skipped rather than filed under an
 * id that belongs to nothing.
 *
 * Prefer passing `workspaceId` explicitly from a TenancyContext; this lookup
 * exists only for callers not yet converted, and it fails closed.
 */
async function resolveWorkspaceId(userId: string): Promise<string | null> {
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .eq('has_access', true)
    .is('suspended_at', null)
    .order('joined_at', { ascending: true })

  // Exactly one, or none. With several the active workspace is a choice this
  // helper cannot make, and guessing would file a shop's activity into the
  // wrong book.
  if (memberships?.length !== 1) return null
  return memberships[0]?.workspace_id ?? null
}

export async function logBusinessEvent(input: LogBusinessEventInput): Promise<void> {
  try {
    const [actorName, resolvedWorkspaceId] = await Promise.all([
      getUserDisplayName(input.userId),
      input.workspaceId ? Promise.resolve(input.workspaceId) : resolveWorkspaceId(input.userId),
    ])

    // Fail closed. An event with no workspace has nowhere legitimate to go,
    // and this helper is fire-and-forget by contract — dropping the log is
    // correct where inventing a tenancy id is not.
    if (!resolvedWorkspaceId) {
      console.warn(
        `[logBusinessEvent] no workspace for user ${input.userId}; skipping ${input.entityType}/${input.action}`,
      )
      return
    }

    const workspaceId = resolvedWorkspaceId

    const tasks: Promise<unknown>[] = [
      activityService.createActivity({
        actorId: input.userId,
        actorName,
        workspaceId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        title: input.title,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        ...(input.importance !== undefined ? { importance: input.importance } : {}),
      }),
    ]

    if (input.notify !== false) {
      tasks.push(
        notificationService.create(workspaceId, {
          user_id: input.userId,
          title: input.title,
          type: input.notifyType ?? 'info',
          entity_type: input.entityType,
          entity_id: input.entityId,
          metadata: input.metadata ?? {},
          ...(input.description !== undefined ? { body: input.description } : {}),
          ...(input.actionUrl !== undefined ? { action_url: input.actionUrl } : {}),
        }),
      )
    }

    const results = await Promise.allSettled(tasks)
    for (const r of results) {
      if (r.status === 'rejected') {
        console.error(`[logBusinessEvent] ${input.entityType}:${input.action} failed:`, r.reason)
      }
    }
  } catch (err) {
    console.error(
      `[logBusinessEvent] unexpected error for ${input.entityType}:${input.action}:`,
      err,
    )
  }
}
