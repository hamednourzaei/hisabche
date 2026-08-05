// ============================================
// IPC handlers.
//
// One rule everywhere: parse the payload with its schema first, act second.
// A handler never trusts the shape it receives from the renderer.
// All sensitive operations require authentication and authorization.
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

/** Authentication middleware for IPC handlers */
export function authenticate<I, O>(
  handler: (input: I, event: Electron.IpcMainInvokeEvent) => O | Promise<O>
) {
  return async (input: I, event: Electron.IpcMainInvokeEvent): Promise<O> => {
    // For desktop, we need to check the secure storage for session
    const { sessionStore } = await import('../shared/lib/storage')
    const storedSession = await sessionStore.read()

    if (!storedSession?.token) {
      throw new Error('UNAUTHORIZED: No valid session')
    }

    // Validate token format
    if (!storedSession.token || typeof storedSession.token !== 'string' || storedSession.token.length < 10) {
      await sessionStore.clear()
      throw new Error('UNAUTHORIZED: Invalid session token')
    }

    return handler(input, event)
  }
}

/** Authorization middleware for specific capabilities */
export function authorize(capability: string) {
  return <I, O>(
    handler: (input: I, event: Electron.IpcMainInvokeEvent) => O | Promise<O>
  ) => {
    return async (input: I, event: Electron.IpcMainInvokeEvent): Promise<O> => {
      const { sessionCan } = await import('../features/auth/auth.store')
      const { sessionStore } = await import('../shared/lib/storage')
      const session = await sessionStore.read()

      if (!sessionCan(session, capability as any)) {
        throw new Error('FORBIDDEN: Insufficient permissions for ' + capability)
      }

      return handler(input, event)
    }
  }
}

/** Context middleware for IPC handlers */
export function authenticateAndAuthorize(
  capability: string | null = null,
  validateInput?: boolean
) {
  return <I, O>(
    handler: (input: I, event: Electron.IpcMainInvokeEvent) => O | Promise<O>
  ) => {
    return async (input: I, event: Electron.IpcMainInvokeEvent): Promise<O> => {
      const { sessionStore } = await import('../shared/lib/storage')
      const session = await sessionStore.read()

      if (!session?.token) {
        throw new Error('UNAUTHORIZED: No valid session')
      }

      if (capability) {
        const { sessionCan } = await import('../features/auth/auth.store')
        if (!sessionCan(session, capability as any)) {
          throw new Error('FORBIDDEN: Insufficient permissions for ' + capability)
        }
      }

      return handler(input, event)
    }
  }
}

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
  // ─── Secure storage ───────────────────────────────────── (High privilege)
  handle(IPC.secureGet, secureKeySchema,
    authenticateAndAuthorize('record.read', true)(({ key }, event) => secureGet(key)))
  handle(IPC.secureSet, secureSetSchema,
    authenticateAndAuthorize('record.update', true)(({ key, value }, event) => void secureSet(key, value)))
  handle(IPC.secureDelete, secureKeySchema,
    authenticateAndAuthorize('record.delete', true)(({ key }, event) => void secureDelete(key)))

  // ─── Local database ───────────────────────────────────── (Business data access)
  handle(IPC.dbQuery, dbQuerySchema,
    authenticateAndAuthorize('record.read', true)((input, event) => db.query(input)))
  handle(IPC.dbUpsertMany, dbUpsertSchema,
    authenticateAndAuthorize('record.update', true)(({ table, rows }, event) => db.upsertMany(table, rows)))
  handle(IPC.dbEnqueue, dbEnqueueSchema,
    authenticateAndAuthorize('record.create', true)((input, event) => void db.enqueue(input)))
  handle(IPC.dbQueue, anySchema,
    authenticateAndAuthorize('record.read', true)((_, event) => db.readQueue()))
  handle(IPC.dbResolveQueue, dbResolveQueueSchema,
    authenticateAndAuthorize('record.delete', true)(({ clientId, status, error }, event) =>
      db.resolveQueue(clientId, status, error)
    )
  )

  // ─── Printing ─────────────────────────────────────────── (High privilege)
  handle(IPC.printHtml, printHtmlSchema,
    authenticateAndAuthorize('record.create', true)((input, event) => printHtml(input)))
  handle(IPC.printEscPos, printEscPosSchema,
    authenticateAndAuthorize('record.create', true)(({ data, deviceName }, event) =>
      printEscPos(data, deviceName)
    )
  )

  // ─── Files ────────────────────────────────────────────── (High privilege)
  handle(IPC.exportFile, exportFileSchema,
    authenticateAndAuthorize('record.create', true)((input, event) => writeExport(input)))
  handle(IPC.importFile, importFileSchema, async ({ extensions }, event): Promise<ImportedFile | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Data', extensions }],
    })
    const path = result.filePaths[0]
    if (result.canceled || !path) return null

    const content = await readFile(path)
    return { fileName: basename(path), content: content.toString('base64') }
  })

  // ─── Window ───────────────────────────────────────────── (Medium privilege)
  handle(IPC.windowControl, windowControlSchema,
    authenticateAndAuthorize('workspace.manage', true)(({ action }, event) => {
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
  )

  // ─── App ──────────────────────────────────────────────── (Medium privilege)
  handle(IPC.appInfo, anySchema,
    authenticateAndAuthorize('record.read', false)((_, event): AppInfo => ({
      version: app.getVersion(),
      platform: process.platform,
      locale: app.getLocale(),
      databaseReady: db.isReady(),
    })))
  handle(IPC.checkUpdates, anySchema,
    authenticateAndAuthorize('workspace.manage', false)((_, event) => checkForUpdates()))
}
