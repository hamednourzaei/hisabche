// ============================================
// Window management.
//
// Security posture: no Node in the renderer, context isolation on, sandbox on,
// and navigation locked to the app's own origin.
// ============================================

import { BrowserWindow, app, shell } from 'electron'

import { reportError } from './services/monitoring'
import { bindUpdaterWindow } from './services/updater'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Runtime window icon. Windows and Linux read it from the BrowserWindow; macOS
 * takes it from the app bundle instead, so it is only set where it applies.
 * Without this Electron falls back to its own default icon.
 */
function resolveIcon(): string | undefined {
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, 'resources/icon.png'), join(process.resourcesPath, 'icon.png')]
    : [join(__dirname, '../../resources/icon.png')]

  // A missing icon must not be fatal — Electron falls back to its default.
  return candidates.find((path) => existsSync(path))
}

const MIN_WIDTH = 1024
const MIN_HEIGHT = 680

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    // Paint nothing until the renderer is ready — avoids a white flash.
    show: false,
    backgroundColor: '#101820',
    ...(() => {
      if (process.platform === 'darwin') return {}
      const icon = resolveIcon()
      return icon ? { icon } : {}
    })(),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
    },
  })

  window.once('ready-to-show', () => window.show())

  // External links open in the user's browser, never inside the app shell.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Block in-app navigation away from the bundled renderer.
  window.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url)
    const allowed = process.env.ELECTRON_RENDERER_URL
      ? new URL(process.env.ELECTRON_RENDERER_URL).origin
      : 'file://'

    if (target.origin !== allowed && target.protocol !== 'file:') event.preventDefault()
  })

  // ══════════════════════════════════════════════════════════════════════
  // ⚠️ A RENDERER THAT FAILS SILENTLY IS A WHITE WINDOW WITH NO EXPLANATION.
  //
  // Nothing was listening for any of these, so when the packaged app came up
  // showing only its background there was no message anywhere — not in the
  // window, not on stdout, not in Sentry. The person sees an app that opened
  // and did nothing, and the only way to find out why is to rebuild it
  // yourself with devtools.
  //
  // Each of these is a DIFFERENT failure that looks identical on screen:
  //   did-fail-load        the HTML itself never loaded
  //   preload-error        the bridge threw, so the UI has no host
  //   render-process-gone  the page crashed after loading
  //   console-message      the app's own error, e.g. a failed import
  // ══════════════════════════════════════════════════════════════════════
  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    reportError(new Error(`renderer failed to load: ${description} (${code})`), {
      scope: 'renderer.load',
      url,
    })
  })

  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    // The bridge is how the UI reaches the database, the printer and the
    // queue. Losing it leaves a UI that renders and cannot do anything.
    reportError(error, { scope: 'renderer.preload', preloadPath })
  })

  window.webContents.on('render-process-gone', (_event, details) => {
    reportError(new Error(`renderer gone: ${details.reason}`), {
      scope: 'renderer.crash',
      exitCode: details.exitCode,
    })
  })

  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    // Only errors. Forwarding every log would bury the one that matters.
    if (level < 3) return
    reportError(new Error(message), { scope: 'renderer.console', line, sourceId })
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Progress events need somewhere to go. Bound here rather than in the
  // updater so the service holds no opinion about how many windows exist.
  bindUpdaterWindow(window)

  return window
}
