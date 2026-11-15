// ============================================
// backend/src/__tests__/helpers/journey-db-module.ts
//
// Stands in for `src/db.ts` inside the journey server (journey-server.ts redirects
// every import of that file here). The world itself is built before the backend is
// imported and parked on globalThis — this module only re-exports it, by name.
// ============================================

interface JourneyDbModule {
  supabase: unknown
  default: unknown
  createAuthClient: unknown
  createUserScopedClient: unknown
  checkDatabaseConnection: unknown
  dbStats: unknown
  withConnection: unknown
  gotrueRequest: unknown
}

const world = (globalThis as typeof globalThis & { __journeyDb?: JourneyDbModule }).__journeyDb
if (!world) throw new Error('JOURNEY_WORLD_MISSING: start the backend through journey-server.ts')

export const supabase = world.supabase
export const createAuthClient = world.createAuthClient
export const createUserScopedClient = world.createUserScopedClient
export const checkDatabaseConnection = world.checkDatabaseConnection
export const dbStats = world.dbStats
export const withConnection = world.withConnection
export const gotrueRequest = world.gotrueRequest
export default world.default
