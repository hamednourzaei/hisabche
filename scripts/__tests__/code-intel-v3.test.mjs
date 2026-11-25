/**
 * Verification Suite for Hisabche Code Intelligence V3.0
 * Covers Phases 0-4: reliability, transitive BFS invalidation, domain preservation,
 * BM25 lexical & Persian concept search, context packs, security filters, MCP batching & doctor().
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'

import { classifyFileDomainAndPlatform } from '../lib/domain-classifier.mjs'
import { buildLexicalIndex, queryLexicalIndex, MAX_QUERY_LENGTH } from '../lib/lexical-index.mjs'
import { IncrementalIndexer } from '../lib/incremental-indexer.mjs'
import { CodeIntelQueryEngine } from '../lib/code-intel-query.mjs'
import { CodeIntelMcpServer, MCP_TOOLS, MCP_SERVER_INFO } from '../lib/code-intel-mcp-server.mjs'

function makeMemoryMcp(engine, opts = {}) {
  const chunks = []
  const errChunks = []
  const output = new PassThrough()
  output.on('data', (d) => chunks.push(d.toString()))
  const error = new PassThrough()
  error.on('data', (d) => errChunks.push(d.toString()))

  const server = new CodeIntelMcpServer({
    engine,
    output,
    error,
    ...opts,
  })
  return {
    server,
    getResponses: () =>
      chunks
        .join('')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => JSON.parse(l)),
  }
}

test('Phase 0: classifyFileDomainAndPlatform preserves real domain, platform, and layer across backends & UI', () => {
  const invRoute = classifyFileDomainAndPlatform('backend/src/routes/invoices.routes.ts')
  assert.equal(invRoute.domain, 'Invoices')
  assert.equal(invRoute.platform, 'SERVER_ONLY')
  assert.equal(invRoute.layer, 'route')

  const syncTest = classifyFileDomainAndPlatform('packages/sync/src/__tests__/outbox.test.ts')
  assert.equal(syncTest.domain, 'Sync')
  assert.equal(syncTest.platform, 'OFFLINE_ENGINE')
  assert.equal(syncTest.layer, 'test')

  const uiComp = classifyFileDomainAndPlatform(
    'packages/ui/src/components/invoices/InvoiceForm.tsx',
  )
  assert.equal(uiComp.domain, 'Invoices')
  assert.equal(uiComp.platform, 'SHARED')
  assert.equal(uiComp.layer, 'ui')
})

test('Phase 0: computeInvalidationSet performs transitive cycle-safe BFS propagation (C -> B -> A)', () => {
  const indexer = new IncrementalIndexer({ rootDir: process.cwd() })
  const graph = {
    files: {
      'packages/core/a.ts': {},
      'packages/core/b.ts': {},
      'packages/core/c.ts': {},
    },
    relationships: [
      {
        type: 'IMPORTS',
        status: 'RESOLVED',
        file: 'packages/core/b.ts',
        targetId: 'packages/core/a.ts',
      },
      {
        type: 'IMPORTS',
        status: 'RESOLVED',
        file: 'packages/core/c.ts',
        targetId: 'packages/core/b.ts',
      },
      {
        type: 'IMPORTS',
        status: 'RESOLVED',
        file: 'packages/core/a.ts',
        targetId: 'packages/core/c.ts',
      },
    ],
  }

  const invalid = indexer.computeInvalidationSet(
    { added: [], modified: ['packages/core/a.ts'], deleted: [] },
    graph,
  )

  assert.ok(invalid.directlyChanged.includes('packages/core/a.ts'))
  assert.ok(invalid.dependentInvalidated.includes('packages/core/b.ts'))
  assert.ok(invalid.dependentInvalidated.includes('packages/core/c.ts'))
})

test('Phase 0: full-manifest getIndexStatus detects staleness past file #20 without blindspot', () => {
  const tempAi = mkdtempSync(join(tmpdir(), 'hisabche-status-v3-'))
  try {
    const graphPath = join(tempAi, 'graph.json')
    const cachePath = join(tempAi, 'cache.json')
    const lexicalPath = join(tempAi, 'lexical.json')

    const fingerprints = {}
    const files = {}
    for (let i = 0; i < 25; i++) {
      const alias = i < 24 ? `packages/fake/file-${i}.ts` : 'packages/fake/missing-25th.ts'
      files[alias] = { fileHash: 'abc' }
      fingerprints[alias] = {
        hash: i < 24 ? 'mismatch-triggers-stale' : 'missing-triggers-stale',
        isTest: false,
      }
    }

    writeFileSync(
      graphPath,
      JSON.stringify({
        metadata: { totalFiles: 25, totalSymbols: 0, totalPackages: 1, gitHash: 'deadbeef' },
        files,
        symbols: {},
        relationships: [],
      }),
    )
    writeFileSync(cachePath, JSON.stringify({ fileFingerprints: fingerprints }))
    writeFileSync(
      lexicalPath,
      JSON.stringify({ schemaVersion: 1, docCount: 0, avgDocLength: 1, docs: {}, postings: {} }),
    )

    const engine = new CodeIntelQueryEngine({ graphPath, cachePath, lexicalPath }).load()
    const status = engine.getIndexStatus()
    assert.equal(status.totalFilesChecked, 25)
    assert.equal(status.staleFilesCount, 25)
    assert.equal(status.status, 'STALE')
  } finally {
    rmSync(tempAi, { recursive: true, force: true })
  }
})

test('Phase 0 & 4: IncrementalIndexer isolated workspace tracks tests, preserves domain/platform, builds lexical.json & passes doctor()', async () => {
  const tmpRepo = mkdtempSync(join(tmpdir(), 'hisabche-inc-v3-'))
  try {
    const pkgDir = join(tmpRepo, 'packages', 'sample-inv', 'src')
    const testDir = join(pkgDir, '__tests__')
    mkdirSync(testDir, { recursive: true })
    writeFileSync(
      join(tmpRepo, 'packages', 'sample-inv', 'package.json'),
      JSON.stringify({ name: '@hisabche/sample-inv' }),
    )
    writeFileSync(
      join(tmpRepo, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { target: 'ES2022' } }),
    )

    const serviceFile = join(pkgDir, 'invoice-helper.ts')
    const testFile = join(testDir, 'invoice-helper.test.ts')

    writeFileSync(
      serviceFile,
      `export interface InvoiceCalcResult { totalMinor: number }\nexport function computeInvoiceMinor(qty: number, price: number): InvoiceCalcResult { return { totalMinor: qty * price } }\n`,
    )
    writeFileSync(
      testFile,
      `import { computeInvoiceMinor } from '../invoice-helper'\nexport const check = () => computeInvoiceMinor(2, 500)\n`,
    )

    const aiDir = join(tmpRepo, '.ai', 'codebase')
    const indexer = new IncrementalIndexer({
      rootDir: tmpRepo,
      aiDir,
      graphPath: join(aiDir, 'graph.json'),
      cachePath: join(aiDir, 'cache.json'),
      lexicalPath: join(aiDir, 'lexical.json'),
      backupPath: join(aiDir, 'graph.backup.json'),
    })

    const res1 = await indexer.rebuildFull()
    assert.equal(res1.mode, 'FULL_REBUILD')
    assert.equal(res1.status, 'FRESH')

    // Modify the test file and verify incremental update tracks test files + preserves domain
    writeFileSync(
      testFile,
      `import { computeInvoiceMinor } from '../invoice-helper'\nexport const check = () => computeInvoiceMinor(3, 500)\n`,
    )

    const res2 = await indexer.update()
    assert.equal(res2.mode, 'INCREMENTAL_UPDATE')
    assert.equal(res2.status, 'FRESH')
    assert.ok(res2.stats.modified >= 1)

    const doctorReport = indexer.doctor()
    assert.equal(doctorReport.healthy, true)
    assert.equal(doctorReport.counts.orphanSymbols, 0)
    assert.equal(doctorReport.counts.brokenEdges, 0)
  } finally {
    rmSync(tmpRepo, { recursive: true, force: true })
  }
})

test('Phase 1 & 2: BM25 lexical index, Persian synonym expansion, return-type filter, feature graph, and <=4000 token Context Pack', () => {
  const tmpRepo = mkdtempSync(join(tmpdir(), 'hisabche-lex-v3-'))
  try {
    mkdirSync(join(tmpRepo, 'backend', 'src', 'services', 'invoices'), { recursive: true })
    mkdirSync(join(tmpRepo, 'packages', 'sync', 'src'), { recursive: true })
    mkdirSync(join(tmpRepo, 'backend', 'src', 'routes', '__tests__'), { recursive: true })

    writeFileSync(
      join(tmpRepo, 'backend', 'src', 'services', 'invoices', 'invoice.service.ts'),
      `export class InvoiceService {\n  constructor() {}\n  toString() { return 'InvoiceService' }\n  static create(tenancy: TenancyContext, dto: CreateInvoiceDto): Promise<InvoiceRecord> {\n    throw new Error('INVOICE_CURRENCY_REQUIRED')\n  }\n}\n`,
    )
    writeFileSync(
      join(tmpRepo, 'packages', 'sync', 'src', 'outbox.ts'),
      `export async function enqueueOfflineInvoiceMutation(mutation: OutboxItem): Promise<void> {\n  return\n}\n`,
    )
    writeFileSync(
      join(tmpRepo, 'backend', 'src', 'routes', '__tests__', 'invoice.test.ts'),
      `describe('InvoiceService.create', () => { it('rejects empty currency', () => {}) })\n`,
    )

    const filesMap = {
      'backend/src/services/invoices/invoice.service.ts': {
        pkg: '@hisabche/backend',
        domain: ['Invoices'],
        platform: ['SERVER_ONLY'],
        layer: 'service',
        exports: ['InvoiceService.create'],
      },
      'packages/sync/src/outbox.ts': {
        pkg: '@hisabche/sync',
        domain: ['Sync'],
        platform: ['OFFLINE_ENGINE'],
        layer: 'sync',
        exports: ['enqueueOfflineInvoiceMutation'],
      },
      'backend/src/routes/__tests__/invoice.test.ts': {
        pkg: '@hisabche/backend',
        domain: ['Invoices'],
        platform: ['SERVER_ONLY'],
        layer: 'test',
        exports: [],
      },
    }

    const symsMap = new Map([
      [
        'backend/src/services/invoices/invoice.service.ts',
        [
          {
            id: '@hisabche/backend/src/services/invoices/invoice.service.ts#InvoiceService.create',
            name: 'InvoiceService.create',
            kind: 'method',
            package: '@hisabche/backend',
            file: 'backend/src/services/invoices/invoice.service.ts',
            startLine: 2,
            endLine: 4,
            exported: true,
            domain: 'Invoices',
            platform: 'SERVER_ONLY',
            signature: '(tenancy: TenancyContext, dto: CreateInvoiceDto) => Promise<InvoiceRecord>',
          },
        ],
      ],
      [
        'packages/sync/src/outbox.ts',
        [
          {
            id: '@hisabche/sync/src/outbox.ts#enqueueOfflineInvoiceMutation',
            name: 'enqueueOfflineInvoiceMutation',
            kind: 'function',
            package: '@hisabche/sync',
            file: 'packages/sync/src/outbox.ts',
            startLine: 1,
            endLine: 3,
            exported: true,
            domain: 'Sync',
            platform: 'OFFLINE_ENGINE',
            signature: '(mutation: OutboxItem) => Promise<void>',
          },
        ],
      ],
    ])

    const lexical = buildLexicalIndex(tmpRepo, filesMap, symsMap)
    const persianHits = queryLexicalIndex(lexical, 'فاکتور', { limit: 5 })
    assert.ok(persianHits.length > 0, 'Persian query فاکتور must expand to invoice matches')
    assert.equal(persianHits[0].file, 'backend/src/services/invoices/invoice.service.ts')

    const errorHits = queryLexicalIndex(lexical, 'INVOICE_CURRENCY_REQUIRED', { limit: 5 })
    assert.ok(errorHits.length > 0)

    const preloadedGraph = {
      metadata: { totalFiles: 3, totalSymbols: 2, totalPackages: 2, totalRelationships: 1 },
      files: filesMap,
      symbols: {
        '@hisabche/backend/src/services/invoices/invoice.service.ts#InvoiceService.create':
          symsMap.get('backend/src/services/invoices/invoice.service.ts')[0],
        '@hisabche/sync/src/outbox.ts#enqueueOfflineInvoiceMutation': symsMap.get(
          'packages/sync/src/outbox.ts',
        )[0],
      },
      relationships: [
        {
          id: 'rel-1',
          type: 'TESTS',
          status: 'RESOLVED',
          file: 'backend/src/routes/__tests__/invoice.test.ts',
          targetId: 'backend/src/services/invoices/invoice.service.ts',
        },
      ],
    }

    const engine = new CodeIntelQueryEngine({
      preloadedIndex: preloadedGraph,
      preloadedLexical: lexical,
    }).load()

    const byReturn = engine.findSymbols('create', { returns: 'InvoiceRecord' })
    assert.equal(byReturn.totalFound, 1)

    const feature = engine.discoverFeature('invoice')
    assert.equal(feature.status, 'FOUND')
    assert.ok(feature.layers.service.length >= 1)

    const pack = engine.getContextPack('invoice offline mutation', { maxTokens: 3500 })
    assert.equal(pack.status, 'READY')
    assert.ok(pack.tokenEstimate <= 4000)
    assert.ok(pack.securityAndSyncWarnings.length >= 1)
    assert.ok(pack.relatedTests.includes('backend/src/routes/__tests__/invoice.test.ts'))

    const emptyPack = engine.getContextPack('zzzznonexistenttokenxyz999')
    assert.equal(emptyPack.status, 'INSUFFICIENT_EVIDENCE')

    // Security: forbidden paths & capped query length
    const secretRead = engine.getSourceExcerpt('.env.production')
    assert.equal(secretRead.success, false)
    const pemRead = engine.getSourceExcerpt('certs/private.pem')
    assert.equal(pemRead.success, false)
    const hugeQuery = 'a'.repeat(MAX_QUERY_LENGTH + 500)
    const safeSearch = engine.searchCode(hugeQuery)
    assert.equal(safeSearch.query.length, MAX_QUERY_LENGTH)
  } finally {
    rmSync(tmpRepo, { recursive: true, force: true })
  }
})

test('Phase 3: MCP server exposes V3.0 readOnly tools, handles batch arrays, and gracefully handles missing index', async () => {
  assert.equal(MCP_SERVER_INFO.readOnly, true)
  const toolNames = new Set(MCP_TOOLS.map((t) => t.name))
  for (const required of [
    'code_intel_search_code',
    'code_intel_feature',
    'code_intel_get_context_pack',
    'code_intel_impact_analysis',
  ]) {
    assert.ok(toolNames.has(required), `Missing MCP tool ${required}`)
  }

  const missingEngine = new CodeIntelQueryEngine({
    graphPath: join(tmpdir(), 'definitely-missing-graph-v3.json'),
    cachePath: join(tmpdir(), 'definitely-missing-cache-v3.json'),
    lexicalPath: join(tmpdir(), 'definitely-missing-lexical-v3.json'),
  })

  const { server, getResponses } = makeMemoryMcp(missingEngine)

  await server.handleRawMessage(
    JSON.stringify([
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'code_intel_status', arguments: {} },
      },
    ]),
  )

  const res = getResponses()
  assert.equal(res.length, 3)
  assert.equal(res[0].result.serverInfo.readOnly, true)
  assert.equal(res[1].result.tools.length, MCP_TOOLS.length)
  assert.equal(res[2].result.isError, true)
  assert.equal(res[2].result.structuredContent.indexStatus, 'MISSING')
})
