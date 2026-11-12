// ============================================
// Main process entry.
// ============================================

import { join } from 'node:path'

import { app, BrowserWindow, session } from 'electron'

import { closeDatabase, initDatabase } from './db/database'
import { registerIpcHandlers } from './ipc/register'
import { createMainWindow } from './window'
import { initCrashReporting } from './services/monitoring'
import { initNetworkLog } from './services/network-log'
import { getDesktopPackStore, isPackDeliveryEnabled } from './packs'
import { buildRendererCsp, registerAppProtocolHandler, registerAppProtocolScheme } from './protocol'

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

if (isPackDeliveryEnabled()) {
  registerAppProtocolScheme()
}

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
        'Content-Security-Policy': [buildRendererCsp(isPackDeliveryEnabled())],
      },
    })
  })
}

/**
 * ⚠️ THE CONSOLE LOG IS GONE, AND THE FILE IS THE POINT.
 *
 * `console.warn` in a packaged Windows app goes nowhere: no terminal is
 * attached to an installer the person double-clicked, and nothing is written
 * to disk for them to send. The attempt is now recorded in
 * `%APPDATA%\@hisabche\desktop\logs\network-offline.log` — one line per
 * outbound attempt, plus a header line with the time the run started, so a
 * run that made NO attempt leaves exactly one line behind.
 */
app.whenReady().then(() => {
  // First, so that even the crash reporter's own start-up call is on record.
  initNetworkLog()
  initCrashReporting()
  initDatabase()
  registerIpcHandlers()

  if (isPackDeliveryEnabled()) {
    const packStore = getDesktopPackStore()
    registerAppProtocolHandler({
      bundledRoot: join(__dirname, '../renderer'),
      packStore,
      getBuildId: () => packStore.readInstalled()?.coreBuildId ?? null,
    })
  }

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
