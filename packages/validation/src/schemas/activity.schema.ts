// packages/validation/src/schemas/activity.schema.ts
import { z } from "zod";

export const activityTypeEnum = z.enum([
  "invoice",
  "customer",
  "product",
  "payment",
  "supplier",
  "inventory",
]);

export const activityActionEnum = z.enum([
  "created",
  "updated",
  "paid",
  "approved",
  "rejected",
  "sent",
  "archived",
  "cancelled",
  "status_changed",
]);

export const activityImportanceEnum = z.number().int().min(0).max(5);

export const createActivitySchema = z.object({
  actorId: z.string().uuid(),
  actorName: z.string().min(1),
  entityType: activityTypeEnum,
  entityId: z.string().uuid(),
  action: activityActionEnum,
  title: z.string().min(1),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  importance: activityImportanceEnum.default(0),
});

export const activityFiltersSchema = z.object({
  type: activityTypeEnum.optional(),
  unread: z.boolean().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type ActivityFilters = z.infer<typeof activityFiltersSchema>;