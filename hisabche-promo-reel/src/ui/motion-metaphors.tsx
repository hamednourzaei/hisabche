// src/ui/motion-metaphors.tsx
// Visual metaphor system — rebuilt from web-widget styling to film marks.
// Every export and the MotionPlan contract are frozen; colors come from the
// single art-direction source, emoji are replaced by drawn glyphs, and all
// motion is a pure function of (t) using transform/opacity only.
// Rules: 22, 33, 76, 81-90, 98.

import type { CSSProperties, ReactNode } from 'react'

import { clamp, ease, mix, progress, pulse } from '../engine/anim'
import type { MotionMetaphorName, MotionPlan } from '../engine/motion-plan'
import { ACCENT, MATERIAL, faNumber } from './art-direction'

export interface MetaphorProps {
  t: number
  at?: number
  dur?: number
  size?: number
}

// ── Rising chart: stroked bars, no gradient pill ─────────────────────────
export function RisingChart({ t, at = 0, dur = 1.2, size = 120 }: MetaphorProps) {
  const bars = [0.3, 0.5, 0.7, 0.85, 1.0]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 4,
        height: size,
        width: size * 1.4,
        borderBottom: `1px solid ${MATERIAL.panelEdge}`,
      }}
    >
      {bars.map((h, i) => {
        const bp = ease(progress(t, at + i * 0.06, dur * 0.6))
        return (
          <div
            key={i}
            style={{
              width: size * 0.2,
              height: Math.max(2, h * size * bp),
              background: ACCENT.cyan.solid,
              opacity: 0.55 + 0.45 * bp,
              transform: 'none',
            }}
          />
        )
      })}
    </div>
  )
}

// ── Question: drawn mark, never a sticker ────────────────────────────────
export function ShakingQuestion({ t, at = 0, dur = 1.0, size = 80 }: MetaphorProps) {
  const elapsed = Math.max(0, t - at)
  const shake = elapsed < dur ? Math.sin(elapsed * 25) * 5 * (1 - elapsed / dur) : 0
  const scale = 1 + pulse(t, at, at + dur, 0.4) * 0.1
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      aria-hidden
      style={{
        transform: `translate3d(${shake}px,0,0) scale(${scale})`,
        opacity: clamp(progress(t, at, 0.2)),
      }}
    >
      <path
        d="M22 26 C22 16 58 16 58 28 C58 38 44 40 40 50"
        fill="none"
        stroke={ACCENT.amber.solid}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <circle cx={40} cy={62} r={5} fill={ACCENT.amber.solid} />
    </svg>
  )
}

// ── Calendar flip: stepped cadence ───────────────────────────────────────
export function FlippingCalendar({ t, at = 0, dur = 1.5, size = 80 }: MetaphorProps) {
  const pages = 3
  return (
    <div style={{ position: 'relative', width: size, height: size * 1.2 }}>
      {Array.from({ length: pages }).map((_, i) => {
        const pageAt = at + i * (dur / pages)
        const p = ease(progress(t, pageAt, dur / pages))
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              background: MATERIAL.panel,
              border: `1px solid ${MATERIAL.panelEdge}`,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: size * 0.4,
              color: ACCENT.cyan.solid,
              fontWeight: 800,
              transform: `rotateX(${p * 180}deg)`,
              transformOrigin: 'top center',
              opacity: 1 - p * 0.7,
              backfaceVisibility: 'hidden',
            }}
          >
            {faNumber(i + 1)}
          </div>
        )
      })}
    </div>
  )
}

// ── Warning: drawn triangle, no emoji ────────────────────────────────────
export function WarningImpact({ t, at = 0, dur = 0.8, size = 80 }: MetaphorProps) {
  const elapsed = Math.max(0, t - at)
  const scale =
    elapsed < dur
      ? mix(0, 1.25, ease(progress(t, at, dur * 0.5))) * (1 - 0.1 * Math.sin(elapsed * 18))
      : 1
  const beat = pulse(t, at + dur, at + dur + 1.5, 0.6)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      aria-hidden
      style={{ transform: `scale(${scale})`, opacity: clamp(progress(t, at, 0.15)) }}
    >
      <path
        d="M40 10 L74 68 L6 68 Z"
        fill="none"
        stroke={ACCENT.amber.solid}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M40 30 L40 50" stroke={ACCENT.amber.solid} strokeWidth={6} strokeLinecap="round" />
      <circle cx={40} cy={59} r={3.5} fill={ACCENT.amber.solid} />
      <circle
        cx={40}
        cy={40}
        r={34}
        fill="none"
        stroke={ACCENT.amber.solid}
        strokeWidth={1.5}
        opacity={beat * 0.5}
      />
    </svg>
  )
}

// ── Opposing plates ──────────────────────────────────────────────────────
export function OpposingCards({ t, at = 0, dur = 1.2, size = 100 }: MetaphorProps) {
  const p = ease(progress(t, at, dur))
  const x = mix(size * 1.4, size * 0.3, p)
  return (
    <div
      style={{
        position: 'relative',
        width: size * 3,
        height: size * 1.2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          transform: `translate3d(${-x}px,0,0)`,
          background: ACCENT.cyan.soft,
          borderInlineStart: `2px solid ${ACCENT.cyan.solid}`,
          padding: '8px 16px',
          color: ACCENT.cyan.solid,
          fontWeight: 800,
          opacity: p,
        }}
      >
        فروش
      </div>
      <div
        style={{
          position: 'absolute',
          transform: `translate3d(${x}px,0,0)`,
          background: ACCENT.red.soft,
          borderInlineStart: `2px solid ${ACCENT.red.solid}`,
          padding: '8px 16px',
          color: ACCENT.red.solid,
          fontWeight: 800,
          opacity: p,
        }}
      >
        سود؟
      </div>
    </div>
  )
}

// ── Transformation: unknown → known, never a made-up figure ──────────────
export function TransformingNumber({
  t,
  at = 0,
  dur = 1.5,
  size = 60,
  from = 'نامعلوم',
  to = '۱۲۰',
}: MetaphorProps & { from?: string; to?: string }) {
  const p = ease(progress(t, at, dur))
  const showTo = p > 0.5
  const scale = 1 + Math.sin(p * Math.PI) * 0.1
  const opacity = p < 0.4 ? 1 : p < 0.6 ? 1 - (p - 0.4) * 5 : (p - 0.6) * 2.5
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 900,
        transform: `scale(${scale})`,
        opacity: clamp(Math.max(0.3, opacity)),
        color: showTo ? ACCENT.green.solid : ACCENT.amber.solid,
      }}
    >
      {showTo ? to : from}
    </div>
  )
}

// ── Directional stroke ───────────────────────────────────────────────────
export function AnimatedArrow({
  t,
  at = 0,
  dur = 0.6,
  size = 40,
  direction = 'right',
}: MetaphorProps & { direction?: 'right' | 'down' | 'up' }) {
  const p = ease(progress(t, at, dur))
  const rotation = direction === 'down' ? 90 : direction === 'up' ? -90 : 0
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden
      style={{
        opacity: clamp(p),
        transform: `translate3d(${mix(-14, 0, p)}px,0,0) rotate(${rotation}deg)`,
      }}
    >
      <path
        d="M4 20 H32 M24 12 L32 20 L24 28"
        fill="none"
        stroke={ACCENT.cyan.solid}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Ambient field ────────────────────────────────────────────────────────
export function MotionBackground({ t, count = 8 }: { t: number; count?: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        opacity: 0.18,
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const x = (i * 37 + 13) % 100
        const y = (i * 53 + 7) % 100
        const speed = 0.3 + (i % 3) * 0.2
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: 3 + (i % 3) * 2,
              height: 3 + (i % 3) * 2,
              background: i % 2 === 0 ? ACCENT.cyan.solid : ACCENT.purple.solid,
              transform: `translate3d(${Math.sin(t * speed + i) * 12}px, ${Math.cos(t * speed * 0.7 + i * 1.3) * 8}px, 0)`,
            }}
          />
        )
      })}
    </div>
  )
}

// ── Silent leak ──────────────────────────────────────────────────────────
export function LeakDrip({ t, at = 0 }: MetaphorProps) {
  return (
    <div style={{ position: 'relative', width: 64, height: 92 }}>
      {[0, 1, 2, 3].map((i) => {
        const cycle = ((((t - at) * 0.8 + i * 0.25) % 1) + 1) % 1
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              left: 6 + i * 14,
              width: 8,
              height: 12,
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              background: ACCENT.cyan.solid,
              opacity: t >= at ? clamp(1 - cycle) : 0,
              transform: `translate3d(0, ${cycle * 74}px, 0)`,
            }}
          />
        )
      })}
    </div>
  )
}

// ── Opposition field ─────────────────────────────────────────────────────
export function OppositionField({ t, at = 0 }: MetaphorProps) {
  const p = ease(progress(t, at, 1))
  const sep = 16 + 6 * Math.sin(t * 1.6)
  return (
    <div style={{ position: 'relative', width: 150, height: 86 }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 75 - sep - 46,
          width: 46,
          height: 86,
          border: `1px solid ${ACCENT.cyan.solid}`,
          background: ACCENT.cyan.soft,
          opacity: p,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 75 + sep,
          width: 46,
          height: 86,
          border: `1px solid ${ACCENT.red.solid}`,
          background: ACCENT.red.soft,
          opacity: p,
        }}
      />
    </div>
  )
}

// ── Attention rings ──────────────────────────────────────────────────────
export function RipplePulse({ t, at = 0 }: MetaphorProps) {
  return (
    <div style={{ position: 'relative', width: 124, height: 124 }}>
      {[0, 1, 2].map((i) => {
        const raw = (t - at) * 0.7 + i / 3
        const p = ((raw % 1) + 1) % 1
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `1px solid ${ACCENT.cyan.solid}`,
              transform: `scale(${0.4 + p * 0.9})`,
              opacity: t >= at ? clamp(1 - p) * 0.8 : 0,
            }}
          />
        )
      })}
    </div>
  )
}

// ── Plan-driven layer ────────────────────────────────────────────────────

const LAYER_POS: Record<MotionMetaphorName, CSSProperties> = {
  'warning-impact': { top: 118, insetInlineStart: 24, opacity: 0.9 },
  'silent-leak': { top: 132, insetInlineEnd: 30, opacity: 0.85 },
  'rising-chart': { top: 610, insetInlineStart: 22, opacity: 0.85 },
  opposition: {
    top: 290,
    insetInlineStart: 0,
    insetInlineEnd: 0,
    display: 'flex',
    justifyContent: 'center',
    opacity: 0.75,
  },
  transformation: {
    top: 300,
    insetInlineStart: 0,
    insetInlineEnd: 0,
    display: 'flex',
    justifyContent: 'center',
    opacity: 0.6,
  },
  'question-shake': { top: 110, insetInlineEnd: 28, opacity: 0.95 },
  'attention-ripple': {
    top: 248,
    insetInlineStart: 0,
    insetInlineEnd: 0,
    display: 'flex',
    justifyContent: 'center',
    opacity: 0.55,
  },
}

function metaphorVisual(name: MotionMetaphorName, t: number, at: number): ReactNode {
  switch (name) {
    case 'warning-impact':
      return <WarningImpact t={t} at={at} size={72} />
    case 'silent-leak':
      return <LeakDrip t={t} at={at} />
    case 'rising-chart':
      return <RisingChart t={t} at={at} dur={1.6} size={64} />
    case 'opposition':
      return <OppositionField t={t} at={at} />
    case 'transformation':
      return <TransformingNumber t={t} at={at} from="؟" to="✓" size={56} />
    case 'question-shake':
      return <ShakingQuestion t={t} at={at} size={64} />
    case 'attention-ripple':
      return <RipplePulse t={t} at={at} />
  }
}

export function MetaphorLayer({ plan, t }: { plan: MotionPlan; t: number }) {
  if (!plan.metaphor && !plan.secondaryMetaphor) return null
  const draw = (
    name: MotionMetaphorName,
    at: number,
    attr: 'data-metaphor' | 'data-metaphor-secondary',
  ) => (
    <div
      key={attr}
      {...{ [attr]: name }}
      data-metaphor-tone={plan.metaphorTone}
      style={{ position: 'absolute', pointerEvents: 'none', zIndex: 0, ...LAYER_POS[name] }}
    >
      {metaphorVisual(name, t, at)}
    </div>
  )
  return (
    <>
      {plan.metaphor && draw(plan.metaphor, 0.2, 'data-metaphor')}
      {plan.secondaryMetaphor && draw(plan.secondaryMetaphor, 0.5, 'data-metaphor-secondary')}
    </>
  )
}
