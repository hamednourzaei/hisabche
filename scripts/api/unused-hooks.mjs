#!/usr/bin/env node
// ============================================
// scripts/api/unused-hooks.mjs
//
// `docs/architecture/universal-core/UNUSED-HOOKS.csv` — every hook `packages/api`
// exports that nothing in the applications calls, with the evidence beside it.
//
// WHY THIS IS A LEDGER AND NOT A WIRING SCRIPT. V64 §1.2 and the owner's own
// instruction: connecting every unused hook is not a fix. A hook can be unused
// because its screen is missing, because a newer hook replaced it, because the
// server route never existed, or because the feature was decided against. Those
// four need four different answers, so this file only measures and every row is
// `NEEDS_OWNER_DECISION`.
//
// HOW «USED» IS DECIDED. A hook counts as used when its name appears in a file
// outside the package that defines it (and outside the barrel that re-exports
// it). A name in a comment counts too — that over-counts, so the ledger can only
// MISS an unused hook, never invent one. That is the safe direction.
//
//   node scripts/api/unused-hooks.mjs           # write
//   node scripts/api/unused-hooks.mjs --check   # fail when stale
// ============================================

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CHECK_ONLY = process.argv.includes('--check')
const OUT = 'docs/architecture/universal-core/UNUSED-HOOKS.csv'
const HOOKS_DIR = path.join(ROOT, 'packages', 'api', 'src', 'hooks')
const BARREL = path.join(ROOT, 'packages', 'api', 'src', 'index.ts')

const CONSUMER_DIRS = [
  // The api package itself: one hook calling another is a real consumer, and
  // leaving it out made `useAuthReady` look unused.
  'packages/api/src',
  'packages/ui/src',
  'packages/app-shell/src',
  'packages/local-engine/src',
  'packages/store/src',
  'apps/web',
  'apps/desktop/src',
  'apps/mobile',
]

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', 'out', 'coverage'])

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(full, out)
    } else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

const relative = (file) => path.relative(ROOT, file).split(path.sep).join('/')

// ---------------------------------------------------------------
// 1. Every hook the api package exports.
// ---------------------------------------------------------------
const hookFiles = readdirSync(HOOKS_DIR).filter((name) => name.endsWith('.ts'))
const hooks = []
for (const name of hookFiles) {
  const file = path.join(HOOKS_DIR, name)
  const source = readFileSync(file, 'utf8')
  const seen = new Set()
  const patterns = [
    /export\s+function\s+(use[A-Z][A-Za-z0-9_]*)/g,
    /export\s+const\s+(use[A-Z][A-Za-z0-9_]*)/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (seen.has(match[1])) continue
      seen.add(match[1])
      hooks.push({ hook: match[1], definedIn: relative(file), module: name.replace(/\.ts$/, '') })
    }
  }
}

const barrel = readFileSync(BARREL, 'utf8')
// `useMarkAsRead as useMarkActivityAsRead` — the public name is the alias.
for (const item of hooks) {
  const alias = new RegExp(`\\b${item.hook}\\s+as\\s+(use[A-Za-z0-9_]+)`)
  const found = alias.exec(barrel)
  item.exportedAs = found ? found[1] : item.hook
}

// ---------------------------------------------------------------
// 2. Server routes and local-engine routes, by path.
// ---------------------------------------------------------------
const routeFiles = [
  ...walk(path.join(ROOT, 'backend', 'src', 'routes')),
  ...walk(path.join(ROOT, 'packages', 'local-engine', 'src')),
].filter((file) => !file.split(path.sep).includes('__tests__'))
const routes = []
for (const file of routeFiles) {
  const source = readFileSync(file, 'utf8')
  // Most plugins register `/serial-holds` under a `/api/v1` prefix, so the
  // leading `/api/v1` is not part of the string. Any quoted absolute path is
  // collected; the match below needs a 5+ character token to fire.
  for (const match of source.matchAll(/['"`](\/[a-z0-9][a-z0-9/:_.-]*)['"`]/gi)) {
    const line = source.slice(0, match.index).split('\n').length
    routes.push({ path: match[1], at: `${relative(file)}:${line}` })
  }
}

// The evidence has to come from the hook's own request path. Name matching
// produced nonsense — `useLogin` matched a wall-logout route — so each hook's
// function body is cut out and the request paths inside it are the candidates.
function hookBody(item) {
  const source = readFileSync(path.join(ROOT, item.definedIn), 'utf8')
  const start = source.search(
    new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${item.hook}\\b`),
  )
  if (start < 0) return ''
  const rest = source.slice(start + 1)
  const next = rest.search(/\nexport\s/)
  return next < 0 ? rest : rest.slice(0, next)
}

function routesFor(item) {
  const body = hookBody(item)
  // Hooks write both `/v1/activities` and `/projects`, and a few interpolate an
  // id into the path (`/projects/${id}/tasks`), so the placeholder is removed
  // before matching.
  const paths = [...body.matchAll(/['"`](\/[a-z][a-z0-9/:_.${}-]*)['"`]/gi)]
    .map((match) => match[1].replace(/\$\{[^}]*\}/g, '').replace(/\/+$/, ''))
    .filter((requested) => requested.length >= 5)
  const found = []
  for (const requested of paths) {
    const tail = requested.replace(/^\/api/, '').replace(/^\/v1/, '')
    if (tail.length < 5) continue
    for (const route of routes) {
      if (found.some((entry) => entry.path === route.path)) continue
      const whole = route.path.replace(/\/:[a-z]+$/i, '')
      if (route.path === requested || route.path === tail || whole.endsWith(tail)) found.push(route)
    }
  }
  return found.slice(0, 3)
}

// ---------------------------------------------------------------
// 3. Who mentions each hook.
// ---------------------------------------------------------------
const consumerFiles = CONSUMER_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)))
const consumers = new Map(consumerFiles.map((file) => [file, readFileSync(file, 'utf8')]))

const rows = []
for (const item of hooks) {
  const names = [item.hook, item.exportedAs]
  const ownFile = path.join(ROOT, item.definedIn)
  const mentions = []
  for (const [file, source] of consumers) {
    // Its own definition and the barrel that re-exports every hook by
    // definition are not consumers.
    if (file === ownFile || file === BARREL) continue
    if (names.some((name) => new RegExp(`\\b${name}\\b`).test(source)))
      mentions.push(relative(file))
  }
  if (mentions.length > 0) continue

  const duplicate = hooks.find(
    (other) => other !== item && other.hook === item.hook && other.definedIn !== item.definedIn,
  )
  const matched = routesFor(item)

  rows.push({
    hook: item.hook,
    defined_in: item.definedIn,
    module: item.module,
    exported_as: item.exportedAs,
    duplicate_in: duplicate?.definedIn ?? '',
    server_route: matched.map((route) => route.path).join(' ; '),
    server_route_evidence: matched.map((route) => route.at).join(' ; '),
    decision: 'NEEDS_OWNER_DECISION',
  })
}

rows.sort((a, b) => a.hook.localeCompare(b.hook))

const columns = [
  'hook',
  'defined_in',
  'module',
  'exported_as',
  'duplicate_in',
  'server_route',
  'server_route_evidence',
  'decision',
]
const quote = (value) => `"${String(value).replaceAll('"', '""')}"`
const csv = [
  columns.join(','),
  ...rows.map((row) => columns.map((column) => quote(row[column])).join(',')),
]
  .join('\n')
  .concat('\n')

const target = path.join(ROOT, OUT)
if (CHECK_ONLY) {
  let current = null
  try {
    current = readFileSync(target, 'utf8')
  } catch {
    current = null
  }
  if (current !== csv) {
    console.error(`STALE: run node scripts/api/unused-hooks.mjs`)
    process.exit(1)
  }
  console.log(`OK: ${hooks.length} exported hooks · ${rows.length} with no consumer`)
} else {
  writeFileSync(target, csv)
  console.log(
    `Wrote ${OUT}: ${hooks.length} exported hooks · ${rows.length} with no consumer · ${consumerFiles.length} consumer files scanned`,
  )
  const withRoute = rows.filter((row) => row.server_route).length
  console.log(`  ${withRoute} of them name a server route (evidence in server_route_evidence)`)
}
