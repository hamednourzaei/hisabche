// packages/ui/src/components/ui/landing/journey/journey-stage.tsx
'use client'

// The top of the landing: a story the visitor plays by scrolling.
//
// The frame is pinned while the page scrolls underneath it. Beat 0 is the
// headline, over a printer printing an invoice. Each following beat is one
// station that records the invoice, named in a caption at the foot of the
// picture. In the last beat the core bursts — alone on screen — and only once
// it has does the invitation to start appear.
//
// A route runs alongside — every stop named, the ones passed turned green, the
// end always in sight — so the visitor knows how far there is to go and wants
// to get there. On a phone it is a row of stops under the header.
//
// WHERE the story is comes from `journey-machine.ts`, for this file and for the
// 3D scene alike. This file adds nothing to that answer; it shows it.
//
// The headline and the invitation are rendered on the server and passed in:
// they are on the page before any of this script, or Three.js, has loaded.

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { SceneCanvas, spanProgress } from '../three/scene-canvas'
import type { IndustrySign } from './journey-industries'
import { JOURNEY_ANALYTICS_EVENTS, BEAT_HEIGHT_DVH, type JourneyBeatId } from '../journey.config'
import { emitJourneyEvent, getJourneyAnalyticsHistory } from '../journey-analytics'
import {
  journeyAt,
  journeyReduce,
  progressForBeat,
  type JourneyEvent,
  type LinkState,
} from './journey-machine'
import type { ScreenModel } from './journey-screens'
import { journeyState, type InvoiceLabels } from './journey-state'

export interface JourneyStop {
  id: string
  title: string
  desc: string
  /** What the person working this station says to the agent. */
  say: string
  /** This stop's number and the number of stops, already in the reader's digits. */
  place: string
  total: string
}

export interface JourneyStageProps {
  /** What the picture shows, for someone who cannot see it. */
  label: string
  hero: ReactNode
  finale: ReactNode
  stops: JourneyStop[]
  /** What each station's board shows, in station order. */
  screens: ScreenModel[]
  /** The kinds of business named on the boards along the hall's walls. */
  industries: IndustrySign[]
  industriesLabel: string
  /** The name of the last stop on the route. */
  endLabel: string
  /** «ایستگاه {current} از {total}» — the words in the reader's order. */
  counter: string
  /** The heading of the text version of the story. */
  summaryLabel: string
  skipLabel: string
  replayLabel?: string | undefined
  locale?: string | undefined
  forceFlat?: boolean | undefined
  invoice: InvoiceLabels
  /** «ثبت شد» — shown on a board once its station has the invoice. */
  recordedLabel: string
  /** What the shop says about its connection while it is down, and while it catches up. */
  offlineLabel: string
  syncingLabel: string
  /** The name on the great board at the end of the hall. */
  signLabel: string
}

/** How much page one beat of the story takes: enough that a wheel notch is a step, not a jump. */
const BEAT_HEIGHT = BEAT_HEIGHT_DVH

/** The counter's sentence, with each number kept whole whichever way the text runs. */
function Counter({
  template,
  current,
  total,
}: {
  template: string
  current: string
  total: string
}) {
  return (
    <>
      {template
        .split(/(\{current\}|\{total\})/)
        .map((part, index) =>
          part === '{current}' ? (
            <bdi key={index}>{current}</bdi>
          ) : part === '{total}' ? (
            <bdi key={index}>{total}</bdi>
          ) : (
            part
          ),
        )}
    </>
  )
}

export function JourneyStage(props: JourneyStageProps) {
  const { stops } = props
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const heroRef = useRef<HTMLDivElement | null>(null)
  const navRef = useRef<HTMLElement | null>(null)
  const captionRef = useRef<HTMLDivElement | null>(null)
  const bubbleRef = useRef<HTMLParagraphElement | null>(null)
  const fillRef = useRef<HTMLSpanElement | null>(null)
  const columnRef = useRef<HTMLSpanElement | null>(null)
  /** The hairline at the foot of the frame: how far through the story the page is. */
  const frameFillRef = useRef<HTMLSpanElement | null>(null)
  const [beat, setBeat] = useState(0)
  const [invited, setInvited] = useState(false)
  const [link, setLink] = useState<LinkState>('online')
  /** No 3D picture on this device: the frame shows the station's board as markup. */
  const [flat, setFlat] = useState(props.forceFlat ?? false)
  /** How many characters of the clerk's line the bubble has typed so far. */
  const [typed, setTyped] = useState(0)
  const beats = stops.length + 2
  const ending = beat === beats - 1

  const lastReportedBeatRef = useRef<number>(-1)
  const lastLinkRef = useRef<LinkState>('online')
  const invitedFiredRef = useRef<boolean>(false)

  useEffect(() => {
    journeyState.stations = stops.length
    journeyState.invoice = props.invoice
    journeyState.recorded = props.recordedLabel
    journeyState.sign = props.signLabel
    journeyState.screens = props.screens
    journeyState.industries = props.industries
    journeyState.bubble = bubbleRef.current

    // Emit initial view_hero analytics event
    emitJourneyEvent(JOURNEY_ANALYTICS_EVENTS.VIEW_HERO, { locale: props.locale ?? 'fa' })

    const onScroll = () => {
      const progress = spanProgress(wrapRef.current)
      // The line reaches the stop the invoice is at, and the end when the story ends.
      const reach = `calc((100% - 1rem) * ${progress})`
      if (fillRef.current) fillRef.current.style.width = reach
      if (frameFillRef.current) frameFillRef.current.style.width = `${progress * 100}%`
      if (columnRef.current) columnRef.current.style.height = reach
      const now = journeyAt(progress, stops.length)

      if (lastReportedBeatRef.current !== now.beat) {
        lastReportedBeatRef.current = now.beat
        if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
          window.history.replaceState(null, '', `#beat-${now.beat}`)
        }
        emitJourneyEvent(JOURNEY_ANALYTICS_EVENTS.BEAT_REACHED, {
          beat: now.beat,
          beatId: `beat-${now.beat}` as JourneyBeatId,
          progress,
        })
      }

      if (lastLinkRef.current !== now.link) {
        lastLinkRef.current = now.link
        if (now.link === 'offline') {
          emitJourneyEvent(JOURNEY_ANALYTICS_EVENTS.OFFLINE_SIM_VIEWED, { state: now.link })
        }
      }

      if (now.invited && !invitedFiredRef.current) {
        invitedFiredRef.current = true
        emitJourneyEvent(JOURNEY_ANALYTICS_EVENTS.CORE_BURST_COMPLETED, {})
      }

      setBeat(now.beat)
      setInvited(now.invited)
      setLink(now.link)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      journeyState.bubble = null
    }
  }, [
    stops.length,
    props.invoice,
    props.recordedLabel,
    props.signLabel,
    props.screens,
    props.industries,
    props.locale,
  ])

  const goTo = (progress: number) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const span = wrap.offsetHeight - window.innerHeight
    const top = wrap.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: top + progress * span, behavior: 'smooth' })
  }
  const send = (event: JourneyEvent) =>
    goTo(journeyReduce(spanProgress(wrapRef.current), event, stops.length))
  const travel = (index: number) => goTo(progressForBeat(index, stops.length))
  const leave = () => {
    emitJourneyEvent(JOURNEY_ANALYTICS_EVENTS.SKIP_CLICKED, { fromBeat: beat })
    const wrap = wrapRef.current
    if (wrap)
      window.scrollTo({
        top: wrap.getBoundingClientRect().bottom + window.scrollY,
        behavior: 'smooth',
      })
  }
  // On the route, the arrow keys step through the story like the wheel does.
  const onRouteKey = (event: KeyboardEvent) => {
    const step: Record<string, JourneyEvent> = {
      ArrowDown: { type: 'next' },
      PageDown: { type: 'next' },
      ArrowUp: { type: 'previous' },
      PageUp: { type: 'previous' },
      Home: { type: 'reset' },
      End: { type: 'skip' },
    }
    const wanted = step[event.key]
    if (!wanted) return
    event.preventDefault()
    send(wanted)
  }

  // Deep-link to #beat-N on mount
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    let timer: number | undefined
    const hash = window.location.hash
    const match = hash.match(/#beat-(\d+)/)
    if (match && match[1]) {
      const targetBeat = parseInt(match[1], 10)
      if (!Number.isNaN(targetBeat) && targetBeat >= 0 && targetBeat < beats) {
        timer = window.setTimeout(() => travel(targetBeat), 120)
      }
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [beats])

  // Expose window.__journey debug hook per v2 spec Section 10
  useEffect(() => {
    if (typeof window === 'undefined') return
    ;(window as unknown as { __journey?: unknown }).__journey = {
      getProgress: () => spanProgress(wrapRef.current),
      setProgress: (p: number) => goTo(p),
      getBeat: () => beat,
      setBeat: (b: number) => travel(b),
      getSnapshot: () => journeyAt(spanProgress(wrapRef.current), stops.length),
      getAnalyticsHistory: () => getJourneyAnalyticsHistory(),
    }
    return () => {
      delete (window as unknown as { __journey?: unknown }).__journey
    }
  }, [beat, stops.length])

  // Tell the scene which band of the frame no text covers, so its camera
  // composes the subject there instead of behind the headline or the caption.
  useEffect(() => {
    const measure = () => {
      const frame = frameRef.current?.getBoundingClientRect()
      if (!frame || frame.height === 0) return
      const at = (y: number) => (y - frame.top) / frame.height
      let top = 0
      let bottom = 1
      if (beat === 0) {
        if (heroRef.current) top = at(heroRef.current.getBoundingClientRect().bottom)
      } else if (!ending) {
        // The route is a row under the header on a phone, a column at the side otherwise.
        const row = !window.matchMedia('(min-width: 768px)').matches
        top = row && navRef.current ? at(navRef.current.getBoundingClientRect().bottom) : at(64)
        if (captionRef.current) bottom = at(captionRef.current.getBoundingClientRect().top)
      }
      const from = Math.min(0.62, Math.max(0, top))
      journeyState.free.top = from
      journeyState.free.bottom = Math.min(1, Math.max(from + 0.25, bottom))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [beat, ending])

  const speaking = beat >= 1 && !ending ? (stops[beat - 1]?.say ?? '') : ''
  // The bubble types its line out, a few characters at a time — and shows it
  // whole at once for a reader who has asked for less motion.
  useEffect(() => {
    const whole = speaking.length
    if (whole === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const settle = window.setTimeout(() => setTyped(whole), 0)
      return () => window.clearTimeout(settle)
    }
    let shown = 0
    const timer = window.setInterval(() => {
      shown = Math.min(whole, shown + 2)
      setTyped(shown)
      if (shown >= whole) window.clearInterval(timer)
    }, 70)
    return () => window.clearInterval(timer)
  }, [speaking])

  // Route stops: the stations, then the end. Stop `n` is reached in beat `n + 1`.
  const route = [...stops.map((stop) => stop.title), props.endLabel]
  const dot = (index: number) =>
    beat > index + 1 || (index === route.length - 1 && ending)
      ? 'bg-[hsl(var(--color-success))]'
      : beat === index + 1
        ? 'bg-[hsl(var(--color-primary))] ring-4 ring-[hsl(var(--color-primary)/0.25)]'
        : 'bg-[hsl(var(--border-strong))]'
  const board = beat >= 1 && !ending ? props.screens[beat - 1] : undefined

  return (
    <div ref={wrapRef} style={{ height: `${beats * BEAT_HEIGHT}dvh` }} className="relative">
      <div
        ref={frameRef}
        className="sticky top-0 h-dvh overflow-hidden bg-[hsl(var(--surface-base))]"
      >
        {!props.forceFlat && (
          <SceneCanvas
            label={props.label}
            load={() => import('./scene')}
            progress={() => spanProgress(wrapRef.current)}
            onUnavailable={() => {
              frameRef.current?.removeAttribute('data-scene')
              setFlat(true)
            }}
            className="absolute inset-0 size-full"
          />
        )}

        <div
          className={
            beat === 0
              ? 'absolute inset-x-0 top-0 bg-gradient-to-b from-[hsl(var(--surface-base))] via-[hsl(var(--surface-base)/0.94)] to-transparent px-4 pb-24 pt-20 sm:px-6 sm:pt-24 lg:px-10'
              : 'hidden'
          }
        >
          <div ref={heroRef}>{props.hero}</div>
        </div>

        {/* No 3D picture: the station's board, as it would hang in the hall, in markup. */}
        {flat && board ? (
          <div className="absolute inset-x-0 top-28 flex justify-center px-4 md:top-24">
            <dl className="w-full max-w-md rounded-lg border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))] p-5">
              <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-[hsl(var(--color-primary)/0.5)] pb-2">
                <dt className="text-lg font-bold text-[hsl(var(--fg-primary))]">{board.title}</dt>
                <dd className="text-xs text-[hsl(var(--fg-tertiary))]">{board.note}</dd>
              </div>
              {board.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-3 border-b border-[hsl(var(--border-default)/0.6)] py-1.5 last:border-0"
                >
                  <dt className="text-sm text-[hsl(var(--fg-secondary))]">{row.label}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-[hsl(var(--fg-primary))]">
                    <bdi>{row.value}</bdi> <bdi>{row.extra}</bdi>
                  </dd>
                </div>
              ))}
              <div className="mt-3 text-xs font-semibold text-[hsl(var(--color-success))]">
                {board.foot}
              </div>
            </dl>
          </div>
        ) : null}

        {/* The connection: said in words too, not only by the hall going amber. */}
        <p
          role="status"
          className={
            link === 'online'
              ? 'hidden'
              : 'absolute inset-x-0 top-28 mx-auto w-fit rounded-md border border-[hsl(var(--color-warning)/0.5)] bg-[hsl(var(--surface-elevated)/0.95)] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--color-warning))] md:top-20'
          }
        >
          {link === 'offline' ? props.offlineLabel : props.syncingLabel}
        </p>

        {/* The route. A row under the header on a phone, a column at the side from a tablet up. */}
        <nav
          ref={navRef}
          aria-label={props.label}
          className={
            beat === 0
              ? 'hidden'
              : 'absolute inset-x-0 top-16 px-4 md:inset-x-auto md:inset-y-0 md:end-4 md:top-0 md:flex md:items-center md:px-0'
          }
        >
          <div className="relative mx-auto max-w-sm md:mx-0">
            <span
              aria-hidden="true"
              className="absolute inset-x-2 top-1.5 h-0.5 bg-[hsl(var(--border-default))] md:inset-x-auto md:inset-y-2 md:end-1.5 md:h-auto md:w-0.5"
            />
            <span
              ref={fillRef}
              aria-hidden="true"
              className="absolute start-2 top-1.5 h-0.5 bg-[hsl(var(--color-success))] md:hidden"
            />
            <span
              ref={columnRef}
              aria-hidden="true"
              className="absolute end-1.5 top-2 hidden w-0.5 bg-[hsl(var(--color-success))] md:block"
            />
            <ol
              className="relative flex justify-between md:flex-col md:gap-7"
              onKeyDown={onRouteKey}
            >
              {route.map((name, index) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => travel(index + 1)}
                    aria-current={beat === index + 1 ? 'step' : undefined}
                    className="group flex min-h-11 min-w-11 flex-col items-center gap-1 md:min-h-0 md:min-w-0 md:flex-row-reverse md:gap-3"
                  >
                    <span
                      className={`block size-3.5 rounded-full transition-colors ${dot(index)} ${index === route.length - 1 ? 'md:size-5' : ''}`}
                    />
                    <span
                      className={
                        beat === index + 1
                          ? 'whitespace-nowrap text-xs font-bold text-[hsl(var(--fg-primary))] [text-shadow:0_1px_3px_hsl(var(--surface-base))]'
                          : 'sr-only md:not-sr-only md:text-xs md:text-[hsl(var(--fg-secondary))] md:[text-shadow:0_1px_3px_hsl(var(--surface-base))]'
                      }
                    >
                      {name}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        {stops.map((stop, index) => (
          <section
            key={stop.id}
            className={
              beat === index + 1
                ? 'absolute inset-x-0 bottom-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-24 sm:px-6 lg:px-10'
                : 'hidden'
            }
          >
            <div
              ref={beat === index + 1 ? captionRef : undefined}
              className="w-full max-w-xl rounded-lg border border-[hsl(var(--border-default)/0.8)] bg-[hsl(var(--surface-base)/0.88)] p-4 text-start backdrop-blur-md sm:p-5"
            >
              {/* A ledger heading: the station's place in the story, then a rule
                  to the edge of the card. */}
              <div className="flex items-center gap-3 border-b border-[hsl(var(--border-default))] pb-2">
                <p className="shrink-0 text-xs font-semibold tabular-nums text-[hsl(var(--color-primary))]">
                  <Counter template={props.counter} current={stop.place} total={stop.total} />
                </p>
                <span aria-hidden="true" className="h-px flex-1 bg-[hsl(var(--border-default))]" />
              </div>

              <h2 className="mt-3 text-balance text-xl font-black tracking-tight text-[hsl(var(--fg-primary))] sm:text-2xl">
                {stop.title}
              </h2>
              <p className="mt-1 max-w-md text-pretty text-base leading-7 text-[hsl(var(--fg-secondary))]">
                {stop.desc}
              </p>
              {/* On mobile: display clerk line in card to avoid overlap. On desktop: shown when 3D scene is unavailable */}
              <p className="mt-3 max-w-md border-s-2 border-[hsl(var(--color-primary)/0.6)] ps-3 text-pretty text-sm leading-6 text-[hsl(var(--fg-primary))] [[data-scene=on]_&]:block sm:[[data-scene=on]_&]:hidden">
                {stop.say}
              </p>
            </div>
          </section>
        ))}

        {/* The one speech bubble: visible only from sm: up on desktop to prevent mobile occlusions */}
        <p
          ref={bubbleRef}
          aria-hidden="true"
          style={{ left: 0, top: 0, opacity: 0 }}
          className="pointer-events-none absolute hidden sm:block w-max max-w-[min(20rem,84vw)] rounded-lg border border-[hsl(var(--color-primary)/0.45)] bg-[hsl(var(--surface-elevated))] px-3.5 py-2 text-start text-sm leading-6 text-[hsl(var(--fg-primary))] shadow-lg transition-opacity duration-300"
        >
          <span>{speaking.slice(0, typed)}</span>
          <span className="invisible">{speaking.slice(typed)}</span>
        </p>
        <p className="sr-only" aria-live="polite">
          {speaking}
        </p>

        {/* The invitation waits for the core: it is not on screen until the burst is over. */}
        <div
          className={
            ending && invited
              ? 'absolute inset-0 flex flex-col items-center justify-center px-4 text-center'
              : 'hidden'
          }
        >
          {props.finale}
          <div className="mt-5 flex items-center justify-center">
            <button
              type="button"
              onClick={() => travel(0)}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-elevated))] px-6 text-sm font-semibold text-[hsl(var(--fg-primary))] shadow-sm transition-colors hover:border-[hsl(var(--color-primary))] hover:text-[hsl(var(--color-primary))]"
            >
              {props.replayLabel ?? 'Replay'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={leave}
          className={
            ending
              ? 'hidden'
              : 'absolute start-4 top-20 min-h-11 px-1 text-xs text-[hsl(var(--fg-tertiary))] underline-offset-4 hover:text-[hsl(var(--fg-primary))] hover:underline md:inset-x-auto md:bottom-4 md:end-4 md:top-auto md:start-auto'
          }
        >
          {props.skipLabel}
        </button>

        {/* The story's own progress, independent of the route: one hairline at
            the foot of the frame that fills from the reading edge. */}
        <span
          aria-hidden="true"
          ref={frameFillRef}
          className="absolute bottom-0 start-0 h-0.5 w-0 bg-[hsl(var(--color-primary))]"
        />
      </div>

      {/* The same story as text, for a reader who has no picture. */}
      <section className="sr-only">
        <h2>{props.summaryLabel}</h2>
        <ol>
          {stops.map((stop, index) => (
            <li key={stop.id}>
              <h3>{stop.title}</h3>
              <p>{stop.desc}</p>
              <p>{stop.say}</p>
              <ul>
                {(props.screens[index]?.rows ?? []).map((row) => (
                  <li key={row.label}>
                    {row.label} <bdi>{row.value}</bdi> <bdi>{row.extra}</bdi>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        {/* What the boards along the walls say. */}
        <h2>{props.industriesLabel}</h2>
        <ul>
          {props.industries.map((industry) => (
            <li key={industry.label}>{industry.label}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
