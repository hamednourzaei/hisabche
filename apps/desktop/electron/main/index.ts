// ============================================
// Main process entry.
// ============================================

import { join } from 'node:path'

import { app, BrowserWindow, session } from 'electron'

import { closeDatabase, initDatabase } from './db/database'
import { registerIpcHandlers } from './ipc/register'
import { createMainWindow } from './window'
import { initCrashReporting } from './services/monitoring'

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ WHERE THE LOCAL DATABASE LIVES — PINNED, NOT DERIVED.
//
// `app.getPath('userData')` defaults to `%APPDATA%/<app name>`, and the app
// name comes from the packaged `package.json`. This package is called
// `@hisabche/desktop`, so every existing installation keeps its SQLite file at
//
//     %APPDATA%/@hisabche/desktop/hisabche.db
//
// That leading `@` is also a build problem: 7-Zip reads an argument beginning
// with `@` as a LIST FILE, so electron-builder's NSIS step fails with
// `ENOENT: stat '…/@hisabchedesktop-0.0.1-x64.nsis.7z'` and no installer is
// produced. The obvious fix — renaming the package for the build — would
// silently move this directory and orphan the local database of everybody who
// already has the app installed: their invoices, their offline queue, their
// vault.
//
// So the path is stated explicitly. The name may now change freely; the data
// stays where it has always been.
//
// ⚠️ THIS MUST RUN BEFORE ANYTHING TOUCHES userData — before `initDatabase`,
// before the secure store, before `app.whenReady`. Electron caches the value
// on first read, and a later `setPath` would leave the two halves of the app
// looking in different folders.
// ═══════════════════════════════════════════════════════════════════════════
app.setPath('userData', join(app.getPath('appData'), '@hisabche', 'desktop'))

// One instance only — a second launch focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null

function applyContentSecurityPolicy(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            // https: for images only — product images, app icons and screenshots
            // live in public storage. Without it every one of them was blocked in
            // the packaged Windows app (3 Oct 2026). An image cannot run code;
            // script-src stays 'self'.
            "img-src 'self' data: blob: https:; " +
            "font-src 'self' data:; " +
            "connect-src 'self' https: wss:;",
        ],
      },
    })
  })
}

app.whenReady().then(() => {
  initCrashReporting()
  initDatabase()
  registerIpcHandlers()

  // Dev serves the renderer over http, where a strict CSP breaks HMR.
  if (app.isPackaged) applyContentSecurityPolicy()

  mainWindow = createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
  })
})

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeDatabase()
})
