// ============================================
// Opening a select must not freeze the page or hide the dashboard header.
//
// Radix treats a select as a modal: it locks <body> (overflow hidden, position
// relative) and swallows wheel and touch-move outside the list. On a scrolled
// page that unstuck the `position: sticky` header — it jumped back to the top of
// the document, out of sight — and nothing could be scrolled until the list was
// closed. Reported on every page, because every dropdown is this component.
//
// The fix has two halves that only work together: the component marks <html>
// and closes on scroll; the stylesheet undoes the body lock under that mark.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const UI = join(__dirname, '..')
/** Comments describe the bug; only code is asserted on. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')

const select = code(readFileSync(join(UI, 'components', 'ui', 'select.tsx'), 'utf8'))
const css = readFileSync(join(UI, 'styles', 'globals.css'), 'utf8')

describe('the select root', () => {
  it('is this component, not the bare Radix root', () => {
    expect(select).not.toContain('const Select = SelectPrimitive.Root')
    expect(select).toContain(
      '<SelectPrimitive.Root {...props} open={open} onOpenChange={setOpen} />',
    )
  })

  it('marks <html> while open — counted, so two selects cannot clear each other', () => {
    expect(select).toContain(
      "root.dataset.selectOpen = String(Number(root.dataset.selectOpen ?? '0') + 1)",
    )
    expect(select).toContain('delete root.dataset.selectOpen')
  })

  it('closes on the first wheel or touch-move OUTSIDE the list', () => {
    expect(select).toContain(
      "window.addEventListener('wheel', closeOnScroll, { capture: true, passive: true })",
    )
    expect(select).toContain(
      "window.addEventListener('touchmove', closeOnScroll, { capture: true, passive: true })",
    )
    expect(select).toContain("target.closest('[data-select-content]')")
    // …and the list carries the mark that test looks for.
    expect(select).toContain('data-select-content=""')
  })

  it('removes both listeners when it closes', () => {
    expect(select).toContain(
      "window.removeEventListener('wheel', closeOnScroll, { capture: true })",
    )
    expect(select).toContain(
      "window.removeEventListener('touchmove', closeOnScroll, { capture: true })",
    )
  })

  it('still honours a caller that controls `open` itself', () => {
    expect(select).toContain('const open = openProp ?? innerOpen')
    expect(select).toContain('onOpenChange?.(next)')
  })
})

describe('the stylesheet', () => {
  const rule = css.slice(css.indexOf('html[data-select-open] body[data-scroll-locked]'))

  it('undoes the body lock under the select mark — and only under it', () => {
    expect(css).toContain('html[data-select-open] body[data-scroll-locked] {')
    // No rule that unlocks the body for everything: a dialog must still lock.
    expect(css).not.toMatch(/(^|\n)\s*body\[data-scroll-locked\]\s*\{/)
  })

  it('restores what kept the header in place and the layout from shifting', () => {
    const body = rule.slice(0, rule.indexOf('}'))
    // `overflow: hidden` on body is what made body the header's scroll container.
    expect(body).toContain('overflow: visible !important;')
    expect(body).toContain('position: static !important;')
    // The scrollbar is still there, so the gap Radix leaves for it must go.
    expect(body).toContain('margin-right: 0 !important;')
  })
})
