// packages/ui/src/components/ui/landing/three/scene-canvas.tsx
'use client'

// The canvas a variant's 3D scene is drawn on — and nothing about what is drawn.
//
// Order of events, which is the whole reason this file exists:
//   1. The variant's own markup paints (text, CSS). The canvas is empty and
//      transparent, so the largest paint never waits for Three.js.
//   2. When the browser is idle, `three` and the variant's `scene.ts` are
//      fetched together.
//   3. The scene runs only while the canvas is on screen and the tab is visible.
//
// No WebGL, a context that fails to start, or one that is lost later: the
// canvas stays empty and `onUnavailable` tells the page, which shows its own
// version of the picture. Nothing throws and nothing is logged.

import { useEffect, useRef } from 'react'

import type { SceneRuntime } from './runtime'
import { JOURNEY_ANALYTICS_EVENTS, type QualityTier } from '../journey.config'
import { emitJourneyEvent } from '../journey-analytics'

export interface SceneFrame {
  /** 0 → 1 along the variant's own scroll model. */
  progress: number
  /** Seconds the scene has been running; frozen at 0 under reduced motion. */
  time: number
}

/** A variant's scene: build the objects, return what to do each frame. */
export type SceneSetup = (runtime: SceneRuntime) => (frame: SceneFrame) => void

export interface SceneCanvasProps {
  /** What the picture shows, for someone who cannot see it. */
  label: string
  /** The variant's own `scene.ts`, fetched after first paint. */
  load: () => Promise<{ default: SceneSetup }>
  /**
   * Where the visitor is in the story, 0 → 1. Left out: how far down the
   * document they have scrolled. A variant with another scroll model (a
   * horizontal lane, a set of stations) passes its own reader.
   */
  progress?: (() => number) | undefined
  /**
   * Called when there will be no picture: no WebGL on this device, or the
   * graphics context was lost. The page shows its own version of the story.
   */
  onUnavailable?: (() => void) | undefined
  className?: string | undefined
}

function documentProgress(): number {
  const span = document.documentElement.scrollHeight - window.innerHeight
  if (span <= 0) return 0
  return Math.min(1, Math.max(0, window.scrollY / span))
}

/** How far the viewport has travelled through `element`, 0 → 1. */
export function spanProgress(element: Element | null): number {
  if (!element) return 0
  const box = element.getBoundingClientRect()
  const span = box.height - window.innerHeight
  if (span <= 0) return 0
  return Math.min(1, Math.max(0, -box.top / span))
}

function whenIdle(run: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(run, { timeout: 1500 })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(run, 300)
  return () => window.clearTimeout(id)
}

export function SceneCanvas({ label, load, progress, onUnavailable, className }: SceneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // Read through a ref so a new function identity never rebuilds the renderer.
  const progressRef = useRef(progress)
  const loadRef = useRef(load)
  const unavailableRef = useRef(onUnavailable)

  useEffect(() => {
    progressRef.current = progress
    loadRef.current = load
    unavailableRef.current = onUnavailable
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    let stop = () => {}

    const cancelIdle = whenIdle(() => {
      void Promise.all([import('./runtime'), loadRef.current()])
        .then(([runtimeModule, sceneModule]) => {
          if (cancelled) return
          if (!runtimeModule.isWebGLAvailable()) {
            unavailableRef.current?.()
            return
          }

          const runtime = runtimeModule.createSceneRuntime(canvas)
          let draw = sceneModule.default(runtime)
          const still = window.matchMedia('(prefers-reduced-motion: reduce)')

          let frame = 0
          let onScreen = false
          let started = 0
          let lastTick = 0
          let benchmarkFrames = 0
          let benchmarkTimeTotal = 0
          let droppedCount = 0
          let benchmarkSettled = false

          const tick = (now: number) => {
            frame = 0
            if (!onScreen || document.visibilityState !== 'visible') return
            if (started === 0) {
              started = now
              lastTick = now
            }

            const delta = now - lastTick
            lastTick = now

            // 60-frame benchmark during initial run
            if (!benchmarkSettled && !still.matches) {
              benchmarkFrames++
              benchmarkTimeTotal += delta
              if (delta > 25) droppedCount++

              if (benchmarkFrames >= 60) {
                benchmarkSettled = true
                const avgFrameTime = benchmarkTimeTotal / 60
                const estimatedFps = Math.min(60, Math.round(1000 / Math.max(1, avgFrameTime)))

                // Downgrade tier if performance budget is violated (> 25ms per frame)
                if (avgFrameTime > 25) {
                  const currentTier = runtime.tier
                  const nextTier: Record<QualityTier, QualityTier> = {
                    S: 'A',
                    A: 'B',
                    B: 'C',
                    C: 'D',
                    D: 'D',
                  }
                  const downgraded = nextTier[currentTier]
                  if (downgraded !== currentTier) {
                    runtime.setTier(downgraded)
                  }
                }

                emitJourneyEvent(JOURNEY_ANALYTICS_EVENTS.PERFORMANCE_TIER, {
                  tier: runtime.tier,
                  fps: estimatedFps,
                  droppedFrames: droppedCount,
                  deviceMemory: (navigator as unknown as { deviceMemory?: number }).deviceMemory,
                  hardwareConcurrency: navigator.hardwareConcurrency,
                })
              }
            }

            draw({
              progress: (progressRef.current ?? documentProgress)(),
              time: still.matches ? 0 : (now - started) / 1000,
            })
            runtime.render()
            frame = requestAnimationFrame(tick)
          }
          const wake = () => {
            if (frame === 0) frame = requestAnimationFrame(tick)
          }

          const watcher = new IntersectionObserver(([entry]) => {
            onScreen = Boolean(entry?.isIntersecting)
            wake()
          })
          watcher.observe(canvas)
          document.addEventListener('visibilitychange', wake)

          // Context lost / restored recovery
          const onLost = (event: Event) => {
            event.preventDefault()
            onScreen = false
            unavailableRef.current?.()
            if (frame !== 0) {
              cancelAnimationFrame(frame)
              frame = 0
            }
          }

          const onRestored = () => {
            try {
              runtime.dispose()
              const restoredRuntime = runtimeModule.createSceneRuntime(canvas)
              draw = sceneModule.default(restoredRuntime)
              onScreen = true
              wake()
            } catch {
              // Context cannot be restored; keep unavailable
            }
          }

          canvas.addEventListener('webglcontextlost', onLost)
          canvas.addEventListener('webglcontextrestored', onRestored)

          stop = () => {
            watcher.disconnect()
            document.removeEventListener('visibilitychange', wake)
            canvas.removeEventListener('webglcontextlost', onLost)
            canvas.removeEventListener('webglcontextrestored', onRestored)
            if (frame !== 0) cancelAnimationFrame(frame)
            runtime.dispose()
          }
        })
        .catch(() => {
          // The scene could not be built; the page tells the story itself.
          unavailableRef.current?.()
        })
    })

    return () => {
      cancelled = true
      cancelIdle()
      stop()
    }
  }, [])

  return <canvas ref={canvasRef} role="img" aria-label={label} className={className} />
}
