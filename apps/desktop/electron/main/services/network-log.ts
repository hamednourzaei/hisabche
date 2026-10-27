// ============================================
// The outbound network log — every attempt, on disk.
//
// ⚠️ WHY A FILE.
//
// The only network log was a `console.warn` in the main process. In a
// PACKAGED Windows app the console goes nowhere: there is no terminal
// attached to a double-clicked installer, and nothing is written to disk. The
// owner could not read it, could not send it, and «the app made no request»
// was an assertion nobody could check.
//
// The log answers the second question of Gate 5 — «it never tried to reach
// the internet» — which is not the same question as «it worked without
// internet». A run in which the app TRIED and failed must be visibly
// different from a run in which it never tried at all.
//
// The file is written under the app's own data folder:
//
//     %APPDATA%\\@hisabche\\desktop\\logs\\network-offline.log
//
// It is RE-CREATED at every start (one header line with the time), so a run
// that made no attempt leaves exactly one line behind — and that line is the
// proof. Attempts are appended under it.
// ============================================

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import dns from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { app, session } from 'electron'

const LOG_DIR = 'logs'
const LOG_FILE = 'network-offline.log'

let logPath: string | null = null
let attemptCount = 0
let hooksInstalled = false

/** The full path of the log file, or null before the log is started. */
export function networkLogPath(): string | null {
  return logPath
}

/** How many outbound attempts have been recorded in this run. */
export function networkLogCount(): number {
  return attemptCount
}

/**
 * Record one outbound attempt.
 *
 * Exported so a test can prove the file is written without reaching the
 * network, and so any other part of the main process can add a line it
 * knows about.
 */
export function recordNetworkAttempt(source: string, detail: string): void {
  if (!logPath) return
  attemptCount += 1
  const line = `${new Date().toISOString()} [${source}] ${detail}\n`
  try {
    appendFileSync(logPath, line, 'utf8')
  } catch {
    // A log that cannot be written must never break the app it describes.
  }
}

/** The host of a request, however it was addressed. */
function describeRequest(target: unknown): string {
  if (typeof target === 'string') return target
  if (target && typeof target === 'object') {
    const options = target as { host?: unknown; hostname?: unknown; port?: unknown; path?: unknown }
    const host = options.host ?? options.hostname
    if (typeof host === 'string') {
      const port = options.port ? `:${String(options.port)}` : ''
      const path = typeof options.path === 'string' ? options.path : ''
      return `${host}${port}${path}`
    }
  }
  return 'unknown'
}

/** The host of a socket connection. */
function describeConnect(target: unknown): string {
  if (typeof target === 'string') return target
  if (target && typeof target === 'object') {
    const options = target as { host?: unknown; port?: unknown }
    if (typeof options.host === 'string') {
      return options.port ? `${options.host}:${String(options.port)}` : options.host
    }
  }
  return 'unknown'
}

/**
 * Install the Node-level hooks.
 *
 * ⚠️ `webRequest` ALONE IS NOT ENOUGH.
 *
 * `session.webRequest` sees Chromium's traffic — the renderer's. It does NOT
 * see the main process's own Node traffic: the renderer→main HTTP proxy
 * (`services/http.ts` uses `fetch`), the updater (`electron-updater` uses
 * Node's https) and Sentry. Those are the paths that actually leave the
 * device in an Electron app, so they are hooked here as well:
 *
 *   dns.lookup / dns.promises.lookup  → the name being resolved
 *   http.request / http.get           → a plain HTTP request
 *   https.request / https.get         → a TLS request
 *   net.connect / net.createConnection → a raw socket
 *   globalThis.fetch                  → undici, which bypasses http.request
 *
 * The hooks LOG; they do not block. Blocking is the firewall's job, and a
 * log that throws would hide the very attempt it was written to record.
 */
function installNodeHooks(): void {
  // ⚠️ ONCE. A second install would wrap the wrappers, and the chain would
  // end at the first one — every attempt would be written several times.
  if (hooksInstalled) return
  hooksInstalled = true

  const originalLookup = dns.lookup
  dns.lookup = ((...args: Parameters<typeof dns.lookup>) => {
    recordNetworkAttempt('dns', `lookup ${String(args[0])}`)
    return originalLookup(...args)
  }) as typeof dns.lookup

  const originalPromisesLookup = dns.promises.lookup
  dns.promises.lookup = ((...args: Parameters<typeof dns.promises.lookup>) => {
    recordNetworkAttempt('dns', `lookup ${String(args[0])}`)
    return originalPromisesLookup(...args)
  }) as typeof dns.promises.lookup

  const originalHttpRequest = http.request
  http.request = ((...args: Parameters<typeof http.request>) => {
    recordNetworkAttempt('http', describeRequest(args[0]))
    return originalHttpRequest(...args)
  }) as typeof http.request

  const originalHttpGet = http.get
  http.get = ((...args: Parameters<typeof http.get>) => {
    recordNetworkAttempt('http', describeRequest(args[0]))
    return originalHttpGet(...args)
  }) as typeof http.get

  const originalHttpsRequest = https.request
  https.request = ((...args: Parameters<typeof https.request>) => {
    recordNetworkAttempt('https', describeRequest(args[0]))
    return originalHttpsRequest(...args)
  }) as typeof https.request

  const originalHttpsGet = https.get
  https.get = ((...args: Parameters<typeof https.get>) => {
    recordNetworkAttempt('https', describeRequest(args[0]))
    return originalHttpsGet(...args)
  }) as typeof https.get

  const originalConnect = net.connect
  net.connect = ((...args: Parameters<typeof net.connect>) => {
    recordNetworkAttempt('net', `connect ${describeConnect(args[0])}`)
    return originalConnect(...args)
  }) as typeof net.connect

  const originalCreateConnection = net.createConnection
  net.createConnection = ((...args: Parameters<typeof net.createConnection>) => {
    recordNetworkAttempt('net', `connect ${describeConnect(args[0])}`)
    return originalCreateConnection(...args)
  }) as typeof net.createConnection

  const originalFetch = globalThis.fetch
  // ⚠️ NOT EVERY RUNTIME HAS ONE. A renderer-less test environment (jsdom)
  // has no `fetch`, and wrapping `undefined` would turn every later call
  // into a crash.
  if (typeof originalFetch === 'function') {
    globalThis.fetch = ((
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      recordNetworkAttempt('fetch', url)
      return originalFetch(input, init)
    }) as typeof globalThis.fetch
  }
}

/**
 * Start the log: create the file, write the header, install the hooks.
 *
 * Called as the FIRST thing the main process does when it is ready, so that
 * even the crash reporter's own start-up call is on record.
 */
export function initNetworkLog(): void {
  try {
    const dir = join(app.getPath('userData'), LOG_DIR)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    logPath = join(dir, LOG_FILE)
    // One run, one file: the header line is the timestamp of the run, and a
    // run that made no attempt leaves exactly this line behind.
    writeFileSync(logPath, `# hisabche network log — started ${new Date().toISOString()}\n`, 'utf8')
    attemptCount = 0
  } catch {
    // No log is better than a crash at start-up.
    logPath = null
    return
  }

  installNodeHooks()

  try {
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      recordNetworkAttempt('webRequest', `${details.method} ${details.url}`)
      callback({})
    })
  } catch {
    // Chromium's hook is a bonus; the Node hooks above are the ones that
    // catch the main process's own traffic.
  }
}
