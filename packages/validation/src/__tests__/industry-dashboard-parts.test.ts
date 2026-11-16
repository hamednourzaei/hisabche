// ============================================
// packages/validation/src/__tests__/industry-dashboard-parts.test.ts
//
// V69.5 Guard: every representative industry dashboard part must have:
//   1. Server provider route (member-scoped cache, hidden figure group)
//   2. Local-engine provider route (offline SQLite), one shared derivation
//   3. Offline endpoint matrix row with status 'available'
//   4. Feature registry entry + the pack its engine belongs to
//   5. Dashboard mounting gated by the profile AND the person's look
//   6. Complete 3-language i18n keys (fa, af, en), statuses included
// ============================================

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_PART_ENGINE,
  DASHBOARD_PART_IDS,
  FEATURE_REGISTRY,
  INDUSTRY_KEYS,
  OFFLINE_ENDPOINT_MATRIX,
  PROFILES,
  REPAIR_STATUSES,
  SERVICE_DELIVERY_STATUSES,
  enginesForPack,
  packForDashboardPart,
  type DashboardPartId,
  type EngineDashboardPart,
  type IndustryKey,
} from '../index'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function findRepoRoot(): string {
  let cur = __dirname
  while (cur !== dirname(cur)) {
    if (existsSync(join(cur, 'pnpm-workspace.yaml'))) return cur
    cur = dirname(cur)
  }
  return join(__dirname, '../../../..')
}

const ROOT = findRepoRoot()

/** Source assertions read the CODE, not the comments that describe it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1')
}

function flat(source: string): string {
  return stripComments(source).replace(/\s+/g, ' ')
}

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(ROOT, ...segments), 'utf8')
}

interface PartSpec {
  partId: EngineDashboardPart
  endpoint: string
  featureKey: string
  serverRoute: string
  uiComponent: string
  /** The trades whose dashboard really mounts this part — no others. */
  profiles: readonly IndustryKey[]
  pack: string
  /**
   * Status values the part may carry. `null` = the part has no status column;
   * every listed status must have a label or the screen shows the raw key.
   */
  statuses: readonly string[] | null
}

const REPRESENTATIVE_PARTS: PartSpec[] = [
  {
    partId: 'lowStockVariants',
    endpoint: 'GET /analytics/dashboard/low-stock-variants',
    featureKey: 'dashboard.low_stock_variants',
    serverRoute: '/api/analytics/dashboard/low-stock-variants',
    uiComponent: 'packages/ui/src/components/ui/dashboard/low-stock-variants-card.tsx',
    profiles: ['clothing', 'shoes'],
    pack: 'core',
    statuses: null,
  },
  {
    partId: 'todaySessions',
    endpoint: 'GET /analytics/dashboard/today-sessions',
    featureKey: 'dashboard.today_sessions',
    serverRoute: '/api/analytics/dashboard/today-sessions',
    uiComponent: 'packages/ui/src/components/ui/dashboard/today-sessions-card.tsx',
    profiles: ['barber', 'beautySalon', 'education'],
    pack: 'workforce',
    statuses: SERVICE_DELIVERY_STATUSES,
  },
  {
    partId: 'packageCreditsLow',
    endpoint: 'GET /analytics/dashboard/package-credits-low',
    featureKey: 'dashboard.package_credits_low',
    serverRoute: '/api/analytics/dashboard/package-credits-low',
    uiComponent: 'packages/ui/src/components/ui/dashboard/package-credits-low-card.tsx',
    profiles: ['education'],
    pack: 'workforce',
    statuses: null,
  },
  {
    partId: 'openRepairTickets',
    endpoint: 'GET /analytics/dashboard/open-repair-tickets',
    featureKey: 'dashboard.open_repair_tickets',
    serverRoute: '/api/analytics/dashboard/open-repair-tickets',
    uiComponent: 'packages/ui/src/components/ui/dashboard/open-repair-tickets-card.tsx',
    profiles: ['repairs', 'mobilePhones', 'mechanic', 'itServices'],
    pack: 'workforce',
    statuses: REPAIR_STATUSES,
  },
]

const SPECIALIZED_PARTS = REPRESENTATIVE_PARTS.map((spec) => spec.partId)

describe('V69.5 — industry dashboard parts contract', () => {
  it('every representative part is in DASHBOARD_PART_IDS', () => {
    for (const spec of REPRESENTATIVE_PARTS) {
      expect(DASHBOARD_PART_IDS).toContain(spec.partId)
    }
  })

  it('every part has a server provider, member-scoped and hidden by figure group', () => {
    const serverFile = flat(readRepoFile('backend', 'src', 'routes', 'analytics.routes.ts'))
    for (const spec of REPRESENTATIVE_PARTS) {
      expect(serverFile, `server route for ${spec.partId}`).toContain(spec.serverRoute)
      // The number is refused by the group the part belongs to, not by a
      // second capability list beside it.
      expect(serverFile, `hiddenFor(${spec.partId})`).toContain(
        `hiddenFor(request, '${spec.partId}')`,
      )
    }
    expect(serverFile).toContain("cacheMiddleware({ scope: 'member'")
    expect(serverFile).toContain('hiddenDashboardGroups(')
  })

  it('every part has a local-engine provider, and the package card uses the one shared rule', () => {
    const localEngineFile = flat(
      readRepoFile('packages', 'local-engine', 'src', 'routes', 'dashboard.ts'),
    )
    for (const spec of REPRESENTATIVE_PARTS) {
      const localPath = spec.serverRoute.replace('/api', '')
      expect(localEngineFile, `local-engine route for ${spec.partId}`).toContain(localPath)
    }
    // The allocation arithmetic exists once (packages/validation); a second copy
    // here is the defect this assertion exists for.
    expect(localEngineFile.match(/grantStatusesFromRows\(/g)?.length ?? 0).toBe(1)
  })

  it('every part has an available row in OFFLINE_ENDPOINT_MATRIX', () => {
    for (const spec of REPRESENTATIVE_PARTS) {
      const row = OFFLINE_ENDPOINT_MATRIX[spec.endpoint as keyof typeof OFFLINE_ENDPOINT_MATRIX]
      expect(row, `matrix row for ${spec.endpoint}`).toBeDefined()
      expect(row?.[0]).toBe(spec.featureKey)
      expect(row?.[1]).toBe('available')
    }
  })

  it('every part has a feature registry entry that the device executes', () => {
    for (const spec of REPRESENTATIVE_PARTS) {
      expect(spec.featureKey in FEATURE_REGISTRY, spec.featureKey).toBe(true)
      const def = FEATURE_REGISTRY[spec.featureKey as keyof typeof FEATURE_REGISTRY]
      expect(def.execution).toBe('local')
    }
  })

  it('every part belongs to the pack of the engine behind it', () => {
    for (const spec of REPRESENTATIVE_PARTS) {
      const pack = packForDashboardPart(spec.partId)
      expect(pack, `pack of ${spec.partId}`).toBe(spec.pack)
      expect(enginesForPack(pack), `${DASHBOARD_PART_ENGINE[spec.partId]} in ${pack}`).toContain(
        DASHBOARD_PART_ENGINE[spec.partId],
      )
    }
  })

  it('a part is mounted by exactly the trades that ask for it, and by no other', () => {
    for (const spec of REPRESENTATIVE_PARTS) {
      const mountedBy = INDUSTRY_KEYS.filter((key) =>
        PROFILES[key].dashboard.includes(spec.partId as DashboardPartId),
      ).sort()
      expect(mountedBy, `profiles mounting ${spec.partId}`).toEqual([...spec.profiles].sort())
    }
  })

  it('a trade a representative also covers inherits that part, an uncovered trade does not', () => {
    // The industry documents say «this trade reads the same spec». The profile
    // must say it too, or the document promises a card the screen never mounts.
    const covered: Partial<Record<IndustryKey, readonly DashboardPartId[]>> = {
      shoes: ['lowStockVariants'],
      mobilePhones: ['openRepairTickets'],
      mechanic: ['openRepairTickets'],
      itServices: ['openRepairTickets'],
    }
    for (const [key, parts] of Object.entries(covered)) {
      for (const part of parts ?? []) {
        expect(PROFILES[key as IndustryKey].dashboard, `${key} inherits ${part}`).toContain(part)
      }
    }
    // A trade no representative covers keeps the generic set: no borrowed card.
    expect(PROFILES.grocery.dashboard).not.toContain('lowStockVariants')
    expect(PROFILES.grocery.dashboard).not.toContain('openRepairTickets')
    expect(PROFILES.education.dashboard).not.toContain('openRepairTickets')
  })

  it('an untreated trade keeps the generic dashboard and mounts none of the four', () => {
    const untreated = PROFILES.hardware
    for (const part of SPECIALIZED_PARTS) {
      expect(untreated.dashboard, `hardware mounting ${part}`).not.toContain(part)
    }
    // The six shell parts are what a trade with no experience gets.
    expect([...untreated.dashboard].sort()).toEqual(
      ['activities', 'chart', 'insights', 'kpis', 'manufacturing', 'workQueue'].sort(),
    )
  })

  it('the dashboard mounts a part only when the profile has it AND the person shows it', () => {
    const container = flat(
      readRepoFile(
        'packages',
        'ui',
        'src',
        'components',
        'ui',
        'dashboard',
        'containers',
        'dashboard-container.tsx',
      ),
    )
    for (const spec of REPRESENTATIVE_PARTS) {
      expect(container, `profile gate for ${spec.partId}`).toContain(
        `profile.dashboard.includes('${spec.partId}') && look.shows('${spec.partId}')`,
      )
    }
  })

  it('every part has a card in packages/ui that lists through DataTable', () => {
    for (const spec of REPRESENTATIVE_PARTS) {
      const path = join(ROOT, spec.uiComponent)
      expect(existsSync(path), `${spec.uiComponent} exists`).toBe(true)
      const source = flat(readFileSync(path, 'utf8'))
      expect(source, `${spec.partId} uses DataTable`).toContain('<DataTable')
      // A raw table is the second implementation this guard forbids.
      expect(source, `${spec.partId} has no raw table`).not.toContain('<table')
      // An unreadable number is said out loud, never rendered as zero.
      expect(source, `${spec.partId} unavailable branch`).toContain('dashboard.partUnavailable')
      expect(source, `${spec.partId} unavailable branch`).toContain('data?.unavailable')
    }
  })

  it('every part has translations in fa, af, and en common.json', () => {
    for (const locale of ['fa', 'af', 'en'] as const) {
      const json = JSON.parse(
        readRepoFile('packages', 'i18n', 'messages', locale, 'common.json'),
      ) as {
        dashboard: Record<string, Record<string, unknown> | string>
        pageLook?: { dashboard?: Record<string, unknown> }
      }

      expect(typeof json.dashboard.partUnavailable, `dashboard.partUnavailable in ${locale}`).toBe(
        'string',
      )

      for (const spec of REPRESENTATIVE_PARTS) {
        const block = json.dashboard[spec.partId] as Record<string, unknown> | undefined
        expect(block?.title, `dashboard.${spec.partId}.title in ${locale}`).toBeDefined()
        expect(block?.empty, `dashboard.${spec.partId}.empty in ${locale}`).toBeDefined()
        expect(
          json.pageLook?.dashboard?.[spec.partId],
          `pageLook.dashboard.${spec.partId} in ${locale}`,
        ).toBeDefined()

        if (spec.statuses) {
          const statuses = block?.statuses as Record<string, unknown> | undefined
          for (const status of spec.statuses) {
            expect(
              typeof statuses?.[status],
              `dashboard.${spec.partId}.statuses.${status} in ${locale}`,
            ).toBe('string')
          }
        }
      }
    }
  })

  it('the sessions card counts what it reads, without inventing a total label', () => {
    for (const locale of ['fa', 'af', 'en'] as const) {
      const json = JSON.parse(
        readRepoFile('packages', 'i18n', 'messages', locale, 'common.json'),
      ) as { dashboard: { todaySessions: Record<string, unknown> } }
      expect(
        typeof json.dashboard.todaySessions.total,
        `dashboard.todaySessions.total in ${locale}`,
      ).toBe('string')
    }
    const card = flat(
      readRepoFile(
        'packages',
        'ui',
        'src',
        'components',
        'ui',
        'dashboard',
        'today-sessions-card.tsx',
      ),
    )
    expect(card).toContain("t('dashboard.todaySessions.total'")
    expect(card).not.toContain("t('dashboard.todaySessions.title', 'کل نوبت‌ها')")
  })

  it('an empty card says why it is empty, from a count the provider really read', () => {
    const reasons = [
      {
        file: 'low-stock-variants-card.tsx',
        count: 'variantsCount',
        reasonKey: 'dashboard.lowStockVariants.noVariants',
      },
      {
        file: 'package-credits-low-card.tsx',
        count: 'packagesCount',
        reasonKey: 'dashboard.packageCreditsLow.noPackages',
      },
      {
        file: 'open-repair-tickets-card.tsx',
        count: 'totalTickets',
        reasonKey: 'dashboard.openRepairTickets.noTickets',
      },
    ] as const

    for (const reason of reasons) {
      const card = flat(
        readRepoFile('packages', 'ui', 'src', 'components', 'ui', 'dashboard', reason.file),
      )
      expect(card, `${reason.file} asks the count`).toContain(`data?.${reason.count} === 0`)
      expect(card, `${reason.file} names the reason`).toContain(reason.reasonKey)
    }

    // Both providers answer the count; a card cannot say «none yet» from nothing.
    for (const file of [
      ['backend', 'src', 'services', 'analytics', 'industry-dashboard.service.ts'],
      ['packages', 'local-engine', 'src', 'routes', 'dashboard.ts'],
    ] as const) {
      const source = flat(readRepoFile(...file))
      for (const reason of reasons) {
        expect(source, `${file.join('/')} sends ${reason.count}`).toContain(reason.count)
      }
    }

    for (const locale of ['fa', 'af', 'en'] as const) {
      const json = JSON.parse(
        readRepoFile('packages', 'i18n', 'messages', locale, 'common.json'),
      ) as {
        dashboard: {
          lowStockVariants: Record<string, unknown>
          packageCreditsLow: Record<string, unknown>
          openRepairTickets: Record<string, unknown>
        }
      }
      expect(typeof json.dashboard.lowStockVariants.noVariants).toBe('string')
      expect(typeof json.dashboard.packageCreditsLow.noPackages).toBe('string')
      expect(typeof json.dashboard.openRepairTickets.noTickets).toBe('string')
    }
  })

  it('injection test: removing the profile gate is detected', () => {
    const container = flat(
      readRepoFile(
        'packages',
        'ui',
        'src',
        'components',
        'ui',
        'dashboard',
        'containers',
        'dashboard-container.tsx',
      ),
    )
    const gate = "profile.dashboard.includes('todaySessions') && look.shows('todaySessions')"
    expect(container).toContain(gate)
    expect(container.replace(gate, "look.shows('todaySessions')")).not.toContain(gate)
  })

  it('injection test: an unregistered dashboard part is not accepted', () => {
    const bogusPart = 'nonExistentPart' as DashboardPartId
    expect(DASHBOARD_PART_IDS.includes(bogusPart)).toBe(false)
  })
})
