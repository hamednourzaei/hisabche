import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { extractSymbolsFromSource } from '../lib/ast-symbol-extractor.mjs'

const ROOT = process.cwd()

function readProjectFile(relPath) {
  const full = join(ROOT, relPath)
  assert.ok(existsSync(full), `Expected real file to exist: ${relPath}`)
  return readFileSync(full, 'utf8')
}

describe('Hisabche AST Code Intelligence — Golden Symbol Tests (10 Real Repository Domains)', () => {
  // Domain 1: Invoices (packages/local-engine/src/routes/invoices.ts)
  it('Domain 1 [Invoices]: extracts InvoiceRow and mapInvoice', () => {
    const file = 'packages/local-engine/src/routes/invoices.ts'
    const code = readProjectFile(file)
    const symbols = extractSymbolsFromSource(file, code, {
      domain: 'Invoices',
      platform: 'OFFLINE_ENGINE',
    })

    const row = symbols.find((s) => s.name === 'InvoiceRow')
    assert.ok(row, 'InvoiceRow should be discovered')
    assert.strictEqual(row.kind, 'interface')
    assert.strictEqual(row.file, file)
    assert.strictEqual(row.domain, 'Invoices')
    assert.strictEqual(row.platform, 'OFFLINE_ENGINE')
    assert.strictEqual(row.schemaVersion, 1)
    assert.ok(row.sourceHash.length === 64)

    const mapFn = symbols.find((s) => s.name === 'mapInvoice')
    assert.ok(mapFn, 'mapInvoice should be discovered')
    assert.strictEqual(mapFn.kind, 'function')
    assert.ok(mapFn.signature.includes('mapInvoice') && mapFn.signature.includes('InvoiceRow'))
  })

  // Domain 2: Payments (backend/src/services/payments/payments.repository.ts)
  it('Domain 2 [Payments]: extracts PaymentsRepository class, methods, and types', () => {
    const file = 'backend/src/services/payments/payments.repository.ts'
    const code = readProjectFile(file)
    const symbols = extractSymbolsFromSource(file, code, {
      domain: 'Payments',
      platform: 'SERVER_ONLY',
    })

    const repoClass = symbols.find((s) => s.name === 'PaymentsRepository')
    assert.ok(repoClass, 'PaymentsRepository class must be discovered')
    assert.strictEqual(repoClass.kind, 'class')
    assert.strictEqual(repoClass.package, '@hisabche/backend')

    const listMethod = symbols.find((s) => s.name === 'PaymentsRepository.listPayments')
    assert.ok(listMethod, 'PaymentsRepository.listPayments method must be extracted')
    assert.strictEqual(listMethod.kind, 'method')
    assert.strictEqual(listMethod.signatureStatus, 'resolved')
  })

  // Domain 3: Inventory (packages/validation/src/schemas/product.schema.ts)
  it('Domain 3 [Inventory]: extracts productSchema and Product type alias', () => {
    const file = 'packages/validation/src/schemas/product.schema.ts'
    const code = readProjectFile(file)
    const symbols = extractSymbolsFromSource(file, code, {
      domain: 'Inventory',
      platform: 'SHARED',
    })

    const schema = symbols.find((s) => s.name === 'productSchema')
    assert.ok(schema, 'productSchema must be discovered')
    assert.strictEqual(schema.kind, 'constant')
    assert.ok(schema.signature.includes('productSchema'))

    const typeAlias = symbols.find((s) => s.name === 'Product')
    assert.ok(typeAlias, 'Product type alias must be discovered')
    assert.strictEqual(typeAlias.kind, 'type_alias')
    assert.strictEqual(typeAlias.signatureStatus, 'resolved')
  })

  // Domain 4: Accounting (backend/src/services/accounting/profit-report.domain.ts)
  it('Domain 4 [Accounting]: extracts buildProfitReport re-export and domain contracts', () => {
    const file = 'backend/src/services/accounting/profit-report.domain.ts'
    const code = readProjectFile(file)
    const symbols = extractSymbolsFromSource(file, code, {
      domain: 'Accounting',
      platform: 'SERVER_ONLY',
    })

    const reExp = symbols.find((s) => s.name === 'buildProfitReport')
    assert.ok(reExp, 'buildProfitReport re-export must be discovered')
    assert.strictEqual(reExp.kind, 're_export')
    assert.ok(reExp.signature.includes('@hisabche/validation'))
  })

  // Domain 5: Sync / App Bridge (packages/app-bridge/src/push-order.ts)
  it('Domain 5 [Sync]: extracts referencedIds and createPushGate function', () => {
    const file = 'packages/app-bridge/src/push-order.ts'
    const code = readProjectFile(file)
    const symbols = extractSymbolsFromSource(file, code, {
      domain: 'Sync',
      platform: 'PLATFORM_ADAPTER',
    })

    const refIds = symbols.find((s) => s.name === 'referencedIds')
    assert.ok(refIds, 'referencedIds function must be discovered')
    assert.strictEqual(refIds.kind, 'function')
    assert.strictEqual(refIds.exported, true)

    const gate = symbols.find((s) => s.name === 'createPushGate')
    assert.ok(gate, 'createPushGate function must be discovered')
    assert.strictEqual(gate.kind, 'function')
    assert.ok(gate.signature.includes('createPushGate('))
  })

  // Domain 6: Backend Route (backend/src/routes/accounting.routes.ts)
  it('Domain 6 [Backend Routes]: extracts accountingRoutes Fastify route plugin', () => {
    const file = 'backend/src/routes/accounting.routes.ts'
    const code = readProjectFile(file)
    const symbols = extractSymbolsFromSource(file, code, {
      domain: 'Accounting',
      platform: 'SERVER_ONLY',
    })

    const routeFn = symbols.find((s) => s.name === 'accountingRoutes')
    assert.ok(routeFn, 'accountingRoutes must be discovered')
    assert.strictEqual(routeFn.kind, 'async_function')
    assert.strictEqual(routeFn.exported, true)
    assert.ok(
      routeFn.signature.includes('accountingRoutes') &&
        routeFn.signature.includes('FastifyInstance'),
    )
  })

  // Domain 7: API Client / Hooks (packages/api/src/hooks/useActivities.ts)
  it('Domain 7 [API Client]: extracts useActivities and useUnreadActivityCount React hooks', () => {
    const file = 'packages/api/src/hooks/useActivities.ts'
    const code = readProjectFile(file)
    const symbols = extractSymbolsFromSource(file, code, { domain: 'Reports', platform: 'SHARED' })

    const hook = symbols.find((s) => s.name === 'useActivities')
    assert.ok(hook, 'useActivities React hook must be discovered')
    assert.strictEqual(hook.kind, 'react_hook')
    assert.strictEqual(hook.exported, true)
    assert.ok(hook.signature.includes('useActivities('))

    const countHook = symbols.find((s) => s.name === 'useUnreadActivityCount')
    assert.ok(countHook, 'useUnreadActivityCount React hook must be discovered')
    assert.strictEqual(countHook.kind, 'react_hook')
  })

  // Domain 8: Shared UI (packages/ui/src/components/ui/dashboard-header.tsx)
  it('Domain 8 [Shared UI]: extracts DashboardHeader component and sub-elements', () => {
    const file = 'packages/ui/src/components/ui/dashboard-header.tsx'
    const code = readProjectFile(file)
    const symbols = extractSymbolsFromSource(file, code, { domain: 'Reports', platform: 'SHARED' })

    const component = symbols.find((s) => s.name === 'DashboardHeader')
    assert.ok(component, 'DashboardHeader component must be discovered')
    assert.strictEqual(component.kind, 'react_component')
    assert.strictEqual(component.exported, true)

    const sub = symbols.find((s) => s.name === 'SvgIcon')
    assert.ok(sub, 'SvgIcon component must be discovered')
    assert.strictEqual(sub.kind, 'react_component')
  })

  // Domain 9: Validation Schemas (packages/validation/src/schemas/workspace.schema.ts)
  it('Domain 9 [Validation]: extracts workspaceSchema and Workspace type', () => {
    const file = 'packages/validation/src/schemas/workspace.schema.ts'
    const code = readProjectFile(file)
    const symbols = extractSymbolsFromSource(file, code, { domain: 'Settings', platform: 'SHARED' })

    const schema = symbols.find((s) => s.name === 'workspaceSchema')
    assert.ok(schema, 'workspaceSchema must be discovered')
    assert.strictEqual(schema.kind, 'constant')

    const typeDef = symbols.find((s) => s.name === 'Workspace')
    assert.ok(typeDef, 'Workspace type must be discovered')
    assert.strictEqual(typeDef.kind, 'type_alias')
  })

  // Domain 10: Local Engine (packages/local-engine/src/db.ts)
  it('Domain 10 [Local Engine]: extracts LocalDb and RunResult interfaces', () => {
    const file = 'packages/local-engine/src/db.ts'
    const code = readProjectFile(file)
    const symbols = extractSymbolsFromSource(file, code, {
      domain: 'Offline',
      platform: 'OFFLINE_ENGINE',
    })

    const dbIntf = symbols.find((s) => s.name === 'LocalDb')
    assert.ok(dbIntf, 'LocalDb interface must be discovered')
    assert.strictEqual(dbIntf.kind, 'interface')
    assert.strictEqual(dbIntf.signature, 'interface LocalDb { ... }')
    assert.strictEqual(dbIntf.package, '@hisabche/local-engine')
  })
})
