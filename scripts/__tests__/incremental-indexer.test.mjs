import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  IncrementalIndexer,
  computeSha256,
  computeConfigFingerprint,
  normalizePath,
} from '../lib/incremental-indexer.mjs'

describe('Incremental Indexer — Unit Test Suite', () => {
  let tempDir

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'inc-indexer-test-'))
  })

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      try {
        rmSync(tempDir, { recursive: true, force: true })
      } catch {}
    }
  })

  describe('1. Hashing & Config Fingerprinting', () => {
    it('computeSha256 normalizes CRLF and LF to identical hash', () => {
      const crlf = 'export function hello() {\r\n  return 1\r\n}\r\n'
      const lf = 'export function hello() {\n  return 1\n}\n'
      const hash1 = computeSha256(crlf)
      const hash2 = computeSha256(lf)
      assert.strictEqual(hash1, hash2)
      assert.strictEqual(hash1.length, 64)
    })

    it('computeConfigFingerprint returns deterministic 64-char hex hash', () => {
      const fp1 = computeConfigFingerprint()
      const fp2 = computeConfigFingerprint()
      assert.strictEqual(fp1, fp2)
      assert.strictEqual(typeof fp1, 'string')
      assert.strictEqual(fp1.length, 64)
    })

    it('normalizePath transforms backslashes to forward slashes', () => {
      assert.strictEqual(normalizePath('packages\\ui\\src\\index.ts'), 'packages/ui/src/index.ts')
      assert.strictEqual(normalizePath('backend/src/routes.ts'), 'backend/src/routes.ts')
    })
  })

  describe('2. Change Detection (Added, Modified, Deleted, Renamed)', () => {
    it('detects added files not present in cache', () => {
      const indexer = new IncrementalIndexer({ rootDir: tempDir })
      const cachedFingerprints = {
        'packages/foo/src/index.ts': { hash: 'hash1', size: 10, lines: 1 },
      }

      const pkgDir = join(tempDir, 'packages', 'foo', 'src')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, 'index.ts'), 'const a = 1\n')
      writeFileSync(join(pkgDir, 'new.ts'), 'const b = 2\n')

      const currentPackages = [{ name: '@hisabche/foo', path: 'packages/foo' }]
      const changes = indexer.detectChanges(cachedFingerprints, currentPackages)

      assert.deepStrictEqual(changes.added, ['packages/foo/src/new.ts'])
      assert.strictEqual(changes.deleted.length, 0)
    })

    it('detects modified files when sha256 differs', () => {
      const indexer = new IncrementalIndexer({ rootDir: tempDir })
      const oldContent = 'const a = 1\n'
      const oldHash = computeSha256(oldContent)
      const cachedFingerprints = {
        'packages/foo/src/index.ts': { hash: oldHash, size: oldContent.length, lines: 1 },
      }

      const pkgDir = join(tempDir, 'packages', 'foo', 'src')
      mkdirSync(pkgDir, { recursive: true })
      // Write modified content
      writeFileSync(join(pkgDir, 'index.ts'), 'const a = 2\n// updated\n')

      const currentPackages = [{ name: '@hisabche/foo', path: 'packages/foo' }]
      const changes = indexer.detectChanges(cachedFingerprints, currentPackages)

      assert.deepStrictEqual(changes.modified, ['packages/foo/src/index.ts'])
      assert.strictEqual(changes.added.length, 0)
      assert.strictEqual(changes.deleted.length, 0)
    })

    it('detects deleted files present in cache but absent on disk', () => {
      const indexer = new IncrementalIndexer({ rootDir: tempDir })
      const cachedFingerprints = {
        'packages/foo/src/index.ts': { hash: 'hash1', size: 10, lines: 1 },
        'packages/foo/src/deleted.ts': { hash: 'hash2', size: 10, lines: 1 },
      }

      const pkgDir = join(tempDir, 'packages', 'foo', 'src')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, 'index.ts'), 'const a = 1\n')

      const currentPackages = [{ name: '@hisabche/foo', path: 'packages/foo' }]
      const changes = indexer.detectChanges(cachedFingerprints, currentPackages)

      assert.deepStrictEqual(changes.deleted, ['packages/foo/src/deleted.ts'])
      assert.strictEqual(changes.added.length, 0)
    })

    it('detects renames when content hash of deleted matches added file', () => {
      const indexer = new IncrementalIndexer({ rootDir: tempDir })
      const content = 'export const SAME_CONTENT = 42\n'
      const hash = computeSha256(content)

      const cachedFingerprints = {
        'packages/foo/src/old-name.ts': { hash, size: content.length, lines: 1 },
      }

      const pkgDir = join(tempDir, 'packages', 'foo', 'src')
      mkdirSync(pkgDir, { recursive: true })
      // File has been moved/renamed to new-name.ts with identical content
      writeFileSync(join(pkgDir, 'new-name.ts'), content)

      const currentPackages = [{ name: '@hisabche/foo', path: 'packages/foo' }]
      const changes = indexer.detectChanges(cachedFingerprints, currentPackages)

      assert.strictEqual(changes.renames.length, 1)
      assert.strictEqual(changes.renames[0].from, 'packages/foo/src/old-name.ts')
      assert.strictEqual(changes.renames[0].to, 'packages/foo/src/new-name.ts')
      assert.strictEqual(changes.added.length, 0)
    })
  })

  describe('3. Invalidation Set Computation', () => {
    it('computes invalidation of directly changed and downstream importing files', () => {
      const indexer = new IncrementalIndexer({ rootDir: tempDir })
      const existingGraph = {
        files: {
          'packages/core/src/service.ts': {
            importedBy: ['packages/core/src/caller.ts', 'packages/api/src/hook.ts'],
          },
          'packages/core/src/caller.ts': {
            importedBy: [],
          },
          'packages/api/src/hook.ts': {
            importedBy: [],
          },
        },
        relationships: [
          {
            type: 'CALLS',
            sourceId: 'packages/core/src/caller.ts::fn',
            targetId: 'packages/core/src/service.ts::targetFn',
            file: 'packages/core/src/caller.ts',
          },
          {
            type: 'TESTS',
            sourceId: 'packages/core/src/service.test.ts::test1',
            targetId: 'packages/core/src/service.ts::targetFn',
            file: 'packages/core/src/service.test.ts',
          },
        ],
      }

      const changes = {
        added: [],
        modified: ['packages/core/src/service.ts'],
        deleted: [],
        renames: [],
      }

      const inv = indexer.computeInvalidationSet(changes, existingGraph)
      assert.strictEqual(inv.requiresFullRebuild, false)
      assert.ok(inv.directlyChanged.includes('packages/core/src/service.ts'))
      assert.ok(inv.dependentInvalidated.includes('packages/core/src/caller.ts'))
      assert.ok(inv.dependentInvalidated.includes('packages/api/src/hook.ts'))
      assert.ok(inv.affectedTestFiles.includes('packages/core/src/service.test.ts'))
    })

    it('requires full rebuild if existing graph is null or missing relationships', () => {
      const indexer = new IncrementalIndexer({ rootDir: tempDir })
      const changes = { added: ['file.ts'], modified: [], deleted: [], renames: [] }
      const inv = indexer.computeInvalidationSet(changes, null)
      assert.strictEqual(inv.requiresFullRebuild, true)
      assert.ok(inv.reason.includes('Missing existing graph'))
    })
  })

  describe('4. Atomic Publication and Safe Backup', () => {
    it('atomically publishes candidate graph and cache, backing up previous graph', () => {
      const aiDir = join(tempDir, '.ai')
      mkdirSync(aiDir, { recursive: true })
      const graphPath = join(aiDir, 'graph.json')
      const cachePath = join(aiDir, 'cache.json')
      const backupPath = join(aiDir, 'graph.json.bak')

      // Initial version
      writeFileSync(graphPath, JSON.stringify({ version: 1, symbols: [] }), 'utf8')
      writeFileSync(cachePath, JSON.stringify({ version: 1 }), 'utf8')

      const indexer = new IncrementalIndexer({
        rootDir: tempDir,
        aiDir,
        graphPath,
        cachePath,
        backupPath,
      })

      const candidateGraph = { version: 2, symbols: [{ id: 'sym1' }] }
      const candidateCache = { version: 2, fileFingerprints: {} }

      const result = indexer.atomicPublish(candidateGraph, candidateCache)
      assert.strictEqual(result.success, true)

      // Verify updated files
      const savedGraph = JSON.parse(readFileSync(graphPath, 'utf8'))
      assert.strictEqual(savedGraph.version, 2)
      assert.strictEqual(savedGraph.symbols[0].id, 'sym1')

      // Verify backup created with version 1
      assert.ok(existsSync(backupPath))
      const backupGraph = JSON.parse(readFileSync(backupPath, 'utf8'))
      assert.strictEqual(backupGraph.version, 1)
    })
  })

  describe('5. Incremental Update Execution & Dry Run', () => {
    it('returns NO_OP when all disk files match cached fingerprints', () => {
      const aiDir = join(tempDir, '.ai')
      mkdirSync(aiDir, { recursive: true })
      const graphPath = join(aiDir, 'graph.json')
      const cachePath = join(aiDir, 'cache.json')

      const configHash = computeConfigFingerprint(tempDir)
      const cachedCache = {
        indexerVersion: '2.0.0',
        configHash,
        fileFingerprints: {},
      }
      const existingGraph = {
        schemaVersion: 2,
        symbols: [],
        relationships: [],
        files: {},
      }

      writeFileSync(graphPath, JSON.stringify(existingGraph), 'utf8')
      writeFileSync(cachePath, JSON.stringify(cachedCache), 'utf8')

      const indexer = new IncrementalIndexer({
        rootDir: tempDir,
        aiDir,
        graphPath,
        cachePath,
      })

      const updateRes = indexer.update()
      assert.strictEqual(updateRes.mode, 'NO_OP')
      assert.strictEqual(updateRes.status, 'FRESH')
      assert.strictEqual(updateRes.stats.modified, 0)
    })

    it('supports dryRun: true without touching disk files', () => {
      const aiDir = join(tempDir, '.ai')
      mkdirSync(aiDir, { recursive: true })
      const graphPath = join(aiDir, 'graph.json')
      const cachePath = join(aiDir, 'cache.json')

      const configHash = computeConfigFingerprint(tempDir)
      const cachedCache = {
        indexerVersion: '2.0.0',
        configHash,
        fileFingerprints: {
          'packages/test/src/index.ts': { hash: 'old_hash', size: 10, lines: 1 },
        },
      }
      const existingGraph = {
        schemaVersion: 2,
        symbols: [],
        relationships: [],
        files: { 'packages/test/src/index.ts': { imports: [], importedBy: [] } },
      }

      writeFileSync(graphPath, JSON.stringify(existingGraph), 'utf8')
      writeFileSync(cachePath, JSON.stringify(cachedCache), 'utf8')

      // Put a modified file on disk
      const srcDir = join(tempDir, 'packages', 'test', 'src')
      mkdirSync(srcDir, { recursive: true })
      writeFileSync(
        join(tempDir, 'packages', 'test', 'package.json'),
        JSON.stringify({ name: '@hisabche/test' }),
      )
      writeFileSync(join(srcDir, 'index.ts'), 'export const NEW = 123\n')

      const indexer = new IncrementalIndexer({
        rootDir: tempDir,
        aiDir,
        graphPath,
        cachePath,
      })

      const dryRunRes = indexer.update({ dryRun: true })
      assert.strictEqual(dryRunRes.dryRun, true)
      assert.strictEqual(dryRunRes.mode, 'INCREMENTAL_UPDATE')
      assert.ok(dryRunRes.changes.modified.includes('packages/test/src/index.ts'))

      // Graph on disk should remain untouched
      const onDiskGraph = JSON.parse(readFileSync(graphPath, 'utf8'))
      assert.strictEqual(onDiskGraph.symbols.length, 0)
    })
  })

  describe('6. Semantic Equivalence Comparator', () => {
    it('compares identical graphs and returns equivalent: true', () => {
      const graphA = {
        symbols: {
          sym1: { id: 'sym1', signature: 'function fnA(): void' },
          sym2: { id: 'sym2', signature: 'function fnB(): string' },
        },
        relationships: [{ id: 'sym1->sym2', type: 'CALLS', sourceId: 'sym1', targetId: 'sym2' }],
        files: { 'fileA.ts': { symbols: ['sym1'] }, 'fileB.ts': { symbols: ['sym2'] } },
      }
      const graphB = {
        symbols: {
          sym2: { id: 'sym2', signature: 'function fnB(): string' },
          sym1: { id: 'sym1', signature: 'function fnA(): void' },
        },
        relationships: [{ id: 'sym1->sym2', type: 'CALLS', sourceId: 'sym1', targetId: 'sym2' }],
        files: { 'fileB.ts': { symbols: ['sym2'] }, 'fileA.ts': { symbols: ['sym1'] } },
      }

      const diff = IncrementalIndexer.compareSemanticEquivalence(graphA, graphB)
      assert.strictEqual(diff.equivalent, true)
      assert.strictEqual(diff.differences.length, 0)
    })

    it('detects missing symbols and mismatched relationships', () => {
      const graphA = {
        symbols: {
          sym1: { id: 'sym1', signature: 'function fnA(): void' },
        },
        relationships: [{ id: 'rel1', type: 'CALLS', sourceId: 'sym1', targetId: 'sym2' }],
        files: { 'fileA.ts': { symbols: ['sym1'] } },
      }
      const graphB = {
        symbols: {
          sym1: { id: 'sym1', signature: 'function fnA(): void' },
          symX: { id: 'symX', signature: 'function fnX(): number' },
        },
        relationships: [],
        files: { 'fileA.ts': { symbols: ['sym1'] } },
      }

      const diff = IncrementalIndexer.compareSemanticEquivalence(graphA, graphB)
      assert.strictEqual(diff.equivalent, false)
      assert.ok(diff.differences.some((d) => d.includes('Symbol count mismatch')))
      assert.ok(diff.differences.some((d) => d.includes('Relationship count mismatch')))
    })
  })
})
