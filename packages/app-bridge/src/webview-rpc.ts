// ============================================
// The WebView transport — how a browser engine with no Node reaches its
// React Native host.
//
// ⚠️ ELECTRON HAS A CHANNEL; A WEBVIEW HAS A POSTBOX.
//
// `contextBridge` hands the renderer real functions that return promises.
// A WebView has one primitive instead: `postMessage`, fire-and-forget, string
// in and string out. So the bridge the UI sees — `HisabcheBridge`, promises
// and all — has to be RECONSTRUCTED on top of it: every call gets an id, the
// caller parks a promise under that id, and the host answers with the same
// id. That correlation is the entire protocol and it lives here, so the two
// sides cannot disagree about it.
//
// What this is NOT: a second bridge contract. The methods, the payloads and
// the return types are `HisabcheBridge` exactly. This file only carries them.
// ============================================

import { z } from 'zod'

/**
 * Injected before the page's own scripts run.
 *
 * ⚠️ IT MUST BE BEFORE. The shared UI reads `window.hisabche` while deciding
 * whether it has a host at all (`hasBridge()`), and a store rehydrates from
 * `secure.get` during module init. A bridge installed after first paint is a
 * bridge the app has already concluded does not exist — the same class of bug
 * as announcing token readiness before the token exists.
 */
export const BRIDGE_GLOBAL = 'hisabche'

/** A call travelling from the WebView to the native host. */
export const rpcRequestSchema = z.object({
  /** Correlates the answer with the caller's parked promise. */
  id: z.string().min(1).max(64),
  /** Dotted path into the bridge: `secure.get`, `db.query`, `print.html`. */
  method: z.string().min(1).max(64),
  /** The method's arguments, exactly as `HisabcheBridge` declares them. */
  args: z.array(z.unknown()).max(4),
})

export type RpcRequest = z.infer<typeof rpcRequestSchema>

/**
 * The answer.
 *
 * ⚠️ AN ERROR IS A RESULT, NOT A SILENCE. A host that simply never answers a
 * failed call leaves the UI's promise pending forever, and the screen sits on
 * a spinner with nothing in the console — the failure mode this codebase has
 * hit repeatedly (راهنمای سشن §۷٫۶). Every request gets exactly one response.
 */
export interface RpcResponse {
  id: string
  ok: boolean
  /** Present when `ok`. */
  value?: unknown
  /** Present when not `ok` — a message the UI can show a person. */
  error?: string
}

/** A message pushed by the host with no request behind it, e.g. update status. */
export interface RpcEvent {
  event: string
  payload: unknown
}

export function isRpcEvent(message: unknown): message is RpcEvent {
  return typeof message === 'object' && message !== null && 'event' in message
}

/**
 * Every method the WebView host answers, as dotted paths.
 *
 * ⚠️ AN ALLOW-LIST, NOT A CONVENIENCE. The host receives a method NAME from a
 * page: without this, a compromised page could ask for any path it can spell.
 * Desktop has the same rule — main re-validates every channel — and the two
 * must not diverge.
 */
export const WEBVIEW_METHODS = [
  'secure.get',
  'secure.set',
  'secure.delete',
  'db.query',
  'db.upsertMany',
  'db.removeMany',
  'db.enqueue',
  'db.queue',
  'db.resolveQueue',
  'db.setWorkspace',
  'print.html',
  'print.escPos',
  'print.listPrinters',
  'files.export',
  'files.import',
  'window.control',
  'app.info',
  'app.checkUpdates',
  'app.downloadUpdate',
  'app.installUpdate',
  'http.request',
] as const

export type WebViewMethod = (typeof WEBVIEW_METHODS)[number]

export function isWebViewMethod(value: string): value is WebViewMethod {
  return (WEBVIEW_METHODS as readonly string[]).includes(value)
}
