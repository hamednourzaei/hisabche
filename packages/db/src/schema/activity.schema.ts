// packages/db/src/schema/activity.schema.ts
import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const activitySchema = appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'activities',
      columns: [
        { name: 'entity_type', type: 'string' },
        { name: 'entity_id', type: 'string' },
        { name: 'action', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'actor_id', type: 'string' },
        { name: 'actor_name', type: 'string' },
        { name: 'metadata', type: 'string' },
        { name: 'importance', type: 'number' },
        { name: 'is_read', type: 'boolean' },
        { name: 'is_pinned', type: 'boolean' },
        { name: 'is_archived', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'synced_at', type: 'number' },
      ],
    }),
    // ─── Indexes ──────────────────────────────────────────────
    tableSchema({
      name: 'activities_indexes',
      columns: [
        { name: 'entity_type', type: 'string' },
        { name: 'entity_id', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'is_read', type: 'boolean' },
        { name: 'is_pinned', type: 'boolean' },
        { name: 'is_archived', type: 'boolean' },
      ],
    }),
  ],
})