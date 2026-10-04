// ============================================
// The شرح کالا / خدمت cell.
//
// It is a text box FIRST and a product picker second. A shopkeeper billing a
// service, a repair or a one-off item must be able to type it and move on —
// forcing every line through the warehouse is the wizard behaviour this whole
// refactor removed. Picking from the list is the shortcut, not the toll gate.
//
// When a warehouse product IS picked, the row carries its `productId`. That is
// what makes stock move: the backend's invoice service decrements (sale) or
// increments (purchase) stock for every item that has one, so the accounting
// happens server-side where it belongs, not here.
//
// ---------------------------------------------------------------------------
// WHY THE LIST IS IN A PORTAL
//
// It used to be an `absolute` panel inside the cell. A table cell sits inside
// the grid's horizontal scroll container, and an absolutely positioned child
// is CLIPPED by that container — so the list appeared to open "inside" the
// table, sliding under the rows below it and cut off at the table's edge. No
// z-index fixes that; clipping happens before stacking is considered.
//
// Rendered into `document.body` with fixed coordinates, it floats above
// everything and can be as tall as the screen allows.
// ============================================
'use client'

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { KeyboardEvent } from 'react'
import { ChevronDown, Package, Search } from 'lucide-react'
import { useProducts } from '@hisabche/api'
import { useInvoiceDraftStore } from '@hisabche/store'

import { cn } from '../../../../lib/utils'
import { productCost, readProducts, type PickerProduct } from '../../../../lib/invoices/products'
import { useInvoiceWarehouseStock } from '../../../../hooks/invoices/use-invoice-warehouse-stock'
import { usePromotionPricer } from '../../../../hooks/invoices/use-promotion-pricer'

export interface DescriptionCellProps {
  value: string
  /** Set when this row is already linked to a warehouse product. */
  productId?: string | undefined
  disabled?: boolean
  rowIndex: number
  columnIndex: number
  t: (key: string, fallback?: string) => string
  locale: string
  onChange: (value: string) => void
  /**
   * What a picked product is being picked AS. `'sale'` (the default) is an
   * invoice line: priced at the sell price, and not pickable on a sale once it
   * is out of stock. `'component'` is something a product is made of: costed at
   * what was paid for it, and always pickable — being out of a material is a
   * reason to buy it, not a reason to hide it from the recipe.
   */
  pickAs?: 'sale' | 'component' | undefined
  onPickProduct: (product: { id: string; name: string; price: string; unit: string }) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>, rowIndex: number, columnIndex: number) => void
}

/** Where the floating list sits, in viewport coordinates. */
interface Anchor {
  top: number
  left: number
  width: number
  /** Opening upward when there is more room above than below. */
  flipped: boolean
}

const PANEL_MAX_HEIGHT = 288
const GAP = 4
const MIN_WIDTH = 260

export const DescriptionCell = memo(function DescriptionCell({
  value,
  productId,
  disabled = false,
  rowIndex,
  columnIndex,
  t,
  locale,
  onChange,
  onPickProduct,
  onKeyDown,
  pickAs = 'sale',
}: DescriptionCellProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [anchor, setAnchor] = useState<Anchor | null>(null)

  const boxRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Debounced so a fast typist does not fire a query per keystroke. Every row
  // with the same search shares one React Query cache entry, so a hundred-row
  // invoice still makes one request, not a hundred.
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isLoading } = useProducts({
    ...(debounced ? { search: debounced } : {}),
    limit: 20,
  })

  const products = useMemo<PickerProduct[]>(() => readProducts(data), [data])

  // ⚠️ AN EXHAUSTED PRODUCT STAYS IN THE LIST — IT IS JUST NOT PICKABLE ON A SALE.
  // Hiding it would make a shopkeeper think the item was deleted. And only a
  // SALE is blocked: a purchase is exactly how an exhausted product comes back.
  const transactionType = useInvoiceDraftStore((state) => state.transactionType)
  // With a warehouse on the invoice, «how many» means «how many HERE».
  const warehouseStock = useInvoiceWarehouseStock()
  const stockOf = (product: PickerProduct): number | null =>
    warehouseStock.inWarehouse
      ? warehouseStock.quantityOf(product.id)
      : typeof product.quantity === 'number'
        ? product.quantity
        : null
  const isExhausted = (product: PickerProduct) => {
    if (pickAs === 'component') return false
    const stock = stockOf(product)
    return transactionType !== 'purchase' && typeof stock === 'number' && stock <= 0
  }

  /**
   * Measure the cell and decide which way the list opens.
   *
   * A row near the bottom of a long invoice has no room below it, and a list
   * that opens downward there is a list nobody can read. Flipping is decided
   * per open, from the space actually available.
   */
  const measure = useCallback(() => {
    const cell = boxRef.current
    if (!cell) return

    const rect = cell.getBoundingClientRect()
    const below = window.innerHeight - rect.bottom
    const above = rect.top
    const flipped = below < PANEL_MAX_HEIGHT && above > below

    const width = Math.max(rect.width, MIN_WIDTH)
    // Kept inside the viewport on a narrow screen, where a cell can sit close
    // enough to the edge that an aligned panel would hang off it.
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)

    setAnchor({
      top: flipped ? rect.top - GAP : rect.bottom + GAP,
      left,
      width,
      flipped,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    measure()
  }, [open, measure])

  useEffect(() => {
    if (!open) return

    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (boxRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }

    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    // The panel is fixed to the viewport, so it has to follow the cell when
    // anything moves — including the grid's own horizontal scroll, which is
    // why this listens in the CAPTURE phase rather than on window alone.
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', measure)
    document.addEventListener('scroll', measure, true)

    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', measure)
      document.removeEventListener('scroll', measure, true)
    }
  }, [open, measure])

  // Focus lands in the panel's own search box, so typing filters the catalogue
  // instead of overwriting the description the person may have already typed.
  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  // A sale line is priced with the live promotions; a component is costed.
  const promoPrice = usePromotionPricer()

  const pick = (product: PickerProduct) => {
    if (isExhausted(product)) return
    const price = pickAs === 'component' ? productCost(product) : promoPrice(product).price
    onPickProduct({
      id: product.id,
      name: product.name,
      price: String(price ?? 0),
      unit: product.unit ?? 'piece',
    })
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={boxRef} className="relative">
      <div
        className={cn(
          'flex h-9 items-center gap-1 px-1',
          'focus-within:bg-[hsl(var(--color-primary)/0.07)]',
          'focus-within:shadow-[inset_0_0_0_1.5px_hsl(var(--color-primary))]',
          'transition-colors duration-150 motion-reduce:transition-none',
        )}
      >
        <input
          type="text"
          value={value}
          disabled={disabled}
          data-cell={`${rowIndex}-${columnIndex}`}
          onKeyDown={(e) => onKeyDown(e, rowIndex, columnIndex)}
          onChange={(e) => onChange(e.target.value)}
          aria-label={t('invoiceBuilder.columns.description', 'شرح کالا / خدمت')}
          placeholder={t(
            'invoiceBuilder.grid.descriptionPlaceholder',
            'تایپ کنید یا از انبار انتخاب کنید',
          )}
          className={cn(
            'h-full w-full min-w-0 bg-transparent px-1 text-sm outline-none',
            'text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))]',
          )}
        />

        {/* Linked to the warehouse — the mark that says stock will move. */}
        {productId ? (
          <span
            title={t('invoiceBuilder.grid.fromStock', 'از انبار — موجودی کم می‌شود')}
            className="shrink-0 text-[hsl(var(--color-success))]"
          >
            <Package className="size-3.5" aria-hidden="true" />
          </span>
        ) : null}

        {/*
          A chevron, not a magnifier.

          It points DOWN when closed and UP when open, which is the one
          convention every dropdown on every platform shares — a person knows
          what it will do before pressing it. The magnifier said "search",
          which is what the panel does, not what the button does.
        */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          aria-label={t('invoiceBuilder.grid.pickProduct', 'انتخاب از انبار')}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            'shrink-0 rounded-[var(--radius-sm)] p-1',
            'text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))]',
            'hover:text-[hsl(var(--color-primary))]',
            'transition-colors duration-150 motion-reduce:transition-none',
            open && 'text-[hsl(var(--color-primary))] bg-[hsl(var(--surface-muted))]',
          )}
        >
          <ChevronDown
            className={cn(
              'size-4 transition-transform duration-150 motion-reduce:transition-none',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
      </div>

      {open && anchor && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              role="listbox"
              style={{
                position: 'fixed',
                top: anchor.flipped ? undefined : anchor.top,
                bottom: anchor.flipped ? window.innerHeight - anchor.top : undefined,
                left: anchor.left,
                width: anchor.width,
                maxHeight: PANEL_MAX_HEIGHT,
                zIndex: 9999,
              }}
              className={cn(
                'flex flex-col overflow-hidden',
                'rounded-[var(--radius-md)] border border-[hsl(var(--border-default))]',
                'bg-[hsl(var(--surface-elevated))] shadow-xl shadow-black/20',
              )}
            >
              {/*
                The panel's own search box.

                Separate from the cell's input on purpose: the cell holds the
                DESCRIPTION that will be printed on the invoice, and typing to
                find a product used to overwrite it. Two boxes, two jobs.
              */}
              <div className="shrink-0 border-b border-[hsl(var(--border-default))] p-2">
                <div className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[hsl(var(--surface-muted))] px-2">
                  <Search
                    className="size-3.5 shrink-0 text-[hsl(var(--fg-tertiary))]"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('invoiceBuilder.grid.searchProduct', 'جستجوی کالا…')}
                    aria-label={t('invoiceBuilder.grid.searchProduct', 'جستجوی کالا…')}
                    className={cn(
                      'h-8 w-full min-w-0 bg-transparent text-sm outline-none',
                      'text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))]',
                    )}
                  />
                </div>
              </div>

              {/* `overscroll-contain`: reaching the end of this list must not
                  start scrolling the invoice behind it. */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
                {isLoading ? (
                  <p className="p-3 text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('common.loading', 'در حال بارگذاری…')}
                  </p>
                ) : products.length === 0 ? (
                  <p className="p-3 text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('invoiceBuilder.grid.noProducts', 'کالایی پیدا نشد — همین متن ثبت می‌شود')}
                  </p>
                ) : (
                  products.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      role="option"
                      onClick={() => pick(product)}
                      disabled={isExhausted(product)}
                      aria-disabled={isExhausted(product)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)]',
                        // 44px: a finger target, not a mouse target. These rows
                        // are picked on a phone at a counter.
                        'min-h-11 px-2.5 py-2 text-start text-sm',
                        'text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]',
                        'transition-colors duration-150 motion-reduce:transition-none',
                        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="min-w-0 truncate">{product.name}</span>
                        {pickAs === 'sale' && promoPrice(product).discounted ? (
                          <span className="shrink-0 rounded bg-[hsl(var(--color-success)/0.12)] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--color-success))]">
                            {t('invoiceBuilder.grid.promotion', 'تخفیف')}
                          </span>
                        ) : null}
                        {pickAs === 'sale' && promoPrice(product).listName ? (
                          <span className="shrink-0 rounded bg-[hsl(var(--color-primary)/0.1)] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--color-primary))]">
                            {promoPrice(product).listName}
                          </span>
                        ) : null}
                        {product.sku ? (
                          <span
                            dir="ltr"
                            className="shrink-0 rounded bg-[hsl(var(--surface-muted))] px-1.5 py-0.5 text-[10px] text-[hsl(var(--fg-tertiary))]"
                          >
                            {product.sku}
                          </span>
                        ) : null}
                        {isExhausted(product) ? (
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))]">
                            {t('warehouse.outOfStock', 'تمام شده')}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-[hsl(var(--fg-tertiary))]">
                        {/* Stock the invoice will actually draw down, and where
                            it is — a business-wide figure would be the wrong
                            number the moment there are two warehouses. */}
                        {(() => {
                          const stock = stockOf(product)
                          if (stock === null) return ''
                          return warehouseStock.inWarehouse
                            ? `${stock.toLocaleString(locale)} · ${warehouseStock.warehouseName}`
                            : stock.toLocaleString(locale)
                        })()}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
})

DescriptionCell.displayName = 'DescriptionCell'
