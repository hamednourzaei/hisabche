// ============================================
// packages/ui/src/lib/use-menu-open-mark.ts
//
// ⚠️ A SELECT OR A DROPDOWN IS A MENU, NOT A DIALOG — Radix locks <body>
// for both (overflow hidden + position relative). That froze the page and,
// on a scrolled page, sent the sticky dashboard header to the top of the
// document, out of sight (selects: Oct 2026; the header «پنل مدیریت» menu:
// owner report, 9 Nov 2026).
//
// While a menu is open this marks <html data-select-open> (counted: one menu
// can open while another closes). `globals.css` undoes the body lock under
// that mark, draws the soft blur behind the menu, and — below 768px — centres
// the menu on the screen. The first wheel or touch-move outside the menu
// closes it, the way a native dropdown does.
// ============================================

import { useEffect } from 'react'

export const MENU_CONTENT_SELECTOR = '[data-select-content], [data-menu-content]'

export function useMenuOpenMark(open: boolean, close: () => void): void {
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    root.dataset.selectOpen = String(Number(root.dataset.selectOpen ?? '0') + 1)

    const closeOnScroll = (event: Event) => {
      const target = event.target
      // Scrolling the list itself is not scrolling the page.
      if (target instanceof Element && target.closest(MENU_CONTENT_SELECTOR)) return
      close()
    }
    window.addEventListener('wheel', closeOnScroll, { capture: true, passive: true })
    window.addEventListener('touchmove', closeOnScroll, { capture: true, passive: true })

    return () => {
      window.removeEventListener('wheel', closeOnScroll, { capture: true })
      window.removeEventListener('touchmove', closeOnScroll, { capture: true })
      const left = Number(root.dataset.selectOpen ?? '1') - 1
      if (left > 0) root.dataset.selectOpen = String(left)
      else delete root.dataset.selectOpen
    }
  }, [open, close])
}
