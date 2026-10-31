import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildDependencyGraph, findCycles } from '../lib/dependency-graph.mjs'

describe('Dependency Graph & Cycle Detection — Unit Test Suite', () => {
  it('constructs file and package graphs from relationships', () => {
    const relationships = [
      {
        type: 'IMPORTS',
        file: 'apps/web/page.tsx',
        targetId: 'packages/ui/src/header.tsx',
        status: 'RESOLVED',
      },
      {
        type: 'IMPORTS',
        file: 'packages/ui/src/header.tsx',
        targetId: 'packages/formatting/src/currency.ts',
        status: 'RESOLVED',
      },
    ]

    const graph = buildDependencyGraph(relationships)
    assert.strictEqual(graph.stats.totalFileNodes, 2)
    assert.strictEqual(graph.stats.totalFileEdges, 2)
    assert.ok(graph.fileGraph['apps/web/page.tsx'].includes('packages/ui/src/header.tsx'))
    assert.ok(graph.packageGraph['@hisabche/web'].includes('@hisabche/ui'))
  })

  it('detects direct circular dependency (A <-> B)', () => {
    const adjMap = new Map([
      ['fileA.ts', new Set(['fileB.ts'])],
      ['fileB.ts', new Set(['fileA.ts'])],
    ])

    const cycles = findCycles(adjMap)
    assert.strictEqual(cycles.length, 1)
    assert.strictEqual(cycles[0].isDirect, true)
    assert.strictEqual(cycles[0].length, 2)
    assert.deepStrictEqual(cycles[0].participatingNodes, ['fileA.ts', 'fileB.ts'])
  })

  it('detects indirect circular dependency (A -> B -> C -> A)', () => {
    const adjMap = new Map([
      ['node1', new Set(['node2'])],
      ['node2', new Set(['node3'])],
      ['node3', new Set(['node1'])],
      ['node4', new Set(['node1'])], // Linear incoming, not part of cycle
    ])

    const cycles = findCycles(adjMap)
    assert.strictEqual(cycles.length, 1)
    assert.strictEqual(cycles[0].isDirect, false)
    assert.strictEqual(cycles[0].length, 3)
    assert.deepStrictEqual(cycles[0].participatingNodes, ['node1', 'node2', 'node3'])
  })

  it('reports zero cycles in acyclic DAG', () => {
    const adjMap = new Map([
      ['a', new Set(['b', 'c'])],
      ['b', new Set(['c'])],
      ['c', new Set([])],
    ])

    const cycles = findCycles(adjMap)
    assert.strictEqual(cycles.length, 0)
  })
})
