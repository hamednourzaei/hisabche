// ============================================
// Global keyboard shortcuts.
//
// Handlers are registered in a ref-backed map so a re-render never detaches
// the window listener. Shortcuts are suppressed while the user is typing,
// except for the ones that must always work (save, command palette).
// ============================================

import { useEffect, useRef } from 'react'

export type ShortcutId = 'newInvoice' | 'save' | 'search' | 'print' | 'commandPalette' | 'close'

interface Binding {
  key: string
  ctrl: boolean
  shift?: boolean
  /** Fires even when focus is inside an input. */
  allowInField?: boolean
}

export const SHORTCUTS: Record<ShortcutId, Binding> = {
  newInvoice: { key: 'n', ctrl: true },
  save: { key: 's', ctrl: true, allowInField: true },
  search: { key: 'f', ctrl: true },
  print: { key: 'p', ctrl: true },
  commandPalette: { key: 'k', ctrl: true, allowInField: true },
  close: { key: 'Escape', ctrl: false, allowInField: true },
}

export type ShortcutHandlers = Partial<Record<ShortcutId, () => void>>

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

function matches(event: KeyboardEvent, binding: Binding): boolean {
  const ctrl = event.ctrlKey || event.metaKey
  if (binding.ctrl !== ctrl) return false
  if (binding.shift !== undefined && binding.shift !== event.shiftKey) return false
  return event.key.toLowerCase() === binding.key.toLowerCase()
}

export function useShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const editing = isEditable(event.target)

      for (const [id, binding] of Object.entries(SHORTCUTS) as Array<[ShortcutId, Binding]>) {
        if (!matches(event, binding)) continue
        if (editing && !binding.allowInField) continue

        const handler = ref.current[id]
        if (!handler) continue

        event.preventDefault()
        handler()
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

/** Human-readable accelerator for menus and tooltips. */
export function accelerator(id: ShortcutId, platform: string): string {
  const binding = SHORTCUTS[id]
  if (!binding.ctrl) return binding.key
  return `${platform === 'darwin' ? '⌘' : 'Ctrl'}+${binding.key.toUpperCase()}`
}
