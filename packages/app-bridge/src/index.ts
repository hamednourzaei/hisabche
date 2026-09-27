// ============================================
// @hisabche/app-bridge — the contract between the shared UI and whatever
// native host is carrying it.
//
// ⚠️ ONE UI, ONE CONTRACT, TWO HOSTS.
//
// `packages/ui` renders in a browser engine — Chromium under Electron on
// Windows, a WebView on Android. Neither engine can do secure storage, a local
// SQLite cache, printing or a file picker, so each host implements THIS
// interface and exposes it as `window.hisabche`.
//
// It lives here, not in `apps/desktop`, because the moment a second host
// exists a contract owned by one of them is not a contract — it is that host's
// private API the other has to guess at. The UI imports the interface; it
// never imports a host.
// ============================================

export * from './contract'
export * from './webview-rpc'
export { webViewBridgeSource } from './webview-client'

// ⚠️ THE LOCAL SCHEMA IS PART OF THE CONTRACT, NOT PART OF A HOST.
//
// Windows mirrors the server into SQLite through better-sqlite3 and Android
// through expo-sqlite. If each kept its own CREATE TABLE the two caches would
// answer the same `db.query` differently — the same product showing a
// different quantity depending on which machine you opened — and nothing in
// either app would ever notice.
export * from './local-schema'

// The cache on disk outlives the build that made it — see the file header.
export * from './local-migrations'
export * from './local-sql'

// Which road a queued write takes — see the file header.
export * from './push-routing'

// Which entry may go now — see the file header.
export * from './push-order'
