'use client'

// ============================================
// packages/ui/src/components/ui/warehouse/shelves/shelf-dialogs.tsx
//
// The two small forms of «قفسه‌ها» (owner, 17 Oct 2026 — the floor map was
// «too much»):
//
//   ShelfDialog   a shelf is a CODE, an optional description and an optional
//                 capacity. No x/y, no width, no parent: a person in front of
//                 a shelf knows its label, not its coordinates.
//   PlaceDialog   which product sits on which shelf, and how many units —
//                 or moving units from one shelf to another.
//
// ⚠️ A PLACEMENT IS NOT A STOCK MOVEMENT. The server sets «this many units are
// on this shelf» and refuses more than the WAREHOUSE holds; nothing here adds,
// removes or revalues stock. The forms say so.
// ============================================

import { useState } from 'react'

import { SelectField } from '../../select-field'
import { typedNumber } from '../../../../lib/typed-number'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../dialog'

export type ShelfT = (key: string, values?: Record<string, string | number>) => string

export const shelfInput =
  'min-h-11 w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 text-sm text-[hsl(var(--fg-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]'
const primary =
  'inline-flex min-h-11 items-center justify-center rounded-full bg-[hsl(var(--color-primary))] px-5 text-sm font-bold text-[hsl(var(--color-primary-fg))] disabled:opacity-50'
const quiet =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-[hsl(var(--border-default))] px-4 text-sm text-[hsl(var(--fg-secondary))]'
const help = 'block text-xs text-[hsl(var(--fg-tertiary))]'
const caption = 'text-sm text-[hsl(var(--fg-secondary))]'

/** The server's refusal, read by code — the sentence is ours. */
export function shelfErrorText(error: unknown, t: ShelfT): string {
  const data = (error as { response?: { data?: { code?: unknown; message?: unknown } } } | null)
    ?.response?.data
  const code = typeof data?.code === 'string' ? data.code : String(data?.message ?? '')
  if (code === 'STORAGE_LOCATION_CODE_TAKEN') return t('warehouseShelves.errors.codeTaken')
  if (code === 'STORAGE_PLACEMENT_EXCEEDS_STOCK') return t('warehouseShelves.errors.exceedsStock')
  if (code === 'STORAGE_PRODUCT_NOT_FOUND') return t('warehouseShelves.errors.productNotFound')
  if (code === 'WAREHOUSE_NOT_PERMITTED') return t('warehouseShelves.errors.notPermitted')
  if (code === 'WAREHOUSE_MAP_SCHEMA_REQUIRED') return t('warehouseShelves.notMigrated')
  return t('warehouseShelves.errors.save')
}

export interface ShelfValues {
  code: string
  name?: string | undefined
  capacity: number | null
}

export function ShelfDialog({
  t,
  open,
  editing,
  isPending,
  onSubmit,
  onClose,
}: {
  t: ShelfT
  open: boolean
  editing: { code: string; name: string | null; capacity: number | null } | null
  isPending: boolean
  /** Resolves when the server accepted; rejects with its refusal. */
  onSubmit: (values: ShelfValues) => Promise<unknown>
  onClose: () => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Each opening starts from the shelf being edited (or empty). Adjusted while
  // rendering, not in an effect: an effect paints the previous form for a frame.
  const [openedFor, setOpenedFor] = useState<typeof editing | false>(false)
  if (open && openedFor !== editing) {
    setOpenedFor(editing)
    setCode(editing?.code ?? '')
    setName(editing?.name ?? '')
    setCapacity(editing?.capacity == null ? '' : String(editing.capacity))
    setError(null)
  } else if (!open && openedFor !== false) {
    setOpenedFor(false)
  }

  // Persian digits included — `type="number"` read «۲۰۰» as empty (typed-number.ts).
  const parsedCapacity = capacity.trim() === '' ? null : typedNumber(capacity)
  const capacityOk =
    parsedCapacity === null || (Number.isFinite(parsedCapacity) && parsedCapacity > 0)

  const submit = async () => {
    setError(null)
    try {
      await onSubmit({
        code: code.trim(),
        ...(name.trim() ? { name: name.trim() } : {}),
        capacity: parsedCapacity,
      })
      onClose()
    } catch (err) {
      setError(shelfErrorText(err, t))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t('warehouseShelves.shelfDialog.editTitle')
              : t('warehouseShelves.shelfDialog.addTitle')}
          </DialogTitle>
          <DialogDescription>{t('warehouseShelves.shelfDialog.hint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block space-y-1">
            <span className={caption}>{t('warehouseShelves.shelfDialog.code')}</span>
            <input
              name="code"
              value={code}
              maxLength={40}
              autoFocus
              onChange={(event) => setCode(event.target.value)}
              placeholder={t('warehouseShelves.shelfDialog.codePlaceholder')}
              className={shelfInput}
            />
            <span className={help}>{t('warehouseShelves.shelfDialog.codeHelp')}</span>
          </label>
          <label className="block space-y-1">
            <span className={caption}>{t('warehouseShelves.shelfDialog.name')}</span>
            <input
              name="name"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('warehouseShelves.shelfDialog.namePlaceholder')}
              className={shelfInput}
            />
          </label>
          <label className="block space-y-1">
            <span className={caption}>{t('warehouseShelves.shelfDialog.capacity')}</span>
            <input
              name="capacity"
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              placeholder={t('warehouseShelves.shelfDialog.capacityPlaceholder')}
              className={shelfInput}
            />
            <span className={help}>{t('warehouseShelves.shelfDialog.capacityHelp')}</span>
          </label>
          {error ? (
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} className={quiet}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={isPending || code.trim() === '' || !capacityOk}
            className={primary}
          >
            {t('common.save')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export interface ShelfOption {
  id: string
  code: string
  name: string | null
}

export interface StockOption {
  id: string
  name: string
  sku: string | null
  unit: string
  /** In this warehouse. */
  total: number
  /** In this warehouse and on no shelf. */
  free: number
  /** Units per shelf id. */
  onShelf: Record<string, number>
}

export type PlaceRequest =
  | { mode: 'place'; shelfId?: string | undefined; productId?: string | undefined }
  | { mode: 'move'; productId: string; fromShelfId: string }

/**
 * «گذاشتن روی قفسه» and «جابه‌جایی».
 *
 * place  the quantity is THE number on that shelf (what the server stores);
 *        it starts at «what is there + what is on no shelf».
 * move   units go from one shelf to another of the same warehouse.
 */
export function PlaceDialog({
  t,
  formatQuantity,
  unitLabel,
  request,
  shelves,
  products,
  isPending,
  onPlace,
  onMove,
  onClose,
}: {
  t: ShelfT
  formatQuantity: (value: number) => string
  unitLabel: (unit: string) => string
  request: PlaceRequest | null
  shelves: ShelfOption[]
  products: StockOption[]
  isPending: boolean
  onPlace: (input: { shelfId: string; productId: string; quantity: number }) => Promise<unknown>
  onMove: (input: {
    productId: string
    fromShelfId: string
    toShelfId: string
    quantity: number
  }) => Promise<unknown>
  onClose: () => void
}) {
  const open = request !== null
  const moving = request?.mode === 'move'
  const [productId, setProductId] = useState('')
  const [shelfId, setShelfId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [suggestedFor, setSuggestedFor] = useState('')
  const [openedFor, setOpenedFor] = useState<PlaceRequest | null>(null)
  if (request !== openedFor) {
    setOpenedFor(request)
    if (request) {
      setError(null)
      setProductId(request.productId ?? '')
      setShelfId(request.mode === 'place' ? (request.shelfId ?? '') : '')
      setQuantity('')
      setSuggestedFor('')
    }
  }

  const product = products.find((row) => row.id === productId)
  const fromShelfId = request?.mode === 'move' ? request.fromShelfId : null
  const onFrom = product && fromShelfId ? (product.onShelf[fromShelfId] ?? 0) : 0
  const onTarget = product && shelfId ? (product.onShelf[shelfId] ?? 0) : 0

  // The first sensible number once both sides are known — the person edits it.
  const key = `${productId}:${shelfId}`
  if (open && product && shelfId && key !== suggestedFor) {
    setSuggestedFor(key)
    setQuantity(String(moving ? onFrom : onTarget + product.free))
  }

  const amount = typedNumber(quantity) ?? 0
  const valid =
    !!product &&
    !!shelfId &&
    quantity.trim() !== '' &&
    Number.isFinite(amount) &&
    (moving ? amount > 0 && amount <= onFrom && shelfId !== fromShelfId : amount >= 0)

  const submit = async () => {
    if (!product || !shelfId) return
    setError(null)
    try {
      if (moving && fromShelfId) {
        await onMove({ productId: product.id, fromShelfId, toShelfId: shelfId, quantity: amount })
      } else {
        await onPlace({ shelfId, productId: product.id, quantity: amount })
      }
      onClose()
    } catch (err) {
      setError(shelfErrorText(err, t))
    }
  }

  const fixedProduct = moving || (request?.mode === 'place' && !!request.productId)
  const fixedShelf = request?.mode === 'place' && !!request.shelfId
  const shelfLabel = (shelf: ShelfOption) => `${shelf.code}${shelf.name ? ` — ${shelf.name}` : ''}`

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {moving
              ? t('warehouseShelves.placeDialog.moveTitle')
              : t('warehouseShelves.placeDialog.title')}
          </DialogTitle>
          <DialogDescription>{t('warehouseShelves.notStock')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <span className={caption}>{t('warehouseShelves.placeDialog.product')}</span>
            {fixedProduct && product ? (
              <p className="rounded-lg bg-[hsl(var(--surface-muted))] px-3 py-2.5 text-sm font-medium text-[hsl(var(--fg-primary))]">
                {product.name}
              </p>
            ) : (
              <SelectField
                aria-label={t('warehouseShelves.placeDialog.product')}
                data-field="productId"
                value={productId}
                onChange={setProductId}
                searchable
                searchPlaceholder={t('warehouseShelves.placeDialog.searchPlaceholder')}
                noResultsText={t('warehouseShelves.placeDialog.noResults')}
                placeholder={t('warehouseShelves.placeDialog.productPlaceholder')}
                options={products.map((row) => ({
                  value: row.id,
                  label: `${row.name} — ${formatQuantity(row.total)} ${unitLabel(row.unit)}`,
                  keywords: `${row.name} ${row.sku ?? ''}`,
                }))}
              />
            )}
            {product && !moving ? (
              <span className={help}>
                {t('warehouseShelves.placeDialog.free', {
                  total: formatQuantity(product.total),
                  free: formatQuantity(product.free),
                  unit: unitLabel(product.unit),
                })}
              </span>
            ) : null}
            {!fixedProduct ? (
              <span className={help}>{t('warehouseShelves.placeDialog.notInList')}</span>
            ) : null}
          </div>

          <div className="space-y-1">
            <span className={caption}>
              {moving
                ? t('warehouseShelves.placeDialog.toShelf')
                : t('warehouseShelves.placeDialog.shelf')}
            </span>
            {fixedShelf ? (
              <p className="rounded-lg bg-[hsl(var(--surface-muted))] px-3 py-2.5 text-sm font-medium text-[hsl(var(--fg-primary))]">
                {shelfLabel(
                  shelves.find((shelf) => shelf.id === shelfId) ?? { id: '', code: '', name: null },
                )}
              </p>
            ) : (
              <SelectField
                aria-label={t('warehouseShelves.placeDialog.shelf')}
                data-field="locationId"
                value={shelfId}
                onChange={setShelfId}
                searchable={shelves.length > 8}
                searchPlaceholder={t('warehouseShelves.placeDialog.shelfPlaceholder')}
                noResultsText={t('warehouseShelves.noMatch')}
                placeholder={t('warehouseShelves.placeDialog.shelfPlaceholder')}
                options={shelves
                  .filter((shelf) => shelf.id !== fromShelfId)
                  .map((shelf) => ({
                    value: shelf.id,
                    label: shelfLabel(shelf),
                    keywords: shelfLabel(shelf),
                  }))}
              />
            )}
            {product && shelfId ? (
              <span className={help}>
                {t('warehouseShelves.placeDialog.onShelf', {
                  quantity: formatQuantity(onTarget),
                  unit: unitLabel(product.unit),
                })}
              </span>
            ) : null}
          </div>

          {product && shelfId ? (
            <label className="block space-y-1">
              <span className={caption}>
                {moving
                  ? t('warehouseShelves.placeDialog.moveQuantity')
                  : t('warehouseShelves.placeDialog.quantity')}
              </span>
              <input
                name="quantity"
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder={t('warehouseShelves.placeDialog.quantityPlaceholder')}
                className={shelfInput}
              />
            </label>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} className={quiet}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={isPending || !valid}
            className={primary}
          >
            {moving
              ? t('warehouseShelves.placeDialog.moveSave')
              : t('warehouseShelves.placeDialog.save')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
