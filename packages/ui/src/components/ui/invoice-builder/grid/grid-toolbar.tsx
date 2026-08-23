// ============================================
// The spreadsheet toolbar that sits directly above the invoice grid.
//
// Every action stays reachable at every width. On a phone the labels collapse
// to icons and the secondary actions move into a menu — but nothing is
// removed, because «افزودن ستون» on a phone is the same need it is on a
// desktop.
// ============================================
'use client'

import { memo } from 'react'
import { Columns3, MoreVertical, Plus, RotateCcw, Settings2, Trash2 } from 'lucide-react'

import { Button } from '../../button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../dropdown-menu'
import { cn } from '../../../../lib/utils'

export interface GridToolbarProps {
  t: (key: string, fallback?: string) => string
  /** Header of the column the user has selected, if any. */
  selectedColumnLabel: string | null
  /** False when the selection is a system column, or nothing is selected. */
  canDeleteSelected: boolean
  onAddRow: () => void
  onAddColumn: () => void
  onDeleteColumn: () => void
  onOpenSettings: () => void
  onResetColumns: () => void
}

export const GridToolbar = memo(function GridToolbar({
  t,
  selectedColumnLabel,
  canDeleteSelected,
  onAddRow,
  onAddColumn,
  onDeleteColumn,
  onOpenSettings,
  onResetColumns,
}: GridToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[hsl(var(--border-default))] px-3 py-2.5">
      <Button size="sm" variant="secondary" onClick={onAddRow} className="gap-1.5">
        <Plus className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">
          {t('invoiceBuilder.toolbar.addRow', 'افزودن ردیف')}
        </span>
        <span className="sm:hidden">{t('invoiceBuilder.toolbar.rowShort', 'ردیف')}</span>
      </Button>

      <Button size="sm" variant="secondary" onClick={onAddColumn} className="gap-1.5">
        <Columns3 className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">
          {t('invoiceBuilder.toolbar.addColumn', 'افزودن ستون')}
        </span>
        <span className="sm:hidden">{t('invoiceBuilder.toolbar.columnShort', 'ستون')}</span>
      </Button>

      {/* Delete-column stays visible on desktop and tablet; on a phone it
          lives in the menu below so the two primary actions keep their room. */}
      <Button
        size="sm"
        variant="outline"
        onClick={onDeleteColumn}
        disabled={!canDeleteSelected}
        className="hidden gap-1.5 sm:inline-flex"
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {t('invoiceBuilder.toolbar.deleteColumn', 'حذف ستون')}
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={onOpenSettings}
        className="hidden gap-1.5 md:inline-flex"
      >
        <Settings2 className="size-4" aria-hidden="true" />
        {t('invoiceBuilder.toolbar.settings', 'تنظیمات جدول')}
      </Button>

      <DropdownMenu>
        {/* A bare <button>, not the Button component: Radix's Slot clones a
            single element, and passing a component that renders conditional
            children through it is how the toolbar crashed the first time. */}
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('invoiceBuilder.toolbar.columnOps', 'عملیات ستون‌ها')}
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-[var(--radius-md)] md:hidden',
              'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
              'hover:text-[hsl(var(--fg-primary))]',
              'transition-colors duration-150 motion-reduce:transition-none',
            )}
          >
            <MoreVertical className="size-4" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onDeleteColumn} disabled={!canDeleteSelected}>
            <Trash2 className="size-4" aria-hidden="true" />
            {t('invoiceBuilder.toolbar.deleteColumn', 'حذف ستون')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenSettings}>
            <Settings2 className="size-4" aria-hidden="true" />
            {t('invoiceBuilder.toolbar.settings', 'تنظیمات جدول')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onResetColumns}>
            <RotateCcw className="size-4" aria-hidden="true" />
            {t('invoiceBuilder.toolbar.resetColumns', 'بازگردانی ستون‌های پیش‌فرض')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ms-auto min-w-0">
        <p
          className={cn(
            'truncate text-xs',
            selectedColumnLabel
              ? 'text-[hsl(var(--fg-secondary))]'
              : 'text-[hsl(var(--fg-tertiary))]',
          )}
        >
          {selectedColumnLabel
            ? t('invoiceBuilder.toolbar.selected', 'ستون انتخاب‌شده:') + ` ${selectedColumnLabel}`
            : t(
                'invoiceBuilder.toolbar.selectHint',
                'برای حذف یا ویرایش، عنوان ستون را انتخاب کنید',
              )}
        </p>
      </div>
    </div>
  )
})

GridToolbar.displayName = 'GridToolbar'
