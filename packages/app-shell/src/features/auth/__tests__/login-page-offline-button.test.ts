// ============================================
// The «offline edition» button must stay on screen under the desktop title bar.
//
// The login page was `min-h-screen` (100vh). Once the desktop window got its own
// title bar above the page, 100vh was 40px taller than the space the page really
// has, and the button — anchored to the page's bottom edge — sat below the window
// and could not be seen. This pins the cause, not the symptom: the page fills the
// space it is given, the form scrolls INSIDE it, and the button row is a sibling
// of that scroll area, so it can never scroll away either.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE = readFileSync(join(__dirname, '../login-page.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('the login page under the desktop title bar', () => {
  it('does not size itself to the whole screen', () => {
    expect(SOURCE).not.toContain('min-h-screen')
  })

  it('fills the space it is given and scrolls its form inside it', () => {
    expect(SOURCE).toContain('className="relative h-full min-h-0"')
    expect(SOURCE).toContain('className="h-full overflow-y-auto"')
  })

  it('draws the offline button after — outside — the scrolling form', () => {
    const scroll = SOURCE.indexOf('className="h-full overflow-y-auto"')
    const button = SOURCE.indexOf('onClick={handleOfflineMode}')
    expect(scroll).toBeGreaterThan(-1)
    expect(button).toBeGreaterThan(scroll)
    // The row holding the button is absolutely placed against the page, not the form.
    const row = SOURCE.lastIndexOf('className="absolute inset-x-0 bottom-3', button)
    expect(row).toBeGreaterThan(scroll)
  })
})
