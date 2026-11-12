#!/usr/bin/env node
// ============================================
// scripts/packs/emit-pack-map.mjs
//
// Generates `packages/app-shell/pack-map.generated.json` from the canonical
// pack registry (`packages/validation/src/schemas/feature-packs.ts`) so that
// `.mjs` Vite configs (`vite.shell.mjs`) can configure `manualChunks` without
// importing TypeScript at config load time.
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')
const registryPath = path.join(repoRoot, 'packages/validation/src/schemas/feature-packs.ts')
const outPath = path.join(repoRoot, 'packages/app-shell/pack-map.generated.json')

const registrySrc = fs.readFileSync(registryPath, 'utf8')
const packIdsMatch = registrySrc.match(/export const PACK_IDS = \[([\s\S]*?)\] as const/)
if (!packIdsMatch) {
  throw new Error('Could not parse PACK_IDS from feature-packs.ts')
}
const packIds = [...packIdsMatch[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1])

const packMatchers = {
  operations: [
    'packages/app-shell/src/features/inventory-ops/',
    'packages/app-shell/src/features/cycle-count/',
    'packages/ui/src/components/ui/inventory-ops/',
    'packages/ui/src/components/ui/cycle-count/',
    'packages/ui/src/components/ui/invoices/containers/sales-orders-container',
    'packages/ui/src/components/ui/invoices/containers/advances-container',
    'packages/ui/src/components/ui/purchasing/',
  ],
  manufacturing: [
    'packages/app-shell/src/features/manufacturing/',
    'packages/ui/src/components/ui/manufacturing/',
  ],
  workforce: [
    'packages/app-shell/src/features/team-and-payroll/',
    'packages/app-shell/src/features/human-resources/',
    'packages/ui/src/components/ui/team-and-payroll/',
    'packages/ui/src/components/ui/human-resources/',
    'packages/ui/src/components/ui/timesheets/',
    'packages/ui/src/components/ui/service-delivery/',
  ],
  approvals: [
    'packages/app-shell/src/features/approvals/',
    'packages/ui/src/components/ui/workflow/',
  ],
  intelligence: [
    'packages/app-shell/src/features/analysis/',
    'packages/app-shell/src/features/ai/',
    'packages/ui/src/components/ui/analysis/',
    'packages/ui/src/components/ui/ai/',
  ],
  marketplace: [
    'packages/app-shell/src/features/marketplace/',
    'packages/app-shell/src/features/market/',
    'packages/ui/src/components/ui/marketplace/',
    'packages/ui/src/components/ui/market/',
  ],
}

const payload = {
  generatedAt: new Date().toISOString(),
  packIds,
  packMatchers,
  localeChunks: {
    'packages/i18n/messages/fa/common.json': 'locale-fa',
    'packages/i18n/messages/af/common.json': 'locale-af',
    'packages/i18n/messages/en/common.json': 'locale-en',
  },
}

fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8')
console.log(`[emit-pack-map] wrote ${path.relative(repoRoot, outPath)} (${packIds.length} packs)`)
