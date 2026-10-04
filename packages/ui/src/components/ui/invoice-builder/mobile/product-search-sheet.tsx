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
// ============================================
'use client'

import { memo, useEffect, useState } from 'react'
import { ChevronDown, Package, Search } from 'lucide-react'
import { useProducts } from '@hisabche/api'

import { Input } from '../../input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../sheet'
import { Skeleton } from '../../skeleton'
import { cn } from '../../../../lib/utils'
import { readProducts, type PickerProduct } from '../../../../lib/invoices/products'
import { usePromotionPricer } from '../../../../hooks/invoices/use-promotion-pricer'

export interface ProductSearchSheetProps {
  t: (key: string, fallback?: string) => string
  locale: string
  value: string
  onChangeText: (value: string) => void
  onPick: (product: { id: string; name: string; price: string; unit: string }) => void
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
  // The sell price, less the promotions live today (see the hook).
  const promoPrice = usePromotionPricer()

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Only fetched while the sheet is open, and shared by cache key across every
  // line that searches the same term.
  const { data, isLoading } = useProducts({
    ...(debounced ? { search: debounced } : {}),
    limit: 30,
  })

  const products: PickerProduct[] = readProducts(data)

  return (
    <>
      {/* The trigger is the field itself: type here, or tap the chevron to
          browse stock. Both paths lead to a valid line. */}
      <div
        className={cn(
          'flex h-12 items-center gap-1 rounded-[var(--radius-md)] border px-2',
          'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]',
          'focus-within:border-[hsl(var(--color-primary))]',
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
          className="h-full flex-1 border-0 bg-transparent px-1 text-base focus-visible:ring-0"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('invoiceBuilder.grid.pickProduct', 'انتخاب از انبار')}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            'inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)]',
            'text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))]',
            'hover:text-[hsl(var(--color-primary))]',
            'transition-colors duration-150 motion-reduce:transition-none',
          )}
        >
          {/*
            A chevron pointing DOWN, flipping UP while the sheet is open.

            It was a `<` — a "go somewhere else" arrow, which is what a
            navigation chevron means everywhere else in this app. This control
            does not navigate: it reveals a list in place. Down-then-up is the
            one convention every dropdown shares, so a person knows what the
            button will do before they press it.
          */}
          <ChevronDown
            className={cn(
              'size-5 transition-transform duration-150 motion-reduce:transition-none',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
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
            {isLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-[var(--radius-md)]" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="p-6 text-center">
                <Package
                  className="mx-auto mb-2 size-8 text-[hsl(var(--fg-tertiary))]"
                  aria-hidden="true"
                />
                <p className="text-sm text-[hsl(var(--fg-secondary))]">
                  {t('invoiceBuilder.grid.noProducts', 'کالایی پیدا نشد — همین متن ثبت می‌شود')}
                </p>
              </div>
            ) : (
              <ul>
                {products.map((product) => {
                  const picked = promoPrice(product)
                  const price = picked.price
                  return (
                    <li key={product.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onPick({
                            id: product.id,
                            name: product.name,
                            price: String(price ?? 0),
                            unit: product.unit ?? 'piece',
                          })
                          setOpen(false)
                        }}
                        className={cn(
                          'flex min-h-[56px] w-full items-center justify-between gap-3',
                          'rounded-[var(--radius-md)] px-3 py-2 text-start',
                          'hover:bg-[hsl(var(--surface-muted))]',
                          'transition-colors duration-150 motion-reduce:transition-none',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base text-[hsl(var(--fg-primary))]">
                            {product.name}
                          </span>
                          <span
                            dir="ltr"
                            className="block text-xs tabular-nums text-[hsl(var(--fg-tertiary))]"
                          >
                            {Number(price ?? 0).toLocaleString(locale)}
                            {picked.discounted ? (
                              <span className="ms-2 line-through opacity-70">
                                {picked.base.toLocaleString(locale)}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        {typeof product.quantity === 'number' ? (
                          <span className="shrink-0 text-xs tabular-nums text-[hsl(var(--fg-tertiary))]">
                            {product.quantity.toLocaleString(locale)}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
})

ProductSearchSheet.displayName = 'ProductSearchSheet'
