// packages/db-server/src/client.ts
// ============================================
// Server-only — Drizzle + Postgres + Supabase
// ============================================

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createClient } from '@supabase/supabase-js'
// Named by module, not by package: `./index.ts` re-exports this file, so going
// through the package barrel would make `index → client → index` a cycle and
// leave `drizzleSchema` in its temporal dead zone at line 18 below, which runs
// at module scope.
import { drizzleSchema } from './drizzle.schema'

const connectionString = process.env.SUPABASE_DATABASE_URL!

if (!connectionString) {
  throw new Error('SUPABASE_DATABASE_URL is not set')
}

const client = postgres(connectionString, { ssl: 'require' })
export const db = drizzle(client, { schema: drizzleSchema })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)
export { client }
