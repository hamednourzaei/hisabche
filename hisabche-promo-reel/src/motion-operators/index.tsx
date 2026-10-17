/**
 * 30 SaaS Motion Operators & Transitions Catalog
 * Implements purpose-bound motion operators for Hisabche product films.
 * Zero Math.random, 100% deterministic, HarfBuzz-safe RTL typography.
 */

import React from 'react'
import { clamp, ease, mix, progress, pulse, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

// ─── 1. Time & Progression Operators ────────────────────────────────────────

/**
 * 1. Radial Clock Dial & Progress Ring
 */
export function RadialClockDial({
  t,
  cx = 270,
  cy = 280,
  r = 100,
  currentHour = 9,
  progressPct = 0,
  glowColor = '#22d3ee',
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
  const strokeOffset = circ * (1 - clamp(progressPct))
  const hourAngle = currentHour * 30
  const minuteAngle = hourAngle * 12

  // Hour hand
  const hRad = ((hourAngle - 90) * Math.PI) / 180
  const hx = cx + 42 * Math.cos(hRad)
  const hy = cy + 42 * Math.sin(hRad)

  // Minute hand
  const mRad = ((minuteAngle - 90) * Math.PI) / 180
  const mx = cx + 68 * Math.cos(mRad)
  const my = cy + 68 * Math.sin(mRad)

  return (
    <svg viewBox="0 0 540 540" width="540" height="540" style={{ overflow: 'visible' }}>
      <defs>
        <filter id="dial-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <radialGradient id="dial-interior" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1e2438" />
          <stop offset="100%" stopColor="#0a0d16" />
        </radialGradient>
      </defs>

      {/* Outer ambient glow */}
      <circle cx={cx} cy={cy} r={r + 14} fill={glowColor} opacity={0.15 + 0.1 * pulse(t, 0, 1e9)} />

      {/* Base track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="url(#dial-interior)"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={3}
      />

      {/* Progress ring arc */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={glowColor}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={strokeOffset}
        transform={`rotate(-90 ${cx} ${cy})`}
        filter="url(#dial-glow)"
      />

      {/* 12 Hour Ticks */}
      {Array.from({ length: 12 }).map((_, i) => {
        const ang = ((i * 30 - 90) * Math.PI) / 180
        const isCardinal = i % 3 === 0
        const x1 = cx + (isCardinal ? 80 : 86) * Math.cos(ang)
        const y1 = cy + (isCardinal ? 80 : 86) * Math.sin(ang)
        const x2 = cx + 94 * Math.cos(ang)
        const y2 = cy + 94 * Math.sin(ang)
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isCardinal ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)'}
            strokeWidth={isCardinal ? 2.5 : 1.5}
            strokeLinecap="round"
          />
        )
      })}

      {/* Hour Hand */}
      <line
        x1={cx}
        y1={cy}
        x2={hx}
        y2={hy}
        stroke="#ffffff"
        strokeWidth={4}
        strokeLinecap="round"
      />

      {/* Minute Hand */}
      <line
        x1={cx}
        y1={cy}
        x2={mx}
        y2={my}
        stroke={glowColor}
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      {/* Pinion */}
      <circle cx={cx} cy={cy} r={7} fill="#0d111d" stroke="#ffffff" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={3} fill={glowColor} />
    </svg>
  )
}

/**
 * 5. Odometer Slot Machine Roll for numbers
 */
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
  const displayVal = Math.round(mix(0, value, p))
  return (
    <span
      style={{
        fontVariantNumeric: 'tabular-nums',
        display: 'inline-block',
        transition: 'transform 0.1s ease',
      }}
    >
      {faNumber(displayVal)}
    </span>
  )
}

// ─── 2. Spatial 2.5D & Camera Operators ─────────────────────────────────────

/**
 * 8. Isometric UI Layer Explosion
 */
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
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      }}
    >
      <div
        style={{
          transform: `rotateX(${mix(0, 42, p)}deg) rotateY(${mix(0, -18, p)}deg) rotateZ(${mix(0, 8, p)}deg)`,
          transformStyle: 'preserve-3d',
          position: 'relative',
          width: 360,
          height: 220,
        }}
      >
        {layers.map((layer, i) => {
          const zOffset = i * mix(0, 65, p)
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                inset: 0,
                transform: `translateZ(${zOffset}px)`,
                borderRadius: 16,
                background: 'rgba(15, 23, 42, 0.88)',
                border: `1.5px solid ${layer.tone}`,
                boxShadow: `0 16px 36px rgba(0, 0, 0, 0.6), 0 0 20px ${layer.tone}33`,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#f8fafc',
                backdropFilter: 'blur(12px)',
                opacity: mix(0.7, 1, p),
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>{layer.icon}</span>
                <span style={{ fontWeight: 800, fontSize: 16 }}>{layer.title}</span>
              </div>
              <span
                style={{ fontWeight: 900, color: layer.tone, fontVariantNumeric: 'tabular-nums' }}
              >
                {layer.value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 3. Morphing & Liquid Transitions ───────────────────────────────────────

/**
 * 15. Iris Reveal Mask
 */
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
  const radius = p * 150
  return (
    <div
      style={{
        clipPath: `circle(${radius}% at 50% 50%)`,
        width: '100%',
        height: '100%',
      }}
    >
      {children}
    </div>
  )
}

// ─── 4. Kinetic Typography Operators ────────────────────────────────────────

/**
 * 20. Baseline Curtain Rise (HarfBuzz-safe word-by-word)
 */
export function BaselineCurtainRise({
  text,
  t,
  startAt = 0.2,
  tone = '#38bdf8',
}: {
  text: string
  t: number
  startAt?: number
  tone?: string
}) {
  const words = text.split(' ')

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 12px',
        direction: 'rtl',
        justifyContent: 'center',
      }}
    >
      {words.map((word, i) => {
        const wordT = startAt + i * 0.08
        const s = spring(t - wordT)
        return (
          <span
            key={i}
            style={{
              overflow: 'hidden',
              display: 'inline-block',
              lineHeight: 1.3,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transform: `translateY(${mix(100, 0, s)}%)`,
                opacity: clamp(s * 2),
                color: i === 0 || i === words.length - 1 ? tone : '#f8fafc',
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

/**
 * 21. Animated Highlighter Sweep
 */
export function HighlighterSweep({
  text,
  t,
  startAt = 0.5,
  color = 'rgba(56, 189, 248, 0.35)',
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
        style={{
          position: 'absolute',
          insetInlineStart: 0,
          bottom: 2,
          height: '42%',
          width: `${p * 100}%`,
          background: color,
          borderRadius: 4,
          zIndex: 0,
        }}
      />
      <span style={{ position: 'relative', zIndex: 1 }}>{text}</span>
    </span>
  )
}

// ─── 5. Financial & Optical FX ──────────────────────────────────────────────

/**
 * 26. Profit Waterfall Drain
 */
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

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 440,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        direction: 'rtl',
      }}
    >
      {/* Gross Revenue */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          <span>فروش ناخالص (دخل روز)</span>
          <span style={{ color: '#38bdf8', fontVariantNumeric: 'tabular-nums' }}>
            {faNumber(Math.round(grossRevenue * pGross))}
          </span>
        </div>
        <div
          style={{
            height: 12,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pGross * 100}%`,
              background: 'linear-gradient(90deg, #38bdf8, #22d3ee)',
            }}
          />
        </div>
      </div>

      {/* COGS Deduction */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 14,
            color: '#f87171',
          }}
        >
          <span>- بهای تمام شده خرید (FIFO)</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {faNumber(Math.round(cogs * pCogs))}
          </span>
        </div>
        <div
          style={{
            height: 8,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${(cogs / grossRevenue) * 100 * pCogs}%`,
              background: '#ef4444',
            }}
          />
        </div>
      </div>

      {/* Expenses Deduction */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 14,
            color: '#fbbf24',
          }}
        >
          <span>- هزینه‌های جاری و تخفیف‌ها</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {faNumber(Math.round(expenses * pExp))}
          </span>
        </div>
        <div
          style={{
            height: 8,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${(expenses / grossRevenue) * 100 * pExp}%`,
              background: '#f59e0b',
            }}
          />
        </div>
      </div>

      {/* True Net Profit */}
      <div
        style={{
          marginTop: 10,
          padding: '16px 20px',
          borderRadius: 14,
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1.5px solid #10b981',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 0 25px rgba(16, 185, 129, 0.25)',
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 900, color: '#ecfdf5' }}>سود خالص واقعی:</span>
        <span
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: '#10b981',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {faNumber(Math.round(netProfit * pExp))}
        </span>
      </div>
    </div>
  )
}

/**
 * 27. X-Ray Profit Scanner
 */
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
  const beamY = mix(0, 100, p)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Moving Laser Beam */}
      <div
        style={{
          position: 'absolute',
          insetInline: 0,
          top: `${beamY}%`,
          height: 3,
          background: 'linear-gradient(90deg, transparent, #38bdf8, #ffffff, #38bdf8, transparent)',
          boxShadow: '0 0 16px #38bdf8, 0 0 32px #22d3ee',
          opacity: p > 0 && p < 1 ? 1 : 0,
        }}
      />
    </div>
  )
}
