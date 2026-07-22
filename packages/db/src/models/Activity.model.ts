// packages/db/src/models/Activity.model.ts
import { Model } from '@nozbe/watermelondb'
import { field, date, readonly, text, json } from '@nozbe/watermelondb/decorators'

export default class Activity extends Model {
  static table = 'activities'

  @text('entity_type') entityType!: string
  @text('entity_id') entityId!: string
  @text('action') action!: string
  @text('title') title!: string
  @text('description') description!: string
  @text('actor_id') actorId!: string
  @text('actor_name') actorName!: string
  @json('metadata', (json) => json) metadata!: Record<string, unknown>
  @field('importance') importance!: number
  @field('is_read') isRead!: boolean
  @field('is_pinned') isPinned!: boolean
  @field('is_archived') isArchived!: boolean
  @date('created_at') createdAt!: Date
  @readonly @date('synced_at') syncedAt!: Date
}