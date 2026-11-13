// ============================================
// «تیم و حقوق» — the redesigned /team-and-payroll, and the month-end run time.
//
// What can go wrong: four pill tabs creeping back into «after»; the hub drawing
// its own bar or switch; an old `?tab=payroll` link landing on the employee
// list; the screen drawing its own tabs under the hub's; «ساعات کار» offered
// to someone whose module is locked; «before» changed or lost; the month-end
// row offering a minute the runner cannot honour, or a month that has passed.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NAV_MODULE } from '@hisabche/ui-contract'

import {
  PAY_SECTIONS,
  TEAM_HUB_TABS,
  TEAM_SECTIONS,
  TIMESHEETS_SOURCE,
  teamAddressOf,
} from '../components/ui/team-and-payroll/containers/team-and-payroll-container'
import { RUN_MINUTES, startMonths } from '../components/ui/accounting/tabs/MonthEndTab'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
const ui = (...parts: string[]) => code(read('packages', 'ui', 'src', 'components', 'ui', ...parts))

const file = ui('team-and-payroll', 'containers', 'team-and-payroll-container.tsx')
const hub = file.slice(
  file.indexOf('function TeamHub()'),
  file.indexOf('function TeamAndPayrollScreen('),
)

describe('two tabs, each with one switch', () => {
  it('team and pay — and the four parts under them', () => {
    expect([...TEAM_HUB_TABS]).toEqual(['team', 'pay'])
    // 12 Nov 2026 (V61 audit): the org chart (B.2.17) joined «team».
    // 12 Nov 2026 (owner decision 1): «فروش هر نفر» — each seller is a member.
    expect([...TEAM_SECTIONS]).toEqual(['employees', 'branches', 'orgChart', 'sellers'])
    // No «حقوق» section (owner, 18 Oct 2026): it repeated the team page. A
    // person's payroll and «پرداخت شد / نشد» are on their own page.
    //
    // ⚠️ «مطالبات هزینه» ADDED 12 Nov 2026 (V61 B.2.18 — expense claims), with
    // the screen's own endpoints in the matrix. It is money owed to a person,
    // decided by whoever approves pay, so it belongs with pay and not with
    // «who works here». The list is still pinned: a silent fourth section is a
    // failure, a dated one is this line.
    expect([...PAY_SECTIONS]).toEqual(['attendance', 'timesheets', 'expenses'])
  })

  it('the payroll list is gone, and settling a payroll is still reachable', () => {
    expect(file).not.toContain('PayrollListTable')
    expect(file).not.toContain('usePayrolls()')
    expect(ui('team-and-payroll', 'team-and-payroll-view.tsx')).not.toContain('PayrollListTable')
    // the way out of «پیش‌نویس» must not die with the list (CLAUDE.md: a
    // status no button changes is a dead end)
    expect(ui('human-resources', 'employee-detail-view.tsx')).toContain('PayrollOutcome')
  })

  it('uses the shared bar, switch and address hooks — it draws none', () => {
    expect(hub).toContain('<HubTabs')
    expect(hub.split('<SegmentedControl').length - 1).toBe(2)
    expect(hub).toContain('useHubTab(TEAM_HUB_TABS)')
    expect(hub).toContain('useHubSection(TEAM_SECTIONS)')
    expect(hub).toContain('useHubSection(paySections)')
    expect(hub).not.toContain('role="tablist"')
    expect(hub).not.toContain('<button')
  })

  it('the screen is told its part, and then draws no tab bar of its own', () => {
    // 12 Nov 2026 (V61 audit): the org chart is its own screen, so the section
    // goes through `TeamSectionBody`, which hands every other part to the screen.
    expect(hub).toContain("<TeamSectionBody section={tab === 'pay' ? pay : team} />")
    expect(file).toContain("if (section === 'orgChart') return <OrgChartSection />")
    expect(file).toContain('return <TeamAndPayrollScreen section={section} />')
    // The view has no pills of its own left.
    expect(ui('team-and-payroll', 'team-and-payroll-view.tsx')).not.toContain('role="tablist"')
  })

  it('«ساعات کار» mounts its own container, lazily, behind its page’s lock', () => {
    expect(file).toContain('const TimesheetsContainer = lazy(')
    expect(hub).toContain('<TimesheetsContainer />')
    expect(TIMESHEETS_SOURCE).toBe('/timesheets')
    expect(NAV_MODULE[TIMESHEETS_SOURCE]).toBe('people')
    expect(hub).toContain("section !== 'timesheets' || !isNavLocked(TIMESHEETS_SOURCE, blocked)")
  })
})

describe('addresses, «قبل / بعد» and the menu', () => {
  it.each([
    ['branches', '/team-and-payroll?view=branches'],
    ['payroll', '/team-and-payroll'],
    ['attendance', '/team-and-payroll?tab=pay&view=attendance'],
  ])('the old ?tab=%s opens %s', (oldTab, address) => {
    expect(teamAddressOf(oldTab)).toBe(address)
  })

  it('the removed «حقوق» section lands on the team page', () => {
    expect(teamAddressOf('pay', 'payroll')).toBe('/team-and-payroll')
    expect(teamAddressOf('pay', 'attendance')).toBeNull()
  })

  it('a new address is left alone', () => {
    for (const value of ['pay', 'team', 'employees', null]) expect(teamAddressOf(value)).toBeNull()
  })

  it('every label exists in all three languages', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const all = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json'))
      const words = all.teamHub
      for (const key of ['label', 'loading', 'sectionsLabel']) {
        expect(words[key], `${lang} ${key}`).toEqual(expect.any(String))
      }
      for (const tab of TEAM_HUB_TABS)
        expect(words.tabs[tab], `${lang} ${tab}`).toEqual(expect.any(String))
      for (const section of [...TEAM_SECTIONS, ...PAY_SECTIONS]) {
        expect(words.sections[section], `${lang} ${section}`).toEqual(expect.any(String))
      }
      for (const key of [
        'scheduleTitle',
        'month',
        'year',
        'day',
        'hour',
        'minute',
        'scheduleHint',
        'schedulePast',
        'runsAt',
      ]) {
        expect(all.accounting.monthEnd[key], `${lang} monthEnd.${key}`).toEqual(expect.any(String))
      }
    }
  })
})

describe('the month-end run time: month, year, day, hour, minute in one row', () => {
  const tab = ui('accounting', 'tabs', 'MonthEndTab.tsx')

  it('five selects in one row that does not wrap', () => {
    const row = tab.slice(tab.indexOf('data-run-schedule=""'))
    for (const name of ['runMonth', 'runYear', 'dayOfMonth', 'runHour', 'runMinute']) {
      expect(row, name).toContain(`name="${name}"`)
    }
    expect(tab).toContain('flex flex-nowrap items-end gap-2 overflow-x-auto')
  })

  it('offers only minutes the five-minute runner can honour', () => {
    expect([...RUN_MINUTES]).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
  })

  it('offers this month and the thirteen after it, each with its first day', () => {
    const months = startMonths('2026-10-05', 'gregory')
    expect(months).toHaveLength(14)
    expect(months[0]).toEqual({ year: 2026, month: 10, from: '2026-10-01' })
    expect(months[3]).toEqual({ year: 2027, month: 1, from: '2027-01-01' })
    // The reader's own calendar: Mehr 1405 starts on 23 Sep 2026.
    expect(startMonths('2026-10-05', 'persian')[0]).toEqual({
      year: 1405,
      month: 7,
      from: '2026-09-23',
    })
  })

  it('sends day, start, minute of the day and the device’s zone — and refuses a past month', () => {
    expect(tab).toContain('dayOfMonth: Number(runDay),')
    expect(tab).toContain('atMinute: Number(runHour) * 60 + Number(runMinute),')
    expect(tab).toContain('timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,')
    expect(tab).toContain('disabled={!hasYearEnd || !runFrom || createAutomatic.isPending}')
  })
})
