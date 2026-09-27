// Hisabche Sync Binary — the codec must round-trip exactly what JSON carries,
// refuse anything malformed (the server decodes untrusted bytes), and actually
// be smaller than the JSON it replaces. Sizes are MEASURED here, not assumed.
import {
  brotliCompressSync,
  brotliDecompressSync,
  constants as zlibConstants,
  gunzipSync,
  gzipSync,
} from 'node:zlib'
import { describe, expect, it } from 'vitest'

import {
  decodeFrame,
  decodePullPage,
  decodeValue,
  encodeFrame,
  encodePullPage,
  encodeValue,
  Op,
  utf8Decode,
  utf8Encode,
  WireError,
  type WirePullPage,
  type WireValue,
} from '../wire'

const roundTrip = (v: WireValue) => decodeValue(encodeValue(v))

describe('HSB codec — exact round-trip', () => {
  it.each<[string, WireValue]>([
    ['null', null],
    ['booleans', [true, false]],
    ['zero and small ints', [0, 1, -1, 63, -64, 127, 128, 255, 256]],
    [
      'money in minor units, both signs',
      [1_500_000_000, -2_750_000, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER],
    ],
    ['floats', [0.1, -3.75, 1e-9, 12345.678]],
    ['Persian and Dari text', 'فاکتور فروش — مشتری: احمد، ۱۲۳۴ افغانی'],
    ['emoji (surrogate pairs)', 'رسید 🧾✅'],
    ['empty string', ''],
    ['long string (not interned)', 'ا'.repeat(500)],
    ['uuid', '3f2b8c1e-9a4d-4e21-8b7a-0c5d6e7f8a9b'],
    ['nested', { a: [1, { b: 'x', c: [null, true] }], d: {} }],
    ['bytes', new Uint8Array([0, 1, 254, 255])],
  ])('%s', (_name, value) => {
    expect(roundTrip(value)).toEqual(value)
  })

  it('a leading-zero barcode stays a string, never a number', () => {
    expect(roundTrip({ barcode: '0123456789012' })).toEqual({ barcode: '0123456789012' })
  })

  it('an UPPERCASE uuid is kept exactly (only canonical lowercase is packed)', () => {
    const v = '3F2B8C1E-9A4D-4E21-8B7A-0C5D6E7F8A9B'
    expect(roundTrip(v)).toBe(v)
  })

  it('-0 survives as a float', () => {
    expect(Object.is(roundTrip(-0), -0)).toBe(true)
  })

  it('refuses NaN and Infinity, like JSON cannot carry them', () => {
    expect(() => encodeValue(Number.NaN)).toThrow(WireError)
    expect(() => encodeValue(Infinity)).toThrow(WireError)
  })

  it('repeated strings are written once and referenced after', () => {
    const one = encodeValue(['AFN']).length
    const many = encodeValue(Array.from({ length: 100 }, () => 'AFN')).length
    // 100 copies cost the first spelling plus ~2 bytes per reference.
    expect(many).toBeLessThan(one + 100 * 3)
  })

  it('the UTF-8 fallback (no TextDecoder, as on Hermes) matches the platform', () => {
    const text = 'حسابچه 🧾 abc'
    expect(utf8Decode(utf8Encode(text))).toBe(text)
    expect(Array.from(utf8Encode(text))).toEqual(Array.from(new TextEncoder().encode(text)))
  })
})

describe('HSB frames — the server decodes untrusted bytes', () => {
  const good = encodeFrame(Op.PING, { at: 1 })

  it('round-trips a frame', () => {
    expect(decodeFrame(good)).toEqual({ op: Op.PING, body: { at: 1 } })
  })

  it('refuses a frame that is not ours', () => {
    const bad = good.slice()
    bad[0] = 0x7b // '{' — a JSON body sent with the wrong content type
    expect(() => decodeFrame(bad)).toThrow(/not a Hisabche frame/)
  })

  it('refuses an unknown version and an unknown opcode', () => {
    const v = good.slice()
    v[2] = 9
    expect(() => decodeFrame(v)).toThrow(/version/)
    const o = good.slice()
    o[3] = 0x7f
    expect(() => decodeFrame(o)).toThrow(/opcode/)
  })

  it('refuses a truncated frame and a lying length', () => {
    expect(() => decodeFrame(good.slice(0, good.length - 1))).toThrow(WireError)
    const lie = good.slice()
    new DataView(lie.buffer).setUint32(4, 9999, true)
    expect(() => decodeFrame(lie)).toThrow(/length/)
  })

  it('refuses an array count larger than the frame before allocating it', () => {
    // tag ARRAY (0x08) + varint 2^28 with nothing after it
    expect(() => decodeValue(new Uint8Array([0x08, 0x80, 0x80, 0x80, 0x80, 0x01]))).toThrow(
      /longer than frame/,
    )
  })

  it('refuses a reference to a string never sent', () => {
    expect(() => decodeValue(new Uint8Array([0x06, 0x05]))).toThrow(/reference/)
  })

  it('a key named __proto__ is an own property — Object.prototype is untouched', () => {
    const w = encodeValue(JSON.parse('{"__proto__":{"polluted":true}}') as WireValue)
    const decoded = decodeValue(w) as Record<string, unknown>
    expect(Object.prototype.hasOwnProperty.call(decoded, '__proto__')).toBe(true)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('refuses nesting deeper than the limit', () => {
    let v: WireValue = null
    for (let i = 0; i < 40; i++) v = [v]
    expect(() => encodeValue(v)).toThrow(/deeply/)
  })

  it('refuses invalid UTF-8', () => {
    expect(() => decodeValue(new Uint8Array([0x0b, 0x02, 0xc3, 0x28]))).toThrow(WireError)
  })
})

/* ── A realistic pull page, shaped like the change log's rows ───────────── */

const hex = (n: number, width: number) => n.toString(16).padStart(width, '0')
const uuid = (n: number) => `${hex(n, 8)}-4a1b-4c2d-8e3f-${hex(n * 7919, 12)}`
const WS = uuid(424242)

function realisticPage(rows: number): WirePullPage {
  return {
    nextCursor: 10_000 + rows,
    hasMore: false,
    mustRehydrate: false,
    changes: Array.from({ length: rows }, (_, i) =>
      i % 2 === 0
        ? {
            syncVersion: 10_001 + i,
            entityType: 'product',
            entityId: uuid(i + 1),
            operation: 'update' as const,
            entityVersion: 3 + (i % 5),
            data: {
              id: uuid(i + 1),
              workspace_id: WS,
              name: `کالای شماره ${i}`,
              barcode: `626${hex(i, 10).replace(/[a-f]/g, '7')}`,
              sku: `SKU-${i}`,
              category: i % 3 === 0 ? 'نوشیدنی' : 'خوراکی',
              unit: 'piece',
              quantity: 40 + (i % 17),
              min_stock_level: 5,
              buy_price: 45_000 + i * 10,
              sell_price: 60_000 + i * 10,
              is_active: true,
              version: 3 + (i % 5),
              updated_at: `2026-09-27T10:${hex(i % 60, 2)}:00.123456+00:00`,
            },
          }
        : {
            syncVersion: 10_001 + i,
            entityType: 'customer',
            entityId: uuid(i + 1),
            operation: 'update' as const,
            entityVersion: 2,
            data: {
              id: uuid(i + 1),
              workspace_id: WS,
              full_name: `مشتری ${i}`,
              phone: `0799${hex(i, 6).replace(/[a-f]/g, '1')}`,
              email: null,
              type: 'individual',
              opening_balance: 0,
              is_active: true,
              version: 2,
              updated_at: `2026-09-27T09:${hex(i % 60, 2)}:00.000000+00:00`,
            },
          },
    ),
  }
}

describe('HSB pull page', () => {
  it('round-trips a page exactly', () => {
    const page = realisticPage(50)
    expect(decodePullPage(encodePullPage(page))).toEqual(page)
  })

  it('carries hasMore / mustRehydrate and a delete with no data', () => {
    const page: WirePullPage = {
      nextCursor: 7,
      hasMore: true,
      mustRehydrate: true,
      changes: [
        {
          syncVersion: 7,
          entityType: 'invoice',
          entityId: uuid(1),
          operation: 'delete',
          entityVersion: 4,
          data: null,
        },
      ],
    }
    expect(decodePullPage(encodePullPage(page))).toEqual(page)
  })

  it('refuses a change with an operation code it does not know', () => {
    const bytes = encodeFrame(Op.PULL_PAGE, [1, 0, [[1, 'product', uuid(1), 9, 1, null]]])
    expect(() => decodePullPage(bytes)).toThrow(/malformed change/)
  })

  // Production settings: gzip (default level) and brotli at quality 4 — the
  // levels @fastify/compress is configured with in backend/src/index.ts.
  const br4 = (b: Uint8Array) =>
    brotliCompressSync(b, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 } })

  it('MEASURED: bytes on the wire, like for like (500-row page)', () => {
    const page = realisticPage(500)
    const json = new TextEncoder().encode(JSON.stringify(page))
    const hsb = encodePullPage(page)
    const sizes = {
      json: json.length,
      jsonGzip: gzipSync(json).length,
      jsonBrotli4: br4(json).length,
      hsb: hsb.length,
      hsbGzip: gzipSync(hsb).length,
      hsbBrotli4: br4(hsb).length,
    }
    const pct = (x: number, y: number) => `${Math.round((1 - x / y) * 100)}%`
    console.info('[hsb-benchmark] 500-row page bytes', sizes, {
      raw: pct(sizes.hsb, sizes.json),
      gzip: pct(sizes.hsbGzip, sizes.jsonGzip),
      brotli4: pct(sizes.hsbBrotli4, sizes.jsonBrotli4),
    })
    expect(sizes.hsb).toBeLessThan(sizes.json * 0.6)
    expect(sizes.hsbGzip).toBeLessThan(sizes.jsonGzip)
  })

  it('MEASURED: CPU per round-trip, codec alone and with compression', () => {
    const page = realisticPage(500)
    const time = (fn: () => void, runs = 20) => {
      for (let i = 0; i < 3; i++) fn() // warm-up
      const start = performance.now()
      for (let i = 0; i < runs; i++) fn()
      return (performance.now() - start) / runs
    }
    const enc = new TextEncoder()
    const dec = new TextDecoder()
    const result = {
      codecOnly: {
        json: time(() => JSON.parse(JSON.stringify(page))),
        hsb: time(() => decodePullPage(encodePullPage(page))),
      },
      withGzip: {
        json: time(() =>
          JSON.parse(dec.decode(gunzipSync(gzipSync(enc.encode(JSON.stringify(page)))))),
        ),
        hsb: time(() => decodePullPage(new Uint8Array(gunzipSync(gzipSync(encodePullPage(page)))))),
      },
      withBrotli4: {
        json: time(() =>
          JSON.parse(dec.decode(brotliDecompressSync(br4(enc.encode(JSON.stringify(page)))))),
        ),
        hsb: time(() =>
          decodePullPage(new Uint8Array(brotliDecompressSync(br4(encodePullPage(page))))),
        ),
      },
    }
    console.info(
      '[hsb-benchmark] 500-row page ms per round-trip',
      JSON.stringify(result, (_k, v) => (typeof v === 'number' ? Number(v.toFixed(2)) : v)),
    )
    // Recorded, not gated: a CPU-time assertion is flaky across machines.
    expect(result.codecOnly.hsb).toBeGreaterThan(0)
  }, 60_000)
})
