// ============================================
// The Android/iOS half of the bridge.
//
// ⚠️ THIS IS A HOST, NOT A UI.
//
// Nothing here renders anything. It answers the same `HisabcheBridge` calls
// Electron's main process answers, using Expo's native modules instead of
// Node — so the shared UI cannot tell which machine it is running on, which
// is the whole point of the architecture.
//
// Every method is looked up by name from an allow-list in
// `@hisabche/app-bridge`; a name the list does not contain is refused before
// anything native is touched, exactly as `electron/main/ipc/register.ts`
// re-validates each channel.
// ============================================

import * as FileSystem from 'expo-file-system'
import * as Print from 'expo-print'
import * as SecureStore from 'expo-secure-store'
import * as Sharing from 'expo-sharing'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import {
  isWebViewMethod,
  type AppInfo,
  type HttpRequestResponse,
  type ImportedFile,
  type LocalTable,
  type QueueEntry,
  type RpcRequest,
  type RpcResponse,
} from '@hisabche/app-bridge'

import * as localDb from './local-db'

// ─── secure storage ───────────────────────────────────────────────────────
//
// ⚠️ SecureStore keys are restricted to [A-Za-z0-9._-]. The shared UI writes
// keys like `hisabche:token`, which SecureStore REJECTS at runtime — and a
// rejected write looks exactly like a user who is not signed in.
const secureKey = (key: string): string => key.replace(/[^A-Za-z0-9._-]/g, '_')

const secure = {
  get: (key: string): Promise<string | null> => SecureStore.getItemAsync(secureKey(key)),
  set: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(secureKey(key), value)
  },
  delete: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(secureKey(key))
  },
}

// ─── local cache and write queue ──────────────────────────────────────────
//
// ⚠️ BOTH LIVE NATIVELY, NOT IN THE WEBVIEW. Android reclaims a backgrounded
// WebView whenever it wants; a queue of invoices written offline has to
// survive exactly that, and so does the cache the app reads with no signal.
//
// ⚠️ ONE QUEUE, AND IT IS SQLITE'S.
//
// Until this build the queue was a zustand store in AsyncStorage while the
// shared UI queued through `db.enqueue`. Two queues means an invoice written
// on the old build is invisible to the drain — `migrateLegacyOutbox()` moves
// whatever the old store still holds, once, before the first drain.
const db = {
  query: <T>(input: {
    table: LocalTable
    search?: string
    where?: Record<string, string | number | boolean | null>
    orderBy?: string
    direction?: 'asc' | 'desc'
    limit?: number
    offset?: number
  }): Promise<T[]> =>
    localDb.query<T>({
      table: input.table,
      // The defaults are the contract's, not this host's: `dbQuerySchema`
      // applies the same ones on the desktop side, and a page that omits
      // `limit` must get the same page size on both.
      direction: input.direction ?? 'desc',
      limit: input.limit ?? 100,
      offset: input.offset ?? 0,
      ...(input.search !== undefined ? { search: input.search } : {}),
      ...(input.where !== undefined ? { where: input.where } : {}),
      ...(input.orderBy !== undefined ? { orderBy: input.orderBy } : {}),
    }),

  upsertMany: (table: LocalTable, rows: Array<Record<string, unknown>>): Promise<number> =>
    localDb.upsertMany(table, rows),
  removeMany: (table: LocalTable, ids: string[]): Promise<number> => localDb.removeMany(table, ids),

  enqueue: (input: {
    entity: LocalTable
    operation: 'create' | 'update' | 'delete'
    clientId: string
    payload: Record<string, unknown>
  }): Promise<void> => localDb.enqueue(input),

  queue: (): Promise<QueueEntry[]> => localDb.queue(),

  resolveQueue: (clientId: string, status: 'done' | 'failed', error?: string): Promise<void> =>
    localDb.resolveQueue(clientId, status, error),

  setWorkspace: (
    workspaceId: string,
  ): Promise<{ purged: boolean; blockedByPendingMutations: number }> =>
    localDb.setWorkspace(workspaceId),
}

// ─── printing ─────────────────────────────────────────────────────────────
const print = {
  html: async (input: { html: string; landscape?: boolean }): Promise<boolean> => {
    await Print.printAsync({
      html: input.html,
      ...(input.landscape ? { orientation: Print.Orientation.landscape } : {}),
    })
    return true
  },
  // ESC/POS needs a USB or Bluetooth printer session that Expo Go cannot open.
  // Refusing is honest; silently returning true would tell the user a receipt
  // printed when nothing did.
  escPos: (): Promise<boolean> => {
    throw new Error('receipt printing needs a paired printer, which this build cannot open yet')
  },
  // The Android print service picks the printer in its own dialog; this build
  // has no list to offer, and says so with an empty one rather than a guess.
  listPrinters: async (): Promise<
    Array<{ name: string; displayName: string; isDefault: boolean }>
  > => [],
}

// ─── files ────────────────────────────────────────────────────────────────
const files = {
  export: async (input: {
    suggestedName: string
    content: string
    encoding?: 'utf8' | 'base64'
  }): Promise<string | null> => {
    const dir = FileSystem.cacheDirectory
    if (!dir) return null
    const uri = dir + input.suggestedName
    await FileSystem.writeAsStringAsync(uri, input.content, {
      encoding:
        input.encoding === 'base64' ? FileSystem.EncodingType.Base64 : FileSystem.EncodingType.UTF8,
    })
    // Android has no «save to a path the user typed». The share sheet is how a
    // file leaves an app, and the user picks Drive, Telegram or Files there.
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri)
    return uri
  },
  import: (): Promise<ImportedFile | null> => {
    throw new Error('file import is not available on this host yet')
  },
}

// ─── the window is not ours to control ────────────────────────────────────
const windowControl = async (): Promise<void> => {
  // Android decides its own window. The shared UI already hides these controls
  // when `app.info().platform` is not desktop.
}

// ─── app ──────────────────────────────────────────────────────────────────
const app = {
  info: async (): Promise<AppInfo> =>
    ({
      version: (Constants.expoConfig?.version as string | undefined) ?? '0.0.0',
      platform: Platform.OS,
      // Updates arrive through the store, not an in-app installer.
      updatesSupported: false,
    }) as unknown as AppInfo,
  checkUpdates: async () => ({ state: 'not-available' }) as never,
  downloadUpdate: async () => ({ state: 'not-available' }) as never,
  installUpdate: async () => ({ ok: false }),
}

// ─── http ─────────────────────────────────────────────────────────────────
//
// ⚠️ THE REQUEST LEAVES THE APP, NOT THE PAGE. A page served from
// `file://android_asset` has a null origin: every call to api.hisabche.com
// would be a cross-origin request from an origin no CORS list can name. The
// native side has no such rule, which is the same reason desktop routes HTTP
// through main.
const http = {
  request: async (input: {
    url: string
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    headers?: Record<string, string>
    body?: string | null
  }): Promise<HttpRequestResponse> => {
    const response = await fetch(input.url, {
      method: input.method,
      ...(input.headers ? { headers: input.headers } : {}),
      ...(input.body != null ? { body: input.body } : {}),
    })
    const data = await response.text()
    const headers: Record<string, string> = {}
    response.headers.forEach((value: string, key: string) => {
      headers[key] = value
    })
    // The shape is the contract's, field for field — `data`, not `body`, and
    // `statusText` carried through. A host that answers a slightly different
    // object is a host the shared UI reads wrong while tsc stays quiet.
    return { status: response.status, statusText: response.statusText, headers, data }
  },
}

const HANDLERS: Record<string, (...args: never[]) => unknown> = {
  'secure.get': secure.get as never,
  'secure.set': secure.set as never,
  'secure.delete': secure.delete as never,
  'db.query': db.query as never,
  'db.upsertMany': db.upsertMany as never,
  'db.removeMany': db.removeMany as never,
  'db.enqueue': db.enqueue as never,
  'db.queue': db.queue as never,
  'db.resolveQueue': db.resolveQueue as never,
  'db.setWorkspace': db.setWorkspace as never,
  'print.html': print.html as never,
  'print.escPos': print.escPos as never,
  'print.listPrinters': print.listPrinters as never,
  'files.export': files.export as never,
  'files.import': files.import as never,
  'window.control': windowControl as never,
  'app.info': app.info as never,
  'app.checkUpdates': app.checkUpdates as never,
  'app.downloadUpdate': app.downloadUpdate as never,
  'app.installUpdate': app.installUpdate as never,
  'http.request': http.request as never,
}

/**
 * Answer one call from the page.
 *
 * ⚠️ ALWAYS ANSWERS. A thrown error becomes `{ ok: false, error }`; dropping
 * it would leave the UI's promise pending forever and the screen on a spinner
 * with a silent console.
 */
export async function handleBridgeCall(request: RpcRequest): Promise<RpcResponse> {
  if (!isWebViewMethod(request.method)) {
    return { id: request.id, ok: false, error: `unknown bridge method: ${request.method}` }
  }

  const handler = HANDLERS[request.method]
  if (!handler) {
    return { id: request.id, ok: false, error: `${request.method} has no implementation` }
  }

  try {
    const value = await (handler as (...args: unknown[]) => unknown)(...request.args)
    return { id: request.id, ok: true, value }
  } catch (error) {
    return {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
