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
  if (code === 'STORAGE_PLACEMENT_EXCEEDS_CAPACITY')
    return t('warehouseShelves.errors.exceedsCapacity')
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
  /** Units it holds; `null` = not recorded (no limit). */
  capacity?: number | null | undefined
  /** Units of every product on it now. */
  occupied?: number | undefined
}

/**
 * How many more units of one product may go on one shelf (owner, 18 Oct 2026):
 * never more than is on NO shelf in this warehouse, never more than the room
 * left on the shelf (every product on it counts). `room: null` = no capacity
 * recorded, so only the stock limits it. The server enforces the same two
 * limits (storage_place_stock); this only says them before a refusal.
 */
export function placeLimits(input: {
  free: number
  capacity: number | null | undefined
  occupied: number | undefined
}): { room: number | null; max: number } {
  const room =
    input.capacity === null || input.capacity === undefined
      ? null
      : Math.max(0, input.capacity - (input.occupied ?? 0))
  const max = Math.max(0, room === null ? input.free : Math.min(input.free, room))
  return { room, max }
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
 * place  ADDS units to that shelf (owner, 18 Oct 2026). It asked for the total
 *        and started at «on the shelf + on no shelf», so re-placing 2 gearboxes
 *        read «8» and a new product read its whole stock. The dialog now shows
 *        the four numbers (in this warehouse, on this shelf, on no shelf, shelf
 *        capacity) and asks «how many to add», at most `placeLimits().max`;
 *        the server is sent «on the shelf + added», the number it stores.
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
  autoShelfOf,
  onSetAuto,
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
  /** The shelf a product's purchases fill in this warehouse, if any. */
  autoShelfOf?: ((productId: string) => string | null) | undefined
  /** Absent = shelf-capacity-01 not run: the switch is not offered. */
  onSetAuto?:
    | ((input: { shelfId: string; productId: string; enabled: boolean }) => Promise<unknown>)
    | undefined
}) {
  const open = request !== null
  const moving = request?.mode === 'move'
  const [productId, setProductId] = useState('')
  const [shelfId, setShelfId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [suggestedFor, setSuggestedFor] = useState('')
  const [auto, setAuto] = useState<boolean | null>(null)
  const [openedFor, setOpenedFor] = useState<PlaceRequest | null>(null)
  if (request !== openedFor) {
    setOpenedFor(request)
    if (request) {
      setError(null)
      setProductId(request.productId ?? '')
      setShelfId(request.mode === 'place' ? (request.shelfId ?? '') : '')
      setQuantity('')
      setSuggestedFor('')
      setAuto(null)
    }
  }

  const product = products.find((row) => row.id === productId)
  const fromShelfId = request?.mode === 'move' ? request.fromShelfId : null
  const onFrom = product && fromShelfId ? (product.onShelf[fromShelfId] ?? 0) : 0
  const onTarget = product && shelfId ? (product.onShelf[shelfId] ?? 0) : 0

  const target = shelves.find((shelf) => shelf.id === shelfId)
  const limits = placeLimits({
    // A move takes what is on the source shelf; a placement, what is on none.
    free: moving ? onFrom : (product?.free ?? 0),
    capacity: target?.capacity,
    occupied: target?.occupied,
  })

  // A move starts at «all of it» (capped by the room); a placement starts empty.
  const key = `${productId}:${shelfId}`
  if (open && product && shelfId && key !== suggestedFor) {
    setSuggestedFor(key)
    setQuantity(moving ? String(limits.max) : '')
    setAuto(null)
  }

  const isAuto = product && shelfId ? autoShelfOf?.(product.id) === shelfId : false
  const autoWanted = auto ?? isAuto
  const autoChanged = !moving && !!onSetAuto && auto !== null && auto !== isAuto

  const amount = typedNumber(quantity) ?? 0
  const amountOk =
    quantity.trim() !== '' && Number.isFinite(amount) && amount > 0 && amount <= limits.max + 1e-9
  const valid =
    !!product &&
    !!shelfId &&
    (moving
      ? amountOk && shelfId !== fromShelfId
      : amountOk || (quantity.trim() === '' && autoChanged))

  const submit = async () => {
    if (!product || !shelfId) return
    setError(null)
    try {
      if (moving && fromShelfId) {
        await onMove({ productId: product.id, fromShelfId, toShelfId: shelfId, quantity: amount })
      } else {
        if (amountOk) await onPlace({ shelfId, productId: product.id, quantity: onTarget + amount })
        if (autoChanged && onSetAuto)
          await onSetAuto({ shelfId, productId: product.id, enabled: autoWanted })
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
            <div className="space-y-2">
              {!moving ? (
                <dl
                  data-place-summary=""
                  className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-[hsl(var(--surface-muted))] p-3 text-xs"
                >
                  <dt className="text-[hsl(var(--fg-secondary))]">
                    {t('warehouseShelves.placeDialog.inWarehouse')}
                  </dt>
                  <dd className="text-end font-semibold tabular-nums">
                    {formatQuantity(product.total)} {unitLabel(product.unit)}
                  </dd>
                  <dt className="text-[hsl(var(--fg-secondary))]">
                    {t('warehouseShelves.placeDialog.onThisShelf')}
                  </dt>
                  <dd className="text-end font-semibold tabular-nums">
                    {formatQuantity(onTarget)} {unitLabel(product.unit)}
                  </dd>
                  <dt className="text-[hsl(var(--fg-secondary))]">
                    {t('warehouseShelves.placeDialog.noShelf')}
                  </dt>
                  <dd className="text-end font-semibold tabular-nums">
                    {formatQuantity(product.free)} {unitLabel(product.unit)}
                  </dd>
                  <dt className="text-[hsl(var(--fg-secondary))]">
                    {t('warehouseShelves.placeDialog.capacityLabel')}
                  </dt>
                  <dd className="text-end font-semibold tabular-nums">
                    {limits.room === null
                      ? t('warehouseShelves.placeDialog.capacityNone')
                      : t('warehouseShelves.placeDialog.capacityOf', {
                          capacity: formatQuantity(target?.capacity ?? 0),
                          occupied: formatQuantity(target?.occupied ?? 0),
                        })}
                  </dd>
                </dl>
              ) : null}
              <label className="block space-y-1">
                <span className={caption}>
                  {moving
                    ? t('warehouseShelves.placeDialog.moveQuantity')
                    : t('warehouseShelves.placeDialog.addQuantity')}
                </span>
                <input
                  name="quantity"
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={quantity}
                  disabled={limits.max <= 0}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder={t('warehouseShelves.placeDialog.maxPlaceholder', {
                    max: formatQuantity(limits.max),
                    unit: unitLabel(product.unit),
                  })}
                  className={shelfInput}
                />
              </label>
              <p className={help} data-place-room="">
                {limits.room === null
                  ? t('warehouseShelves.placeDialog.roomUnlimited')
                  : t('warehouseShelves.placeDialog.room', {
                      room: formatQuantity(limits.room),
                      unit: unitLabel(product.unit),
                    })}
                {!moving
                  ? ` · ${t('warehouseShelves.placeDialog.freeShort', {
                      free: formatQuantity(product.free),
                      unit: unitLabel(product.unit),
                    })}`
                  : ''}
              </p>
              {limits.max <= 0 ? (
                <p role="status" className="text-xs text-[hsl(var(--color-warning))]">
                  {limits.room === 0
                    ? t('warehouseShelves.placeDialog.shelfFull')
                    : t('warehouseShelves.placeDialog.nothingFree')}
                </p>
              ) : quantity.trim() !== '' && !amountOk ? (
                <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
                  {t('warehouseShelves.placeDialog.overMax', {
                    max: formatQuantity(limits.max),
                    unit: unitLabel(product.unit),
                  })}
                </p>
              ) : null}
              {!moving && onSetAuto ? (
                <label className="flex items-start gap-2 text-xs text-[hsl(var(--fg-primary))]">
                  <input
                    type="checkbox"
                    data-auto-shelf=""
                    checked={autoWanted}
                    onChange={(event) => setAuto(event.target.checked)}
                    className="mt-0.5 size-4 accent-[hsl(var(--color-primary))]"
                  />
                  <span>
                    {t('warehouseShelves.placeDialog.autoLabel')}
                    <span className={`${help} block`}>
                      {t('warehouseShelves.placeDialog.autoHint')}
                    </span>
                  </span>
                </label>
              ) : null}
            </div>
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
