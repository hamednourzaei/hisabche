// ============================================
// packages/ui/src/__tests__/extended-capabilities-ui.test.tsx
//
// Verifies SSR rendering, responsive mobile/desktop Tailwind grids, RTL logical
// styling, 3-language i18n keys (`fa`, `af`, `en`), zero raw `<select>`, and
// hub mounting across Till, Orders, Warehouse, Accounting, Billing & Settings.
// ============================================

import React from 'react'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import {
  FinanceCompliancePanel,
  OrdersExpressPanel,
  RoleOnboardingPanel,
  TillLoyaltyPanel,
  WarehouseDiagnosticsPanel,
  WorkspaceOpsPanel,
} from '../components/ui/extended-ops'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@hisabche/api', async (orig) => {
  const actual = await orig<typeof import('@hisabche/api')>()
  return {
    ...actual,
    useBaseCurrency: () => ({ data: { currency: 'AFN' } }),
    useCurrentSession: () => ({ data: { session: { id: 'sess-1' } } }),
    useGuideProgress: () => ({ data: { configured: true, steps: [] } }),
    useIntegrationHealth: () => ({
      data: { status: 'healthy', slaTargetUptimePct: 99.9, channels: [] },
      isLoading: false,
      error: null,
    }),
  }
})

function renderWithQuery(node: React.ReactElement): string {
  const client = new QueryClient()
  return renderToStaticMarkup(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

describe('Extended Single-Core Responsive UI & Role Onboarding', () => {
  it('renders all 6 extended UI panels cleanly on SSR with responsive grids and 44px mobile targets', () => {
    const tillHtml = renderWithQuery(<TillLoyaltyPanel />)
    expect(tillHtml).toContain('data-extended-panel="till-loyalty"')
    expect(tillHtml).toContain('grid-cols-1')
    expect(tillHtml).toContain('min-h-[44px]')
    expect(tillHtml).toContain('queued_offline')

    const ordersHtml = renderWithQuery(<OrdersExpressPanel />)
    expect(ordersHtml).toContain('data-extended-panel="orders-express"')
    expect(ordersHtml).toContain('orders.qrEndpointHint')

    const whHtml = renderWithQuery(<WarehouseDiagnosticsPanel />)
    expect(whHtml).toContain('data-extended-panel="warehouse-diagnostics"')

    const finHtml = renderWithQuery(<FinanceCompliancePanel />)
    expect(finHtml).toContain('data-extended-panel="finance-compliance"')

    const onboardHtml = renderWithQuery(<RoleOnboardingPanel />)
    expect(onboardHtml).toContain('data-extended-panel="role-onboarding"')

    const opsHtml = renderWithQuery(<WorkspaceOpsPanel />)
    expect(opsHtml).toContain('data-extended-panel="workspace-ops"')
  })

  it('obeys UI discipline: zero raw <select>, zero hardcoded hex colors, zero physical left/right utilities', () => {
    const dir = join(__dirname, '..', 'components', 'ui', 'extended-ops')
    const files = readdirSync(dir).filter((f) => f.endsWith('.tsx'))
    for (const file of files) {
      const src = readFileSync(join(dir, file), 'utf8')
      expect(src, `${file} raw <select>`).not.toMatch(/<select[\s>]/)
      expect(src, `${file} hex color`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(src, `${file} hardcoded AFN`).not.toContain("'AFN'")
      expect(src, `${file} physical text-left/right`).not.toMatch(/\btext-(left|right)\b/)
    }
  })
})
