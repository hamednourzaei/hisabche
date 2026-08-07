// ============================================
// Preload — the only bridge between renderer and Node.
//
// Nothing from Node is re-exported. Each function forwards a plain object to
// a named channel; main re-validates before acting. The renderer never sees
// ipcRenderer itself, so it cannot invoke an arbitrary channel.
// ============================================

import { contextBridge, ipcRenderer } from 'electron'

import { IPC } from '../shared/ipc-contract'
import type {
  AppInfo,
  ImportedFile,
  LocalTable,
  QueueEntry,
  HttpRequestResponse,
} from '../shared/ipc-contract'

export interface DesktopBridge {
  secure: {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
    delete(key: string): Promise<void>
  }
  db: {
    query<T>(input: {
      table: LocalTable
      search?: string
      where?: Record<string, string | number | boolean | null>
      orderBy?: string
      direction?: 'asc' | 'desc'
      limit?: number
      offset?: number
    }): Promise<T[]>
    upsertMany(table: LocalTable, rows: Array<Record<string, unknown>>): Promise<number>
    enqueue(input: {
      entity: LocalTable
      operation: 'create' | 'update' | 'delete'
      clientId: string
      payload: Record<string, unknown>
    }): Promise<void>
    queue(): Promise<QueueEntry[]>
    resolveQueue(clientId: string, status: 'done' | 'failed', error?: string): Promise<void>
  }
  print: {
    html(input: {
      html: string
      landscape?: boolean
      silent?: boolean
      deviceName?: string
    }): Promise<boolean>
    escPos(input: { data: string; deviceName?: string }): Promise<boolean>
  }
  files: {
    export(input: {
      suggestedName: string
      content: string
      encoding?: 'utf8' | 'base64'
      filters?: Array<{ name: string; extensions: string[] }>
    }): Promise<string | null>
    import(extensions: string[]): Promise<ImportedFile | null>
  }
  window: {
    control(
      action: 'minimize' | 'maximize' | 'unmaximize' | 'close' | 'toggleMaximize',
    ): Promise<void>
  }
  app: {
    info(): Promise<AppInfo>
    checkUpdates(): Promise<void>
  }
  http: {
    request(input: {
      url: string
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      headers?: Record<string, string>
      body?: string | null
    }): Promise<HttpRequestResponse>
  }
}

const bridge: DesktopBridge = {
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
  },
  http: {
    request: (input) => ipcRenderer.invoke(IPC.httpRequest, input),
  },
}

contextBridge.exposeInMainWorld('hisabche', bridge)
