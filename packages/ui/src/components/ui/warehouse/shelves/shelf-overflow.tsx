'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/shelves/shelf-overflow.tsx
//
// «جا نشد» — goods that are in the warehouse, belong on a shelf, and do not fit
// (owner, 18 Oct 2026): a purchase fills a product's auto shelf up to its
// capacity (shelf-capacity-01); what is left stays on no shelf. The warehouse
// shows those products in red and a warning in the corner that says how many
// of what did not fit on which shelf, so a person gives them another shelf or
// moves something.
//
// ⚠️ DERIVED, NOT STORED. The overflow is read from the same numbers every
// time — stock in the warehouse, what each shelf holds, the shelf's capacity —
// so it survives a reload, is never shown twice, and goes away by itself the
// moment the goods are placed or the capacity is raised. A product with no auto
// shelf, or an auto shelf without a capacity, is never «over»: unshelved stock
// alone is not a problem.
// ============================================

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { WarehouseMap } from '@hisabche/api'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../dialog'
import type { ShelfT } from './shelf-dialogs'

export interface ShelfOverflow {
  productId: string
  productName: string
  unit: string | null
  shelfId: string
  shelfCode: string
  /** Units of it on no shelf that its full auto shelf cannot take. */
  quantity: number
}

/** Pure: exported for the tests. */
export function shelfOverflows(
  map: Pick<WarehouseMap, 'locations' | 'autoShelves'> | undefined,
  stock: ReadonlyArray<{ id: string; name: string; unit: string; free: number }>,
): ShelfOverflow[] {
  if (!map?.autoShelves) return []
  const out: ShelfOverflow[] = []
  for (const auto of map.autoShelves) {
    const shelf = map.locations.find((location) => location.id === auto.locationId)
    if (!shelf || !shelf.isActive || shelf.capacity === null) continue
    const product = stock.find((row) => row.id === auto.productId)
    if (!product || product.free <= 0) continue
    const room = Math.max(0, shelf.capacity - shelf.quantity)
    const quantity = product.free - room
    if (quantity <= 1e-9) continue
    out.push({
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      shelfId: shelf.id,
      shelfCode: shelf.code,
      quantity,
    })
  }
  return out
}

export function ShelfOverflowNotice({
  t,
  overflows,
  formatQuantity,
  unitLabel,
  onOpenShelf,
}: {
  t: ShelfT
  overflows: readonly ShelfOverflow[]
  formatQuantity: (value: number) => string
  unitLabel: (unit: string) => string
  /** Open the full shelf (its table), to move something or place elsewhere. */
  onOpenShelf?: ((shelfId: string) => void) | undefined
}) {
  const [open, setOpen] = useState(false)
  if (overflows.length === 0) return null
  return (
    <>
      <button
        type="button"
        data-shelf-overflow=""
        onClick={() => setOpen(true)}
        className="fixed bottom-20 end-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full bg-[hsl(var(--color-destructive))] px-4 text-sm font-bold text-[hsl(var(--color-destructive-fg))] shadow-lg sm:bottom-6"
      >
        <AlertTriangle className="size-4" aria-hidden="true" />
        {t('warehouseShelves.overflow.button', { count: formatQuantity(overflows.length) })}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[90vh] max-w-md overflow-y-auto"
          data-shelf-overflow-dialog=""
        >
          <DialogHeader>
            <DialogTitle>{t('warehouseShelves.overflow.title')}</DialogTitle>
            <DialogDescription>{t('warehouseShelves.overflow.hint')}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {overflows.map((row) => (
              <li
                key={`${row.productId}:${row.shelfId}`}
                className="rounded-lg border border-[hsl(var(--color-destructive)/0.4)] bg-[hsl(var(--color-destructive)/0.06)] p-3 text-sm"
              >
                <p className="text-[hsl(var(--fg-primary))]">
                  {t('warehouseShelves.overflow.row', {
                    product: row.productName,
                    quantity: formatQuantity(row.quantity),
                    unit: unitLabel(row.unit ?? ''),
                    shelf: row.shelfCode,
                  })}
                </p>
                {onOpenShelf ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      onOpenShelf(row.shelfId)
                    }}
                    className="mt-2 text-xs font-medium text-[hsl(var(--color-primary))] underline"
                  >
                    {t('warehouseShelves.overflow.openShelf', { shelf: row.shelfCode })}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
