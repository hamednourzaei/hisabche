// ═══════════════════════════════════════════════════════════
// packages/ui/src/lib/use-in-view.ts — v2: WeakMap + per-hook threshold
// ═══════════════════════════════════════════════════════════
"use client"

import { useEffect, useRef, useState } from "react"

type Callback = () => void
type ObserverEntry = { observer: IntersectionObserver; callbacks: WeakMap<Element, Callback> }

// Pool of observers keyed by threshold
const observerPool = new Map<number, ObserverEntry>()

function getObserver(threshold: number): ObserverEntry {
  const existing = observerPool.get(threshold)
  if (existing) return existing

  const callbacks = new WeakMap<Element, Callback>()
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const cb = callbacks.get(entry.target)
          if (cb) {
            cb()
            callbacks.delete(entry.target)
            observer.unobserve(entry.target)
          }
        }
      })
    },
    { threshold }
  )

  const entry: ObserverEntry = { observer, callbacks }
  observerPool.set(threshold, entry)
  return entry
}

export function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const { observer, callbacks } = getObserver(threshold)
    callbacks.set(el, () => setInView(true))
    observer.observe(el)

    return () => {
      callbacks.delete(el)
      observer.unobserve(el)
    }
  }, [threshold])

  return { ref, inView }
}