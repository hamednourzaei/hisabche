// ============================================
// مدیریت ستون‌ها — column management, on a phone.
//
// The desktop affordance for this is a header you select plus a settings
// dialog. Neither survives a thumb, so on mobile the whole thing collapses to
// one sheet reached from the section's ⋮ menu: what is shown, in what order,
// what totals, and «افزودن ستون سفارشی».
//
// It edits the SAME column configuration the desktop dialog edits — this is a
// second presentation, never a second model. A column added here is a column
// the desktop grid and the printed preview both render.
// ============================================
'use client'

import { memo } from 'react'
import { ArrowDown, ArrowUp, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  canAggregate,
  canDeleteColumn,
  columnCountsInTotal,
  type InvoiceColumn,
} from '@hisabche/validation'

import { Button } from '../../button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../sheet'
import { Switch } from '../../switch'
import { cn } from '../../../../lib/utils'

export interface ColumnsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  t: (key: string, fallback?: string) => string
  columns: readonly InvoiceColumn[]
  onToggleVisible: (id: string, visible: boolean) => void
  onToggleAggregate: (id: string, aggregate: boolean) => void
  /**
   * «در جمع کل حساب شود؟» (T8) — distinct from the footer sum above.
   *
   * `aggregate` shows a total for the column in the footer row; this decides
   * whether the column is part of what the CUSTOMER PAYS. A weight column
   * wants the first and must never have the second.
   */
  onToggleIncludeInTotal: (id: string, includeInTotal: boolean) => void
  onMove: (id: string, direction: -1 | 1) => void
  onEdit: (column: InvoiceColumn) => void
  onDelete: (column: InvoiceColumn) => void
  onAdd: () => void
}

/** 44px minimum on every control in the list. */
const iconButton = cn(
  'inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)]',
  'text-[hsl(var(--fg-tertiary))]',
  'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
  'disabled:opacity-25 disabled:hover:bg-transparent',
  'transition-colors duration-150 motion-reduce:transition-none',
)

export const ColumnsSheet = memo(function ColumnsSheet({
  open,
  onOpenChange,
  t,
  columns,
  onToggleVisible,
  onToggleAggregate,
  onToggleIncludeInTotal,
  onMove,
  onEdit,
  onDelete,
  onAdd,
}: ColumnsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[88vh] flex-col rounded-t-[var(--radius-lg)] p-0"
      >
        <div className="border-b border-[hsl(var(--border-default))] px-4 pb-3 pt-2">
          <div
            aria-hidden="true"
            className="mx-auto mb-2 h-1 w-10 rounded-full bg-[hsl(var(--border-strong,var(--border-default)))]"
          />
          <SheetHeader>
            <SheetTitle>{t('invoiceBuilder.mobile.manageColumns', 'مدیریت ستون‌ها')}</SheetTitle>
          </SheetHeader>
        </div>

        <ul className="min-h-0 flex-1 divide-y divide-[hsl(var(--border-default))] overflow-y-auto">
          {columns.map((column, index) => {
            const deletable = canDeleteColumn(column)
            const name = column.labelKey ? t(column.labelKey, column.label) : column.label

            return (
              <li key={column.id} className="flex items-center gap-1 px-2 py-1">
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    onClick={() => onMove(column.id, -1)}
                    disabled={index === 0}
                    aria-label={t('invoiceBuilder.settings.moveUp', 'انتقال به بالا')}
                    className={cn(iconButton, 'size-8')}
                  >
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(column.id, 1)}
                    disabled={index === columns.length - 1}
                    aria-label={t('invoiceBuilder.settings.moveDown', 'انتقال به پایین')}
                    className={cn(iconButton, 'size-8')}
                  >
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="min-w-0 flex-1 py-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-[hsl(var(--fg-primary))]">
                    {name}
                    {deletable ? null : (
                      <Lock
                        className="size-3 shrink-0 text-[hsl(var(--fg-tertiary))]"
                        aria-label={t(
                          'invoiceBuilder.settings.systemColumn',
                          'ستون سیستمی — قابل حذف نیست',
                        )}
                      />
                    )}
                  </p>
                  <p className="truncate text-[11px] text-[hsl(var(--fg-tertiary))]">
                    {column.typeLabel ?? t(`invoiceBuilder.columnType.${column.type}`, column.type)}
                    {column.currency
                      ? ` · ${t(`currency.${column.currency.toLowerCase()}`, column.currency)}`
                      : ''}
                  </p>

                  {column.type === 'currency' || column.type === 'percent' ? (
                    <label className="mt-1 flex items-center gap-2 text-[11px] text-[hsl(var(--fg-secondary))]">
                      <Switch
                        // Read through the compatibility rule, not as
                        // `column.includeInTotal ?? false`: a column saved
                        // before T8 has no flag, and «no flag» means «what it
                        // did before» — true for money, false for percent.
                        checked={columnCountsInTotal(column)}
                        onCheckedChange={(v) => onToggleIncludeInTotal(column.id, v)}
                        aria-label={`${t('invoiceBuilder.settings.inTotal', 'در جمع کل')} — ${name}`}
                      />
                      {t('invoiceBuilder.column.includeInTotal', 'در جمع کل حساب شود')}
                    </label>
                  ) : null}

                  {canAggregate(column.type) ? (
                    <label className="mt-1 flex items-center gap-2 text-[11px] text-[hsl(var(--fg-secondary))]">
                      <Switch
                        checked={column.aggregate}
                        onCheckedChange={(v) => onToggleAggregate(column.id, v)}
                        aria-label={`${t('invoiceBuilder.settings.sum', 'جمع')} — ${name}`}
                      />
                      {t('invoiceBuilder.column.aggregate', 'محاسبه جمع ستون')}
                    </label>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => onEdit(column)}
                  aria-label={`${t('common.edit', 'ویرایش')} — ${name}`}
                  className={iconButton}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => onDelete(column)}
                  disabled={!deletable}
                  aria-label={`${t('invoiceBuilder.toolbar.deleteColumn', 'حذف ستون')} — ${name}`}
                  className={cn(
                    iconButton,
                    'hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))]',
                  )}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>

                {/* The visibility switch is the primary decision, so it sits
                    last where the thumb naturally lands. */}
                <Switch
                  checked={column.visible}
                  onCheckedChange={(v) => onToggleVisible(column.id, v)}
                  aria-label={`${t('invoiceBuilder.settings.show', 'نمایش ستون')} — ${name}`}
                  className="ms-1 shrink-0"
                />
              </li>
            )
          })}
        </ul>

        <div className="border-t border-[hsl(var(--border-default))] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" onClick={onAdd} fullWidth className="h-12 gap-2">
            <Plus className="size-4" aria-hidden="true" />
            {t('invoiceBuilder.mobile.addCustomColumn', 'افزودن ستون سفارشی')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
})

ColumnsSheet.displayName = 'ColumnsSheet'
