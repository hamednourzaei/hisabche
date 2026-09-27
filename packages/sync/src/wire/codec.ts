// ============================================
// Hisabche Sync Binary (HSB) — the value codec.
//
// Why binary, and why this shape (owner's request, 27 Sep 2026, «Binary
// Protocol حتما»). A sync page is hundreds of rows with the SAME column names,
// the same handful of repeated values ('AFN', 'sale', 'pending', an entity
// type) and many UUIDs. JSON repeats every key on every row and spells a UUID
// in 36 characters. This codec:
//
//   * interns strings: the first time a short string appears it is written in
//     full and added to a per-frame table; every later occurrence is a varint
//     index. Keys therefore cost their bytes once per frame, not once per row
//     — the effect of a TL schema without having to maintain one per table.
//   * writes canonical lowercase UUIDs as 16 raw bytes (36 → 17 with the tag).
//   * writes safe integers (money is always integer minor units here) as
//     zig-zag LEB128 varints, and everything else as float64 little-endian.
//
// Round-trips exactly what JSON can carry (null, boolean, number, string,
// array, plain object) plus Uint8Array. Deterministic: encoder and decoder
// build the string table in the same order, so no table is sent.
//
// The decoder runs on the SERVER against untrusted bytes: every length is
// checked against what remains, depth is bounded, and a malformed frame is an
// error — never a partial value.
// ============================================

export type WireValue =
  null | boolean | number | string | Uint8Array | WireValue[] | { [key: string]: WireValue }

const T_NULL = 0x00
const T_FALSE = 0x01
const T_TRUE = 0x02
const T_INT = 0x03
const T_F64 = 0x04
const T_STR_INTERN = 0x05
const T_STR_REF = 0x06
const T_UUID = 0x07
const T_ARRAY = 0x08
const T_MAP = 0x09
const T_BYTES = 0x0a
const T_STR_RAW = 0x0b

/** Strings up to this many UTF-8 bytes are interned. Longer ones are rarely repeated. */
export const INTERN_MAX_BYTES = 64
const MAX_TABLE = 65_536
const MAX_DEPTH = 32

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export class WireError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WireError'
  }
}

/* ── UTF-8 (TextEncoder/Decoder where present; Hermes lacks TextDecoder) ── */

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null
const textDecoder =
  typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: true }) : null

export function utf8Encode(value: string): Uint8Array {
  if (textEncoder) return textEncoder.encode(value)
  const out: number[] = []
  for (let i = 0; i < value.length; i++) {
    let code = value.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const low = value.charCodeAt(i + 1)
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00)
        i++
      }
    }
    if (code < 0x80) out.push(code)
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63))
    else if (code < 0x10000)
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63))
    else
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      )
  }
  return Uint8Array.from(out)
}

export function utf8Decode(bytes: Uint8Array): string {
  if (textDecoder) {
    try {
      return textDecoder.decode(bytes)
    } catch {
      throw new WireError('invalid UTF-8')
    }
  }
  let out = ''
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i++]!
    let code: number
    if (b < 0x80) code = b
    else if (b >= 0xc0 && b < 0xe0) code = ((b & 31) << 6) | (bytes[i++]! & 63)
    else if (b >= 0xe0 && b < 0xf0)
      code = ((b & 15) << 12) | ((bytes[i++]! & 63) << 6) | (bytes[i++]! & 63)
    else if (b >= 0xf0 && b < 0xf8)
      code =
        ((b & 7) << 18) |
        ((bytes[i++]! & 63) << 12) |
        ((bytes[i++]! & 63) << 6) |
        (bytes[i++]! & 63)
    else throw new WireError('invalid UTF-8')
    out += String.fromCodePoint(code)
  }
  return out
}

/** '0'-'9' / 'a'-'f' → 0-15. Only called on strings UUID_RE already accepted. */
const hexNibble = (code: number): number => (code <= 57 ? code - 48 : code - 87)

/** ASCII-only strings skip the UTF-8 encoder: one byte per char, written directly. */
function isAscii(value: string): boolean {
  for (let i = 0; i < value.length; i++) if (value.charCodeAt(i) > 0x7f) return false
  return true
}

/* ── writer ─────────────────────────────────────────────────────────────── */

export class Writer {
  private buf = new Uint8Array(1024)
  private view = new DataView(this.buf.buffer)
  private pos = 0
  private readonly table = new Map<string, number>()

  private ensure(extra: number): void {
    if (this.pos + extra <= this.buf.length) return
    let size = this.buf.length * 2
    while (size < this.pos + extra) size *= 2
    const next = new Uint8Array(size)
    next.set(this.buf.subarray(0, this.pos))
    this.buf = next
    this.view = new DataView(next.buffer)
  }

  byte(value: number): void {
    this.ensure(1)
    this.buf[this.pos++] = value
  }

  raw(bytes: Uint8Array): void {
    this.ensure(bytes.length)
    this.buf.set(bytes, this.pos)
    this.pos += bytes.length
  }

  u32(value: number): void {
    this.ensure(4)
    this.view.setUint32(this.pos, value, true)
    this.pos += 4
  }

  /** Unsigned LEB128, exact for every safe integer (arithmetic, not 32-bit bitwise). */
  varint(value: number): void {
    let v = value
    while (v >= 0x80) {
      this.byte((v % 0x80) + 0x80)
      v = Math.floor(v / 0x80)
    }
    this.byte(v)
  }

  value(value: WireValue, depth = 0): void {
    if (depth > MAX_DEPTH) throw new WireError('value nested too deeply')
    if (value === null || value === undefined) return this.byte(T_NULL)
    if (value === true) return this.byte(T_TRUE)
    if (value === false) return this.byte(T_FALSE)
    if (typeof value === 'number') {
      // |v| < 2^52 so the zig-zag value (≈2|v|) is still a safe integer. Larger
      // safe integers go as float64, which represents every one of them exactly.
      if (Number.isSafeInteger(value) && Math.abs(value) < 2 ** 52 && !Object.is(value, -0)) {
        this.byte(T_INT)
        // zig-zag: 0,-1,1,-2 → 0,1,2,3
        this.varint(value >= 0 ? value * 2 : -value * 2 - 1)
        return
      }
      if (!Number.isFinite(value)) throw new WireError('non-finite number') // JSON cannot carry it either
      this.byte(T_F64)
      this.ensure(8)
      this.view.setFloat64(this.pos, value, true)
      this.pos += 8
      return
    }
    if (typeof value === 'string') return this.string(value)
    if (value instanceof Uint8Array) {
      this.byte(T_BYTES)
      this.varint(value.length)
      this.raw(value)
      return
    }
    if (Array.isArray(value)) {
      this.byte(T_ARRAY)
      this.varint(value.length)
      for (const item of value) this.value(item, depth + 1)
      return
    }
    if (typeof value === 'object') {
      // Like JSON: undefined-valued keys are dropped.
      const entries = Object.entries(value).filter(([, v]) => v !== undefined)
      this.byte(T_MAP)
      this.varint(entries.length)
      for (const [key, item] of entries) {
        this.string(key)
        this.value(item, depth + 1)
      }
      return
    }
    throw new WireError(`cannot encode ${typeof value}`)
  }

  private string(value: string): void {
    const ref = this.table.get(value)
    if (ref !== undefined) {
      this.byte(T_STR_REF)
      this.varint(ref)
      return
    }
    // Length first: the regex only ever runs on 36-character strings.
    if (value.length === 36 && UUID_RE.test(value)) {
      this.byte(T_UUID)
      this.ensure(16)
      for (let i = 0, c = 0; i < 16; i++) {
        if (c === 8 || c === 13 || c === 18 || c === 23) c++
        this.buf[this.pos++] =
          (hexNibble(value.charCodeAt(c)) << 4) | hexNibble(value.charCodeAt(c + 1))
        c += 2
      }
      return
    }
    const ascii = isAscii(value)
    const bytes = ascii ? null : utf8Encode(value)
    const byteLength = bytes ? bytes.length : value.length
    if (byteLength > 0 && byteLength <= INTERN_MAX_BYTES && this.table.size < MAX_TABLE) {
      this.table.set(value, this.table.size)
      this.byte(T_STR_INTERN)
    } else {
      this.byte(T_STR_RAW)
    }
    this.varint(byteLength)
    if (bytes) {
      this.raw(bytes)
      return
    }
    this.ensure(byteLength)
    for (let i = 0; i < byteLength; i++) this.buf[this.pos++] = value.charCodeAt(i)
  }

  finish(): Uint8Array {
    return this.buf.slice(0, this.pos)
  }

  get length(): number {
    return this.pos
  }
}

/* ── reader ─────────────────────────────────────────────────────────────── */

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'))

export class Reader {
  private pos = 0
  private readonly view: DataView
  private readonly table: string[] = []

  constructor(private readonly buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  }

  get remaining(): number {
    return this.buf.length - this.pos
  }

  private need(n: number): void {
    if (n < 0 || this.pos + n > this.buf.length) throw new WireError('truncated frame')
  }

  byte(): number {
    this.need(1)
    return this.buf[this.pos++]!
  }

  bytes(n: number): Uint8Array {
    this.need(n)
    const out = this.buf.subarray(this.pos, this.pos + n)
    this.pos += n
    return out
  }

  u32(): number {
    this.need(4)
    const v = this.view.getUint32(this.pos, true)
    this.pos += 4
    return v
  }

  varint(): number {
    let result = 0
    let scale = 1
    for (let i = 0; i < 8; i++) {
      const b = this.byte()
      result += (b & 0x7f) * scale
      if (b < 0x80) {
        if (!Number.isSafeInteger(result)) throw new WireError('varint out of range')
        return result
      }
      scale *= 0x80
    }
    throw new WireError('varint too long')
  }

  value(depth = 0): WireValue {
    if (depth > MAX_DEPTH) throw new WireError('value nested too deeply')
    const tag = this.byte()
    switch (tag) {
      case T_NULL:
        return null
      case T_FALSE:
        return false
      case T_TRUE:
        return true
      case T_INT: {
        const z = this.varint()
        return z % 2 === 0 ? z / 2 : -(z + 1) / 2
      }
      case T_F64: {
        this.need(8)
        const v = this.view.getFloat64(this.pos, true)
        this.pos += 8
        return v
      }
      case T_STR_INTERN: {
        const s = utf8Decode(this.bytes(this.varint()))
        if (this.table.length >= MAX_TABLE) throw new WireError('string table overflow')
        this.table.push(s)
        return s
      }
      case T_STR_RAW:
        return utf8Decode(this.bytes(this.varint()))
      case T_STR_REF: {
        const s = this.table[this.varint()]
        if (s === undefined) throw new WireError('unknown string reference')
        return s
      }
      case T_UUID: {
        const b = this.bytes(16)
        let hex = ''
        for (let i = 0; i < 16; i++) hex += HEX[b[i]!]
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
      }
      case T_BYTES:
        return this.bytes(this.varint()).slice()
      case T_ARRAY: {
        const n = this.varint()
        // Every element takes at least one byte: a count larger than what is
        // left is a lie, refused before anything is allocated for it.
        if (n > this.remaining) throw new WireError('array longer than frame')
        const out: WireValue[] = new Array(n)
        for (let i = 0; i < n; i++) out[i] = this.value(depth + 1)
        return out
      }
      case T_MAP: {
        const n = this.varint()
        if (n * 2 > this.remaining) throw new WireError('map longer than frame')
        const out: { [key: string]: WireValue } = {}
        for (let i = 0; i < n; i++) {
          const key = this.value(depth + 1)
          if (typeof key !== 'string') throw new WireError('map key is not a string')
          // Own property, never the prototype: a key named __proto__ must not
          // reach Object.prototype.
          Object.defineProperty(out, key, {
            value: this.value(depth + 1),
            enumerable: true,
            writable: true,
            configurable: true,
          })
        }
        return out
      }
      default:
        throw new WireError(`unknown tag 0x${tag.toString(16)}`)
    }
  }
}

export function encodeValue(value: WireValue): Uint8Array {
  const w = new Writer()
  w.value(value)
  return w.finish()
}

export function decodeValue(bytes: Uint8Array): WireValue {
  const r = new Reader(bytes)
  const v = r.value()
  if (r.remaining !== 0) throw new WireError('trailing bytes')
  return v
}
