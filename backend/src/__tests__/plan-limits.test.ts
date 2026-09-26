// Plan limits: built-in default ← admin's plan setting ← admin's workspace
// setting — and, since 26 Sep 2026, ENFORCED. `checkUsageLimit` existed and
// nothing called it: a free workspace created unlimited invoices.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = {
  sub: { plan: 'free', is_trial: false } as { plan: string; is_trial: boolean } | null,
  planLimits: {} as Record<string, unknown>,
  wsLimits: null as Record<string, unknown> | null,
  counts: { invoices: 0, workspace_members: 0 } as Record<string, number>,
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      for (const m of ['eq', 'order', 'limit']) q[m] = () => q
      q.select = (_cols: string, opts?: { head?: boolean }) => {
        if (opts?.head) {
          const head: Record<string, unknown> = {
            eq: async () => ({ count: db.counts[table] ?? 0, error: null }),
          }
          return head
        }
        return q
      }
      q.maybeSingle = async () => {
        if (table === 'subscriptions') return { data: db.sub, error: null }
        if (table === 'plan_limit_settings') return { data: { limits: db.planLimits }, error: null }
        if (table === 'workspace_limit_overrides')
          return { data: db.wsLimits ? { limits: db.wsLimits } : null, error: null }
        return { data: null, error: null }
      }
      return q
    },
  },
}))
vi.mock('../utils/pagination', () => ({
  memoryCache: {
    getShared: async () => null,
    setShared: async () => {},
    invalidate: async () => {},
  },
}))

const limits = await import('../services/plan-limits.service')

beforeEach(() => {
  db.sub = { plan: 'free', is_trial: false }
  db.planLimits = {}
  db.wsLimits = null
  db.counts = { invoices: 0, workspace_members: 0 }
})

describe('layers', () => {
  it('built-in defaults when nothing is set', async () => {
    expect(await limits.effectiveLimits('ws', 'free')).toEqual({
      invoices: 10,
      users: 1,
      aiMonthly: 20,
    })
  })

  it('the plan setting replaces a default; null there means unlimited', async () => {
    db.planLimits = { invoices: 50, users: null }
    expect(await limits.effectiveLimits('ws', 'free')).toEqual({
      invoices: 50,
      users: null,
      aiMonthly: 20,
    })
  })

  it('the workspace setting wins over the plan; an absent key inherits', async () => {
    db.planLimits = { invoices: 50 }
    db.wsLimits = { invoices: 3 }
    expect(await limits.effectiveLimits('ws', 'free')).toEqual({
      invoices: 3,
      users: 1,
      aiMonthly: 20,
    })
  })

  it('junk in the stored json is ignored, not trusted', () => {
    expect(
      limits.cleanPatch({ invoices: -1, users: 2.5, aiMonthly: 'x', other: 9, extra: null }),
    ).toEqual({})
  })
})

describe('⚠️ enforcement', () => {
  it('the 11th invoice on the free plan is refused with 402 and the numbers', async () => {
    db.counts.invoices = 10
    await expect(limits.assertWithinLimit('ws', 'invoices')).rejects.toMatchObject({
      statusCode: 402,
      code: 'PLAN_LIMIT_REACHED',
      feature: 'invoices',
      limit: 10,
      used: 10,
    })
  })

  it('the 10th is allowed', async () => {
    db.counts.invoices = 9
    await expect(limits.assertWithinLimit('ws', 'invoices')).resolves.toBeUndefined()
  })

  it('a trial is never limited', async () => {
    db.sub = { plan: 'free', is_trial: true }
    db.counts.invoices = 999
    await expect(limits.assertWithinLimit('ws', 'invoices')).resolves.toBeUndefined()
  })

  it('unlimited (null) is never refused', async () => {
    db.sub = { plan: 'pro', is_trial: false }
    db.counts.invoices = 1_000_000
    await expect(limits.assertWithinLimit('ws', 'invoices')).resolves.toBeUndefined()
  })

  it('members: a second member on the free plan is refused', async () => {
    db.counts.workspace_members = 1
    await expect(limits.assertWithinLimit('ws', 'users')).rejects.toMatchObject({
      feature: 'users',
      limit: 1,
    })
  })
})

describe('wiring', () => {
  const code = (p: string) =>
    readFileSync(join(__dirname, '..', p), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

  it('invoice creation checks the ceiling AFTER the replay check (a resent offline sale is never refused)', () => {
    const src = code('services/invoice.service.ts')
    const replay = src.indexOf('idempotentReplay: true')
    const check = src.indexOf("assertWithinLimit(workspaceId, 'invoices')")
    expect(replay).toBeGreaterThan(0)
    expect(check).toBeGreaterThan(replay)
  })

  it('invites check the member ceiling', () => {
    expect(code('services/workspace.service.ts')).toContain(
      "assertWithinLimit(data.workspaceId, 'users')",
    )
  })

  it('the routes answer 402 with the numbers, not a 500', () => {
    for (const route of ['routes/invoice.routes.ts', 'routes/workspace.routes.ts']) {
      expect(code(route)).toMatch(/instanceof PlanLimitError[\s\S]{0,200}statusCode/)
    }
  })

  it('/billing and the AI quota read the effective limits, and PLANS reads the one list of defaults', () => {
    expect(code('services/billing.service.ts')).toContain(
      'await effectiveLimits(workspaceId, subscription.plan)',
    )
    expect(code('services/billing.service.ts')).toContain('PLAN_LIMIT_DEFAULTS.free.invoices')
    expect(code('services/ai/ai-quota.service.ts')).toContain(
      'await effectiveLimits(ctx.workspaceId, plan)',
    )
    expect(code('services/ai/ai-quota.service.ts')).not.toContain('PLAN_ALLOWANCE')
  })

  it('the invite result (with its raw token) is not logged', () => {
    expect(code('routes/workspace.routes.ts')).not.toMatch(/console\.log\([^)]*invite\)/)
  })
})
