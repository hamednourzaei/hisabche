// packages/db-schema/src/index.ts
// ============================================
// Only type exports — safe everywhere
// ============================================

export * from './types';
export { drizzleSchema } from './drizzle.schema';
export { watermelonSchema } from './watermelon.schema';
// packages/db-server/src/index.ts
// ============================================
// Server-only exports
// ============================================

export { db, client, supabase } from './client';
export * from './repositories/ActivityRepository';
export { DatabaseError } from './errors';