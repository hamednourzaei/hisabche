// ============================================
// The phone camera as a barcode scanner — the host side of `barcode.scan`
// (27 Sep 2026).
//
// The page asks over the bridge; this opens the camera overlay
// (camera-scan-overlay.tsx) and answers with exactly one of: a code, «closed»,
// or «camera not allowed». Only one scan at a time: a second request answers
// the first as cancelled rather than leaving its promise hanging — the bridge
// always answers (native-bridge.ts), and so does this.
// ============================================

import type { CameraScanResult } from '@hisabche/app-bridge'

type Listener = (active: boolean) => void

let pending: ((result: CameraScanResult) => void) | null = null
const listeners = new Set<Listener>()

function notify(active: boolean): void {
  for (const listener of listeners) listener(active)
}

/** Open the camera; resolves when the overlay answers. */
export function requestScan(): Promise<CameraScanResult> {
  pending?.({ status: 'cancelled' })
  return new Promise<CameraScanResult>((resolve) => {
    pending = resolve
    notify(true)
  })
}

/** The overlay's answer. A second call (two frames with a code) is ignored. */
export function finishScan(result: CameraScanResult): void {
  const resolve = pending
  if (!resolve) return
  pending = null
  resolve(result)
  notify(false)
}

export function onScanRequest(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isScanning(): boolean {
  return pending !== null
}
