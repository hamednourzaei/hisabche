// ============================================
// TableToolbar — the strip that sits directly on top of a table.
//
// The search field is collapsed to a single 🔍 button; clicking it expands the
// input. Next to it sit the column-settings menu and any page-specific actions
// (export), so every table exposes the same controls in the same place.
// ============================================

'use client'

import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Search, Settings2, X } from 'lucide-react'

import { cn } from '../../../lib/utils'
import { FOCUS_RING } from '../focus-ring'
import type { TableColumn } from './table-types'

export interface TableToolbarProps<T> {
  t: (key: string, fallback?: string) => string
  columns: readonly TableColumn<T>[]
  hiddenIds: readonly string[]
  onToggleColumn: (id: string) => void
  /** Omit both to show no search control (a page whose filter is elsewhere). */
  searchValue?: string | undefined
  onSearchChange?: ((value: string) => void) | undefined
  /** Export buttons and other page-specific controls. */
  actions?: ReactNode
}

function TableToolbarInner<T>({
  t,
  columns,
  hiddenIds,
  onToggleColumn,
  searchValue,
  onSearchChange,
  actions,
}: TableToolbarProps<T>) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  // Dismiss the column menu on any outside click.
  useEffect(() => {
    if (!menuOpen) return

    function onPointerDown(event: MouseEvent): void {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [menuOpen])

  const hasSearch = onSearchChange !== undefined

  const closeSearch = useCallback(() => {
    onSearchChange?.('')
    setSearchOpen(false)
  }, [onSearchChange])

  return (
    <div className="flex items-center justify-end gap-1.5 pb-2">
      {!hasSearch ? null : searchOpen ? (
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[hsl(var(--fg-tertiary))]"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            value={searchValue ?? ''}
            placeholder={t('action.search', 'جستجو')}
            onChange={(event) => onSearchChange?.(event.target.value)}
            onKeyDown={(event) => event.key === 'Escape' && closeSearch()}
            className={cn(
              'h-10 w-full rounded-xl ps-9 pe-9 text-base sm:h-9 sm:text-sm',
              'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))]',
              'text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))]',
              'focus:border-[hsl(var(--color-primary)/0.5)] focus:outline-none',
            )}
          />
          <button
            type="button"
            onClick={closeSearch}
            aria-label={t('action.clear', 'پاک کردن')}
            className="absolute end-2 top-1/2 -translate-y-1/2 text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-primary))]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <ToolbarButton
          label={t('action.search', 'جستجو')}
          onClick={() => setSearchOpen(true)}
          icon={<Search className="size-4" aria-hidden="true" />}
        />
      )}

      <div className="relative" ref={menuRef}>
        <ToolbarButton
          label={t('table.columns', 'تنظیمات جدول')}
          onClick={() => setMenuOpen((current) => !current)}
          icon={<Settings2 className="size-4" aria-hidden="true" />}
          active={menuOpen}
        />

        {menuOpen && (
          <div
            role="menu"
            className={cn(
              'absolute end-0 z-30 mt-1.5 flex w-56 flex-col gap-0.5 rounded-xl p-1.5',
              'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-xl',
            )}
          >
            <span className="px-2 py-1 text-[11px] font-semibold text-[hsl(var(--fg-tertiary))]">
              {t('table.columns', 'تنظیمات جدول')}
            </span>

            {columns.map((column) => (
              <label
                key={column.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
                  'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
                  column.locked && 'cursor-not-allowed opacity-50',
                )}
              >
                <input
                  type="checkbox"
                  disabled={column.locked}
                  checked={column.locked || !hiddenIds.includes(column.id)}
                  onChange={() => onToggleColumn(column.id)}
                  className="size-4 accent-[hsl(var(--color-primary))]"
                />
                <span className="truncate">{t(column.labelKey, column.labelFallback)}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {actions}
    </div>
  )
}

const ToolbarButton = memo(function ToolbarButton({
  label,
  icon,
  onClick,
  active = false,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-xl',
        'border border-[hsl(var(--border-default))]',
        'text-[hsl(var(--fg-secondary))]',
        'hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
        FOCUS_RING,
        'transition-colors duration-150 motion-reduce:transition-none',
        active && 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-primary))]',
      )}
    >
      {icon}
    </button>
  )
})

export const TableToolbar = memo(TableToolbarInner) as typeof TableToolbarInner
