// ============================================
// USB barcode scanners behave as keyboards: they type the code fast and
// press Enter. Characters arriving faster than a human types are treated as
// a scan, so normal typing in a field is never hijacked.
// ============================================

import { useEffect, useRef } from 'react'

const MAX_INTER_KEY_MS = 40
const MIN_CODE_LENGTH = 4

export function useBarcodeScanner(onScan: (code: string) => void): void {
  const handler = useRef(onScan)
  handler.current = onScan

  useEffect(() => {
    let buffer = ''
    let lastKeyAt = 0

    function onKeyDown(event: KeyboardEvent): void {
      const now = Date.now()
      const fast = now - lastKeyAt < MAX_INTER_KEY_MS
      lastKeyAt = now

      if (event.key === 'Enter') {
        if (buffer.length >= MIN_CODE_LENGTH) {
          event.preventDefault()
          handler.current(buffer)
        }
        buffer = ''
        return
      }

      if (event.key.length !== 1) return
      buffer = fast ? buffer + event.key : event.key
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
