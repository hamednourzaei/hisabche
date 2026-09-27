// ============================================
// Barcode — one rule for every place a barcode is read, stored or matched.
//
// ⚠️ ALWAYS A STRING. `0123456789012` as a number is 123456789012 — the leading
// zero of an EAN/UPC is part of the code, and a numeric column or a parseInt
// anywhere turns a real product into «unknown barcode».
//
// ⚠️ NORMALISED THE SAME ON BOTH SIDES. A scanner on a Windows machine set to
// the Persian layout can deliver `۶۲۶۱۲۳` (the scanner is a keyboard, and the
// layout decides what a key means), a spreadsheet import can carry a trailing
// space, a CR from the scanner's suffix can survive. Stored as typed and
// matched as scanned, those never meet. The server normalises before it
// stores and before it looks up; the scanner normalises before it asks.
// ============================================

import { z } from 'zod'

export const BARCODE_MAX_LENGTH = 64

const PERSIAN_ZERO = 0x06f0 // ۰
const ARABIC_ZERO = 0x0660 // ٠

/** Persian/Arabic digits → ASCII; strip whitespace and control characters. */
export function normalizeBarcode(value: string | null | undefined): string {
  if (typeof value !== 'string') return ''
  let out = ''
  for (const ch of value) {
    const code = ch.codePointAt(0)!
    if (code >= PERSIAN_ZERO && code <= PERSIAN_ZERO + 9) out += String(code - PERSIAN_ZERO)
    else if (code >= ARABIC_ZERO && code <= ARABIC_ZERO + 9) out += String(code - ARABIC_ZERO)
    else if (code <= 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f) || /\s/u.test(ch))
      continue
    else out += ch
  }
  return out.slice(0, BARCODE_MAX_LENGTH)
}

/** An optional barcode field on a product: normalised, never a number. */
export const barcodeSchema = z
  .string()
  .max(BARCODE_MAX_LENGTH * 2)
  .transform((v) => normalizeBarcode(v))
