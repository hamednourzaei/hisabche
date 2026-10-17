'use client'

// ============================================
// Multi-warehouse (request #90) — «افزودن انبار» and «افزودن کالا به انبار».
//
// Assigning takes stock that is in NO warehouse and puts it into this one; the
// product total does not change (warehouse.service#assignStock). New stock
// arrives through a purchase invoice that names the warehouse — one path for
// goods coming in, not a second one here.
// ============================================

import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import {
  apiErrorMessage,
  asList,
  useBranches,
  useCreateBranch,
  useCreateStorageLocation,
  useMyCapabilities,
  useStockPlacement,
  useWarehouseMap,
  type Branch,
  type WarehouseProduct,
} from '@hisabche/api'

import { SelectField } from '../select-field'
import { Switch } from '../switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../dialog'

type T = (key: string, fallback?: string) => string

const input =
  'min-h-10 w-full rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-3 text-sm text-[hsl(var(--fg-primary))]'
const primary =
  'inline-flex min-h-10 items-center justify-center rounded-full bg-[hsl(var(--color-primary))] px-5 text-sm font-bold text-[hsl(var(--color-primary-fg))] disabled:opacity-50'
const quiet =
  'inline-flex min-h-10 items-center justify-center rounded-full border border-[hsl(var(--border-default))] px-4 text-sm text-[hsl(var(--fg-secondary))]'

const errorText = (t: T, err: unknown) => {
  const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code ?? ''
  return code === 'WAREHOUSE_ASSIGN_EXCEEDS_UNASSIGNED'
    ? t('warehouse.assignExceeds', 'این مقدار بیشتر از موجودی بدون انبار این کالاست')
    : t('warehouse.saveFailed', 'ذخیره نشد. دوباره تلاش کنید.')
}

/** The select's value for «belongs to no branch». Never sent as an id. */
const NO_BRANCH = 'none'

interface ShelfRow {
  key: number
  code: string
  name: string
}

/** Codes written twice in the form, compared the way the database compares them. */
export function repeatedShelfCodes(rows: Array<{ code: string }>): string[] {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const row of rows) {
    const code = row.code.trim()
    if (!code) continue
    if (seen.has(code)) repeated.add(code)
    seen.add(code)
  }
  return [...repeated]
}

export function AddWarehouseDialog({
  t,
  open,
  onClose,
  onCreate,
  isPending,
  initial,
}: {
  t: T
  open: boolean
  onClose: () => void
  /** Resolves with the warehouse (its id is needed for the shelves written below it). */
  onCreate: (input: {
    name: string
    location: string
    branchId?: string | null
  }) => Promise<unknown>
  isPending: boolean
  /** Set when editing an existing warehouse: the form starts from its values. */
  initial?: { id?: string; name: string; location: string } | null | undefined
}) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [branchId, setBranchId] = useState(NO_BRANCH)
  const [error, setError] = useState<string | null>(null)

  // «مدیریت قفسه‌ها» (owner, 17 Oct 2026): off by default and the warehouse works
  // fully without it. On, a few shelf codes are written right here; more can be
  // added later from «کالاها» › this warehouse. There is no stored «shelves on»
  // flag — a warehouse that has shelves IS managed by shelf, so the switch of an
  // existing warehouse starts on when it has any.
  const canShelve = useMyCapabilities().can('inventory.configure') === true
  const existingShelves = useWarehouseMap(open && canShelve && initial?.id ? initial.id : null, 90)
  const shelfCount = existingShelves.data?.migrated
    ? existingShelves.data.locations.filter((location) => location.isActive).length
    : 0
  const [shelvesOn, setShelvesOn] = useState(false)
  const [rows, setRows] = useState<ShelfRow[]>([{ key: 0, code: '', name: '' }])
  const createShelf = useCreateStorageLocation(null)

  // Which branch a warehouse belongs to decides who may sell from it: a member
  // limited to a branch sees and uses only that branch's warehouses.
  const branchList = useBranches()
  const branches = asList<Branch>(branchList.data).filter((branch) => branch.isActive)
  const placement = useStockPlacement(open)
  const currentBranch = initial?.id
    ? (placement.data?.warehouses.find((warehouse) => warehouse.id === initial.id)?.branchId ??
      null)
    : null
  // The branch select is offered only when it can be saved and read back.
  // ⚠️ Offered whenever branches can be saved — NOT only once one exists. «کل
  // کسب‌وکار» is a real answer, and a business with no branch yet must be able to
  // make its first one here (owner, 17 Oct 2026: «انبار و شعب باید باهم باشن»).
  const canPlace = placement.data?.branchesConfigured === true
  // Making a branch is `workspace.manage` on the server; the button follows it.
  const canAddBranch = useMyCapabilities().can('workspace.manage') === true
  const createBranch = useCreateBranch()
  const [newBranch, setNewBranch] = useState<{ name: string; code: string } | null>(null)
  const [branchError, setBranchError] = useState<string | null>(null)
  const saveBranch = async () => {
    if (!newBranch) return
    setBranchError(null)
    try {
      const created = await createBranch.mutateAsync({
        name: newBranch.name.trim(),
        code: newBranch.code.trim(),
      })
      if (created?.id) setBranchId(created.id)
      setNewBranch(null)
    } catch (err) {
      setBranchError(
        apiErrorMessage(err, t('warehouse.saveFailed', 'ذخیره نشد. دوباره تلاش کنید.')),
      )
    }
  }

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setLocation(initial?.location ?? '')
      setError(null)
      setRows([{ key: Date.now(), code: '', name: '' }])
    }
  }, [open, initial])
  useEffect(() => {
    if (open) setShelvesOn(shelfCount > 0)
  }, [open, shelfCount])

  const filledRows = shelvesOn ? rows.filter((row) => row.code.trim() !== '') : []
  const repeated = repeatedShelfCodes(filledRows)
  // The warehouse's present branch arrives after the dialog opens.
  useEffect(() => {
    if (open) setBranchId(currentBranch ?? NO_BRANCH)
  }, [open, currentBranch])

  const submit = async () => {
    try {
      const chosen = branchId === NO_BRANCH ? null : branchId
      const saved = await onCreate({
        name: name.trim(),
        location: location.trim(),
        // Sent only when it can be saved, and on an edit only when it changed.
        ...(canPlace && (initial ? chosen !== currentBranch : chosen !== null)
          ? { branchId: chosen }
          : {}),
      })
      const warehouseId = initial?.id ?? (saved as { id?: string } | null)?.id
      if (warehouseId && filledRows.length > 0) {
        // One shelf per call, each through the same route as «افزودن قفسه». The
        // warehouse is already saved: a refused shelf is named, not hidden.
        const failed: string[] = []
        for (const row of filledRows) {
          try {
            await createShelf.mutateAsync({
              warehouseId,
              kind: 'shelf',
              code: row.code.trim(),
              ...(row.name.trim() ? { name: row.name.trim() } : {}),
            })
          } catch {
            failed.push(row.code.trim())
          }
        }
        if (failed.length > 0) {
          setRows(filledRows.filter((row) => failed.includes(row.code.trim())))
          setError(t('warehouseShelves.form.partialFail').replace('{codes}', failed.join('، ')))
          return
        }
      }
      onClose()
    } catch (err) {
      setError(errorText(t, err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial
              ? t('warehouse.editWarehouse', 'ویرایش انبار')
              : t('warehouse.addWarehouse', 'افزودن انبار')}
          </DialogTitle>
          <DialogDescription>
            {t('warehouse.addWarehouseHint', 'نام انبار یا شعبه‌ای که کالا در آن نگهداری می‌شود.')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('warehouse.warehouseName', 'انبار')}
            </span>
            <input
              id="warehouse-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={input}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-[hsl(var(--fg-secondary))]">
              {t('warehouse.location', 'محل')}
            </span>
            <input
              id="warehouse-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={input}
            />
          </label>
          {canPlace ? (
            <div className="space-y-1 text-sm" data-warehouse-branch>
              <label htmlFor="warehouse-branch" className="text-[hsl(var(--fg-secondary))]">
                {t('warehouse.branch', 'شعبه')}
              </label>
              <SelectField
                id="warehouse-branch"
                value={branchId}
                onChange={setBranchId}
                options={[
                  { value: NO_BRANCH, label: t('warehouse.branchNone', 'کل کسب‌وکار') },
                  ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
                ]}
              />
              {canAddBranch && !newBranch ? (
                <button
                  type="button"
                  data-add-branch=""
                  onClick={() => {
                    setBranchError(null)
                    setNewBranch({ name: '', code: '' })
                  }}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--surface-muted))]"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  {t('warehouse.newBranch', 'شعبه‌ی تازه')}
                </button>
              ) : null}
              {newBranch ? (
                <div
                  data-new-branch=""
                  className="space-y-2 rounded-xl border border-dashed border-[hsl(var(--border-default))] p-3"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
                    <input
                      name="branch-name"
                      value={newBranch.name}
                      maxLength={120}
                      autoFocus
                      onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                      placeholder={t('warehouse.newBranchName', 'نام شعبه، مثلاً شعبه‌ی مرکزی')}
                      aria-label={t('warehouse.newBranchName', 'نام شعبه')}
                      className={`${input} min-w-0`}
                    />
                    <input
                      name="branch-code"
                      value={newBranch.code}
                      maxLength={20}
                      dir="ltr"
                      onChange={(e) => setNewBranch({ ...newBranch, code: e.target.value })}
                      placeholder="BR-01"
                      aria-label={t('warehouse.newBranchCode', 'کد شعبه')}
                      className={`${input} min-w-0 text-center`}
                    />
                  </div>
                  {branchError ? (
                    <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
                      {branchError}
                    </p>
                  ) : null}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setNewBranch(null)} className={quiet}>
                      {t('common.cancel', 'انصراف')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveBranch()}
                      disabled={
                        createBranch.isPending ||
                        newBranch.name.trim() === '' ||
                        newBranch.code.trim() === ''
                      }
                      className={primary}
                    >
                      {t('warehouse.addBranch', 'افزودن شعبه')}
                    </button>
                  </div>
                </div>
              ) : null}
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t(
                  'warehouse.branchHint',
                  'وقتی انبار را به یک شعبه بدهید، فقط کسانی که به آن شعبه دسترسی دارند آن را می‌بینند و از آن فاکتور می‌زنند. انبارِ «کل کسب‌وکار» برای همه باز است.',
                )}
              </p>
            </div>
          ) : null}
          {canShelve ? (
            <section
              data-warehouse-shelves-switch=""
              className="space-y-3 rounded-xl border border-[hsl(var(--border-default))] p-3"
            >
              <label className="flex cursor-pointer items-start justify-between gap-3">
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium text-[hsl(var(--fg-primary))]">
                    {t('warehouseShelves.form.switchLabel', 'مدیریت قفسه‌ها در این انبار')}
                  </span>
                  <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
                    {t('warehouseShelves.form.switchHint', '')}
                  </span>
                </span>
                <Switch
                  checked={shelvesOn}
                  onCheckedChange={setShelvesOn}
                  aria-label={t('warehouseShelves.form.switchLabel', 'مدیریت قفسه‌ها در این انبار')}
                />
              </label>
              {shelvesOn ? (
                <div className="space-y-2">
                  {shelfCount > 0 ? (
                    <p className="text-xs text-[hsl(var(--fg-secondary))]">
                      {t('warehouseShelves.form.existing', '').replace(
                        '{count}',
                        String(shelfCount),
                      )}
                    </p>
                  ) : null}
                  <div
                    aria-hidden="true"
                    className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] gap-2 px-1 text-xs text-[hsl(var(--fg-tertiary))]"
                  >
                    <span className="text-center">
                      {t('warehouseShelves.shelfDialog.code', 'کد قفسه')}
                    </span>
                    <span>{t('warehouseShelves.shelfDialog.name', 'توضیح (اختیاری)')}</span>
                  </div>
                  {rows.map((row, index) => (
                    <div
                      key={row.key}
                      className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] items-center gap-2"
                    >
                      <input
                        name={`shelf-code-${index}`}
                        value={row.code}
                        maxLength={40}
                        dir="ltr"
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((item) =>
                              item.key === row.key ? { ...item, code: event.target.value } : item,
                            ),
                          )
                        }
                        placeholder={t('warehouseShelves.form.rowCode', 'A-01')}
                        aria-label={t('warehouseShelves.shelfDialog.code', 'کد قفسه')}
                        className={`${input} min-w-0 text-center`}
                      />
                      <input
                        name={`shelf-name-${index}`}
                        value={row.name}
                        maxLength={80}
                        onChange={(event) =>
                          setRows((current) =>
                            current.map((item) =>
                              item.key === row.key ? { ...item, name: event.target.value } : item,
                            ),
                          )
                        }
                        placeholder={t('warehouseShelves.form.rowName', '')}
                        aria-label={t('warehouseShelves.shelfDialog.name', '')}
                        className={`${input} min-w-0`}
                      />
                      {rows.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setRows((current) => current.filter((item) => item.key !== row.key))
                          }
                          aria-label={t('warehouseShelves.form.removeRow', '')}
                          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))]"
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      ) : (
                        <span aria-hidden="true" />
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setRows((current) => [...current, { key: Date.now(), code: '', name: '' }])
                    }
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--surface-muted))]"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    {t('warehouseShelves.form.addRow', '')}
                  </button>
                  {repeated.length > 0 ? (
                    <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
                      {t('warehouseShelves.form.duplicateCodes', '').replace(
                        '{codes}',
                        repeated.join('، '),
                      )}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} className={quiet}>
            {t('common.cancel', 'انصراف')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={
              isPending || createShelf.isPending || name.trim() === '' || repeated.length > 0
            }
            className={primary}
          >
            {t('common.save', 'ذخیره')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AssignStockDialog({
  t,
  fmt,
  open,
  onClose,
  warehouseName,
  unassigned,
  isLoadingUnassigned,
  onAssign,
  isPending,
}: {
  t: T
  fmt: (v: number) => string
  open: boolean
  onClose: () => void
  warehouseName: string
  /** Products with stock in no warehouse, and how much of each. */
  unassigned: WarehouseProduct[]
  isLoadingUnassigned: boolean
  onAssign: (input: { productId: string; quantity: number }) => Promise<unknown>
  isPending: boolean
}) {
  const available = unassigned.filter((product) => product.quantity > 0)
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setProductId('')
      setQuantity('')
      setError(null)
    }
  }, [open])

  const selected = available.find((product) => product.id === productId)
  const amount = Number(quantity)
  const valid = !!selected && Number.isFinite(amount) && amount > 0 && amount <= selected.quantity

  const submit = async () => {
    if (!selected) return
    try {
      await onAssign({ productId: selected.id, quantity: amount })
      onClose()
    } catch (err) {
      setError(errorText(t, err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('warehouse.assignTitle', 'افزودن کالا به انبار')}: {warehouseName}
          </DialogTitle>
          <DialogDescription>
            {t(
              'warehouse.assignHint',
              'موجودی‌ای که در هیچ انباری نیست به این انبار منتقل می‌شود؛ کل موجودی کالا تغییر نمی‌کند. کالای تازه را با فاکتور خرید همین انبار ثبت کنید.',
            )}
          </DialogDescription>
        </DialogHeader>
        {isLoadingUnassigned ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
            {t('common.loading', 'در حال بارگذاری…')}
          </p>
        ) : available.length === 0 ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
            {t('warehouse.nothingUnassigned', 'موجودی بدون انبار وجود ندارد.')}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1 text-sm">
              <label htmlFor="warehouse-assign-product" className="text-[hsl(var(--fg-secondary))]">
                {t('warehouse.name', 'نام')}
              </label>
              <SelectField
                id="warehouse-assign-product"
                value={productId}
                onChange={setProductId}
                placeholder={t('warehouse.chooseProduct', 'انتخاب کالا')}
                options={available.map((product) => ({
                  value: product.id,
                  label: `${product.name} — ${fmt(product.quantity)} ${t(`unit.${product.unit}`, product.unit)}`,
                }))}
              />
            </div>
            <label className="block space-y-1 text-sm">
              <span className="text-[hsl(var(--fg-secondary))]">
                {t('warehouse.quantity', 'مقدار')}
              </span>
              <input
                id="warehouse-assign-quantity"
                type="number"
                min={0}
                max={selected?.quantity}
                inputMode="decimal"
                dir="ltr"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={input}
              />
            </label>
            {selected ? (
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('warehouse.assignMax', 'حداکثر')}: {fmt(selected.quantity)}{' '}
                {t(`unit.${selected.unit}`, selected.unit)}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
                {error}
              </p>
            ) : null}
          </div>
        )}
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} className={quiet}>
            {t('common.cancel', 'انصراف')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={isPending || !valid}
            className={primary}
          >
            {t('warehouse.assignAction', 'افزودن به انبار')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * «انتقال موجودی» — move a quantity of one product from the open warehouse to
 * another. The product total does not change; the server moves both sides in
 * one transaction and refuses more than the source holds.
 *
 * The quantity is in the product's own unit, shown beside the field — the same
 * unit the warehouse counts it in.
 */
export function TransferStockDialog({
  t,
  fmt,
  open,
  onClose,
  warehouseName,
  products,
  targets,
  onTransfer,
  isPending,
}: {
  t: T
  fmt: (v: number) => string
  open: boolean
  onClose: () => void
  /** The source: the warehouse that is open. */
  warehouseName: string
  /** What the source holds. */
  products: WarehouseProduct[]
  /** Every OTHER live warehouse. */
  targets: Array<{ id: string; name: string }>
  onTransfer: (input: {
    productId: string
    toWarehouseId: string
    quantity: number
    notes?: string | undefined
    idempotencyKey: string
  }) => Promise<unknown>
  isPending: boolean
}) {
  const available = products.filter((product) => product.quantity > 0)
  const [productId, setProductId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  // One key per opening of the dialog: pressing «انتقال» twice, or a retry after
  // a lost answer, is the same movement.
  const [requestKey, setRequestKey] = useState('')

  useEffect(() => {
    if (open) {
      setProductId('')
      setTargetId('')
      setQuantity('')
      setNotes('')
      setError(null)
      setRequestKey(crypto.randomUUID())
    }
  }, [open])

  const selected = available.find((product) => product.id === productId)
  const amount = Number(quantity)
  const valid =
    !!selected && !!targetId && Number.isFinite(amount) && amount > 0 && amount <= selected.quantity

  const submit = async () => {
    if (!selected || !targetId) return
    setError(null)
    try {
      await onTransfer({
        productId: selected.id,
        toWarehouseId: targetId,
        quantity: amount,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        idempotencyKey: requestKey,
      })
      onClose()
    } catch (err) {
      const body = (err as { response?: { data?: { code?: string; error?: string } } })?.response
        ?.data
      const code = `${body?.code ?? ''} ${body?.error ?? ''}`
      setError(
        code.includes('WAREHOUSE_INSUFFICIENT_STOCK')
          ? t(
              'warehouse.transferInsufficient',
              'این مقدار بیشتر از موجودی این کالا در انبار مبدأ است.',
            )
          : t('warehouse.saveFailed', 'ذخیره نشد. دوباره تلاش کنید.'),
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-w-md" data-transfer-stock="">
        <DialogHeader>
          <DialogTitle>
            {t('warehouse.transferStock', 'انتقال موجودی')}: {warehouseName}
          </DialogTitle>
          <DialogDescription>
            {t(
              'warehouse.transferHint',
              'کالا از این انبار کم و به انبار مقصد اضافه می‌شود؛ کل موجودی کالا تغییر نمی‌کند.',
            )}
          </DialogDescription>
        </DialogHeader>
        {targets.length === 0 ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
            {t(
              'warehouse.transferNoTarget',
              'انبار دیگری برای انتقال وجود ندارد. اول یک انبار اضافه کنید.',
            )}
          </p>
        ) : available.length === 0 ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--fg-secondary))]">
            {t('warehouse.transferNothing', 'در این انبار کالایی برای انتقال نیست.')}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1 text-sm">
              <label
                htmlFor="warehouse-transfer-product"
                className="text-[hsl(var(--fg-secondary))]"
              >
                {t('warehouse.name', 'نام')}
              </label>
              <SelectField
                id="warehouse-transfer-product"
                value={productId}
                onChange={setProductId}
                placeholder={t('warehouse.chooseProduct', 'انتخاب کالا')}
                options={available.map((product) => ({
                  value: product.id,
                  label: `${product.name} — ${fmt(product.quantity)} ${t(`unit.${product.unit}`, product.unit)}`,
                }))}
              />
            </div>
            <div className="space-y-1 text-sm">
              <label
                htmlFor="warehouse-transfer-target"
                className="text-[hsl(var(--fg-secondary))]"
              >
                {t('warehouse.toWarehouse', 'به انبار')}
              </label>
              <SelectField
                id="warehouse-transfer-target"
                value={targetId}
                onChange={setTargetId}
                placeholder={t('warehouse.toWarehouse', 'به انبار')}
                options={targets.map((target) => ({ value: target.id, label: target.name }))}
              />
            </div>
            <label className="block space-y-1 text-sm">
              <span className="text-[hsl(var(--fg-secondary))]">
                {t('warehouse.transferQuantity', 'مقدار انتقال')}
                {selected ? ` (${t(`unit.${selected.unit}`, selected.unit)})` : ''}
              </span>
              <input
                id="warehouse-transfer-quantity"
                name="quantity"
                type="number"
                min={0}
                max={selected?.quantity}
                inputMode="decimal"
                dir="ltr"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={input}
              />
            </label>
            {selected ? (
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                {t('warehouse.assignMax', 'حداکثر')}: {fmt(selected.quantity)}{' '}
                {t(`unit.${selected.unit}`, selected.unit)}
              </p>
            ) : null}
            <label className="block space-y-1 text-sm">
              <span className="text-[hsl(var(--fg-secondary))]">
                {t('warehouse.transferNotes', 'توضیحات (اختیاری)')}
              </span>
              <input
                id="warehouse-transfer-notes"
                name="notes"
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={input}
              />
            </label>
            {error ? (
              <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
                {error}
              </p>
            ) : null}
          </div>
        )}
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} className={quiet}>
            {t('common.cancel', 'انصراف')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={isPending || !valid}
            className={primary}
          >
            {t('warehouse.transferAction', 'انتقال')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
