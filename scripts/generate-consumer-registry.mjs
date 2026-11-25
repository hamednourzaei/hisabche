#!/usr/bin/env node
// ============================================
// scripts/generate-consumer-registry.mjs
//
// Domain 6.1 — Machine-readable Consumer Registry:
// Scans all backend routes, classifies each endpoint by consumer type
// (UI-connected, public/webhook, admin/internal, infra/health, sync, or
// no direct UI caller), and writes `docs/architecture/CONSUMER-REGISTRY.json`.
// ============================================

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHECK_ONLY = process.argv.includes('--check')
const OUT = 'docs/architecture/CONSUMER-REGISTRY.json'

const ROUTES_DIR = path.join(ROOT, 'backend/src/routes')
const CALLER_DIRS = [
  'packages/api/src',
  'packages/ui/src',
  'packages/app-shell/src',
  'apps/web/src',
  'apps/admin/src',
  'apps/desktop/src',
  'apps/mobile/src',
]

function walkTs(dir) {
  if (!existsSync(dir)) return []
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue
      files.push(...walkTs(full))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

const clientCorpus = CALLER_DIRS.flatMap((d) => walkTs(path.join(ROOT, d)))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')

function classifyRoute(routeFile, routePath) {
  if (
    routePath.startsWith('/api/health') ||
    routePath.startsWith('/api/metrics') ||
    routeFile === 'debug.routes.ts'
  ) {
    return 'HEALTH_OR_INFRA'
  }
  if (
    routePath.startsWith('/api/public') ||
    routePath.includes('/webhook') ||
    routeFile === 'oauth.routes.ts'
  ) {
    return 'PUBLIC_OR_WEBHOOK'
  }
  if (routePath.startsWith('/api/admin') || routeFile.startsWith('admin')) {
    return 'ADMIN_OR_INTERNAL'
  }
  if (routePath.startsWith('/api/sync')) {
    return 'SYNC_OR_OFFLINE'
  }
  // Normalize `:param` segments to match client template strings
  const normalized = routePath.replace(/\/:[a-zA-Z0-9_]+/g, '')
  const tail = normalized.split('/').filter(Boolean).slice(-2).join('/')
  if (clientCorpus.includes(routePath) || (tail.length > 3 && clientCorpus.includes(tail))) {
    return 'CONNECTED_TO_UI'
  }
  return 'NO_DIRECT_UI_CALLER'
}

const routeFiles = readdirSync(ROUTES_DIR)
  .filter((f) => f.endsWith('.routes.ts'))
  .sort()
const endpoints = []

for (const file of routeFiles) {
  const text = readFileSync(path.join(ROUTES_DIR, file), 'utf8')
  const regex = /fastify\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g
  let match
  while ((match = regex.exec(text)) !== null) {
    const method = match[1].toUpperCase()
    const rawPath = match[2]
    const fullPath = rawPath.startsWith('/api')
      ? rawPath
      : `/api${rawPath.startsWith('/') ? '' : '/'}${rawPath}`
    const classification = classifyRoute(file, fullPath)
    endpoints.push({
      routeFile: `backend/src/routes/${file}`,
      method,
      path: fullPath,
      classification,
      tenantScoped: !fullPath.startsWith('/api/public') && !fullPath.startsWith('/api/health'),
    })
  }
}

const counts = endpoints.reduce((acc, ep) => {
  acc[ep.classification] = (acc[ep.classification] ?? 0) + 1
  return acc
}, {})

const registry = {
  schemaVersion: 1,
  totalEndpoints: endpoints.length,
  counts,
  endpoints,
}

const serialized = JSON.stringify(registry, null, 2) + '\n'
const outPath = path.join(ROOT, OUT)

if (CHECK_ONLY) {
  if (!existsSync(outPath) || readFileSync(outPath, 'utf8') !== serialized) {
    console.error('STALE: run node scripts/generate-consumer-registry.mjs')
    process.exit(1)
  }
  console.log(`OK: ${registry.totalEndpoints} endpoints classified`)
} else {
  writeFileSync(outPath, serialized)
  console.log(`Wrote ${OUT}: ${registry.totalEndpoints} endpoints classified`, counts)
}
