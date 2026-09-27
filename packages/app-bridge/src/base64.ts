// ============================================
// Bytes over a JSON channel.
//
// The Android host talks to the WebView through `postMessage` strings (JSON).
// A Uint8Array serialised as JSON becomes {"0":72,"1":83,…} — or nothing — so
// a binary HTTP body (Hisabche Sync Binary) crosses that bridge as base64.
// Desktop does not need this: Electron IPC carries a Uint8Array as is.
//
// Hand-written on purpose: `btoa`/`atob` are not guaranteed on every Hermes
// version the app runs on, and they take «binary strings», a classic source
// of silent corruption above 0x7F.
// ============================================

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const LOOKUP = new Int16Array(128).fill(-1)
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i

export function bytesToBase64(bytes: Uint8Array): string {
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!
    out +=
      ALPHABET[(n >> 18) & 63]! +
      ALPHABET[(n >> 12) & 63]! +
      ALPHABET[(n >> 6) & 63]! +
      ALPHABET[n & 63]!
  }
  const rest = bytes.length - i
  if (rest === 1) {
    const n = bytes[i]! << 16
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]! + '=='
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8)
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]! + ALPHABET[(n >> 6) & 63]! + '='
  }
  return out
}

export function base64ToBytes(value: string): Uint8Array {
  const clean = value.replace(/[^A-Za-z0-9+/]/g, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let o = 0
  for (let i = 0; i < clean.length; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)]!
    const b = LOOKUP[clean.charCodeAt(i + 1)]!
    const c = i + 2 < clean.length ? LOOKUP[clean.charCodeAt(i + 2)]! : 0
    const d = i + 3 < clean.length ? LOOKUP[clean.charCodeAt(i + 3)]! : 0
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error('invalid base64')
    const n = (a << 18) | (b << 12) | (c << 6) | d
    if (o < out.length) out[o++] = (n >> 16) & 255
    if (i + 2 < clean.length && o < out.length) out[o++] = (n >> 8) & 255
    if (i + 3 < clean.length && o < out.length) out[o++] = n & 255
  }
  return out
}
