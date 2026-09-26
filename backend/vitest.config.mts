import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Placeholder credentials so `src/db.ts` can construct its client at import
    // time. No test performs a real query — the Supabase client is mocked in
    // the suites that would otherwise reach it — so these values are never
    // used to talk to anything.
    setupFiles: ['./src/__tests__/setup.ts'],
    // Building the whole Fastify app registers every route and plugin once.
    hookTimeout: 60_000,

    // ⚠️ THE REAL-POSTGRES SUITES RUN ONE AT A TIME.
    //
    // Each `*.pg.test.ts` boots its own embedded Postgres. Three of them
    // starting beside ~140 other files starved the machine, and unrelated
    // tests failed on timing — a different one each run, every one of them
    // green on its own. A flaky suite is a suite nobody believes, so the
    // Postgres files get their own project with file parallelism off.
    projects: [
      {
        extends: true,
        test: { name: 'unit', exclude: [...configDefaults.exclude, '**/*.pg.test.ts'] },
      },
      {
        extends: true,
        test: { name: 'pg', include: ['src/**/*.pg.test.ts'], fileParallelism: false },
      },
    ],
  },
})
