'use client'

// ============================================
// packages/ui/src/hooks/activity/useOfflineActivities.ts
//
// V65: this file was a SECOND 308-line implementation of a hook that already
// existed in `packages/api`, and it built its own data: it flattened the feed
// into a private `OfflineActivity` shape and turned each row back into an
// `ActivityGroupDto` with `actor: 'System'`, `action: 'created'` and
// `importance: 1` — values the server never sent. It had no caller in any app.
//
// There is now one implementation. This path stays so an import that already
// names it keeps working, and it re-exports the real hook. Nothing here invents
// data.
// ============================================

export {
  useOfflineActivities,
  type OfflineActivitiesResult,
  type OfflineActivitySyncStatus,
} from '@hisabche/api'
