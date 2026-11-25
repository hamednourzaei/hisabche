// ============================================
// Regression & Integration Tests:
// Real-time line pricing when switching between sale, purchase, pre_sale, and
// pre_purchase through the ONE canonical pricing engine.
//
// Prevents recurrence of the /invoices/new?type=pre_sale defect where picking a
// product (21M buy / 25M sell) and switching between فروش / خرید / پیش‌فروش /
// پیش‌خرید left previously picked unit prices frozen on the initial side.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COLUMN, type GoldLineSnapshot } from '@hisabche/validation'
import { useCurrencyStore, useInvoiceDraftStore } from '@hisabche/store'

const ROOT = join(__dirname, '..', '..', '..', '..')
const faMessages = JSON.parse(
  readFileSync(join(ROOT, 'packages', 'i18n', 'messages', 'fa', 'common.json'), 'utf8'),
) as Record<string, unknown>

function lookupRaw(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj
  for (const part of path.split('.')) {
    if (!cur || typeof cur !== 'object' || !(part in cur)) return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

function lookupMessage(obj: Record<string, unknown>, path: string): string | undefined {
  const value = lookupRaw(obj, path)
  return typeof value === 'string' ? value : undefined
}

const navState = vi.hoisted(() => ({
  search: '?type=pre_sale',
  autoSyncUrl: true,
  replacedUrls: [] as string[],
  pushedUrls: [] as string[],
}))

const apiFixtures = vi.hoisted(() => ({
  products: [
    {
      id: 'prod-espresso',
      name: 'دستگاه اسپرسو صنعتی',
      sku: 'ESP-01',
      buyPrice: 21_000_000,
      sellPrice: 25_000_000,
      unit: 'piece',
      quantity: 8,
    },
    {
      id: 'prod-grinder',
      name: 'آسیاب قهوه بدون قیمت خرید',
      sku: 'GRD-02',
      buyPrice: 0,
      sellPrice: 12_000_000,
      unit: 'piece',
      quantity: 4,
    },
  ],
  bookCurrency: 'IRR',
}))

vi.mock('next-intl', () => {
  const tr = Object.assign((key: string) => lookupMessage(faMessages, key) ?? key, {
    raw: (key: string) => lookupRaw(faMessages, key),
  })
  return {
    useLocale: () => 'fa',
    useTranslations: () => tr,
  }
})

vi.mock('next/navigation', () => ({
  useParams: () => ({ lang: 'fa' }),
  useSearchParams: () => new URLSearchParams(navState.search),
  useRouter: () => ({
    push: (url: string) => {
      navState.pushedUrls.push(url)
    },
    replace: (url: string) => {
      navState.replacedUrls.push(url)
      if (navState.autoSyncUrl) {
        const qIndex = url.indexOf('?')
        navState.search = qIndex >= 0 ? url.slice(qIndex) : ''
      }
    },
  }),
}))

vi.mock('@hisabche/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hisabche/api')>()
  return {
    ...actual,
    rateOn: () => null,
    lookupProductByBarcode: async () => ({ status: 'unknown', barcode: '' }),
    useProducts: () => ({
      data: { products: apiFixtures.products, total: apiFixtures.products.length },
      isLoading: false,
    }),
    useProductsByIds: (ids: readonly string[]) =>
      ids.map((id) => ({
        data: apiFixtures.products.find((p) => p.id === id),
        isLoading: false,
      })),
    useStockPlacement: () => ({
      data: {
        branchesConfigured: false,
        restricted: false,
        warehouses: [],
        stock: [],
      },
    }),
    useBranches: () => ({ data: [] }),
    useBaseCurrency: () => ({ data: { currency: apiFixtures.bookCurrency } }),
    useWorkspaceProfile: () => ({ data: { declared: false, businessTypes: [] } }),
    useCustomers: () => ({ data: [] }),
    useCreateCustomer: () => ({ mutateAsync: async () => ({}), isPending: false }),
    useSuppliers: () => ({ data: [] }),
    useCreateSupplier: () => ({ mutateAsync: async () => ({}), isPending: false }),
    useCustomerProfile: () => ({ data: null }),
    usePromotions: () => ({ data: [] }),
    useCustomerPriceList: () => ({ data: null }),
    useLatestMetalRate: () => ({ data: null }),
    useExchangeRates: () => ({ data: [] }),
    useSaveInvoiceDraft: () => ({ mutate: () => undefined, isPending: false }),
    useProductVariants: () => ({ data: [] }),
    useVariantStock: () => ({ data: [] }),
  }
})

import {
  booksPriceForSide,
  planRepricedLines,
  productDualBooksPrices,
  repriceAutoFilled,
  tradingSideOf,
  type AutoPricedLine,
} from '../lib/invoices/exchange-rate'
import { InvoiceBuilderContainer } from '../components/ui/invoice-builder/containers/invoice-builder-container'
import { ToastProvider } from '../components/ui/toast-provider'

function setDraftStateReset() {
  useCurrencyStore.getState().setPrimaryCurrency('IRR')
  useInvoiceDraftStore.getState().clearDraft()
}

describe('single canonical trading & pre-trading pricing engine (pure)', () => {
  it('maps sale/pre_sale to sale and purchase/pre_purchase to purchase through one helper', () => {
    expect(tradingSideOf('sale')).toBe('sale')
    expect(tradingSideOf('pre_sale')).toBe('sale')
    expect(tradingSideOf('purchase')).toBe('purchase')
    expect(tradingSideOf('pre_purchase')).toBe('purchase')
    expect(tradingSideOf('unknown')).toBeNull()
    expect(tradingSideOf(null)).toBeNull()
  })

  it('extracts dual books prices without inventing zero on missing price', () => {
    const withBoth = {
      id: 'p1',
      name: 'A',
      buyPrice: 21_000_000,
      sellPrice: 25_000_000,
    }
    expect(productDualBooksPrices(withBoth)).toEqual({
      sellBooksPrice: '25000000',
      buyBooksPrice: '21000000',
    })

    const missingBuy = {
      id: 'p2',
      name: 'No Buy',
      buyPrice: 0,
      sellPrice: 12_000_000,
    }
    expect(productDualBooksPrices(missingBuy)).toEqual({
      sellBooksPrice: '12000000',
      buyBooksPrice: '',
    })
  })

  it('repriceAutoFilled updates prices across all 4 document kinds, respects hand edits, and converts foreign currency', () => {
    const auto = new Map<string, AutoPricedLine>([
      [
        'r1',
        {
          booksPrice: '25000000',
          sellBooksPrice: '25000000',
          buyBooksPrice: '21000000',
          filled: '25000000',
        },
      ],
      [
        'r2-no-buy',
        {
          booksPrice: '12000000',
          sellBooksPrice: '12000000',
          buyBooksPrice: '',
          filled: '12000000',
        },
      ],
      [
        'r3-manual',
        {
          booksPrice: '25000000',
          sellBooksPrice: '25000000',
          buyBooksPrice: '21000000',
          filled: '25000000',
        },
      ],
    ])
    const current = new Map([
      ['r1', '25000000'],
      ['r2-no-buy', '12000000'],
      ['r3-manual', '23500000'],
    ])

    // Switch pre_sale -> purchase: r1 flips 25M -> 21M, r2 clears (never buys at sell price), r3 manual stays 23.5M
    const toPurchase = repriceAutoFilled(current, auto, 'IRR', 'IRR', null, 'purchase')
    expect(toPurchase.get('r1')).toBe('21000000')
    expect(toPurchase.get('r2-no-buy')).toBe('')
    expect(toPurchase.has('r3-manual')).toBe(false)

    // Switch purchase -> pre_purchase in USD at 500,000 IRR = 1 USD (and rate 500,000)
    const afterPurchaseCurrent = new Map([
      ['r1', '21000000'],
      ['r2-no-buy', ''],
      ['r3-manual', '23500000'],
    ])
    const afterPurchaseAuto = new Map<string, AutoPricedLine>([
      [
        'r1',
        {
          booksPrice: '21000000',
          sellBooksPrice: '25000000',
          buyBooksPrice: '21000000',
          filled: '21000000',
        },
      ],
      [
        'r2-no-buy',
        {
          booksPrice: '',
          sellBooksPrice: '12000000',
          buyBooksPrice: '',
          filled: '',
        },
      ],
      auto.get('r3-manual')
        ? ['r3-manual', auto.get('r3-manual')!]
        : ['r3-manual', { booksPrice: '', filled: '' }],
    ])

    const usdPrePurchase = repriceAutoFilled(
      afterPurchaseCurrent,
      afterPurchaseAuto,
      'USD',
      'IRR',
      500_000,
      'pre_purchase',
    )
    expect(usdPrePurchase.get('r1')).toBe('42') // 21,000,000 / 500,000

    // Now switch USD pre_purchase -> USD pre_sale: 25,000,000 / 500,000 = 50; r2 restores 12,000,000 / 500,000 = 24
    const usdAt42 = new Map([
      ['r1', '42'],
      ['r2-no-buy', ''],
      ['r3-manual', '23500000'],
    ])
    const usdAuto = new Map<string, AutoPricedLine>([
      [
        'r1',
        {
          booksPrice: '21000000',
          sellBooksPrice: '25000000',
          buyBooksPrice: '21000000',
          filled: '42',
        },
      ],
      [
        'r2-no-buy',
        {
          booksPrice: '',
          sellBooksPrice: '12000000',
          buyBooksPrice: '',
          filled: '',
        },
      ],
    ])
    const usdPreSale = repriceAutoFilled(usdAt42, usdAuto, 'USD', 'IRR', 500_000, 'pre_sale')
    expect(usdPreSale.get('r1')).toBe('50')
    expect(usdPreSale.get('r2-no-buy')).toBe('24')
    expect(usdPreSale.has('r3-manual')).toBe(false)
  })

  it('planRepricedLines toggles saleGoldSnapshot cleanly on side switch and scales cleanly across 25 rows', () => {
    const snap: GoldLineSnapshot = {
      karat: 24,
      netWeightMg: 1000,
      rate24kMinorPerGram: 800000,
      makingChargeMinor: 0,
      capturedAt: '2026-11-25T00:00:00.000Z',
      capturedBy: 'u1',
    }
    const rows = Array.from({ length: 25 }, (_, i) => ({
      id: `r${i}`,
      productId: `p${i}`,
      goldSnapshot: snap,
      values: { [COLUMN.unitPrice]: '25000000' },
    }))
    const autoPriced = Object.fromEntries(
      rows.map((r) => [
        r.id,
        {
          booksPrice: '25000000',
          sellBooksPrice: '25000000',
          buyBooksPrice: '21000000',
          filled: '25000000',
          saleGoldSnapshot: snap,
        },
      ]),
    )
    const toPurchase = planRepricedLines(rows, autoPriced, 'IRR', 'IRR', null, 'pre_purchase')
    expect(toPurchase).toHaveLength(25)
    expect(toPurchase[0]?.unitPrice).toBe('21000000')
    expect(toPurchase[0]?.goldSnapshot).toBeUndefined()

    const afterRows = rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      values: { [COLUMN.unitPrice]: '21000000' },
    }))
    const afterAuto = Object.fromEntries(
      rows.map((r) => [r.id, { ...autoPriced[r.id]!, booksPrice: '21000000', filled: '21000000' }]),
    )
    const backToPreSale = planRepricedLines(afterRows, afterAuto, 'IRR', 'IRR', null, 'pre_sale')
    expect(backToPreSale).toHaveLength(25)
    expect(backToPreSale[0]?.unitPrice).toBe('25000000')
    expect(backToPreSale[0]?.goldSnapshot).toEqual(snap)

    expect(booksPriceForSide(autoPriced.r0!, 'purchase')).toBe('21000000')
    expect(booksPriceForSide(autoPriced.r0!, 'pre_sale')).toBe('25000000')
  })
})

describe('real rendered /invoices/new?type=pre_sale interactive button switching', () => {
  beforeEach(() => {
    navState.search = '?type=pre_sale'
    navState.autoSyncUrl = true
    navState.replacedUrls = []
    navState.pushedUrls = []
    setDraftStateReset()
  })

  afterEach(() => {
    cleanup()
  })

  function renderBuilder() {
    return render(
      <ToastProvider>
        <InvoiceBuilderContainer />
      </ToastProvider>,
    )
  }

  function unitPriceInputs(): HTMLInputElement[] {
    return screen.getAllByLabelText('قیمت واحد') as HTMLInputElement[]
  }

  it('picks a 21M buy / 25M sell product on pre_sale and reprices in real time across every button', async () => {
    renderBuilder()

    // Open product picker on row 0 and select the 21M-buy / 25M-sell espresso machine
    const pickButtons = screen.getAllByLabelText('انتخاب از انبار')
    fireEvent.click(pickButtons[0]!)
    const itemOption = await screen.findByText('دستگاه اسپرسو صنعتی')
    fireEvent.click(itemOption)

    await waitFor(() => {
      expect(useInvoiceDraftStore.getState().rows[0]?.values[COLUMN.unitPrice]).toBe('25000000')
    })
    expect(unitPriceInputs()[0]?.value.replace(/[^\d۰-۹]/g, '')).toMatch(/25000000|۲۵۰۰۰۰۰۰/)

    // 1) Switch pre_sale -> خرید (purchase): must immediately become 21,000,000
    fireEvent.click(screen.getAllByRole('radio', { name: 'خرید' })[0]!)
    await waitFor(() => {
      expect(useInvoiceDraftStore.getState().rows[0]?.values[COLUMN.unitPrice]).toBe('21000000')
    })
    expect(unitPriceInputs()[0]?.value.replace(/[^\d۰-۹]/g, '')).toMatch(/21000000|۲۱۰۰۰۰۰۰/)
    expect(navState.replacedUrls.at(-1)).toBe('/fa/invoices/new?type=purchase')

    // 2) Switch خرید -> پیش‌خرید (pre_purchase): stays 21,000,000
    fireEvent.click(screen.getAllByRole('radio', { name: 'پیش‌خرید' })[0]!)
    await waitFor(() => {
      expect(navState.replacedUrls.at(-1)).toBe('/fa/invoices/new?type=pre_purchase')
    })
    expect(useInvoiceDraftStore.getState().rows[0]?.values[COLUMN.unitPrice]).toBe('21000000')

    // 3) Switch پیش‌خرید -> فروش (sale): must immediately become 25,000,000
    fireEvent.click(screen.getAllByRole('radio', { name: 'فروش' })[0]!)
    await waitFor(() => {
      expect(useInvoiceDraftStore.getState().rows[0]?.values[COLUMN.unitPrice]).toBe('25000000')
    })
    expect(unitPriceInputs()[0]?.value.replace(/[^\d۰-۹]/g, '')).toMatch(/25000000|۲۵۰۰۰۰۰۰/)

    // 4) Switch فروش -> پیش‌فروش (pre_sale): stays 25,000,000
    fireEvent.click(screen.getAllByRole('radio', { name: 'پیش‌فروش' })[0]!)
    await waitFor(() => {
      expect(navState.replacedUrls.at(-1)).toBe('/fa/invoices/new?type=pre_sale')
    })
    expect(useInvoiceDraftStore.getState().rows[0]?.values[COLUMN.unitPrice]).toBe('25000000')

    // 5) Switch directly پیش‌فروش -> پیش‌خرید: must immediately become 21,000,000
    fireEvent.click(screen.getAllByRole('radio', { name: 'پیش‌خرید' })[0]!)
    await waitFor(() => {
      expect(useInvoiceDraftStore.getState().rows[0]?.values[COLUMN.unitPrice]).toBe('21000000')
    })

    // 6) Manually override unitPrice -> switching back to فروش preserves manual value
    act(() => {
      const rowId = useInvoiceDraftStore.getState().rows[0]!.id
      useInvoiceDraftStore.getState().setCell(rowId, COLUMN.unitPrice, '23500000')
    })
    fireEvent.click(screen.getAllByRole('radio', { name: 'فروش' })[0]!)
    await waitFor(() => {
      expect(navState.replacedUrls.at(-1)).toBe('/fa/invoices/new?type=sale')
    })
    expect(useInvoiceDraftStore.getState().rows[0]?.values[COLUMN.unitPrice]).toBe('23500000')
  })

  it('survives preview -> back remount AND works optimistically even before URL query settles', async () => {
    const view1 = renderBuilder()

    fireEvent.click(screen.getAllByLabelText('انتخاب از انبار')[0]!)
    fireEvent.click(await screen.findByText('دستگاه اسپرسو صنعتی'))
    await waitFor(() => {
      expect(useInvoiceDraftStore.getState().rows[0]?.values[COLUMN.unitPrice]).toBe('25000000')
    })

    // Unmount (navigate to /invoices/new/preview) and re-mount builder
    view1.unmount()
    navState.autoSyncUrl = false // Simulate delayed Next.js router.replace()
    renderBuilder()

    fireEvent.click(screen.getAllByRole('radio', { name: 'پیش‌خرید' })[0]!)
    await waitFor(() => {
      expect(useInvoiceDraftStore.getState().rows[0]?.values[COLUMN.unitPrice]).toBe('21000000')
    })
  })

  it('hydrates pre-existing draft rows with productId (missing autoPriced) via useProductsByIds', async () => {
    const row = useInvoiceDraftStore.getState().rows[0]!
    act(() => {
      useInvoiceDraftStore
        .getState()
        .setRowProduct(row.id, 'prod-espresso', 'دستگاه اسپرسو صنعتی', '25000000', 'piece')
      // Simulate legacy draft saved before autoPriced existed
      useInvoiceDraftStore.getState().setRowAutoPrice(row.id, null)
    })

    renderBuilder()
    await waitFor(() => {
      expect(useInvoiceDraftStore.getState().autoPriced[row.id]).toBeTruthy()
    })

    fireEvent.click(screen.getAllByRole('radio', { name: 'خرید' })[0]!)
    await waitFor(() => {
      expect(useInvoiceDraftStore.getState().rows[0]?.values[COLUMN.unitPrice]).toBe('21000000')
    })
  })
})

describe('structural invariant: single canonical pricing engine for trading & proforma', () => {
  it('customer-panel, use-picker-rows, and invoice-builder-container all route through the shared engine', () => {
    const clean = (rel: string) =>
      readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')

    const panel = clean('components/ui/invoice-builder/customer-panel.tsx')
    const picker = clean('hooks/invoices/use-picker-rows.ts')
    const container = clean(
      'components/ui/invoice-builder/containers/invoice-builder-container.tsx',
    )

    expect(panel).toContain('tradingSideOf(transactionType)')
    expect(picker).toContain('productDualBooksPrices(')
    expect(container).toContain('tradingSideOf(')
    expect(container).toContain('planRepricedLines(')
    expect(container).toContain('productDualBooksPrices(')
  })
})
