#!/usr/bin/env node
// ============================================
// scripts/capability/wiring-matrix.mjs
//
// docs/architecture/universal-core/ENGINE-WIRING.csv — the wiring chain of every
// engine and every capability, READ FROM DISK, never typed by hand (V64 §4 phase 1).
//
// WHY THIS EXISTS
// The capability registry told customers «the UI is not wired» while the screen
// was in the menu, and `INDUSTRY-SUPPORT-LEVELS.csv` repeated it. A claim is only
// worth its evidence: this file walks the real chain
//
//   engine registry → service file → backend route that imports it
//                  → route function registered in backend/src/index.ts
//                  → local-engine route (offline) → client hook → hook re-exported
//                  → UI host
//
// and writes one row per `ENGINE_KEYS` entry and one per `CAPABILITY_KEYS` entry.
// A missing link is a fact about the repository, not an opinion about it.
//
// ⚠️ It does NOT decide what may be sold. `generate-sellable.mjs` does, from
// acceptance evidence. This file only answers «is the chain present?».
//
//   node scripts/capability/wiring-matrix.mjs           # write
//   node scripts/capability/wiring-matrix.mjs --check   # fail when stale
// ============================================

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CHECK_ONLY = process.argv.includes('--check')
const OUT = 'docs/architecture/universal-core/ENGINE-WIRING.csv'
const REGISTRY = 'packages/validation/src/schemas/business-capabilities.ts'
const BACKEND_INDEX = 'backend/src/index.ts'
const HOOKS_INDEX = 'packages/api/src/index.ts'
const ROUTES_DIR = 'backend/src/routes'

const read = (relative) => readFileSync(path.join(ROOT, relative), 'utf8')
const exists = (relative) => relative !== null && existsSync(path.join(ROOT, relative))

/** The seven words V65 allows. A status outside this set is a bug, not a nuance. */
const STATUSES = [
  'available',
  'partial',
  'planned',
  'unsupported',
  'unwired',
  'online_required',
  'not_verified',
]

// ─── 1. Read the registry out of the TypeScript source ───────────────
//
// The registry is data, not behaviour, so it is read with the same technique the
// other generators use (source text, exact keys). It is NOT imported: a `.mjs`
// script cannot import TypeScript, and adding a TS runtime is a dependency
// change this task does not have.

const source = read(REGISTRY)

function objectBody(marker) {
  const start = source.indexOf(marker)
  if (start < 0) throw new Error(`${REGISTRY}: ${marker} not found`)
  const end = source.indexOf('\n}\n', start)
  if (end < 0) throw new Error(`${REGISTRY}: ${marker} is not closed`)
  return source.slice(start, end)
}

/** Every `  key: { … },` block of a top-level registry object. */
function blocks(bodyText) {
  const out = new Map()
  const re = /^ {2}([a-zA-Z_]+): \{\n([\s\S]*?)^ {2}\},$/gm
  let match
  while ((match = re.exec(bodyText))) {
    // A wrapped value (`uiHost:\n      '…'`) is joined so a field is one line.
    out.set(match[1], match[2].replace(/:\s*\n\s*/g, ': '))
  }
  return out
}

const engineBlocks = blocks(objectBody('export const ENGINES'))
const capabilityBlocks = blocks(objectBody('export const CAPABILITIES'))

/** A `field: value` line of a block: string | null. */
function fieldOf(body, name) {
  const match = body.match(new RegExp(`^ {4}${name}: (?:null|'([^']*)')`, 'm'))
  return match ? (match[1] ?? null) : null
}

function limitationsOf(body) {
  const start = body.indexOf('limitations: [')
  if (start < 0) return []
  const end = body.indexOf(']', start)
  return [...body.slice(start, end).matchAll(/'([A-Z0-9_]+)'/g)].map((m) => m[1])
}

function evidenceOf(body) {
  const out = { sources: [], tests: [] }
  for (const group of ['sources', 'tests']) {
    const start = body.indexOf(`${group}: [`)
    if (start < 0) continue
    const end = body.indexOf(']', start)
    out[group] = [...body.slice(start, end).matchAll(/'([^']+)'/g)].map((m) => m[0].slice(1, -1))
  }
  return out
}

// ─── 2. The backend routes and the index that registers them ─────────

const routeFiles = readdirSync(path.join(ROOT, ROUTES_DIR))
  .filter((name) => name.endsWith('.ts'))
  .map((name) => `${ROUTES_DIR}/${name}`)
  .sort()

const routeSources = new Map(routeFiles.map((file) => [file, read(file)]))
const backendIndex = read(BACKEND_INDEX)
const hooksIndex = read(HOOKS_INDEX)

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Module specifier a route would use for an absolute repository path. */
const specifierOf = (file) =>
  file
    .replace(/^backend\/src\//, '')
    .replace(/^packages\/[^/]+\/src\//, '')
    .replace(/\.tsx?$/, '')

/** Route files that import this module — the real «a route answers it» evidence. */
function routesImporting(relativePath) {
  if (!relativePath) return []
  const specifier = specifierOf(relativePath)
  const test = new RegExp(`from '[^']*${escape(specifier)}'`)
  return routeFiles.filter((file) => test.test(routeSources.get(file)))
}

/** Of those route files, the exported plugin functions `index.ts` registers. */
function registeredPlugins(files) {
  const names = new Set()
  for (const file of files) {
    for (const match of routeSources
      .get(file)
      .matchAll(/export (?:async )?(?:function|const) ([A-Za-z0-9_]+)/g)) {
      names.add(match[1])
    }
  }
  return [...names]
    .filter((name) => new RegExp(`register\\(\\s*${name}\\s*\\)`).test(backendIndex))
    .sort()
}

/** Routes that answer a capability's OWN evidence (not its whole engine). */
function routesForEvidence(evidence) {
  const hits = new Set()
  for (const file of evidence.sources) {
    for (const route of routesImporting(file)) hits.add(route)
  }
  return [...hits].sort()
}

const hookExported = (hookFile) =>
  hookFile !== null &&
  new RegExp(`from '\\./hooks/${escape(path.basename(hookFile, '.ts'))}'`).test(hooksIndex)

// ─── 3. Engine rows ──────────────────────────────────────────────────

const engines = new Map()

for (const [key, body] of engineBlocks) {
  const service = fieldOf(body, 'service')
  const localEngine = fieldOf(body, 'localEngine')
  const clientHook = fieldOf(body, 'clientHook')
  const uiHost = fieldOf(body, 'uiHost')
  const offlineStatus = fieldOf(body, 'offlineStatus')
  const pack = fieldOf(body, 'pack')

  const routeFilesForService = routesImporting(service)
  const registered = registeredPlugins(routeFilesForService)

  const servicePresent = exists(service)
  const localEnginePresent = exists(localEngine)
  const clientHookPresent = exists(clientHook)
  const uiHostPresent = exists(uiHost)

  const capabilities = [...capabilityBlocks.entries()]
    .filter(([, capabilityBody]) => fieldOf(capabilityBody, 'engine') === key)
    .map(([capabilityKey, capabilityBody]) => ({
      key: capabilityKey,
      status: fieldOf(capabilityBody, 'status'),
      limitations: limitationsOf(capabilityBody),
    }))

  const availableCapabilities = capabilities.filter(
    (capability) => capability.status === 'available',
  )
  const executes = registered.length > 0 || localEnginePresent

  let status
  if (!servicePresent || !executes) status = 'unwired'
  else if (!uiHostPresent) status = 'not_verified'
  else if (availableCapabilities.length === 0) {
    // Nothing in it is finished yet; «planned» would claim it is not built at all.
    status = capabilities.length === 0 ? 'not_verified' : 'partial'
  } else status = 'available'

  engines.set(key, {
    key,
    service,
    servicePresent,
    routeFiles: routeFilesForService,
    registered,
    localEngine,
    localEnginePresent,
    clientHook,
    clientHookPresent,
    clientHookExported: hookExported(clientHook),
    uiHost,
    uiHostPresent,
    offlineStatus,
    pack,
    capabilities,
    availableCapabilities,
    status,
  })
}

// ─── 4. Capability rows ─────────────────────────────────────────────

const capabilities = [...capabilityBlocks.entries()].map(([key, body]) => {
  const engineKey = fieldOf(body, 'engine')
  const engine = engineKey ? engines.get(engineKey) : undefined
  const evidence = evidenceOf(body)
  const evidenceFiles = [...evidence.sources, ...evidence.tests]
  return {
    key,
    status: fieldOf(body, 'status'),
    engine: engineKey,
    pack: engine?.pack ?? null,
    service: engine?.service ?? null,
    servicePresent: engine?.servicePresent ?? false,
    backendRouteFiles: routesForEvidence(evidence),
    localEngine: engine?.localEngine ?? null,
    localEnginePresent: engine?.localEnginePresent ?? false,
    clientHook: engine?.clientHook ?? null,
    clientHookPresent: engine?.clientHookPresent ?? false,
    clientHookExported: engine?.clientHookExported ?? false,
    uiHost: engine?.uiHost ?? null,
    uiHostPresent: engine?.uiHostPresent ?? false,
    evidenceFiles: evidenceFiles.length,
    evidencePresent: evidenceFiles.filter((file) => exists(file)).length,
    limitations: limitationsOf(body),
  }
})

// ─── 5. Write ────────────────────────────────────────────────────────

const HEADER = [
  'row_type',
  'key',
  'status',
  'engine',
  'pack',
  'service',
  'service_present',
  'backend_route_files',
  'backend_routes_registered',
  'local_engine',
  'local_engine_present',
  'client_hook',
  'client_hook_present',
  'client_hook_exported',
  'ui_host',
  'ui_host_present',
  'evidence_files',
  'evidence_present',
  'limitations',
]

/** Every cell is quoted, and no value contains a comma or a quote. */
function cell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  if (text.includes('"')) throw new Error(`a CSV cell cannot contain a quote: ${text}`)
  return `"${text}"`
}

const lines = [HEADER.map(cell).join(',')]

for (const engine of engines.values()) {
  lines.push(
    [
      'engine',
      engine.key,
      engine.status,
      engine.key,
      engine.pack,
      engine.service,
      engine.servicePresent,
      engine.routeFiles.length,
      engine.registered.join(';'),
      engine.localEngine,
      engine.localEnginePresent,
      engine.clientHook,
      engine.clientHookPresent,
      engine.clientHookExported,
      engine.uiHost,
      engine.uiHostPresent,
      '',
      '',
      '',
    ]
      .map(cell)
      .join(','),
  )
}

for (const capability of capabilities) {
  lines.push(
    [
      'capability',
      capability.key,
      capability.status,
      capability.engine,
      capability.pack,
      capability.service,
      capability.servicePresent,
      capability.backendRouteFiles.length,
      capability.backendRouteFiles.join(';'),
      capability.localEngine,
      capability.localEnginePresent,
      capability.clientHook,
      capability.clientHookPresent,
      capability.clientHookExported,
      capability.uiHost,
      capability.uiHostPresent,
      capability.evidenceFiles,
      capability.evidencePresent,
      capability.limitations.join(';'),
    ]
      .map(cell)
      .join(','),
  )
}

const csv = `${lines.join('\n')}\n`

// A status outside the vocabulary must never reach the file.
const unknownStatuses = lines
  .slice(1)
  .map((line) => line.split('","')[2])
  .filter((status) => !STATUSES.includes(status))
if (unknownStatuses.length > 0) {
  console.error(`UNKNOWN STATUS: ${[...new Set(unknownStatuses)].join(', ')}`)
  process.exit(1)
}

const summary = (rows) => {
  const counts = {}
  for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `${status}=${count}`)
    .join(' ')
}

if (CHECK_ONLY) {
  if (!existsSync(path.join(ROOT, OUT)) || read(OUT) !== csv) {
    console.error('STALE: run node scripts/capability/wiring-matrix.mjs')
    process.exit(1)
  }
  console.log(
    `OK: ${engines.size} engines (${summary([...engines.values()])}) · ` +
      `${capabilities.length} capabilities (${summary(capabilities)})`,
  )
} else {
  writeFileSync(path.join(ROOT, OUT), csv)
  console.log(
    `Wrote ${OUT}: ${engines.size} engines (${summary([...engines.values()])}) · ` +
      `${capabilities.length} capabilities (${summary(capabilities)})`,
  )
}
