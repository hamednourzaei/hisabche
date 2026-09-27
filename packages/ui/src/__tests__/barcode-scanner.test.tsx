// Barcode scanner (keyboard wedge) → invoice line. See lib/barcode/*.
import { act, cleanup, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useBarcodeScanner } from '../hooks/use-barcode-scanner'
import {
  charFromKey,
  createScanDetector,
  DEFAULT_SCANNER_CONFIG,
  type BarcodeScan,
  type KeyInput,
} from '../lib/barcode/scan-detector'
import { sanitizeScannerConfig } from '../lib/barcode/scanner-settings'
import { planScan } from '../lib/barcode/scan-into-invoice'

const key = (k: string, code: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  code,
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...extra,
})
const digit = (d: string) => key(d, `Digit${d}`)
const ENTER = key('Enter', 'Enter')

/** Feed a code at `gapMs` per key, then Enter. */
function scan(code: string, gapMs: number, detector = createScanDetector(DEFAULT_SCANNER_CONFIG)) {
  let t = 1000
  for (const ch of code) {
    detector.feed(/[0-9]/.test(ch) ? digit(ch) : key(ch, `Key${ch.toUpperCase()}`), t)
    t += gapMs
  }
  return detector.feed(ENTER, t)
}

describe('scan detector', () => {
  it('a fast burst + Enter is a scan', () => {
    const result = scan('6261234567890', 8)
    expect(result).toMatchObject({ kind: 'scan', scan: { value: '6261234567890', source: 'hid' } })
  })

  it('a person typing the same digits (slow) is NOT a scan', () => {
    expect(scan('6261234567890', 180).kind).toBe('pass')
  })

  it('too short (below minLength) is not a scan', () => {
    expect(scan('12', 5).kind).toBe('pass')
  })

  it('⚠️ Persian keyboard layout: the physical key decides, not the Persian character', () => {
    const d = createScanDetector(DEFAULT_SCANNER_CONFIG)
    let t = 0
    for (const [fa, n] of [
      ['۶', '6'],
      ['۲', '2'],
      ['۶', '6'],
      ['۱', '1'],
    ] as const) {
      d.feed(key(fa, `Digit${n}`), (t += 5))
    }
    d.feed(key('ش', 'KeyA', { shiftKey: true }), (t += 5))
    expect(d.feed(ENTER, t + 5)).toMatchObject({ kind: 'scan', scan: { value: '6261A' } })
  })

  it('reads Persian digits from `key` when there is no physical code', () => {
    expect(charFromKey(key('۷', ''))).toBe('7')
  })

  it('a leading zero survives — the value is a string', () => {
    expect(scan('0123456789012', 5)).toMatchObject({ scan: { value: '0123456789012' } })
  })

  it('a shortcut (Ctrl+V) breaks the burst', () => {
    const d = createScanDetector(DEFAULT_SCANNER_CONFIG)
    d.feed(digit('1'), 0)
    d.feed(digit('2'), 5)
    d.feed(key('v', 'KeyV', { ctrlKey: true }), 10)
    d.feed(digit('3'), 15)
    expect(d.feed(ENTER, 20).kind).toBe('pass') // «3» alone is too short
  })

  it('suffix Tab and suffix none are honoured', () => {
    const tab = createScanDetector({ ...DEFAULT_SCANNER_CONFIG, suffix: 'Tab' })
    for (const [i, c] of [...'12345'].entries()) tab.feed(digit(c), i * 5)
    expect(tab.feed(key('Tab', 'Tab'), 25).kind).toBe('scan')

    const none = createScanDetector({ ...DEFAULT_SCANNER_CONFIG, suffix: 'none' })
    for (const [i, c] of [...'12345'].entries()) none.feed(digit(c), i * 5)
    expect(none.flushIdle(30).kind).toBe('pass') // not idle long enough
    expect(none.flushIdle(20 + DEFAULT_SCANNER_CONFIG.idleCommitMs).kind).toBe('scan')
  })

  it('disabled → nothing is ever a scan', () => {
    expect(
      scan('6261234567890', 5, createScanDetector({ ...DEFAULT_SCANNER_CONFIG, enabled: false }))
        .kind,
    ).toBe('pass')
  })
})

describe('scanner settings are never trusted as stored', () => {
  it('garbage becomes the defaults; out-of-range values are clamped', () => {
    expect(sanitizeScannerConfig('nonsense')).toEqual(DEFAULT_SCANNER_CONFIG)
    expect(
      sanitizeScannerConfig({
        suffix: 'Escape',
        maxInterKeyMs: 99999,
        minLength: 10,
        maxLength: 3,
      }),
    ).toMatchObject({
      suffix: 'Enter',
      maxInterKeyMs: 300,
      minLength: 10,
      maxLength: 10,
    })
  })
})

describe('planScan — where the product lands on the grid', () => {
  const tea = { id: 'p-tea', name: 'چای', price: '60000', unit: 'piece' }
  const blank = { id: 'r-blank', values: {} }

  it('the same product + unit again → +1 on its line', () => {
    const rows = [{ id: 'r1', productId: 'p-tea', values: { quantity: '2', unit: 'piece' } }, blank]
    expect(planScan(rows, tea)).toEqual({ kind: 'increment', rowId: 'r1', quantity: '3' })
  })

  it('Persian digits and a decimal quantity are read, not reset', () => {
    const rows = [{ id: 'r1', productId: 'p-tea', values: { quantity: '۱٫۵', unit: 'piece' } }]
    expect(planScan(rows, tea)).toEqual({ kind: 'increment', rowId: 'r1', quantity: '2.5' })
  })

  it('same product in ANOTHER unit (carton) → its own line', () => {
    const rows = [
      { id: 'r1', productId: 'p-tea', values: { quantity: '1', unit: 'carton' } },
      blank,
    ]
    expect(planScan(rows, tea)).toEqual({ kind: 'fill', rowId: 'r-blank' })
  })

  it('a new product fills the blank row; no blank row → append', () => {
    expect(planScan([blank], tea)).toEqual({ kind: 'fill', rowId: 'r-blank' })
    expect(planScan([{ id: 'r1', values: { description: 'خدمات' } }], tea)).toEqual({
      kind: 'append',
    })
  })
})

/* ── the hook, in a real DOM ─────────────────────────────────────────────── */

function Harness({ onScan }: { onScan: (s: BarcodeScan) => void }) {
  const [value, setValue] = useState('')
  useBarcodeScanner(onScan)
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <input aria-label="field" value={value} onChange={(e) => setValue(e.target.value)} />
      <input aria-label="secret" type="password" />
    </form>
  )
}

let now = 0
beforeEach(() => {
  now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Type into an element the way a browser does: keydown, then (if not prevented) the character. */
function type(el: HTMLInputElement, chars: string, gap: number) {
  for (const ch of chars) {
    now += gap
    const ev = new KeyboardEvent('keydown', {
      key: ch,
      code: `Digit${ch}`,
      bubbles: true,
      cancelable: true,
    })
    const allowed = el.dispatchEvent(ev)
    if (allowed) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(el, el.value + ch)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }
  now += gap
  return el.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }),
  )
}

describe('useBarcodeScanner', () => {
  it('a scan into a focused field: delivered, the field restored, Enter swallowed', () => {
    const onScan = vi.fn()
    const { getByLabelText } = render(<Harness onScan={onScan} />)
    const field = getByLabelText('field') as HTMLInputElement
    act(() => {
      // The cashier had typed «ab» slowly…
      type(field, '', 0)
    })
    let enterReachedPage = true
    act(() => {
      enterReachedPage = type(field, '6261234567890', 5)
    })
    expect(onScan).toHaveBeenCalledWith(expect.objectContaining({ value: '6261234567890' }))
    expect(field.value).toBe('')
    expect(enterReachedPage).toBe(false)
  })

  it('a person typing slowly is left alone', () => {
    const onScan = vi.fn()
    const { getByLabelText } = render(<Harness onScan={onScan} />)
    const field = getByLabelText('field') as HTMLInputElement
    act(() => {
      type(field, '1234', 200)
    })
    expect(onScan).not.toHaveBeenCalled()
    expect(field.value).toBe('1234')
  })

  it('never reads a password field', () => {
    const onScan = vi.fn()
    const { getByLabelText } = render(<Harness onScan={onScan} />)
    act(() => {
      type(getByLabelText('secret') as HTMLInputElement, '6261234567890', 5)
    })
    expect(onScan).not.toHaveBeenCalled()
  })
})
