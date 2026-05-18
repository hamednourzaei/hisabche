import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.SUPABASE_DATABASE_URL ||
  "postgresql://postgres.quxpxatopmquheoazzlj:09025120419Hamed@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres"

const client = postgres(connectionString, { ssl: 'require' })
export const db = drizzle(client, { schema })
export { client }