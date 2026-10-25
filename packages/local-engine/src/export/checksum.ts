// ============================================
// packages/local-engine/src/export/checksum.ts
//
// Platform-agnostic cryptographic hash utilities for migration export packages.
// Uses @noble/hashes (pure JS, Hermes-compatible, zero Node dependencies).
// ============================================

import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'

/** Deterministic JSON stringify with sorted object keys. */
export function canonicalJson(data: unknown): string {
  if (data === null || data === undefined) return 'null'
  if (typeof data !== 'object') return JSON.stringify(data)
  if (Array.isArray(data)) {
    return '[' + data.map(canonicalJson).join(',') + ']'
  }
  const keys = Object.keys(data as Record<string, unknown>).sort()
  const entries = keys.map((key) => {
    const val = (data as Record<string, unknown>)[key]
    return JSON.stringify(key) + ':' + canonicalJson(val)
  })
  return '{' + entries.join(',') + '}'
}

/** Compute SHA-256 hash of any JSON-serializable value. */
export function sha256Hex(data: unknown): string {
  const text = typeof data === 'string' ? data : canonicalJson(data)
  return bytesToHex(sha256(utf8ToBytes(text)))
}
