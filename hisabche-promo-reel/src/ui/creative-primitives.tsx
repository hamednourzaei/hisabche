// ============================================
// Creative primitives — rebuilt as film apparatus, not web decoration.
// All 8 exports and signatures are frozen; the drawing language changed:
// static grain, single accents, stroked geometry, deterministic numerals.
// Rules: 21-30, 33, 51-57, 66, 98.
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
import { ACCENT, MATERIAL, faNumber, grain } from './art-direction'
import { TONE } from './card'
import { Rich } from './rich'

// ─── 1. Perspective stage & parallax ─────────────────────────────────────

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
      style={{ transform: `translateZ(${z}px) scale(${scale})`, opacity, ...style }}
    >
      {children}
    </div>
  )
}

// ─── 2. Procedural vector network ────────────────────────────────────────

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
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: i,
    x: deterministicHash(i, 1) * 480 + 30,
    y: deterministicHash(i, 2) * 560 + 100,
    r: deterministicHash(i, 3) * 3 + 2.5,
  }))
  return (
    <svg className="procedural-network-svg" viewBox="0 0 540 800" aria-hidden>
      {nodes.map((n, idx) => {
        const n2 = nodes[(idx + 1) % nodes.length]!
        const n3 = nodes[(idx + 3) % nodes.length]!
        const a = clamp((t - idx * 0.15) / 1.2)
        const b = clamp((t - idx * 0.18) / 1.2)
        return (
          <g key={n.id}>
            <line
              x1={n.x}
              y1={n.y}
              x2={mix(n.x, n2.x, a)}
              y2={mix(n.y, n2.y, a)}
              stroke={c.solid}
              strokeOpacity={0.22}
              strokeWidth={1.1}
            />
            {idx % 2 === 0 && (
              <line
                x1={n.x}
                y1={n.y}
                x2={mix(n.x, n3.x, b)}
                y2={mix(n.y, n3.y, b)}
                stroke={c.solid}
                strokeOpacity={0.12}
                strokeWidth={0.8}
                strokeDasharray="3 5"
              />
            )}
          </g>
        )
      })}
      {nodes.map((node) => {
        const beat = pulse(t, 0.5 + node.id * 0.2, 10, 2.0)
        const op = clamp(progress(t, node.id * 0.12, 0.4))
        return (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`} opacity={op}>
            <circle r={node.r * (1 + beat * 1.6)} fill={c.soft} />
            <circle r={node.r} fill={c.solid} />
          </g>
        )
      })}
    </svg>
  )
}

// ─── 3. Blueprint apparatus ──────────────────────────────────────────────

export function GeometricBlueprint({
  t,
  accentColor = ACCENT.cyan.solid,
}: {
  t: number
  accentColor?: string
}) {
  const draw1 = strokeDraw(t, 0.2, 1.8, 1200)
  const draw2 = strokeDraw(t, 0.6, 2.0, 900)
  const rot = (t * 6) % 360
  return (
    <div className="blueprint-container" aria-hidden style={grain(0.16)}>
      <svg className="blueprint-svg" viewBox="0 0 540 960">
        <path
          d="M 40 80 L 500 80 L 500 880 L 40 880 Z"
          fill="none"
          stroke={MATERIAL.panelEdge}
          strokeWidth={1}
          style={draw1}
        />
        <g stroke={accentColor} strokeWidth={1.4} opacity={0.65}>
          <path d="M 32 80 L 48 80 M 40 72 L 40 88" />
          <path d="M 492 80 L 508 80 M 500 72 L 500 88" />
          <path d="M 32 880 L 48 880 M 40 872 L 40 888" />
          <path d="M 492 880 L 508 880 M 500 872 L 500 888" />
        </g>
        <g transform={`translate(270, 480) rotate(${rot})`}>
          <circle
            r={160}
            fill="none"
            stroke={MATERIAL.panelEdge}
            strokeWidth={1.2}
            strokeDasharray="4 10"
          />
          <circle
            r={130}
            fill="none"
            stroke={accentColor}
            strokeWidth={1.2}
            strokeOpacity={0.5}
            style={draw2}
          />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1={0}
              y1={-165}
              x2={0}
              y2={-155}
              stroke={accentColor}
              strokeWidth={1.4}
              transform={`rotate(${deg})`}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}

// ─── 4. Kinetic typography mask ──────────────────────────────────────────

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
    <div className={`kinetic-mask-headline ${className}`} style={{ direction: 'rtl' }}>
      {lines.map((line, idx) => {
        const at = startAt + idx * interval
        const p = ease(progress(t, at, 0.55))
        return (
          <div key={idx} className="mask-line-wrapper" style={{ overflow: 'hidden' }}>
            <div
              className="mask-line-content"
              style={{
                clipPath: maskWipe(p, direction),
                transform: `translate3d(0, ${mix(30, 0, p)}px, 0)`,
                opacity: p,
                color: MATERIAL.ink,
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

// ─── 5. Continuous morph object ──────────────────────────────────────────

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
  const p1 = ease(progress(t, 0.4, 1.2))
  const p2 = ease(progress(t, 3.5, 1.2))
  const p3 = ease(progress(t, 7.5, 1.2))
  const p4 = ease(progress(t, 11.5, 1.2))
  const rot = (t * 20) % 360
  const beat = pulse(t, 0, 15, 1.6)
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
        <g opacity={1 - p2}>
          <circle
            cx={100}
            cy={100}
            r={mix(20, 75, p1)}
            fill="none"
            stroke={c.solid}
            strokeWidth={3}
            strokeDasharray="5 9"
            transform={`rotate(${rot} 100 100)`}
          />
          <circle
            cx={100}
            cy={100}
            r={mix(10, 50, p1) * (1 + beat * 0.06)}
            fill="none"
            stroke={c.solid}
            strokeWidth={2}
            opacity={0.6}
          />
          <circle cx={100} cy={100} r={mix(4, 16, p1)} fill={c.solid} />
        </g>
        <g opacity={p2 * (1 - p3)}>
          <path
            d="M 100 35 L 155 60 L 155 110 C 155 145 100 170 100 170 C 100 170 45 145 45 110 L 45 60 Z"
            fill={c.soft}
            stroke={c.solid}
            strokeWidth={2.5}
            style={strokeDraw(t, 3.5, 1.2, 450)}
          />
          <circle cx={100} cy={95} r={14} fill={c.solid} opacity={p2} />
          <path d="M 94 95 L 106 95 L 109 125 L 91 125 Z" fill={c.solid} opacity={p2} />
        </g>
        <g opacity={p3 * (1 - p4)}>
          <path
            d="M 65 130 C 50 130 40 120 40 105 C 40 92 50 82 62 80 C 66 62 82 50 100 50 C 122 50 139 65 142 85 C 153 87 160 96 160 108 C 160 120 150 130 138 130 Z"
            fill={c.soft}
            stroke={ACCENT.purple.solid}
            strokeWidth={2.5}
            style={strokeDraw(t, 7.5, 1.2, 500)}
          />
          <path
            d="M 85 100 L 100 85 L 115 100 M 100 85 L 100 115"
            stroke={MATERIAL.ink}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={p3}
          />
        </g>
        <g opacity={p4}>
          <rect
            x={45}
            y={45}
            width={110}
            height={110}
            rx={2}
            fill={ACCENT.green.soft}
            stroke={ACCENT.green.solid}
            strokeWidth={2.5}
            style={strokeDraw(t, 11.5, 1.2, 440)}
          />
          <path
            d="M 72 100 L 92 120 L 132 75"
            fill="none"
            stroke={ACCENT.green.solid}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={strokeDraw(t, 12, 0.8, 150)}
          />
        </g>
      </svg>
    </div>
  )
}

// ─── 6. Financial flow — numbers, not dashboard chrome ───────────────────

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
  const node = (progressValue: number, color: string): CSSProperties => ({
    opacity: progressValue,
    transform: `translate3d(0, ${((1 - progressValue) * 14).toFixed(2)}px, 0)`,
    borderBottom: `2px solid ${color}`,
    paddingBottom: 6,
    color,
  })
  return (
    <div
      className="financial-flow-wrap"
      style={{ direction: 'rtl', display: 'flex', flexDirection: 'column', gap: 22 }}
    >
      <div className="flow-node flow-node-revenue" style={node(p1, ACCENT.cyan.solid)}>
        <span className="flow-node-title" style={{ color: MATERIAL.muted, fontSize: 13 }}>
          کل فروش فاکتورها
        </span>
        <span className="flow-node-amount" style={{ fontSize: 30, fontWeight: 900 }}>
          {faNumber(revenue * 1000)}
        </span>
      </div>
      <svg className="flow-pipe-svg" viewBox="0 0 400 90" aria-hidden>
        <line x1={200} y1={0} x2={200} y2={40} stroke={ACCENT.cyan.solid} strokeWidth={3} />
        <path
          d="M 200 40 C 200 65 100 60 100 90"
          fill="none"
          stroke={ACCENT.red.solid}
          strokeWidth={3}
          strokeDasharray="5 5"
        />
        <path
          d="M 200 40 C 200 65 300 60 300 90"
          fill="none"
          stroke={ACCENT.green.solid}
          strokeWidth={3}
        />
      </svg>
      <div
        className="flow-branch-row"
        style={{ display: 'flex', justifyContent: 'space-between', gap: 18 }}
      >
        <div className="flow-node flow-node-cogs" style={node(p2, ACCENT.red.solid)}>
          <span className="flow-node-title" style={{ color: MATERIAL.muted, fontSize: 12 }}>
            بهای تمامشده
          </span>
          <span className="flow-node-amount" style={{ fontSize: 24, fontWeight: 900 }}>
            {faNumber(cogs * 1000)}
          </span>
        </div>
        <div className="flow-node flow-node-profit" style={node(p3, ACCENT.green.solid)}>
          <span className="flow-node-title" style={{ color: MATERIAL.muted, fontSize: 12 }}>
            سود ناخالص خالص
          </span>
          <span className="flow-node-amount" style={{ fontSize: 24, fontWeight: 900 }}>
            {faNumber(grossProfit * 1000)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── 7. Editorial paper plate ────────────────────────────────────────────

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
  const head = ease(progress(t, 0.2, 0.7))
  return (
    <div
      className="daylight-editorial-box"
      style={{
        position: 'relative',
        background: MATERIAL.paper,
        color: MATERIAL.paperInk,
        padding: 28,
        direction: 'rtl',
      }}
    >
      <span aria-hidden style={grain(0.18)} />
      <div
        className="daylight-category-tag"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          borderBottom: `1px solid ${MATERIAL.paperInk}`,
          paddingBottom: 4,
        }}
      >
        <span
          className="tag-dot"
          style={{ width: 6, height: 6, background: MATERIAL.paperInk, display: 'inline-block' }}
        />{' '}
        {category}
      </div>
      <div
        className="daylight-headline"
        style={{
          transform: `translate3d(0, ${mix(18, 0, head)}px, 0)`,
          opacity: head,
          fontSize: 30,
          fontWeight: 900,
          marginTop: 18,
        }}
      >
        <Rich text={headline} />
      </div>
      <div
        className="daylight-stats-grid"
        style={{
          display: 'flex',
          gap: 24,
          marginTop: 24,
          borderTop: `2px solid ${MATERIAL.paperInk}`,
          paddingTop: 16,
        }}
      >
        {points.map((pt, i) => {
          const p = ease(progress(t, 0.8 + i * 0.35, 0.55))
          return (
            <div
              key={i}
              className="daylight-stat-col"
              style={{ transform: `translate3d(0, ${mix(14, 0, p)}px, 0)`, opacity: p, flex: 1 }}
            >
              <div className="daylight-stat-val" style={{ fontSize: 26, fontWeight: 900 }}>
                {pt.value}
              </div>
              <div className="daylight-stat-lbl" style={{ fontSize: 12, opacity: 0.75 }}>
                {pt.label}
              </div>
            </div>
          )
        })}
      </div>
      <div
        className="daylight-watermark"
        style={{ marginTop: 18, fontSize: 11, letterSpacing: '0.32em', opacity: 0.5 }}
      >
        H I S A B C H E
      </div>
    </div>
  )
}
