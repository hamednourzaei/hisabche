// ============================================
// Window management.
//
// Security posture: no Node in the renderer, context isolation on, sandbox on,
// and navigation locked to the app's own origin.
// ============================================

import { BrowserWindow, app, shell } from 'electron'

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
