// ============================================
// Preload — the only bridge between renderer and Node.
//
// Nothing from Node is re-exported. Each function forwards a plain object to
// a named channel; main re-validates before acting. The renderer never sees
// ipcRenderer itself, so it cannot invoke an arbitrary channel.
// ============================================

import { contextBridge, ipcRenderer } from 'electron'

import { IPC_EVENT, IPC, type HisabcheBridge } from '@hisabche/app-bridge'
import type {
  AppInfo,
  ImportedFile,
  LocalTable,
  QueueEntry,
  HttpRequestResponse,
  UpdateStatus,
} from '@hisabche/app-bridge'

const bridge: HisabcheBridge = {
  secure: {
    get: (key) => ipcRenderer.invoke(IPC.secureGet, { key }),
    set: (key, value) => ipcRenderer.invoke(IPC.secureSet, { key, value }),
    delete: (key) => ipcRenderer.invoke(IPC.secureDelete, { key }),
  },
  db: {
    query: (input) => ipcRenderer.invoke(IPC.dbQuery, input),
    upsertMany: (table, rows) => ipcRenderer.invoke(IPC.dbUpsertMany, { table, rows }),
    enqueue: (input) => ipcRenderer.invoke(IPC.dbEnqueue, input),
    queue: () => ipcRenderer.invoke(IPC.dbQueue, {}),
    resolveQueue: (clientId, status, error) =>
      ipcRenderer.invoke(IPC.dbResolveQueue, { clientId, status, error }),
    setWorkspace: (workspaceId) => ipcRenderer.invoke(IPC.dbSetWorkspace, { workspaceId }),
  },
  print: {
    html: (input) => ipcRenderer.invoke(IPC.printHtml, input),
    escPos: (input) => ipcRenderer.invoke(IPC.printEscPos, input),
  },
  files: {
    export: (input) => ipcRenderer.invoke(IPC.exportFile, input),
    import: (extensions) => ipcRenderer.invoke(IPC.importFile, { extensions }),
  },
  window: {
    control: (action) => ipcRenderer.invoke(IPC.windowControl, { action }),
  },
  app: {
    info: () => ipcRenderer.invoke(IPC.appInfo, {}),
    checkUpdates: () => ipcRenderer.invoke(IPC.checkUpdates, {}),
    downloadUpdate: () => ipcRenderer.invoke(IPC.downloadUpdate, {}),
    installUpdate: () => ipcRenderer.invoke(IPC.installUpdate, {}),
    onUpdateStatus: (listener) => {
      // The IpcRendererEvent is deliberately not forwarded: it carries a
      // `sender` the renderer has no business holding.
      const handler = (_event: unknown, status: UpdateStatus) => listener(status)
      ipcRenderer.on(IPC_EVENT.updateStatus, handler)
      return () => ipcRenderer.removeListener(IPC_EVENT.updateStatus, handler)
    },
  },
  http: {
    request: (input) => ipcRenderer.invoke(IPC.httpRequest, input),
  },
}

contextBridge.exposeInMainWorld('hisabche', bridge)
