// ============================================
// packages/ui/src/__tests__/cloud-required.test.ts
//
// GATE 7: «این کار اینترنت می‌خواهد» (Offline Phase 7 verification)
//
// 1. Every C-class row in FEATURE_REGISTRY (execution === 'server') returns
//    requiresOnline: true and available: false when app edition is offline.
// 2. In cloud mode, behavior is unchanged (requiresOnline: false).
// 3. Hybrid features correctly distinguish local vs server parts.
// 4. Source audit: every UI container/component mapped in docs/offline/P7-0-PLAN.md
//    imports and invokes useActionAvailability with its registered key.
// 5. 0 HTTP requests are sent to the network when checking availability offline.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { apiClient, setAppEdition } from '@hisabche/api'
import { FEATURE_REGISTRY, type FeatureKey } from '@hisabche/validation'
import {
  checkActionAvailability,
  registerEntitlementContextProvider,
} from '../lib/capability/use-action-availability'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')

/** Comments describe the bugs; only code is asserted on. Flattened: formatter wraps. */
const cleanCode = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

describe('Gate 7: Offline Phase 7 — «این کار اینترنت می‌خواهد»', () => {
  beforeEach(() => {
    registerEntitlementContextProvider(null)
    setAppEdition('cloud')
    vi.restoreAllMocks()
  })

  describe('1. C-Class Feature Registry Guarding', () => {
    const serverFeatures = (
      Object.entries(FEATURE_REGISTRY) as [FeatureKey, (typeof FEATURE_REGISTRY)[FeatureKey]][]
    )
      .filter(([, def]) => def.execution === 'server')
      .map(([key]) => key)

    // 32 since 24 Oct 2026: `customer.outreach` («پیگیری و کمپین») joined — the device
    // has no follow-up, campaign or stale-sale engine, so the offline edition does not
    // offer that tab (see customers-hub-container).
    // 52 after the endpoint matrix (24 Oct 2026): every endpoint the client calls has a
    // feature, so the 20 cloud-only ones that had no row joined — price lists, budgets,
    // timesheets, expiry, fixed assets, automation, custom reports, …
    // 48 since the offline parity sessions (25 Oct): the till, pricing and the people/books
    // domains moved onto the device; 50 before that: the logo/stamp/signature section (settings.business_stamp) and
    // the dashboard suggestions (dashboard.ai_insight) run on the device now.
    it('has exactly 49 server-execution features in FEATURE_REGISTRY', () => {
      expect(serverFeatures.length).toBe(49)
    })

    it('refuses EVERY server-execution feature when offline with REQUIRES_ONLINE', () => {
      setAppEdition('offline')

      for (const feature of serverFeatures) {
        const result = checkActionAvailability(feature)
        expect(result.available, `Feature ${feature} must NOT be available offline`).toBe(false)
        expect(result.requiresOnline, `Feature ${feature} must require online connection`).toBe(
          true,
        )
        // `not_supported` is the matrix's own word for a feature the device can never have.
        expect(result.reason).toBe(
          result.offline === 'not_supported' ? 'not_supported' : 'offline_edition',
        )
        expect(result.verdict.kind).toBe('REQUIRES_ONLINE')
      }
    })

    it('allows server-execution features when online in cloud edition', () => {
      setAppEdition('cloud')

      for (const feature of serverFeatures) {
        const result = checkActionAvailability(feature)
        expect(
          result.requiresOnline,
          `Feature ${feature} must NOT require online in cloud edition`,
        ).toBe(false)
        expect(
          result.available,
          `Feature ${feature} should be available by default in cloud edition`,
        ).toBe(true)
      }
    })
  })

  describe('2. Hybrid Feature Handling', () => {
    const hybridFeatures = (
      Object.entries(FEATURE_REGISTRY) as [FeatureKey, (typeof FEATURE_REGISTRY)[FeatureKey]][]
    )
      .filter(([, def]) => def.execution === 'hybrid')
      .map(([key]) => key)

    it('has exactly 5 hybrid features in FEATURE_REGISTRY', () => {
      expect(hybridFeatures.length).toBe(5)
      expect(hybridFeatures).toEqual(
        expect.arrayContaining([
          'dashboard.work_queue',
          'product.images',
          'inventory.costing_method',
          'data.backup',
          'data.migration',
        ]),
      )
    })

    it('allows local part offline, but requires online for server part', () => {
      setAppEdition('offline')

      for (const feature of hybridFeatures) {
        const localResult = checkActionAvailability(feature, { part: 'local' })
        expect(
          localResult.available,
          `Hybrid feature ${feature} (local part) must be available offline`,
        ).toBe(true)
        expect(
          localResult.requiresOnline,
          `Hybrid feature ${feature} (local part) must NOT require online`,
        ).toBe(false)

        const serverResult = checkActionAvailability(feature, { part: 'server' })
        expect(
          serverResult.available,
          `Hybrid feature ${feature} (server part) must NOT be available offline`,
        ).toBe(false)
        expect(
          serverResult.requiresOnline,
          `Hybrid feature ${feature} (server part) must require online`,
        ).toBe(true)
        expect(serverResult.verdict.kind).toBe('REQUIRES_ONLINE')
      }
    })
  })

  describe('3. UI Source Audit: Every Mapped C Trigger Is Guarded', () => {
    const mappings: { file: string[]; key: FeatureKey }[] = [
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'ai',
          'containers',
          'ai-assistant-container.tsx',
        ],
        key: 'ai.assistant',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'manufacturing',
          'containers',
          'manufacturing-container.tsx',
        ],
        key: 'manufacturing.bom',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'manufacturing',
          'manufacturing-dashboard-card.tsx',
        ],
        key: 'dashboard.manufacturing_card',
      },
      {
        file: ['packages', 'ui', 'src', 'components', 'ui', 'dashboard', 'dashboard-view.tsx'],
        key: 'dashboard.ai_insight',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'customers',
          'customer-profile-panel.tsx',
        ],
        key: 'customer.documents',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'customers',
          'customer-portal-panel.tsx',
        ],
        key: 'customer.portal_link',
      },
      {
        file: ['packages', 'ui', 'src', 'components', 'ui', 'settings', 'settings-page.tsx'],
        key: 'settings.business_stamp',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'team-and-payroll',
          'attendance-devices.tsx',
        ],
        key: 'hr.attendance_devices',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'team-and-payroll',
          'attendance-link-dialog.tsx',
        ],
        key: 'hr.attendance_links',
      },
      {
        file: ['packages', 'ui', 'src', 'components', 'ui', 'analysis', 'peer-benchmark.tsx'],
        key: 'analysis.benchmark',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'bank',
          'containers',
          'bank-container.tsx',
        ],
        key: 'bank.import',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'developers',
          'containers',
          'developers-container.tsx',
        ],
        key: 'developer.keys',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'marketplace',
          'containers',
          'marketplace-container.tsx',
        ],
        key: 'marketplace.apps',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'market',
          'market-seller-container.tsx',
        ],
        key: 'storefront.public',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'billing',
          'containers',
          'billing-hub-container.tsx',
        ],
        key: 'billing.portal',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'permissions',
          'containers',
          'permissions-container.tsx',
        ],
        key: 'governance.permission_matrix',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'workflow',
          'containers',
          'approvals-container.tsx',
        ],
        key: 'approvals.workflows',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'conflicts',
          'containers',
          'conflicts-container.tsx',
        ],
        key: 'sync.conflicts',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'data-and-sync',
          'containers',
          'data-and-sync-container.tsx',
        ],
        key: 'sync.overview',
      },
      {
        file: ['packages', 'app-shell', 'src', 'features', 'sync', 'sync-page.tsx'],
        key: 'sync.push_pull',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'invoice-builder',
          'containers',
          'invoice-preview-container.tsx',
        ],
        key: 'invoice.recurring',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'invoice-detail',
          'containers',
          'invoice-detail-container.tsx',
        ],
        key: 'invoice.approval',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'manufacturing',
          'production-editor.tsx',
        ],
        key: 'manufacturing.produce',
      },
      {
        file: [
          'packages',
          'ui',
          'src',
          'components',
          'ui',
          'team-and-payroll',
          'containers',
          'team-and-payroll-container.tsx',
        ],
        key: 'team.members',
      },
    ]

    for (const { file, key } of mappings) {
      it(`guards ${key} in ${file[file.length - 1]} using useActionAvailability`, () => {
        const source = cleanCode(read(...file))
        expect(
          source,
          `${file.join('/')} must import and invoke useActionAvailability('${key}')`,
        ).toContain(`useActionAvailability('${key}')`)
      })
    }
  })

  describe('4. Zero HTTP Requests on C Actions When Offline', () => {
    it('sends 0 HTTP requests when checking or asserting C actions in offline edition', () => {
      setAppEdition('offline')

      const getSpy = vi.spyOn(apiClient, 'get')
      const postSpy = vi.spyOn(apiClient, 'post')
      const putSpy = vi.spyOn(apiClient, 'put')
      const deleteSpy = vi.spyOn(apiClient, 'delete')
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      // Check all the C features offline
      const serverFeatures = (
        Object.entries(FEATURE_REGISTRY) as [FeatureKey, (typeof FEATURE_REGISTRY)[FeatureKey]][]
      )
        .filter(([, def]) => def.execution === 'server')
        .map(([key]) => key)

      for (const feature of serverFeatures) {
        const result = checkActionAvailability(feature)
        expect(result.requiresOnline).toBe(true)
        expect(result.available).toBe(false)
      }

      // Assert 0 network requests occurred
      expect(getSpy).not.toHaveBeenCalled()
      expect(postSpy).not.toHaveBeenCalled()
      expect(putSpy).not.toHaveBeenCalled()
      expect(deleteSpy).not.toHaveBeenCalled()
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })
})
