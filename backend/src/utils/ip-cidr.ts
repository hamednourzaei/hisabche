// ============================================
// backend/src/utils/ip-cidr.ts
//
// Pure address matching for the admin IP allow-list (V63 · S-5).
//
// No dependency, no network. IPv4 is compared as 32-bit integers and IPv6 as
// 128-bit integers; a bare address is treated as a /32 or /128. A malformed
// entry matches NOTHING — a typo must lock nobody in and nobody out by
// accident, and the service reports the bad entry instead.
// ============================================

import { isIP } from 'node:net'

function ipv4ToBigInt(address: string): bigint | null {
  const parts = address.split('.')
  if (parts.length !== 4) return null
  let value = 0n
  for (const part of parts) {
    const octet = Number(part)
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null
    value = (value << 8n) | BigInt(octet)
  }
  return value
}

function ipv6ToBigInt(address: string): bigint | null {
  let text = address
  // A zone index (`fe80::1%eth0`) is not part of the address.
  const zone = text.indexOf('%')
  if (zone !== -1) text = text.slice(0, zone)

  // An embedded IPv4 tail (`::ffff:192.0.2.1`) is converted to two groups.
  const lastColon = text.lastIndexOf(':')
  const tail = text.slice(lastColon + 1)
  if (tail.includes('.')) {
    const v4 = ipv4ToBigInt(tail)
    if (v4 === null) return null
    const high = Number((v4 >> 16n) & 0xffffn).toString(16)
    const low = Number(v4 & 0xffffn).toString(16)
    text = `${text.slice(0, lastColon + 1)}${high}:${low}`
  }

  const halves = text.split('::')
  if (halves.length > 2) return null

  const head = halves[0] ? halves[0].split(':') : []
  const tailGroups = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - tailGroups.length
  if (halves.length === 2 && missing < 0) return null
  if (halves.length === 1 && head.length !== 8) return null

  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tailGroups]
  if (groups.length !== 8) return null

  let value = 0n
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null
    value = (value << 16n) | BigInt(parseInt(group, 16))
  }
  return value
}

function toBigInt(address: string): { value: bigint; family: 4 | 6 } | null {
  const family = isIP(address)
  if (family === 4) {
    const value = ipv4ToBigInt(address)
    return value === null ? null : { value, family: 4 }
  }
  if (family === 6) {
    const value = ipv6ToBigInt(address)
    return value === null ? null : { value, family: 6 }
  }
  return null
}

/**
 * True when `address` is inside `cidr` (or equals it, for a bare address).
 * A malformed address or entry is `false` — never an exception, so a bad row
 * cannot crash an admin request.
 */
export function ipInCidr(address: string, cidr: string): boolean {
  const target = toBigInt(address.trim())
  if (!target) return false

  const [network, prefixRaw] = cidr.trim().split('/')
  if (!network) return false

  const base = toBigInt(network)
  if (!base || base.family !== target.family) return false

  const bits = target.family === 4 ? 32 : 128
  const prefix = prefixRaw === undefined ? bits : Number(prefixRaw)
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) return false

  if (prefix === 0) return true
  const shift = BigInt(bits - prefix)
  return target.value >> shift === base.value >> shift
}

/** True when at least one entry matches. An empty list matches nothing. */
export function ipMatchesAny(address: string, cidrs: readonly string[]): boolean {
  return cidrs.some((cidr) => ipInCidr(address, cidr))
}

/**
 * Validate an allow-list entry as it is TYPED, not as it is matched: a family
 * that parses, and a prefix inside that family's length. Used by the route so a
 * typo is refused with a sentence instead of a 500 from the database.
 */
export function isValidCidrEntry(cidr: string): boolean {
  const trimmed = cidr.trim()
  if (trimmed.length === 0) return false
  const [network, prefixRaw] = trimmed.split('/')
  if (!network) return false
  const base = toBigInt(network)
  if (!base) return false
  if (prefixRaw === undefined) return true
  const bits = base.family === 4 ? 32 : 128
  const prefix = Number(prefixRaw)
  return Number.isInteger(prefix) && prefix >= 0 && prefix <= bits
}
