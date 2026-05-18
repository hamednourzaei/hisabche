import type { Config } from 'drizzle-kit'

export default {
  schema: './backend/src/drizzle-schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: 'postgresql://postgres.quxpxatopmquheoazzlj:09025120419Hamed@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=30',
  },
} satisfies Config