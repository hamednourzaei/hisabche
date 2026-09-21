// ============================================
// ⚠️ THE APP RENDERED PERFECTLY AND HAD NO STYLES.
//
// The packaged window showed a 1536px logo at its natural size and the
// navigation as plain text in a corner. Not a crash, not a blank page — a
// complete, working UI with the stylesheet missing. DevTools reported «No
// Issues».
//
// The cause: Vite writes `<link rel="stylesheet" crossorigin …>`, which is
// right for a CDN-hosted build and fatal under `file://`. The origin there is
// `null`, so the stylesheet becomes a CORS request that can never succeed, and
// the browser drops it WITHOUT logging anything.
//
// `electron-vite dev` serves over http, where `crossorigin` is harmless — so
// the failure exists only in the packaged build, and only a check against the
// BUILT HTML can see it.
// ============================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const html = join(__dirname, '..', '..', 'out/renderer/index.html')

describe('the built page can load its own assets from disk', () => {
  it('⚠️ the build exists to be checked', () => {
    // Saying so beats passing silently on a machine that has not built.
    expect(existsSync(html)).toBe(true)
  })

  const source = existsSync(html) ? readFileSync(html, 'utf8') : ''

  it('⚠️ no crossorigin attribute survives into the HTML', () => {
    // One attribute, one silent failure. It applies to the module script too:
    // that one happens to work today, and relying on that is how this comes
    // back the next time Chromium tightens file:// handling.
    expect(source).not.toContain('crossorigin')
  })

  it('⚠️ every asset is referenced relatively, never from the drive root', () => {
    // `/assets/app.js` under `file://` means C:\assets\app.js — a path that
    // has never existed on any machine.
    const refs = [...source.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1] ?? '')
    expect(refs.length).toBeGreaterThan(0)

    for (const ref of refs) {
      if (ref.startsWith('http') || ref.startsWith('data:')) continue
      expect(ref.startsWith('/')).toBe(false)
    }
  })

  it('⚠️ the stylesheet it asks for is actually there', () => {
    // A relative path to a file the build did not emit is the same blank
    // design with a different cause.
    const stylesheet = /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/.exec(source)?.[1]
    expect(stylesheet).toBeTruthy()

    const onDisk = join(__dirname, '..', '..', 'out/renderer', stylesheet ?? '')
    expect(existsSync(onDisk)).toBe(true)
  })
})
