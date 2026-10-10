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
import { journeyAt, journeyReduce, progressForBeat, type JourneyEvent } from './journey-machine'
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
  invoice: InvoiceLabels
  /** «ثبت شد» — shown on a board once its station has the invoice. */
  recordedLabel: string
}

/** How much page one beat of the story takes: enough that a wheel notch is a step, not a jump. */
const BEAT_HEIGHT = 150

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
  const [beat, setBeat] = useState(0)
  const [invited, setInvited] = useState(false)
  const beats = stops.length + 2
  const ending = beat === beats - 1

  useEffect(() => {
    journeyState.stations = stops.length
    journeyState.invoice = props.invoice
    journeyState.recorded = props.recordedLabel
    journeyState.screens = props.screens
    journeyState.industries = props.industries
    journeyState.bubble = bubbleRef.current
    const onScroll = () => {
      const progress = spanProgress(wrapRef.current)
      // The line reaches the stop the invoice is at, and the end when the story ends.
      const reach = `calc((100% - 1rem) * ${progress})`
      if (fillRef.current) fillRef.current.style.width = reach
      if (columnRef.current) columnRef.current.style.height = reach
      const now = journeyAt(progress, stops.length)
      setBeat(now.beat)
      setInvited(now.invited)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      journeyState.bubble = null
    }
  }, [stops.length, props.invoice, props.recordedLabel, props.screens, props.industries])

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

  // Route stops: the stations, then the end. Stop `n` is reached in beat `n + 1`.
  const route = [...stops.map((stop) => stop.title), props.endLabel]
  const dot = (index: number) =>
    beat > index + 1 || (index === route.length - 1 && ending)
      ? 'bg-[hsl(var(--color-success))]'
      : beat === index + 1
        ? 'bg-[hsl(var(--color-primary))] ring-4 ring-[hsl(var(--color-primary)/0.25)]'
        : 'bg-[hsl(var(--border-strong))]'
  const speaking = beat >= 1 && !ending ? (stops[beat - 1]?.say ?? '') : ''

  return (
    <div ref={wrapRef} style={{ height: `${beats * BEAT_HEIGHT}dvh` }} className="relative">
      <div
        ref={frameRef}
        className="sticky top-0 h-dvh overflow-hidden bg-[hsl(var(--surface-base))]"
      >
        <SceneCanvas
          label={props.label}
          load={() => import('./scene')}
          progress={() => spanProgress(wrapRef.current)}
          className="absolute inset-0 size-full"
        />

        <div
          className={
            beat === 0
              ? 'absolute inset-x-0 top-0 bg-gradient-to-b from-[hsl(var(--surface-base))] via-[hsl(var(--surface-base))] to-transparent px-4 pb-32 pt-24 text-center sm:pt-28'
              : 'hidden'
          }
        >
          <div ref={heroRef}>{props.hero}</div>
        </div>

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
                          ? 'whitespace-nowrap text-xs font-bold text-[hsl(var(--fg-primary))]'
                          : 'sr-only md:not-sr-only md:text-xs md:text-[hsl(var(--fg-tertiary))]'
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
                ? 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-[hsl(var(--surface-base))] via-[hsl(var(--surface-base)/0.9)] to-transparent px-5 pb-[max(3.5rem,env(safe-area-inset-bottom))] pt-16 text-center'
                : 'hidden'
            }
          >
            <div ref={beat === index + 1 ? captionRef : undefined}>
              <p className="text-xs font-semibold tracking-wide text-[hsl(var(--color-primary))]">
                <Counter template={props.counter} current={stop.place} total={stop.total} />
              </p>
              <h2 className="mx-auto mt-1 max-w-xl text-xl font-bold text-[hsl(var(--fg-primary))] sm:text-3xl">
                {stop.title}
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[hsl(var(--fg-secondary))] sm:text-base sm:leading-7">
                {stop.desc}
              </p>
              {/* On a phone the clerk's line is part of the caption; from a tablet up it is the bubble over the clerk. */}
              <p className="mx-auto mt-2 max-w-md rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.85)] px-4 py-2 text-sm leading-6 text-[hsl(var(--fg-primary))] md:[[data-scene=on]_&]:hidden">
                {stop.say}
              </p>
            </div>
          </section>
        ))}

        {/* The one speech bubble. The scene moves it to the head of whoever is speaking. */}
        <p
          ref={bubbleRef}
          aria-hidden="true"
          style={{ left: 0, top: 0, opacity: 0 }}
          className="pointer-events-none absolute hidden max-w-xs rounded-2xl border border-[hsl(var(--color-primary)/0.4)] bg-[hsl(var(--surface-elevated))] px-4 py-2 text-center text-sm leading-6 text-[hsl(var(--fg-primary))] shadow-lg transition-opacity duration-300 md:block"
        >
          {speaking}
        </p>
        <p className="sr-only" aria-live="polite">
          {speaking}
        </p>

        {/* The invitation waits for the core: it is not on screen until the burst is over. */}
        <div
          className={
            ending && invited
              ? 'absolute inset-0 flex items-center justify-center px-4 text-center'
              : 'hidden'
          }
        >
          {props.finale}
        </div>

        <button
          type="button"
          onClick={leave}
          className={
            ending
              ? 'hidden'
              : 'absolute bottom-2 start-3 min-h-11 px-2 text-xs text-[hsl(var(--fg-tertiary))] underline-offset-4 hover:underline'
          }
        >
          {props.skipLabel}
        </button>
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
