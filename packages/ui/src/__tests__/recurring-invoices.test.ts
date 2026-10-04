// ============================================
// Recurring invoices (capability #63) — the client side.
//
//   · the cadence a confirmed invoice turns into, starting with the NEXT
//     occurrence (the invoice on screen is this period's);
//   · every key the two screens use exists in fa, af and en — `t()` throws on a
//     missing key and takes the invoices page with it;
//   · a run's reason is a closed list, each code with a sentence;
//   · the repeat is set up only AFTER the invoice is recorded, and its failure
//     never reads as a failed invoice.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  INITIAL_RECURRENCE,
  cadenceFor,
  scheduleCalendarFor,
} from '../components/ui/invoice-builder/recurrence-panel'
import { RECURRING_REASON_CODES } from '../components/ui/invoices/recurring-invoices'

const ROOT = join(__dirname, '..', '..', '..', '..')
const UI = join(__dirname, '..', 'components', 'ui')
const FILES = [
  join(UI, 'invoice-builder', 'recurrence-panel.tsx'),
  join(UI, 'invoices', 'recurring-invoices.tsx'),
  join(UI, 'invoice-builder', 'containers', 'invoice-preview-container.tsx'),
]

const code = (path: string) =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')

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

describe('cadenceFor', () => {
  const on = { ...INITIAL_RECURRENCE, enabled: true }

  it('monthly: the invoice’s own day of the month, from the day after it', () => {
    expect(cadenceFor({ ...on, kind: 'monthly' }, '2026-10-04T00:00:00.000Z', 'gregory')).toEqual({
      kind: 'monthly',
      dayOfMonth: 4,
      calendar: 'gregory',
      from: '2026-10-05',
    })
  })

  it('monthly on the 31st starts on the 1st of the next month — built from a date, not a string', () => {
    expect(cadenceFor({ ...on, kind: 'monthly' }, '2026-10-31', 'gregory')).toEqual({
      kind: 'monthly',
      dayOfMonth: 31,
      calendar: 'gregory',
      from: '2026-11-01',
    })
  })

  // ⚠️ The same invoice, for a Persian or Dari reader: 4 October 2026 is 12 Mehr
  // 1405, so «every month, on this day» is the 12th of every solar Hijri month —
  // not the 4th of Gregorian months the reader never sees.
  it('monthly in the reader’s calendar: the solar Hijri day, not the Gregorian one', () => {
    expect(cadenceFor({ ...on, kind: 'monthly' }, '2026-10-04', 'persian')).toEqual({
      kind: 'monthly',
      dayOfMonth: 12,
      calendar: 'persian',
      from: '2026-10-05',
    })
  })

  it('the calendar follows the language: fa and af solar Hijri, en Gregorian', () => {
    expect(scheduleCalendarFor('fa-IR')).toBe('persian')
    expect(scheduleCalendarFor('fa-AF')).toBe('persian')
    expect(scheduleCalendarFor('fa')).toBe('persian')
    expect(scheduleCalendarFor('en')).toBe('gregory')
    expect(scheduleCalendarFor('en-US')).toBe('gregory')
  })

  it('interval: first due one interval after the invoice, across a year end', () => {
    expect(
      cadenceFor({ ...on, kind: 'interval', everyDays: '7' }, '2026-12-28', 'persian'),
    ).toEqual({
      kind: 'interval',
      everyDays: 7,
      from: '2027-01-04',
    })
  })

  it.each(['', '0', '-3', '2.5', 'abc', '400'])(
    'interval «%s» is refused, not guessed',
    (typed) => {
      expect(
        cadenceFor({ ...on, kind: 'interval', everyDays: typed }, '2026-10-04', 'gregory'),
      ).toBeNull()
    },
  )

  it('an invoice with no usable date has no cadence', () => {
    expect(cadenceFor({ ...on, kind: 'monthly' }, '', 'persian')).toBeNull()
  })
})

describe('translations', () => {
  const keys = new Set<string>()
  for (const file of FILES) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(
      /['"`]((?:invoices\.recurring|invoiceBuilder\.recurrence)\.[A-Za-z0-9_.]+)['"`]\s*,/g,
    )) {
      keys.add(match[1] as string)
    }
  }
  const used = [...keys].filter((key) => !key.endsWith('.'))

  it('finds the keys it is supposed to check', () => {
    expect(used.length).toBeGreaterThan(40)
  })

  it.each(LOCALES)('every key used on screen is a string in %s', (locale) => {
    expect(used.filter((key) => typeof lookup(messages[locale], key) !== 'string')).toEqual([])
  })

  it.each(LOCALES)('every reason code has a sentence in %s', (locale) => {
    expect(RECURRING_REASON_CODES.length).toBeGreaterThan(8)
    expect(
      RECURRING_REASON_CODES.filter(
        (reason) =>
          typeof lookup(messages[locale], `invoices.recurring.reasons.${reason}`) !== 'string',
      ),
    ).toEqual([])
  })

  it('a server message is never looked up as a key outside the closed list', () => {
    const list = code(join(UI, 'invoices', 'recurring-invoices.tsx'))
    // Exactly one interpolated lookup — the guarded one inside recurringReasonText.
    expect(list.match(/invoices\.recurring\.reasons\.\$\{/g) ?? []).toHaveLength(1)
    expect(list).toContain('KNOWN.has(code)')
  })
})

describe('where the repeat is set up', () => {
  const preview = code(FILES[2] as string)

  it('after the invoice exists, never before it', () => {
    const invoice = preview.indexOf('await createInvoice.mutateAsync(')
    const repeat = preview.indexOf('await createRecurring.mutateAsync(')
    expect(invoice).toBeGreaterThan(-1)
    expect(repeat).toBeGreaterThan(invoice)
  })

  it('an invalid interval stops the confirm BEFORE the invoice is created', () => {
    const check = preview.indexOf('recurrence.enabled && !cadence')
    expect(check).toBeGreaterThan(-1)
    expect(check).toBeLessThan(preview.indexOf('await createInvoice.mutateAsync('))
  })

  it('the template carries no date and no payment of the invoice it came from', () => {
    const start = preview.indexOf('await createRecurring.mutateAsync(')
    const body = preview.slice(start, preview.indexOf('toast.success', start))
    for (const field of [
      'paidAmount',
      'payments',
      'paymentMethod',
      'idempotencyKey',
      'date:',
      'dueDate:',
    ]) {
      expect(body, field).not.toContain(field)
    }
    expect(body).toContain('items,')
  })

  it('an invoice queued offline does not set up a repeat, and says so', () => {
    expect(preview).toContain('cadence && !created.pendingSync')
    expect(preview).toContain('invoiceBuilder.recurrence.offline')
  })

  it('a failed repeat is a warning about the repeat — the invoice is not reported as failed', () => {
    const start = preview.indexOf('await createRecurring.mutateAsync(')
    const handler = preview.slice(start, preview.indexOf('preferences.setLastCustomer', start))
    expect(handler).toContain('toast.warning(')
    expect(handler).not.toContain('setError(')
  })

  it('the invoices page offers the list', () => {
    expect(code(join(UI, 'invoices', 'containers', 'invoices-container.tsx'))).toContain(
      '<RecurringInvoicesButton',
    )
  })
})
