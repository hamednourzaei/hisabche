// ============================================
// packages/ui/src/__tests__/service-delivery-screen.test.tsx
//
// «جلسات خدمت» on screen, and the promises its dialogs refuse to make.
//
// What can go wrong: a delivered session offered for delivery again; a
// settlement inferred instead of chosen; an invoice CREATED from the delivery
// dialog; a cancellation reason collected and thrown away; `updatedAt`
// presented as a delivery time; a browser row shown as «the server confirmed
// it»; a refusal hidden from the list; a count that describes a page; a
// sentence this build does not have in one of the three languages.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () =>
    Object.assign((key: string) => key, { raw: () => undefined, has: () => false }),
  useLocale: () => 'fa',
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/fa/customers',
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ lang: 'fa' }),
}))

import { ServiceDeliveryView } from '../components/ui/service-delivery/service-delivery-view'
import { SERVICE_DELIVERY_ERROR_CODES } from '../components/ui/service-delivery/service-delivery-errors'
import {
  SERVICE_SESSION_STATUSES,
  SETTLEMENT_METHODS,
  summarizeSessions,
  type ServiceSessionRow,
} from '../components/ui/service-delivery/service-delivery-model'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')

const SOURCES = {
  view: 'packages/ui/src/components/ui/service-delivery/service-delivery-view.tsx',
  model: 'packages/ui/src/components/ui/service-delivery/service-delivery-model.ts',
  create: 'packages/ui/src/components/ui/service-delivery/service-session-create-dialog.tsx',
  deliver: 'packages/ui/src/components/ui/service-delivery/service-session-deliver-dialog.tsx',
  cancel: 'packages/ui/src/components/ui/service-delivery/service-session-cancel-dialog.tsx',
  details: 'packages/ui/src/components/ui/service-delivery/service-session-details.tsx',
  container:
    'packages/ui/src/components/ui/service-delivery/containers/service-delivery-container.tsx',
  hub: 'packages/ui/src/components/ui/customers/containers/customers-hub-container.tsx',
} as const

const source = (key: keyof typeof SOURCES) => read(...SOURCES[key].split('/'))

/** Comments describe the bugs; only code is asserted on. */
const code = (text: string) =>
  text
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')

const row = (overrides: Partial<ServiceSessionRow> = {}): ServiceSessionRow => ({
  id: 'session-1',
  workspaceId: 'ws-1',
  customerId: 'customer-1',
  serviceOfferingId: 'service-1',
  sessionDate: '2026-11-01',
  startTime: '09:00',
  endTime: '09:45',
  durationMinutes: 45,
  status: 'scheduled',
  settlementMethod: 'invoice',
  customerName: 'سارا احمدی',
  serviceName: 'کوتاهی مو',
  practitionerName: null,
  branchName: null,
  sync: 'confirmed',
  syncCode: null,
  ...overrides,
})

const t = (key: string, fallback?: string) => fallback ?? key

function renderView(overrides: Partial<Parameters<typeof ServiceDeliveryView>[0]> = {}) {
  const rows = overrides.rows ?? [row()]
  return render(
    <ServiceDeliveryView
      t={t}
      rows={rows}
      summary={summarizeSessions(rows)}
      today={0}
      isLoading={false}
      error={null}
      onRetry={vi.fn()}
      search=""
      onSearchChange={vi.fn()}
      statusFilter="all"
      onStatusFilterChange={vi.fn()}
      dateFilter="all"
      onDateFilterChange={vi.fn()}
      hasBranches={false}
      mayWrite
      mayCancel
      onCreate={vi.fn()}
      onDeliver={vi.fn()}
      onCancel={vi.fn()}
      onOpen={vi.fn()}
      {...overrides}
    />,
  )
}

afterEach(cleanup)

describe('the list shows what the row carries', () => {
  it('renders all four sync states, and «unknown» when the host cannot answer', async () => {
    const rows = [
      row({ id: 'a', customerName: 'تأیید', sync: 'confirmed' }),
      row({ id: 'b', customerName: 'صف', sync: 'pending' }),
      row({
        id: 'c',
        customerName: 'رد',
        sync: 'rejected',
        syncCode: 'INSUFFICIENT_PACKAGE_CREDIT',
      }),
      row({ id: 'd', customerName: 'رسیدگی', sync: 'attention' }),
      row({ id: 'e', customerName: 'بی‌پاسخ', sync: null }),
    ]
    await act(async () => {
      renderView({ rows })
    })
    expect(screen.getByText('تأییدشده توسط سرور')).toBeTruthy()
    expect(screen.getByText('در صف ارسال')).toBeTruthy()
    expect(screen.getByText('سرور رد کرد')).toBeTruthy()
    expect(screen.getByText('نیاز به بررسی')).toBeTruthy()
    expect(screen.getByText('نامعلوم')).toBeTruthy()
    // The refusal keeps the server's CODE visible — never a hidden failure.
    expect(screen.getByText('INSUFFICIENT_PACKAGE_CREDIT')).toBeTruthy()
  })

  it('a name it could not read says so instead of showing a blank cell', async () => {
    await act(async () => {
      renderView({
        rows: [row({ customerName: null, serviceName: null, practitionerName: null })],
      })
    })
    expect(screen.getByText('نام مشتری خوانده نشد')).toBeTruthy()
    expect(screen.getByText('نام خدمت خوانده نشد')).toBeTruthy()
    expect(screen.getByText('بدون مجری')).toBeTruthy()
  })

  it('the branch column exists only when the business has branches', async () => {
    await act(async () => {
      renderView()
    })
    expect(screen.queryAllByText('شعبه')).toHaveLength(0)

    cleanup()
    await act(async () => {
      renderView({ hasBranches: true, rows: [row({ branchName: 'شعبهٔ مرکزی' })] })
    })
    expect(screen.getByText('شعبهٔ مرکزی')).toBeTruthy()
    expect(screen.getAllByText('شعبه').length).toBeGreaterThan(0)
  })

  it('the counts come from the rows the caller passed, not from the filtered page', async () => {
    const all = [
      row({ id: 'a', status: 'scheduled' }),
      row({ id: 'b', status: 'delivered', sync: 'pending' }),
      row({ id: 'c', status: 'cancelled', sync: 'rejected' }),
    ]
    // The screen is showing ONE filtered row, the summary still counts three —
    // and «today» is a fourth card, backed by the caller's count.
    await act(async () => {
      renderView({ rows: [all[0]!], summary: summarizeSessions(all), today: 1 })
    })
    const counts = [...document.querySelectorAll('dl dd')].map((node) => node.textContent)
    // Scheduled · today · delivered · cancelled — the two device-queue counts
    // (awaiting / rejected) are NOT cards any more; they are one line each.
    expect(counts).toEqual(['1', '1', '1', '1'])
  })
})

describe('the actions follow both the status and the permission', () => {
  it('a delivered session offers no «تحویل خدمت»; a scheduled one does', async () => {
    await act(async () => {
      renderView({ rows: [row({ status: 'delivered', settlementMethod: 'invoice' })] })
    })
    expect(screen.queryByRole('button', { name: 'تحویل خدمت' })).toBeNull()

    cleanup()
    await act(async () => {
      renderView({ rows: [row({ status: 'scheduled' })] })
    })
    expect(screen.getByRole('button', { name: 'تحویل خدمت' })).toBeTruthy()
  })

  it('no show is not offered for cancellation — the server refuses that transition', async () => {
    const onCancel = vi.fn()
    await act(async () => {
      renderView({ rows: [row({ status: 'no_show' })], onCancel })
    })
    expect(screen.queryByRole('button', { name: 'لغو جلسه' })).toBeNull()
  })

  it('a person who may not write gets no create, deliver or cancel button', async () => {
    await act(async () => {
      renderView({ mayWrite: false, mayCancel: false })
    })
    expect(screen.queryByRole('button', { name: 'جلسه‌ی جدید' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'تحویل خدمت' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'لغو جلسه' })).toBeNull()
    // Reading is still allowed: the row and its details stay.
    expect(screen.getByRole('button', { name: 'جزئیات' })).toBeTruthy()
  })

  it('hands the row back to the caller', async () => {
    const onDeliver = vi.fn()
    const onOpen = vi.fn()
    const only = row()
    await act(async () => {
      renderView({ rows: [only], onDeliver, onOpen })
    })
    fireEvent.click(screen.getByRole('button', { name: 'تحویل خدمت' }))
    expect(onDeliver).toHaveBeenCalledWith(only)
    fireEvent.click(screen.getByRole('button', { name: 'جزئیات' }))
    expect(onOpen).toHaveBeenCalledWith(only)
  })
})

describe('error and empty are two different answers', () => {
  it('a failed read is an error, not «you have no sessions»', async () => {
    await act(async () => {
      renderView({ rows: [], error: 'فهرست خوانده نشد', onRetry: vi.fn() })
    })
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('فهرست خوانده نشد')).toBeTruthy()
    expect(screen.queryByText('هنوز جلسه‌ای ثبت نشده است')).toBeNull()
  })

  it('an empty list says how to start', async () => {
    await act(async () => {
      renderView({ rows: [] })
    })
    expect(screen.getByText('هنوز جلسه‌ای ثبت نشده است')).toBeTruthy()
    expect(screen.getByText(/«جلسه‌ی جدید» را بزنید/)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('while loading it says so and shows no table', async () => {
    await act(async () => {
      renderView({ isLoading: true })
    })
    expect(screen.getByRole('status', { name: 'در حال بارگذاری…' })).toBeTruthy()
    expect(document.querySelector('table')).toBeNull()
  })

  it('a refused change points at the sync centre — only where one exists', async () => {
    const onOpenSyncCentre = vi.fn()
    await act(async () => {
      renderView({
        rows: [row({ sync: 'rejected', syncCode: 'SESSION_CHANGED' })],
        onOpenSyncCentre,
      })
    })
    fireEvent.click(screen.getByRole('button', { name: 'مرکز همگام‌سازی' }))
    expect(onOpenSyncCentre).toHaveBeenCalledTimes(1)

    cleanup()
    await act(async () => {
      renderView({ rows: [row({ sync: 'confirmed' })], onOpenSyncCentre })
    })
    expect(screen.queryByRole('button', { name: 'مرکز همگام‌سازی' })).toBeNull()
  })
})

describe('the delivery dialog never guesses the money', () => {
  const deliver = code(source('deliver'))

  it('starts with NO settlement chosen — the choice is the person’s, not a default', () => {
    expect(deliver).toContain("useState<SettlementMethod | ''>('')")
    expect(deliver).not.toContain('session.settlementMethod)')
  })

  it('links an EXISTING invoice of this customer and creates none', () => {
    expect(deliver).toContain('customerId: session.customerId')
    expect(deliver).not.toContain('useCreateInvoice')
    expect(deliver).not.toContain('createInvoice')
    expect(deliver).toContain('invoiceLinks')
  })

  it('asks for a reason on a free service and shows the server’s balance', () => {
    expect(deliver).toContain('usePackageCreditBalance(session.customerId)')
    expect(deliver).toContain('reasonRequired')
    expect(deliver).toContain('balanceFromServer')
  })

  it('sends expectedUpdatedAt and does not offer to deliver twice', () => {
    expect(deliver).toContain('expectedUpdatedAt')
    expect(deliver).toContain('deliveryBlocked(session.status)')
    expect(deliver).toContain('disabled={blocked')
  })

  it('shows the server’s refusal through our own sentence, keyed by code', () => {
    expect(deliver).toContain('serviceDeliveryErrorCode(error)')
    expect(deliver).toContain('serviceDeliveryErrorKey')
  })
})

describe('the cancel dialog states the money before it asks', () => {
  const cancel = code(source('cancel'))

  it('derives the consequence from the row it was given', () => {
    expect(cancel).toContain('cancellationEffect(session)')
    for (const effect of ['package_reversal', 'free', 'invoice_blocked', 'credit_missing']) {
      expect(cancel, effect).toContain(effect)
    }
    // The remaining case (not delivered) is the dialog's last branch, and it
    // says so with its own sentence rather than silence.
    expect(cancel).toContain('effectNothing')
  })

  it('asks WHY, will not confirm without it, and sends it with the id', () => {
    expect(cancel).toContain('name="reason"')
    expect(cancel).toContain('cancellationReasonMissing(reason)')
    expect(cancel).toContain('reasonRequired')
    // the mutation takes the reason with the id - the endpoint stores it
    expect(cancel).toMatch(/cancel\.mutate\(\s*\{\s*id: session\.id,\s*reason/)
  })

  it('the confirm button is disabled while the reason is empty', () => {
    expect(cancel).toMatch(/disabled=\{[^}]*cancellationReasonMissing\(reason\)/)
  })

  it('disables the action for a billed service instead of cancelling it', () => {
    expect(cancel).toContain('blocked !== null')
    expect(cancel).toContain('effectInvoice')
  })
})

describe('the details drawer shows only facts that exist', () => {
  const details = code(source('details'))

  it('shows the cancellation reason when the session has one — and never invents one', () => {
    expect(details).toContain('session.cancellationReason ?')
    expect(details).toContain('cancellationReason')
  })

  it('labels updatedAt «last change», never a delivery time', () => {
    expect(details).toContain('lastChange')
    expect(details).not.toContain('delivered_at')
    expect(details).not.toContain('deliveryTime')
    expect(details).not.toContain('deliveredAt')
  })

  it('shows the references it was given and invents no history', () => {
    expect(details).toContain('packageCreditId')
    expect(details).toContain('invoiceId')
    expect(details).not.toContain('history')
  })
})

describe('the container reads one list and filters it in place', () => {
  const container = code(source('container'))

  it('reads the sessions once, with no page cap under a total', () => {
    expect(container).toContain('useServiceDeliverySessions()')
    expect(container).not.toContain('/service-delivery/sessions/')
    expect(container).not.toMatch(/useServiceDeliverySessions\(\{[^)]*limit/)
  })

  it('counts over the unfiltered rows and filters afterwards', () => {
    expect(container).toContain('summarizeSessions(rows)')
    expect(container.indexOf('summarizeSessions(rows)')).toBeLessThan(
      container.indexOf('const filtered = useMemo'),
    )
  })

  it('asks the HOST for sync state under the entity name the outbox uses', () => {
    expect(container).toContain("useEntitySyncStates('service_delivery_sessions')")
  })

  it('gates the offline contract through the ONE gate, not an `if (offline)`', () => {
    expect(container).toContain('<OfflineGate feature="operations.service_delivery">')
    expect(container).not.toContain('isOffline()')
  })

  it('no raw <select> and no second table implementation', () => {
    for (const key of ['view', 'create', 'deliver', 'cancel', 'details', 'container'] as const) {
      const text = source(key)
      expect(text, key).not.toMatch(/<select[\s>]/)
      expect(text, key).not.toMatch(/<table[\s>]/)
    }
  })
})

describe('every sentence exists in fa, af and en', () => {
  const messages = (lang: string) =>
    JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json')) as Record<string, unknown>

  /** Every `serviceDelivery.*` key the screens name, templates expanded. */
  function keysUsed(): string[] {
    const files = Object.values(SOURCES).filter(
      (path) => !path.endsWith('service-delivery-model.ts'),
    )
    const keys = new Set<string>()
    for (const path of files) {
      const src = code(read(...path.split('/')))
      for (const match of src.matchAll(/['"`](serviceDelivery\.[A-Za-z0-9_.]+)['"`]/g)) {
        // A template (`serviceDelivery.status.${status}`) is expanded from the
        // closed lists below, not from its prefix.
        if (match[1]!.endsWith('.')) continue
        keys.add(match[1]!)
      }
      for (const match of src.matchAll(/['"`](customersHub\.tabs\.sessions)['"`]/g)) {
        keys.add(match[1]!)
      }
    }
    // The hub names its tabs through a template (`customersHub.tabs.${tab}`),
    // so the sessions key is added from the tab list, not read from the source.
    keys.add('customersHub.tabs.sessions')
    for (const status of SERVICE_SESSION_STATUSES) keys.add(`serviceDelivery.status.${status}`)
    for (const settlement of SETTLEMENT_METHODS) {
      keys.add(`serviceDelivery.settlement.${settlement}`)
    }
    for (const error of SERVICE_DELIVERY_ERROR_CODES) keys.add(`serviceDelivery.errors.${error}`)
    keys.add('serviceDelivery.errors.unknown')
    return [...keys]
  }

  const used = keysUsed()

  it('found the keys the screens use', () => {
    expect(used.length).toBeGreaterThan(90)
    expect(used).toEqual(
      expect.arrayContaining([
        'serviceDelivery.columns.sync',
        'serviceDelivery.deliver.balanceIs',
        'serviceDelivery.cancel.effectInvoice',
        'serviceDelivery.errors.SESSION_CHANGED',
        'customersHub.tabs.sessions',
      ]),
    )
  })

  function resolve(bundle: Record<string, unknown>, key: string): unknown {
    let node: unknown = bundle
    for (const part of key.split('.')) {
      if (typeof node !== 'object' || node === null || !(part in node)) return undefined
      node = (node as Record<string, unknown>)[part]
    }
    return node
  }

  for (const lang of ['fa', 'af', 'en']) {
    it(`${lang}: every key resolves to a sentence`, () => {
      const bundle = messages(lang)
      const missing = used.filter((key) => typeof resolve(bundle, key) !== 'string')
      expect(missing).toEqual([])
    })
  }

  it('the three languages carry the same service-delivery keys', () => {
    const paths = (lang: string): string[] => {
      const out: string[] = []
      const walk = (node: unknown, prefix: string) => {
        if (typeof node === 'string') {
          out.push(prefix)
          return
        }
        if (typeof node !== 'object' || node === null) return
        for (const [key, value] of Object.entries(node))
          walk(value, prefix ? `${prefix}.${key}` : key)
      }
      walk(resolve(messages(lang), 'serviceDelivery'), '')
      return out.sort()
    }
    expect(paths('af')).toEqual(paths('fa'))
    expect(paths('en')).toEqual(paths('fa'))
  })

  it('the error list is closed on purpose: every code translated, nothing extra', () => {
    const errors = resolve(messages('fa'), 'serviceDelivery.errors') as Record<string, string>
    expect(Object.keys(errors).sort()).toEqual([...SERVICE_DELIVERY_ERROR_CODES, 'unknown'].sort())
  })

  it('the help article exists in all three languages and is mapped to the tab', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const article = resolve(messages(lang), 'docs.service-delivery') as Record<string, unknown>
      for (const key of ['title', 'summary', 'seoTitle', 'what.heading', 'create.step1']) {
        let node: unknown = article
        for (const part of key.split('.')) {
          node =
            typeof node === 'object' && node !== null
              ? (node as Record<string, unknown>)[part]
              : undefined
        }
        expect(typeof node, `${lang} docs.service-delivery.${key}`).toBe('string')
      }
    }
    const help = read('packages', 'ui', 'src', 'components', 'ui', 'docs', 'docs-help-link.tsx')
    expect(help).toContain("'customers?tab=sessions': 'service-delivery'")
  })
})
