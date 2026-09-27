// ============================================
// The device camera as a barcode scanner — registered by the HOST, like the
// receipt printer (lib/print/printer-host.ts). This package never imports a
// host's bridge: the phone registers its camera at start-up; desktop and the
// browser register nothing, and no camera button is drawn there (27 Sep 2026).
//
// A scanned code goes through the SAME path as the keyboard-wedge scanner
// (lookupProductByBarcode → planScan), so a code means the same product
// whichever device read it.
// ============================================

export type CameraScanResult =
  { status: 'scanned'; code: string } | { status: 'cancelled' } | { status: 'denied' }

export interface CameraScannerHost {
  scan(): Promise<CameraScanResult>
}

let host: CameraScannerHost | null = null

export function registerCameraScanner(next: CameraScannerHost | null): void {
  host = next
}

export function getCameraScanner(): CameraScannerHost | null {
  return host
}
