import type { Config } from 'drizzle-kit'

// ⚠️ NO CONNECTION STRING IN CODE (27 Sep 2026). This file carried the
// production database URL WITH ITS PASSWORD, committed to git. The value is
// read from the environment only; the password that was here must be treated
// as leaked and rotated in Supabase (it stays in git history).
const url = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL
if (!url) {
  throw new Error(
    'drizzle.config.ts: set SUPABASE_DATABASE_URL (or DATABASE_URL) in the environment',
  )
}

export default {
  schema: './backend/src/drizzle-schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
} satisfies Config
