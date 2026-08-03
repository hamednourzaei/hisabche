// ============================================
// Auto-update. Disabled in development so a dev run never contacts a feed.
// ============================================

import { app } from 'electron'

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) return

  try {
    // Required lazily: electron-updater reads packaging metadata at import time.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')

    autoUpdater.autoDownload = true
    autoUpdater.on('error', (error) => console.error('[updater]', error))

    await autoUpdater.checkForUpdatesAndNotify()
  } catch (error) {
    console.error('[updater] check failed:', error)
  }
}
