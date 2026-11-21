import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../../')
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8')
const flat = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
const count = (s: string, needle: string) => s.split(needle).length - 1

describe('Customers hub unification', () => {
  it('customers owns exactly one rendering of each subscription panel', () => {
    const customers = flat(read('app/[lang]/(admin)/customers/customers-client.tsx'))
    expect(count(customers, '<UpgradeRequestsPanel />')).toBe(1)
    expect(count(customers, '<PlanLimitsPanel />')).toBe(1)
    expect(customers).not.toContain('SubscriptionsClient')
  })

  it('revenue keeps only financial tabs', () => {
    const revenue = flat(read('app/[lang]/(admin)/revenue/revenue-client.tsx'))
    for (const gone of [
      'SubscriptionsClient',
      'UpgradeRequestsPanel',
      'PlanLimitsPanel',
      "'subscriptions'",
    ]) {
      expect(revenue, gone).not.toContain(gone)
    }
    for (const kept of ["'plans'", "'ledger'", "'maker_checker'", "'wallet'", "'gateways'"]) {
      expect(revenue, kept).toContain(kept)
    }
  })

  it('there is one canonical URL for workspaces and subscriptions', () => {
    const proxy = flat(read('proxy.ts'))
    const config = flat(read('next.config.js'))
    const page = flat(read('app/[lang]/(admin)/subscriptions/page.tsx'))
    const header = flat(read('components/admin-shell/admin-header.tsx'))
    const dash = flat(read('app/[lang]/(admin)/dashboard/dashboard-client.tsx'))
    expect(proxy).toContain("'/subscriptions': '/customers?tab=workspaces'")
    expect(config).toContain("destination: '/:lang/customers?tab=workspaces'")
    expect(page).toContain('/${lang}/customers?tab=workspaces')
    expect(header).not.toContain('/revenue?tab=subscriptions')
    expect(dash).not.toContain('/revenue?tab=subscriptions')
    expect(
      fs.existsSync(path.join(root, 'app/[lang]/(admin)/subscriptions/subscriptions-client.tsx')),
    ).toBe(false)
  })

  it('the workspace card carries subscription info and expired controls', () => {
    const row = flat(read('components/workspaces/workspace-row.tsx'))
    expect(row).toContain('data-expired=')
    expect(row).toContain('subscriptionPeriodEnd')
    expect(row).toContain("expired ? 'expired'")
    expect(row).toContain('admin.subscriptions.expiredAlert')
    expect(row).toContain('admin.subscriptions.resetSubscription')
    expect(row).toContain('useUpdateSubscriptionPlan')
    expect(row).toContain('useUpdateSubscriptionStatus')
    expect(row).toContain('STATUSES.map')
    expect(row).toContain('PLANS.map')
  })

  it('the backend enriches the workspace page with subscription identity and lifecycle', () => {
    const svc = flat(read('../../backend/src/services/admin.service.ts'))
    expect(svc).toContain(
      'id, workspace_id, plan, status, period_end, is_trial, trial_ends_at, cancel_at_period_end',
    )
    expect(svc).toContain('subscriptionId: subscription?.id ?? null')
    expect(svc).toContain('cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? null')
  })

  it('every new key exists in fa, af and en', () => {
    const keys = [
      'admin.hubs.customers.subscriptions',
      'admin.hubs.customers.upgradeRequests',
      'admin.hubs.customers.planLimits',
      'admin.hubs.customers.open360',
      'admin.subscriptions.resetReason',
      'admin.subscriptions.upgradeReason',
      'admin.subscriptions.changeReason',
      'admin.subscriptions.managementTitle',
      'admin.subscriptions.expiredAlert',
      'admin.subscriptions.resetSubscription',
    ]
    for (const locale of ['fa', 'af', 'en'] as const) {
      const bundle = JSON.parse(
        fs.readFileSync(
          path.resolve(root, `../../packages/i18n/messages/${locale}/common.json`),
          'utf8',
        ),
      )
      let node: unknown = bundle
      for (const key of keys) {
        node = bundle
        for (const part of key.split('.')) {
          if (typeof node !== 'object' || node === null) {
            node = undefined
            break
          }
          node = (node as Record<string, unknown>)[part]
        }
        expect(typeof node, `${locale}:${key}`).toBe('string')
      }
    }
  })
})
