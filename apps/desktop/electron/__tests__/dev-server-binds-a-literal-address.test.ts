// ============================================
// ⚠️ THE DEV WINDOW WAS BLANK AND THE SERVER WAS RUNNING.
//
// electron-vite printed «dev server running … http://localhost:5173/» and the
// window showed nothing. The console held one Electron CSP warning and no
// error at all, so there was nothing to read.
//
// The cause is that `localhost` is two addresses: Vite listens on 127.0.0.1,
// Chromium resolves the name to `::1` first, and the load fails with
// ERR_CONNECTION_REFUSED. Nothing in the UI, the terminal or DevTools said so
// until `did-fail-load` was given a listener.
//
// Binding the literal address removes the name, so there is nothing left to
// resolve two ways. This guard exists because the line looks redundant — it is
// the first thing someone tidies away.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const config = readFileSync(
  join(__dirname, '../../../../packages/app-shell/vite.shell.mjs'),
  'utf8',
)

describe('the shared renderer dev server', () => {
  it('⚠️ binds 127.0.0.1, never the name `localhost`', () => {
    expect(config).toContain("server: { host: '127.0.0.1' }")
  })
})

describe('a renderer that cannot load says so', () => {
  const window = readFileSync(join(__dirname, '../main/window.ts'), 'utf8')

  it.each(['did-fail-load', 'preload-error', 'render-process-gone'])(
    '⚠️ %s is reported, not swallowed',
    (event) => {
      // Each of these looks identical on screen: a window that opened and did
      // nothing. Without the listener there is no way to tell them apart.
      expect(window).toContain(`'${event}'`)
    },
  )
})
