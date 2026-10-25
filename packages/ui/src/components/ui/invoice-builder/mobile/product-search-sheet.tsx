// ============================================
// Choosing what the line is FOR, on a phone.
//
// Free text first, warehouse second — the same rule the desktop cell follows.
// A repair, a delivery charge or a one-off item must be typeable; picking from
// stock is the shortcut. Picking links `productId`, which is what makes the
// backend move stock for the line.
//
// Full-width sheet rather than a dropdown: a list of products in a 200px
// popover is a desktop idiom that does not survive a thumb.
//
// ⚠️ THE LIST IS THE DESKTOP CELL'S (hooks/invoices/use-picker-rows). With
// «all warehouses» on the invoice a product held in two warehouses is two
// lines, grouped under each warehouse's name: picking one also picks the
// warehouse the stock leaves from.
// ============================================
'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Package, Search, Warehouse } from 'lucide-react'

import { Input } from '../../input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../sheet'
import { Skeleton } from '../../skeleton'
import { cn } from '../../../../lib/utils'
import type { PickerRow } from '../../../../lib/invoices/picker-rows'
import { usePickerRows, type PickedProduct } from '../../../../hooks/invoices/use-picker-rows'

export interface ProductSearchSheetProps {
  t: (key: string, fallback?: string) => string
  locale: string
  value: string
  onChangeText: (value: string) => void
  onPick: (product: PickedProduct) => void
}

interface WarehouseGroup {
  key: string
  name: string
  rows: PickerRow[]
}

/** Rows in list order, gathered under their warehouse (one unnamed group when none). */
function groupByWarehouse(rows: readonly PickerRow[]): WarehouseGroup[] {
  const groups = new Map<string, WarehouseGroup>()
  for (const row of rows) {
    const key = row.warehouseId ?? ''
    const group = groups.get(key) ?? { key, name: row.warehouseName, rows: [] }
    group.rows.push(row)
    groups.set(key, group)
  }
  return [...groups.values()]
}

export const ProductSearchSheet = memo(function ProductSearchSheet({
  t,
  locale,
  value,
  onChangeText,
  onPick,
}: ProductSearchSheetProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const picker = usePickerRows(debounced)
  const groups = useMemo(() => groupByWarehouse(picker.rows), [picker.rows])
  // Headers only when the rows really come from more than one place.
  const grouped = groups.length > 1 || (groups.length === 1 && groups[0]!.name !== '')

  const toggle = (key: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const pick = (row: PickerRow) => {
    const picked = picker.pick(row)
    if (!picked) return
    onPick(picked)
    setOpen(false)
    setSearch('')
  }

  const rowButton = (row: PickerRow) => {
    const price = picker.priceOf(row.product)
    return (
      <li key={row.key}>
        <button
          type="button"
          disabled={row.exhausted}
          onClick={() => pick(row)}
          className={cn(
            'flex min-h-[56px] w-full items-center justify-between gap-3',
            'rounded-[var(--radius-md)] px-3 py-2 text-start',
            'hover:bg-[hsl(var(--surface-muted))]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors duration-150 motion-reduce:transition-none',
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base text-[hsl(var(--fg-primary))]">
              {row.product.name}
            </span>
            <span dir="ltr" className="block text-xs tabular-nums text-[hsl(var(--fg-tertiary))]">
              {price.price.toLocaleString(locale)}
              {price.discounted ? (
                <span className="ms-2 line-through opacity-70">
                  {price.base.toLocaleString(locale)}
                </span>
              ) : null}
              {price.listName ? (
                <span dir="auto" className="ms-2">
                  {price.listName}
                </span>
              ) : null}
            </span>
          </span>
          {row.stock !== null ? (
            <span className="shrink-0 text-xs tabular-nums text-[hsl(var(--fg-tertiary))]">
              {row.stock.toLocaleString(locale)}
            </span>
          ) : null}
        </button>
      </li>
    )
  }

  return (
    <>
      {/* The trigger is the field itself: type here, or open the warehouse to
          browse stock. Both paths lead to a valid line. */}
      <div
        className={cn(
          'flex h-12 items-center gap-1 rounded-[var(--radius-md)] border ps-2 pe-1',
          'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]',
          'own-focus-ring focus-within:border-[hsl(var(--color-primary))]',
          'transition-colors duration-150 motion-reduce:transition-none',
        )}
      >
        <Input
          id="item-field-description"
          value={value}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder={t(
            'invoiceBuilder.grid.descriptionPlaceholder',
            'تایپ کنید یا از انبار انتخاب کنید',
          )}
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-1 text-base focus-visible:ring-0"
        />
        {/* A labelled button, not a bare chevron: a lone arrow in the middle of
            the field did not read as «open the warehouse» (owner report). */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] px-3',
            'bg-[hsl(var(--color-primary)/0.12)] text-sm font-medium text-[hsl(var(--color-primary))]',
            'hover:bg-[hsl(var(--color-primary)/0.2)]',
            'transition-colors duration-150 motion-reduce:transition-none',
          )}
        >
          <Warehouse className="size-4" aria-hidden="true" />
          {t('invoiceBuilder.grid.pickProduct', 'انتخاب از انبار')}
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[85vh] flex-col rounded-t-[var(--radius-lg)] p-0"
        >
          <div className="border-b border-[hsl(var(--border-default))] p-4">
            <div
              aria-hidden="true"
              className="mx-auto mb-3 h-1 w-10 rounded-full bg-[hsl(var(--border-strong,var(--border-default)))]"
            />
            <SheetHeader className="mb-3">
              <SheetTitle>{t('invoiceBuilder.grid.pickProduct', 'انتخاب از انبار')}</SheetTitle>
            </SheetHeader>
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[hsl(var(--fg-tertiary))]"
                aria-hidden="true"
              />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('invoiceBuilder.mobile.searchProduct', 'جستجوی کالا یا خدمت…')}
                className="h-12 ps-9 text-base"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {picker.isLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-[var(--radius-md)]" />
                ))}
              </div>
            ) : picker.rows.length === 0 ? (
              <div className="p-6 text-center">
                <Package
                  className="mx-auto mb-2 size-8 text-[hsl(var(--fg-tertiary))]"
                  aria-hidden="true"
                />
                <p className="text-sm text-[hsl(var(--fg-secondary))]">
                  {picker.productCount > 0
                    ? t(
                        'invoiceBuilder.grid.noProductsHere',
                        'این کالا در انبار انتخاب‌شده نیست — همین متن ثبت می‌شود',
                      )
                    : t('invoiceBuilder.grid.noProducts', 'کالایی پیدا نشد — همین متن ثبت می‌شود')}
                </p>
              </div>
            ) : grouped ? (
              <div className="space-y-2">
                {groups.map((group) => {
                  const isOpen = !collapsed.has(group.key)
                  return (
                    <section key={group.key}>
                      <button
                        type="button"
                        onClick={() => toggle(group.key)}
                        aria-expanded={isOpen}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] px-3 py-2.5',
                          'bg-[hsl(var(--surface-muted)/0.6)] text-sm font-semibold text-[hsl(var(--fg-primary))]',
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Warehouse
                            className="size-4 shrink-0 text-[hsl(var(--color-primary))]"
                            aria-hidden="true"
                          />
                          <span className="truncate">{group.name}</span>
                          <span className="shrink-0 text-xs font-normal tabular-nums text-[hsl(var(--fg-tertiary))]">
                            {group.rows.length.toLocaleString(locale)}
                          </span>
                        </span>
                        <ChevronDown
                          className={cn(
                            'size-4 shrink-0 transition-transform duration-150 motion-reduce:transition-none',
                            isOpen && 'rotate-180',
                          )}
                          aria-hidden="true"
                        />
                      </button>
                      {isOpen ? <ul className="mt-1">{group.rows.map(rowButton)}</ul> : null}
                    </section>
                  )
                })}
              </div>
            ) : (
              <ul>{picker.rows.map(rowButton)}</ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
})

ProductSearchSheet.displayName = 'ProductSearchSheet'
