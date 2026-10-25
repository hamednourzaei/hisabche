// ============================================
// scripts/measure/http-load.mjs
//
// WHAT IT MEASURES — and what it deliberately does not.
//
// It builds the REAL Fastify server (`buildServer()` from backend/src/index.ts)
// and drives its request pipeline. Two modes:
//
//   --mode=http    a real port and real `fetch` requests (closest to production
//                  for connection and compression behaviour)
//   --mode=inject  Fastify's `app.inject()` (same routing, hooks, validation and
//                  serialization; no socket)
//
// ⚠️ IT DOES NOT EXERCISE PERSISTENCE, AND SAYS SO.
//
// This machine has no Supabase credentials, so the queries a handler would issue
// cannot run. Every number here is therefore the cost of the SERVER AROUND the
// data — plugins, hooks, validation, serialization, compression. MEASUREMENTS.md
// labels anything touching the database as NOT MEASURED.
//
// ⚠️ TWO COLUMNS, AND THE DELTA IS THE POINT.
//
//   baseline   shadow mode off (the shipped default for `CoreDivergenceService`)
//   shadow     shadow mode on, so a recorded payment would be re-derived by the
//              shared core and compared
//
// Both run in the same process, on the same server, one after the other.
//
// Run (TS sources need a TS-capable runner):
//   npx tsx scripts/measure/http-load.mjs --mode=inject --requests 2000
// ============================================

import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

process.env.NODE_ENV ??= 'test'
// ⚠️ `VITEST` MUST BE SET BEFORE `index.ts` IS IMPORTED.
//
// `backend/src/index.ts` ends with `if (!process.env.VITEST) { start() }`, so a
// plain import — from a script, a bench, a REPL — builds AND starts the server
// (it binds the real PORT and starts the cron scheduler). Calling `buildServer()`
// afterwards then registers `@fastify/compress` a second time on the same
// singleton and throws «The decorator 'compress' has already been added».
//
// Setting the flag is what the test suite does implicitly; it tells that module
// «build on request, do not start». It changes nothing about the code under
// measurement — the same `buildServer()` runs.
process.env.VITEST ??= 'measure'
process.env.SUPABASE_URL ??= 'https://test.supabase.example.com'
process.env.SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.JWT_SECRET ??= 'test-jwt-secret'
process.env.SUPABASE_SERVICE_KEY ??= 'test-service'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service'

const argOf = (name, fallback) => {
  // Support BOTH `--name=value` and `--name value`. The first form was silently
  // ignored by the original parser (it looked for the value in the NEXT token),
  // so `--mode=http` ran in inject mode while reporting otherwise — a
  // measurement labelled with a mode it did not use.
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3)
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}
const num = (name, fallback) => Number(argOf(name, fallback))

const MODE = argOf('mode', 'inject')
const REQUESTS = num('requests', 2000)
const CONCURRENCY = num('concurrency', 10)
const PATH = '/api/health'

// ⚠️ ONE ABSOLUTE SPECIFIER, RESOLVED ONCE.
//
// `backend/src/index.ts` builds a module-level Fastify singleton and registers
// `@fastify/compress` INSIDE `buildServer`. It must be built exactly once in a
// process: a second build — including one caused by importing the same file under
// a different specifier (`../index` vs `../index.ts`) — throws «The decorator
// 'compress' has already been added». So the URL is computed once here and used
// for every import, and only `buildServer` is called.
const INDEX_URL = pathToFileURL(join(process.cwd(), 'backend/src/index.ts')).href

const { buildServer } = await import(INDEX_URL)
const app = await buildServer()
await app.ready()

// The shadow flag is read through the SAME module graph, so it is the instance
// the server uses.
const { CoreDivergenceService } = await import(
  pathToFileURL(join(process.cwd(), 'backend/src/services/core-divergence.service.ts')).href
)

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
}

async function driveHttp(label) {
  const server = app.server
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  const base = `http://127.0.0.1:${port}`

  for (let i = 0; i < 200; i++) await fetch(`${base}${PATH}`)

  const latencies = []
  let failures = 0
  let issued = 0
  const cpuStart = process.cpuUsage()
  const startedAt = performance.now()

  const worker = async () => {
    while (issued < REQUESTS) {
      issued += 1
      const t0 = performance.now()
      try {
        const response = await fetch(`${base}${PATH}`)
        await response.arrayBuffer()
        if (!response.ok) failures += 1
      } catch {
        failures += 1
      }
      latencies.push(performance.now() - t0)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const elapsedMs = performance.now() - startedAt
  const cpu = process.cpuUsage(cpuStart)
  await new Promise((resolve) => server.close(resolve))

  return summarize(label, latencies, failures, elapsedMs, cpu)
}

async function driveInject(label) {
  for (let i = 0; i < 200; i++) await app.inject({ method: 'GET', url: PATH })

  const latencies = []
  let failures = 0
  const cpuStart = process.cpuUsage()
  const startedAt = performance.now()

  for (let i = 0; i < REQUESTS; i++) {
    const t0 = performance.now()
    const response = await app.inject({ method: 'GET', url: PATH })
    if (response.statusCode !== 200) failures += 1
    latencies.push(performance.now() - t0)
  }

  const elapsedMs = performance.now() - startedAt
  const cpu = process.cpuUsage(cpuStart)
  return summarize(label, latencies, failures, elapsedMs, cpu)
}

function summarize(label, latencies, failures, elapsedMs, cpu) {
  const sorted = [...latencies].sort((a, b) => a - b)
  const total = sorted.reduce((a, b) => a + b, 0)
  return {
    label,
    requests: sorted.length,
    failures,
    elapsedMs: Math.round(elapsedMs),
    requestsPerUserHour: Math.round((sorted.length / elapsedMs) * 3_600_000),
    p50: +percentile(sorted, 0.5).toFixed(3),
    p95: +percentile(sorted, 0.95).toFixed(3),
    p99: +percentile(sorted, 0.99).toFixed(3),
    avg: +(total / sorted.length).toFixed(3),
    serverCpuMs: Math.round((cpu.user + cpu.system) / 1000),
  }
}

const drive = MODE === 'http' ? driveHttp : driveInject
const results = []

CoreDivergenceService.setShadowMode(false)
results.push(await drive('baseline (shadow off)'))

CoreDivergenceService.setShadowMode(true)
results.push(await drive('shadow on'))

CoreDivergenceService.setShadowMode(false)
await app.close()

console.log(`\nnode ${process.version} | ${process.platform} ${process.arch} | mode=${MODE}`)
console.log(`requests=${REQUESTS} concurrency=${MODE === 'http' ? CONCURRENCY : 1} path=${PATH}`)
console.log('NOTE: persistence is NOT exercised (no database on this machine).\n')
console.log(
  'run                  req  fail  req/user-hr    p50ms    p95ms    p99ms    avgms  procCpuMs',
)
for (const r of results) {
  console.log(
    `${r.label.padEnd(21)}${String(r.requests).padStart(4)}${String(r.failures).padStart(6)}` +
      `${String(r.requestsPerUserHour).padStart(13)}${String(r.p50).padStart(9)}${String(r.p95).padStart(9)}` +
      `${String(r.p99).padStart(9)}${String(r.avg).padStart(9)}${String(r.serverCpuMs).padStart(12)}`,
  )
}
const [baseline, shadow] = results
console.log(`\np95 delta (shadow − baseline) = ${(shadow.p95 - baseline.p95).toFixed(3)} ms`)

// ⚠️ EXPLICIT EXIT. `app.close()` releases Fastify, but importing `index.ts`
// registers process-level signal handlers and the module graph can hold a timer
// open; without this the script prints its table and then never returns, which
// looks like a hang rather than a finished measurement.
process.exit(0)
