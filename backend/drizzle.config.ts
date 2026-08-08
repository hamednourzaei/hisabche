// backend/drizzle.config.ts
import { defineConfig } from 'drizzle-kit'
import * as dotenv from 'dotenv'

dotenv.config()

// `drizzle-kit generate` only needs the schema, not a live connection — so an
// absent URL must not break the deploy build. push/migrate still fail loudly.
const DATABASE_URL = process.env.SUPABASE_DATABASE_URL ?? ''

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/drizzle-schema.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    url: DATABASE_URL,
  },
  verbose: true,
  strict: true,
})
