// ============================================
// packages/ui/src/components/ui/guide/interactive-guide.tsx
// Persistent, Non-Blocking, Interactive Step Guide
//
// ⚠️ THE CARD STANDS NEXT TO THE SECTION IT DESCRIBES, NOT IN A CORNER.
//
// It used to be a fixed block in the bottom corner of every page, so step 1
// «about the KPI cards» sat a screen away from the cards. It now measures the
// element a step names (`[data-guide="<sectionId>"]`) and sits just above it —
// or just below when the top of the viewport is too close — with a small
// arrow on the side that faces the section.
//
// The page scrolls inside `<main>`, not the window, so the position is
// re-measured on every scroll event captured at the window, on resize, and
// whenever the section or the card changes size.
// ============================================

'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, X, ChevronRight, Check, HelpCircle } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useGuideStore } from '@hisabche/store'
import {
  GUIDE_CATALOG,
  GUIDE_SECTION_ATTRIBUTE,
  guidePageAnchor,
  type GuideStepDefinition,
} from '@hisabche/ui-contract'
import { formatNumber } from '@hisabche/formatting'
import { cn } from '../../../lib/utils'
import { Button } from '../button'

/** Wide enough for a sentence, narrow enough to stay a card. */
const CARD_MAX_WIDTH = 340
/** Never closer than this to the edge of the viewport. */
const EDGE = 12
/** Space between the card and the section it describes. */
const GAP = 12

export interface InteractiveGuideProps {
  currentRoute: string
  t: (key: string) => string
}

interface AnchorRect {
  top: number
  bottom: number
  left: number
}

interface Placement {
  top: number
  left: number
  width: number
  /** Which side of the card touches the section; none when it had to be clamped. */
  arrow: 'top' | 'bottom' | null
  /** Physical pixels from the card's left edge to the arrow. */
  arrowOffset: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function InteractiveGuide({ currentRoute, t }: InteractiveGuideProps) {
  const locale = useLocale()
  const completedSteps = useGuideStore((s) => s.completedSteps)
  const dismissedForSession = useGuideStore((s) => s.dismissedForSession)
  const markStepSeen = useGuideStore((s) => s.markStepSeen)
  const dismissSession = useGuideStore((s) => s.dismissSession)
  const resetRouteProgress = useGuideStore((s) => s.resetRouteProgress)

  // Normalize route string (remove leading / and locale)
  const cleanRoute = useMemo(() => {
    return (
      currentRoute
        .replace(/^\/(fa|af|en)(?=\/|$)/, '')
        .replace(/^\//, '')
        .split('/')[0] || 'dashboard'
    )
  }, [currentRoute])

  const routeSteps = useMemo(() => {
    return [...(GUIDE_CATALOG[cleanRoute] ?? [])].sort((a, b) => a.order - b.order)
  }, [cleanRoute])

  // Active step is the earliest unseen step in this route
  const currentStep = useMemo<GuideStepDefinition | null>(() => {
    if (dismissedForSession || routeSteps.length === 0) return null
    return routeSteps.find((step) => !completedSteps[step.id]?.seen) ?? null
  }, [dismissedForSession, routeSteps, completedSteps])

  const allSeen = routeSteps.length > 0 && routeSteps.every((step) => completedSteps[step.id]?.seen)

  const totalSteps = routeSteps.length
  const currentStepIndex = currentStep
    ? routeSteps.findIndex((s) => s.id === currentStep.id) + 1
    : 0

  // ─── Where the section is ──────────────────────────────────────────────
  const cardRef = useRef<HTMLDivElement | null>(null)
  const lastRect = useRef<AnchorRect | null>(null)
  /** Set by «next» — the reader asked to move, so the next section may be scrolled to. */
  const scrollToSection = useRef(false)
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null)
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null)
  const [anchorState, setAnchorState] = useState<'pending' | 'found' | 'missing'>('pending')
  const [cardHeight, setCardHeight] = useState(0)

  useEffect(() => {
    const sync = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  useEffect(() => {
    if (!currentStep) {
      setAnchorState('missing')
      setAnchorRect(null)
      return
    }

    const findTarget = () =>
      document.querySelector<HTMLElement>(
        `[${GUIDE_SECTION_ATTRIBUTE}="${currentStep.sectionId}"]`,
      ) ??
      document.querySelector<HTMLElement>(
        `[${GUIDE_SECTION_ATTRIBUTE}="${guidePageAnchor(cleanRoute)}"]`,
      )

    setAnchorState('pending')

    const measure = () => {
      const target = findTarget()
      if (!target) {
        lastRect.current = null
        setAnchorRect(null)
        setAnchorState('missing')
        return
      }
      const rect = target.getBoundingClientRect()
      const next = { top: rect.top, bottom: rect.bottom, left: rect.left }
      const previous = lastRect.current
      // Scroll fires many times per second; only a position that actually
      // changed produces a new render.
      if (
        !previous ||
        previous.top !== next.top ||
        previous.bottom !== next.bottom ||
        previous.left !== next.left
      ) {
        lastRect.current = next
        setAnchorRect(next)
      }
      setAnchorState('found')
    }

    measure()

    // Only after «next»: scrolling on page load would move a page the reader
    // just opened, before they have asked for anything.
    if (scrollToSection.current) {
      scrollToSection.current = false
      const target = findTarget()
      const rect = target?.getBoundingClientRect()
      if (target && rect && (rect.top > window.innerHeight - EDGE || rect.bottom < EDGE)) {
        const reduceMotion =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
        target.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' })
      }
    }

    // `capture` because the page scrolls inside `<main>`: a scroll event does
    // not bubble out of it, and the card would otherwise stay where the section
    // used to be.
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)

    // Content above the section can grow after it loads without a scroll, and
    // then the section moves. Re-measure when either the section or the page
    // changes size.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(findTarget() ?? document.body)
    observer?.observe(document.body)

    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [currentStep, cleanRoute])

  useEffect(() => {
    const card = cardRef.current
    if (!card) {
      setCardHeight(0)
      return
    }
    const sync = () => setCardHeight(card.offsetHeight)
    sync()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync)
    observer?.observe(card)
    return () => observer?.disconnect()
  }, [currentStep])

  const placement = useMemo<Placement | null>(() => {
    if (!anchorRect || !viewport || cardHeight === 0) return null

    const width = Math.min(CARD_MAX_WIDTH, viewport.width - EDGE * 2)
    const fitsAbove = anchorRect.top - EDGE >= cardHeight + GAP
    const rawTop = fitsAbove ? anchorRect.top - cardHeight - GAP : anchorRect.bottom + GAP
    const top = clamp(rawTop, EDGE, Math.max(EDGE, viewport.height - cardHeight - EDGE))
    const left = clamp(anchorRect.left, EDGE, Math.max(EDGE, viewport.width - width - EDGE))
    // A clamped card no longer touches the section, so it grows no arrow: a
    // pointer aimed at nothing is worse than none.
    const touchesSection = Math.abs(top - rawTop) < 1

    return {
      top,
      left,
      width,
      arrow: touchesSection ? (fitsAbove ? 'bottom' : 'top') : null,
      arrowOffset: clamp(anchorRect.left + 20 - left, 16, width - 36),
    }
  }, [anchorRect, viewport, cardHeight])

  const handleNext = useCallback(() => {
    if (!currentStep) return
    const isLast = routeSteps[routeSteps.length - 1]?.id === currentStep.id
    scrollToSection.current = !isLast
    markStepSeen(currentStep.id, cleanRoute)
  }, [currentStep, routeSteps, markStepSeen, cleanRoute])

  const handleRestart = useCallback(() => {
    scrollToSection.current = true
    resetRouteProgress(cleanRoute)
  }, [resetRouteProgress, cleanRoute])

  // Everything the route teaches has been read: leave a way back in, because a
  // guide that can only be read once is a guide nobody can re-read after
  // forgetting a step.
  if (!currentStep) {
    if (!allSeen || dismissedForSession) return null
    return (
      <button
        type="button"
        onClick={handleRestart}
        aria-label={t('guide.short')}
        className={cn(
          'fixed bottom-6 end-6 z-40 inline-flex items-center gap-1.5 rounded-full',
          'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2',
          'text-xs font-medium text-[hsl(var(--fg-secondary))] shadow-lg',
          'hover:text-[hsl(var(--fg-primary))] hover:border-[hsl(var(--border-strong))]',
          'transition-colors duration-150 motion-reduce:transition-none',
        )}
      >
        <HelpCircle className="size-4" aria-hidden="true" />
        <span>{t('guide.short')}</span>
      </button>
    )
  }

  // Held back for one frame while the section is measured, so the card is not
  // seen jumping from the corner to the section.
  const hidden = anchorState === 'pending' || (anchorState === 'found' && placement === null)

  return (
    <div
      ref={cardRef}
      role="region"
      aria-label={t('guide.regionLabel')}
      style={
        placement ? { top: placement.top, left: placement.left, width: placement.width } : undefined
      }
      className={cn(
        'fixed z-50 rounded-xl border border-[hsl(var(--color-primary)/0.35)] p-4',
        'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-primary))] shadow-2xl',
        'animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none',
        placement ? undefined : 'bottom-6 end-6 w-[min(340px,calc(100vw-1.5rem))]',
        hidden && 'invisible',
      )}
    >
      {placement?.arrow ? (
        <span
          aria-hidden="true"
          style={{ left: placement.arrowOffset }}
          className={cn(
            'absolute size-3 rotate-45 border-[hsl(var(--color-primary)/0.35)]',
            'bg-[hsl(var(--surface-elevated))]',
            placement.arrow === 'bottom'
              ? '-bottom-1.5 border-b border-e'
              : '-top-1.5 border-s border-t',
          )}
        />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Sparkles
            className="size-4 shrink-0 text-[hsl(var(--color-primary))]"
            aria-hidden="true"
          />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--color-primary))]">
            {t('guide.badge')}
          </span>
          <span className="rounded-full bg-[hsl(var(--color-primary)/0.12)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[hsl(var(--color-primary))]">
            {formatNumber(currentStepIndex, locale)} / {formatNumber(totalSteps, locale)}
          </span>
        </div>
        <button
          type="button"
          onClick={dismissSession}
          aria-label={t('common.close')}
          className="rounded p-1 text-[hsl(var(--fg-tertiary))] transition-colors hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-2 space-y-1">
        <h4 className="text-sm font-bold text-[hsl(var(--fg-primary))]">
          {t(currentStep.titleKey)}
        </h4>
        <p className="text-xs leading-relaxed text-[hsl(var(--fg-secondary))]">
          {t(currentStep.descriptionKey)}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-1" aria-hidden="true">
        {routeSteps.map((step, index) => (
          <span
            key={step.id}
            className={cn(
              'h-1 rounded-full transition-all duration-200 motion-reduce:transition-none',
              index < currentStepIndex
                ? 'w-4 bg-[hsl(var(--color-primary))]'
                : 'w-2 bg-[hsl(var(--border-strong))]',
            )}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[hsl(var(--border-default))] pt-2">
        <span className="text-[11px] text-[hsl(var(--fg-tertiary))]">
          {t('guide.persistentTip')}
        </span>
        <Button
          size="sm"
          variant="default"
          onClick={handleNext}
          className="flex items-center gap-1.5 text-xs font-medium"
        >
          {currentStepIndex === totalSteps ? (
            <>
              <span>{t('guide.finish')}</span>
              <Check className="size-3.5" aria-hidden="true" />
            </>
          ) : (
            <>
              <span>{t('guide.next')}</span>
              <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
