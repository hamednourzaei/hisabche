// backend/drizzle.config.ts
import { defineConfig } from 'drizzle-kit'
import * as dotenv from 'dotenv'

dotenv.config()

const DATABASE_URL = process.env.SUPABASE_DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('SUPABASE_DATABASE_URL is not defined in .env')
}

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