// packages/api/src/types/activity.types.ts
export interface ActivityDto {
  id: string;
  actorId: string;
  actorName: string;
  entityType: "invoice" | "customer" | "product" | "payment" | "supplier" | "inventory";
  entityId: string;
  action: "created" | "updated" | "paid" | "approved" | "rejected" | "sent" | "archived" | "cancelled";
  title: string;
  description?: string | undefined;
  metadata: Record<string, unknown>;
  importance: number;
  isRead: boolean;
  createdAt: string;
}

// نگه‌داشته شده برای سازگاری با کدی که هنوز ActivityItemDto رو import می‌کنه
export type ActivityItemDto = ActivityDto;

export interface EntitySummaryDto {
  label: string;
  subtitle?: string;
  amount?: number;
  currency?: string;
  status?: string;
  statusLabel?: string;
  statusColor?: string;
  activityCount: number;
  lastActivity: string;
  route: string;
}

export interface ActivityGroupDto {
  entityType: ActivityDto["entityType"];
  entityId: string;
  entitySummary: EntitySummaryDto;
  activities: ActivityDto[];
  unreadCount: number;
  hasUnread: boolean;
  latestAt: string;
  priority: "critical" | "high" | "medium" | "low";
}

export interface PaginatedActivitiesResponse {
  data: ActivityGroupDto[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}