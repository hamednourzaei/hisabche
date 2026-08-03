// ============================================
// Main process entry.
// ============================================

import { app, BrowserWindow, session } from 'electron'

import { closeDatabase, initDatabase } from './db/database'
import { registerIpcHandlers } from './ipc/register'
import { createMainWindow } from './window'
import { initCrashReporting } from './services/monitoring'

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
            "img-src 'self' data: blob:; " +
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
