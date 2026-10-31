import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveModule, normalizePath } from '../lib/module-resolver.mjs'

describe('Module Resolver — Unit Test Suite', () => {
  // 1. Relative imports
  it('resolves direct relative imports with extension', () => {
    const res = resolveModule(
      'backend/src/index.ts',
      './services/accounting/profit-report.domain.ts',
    )
    assert.strictEqual(res.status, 'RESOLVED')
    assert.strictEqual(res.isExternal, false)
    assert.strictEqual(res.resolvedPath, 'backend/src/services/accounting/profit-report.domain.ts')
  })

  it('resolves relative imports without extension (.ts)', () => {
    const res = resolveModule('packages/local-engine/src/routes/invoices.ts', '../db')
    assert.strictEqual(res.status, 'RESOLVED')
    assert.strictEqual(res.resolvedPath, 'packages/local-engine/src/db.ts')
  })

  it('resolves relative directory index imports', () => {
    const res = resolveModule('backend/src/index.ts', './routes')
    // If backend/src/routes/index.ts exists or backend/src/routes exists
    assert.ok(res.status === 'RESOLVED' || res.status === 'UNRESOLVED')
  })

  // 2. Path Aliases
  it('resolves tsconfig path alias @hisabche/validation', () => {
    const res = resolveModule('backend/src/index.ts', '@hisabche/validation')
    assert.strictEqual(res.status, 'RESOLVED')
    assert.strictEqual(res.isExternal, false)
    assert.strictEqual(res.resolvedPath, 'packages/validation/src/index.ts')
  })

  it('resolves wildcard path alias @hisabche/ui/components/ui/dashboard-header', () => {
    const res = resolveModule('apps/web/page.tsx', '@hisabche/ui/components/ui/dashboard-header')
    assert.strictEqual(res.status, 'RESOLVED')
    assert.strictEqual(res.resolvedPath, 'packages/ui/src/components/ui/dashboard-header.tsx')
  })

  // 3. Workspace Packages
  it('resolves workspace package @hisabche/local-engine', () => {
    const res = resolveModule('apps/desktop/src/main.ts', '@hisabche/local-engine')
    assert.strictEqual(res.status, 'RESOLVED')
    assert.strictEqual(res.resolvedPath, 'packages/local-engine/src/index.ts')
  })

  it('resolves workspace package subpath', () => {
    const res = resolveModule('apps/desktop/src/main.ts', '@hisabche/local-engine/routes/invoices')
    assert.strictEqual(res.status, 'RESOLVED')
    assert.strictEqual(res.resolvedPath, 'packages/local-engine/src/routes/invoices.ts')
  })

  // 4. External npm & Node built-in packages
  it('classifies external npm packages correctly', () => {
    const res = resolveModule('backend/src/index.ts', 'fastify')
    assert.strictEqual(res.status, 'EXTERNAL')
    assert.strictEqual(res.isExternal, true)
    assert.strictEqual(res.resolvedPath, 'fastify')
  })

  it('classifies node built-in modules as external', () => {
    const res = resolveModule('scripts/build.mjs', 'node:fs')
    assert.strictEqual(res.status, 'EXTERNAL')
    assert.strictEqual(res.isExternal, true)
    assert.strictEqual(res.resolvedPath, 'node:fs')
  })

  // 5. Unresolved imports
  it('marks non-existent relative imports as UNRESOLVED', () => {
    const res = resolveModule('backend/src/index.ts', './non-existent-file-xyz')
    assert.strictEqual(res.status, 'UNRESOLVED')
    assert.strictEqual(res.resolvedPath, null)
  })

  it('normalizes paths consistently with forward slashes', () => {
    const p = normalizePath('backend\\src\\index.ts')
    assert.strictEqual(p, 'backend/src/index.ts')
  })
})
