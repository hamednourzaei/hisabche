// ============================================
// The Business-OS screens wired from October 2026 on: every translation key
// they use is a non-empty string in fa, af and en.
//
// `t()` on a missing key throws and takes the page to the error boundary, and
// several of these screens call the raw `useTranslations()` (no fallback). One
// guard, with a row per screen, so adding a screen is adding a row — not
// writing a seventh copy of the same test.
//
// A row lists the FILE, the key PREFIXES it owns, and — for keys built at run
// time (`t(\`…step.${step}\`)`) — the closed set of values that reach them.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..', '..')
const UI = join(__dirname, '..', 'components', 'ui')

interface Screen {
  name: string
  file: string
  prefixes: string[]
  /** Keys assembled at run time: prefix → every suffix that can occur. */
  dynamic?: Record<string, readonly string[]>
}

const SCREENS: Screen[] = [
  {
    name: 'month-end tab',
    file: join(UI, 'accounting', 'tabs', 'MonthEndTab.tsx'),
    prefixes: ['accounting.monthEnd.'],
    dynamic: {
      'accounting.monthEnd.step.': [
        'depreciation',
        'fx_revaluation',
        'cost_repost',
        'year_end_close',
        'period_lock',
      ],
      'accounting.monthEnd.status.': ['ok', 'nothing_to_do', 'failed'],
      'accounting.monthEnd.errors.': [
        'AUTOMATION_MONTH_END_EXISTS',
        'AUTOMATION_MIGRATION_PENDING',
      ],
      'accounting.monthEnd.': ['runFailed', 'saveFailed'],
    },
  },
  {
    name: 'undo disclosure (#81)',
    file: join(UI, 'undo-disclosure.tsx'),
    prefixes: ['undo.'],
    dynamic: {
      'undo.kind.': [
        'invoice_create',
        'invoice_cancel',
        'payment_record',
        'payment_cancel',
        'purchase_order_create',
        'stock_adjust',
        'budget_commit',
      ],
    },
  },
  {
    name: 'saved views menu (#87, #89)',
    file: join(UI, 'data-table', 'saved-views-menu.tsx'),
    prefixes: ['table.views.'],
    dynamic: {
      'table.views.errors.': ['SAVED_VIEW_NAME_TAKEN', 'SAVED_VIEWS_MIGRATION_PENDING'],
    },
  },
  {
    name: 'business analysis page',
    file: join(UI, 'analysis', 'analysis-container.tsx'),
    prefixes: ['analysis.', 'nav.analysis'],
    dynamic: {
      'analysis.collections.tones.': ['courtesy', 'formal', 'firm', 'final'],
      'analysis.suppliers.bands.': ['low', 'moderate', 'high', 'unknown'],
      'analysis.suppliers.signals.': ['LATE_DELIVERY', 'PRICE_DRIFT', 'INACTIVITY', 'UNRECEIVED'],
      'analysis.breakEven.reasons.': ['NO_REVENUE', 'NO_CONTRIBUTION', 'NO_FIXED_COSTS'],
    },
  },
  {
    name: 'customer risk note',
    file: join(UI, 'analysis', 'customer-risk-note.tsx'),
    prefixes: ['analysis.risk.'],
    dynamic: {
      'analysis.risk.': ['title', 'failed', 'averageLate', 'healthTitle', 'loyaltyTitle'],
      'analysis.risk.health.': ['growing', 'steady', 'shrinking', 'dormant'],
      'analysis.risk.loyalty.': ['new', 'regular', 'loyal', 'champion'],
      'analysis.risk.bands.': ['healthy', 'watch', 'at_risk', 'unknown'],
      'analysis.risk.signals.': ['RECENT_LATE', 'TREND', 'GROWING_DEBT', 'BROKEN_PROMISE'],
      'analysis.risk.reasons.': ['NEVER_BOUGHT', 'TOO_FEW_SETTLED', 'NO_SETTLED_INVOICES'],
    },
  },
  {
    name: 'invoice installments panel (#123)',
    file: join(UI, 'invoice-detail', 'invoice-installments-panel.tsx'),
    prefixes: ['installments.'],
    dynamic: {
      'installments.': [
        'title',
        'show',
        'hide',
        'loading',
        'seq',
        'dueDate',
        'amount',
        'paid',
        'status',
        'statusPaid',
        'statusLate',
        'statusDue',
        'clear',
        'clearConfirm',
        'clearYes',
        'cancel',
        'nothingOwed',
        'noPlan',
        'count',
        'firstDueDate',
        'save',
        'hint',
      ],
      'installments.errors.': [
        'general',
        'INSTALLMENT_COUNT_INVALID',
        'INSTALLMENT_NOTHING_OWED',
        'INSTALLMENT_SUM_MISMATCH',
        'INSTALLMENTS_MIGRATION_PENDING',
      ],
    },
  },
  {
    name: 'attendance sheet (#100)',
    file: join(UI, 'team-and-payroll', 'attendance-sheet.tsx'),
    prefixes: ['attendance.'],
    dynamic: {
      'attendance.': [
        'date',
        'forbidden',
        'loadFailed',
        'noEmployees',
        'employee',
        'status',
        'checkIn',
        'checkOut',
        'hours',
        'actions',
        'note',
        'notRecorded',
        'stillIn',
        'checkInNow',
        'checkOutNow',
        'saveTimes',
        'markPresent',
        'markLeave',
        'markAbsent',
      ],
      'attendance.summary.': ['present', 'absent', 'leave', 'stillIn', 'notRecorded'],
      'attendance.statuses.': ['present', 'absent', 'leave', 'holiday', 'open'],
      'attendance.errors.': [
        'general',
        'ATTENDANCE_TIME_INVALID',
        'ATTENDANCE_CHECK_OUT_WITHOUT_CHECK_IN',
        'ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN',
      ],
      'team.': ['attendance'],
    },
  },
  {
    name: 'promotions screen (#114–#117)',
    file: join(UI, 'promotions', 'promotions-container.tsx'),
    prefixes: ['promotions.'],
    dynamic: {
      'promotions.': [
        'title',
        'subtitle',
        'add',
        'forbidden',
        'empty',
        'retired',
        'always',
        'stacks',
        'retire',
        'reactivate',
        'note',
        'scopeProducts',
        'scopeCustomers',
        'allProducts',
        'allCustomers',
        'newTitle',
        'name',
        'kind',
        'percent',
        'amount',
        'currency',
        'validFrom',
        'validTo',
        'noLimit',
        'stackingLabel',
        'stackingHint',
        'save',
        'cancel',
        'forProducts',
        'forCustomers',
        'onlyTheseProducts',
        'onlyTheseCustomers',
        'remove',
        'searchProduct',
        'searchCustomer',
        'searchFailed',
        'searching',
        'nothingFound',
      ],
      'promotions.kinds.': ['percentage', 'fixed_amount'],
      'promotions.errors.': [
        'general',
        'incomplete',
        'PROMOTION_PERCENT_OVER_100',
        'PROMOTION_CURRENCY_REQUIRED',
        'PROMOTION_WINDOW_INVERTED',
        'PROMOTION_PRODUCT_NOT_FOUND',
        'PROMOTION_CUSTOMER_NOT_FOUND',
        'PROMOTIONS_MIGRATION_PENDING',
      ],
      'nav.': ['promotions', 'promotions_description'],
      'invoiceBuilder.grid.': ['promotion'],
    },
  },
  {
    name: 'bank category suggestions (#62)',
    file: join(UI, 'bank', 'bank-category-suggestions.tsx'),
    prefixes: ['bank.category_'],
    dynamic: {
      'bank.': [
        'category_title',
        'category_hint',
        'category_failed',
        'category_none_open',
        'category_no_history',
        'category_date',
        'category_line',
        'category_amount',
        'category_account',
        'category_evidence',
        'category_ambiguous',
        'category_insufficient',
        'category_no_pattern',
        'review_bank_charge',
        'review_ready',
      ],
    },
  },
  {
    name: 'entity notes (#103)',
    file: join(UI, 'entity-notes.tsx'),
    prefixes: ['notes.'],
    dynamic: {
      'notes.': [
        'title',
        'show',
        'hide',
        'loading',
        'forbidden',
        'placeholder',
        'permanent',
        'add',
        'empty',
        'mine',
      ],
      'notes.errors.': [
        'general',
        'NOTE_EMPTY_BODY',
        'NOTE_BODY_TOO_LONG',
        'NOTES_MIGRATION_PENDING',
      ],
    },
  },
  {
    name: 'shift manager (#101)',
    file: join(UI, 'team-and-payroll', 'shift-manager.tsx'),
    prefixes: ['shifts.'],
    dynamic: {
      'shifts.': [
        'title',
        'hint',
        'show',
        'hide',
        'loading',
        'empty',
        'retired',
        'retire',
        'reactivate',
        'hours',
        'breakLabel',
        'name',
        'startsAt',
        'endsAt',
        'breakMinutes',
        'add',
      ],
      'shifts.errors.': [
        'general',
        'SHIFT_INVALID_TIMES',
        'SHIFT_BREAK_LONGER_THAN_SHIFT',
        'SHIFT_NAME_TAKEN',
        'SHIFTS_MIGRATION_PENDING',
      ],
      'attendance.': ['shiftPicker', 'shiftNone', 'byShift'],
    },
  },
  {
    name: 'financing tab (#125 #126)',
    file: join(UI, 'accounting', 'tabs', 'FinancingTab.tsx'),
    prefixes: ['financing.'],
    dynamic: {
      'financing.': [
        'notLedger',
        'forbidden',
        'currency',
        'save',
        'cancel',
        'close',
        'reopen',
        'closed',
      ],
      'financing.loans.': [
        'title',
        'add',
        'kind',
        'counterparty',
        'principal',
        'rate',
        'frequency',
        'startDate',
        'endDate',
        'noEnd',
        'empty',
        'accrued',
        'term',
        'instalment',
        'days',
        'noInstalment',
        'note',
      ],
      'financing.loans.kinds.': ['loan', 'receivable_facility'],
      'financing.loans.frequencies.': ['1', '2', '4', '12'],
      'financing.holdings.': [
        'title',
        'add',
        'label',
        'cost',
        'value',
        'empty',
        'difference',
        'valuedOn',
        'revalue',
        'note',
      ],
      'financing.errors.': [
        'general',
        'incomplete',
        'FINANCING_DATES_INVERTED',
        'FINANCING_AMOUNT_INVALID',
        'FINANCING_VALUE_NEEDS_DATE',
        'FINANCING_MIGRATION_PENDING',
      ],
      'accounting.tabs.': ['financing'],
    },
  },
  {
    name: 'custom fields panel (#141–#143)',
    file: join(UI, 'custom-fields-panel.tsx'),
    prefixes: ['customFields.'],
    dynamic: {
      'customFields.': [
        'title',
        'show',
        'hide',
        'loading',
        'forbidden',
        'yes',
        'no',
        'empty',
        'computed',
        'retire',
        'save',
        'saved',
        'manage',
        'doneManaging',
        'manageHint',
        'fieldLabel',
        'fieldKey',
        'fieldType',
        'keyRule',
        'choices',
        'formula',
        'formulaHint',
        'formulaNoNumbers',
        'required',
        'addField',
      ],
      'customFields.none.': ['customer', 'supplier', 'product'],
      'customFields.types.': ['text', 'number', 'date', 'boolean', 'choice', 'formula'],
      'customFields.formulaProblems.': [
        'MISSING_VALUE',
        'DIVIDE_BY_ZERO',
        'NOT_A_NUMBER',
        'UNKNOWN_FIELD',
        'UNKNOWN_OPERATOR',
        'UNBALANCED',
        'EMPTY',
      ],
      'customFields.errors.': [
        'general',
        'CUSTOM_FIELD_INVALID',
        'CUSTOM_FIELD_REQUIRED',
        'CUSTOM_FIELD_UNKNOWN',
        'CUSTOM_FIELD_KEY_TAKEN',
        'CUSTOM_FIELD_LIMIT_REACHED',
        'CUSTOM_FIELD_CHOICES_REQUIRED',
        'CUSTOM_FIELD_FORMULA_EMPTY',
        'CUSTOM_FIELD_FORMULA_UNKNOWN_FIELD',
        'CUSTOM_FIELD_FORMULA_UNKNOWN_OPERATOR',
        'CUSTOM_FIELD_FORMULA_UNBALANCED',
        'CUSTOM_FIELDS_MIGRATION_PENDING',
      ],
    },
  },
  {
    name: 'report builder (#145)',
    file: join(UI, 'analysis', 'report-builder.tsx'),
    prefixes: ['reportBuilder.'],
    dynamic: {
      'reportBuilder.': [
        'newTitle',
        'name',
        'measures',
        'groupBy',
        'hint',
        'save',
        'savedTitle',
        'empty',
        'retire',
        'noRows',
        'noCustomer',
        'capped',
        'live',
      ],
      'reportBuilder.measureNames.': ['count', 'outstanding', 'collected'],
      'reportBuilder.dimensionNames.': ['month', 'quarter', 'customer', 'currency'],
      'reportBuilder.errors.': [
        'general',
        'REPORT_NOT_RUNNABLE',
        'REPORT_NAME_TAKEN',
        'REPORT_NO_MEASURES',
        'REPORT_TOO_MANY_DIMENSIONS',
        'REPORT_NON_ADDITIVE_IN_TIME',
        'REPORTS_MIGRATION_PENDING',
      ],
      'analysis.tabs.': ['reports'],
    },
  },
  {
    name: 'data snapshots panel (#42–#46)',
    file: join(UI, 'data-and-sync', 'data-snapshots-panel.tsx'),
    prefixes: ['snapshots.'],
    dynamic: {
      'snapshots.': [
        'title',
        'notBackup',
        'show',
        'hide',
        'loading',
        'forbidden',
        'label',
        'labelPlaceholder',
        'take',
        'empty',
        'notReadable',
        'what',
        'then',
        'now',
        'added',
        'limits',
      ],
      'snapshots.tables.': [
        'journal_entries',
        'journal_lines',
        'accounts',
        'invoices',
        'invoice_items',
        'payments',
        'payment_allocations',
        'customers',
        'suppliers',
        'products',
      ],
      'snapshots.errors.': ['general', 'SNAPSHOTS_MIGRATION_PENDING'],
    },
  },
  {
    name: 'AI assistants panel (MCP)',
    file: join(UI, 'developers', 'ai-assistants-panel.tsx'),
    prefixes: ['aiConnect.'],
    dynamic: {
      'aiConnect.': [
        'title',
        'subtitle',
        'show',
        'hide',
        'forbidden',
        'endpoint',
        'step1',
        'step2',
        'step3',
        'safety',
        'queueTitle',
        'queueEmpty',
        'argumentsLabel',
        'approveConfirm',
        'approveYes',
        'cancel',
        'approve',
        'reject',
        'historyTitle',
      ],
      'aiConnect.tools.': [
        'create_invoice',
        'confirm_order',
        'fulfill_order',
        'invoice_order',
        'cancel_order',
      ],
      'aiConnect.risks.': ['financial', 'destructive'],
      'aiConnect.statuses.': ['pending', 'approved', 'executed', 'failed', 'rejected', 'expired'],
      'aiConnect.errors.': [
        'general',
        'AI_REQUEST_ALREADY_DECIDED',
        'AI_REQUEST_EXPIRED',
        'AI_REQUESTS_MIGRATION_PENDING',
      ],
    },
  },
  {
    name: 'accounting tabs',
    file: join(UI, 'accounting', 'AccountingTabs.tsx'),
    prefixes: ['accounting.tabs.'],
  },
]

const LOCALES = ['fa', 'af', 'en'] as const
const messages = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(
      readFileSync(join(ROOT, 'packages', 'i18n', 'messages', locale, 'common.json'), 'utf8'),
    ) as Record<string, unknown>,
  ]),
) as Record<(typeof LOCALES)[number], Record<string, unknown>>

const lookup = (tree: Record<string, unknown>, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      tree,
    )

function keysOf(screen: Screen): string[] {
  const source = readFileSync(screen.file, 'utf8')
  const keys = new Set<string>()
  for (const prefix of screen.prefixes) {
    const escaped = prefix.replace(/\./g, '\\.')
    for (const match of source.matchAll(
      new RegExp(`['"\`](${escaped}[A-Za-z0-9_.]+)['"\`]`, 'g'),
    )) {
      const key = match[1] as string
      // A key ending in a dot is the static part of a run-time key.
      if (!key.endsWith('.')) keys.add(key)
    }
  }
  for (const [prefix, suffixes] of Object.entries(screen.dynamic ?? {})) {
    for (const suffix of suffixes) keys.add(`${prefix}${suffix}`)
  }
  return [...keys]
}

describe.each(SCREENS)('$name', (screen) => {
  const keys = keysOf(screen)

  it('uses keys this guard can see', () => {
    expect(keys.length).toBeGreaterThan(0)
  })

  it.each(LOCALES)('every key is a non-empty string in %s', (locale) => {
    expect(
      keys.filter((key) => {
        const value = lookup(messages[locale], key)
        return typeof value !== 'string' || value.trim() === ''
      }),
    ).toEqual([])
  })
})
