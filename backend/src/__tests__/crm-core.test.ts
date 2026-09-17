// CRM Core (services/crm). Rules are pure; the structure is guarded so the Core
// stays the only way into the CRM tables.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  CrmRuleError,
  appendStatus,
  concernsCustomer,
  distinctSubjects,
  recordOutcome,
  summarizeCustomerCrm,
  toInteraction,
  toOpportunity,
  type Interaction,
  type Opportunity,
} from '../services/crm/crm.domain'

const SRC = join(__dirname, '..')
const AT = '2026-09-17T10:00:00.000Z'

const task = (over: Partial<Interaction>): Interaction => ({
  ...toInteraction({ id: 't', status: 'pending' }),
  ...over,
})
const deal = (over: Partial<Opportunity>): Opportunity => ({
  ...toOpportunity({ id: 'o', title: 'x' }),
  ...over,
})

describe('mapping', () => {
  it('opportunities come back camelCase (the list used to send raw snake_case rows)', () => {
    const opp = toOpportunity({
      id: '1',
      customer_id: 'c',
      title: 'Deal',
      stage: 'proposal',
      value: '1500.50',
      probability: 40,
      expected_close_date: '2026-10-01',
      created_at: AT,
    })
    expect(opp).toMatchObject({
      customerId: 'c',
      expectedCloseDate: '2026-10-01',
      createdAt: AT,
      value: 1500.5,
    })
    expect(opp).not.toHaveProperty('customer_id')
  })

  it('interaction defaults when the task migrations have not run', () => {
    const legacy = toInteraction({ id: '1', customer_id: 'c', interaction_date: AT })
    expect(legacy).toMatchObject({ status: 'pending', customers: [], customerOutcomes: [] })
  })
})

describe('task rules', () => {
  it('appends to the status history', () => {
    expect(appendStatus([], 'completed', 'employee', AT)).toEqual([
      { status: 'completed', changedAt: AT, changedBy: 'employee' },
    ])
  })

  it('a failed outcome needs a note', () => {
    expect(() =>
      recordOutcome([{ id: 'c1' }], [], { customerId: 'c1', outcome: 'failed' }, 'owner', AT),
    ).toThrow(CrmRuleError)
  })

  it('only customers already on the task can get an outcome (public link safety)', () => {
    expect(() =>
      recordOutcome([{ id: 'c1' }], [], { customerId: 'other', outcome: 'done' }, 'employee', AT),
    ).toThrowError('CRM_OUTCOME_CUSTOMER_NOT_ON_TASK')
  })

  it('re-recording replaces the earlier outcome', () => {
    const first = recordOutcome(
      [{ id: 'c1' }],
      [],
      { customerId: 'c1', outcome: 'failed', note: 'no answer' },
      'employee',
      AT,
    )
    const second = recordOutcome(
      [{ id: 'c1' }],
      first,
      { customerId: 'c1', outcome: 'done' },
      'employee',
      AT,
    )
    expect(second).toHaveLength(1)
    expect(second[0]).toMatchObject({ outcome: 'done' })
  })

  it('subject suggestions are distinct, case-insensitive, typed casing kept', () => {
    expect(distinctSubjects(['Eid offer', 'eid OFFER', '', null, 'Debt reminder'], 5)).toEqual([
      'Eid offer',
      'Debt reminder',
    ])
  })

  it('a task concerns every customer on its snapshot, not only the primary one', () => {
    const multi = task({
      customerId: 'a',
      customers: [
        { id: 'a', name: 'A', phone: null },
        { id: 'b', name: 'B', phone: null },
      ],
    })
    expect(concernsCustomer(multi, 'b')).toBe(true)
    expect(concernsCustomer(multi, 'z')).toBe(false)
  })
})

describe('customer CRM summary', () => {
  it('counts open work, the next task and the pipeline with won/lost as stored', () => {
    const summary = summarizeCustomerCrm(
      [
        task({ id: '1', status: 'completed', interactionDate: '2026-09-01' }),
        task({ id: '2', status: 'pending', interactionDate: '2026-09-20', subject: 'call' }),
        task({ id: '3', status: 'in_progress', interactionDate: '2026-09-10', subject: 'visit' }),
      ],
      [
        deal({ id: 'a', stage: 'proposal', value: 1000, probability: 50 }),
        deal({ id: 'b', stage: 'won', value: 700 }),
        deal({ id: 'c', stage: 'lost', value: 300 }),
      ],
    )
    expect(summary).toMatchObject({
      openTasks: 2,
      completedTasks: 1,
      lastInteractionAt: '2026-09-20',
      nextTask: { id: '3', subject: 'visit' },
      openOpportunities: 1,
      openPipelineValue: 1000,
      weightedPipelineValue: 500,
      // `won` / `lost` — the stage names writes actually store.
      wonValue: 700,
      lostCount: 1,
    })
  })
})

describe('the CRM Core is the only way into the CRM tables', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return name === '__tests__' ? [] : files(path)
      return path.endsWith('.ts') ? [path] : []
    })

  it("no file outside services/crm reads 'interactions' or 'opportunities'", () => {
    const offenders = files(SRC)
      .filter((file) => !relative(SRC, file).replace(/\\/g, '/').startsWith('services/crm/'))
      .filter((file) => /from\('(interactions|opportunities)'\)/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file))
    expect(offenders).toEqual([])
  })

  it('routes import the Core through its index only', () => {
    const routes = readFileSync(join(SRC, 'routes/crm.routes.ts'), 'utf8')
    expect(routes).toContain("from '../services/crm'")
    expect(routes).not.toMatch(/services\/crm\/crm\.(service|repository|domain)/)
    expect(routes).not.toMatch(/clearCache\('(interactions|opportunities):\*'\)/)
  })

  it('counts are exact, not estimated', () => {
    const repo = readFileSync(join(SRC, 'services/crm/crm.repository.ts'), 'utf8')
    expect(repo).not.toContain("count: 'estimated'")
  })
})
