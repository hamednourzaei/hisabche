// ============================================
// The calendar is a consequence of the language, not a constant.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT WAS BEING SHOWN
//
// Dates were formatted with a hardcoded `'fa-AF'` across this package —
// including inside `lib/utils.ts#formatDate`, whose own doc comment promised
// «Jalali (Shamsi) or Gregorian» while accepting no language at all.
//
//   * an English reader saw «۱۸ سنبلهٔ ۱۴۰۵» — Afghan months, Persian digits
//   * an Iranian Persian reader saw «سنبله» where their calendar says
//     «شهریور» — the right calendar with the wrong month names, which reads as
//     a typo rather than as a bug, so it was never reported as one
//   * `workflow/approval-timeline.tsx` used `'fa-IR'` in one helper and
//     `'fa-AF'` thirty lines below — two calendars on one screen
//   * `dashboard/date-range-picker.tsx` offers the reader a «gregorian»
//     option that formatted with `'fa-AF'`, whose DEFAULT CALENDAR is
//     `persian` — so choosing Gregorian changed the month names and nothing
//     else. A locale tag does not carry a calendar; the calendar has to be
//     asked for.
//
// ICU already knows all three. Nothing here converts a calendar by hand —
// reimplementing Jalali leap years is how a date drifts by a day once a cycle.
// ============================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      return entry === 'node_modules' || entry === '__tests__' ? [] : walk(full)
    }
    return /\.(ts|tsx)$/.test(entry) ? [full] : []
  })
}

const files = walk(SRC)

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*/g, '')
}

describe('no component decides the calendar for the reader', () => {
  it('⚠️ no hardcoded locale reaches a date formatter', () => {
    const offenders = files
      .map((file) => [file, code(file)] as const)
      .filter(
        ([, source]) =>
          /(toLocaleDateString|toLocaleTimeString)\(\s*['"]/.test(source) ||
          /Intl\.DateTimeFormat\(\s*['"]/.test(source),
      )
      .map(([file]) => file.slice(SRC.length + 1))

    expect(offenders).toEqual([])
  })

  it('⚠️ hardcoded number locales only shrink (purchasing is off the list)', () => {
    // `toLocaleString('fa-AF')` shows Afghan digits to an English reader. These
    // files still do it and are reported debt; a new file doing it, or a fixed
    // one regressing, fails here. Fix one → delete its line.
    const KNOWN = new Set([
      'components/ui/customers/AddCustomerModal.tsx',
      'components/ui/customers/PaymentModal.tsx',
      'components/ui/cycle-count/containers/cycle-count-container.tsx',
      'components/ui/dashboard/sales-funnel.tsx',
      'components/ui/human-resources/employee-detail-view.tsx',
      'components/ui/human-resources/hr-view.tsx',
      'components/ui/inventory-ops/containers/inventory-ops-container.tsx',
      'components/ui/inventory-ops/inventory-ops-view.tsx',
      'components/ui/invoice-builder/containers/invoice-preview-container.tsx',
      'components/ui/invoice-detail/containers/invoice-detail-container.tsx',
      'components/ui/landing-section.tsx',
      'components/ui/team-and-payroll/employee-list-table.tsx',
      'components/ui/team-and-payroll/payroll-list-table.tsx',
      'components/ui/team-and-payroll/team-and-payroll-view.tsx',
      'components/ui/warehouse-detail/containers/warehouse-detail-container.tsx',
    ])
    const offenders = files
      .filter((file) => /toLocaleString\(\s*['"](fa|en|ps)/.test(code(file)))
      .map((file) => file.slice(SRC.length + 1).replace(/\\/g, '/'))
    expect(offenders.filter((file) => !KNOWN.has(file))).toEqual([])
    expect(offenders).not.toContain('components/ui/purchasing/purchasing-view.tsx')
  })

  it('⚠️ the shared helper takes a language, and requires it', () => {
    // A DEFAULT would leave every existing caller silently wrong and give the
    // compiler nothing to find. Required is the point.
    const utils = code(join(SRC, 'lib', 'utils.ts'))
    expect(utils).toMatch(/lang: string,/)
    expect(utils).toMatch(/resolveIntlLocale\(lang\)/)
    expect(utils).not.toMatch(/lang: string = /)
  })

  it('⚠️ the language is never read from module state', () => {
    // `apps/web` renders on the SERVER: one process serves a Persian request
    // and an English one concurrently, so a shared «current language» lets one
    // request decide what the other renders.
    const hook = code(join(SRC, 'hooks', 'use-date-format.ts'))
    expect(hook).toMatch(/useLocale\(\)/)
    expect(hook).not.toMatch(/^let currentLang/m)
  })

  it('⚠️ «gregorian» actually asks for the Gregorian calendar', () => {
    const picker = code(join(SRC, 'components', 'ui', 'dashboard', 'date-range-picker.tsx'))
    expect(picker).toMatch(/calendar: 'gregory'/)
  })
})

describe('the three calendars are really different', () => {
  // Guards the mapping itself, not our arithmetic — if `af` ever collapses
  // onto `fa-IR`, Dari readers silently get Iranian month names.
  const DAY = new Date('2026-09-09T12:00:00.000Z')
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }

  it('fa is Iranian, af is Afghan, en is Gregorian', () => {
    expect(new Intl.DateTimeFormat('fa-IR', opts).format(DAY)).toContain('شهریور')
    expect(new Intl.DateTimeFormat('fa-AF', opts).format(DAY)).toContain('سنبله')
    expect(new Intl.DateTimeFormat('en', opts).format(DAY)).toContain('September')
  })
})
