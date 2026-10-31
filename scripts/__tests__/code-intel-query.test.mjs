import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { CodeIntelQueryEngine } from '../lib/code-intel-query.mjs'

describe('Code Intelligence Query Engine — Unit Test Suite', () => {
  let mockEngine
  let realEngine

  before(async () => {
    // 1. Synthetic engine for isolated deterministic unit tests
    const mockIndex = {
      metadata: {
        schemaVersion: 2,
        gitHash: 'fake-commit-hash',
        timestamp: new Date().toISOString(),
        totalFiles: 4,
        totalSymbols: 4,
        totalPackages: 3,
        astStats: { resolved: 4, partiallyResolved: 0, unresolved: 0 },
        relationshipStats: {
          total: 5,
          byType: { CALLS: 3, IMPORTS: 1, TESTS: 1 },
          resolved: 5,
          unresolved: 0,
          external: 0,
          ambiguous: 0,
          fileCycles: 0,
          packageCycles: 0,
        },
      },
      packages: {
        '@hisabche/local-engine': 'packages/local-engine',
        '@hisabche/backend': 'backend',
        '@hisabche/validation': 'packages/validation',
      },
      files: {
        'packages/local-engine/src/invoices.ts': {
          file: 'packages/local-engine/src/invoices.ts',
          pkg: '@hisabche/local-engine',
          fileHash: 'hash-invoices',
          lineCount: 100,
          symbols: ['packages/local-engine/src/invoices.ts:createInvoice:10'],
        },
        'packages/local-engine/src/payments.ts': {
          file: 'packages/local-engine/src/payments.ts',
          pkg: '@hisabche/local-engine',
          fileHash: 'hash-payments',
          lineCount: 80,
          symbols: ['packages/local-engine/src/payments.ts:createPayment:15'],
        },
        'backend/src/services/invoice-service.ts': {
          file: 'backend/src/services/invoice-service.ts',
          pkg: '@hisabche/backend',
          fileHash: 'hash-backend-invoice',
          lineCount: 120,
          symbols: ['backend/src/services/invoice-service.ts:processInvoice:20'],
        },
        'packages/local-engine/src/__tests__/invoices.test.ts': {
          file: 'packages/local-engine/src/__tests__/invoices.test.ts',
          pkg: '@hisabche/local-engine',
          fileHash: 'hash-invoices-test',
          lineCount: 50,
          symbols: [],
        },
      },
      symbols: [
        {
          id: 'packages/local-engine/src/invoices.ts:createInvoice:10',
          name: 'createInvoice',
          kind: 'function',
          file: 'packages/local-engine/src/invoices.ts',
          package: '@hisabche/local-engine',
          exported: true,
          startLine: 10,
          endLine: 45,
          signature: 'export function createInvoice(data: InvoiceInput): Promise<InvoiceRow>',
          doc: 'Creates an invoice in local SQLite storage',
          sourceHash: 'hash-ci',
          confidence: 'HIGH',
        },
        {
          id: 'backend/src/services/invoice-service.ts:createInvoice:35',
          name: 'createInvoice',
          kind: 'function',
          file: 'backend/src/services/invoice-service.ts',
          package: '@hisabche/backend',
          exported: true,
          startLine: 35,
          endLine: 70,
          signature:
            'export async function createInvoice(ctx: TenancyContext, input: CreateInvoiceDto): Promise<Invoice>',
          doc: 'Creates an invoice in PostgreSQL via Supabase',
          sourceHash: 'hash-ci-backend',
          confidence: 'HIGH',
        },
        {
          id: 'packages/local-engine/src/payments.ts:createPayment:15',
          name: 'createPayment',
          kind: 'function',
          file: 'packages/local-engine/src/payments.ts',
          package: '@hisabche/local-engine',
          exported: true,
          startLine: 15,
          endLine: 40,
          signature: 'export function createPayment(input: PaymentInput): Promise<PaymentRow>',
          doc: 'Creates a payment row',
          sourceHash: 'hash-cp',
          confidence: 'HIGH',
        },
        {
          id: 'backend/src/services/invoice-service.ts:processInvoice:20',
          name: 'processInvoice',
          kind: 'function',
          file: 'backend/src/services/invoice-service.ts',
          package: '@hisabche/backend',
          exported: false,
          startLine: 20,
          endLine: 30,
          signature: 'function processInvoice(id: string): void',
          doc: 'Internal helper',
          sourceHash: 'hash-pi',
          confidence: 'HIGH',
        },
      ],
      relationships: [
        {
          id: 'rel-1',
          type: 'CALLS',
          sourceId: 'backend/src/services/invoice-service.ts:processInvoice:20',
          targetId: 'packages/local-engine/src/invoices.ts:createInvoice:10',
          file: 'backend/src/services/invoice-service.ts',
          startLine: 25,
          status: 'RESOLVED',
          evidence: 'AST_CALL',
        },
        {
          id: 'rel-2',
          type: 'IMPORTS',
          file: 'backend/src/services/invoice-service.ts',
          targetId: 'packages/local-engine/src/invoices.ts',
          startLine: 2,
          status: 'RESOLVED',
          evidence: 'IMPORT_STATEMENT',
        },
        {
          id: 'rel-3',
          type: 'CALLS',
          sourceId: 'packages/local-engine/src/payments.ts:createPayment:15',
          targetId: 'packages/local-engine/src/invoices.ts:createInvoice:10',
          file: 'packages/local-engine/src/payments.ts',
          startLine: 22,
          status: 'RESOLVED',
          evidence: 'AST_CALL',
        },
        {
          id: 'rel-4',
          type: 'CALLS',
          sourceId: 'packages/local-engine/src/invoices.ts:createInvoice:10',
          targetId: 'packages/local-engine/src/payments.ts:createPayment:15',
          file: 'packages/local-engine/src/invoices.ts',
          startLine: 30,
          status: 'RESOLVED',
          evidence: 'AST_CALL',
        },
        {
          id: 'rel-5',
          type: 'TESTS',
          file: 'packages/local-engine/src/__tests__/invoices.test.ts',
          startLine: 12,
          targetId: 'packages/local-engine/src/invoices.ts:createInvoice:10',
          status: 'RESOLVED',
          evidence: 'TEST_FILE_STRUCTURE',
        },
      ],
    }

    mockEngine = new CodeIntelQueryEngine({ preloadedIndex: mockIndex })
    mockEngine.load()

    // 2. Real engine loading canonical graph.json
    realEngine = new CodeIntelQueryEngine()
    realEngine.load()
  })

  describe('findSymbols', () => {
    it('finds symbols by exact name and returns disambiguation candidates', () => {
      const { results } = mockEngine.findSymbols('createInvoice', { exact: true })
      assert.strictEqual(results.length, 2)
      assert.strictEqual(results[0].name, 'createInvoice')
      assert.strictEqual(results[1].name, 'createInvoice')
      const pkgs = results.map((r) => r.package).sort()
      assert.deepStrictEqual(pkgs, ['@hisabche/backend', '@hisabche/local-engine'])
    })

    it('filters symbols by package', () => {
      const { results } = mockEngine.findSymbols('createInvoice', { pkg: '@hisabche/backend' })
      assert.strictEqual(results.length, 1)
      assert.strictEqual(results[0].package, '@hisabche/backend')
      assert.strictEqual(results[0].id, 'backend/src/services/invoice-service.ts:createInvoice:35')
    })

    it('filters symbols by kind', () => {
      const { results } = mockEngine.findSymbols('createInvoice', { kind: 'function' })
      assert.strictEqual(results.length, 2)
    })

    it('filters symbols by exported status', () => {
      const unexported = mockEngine.findSymbols('processInvoice', { exported: false })
      assert.strictEqual(unexported.results.length, 1)
      assert.strictEqual(unexported.results[0].exported, false)

      const exported = mockEngine.findSymbols('processInvoice', { exported: true })
      assert.strictEqual(exported.results.length, 0)
    })

    it('supports fuzzy substring search', () => {
      const { results } = mockEngine.findSymbols('Invoice', { exact: false })
      assert.strictEqual(results.length, 3) // 2 createInvoice + 1 processInvoice
    })
  })

  describe('getSymbol', () => {
    it('retrieves exact symbol by symbolId', () => {
      const res = mockEngine.getSymbol('packages/local-engine/src/invoices.ts:createInvoice:10')
      assert.strictEqual(res.found, true)
      assert.strictEqual(res.ambiguous, false)
      assert.strictEqual(res.symbol.name, 'createInvoice')
    })

    it('retrieves symbol by exact name if unambiguous', () => {
      const res = mockEngine.getSymbol('createPayment')
      assert.strictEqual(res.found, true)
      assert.strictEqual(res.ambiguous, false)
      assert.strictEqual(res.symbol.name, 'createPayment')
    })

    it('returns AMBIGUOUS status when multiple declarations exist', () => {
      const res = mockEngine.getSymbol('createInvoice')
      assert.strictEqual(res.found, true)
      assert.strictEqual(res.ambiguous, true)
      assert.strictEqual(res.allMatches.length, 2)
    })

    it('returns NOT_FOUND status for non-existent symbol', () => {
      const res = mockEngine.getSymbol('nonExistentFunctionXYZ')
      assert.strictEqual(res.found, false)
      assert.strictEqual(res.symbol, null)
    })
  })

  describe('getCallers and getCallees', () => {
    it('finds callers of a symbol', () => {
      const { callers } = mockEngine.getCallers(
        'packages/local-engine/src/invoices.ts:createInvoice:10',
      )
      assert.strictEqual(callers.length, 2)
      const callerIds = callers.map((c) => c.callerSymbolId).sort()
      assert.deepStrictEqual(callerIds, [
        'backend/src/services/invoice-service.ts:processInvoice:20',
        'packages/local-engine/src/payments.ts:createPayment:15',
      ])
    })

    it('finds callees called by a symbol', () => {
      const { callees } = mockEngine.getCallees(
        'packages/local-engine/src/invoices.ts:createInvoice:10',
      )
      assert.strictEqual(callees.length, 1)
      assert.strictEqual(
        callees[0].targetSymbolId,
        'packages/local-engine/src/payments.ts:createPayment:15',
      )
    })

    it('filters callers by verifiedOnly', () => {
      const { callers } = mockEngine.getCallers(
        'packages/local-engine/src/invoices.ts:createInvoice:10',
        { verifiedOnly: true },
      )
      assert.strictEqual(callers.length, 2)
    })
  })

  describe('getImports and getRelatedTests', () => {
    it('finds imports for a file', () => {
      const { imports } = mockEngine.getImports('backend/src/services/invoice-service.ts')
      assert.strictEqual(imports.length, 1)
      assert.strictEqual(imports[0].resolvedTarget, 'packages/local-engine/src/invoices.ts')
    })

    it('finds related tests for a symbol', () => {
      const { tests } = mockEngine.getRelatedTests(
        'packages/local-engine/src/invoices.ts:createInvoice:10',
      )
      assert.strictEqual(tests.length, 1)
      assert.strictEqual(tests[0].testFile, 'packages/local-engine/src/__tests__/invoices.test.ts')
      assert.strictEqual(tests[0].evidence, 'TEST_FILE_STRUCTURE')
    })
  })

  describe('getFile', () => {
    it('returns file metadata, declared symbols, imports, and inbound dependencies', () => {
      const fileData = mockEngine.getFile('packages/local-engine/src/invoices.ts')
      assert.ok(fileData)
      assert.strictEqual(fileData.file, 'packages/local-engine/src/invoices.ts')
      assert.strictEqual(fileData.symbols.length, 1)
      assert.strictEqual(fileData.directDependents.length, 1)
      assert.strictEqual(fileData.directDependents[0], 'backend/src/services/invoice-service.ts')
    })
  })

  describe('getImpactSummary', () => {
    it('traverses downstream and upstream impact within bounded depth and handles dependencies', () => {
      const impact = mockEngine.getImpactSummary(
        'packages/local-engine/src/invoices.ts:createInvoice:10',
        {
          depth: 2,
          limit: 10,
        },
      )

      assert.strictEqual(impact.target, 'packages/local-engine/src/invoices.ts:createInvoice:10')
      assert.strictEqual(impact.directCallers.length, 2)
      assert.strictEqual(impact.directCallees.length, 1)
      assert.strictEqual(impact.relatedTests.length, 1)
    })
  })

  describe('getSourceExcerpt security & stale checks', () => {
    it('rejects path traversal escaping workspace root', () => {
      const res = mockEngine.getSourceExcerpt('../../outside.txt')
      assert.strictEqual(res.success, false)
      assert.ok(res.error.includes('Path traversal'))
    })

    it('rejects attempts to read .env files', () => {
      const res = mockEngine.getSourceExcerpt('.env')
      assert.strictEqual(res.success, false)
      assert.ok(res.error.includes('forbidden'))
    })

    it('reads real file excerpts cleanly from disk with line numbers', () => {
      const res = realEngine.getSourceExcerpt('package.json', {
        startLine: 1,
        endLine: 5,
        contextLines: 0,
      })
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.file, 'package.json')
      assert.ok(res.excerpt.includes('"name": "hisabche"'))
    })
  })

  describe('getIndexStatus', () => {
    it('returns index status report with valid schema and counts', () => {
      const status = realEngine.getIndexStatus()
      assert.strictEqual(status.schemaVersion, 2)
      assert.ok(status.totalFiles > 1000)
      assert.ok(status.totalSymbols > 10000)
      assert.ok(status.relationshipStats.total > 50000)
      assert.strictEqual(status.gitMatch, true)
    })
  })
})
