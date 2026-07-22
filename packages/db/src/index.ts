// packages/db/src/index.ts
// ============================================
// Only type exports — safe for web, mobile, backend
// ============================================

// ─── Drizzle Schema ──────────────────────────────────────────────────────────
export { drizzleSchema } from './drizzle.schema'
export * from './drizzle.schema'

// ─── Watermelon Schema ──────────────────────────────────────────────────────
export { watermelonSchema } from './watermelon.schema'

// ─── Supabase Types ─────────────────────────────────────────────────────────
export type { Database } from './supabase/types'

// ─── Drizzle Client ─────────────────────────────────────────────────────────
export { db, client } from './client'

// ─── Watermelon DB ──────────────────────────────────────────────────────────
export { database, performSync } from './database'

// ─── Sync Queue ─────────────────────────────────────────────────────────────
export { syncQueue } from './sync-queue'

// ─── Activity Repository ──────────────────────────────────────────────────
export { ActivityRepository } from './repositories/ActivityRepository'
export type {
  ActivityRecord,
  CreateActivityInput,
  UpdateActivityInput,
  ActivityFilters,
} from './repositories/ActivityRepository'