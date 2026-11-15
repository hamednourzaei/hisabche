// ============================================
// The first-visit guide never covers an open dialog.
//
// «اولین کالا را ثبت کن» opens the add-product form; the guide opened over it, its backdrop
// took every click on the form and the form's modality took the guide's close button — a
// new owner was locked out of their first product (browser journey, 14 Nov 2026).
// ============================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const guide = readFileSync(
  join(__dirname, '..', 'components', 'ui', 'guide', 'interactive-guide.tsx'),
  'utf8',
)
const hook = readFileSync(join(__dirname, '..', 'hooks', 'use-modal-open.ts'), 'utf8')

describe('guide and dialogs', () => {
  it('the guide asks whether a dialog is open, and renders nothing while one is', () => {
    expect(guide).toContain('const modalOpen = useModalOpen()')
    expect(guide).toContain('if (modalOpen) return null')
    // …and it does not lock the page behind the dialog either.
    expect(guide).toContain('const active = (Boolean(currentStep) || showFinished) && !modalOpen')
    // The hook is called with the other hooks, before the first early return.
    expect(guide.indexOf('const modalOpen = useModalOpen()')).toBeLessThan(
      guide.indexOf("if (typeof document === 'undefined') return null"),
    )
  })

  it("the guide's own card does not count as a dialog", () => {
    expect(hook).toContain("element.closest('[data-guide-layer]')")
    expect(guide).toContain('data-guide-layer=""')
  })
})
