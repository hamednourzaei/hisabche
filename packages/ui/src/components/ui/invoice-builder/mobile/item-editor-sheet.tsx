// ============================================
// Editing one invoice line, on a phone.
//
// A bottom sheet with full-width fields, not a row of 24px cells. Every
// configured column gets a real labelled input at a real size; the four
// primary roles come first and the rest follow under a heading, so a
// fourteen-column layout is a scroll rather than a puzzle.
//
// Writes go straight through to the draft store, cell by cell — the same
// `onCellChange` the desktop grid calls. There is no local copy of the row and
// no "apply" step, so the summary and the sticky total move as you type and
// the two presentations can never disagree.
// ============================================
'use client'

import { memo } from 'react'
import {
  COLUMN,
  rowTotal,
  visibleColumns,
  type GridMoneyContext,
  type InvoiceColumn,
  type InvoiceGridRow,
} from '@hisabche/validation'
import { formatNumber } from '@hisabche/formatting'

import { Button } from '../../button'
import { Input } from '../../input'
import { JalaliDatePicker } from '../../jalali-datepicker'
import { NumberStepper } from '../../number-stepper'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../sheet'
import { Switch } from '../../switch'
import { cn } from '../../../../lib/utils'
import { UNIT_CHOICES } from '../grid/grid-cell'
import { ProductSearchSheet } from './product-search-sheet'

export interface ItemEditorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  t: (key: string, fallback?: string) => string
  locale: string
  row: InvoiceGridRow | null
  columns: readonly InvoiceColumn[]
  ctx: GridMoneyContext
  onCellChange: (rowId: string, columnId: string, value: string) => void
  onPickProduct: (
    rowId: string,
    product: { id: string; name: string; price: string; unit: string },
  ) => void
}

const PRIMARY_IDS: readonly string[] = [
  COLUMN.description,
  COLUMN.quantity,
  COLUMN.unit,
  COLUMN.unitPrice,
]

const fieldShell = cn(
  'flex h-12 items-center rounded-[var(--radius-md)] border px-3',
  'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]',
  'focus-within:border-[hsl(var(--color-primary))]',
  'transition-colors duration-150 motion-reduce:transition-none',
)

export const ItemEditorSheet = memo(function ItemEditorSheet({
  open,
  onOpenChange,
  t,
  locale,
  row,
  columns,
  ctx,
  onCellChange,
  onPickProduct,
}: ItemEditorSheetProps) {
  if (!row) return null

  const shown = visibleColumns(columns)
  const primary = shown.filter((c) => PRIMARY_IDS.includes(c.id))
  const secondary = shown.filter((c) => !PRIMARY_IDS.includes(c.id) && c.type !== 'computed')

  const label = (column: InvoiceColumn) =>
    column.labelKey ? t(column.labelKey, column.label) : column.label

  const field = (column: InvoiceColumn) => {
    const value = row.values[column.id] ?? ''
    const set = (next: string) => onCellChange(row.id, column.id, next)
    const id = `item-field-${column.id}`

    if (column.id === COLUMN.description) {
      return (
        <ProductSearchSheet
          t={t}
          locale={locale}
          value={value}
          onChangeText={set}
          onPick={(product) => onPickProduct(row.id, product)}
        />
      )
    }

    if (column.type === 'boolean') {
      return (
        <div className={cn(fieldShell, 'justify-between')}>
          <span className="text-sm text-[hsl(var(--fg-secondary))]">{label(column)}</span>
          <Switch
            checked={value === 'true'}
            onCheckedChange={(v) => set(v ? 'true' : '')}
            aria-label={label(column)}
          />
        </div>
      )
    }

    if (column.type === 'date') {
      return <JalaliDatePicker value={value} onChange={set} />
    }

    if (column.type === 'select') {
      const options =
        column.id === COLUMN.unit
          ? UNIT_CHOICES.map((u) => ({ value: u, label: t(`unit.${u}`, u) }))
          : (column.options ?? []).map((o) => ({ value: o, label: o }))

      return (
        <Select {...(value ? { value } : {})} onValueChange={set}>
          <SelectTrigger id={id} aria-label={label(column)}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    if (
      column.type === 'integer' ||
      column.type === 'decimal' ||
      column.type === 'currency' ||
      column.type === 'percent'
    ) {
      return (
        <NumberStepper
          id={id}
          value={value}
          onValueChange={set}
          step={column.type === 'currency' ? 1000 : 1}
          min={0}
          {...(column.type === 'percent' ? { max: 100 } : {})}
          precision={column.precision}
          groupThousands={column.type === 'currency'}
          {...(column.suffix ? { suffix: column.suffix } : {})}
          aria-label={label(column)}
          className={fieldShell}
          inputClassName="text-base tabular-nums"
        />
      )
    }

    return (
      <Input
        id={id}
        value={value}
        onChange={(e) => set(e.target.value)}
        aria-label={label(column)}
        className="h-12 text-base"
      />
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-[var(--radius-lg)] p-0"
      >
        {/* The grab affordance a bottom sheet is expected to have. */}
        <div className="sticky top-0 z-10 bg-[hsl(var(--surface-elevated))] pb-2 pt-2">
          <div
            aria-hidden="true"
            className="mx-auto mb-2 h-1 w-10 rounded-full bg-[hsl(var(--border-strong,var(--border-default)))]"
          />
          <SheetHeader className="px-4">
            <SheetTitle>{t('invoiceBuilder.mobile.editItem', 'ویرایش قلم')}</SheetTitle>
          </SheetHeader>
        </div>

        <div className="space-y-4 px-4 pb-4">
          {primary.map((column) => (
            <div key={column.id}>
              {column.type === 'boolean' ? null : (
                <label
                  htmlFor={`item-field-${column.id}`}
                  className="mb-1.5 block text-sm font-medium text-[hsl(var(--fg-secondary))]"
                >
                  {label(column)}
                </label>
              )}
              {field(column)}
            </div>
          ))}

          {secondary.length ? (
            <div className="space-y-4 border-t border-[hsl(var(--border-default))] pt-4">
              <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
                {t('invoiceBuilder.mobile.otherFields', 'سایر اطلاعات')}
              </h3>
              {secondary.map((column) => (
                <div key={column.id}>
                  {column.type === 'boolean' ? null : (
                    <label
                      htmlFor={`item-field-${column.id}`}
                      className="mb-1.5 block text-sm font-medium text-[hsl(var(--fg-secondary))]"
                    >
                      {label(column)}
                    </label>
                  )}
                  {field(column)}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* The running line total, pinned where the thumb already is. */}
        <div className="sticky bottom-0 border-t border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-[hsl(var(--fg-secondary))]">
              {t('invoiceBuilder.columns.lineTotal', 'مبلغ کل')}
            </span>
            <span
              dir="ltr"
              className="text-lg font-bold tabular-nums text-[hsl(var(--fg-primary))]"
            >
              {formatNumber(rowTotal(row, columns, ctx), locale, ctx.precision)}
            </span>
          </div>
          <Button onClick={() => onOpenChange(false)} fullWidth className="h-12">
            {t('common.done', 'تمام')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
})

ItemEditorSheet.displayName = 'ItemEditorSheet'
