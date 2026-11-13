// ============================================
// V61 B.2.18 — «مطالبات هزینه»: the screen exists, the hub reaches it, and a
// claim in two currencies has no total.
//
// The audit found the opposite: five working endpoints, a service, and no screen
// anywhere in web, desktop or mobile — the feature was «complete» only in a
// document. Each assertion below is a different way of being invisible:
//
//   · a section that the hub never mounts      → the container/view assertions
//   · a claim totalled across currencies       → the money assertions
//   · a message file missing one of the keys   → the i18n assertion (a missing
//     key throws and takes the page down)
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { OFFLINE_ENDPOINT_MATRIX } from '@hisabche/validation'

import {
  EXPENSE_CATEGORIES,
  claimTotalOf,
  toClaimRow,
} from '../components/ui/team-and-payroll/expense-claims-section'
import { PAY_SECTIONS } from '../components/ui/team-and-payroll/containers/team-and-payroll-container'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')

const container = code(
  read(
    'packages',
    'ui',
    'src',
    'components',
    'ui',
    'team-and-payroll',
    'containers',
    'team-and-payroll-container.tsx',
  ),
)
const view = code(
  read(
    'packages',
    'ui',
    'src',
    'components',
    'ui',
    'team-and-payroll',
    'team-and-payroll-view.tsx',
  ),
)
const section = code(
  read(
    'packages',
    'ui',
    'src',
    'components',
    'ui',
    'team-and-payroll',
    'expense-claims-section.tsx',
  ),
)

const claim = (lines: Array<{ amount: number; currency: string }>) => ({
  id: 'claim-1',
  title: 'Trip',
  status: 'submitted',
  employeeId: 'employee-1',
  createdAt: '2026-11-12T08:00:00.000Z',
  rejectedReason: null,
  paymentId: null,
  lines: lines.map((line, index) => ({
    id: `line-${index}`,
    category: 'travel',
    amount_minor: line.amount,
    currency: line.currency,
  })),
})

describe('the hub reaches the screen', () => {
  it('«حقوق و حضور» has a third section for claims', () => {
    expect([...PAY_SECTIONS]).toContain('expenses')
    expect(container).toContain("expenses: 'hr.expense_claims'")
  })

  it('the container mounts it, and the view renders what it is given', () => {
    expect(container).toContain("import { ExpenseClaimsSection } from '../expense-claims-section'")
    expect(container).toContain(
      "expensesTab={tab === 'expenses' ? <ExpenseClaimsSection /> : null}",
    )
    expect(view).toContain('expensesTab?: React.ReactNode')
    expect(view).toContain("statusFilter === 'expenses'")
    expect(view).toContain('<div>{expensesTab}</div>')
  })

  it('every endpoint behind the screen is online-only, as the matrix says', () => {
    // A claim is approved against the books and paid as a real payment; none of
    // that can happen on a device that cannot see them.
    for (const key of [
      'GET /expense-claims',
      'POST /expense-claims',
      'POST /expense-claims/:x/approve',
      'POST /expense-claims/:x/reject',
      'POST /expense-claims/:x/reimburse',
    ]) {
      expect(OFFLINE_ENDPOINT_MATRIX[key as keyof typeof OFFLINE_ENDPOINT_MATRIX]).toEqual([
        'hr.expense_claims',
        'online_required',
      ])
    }
  })
})

describe('a claim has a total only when its lines agree', () => {
  it('adds minor units of one currency', () => {
    expect(
      claimTotalOf(
        claim([
          { amount: 3000, currency: 'AFN' },
          { amount: 2000, currency: 'AFN' },
        ]),
      ),
    ).toEqual({ minor: 5000, currency: 'AFN' })
    // Scale, beside the exact case.
    expect(claimTotalOf(claim([{ amount: 1_000_000, currency: 'USD' }]))).toEqual({
      minor: 1_000_000,
      currency: 'USD',
    })
  })

  it('has NO total for two currencies — never a sum of the two', () => {
    expect(
      claimTotalOf(
        claim([
          { amount: 5000, currency: 'AFN' },
          { amount: 20, currency: 'USD' },
        ]),
      ),
    ).toBeNull()
  })

  it('has no total for a claim with no line', () => {
    expect(claimTotalOf(claim([]))).toBeNull()
  })

  it('drops a row it cannot key rather than rendering it under a wrong id', () => {
    expect(toClaimRow({ title: 'no id' })).toBeNull()
    expect(toClaimRow({ id: 'claim-9', status: 'submitted' })?.lines).toEqual([])
  })
})

describe('the amounts are typed in the line’s own currency', () => {
  it('uses typedMinor, and never multiplies or divides by 100', () => {
    expect(section).toContain('typedMinor(amountText, chosenCurrency)')
    expect(section).not.toContain('* 100')
    expect(section).not.toContain('/ 100')
  })
})

describe('every label the screen asks for exists in all three languages', () => {
  it('sections, statuses, categories, actions and refusals', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const all = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json'))
      expect(all.teamHub.sections.expenses, `${lang} section`).toEqual(expect.any(String))
      const words = all.expenseClaims
      for (const key of [
        'intro',
        'approvalNote',
        'unknownEmployee',
        'mixedCurrency',
        'loading',
        'loadFailed',
        'retry',
        'emptyTitle',
        'emptyDescription',
      ]) {
        expect(words[key], `${lang} ${key}`).toEqual(expect.any(String))
      }
      for (const key of ['title', 'employee', 'created', 'total', 'status', 'actions']) {
        expect(words.columns[key], `${lang} columns.${key}`).toEqual(expect.any(String))
      }
      for (const status of ['draft', 'submitted', 'approved', 'rejected', 'reimbursed']) {
        expect(words.status[status], `${lang} status.${status}`).toEqual(expect.any(String))
      }
      for (const action of ['approve', 'reject', 'reimburse']) {
        expect(words.actions[action], `${lang} actions.${action}`).toEqual(expect.any(String))
      }
      for (const category of EXPENSE_CATEGORIES) {
        expect(words.categories[category], `${lang} categories.${category}`).toEqual(
          expect.any(String),
        )
      }
      for (const key of [
        'general',
        'formIncomplete',
        'EXPENSE_CLAIM_CANNOT_APPROVE',
        'EXPENSE_CLAIM_CANNOT_REJECT',
        'EXPENSE_CLAIM_ALREADY_REIMBURSED_OR_UNAPPROVED',
        'EXPENSE_CLAIM_MIXED_CURRENCY',
        'EXPENSE_CLAIM_CURRENCY_MISMATCH',
        'EXPENSE_CLAIM_HAS_NO_LINES',
      ]) {
        expect(words.errors[key], `${lang} errors.${key}`).toEqual(expect.any(String))
      }
      for (const key of [
        'employee',
        'title',
        'category',
        'amount',
        'currency',
        'addLine',
        'lines',
        'noLines',
        'removeLine',
        'submit',
        'saveDraft',
      ]) {
        expect(words.form[key], `${lang} form.${key}`).toEqual(expect.any(String))
      }
      for (const key of ['all']) {
        expect(words.filter[key], `${lang} filter.${key}`).toEqual(expect.any(String))
      }
      for (const key of ['saved', 'approved', 'rejected', 'reimbursed']) {
        expect(words.messages[key], `${lang} messages.${key}`).toEqual(expect.any(String))
      }
      for (const key of ['reason', 'confirm', 'cancel']) {
        expect(words.reject[key], `${lang} reject.${key}`).toEqual(expect.any(String))
      }
    }
  })
})
