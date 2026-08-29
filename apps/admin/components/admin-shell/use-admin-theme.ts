'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Admin theme state.
 *
 * The design system is DARK BY DEFAULT: `:root` in `@hisabche/ui/globals.css`
 * carries the dark surfaces and `:root[data-theme='light']` overrides them. So
 * "dark" is the absence of the attribute, not the presence of one — which is
 * why this sets/removes `data-theme` rather than toggling a `dark` class.
 *
 * The previous shell held `isDark` in React state and passed it to the header,
 * where nothing ever read it against the DOM. The toggle moved a chevron and
 * changed no pixel. This one actually writes the attribute and remembers it.
 *
 * The DOM is the source of truth, read through `useSyncExternalStore` rather
 * than mirrored into React state by an effect. That matters here: the inline
 * `THEME_INIT_SCRIPT` has ALREADY set the attribute before React hydrates, so
 * a `useState('dark')` + effect would render one frame disagreeing with the
 * painted page and then re-render — the cascading render `react-hooks` warns
 * about, for a value that was never React's to own.
 */
const STORAGE_KEY = 'hisabche-admin-theme'

export type AdminTheme = 'dark' | 'light'

/** Subscribers woken by `toggle()`; the DOM attribute emits no event of its own. */
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): AdminTheme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
}

/** The server renders the product default; the init script fixes up the rest. */
function getServerSnapshot(): AdminTheme {
  return 'dark'
}

export function useAdminTheme(): { theme: AdminTheme; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = useCallback(() => {
    const next: AdminTheme = getSnapshot() === 'dark' ? 'light' : 'dark'
    const root = document.documentElement
    if (next === 'light') root.setAttribute('data-theme', 'light')
    else root.removeAttribute('data-theme')

    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode or blocked storage: not remembering the choice is
      // acceptable, failing the click is not.
    }

    listeners.forEach((listener) => listener())
  }, [])

  return { theme, toggle }
}

/**
 * Runs before first paint so a light-mode admin never flashes dark.
 * Kept as a string because it must be inlined into the document head.
 */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem('${STORAGE_KEY}')==='light'){document.documentElement.setAttribute('data-theme','light')}}catch(e){}`
