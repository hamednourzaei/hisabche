// ============================================
// تنظیمات جدول — visibility, order and per-column totals in one place.
//
// Consolidated deliberately: before this, column visibility lived in a
// different menu from column totals, and users had to know which. Everything
// that shapes the grid is here, and the toolbar's «حذف ستون» is the only
// column action that lives outside it (because it needs a selection).
// ============================================
'use client'

import { memo } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react'
import { canAggregate, canDeleteColumn, type InvoiceColumn } from '@hisabche/validation'

import { Button } from '../button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../dialog'
import { Switch } from '../switch'
import { cn } from '../../../lib/utils'

export interface TableSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  t: (key: string, fallback?: string) => string
  columns: readonly InvoiceColumn[]
  onToggleVisible: (id: string, visible: boolean) => void
  onToggleAggregate: (id: string, aggregate: boolean) => void
  onMove: (id: string, direction: -1 | 1) => void
  onEdit: (column: InvoiceColumn) => void
  onDelete: (column: InvoiceColumn) => void
  onReset: () => void
}

export const TableSettingsDialog = memo(function TableSettingsDialog({
  open,
  onOpenChange,
  t,
  columns,
  onToggleVisible,
  onToggleAggregate,
  onMove,
  onEdit,
  onDelete,
  onReset,
}: TableSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('invoiceBuilder.settings.title', 'تنظیمات جدول')}</DialogTitle>
          <DialogDescription>
            {t(
              'invoiceBuilder.settings.description',
              'ترتیب، نمایش و جمع هر ستون را تعیین کنید. همین ترتیب در پیش‌نمایش فاکتور دیده می‌شود.',
            )}
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto pe-1">
          {columns.map((column, index) => (
            <li
              key={column.id}
              className={cn(
                'flex items-center gap-2 rounded-[var(--radius-md)] border px-2.5 py-2',
                'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]',
              )}
            >
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => onMove(column.id, -1)}
                  disabled={index === 0}
                  aria-label={t('invoiceBuilder.settings.moveUp', 'انتقال به بالا')}
                  className="rounded p-0.5 text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))] disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(column.id, 1)}
                  disabled={index === columns.length - 1}
                  aria-label={t('invoiceBuilder.settings.moveDown', 'انتقال به پایین')}
                  className="rounded p-0.5 text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))] disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" aria-hidden="true" />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[hsl(var(--fg-primary))]">
                  {column.labelKey ? t(column.labelKey, column.label) : column.label}
                </p>
                <p className="text-[11px] text-[hsl(var(--fg-tertiary))]">
                  {t(`invoiceBuilder.columnType.${column.type}`, column.type)}
                  {column.currency
                    ? ` · ${t(`currency.${(column.currency ?? '').toLowerCase()}`, column.currency)}`
                    : ''}
                </p>
              </div>

              {canAggregate(column.type) ? (
                <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-[hsl(var(--fg-secondary))]">
                  <span className="hidden sm:inline">
                    {t('invoiceBuilder.settings.sum', 'جمع')}
                  </span>
                  <Switch
                    checked={column.aggregate}
                    onCheckedChange={(v) => onToggleAggregate(column.id, v)}
                    aria-label={t('invoiceBuilder.settings.sum', 'جمع')}
                  />
                </label>
              ) : null}

              <button
                type="button"
                onClick={() => onToggleVisible(column.id, !column.visible)}
                aria-label={
                  column.visible
                    ? t('invoiceBuilder.settings.hide', 'مخفی کردن ستون')
                    : t('invoiceBuilder.settings.show', 'نمایش ستون')
                }
                className="shrink-0 rounded p-1.5 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
              >
                {column.visible ? (
                  <Eye className="size-4" aria-hidden="true" />
                ) : (
                  <EyeOff className="size-4" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onEdit(column)}
                aria-label={t('common.edit', 'ویرایش')}
                className="shrink-0 rounded p-1.5 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => onDelete(column)}
                disabled={!canDeleteColumn(column)}
                aria-label={t('invoiceBuilder.toolbar.deleteColumn', 'حذف ستون')}
                title={
                  canDeleteColumn(column)
                    ? undefined
                    : t('invoiceBuilder.settings.systemColumn', 'ستون سیستمی — قابل حذف نیست')
                }
                className="shrink-0 rounded p-1.5 text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--color-destructive)/0.1)] hover:text-[hsl(var(--color-destructive))] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[hsl(var(--fg-tertiary))]"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={onReset}>
            {t('invoiceBuilder.toolbar.resetColumns', 'بازگردانی ستون‌های پیش‌فرض')}
          </Button>
          <Button onClick={() => onOpenChange(false)}>{t('common.done', 'تمام')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

TableSettingsDialog.displayName = 'TableSettingsDialog'
