import path from 'node:path'
import { fileURLToPath } from 'node:url'
// Resolved by file path: this config lives outside the package that owns the
// vitest dependency, so a bare 'vitest/config' specifier does not resolve here.
import { defineConfig } from '../../../backend/node_modules/vitest/dist/config.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../..')

// Audit probe runner: boots the real Fastify app (buildServer) and asserts on
// the five critical routes over HTTP. No product code and no existing test is
// touched; this file lives under scripts/audit/probe/ by design.
export default defineConfig({
  test: {
    root: repoRoot,
    include: ['scripts/audit/probe/**/*.probe.test.ts'],
    setupFiles: [path.join(repoRoot, 'backend/src/__tests__/setup.ts')],
    hookTimeout: 120_000,
    testTimeout: 120_000,
  },
})
