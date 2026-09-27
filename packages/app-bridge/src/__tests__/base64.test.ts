// Bytes across the Android WebView's JSON bridge (request #153 regression, 27
// Sep 2026: a binary sync page read as text failed every Android pull).
import { describe, expect, it } from 'vitest'

import { base64ToBytes, bytesToBase64 } from '../base64'

describe('base64 over the JSON bridge', () => {
  it('matches Node for every length 0..40 and every byte value', () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i)
    for (let n = 0; n <= 40; n++) {
      const bytes = all.slice(0, n)
      expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'))
      expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes))
    }
    expect(Array.from(base64ToBytes(bytesToBase64(all)))).toEqual(Array.from(all))
  })

  it('survives JSON — which a Uint8Array does not', () => {
    const bytes = Uint8Array.from([0x48, 0x53, 0x01, 0x01, 0xff, 0x00, 0x80])
    const viaJson = JSON.parse(JSON.stringify({ b: bytesToBase64(bytes) })) as { b: string }
    expect(Array.from(base64ToBytes(viaJson.b))).toEqual(Array.from(bytes))
    // The failure it prevents: a typed array through JSON is not bytes anymore.
    expect(JSON.parse(JSON.stringify(bytes))).not.toBeInstanceOf(Uint8Array)
  })

  it('refuses characters outside the alphabet only by ignoring whitespace, never inventing bytes', () => {
    expect(Array.from(base64ToBytes('SGk=\n'))).toEqual([0x48, 0x69])
  })
})
