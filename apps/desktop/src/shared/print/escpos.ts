// ============================================
// ESC/POS encoder for 58/80mm thermal receipt printers.
//
// Produces the raw byte stream; the main process hands it to the OS spooler.
// Text is encoded as UTF-8 — printers without an Arabic/Persian codepage will
// need a font cartridge or an image-based fallback.
// ============================================

import type { PrintableInvoice, PrintLabels } from './invoice-template'

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

/** Characters per line. 80mm ≈ 48, 58mm ≈ 32. */
export type PaperWidth = 32 | 48

class Encoder {
  private readonly parts: number[] = []

  raw(...bytes: number[]): this {
    this.parts.push(...bytes)
    return this
  }

  text(value: string): this {
    const encoded = new TextEncoder().encode(value)
    this.parts.push(...encoded)
    return this
  }

  line(value = ''): this {
    return this.text(value).raw(LF)
  }

  init(): this {
    return this.raw(ESC, 0x40)
  }

  align(mode: 'left' | 'center' | 'right'): this {
    const map = { left: 0, center: 1, right: 2 } as const
    return this.raw(ESC, 0x61, map[mode])
  }

  bold(on: boolean): this {
    return this.raw(ESC, 0x45, on ? 1 : 0)
  }

  doubleHeight(on: boolean): this {
    return this.raw(GS, 0x21, on ? 0x01 : 0x00)
  }

  cut(): this {
    return this.raw(LF, LF, LF, GS, 0x56, 0x42, 0x00)
  }

  toBase64(): string {
    let binary = ''
    for (const byte of this.parts) binary += String.fromCharCode(byte)
    return btoa(binary)
  }
}

/** Pad a label/value pair to the full paper width. */
function pair(label: string, value: string, width: PaperWidth): string {
  const gap = Math.max(1, width - label.length - value.length)
  return `${label}${' '.repeat(gap)}${value}`
}

export function encodeReceipt(
  invoice: PrintableInvoice,
  labels: PrintLabels,
  width: PaperWidth = 48
): string {
  const encoder = new Encoder()
  const rule = '-'.repeat(width)

  encoder.init().align('center').bold(true).doubleHeight(true)
  encoder.line(labels.title)
  encoder.doubleHeight(false).bold(false)

  encoder.align('left').line(rule)
  encoder.line(pair(labels.invoiceNumber, invoice.invoiceNumber, width))
  encoder.line(pair(labels.customer, invoice.customerName, width))
  encoder.line(pair(labels.date, invoice.date, width))
  encoder.line(rule)

  for (const item of invoice.lines) {
    encoder.line(item.productName)
    encoder.line(pair(`  ${item.quantity} x ${item.unitPrice}`, String(item.totalPrice), width))
  }

  encoder.line(rule)
  encoder.line(pair(labels.subtotal, invoice.subtotal, width))
  encoder.line(pair(labels.paid, invoice.paid, width))
  encoder.bold(true)
  encoder.line(pair(labels.total, `${invoice.total} ${invoice.currencySign}`, width))
  encoder.bold(false)

  return encoder.cut().toBase64()
}
