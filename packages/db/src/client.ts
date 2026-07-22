// packages/db/src/client.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createClient } from '@supabase/supabase-js'
import * as schema from './schema'

const connectionString = process.env.SUPABASE_DATABASE_URL ||
  "postgresql://postgres.quxpxatopmquheoazzlj:09025120419Hamed@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres"

const client = postgres(connectionString, { ssl: 'require' })
export const db = drizzle(client, { schema })

// ✅ اضافه کردن supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://quxpxatopmquheoazzlj.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_mGppZjb0DVEKLFf7f1XjmQ_iHBQVu_U'

export const supabase = createClient(supabaseUrl, supabaseKey)
export { client }