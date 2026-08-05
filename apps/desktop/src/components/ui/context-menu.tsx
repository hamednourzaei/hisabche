// ============================================
// Context menu — opened from a right-click on a table row.
// ============================================

import React, { useCallback, useEffect, useState, type ReactNode } from 'react'

export interface ContextMenuState<T> {
  row: T
  x: number
  y: number
}

export interface ContextMenuItem<T> {
  key: string
  label: string
  icon?: ReactNode
  destructive?: boolean
  onSelect: (row: T) => void
}

export interface ContextMenuProps<T> {
  state: ContextMenuState<T> | null
  onClose: () => void
  items: readonly ContextMenuItem<T>[]
}

export function useContextMenu<T>() {
  const [state, setState] = useState<ContextMenuState<T> | null>(null)

  const open = useCallback((row: T, position: { x: number; y: number }) => {
    setState({ row, x: position.x, y: position.y })
  }, [])

  return { state, open, close: useCallback(() => setState(null), []) }
}

export function ContextMenu<T>({ state, onClose, items }: ContextMenuProps<T>) {
  useEffect(() => {
    if (!state) return

    const dismiss = () => onClose()
    window.addEventListener('click', dismiss)
    window.addEventListener('resize', dismiss)
    return () => {
      window.removeEventListener('click', dismiss)
      window.removeEventListener('resize', dismiss)
    }
  }, [onClose, state])

  if (!state) return null

  return (
    <div
      role="menu"
      style={{ top: state.y, left: state.x }}
      className="fixed z-[var(--z-popover)] min-w-44 rounded-[var(--radius-sm)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-1 shadow-xl"
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose()
            item.onSelect(state.row)
          }}
          className="flex h-8 w-full items-center gap-2 rounded-[var(--radius-xs)] px-2 text-start text-sm text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}
