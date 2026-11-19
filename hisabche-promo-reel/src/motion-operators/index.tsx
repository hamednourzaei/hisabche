// ============================================
// SaaS Motion Operators — rebuilt on the 100 motion rules.
// 8 exports, signatures frozen. The old catalog painted frosted glass cards,
// gradient bars, blur filters and CSS transitions (website footprint). Now:
// single-source tokens, stroked geometry, transform/opacity only, no zoom.
// Rules: 21-29, 33, 41-43, 51-57, 66, 98.
// ============================================

import React from 'react'
import { clamp, ease, mix, progress, pulse, spring } from '../engine/anim'
import { ACCENT, MATERIAL, faNumber } from '../ui/art-direction'

// ─── 1. Time & progression ─────────────────────────────────────────────────

export function RadialClockDial({
  t,
  cx = 270,
  cy = 280,
  r = 100,
  currentHour = 9,
  progressPct = 0,
  glowColor = ACCENT.cyan.solid,
}: {
  t: number
  cx?: number
  cy?: number
  r?: number
  currentHour?: number
  progressPct?: number
  glowColor?: string
}) {
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - clamp(progressPct))
  const hourAngle = currentHour * 30
  const minuteAngle = hourAngle * 12
  const hand = (angle: number, len: number) => {
    const rad = ((angle - 90) * Math.PI) / 180
    return { x: cx + len * Math.cos(rad), y: cy + len * Math.sin(rad) }
  }
  const h = hand(hourAngle, 42)
  const m = hand(minuteAngle, 68)
  const beat = pulse(t, 0, 1e9, 2.4)
  return (
    <svg viewBox="0 0 540 540" width={540} height={540} style={{ overflow: 'visible' }} aria-hidden>
      <circle cx={cx} cy={cy} r={r + 14} fill={glowColor} opacity={0.06 + 0.05 * beat} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={MATERIAL.panel}
        stroke={MATERIAL.panelEdge}
        strokeWidth={2}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={glowColor}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {Array.from({ length: 12 }).map((_, i) => {
        const ang = ((i * 30 - 90) * Math.PI) / 180
        const major = i % 3 === 0
        return (
          <line
            key={i}
            x1={cx + (major ? 80 : 86) * Math.cos(ang)}
            y1={cy + (major ? 80 : 86) * Math.sin(ang)}
            x2={cx + 94 * Math.cos(ang)}
            y2={cy + 94 * Math.sin(ang)}
            stroke={major ? MATERIAL.ink : MATERIAL.muted}
            strokeOpacity={major ? 0.8 : 0.35}
            strokeWidth={major ? 2 : 1}
            strokeLinecap="round"
          />
        )
      })}
      <line
        x1={cx}
        y1={cy}
        x2={h.x}
        y2={h.y}
        stroke={MATERIAL.ink}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <line
        x1={cx}
        y1={cy}
        x2={m.x}
        y2={m.y}
        stroke={glowColor}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={6} fill={MATERIAL.void} stroke={MATERIAL.ink} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={2.5} fill={glowColor} />
    </svg>
  )
}

export function OdometerRoll({
  value,
  duration = 1.2,
  t,
  startAt = 0,
}: {
  value: number
  duration?: number
  t: number
  startAt?: number
}) {
  const p = ease(progress(t, startAt, duration))
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', display: 'inline-block', opacity: 1 }}>
      {faNumber(Math.round(mix(0, value, p)))}
    </span>
  )
}

// ─── 2. Spatial 2.5D ──────────────────────────────────────────────────────

export function IsometricLayerExplosion({
  t,
  startAt = 0.5,
  layers,
}: {
  t: number
  startAt?: number
  layers: { title: string; tone: string; value: string; icon: string }[]
}) {
  const p = ease(progress(t, startAt, 1.2))
  return (
    <div
      style={{
        perspective: 1200,
        transformStyle: 'preserve-3d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      }}
    >
      <div
        style={{
          transform: `rotateX(${mix(0, 38, p)}deg) rotateY(${mix(0, -16, p)}deg) rotateZ(${mix(0, 6, p)}deg)`,
          transformStyle: 'preserve-3d',
          position: 'relative',
          width: 360,
          height: 200,
        }}
      >
        {layers.map((layer, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              transform: `translate3d(0, 0, ${i * mix(0, 48, p)}px)`,
              background: MATERIAL.panel,
              border: `1px solid ${MATERIAL.panelEdge}`,
              borderInlineStart: `2px solid ${layer.tone}`,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: MATERIAL.ink,
              opacity: mix(0.72, 1, p),
            }}
          >
            <span style={{ fontWeight: 800, fontSize: 16 }}>{layer.title}</span>
            <span
              style={{ fontWeight: 900, color: layer.tone, fontVariantNumeric: 'tabular-nums' }}
            >
              {layer.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 3. Transitions ───────────────────────────────────────────────────────

export function IrisReveal({
  t,
  startAt = 0,
  duration = 0.8,
  children,
}: {
  t: number
  startAt?: number
  duration?: number
  children: React.ReactNode
}) {
  const p = ease(progress(t, startAt, duration))
  return (
    <div style={{ clipPath: `circle(${p * 150}% at 50% 50%)`, width: '100%', height: '100%' }}>
      {children}
    </div>
  )
}

// ─── 4. Kinetic typography ────────────────────────────────────────────────

export function BaselineCurtainRise({
  text,
  t,
  startAt = 0.2,
  tone = ACCENT.cyan.solid,
}: {
  text: string
  t: number
  startAt?: number
  tone?: string
}) {
  const words = text.split(' ')
  return (
    <div
      dir="rtl"
      style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', justifyContent: 'center' }}
    >
      {words.map((word, i) => {
        const s = spring(t - (startAt + i * 0.06))
        return (
          <span key={i} style={{ overflow: 'hidden', display: 'inline-block', lineHeight: 1.4 }}>
            <span
              style={{
                display: 'inline-block',
                transform: `translate3d(0, ${mix(100, 0, s)}%, 0)`,
                opacity: clamp(s * 2),
                color: i === 0 || i === words.length - 1 ? tone : MATERIAL.ink,
                fontWeight: 900,
                fontSize: 26,
              }}
            >
              {word}
            </span>
          </span>
        )
      })}
    </div>
  )
}

export function HighlighterSweep({
  text,
  t,
  startAt = 0.5,
  color = ACCENT.cyan.soft,
}: {
  text: string
  t: number
  startAt?: number
  color?: string
}) {
  const p = ease(progress(t, startAt, 0.6))
  return (
    <span style={{ position: 'relative', display: 'inline-block', paddingInline: 4 }}>
      <span
        aria-hidden
        style={{
          position: 'absolute',
          insetInlineStart: 0,
          bottom: 2,
          height: 2,
          width: `${p * 100}%`,
          background: color,
          transform: 'none',
        }}
      />
      <span style={{ position: 'relative' }}>{text}</span>
    </span>
  )
}

// ─── 5. Financial marks ───────────────────────────────────────────────────

export function ProfitWaterfallDrain({
  t,
  grossRevenue = 50000000,
  cogs = 32000000,
  expenses = 8000000,
}: {
  t: number
  grossRevenue?: number
  cogs?: number
  expenses?: number
}) {
  const pGross = ease(progress(t, 0.2, 0.8))
  const pCogs = ease(progress(t, 0.9, 0.8))
  const pExp = ease(progress(t, 1.6, 0.8))
  const netProfit = grossRevenue - cogs - expenses
  const row = (label: string, value: number, color: string, p: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color }}>
        <span>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {faNumber(Math.round(value * p))}
        </span>
      </div>
      <div style={{ height: 2, background: MATERIAL.panelEdge }}>
        <div
          style={{ height: '100%', width: `${p * 100}%`, background: color, transform: 'none' }}
        />
      </div>
    </div>
  )
  return (
    <div
      dir="rtl"
      style={{
        width: '100%',
        maxWidth: 440,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      {row('فروش ناخالص (دخل روز)', grossRevenue, ACCENT.cyan.solid, pGross)}
      {row('− بهای تمامشده خرید (FIFO)', cogs, ACCENT.red.solid, pCogs)}
      {row('− هزینههای جاری و تخفیفها', expenses, ACCENT.amber.solid, pExp)}
      <div
        style={{
          marginTop: 8,
          padding: '14px 18px',
          border: `1px solid ${ACCENT.green.solid}`,
          borderInlineStart: `3px solid ${ACCENT.green.solid}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 900, color: MATERIAL.ink }}>سود خالص واقعی:</span>
        <span
          style={{
            fontSize: 23,
            fontWeight: 900,
            color: ACCENT.green.solid,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {faNumber(Math.round(netProfit * pExp))}
        </span>
      </div>
    </div>
  )
}

export function XRayProfitScanner({
  t,
  startAt = 0.4,
  duration = 1.5,
}: {
  t: number
  startAt?: number
  duration?: number
}) {
  const p = ease(progress(t, startAt, duration))
  return (
    <div
      aria-hidden
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
    >
      <div
        style={{
          position: 'absolute',
          insetInline: 0,
          top: `${mix(0, 100, p)}%`,
          height: 2,
          background: ACCENT.cyan.solid,
          opacity: p > 0 && p < 1 ? 0.7 : 0,
        }}
      />
    </div>
  )
}
