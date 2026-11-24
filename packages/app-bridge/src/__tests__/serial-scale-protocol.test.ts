// ============================================
// packages/app-bridge/src/__tests__/serial-scale-protocol.test.ts
//
// Tests for POS Hardware Serial Scale Protocol Parsers (CAS & Mettler Toledo/NCI)
// ============================================

import { describe, it, expect } from 'vitest'
import {
  parseCasScaleLine,
  parseToledoNciLine,
  parseScaleStreamLine,
} from '../hardware/serial-scale-protocol'

describe('POS Hardware Serial Scale Protocol Parsers', () => {
  describe('CAS Scale Protocol', () => {
    it('parses stable net weight in kg (ST,NT,+  1.250kg)', () => {
      const line = 'ST,NT,+  1.250kg\r\n'
      const result = parseCasScaleLine(line)

      expect(result).not.toBeNull()
      expect(result?.isStable).toBe(true)
      expect(result?.isNet).toBe(true)
      expect(result?.weightGrams).toBe(1250)
      expect(result?.weightMilligrams).toBe(1250000)
      expect(result?.isOverload).toBe(false)
      expect(result?.isZero).toBe(false)
      expect(result?.originalUnit).toBe('kg')
    })

    it('parses unstable gross weight in kg (US,GS,+  0.750kg)', () => {
      const line = 'US,GS,+  0.750kg'
      const result = parseCasScaleLine(line)

      expect(result).not.toBeNull()
      expect(result?.isStable).toBe(false)
      expect(result?.isNet).toBe(false)
      expect(result?.weightGrams).toBe(750)
      expect(result?.weightMilligrams).toBe(750000)
    })

    it('parses stable weight in grams (ST,GS,+  250g)', () => {
      const line = 'ST,GS,+  250g'
      const result = parseCasScaleLine(line)

      expect(result).not.toBeNull()
      expect(result?.isStable).toBe(true)
      expect(result?.weightGrams).toBe(250)
      expect(result?.weightMilligrams).toBe(250000)
    })

    it('detects overload condition (OL,GS,+999.999kg)', () => {
      const line = 'OL,GS,+999.999kg'
      const result = parseCasScaleLine(line)

      expect(result).not.toBeNull()
      expect(result?.isOverload).toBe(true)
    })

    it('returns null on invalid or empty lines', () => {
      expect(parseCasScaleLine('')).toBeNull()
      expect(parseCasScaleLine('GARBAGE DATA 123')).toBeNull()
    })
  })

  describe('Mettler Toledo / NCI Protocol', () => {
    it('parses stable Toledo reading (S   2.500 kg)', () => {
      const line = '\x02S   2.500 kg\x03'
      const result = parseToledoNciLine(line)

      expect(result).not.toBeNull()
      expect(result?.isStable).toBe(true)
      expect(result?.weightGrams).toBe(2500)
      expect(result?.weightMilligrams).toBe(2500000)
    })

    it('parses dynamic/unstable Toledo reading (D   0.320 kg)', () => {
      const line = 'D   0.320 kg'
      const result = parseToledoNciLine(line)

      expect(result).not.toBeNull()
      expect(result?.isStable).toBe(false)
      expect(result?.weightGrams).toBe(320)
    })
  })

  describe('Auto-detecting Multi-protocol Parser', () => {
    it('correctly auto-detects CAS and Toledo strings in stream', () => {
      const cas = parseScaleStreamLine('ST,GS,+  1.100kg')
      expect(cas?.weightGrams).toBe(1100)

      const toledo = parseScaleStreamLine('S   3.450 kg')
      expect(toledo?.weightGrams).toBe(3450)
    })
  })
})
