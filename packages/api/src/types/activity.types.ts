// packages/api/src/types/activity.types.ts

export interface ActivityDto {
  id: string
  entity_type: string
  entity_id: string
  action: string
  title: string
  description?: string
  actor_id: string
  actor_name: string
  is_read: boolean
  priority: 'low' | 'medium' | 'high' | 'urgent'
  metadata: Record<string, unknown>
  created_at: string
}

/** The role vocabulary the UI colours — see `ROLE_TONE` in `packages/ui`. */
export type ActorRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface ActivityItemDto {
  id: string
  action: string
  title: string
  description?: string
  actor: string
  /**
   * The role the actor held in the workspace that owns this activity, resolved
   * server-side from `workspace_members`.
   *
   * ⚠️ `null`/absent MEANS UNKNOWN. The actor left, lost access, or the row
   * predates memberships. Render it as a neutral, uncoloured cell — never fall
   * back to `member` or `viewer`, which would state something about a real
   * person that may be false.
   */
  actorRole?: ActorRole | null
  timestamp: string
  isRead: boolean
  importance: number
}

export interface EntitySummaryDto {
  label: string
  subtitle?: string
  amount?: number
  currency?: string
  status?: string
  activityCount: number
  lastActivity: string
  route?: string
}

export interface ActivityGroupDto {
  entityType: string
  entityId: string
  entitySummary: EntitySummaryDto
  activities: ActivityItemDto[]
  unreadCount: number
  priority: 'low' | 'medium' | 'high' | 'urgent'
  latestAt: string
  hasUnread: boolean
}

// ✅ اضافه کردن ActivityFilterDto
export interface ActivityFilterDto {
  type?: string
  status?: string
  search?: string
  entityType?: string
  entityId?: string
  startDate?: string
  endDate?: string
  unread?: boolean
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  limit?: number
  cursor?: string | null
}

export interface PaginatedActivitiesResponse {
  data: ActivityGroupDto[]
  nextCursor: string | null
  hasMore: boolean
}
