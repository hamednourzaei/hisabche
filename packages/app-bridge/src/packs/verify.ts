// ============================================
// packages/app-bridge/src/packs/verify.ts
//
// V62 Slice 8 — Cryptographic verification & path-traversal guard (Node/Electron).
// ============================================

import { createHash, verify as cryptoVerify } from 'node:crypto'
import path from 'node:path'

export function sha256Hex(bytes: Uint8Array | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex').toLowerCase()
}

export function verifyFileSha256(bytes: Uint8Array | Buffer, expectedSha256: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) return false
  return sha256Hex(bytes) === expectedSha256.toLowerCase()
}

/**
 * Verify detached Ed25519 signature over `manifestBytes` against `publicKeyPem`.
 * Returns false on any malformed key, signature, or mismatch.
 */
export function verifyManifestEd25519(
  manifestBytes: Uint8Array | Buffer,
  signatureBase64: string,
  publicKeyPem: string,
): boolean {
  try {
    const sig = Buffer.from(signatureBase64.trim(), 'base64')
    if (sig.length !== 64) return false
    return cryptoVerify(null, Buffer.from(manifestBytes), publicKeyPem, sig)
  } catch {
    return false
  }
}

/**
 * Resolve `relPath` strictly inside `rootDir`. Throws on path traversal or
 * escaping outside `rootDir`.
 */
export function safeJoinRoot(rootDir: string, relPath: string): string {
  const cleanRel = relPath.replace(/^\/+/, '')
  if (cleanRel.includes('\0') || cleanRel.includes('..') || cleanRel.includes('\\')) {
    throw new Error(`PATH_TRAVERSAL_REFUSED:${relPath}`)
  }
  const resolvedRoot = path.resolve(rootDir)
  const resolvedTarget = path.resolve(resolvedRoot, cleanRel)
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(prefix)) {
    throw new Error(`PATH_TRAVERSAL_REFUSED:${relPath}`)
  }
  return resolvedTarget
}
