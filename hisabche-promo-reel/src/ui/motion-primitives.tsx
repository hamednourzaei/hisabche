import type { CSSProperties } from 'react'
import { ease, enter, mix, progress, pulse, spring, strokeDraw } from '../engine/anim'
import type { Tone } from '../engine/types'
import { Badge, TONE } from './card'
import { Icon } from './icons'
import { Rich } from './rich'

export const faNumber = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(n))

// ─── Kinetic Typography ──────────────────────────────────────────────────

export function KineticWords({
  words,
  t,
  startAt = 0.2,
  gap = 0.3,
  tone = 'cyan',
}: {
  words: string[]
  t: number
  startAt?: number
  gap?: number
  tone?: Tone
}) {
  return (
    <div className="kinetic-words-wrap">
      {words.map((word, i) => {
        const at = startAt + i * gap
        const s = spring(t - at)
        const o = progress(t, at, 0.25)
        const scale = mix(0.7, 1, s)
        const y = mix(40, 0, s)
        const isLast = i === words.length - 1
        return (
          <span
            key={i}
            className={`kinetic-word ${isLast ? 'kinetic-highlight' : ''}`}
            style={{
              opacity: o,
              transform: `translateY(${y}px) scale(${scale})`,
              color: isLast ? TONE[tone].solid : undefined,
              textShadow: isLast ? `0 0 24px ${TONE[tone].glow}` : undefined,
            }}
          >
            <Rich text={word} />
          </span>
        )
      })}
    </div>
  )
}

// ─── Animated Number Counter ─────────────────────────────────────────────

export function CountUp({
  from = 0,
  to,
  t,
  startAt,
  dur = 1.4,
  unit = '',
  className = '',
  style,
}: {
  from?: number
  to: number
  t: number
  startAt: number
  dur?: number
  unit?: string
  className?: string
  style?: CSSProperties
}) {
  const p = ease(progress(t, startAt, dur))
  const val = mix(from, to, p)
  return (
    <span className={`tabular ${className}`} style={{ ...style, opacity: 1 }}>
      {faNumber(val)} {unit}
    </span>
  )
}

/**
 * Hard Rule 1: Numeric Continuity Primitive.
 * Once introduced, displays continuously with zero opacity flicker.
 * Smoothly morphs from `fromVal` to `toVal` at `transformAt` without disappearing.
 */
export function NumericTransform({
  fromVal,
  toVal,
  t,
  startAt,
  transformAt,
  dur = 0.8,
  unit = '',
  tone = 'cyan',
  className = '',
  style,
}: {
  fromVal: number
  toVal: number
  t: number
  startAt: number
  transformAt: number
  dur?: number
  unit?: string
  tone?: Tone
  className?: string
  style?: CSSProperties
}) {
  const isStarted = t >= startAt
  const isTransformed = t >= transformAt

  // Before transform: holds fromVal steadily
  // During transform: smoothly interpolates to toVal
  // After transform: holds toVal steadily
  const currentVal = isTransformed
    ? mix(fromVal, toVal, ease(progress(t, transformAt, dur)))
    : fromVal

  return (
    <span
      className={`tabular numeric-transform ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '4px',
        color: TONE[tone].solid,
        opacity: isStarted ? 1 : 0,
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      <span>{faNumber(currentVal)}</span>
      {unit && <span style={{ fontSize: '0.45em', opacity: 0.9 }}>{unit}</span>}
    </span>
  )
}

// ─── Desktop Application Window Mockup ───────────────────────────────────

export function DesktopWindow({
  title,
  header,
  items,
  totalLabel,
  totalValue,
  t,
  startAt = 0.3,
  tone = 'cyan',
}: {
  title: string
  header: string
  items: { name: string; qty?: string; price: string; badge?: string }[]
  totalLabel?: string
  totalValue?: string
  t: number
  startAt?: number
  tone?: Tone
}) {
  const winEnter = enter(t, startAt, { y: 40, scale: 0.94 })
  return (
    <div className="mockup-window" style={winEnter}>
      <div className="window-titlebar">
        <div className="traffic-lights">
          <span className="light red" />
          <span className="light yellow" />
          <span className="light green" />
        </div>
        <div className="window-title-text">
          <Icon name="store" size={14} /> {title}
        </div>
        <div className="window-pill">Hisabche Cloud</div>
      </div>
      <div className="window-body">
        <div className="window-sidebar">
          <span className="sidebar-item active">
            <Icon name="receipt" size={18} />
          </span>
          <span className="sidebar-item">
            <Icon name="boxes" size={18} />
          </span>
          <span className="sidebar-item">
            <Icon name="user" size={18} />
          </span>
          <span className="sidebar-item">
            <Icon name="trend" size={18} />
          </span>
        </div>
        <div className="window-content">
          <div className="window-content-header">
            <span className="content-heading">{header}</span>
            <span className="status-badge live">آنلاین</span>
          </div>
          <div className="window-rows">
            {items.map((it, i) => {
              const rowEnter = enter(t, startAt + 0.5 + i * 0.25, { y: 15, scale: 0.98 })
              return (
                <div key={i} className="window-row" style={rowEnter}>
                  <div className="row-col-main">
                    <span className="row-name">{it.name}</span>
                    {it.qty && <span className="row-qty">{it.qty}</span>}
                  </div>
                  <div className="row-col-end">
                    <span className="row-price">{it.price}</span>
                    {it.badge && <span className="row-tag">{it.badge}</span>}
                  </div>
                </div>
              )
            })}
          </div>
          {totalLabel && (
            <div
              className="window-total-bar"
              style={enter(t, startAt + 0.5 + items.length * 0.25 + 0.2)}
            >
              <span className="total-label">{totalLabel}</span>
              <span className="total-val" style={{ color: TONE[tone].solid }}>
                {totalValue}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Mobile Smartphone Mockup ────────────────────────────────────────────

export function PhoneMockup({
  title,
  items,
  totalLabel,
  totalValue,
  t,
  startAt = 0.3,
  tone = 'cyan',
}: {
  title: string
  items: { name: string; qty?: string; price: string; badge?: string }[]
  totalLabel?: string
  totalValue?: string
  t: number
  startAt?: number
  tone?: Tone
}) {
  const phoneEnter = enter(t, startAt, { y: 50, scale: 0.92 })
  const scanSweep = pulse(t, startAt + 0.8, startAt + 3.2, 1.2)
  return (
    <div className="mockup-phone" style={phoneEnter}>
      <div className="phone-notch">
        <div className="dynamic-island" />
      </div>
      <div className="phone-screen">
        <div className="phone-status-bar">
          <span className="time">۰۹:۴۱</span>
          <div className="icons">
            <Icon name="sync" size={12} />
          </div>
        </div>
        <div className="phone-header">
          <span className="phone-app-title">{title}</span>
          <span className="phone-tag">صندوق سریع</span>
        </div>
        <div className="phone-scanner-box">
          <div
            className="scanner-line"
            style={{ top: `${scanSweep * 100}%`, opacity: scanSweep > 0.05 ? 1 : 0 }}
          />
          <Icon name="barcode" size={36} />
          <span className="scanner-hint">اسکن لحظه‌ای بارکد</span>
        </div>
        <div className="phone-list">
          {items.map((it, i) => (
            <div
              key={i}
              className="phone-item"
              style={enter(t, startAt + 0.9 + i * 0.2, { y: 12 })}
            >
              <div>
                <div className="phone-item-name">{it.name}</div>
                {it.qty && <div className="phone-item-qty">{it.qty}</div>}
              </div>
              <div className="phone-item-price">{it.price}</div>
            </div>
          ))}
        </div>
        {totalLabel && (
          <div className="phone-footer-total">
            <span>{totalLabel}</span>
            <span style={{ color: TONE[tone].solid, fontWeight: 800 }}>{totalValue}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SVG Area Chart (Smooth Bezier Financial Trend) ───────────────────────

export function AreaChartSvg({
  data,
  t,
  startAt = 0.5,
  dur = 1.4,
  tone = 'cyan',
}: {
  data: { label: string; value: number }[]
  t: number
  startAt?: number
  dur?: number
  tone?: Tone
}) {
  const n = data.length
  if (n < 2) return null
  const W = 460
  const H = 220
  const max = Math.max(...data.map((d) => d.value)) * 1.15 || 100
  const points = data.map((d, i) => {
    const x = 30 + (i / (n - 1)) * (W - 60)
    const y = H - 30 - (d.value / max) * (H - 60)
    return { x, y }
  })

  // Build cubic spline
  let linePath = `M ${points[0]!.x} ${points[0]!.y}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i]!
    const p1 = points[i + 1]!
    const cp1x = p0.x + (p1.x - p0.x) * 0.5
    const cp2x = cp1x
    linePath += ` C ${cp1x} ${p0.y}, ${cp2x} ${p1.y}, ${p1.x} ${p1.y}`
  }

  const areaPath = `${linePath} L ${points[n - 1]!.x} ${H - 25} L ${points[0]!.x} ${H - 25} Z`
  const strokeAnim = strokeDraw(t, startAt, dur, 1400)
  const p = ease(progress(t, startAt, dur))

  return (
    <div className="chart-svg-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TONE[tone].solid} stopOpacity={0.4} />
            <stop offset="100%" stopColor={TONE[tone].solid} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75].map((g, idx) => (
          <line
            key={idx}
            x1={25}
            y1={H - 30 - g * (H - 60)}
            x2={W - 25}
            y2={H - 30 - g * (H - 60)}
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="4 4"
          />
        ))}
        {/* Filled gradient area */}
        <path d={areaPath} fill="url(#area-grad)" opacity={p} />
        {/* Animated stroke line */}
        <path
          d={linePath}
          fill="none"
          stroke={TONE[tone].solid}
          strokeWidth={3.5}
          strokeLinecap="round"
          style={strokeAnim}
        />
        {/* Data points */}
        {points.map((pt, i) => {
          const ptEnter = enter(t, startAt + (i / n) * dur, { scale: 0.2, y: 0 })
          return (
            <g key={i} style={ptEnter}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={6}
                fill="#0d0b1a"
                stroke={TONE[tone].solid}
                strokeWidth={3}
              />
              <text x={pt.x} y={H - 10} fill="#94a3b8" fontSize={11} textAnchor="middle">
                {data[i]!.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── SVG Bar Chart ────────────────────────────────────────────────────────

export function BarChartSvg({
  data,
  t,
  startAt = 0.5,
  gap = 0.15,
  tone = 'cyan',
}: {
  data: { label: string; value: number }[]
  t: number
  startAt?: number
  gap?: number
  tone?: Tone
}) {
  const max = Math.max(...data.map((d) => d.value)) || 100
  const H = 180
  return (
    <div className="barchart-wrap">
      {data.map((d, i) => {
        const at = startAt + i * gap
        const p = ease(progress(t, at, 0.8))
        const barH = (d.value / max) * H * p
        return (
          <div key={i} className="barchart-col">
            <span className="bar-val" style={{ opacity: p }}>
              {faNumber(Math.round(d.value * p))}
            </span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  height: `${barH}px`,
                  background: `linear-gradient(180deg, ${TONE[tone].solid}, ${TONE[tone].glow})`,
                  boxShadow: `0 0 16px ${TONE[tone].glow}`,
                }}
              />
            </div>
            <span className="bar-label">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Floating Toast Notification ──────────────────────────────────────────

export function BadgeToast({
  icon,
  text,
  t,
  at,
  tone = 'green',
}: {
  icon: string
  text: string
  t: number
  at: number
  tone?: Tone
}) {
  const s = enter(t, at, { y: -20, scale: 0.85 })
  return (
    <div className="floating-toast" style={s}>
      <Badge icon={icon} tone={tone} size={32} />
      <span>{text}</span>
    </div>
  )
}

// ─── Interactive Touch/Mouse Cursor ───────────────────────────────────────

export function InteractiveCursor({
  t,
  x,
  y,
  clickAt,
}: {
  t: number
  x: number
  y: number
  clickAt: number
}) {
  const isClicked = t >= clickAt && t < clickAt + 0.6
  const ripple = isClicked ? pulse(t, clickAt, clickAt + 0.6, 0.6) : 0
  return (
    <div className="interactive-cursor" style={{ left: x, top: y }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
          fill="#22d3ee"
          stroke="#06050e"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      {isClicked && (
        <span
          className="cursor-ripple"
          style={{ transform: `scale(${1 + ripple * 2})`, opacity: 1 - ripple }}
        />
      )}
    </div>
  )
}
