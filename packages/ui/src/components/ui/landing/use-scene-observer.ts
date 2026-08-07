// packages/ui/src/components/ui/landing/use-scene-observer.ts
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

import {
  isSectionId,
  queueSetActiveSection,
  type NarrativeState,
  type SectionId,
} from './use-scroll-narrative-store'

export type SceneState = 'hidden' | 'visible' | 'animated'

interface UseSceneObserverOptions {
  threshold?: number
  rootMargin?: string
  narrativeState?: NarrativeState
  cooldownMs?: number
  mountDelayMs?: number
}

interface UseSceneObserverReturn<T extends HTMLElement> {
  ref: React.RefObject<T | null>
  state: SceneState
}

const lastTriggerTime = new Map<SectionId, number>()

function canTrigger(section: SectionId, cooldownMs: number): boolean {
  const last = lastTriggerTime.get(section) ?? 0
  return Date.now() - last > cooldownMs
}

function recordTrigger(section: SectionId): void {
  lastTriggerTime.set(section, Date.now())
}

// ─── matchMedia به‌جای window.innerWidth polling ─────────────────────────
// چرا این جایگزین بهتریه:
// خوندن window.innerWidth داخل setTimeout فقط یه snapshot لحظه‌ایه؛ اگه
// قبل از استیبل‌شدن layout (لود فونت، عکس‌های سنگین unoptimized که باعث
// reflow می‌شن) خونده بشه، می‌تونه اشتباه باشه و فقط با resize دستی درست بشه.
// matchMedia یک subscription زنده می‌ده: مرورگر خودش دوباره محاسبه می‌کنه
// و رویداد change رو با مقدار درست صدا می‌زنه — بدون حدس زدن با تایمر.

const DESKTOP_QUERY = '(min-width: 1024px)'

function useIsDesktop(): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null) // null = هنوز معلوم نیست

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY)
    setIsDesktop(mql.matches)

    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', listener)
    return () => mql.removeEventListener('change', listener)
  }, [])

  return isDesktop
}

function getDeviceConfig(isDesktop: boolean) {
  if (isDesktop) {
    return { threshold: 0.1, rootMargin: '0px 0px 0px 0px' }
  }
  return { threshold: 0.25, rootMargin: '0px 0px -40px 0px' }
}

export function useSceneObserver<T extends HTMLElement = HTMLDivElement>(
  options: UseSceneObserverOptions = {},
): UseSceneObserverReturn<T> {
  const {
    threshold: userThreshold,
    rootMargin: userRootMargin,
    narrativeState,
    cooldownMs = 300,
    mountDelayMs = 120,
  } = options

  const ref = useRef<T>(null)
  const [state, setState] = useState<SceneState>('hidden')
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sectionIdRef = useRef<SectionId | null>(null)
  const hasAnimatedRef = useRef(false)

  const isDesktop = useIsDesktop()

  const setupObserver = useCallback(
    (element: T, desktop: boolean) => {
      const sectionId = sectionIdRef.current
      observerRef.current?.disconnect()

      const device = getDeviceConfig(desktop)
      const threshold = userThreshold ?? device.threshold
      const rootMargin = userRootMargin ?? device.rootMargin

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          if (!entry) return
          if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
            if (sectionId && canTrigger(sectionId, cooldownMs)) {
              recordTrigger(sectionId)
              queueSetActiveSection(sectionId)
            }
          }
        },
        { threshold, rootMargin },
      )

      observer.observe(element)
      observerRef.current = observer
    },
    [userThreshold, userRootMargin, cooldownMs],
  )

  // یک افکت واحد که هم mount اولیه و هم تغییر کلاس دستگاه (موبایل↔دسکتاپ)
  // رو پوشش می‌ده — دیگه افکت جدا برای resize با debounce لازم نیست.
  useEffect(() => {
    const element = ref.current
    if (!element || isDesktop === null) return // صبر کن اولین مقدار واقعی معلوم بشه

    const rawId = element.id
    if (!rawId || !isSectionId(rawId)) {
      if (!rawId) console.warn('[Observer] Element is missing an id.', element)
      else console.warn(`[Observer] Unknown section id "${rawId}".`)
      return
    }

    sectionIdRef.current = rawId

    if (narrativeState) {
      element.setAttribute('data-narrative', narrativeState)
    }

    setupObserver(element, isDesktop)

    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
    }
  }, [isDesktop, narrativeState, setupObserver])

  // انیمیشن ورود، مستقل از observer
  useEffect(() => {
    const mountTimer = setTimeout(() => {
      setState('visible')
      const animateTimer = setTimeout(() => {
        if (!hasAnimatedRef.current) {
          hasAnimatedRef.current = true
          setState('animated')
        }
      }, 50)
      return () => clearTimeout(animateTimer)
    }, mountDelayMs)

    return () => clearTimeout(mountTimer)
  }, [mountDelayMs])

  return { ref, state }
}

export type { NarrativeState, SectionId }
