'use client'

// ============================================
// The production form — ONE component for every product and every trade.
//
// It is the invoice builder's interaction, on purpose: the component table IS
// the invoice grid (same cells, same product picker, same «add a column»
// dialog, same row total), so nobody has to learn a second way to enter lines.
// Around it sit the things an invoice does not have: other costs, labour, how
// many units, an optional manual total, and whether the result goes into a
// warehouse.
//
// Used from the manufacturing page AND from a product's own page. Both save
// through the same two calls (definition, run), so there is one behaviour.
//
// ⚠️ Every figure on screen is a PREVIEW (`useProductionDraft` →
// `computeProductionCost`). The server recomputes from the same rows and its
// result is what is stored; a total is never sent as an instruction, except
// the explicit override, which travels with its reason.
// ============================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  canDeleteColumn,
  isForeignMoneyColumn,
  isRowFilled,
  parseCellNumber,
  type InvoiceColumn,
  type ProduceInput,
  type SaveProductionDefinition,
} from '@hisabche/validation'
import { formatNumber } from '@hisabche/formatting'
import { SUPPORTED_CURRENCIES, useCurrencyStore, type CurrencyCode } from '@hisabche/store'
import {
  apiErrorMessage,
  useCreateWarehouse,
  useProduce,
  useProductionDefinition,
  useSaveProductionDefinition,
  useWarehouseOverview,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { AddProductModal } from '../add-product-modal'
import { Button } from '../button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../dialog'
import { Input } from '../input'
import { MoneyInput } from '../money-input'
import { ProductPicker } from '../product-picker'
import { SelectField } from '../select-field'
import { Switch } from '../switch'
import { useToast } from '../toast-provider'
import { ColumnDialog } from '../invoice-builder/column-dialog'
import { TableSettingsDialog } from '../invoice-builder/table-settings-dialog'
import { GridToolbar } from '../invoice-builder/grid/grid-toolbar'
import { InvoiceItemsGrid } from '../invoice-builder/grid/invoice-items-grid'
import { AddWarehouseDialog } from '../warehouse/warehouse-dialogs'
import { useProductionDraft } from './use-production-draft'
import { manufacturingErrorText } from './manufacturing-errors'

type T = (key: string, fallback?: string) => string

export interface ProductionEditorTarget {
  productId: string
  productName: string
}

export interface ProductionEditorProps {
  t: T
  locale: string
  /** Fixed when opened from a product or a planned order; absent = choose. */
  product?: ProductionEditorTarget | null | undefined
  /** A planned order this run completes. */
  workOrderId?: string | undefined
  initialQuantity?: number | undefined
  /** `'definition'` edits the recipe only; `'produce'` also records a run. */
  mode: 'produce' | 'definition'
  onDone: () => void
  onCancel: () => void
}

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 md:p-5'
const sectionTitle = 'text-sm font-semibold text-[hsl(var(--fg-primary))]'
const fieldLabel = 'mb-1 block text-xs font-medium text-[hsl(var(--fg-secondary))]'
const hint = 'text-xs text-[hsl(var(--fg-tertiary))]'
const problem = 'text-xs text-[hsl(var(--color-destructive))]'

/** One key per press of «ثبت»; a retry of the same press sends it again. */
function newIdempotencyKey(): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `produce-${random}`
}

export function ProductionEditor({
  t,
  locale,
  product,
  workOrderId,
  initialQuantity,
  mode,
  onDone,
  onCancel,
}: ProductionEditorProps) {
  const toast = useToast()
  const primaryCurrency = useCurrencyStore((s) => s.primaryCurrency)
  const draft = useProductionDraft(primaryCurrency)

  const [target, setTarget] = useState<ProductionEditorTarget | null>(product ?? null)
  const [addProductOpen, setAddProductOpen] = useState(false)

  const [addToInventory, setAddToInventory] = useState(false)
  const [consumeComponents, setConsumeComponents] = useState(true)
  const [warehouseId, setWarehouseId] = useState<string | null>(null)
  const [addWarehouseOpen, setAddWarehouseOpen] = useState(false)

  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null)
  const [columnDialogOpen, setColumnDialogOpen] = useState(false)
  const [editingColumn, setEditingColumn] = useState<InvoiceColumn | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<InvoiceColumn | null>(null)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const idempotencyKey = useRef(newIdempotencyKey())

  const definition = useProductionDefinition(target?.productId ?? null)
  const saveDefinition = useSaveProductionDefinition()
  const produce = useProduce()
  const warehouseOverview = useWarehouseOverview()
  const createWarehouse = useCreateWarehouse()

  const warehouses = useMemo(
    () => (warehouseOverview.data?.warehouses ?? []).filter((warehouse) => warehouse.isActive),
    [warehouseOverview.data],
  )

  // ─── Start from the product's saved definition, once per product ─────────
  const loadedFor = useRef<string | null>(null)
  const { load, reset, setQuantity } = draft
  useEffect(() => {
    const productId = target?.productId ?? null
    if (!productId || definition.isLoading || loadedFor.current === productId) return
    loadedFor.current = productId
    if (definition.data) load(definition.data, primaryCurrency)
    else reset(primaryCurrency)
  }, [target, definition.isLoading, definition.data, load, reset, primaryCurrency])

  useEffect(() => {
    if (initialQuantity && initialQuantity > 0) setQuantity(String(initialQuantity))
  }, [initialQuantity, setQuantity])

  // With exactly one warehouse there is nothing to choose.
  useEffect(() => {
    if (!addToInventory) return
    if (warehouseId && !warehouses.some((warehouse) => warehouse.id === warehouseId)) {
      setWarehouseId(null)
    } else if (!warehouseId && warehouses.length === 1) {
      setWarehouseId(warehouses[0]!.id)
    }
  }, [addToInventory, warehouseId, warehouses])

  const { cost, columns, ctx, currency } = draft
  const currencyName = t(`currency.${currency.toLowerCase()}`, currency)
  const money = useCallback((value: number) => formatNumber(value, locale, 4), [locale])

  const foreignCurrencies = useMemo(() => {
    const set = new Set<CurrencyCode>()
    for (const column of columns) {
      if (isForeignMoneyColumn(column, ctx) && column.currency) set.add(column.currency)
    }
    return [...set]
  }, [columns, ctx])

  const selectedColumn = useMemo(
    () => columns.find((column) => column.id === selectedColumnId) ?? null,
    [columns, selectedColumnId],
  )

  /** The stocked components this run would take off the shelf. */
  const consumed = useMemo(
    () => cost.lines.filter((line) => line.kind === 'component' && line.productId),
    [cost.lines],
  )

  // A component whose buy price moved since the definition was saved.
  const priceDrift = useMemo(() => {
    const current = definition.data?.currentCosts ?? {}
    return cost.lines
      .filter((line) => line.productId && current[line.productId] !== undefined)
      .map((line) => ({
        label: line.label,
        saved: line.unitCost,
        now: current[line.productId as string] as number,
      }))
      .filter((entry) => entry.now > 0 && Math.abs(entry.now - entry.saved) > 0.00005)
  }, [definition.data, cost.lines])

  // ─── Validation: say which field, never just «invalid» ───────────────────
  const validate = useCallback(
    (forRun: boolean): Record<string, string> => {
      const found: Record<string, string> = {}
      if (!target) found.product = t('manufacturing.editor.errors.product', 'محصول را انتخاب کنید.')
      const filled = draft.rows.filter(isRowFilled)
      if (filled.length === 0 && cost.laborCost === 0 && cost.otherCost === 0) {
        found.lines = t(
          'manufacturing.editor.errors.empty',
          'دست‌کم یک قطعه، دستمزد یا هزینه وارد کنید.',
        )
      }
      if (foreignCurrencies.some((code) => !draft.parsedRates[code])) {
        found.rates = t(
          'manufacturing.editor.errors.rate',
          'برای ستونی که ارز دیگری دارد نرخ تبدیل وارد کنید.',
        )
      }
      if (!forRun) return found
      if (!(draft.quantityValue > 0)) {
        found.quantity = t('manufacturing.editor.errors.quantity', 'تعداد باید بیشتر از صفر باشد.')
      }
      if (draft.overrideOn) {
        if (draft.overrideValue === null) {
          found.overrideTotal = t(
            'manufacturing.editor.errors.overrideTotal',
            'جمع دستی را وارد کنید یا این گزینه را خاموش کنید.',
          )
        }
        if (!draft.overrideReason.trim()) {
          found.overrideReason = t(
            'manufacturing.editor.errors.overrideReason',
            'دلیل تغییر جمع را بنویسید.',
          )
        }
      }
      if (addToInventory && warehouses.length > 1 && !warehouseId) {
        found.warehouseId = t('manufacturing.editor.errors.warehouse', 'انبار را انتخاب کنید.')
      }
      return found
    },
    [target, draft, cost, foreignCurrencies, addToInventory, warehouses, warehouseId, t],
  )

  const definitionPayload = useCallback((): SaveProductionDefinition => {
    return {
      productId: (target as ProductionEditorTarget).productId,
      currency,
      columns: columns as unknown as SaveProductionDefinition['columns'],
      rows: draft.rows.filter(isRowFilled).map((row) => ({
        id: row.id,
        ...(row.productId ? { productId: row.productId } : {}),
        values: row.values,
      })),
      rates: draft.parsedRates,
      otherCosts: draft.otherCostInput,
      labor: draft.laborInput,
      ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
      ...(draft.bomId ? { bomId: draft.bomId } : {}),
    }
  }, [target, currency, columns, draft])

  const handleSaveDefinition = useCallback(() => {
    const found = validate(false)
    setErrors(found)
    setServerError(null)
    if (Object.keys(found).length > 0) return
    saveDefinition.mutate(definitionPayload(), {
      onSuccess: (saved) => {
        toast.success(
          saved.revised
            ? t('manufacturing.editor.revised', 'نسخه‌ی تازه‌ی فرمول ذخیره شد.')
            : t('manufacturing.editor.saved', 'فرمول ساخت ذخیره شد.'),
        )
        onDone()
      },
      onError: (error) =>
        setServerError(apiErrorMessage(error, t('manufacturing.editor.saveFailed', 'ذخیره نشد.'))),
    })
  }, [validate, saveDefinition, definitionPayload, toast, t, onDone])

  const handleProduce = useCallback(() => {
    const found = validate(true)
    setErrors(found)
    setServerError(null)
    if (Object.keys(found).length > 0) return

    const input: ProduceInput = {
      ...definitionPayload(),
      ...(workOrderId ? { workOrderId } : {}),
      quantity: draft.quantityValue,
      overrideTotal: draft.overrideValue,
      ...(draft.overrideValue !== null ? { overrideReason: draft.overrideReason.trim() } : {}),
      saveDefinition: true,
      addToInventory,
      consumeComponents: addToInventory && consumeComponents,
      warehouseId: addToInventory ? warehouseId : null,
      idempotencyKey: idempotencyKey.current,
    }
    produce.mutate(input, {
      onSuccess: () => {
        // The next press is a new run.
        idempotencyKey.current = newIdempotencyKey()
        toast.success(
          addToInventory
            ? t('manufacturing.editor.producedToStock', 'تولید ثبت و به انبار اضافه شد.')
            : t('manufacturing.editor.produced', 'تولید ثبت شد.'),
        )
        onDone()
      },
      // The key is KEPT on failure: pressing again retries the same run.
      onError: (error) =>
        setServerError(
          apiErrorMessage(error, t('manufacturing.editor.produceFailed', 'تولید ثبت نشد.')),
        ),
    })
  }, [
    validate,
    definitionPayload,
    workOrderId,
    draft,
    addToInventory,
    consumeComponents,
    warehouseId,
    produce,
    toast,
    t,
    onDone,
  ])

  const busy = saveDefinition.isPending || produce.isPending

  // A code from the server reads as a sentence when the catalogue has one.
  const serverErrorText = serverError ? manufacturingErrorText(t, serverError, serverError) : null

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4 px-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-[hsl(var(--fg-primary))]">
          {mode === 'produce'
            ? t('manufacturing.editor.titleProduce', 'ساخت محصول')
            : t('manufacturing.editor.titleDefinition', 'فرمول ساخت')}
        </h1>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('action.back', 'بازگشت')}
        </Button>
      </div>

      {/* ── What is being made ─────────────────────────────────────────── */}
      <section className={card}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div data-field="productId">
            <span className={fieldLabel}>{t('manufacturing.editor.product', 'محصول')}</span>
            {product ? (
              <p className="flex h-10 items-center text-sm font-medium text-[hsl(var(--fg-primary))]">
                {product.productName}
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <ProductPicker
                    value={
                      target
                        ? { id: target.productId, name: target.productName, sellPrice: 0, unit: '' }
                        : null
                    }
                    onChange={(picked) =>
                      setTarget(picked ? { productId: picked.id, productName: picked.name } : null)
                    }
                    placeholder={t('manufacturing.editor.pickProduct', 'انتخاب محصول')}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddProductOpen(true)}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {t('manufacturing.editor.newProduct', 'محصول جدید')}
                </Button>
              </div>
            )}
            {errors.product ? <p className={problem}>{errors.product}</p> : null}
            {definition.data ? (
              <p className={cn(hint, 'mt-1')}>
                {t('manufacturing.editor.loadedVersion', 'فرمول ذخیره‌شده، نسخه')}{' '}
                {formatNumber(definition.data.version, locale, 0)}
              </p>
            ) : target && !definition.isLoading ? (
              <p className={cn(hint, 'mt-1')}>
                {t('manufacturing.editor.noDefinition', 'برای این محصول هنوز فرمولی ذخیره نشده.')}
              </p>
            ) : null}
          </div>

          <div>
            <span className={fieldLabel}>{t('manufacturing.editor.currency', 'ارز')}</span>
            <SelectField
              name="currency"
              aria-label={t('manufacturing.editor.currency', 'ارز')}
              value={currency}
              onChange={(next) => draft.setCurrency(next as CurrencyCode)}
              options={SUPPORTED_CURRENCIES.map((code) => ({
                value: code,
                label: t(`currency.${code.toLowerCase()}`, code),
              }))}
            />
          </div>

          {mode === 'produce' ? (
            <div>
              <Input
                name="quantity"
                inputMode="decimal"
                label={t('manufacturing.editor.quantity', 'تعداد تولید')}
                value={draft.quantity}
                onChange={(event) => draft.setQuantity(event.target.value)}
                aria-invalid={errors.quantity ? true : undefined}
              />
              {errors.quantity ? <p className={problem}>{errors.quantity}</p> : null}
            </div>
          ) : null}
        </div>

        {foreignCurrencies.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3" data-field="rates">
            {foreignCurrencies.map((code) => (
              <Input
                key={code}
                inputMode="decimal"
                label={`${t('invoiceBuilder.customer.rate', 'نرخ تبدیل')} — 1 ${t(`currency.${code.toLowerCase()}`, code)} (${currencyName})`}
                value={draft.rates[code] ?? ''}
                onChange={(event) => draft.setRate(code, event.target.value)}
              />
            ))}
            {errors.rates ? <p className={cn(problem, 'md:col-span-3')}>{errors.rates}</p> : null}
          </div>
        ) : null}
      </section>

      {/* ── Components: the invoice grid ───────────────────────────────── */}
      <section className={cn(card, 'min-w-0')} data-field="rows">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={sectionTitle}>{t('manufacturing.editor.components', 'قطعات و مواد')}</h2>
          <p className={hint}>
            {t('manufacturing.editor.perUnit', 'همه‌ی مقدارها برای ساخت یک واحد است.')}
          </p>
        </div>

        <GridToolbar
          t={t}
          selectedColumnLabel={
            selectedColumn
              ? selectedColumn.labelKey
                ? t(selectedColumn.labelKey, selectedColumn.label)
                : selectedColumn.label
              : null
          }
          canDeleteSelected={!!selectedColumn && canDeleteColumn(selectedColumn)}
          onAddRow={draft.addRow}
          onAddColumn={() => {
            setEditingColumn(null)
            setColumnDialogOpen(true)
          }}
          onDeleteColumn={() => {
            if (selectedColumn && canDeleteColumn(selectedColumn)) setPendingDelete(selectedColumn)
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          onResetColumns={draft.resetColumns}
        />

        <InvoiceItemsGrid
          t={t}
          locale={locale}
          columns={columns}
          rows={draft.rows}
          ctx={ctx}
          selectedColumnId={selectedColumnId}
          onSelectColumn={setSelectedColumnId}
          onCellChange={draft.setCell}
          onPickProduct={draft.pickProduct}
          onMoveColumn={draft.shiftColumn}
          onRemoveRow={draft.removeRow}
          onDuplicateRow={draft.duplicateRow}
          invalidRowIds={NO_INVALID_ROWS}
          pickAs="component"
        />
        {errors.lines ? <p className={cn(problem, 'mt-2')}>{errors.lines}</p> : null}

        {priceDrift.length > 0 ? (
          <div className="mt-3 rounded-[var(--radius-md)] border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.08)] p-3">
            <p className="text-xs font-medium text-[hsl(var(--fg-primary))]">
              {t(
                'manufacturing.editor.drift',
                'بهای خرید این مواد از زمان ذخیره‌ی فرمول تغییر کرده است. در صورت نیاز بهای واحد را اصلاح کنید:',
              )}
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-[hsl(var(--fg-secondary))]">
              {priceDrift.map((entry) => (
                <li key={`${entry.label}-${entry.now}`}>
                  {entry.label}: {money(entry.saved)} {t('manufacturing.arrow', '←')}{' '}
                  {money(entry.now)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── Other costs ───────────────────────────────────────────────── */}
        <section className={card}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className={sectionTitle}>
              {t('manufacturing.editor.otherCosts', 'هزینه‌های دیگر')}
            </h2>
            <Button type="button" variant="ghost" size="sm" onClick={draft.addOtherCost}>
              <Plus className="size-4" aria-hidden="true" />
              {t('manufacturing.editor.addCost', 'افزودن هزینه')}
            </Button>
          </div>
          {draft.otherCosts.length === 0 ? (
            <p className={hint}>
              {t(
                'manufacturing.editor.otherCostsEmpty',
                'هزینه‌ای مثل بسته‌بندی، حمل یا برق — اختیاری است.',
              )}
            </p>
          ) : (
            <ul className="space-y-2">
              {draft.otherCosts.map((entry) => (
                <li key={entry.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Input
                      aria-label={t('manufacturing.editor.costLabel', 'عنوان هزینه')}
                      placeholder={t('manufacturing.editor.costLabel', 'عنوان هزینه')}
                      value={entry.label}
                      onChange={(event) =>
                        draft.setOtherCost(entry.id, { label: event.target.value })
                      }
                    />
                  </div>
                  <div className="w-36">
                    <MoneyInput
                      aria-label={t('manufacturing.editor.costAmount', 'مبلغ')}
                      placeholder={t('manufacturing.editor.costAmount', 'مبلغ')}
                      value={entry.amount}
                      onChange={(raw) => draft.setOtherCost(entry.id, { amount: raw })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('action.delete', 'حذف')}
                    onClick={() => draft.removeOtherCost(entry.id)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Labour ────────────────────────────────────────────────────── */}
        <section className={card}>
          <h2 className={cn(sectionTitle, 'mb-2')}>
            {t('manufacturing.editor.labor', 'نیروی کار')}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Input
              name="labor.workers"
              inputMode="decimal"
              label={t('manufacturing.editor.workers', 'تعداد نفر')}
              value={draft.labor.workers}
              onChange={(event) => draft.setLaborField('workers', event.target.value)}
            />
            <Input
              name="labor.minutes"
              inputMode="decimal"
              label={t('manufacturing.editor.hours', 'مدت ساخت (ساعت)')}
              value={draft.labor.hours}
              onChange={(event) => draft.setLaborField('hours', event.target.value)}
            />
            <MoneyInput
              name="labor.hourlyRate"
              label={t('manufacturing.editor.hourlyRate', 'دستمزد هر نفر در ساعت')}
              value={draft.labor.hourlyRate}
              onChange={(raw) => draft.setLaborField('hourlyRate', raw)}
            />
            <MoneyInput
              name="labor.cost"
              label={t('manufacturing.editor.laborCost', 'هزینه‌ی دستمزد')}
              placeholder={money(cost.laborCost)}
              value={draft.labor.cost}
              onChange={(raw) => draft.setLaborField('cost', raw)}
            />
          </div>
          <p className={cn(hint, 'mt-2')}>
            {t(
              'manufacturing.editor.laborHint',
              'همه اختیاری است. اگر هزینه‌ی دستمزد را خالی بگذارید از نفر × ساعت × دستمزد حساب می‌شود.',
            )}
          </p>
        </section>
      </div>

      {/* ── The cost, by part ────────────────────────────────────────────── */}
      <section className={card}>
        <h2 className={cn(sectionTitle, 'mb-2')}>
          {t('manufacturing.editor.breakdown', 'بهای تمام‌شده')} ({currencyName})
        </h2>
        <dl className="space-y-1.5 text-sm">
          <Row
            label={t('manufacturing.editor.componentsCost', 'قطعات و مواد')}
            value={money(cost.componentsCost)}
          />
          <Row
            label={t('manufacturing.editor.laborCostRow', 'دستمزد')}
            value={money(cost.laborCost)}
          />
          <Row
            label={t('manufacturing.editor.otherCostRow', 'هزینه‌های دیگر')}
            value={money(cost.otherCost)}
          />
          <Row
            strong
            label={t('manufacturing.editor.unitCost', 'بهای یک واحد')}
            value={money(cost.unitCost)}
          />
          {mode === 'produce' ? (
            <>
              <Row
                label={`${t('manufacturing.editor.calculatedTotal', 'جمع محاسبه‌شده')} (× ${formatNumber(cost.quantity, locale, 4)})`}
                value={money(cost.calculatedTotal)}
              />
              <div className="flex flex-wrap items-center gap-3 border-t border-[hsl(var(--border-default))] pt-3">
                <label className="flex items-center gap-2 text-sm text-[hsl(var(--fg-primary))]">
                  <Switch
                    size="sm"
                    checked={draft.overrideOn}
                    onCheckedChange={draft.setOverrideOn}
                    aria-label={t('manufacturing.editor.override', 'جمع کل را دستی تعیین می‌کنم')}
                  />
                  {t('manufacturing.editor.override', 'جمع کل را دستی تعیین می‌کنم')}
                </label>
              </div>
              {draft.overrideOn ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <MoneyInput
                      name="overrideTotal"
                      label={t('manufacturing.editor.overrideTotal', 'جمع دستی')}
                      value={draft.overrideTotal}
                      onChange={draft.setOverrideTotal}
                    />
                    {errors.overrideTotal ? (
                      <p className={problem}>{errors.overrideTotal}</p>
                    ) : null}
                  </div>
                  <div>
                    <Input
                      name="overrideReason"
                      label={t('manufacturing.editor.overrideReason', 'دلیل تغییر')}
                      value={draft.overrideReason}
                      onChange={(event) => draft.setOverrideReason(event.target.value)}
                    />
                    {errors.overrideReason ? (
                      <p className={problem}>{errors.overrideReason}</p>
                    ) : null}
                  </div>
                  <p className={cn(hint, 'md:col-span-2')}>
                    {t(
                      'manufacturing.editor.overrideHint',
                      'جمع محاسبه‌شده حذف نمی‌شود؛ هر دو عدد همراه نام شما و دلیل ثبت می‌شوند.',
                    )}
                  </p>
                </div>
              ) : null}
              <Row
                strong
                label={t('manufacturing.editor.total', 'جمع کل تولید')}
                value={money(cost.total)}
              />
              <Row
                label={t('manufacturing.editor.effectiveUnitCost', 'بهای هر واحد در انبار')}
                value={money(cost.effectiveUnitCost)}
              />
            </>
          ) : null}
        </dl>
      </section>

      {/* ── Inventory ────────────────────────────────────────────────────── */}
      {mode === 'produce' ? (
        <section className={card}>
          <label className="flex items-center justify-between gap-3">
            <span className={sectionTitle}>
              {t('manufacturing.editor.addToInventory', 'به انبار اضافه شود؟')}
            </span>
            <Switch
              checked={addToInventory}
              onCheckedChange={setAddToInventory}
              aria-label={t('manufacturing.editor.addToInventory', 'به انبار اضافه شود؟')}
            />
          </label>

          {!addToInventory ? (
            <p className={cn(hint, 'mt-2')}>
              {t(
                'manufacturing.editor.inventoryOff',
                'خاموش: فقط بهای ساخت ثبت می‌شود و موجودی هیچ کالایی تغییر نمی‌کند.',
              )}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <div data-field="warehouseId">
                <span className={fieldLabel}>{t('manufacturing.editor.warehouse', 'انبار')}</span>
                <div className="flex flex-wrap items-center gap-2">
                  {warehouses.length > 0 ? (
                    <div className="min-w-48">
                      <SelectField
                        name="warehouseId"
                        aria-label={t('manufacturing.editor.warehouse', 'انبار')}
                        value={warehouseId ?? ''}
                        onChange={(next) => setWarehouseId(next || null)}
                        placeholder={t('manufacturing.editor.pickWarehouse', 'انتخاب انبار')}
                        options={warehouses.map((warehouse) => ({
                          value: warehouse.id,
                          label: warehouse.name,
                        }))}
                      />
                    </div>
                  ) : (
                    <p className={hint}>
                      {t(
                        'manufacturing.editor.noWarehouse',
                        'هنوز انباری ندارید؛ کالا به موجودی کل اضافه می‌شود. می‌توانید همین حالا یک انبار بسازید.',
                      )}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAddWarehouseOpen(true)}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    {t('manufacturing.editor.newWarehouse', 'انبار جدید')}
                  </Button>
                </div>
                {errors.warehouseId ? <p className={problem}>{errors.warehouseId}</p> : null}
              </div>

              <label className="flex items-center gap-2 text-sm text-[hsl(var(--fg-primary))]">
                <Switch
                  size="sm"
                  checked={consumeComponents}
                  onCheckedChange={setConsumeComponents}
                  aria-label={t('manufacturing.editor.consume', 'مواد اولیه از همین انبار کم شود')}
                />
                {t('manufacturing.editor.consume', 'مواد اولیه از همین انبار کم شود')}
              </label>

              {/* What pressing «ثبت» will do to stock, before it is pressed. */}
              <div className="rounded-[var(--radius-md)] bg-[hsl(var(--surface-muted))] p-3 text-xs text-[hsl(var(--fg-secondary))]">
                <p className="mb-1 font-medium text-[hsl(var(--fg-primary))]">
                  {t('manufacturing.editor.stockPreview', 'با ثبت، موجودی این‌طور تغییر می‌کند:')}
                </p>
                <ul className="space-y-0.5">
                  <li>
                    + {formatNumber(cost.quantity, locale, 4)} {target?.productName ?? ''} —{' '}
                    {t('manufacturing.editor.atCost', 'هر واحد به بهای')}{' '}
                    {money(cost.effectiveUnitCost)}
                  </li>
                  {consumeComponents
                    ? consumed.map((line) => (
                        <li key={`${line.position}-${line.productId}`}>
                          − {formatNumber(line.quantity * cost.quantity, locale, 4)} {line.label}
                        </li>
                      ))
                    : null}
                </ul>
                {consumeComponents && consumed.length === 0 ? (
                  <p className="mt-1">
                    {t(
                      'manufacturing.editor.nothingToConsume',
                      'هیچ‌کدام از قطعات از فهرست کالاها انتخاب نشده، پس چیزی از انبار کم نمی‌شود.',
                    )}
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </section>
      ) : null}

      {serverErrorText ? (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-[hsl(var(--color-destructive)/0.3)] bg-[hsl(var(--color-destructive)/0.05)] p-3 text-sm text-[hsl(var(--color-destructive))]"
        >
          {serverErrorText}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          {t('action.cancel', 'انصراف')}
        </Button>
        <Button
          type="button"
          variant={mode === 'definition' ? 'default' : 'secondary'}
          onClick={handleSaveDefinition}
          loading={saveDefinition.isPending}
          disabled={busy}
        >
          {t('manufacturing.editor.saveDefinition', 'ذخیره‌ی فرمول')}
        </Button>
        {mode === 'produce' ? (
          <Button type="button" onClick={handleProduce} loading={produce.isPending} disabled={busy}>
            {addToInventory
              ? t('manufacturing.editor.produceToStock', 'ثبت تولید و افزودن به انبار')
              : t('manufacturing.editor.produce', 'ثبت تولید')}
          </Button>
        ) : null}
      </div>

      {/* ── Dialogs: the invoice's own, and the warehouse's own ──────────── */}
      <ColumnDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        t={t}
        column={editingColumn}
        existingColumns={columns}
        invoiceCurrency={currency}
        onSubmit={(column) =>
          editingColumn ? draft.replaceColumn(column) : draft.addColumn(column)
        }
      />

      <TableSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        t={t}
        columns={columns}
        onToggleVisible={(id, visible) => draft.updateColumn(id, { visible })}
        onToggleAggregate={(id, aggregate) => draft.updateColumn(id, { aggregate })}
        onToggleIncludeInTotal={(id, includeInTotal) => draft.updateColumn(id, { includeInTotal })}
        onMove={draft.shiftColumn}
        onEdit={(column) => {
          setEditingColumn(column)
          setColumnDialogOpen(true)
        }}
        onDelete={(column) => {
          if (canDeleteColumn(column)) setPendingDelete(column)
        }}
        onReset={draft.resetColumns}
      />

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('manufacturing.editor.deleteColumn', 'این ستون حذف شود؟')}{' '}
              {pendingDelete
                ? pendingDelete.labelKey
                  ? t(pendingDelete.labelKey, pendingDelete.label)
                  : pendingDelete.label
                : ''}
            </DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
              {t('action.cancel', 'انصراف')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!pendingDelete) return
                draft.removeColumn(pendingDelete.id)
                if (selectedColumnId === pendingDelete.id) setSelectedColumnId(null)
                setPendingDelete(null)
              }}
            >
              {t('action.delete', 'حذف')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddWarehouseDialog
        t={t}
        open={addWarehouseOpen}
        onClose={() => setAddWarehouseOpen(false)}
        isPending={createWarehouse.isPending}
        onCreate={async (input) => {
          // Back in the form with the new warehouse already chosen.
          const created = (await createWarehouse.mutateAsync(input)) as { id?: string } | null
          if (created?.id) setWarehouseId(created.id)
          return created
        }}
      />

      <AddProductModal open={addProductOpen} onClose={() => setAddProductOpen(false)} />
    </div>
  )
}

const NO_INVALID_ROWS: ReadonlySet<string> = new Set()

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3',
        strong && 'border-t border-[hsl(var(--border-default))] pt-2 font-semibold',
      )}
    >
      <dt className={strong ? 'text-[hsl(var(--fg-primary))]' : 'text-[hsl(var(--fg-secondary))]'}>
        {label}
      </dt>
      <dd className="tabular-nums text-[hsl(var(--fg-primary))]">{value}</dd>
    </div>
  )
}
