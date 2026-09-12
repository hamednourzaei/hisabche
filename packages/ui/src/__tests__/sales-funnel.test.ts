// ============================================
// The funnel shows the pipeline, not an illustration.
//
// ---------------------------------------------------------------------------
// ⚠️ THE MOCK IT WAS BUILT FROM CONTAINED INVENTED NUMBERS
//
// 1,500 leads narrowing to 38 sales, on a dashboard whose own KPI says the
// shop has 24 customers. There is no ratio that turns 24 customers into 1,500
// leads; shipping those proportions would be a dashboard that lies
// confidently, which is what G1 forbids.
//
// `opportunitySchema` already defines exactly these stages, and the
// `opportunities` table, service and route already exist — so the funnel is a
// real count and a shop with no pipeline sees an empty state saying so.
//
// ⚠️ AND IT IS NOT COUNTED FROM THE PAGINATED LIST ENDPOINT.
// `GET /api/opportunities` uses `.range(offset, offset + limit - 1)` and
// `count: 'estimated'`. Grouping its result would show the stage breakdown of
// ONE PAGE and present it as the pipeline — the same class of defect as the
// ~20 `.limit(N)` money reads already catalogued in this repo.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*/g, '')
}

const ROOT = join(__dirname, '..', '..', '..', '..')
const service = code(join(ROOT, 'backend', 'src', 'services', 'crm.service.ts'))
const funnel = code(join(__dirname, '..', 'components', 'ui', 'dashboard', 'sales-funnel.tsx'))
const view = code(join(__dirname, '..', 'components', 'ui', 'dashboard', 'dashboard-view.tsx'))

describe('the counts are real', () => {
  it('⚠️ counted by the database, exactly — never estimated', () => {
    const method = service.slice(service.indexOf('async getFunnel'))
    expect(method).toMatch(/count: 'exact', head: true/)
    expect(method).not.toMatch(/count: 'estimated'/)
  })

  it('⚠️ not derived from the paginated list', () => {
    const method = service.slice(service.indexOf('async getFunnel'))
    expect(method).not.toMatch(/\.range\(/)
    expect(method).not.toMatch(/listOpportunities/)
  })

  it('is scoped to the workspace', () => {
    const method = service.slice(service.indexOf('async getFunnel'))
    expect(method).toMatch(/\.eq\('workspace_id', workspaceId\)/)
  })

  it('⚠️ a failed count throws instead of drawing an empty funnel', () => {
    // Returning 0 would state «you have no pipeline» out of a query error.
    const method = service.slice(service.indexOf('async getFunnel'))
    expect(method).toMatch(/if \(error\) throw new DatabaseError/)
  })

  it('there are no hardcoded stage counts anywhere in the component', () => {
    expect(funnel).not.toMatch(/1500|1,500|\b380\b|\b120\b/)
  })
})

describe('what the shape claims', () => {
  it('⚠️ lost deals are not a band in the cone', () => {
    // A lost deal did not pass through the stages beneath it; stacking it in
    // makes every lower stage look wider than it is.
    expect(service).toMatch(
      /const FUNNEL_STAGES = \['lead', 'qualified', 'proposal', 'negotiation', 'won'\]/,
    )
  })

  it('⚠️ bands are proportional to the top stage, not to the one above', () => {
    // Scaling each against its predecessor makes 10 → 9 → 8 look identical to
    // 1000 → 90 → 8.
    expect(funnel).toMatch(/item\.count \/ top/)
  })

  it('⚠️ an empty pipeline has no conversion rate, rather than «0%»', () => {
    expect(service).toMatch(/entered > 0 \?/)
    expect(funnel).toMatch(/conversionRate !== null \?/)
  })

  it('an error state is distinct from an empty one', () => {
    expect(funnel).toMatch(/dashboard\.funnel\.error/)
    expect(funnel).toMatch(/dashboard\.funnel\.empty/)
  })
})

describe('the switch on the dashboard card', () => {
  it('⚠️ the funnel hook is never called conditionally', () => {
    // Gating it on `view` would be a conditional hook: React throws «rendered
    // fewer hooks than expected» and the dashboard goes with it.
    expect(view).not.toMatch(/view === 'funnel' && useSalesFunnel/)
    expect(view).toMatch(/const funnel = useSalesFunnel\(\)/)
  })

  it('states both options rather than relying on a convention', () => {
    expect(view).toMatch(/aria-pressed=\{view === 'chart'\}/)
    expect(view).toMatch(/aria-pressed=\{view === 'funnel'\}/)
  })

  it('⚠️ the date picker is hidden on the funnel, not left inert', () => {
    // The funnel is the pipeline as it stands now, not a window over time.
    expect(view).toMatch(/\{view === 'chart' \? \(\s*<DateRangePicker/)
  })

  it('every string exists in all three locales', () => {
    for (const locale of ['fa', 'af', 'en']) {
      const bundle = JSON.parse(
        readFileSync(join(ROOT, 'packages', 'i18n', 'messages', locale, 'common.json'), 'utf8'),
      ) as { dashboard: { funnel?: Record<string, unknown>; viewSwitch?: string } }

      const f = bundle.dashboard.funnel as Record<string, unknown> | undefined
      expect(f, `${locale}.dashboard.funnel`).toBeTruthy()
      for (const key of ['title', 'empty', 'emptyHint', 'error', 'conversion', 'lost', 'aria']) {
        expect(f?.[key], `${locale}.funnel.${key}`).toBeTruthy()
      }
      const stages = f?.['stage'] as Record<string, unknown> | undefined
      for (const s of ['lead', 'qualified', 'proposal', 'negotiation', 'won']) {
        expect(stages?.[s], `${locale}.funnel.stage.${s}`).toBeTruthy()
      }
      expect(bundle.dashboard.viewSwitch, `${locale}.viewSwitch`).toBeTruthy()
    }
  })
})
