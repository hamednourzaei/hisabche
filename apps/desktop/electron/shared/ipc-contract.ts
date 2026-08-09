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
  dbEnqueue: 'db:enqueue',
  dbQueue: 'db:queue',
  dbResolveQueue: 'db:resolveQueue',

  // Native capabilities
  printHtml: 'print:html',
  printEscPos: 'print:escpos',
  exportFile: 'file:export',
  importFile: 'file:import',

  // Window / app
  windowControl: 'window:control',
  appInfo: 'app:info',
  checkUpdates: 'app:checkUpdates',

  // Outbound HTTP (main-process proxy: renders without browser CORS)
  httpRequest: 'http:request',
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

export const printHtmlSchema = z.object({
  html: z.string().max(2_000_000),
  landscape: z.boolean().default(false),
  silent: z.boolean().default(false),
  deviceName: z.string().max(200).optional(),
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
})

export interface HttpRequestResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  data: string
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
}

export interface ImportedFile {
  fileName: string
  /** base64 contents; the renderer decides how to parse it. */
  content: string
}
