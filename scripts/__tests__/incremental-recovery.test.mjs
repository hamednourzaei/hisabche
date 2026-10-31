import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { IncrementalIndexer, computeConfigFingerprint } from '../lib/incremental-indexer.mjs'
import { CodeIntelQueryEngine } from '../lib/code-intel-query.mjs'

describe('Code Intelligence — Windows Atomic Swap & Crash Recovery Test Suite', () => {
  let tempDir
  let aiDir
  let graphPath
  let cachePath
  let backupPath

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'inc-recovery-test-'))
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

  it('Point 1: Preserves existing graph when candidate generation or validation fails', () => {
    const validGraph = {
      metadata: { gitHash: 'abc', timestamp: '2026-10-30T00:00:00.000Z' },
      symbols: { sym1: { id: 'sym1', name: 'fn1' } },
      relationships: [],
      files: {},
    }
    const validCache = { version: 1, fileFingerprints: {} }

    writeFileSync(graphPath, JSON.stringify(validGraph, null, 2), 'utf8')
    writeFileSync(cachePath, JSON.stringify(validCache, null, 2), 'utf8')

    const indexer = new IncrementalIndexer({
      rootDir: tempDir,
      aiDir,
      graphPath,
      cachePath,
      backupPath,
    })

    // Simulate invalid candidate (circular reference or un-stringifiable object)
    const circular = {}
    circular.self = circular

    assert.throws(() => {
      indexer.atomicPublish(circular, validCache)
    })

    // Verify existing graph is untouched
    const currentOnDisk = JSON.parse(readFileSync(graphPath, 'utf8'))
    assert.strictEqual(currentOnDisk.metadata.gitHash, 'abc')
    assert.ok(currentOnDisk.symbols['sym1'])

    // Verify no temporary PID files left dangling
    const tmpGraph = `${graphPath}.tmp.${process.pid}`
    assert.strictEqual(existsSync(tmpGraph), false)
  })

  it('Point 2: Two-phase rollback restores graph from backup if cache swap fails', () => {
    const originalGraph = {
      metadata: { gitHash: 'orig', timestamp: '2026-10-30T00:00:00.000Z' },
      symbols: { origSym: { id: 'origSym' } },
      relationships: [],
      files: {},
    }
    const originalCache = { version: 1, fileFingerprints: {} }

    writeFileSync(graphPath, JSON.stringify(originalGraph, null, 2), 'utf8')
    writeFileSync(cachePath, JSON.stringify(originalCache, null, 2), 'utf8')

    const indexer = new IncrementalIndexer({
      rootDir: tempDir,
      aiDir,
      graphPath,
      cachePath,
      backupPath,
    })

    // Candidate
    const candidateGraph = {
      metadata: { gitHash: 'cand' },
      symbols: { candSym: { id: 'candSym' } },
      relationships: [],
      files: {},
    }
    const candidateCache = { version: 2 }

    // Mock _safeReplace so that swapping cache throws an error (simulating Windows lock)
    const originalSafeReplace = indexer._safeReplace.bind(indexer)
    let callCount = 0
    indexer._safeReplace = (source, target) => {
      callCount++
      if (callCount === 1) {
        // Swap graph succeeds
        originalSafeReplace(source, target)
      } else {
        // Swap cache throws
        throw new Error('EPERM: Windows file lock during cache swap')
      }
    }

    assert.throws(() => {
      indexer.atomicPublish(candidateGraph, candidateCache)
    }, /EPERM/)

    // Graph should have been rolled back to original via backup
    const restoredGraph = JSON.parse(readFileSync(graphPath, 'utf8'))
    assert.strictEqual(restoredGraph.metadata.gitHash, 'orig')
    assert.ok(restoredGraph.symbols['origSym'])
  })

  it('Point 3: Automatic recovery from .bak when graph.json is truncated or 0 bytes', () => {
    const healthyGraph = {
      metadata: { gitHash: 'healthy', timestamp: '2026-10-30T00:00:00.000Z' },
      symbols: { healthySym: { id: 'healthySym' } },
      relationships: [],
      files: {},
    }

    // Write healthy backup
    writeFileSync(backupPath, JSON.stringify(healthyGraph, null, 2), 'utf8')

    // Write 0-byte corrupt graph.json
    writeFileSync(graphPath, '', 'utf8')

    const indexer = new IncrementalIndexer({
      rootDir: tempDir,
      aiDir,
      graphPath,
      cachePath,
      backupPath,
    })

    // loadGraph() should detect empty/corrupt file and recover from backup
    const loaded = indexer.loadGraph()
    assert.ok(loaded)
    assert.strictEqual(loaded.metadata.gitHash, 'healthy')
    assert.ok(loaded.symbols['healthySym'])

    // Disk graph.json should now be restored
    const onDisk = JSON.parse(readFileSync(graphPath, 'utf8'))
    assert.strictEqual(onDisk.metadata.gitHash, 'healthy')
  })

  it('Point 4: Status never falsely reports FRESH when index is corrupt or config altered', () => {
    const corruptGraph = '{ invalid json'
    writeFileSync(graphPath, corruptGraph, 'utf8')

    const engine = new CodeIntelQueryEngine(graphPath)
    const status = engine.getIndexStatus()

    assert.notStrictEqual(status.status, 'FRESH')
    assert.strictEqual(status.status, 'CORRUPT')
    assert.ok(status.message.includes('corrupted'))
  })
})
