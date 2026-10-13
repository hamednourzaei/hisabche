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
  it('«no till is open» is said only when the list arrived and is empty', () => {
    // The list no longer shows a per-till figure with a hint under it; it
    // shows how many tills are open, and names the empty case only then.
    expect(view).toContain(
      "tillsKnown && tills.length === 0 ? t('till.no_open_session', 'صندوقی باز نیست') : undefined",
    )
    expect(view).toContain('const tillsKnown = !isTillsLoading && !tillsError')
    expect(view).not.toContain('noTillHint')
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

// ─── the till page after the 13 October review ──────────────────────────────

describe('the till page after the 13 October review', () => {
  const messages = (lang: string) =>
    JSON.parse(readFileSync(join(ROOT, 'packages/i18n/messages', lang, 'common.json'), 'utf8')) as {
      till: Record<string, string>
    }

  it('⚠️ cash in, cash out and counting are dialogs, like «افزودن صندوق» — no inline form is left', () => {
    for (const mark of ['data-add-till=""', 'data-movement-till=""', 'data-close-till=""']) {
      expect(count(view, mark), mark).toBe(1)
    }
    // Each is a Dialog, and each shows a refusal inside itself.
    const movement = view.slice(
      view.indexOf('data-movement-till=""'),
      view.indexOf('data-close-till=""'),
    )
    expect(movement).toContain('{actionError ? <ErrorNote message={actionError} /> : null}')
    expect(movement).toContain('<MinorInput')
    expect(view).toContain(
      '{actionError && !addTillOpen && !movementOpen && !closing ? ( <ErrorNote message={actionError} /> ) : null}',
    )
    // The form that used to sit above the ledger is gone.
    expect(view).not.toContain('{/* Movement dialog */}')
  })

  it('⚠️ the movement dialog closes on the answer of the server, and not while it is busy', () => {
    expect(view).toContain(
      '<Dialog open onOpenChange={(open) => !open && !isBusy && setMovementOpen(false)}>',
    )
    expect(view).toContain(
      '<Dialog open onOpenChange={(open) => !open && !isBusy && setClosing(null)}>',
    )
    expect(view).toContain('if (!recorded) return setMovementOpen(false)')
    expect(view).toContain('if (closed) setClosing(null)')
  })

  it('deposit, withdrawal and count-and-close each have their own named button on the page of a till', () => {
    const actions = view.slice(view.indexOf('data-till-actions'))
    expect(actions).toContain("onClick={() => openMovementForm('cash_in')}")
    expect(actions).toContain("onClick={() => openMovementForm('cash_out')}")
    expect(actions).toContain("{t('till.take_cash', 'برداشت نقدی')}")
    expect(actions).toContain('disabled={isBusy || !selectedListed}')
    // The direction is set by the button, and the id is still made once per fill.
    expect(view).toContain(
      "const openMovementForm = (kind: 'cash_in' | 'cash_out') => { setMovementKind(kind) setMovementRequestId((current) => current || crypto.randomUUID())",
    )
  })

  it('⚠️ the title of the page of a till is that till, and the way back is beside it', () => {
    expect(view).toContain(
      "title={ selectedTillId && session ? nameOfTill(session.id) : t('till.title', 'صندوق') }",
    )
    const header = view.slice(view.indexOf('<CapabilityHeader'), view.indexOf('{closeNotice ? ('))
    expect(header).toContain("{t('till.back_to_tills', '← صندوق‌ها')}")
  })

  it('⚠️ recorded, counted and variance are three lines with three names', () => {
    const close = view.slice(view.indexOf('data-close-till=""'))
    const recorded = close.indexOf("t('till.expected_cash', 'موجودی ثبت‌شده در سیستم')")
    const counted = close.indexOf("t('till.counted_cash', 'موجودی شمارش‌شده')")
    const variance = close.indexOf("t('till.variance', 'مغایرت صندوق')")
    expect(recorded).toBeGreaterThan(-1)
    expect(counted).toBeGreaterThan(recorded)
    expect(variance).toBeGreaterThan(counted)
    for (const lang of ['fa', 'af', 'en']) {
      const till = messages(lang).till
      expect(new Set([till.expected_cash, till.counted_cash, till.variance]).size, lang).toBe(3)
      for (const key of [
        'take_cash',
        'more_actions',
        'open_tills',
        'open_tills_cash',
        'only_currency',
        'transactions_hint',
        'name_required',
        'recorded_cash_hint',
      ]) {
        expect(typeof till[key], lang + ' ' + key).toBe('string')
      }
    }
    // The recorded balance of a till is said once on its page: at the top.
    expect(count(view, 'minor={totals.expectedCashMinor}')).toBe(1)
  })

  it('⚠️ the list never adds two currencies, and says which one its figure is in', () => {
    expect(view).toContain(
      'const tillsOfListCurrency = tills.filter( (item) => (item.currency ?? bookCurrency) === listCurrency, )',
    )
    expect(view).toContain('<Money minor={recordedInListCurrency} currency={listCurrency} />')
    expect(view).toContain("t('till.only_currency', 'فقط صندوق‌های این ارز')}: ${listCurrency}")
    // A failed or unfinished read of the list is not «zero».
    expect(view).toContain(') : tillsKnown && listCurrency ? (')
  })

  it('one visible action per row; removing is last, behind «more», and marked destructive', () => {
    const actions = view.slice(view.indexOf("id: 'actions'"), view.indexOf('<CapabilityHeader'))
    expect(count(actions, '<ActionButton')).toBe(1)
    expect(actions).toContain("aria-label={t('till.more_actions', 'عملیات بیشتر')}")
    const rename = actions.indexOf("t('till.rename'")
    const remove = actions.indexOf(
      '<DropdownMenuItem variant="destructive" onSelect={() => setRemoving(item)}>',
    )
    expect(rename).toBeGreaterThan(-1)
    expect(remove).toBeGreaterThan(rename)
    // The confirmation names the till and its state.
    expect(view).toContain('<span className="font-medium">{nameOfTill(removing.sessionId)}</span>')
  })

  it('a till is opened with a name; the profit column appears only when it can say something', () => {
    expect(view).toContain(
      "disabled={isBusy || !bookCurrency || !currencyDraft || labelDraft.trim() === ''}",
    )
    expect(view).toContain(
      "const hasMargin = ledger.some((entry) => typeof entry.marginPercent === 'number')",
    )
    expect(view).toContain('...(hasMargin ? [')
    expect(view).not.toContain('eslint-disable')
  })
})
