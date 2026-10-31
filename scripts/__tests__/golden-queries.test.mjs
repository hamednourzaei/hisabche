import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { CodeIntelQueryEngine } from '../lib/code-intel-query.mjs'

describe('Code Intelligence — 10-Domain Golden Query Suite', () => {
  let engine

  before(() => {
    engine = new CodeIntelQueryEngine()
    engine.load()
  })

  // Domain 1: Invoices
  it('Domain 1 [Invoices]: resolves createInvoiceSchema and extracts source excerpt', () => {
    const symbolId =
      '@hisabche/validation/packages/validation/src/schemas/invoice.schema.ts#createInvoiceSchema'
    const symRes = engine.getSymbol(symbolId)
    assert.strictEqual(symRes.found, true)
    assert.strictEqual(symRes.symbol.name, 'createInvoiceSchema')
    assert.strictEqual(symRes.symbol.package, '@hisabche/validation')
    assert.ok(symRes.symbol.signature.includes('invoiceSchema.omit'))

    const excerpt = engine.getSourceExcerpt(symbolId, { contextLines: 2 })
    assert.strictEqual(excerpt.success, true)
    assert.strictEqual(excerpt.file, 'packages/validation/src/schemas/invoice.schema.ts')
    assert.ok(excerpt.excerpt.includes('createInvoiceSchema'))
    assert.strictEqual(excerpt.isStale, false)
  })

  // Domain 2: Payments
  it('Domain 2 [Payments]: resolves PaymentsRepository class and inspects file relationships', () => {
    const symbolId =
      '@hisabche/backend/backend/src/services/payments/payments.repository.ts#PaymentsRepository'
    const symRes = engine.getSymbol(symbolId)
    assert.strictEqual(symRes.found, true)
    assert.strictEqual(symRes.symbol.name, 'PaymentsRepository')
    assert.strictEqual(symRes.symbol.kind, 'class')
    assert.strictEqual(symRes.symbol.package, '@hisabche/backend')

    const fileData = engine.getFile(symRes.symbol.file)
    assert.strictEqual(fileData.found, true)
    assert.ok(fileData.symbols.length >= 1)
  })

  // Domain 3: Inventory
  it('Domain 3 [Inventory]: discovers productSchema with exact search and kind filtering', () => {
    const searchRes = engine.findSymbols('productSchema', {
      exact: true,
      package: '@hisabche/validation',
    })
    assert.ok(searchRes.results.length >= 1)
    const match = searchRes.results.find(
      (s) => s.file === 'packages/validation/src/schemas/product.schema.ts',
    )
    assert.ok(match, 'Expected productSchema in schemas/product.schema.ts')
    assert.strictEqual(match.name, 'productSchema')
    assert.strictEqual(match.exported, true)
  })

  // Domain 4: Accounting
  it('Domain 4 [Accounting]: disambiguates buildProfitReport declarations across packages', () => {
    const symRes = engine.getSymbol('buildProfitReport')
    assert.strictEqual(symRes.found, true)
    assert.strictEqual(symRes.ambiguous, true)
    assert.ok(symRes.allMatches.length >= 2)

    // Can resolve exact backend implementation
    const backendSym = symRes.allMatches.find((s) => s.package === '@hisabche/backend')
    assert.ok(backendSym)
    assert.strictEqual(backendSym.file, 'backend/src/services/accounting/profit-report.domain.ts')
  })

  // Domain 5: Sync & Offline Bridge
  it('Domain 5 [Sync & App-Bridge]: verifies createPushGate and its outbound callees', () => {
    const symbolId = '@hisabche/app-bridge/packages/app-bridge/src/push-order.ts#createPushGate'
    const symRes = engine.getSymbol(symbolId)
    assert.strictEqual(symRes.found, true)
    assert.strictEqual(symRes.symbol.name, 'createPushGate')
    assert.strictEqual(symRes.symbol.package, '@hisabche/app-bridge')

    const { callees } = engine.getCallees(symbolId)
    assert.ok(callees.length >= 1)
  })

  // Domain 6: Backend HTTP Routes
  it('Domain 6 [Backend Routes]: discovers accountingRoutes and validates module imports', () => {
    const symbolId = '@hisabche/backend/backend/src/routes/accounting.routes.ts#accountingRoutes'
    const symRes = engine.getSymbol(symbolId)
    assert.strictEqual(symRes.found, true)
    assert.strictEqual(symRes.symbol.name, 'accountingRoutes')
    assert.strictEqual(symRes.symbol.package, '@hisabche/backend')

    const fileImports = engine.getImports('backend/src/routes/accounting.routes.ts')
    assert.ok(fileImports.totalImports >= 1)
  })

  // Domain 7: API Client & Hooks
  it('Domain 7 [API Hooks]: retrieves useActivities hook and checks its source excerpt', () => {
    const searchRes = engine.findSymbols('useActivities', { exact: true, package: '@hisabche/api' })
    assert.ok(searchRes.results.length >= 1)

    const hookSym = searchRes.results.find(
      (s) => s.file === 'packages/api/src/hooks/useActivities.ts',
    )
    assert.ok(hookSym)
    assert.strictEqual(hookSym.name, 'useActivities')

    const excerpt = engine.getSourceExcerpt(hookSym.id, { contextLines: 1 })
    assert.strictEqual(excerpt.success, true)
    assert.ok(excerpt.excerpt.includes('useActivities'))
  })

  // Domain 8: Shared UI Components
  it('Domain 8 [Shared UI]: finds DashboardHeader and distinguishes between packages', () => {
    const searchRes = engine.findSymbols('DashboardHeader', { exact: true })
    assert.ok(searchRes.results.length >= 2)

    const uiComponent = searchRes.results.find(
      (s) => s.package === '@hisabche/ui' && s.file.includes('dashboard-header.tsx'),
    )
    assert.ok(uiComponent, 'Expected DashboardHeader in @hisabche/ui')
    assert.strictEqual(uiComponent.kind, 'react_component')
  })

  // Domain 9: Validation Domain
  it('Domain 9 [Validation]: inspects workspaceSchema and validates line ranges', () => {
    const symbolId =
      '@hisabche/validation/packages/validation/src/schemas/workspace.schema.ts#workspaceSchema'
    const symRes = engine.getSymbol(symbolId)
    assert.strictEqual(symRes.found, true)
    assert.strictEqual(symRes.symbol.name, 'workspaceSchema')
    assert.ok(symRes.symbol.endLine >= symRes.symbol.startLine)

    const excerpt = engine.getSourceExcerpt(symbolId)
    assert.strictEqual(excerpt.success, true)
    assert.ok(excerpt.linesWithNumbers.includes('workspaceSchema'))
  })

  // Domain 10: Local Engine
  it('Domain 10 [Local Engine]: inspects LocalDb class, callers, and impact subgraph', () => {
    const symbolId = '@hisabche/local-engine/packages/local-engine/src/db.ts#LocalDb'
    const symRes = engine.getSymbol(symbolId)
    assert.strictEqual(symRes.found, true)
    assert.strictEqual(symRes.symbol.name, 'LocalDb')
    assert.strictEqual(symRes.symbol.kind, 'interface')
    assert.strictEqual(symRes.symbol.package, '@hisabche/local-engine')

    const impact = engine.getImpactSummary(symbolId, { depth: 1, limit: 10 })
    assert.strictEqual(impact.target, symbolId)
    assert.ok(Array.isArray(impact.directCallers))
    assert.ok(Array.isArray(impact.directCallees))
  })
})
