// ============================================
// Hisabche Motion Design Studio — Layer A Creative Primitives
// High-expressive, modular visual primitives for cinematic 3D,
// Swiss editorial, kinetic manifesto, and procedural spatial design.
// Zero reliance on fixed card templates.
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import {
  clamp,
  deterministicHash,
  ease,
  maskWipe,
  mix,
  progress,
  pulse,
  strokeDraw,
} from '../engine/anim'
import type { Tone } from '../engine/types'
import { TONE } from './card'
import { Rich } from './rich'

// ─── 1. Perspective 3D Stage & Parallax Layer ────────────────────────────

export function PerspectiveStage({
  t,
  children,
  camera = { rx: 12, ry: -14, z: -40 },
  target = { rx: 0, ry: 0, z: 0 },
  dur = 8,
  style,
}: {
  t: number
  children: ReactNode
  camera?: { rx: number; ry: number; z: number }
  target?: { rx: number; ry: number; z: number }
  dur?: number
  style?: CSSProperties
}) {
  const p = ease(clamp(t / dur))
  const rx = mix(camera.rx, target.rx, p)
  const ry = mix(camera.ry, target.ry, p)
  const z = mix(camera.z, target.z, p)

  return (
    <div className="perspective-viewport" style={style}>
      <div
        className="perspective-world"
        style={{
          transform: `perspective(1200px) translateZ(${z}px) rotateX(${rx}deg) rotateY(${ry}deg)`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function ParallaxLayer({
  z = 0,
  scale = 1,
  opacity = 1,
  className = '',
  style,
  children,
}: {
  z?: number
  scale?: number
  opacity?: number
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div
      className={`parallax-layer ${className}`}
      style={{
        transform: `translateZ(${z}px) scale(${scale})`,
        opacity,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── 2. Procedural Spatial Vector Network ─────────────────────────────────

export function ProceduralNetwork({
  t,
  nodeCount = 18,
  tone = 'cyan',
}: {
  t: number
  nodeCount?: number
  tone?: Tone
}) {
  const c = TONE[tone]
  const nodes: { id: number; x: number; y: number; r: number }[] = []

  for (let i = 0; i < nodeCount; i++) {
    const x = deterministicHash(i, 1) * 480 + 30
    const y = deterministicHash(i, 2) * 560 + 100
    const r = deterministicHash(i, 3) * 3 + 2.5
    nodes.push({ id: i, x, y, r })
  }

  return (
    <svg className="procedural-network-svg" viewBox="0 0 540 800" aria-hidden="true">
      <defs>
        <radialGradient id={`net-glow-${tone}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={c.solid} stopOpacity="0.8" />
          <stop offset="100%" stopColor={c.solid} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Interconnecting dynamic lines */}
      {nodes.map((n1, idx) => {
        const n2 = nodes[(idx + 1) % nodes.length]!
        const n3 = nodes[(idx + 3) % nodes.length]!
        const strokeP1 = clamp((t - idx * 0.15) / 1.2)
        const strokeP2 = clamp((t - idx * 0.18) / 1.2)

        return (
          <g key={n1.id}>
            <line
              x1={n1.x}
              y1={n1.y}
              x2={mix(n1.x, n2.x, strokeP1)}
              y2={mix(n1.y, n2.y, strokeP1)}
              stroke={c.solid}
              strokeOpacity={0.25}
              strokeWidth={1.2}
            />
            {idx % 2 === 0 && (
              <line
                x1={n1.x}
                y1={n1.y}
                x2={mix(n1.x, n3.x, strokeP2)}
                y2={mix(n1.y, n3.y, strokeP2)}
                stroke={c.solid}
                strokeOpacity={0.15}
                strokeWidth={0.8}
                strokeDasharray="4 4"
              />
            )}
          </g>
        )
      })}

      {/* Nodes and pulse beacons */}
      {nodes.map((node) => {
        const pulseVal = pulse(t, 0.5 + node.id * 0.2, 10, 2.0)
        const op = clamp(progress(t, node.id * 0.12, 0.4))
        return (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`} opacity={op}>
            <circle
              r={node.r * (1 + pulseVal * 1.8)}
              fill={`url(#net-glow-${tone})`}
              opacity={0.6}
            />
            <circle r={node.r} fill={c.solid} />
          </g>
        )
      })}
    </svg>
  )
}

// ─── 3. Precision Geometric Blueprint ────────────────────────────────────

export function GeometricBlueprint({
  t,
  accentColor = '#22d3ee',
}: {
  t: number
  accentColor?: string
}) {
  const draw1 = strokeDraw(t, 0.2, 1.8, 1200)
  const draw2 = strokeDraw(t, 0.6, 2.0, 900)
  const rot = (t * 8) % 360

  return (
    <div className="blueprint-container" aria-hidden="true">
      <svg className="blueprint-svg" viewBox="0 0 540 960">
        <defs>
          <pattern id="grid-pattern-fine" width="30" height="30" patternUnits="userSpaceOnUse">
            <path
              d="M 30 0 L 0 0 0 30"
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="0.8"
            />
          </pattern>
        </defs>

        <rect width="540" height="960" fill="url(#grid-pattern-fine)" />

        {/* Framing & Measurement Markers */}
        <path
          d="M 40 80 L 500 80 L 500 880 L 40 880 Z"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
          style={draw1}
        />

        {/* Technical crosshairs at corners */}
        <g stroke={accentColor} strokeWidth="1.5" opacity={0.7}>
          <path d="M 32 80 L 48 80 M 40 72 L 40 88" />
          <path d="M 492 80 L 508 80 M 500 72 L 500 88" />
          <path d="M 32 880 L 48 880 M 40 872 L 40 888" />
          <path d="M 492 880 L 508 880 M 500 872 L 500 888" />
        </g>

        {/* Central rotating compass ring */}
        <g transform={`translate(270, 480) rotate(${rot})`}>
          <circle
            r="160"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1.5"
            strokeDasharray="6 8"
          />
          <circle
            r="130"
            fill="none"
            stroke={accentColor}
            strokeWidth="1.2"
            strokeOpacity={0.4}
            style={draw2}
          />
          {/* Degree ticks */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="0"
              y1="-165"
              x2="0"
              y2="-155"
              stroke={accentColor}
              strokeWidth="1.5"
              transform={`rotate(${deg})`}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}

// ─── 4. High-End Kinetic Typography Mask ──────────────────────────────────

export function KineticMaskHeadline({
  lines,
  t,
  startAt = 0.2,
  interval = 0.35,
  direction = 'up',
  className = '',
}: {
  lines: string[]
  t: number
  startAt?: number
  interval?: number
  direction?: 'up' | 'down' | 'left' | 'right'
  className?: string
}) {
  return (
    <div className={`kinetic-mask-headline ${className}`}>
      {lines.map((line, idx) => {
        const at = startAt + idx * interval
        const p = ease(progress(t, at, 0.6))
        const clip = maskWipe(p, direction)
        const y = mix(45, 0, p)

        return (
          <div key={idx} className="mask-line-wrapper" style={{ overflow: 'hidden' }}>
            <div
              className="mask-line-content"
              style={{
                clipPath: clip,
                transform: `translateY(${y}px)`,
                opacity: p,
              }}
            >
              <Rich text={line} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── 5. Continuous Morph Shape ───────────────────────────────────────────

export function ContinuousMorphShape({
  t,
  size = 280,
  tone = 'cyan',
}: {
  t: number
  size?: number
  tone?: Tone
}) {
  const c = TONE[tone]
  // Phase 1 (0..3s): Core Ring & Concentric Orbit
  // Phase 2 (3..7s): Security Vault & Shield
  // Phase 3 (7..11s): Cloud Infrastructure
  // Phase 4 (11..15s): Certified Ledger & Check

  const p1 = ease(progress(t, 0.4, 1.2))
  const p2 = ease(progress(t, 3.5, 1.2))
  const p3 = ease(progress(t, 7.5, 1.2))
  const p4 = ease(progress(t, 11.5, 1.2))

  const rot = (t * 24) % 360
  const pulseVal = pulse(t, 0, 15, 1.6)

  return (
    <div
      className="continuous-morph-container"
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 200 200" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={`morph-grad-${tone}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c.solid} />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
          <filter id="morph-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* State 1: Geometric Concentric Energy Ring */}
        <g opacity={1 - p2}>
          <circle
            cx="100"
            cy="100"
            r={mix(20, 75, p1)}
            fill="none"
            stroke={`url(#morph-grad-${tone})`}
            strokeWidth="3.5"
            strokeDasharray="6 8"
            transform={`rotate(${rot} 100 100)`}
            filter="url(#morph-glow)"
          />
          <circle
            cx="100"
            cy="100"
            r={mix(10, 50, p1) * (1 + pulseVal * 0.08)}
            fill="none"
            stroke={c.solid}
            strokeWidth="2"
            opacity={0.6}
          />
          <circle cx="100" cy="100" r={mix(4, 16, p1)} fill={c.solid} />
        </g>

        {/* State 2: Security Vault Shield */}
        <g opacity={p2 * (1 - p3)}>
          <path
            d="M 100 35 L 155 60 L 155 110 C 155 145 100 170 100 170 C 100 170 45 145 45 110 L 45 60 Z"
            fill="rgba(6, 182, 212, 0.08)"
            stroke={c.solid}
            strokeWidth="3"
            filter="url(#morph-glow)"
            style={strokeDraw(t, 3.5, 1.2, 450)}
          />
          {/* Keyhole / Lock Core */}
          <circle cx="100" cy="95" r="14" fill={c.solid} opacity={p2} />
          <path d="M 94 95 L 106 95 L 109 125 L 91 125 Z" fill={c.solid} opacity={p2} />
        </g>

        {/* State 3: Cloud Infrastructure */}
        <g opacity={p3 * (1 - p4)}>
          <path
            d="M 65 130 C 50 130 40 120 40 105 C 40 92 50 82 62 80 C 66 62 82 50 100 50 C 122 50 139 65 142 85 C 153 87 160 96 160 108 C 160 120 150 130 138 130 Z"
            fill="rgba(192, 132, 252, 0.12)"
            stroke="#c084fc"
            strokeWidth="3"
            filter="url(#morph-glow)"
            style={strokeDraw(t, 7.5, 1.2, 500)}
          />
          {/* Flowing sync arrows inside cloud */}
          <path
            d="M 85 100 L 100 85 L 115 100 M 100 85 L 100 115"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={p3}
          />
        </g>

        {/* State 4: Verified Double Ledger & Certified Seal */}
        <g opacity={p4}>
          <rect
            x="45"
            y="45"
            width="110"
            height="110"
            rx="20"
            fill="rgba(34, 197, 94, 0.1)"
            stroke="#4ade80"
            strokeWidth="3"
            filter="url(#morph-glow)"
            style={strokeDraw(t, 11.5, 1.2, 440)}
          />
          {/* Big Checkmark */}
          <path
            d="M 72 100 L 92 120 L 132 75"
            fill="none"
            stroke="#4ade80"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={strokeDraw(t, 12.0, 0.8, 150)}
          />
        </g>
      </svg>
    </div>
  )
}

// ─── 6. Living Financial Flow Diagram ────────────────────────────────────

export function FinancialIntelligenceFlow({
  revenue = 100,
  cogs = 60,
  grossProfit = 40,
  t,
}: {
  revenue?: number
  cogs?: number
  grossProfit?: number
  t: number
}) {
  const p1 = ease(progress(t, 0.3, 1.0))
  const p2 = ease(progress(t, 1.2, 1.0))
  const p3 = ease(progress(t, 2.2, 1.0))

  return (
    <div className="financial-flow-wrap">
      {/* Node 1: Gross Sales */}
      <div
        className="flow-node flow-node-revenue"
        style={{
          transform: `scale(${mix(0.85, 1, p1)})`,
          opacity: p1,
        }}
      >
        <span className="flow-node-title">کل فروش فاکتورها</span>
        <span className="flow-node-amount cyan">
          {new Intl.NumberFormat('fa-IR').format(Math.round(revenue * 1000))}
        </span>
        <span className="flow-node-pct">۱۰۰٪ جریان ورودی</span>
      </div>

      {/* SVG Connecting Flow Pipe with Animated Current */}
      <svg className="flow-pipe-svg" viewBox="0 0 400 90">
        <defs>
          <linearGradient id="pipe-split-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="60%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
        </defs>
        {/* Main trunk */}
        <line x1="200" y1="0" x2="200" y2="40" stroke="#22d3ee" strokeWidth="4" />
        {/* Split to left (cost) and right (net profit) */}
        <path
          d="M 200 40 C 200 65 100 60 100 90"
          fill="none"
          stroke="#fb7185"
          strokeWidth="3.5"
          strokeDasharray="6 4"
        />
        <path d="M 200 40 C 200 65 300 60 300 90" fill="none" stroke="#4ade80" strokeWidth="4" />
      </svg>

      {/* Branching Nodes: COGS vs Net Profit */}
      <div className="flow-branch-row">
        {/* Cost Node */}
        <div
          className="flow-node flow-node-cogs"
          style={{
            transform: `scale(${mix(0.85, 1, p2)})`,
            opacity: p2,
          }}
        >
          <span className="flow-node-title">بهای تمام‌شده (خرید)</span>
          <span className="flow-node-amount red">
            {new Intl.NumberFormat('fa-IR').format(Math.round(cogs * 1000))}
          </span>
          <span className="flow-node-pct">۶۰٪ هزینه بار</span>
        </div>

        {/* Real Net Profit Node */}
        <div
          className="flow-node flow-node-profit"
          style={{
            transform: `scale(${mix(0.85, 1, p3)})`,
            opacity: p3,
          }}
        >
          <span className="flow-node-title">سود ناخالص خالص</span>
          <span className="flow-node-amount green">
            {new Intl.NumberFormat('fa-IR').format(Math.round(grossProfit * 1000))}
          </span>
          <span className="flow-node-pct">۴۰٪ مارجین واقعی</span>
        </div>
      </div>
    </div>
  )
}

// ─── 7. Daylight Editorial Paper Canvas ───────────────────────────────────

export function DaylightEditorialCanvas({
  headline,
  category,
  points,
  t,
}: {
  headline: string
  category: string
  points: { label: string; value: string }[]
  t: number
}) {
  const pHead = ease(progress(t, 0.2, 0.7))

  return (
    <div className="daylight-editorial-box">
      <div className="daylight-rule-top" />
      <div className="daylight-category-tag">
        <span className="tag-dot" /> {category}
      </div>

      <div
        className="daylight-headline"
        style={{
          transform: `translateY(${mix(20, 0, pHead)}px)`,
          opacity: pHead,
        }}
      >
        <Rich text={headline} />
      </div>

      <div className="daylight-rule-mid" />

      <div className="daylight-stats-grid">
        {points.map((pt, i) => {
          const p = ease(progress(t, 0.8 + i * 0.35, 0.6))
          return (
            <div
              key={i}
              className="daylight-stat-col"
              style={{
                transform: `translateY(${mix(15, 0, p)}px)`,
                opacity: p,
              }}
            >
              <div className="daylight-stat-val">{pt.value}</div>
              <div className="daylight-stat-lbl">{pt.label}</div>
            </div>
          )
        })}
      </div>
      <div className="daylight-watermark">H I S A B C H E</div>
    </div>
  )
}
