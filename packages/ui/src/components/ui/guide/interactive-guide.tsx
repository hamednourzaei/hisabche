// ============================================
// packages/ui/src/components/ui/guide/interactive-guide.tsx
// The in-app guide: one card per step, beside the section it describes.
//
// Owner request (8 Nov 2026) — production behaviour:
//   1. READ ONCE, NEVER AGAIN. The steps a person has seen are stored on the
//      server for that person (`/api/me/guide-progress`) and mirrored on the
//      device, so neither a hard refresh, another browser nor another device
//      shows them again. Nothing is drawn until that record has answered.
//   2. SPOTLIGHT. While a step is open, everything but its section is dimmed
//      and blurred and the page is locked — no click, scroll or key reaches it
//      — until the reader presses «next» or closes the guide.
//   3. RIGHT-TO-LEFT. The card aligns with the section's start edge and the
//      arrow points at it in Persian and Dari as in English (guide-placement).
//   4. IT LEADS ON. When a page's guide ends, the card names the next page that
//      still has something to teach and takes the reader there.
//
// Closing (×) means «I don't need this page's guide»: its remaining steps are
// recorded as seen. «راهنما» reads a page again without forgetting anything.
// ============================================

'use client'

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, Check, ChevronRight, HelpCircle, Sparkles, X } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useAuthStore, useGuideStore } from '@hisabche/store'
import { useGuideProgress, useMarkGuideStepsSeen } from '@hisabche/api'
import {
  GUIDE_CATALOG,
  GUIDE_SECTION_ATTRIBUTE,
  guidePageAnchor,
  nextGuideRoute,
  type GuideStepDefinition,
} from '@hisabche/ui-contract'
import { formatNumber } from '@hisabche/formatting'
import { cn } from '../../../lib/utils'
import { useActionAvailability } from '../../../lib/capability/use-action-availability'
import { useLocalePush } from '../../../hooks/use-locale-push'
import { Button } from '../button'
import { placeGuideCard, spotlightHole, type GuideRect } from './guide-placement'

export interface InteractiveGuideProps {
  currentRoute: string
  t: (key: string) => string
}

/** Keys that scroll the page; swallowed while the guide holds it. */
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
  'Spacebar',
])

const OVERLAY =
  'fixed bg-[hsl(var(--surface-base)/0.55)] backdrop-blur-[3px] motion-reduce:backdrop-blur-none'

export function InteractiveGuide({ currentRoute, t }: InteractiveGuideProps) {
  const locale = useLocale()
  const push = useLocalePush()
  const userId = useAuthStore((s) => s.user?.id ?? null)

  const completedSteps = useGuideStore((s) => s.completedSteps)
  const ownerId = useGuideStore((s) => s.ownerId)
  const bindOwner = useGuideStore((s) => s.bindOwner)
  const markStepsSeen = useGuideStore((s) => s.markStepsSeen)
  const mergeRemoteProgress = useGuideStore((s) => s.mergeRemoteProgress)
  const replayRoute = useGuideStore((s) => s.replayRoute)
  const replaySeen = useGuideStore((s) => s.replaySeen)
  const startReplay = useGuideStore((s) => s.startReplay)
  const advanceReplay = useGuideStore((s) => s.advanceReplay)
  const endReplay = useGuideStore((s) => s.endReplay)

  // ─── The person's record ───────────────────────────────────────────────
  const online = useActionAvailability('ui.guide_progress').available
  const remote = useGuideProgress({ enabled: Boolean(userId) && online })
  // `mutate` is stable across renders (TanStack Query), unlike the result object.
  const saveRemote = useMarkGuideStepsSeen().mutate

  useEffect(() => {
    if (userId) bindOwner(userId)
  }, [userId, bindOwner])

  // Server → device, then device → server for anything seen offline or before
  // the record existed. Once per answer.
  const remoteData = remote.data
  useEffect(() => {
    if (!remoteData?.configured || !userId || ownerId !== userId) return
    mergeRemoteProgress(
      Object.fromEntries(
        remoteData.steps.map((step) => [
          step.stepId,
          { stepId: step.stepId, routeId: step.routeId, seen: true, completedAt: step.seenAt },
        ]),
      ),
    )
    const onServer = new Set(remoteData.steps.map((step) => step.stepId))
    const onlyHere = Object.values(useGuideStore.getState().completedSteps)
      .filter((step) => step.seen && !onServer.has(step.stepId))
      .map((step) => ({ stepId: step.stepId, routeId: step.routeId }))
      .slice(0, 100)
    if (onlyHere.length > 0) saveRemote(onlyHere)
  }, [remoteData, userId, ownerId, mergeRemoteProgress, saveRemote])

  /** Nothing is drawn until we know what this person has already read. */
  const recordReady =
    Boolean(userId) && ownerId === userId && (!online || remote.isSuccess || remote.isError)

  const record = useCallback(
    (steps: { stepId: string; routeId: string }[]) => {
      if (steps.length === 0) return
      markStepsSeen(steps)
      if (online) saveRemote(steps)
    },
    [markStepsSeen, online, saveRemote],
  )

  // ─── Which step ────────────────────────────────────────────────────────
  const cleanRoute = useMemo(
    () =>
      currentRoute
        .replace(/^\/(fa|af|en)(?=\/|$)/, '')
        .replace(/^\//, '')
        .split('/')[0] || 'dashboard',
    [currentRoute],
  )

  const routeSteps = useMemo(
    () => [...(GUIDE_CATALOG[cleanRoute] ?? [])].sort((a, b) => a.order - b.order),
    [cleanRoute],
  )

  const replaying = replayRoute === cleanRoute
  const isSeen = useCallback(
    (stepId: string) => Boolean(completedSteps[stepId]?.seen),
    [completedSteps],
  )

  const currentStep = useMemo<GuideStepDefinition | null>(() => {
    if (!recordReady || routeSteps.length === 0) return null
    if (replaying) return routeSteps.find((step) => !replaySeen.includes(step.id)) ?? null
    return routeSteps.find((step) => !isSeen(step.id)) ?? null
  }, [recordReady, routeSteps, replaying, replaySeen, isSeen])

  // A replay that ran out ends itself.
  useEffect(() => {
    if (replaying && recordReady && currentStep === null) endReplay()
  }, [replaying, recordReady, currentStep, endReplay])

  /** Set when the reader finishes a page in this visit — the «where next» card. */
  // Shown only while the reader is still on that page (`showFinished` below).
  const [finishedRoute, setFinishedRoute] = useState<string | null>(null)

  const totalSteps = routeSteps.length
  const currentStepIndex = currentStep
    ? routeSteps.findIndex((s) => s.id === currentStep.id) + 1
    : 0
  const allSeen = routeSteps.length > 0 && routeSteps.every((step) => isSeen(step.id))
  const nextStop = useMemo(() => nextGuideRoute(cleanRoute, isSeen), [cleanRoute, isSeen])
  const showFinished = finishedRoute === cleanRoute && !currentStep
  const active = Boolean(currentStep) || showFinished

  // ─── Where the section is ──────────────────────────────────────────────
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null)
  const [targetRect, setTargetRect] = useState<GuideRect | null>(null)
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('rtl')
  const [cardHeight, setCardHeight] = useState(0)

  useEffect(() => {
    const sync = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  useEffect(() => {
    // No step: the rect is ignored (`placement` reads it only with a step).
    if (!currentStep) return
    const findTarget = () =>
      document.querySelector<HTMLElement>(
        `[${GUIDE_SECTION_ATTRIBUTE}="${currentStep.sectionId}"]`,
      ) ??
      document.querySelector<HTMLElement>(
        `[${GUIDE_SECTION_ATTRIBUTE}="${guidePageAnchor(cleanRoute)}"]`,
      )

    let last = ''
    const measure = () => {
      const target = findTarget()
      if (!target) {
        if (last !== 'none') {
          last = 'none'
          setTargetRect(null)
        }
        return
      }
      const rect = target.getBoundingClientRect()
      const key = `${rect.top}|${rect.bottom}|${rect.left}|${rect.right}`
      if (key !== last) {
        last = key
        setTargetRect({ top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right })
      }
      setDirection(getComputedStyle(target).direction === 'ltr' ? 'ltr' : 'rtl')
    }

    // The page is locked while the guide is open, so the guide brings each
    // section into view itself.
    const target = findTarget()
    if (target) {
      const rect = target.getBoundingClientRect()
      const offscreen = rect.top < 72 || rect.bottom > window.innerHeight - 12
      if (offscreen && typeof target.scrollIntoView === 'function') {
        const reduceMotion =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
        target.scrollIntoView({
          block: rect.height > window.innerHeight * 0.6 ? 'start' : 'center',
          behavior: reduceMotion ? 'auto' : 'smooth',
        })
      }
    }
    measure()

    // `capture`: the page scrolls inside `<main>`, whose scroll does not bubble.
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(target ?? document.body)
    observer?.observe(document.body)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [currentStep, cleanRoute])

  useLayoutEffect(() => {
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
  }, [currentStep, showFinished])

  const placement = useMemo(
    () =>
      viewport && cardHeight > 0
        ? placeGuideCard({
            target: currentStep ? targetRect : null,
            viewport,
            cardHeight,
            direction,
          })
        : null,
    [viewport, cardHeight, currentStep, targetRect, direction],
  )

  // ─── Actions ───────────────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    if (!currentStep) return
    const isLast = routeSteps[routeSteps.length - 1]?.id === currentStep.id
    if (replaying) {
      advanceReplay(currentStep.id)
      return
    }
    record([{ stepId: currentStep.id, routeId: cleanRoute }])
    if (isLast) setFinishedRoute(cleanRoute)
  }, [currentStep, routeSteps, replaying, advanceReplay, record, cleanRoute])

  const handleClose = useCallback(() => {
    setFinishedRoute(null)
    if (replaying) {
      endReplay()
      return
    }
    record(
      routeSteps
        .filter((step) => !isSeen(step.id))
        .map((step) => ({ stepId: step.id, routeId: cleanRoute })),
    )
  }, [replaying, endReplay, record, routeSteps, isSeen, cleanRoute])

  const handleGoNext = useCallback(() => {
    setFinishedRoute(null)
    if (nextStop) push(nextStop.path)
  }, [nextStop, push])

  const handleRestart = useCallback(() => {
    setFinishedRoute(null)
    startReplay(cleanRoute)
  }, [startReplay, cleanRoute])

  // ─── The lock ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return
    const insideCard = (node: EventTarget | null) =>
      node instanceof Node && Boolean(cardRef.current?.contains(node))
    const block = (event: Event) => {
      if (!insideCard(event.target)) event.preventDefault()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleClose()
        return
      }
      if (event.key === 'Tab') {
        // Focus stays in the card.
        const focusable = cardRef.current?.querySelectorAll<HTMLElement>('button')
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]!
        const last = focusable[focusable.length - 1]!
        const current = document.activeElement
        if (!insideCard(current)) {
          event.preventDefault()
          first.focus()
        } else if (event.shiftKey && current === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && current === last) {
          event.preventDefault()
          first.focus()
        }
        return
      }
      if (SCROLL_KEYS.has(event.key) && !insideCard(event.target)) event.preventDefault()
    }
    window.addEventListener('wheel', block, { capture: true, passive: false })
    window.addEventListener('touchmove', block, { capture: true, passive: false })
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('wheel', block, true)
      window.removeEventListener('touchmove', block, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [active, handleClose])

  // The primary action takes focus on every step, so Enter moves on.
  const primaryRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (active) primaryRef.current?.focus({ preventScroll: true })
  }, [active, currentStep, showFinished])

  // ─── Nothing open: the way back in ─────────────────────────────────────
  if (!active) {
    if (!recordReady || !allSeen || replaying) return null
    return (
      <button
        type="button"
        onClick={handleRestart}
        aria-label={t('guide.short')}
        className={cn(
          'fixed bottom-24 end-4 z-40 inline-flex items-center gap-1.5 rounded-full lg:bottom-6 lg:end-6',
          'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2',
          'text-xs font-medium text-[hsl(var(--fg-secondary))] shadow-lg',
          'hover:border-[hsl(var(--border-strong))] hover:text-[hsl(var(--fg-primary))]',
          'transition-colors duration-150 motion-reduce:transition-none',
        )}
      >
        <HelpCircle className="size-4" aria-hidden="true" />
        <span>{t('guide.short')}</span>
      </button>
    )
  }

  if (typeof document === 'undefined') return null

  const hole = currentStep && targetRect && viewport ? spotlightHole(targetRect, viewport) : null
  const NextPageArrow = direction === 'rtl' ? ArrowLeft : ArrowRight

  const overlay = hole ? (
    <>
      <div
        aria-hidden="true"
        className={OVERLAY}
        style={{ top: 0, left: 0, right: 0, height: hole.top }}
      />
      <div
        aria-hidden="true"
        className={OVERLAY}
        style={{ top: hole.bottom, left: 0, right: 0, bottom: 0 }}
      />
      <div
        aria-hidden="true"
        className={OVERLAY}
        style={{ top: hole.top, left: 0, width: hole.left, height: hole.bottom - hole.top }}
      />
      <div
        aria-hidden="true"
        className={OVERLAY}
        style={{ top: hole.top, left: hole.right, right: 0, height: hole.bottom - hole.top }}
      />
      {/* The section stays sharp but cannot be clicked while the guide holds the page. */}
      <div
        aria-hidden="true"
        data-guide-spotlight=""
        className="fixed rounded-xl ring-2 ring-[hsl(var(--color-primary))] ring-offset-0"
        style={{
          top: hole.top,
          left: hole.left,
          width: hole.right - hole.left,
          height: hole.bottom - hole.top,
        }}
      />
    </>
  ) : (
    <div aria-hidden="true" className={cn(OVERLAY, 'inset-0')} />
  )

  const card = (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('guide.regionLabel')}
      data-guide-card=""
      style={
        placement
          ? { top: placement.top, left: placement.left, width: placement.width }
          : { top: 0, left: 0, width: 340 }
      }
      className={cn(
        'fixed rounded-xl border border-[hsl(var(--color-primary)/0.35)] p-4',
        'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-primary))] shadow-2xl',
        'animate-in fade-in duration-200 motion-reduce:animate-none',
        !placement && 'invisible',
      )}
    >
      {currentStep && placement?.arrow ? (
        <span
          aria-hidden="true"
          // Physical sides on purpose: `arrowOffset` is measured from the
          // card's physical left, and a rotated square's lower corner is its
          // bottom + right borders in every reading direction.
          style={
            placement.arrow === 'bottom'
              ? { left: placement.arrowOffset, borderBottomWidth: 1, borderRightWidth: 1 }
              : { left: placement.arrowOffset, borderTopWidth: 1, borderLeftWidth: 1 }
          }
          className={cn(
            'absolute size-3 rotate-45 border-solid border-[hsl(var(--color-primary)/0.35)]',
            'bg-[hsl(var(--surface-elevated))]',
            placement.arrow === 'bottom' ? '-bottom-1.5' : '-top-1.5',
          )}
        />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Sparkles
            className="size-4 shrink-0 text-[hsl(var(--color-primary))]"
            aria-hidden="true"
          />
          <span className="text-[11px] font-semibold tracking-wider text-[hsl(var(--color-primary))]">
            {t('guide.badge')}
          </span>
          {currentStep ? (
            <span className="rounded-full bg-[hsl(var(--color-primary)/0.12)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[hsl(var(--color-primary))]">
              {formatNumber(currentStepIndex, locale)} / {formatNumber(totalSteps, locale)}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label={t('guide.close')}
          title={t('guide.close')}
          className="rounded p-1 text-[hsl(var(--fg-tertiary))] transition-colors hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {currentStep ? (
        <>
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
              ref={primaryRef}
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
        </>
      ) : (
        <>
          <div className="mt-2 space-y-1">
            <h4 className="text-sm font-bold text-[hsl(var(--fg-primary))]">
              {nextStop ? t('guide.pageDoneTitle') : t('guide.allDoneTitle')}
            </h4>
            <p className="text-xs leading-relaxed text-[hsl(var(--fg-secondary))]">
              {nextStop ? t('guide.pageDoneBody') : t('guide.allDoneBody')}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[hsl(var(--border-default))] pt-2">
            {nextStop ? (
              <>
                <Button size="sm" variant="ghost" onClick={handleClose} className="text-xs">
                  {t('guide.later')}
                </Button>
                <Button
                  ref={primaryRef}
                  size="sm"
                  variant="default"
                  onClick={handleGoNext}
                  data-guide-next-page={nextStop.routeId}
                  className="flex items-center gap-1.5 text-xs font-medium"
                >
                  <span>
                    {t('guide.goTo')} {t(nextStop.labelKey)}
                  </span>
                  <NextPageArrow className="size-3.5" aria-hidden="true" />
                </Button>
              </>
            ) : (
              <Button
                ref={primaryRef}
                size="sm"
                variant="default"
                onClick={handleClose}
                className="text-xs"
              >
                {t('guide.finish')}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )

  return createPortal(
    <div data-guide-layer="" className="fixed inset-0 z-[70]">
      {overlay}
      {card}
    </div>,
    document.body,
  )
}
