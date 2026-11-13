// Owner decisions, 12 Nov 2026 (V61 open decisions 1 and 2) and the console's
// two-person deletions: the screens are wired and every key they read exists
// in fa, af and en (`t()` throws on a missing key).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { sellerPeriodRange } from '../components/ui/erp-core/sellers-section'

const repo = join(__dirname, '..', '..', '..', '..')
const read = (...p: string[]) => readFileSync(join(repo, ...p), 'utf8')
const flat = (s: string) => s.split(/\s+/).join(' ')
type Tree = { [k: string]: string | Tree }
const at = (tree: Tree, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree)

describe('seller on a sale', () => {
  const preview = flat(
    read(
      'packages',
      'ui',
      'src',
      'components',
      'ui',
      'invoice-builder',
      'containers',
      'invoice-preview-container.tsx',
    ),
  )
  it('is sent only for a sale, and only when another member is chosen', () => {
    expect(preview).toContain(
      "const sellerUserId = draft.transactionType === 'sale' ? sellerChoice.sellerUserId : ''",
    )
    expect(preview).toContain('...(sellerUserId ? { sellerUserId } : {}),')
    expect(preview).toContain("{draft.transactionType === 'sale' && sellerChoice.show ? (")
  })
  it('the team hub shows sales per person', () => {
    const team = read(
      'packages',
      'ui',
      'src',
      'components',
      'ui',
      'team-and-payroll',
      'containers',
      'team-and-payroll-container.tsx',
    )
    expect(team).toContain(
      "export const TEAM_SECTIONS = ['employees', 'branches', 'orgChart', 'sellers'] as const",
    )
    expect(team).toContain("if (section === 'sellers') return <SellersSection />")
  })
  it('a period is whole calendar days, the last day of the month included', () => {
    expect(sellerPeriodRange('lastMonth', new Date(2026, 2, 15))).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    })
    expect(sellerPeriodRange('thisMonth', new Date(2026, 0, 31))).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
    })
    expect(sellerPeriodRange('all', new Date())).toEqual({})
  })
})

describe.each(['fa', 'af', 'en'])('keys exist in %s', (lang) => {
  const m = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json')) as Tree
  it('every new key is a string', () => {
    const keys = [
      'teamHub.sections.sellers',
      'invoiceBuilder.seller.label',
      'invoiceBuilder.seller.me',
      'invoiceBuilder.seller.hint',
      'invoiceBuilder.seller.errors.notAMember',
      'invoiceBuilder.seller.errors.notInstalled',
      ...[
        'intro',
        'introOwn',
        'notInstalled',
        'period',
        'formerMember',
        'emptyTitle',
        'emptyDescription',
        'unattributed',
        'loading',
        'loadFailed',
        'retry',
      ].map((k) => `erpCore.sellers.${k}`),
      ...['thisMonth', 'lastMonth', 'all'].map((k) => `erpCore.sellers.periods.${k}`),
      ...['seller', 'invoices', 'total'].map((k) => `erpCore.sellers.columns.${k}`),
      'workflow.condition.typeLabel',
      'workflow.condition.types.all',
      'workflow.condition.types.sale',
      'workflow.condition.types.purchase',
      'workflow.condition.inBookCurrency',
      'workflow.condition.inInvoiceCurrency',
      'workflow.selfApprovalRefused',
      'admin.member.removalProposed',
      'admin.security.allowlist.removalProposed',
    ]
    expect(keys.filter((k) => typeof at(m, k) !== 'string')).toEqual([])
  })
})

describe('the console says a deletion is a request', () => {
  it('member list and allow-list show the «awaiting a second admin» notice', () => {
    expect(read('apps', 'admin', 'components', 'members', 'member-list.tsx')).toContain(
      "t('admin.member.removalProposed')",
    )
    expect(
      read('apps', 'admin', 'app', '[lang]', '(admin)', 'security', 'security-client.tsx'),
    ).toContain("t('admin.security.allowlist.removalProposed')")
  })
})
