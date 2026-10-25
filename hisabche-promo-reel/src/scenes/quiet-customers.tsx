// ============================================
// L3.05 — «کدام فروش راکد ماند؟»: the owner's evening, told on a lamp-lit desk.
// Design language: a warm lamp, a list drawn on paper, amber turning to grey — no UI, no neon.
// The list is a drawing of a list (no names, no figures). The one real thing is the recording of the
// product's own tab «پیگیری و کمپین» with its sections «پیگیری فروش» and «فرصت‌های راکد»
// (customersHub.*). No claim is made about what a follow-up recovers.
// Blueprint: docs/scenarios/L3.05-which-sale-went-quiet.md
// ============================================

import type { ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, mix, progress, spring } from '../engine/anim'

export const LAMP_DARK = '#1c130b'
export const LAMP_INK = '#f6e7c8'
const AMBER = '#f2a93b'
const GREY = '#6d6556'
const PAPER = '#f3e9d2'

type SceneProps = { t: number; scene: Scene }

/** The customers tab the recording shows (declared by the capture scene in the reel). */
export const OUTREACH_CAPTURE = {
  file: 'customers-outreach.mp4',
  route: '/customers?tab=outreach',
} as const

const pop = (t: number, at: number, dur = 0.5): number =>
  spring(clamp(progress(t, at, at + dur), 0, 1) * 1.15)

function Room({ children }: { children: ReactNode }) {
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        inset: 0,
        zoom: 0.5,
        background: `radial-gradient(ellipse at 50% 30%, #4a2f14 0%, ${LAMP_DARK} 62%, #0c0805 100%)`,
        color: LAMP_INK,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

function Words({
  children,
  size,
  color = LAMP_INK,
  top,
}: {
  children: ReactNode
  size: number
  color?: string
  top: number
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 90,
        right: 90,
        fontSize: size,
        fontWeight: 800,
        lineHeight: 1.5,
        color,
        textShadow: `0 0 24px ${AMBER}33`,
        textAlign: 'center',
        textWrap: 'balance',
      }}
    >
      {children}
    </div>
  )
}

/** The list on paper: six rows, each lit amber until it goes quiet. `quiet` is how many have gone grey (0–6, fractional). */
function List({ quiet }: { quiet: number }) {
  const rows = [0, 1, 2, 3, 4, 5]
  return (
    <svg
      viewBox="0 0 600 640"
      style={{ position: 'absolute', left: 150, top: 620, width: 780, height: 832 }}
      role="img"
      aria-label="یک فهرست"
    >
      <rect
        x="10"
        y="10"
        width="580"
        height="620"
        rx="22"
        fill={PAPER}
        stroke="#8a7449"
        strokeWidth="5"
      />
      {rows.map((i) => {
        const y = 80 + i * 92
        const gone = clamp(quiet - i, 0, 1)
        const tone = gone > 0.5 ? GREY : AMBER
        return (
          <g key={i} opacity={mix(1, 0.55, gone)}>
            <circle cx="520" cy={y} r="20" fill={tone} />
            <rect
              x="150"
              y={y - 14}
              width={mix(300, 210, ((i * 37) % 3) / 3)}
              height="28"
              rx="14"
              fill="#a89572"
            />
            <rect x="70" y={y - 8} width="56" height="16" rx="8" fill={tone} opacity="0.8" />
          </g>
        )
      })}
    </svg>
  )
}

/** 1 — the list on the desk. Frame 0 is the list, every row lit. */
export function ListScene({ t }: SceneProps) {
  const ask = ease(clamp(progress(t, 0.7, 1.3), 0, 1))
  return (
    <Room>
      <List quiet={0} />
      <Words size={104} top={300}>
        <span style={{ opacity: ask, display: 'inline-block' }}>کدام فروش راکد ماند؟</span>
      </Words>
    </Room>
  )
}

/** The loop's last frame: the list exactly as the reel opened. */
function ListStill() {
  return (
    <Room>
      <List quiet={0} />
    </Room>
  )
}

/** 2 — months pass: the rows go quiet one by one. */
export function QuietScene({ t }: SceneProps) {
  const quiet = clamp(progress(t, 0.6, 4.6), 0, 1) * 6
  const text = ease(clamp(progress(t, 0.3, 0.8), 0, 1))
  return (
    <Room>
      <List quiet={quiet} />
      <Words size={104} top={300}>
        <span style={{ opacity: text, display: 'inline-block' }}>ماه‌ها گذشت</span>
      </Words>
    </Room>
  )
}

/** 3 — the question. */
export function AskScene({ t }: SceneProps) {
  const ask = pop(t, 0.3, 0.7)
  return (
    <Room>
      <List quiet={6} />
      <Words size={116} color={AMBER} top={300}>
        <span
          style={{
            opacity: clamp(ask * 1.4, 0, 1),
            display: 'inline-block',
            transform: `scale(${0.85 + 0.15 * ask})`,
          }}
        >
          کسی پیگیری کرد؟
        </span>
      </Words>
    </Room>
  )
}

/** 5 — the three names the product gives it, in the order you find them. */
export function ProductWordsScene({ t }: SceneProps) {
  const words = ['پیگیری و کمپین', 'پیگیری فروش', 'فرصت‌های راکد']
  return (
    <Room>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 80,
        }}
      >
        {words.map((word, i) => {
          const shown = pop(t, 0.3 + i * 1.1, 0.6)
          return (
            <div
              key={word}
              style={{
                fontSize: 108,
                fontWeight: 900,
                color: i === 2 ? AMBER : LAMP_INK,
                opacity: clamp(shown * 1.5, 0, 1),
                transform: `translateY(${(1 - clamp(shown, 0, 1)) * 60}px)`,
                textShadow: `0 0 24px ${AMBER}33`,
              }}
            >
              {word}
            </div>
          )
        })}
      </div>
    </Room>
  )
}

/** 6 — the ask; the last half second is the list again. */
export function LinkScene({ t, scene }: SceneProps) {
  const dur = scene.end - scene.start
  const back = ease(clamp(progress(t, dur - 0.6, dur - 0.15), 0, 1))
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Room>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 1 - back,
            fontSize: 124,
            fontWeight: 800,
            textShadow: `0 0 24px ${AMBER}33`,
            transform: `scale(${0.85 + 0.15 * pop(t, 0.1, 0.5)})`,
          }}
        >
          لینک در بیو
        </div>
      </Room>
      <div style={{ position: 'absolute', inset: 0, opacity: back }}>
        <ListStill />
      </div>
    </div>
  )
}
