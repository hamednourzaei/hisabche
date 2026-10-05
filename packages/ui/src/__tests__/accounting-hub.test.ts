// ============================================
// «حسابداری» — the redesigned /accounting.
//
// What can go wrong: seven tabs creeping back; the hub drawing its own bar or
// switch; an old `?tab=journal` link landing on the chart of accounts; the
// chart of accounts or the journal keeping a hand-made list; a journal row
// that cannot be opened; the two financing registers stacked on one screen;
// «before» being changed or lost.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  ACCOUNTING_BOOK_SECTIONS,
  ACCOUNTING_HUB_TABS,
  ACCOUNTING_REPORT_SECTIONS,
  ACCOUNTING_SECTION_SOURCE,
  ACCOUNTING_TREASURY_SECTIONS,
  accountingAddressOf,
} from '../components/ui/accounting/AccountingPage'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
const ui = (...parts: string[]) =>
  code(read('packages', 'ui', 'src', 'components', 'ui', 'accounting', ...parts))

const page = ui('AccountingPage.tsx')
const hub = page.slice(page.indexOf('function AccountingHub()'))

describe('three tabs, each with one switch', () => {
  it('books, treasury and reports — ten screens under them', () => {
    expect([...ACCOUNTING_HUB_TABS]).toEqual(['books', 'treasury', 'reports'])
    expect([...ACCOUNTING_BOOK_SECTIONS]).toEqual(['accounts', 'journal', 'monthEnd'])
    expect([...ACCOUNTING_TREASURY_SECTIONS]).toEqual(['bank', 'assets', 'financing'])
    expect([...ACCOUNTING_REPORT_SECTIONS]).toEqual([
      'trialBalance',
      'balanceSheet',
      'incomeStatement',
      'budgets',
    ])
  })

  it('is the shared PageHub — it draws no bar and no switch of its own', () => {
    expect(hub).toContain('<PageHub')
    expect(hub).not.toContain('<HubTabs')
    expect(hub).not.toContain('<SegmentedControl')
    expect(hub).not.toContain('<AccountingTabs')
    expect(hub).not.toContain('role="tablist"')
  })

  it('mounts each screen exactly once and fetches nothing itself', () => {
    for (const screen of [
      'AccountsTab',
      'JournalTab',
      'MonthEndTab',
      'FinancingTab',
      'TrialBalanceTab',
      'BalanceSheetTab',
      'IncomeStatementTab',
      'BankContainer',
      'BudgetsContainer',
      'AssetsContainer',
    ]) {
      expect(hub.split(`<${screen} />`).length - 1, screen).toBe(1)
    }
    const allowed = ['useTranslations', 'useSearchParams', 'useLocaleReplace', 'useEffect']
    const dataHooks = [...hub.matchAll(/\buse[A-Z]\w+(?=\()/g)]
      .map((match) => match[0])
      .filter((name) => !allowed.includes(name))
    expect(dataHooks).toEqual([])
  })

  it('bank, budgets and assets came in from their own pages, behind those pages’ locks', () => {
    expect(ACCOUNTING_SECTION_SOURCE).toEqual({
      bank: '/bank',
      assets: '/assets',
      budgets: '/budgets',
    })
    expect(page).toContain('const BankContainer = lazy(')
    expect(page).toContain('const BudgetsContainer = lazy(')
    expect(hub).toContain('source: ACCOUNTING_SECTION_SOURCE[id],')
  })

  it('every report still sits inside the branch scope', () => {
    expect(hub).toContain('<BranchScopeProvider>')
  })
})

describe('«دارایی‌های ثابت» came in as a section of «دفترها»', () => {
  const assets = (file: string) =>
    code(read('packages', 'ui', 'src', 'components', 'ui', 'assets', ...file.split('/')))
  const view = assets('assets-view.tsx')

  it('the hub mounts the container that owns it, lazily', () => {
    expect(page).toContain('const AssetsContainer = lazy(')
    expect(hub.split('<AssetsContainer />').length - 1).toBe(1)
  })

  it('an asset can be ADDED and DISPOSED OF from the screen — it was a list nobody could add to', () => {
    const container = assets('containers/assets-container.tsx')
    expect(container).toContain('useCreateAsset()')
    expect(container).toContain('useDisposeAsset()')
    expect(view).toContain('data-add-asset=""')
    expect(view).toContain('data-dispose-asset=""')
    // What is left at the end must be less than what it cost.
    expect(view).toContain('salvageMinor < costMinor')
    // A disposed asset is not offered for disposal again.
    expect(view).toContain('{...(selected.disposedOn')
  })

  it('the status filter is in the table’s toolbar and the four figures never pop in', () => {
    expect(view).toContain('<TableFilterSelect')
    expect(view).not.toContain('<SegmentedFilter')
    expect(view).toContain(
      "const figure = (value: number) => (isLoading ? '…' : error ? '—' : value)",
    )
    expect(view).not.toContain('!isLoading && !error && assets.length > 0 ? (')
  })

  it('the empty state no longer claims assets come from somewhere they do not', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const words = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json'))
      expect(words.assets.empty_hint, lang).not.toMatch(/purchase invoice|فاکتور خرید/)
      for (const key of ['add', 'dispose', 'proceeds', 'dispose_hint', 'acquired_on']) {
        expect(words.assets[key], `${lang} assets.${key}`).toEqual(expect.any(String))
      }
    }
  })
})

describe('the old addresses', () => {
  it.each([
    ['accounts', '/accounting'],
    ['journal', '/accounting?view=journal'],
    ['monthEnd', '/accounting?view=monthEnd'],
    ['financing', '/accounting?tab=treasury&view=financing'],
    ['assets', '/accounting?tab=treasury&view=assets'],
    ['trialBalance', '/accounting?tab=reports'],
    ['balanceSheet', '/accounting?tab=reports&view=balanceSheet'],
    ['incomeStatement', '/accounting?tab=reports&view=incomeStatement'],
  ])('?tab=%s opens %s', (oldTab, address) => {
    expect(accountingAddressOf(oldTab)).toBe(address)
  })

  it('a new address is left alone', () => {
    expect(accountingAddressOf('reports')).toBeNull()
    expect(accountingAddressOf('treasury')).toBeNull()
    expect(accountingAddressOf('books')).toBeNull()
    expect(accountingAddressOf(null)).toBeNull()
    expect(hub).toContain('if (moved) localeReplace(moved)')
  })
})

describe('the lists are the shared table', () => {
  const accounts = ui('tabs', 'AccountsTab.tsx')
  const journal = ui('tabs', 'JournalTab.tsx')

  it('the chart of accounts: search and a type filter in the toolbar', () => {
    expect(accounts).toContain('tableId="accounts"')
    expect(accounts).toContain('<TableFilterSelect')
    expect(accounts).toContain('matchesSearch(search, [account.code, account.name])')
    expect(accounts).not.toContain('<LedgerTable')
  })

  it('the journal: a row opens its entry under the table', () => {
    expect(journal).toContain('tableId="journal-entries"')
    expect(journal).toContain(
      'onRowClick={(entry) => setOpenId((current) => (current === entry.id ? null : entry.id))}',
    )
    expect(journal).toContain('defaultOpen />')
    // Not the old stack of accordions.
    expect(journal).not.toContain('{entries.map((entry) => (')
  })

  it('«nothing yet» and «nothing matches» are two messages', () => {
    expect(accounts).toContain("safeT('accounting.accounts.noMatch'")
    expect(journal).toContain("safeT('accounting.journal.noMatch'")
  })

  it('loans OR holdings — never both on one screen', () => {
    const financing = ui('tabs', 'FinancingTab.tsx')
    expect(financing).toContain('<SegmentedControl')
    expect(financing).toContain("{section === 'holdings' ? (")
    expect(financing.split('<Loans ').length - 1).toBe(1)
    expect(financing.split('<Holdings ').length - 1).toBe(1)
  })
})

describe('periods: from … to', () => {
  const trial = ui('tabs', 'TrialBalanceTab.tsx')

  it('the trial balance takes a start and an end, and sends both', () => {
    expect(trial).toContain('<DateRangePicker')
    expect(trial).toContain('useTrialBalance(date, branchId, fromDate)')
    const hook = code(read('packages', 'api', 'src', 'hooks', 'accounting.ts'))
    expect(hook).toContain('fromDate: fromDate || undefined')
    // Two periods are two answers: the start is part of the cache key.
    expect(hook).toContain('accountingKeys.trialBalance(date, branchId, fromDate)')
  })

  it('the drill-down opens the same window the figures were built from', () => {
    expect(trial).toContain('useAccountDrilldown(fromDate, date, safeT)')
  })

  it('the chart of accounts filters by when an account was opened', async () => {
    const { openedWithin } = await import('../components/ui/accounting/tabs/AccountsTab')
    expect(openedWithin('2026-03-10T08:00:00Z', '', '')).toBe(true)
    expect(openedWithin(null, '', '')).toBe(true)
    expect(openedWithin('2026-03-10T08:00:00Z', '2026-03-01', '2026-03-31')).toBe(true)
    expect(openedWithin('2026-03-10T08:00:00Z', '2026-03-11', '')).toBe(false)
    expect(openedWithin('2026-03-10T08:00:00Z', '', '2026-03-09')).toBe(false)
    // No recorded date cannot be placed in a period — it is not guessed in.
    expect(openedWithin(null, '2026-01-01', '')).toBe(false)
  })
})

describe('«قبل / بعد» and words', () => {
  it('every label exists in all three languages', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const words = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json'))
      for (const key of ['label', 'booksLabel', 'reportsLabel']) {
        expect(words.accountingHub[key], `${lang} ${key}`).toEqual(expect.any(String))
      }
      for (const tab of ACCOUNTING_HUB_TABS) {
        expect(words.accountingHub.tabs[tab], `${lang} ${tab}`).toEqual(expect.any(String))
      }
      for (const section of [
        ...ACCOUNTING_BOOK_SECTIONS,
        ...ACCOUNTING_TREASURY_SECTIONS,
        ...ACCOUNTING_REPORT_SECTIONS,
      ]) {
        expect(words.accounting.tabs[section], `${lang} ${section}`).toEqual(expect.any(String))
      }
      expect(words.financing.sectionsLabel, lang).toEqual(expect.any(String))
      expect(words.accounting.accounts.noMatch, lang).toEqual(expect.any(String))
      expect(words.accounting.journal.noMatch, lang).toEqual(expect.any(String))
    }
  })
})
