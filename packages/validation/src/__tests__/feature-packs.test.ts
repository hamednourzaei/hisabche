import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { NAV_CONTRACT } from '../../../ui-contract/src/navigation'
import {
  ENGINES,
  ENGINE_KEYS,
  FEATURE_PACKS,
  PACK_IDS,
  composeBusinessSolution,
  packsForPlan,
  syncEntitiesForPacks,
  syncEntitySchema,
  type PackId,
} from '../index'

const APP_TSX_PATH = path.resolve(__dirname, '../../../app-shell/src/app/app.tsx')

function extractAppShellLazyRoutePaths(): string[] {
  const src = fs.readFileSync(APP_TSX_PATH, 'utf8')
  const paths: string[] = []
  const routeBlocks = src.matchAll(
    /\{\s*(index:\s*true|path:\s*'([^']+)')[\s\S]*?element:\s*([^\n]+)/g,
  )
  for (const match of routeBlocks) {
    const isIndex = Boolean(match[1]?.startsWith('index'))
    const rawPath = match[2]
    const elementStart = match[3] ?? ''
    if (elementStart.includes('<Navigate ') || elementStart.includes('<Legacy')) continue
    if (rawPath === '*') continue
    if (isIndex) {
      paths.push('/')
    } else if (rawPath) {
      paths.push(rawPath.startsWith('/') ? rawPath : `/${rawPath}`)
    }
  }
  return [...new Set(paths)]
}

describe('FEATURE_PACKS registry (V62 Slice 1)', () => {
  it('assigns every app-shell non-redirect route to exactly one pack', () => {
    const appRoutes = extractAppShellLazyRoutePaths()
    expect(appRoutes.length).toBeGreaterThanOrEqual(30)

    const routeOwners = new Map<string, PackId[]>()
    for (const packId of PACK_IDS) {
      for (const r of FEATURE_PACKS[packId].routes) {
        const owners = routeOwners.get(r) ?? []
        owners.push(packId)
        routeOwners.set(r, owners)
      }
    }

    for (const route of appRoutes) {
      const owners = routeOwners.get(route) ?? []
      expect(owners, `Route ${route} should belong to exactly one pack`).toHaveLength(1)
    }
  })

  it('assigns every NAV_CONTRACT item to exactly one pack', () => {
    const navOwners = new Map<string, PackId[]>()
    for (const packId of PACK_IDS) {
      for (const navId of FEATURE_PACKS[packId].navItems) {
        const owners = navOwners.get(navId) ?? []
        owners.push(packId)
        navOwners.set(navId, owners)
      }
    }

    for (const item of NAV_CONTRACT) {
      const owners = navOwners.get(item.id) ?? []
      expect(owners, `Nav item ${item.id} should belong to exactly one pack`).toHaveLength(1)
    }
  })

  it('assigns every syncEntitySchema value to core or exactly one pack', () => {
    const entityOwners = new Map<string, PackId[]>()
    for (const packId of PACK_IDS) {
      for (const entity of FEATURE_PACKS[packId].syncEntities) {
        const owners = entityOwners.get(entity) ?? []
        owners.push(packId)
        entityOwners.set(entity, owners)
      }
    }

    for (const entity of syncEntitySchema.options) {
      const owners = entityOwners.get(entity) ?? []
      expect(owners, `Sync entity ${entity} must belong to exactly one pack`).toHaveLength(1)
    }
  })

  it('assigns every ENGINES entry to a valid pack', () => {
    for (const key of ENGINE_KEYS) {
      expect(PACK_IDS).toContain(ENGINES[key].pack)
    }
  })

  it('has an acyclic dependsOn graph', () => {
    const visiting = new Set<PackId>()
    const visited = new Set<PackId>()

    const dfs = (id: PackId) => {
      expect(visiting.has(id), `Cycle detected at ${id}`).toBe(false)
      if (visited.has(id)) return
      visiting.add(id)
      for (const dep of FEATURE_PACKS[id].dependsOn) {
        expect(PACK_IDS).toContain(dep)
        dfs(dep)
      }
      visiting.delete(id)
      visited.add(id)
    }

    for (const id of PACK_IDS) dfs(id)
  })

  it('keeps local SQLite schema migrations exclusively in core', () => {
    expect(FEATURE_PACKS.core.holdsLocalSchema).toBe(true)
    for (const id of PACK_IDS) {
      if (id !== 'core') {
        expect(FEATURE_PACKS[id].holdsLocalSchema).toBe(false)
      }
    }
  })

  it('derives packsForPlan from composeBusinessSolution and narrows sync entities', () => {
    const retailPlan = composeBusinessSolution({
      holdsStock: 'yes',
      producesGoods: 'no',
    })
    const packs = packsForPlan(retailPlan)
    expect(packs).toContain('core')
    const entities = syncEntitiesForPacks(['core'])
    expect(entities).toContain('invoice')
    expect(entities).not.toContain('time_entry')
    expect(entities).not.toContain('order_deposits')
  })
})
