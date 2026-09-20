// ============================================
// ONE KPI card in the whole product.
//
// The owner's instruction: the «kpi-card» block (dashboardcn, MIT), rebuilt on
// this project's tokens, is the only card any screen draws a figure in.
//
// Before this there were three — `BentoStats`' cells, `capability-kit`'s
// `Stat`, and a `StockStatsCard` nothing imported — plus screens assembling
// the shell by hand out of `stat-surface` strings. They shared a look and
// nothing else, so a delta badge existed on one and not the others.
// ============================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const UI_ROOT = join(__dirname, '..', 'components', 'ui')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return entry.endsWith('.tsx') ? [full] : []
  })
}

const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const files = walk(UI_ROOT).filter((f) => !f.includes('__tests__'))

describe('the card is assembled in exactly one file', () => {
  it('⚠️ no screen builds the KPI shell out of stat-surface strings itself', () => {
    // `STAT_CARD_SURFACE` + `STAT_PADDING` next to `STAT_LABEL` IS the card.
    // Hand-assembling it is how the two visual languages appeared in the first
    // place; `kpi-card.tsx` is the one place allowed to do it.
    const offenders = files.filter((file) => {
      if (file.endsWith('kpi-card.tsx')) return false
      const src = code(readFileSync(file, 'utf8'))
      return src.includes('STAT_CARD_SURFACE') && src.includes('STAT_LABEL')
    })

    expect(offenders.map((f) => f.replace(UI_ROOT, ''))).toEqual([])
  })

  it('⚠️ the row is `KpiGrid` everywhere — no page has its own arrangement', () => {
    // `BentoStats` used to draw a 7/5 · 5/7 grid that merged into one bordered
    // box on mobile, while `/dashboard` drew a plain row. Same card underneath
    // and still two different pages on screen, which is what the owner kept
    // reporting.
    const bento = code(readFileSync(join(UI_ROOT, 'bento-stats.tsx'), 'utf8'))
    expect(bento).toContain('<KpiGrid')
    expect(bento).toContain('<KpiCard')
    expect(bento).not.toMatch(/grid-cols-12|col-span-7|col-span-5/)
    expect(bento).not.toContain('STAT_VALUE')
  })

  it('capability-kit’s Stat is an alias, not a second implementation', () => {
    const kit = code(readFileSync(join(UI_ROOT, 'capability', 'capability-kit.tsx'), 'utf8'))
    expect(kit).toContain('export function Stat(props: KpiCardProps)')
    expect(kit).toContain('<KpiCard {...props} />')
    expect(kit).toContain('export { KpiGrid as StatGrid }')
  })
})

describe('no screen declares a KPI card of its own', () => {
  it('⚠️ there is no second component named like the card', () => {
    // The dashboard, `/human-resources` and `/team-and-payroll` each had their
    // own `KpiCard`/`StatCard` — same information, four different cards, and
    // the owner's report was exactly that: the dashboard's four cards were not
    // the new card.
    //
    // `landing-preview.tsx` is excluded by NAME, not by path: its `PreviewKpi`
    // is a 9-pixel drawing of a card inside a mockup laptop, with invented
    // numbers and no data behind it.
    const offenders = files.filter((file) => {
      if (file.endsWith('kpi-card.tsx')) return false
      const src = code(readFileSync(file, 'utf8'))
      return /\b(?:const|function)\s+(?:Kpi|Stat|Metric|Summary)Card\b/.test(src)
    })

    expect(offenders.map((f) => f.replace(UI_ROOT, ''))).toEqual([])
  })

  it('the dashboard’s four cards are the shared one, in the shared row', () => {
    const view = code(readFileSync(join(UI_ROOT, 'dashboard', 'dashboard-view.tsx'), 'utf8'))
    expect(view).toContain("import { KpiCard, KpiGrid } from '../kpi-card'")
    expect(view).toContain('<KpiGrid>')
    // Four cards, each opening the rows its figure was computed from.
    expect((view.match(/<KpiCard/g) ?? []).length).toBe(4)
    expect((view.match(/onOpen=\{/g) ?? []).length).toBe(4)
    // ⚠️ Debt is the one where rising is bad.
    const debt = view.slice(view.indexOf('dashboard.customerDebt'))
    expect(debt.slice(0, 400)).toContain('invertDelta')
  })

  it('⚠️ a row keeps its baselines when only some cards have a comparison', () => {
    // Without this the cards with no delta are shorter than the ones with it.
    // The dash means «not compared» — never «unchanged», which is why it is a
    // dash and not «۰٪».
    const kpi = code(readFileSync(join(UI_ROOT, 'kpi-card.tsx'), 'utf8'))
    expect(kpi).toContain('{!hasDelta && showEmptyDelta && (')
    expect(kpi).not.toContain("showEmptyDelta && '۰٪'")
  })

  it('a card with a drill-down is a real button', () => {
    // Keyboard focus, Enter and Space and an accessible name — none of which
    // an onClick on a div provides.
    const kpi = code(readFileSync(join(UI_ROOT, 'kpi-card.tsx'), 'utf8'))
    expect(kpi).toContain("const Tag = onOpen ? 'button' : 'div'")
    expect(kpi).toContain("type: 'button' as const")
    expect(kpi).toContain("'aria-label': openLabel ? `${label} — ${openLabel}` : label")
    // RTL: a button centre-aligns by default.
    expect(kpi).toContain('w-full text-start')
  })
})

describe('every screen with a row of figures uses it', () => {
  it.each([
    ['dashboard/dashboard-view.tsx'],
    ['warehouse/warehouse-view.tsx'],
    ['warehouse-detail/warehouse-detail-page.tsx'],
    ['invoices/invoices-view.tsx'],
    ['customers/customer-workspace.tsx'],
    ['customers/customer-stats.tsx'],
    ['crm/crm-view.tsx'],
    ['crm/customer-crm-panel.tsx'],
    ['sync-center/sync-center-page.tsx'],
    ['human-resources/hr-view.tsx'],
    ['team-and-payroll/team-and-payroll-view.tsx'],
    ['inventory-ops/inventory-ops-view.tsx'],
  ])('%s', (file) => {
    const src = code(readFileSync(join(UI_ROOT, ...file.split('/')), 'utf8'))
    // Either directly, or through `BentoStats`/`Stat`, which are the row and
    // the alias — never a shell of its own.
    expect(/<(?:KpiCard|KpiGrid|BentoStats|Stat)\b/.test(src), file).toBe(true)
  })

  it('⚠️ no screen hand-builds a figure-with-caption box any more', () => {
    // `text-2xl font-bold tabular-nums` over a small caption IS a KPI card.
    // Pricing pages and invoice totals are not KPI rows and keep their own
    // type scale, so they are named rather than matched.
    const ALLOWED = [
      'kpi-card.tsx',
      'landing-section.tsx',
      'landing-preview.tsx',
      'pricing-scene.tsx',
      'PricingPage.tsx',
      'IncomeStatementTab.tsx',
      'sales-funnel.tsx',
      'invoice-preview-container.tsx',
      'invoice-builder-mobile.tsx',
      // A table footer's total and the number inside a donut are not cards.
      'ProductProfitTable.tsx',
      'till-distribution-chart-internal.tsx',
    ]
    const offenders = files.filter((file) => {
      if (ALLOWED.some((name) => file.endsWith(name))) return false
      const src = code(readFileSync(file, 'utf8'))
      return /text-(?:xl|2xl|3xl) font-bold tabular-nums/.test(src)
    })

    expect(offenders.map((f) => f.replace(UI_ROOT, ''))).toEqual([])
  })
})

describe('a longer number takes a smaller font', () => {
  // ⚠️ THE BUG THIS PREVENTS: the ladder existed from the start and almost
  // nothing reached it. The card sized a NUMBER automatically and gave every
  // pre-formatted STRING a fixed `text-lg sm:text-xl` — and practically every
  // screen passes a formatted string, because money carries its own currency
  // rules. «۲۶۱٬۵۰۰٬۰۰۰» rendered at the fixed size and overflowed its card.
  const kpi = code(readFileSync(join(UI_ROOT, 'kpi-card.tsx'), 'utf8'))

  it('⚠️ a string is measured too, not only a number', () => {
    expect(kpi).toContain("typeof value === 'string' ? value : null")
    expect(kpi).toContain('valueFontClass(text)')
    // Only a ReactNode may keep the fixed step — there is no text to measure.
    expect(kpi).toContain('mt-1.5 text-lg sm:mt-2 sm:text-xl')
  })

  it('the ladder actually steps down', () => {
    const ladder = kpi.slice(kpi.indexOf('export function valueFontClass'))
    for (const step of ['text-lg sm:text-2xl', 'text-base sm:text-xl', 'text-[10px] sm:text-xs']) {
      expect(ladder).toContain(step)
    }
  })

  it('⚠️ ONE ladder, not a hand-written set per screen', () => {
    // Three breakpoint sets is how the dashboard came to have a card that
    // shrank and a headline beside it that did not.
    expect(kpi).toContain('export function headlineFontClass')
    expect(kpi).toContain('export function statFontClass')

    const chart = code(readFileSync(join(UI_ROOT, 'dashboard', 'sales-chart.tsx'), 'utf8'))
    const funnel = code(readFileSync(join(UI_ROOT, 'dashboard', 'sales-funnel.tsx'), 'utf8'))

    expect(chart).toContain('headlineFontClass(fmt(currentPeriodTotal))')
    expect(chart).toContain('statFontClass(fmt(value))')
    expect(funnel).toContain('headlineFontClass(')

    // The fixed sizes these replaced must not come back.
    expect(chart).not.toContain('text-3xl font-bold text-[hsl(var(--fg-primary))] tracking-tight')
    expect(funnel).not.toContain('text-2xl font-bold tabular-nums text-[hsl(var(--fg-primary))]')
  })

  it('⚠️ a formatted string is never sign-coloured', () => {
    // `amountTone` reads a NUMBER. Handing it a string would make every
    // formatted figure green, including ones that are bad news.
    expect(kpi).toContain(
      "isNumeric ? amountTone(value as number) : 'text-[hsl(var(--fg-primary))]'",
    )
  })
})

describe('what the card promises about the numbers', () => {
  const kpi = code(readFileSync(join(UI_ROOT, 'kpi-card.tsx'), 'utf8'))

  it('⚠️ never abbreviates — it shrinks the font instead', () => {
    // «۱۲ میلیون» hides the exact figure a bookkeeper is checking.
    expect(kpi).toContain('export function valueFontClass')
    expect(kpi).not.toMatch(/میلیون|\bM\b['"]|toPrecision/)
  })

  it('⚠️ a null delta renders no badge', () => {
    // Zero reads as «measured, no change»; null means there was nothing to
    // compare against, and a green 0% would be a claim out of no evidence.
    expect(kpi).toContain('const hasDelta = delta !== undefined && delta !== null')
    expect(kpi).toContain('{hasDelta && (')
  })

  it('⚠️ «up is good» is stated per metric, never inferred from the sign', () => {
    // Debt and expenses invert.
    expect(kpi).toContain('const isGood = invertDelta ? !isUp : isUp')
  })

  it('digits line up', () => {
    // Without tabular-nums a column of amounts does not align, which is the
    // one thing someone reading a column of money is doing.
    expect(kpi).toContain('tabular-nums')
  })

  it('⚠️ colours are tokens — no hex, no Tailwind palette', () => {
    expect(kpi).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(kpi).not.toMatch(
      /\b(?:bg|text|border)-(?:slate|gray|zinc|blue|emerald|indigo|violet|rose)-\d{2,3}\b/,
    )
    expect(kpi).toContain('hsl(var(--color-success)')
  })
})
