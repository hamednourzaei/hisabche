// ============================================
// scripts/industry/generate-industry-docs.mjs
//
// Rewrites docs/industries (every file except INDUSTRY-REGISTRY.md) from the
// code. The builder is TypeScript that imports the real modules, so it runs
// inside the UI package's own test runner rather than through a parser here:
//
//   packages/ui/src/__tests__/industry-docs/build.ts     the builder
//   packages/ui/src/__tests__/industry-docs/content.ts   what a person wrote
//   packages/ui/src/__tests__/industry-specs-complete.test.ts   the guard
//
// Run:    node scripts/industry/generate-industry-docs.mjs
// Check:  node scripts/industry/generate-industry-docs.mjs --check   (exit 1 if stale)
// ============================================

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CHECK_ONLY = process.argv.includes('--check')

const run = spawnSync('npx vitest run src/__tests__/industry-specs-complete.test.ts', {
  cwd: path.join(ROOT, 'packages/ui'),
  shell: true,
  stdio: 'inherit',
  env: { ...process.env, ...(CHECK_ONLY ? {} : { UPDATE_INDUSTRY_DOCS: '1' }) },
})

process.exit(run.status ?? 1)
