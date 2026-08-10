import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Placeholder credentials so `src/db.ts` can construct its client at import
    // time. No test performs a real query — the Supabase client is mocked in
    // the suites that would otherwise reach it — so these values are never
    // used to talk to anything.
    setupFiles: ['./src/__tests__/setup.ts'],
    // Building the whole Fastify app registers every route and plugin once.
    hookTimeout: 60_000,
  },
})
