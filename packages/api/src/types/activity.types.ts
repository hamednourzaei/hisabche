// packages/api/src/types/activity.types.ts

export interface ActivityDto {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  title: string;
  description?: string;
  actor_id: string;
  actor_name: string;
  is_read: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ActivityItemDto {
  id: string;
  action: string;
  title: string;
  description?: string;
  actor: string;
  timestamp: string;
  isRead: boolean;
  importance: number;
}

export interface EntitySummaryDto {
  label: string;
  subtitle?: string;
  amount?: number;
  currency?: string;
  status?: string;
  activityCount: number;
  lastActivity: string;
  route?: string;
}

export interface ActivityGroupDto {
  entityType: string;
  entityId: string;
  entitySummary: EntitySummaryDto;
  activities: ActivityItemDto[];
  unreadCount: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  latestAt: string;
  hasUnread: boolean;
}

// ✅ اضافه کردن ActivityFilterDto
export interface ActivityFilterDto {
  type?: string;
  status?: string;
  search?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  unread?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  limit?: number;
  cursor?: string | null;
}

export interface PaginatedActivitiesResponse {
  data: ActivityGroupDto[];
  nextCursor: string | null;
  hasMore: boolean;
}