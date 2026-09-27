// ============================================
// useBarcodeScanner — listen for a keyboard-wedge scanner anywhere on the page.
//
// Works with the cursor in no field, and with the cursor in one: whatever the
// scanner typed into a focused input is rolled back to what it held before
// the burst, and the suffix Enter is swallowed so it cannot submit a form or
// jump a grid row. A person typing (slower than the configured gap) is never
// affected — their keys pass through untouched.
//
// Settings come from this device (scanner-settings.ts) and are read in an
// effect, never during render (React 19 hydration: CLAUDE.md §8).
// ============================================
'use client'

import { useEffect, useRef } from 'react'

import { createScanDetector, type BarcodeScan } from '../lib/barcode/scan-detector'
import { loadScannerConfig, SCANNER_SETTINGS_EVENT } from '../lib/barcode/scanner-settings'

type Editable = HTMLInputElement | HTMLTextAreaElement

function editableTarget(target: EventTarget | null): Editable | null {
  if (target instanceof HTMLTextAreaElement) return target
  if (
    target instanceof HTMLInputElement &&
    !['checkbox', 'radio', 'button', 'submit'].includes(target.type)
  ) {
    return target
  }
  return null
}

/** Set a React-controlled input's value so React sees the change. */
function restoreValue(el: Editable, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(el, value)
  else el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export interface UseBarcodeScannerOptions {
  /** Pause listening (a dialog of its own is open, the page is read-only). */
  enabled?: boolean | undefined
}

export function useBarcodeScanner(
  onScan: (scan: BarcodeScan) => void,
  options: UseBarcodeScannerOptions = {},
): void {
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const enabled = options.enabled !== false

  useEffect(() => {
    if (!enabled) return

    let config = loadScannerConfig()
    let detector = createScanDetector(config)
    let snapshot: { el: Editable; value: string } | null = null
    let idleTimer: ReturnType<typeof setTimeout> | null = null

    const reload = () => {
      config = loadScannerConfig()
      detector = createScanDetector(config)
      snapshot = null
    }

    const deliver = (scan: BarcodeScan) => {
      if (snapshot) {
        // Undo what the scanner typed into the field it happened to land in.
        restoreValue(snapshot.el, snapshot.value)
        snapshot = null
      }
      onScanRef.current(scan)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const el = editableTarget(event.target)
      // Never read a password field as a barcode, and let a field opt out.
      if (el && (el.type === 'password' || el.closest('[data-barcode-ignore]'))) {
        detector.reset()
        return
      }
      const now = performance.now()
      // A new burst begins whenever the detector holds nothing it could
      // continue: remember the field as it was BEFORE this key (keydown runs
      // before the character is inserted), to roll a scan back to it.
      if (!detector.isBuffering(now)) snapshot = el ? { el, value: el.value } : null

      const result = detector.feed(event, now)
      if (result.kind === 'scan') {
        event.preventDefault()
        event.stopPropagation()
        deliver(result.scan)
        return
      }
      if (result.kind === 'buffered' && config.suffix === 'none') {
        if (idleTimer) clearTimeout(idleTimer)
        idleTimer = setTimeout(() => {
          const flushed = detector.flushIdle(performance.now())
          if (flushed.kind === 'scan') deliver(flushed.scan)
        }, config.idleCommitMs)
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener(SCANNER_SETTINGS_EVENT, reload)
    window.addEventListener('storage', reload)
    return () => {
      if (idleTimer) clearTimeout(idleTimer)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener(SCANNER_SETTINGS_EVENT, reload)
      window.removeEventListener('storage', reload)
    }
  }, [enabled])
}
