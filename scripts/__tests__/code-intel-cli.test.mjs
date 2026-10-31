import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const CLI_PATH = path.resolve('scripts/code-intel.mjs')

function runCli(args = [], opts = {}) {
  try {
    const stdout = execFileSync('node', [CLI_PATH, ...args], {
      encoding: 'utf8',
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opts,
    })
    return { code: 0, stdout, stderr: '' }
  } catch (err) {
    return {
      code: err.status || 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : '',
    }
  }
}

describe('Code Intelligence CLI Interface — Unit Test Suite', () => {
  it('exits with 0 and prints help when invoked with no args or help', () => {
    const res = runCli([])
    assert.strictEqual(res.code, 0)
    assert.ok(res.stdout.includes('Code Intelligence CLI'))
    assert.ok(res.stdout.includes('Commands:'))

    const resHelp = runCli(['help'])
    assert.strictEqual(resHelp.code, 0)
    assert.ok(resHelp.stdout.includes('Commands:'))
  })

  it('exits with 1 when unknown command is invoked', () => {
    const res = runCli(['unknownCommandXYZ'])
    assert.strictEqual(res.code, 1)
    assert.ok(res.stderr.includes('Unknown command') || res.stdout.includes('Unknown command'))
  })

  it('reports fresh index status in text and json formats', () => {
    // Text mode
    const textRes = runCli(['status'])
    assert.strictEqual(textRes.code, 0)
    assert.ok(textRes.stdout.includes('Code Intelligence Index Status:'))
    assert.ok(textRes.stdout.includes('Total Files:'))

    // JSON mode
    const jsonRes = runCli(['status', '--json'])
    assert.strictEqual(jsonRes.code, 0)
    const data = JSON.parse(jsonRes.stdout)
    assert.strictEqual(data.query.operation, 'status')
    assert.ok(data.results[0].totalFiles > 1000)
    assert.strictEqual(data.errors.length, 0)
  })

  it('executes symbol find and outputs JSON matching agent contract', () => {
    const res = runCli(['symbol', 'find', 'createInvoice', '--json'])
    assert.strictEqual(res.code, 0)
    const envelope = JSON.parse(res.stdout)
    assert.ok(envelope.query.operation.includes('symbol'))
    assert.strictEqual(envelope.query.target, 'createInvoice')
    assert.ok(Array.isArray(envelope.results))
    assert.ok(envelope.resultCount >= 1)
    const match = envelope.results.find((s) => s.name.toLowerCase().includes('createinvoice'))
    assert.ok(match, 'Expected CreateInvoice or createInvoice symbol in results')
    assert.ok(match.signature, 'Expected signature in symbol card')
    assert.ok(match.file, 'Expected file path in symbol card')
  })

  it('executes symbol show and handles exact lookup', () => {
    const res = runCli(['symbol', 'show', 'useActivities', '--json'])
    assert.strictEqual(res.code, 0)
    const envelope = JSON.parse(res.stdout)
    assert.ok(envelope.query.operation.includes('symbol'))
    assert.strictEqual(envelope.resultCount, 1)
    assert.strictEqual(envelope.results[0].name, 'useActivities')
  })

  it('executes callers query with json contract', () => {
    const res = runCli(['callers', 'useActivities', '--json'])
    assert.strictEqual(res.code, 0)
    const envelope = JSON.parse(res.stdout)
    assert.strictEqual(envelope.query.operation, 'callers')
    assert.ok(Array.isArray(envelope.results))
  })

  it('executes callees query with json contract', () => {
    const res = runCli(['callees', 'useActivities', '--json'])
    assert.strictEqual(res.code, 0)
    const envelope = JSON.parse(res.stdout)
    assert.strictEqual(envelope.query.operation, 'callees')
    assert.ok(Array.isArray(envelope.results))
  })

  it('executes imports query for a file', () => {
    const res = runCli(['imports', 'packages/api/src/hooks/useActivities.ts', '--json'])
    assert.strictEqual(res.code, 0)
    const envelope = JSON.parse(res.stdout)
    assert.strictEqual(envelope.query.operation, 'imports')
    assert.ok(Array.isArray(envelope.results))
    assert.ok(envelope.resultCount > 0)
  })

  it('executes impact query with bounded depth', () => {
    const res = runCli(['impact', 'useActivities', '--depth=1', '--limit=5', '--json'])
    assert.strictEqual(res.code, 0)
    const envelope = JSON.parse(res.stdout)
    assert.strictEqual(envelope.query.operation, 'impact')
    assert.strictEqual(envelope.resultCount, 1)
    const impactData = envelope.results[0]
    assert.ok(impactData.target)
    assert.ok(Array.isArray(impactData.directCallers))
  })

  it('executes file query returning file metadata and dependents', () => {
    const res = runCli(['file', 'packages/api/src/hooks/useActivities.ts', '--json'])
    assert.strictEqual(res.code, 0)
    const envelope = JSON.parse(res.stdout)
    assert.strictEqual(envelope.query.operation, 'file')
    assert.strictEqual(envelope.resultCount, 1)
    const fileData = envelope.results[0]
    assert.strictEqual(fileData.file, 'packages/api/src/hooks/useActivities.ts')
    assert.ok(Array.isArray(fileData.symbols))
  })

  it('executes source command and returns line-numbered excerpt', () => {
    const res = runCli(['source', 'useActivities', '--context=2', '--json'])
    assert.strictEqual(res.code, 0)
    const envelope = JSON.parse(res.stdout)
    assert.strictEqual(envelope.query.operation, 'source')
    const sourceData = envelope.results[0]
    assert.strictEqual(sourceData.success, true)
    assert.ok(sourceData.excerpt.includes('useActivities'))
    assert.ok(sourceData.linesWithNumbers)
  })

  it('handles errors cleanly when querying non-existent symbols', () => {
    const res = runCli(['symbol', 'show', 'nonExistentSymbol_Phase3_Test', '--json'])
    assert.strictEqual(res.code, 0)
    const envelope = JSON.parse(res.stdout)
    assert.strictEqual(envelope.resultCount, 0)
    assert.ok(envelope.warnings.length > 0 || envelope.errors.length > 0)
  })
})
