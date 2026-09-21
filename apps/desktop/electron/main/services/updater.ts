// ============================================
// Auto-update.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT THIS REPLACED
//
// `checkForUpdates()` returned `void`, called `checkForUpdatesAndNotify()`, and
// was wired to a button labelled «تازه‌سازی». So pressing it did one of two
// things: nothing at all, or — if an update happened to exist — raised an
// operating-system notification the person had no reason to expect and no way
// to act on from inside the app.
//
// It also could never find anything: `electron-builder.yml` had `publish: null`,
// so no `latest.yml` was ever generated and there was no feed to check.
//
// This reports a RESULT the renderer can render, and separates the three steps
// a person actually takes: look, download, install.
//
// ---------------------------------------------------------------------------
// ⚠️ NO FEED CONFIGURED IS NOT AN ERROR
//
// A build with no publish target reports `unsupported`, and the settings screen
// says so plainly. Reporting it as a failure would train people to ignore a
// red state that means "this build was never meant to update itself" — which is
// true of every local `--dir` build and every fork.
// ============================================

import { app } from 'electron'

import type { BrowserWindow } from 'electron'

import { IPC_EVENT, type UpdateStatus } from '@hisabche/app-bridge'

export type { UpdateStatus }

/** The window that gets progress events. Set once, on creation. */
let target: BrowserWindow | null = null

export function bindUpdaterWindow(window: BrowserWindow): void {
  target = window
}

/** Progress is pushed, not polled — a download has no natural request. */
function emit(status: UpdateStatus): void {
  if (target && !target.isDestroyed()) {
    target.webContents.send(IPC_EVENT.updateStatus, status)
  }
}

/**
 * electron-updater, loaded lazily.
 *
 * ⚠️ It reads packaging metadata AT IMPORT TIME, so importing it in a dev run
 * or an unpackaged build throws before anything can catch a useful error.
 */
function loadUpdater() {
  const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')

  // ⚠️ MANUAL, DELIBERATELY. With `autoDownload` on, merely LOOKING for an
  // update starts pulling ~80 MB over whatever connection the person is on —
  // which in Kabul or Herat may be metered and slow. They press download.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  return autoUpdater
}

/** `true` when this build was given somewhere to check. */
function hasFeed(): boolean {
  // electron-builder writes `app-update.yml` beside the app only when a
  // `publish` target is configured. Asking the updater without one produces a
  // confusing «ENOENT app-update.yml», so it is answered here instead.
  try {
    const { existsSync } = require('node:fs') as typeof import('node:fs')

    const { join } = require('node:path') as typeof import('node:path')
    return existsSync(join(process.resourcesPath, 'app-update.yml'))
  } catch {
    return false
  }
}

/**
 * Is there a newer version?
 *
 * Returns rather than notifies. The caller renders the answer.
 */
export async function checkForUpdates(): Promise<UpdateStatus> {
  if (!app.isPackaged) {
    return { state: 'unsupported', reason: 'development' }
  }
  if (!hasFeed()) {
    return { state: 'unsupported', reason: 'no-feed' }
  }

  try {
    const autoUpdater = loadUpdater()
    const result = await autoUpdater.checkForUpdates()

    const version = result?.updateInfo?.version
    if (!version || version === app.getVersion()) {
      return { state: 'none', currentVersion: app.getVersion() }
    }

    const notes = result.updateInfo.releaseNotes
    return {
      state: 'available',
      version,
      // Release notes arrive as a string or as a list of per-version entries.
      // Anything else is dropped rather than stringified into `[object Object]`.
      notes: typeof notes === 'string' && notes.trim().length > 0 ? notes : null,
    }
  } catch (error) {
    return { state: 'error', message: messageOf(error) }
  }
}

/**
 * Download the update the last check found, reporting progress.
 *
 * Resolves when the file is on disk and ready to install.
 */
export async function downloadUpdate(): Promise<UpdateStatus> {
  if (!app.isPackaged || !hasFeed()) {
    return { state: 'unsupported', reason: !app.isPackaged ? 'development' : 'no-feed' }
  }

  try {
    const autoUpdater = loadUpdater()

    // ⚠️ Listeners are attached fresh and removed after. electron-updater's
    // emitter is a module singleton, so leaving them on stacks another set on
    // every download and the renderer receives each event N times.
    const onProgress = (progress: { percent: number }) => {
      emit({
        state: 'downloading',
        version: pendingVersion ?? '',
        percent: Math.round(progress.percent),
      })
    }
    autoUpdater.on('download-progress', onProgress)

    try {
      const info = await autoUpdater.checkForUpdates()
      pendingVersion = info?.updateInfo?.version ?? null

      await autoUpdater.downloadUpdate()
      const ready: UpdateStatus = { state: 'ready', version: pendingVersion ?? '' }
      emit(ready)
      return ready
    } finally {
      autoUpdater.removeListener('download-progress', onProgress)
    }
  } catch (error) {
    const failed: UpdateStatus = { state: 'error', message: messageOf(error) }
    emit(failed)
    return failed
  }
}

let pendingVersion: string | null = null

/**
 * Quit and install what was downloaded.
 *
 * ⚠️ THIS CLOSES THE APP. The caller must have asked first — there is no
 * confirmation here, because a confirmation dialog raised from the main
 * process is not translatable by the renderer that owns every other string.
 */
export function quitAndInstall(): void {
  if (!app.isPackaged) return
  try {
    const autoUpdater = loadUpdater()
    // `isSilent: false` so the installer shows its progress; `forceRunAfter`
    // so the person lands back in the app rather than on their desktop.
    autoUpdater.quitAndInstall(false, true)
  } catch (error) {
    emit({ state: 'error', message: messageOf(error) })
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
