// ============================================
// apps/desktop/electron/main/protocol.ts
//
// V62 Slice 8 — Privileged custom protocol (`hisabche-app://`) for serving
// renderer assets from two roots:
//   1. bundled renderer directory first (`out/renderer/`)
//   2. verified on-disk PackStore (`userData/packs/<buildId>/`) second
//
// Replaces `file://` ONLY when `packs.delivery=on`, eliminating `file://`
// absolute-path and `crossorigin` traps while keeping path-traversal and
// manifest-verification guarantees strict.
// ============================================

import fs from 'node:fs'
import path from 'node:path'

import { net, protocol } from 'electron'
import { pathToFileURL } from 'node:url'
import { PackStore } from '@hisabche/app-bridge/packs-node'
import { safeJoinRoot } from '@hisabche/app-bridge/packs-verify'

export const APP_PROTOCOL_SCHEME = 'hisabche-app'
export const APP_PROTOCOL_ORIGIN = `${APP_PROTOCOL_SCHEME}://app`

export function buildRendererCsp(includeAppOrigin: boolean): string {
  const selfOrOrigin = includeAppOrigin ? `'self' ${APP_PROTOCOL_ORIGIN}` : "'self'"
  return (
    `default-src ${selfOrOrigin}; ` +
    `script-src ${selfOrOrigin}; ` +
    `style-src ${selfOrOrigin} 'unsafe-inline'; ` +
    `img-src ${selfOrOrigin} data: blob: https:; ` +
    `font-src ${selfOrOrigin} data:; ` +
    `connect-src ${selfOrOrigin} https: wss:;`
  )
}

export function registerAppProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_PROTOCOL_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ])
}

/**
 * Pure asset path resolver: bundled-first, then verified PackStore.
 * Refuses path traversal (`..`, backslash, NUL) and unverified pack files.
 */
export function resolvePackProtocolFile(opts: {
  requestUrl: string
  bundledRoot: string
  packStore?: PackStore | null
  buildId?: string | null
}): string | null {
  let url: URL
  try {
    url = new URL(opts.requestUrl)
  } catch {
    return null
  }
  if (url.protocol !== `${APP_PROTOCOL_SCHEME}:` || url.hostname !== 'app') {
    return null
  }

  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
  if (rel === '' || rel === '/') rel = 'index.html'

  let bundledCandidate: string
  try {
    bundledCandidate = safeJoinRoot(opts.bundledRoot, rel)
  } catch {
    return null
  }

  if (fs.existsSync(bundledCandidate) && fs.statSync(bundledCandidate).isFile()) {
    return bundledCandidate
  }

  if (opts.packStore && opts.buildId) {
    try {
      return opts.packStore.resolveVerifiedAsset(opts.buildId, rel)
    } catch {
      return null
    }
  }

  return null
}

export function registerAppProtocolHandler(opts: {
  bundledRoot: string
  packStore: PackStore
  getBuildId: () => string | null
}): void {
  protocol.handle(APP_PROTOCOL_SCHEME, (request) => {
    const resolved = resolvePackProtocolFile({
      requestUrl: request.url,
      bundledRoot: path.resolve(opts.bundledRoot),
      packStore: opts.packStore,
      buildId: opts.getBuildId(),
    })

    if (!resolved) {
      return new Response('Not Found', { status: 404 })
    }

    return net.fetch(pathToFileURL(resolved).toString())
  })
}
