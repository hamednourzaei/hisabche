#!/usr/bin/env node
/**
 * Hisabche Code Intelligence V3.0 — Retrieval & Token Economy Benchmark
 *
 * Compares:
 *   A: Naive grep + full file read (10 files matching task keyword)
 *   B: `CodeIntelQueryEngine.getContextPack(task)` (<= 4000 tokens bounded pack)
 *
 * Usage:
 *   node scripts/benchmark-retrieval.mjs
 */

import { readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { CodeIntelQueryEngine } from './lib/code-intel-query.mjs'
import { tokenizeText } from './lib/lexical-index.mjs'

const ROOT = process.cwd()

const BENCHMARK_TASKS = [
  'Fix the invoice creation and ledger posting validation flow',
  'Trace offline sync outbox push and crash recovery queue',
  'Verify distributed writer fencing lease promotion and stale epoch rejection',
  'Audit local SQLite encryption master secret and SQLCipher activation',
  'Check payment allocation and customer receivable settlement parity',
  'Inspect read replica lag measurement and primary fallback routing',
  'Audit storage adapter signed URLs and path traversal prevention',
  'Trace inventory costing FIFO AVCO consumption rules',
  'Check Nginx infrastructure reload webhook HMAC and replay protection',
  'Inspect industry capability profiles and onboarding DNA resolver',
]

function estimateTokens(strOrObj) {
  const s = typeof strOrObj === 'string' ? strOrObj : JSON.stringify(strOrObj)
  return Math.ceil(s.length / 4)
}

function naiveGrepBaseline(engine, task) {
  const tokens = tokenizeText(task).filter((t) => t.length >= 4)
  const files = Object.keys(engine.graph?.files || {})
  const matchedFiles = []

  for (const file of files) {
    const lower = file.toLowerCase()
    if (tokens.some((t) => lower.includes(t))) {
      matchedFiles.push(file)
      if (matchedFiles.length >= 10) break
    }
  }

  let totalBytes = 0
  let filesRead = 0
  for (const f of matchedFiles) {
    const full = join(ROOT, f)
    if (existsSync(full) && statSync(full).isFile()) {
      const content = readFileSync(full, 'utf8')
      totalBytes += Buffer.byteLength(content, 'utf8')
      filesRead++
    }
  }

  return {
    filesRead,
    bytesProcessed: totalBytes,
    estimatedTokens: Math.ceil(totalBytes / 4),
  }
}

const engine = new CodeIntelQueryEngine().load()
const rows = []
let totalNaiveTokens = 0
let totalPackTokens = 0

for (const task of BENCHMARK_TASKS) {
  const naive = naiveGrepBaseline(engine, task)
  const pack = engine.getContextPack(task, { maxTokens: 3500 })
  const packBytes = Buffer.byteLength(JSON.stringify(pack), 'utf8')
  const packTokens = pack.tokenEstimate || estimateTokens(pack)

  totalNaiveTokens += naive.estimatedTokens
  totalPackTokens += packTokens

  const reductionPct =
    naive.estimatedTokens > 0
      ? Number((((naive.estimatedTokens - packTokens) / naive.estimatedTokens) * 100).toFixed(1))
      : 0

  rows.push({
    task,
    naiveFiles: naive.filesRead,
    naiveTokens: naive.estimatedTokens,
    packFiles: pack.relevantFiles.length,
    packSnippets: pack.snippets.length,
    packBytes,
    packTokens,
    reductionPct,
  })
}

const overallReductionPct =
  totalNaiveTokens > 0
    ? Number((((totalNaiveTokens - totalPackTokens) / totalNaiveTokens) * 100).toFixed(1))
    : 0

console.log(
  JSON.stringify(
    {
      taskCount: BENCHMARK_TASKS.length,
      totalNaiveTokens,
      totalPackTokens,
      overallReductionPct,
      targetMet: overallReductionPct >= 70,
      tasks: rows,
    },
    null,
    2,
  ),
)
