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
// ============================================
'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Package, Search } from 'lucide-react'
import { useProducts } from '@hisabche/api'

import { cn } from '../../../../lib/utils'

interface ProductRow {
  id: string
  name: string
  sell_price?: number | null
  sellPrice?: number | null
  unit?: string | null
  quantity?: number | null
}

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
  onPickProduct: (product: { id: string; name: string; price: string; unit: string }) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>, rowIndex: number, columnIndex: number) => void
}

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
}: DescriptionCellProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

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

  const products = useMemo<ProductRow[]>(() => {
    const raw = (data as { data?: unknown[] } | unknown[] | undefined) ?? []
    const list = Array.isArray(raw) ? raw : ((raw as { data?: unknown[] }).data ?? [])
    return list as ProductRow[]
  }, [data])

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

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
          onChange={(e) => {
            onChange(e.target.value)
            setSearch(e.target.value)
          }}
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

        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          aria-label={t('invoiceBuilder.grid.pickProduct', 'انتخاب از انبار')}
          aria-expanded={open}
          className={cn(
            'shrink-0 rounded-[var(--radius-sm)] p-1',
            'text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))]',
            'hover:text-[hsl(var(--color-primary))]',
            'transition-colors duration-150 motion-reduce:transition-none',
          )}
        >
          <Search className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      {open ? (
        <div
          className={cn(
            'absolute z-50 mt-1 max-h-64 w-72 max-w-[80vw] overflow-y-auto',
            'rounded-[var(--radius-md)] border border-[hsl(var(--border-default))]',
            'bg-[hsl(var(--surface-elevated))] p-1 shadow-lg',
          )}
        >
          {isLoading ? (
            <p className="p-3 text-xs text-[hsl(var(--fg-tertiary))]">
              {t('common.loading', 'در حال بارگذاری…')}
            </p>
          ) : products.length === 0 ? (
            <p className="p-3 text-xs text-[hsl(var(--fg-tertiary))]">
              {t('invoiceBuilder.grid.noProducts', 'کالایی پیدا نشد — همین متن ثبت می‌شود')}
            </p>
          ) : (
            products.map((product) => {
              const price = product.sellPrice ?? product.sell_price ?? 0
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    onPickProduct({
                      id: product.id,
                      name: product.name,
                      price: String(price ?? 0),
                      unit: product.unit ?? 'piece',
                    })
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)]',
                    'px-2.5 py-2 text-start text-sm',
                    'text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]',
                    'transition-colors duration-150 motion-reduce:transition-none',
                  )}
                >
                  <span className="min-w-0 truncate">{product.name}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-[hsl(var(--fg-tertiary))]">
                    {/* Stock on hand, so the user sees what they are drawing down. */}
                    {typeof product.quantity === 'number'
                      ? product.quantity.toLocaleString(locale)
                      : ''}
                  </span>
                </button>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
})

DescriptionCell.displayName = 'DescriptionCell'
