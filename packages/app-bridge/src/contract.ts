// ============================================
// IPC contract — the single source of truth shared by main and preload.
//
// Every channel declares a Zod schema for its request payload. Main parses
// with that schema before touching the database or the OS, so a compromised
// renderer cannot smuggle an unexpected shape through the bridge.
// ============================================

import { z } from 'zod'

export const IPC = {
  // Secure credential storage (Credential Manager / Keychain / encrypted file)
  secureGet: 'secure:get',
  secureSet: 'secure:set',
  secureDelete: 'secure:delete',

  // Local SQLite cache
  dbQuery: 'db:query',
  dbUpsertMany: 'db:upsertMany',
  /** Remove server-deleted rows. Never removes a row with an unsent local edit. */
  dbRemoveMany: 'db:removeMany',
  dbEnqueue: 'db:enqueue',
  dbQueue: 'db:queue',
  dbResolveQueue: 'db:resolveQueue',
  /** Point the local cache at a workspace, purging another workspace's rows. */
  dbSetWorkspace: 'db:setWorkspace',

  // Native capabilities
  printHtml: 'print:html',
  printEscPos: 'print:escpos',
  /** The system's printers, for the receipt-printer setting. */
  printListPrinters: 'print:listPrinters',
  exportFile: 'file:export',
  importFile: 'file:import',

  // Window / app
  windowControl: 'window:control',
  appInfo: 'app:info',
  checkUpdates: 'app:checkUpdates',
  // Downloading is separate from checking on purpose: looking for an update
  // must not pull ~80 MB over a connection that may be metered.
  downloadUpdate: 'app:downloadUpdate',
  installUpdate: 'app:installUpdate',

  // Outbound HTTP (main-process proxy: renders without browser CORS)
  httpRequest: 'http:request',
} as const

/**
 * Pushed from main to the renderer — not a request/response channel.
 *
 * A download has no natural request to answer with progress, so main sends
 * and the renderer subscribes.
 */
/**
 * What the renderer is told about an update.
 *
 * ⚠️ Lives HERE, not in `main/services/updater.ts`. The preload bridge cannot
 * import from main — they are different processes with different module
 * graphs — and duplicating the union would let the two halves of one channel
 * drift apart.
 *
 * Nothing in it leaks a file path or a feed URL.
 */
export type UpdateStatus =
  | { state: 'unsupported'; reason: 'development' | 'no-feed' }
  | { state: 'none'; currentVersion: string }
  | { state: 'available'; version: string; notes: string | null }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }

export const IPC_EVENT = {
  updateStatus: 'app:updateStatus',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

// ============================================
// Payload schemas
// ============================================

export const secureKeySchema = z.object({
  key: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9._-]+$/),
})

export const secureSetSchema = secureKeySchema.extend({
  value: z.string().max(64_000),
})

export const localTableSchema = z.enum([
  'product',
  'customer',
  'invoice',
  'invoice_item',
  'transaction',
  'inventory_movement',
  'employee',
])

export type LocalTable = z.infer<typeof localTableSchema>

export const dbQuerySchema = z.object({
  table: localTableSchema,
  search: z.string().max(200).optional(),
  where: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  orderBy: z.string().max(40).optional(),
  direction: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
})

export const dbUpsertSchema = z.object({
  table: localTableSchema,
  rows: z.array(z.record(z.unknown())).max(5000),
})

export const dbRemoveSchema = z.object({
  table: localTableSchema,
  ids: z.array(z.string().min(1).max(128)).max(5000),
})

export const queueOperationSchema = z.enum(['create', 'update', 'delete'])

export const dbEnqueueSchema = z.object({
  entity: localTableSchema,
  operation: queueOperationSchema,
  clientId: z.string().min(1).max(64),
  payload: z.record(z.unknown()),
})

export const dbResolveQueueSchema = z.object({
  clientId: z.string().min(1).max(64),
  status: z.enum(['done', 'failed']),
  error: z.string().max(500).optional(),
})

/**
 * The cached tables carry no workspace column — they are filled from REST
 * endpoints already scoped to the caller's authorized workspace. That holds
 * until the active workspace changes, at which point the cache holds one
 * business's books while the app believes it is showing another's. This tells
 * the main process which workspace the cache is for, so it can purge.
 */
export const dbSetWorkspaceSchema = z.object({
  workspaceId: z.string().min(1).max(64),
})

export const dbSetWorkspaceResultSchema = z.object({
  /** True when another workspace's cached rows were discarded. */
  purged: z.boolean(),
  /**
   * Non-zero when the switch was REFUSED because unsynced offline mutations
   * are queued. Those exist nowhere but this device, so they are never
   * silently dropped — flush them, then switch.
   */
  blockedByPendingMutations: z.number().int().min(0),
})

export const printHtmlSchema = z.object({
  html: z.string().max(2_000_000),
  landscape: z.boolean().default(false),
  silent: z.boolean().default(false),
  deviceName: z.string().max(200).optional(),
  /**
   * Receipt paper width (58/80 mm). Absent = a normal page (A4). With it the
   * page is exactly the paper wide and exactly the receipt long, so a thermal
   * printer does not feed a page's worth of blank paper.
   */
  pageWidthMm: z.number().int().min(40).max(120).optional(),
  copies: z.number().int().min(1).max(5).optional(),
})

export const printEscPosSchema = z.object({
  /** Pre-rendered ESC/POS byte stream, base64 encoded. */
  data: z.string().max(2_000_000),
  deviceName: z.string().max(200).optional(),
})

export const exportFileSchema = z.object({
  suggestedName: z.string().min(1).max(200),
  /** base64 for binary formats, utf-8 text otherwise. */
  content: z.string().max(50_000_000),
  encoding: z.enum(['utf8', 'base64']).default('utf8'),
  filters: z
    .array(z.object({ name: z.string().max(60), extensions: z.array(z.string().max(10)).max(6) }))
    .max(6)
    .optional(),
})

export const importFileSchema = z.object({
  extensions: z.array(z.string().max(10)).min(1).max(6),
})

export const windowControlSchema = z.object({
  action: z.enum(['minimize', 'maximize', 'unmaximize', 'close', 'toggleMaximize']),
})

export const httpRequestSchema = z.object({
  url: z.string().url().max(2048),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  // 200 was too tight: a Supabase JWT in `Authorization` is ~1 KB, so every
  // authenticated request was rejected and the UI rendered empty data.
  headers: z.record(z.string().max(8_192)).optional(),
  body: z.union([z.string().max(2_000_000), z.null()]).optional(),
  // ⚠️ BINARY (request #153, Hisabche Sync Binary). `body`/`data` are text;
  // a binary frame forced through `response.text()` is corrupted (every byte
  // above 0x7F becomes U+FFFD). IPC carries a Uint8Array natively (structured
  // clone), so bytes travel as bytes in both directions.
  bodyBytes: z
    .instanceof(Uint8Array)
    .refine((b) => b.byteLength <= 2_000_000, 'body too large')
    .optional(),
  /** 'bytes' → the response body comes back in `bytes`, untouched. */
  responseType: z.enum(['text', 'bytes']).optional(),
})

export interface HttpRequestResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  data: string
  /** Present only when the request asked for `responseType: 'bytes'`. */
  bytes?: Uint8Array
}

// ============================================
// Response types
// ============================================

export interface QueueEntry {
  clientId: string
  entity: LocalTable
  operation: z.infer<typeof queueOperationSchema>
  payload: Record<string, unknown>
  attempts: number
  status: 'pending' | 'failed'
  lastError: string | null
  createdAt: string
}

export interface AppInfo {
  version: string
  platform: NodeJS.Platform
  locale: string
  databaseReady: boolean
  /**
   * Why the local cache is unavailable, or null when it is working.
   *
   * ⚠️ `databaseReady: false` on its own tells a person nothing — it is
   * indistinguishable from a build that never had a cache, and somebody who
   * is told nothing keeps trusting an app that is quietly storing nothing.
   * A host with no cache at all reports `null` here and `false` above.
   */
  databaseFailure?: string | null
}

export interface ImportedFile {
  fileName: string
  /** base64 contents; the renderer decides how to parse it. */
  content: string
}

// ============================================
// The bridge itself — what the shared UI is allowed to ask its host for.
//
// ⚠️ THE UI MUST NOT KNOW WHICH HOST IT IS ON.
//
// Electron answers these with IPC into Node; React Native answers them with
// Android/iOS APIs over a WebView message channel. Neither name appears in
// the UI, and nothing host-specific belongs in this interface: if only one
// host can implement a method, it does not go here.
// ============================================

export interface HisabcheBridge {
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
    /**
     * Delete rows the SERVER deleted. A row still carrying an unsent local edit
     * (`dirty = 1`) is kept: that edit exists nowhere else, and the push will
     * surface the conflict. Returns how many rows were removed.
     */
    removeMany(table: LocalTable, ids: string[]): Promise<number>
    enqueue(input: {
      entity: LocalTable
      operation: 'create' | 'update' | 'delete'
      clientId: string
      payload: Record<string, unknown>
    }): Promise<void>
    queue(): Promise<QueueEntry[]>
    resolveQueue(clientId: string, status: 'done' | 'failed', error?: string): Promise<void>
    /**
     * Point the local cache at a workspace, discarding another workspace's
     * cached rows first.
     *
     * Refuses (and reports `blockedByPendingMutations`) when unsynced offline
     * mutations are queued — those exist nowhere but this device.
     */
    setWorkspace(workspaceId: string): Promise<{
      purged: boolean
      blockedByPendingMutations: number
    }>
  }
  print: {
    html(input: {
      html: string
      landscape?: boolean
      silent?: boolean
      deviceName?: string
      pageWidthMm?: number
      copies?: number
    }): Promise<boolean>
    /** The printers this machine has. Empty where the host cannot list them. */
    listPrinters(): Promise<Array<{ name: string; displayName: string; isDefault: boolean }>>
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
    checkUpdates(): Promise<UpdateStatus>
    downloadUpdate(): Promise<UpdateStatus>
    /** Quits and runs the installer. Ask before calling. */
    installUpdate(): Promise<{ ok: boolean }>
    /**
     * Download progress, pushed from main.
     *
     * ⚠️ Returns its own unsubscribe. Without it every mount of the settings
     * screen adds another listener to the same singleton emitter, and the
     * progress bar jumps as N copies of each event arrive.
     */
    onUpdateStatus(listener: (status: UpdateStatus) => void): () => void
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
