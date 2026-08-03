// ============================================
// IPC handlers.
//
// One rule everywhere: parse the payload with its schema first, act second.
// A handler never trusts the shape it receives from the renderer.
// ============================================

import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

import {
  IPC,
  dbEnqueueSchema,
  dbQuerySchema,
  dbResolveQueueSchema,
  dbUpsertSchema,
  exportFileSchema,
  importFileSchema,
  printEscPosSchema,
  printHtmlSchema,
  secureKeySchema,
  secureSetSchema,
  windowControlSchema,
} from '../../shared/ipc-contract'
import type { AppInfo, ImportedFile } from '../../shared/ipc-contract'
import * as db from '../db/database'
import { secureDelete, secureGet, secureSet } from '../services/secure-store'
import { printEscPos, printHtml } from '../services/printing'
import { checkForUpdates } from '../services/updater'
import { writeExport } from '../services/files'

/** Wrap a handler so a rejected schema surfaces as a clear, non-fatal error. */
function handle<TInput, TResult>(
  channel: string,
  schema: { parse: (value: unknown) => TInput },
  handler: (input: TInput, event: Electron.IpcMainInvokeEvent) => TResult | Promise<TResult>
): void {
  ipcMain.handle(channel, async (event, raw: unknown) => {
    try {
      return await handler(schema.parse(raw), event)
    } catch (error) {
      console.error(`[ipc] ${channel} rejected:`, error)
      throw new Error(`IPC_REJECTED:${channel}`)
    }
  })
}

const anySchema = { parse: (value: unknown) => value ?? {} }

export function registerIpcHandlers(): void {
  // ─── Secure storage ─────────────────────────────────────
  handle(IPC.secureGet, secureKeySchema, ({ key }) => secureGet(key))
  handle(IPC.secureSet, secureSetSchema, ({ key, value }) => void secureSet(key, value))
  handle(IPC.secureDelete, secureKeySchema, ({ key }) => void secureDelete(key))

  // ─── Local database ─────────────────────────────────────
  handle(IPC.dbQuery, dbQuerySchema, (input) => db.query(input))
  handle(IPC.dbUpsertMany, dbUpsertSchema, ({ table, rows }) => db.upsertMany(table, rows))
  handle(IPC.dbEnqueue, dbEnqueueSchema, (input) => void db.enqueue(input))
  handle(IPC.dbQueue, anySchema, () => db.readQueue())
  handle(IPC.dbResolveQueue, dbResolveQueueSchema, ({ clientId, status, error }) =>
    db.resolveQueue(clientId, status, error)
  )

  // ─── Printing ───────────────────────────────────────────
  handle(IPC.printHtml, printHtmlSchema, (input) => printHtml(input))
  handle(IPC.printEscPos, printEscPosSchema, ({ data, deviceName }) =>
    printEscPos(data, deviceName)
  )

  // ─── Files ──────────────────────────────────────────────
  handle(IPC.exportFile, exportFileSchema, (input) => writeExport(input))
  handle(IPC.importFile, importFileSchema, async ({ extensions }): Promise<ImportedFile | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Data', extensions }],
    })
    const path = result.filePaths[0]
    if (result.canceled || !path) return null

    const content = await readFile(path)
    return { fileName: basename(path), content: content.toString('base64') }
  })

  // ─── Window ─────────────────────────────────────────────
  handle(IPC.windowControl, windowControlSchema, ({ action }, event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return

    const actions: Record<typeof action, () => void> = {
      minimize: () => win.minimize(),
      maximize: () => win.maximize(),
      unmaximize: () => win.unmaximize(),
      close: () => win.close(),
      toggleMaximize: () => (win.isMaximized() ? win.unmaximize() : win.maximize()),
    }
    actions[action]()
  })

  // ─── App ────────────────────────────────────────────────
  handle(IPC.appInfo, anySchema, (): AppInfo => ({
    version: app.getVersion(),
    platform: process.platform,
    locale: app.getLocale(),
    databaseReady: db.isReady(),
  }))
  handle(IPC.checkUpdates, anySchema, () => checkForUpdates())
}
