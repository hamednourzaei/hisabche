'use client'

// ============================================
// «Scan with the camera» — only where the host HAS a camera scanner (the phone
// app; lib/barcode/camera-host.ts). Desktop scans with a keyboard-wedge
// scanner and the browser build has no host: there the button is not drawn,
// rather than drawn and failing (27 Sep 2026).
//
// The code goes to `onCode` — the same handleScan the keyboard scanner feeds,
// so the camera and the scanner cannot disagree about what a code means.
// ============================================

import { useState } from 'react'
import { Camera } from 'lucide-react'

import { Button } from '../button'
import { getCameraScanner } from '../../../lib/barcode/camera-host'

export interface CameraScanButtonProps {
  t: (key: string) => string
  onCode: (code: string) => void
  /** Paused while a scan problem is being answered. */
  disabled?: boolean | undefined
}

export function CameraScanButton({ t, onCode, disabled }: CameraScanButtonProps) {
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)
  const scanner = getCameraScanner()
  if (!scanner) return null

  const scan = async () => {
    setBusy(true)
    setDenied(false)
    try {
      const result = await scanner.scan()
      if (result.status === 'scanned') onCode(result.code)
      // «You did not let me look» is said, not shown as «no barcode».
      else if (result.status === 'denied') setDenied(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || busy}
        onClick={() => void scan()}
        className="self-start"
      >
        <Camera className="size-4" aria-hidden="true" />
        {t('barcode.cameraScan')}
      </Button>
      {denied ? (
        <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
          {t('barcode.cameraDenied')}
        </p>
      ) : null}
    </div>
  )
}
