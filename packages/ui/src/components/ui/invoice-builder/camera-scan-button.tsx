'use client'

// ============================================
// «Scan a barcode» — one button, every device (28 Sep 2026).
//
// It used to be drawn only where the phone app registered a camera, so the
// website (computer or phone browser) had no scan button at all. Now it opens
// a small dialog with the two ways a code arrives:
//
//   · a DEVICE (USB/Bluetooth keyboard-wedge scanner) or typing — the field is
//     focused; the scanner types the code and presses Enter;
//   · the CAMERA — the phone app's native scanner when the host registered one
//     (camera-host.ts), otherwise the browser's camera (browser-camera.ts).
//
// Every code goes to `onCode` — the same handleScan the page's own keyboard
// listener feeds — so a product's main barcode AND its extra codes
// (product_barcodes, carton units) resolve the same way whichever way the
// code was read. While the dialog is open the caller pauses that listener
// (`onOpenChange`), so one scan is never added twice.
// ============================================

import { useEffect, useRef, useState } from 'react'
import { Camera, ScanBarcode } from 'lucide-react'

import { Button } from '../button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../dialog'
import { Input } from '../input'
import { getCameraScanner } from '../../../lib/barcode/camera-host'
import {
  BrowserScanError,
  browserCameraAvailable,
  startBrowserScan,
  type BrowserScanFailure,
} from '../../../lib/barcode/browser-camera'

export interface CameraScanButtonProps {
  t: (key: string) => string
  onCode: (code: string) => void
  /** Paused while a scan problem is being answered. */
  disabled?: boolean | undefined
  /** The dialog opened/closed — the page pauses its own scanner listener meanwhile. */
  onOpenChange?: ((open: boolean) => void) | undefined
}

export function CameraScanButton({ t, onCode, disabled, onOpenChange }: CameraScanButtonProps) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const [failure, setFailure] = useState<BrowserScanFailure | null>(null)
  const [busy, setBusy] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  // Read after mount only: the host and the browser camera are client facts.
  const [canCamera, setCanCamera] = useState(false)
  useEffect(() => {
    setCanCamera(getCameraScanner() !== null || browserCameraAvailable())
  }, [])

  const stopCamera = () => {
    stopRef.current?.()
    stopRef.current = null
    setCameraOn(false)
  }

  const setDialog = (next: boolean) => {
    if (!next) stopCamera()
    setOpen(next)
    setCode('')
    setFailure(null)
    onOpenChange?.(next)
  }

  const deliver = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setDialog(false)
    onCode(trimmed)
  }

  // The browser camera stops when the dialog unmounts, whatever closed it.
  useEffect(() => () => stopRef.current?.(), [])

  const startCamera = async () => {
    setFailure(null)
    const host = getCameraScanner()
    if (host) {
      // The phone app's own scanner screen.
      setBusy(true)
      try {
        const result = await host.scan()
        if (result.status === 'scanned') deliver(result.code)
        // «You did not let me look» is said, not shown as «no barcode».
        else if (result.status === 'denied') setFailure('denied')
      } finally {
        setBusy(false)
      }
      return
    }
    setCameraOn(true)
    // The <video> renders on the next frame.
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const video = videoRef.current
    if (!video) return
    try {
      let delivered = false
      stopRef.current = await startBrowserScan(video, (value) => {
        if (delivered) return
        delivered = true
        deliver(value)
      })
    } catch (error) {
      setCameraOn(false)
      setFailure(error instanceof BrowserScanError ? error.reason : 'failed')
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setDialog(true)}
        className="self-start"
      >
        <ScanBarcode className="size-4" aria-hidden="true" />
        {t('barcode.scanButton')}
      </Button>

      <Dialog open={open} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogTitle>{t('barcode.scanTitle')}</DialogTitle>
          <DialogDescription>{t('barcode.scanHint')}</DialogDescription>

          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              deliver(code)
            }}
          >
            <div className="flex-1">
              <Input
                autoFocus
                dir="ltr"
                name="barcode"
                autoComplete="off"
                value={code}
                placeholder={t('barcode.hint')}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={!code.trim()}>
              {t('barcode.scanAdd')}
            </Button>
          </form>

          {canCamera ? (
            <div className="space-y-2">
              {cameraOn ? (
                <>
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className="aspect-video w-full rounded-xl bg-[hsl(var(--surface-muted))] object-cover"
                  />
                  <p className="text-xs text-[hsl(var(--fg-secondary))]">
                    {t('barcode.cameraTitle')}
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={stopCamera}>
                    {t('barcode.cameraCancel')}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void startCamera()}
                >
                  <Camera className="size-4" aria-hidden="true" />
                  {t('barcode.cameraScan')}
                </Button>
              )}
            </div>
          ) : null}

          {failure ? (
            <p role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
              {failure === 'denied'
                ? t('barcode.cameraDenied')
                : failure === 'unsupported'
                  ? t('barcode.cameraUnsupported')
                  : t('barcode.cameraFailed')}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
