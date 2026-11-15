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
//   5. ONLY WHAT THIS PERSON HAS (owner, 15 Nov 2026). A step names the hub tab
//      and switch it teaches; the guide opens them through the address and SKIPS
//      a step whose tab this person's screen does not offer (role, trade, their
//      own look). Steps of a DNA module the business does not run are not taught,
//      and «next page» goes only to a page in this person's menu (use-guide-scope).
//
// Closing (×) means «I don't need this page's guide»: its remaining steps are
// recorded as seen. «راهنما» reads a page again without forgetting anything.
// ============================================

'use client'

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  HelpCircle,
  Sparkles,
  X,
} from 'lucide-react'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore, useGuideStore } from '@hisabche/store'
import { useGuideProgress, useMarkGuideStepsSeen } from '@hisabche/api'
import {
  GUIDE_ACTIVE_ATTRIBUTE,
  GUIDE_CATALOG,
  GUIDE_SECTION_ATTRIBUTE,
  GUIDE_TAB_ATTRIBUTE,
  GUIDE_VIEW_ATTRIBUTE,
  guidePageAnchor,
  guideRouteOf,
  guideStepInScope,
  nextGuideRoute,
  type GuideStepDefinition,
} from '@hisabche/ui-contract'
import { formatNumber } from '@hisabche/formatting'
import { cn } from '../../../lib/utils'
import { linkOrigin, noSubscription } from '../../../lib/browser-facts'
import { useActionAvailability } from '../../../lib/capability/use-action-availability'
import { useLocalePush } from '../../../hooks/use-locale-push'
import { useModalOpen } from '../../../hooks/use-modal-open'
import { Button } from '../button'
import { placeGuideCard, spotlightHole, type GuideRect } from './guide-placement'
import { useGuideScope } from './use-guide-scope'

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

/** How long a step waits for its tab / switch to appear before it is called «not on this screen». */
const MARKER_WAIT_MS = 2500
const MARKER_POLL_MS = 150
const NO_IDS: readonly string[] = []
const serverOrigin = () => ''

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
  const skippedSteps = useGuideStore((s) => s.skippedSteps)
  const markStepsSkipped = useGuideStore((s) => s.markStepsSkipped)
  const forgetSkipped = useGuideStore((s) => s.forgetSkipped)

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
  // `/fa/warehouse/123` is the product's own page, not the warehouse list.
  const cleanRoute = useMemo(() => guideRouteOf(currentRoute), [currentRoute])
  const { activeModules, isReachable } = useGuideScope()

  // This page's steps for THIS business (its DNA modules), in order…
  const scopedSteps = useMemo(
    () =>
      [...(GUIDE_CATALOG[cleanRoute] ?? [])]
        .filter((step) => guideStepInScope(step, activeModules))
        .sort((a, b) => a.order - b.order),
    [cleanRoute, activeModules],
  )
  // …minus those whose tab or switch this visit found NOT on the person's screen.
  const [missing, setMissing] = useState<{ route: string; ids: readonly string[] }>({
    route: '',
    ids: NO_IDS,
  })
  const missingIds = missing.route === cleanRoute ? missing.ids : NO_IDS
  const routeSteps = useMemo(
    () => scopedSteps.filter((step) => !missingIds.includes(step.id)),
    [scopedSteps, missingIds],
  )

  const replaying = replayRoute === cleanRoute
  const isSeen = useCallback(
    (stepId: string) => Boolean(completedSteps[stepId]?.seen),
    [completedSteps],
  )

  // ⚠️ THE WALK STARTS AT STEP ONE (owner, 10 Nov 2026). It used to open at
  // the first step not yet seen — after the guide gained steps, a reader who
  // had seen two of them was dropped into «۳ / ۵» with no context. A page with
  // anything unseen is now walked from its first step; what this visit walked
  // is kept here, and the server record still decides whether the page is done.
  const [walked, setWalked] = useState<{ route: string; ids: readonly string[] }>({
    route: '',
    ids: [],
  })
  const pageDone = routeSteps.length > 0 && routeSteps.every((step) => isSeen(step.id))
  const walkedIds = walked.route === cleanRoute ? walked.ids : NO_IDS

  const currentStep = useMemo<GuideStepDefinition | null>(() => {
    if (!recordReady || routeSteps.length === 0) return null
    if (replaying) return routeSteps.find((step) => !replaySeen.includes(step.id)) ?? null
    if (pageDone) return null
    return routeSteps.find((step) => !walkedIds.includes(step.id)) ?? null
  }, [recordReady, routeSteps, replaying, replaySeen, pageDone, walkedIds])

  // A replay that ran out ends itself.
  useEffect(() => {
    if (replaying && recordReady && currentStep === null) endReplay()
  }, [replaying, recordReady, currentStep, endReplay])

  /** Set when the reader finishes a page in this visit — the «where next» card. */
  // Shown only while the reader is still on that page (`showFinished` below).
  const [finishedRoute, setFinishedRoute] = useState<string | null>(null)
  // The page the guide itself sent the reader to, and a page whose «where next»
  // card the reader already answered.
  const [arrivedFor, setArrivedFor] = useState<string | null>(null)
  const [dismissedRoute, setDismissedRoute] = useState<string | null>(null)

  const totalSteps = routeSteps.length
  const currentStepIndex = currentStep
    ? routeSteps.findIndex((s) => s.id === currentStep.id) + 1
    : 0
  // A step skipped on this device (its tab is not on this person's screen) does
  // not keep a page «unfinished» for the tour — the page is never offered again
  // just to show nothing.
  const isDoneForTour = useCallback(
    (stepId: string) => isSeen(stepId) || stepId in skippedSteps,
    [isSeen, skippedSteps],
  )
  const nextStop = useMemo(
    () => nextGuideRoute(cleanRoute, isDoneForTour, isReachable, activeModules),
    [cleanRoute, isDoneForTour, isReachable, activeModules],
  )
  // The walk ran out because the rest of the page is not on this screen, or the
  // tour brought the reader to a page with nothing of theirs to show: lead on
  // instead of going silent.
  const ranOut =
    recordReady &&
    !replaying &&
    !currentStep &&
    missingIds.length > 0 &&
    (walkedIds.length > 0 || (arrivedFor === cleanRoute && routeSteps.length === 0))
  const showFinished =
    (finishedRoute === cleanRoute || (ranOut && dismissedRoute !== cleanRoute)) && !currentStep
  // A dialog is open: the guide steps aside — not drawn AND not locking scroll or keys — and
  // resumes at the same step when it closes (use-modal-open.ts).
  const modalOpen = useModalOpen()
  const active = (Boolean(currentStep) || showFinished) && !modalOpen

  // ─── The step's tab and switch ─────────────────────────────────────────
  // Opened through the ADDRESS (`?tab=` / `?view=`), the same way a click on
  // the tab does — never by touching the tab bar. A step whose marker never
  // appears is not on this person's screen: it is skipped, not taught.
  // ⚠️ No `useSearchParams` here: this card is mounted by the LAYOUT, where it
  // would need a Suspense boundary for `next build`. The step's own tab and view
  // are the whole address it needs — another section's parameters go, exactly
  // as they do when the person clicks a tab.
  const router = useRouter()
  const pathname = usePathname()

  const [syncedStep, setSyncedStep] = useState<string | null>(null)
  const needsSync = Boolean(currentStep && (currentStep.tab || currentStep.view))
  const stepReady = Boolean(currentStep) && (!needsSync || syncedStep === currentStep?.id)

  useEffect(() => {
    if (!currentStep || !(currentStep.tab || currentStep.view)) return
    const step = currentStep
    const route = cleanRoute
    let cancelled = false
    let asked = false
    const started = Date.now()
    const marker = (attribute: string, value: string) =>
      document.querySelector<HTMLElement>(`[${attribute}="${value}"]`)

    const notHere = () => {
      setMissing((prev) => ({
        route,
        ids: [...(prev.route === route ? prev.ids : []), step.id],
      }))
      markStepsSkipped([{ stepId: step.id, routeId: route }])
    }
    const open = () => {
      const params = new URLSearchParams()
      if (step.tab) params.set('tab', step.tab)
      if (step.view) params.set('view', step.view)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
    const tick = () => {
      if (cancelled) return
      const waited = Date.now() - started
      const tab = step.tab ? marker(GUIDE_TAB_ATTRIBUTE, step.tab) : null
      const tabOpen = !step.tab || Boolean(tab?.hasAttribute(GUIDE_ACTIVE_ATTRIBUTE))
      const view = step.view ? marker(GUIDE_VIEW_ATTRIBUTE, step.view) : null
      const viewOpen = !step.view || Boolean(view?.hasAttribute(GUIDE_ACTIVE_ATTRIBUTE))

      if (tabOpen && viewOpen) {
        forgetSkipped([step.id])
        setSyncedStep(step.id)
        return
      }
      // The tab bar is drawn but this tab is not in it — or, after the tab was
      // asked for, its switch never offered this section.
      const absent = (step.tab && !tab) || (tabOpen && step.view && !view)
      if (absent && waited >= MARKER_WAIT_MS) {
        notHere()
        return
      }
      if (!absent && !asked) {
        asked = true
        open()
      }
      if (waited >= MARKER_WAIT_MS * 2) {
        notHere()
        return
      }
      timer = setTimeout(tick, MARKER_POLL_MS)
    }
    let timer = setTimeout(tick, 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [currentStep, cleanRoute, router, pathname, markStepsSkipped, forgetSkipped])

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
    // A step whose tab is still opening is measured once it is open.
    if (!currentStep || !stepReady) return
    const findTarget = () =>
      document.querySelector<HTMLElement>(
        `[${GUIDE_SECTION_ATTRIBUTE}="${currentStep.sectionId}"]`,
      ) ??
      document.querySelector<HTMLElement>(
        `[${GUIDE_SECTION_ATTRIBUTE}="${guidePageAnchor(cleanRoute)}"]`,
      ) ??
      // The page's own content area — never the corner of the screen.
      document.querySelector<HTMLElement>('main')

    let last = ''
    let broughtIntoView: HTMLElement | null = null
    const bringIntoView = (target: HTMLElement) => {
      if (broughtIntoView === target) return
      broughtIntoView = target
      const rect = target.getBoundingClientRect()
      const offscreen = rect.top < 72 || rect.bottom > window.innerHeight - 12
      if (!offscreen || typeof target.scrollIntoView !== 'function') return
      const reduceMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      target.scrollIntoView({
        block: rect.height > window.innerHeight * 0.6 ? 'start' : 'center',
        behavior: reduceMotion ? 'auto' : 'smooth',
      })
    }
    const measure = () => {
      const target = findTarget()
      if (target) bringIntoView(target)
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
    // section into view itself — in `measure`, which runs again whenever the
    // page grows, so a section that renders late is still scrolled to.
    const target = findTarget()
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
  }, [currentStep, stepReady, cleanRoute])

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
    setWalked((prev) => ({
      route: cleanRoute,
      ids: [...(prev.route === cleanRoute ? prev.ids : []), currentStep.id],
    }))
    if (isLast) {
      // The page is done: every step is recorded, including ones seen on an
      // earlier visit and walked again now.
      record(routeSteps.map((step) => ({ stepId: step.id, routeId: cleanRoute })))
      setFinishedRoute(cleanRoute)
    } else if (!isSeen(currentStep.id)) {
      record([{ stepId: currentStep.id, routeId: cleanRoute }])
    }
  }, [currentStep, routeSteps, replaying, advanceReplay, record, cleanRoute, isSeen])

  const handleClose = useCallback(() => {
    setFinishedRoute(null)
    setDismissedRoute(cleanRoute)
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
    setDismissedRoute(cleanRoute)
    if (!nextStop) return
    setArrivedFor(nextStop.routeId)
    push(nextStop.path)
  }, [nextStop, push, cleanRoute])

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
      // The arrow that points FORWARD in the reading direction moves on.
      const forward = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
      if (event.key === forward && insideCard(event.target) && currentStep) {
        event.preventDefault()
        handleNext()
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
  }, [active, handleClose, handleNext, direction, currentStep])

  // Focus goes back where it was when the guide lets go of the page.
  useEffect(() => {
    if (!active) return
    const before = document.activeElement
    return () => {
      if (before instanceof HTMLElement && document.body.contains(before)) {
        before.focus({ preventScroll: true })
      }
    }
  }, [active])

  // The primary action takes focus on every step, so Enter moves on.
  const primaryRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (active) primaryRef.current?.focus({ preventScroll: true })
  }, [active, currentStep, showFinished])

  // The public article is on the website; a packaged desktop app has none.
  const docsOrigin = useSyncExternalStore(noSubscription, linkOrigin, serverOrigin)
  const docs = currentStep?.docs
  const docsHref = docs
    ? `${docsOrigin}/${locale}/docs/${docs.slug}${docs.section ? `#${docs.section}` : ''}`
    : null

  // ─── Nothing open: the way back in ─────────────────────────────────────
  if (!active) {
    if (!recordReady || !pageDone || replaying) return null
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
  if (modalOpen) return null

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
        // Not drawn until it has a place — and, for a step in a tab, until that tab is open:
        // the card must not name a section the screen is not showing yet.
        (!placement || (currentStep && !stepReady)) && 'invisible',
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
            {docsHref ? (
              <a
                href={docsHref}
                // A new tab: the reader is mid-task and keeps their place.
                target="_blank"
                rel="noopener noreferrer"
                data-guide-docs={docs?.slug}
                className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--color-primary))] hover:underline"
              >
                <BookOpen className="size-3.5" aria-hidden="true" />
                {t('guide.readMore')}
              </a>
            ) : null}
          </div>
          {/* Announced on every step change; the dialog's name alone does not change. */}
          <p className="sr-only" aria-live="polite">
            {formatNumber(currentStepIndex, locale)} / {formatNumber(totalSteps, locale)} —{' '}
            {t(currentStep.titleKey)}
          </p>

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
              {routeSteps.length === 0
                ? t('guide.nothingHereTitle')
                : nextStop
                  ? t('guide.pageDoneTitle')
                  : t('guide.allDoneTitle')}
            </h4>
            <p
              aria-live="polite"
              className="text-xs leading-relaxed text-[hsl(var(--fg-secondary))]"
            >
              {routeSteps.length === 0
                ? t('guide.nothingHereBody')
                : nextStop
                  ? t('guide.pageDoneBody')
                  : t('guide.allDoneBody')}
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
