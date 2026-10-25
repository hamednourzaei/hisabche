// src/ui/motion-metaphors.tsx
// Visual Metaphor System — animated graphics that make concepts tangible.
// Each metaphor is a pure function of (t, at) and returns CSS/JSX.
// `MetaphorLayer` is consumed by SceneView every frame — see engine/motion-plan.ts.

import type { CSSProperties, ReactNode } from 'react'

import { clamp, ease, mix, progress, pulse } from '../engine/anim'
import type { MotionMetaphorName, MotionPlan } from '../engine/motion-plan'

export interface MetaphorProps {
  t: number
  at?: number
  dur?: number
  size?: number
}

// ── Rising Chart ──────────────────────────────────────────────────────────────
export function RisingChart({ t, at = 0, dur = 1.2, size = 120 }: MetaphorProps) {
  const bars = [0.3, 0.5, 0.7, 0.85, 1.0]
  return (
    <div
      style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: size, width: size * 1.4 }}
    >
      {bars.map((h, i) => {
        const delay = i * 0.08
        const bp = ease(progress(t, at + delay, dur * 0.6))
        const height = h * size * bp
        return (
          <div
            key={i}
            style={{
              width: size * 0.22,
              height: Math.max(2, height),
              background: `linear-gradient(180deg, #00E5FF, #A855F7)`,
              borderRadius: 4,
              transform: `scaleY(${bp})`,
              transformOrigin: 'bottom',
              opacity: bp,
            }}
          />
        )
      })}
    </div>
  )
}

// ── Shaking Question Mark ─────────────────────────────────────────────────────
export function ShakingQuestion({ t, at = 0, dur = 1.0, size = 80 }: MetaphorProps) {
  const elapsed = Math.max(0, t - at)
  const shake = elapsed < dur ? Math.sin(elapsed * 25) * 6 * (1 - elapsed / dur) : 0
  const scale = 1 + pulse(t, at, at + dur, 0.4) * 0.15
  const opacity = progress(t, at, 0.2)
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 900,
        color: '#F59E0B',
        transform: `translateX(${shake}px) scale(${scale})`,
        opacity: clamp(opacity),
        textShadow: '0 0 20px rgba(245,158,11,0.6)',
        lineHeight: 1,
      }}
    >
      ?
    </div>
  )
}

// ── Flipping Calendar Pages ───────────────────────────────────────────────────
export function FlippingCalendar({ t, at = 0, dur = 1.5, size = 80 }: MetaphorProps) {
  const pages = 3
  return (
    <div style={{ position: 'relative', width: size, height: size * 1.2 }}>
      {Array.from({ length: pages }).map((_, i) => {
        const pageAt = at + i * (dur / pages)
        const p = ease(progress(t, pageAt, dur / pages))
        const flip = p * 180
        const opacity = 1 - p * 0.7
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, #1e293b, #0f172a)',
              border: '2px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: size * 0.4,
              color: '#00E5FF',
              fontWeight: 700,
              transform: `rotateX(${flip}deg)`,
              transformOrigin: 'top center',
              opacity: clamp(opacity),
              backfaceVisibility: 'hidden',
            }}
          >
            {i + 1}
          </div>
        )
      })}
    </div>
  )
}

// ── Warning Icon with Impact ──────────────────────────────────────────────────
export function WarningImpact({ t, at = 0, dur = 0.8, size = 80 }: MetaphorProps) {
  const elapsed = Math.max(0, t - at)
  const scale =
    elapsed < dur
      ? mix(0, 1.3, ease(progress(t, at, dur * 0.5))) * (1 - 0.15 * Math.sin(elapsed * 20))
      : 1
  const opacity = progress(t, at, 0.15)
  const pulseVal = pulse(t, at + dur, at + dur + 1.5, 0.6)
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 900,
        color: '#F59E0B',
        transform: `scale(${scale})`,
        opacity: clamp(opacity),
        textShadow: `0 0 ${10 + pulseVal * 20}px rgba(245,158,11,${0.4 + pulseVal * 0.4})`,
        lineHeight: 1,
      }}
    >
      ⚠
    </div>
  )
}

// ── Opposing Cards ────────────────────────────────────────────────────────────
export function OpposingCards({ t, at = 0, dur = 1.2, size = 100 }: MetaphorProps) {
  const p = ease(progress(t, at, dur))
  const leftX = mix(-size * 1.5, -size * 0.3, p)
  const rightX = mix(size * 1.5, size * 0.3, p)
  const leftScale = mix(0.8, 1, p)
  const rightScale = mix(0.8, 1, p)
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
          transform: `translateX(${leftX}px) scale(${leftScale})`,
          background: 'rgba(0,229,255,0.15)',
          border: '2px solid #00E5FF',
          borderRadius: 12,
          padding: '8px 16px',
          fontSize: size * 0.25,
          color: '#00E5FF',
          fontWeight: 700,
          opacity: p,
        }}
      >
        فروش
      </div>
      <div
        style={{
          position: 'absolute',
          transform: `translateX(${rightX}px) scale(${rightScale})`,
          background: 'rgba(239,68,68,0.15)',
          border: '2px solid #EF4444',
          borderRadius: 12,
          padding: '8px 16px',
          fontSize: size * 0.25,
          color: '#EF4444',
          fontWeight: 700,
          opacity: p,
        }}
      >
        سود؟
      </div>
    </div>
  )
}

// ── Transforming Number ───────────────────────────────────────────────────────
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
  const scale = 1 + Math.sin(p * Math.PI) * 0.2
  const opacity = p < 0.4 ? 1 : p < 0.6 ? 1 - (p - 0.4) * 5 : (p - 0.6) * 2.5
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 900,
        transform: `scale(${scale})`,
        opacity: clamp(Math.max(0.3, opacity)),
        color: showTo ? '#10B981' : '#F59E0B',
        textShadow: showTo ? '0 0 20px rgba(16,185,129,0.6)' : '0 0 20px rgba(245,158,11,0.6)',
        transition: 'color 0.3s',
      }}
    >
      {showTo ? to : from}
    </div>
  )
}

// ── Animated Arrow ────────────────────────────────────────────────────────────
export function AnimatedArrow({
  t,
  at = 0,
  dur = 0.6,
  size = 40,
  direction = 'right',
}: MetaphorProps & { direction?: 'right' | 'down' | 'up' }) {
  const p = ease(progress(t, at, dur))
  const translate = mix(-20, 0, p)
  const opacity = p
  const rotation = direction === 'down' ? 90 : direction === 'up' ? -90 : 0
  return (
    <div
      style={{
        fontSize: size,
        opacity: clamp(opacity),
        transform: `translateX(${translate}px) rotate(${rotation}deg)`,
        color: '#00E5FF',
        fontWeight: 900,
        lineHeight: 1,
      }}
    >
      →
    </div>
  )
}

// ── Motion Background (subtle floating particles) ────────────────────────────
export function MotionBackground({ t, count = 8 }: { t: number; count?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        opacity: 0.15,
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const x = (i * 37 + 13) % 100
        const y = (i * 53 + 7) % 100
        const speed = 0.3 + (i % 3) * 0.2
        const offsetX = Math.sin(t * speed + i) * 15
        const offsetY = Math.cos(t * speed * 0.7 + i * 1.3) * 10
        const scale = 0.5 + 0.5 * Math.sin(t * 0.5 + i * 0.8)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: 4 + (i % 3) * 3,
              height: 4 + (i % 3) * 3,
              borderRadius: '50%',
              background: i % 2 === 0 ? '#00E5FF' : '#A855F7',
              transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
              filter: 'blur(1px)',
            }}
          />
        )
      })}
    </div>
  )
}

// ── Silent Leak (profit dripping away — no words, pure motion) ────────────────
export function LeakDrip({ t, at = 0 }: MetaphorProps) {
  return (
    <div style={{ position: 'relative', width: 64, height: 92 }}>
      {[0, 1, 2, 3].map((i) => {
        const cycle = ((((t - at) * 0.8 + i * 0.25) % 1) + 1) % 1
        const started = t >= at
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
              background: '#22d3ee',
              opacity: started ? clamp(1 - cycle) : 0,
              transform: `translateY(${cycle * 74}px)`,
              boxShadow: '0 0 8px rgba(34,211,238,0.5)',
            }}
          />
        )
      })}
    </div>
  )
}

// ── Opposition Field (two sides pushing apart — no words) ─────────────────────
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
          borderRadius: 12,
          border: '2px solid rgba(34,211,238,0.85)',
          background: 'rgba(34,211,238,0.10)',
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
          borderRadius: 12,
          border: '2px solid rgba(251,113,133,0.85)',
          background: 'rgba(251,113,133,0.10)',
          opacity: p,
        }}
      />
    </div>
  )
}

// ── Ripple Pulse (attention rings — no words) ─────────────────────────────────
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
              border: '2px solid rgba(34,211,238,0.55)',
              transform: `scale(${0.4 + p * 0.9})`,
              opacity: t >= at ? clamp(1 - p) * 0.9 : 0,
            }}
          />
        )
      })}
    </div>
  )
}

// ── Metaphor Layer — the render hook every SceneView frame goes through ───────
// Plan-driven: `plan.metaphor` and `plan.secondaryMetaphor` decide what is drawn.
// Rendered behind scene content (pointer-events: none) with data attributes so
// Motion QA and tests can prove the metaphor reached the real output.

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
      // Symbols only — never a made-up figure or a currency.
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
