// ============================================
// The outbound network log — a FILE, not a console line.
//
// ⚠️ WHAT IS BEING PROVED.
//
// The log is the answer to «the app never tried to reach the internet»,
// which is a DIFFERENT fact from «the app worked without internet». For it
// to be worth anything it must:
//
//   1. exist on disk, at the path the owner is told to look at;
//   2. carry a header line with the time the run started, so a run that made
//      NO attempt leaves exactly one line behind;
//   3. record every attempt — Chromium's (webRequest) AND the main
//      process's own Node traffic (dns, http, https, net, fetch), which
//      webRequest never sees.
// ============================================

import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import dns from 'node:dns'

let userDataDir = ''
let webRequestListener:
  ((details: { url: string; method: string }, callback: (r: object) => void) => void) | null = null

jest.mock('electron', () => ({
  app: {
    getPath: () => userDataDir,
  },
  session: {
    defaultSession: {
      webRequest: {
        onBeforeRequest: (
          listener: (
            details: { url: string; method: string },
            callback: (r: object) => void,
          ) => void,
        ) => {
          webRequestListener = listener
        },
      },
    },
  },
}))

import {
  initNetworkLog,
  networkLogCount,
  networkLogPath,
  recordNetworkAttempt,
} from '../main/services/network-log'

function readLog(): string {
  const path = networkLogPath()
  if (!path) throw new Error('NO_LOG_PATH')
  return readFileSync(path, 'utf8')
}

beforeEach(() => {
  userDataDir = mkdtempSync(join(tmpdir(), 'hisabche-network-log-'))
  webRequestListener = null
})

// jsdom has no `fetch`, and the main process's own traffic is exactly what
// `webRequest` cannot see — so the hook is installed over a stub, before the
// log is started for the first time.
beforeAll(() => {
  globalThis.fetch = jest.fn(async () => ({ ok: true }) as Response)
})

describe('the log file', () => {
  it('is created under the app data folder, in a logs folder', () => {
    initNetworkLog()

    const path = networkLogPath()
    expect(path).not.toBeNull()
    expect(path).toBe(join(userDataDir, 'logs', 'network-offline.log'))
    expect(existsSync(path as string)).toBe(true)
  })

  it('starts with one line carrying the time of the run', () => {
    initNetworkLog()

    const content = readLog()
    const lines = content.split('\n').filter((line) => line.length > 0)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('started')
    // A timestamp, not a word: 2026-10-20T…
    expect(lines[0]).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('is re-created on every start, so a run with no attempt leaves one line', () => {
    initNetworkLog()
    recordNetworkAttempt('test', 'an attempt from a previous run')

    initNetworkLog()

    const lines = readLog()
      .split('\n')
      .filter((line) => line.length > 0)
    expect(lines).toHaveLength(1)
    expect(networkLogCount()).toBe(0)
  })
})

describe('what is recorded', () => {
  it('an attempt is appended with its time and its source', () => {
    initNetworkLog()

    recordNetworkAttempt('dns', 'lookup api.hisabche.com')

    const content = readLog()
    expect(content).toContain('[dns] lookup api.hisabche.com')
    expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[dns\]/)
    expect(networkLogCount()).toBe(1)
  })

  it("Chromium's traffic is recorded too", () => {
    initNetworkLog()

    expect(webRequestListener).not.toBeNull()
    webRequestListener?.({ url: 'https://api.hisabche.com/api/products', method: 'GET' }, () => {})

    expect(readLog()).toContain('[webRequest] GET https://api.hisabche.com/api/products')
  })

  it("the main process's own DNS lookups are recorded — webRequest never sees them", async () => {
    initNetworkLog()

    await new Promise<void>((resolve) => {
      dns.lookup('localhost', () => resolve())
    })

    expect(readLog()).toContain('[dns] lookup localhost')
  })

  it("the main process's own fetch is recorded — it bypasses http.request", async () => {
    initNetworkLog()

    // 127.0.0.1 on a closed port: the attempt happens, the answer does not.
    // The log is written BEFORE the request is made, which is the point.
    await fetch('http://127.0.0.1:1/').catch(() => undefined)

    expect(readLog()).toContain('[fetch] http://127.0.0.1:1/')
  })
})
