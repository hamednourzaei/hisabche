// ============================================
// DesktopTitleBar — the app's own top strip on Windows and Linux.
//
// The window has no system title bar (see `createMainWindow`): this strip is
// it. It is the drag handle, and the native minimise / maximise / close buttons
// are laid over its end edge by the OS, so the buttons belong to the app
// instead of a grey frame around it.
//
// ⚠️ THE BUTTONS ARE NATIVE AND CANNOT READ CSS. Their colours are sent to the
// main process from this strip's computed style, so they follow the same
// theme tokens as everything else and change with the theme — no hex here.
//
// macOS keeps its own traffic lights and Android has no window: neither
// renders this strip.
// ============================================

import React, { useEffect, useRef, useState } from 'react'
import { useThemeStore } from '@hisabche/store'

import { bridge } from '@/shared/lib/bridge'

/** Matches `TITLE_BAR_HEIGHT` in the Electron main process. */
export const TITLE_BAR_HEIGHT_PX = 40

/**
 * Electron on Windows or Linux. Read from the user agent, synchronously, so the
 * strip is there on the first paint — an async platform answer would shift the
 * whole app down by the strip's height a moment after it opened.
 */
export function useHasDesktopTitleBar(): boolean {
  const [has] = useState(() => {
    if (typeof navigator === 'undefined') return false
    return /Electron\//.test(navigator.userAgent) && !/Macintosh/.test(navigator.userAgent)
  })
  return has
}

export function DesktopTitleBar() {
  const ref = useRef<HTMLDivElement>(null)
  const isDark = useThemeStore((s) => s.isDark)

  useEffect(() => {
    // After the theme class has been applied to the page.
    const frame = requestAnimationFrame(() => {
      const node = ref.current
      if (!node) return
      const style = getComputedStyle(node)
      void bridge()
        ?.window.setChrome?.(style.backgroundColor, style.color)
        .catch(() => undefined)
    })
    return () => cancelAnimationFrame(frame)
  }, [isDark])

  return (
    <div
      ref={ref}
      style={{ height: TITLE_BAR_HEIGHT_PX, WebkitAppRegion: 'drag' } as React.CSSProperties}
      className="flex shrink-0 select-none items-center border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 text-xs text-[hsl(var(--fg-primary))]"
    >
      <span className="truncate opacity-80">{document.title}</span>
    </div>
  )
}
