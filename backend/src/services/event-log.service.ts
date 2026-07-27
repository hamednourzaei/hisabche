// backend/src/services/event-log.service.ts
// Shared helper so every module (customers, products, projects, purchasing,
// HR, CRM, manufacturing, warehouse, checkout, ...) can log a business event
// to BOTH the activity feed (/activities) and the notification bell with a
// single call, instead of only invoices/workflow doing it.
// Fire-and-forget from call sites — logging must never break the actual
// business operation.

import { supabase } from "../db";
import { ActivityService } from "./activity.service";
import { NotificationService } from "./notification.service";

const activityService = new ActivityService();
const notificationService = new NotificationService();

export interface LogBusinessEventInput {
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  title: string;
  description?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  importance?: number | undefined;
  notifyType?: "info" | "success" | "warning" | "approval_required" | undefined;
  actionUrl?: string | undefined;
  /** Set to false to skip the bell notification and only log the activity. */
  notify?: boolean | undefined;
}

async function getUserDisplayName(userId: string): Promise<string> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, display_name")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.full_name) return profile.full_name;
    if (profile?.display_name) return profile.display_name;

    const { data: user } = await supabase
      .from("users")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();

    return user?.full_name || user?.email || userId.slice(0, 8);
  } catch {
    return userId.slice(0, 8);
  }
}

async function resolveWorkspaceId(userId: string): Promise<string> {
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  return membership?.workspace_id ?? userId;
}

export async function logBusinessEvent(input: LogBusinessEventInput): Promise<void> {
  try {
    const [actorName, workspaceId] = await Promise.all([
      getUserDisplayName(input.userId),
      resolveWorkspaceId(input.userId),
    ]);

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
    ];

    if (input.notify !== false) {
      tasks.push(
        notificationService.create(workspaceId, {
          user_id: input.userId,
          title: input.title,
          type: input.notifyType ?? "info",
          entity_type: input.entityType,
          entity_id: input.entityId,
          metadata: input.metadata ?? {},
          ...(input.description !== undefined ? { body: input.description } : {}),
          ...(input.actionUrl !== undefined ? { action_url: input.actionUrl } : {}),
        })
      );
    }

    const results = await Promise.allSettled(tasks);
    for (const r of results) {
      if (r.status === "rejected") {
        console.error(`[logBusinessEvent] ${input.entityType}:${input.action} failed:`, r.reason);
      }
    }
  } catch (err) {
    console.error(`[logBusinessEvent] unexpected error for ${input.entityType}:${input.action}:`, err);
  }
}
