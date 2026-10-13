// ============================================
// The till screen's data paths — what was found by READING till-view.tsx and
// its container (12 Oct 2026), each held here so it stays fixed.
//
//   1. «the read failed» and «no such till» were one branch
//   2. three forms closed and emptied themselves before the server answered
//   3. a retried cash movement was a NEW movement (a new id per click)
//   4. a float typed in one currency stayed when the currency was changed
//   5. «همه‌ی ارزها» showed the books currency under another name
//   6. on the list, with tills open, two cards and a panel said «صندوقی باز نیست»
//   7. the day's figures stayed in the books currency on a dollar till's page
//   8. errors were the transport's sentence («Request failed with status code…»)
//
// And one beside it: «mark all as read» was lit by a tab's total, not its unread.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../../../..')
const code = (path: string) =>
  readFileSync(join(ROOT, path), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

const view = code('packages/ui/src/components/ui/till/till-view.tsx')
const container = code('packages/ui/src/components/ui/till/containers/till-container.tsx')
const count = (source: string, needle: string) => source.split(needle).length - 1

describe('1 · a failed read is not «no such till»', () => {
  it('the view has two branches, in this order: failed, then not found', () => {
    const failed = view.indexOf(') : sessionError && !sessionNotFound ? (')
    const missing = view.indexOf(') : sessionNotFound || !session || !totals ? (')
    expect(failed).toBeGreaterThan(-1)
    expect(missing).toBeGreaterThan(failed)
    expect(view).not.toContain('sessionError || !session || !totals')
    // The failed branch offers a retry; the not-found branch offers the way back.
    const between = view.slice(failed, missing)
    expect(between).toContain('<ErrorNote')
    expect(between).toContain('onRetry={onRefresh}')
  })

  it('«not found» is the 404 of the server and nothing else', () => {
    expect(container).toContain('?.response?.status === 404')
    expect(container).toContain('sessionNotFound={Boolean(selectedTillId) && sessionNotFound}')
  })
})

describe('2 · a form closes when the server has answered, not when the button was pressed', () => {
  it('open, movement and close all wait for the outcome', () => {
    expect(view).toContain('}).then((opened) => { if (!opened) return setAddTillOpen(false)')
    expect(view).toContain('}).then((recorded) => { if (!recorded) return setMovementOpen(false)')
    expect(view).toContain('}).then((closed) => { if (closed) setClosing(null) })')
    // Nothing closes a form on the line after the call any more.
    expect(view).not.toMatch(/onOpen\(\{[^}]*\}\) setAddTillOpen\(false\)/)
    expect(view).not.toMatch(/\}\) setMovementOpen\(false\) setMovementAmountMinor\(0\)/)
    expect(view).not.toMatch(/\}\) setClosing\(null\) \}\}/)
  })

  it('the container answers true or false, and reports the refusal', () => {
    for (const mutation of ['openSession', 'cashMovement', 'closeSession']) {
      expect(container, mutation).toContain(`await ${mutation}.mutateAsync(`)
    }
    expect(count(container, '} catch (err) { report(err) return false }')).toBe(3)
    // …and never through a callback that cannot tell the form what happened.
    for (const mutation of ['openSession', 'cashMovement', 'closeSession']) {
      expect(container, mutation).not.toContain(`${mutation}.mutate(`)
    }
  })

  it('the open dialog shows the refusal where the person is looking', () => {
    const dialog = view.slice(view.indexOf('data-add-till'))
    expect(dialog).toContain('{actionError ? <ErrorNote message={actionError} /> : null}')
  })
})

describe('3 · a retried movement is the same movement', () => {
  it('the id is made once per form fill and renewed only after success', () => {
    expect(view).toContain('setMovementRequestId((current) => current || crypto.randomUUID())')
    expect(view).toContain('movementId: movementRequestId,')
    // Emptied — so the next fill makes a new one — inside the success branch only.
    expect(count(view, "setMovementRequestId('')")).toBe(1)
    const success = view.slice(view.indexOf('}).then((recorded) => {'))
    expect(success.indexOf("setMovementRequestId('')")).toBeLessThan(success.indexOf('}) }}'))
    // The container no longer mints one per click.
    expect(container).not.toContain('randomUUID')
    expect(container).toContain(
      'await cashMovement.mutateAsync({ sessionId: selectedTillId, ...input })',
    )
  })
})

describe('4 · minor units belong to a currency', () => {
  it('changing the currency of a new till empties the opening amount', () => {
    expect(view).toContain(
      'const chooseCurrency = (next: string) => { if (next !== currencyDraft) setFloatMinor(0) setCurrencyDraft(next) }',
    )
    const dialog = view.slice(view.indexOf('data-add-till'))
    expect(dialog).toContain('onChange={chooseCurrency}')
    expect(dialog).not.toContain('onChange={setCurrencyDraft}')
  })
})

describe('5 · one currency at a time', () => {
  it('there is no «all currencies» choice, in the screen or in the messages', () => {
    expect(view).not.toContain('all_currencies')
    expect(view).toContain("allValue={bookCurrency ?? ''}")
    for (const lang of ['fa', 'af', 'en']) {
      const till = (
        JSON.parse(
          readFileSync(join(ROOT, 'packages/i18n/messages', lang, 'common.json'), 'utf8'),
        ) as { till: Record<string, unknown> }
      ).till
      expect(till.all_currencies, lang).toBeUndefined()
      expect(typeof till.select_a_till, lang).toBe('string')
    }
  })

  it('an emptied choice falls back to the books currency, never to «no currency»', () => {
    expect(container).toContain('tillCurrency ?? (selectedCurrency || bookCurrency)')
  })
})

describe('6 · the list does not say «no till is open» while tills are open', () => {
  it('the hint knows three things: loading or failed, some tills, none', () => {
    expect(view).toContain(
      "isTillsLoading || tillsError ? undefined : tills.length > 0 ? t('till.select_a_till'",
    )
    expect(view).toContain(': noTillHint }')
  })

  it('the cash-flow chart and the distribution panel are gone (owner, 13 October) — the currency choice is not', () => {
    for (const gone of [
      "t('till.cash_flow_title'",
      "t('till.distribution_title'",
      'CashFlowChart',
      'DistributionChart',
      'cashFlowDays',
      'till-cash-flow-chart-internal',
    ]) {
      expect(view, gone).not.toContain(gone)
    }
    // The figures at the top are still read in ONE chosen currency, and the
    // choice is still on the list.
    expect(view).toContain('data-till-currency')
    expect(count(view, 'onChange={(cur) => onSelectCurrency?.(cur)}')).toBe(1)
  })

  it('«+13% نسبت به روز قبل» is claimed only from two loaded days', () => {
    expect(view).toContain('const cashFlowKnown = !isCashFlowLoading && !cashFlowError')
    expect(count(view, 'cashFlowKnown ? ( <DeltaHint')).toBe(2)
  })
})

describe('7 · the page of a till is in the currency of that till', () => {
  it('the currency of the selected till wins over the picked one and the books', () => {
    expect(container).toContain(
      'const tillCurrency = selectedTillId ? (selected.data?.session?.currency ?? (tills.data ?? []).find((till) => till.sessionId === selectedTillId)?.currency) : undefined',
    )
    expect(container).toContain('const cashFlow = useCashFlow(7, activeCurrency)')
  })
})

describe('8 · an error is the sentence of the server or ours', () => {
  it('every read goes through one reader, and none shows the raw transport message', () => {
    expect(container).toContain(
      "failure ? apiErrorMessage(failure, t('common.loadError', 'خطا در بارگذاری')) : null",
    )
    // The selected till, the list, the page-level read, the ledger, the chart.
    expect(count(container, 'said(')).toBe(5)
    expect(container).not.toContain('as Error).message')
    expect(container).not.toContain(': any')
    expect(container).not.toContain('as any')
  })
})

describe('two rows of the ledger never share a key', () => {
  it('the key carries the source and the balance after it', () => {
    expect(view).toContain(
      "`${entry.sourceId ?? ''}-${entry.at}-${entry.kind}-${entry.amountMinor}-${entry.balanceMinor}`",
    )
  })
})

describe('«همه را خوانده‌شده کن» is offered by the unread of the tab itself', () => {
  const page = code('packages/ui/src/components/ui/activity/ActivitiesPage.tsx')

  it('a typed tab reads unreadBy, not its total', () => {
    expect(page).toContain('return filterCounts?.unreadBy?.[filter] ?? 0')
    expect(page).not.toContain('return filterCounts?.[filter] ?? 0')
    expect(page).toContain('{currentTabUnread > 0 && (')
  })

  it('the type of the hook names the per-tab unread', () => {
    expect(code('packages/api/src/hooks/activity.ts')).toContain(
      'unreadBy: { invoices: number; payments: number; customers: number }',
    )
  })
})
