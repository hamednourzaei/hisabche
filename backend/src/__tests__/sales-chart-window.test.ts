// ============================================
// The sales chart's window — the two numbers that have to agree.
//
// ---------------------------------------------------------------------------
// ⚠️ WHY THE CHART LOOKED BROKEN
//
// `analytics.service.ts` builds `chartData` from the last FOURTEEN days of
// whatever range it is asked for. The dashboard asked for SEVEN.
//
// So half the window the chart was designed around was thrown away before it
// ever reached the client, and a shop whose last sale was ten days ago got an
// empty chart — under the words «هنوز فروشی ثبت نشده است», which is a claim
// about their entire history made from one week of it. Nothing errored. The
// person went looking for a bug in their invoices.
//
// Two numbers in two packages, with nothing relating them. This is the
// relation.
//
// ---------------------------------------------------------------------------
// AND A SECOND, QUIETER ONE
//
// The fourteen-day boundary was `new Date()` minus fourteen days — carrying
// the current TIME. So the comparison dropped every invoice from earlier in
// the day fourteen days ago, and the oldest column of the chart shrank through
// the afternoon.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SERVICE = join(__dirname, '..', 'services', 'analytics.service.ts')
const HOOK = join(
  __dirname,
  '..',
  '..',
  '..',
  'packages',
  'ui',
  'src',
  'hooks',
  'dashboard',
  'use-dashboard.ts',
)
const CHART = join(
  __dirname,
  '..',
  '..',
  '..',
  'packages',
  'ui',
  'src',
  'components',
  'ui',
  'dashboard',
  'sales-chart.tsx',
)

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

const service = code(SERVICE)
const hook = code(HOOK)
const chart = code(CHART)

/** The number of days the server actually charts. */
function serverWindowDays(): number {
  const match = /getDate\(\) - (\d+)\)/.exec(service.slice(service.indexOf('fourteenDaysAgo')))
  expect(match, 'the server chart window is no longer a literal').not.toBeNull()
  return Number(match![1])
}

/** The number of days the dashboard asks for. */
function requestedWindowDays(): number {
  const match = /const fromDate = getDaysAgo\((\d+)\)/.exec(hook)
  expect(match, 'the dashboard request window is no longer a literal').not.toBeNull()
  return Number(match![1])
}

describe('the request and the chart agree', () => {
  it('read both windows', () => {
    // If either stops being a literal the comparison below is vacuous.
    expect(serverWindowDays()).toBeGreaterThan(0)
    expect(requestedWindowDays()).toBeGreaterThan(0)
  })

  it('⚠️ the dashboard does not ask for LESS than the server charts', () => {
    // Asking for less throws away part of the window silently. Asking for more
    // is harmless — the server's own filter caps it.
    expect(
      requestedWindowDays(),
      `the dashboard asks for ${requestedWindowDays()} days but the chart is built from ${serverWindowDays()}`,
    ).toBeGreaterThanOrEqual(serverWindowDays())
  })
})

describe('the fourteen-day boundary', () => {
  it('⚠️ starts at midnight, not at the current time', () => {
    // Without this the window slides through the day and the oldest column
    // shrinks as the afternoon goes on.
    expect(service).toMatch(/fourteenDaysAgo\.setHours\(0, 0, 0, 0\)/)
  })

  it('the filter is inclusive of that boundary', () => {
    expect(service).toMatch(/new Date\(inv\.date\) >= fourteenDaysAgo/)
  })
})

describe('the chart only counts sales', () => {
  it('⚠️ excludes purchases', () => {
    // Without this every purchase invoice landed in the revenue chart and the
    // supplier appeared under «best customers».
    expect(service).toMatch(/\.or\('type\.eq\.sale,type\.is\.null'\)/)
  })

  it('includes the whole of the last day', () => {
    // `date` is a timestamptz and `endDate` is a date, so `lte` meant
    // `<= 00:00:00` and today's sales never appeared.
    expect(service).toMatch(/\.lt\('date', endOfDayExclusive\(endDate\)\)/)
  })

  it('is scoped to the workspace', () => {
    expect(service).toMatch(/\.eq\('workspace_id', workspaceId\)/)
  })
})

describe('the empty state says what it actually knows', () => {
  it('⚠️ does not claim the shop has never sold anything', () => {
    // The data behind it is one window. «هنوز فروشی ثبت نشده است» is a claim
    // about all of history, and it sent people looking for a bug.
    expect(chart).not.toMatch(/dashboard\.noSalesYet/)
    expect(chart).not.toMatch(/dashboard\.startSelling/)
  })

  it('says «in this period» instead', () => {
    expect(chart).toMatch(/dashboard\.noSalesInPeriod/)
    expect(chart).toMatch(/dashboard\.tryWiderRange/)
  })

  it('the replacement keys exist in every locale', () => {
    for (const locale of ['fa', 'af', 'en']) {
      const bundle = JSON.parse(
        readFileSync(
          join(__dirname, '..', '..', '..', 'packages', 'i18n', 'messages', locale, 'common.json'),
          'utf8',
        ),
      ) as { dashboard: Record<string, string> }

      expect(bundle.dashboard.noSalesInPeriod, `${locale}.noSalesInPeriod`).toBeTruthy()
      expect(bundle.dashboard.tryWiderRange, `${locale}.tryWiderRange`).toBeTruthy()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// «You sold nothing» is a claim about the business. It has to be true.
// ─────────────────────────────────────────────────────────────────────────────

describe('a failed query is not an empty shop', () => {
  it('⚠️ the error branch and the no-rows branch are separate', () => {
    // `if (error || rows.length === 0) return empty` served a BROKEN query as
    // a truthful-looking 200 — zero revenue, zero invoices, an empty chart —
    // and `withCacheKey` then stored that for two minutes, so the log said
    // «Cache HIT» while the shop had data. The owner went looking through
    // their own invoices for something that was never missing.
    expect(service).toMatch(/if \(error\) \{\s*throw error/)
    expect(service).not.toMatch(/if \(error \|\| !invoices \|\| invoices\.length === 0\)/)
  })

  it('⚠️ a thrown error is never cached', () => {
    // `withCacheKey` awaits the fetcher and only then calls `set`, so a throw
    // leaves the key empty. If that order ever changes, a single failure
    // becomes a two-minute outage that looks like real data.
    const cache = readFileSync(join(__dirname, '..', 'utils', 'cache.ts'), 'utf8')
    const body = cache.slice(cache.indexOf('export async function withCacheKey'))
    expect(body.indexOf('await fetcher()')).toBeLessThan(body.indexOf('memoryCache.set'))
  })

  it('⚠️ no embedded resource, which needs a foreign key to resolve', () => {
    // `customers!left (…)` was the only embed in this file and the only place
    // this table pair was joined through PostgREST.
    expect(service).not.toMatch(/customers!left/)
    expect(service).toMatch(/\.from\('customers'\)[\s\S]{0,120}\.eq\('workspace_id', workspaceId\)/)
  })

  it('says which kind of empty it found', () => {
    expect(service).toMatch(/unfiltered: \$\{count/)
  })
})
