// ============================================
// The customer page's money parts, its accounting documents, the attendance
// sheet and the month-end run time of an automatic close that is already on
// (5 Oct 2026).
//
// What can go wrong: the removed «رابطه» group (activity, insights, CRM,
// credit & documents, change history) creeping back onto this URL; a money
// part going missing; the accounting documents or the attendance sheet drawn
// by hand again; a time typed for one day showing on another; a saved row
// keeping its stale draft; having to turn the automatic close off and on to
// change its time.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
const ui = (...parts: string[]) => code(read('packages', 'ui', 'src', 'components', 'ui', ...parts))

describe('the customer page: four money parts, and no relationship group', () => {
  const view = ui('customers', 'customer-detail-view.tsx')

  it('renders exactly the four parts of the account, in order', () => {
    const contents = [...view.matchAll(/<TabsContent value="(\w+)"/g)].map((match) => match[1])
    expect(contents).toEqual(['statement', 'invoices', 'payments', 'accounting'])
  })

  it('the removed relationship group stays off this URL', () => {
    // Owner, 21 Nov 2026: فعالیت و کالاها، تحلیل، CRM، اعتبار و مدارک and
    // تاریخچه‌ی تغییرات are gone from the customer page — not hidden, not a
    // second group bar.
    expect(view).not.toContain('<HubTabs')
    expect(view).not.toContain('<CustomerCrmPanel')
    expect(view).not.toContain('<CustomerProfilePanel')
    expect(view).not.toContain('<CustomerPortalPanel')
    expect(view).not.toContain('<CustomerInsightsPanel')
    for (const part of ['activity', 'insights', 'crm', 'account', 'history']) {
      expect(view, part).not.toContain(`value="${part}"`)
    }
    // One switch for what is left.
    expect(view).toContain('<SegmentedControl')
  })

  it('every label exists in all three languages', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const all = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json'))
      expect(all.customer360.groupsLabel, lang).toEqual(expect.any(String))
      for (const key of ['tabStatement', 'tabSales', 'tabPayments', 'tabAccounting']) {
        expect(all.customer360[key], `${lang} customer360.${key}`).toEqual(expect.any(String))
      }
      for (const key of ['filterAll', 'posted', 'colAmount', 'noMatch', 'openDocument']) {
        expect(all.customerAnalysis[key], `${lang} customerAnalysis.${key}`).toEqual(
          expect.any(String),
        )
      }
      expect(all.attendance.noMatch, lang).toEqual(expect.any(String))
      expect(all.accounting.monthEnd.scheduleSave, lang).toEqual(expect.any(String))
      expect(all.accounting.monthEnd.scheduleSaved, lang).toEqual(expect.any(String))
    }
  })
})

describe('accounting documents of a customer', () => {
  const panel = ui('customers', 'customer-analysis-panels.tsx')

  it('one row per document in the shared table; its lines open under it', () => {
    expect(panel).toContain('tableId="customer-accounting"')
    expect(panel).toContain('tableId="customer-accounting-lines"')
    expect(panel).toContain(
      'setOpenId((current) => (current === doc.sourceId ? null : doc.sourceId))',
    )
    expect(panel).not.toContain('<table')
  })

  it('«ثبت‌نشده» is a filter in the toolbar, and posting does not open the row', () => {
    expect(panel).toContain('<TableFilterSelect')
    expect(panel).toContain("filter === 'unposted' ? doc.unposted : !doc.unposted")
    expect(panel).toContain('event.stopPropagation()')
    expect(panel).toContain('post.mutate(doc.sourceId, { onSettled: () => void refetch() })')
  })

  it('a reversal and an entry not yet in the books still say so', () => {
    expect(panel).toContain("(entry.reversalOf ? ` (${t('reversal')})` : '')")
    expect(panel).toContain("entry.status !== 'posted'")
  })
})

describe('the attendance sheet', () => {
  const sheet = ui('team-and-payroll', 'attendance-sheet.tsx')

  it('is the shared table with a status filter — no hand-made table, no row component', () => {
    expect(sheet).toContain('tableId="attendance-sheet"')
    expect(sheet).toContain('<TableFilterSelect')
    expect(sheet).not.toContain('<table')
    expect(sheet).not.toContain('function SheetLine')
  })

  it('«ثبت‌نشده» is its own filter value, never a status', () => {
    expect(sheet).toContain("const NOT_RECORDED = 'none'")
    expect(sheet).toContain('? !row.record')
  })

  it('a typed time belongs to its day, and a saved row forgets its draft', () => {
    expect(sheet).toContain(
      'const draftKey = (row: AttendanceSheetRow) => `${date}|${row.employeeId}`',
    )
    expect(sheet).toContain('delete next[`${date}|${row.employeeId}`]')
  })

  it('still records in place: now, by shift, typed times, leave and absent', () => {
    for (const label of [
      'checkInNow',
      'checkOutNow',
      'byShift',
      'saveTimes',
      'markLeave',
      'markAbsent',
    ]) {
      expect(sheet, label).toContain(`{t('${label}')}`)
    }
    // No hours yet is said in words, never shown as 0.
    expect(sheet).toContain('row.record.result.workedHours === null')
  })
})

describe('an automatic close that is already on takes a new time in place', () => {
  it('the tab saves the cadence with the update hook', () => {
    const tab = ui('accounting', 'tabs', 'MonthEndTab.tsx')
    expect(tab).toContain('useUpdateAutomation()')
    expect(tab).toContain('id: automatic.id,')
    expect(tab).toContain("{t('accounting.monthEnd.scheduleSave')}")
  })

  it('the server gives a timed cadence a zone it knows on update too', () => {
    const service = code(read('backend', 'src', 'services', 'automation', 'automation.service.ts'))
    expect(service).toContain('? { ...cadence, timeZone: resolveTimeZone(cadence.timeZone) }')
  })
})
