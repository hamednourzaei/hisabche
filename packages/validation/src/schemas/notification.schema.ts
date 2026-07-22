// packages/validation/src/schemas/notification.schema.ts
import { z } from "zod";

export const notificationTypeEnum = z.enum(["info", "success", "warning", "approval_required"]);

export const createNotificationSchema = z.object({
  user_id: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().optional(),
  type: notificationTypeEnum.default("info"),
  action_url: z.string().optional(),
  entity_type: z.string().optional(),
  entity_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const notificationSchema = createNotificationSchema.extend({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  is_read: z.boolean(),
  created_at: z.string(),
});

export const notificationFiltersSchema = z.object({
  is_read: z.boolean().optional(),
  type: notificationTypeEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ✅ اصلاح شده: ids می‌تواند آرایه‌ای از string باشد (نه لزوماً UUID)
export const markReadSchema = z.object({
  ids: z.array(z.string()).min(1, "ids must have at least one item"),
});

export type NotificationType = z.infer<typeof notificationTypeEnum>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type NotificationFilters = z.infer<typeof notificationFiltersSchema>;