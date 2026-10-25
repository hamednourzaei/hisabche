import { useEffect, useRef, useState } from 'react'
import type { Cue, SceneSpec } from '../engine/types'

type CaptureSpec = Extract<SceneSpec, { kind: 'product-capture' }>

/** Where the media element's pending seeks are waiting; the exporter awaits them before each frame. */
const PENDING = '__REEL_MEDIA_PENDING'
type PendingSet = Set<Promise<void>>

const MIME: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

const isVideoName = (file: string) => /\.(mp4|webm)$/i.test(file)

/** What the fetch of `file` produced. Tagged with the file so a new file never shows the old result. */
type Loaded =
  | { file: string; state: 'ready'; url: string; ratio: number }
  | { file: string; state: 'failed'; reason: string }

/** Width over height of a still, read from the picture itself. */
function stillRatio(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = new globalThis.Image()
    probe.onload = () => resolve(probe.naturalWidth / probe.naturalHeight)
    probe.onerror = () => reject(new Error('the picture cannot be decoded'))
    probe.src = url
  })
}

function pendingSet(): PendingSet {
  const g = globalThis as unknown as Record<string, PendingSet | undefined>
  const existing = g[PENDING]
  if (existing) return existing
  const created: PendingSet = new Set()
  g[PENDING] = created
  return created
}

export interface CaptureViewProps {
  file: string
  route: string
  /** Seconds into a video where this scene starts. */
  trimStart?: number | undefined
  /** `contain` keeps the whole screen; `cover` fills the frame and may crop. */
  fit?: 'contain' | 'cover' | undefined
  /** Seconds since the scene began. */
  t: number
  /** Frame width in px (default 1000, the full-scene width). */
  width?: number | undefined
  /** Frame height cap in px (default 1100). */
  maxHeight?: number | undefined
}

/**
 * A real recording of the product, played at the scene's own time (`trimStart + t`), in a frame.
 *
 * ⚠️ It never draws an interface. If the file is not there it says so on screen and the exporter
 * refuses the reel (`scripts/product-capture.mjs`); there is no stand-in. A scene that embeds this
 * inside its own layout (a split screen, say) must list the file in its `captures`, or the export
 * gate and the manifest would not know about it.
 * The bytes are fetched and wrapped in a blob so a download manager in the browser (it grabs
 * media-looking URLs) cannot take them over — same trick as the preview's sounds.
 */
export function CaptureView({
  file,
  route,
  trimStart,
  fit = 'contain',
  t,
  width = 1000,
  maxHeight = 1100,
}: CaptureViewProps) {
  const [result, setResult] = useState<Loaded | null>(null)
  const loaded = result && result.file === file ? result : null
  const video = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    let alive = true
    let url = ''
    fetch(`/capture-data?f=${encodeURIComponent(file)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const bytes = await response.arrayBuffer()
        const type = MIME[file.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'
        url = URL.createObjectURL(new Blob([bytes], { type }))
        // A still's shape is read once; a video's is its own. (No <img>: the frame is a box
        // of this shape with the picture as its background, so `fit` means what it says.)
        const ratio = isVideoName(file) ? 0 : await stillRatio(url)
        if (alive) setResult({ file, state: 'ready', url, ratio })
      })
      .catch((error: unknown) => {
        if (alive)
          setResult({
            file,
            state: 'failed',
            reason: error instanceof Error ? error.message : 'unknown',
          })
      })
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [file])

  // The frame being drawn is the frame at `trimStart + t`, held on the last frame past the end.
  const wanted = (trimStart ?? 0) + t
  useEffect(() => {
    const element = video.current
    if (!element || loaded?.state !== 'ready') return
    const seek = () => {
      const last = Number.isFinite(element.duration) ? Math.max(0, element.duration - 0.04) : wanted
      const target = Math.min(wanted, last)
      if (Math.abs(element.currentTime - target) < 0.001) return
      const done = new Promise<void>((resolve) => {
        const finish = () => {
          element.removeEventListener('seeked', finish)
          resolve()
        }
        element.addEventListener('seeked', finish)
      })
      const set = pendingSet()
      set.add(done)
      void done.then(() => set.delete(done))
      element.currentTime = target
    }
    if (element.readyState >= 1) seek()
    else element.addEventListener('loadedmetadata', seek, { once: true })
  }, [wanted, loaded?.state])

  const missing = loaded?.state === 'failed'

  return (
    <div
      style={{
        width,
        maxHeight,
        borderRadius: 28,
        overflow: 'hidden',
        background: 'var(--panel)',
        border: missing ? '3px dashed rgba(251,113,133,0.8)' : '2px solid rgba(255,255,255,0.14)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: missing ? Math.min(420, maxHeight) : undefined,
      }}
    >
      {loaded?.state === 'ready' && isVideoName(file) && (
        <video
          ref={video}
          src={loaded.url}
          muted
          playsInline
          preload="auto"
          style={{ width: '100%', maxHeight, objectFit: fit, display: 'block' }}
        />
      )}
      {loaded?.state === 'ready' && !isVideoName(file) && (
        <div
          role="img"
          aria-label={route}
          style={{
            width: '100%',
            aspectRatio: String(loaded.ratio || 1),
            maxHeight,
            backgroundImage: `url(${loaded.url})`,
            backgroundSize: fit,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}
      {missing && (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            direction: 'rtl',
            color: '#fb7185',
            fontSize: width < 700 ? 30 : 38,
            lineHeight: 1.6,
          }}
        >
          ضبط واقعی محصول موجود نیست
          <div dir="ltr" style={{ fontSize: width < 700 ? 22 : 28, opacity: 0.85, marginTop: 12 }}>
            {file} · {route}
          </div>
        </div>
      )}
    </div>
  )
}

/** The whole scene: the recording centred in the frame, with its (one or two word) label above. */
export function ProductCaptureScene({ spec, t }: { spec: CaptureSpec; t: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zoom: 0.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: spec.stage?.background,
      }}
    >
      <CaptureView
        file={spec.file}
        route={spec.route}
        trimStart={spec.trimStart}
        fit={spec.fit}
        t={t}
      />
      {spec.label && (
        <div
          style={{
            position: 'absolute',
            top: '15%',
            padding: '10px 28px',
            borderRadius: 999,
            background: spec.stage ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.1)',
            color: spec.stage?.ink ?? 'var(--ink)',
            fontSize: 38,
            direction: 'rtl',
          }}
        >
          {spec.label}
        </div>
      )}
    </div>
  )
}

/** The whoosh that opens a new scene (hard rule 15); the recording itself carries no sound. */
export function productCaptureCues(): Cue[] {
  return [{ at: 0.02, kind: 'whoosh' }]
}
