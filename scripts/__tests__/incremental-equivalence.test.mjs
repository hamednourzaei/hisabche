import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { IncrementalIndexer } from '../lib/incremental-indexer.mjs'

describe('Code Intelligence — Full-Rebuild Semantic Equivalence Test Suite', () => {
  let tempDir
  let aiDir
  let graphPath
  let cachePath
  let backupPath

  function setupFixture(dir) {
    // Monorepo root config files
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'test-monorepo',
        version: '1.0.0',
        workspaces: ['packages/*'],
      }),
    )

    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
        },
      }),
    )

    // Package: @test/core
    const corePkg = join(dir, 'packages', 'core')
    const coreSrc = join(corePkg, 'src')
    mkdirSync(coreSrc, { recursive: true })

    writeFileSync(
      join(corePkg, 'package.json'),
      JSON.stringify({
        name: '@test/core',
        version: '1.0.0',
        main: './src/index.ts',
      }),
    )

    writeFileSync(
      join(coreSrc, 'math.ts'),
      `export function add(a: number, b: number): number {\n  return a + b\n}\n`,
    )

    writeFileSync(
      join(coreSrc, 'calculator.ts'),
      `import { add } from './math'\n\nexport function compute(val: number): number {\n  return add(val, 10)\n}\n`,
    )

    writeFileSync(
      join(coreSrc, 'calculator.test.ts'),
      `import { compute } from './calculator'\n\nexport function testCalc(): void {\n  const res = compute(5)\n}\n`,
    )
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'inc-equiv-test-'))
    setupFixture(tempDir)
    aiDir = join(tempDir, '.ai', 'codebase')
    mkdirSync(aiDir, { recursive: true })
    graphPath = join(aiDir, 'graph.json')
    cachePath = join(aiDir, 'cache.json')
    backupPath = join(aiDir, 'graph.json.bak')
  })

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      try {
        rmSync(tempDir, { recursive: true, force: true })
      } catch {}
    }
  })

  it('Scenario 1: Baseline full rebuild produces valid graph and cache', () => {
    const indexer = new IncrementalIndexer({
      rootDir: tempDir,
      aiDir,
      graphPath,
      cachePath,
      backupPath,
    })

    const buildRes = indexer.rebuildFull({ reason: 'Initial build' })
    assert.strictEqual(buildRes.mode, 'FULL_REBUILD')
    assert.strictEqual(buildRes.status, 'FRESH')
    assert.ok(existsSync(graphPath))
    assert.ok(existsSync(cachePath))

    const graph = JSON.parse(readFileSync(graphPath, 'utf8'))
    const cache = JSON.parse(readFileSync(cachePath, 'utf8'))

    assert.ok(Object.keys(graph.symbols).length >= 3)
    assert.ok(graph.relationships.length >= 2)
    assert.ok(Object.keys(cache.fileFingerprints).length >= 3)
  })

  it('Scenario 2: Modification produces identical semantics to full rebuild', () => {
    const indexer = new IncrementalIndexer({
      rootDir: tempDir,
      aiDir,
      graphPath,
      cachePath,
      backupPath,
    })

    // 1. Initial full build
    indexer.rebuildFull({ reason: 'Initial build' })

    // 2. Modify math.ts (change signature and logic)
    const mathPath = join(tempDir, 'packages', 'core', 'src', 'math.ts')
    writeFileSync(
      mathPath,
      `export function add(a: number, b: number, factor: number = 1): number {\n  return (a + b) * factor\n}\n`,
    )

    // 3. Incremental update
    const incRes = indexer.update()
    assert.strictEqual(incRes.mode, 'INCREMENTAL_UPDATE')
    assert.ok(incRes.changes.modified.includes('packages/core/src/math.ts'))
    const incGraph = JSON.parse(readFileSync(graphPath, 'utf8'))

    // 4. Clean full rebuild
    const fullRes = indexer.rebuildFull({ reason: 'Verification full rebuild' })
    assert.strictEqual(fullRes.mode, 'FULL_REBUILD')
    const fullGraph = JSON.parse(readFileSync(graphPath, 'utf8'))

    // 5. Compare semantic equivalence
    const cmp = IncrementalIndexer.compareSemanticEquivalence(incGraph, fullGraph)
    assert.strictEqual(
      cmp.equivalent,
      true,
      `Expected equivalence but got differences: ${JSON.stringify(cmp.differences)}`,
    )
  })

  it('Scenario 3: Adding a new file produces identical semantics to full rebuild', () => {
    const indexer = new IncrementalIndexer({
      rootDir: tempDir,
      aiDir,
      graphPath,
      cachePath,
      backupPath,
    })

    // 1. Initial build
    indexer.rebuildFull({ reason: 'Initial build' })

    // 2. Add a new file
    const extraPath = join(tempDir, 'packages', 'core', 'src', 'extra.ts')
    writeFileSync(
      extraPath,
      `export function multiply(a: number, b: number): number {\n  return a * b\n}\n`,
    )

    // 3. Incremental update
    const incRes = indexer.update()
    assert.strictEqual(incRes.mode, 'INCREMENTAL_UPDATE')
    assert.ok(incRes.changes.added.includes('packages/core/src/extra.ts'))
    const incGraph = JSON.parse(readFileSync(graphPath, 'utf8'))

    // 4. Clean full rebuild
    indexer.rebuildFull({ reason: 'Verification full rebuild' })
    const fullGraph = JSON.parse(readFileSync(graphPath, 'utf8'))

    // 5. Assert equivalence
    const cmp = IncrementalIndexer.compareSemanticEquivalence(incGraph, fullGraph)
    assert.strictEqual(cmp.equivalent, true, `Differences: ${JSON.stringify(cmp.differences)}`)
  })

  it('Scenario 4: Deleting a file produces identical semantics to full rebuild', () => {
    const indexer = new IncrementalIndexer({
      rootDir: tempDir,
      aiDir,
      graphPath,
      cachePath,
      backupPath,
    })

    // Setup an additional file before initial build
    const extraPath = join(tempDir, 'packages', 'core', 'src', 'to-delete.ts')
    writeFileSync(extraPath, `export function helper(): string {\n  return 'temp'\n}\n`)

    // 1. Initial build
    indexer.rebuildFull({ reason: 'Initial build' })

    // 2. Delete the file
    rmSync(extraPath)

    // 3. Incremental update
    const incRes = indexer.update()
    assert.strictEqual(incRes.mode, 'INCREMENTAL_UPDATE')
    assert.ok(incRes.changes.deleted.includes('packages/core/src/to-delete.ts'))
    const incGraph = JSON.parse(readFileSync(graphPath, 'utf8'))

    // 4. Full rebuild
    indexer.rebuildFull({ reason: 'Verification full rebuild' })
    const fullGraph = JSON.parse(readFileSync(graphPath, 'utf8'))

    // 5. Assert equivalence
    const cmp = IncrementalIndexer.compareSemanticEquivalence(incGraph, fullGraph)
    assert.strictEqual(cmp.equivalent, true, `Differences: ${JSON.stringify(cmp.differences)}`)
  })

  it('Scenario 5: Idempotency — repeated update without changes returns NO_OP', () => {
    const indexer = new IncrementalIndexer({
      rootDir: tempDir,
      aiDir,
      graphPath,
      cachePath,
      backupPath,
    })

    indexer.rebuildFull({ reason: 'Initial build' })

    // Update 1 (no disk changes)
    const res1 = indexer.update()
    assert.strictEqual(res1.mode, 'NO_OP')
    assert.strictEqual(res1.status, 'FRESH')

    // Update 2 (still no disk changes)
    const res2 = indexer.update()
    assert.strictEqual(res2.mode, 'NO_OP')
    assert.strictEqual(res2.status, 'FRESH')
  })

  it('Scenario 6: Changing an exported symbol name re-resolves importing consumer call sites', () => {
    const indexer = new IncrementalIndexer({
      rootDir: tempDir,
      aiDir,
      graphPath,
      cachePath,
      backupPath,
    })

    indexer.rebuildFull({ reason: 'Initial build' })

    // Change export from add to calculateSum in math.ts
    const mathPath = join(tempDir, 'packages', 'core', 'src', 'math.ts')
    writeFileSync(
      mathPath,
      `export function calculateSum(a: number, b: number): number {\n  return a + b\n}\n`,
    )

    // Update calculator.ts to import calculateSum
    const calcPath = join(tempDir, 'packages', 'core', 'src', 'calculator.ts')
    writeFileSync(
      calcPath,
      `import { calculateSum } from './math'\n\nexport function compute(val: number): number {\n  return calculateSum(val, 10)\n}\n`,
    )

    const incRes = indexer.update()
    assert.strictEqual(incRes.mode, 'INCREMENTAL_UPDATE')
    assert.ok(incRes.changes.modified.includes('packages/core/src/math.ts'))
    assert.ok(incRes.changes.modified.includes('packages/core/src/calculator.ts'))
    const incGraph = JSON.parse(readFileSync(graphPath, 'utf8'))

    // Verify against clean full rebuild
    indexer.rebuildFull({ reason: 'Verification' })
    const fullGraph = JSON.parse(readFileSync(graphPath, 'utf8'))

    const cmp = IncrementalIndexer.compareSemanticEquivalence(incGraph, fullGraph)
    assert.strictEqual(cmp.equivalent, true, `Differences: ${JSON.stringify(cmp.differences)}`)
  })

  it('Scenario 7: tsconfig / path alias modification triggers config hash invalidation & full rebuild fallback', () => {
    const indexer = new IncrementalIndexer({
      rootDir: tempDir,
      aiDir,
      graphPath,
      cachePath,
      backupPath,
    })

    indexer.rebuildFull({ reason: 'Initial build' })

    // Modify tsconfig.json to add path aliases
    const tsconfigPath = join(tempDir, 'tsconfig.json')
    writeFileSync(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          paths: { '@test/core/*': ['packages/core/src/*'] },
        },
      }),
    )

    // Running update should automatically detect config change and fall back to full rebuild
    const res = indexer.update()
    assert.strictEqual(res.mode, 'FULL_REBUILD')
    assert.ok(res.reason.includes('Configuration fingerprint changed'))
  })

  it('Scenario 8: package.json dependency modification triggers configuration hash invalidation', () => {
    const indexer = new IncrementalIndexer({
      rootDir: tempDir,
      aiDir,
      graphPath,
      cachePath,
      backupPath,
    })

    indexer.rebuildFull({ reason: 'Initial build' })

    // Modify root package.json
    const pkgJsonPath = join(tempDir, 'package.json')
    writeFileSync(
      pkgJsonPath,
      JSON.stringify({
        name: 'test-monorepo',
        version: '1.0.1',
        workspaces: ['packages/*'],
        dependencies: { fastify: '^4.0.0' },
      }),
    )

    const res = indexer.update()
    assert.strictEqual(res.mode, 'FULL_REBUILD')
    assert.ok(res.reason.includes('Configuration fingerprint changed'))
  })

  it('Scenario 9: Deleting a file with importing consumers and tests updates relationships cleanly', () => {
    const indexer = new IncrementalIndexer({
      rootDir: tempDir,
      aiDir,
      graphPath,
      cachePath,
      backupPath,
    })

    indexer.rebuildFull({ reason: 'Initial build' })

    // Delete calculator.ts which is imported by calculator.test.ts
    const calcPath = join(tempDir, 'packages', 'core', 'src', 'calculator.ts')
    rmSync(calcPath)

    const incRes = indexer.update()
    assert.strictEqual(incRes.mode, 'INCREMENTAL_UPDATE')
    assert.ok(incRes.changes.deleted.includes('packages/core/src/calculator.ts'))
    const incGraph = JSON.parse(readFileSync(graphPath, 'utf8'))

    // Verify against clean full rebuild
    indexer.rebuildFull({ reason: 'Verification' })
    const fullGraph = JSON.parse(readFileSync(graphPath, 'utf8'))

    const cmp = IncrementalIndexer.compareSemanticEquivalence(incGraph, fullGraph)
    assert.strictEqual(cmp.equivalent, true, `Differences: ${JSON.stringify(cmp.differences)}`)
  })

  it('Scenario 10: Introducing a missing export resolves previously UNRESOLVED relationship', () => {
    const indexer = new IncrementalIndexer({
      rootDir: tempDir,
      aiDir,
      graphPath,
      cachePath,
      backupPath,
    })

    // Setup caller referencing un-exported function
    const callerPath = join(tempDir, 'packages', 'core', 'src', 'caller.ts')
    writeFileSync(
      callerPath,
      `import { helper } from './math'\n\nexport function run(): void {\n  helper()\n}\n`,
    )

    indexer.rebuildFull({ reason: 'Initial build with unresolved helper' })
    const initialGraph = JSON.parse(readFileSync(graphPath, 'utf8'))
    const unresolvedRel = initialGraph.relationships.find((r) => r.targetId.includes('helper'))
    assert.ok(unresolvedRel, 'Expected relationship to helper')

    // Now export helper in math.ts
    const mathPath = join(tempDir, 'packages', 'core', 'src', 'math.ts')
    writeFileSync(
      mathPath,
      `export function add(a: number, b: number): number { return a + b; }\nexport function helper(): void {}\n`,
    )

    const incRes = indexer.update()
    assert.strictEqual(incRes.mode, 'INCREMENTAL_UPDATE')
    const incGraph = JSON.parse(readFileSync(graphPath, 'utf8'))

    // Verify against full rebuild
    indexer.rebuildFull({ reason: 'Verification' })
    const fullGraph = JSON.parse(readFileSync(graphPath, 'utf8'))

    const cmp = IncrementalIndexer.compareSemanticEquivalence(incGraph, fullGraph)
    assert.strictEqual(cmp.equivalent, true, `Differences: ${JSON.stringify(cmp.differences)}`)
  })

  it('Scenario 11: Introducing an unresolved import preserves identical semantic representation', () => {
    const indexer = new IncrementalIndexer({
      rootDir: tempDir,
      aiDir,
      graphPath,
      cachePath,
      backupPath,
    })

    indexer.rebuildFull({ reason: 'Initial build' })

    // Add a file importing non-existent module
    const brokenPath = join(tempDir, 'packages', 'core', 'src', 'broken.ts')
    writeFileSync(
      brokenPath,
      `import { missingFn } from './non-existent-module'\n\nexport function doBroken(): void { missingFn(); }\n`,
    )

    const incRes = indexer.update()
    assert.strictEqual(incRes.mode, 'INCREMENTAL_UPDATE')
    const incGraph = JSON.parse(readFileSync(graphPath, 'utf8'))

    indexer.rebuildFull({ reason: 'Verification' })
    const fullGraph = JSON.parse(readFileSync(graphPath, 'utf8'))

    const cmp = IncrementalIndexer.compareSemanticEquivalence(incGraph, fullGraph)
    assert.strictEqual(cmp.equivalent, true, `Differences: ${JSON.stringify(cmp.differences)}`)
  })

  it('Scenario 12: Indexer version upgrade in cache triggers safe clean full rebuild', () => {
    const indexer = new IncrementalIndexer({
      rootDir: tempDir,
      aiDir,
      graphPath,
      cachePath,
      backupPath,
    })

    indexer.rebuildFull({ reason: 'Initial build' })

    // Tamper cache indexerVersion to simulate upgrading indexer version
    const cache = JSON.parse(readFileSync(cachePath, 'utf8'))
    cache.indexerVersion = '1.0.0-legacy'
    writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8')

    const res = indexer.update()
    assert.strictEqual(res.mode, 'FULL_REBUILD')
    assert.ok(res.reason.includes('Indexer version upgraded'))
  })

  it('Scenario 13: Strict Anti-Orphan Assertion — graph has 0 orphaned symbols or relationships', () => {
    const indexer = new IncrementalIndexer({
      rootDir: tempDir,
      aiDir,
      graphPath,
      cachePath,
      backupPath,
    })

    // Add a few temporary files
    const fileA = join(tempDir, 'packages', 'core', 'src', 'tempA.ts')
    const fileB = join(tempDir, 'packages', 'core', 'src', 'tempB.ts')
    writeFileSync(fileA, `export function fnA(): string { return 'A'; }\n`)
    writeFileSync(
      fileB,
      `import { fnA } from './tempA'; export function fnB(): string { return fnA(); }\n`,
    )

    indexer.rebuildFull({ reason: 'Initial build' })

    // Delete tempA.ts and tempB.ts
    rmSync(fileA)
    rmSync(fileB)

    indexer.update()
    const graph = JSON.parse(readFileSync(graphPath, 'utf8'))

    // Verify 0 orphaned symbols
    const files = new Set(Object.keys(graph.files))
    for (const [symId, sym] of Object.entries(graph.symbols)) {
      assert.ok(
        files.has(sym.file),
        `Symbol '${symId}' is orphaned (file '${sym.file}' does not exist in graph.files)`,
      )
    }

    // Verify 0 orphaned relationships
    for (const rel of graph.relationships) {
      assert.ok(
        files.has(rel.file),
        `Relationship '${rel.id}' is orphaned (file '${rel.file}' does not exist in graph.files)`,
      )
    }
  })
})
