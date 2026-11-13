// ============================================
// backend/src/__tests__/ai-admin.test.ts
//
// V63 · A — the rules the AI admin surface must keep, tested where they can be
// tested without a database:
//
//  1. a token total is NULL when any question did not report tokens;
//  2. spend is per currency, and one unpriced question makes it unknown;
//  3. provider usage is read from the right key for each provider;
//  4. only a provider FAULT moves on to the next provider;
//  5. every route in admin-ai.routes.ts carries the admin chain, and no route
//     in that file can read or accept the provider key.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  microsOrNull,
  summariseSpend,
  usageWindow,
  type AiUsageRow,
} from '../services/admin/admin-ai.service'
import { isProviderFault, sumReportedTokens, AiBusyError } from '../services/ai/ai-chat.service'
import { providerUsage } from '../services/ai/provider-client'
import { ValidationError } from '../errors/validation.error'

const ROUTE_FILE = join(__dirname, '..', 'routes', 'admin-ai.routes.ts')
const routeSource = readFileSync(ROUTE_FILE, 'utf-8')
const routeCode = routeSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

function usageRow(overrides: Partial<AiUsageRow>): AiUsageRow {
  return {
    day: '2026-03-02',
    provider: 'anthropic',
    model: 'claude-x',
    queries: 1,
    promptTokens: 10,
    completionTokens: 20,
    currency: 'USD',
    costMicros: 1000,
    unpricedQueries: 0,
    ...overrides,
  }
}

describe('sumReportedTokens', () => {
  it('adds every reported pair', () => {
    expect(sumReportedTokens([10, 5])).toBe(15)
  })

  it('returns null when one call did not report — not the partial sum', () => {
    // A total of 10 beside a bill for 30 is the failure this guards.
    expect(sumReportedTokens([10, null])).toBeNull()
  })

  it('returns null when there was no call at all', () => {
    expect(sumReportedTokens([])).toBeNull()
  })
})

describe('microsOrNull', () => {
  it('reads a number and a numeric string', () => {
    expect(microsOrNull(3_000_000)).toBe(3_000_000)
    expect(microsOrNull('6000000')).toBe(6_000_000)
  })

  it('returns null rather than a rounded bigint', () => {
    expect(microsOrNull('9007199254740993')).toBeNull()
    expect(microsOrNull('not-a-number')).toBeNull()
    expect(microsOrNull(null)).toBeNull()
    expect(microsOrNull(1.5)).toBeNull()
  })
})

describe('summariseSpend', () => {
  it('adds costs within one currency', () => {
    const { byCurrency } = summariseSpend([
      usageRow({ currency: 'USD', costMicros: 1000 }),
      usageRow({ currency: 'USD', costMicros: 2500 }),
    ])
    expect(byCurrency.get('USD')).toEqual({
      spentMicros: 3500,
      unpricedQueries: 0,
      queries: 2,
    })
  })

  it('never merges two currencies', () => {
    const { byCurrency } = summariseSpend([
      usageRow({ currency: 'USD', costMicros: 1000 }),
      usageRow({ currency: 'AFN', costMicros: 7_000_000 }),
    ])
    expect(byCurrency.get('USD')?.spentMicros).toBe(1000)
    expect(byCurrency.get('AFN')?.spentMicros).toBe(7_000_000)
    expect(byCurrency.size).toBe(2)
  })

  it('makes the currency total unknown when one question has no price', () => {
    const { byCurrency } = summariseSpend([
      usageRow({ currency: 'USD', costMicros: 1000 }),
      usageRow({ currency: 'USD', costMicros: null, unpricedQueries: 1 }),
    ])
    expect(byCurrency.get('USD')?.spentMicros).toBeNull()
    expect(byCurrency.get('USD')?.unpricedQueries).toBe(1)
  })

  it('counts questions with no currency instead of guessing one', () => {
    const { byCurrency, unattributed } = summariseSpend([
      usageRow({ currency: null, costMicros: null, unpricedQueries: 1, queries: 3 }),
      usageRow({ currency: 'USD', costMicros: 500 }),
    ])
    expect(unattributed).toBe(3)
    expect(byCurrency.get('USD')?.spentMicros).toBe(500)
    expect(byCurrency.has('')).toBe(false)
  })
})

describe('usageWindow', () => {
  const now = new Date('2026-03-10T12:00:00.000Z')

  it('ends at now and starts the requested number of days back', () => {
    const window = usageWindow('7d', now)
    expect(window.until.toISOString()).toBe('2026-03-10T12:00:00.000Z')
    expect(window.since.toISOString()).toBe('2026-03-03T12:00:00.000Z')
  })

  it('treats 24h as one day', () => {
    expect(usageWindow('24h', now).since.toISOString()).toBe('2026-03-09T12:00:00.000Z')
  })
})

describe('providerUsage', () => {
  it('reads Anthropic input/output tokens', () => {
    expect(providerUsage('anthropic', { usage: { input_tokens: 12, output_tokens: 34 } })).toEqual({
      promptTokens: 12,
      completionTokens: 34,
    })
  })

  it('reads OpenAI prompt/completion tokens', () => {
    expect(providerUsage('openai', { usage: { prompt_tokens: 5, completion_tokens: 6 } })).toEqual({
      promptTokens: 5,
      completionTokens: 6,
    })
  })

  it('reports null when the provider sends no usage', () => {
    expect(providerUsage('openai', { choices: [] })).toEqual({
      promptTokens: null,
      completionTokens: null,
    })
  })

  it('refuses a negative or non-numeric count', () => {
    expect(
      providerUsage('anthropic', { usage: { input_tokens: -1, output_tokens: 'many' } }),
    ).toEqual({ promptTokens: null, completionTokens: null })
  })
})

describe('isProviderFault', () => {
  it('treats a provider status, a timeout and a busy signal as faults', () => {
    expect(isProviderFault(new ValidationError('AI_PROVIDER_ERROR: 500'))).toBe(true)
    expect(isProviderFault(new AiBusyError(429))).toBe(true)
    expect(isProviderFault({ name: 'TimeoutError', message: 'timed out' })).toBe(true)
  })

  it('treats our own configuration errors as final', () => {
    expect(isProviderFault(new ValidationError('AI_NOT_CONFIGURED'))).toBe(false)
    expect(isProviderFault(new ValidationError('AI_QUOTA_EXCEEDED'))).toBe(false)
    expect(isProviderFault(null)).toBe(false)
  })
})

describe('the AI admin route file', () => {
  const routes = [...routeCode.matchAll(/fastify\.(get|put|delete)\(\s*'([^']+)'/g)].map(
    (match) => ({
      method: match[1]!.toUpperCase(),
      path: match[2]!,
    }),
  )

  it('declares the twelve routes the console calls', () => {
    expect(routes.map((route) => `${route.method} ${route.path}`).sort()).toEqual(
      [
        'GET /api/admin/ai/audit',
        'GET /api/admin/ai/budgets',
        'GET /api/admin/ai/fallbacks',
        'GET /api/admin/ai/prices',
        'GET /api/admin/ai/prompts',
        'GET /api/admin/ai/usage',
        'PUT /api/admin/ai/fallbacks',
        'PUT /api/admin/ai/prices',
        'PUT /api/admin/ai/budgets',
        'PUT /api/admin/ai/budgets/workspace/:workspaceId',
        'DELETE /api/admin/ai/prices/:id',
        'DELETE /api/admin/ai/budgets/:id',
      ].sort(),
    )
  })

  it('puts every route behind the admin chain, and every write behind step-up', () => {
    const registrations = routeCode.split(/fastify\.(?=get|put|delete\()/).slice(1)
    expect(registrations).toHaveLength(routes.length)

    for (const registration of registrations) {
      const method = /^(get|put|delete)/.exec(registration)?.[1]?.toUpperCase() ?? ''
      // Every handler names its guard in an object literal.
      expect(registration, `${method} route`).toMatch(/\{\s*preHandler:\s*(read|write)\s*\}/)
      if (method === 'GET') {
        expect(registration, 'reads use the read chain').toContain('preHandler: read')
      } else {
        expect(registration, 'writes use the write chain').toContain('preHandler: write')
      }
    }

    // The two chains are the admin builder with the right permission, and the
    // write one asks for a fresh step-up.
    expect(routeCode).toContain("adminRoute('product.ai.read')")
    expect(routeCode).toContain("adminRoute('product.ai.write', { stepUp: true })")
  })

  it('never mentions the provider key', () => {
    expect(routeCode).not.toMatch(/api[_-]?key/i)
  })
})

describe('the question log records tokens without failing the question', () => {
  const chatSource = readFileSync(
    join(__dirname, '..', 'services', 'ai', 'ai-chat.service.ts'),
    'utf-8',
  )
  const code = chatSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('writes the two token columns with the row', () => {
    expect(code).toContain('prompt_tokens: promptTokens')
    expect(code).toContain('completion_tokens: completionTokens')
  })

  it('keeps the row when the migration has not added those columns yet', () => {
    // The row is also the quota counter: losing it gives away a free question.
    expect(code).toMatch(/LOG_SCHEMA_ABSENT\.has\(error\.code\)[\s\S]{0,240}\.insert\(row\)/)
  })

  it('attributes tokens only when one model answered', () => {
    expect(code).toContain('const oneModel =')
    expect(code).toMatch(/oneModel[\s\S]{0,120}sumReportedTokens/)
  })
})
