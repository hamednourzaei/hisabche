// ============================================
// Owner request (8 Nov 2026): onboarding is ONE screen per step — the page
// itself never scrolls, the buttons are always on screen, only a long list
// scrolls inside its own box — and it carries no hardcoded text in any language.
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const DIR = join(__dirname, '..', 'components', 'ui', 'onboarding')
const page = readFileSync(join(DIR, 'onboarding-page.tsx'), 'utf8')

const codeOnly = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')

describe('onboarding — one screen', () => {
  it('the screen is exactly the viewport and does not scroll', () => {
    expect(page).toContain('flex h-[100dvh] flex-col overflow-hidden')
    expect(page).not.toContain('min-h-[100dvh]')
  })

  it('each of the four question steps has a body that scrolls inside itself', () => {
    expect(page.match(/data-onboarding-body=""/g)?.length).toBe(4)
    expect(page.match(/min-h-0 flex-1 overflow-y-auto overscroll-contain/g)?.length).toBe(4)
  })

  it('the back / next buttons never scroll away', () => {
    expect(page.match(/flex shrink-0 justify-between/g)?.length).toBe(4)
  })
})

describe('onboarding — no hardcoded text', () => {
  const files = readdirSync(DIR, { recursive: true })
    .map(String)
    .filter((name) => /\.tsx?$/.test(name))

  it.each(files)('%s has no Persian or Dari text in code', (name) => {
    const source = codeOnly(readFileSync(join(DIR, name), 'utf8'))
    expect(source.match(/[؀-ۿ][^'"`\n]*/g) ?? []).toEqual([])
  })
})
