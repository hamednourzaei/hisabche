import { primaryDb } from './primary'

/**
 * Admin / session-mode client handle (used only by explicit admin/migration tooling).
 * Behind Supavisor/PgBouncer, session-scoped operations belong on the session pooler,
 * never on the transaction pooler used by API/worker traffic.
 */
export const adminDb = primaryDb
