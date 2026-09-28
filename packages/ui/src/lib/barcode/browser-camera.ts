// ============================================
// The camera as a barcode scanner INSIDE A BROWSER — for the website on a
// computer or a phone, where no host registers a camera (camera-host.ts is the
// phone app's). 28 Sep 2026: «a scan button on /invoices/new, with a device
// and with a phone».
//
// The browser's own BarcodeDetector when it has one (Chrome on Android, macOS,
// ChromeOS); otherwise @zxing/browser (Windows Chrome, iPhone Safari have no
// BarcodeDetector). zxing is imported only here, only when the camera is
// actually started — nothing is added to any page's first load.
//
// The code goes to the caller once; the caller stops the camera.
// ============================================

export type BrowserScanFailure = 'denied' | 'unsupported' | 'failed'

export class BrowserScanError extends Error {
  constructor(readonly reason: BrowserScanFailure) {
    super(reason)
    this.name = 'BrowserScanError'
  }
}

/** Whether this browser can reach a camera at all (https + mediaDevices). */
export function browserCameraAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    window.isSecureContext
  )
}

interface NativeDetector {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>
}
type NativeDetectorClass = new (options?: { formats?: string[] }) => NativeDetector

function nativeDetector(): NativeDetectorClass | null {
  const ctor = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector
  return typeof ctor === 'function' ? ctor : null
}

function failureOf(error: unknown): BrowserScanFailure {
  const name = (error as { name?: string } | null)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'unsupported'
  return 'failed'
}

/**
 * Start reading codes from the back camera into `video`. Resolves to a stop
 * function; `onCode` is called with the first code read (then again only if
 * the caller keeps the camera running).
 */
export async function startBrowserScan(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
): Promise<() => void> {
  if (!browserCameraAvailable()) throw new BrowserScanError('unsupported')
  const constraints: MediaStreamConstraints = {
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  }

  const Native = nativeDetector()
  if (Native) {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints)
    } catch (error) {
      throw new BrowserScanError(failureOf(error))
    }
    video.srcObject = stream
    video.setAttribute('playsinline', 'true')
    await video.play().catch(() => undefined)
    const detector = new Native()
    let stopped = false
    const tick = async () => {
      if (stopped) return
      try {
        const found = await detector.detect(video)
        const code = found[0]?.rawValue?.trim()
        if (code) onCode(code)
      } catch {
        // A frame that could not be read is not an answer; try the next one.
      }
      if (!stopped) window.setTimeout(() => void tick(), 200)
    }
    void tick()
    return () => {
      stopped = true
      stream.getTracks().forEach((track) => track.stop())
      video.srcObject = null
    }
  }

  const { BrowserMultiFormatReader } = await import('@zxing/browser')
  const reader = new BrowserMultiFormatReader()
  try {
    const controls = await reader.decodeFromConstraints(constraints, video, (result) => {
      const code = result?.getText().trim()
      if (code) onCode(code)
    })
    return () => controls.stop()
  } catch (error) {
    throw new BrowserScanError(failureOf(error))
  }
}
