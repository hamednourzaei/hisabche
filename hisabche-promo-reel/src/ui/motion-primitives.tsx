// ============================================
// Motion primitives — rebuilt as film elements, not a website dashboard.
//
// The old vocabulary (traffic lights, browser titlebars, sidebar icons,
// glass cards, gradient charts, floating toasts, mouse cursors) made the
// reels look like a screenshot of a SaaS landing page. Every export below
// keeps its exact signature and CSS class hooks, but the drawing is now:
// cropped product fragments, hairline rules, stroked data marks, and one
// restrained accent per frame.
//
// Rules: 9, 16, 33, 51-60, 61-70, 98, 99.
// ============================================

import type { CSSProperties } from 'react'

import { ease, enter, progress, pulse, strokeDraw } from '../engine/anim'
import type { Tone } from '../engine/types'
import { ACCENT, MATERIAL, faNumber } from './art-direction'
import { Badge, TONE } from './card'
import { Icon } from './icons'
import { Rich } from './rich'

export { faNumber }

/** An unknown value is rendered as text, never silently coerced to a number. */
export const isUnknownValue = (value?: string) =>
  !!value && (value.includes('نامعلوم') || value.includes('؟؟؟') || value.includes('نا مشخص'))

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
  const c = TONE[tone]
  return (
    <div className="kinetic-words-wrap" style={{ direction: 'rtl' }}>
      {words.map((word, i) => {
        const at = startAt + i * gap
        const s = ease(progress(t, at, 0.38))
        const landed = progress(t, at + 0.38, 0.6)
        // Continuous micro-motion after entrance: a slow breath so a revealed
        // word is never a frozen slide element (soak-safe, no spring on type).
        const breath = 1 + 0.012 * Math.sin((t - at) * 1.8 + i * 0.7) * landed
        const drift = Math.sin((t - at) * 1.1 + i * 0.55) * 1.4 * landed
        const isLast = i === words.length - 1
        return (
          <span
            key={i}
            className={`kinetic-word ${isLast ? 'kinetic-highlight' : ''}`}
            data-mg-kinetic={isLast ? 'focal' : 'support'}
            style={{
              display: 'inline-block',
              opacity: s,
              transform: `translate3d(0, ${((1 - s) * 22 + drift).toFixed(2)}px, 0) scale(${(0.94 + 0.06 * s) * breath})`,
              color: isLast ? c.solid : MATERIAL.ink,
              borderBottom: isLast ? `2px solid ${c.solid}` : 'none',
              paddingBottom: isLast ? 2 : 0,
              willChange: 'transform, opacity',
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
  const val = from + (to - from) * p
  return (
    <span
      className={`tabular ${className}`}
      style={{ ...style, opacity: 1, fontVariantNumeric: 'tabular-nums' }}
    >
      {faNumber(val)} {unit}
    </span>
  )
}

/**
 * Numeric Continuity Primitive. Once introduced, the number never blinks;
 * it morphs from one value to the next on a single continuous timeline.
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
  const started = t >= startAt
  const current =
    t >= transformAt ? fromVal + (toVal - fromVal) * ease(progress(t, transformAt, dur)) : fromVal
  return (
    <span
      className={`tabular numeric-transform ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        color: TONE[tone].solid,
        opacity: started ? 1 : 0,
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      <span>{faNumber(current)}</span>
      {unit && <span style={{ fontSize: '0.45em', opacity: 0.9 }}>{unit}</span>}
    </span>
  )
}

// ─── Cropped product evidence (no browser chrome) ────────────────────────

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
  const c = TONE[tone]
  const winEnter = enter(t, startAt, { y: 30, scale: 0.98 })
  // The "camera" hook is retained for QA; the actual motion is a scan sweep,
  // never a push-in zoom (Hard Rule 11.9 — stage scale stays 1.0).
  const sweep = ((t - startAt) % 3.4) / 3.4
  const sweepY = 60 + sweep * 300
  return (
    <div
      className="mockup-window"
      data-ui-camera="push-in"
      data-mg-evidence="desktop-fragment"
      style={{
        ...winEnter,
        width: '100%',
        boxSizing: 'border-box',
        background: MATERIAL.panel,
        border: `1px solid ${MATERIAL.panelEdge}`,
        borderInlineStart: `3px solid ${c.solid}`,
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: '0 28px 60px rgba(0,0,0,0.62)',
        position: 'relative',
      }}
    >
      <div
        className="window-titlebar"
        style={{ padding: '10px 14px', borderBottom: `1px solid ${MATERIAL.panelEdge}` }}
      >
        <div
          className="window-title-text"
          style={{ display: 'flex', gap: 8, color: MATERIAL.muted, fontSize: 13 }}
        >
          <Icon name="receipt" size={14} /> {title}
        </div>
        <div
          className="window-pill"
          style={{
            color: c.solid,
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Hisabche
        </div>
      </div>
      <div className="window-body" style={{ position: 'relative', minHeight: 360 }}>
        <div className="window-content" style={{ padding: '14px 16px' }}>
          <div
            className="window-content-header"
            style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}
          >
            <span className="content-heading" style={{ color: MATERIAL.ink, fontWeight: 800 }}>
              {header}
            </span>
            <span className="status-badge live" style={{ color: c.solid, fontSize: 11 }}>
              ●
            </span>
          </div>
          <div className="window-rows" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((it, i) => {
              const rowEnter = enter(t, startAt + 0.4 + i * 0.12, { y: 12, scale: 1 })
              return (
                <div
                  key={i}
                  className="window-row"
                  style={{
                    ...rowEnter,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    paddingBottom: 6,
                    borderBottom: `1px solid ${MATERIAL.panelEdge}`,
                  }}
                >
                  <div className="row-col-main" style={{ display: 'flex', gap: 8 }}>
                    <span className="row-name" style={{ color: MATERIAL.ink }}>
                      {it.name}
                    </span>
                    {it.qty && (
                      <span className="row-qty" style={{ color: MATERIAL.muted }}>
                        {it.qty}
                      </span>
                    )}
                  </div>
                  <div className="row-col-end" style={{ display: 'flex', gap: 8 }}>
                    <span className="row-price" style={{ color: c.solid, fontWeight: 800 }}>
                      {it.price}
                    </span>
                    {it.badge && (
                      <span className="row-tag" style={{ color: MATERIAL.muted, fontSize: 11 }}>
                        {it.badge}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {totalLabel && (
            <div
              className="window-total-bar"
              style={{
                ...enter(t, startAt + 0.4 + items.length * 0.12 + 0.2),
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 14,
                paddingTop: 10,
                borderTop: `2px solid ${c.solid}`,
              }}
            >
              <span className="total-label" style={{ color: MATERIAL.muted }}>
                {totalLabel}
              </span>
              <span className="total-val" style={{ color: c.solid, fontWeight: 900 }}>
                {totalValue}
              </span>
            </div>
          )}
        </div>
        <div
          aria-hidden
          data-mg-scan
          style={{
            position: 'absolute',
            insetInlineStart: 0,
            insetInlineEnd: 0,
            top: sweepY,
            height: 2,
            background: c.solid,
            opacity: 0.35,
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  )
}

/** A cropped receipt panel — not a full phone with notch and status bar. */
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
  const c = TONE[tone]
  const phoneEnter = enter(t, startAt, { y: 34, scale: 0.98 })
  const sweep = pulse(t, startAt + 0.6, startAt + 2.4, 1.2)
  return (
    <div
      className="mockup-phone"
      data-ui-camera="push-in"
      data-mg-evidence="receipt-fragment"
      style={{
        ...phoneEnter,
        width: '100%',
        maxWidth: 320,
        boxSizing: 'border-box',
        background: MATERIAL.panel,
        border: `1px solid ${MATERIAL.panelEdge}`,
        borderTop: `3px solid ${c.solid}`,
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: '0 28px 60px rgba(0,0,0,0.62)',
      }}
    >
      <div className="phone-screen" style={{ padding: '16px 18px' }}>
        <div
          className="phone-header"
          style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}
        >
          <span className="phone-app-title" style={{ color: MATERIAL.ink, fontWeight: 800 }}>
            {title}
          </span>
          <span className="phone-tag" style={{ color: c.solid, fontSize: 11 }}>
            ●
          </span>
        </div>
        <div
          className="phone-scanner-box"
          style={{
            position: 'relative',
            padding: '18px 0',
            borderBlock: `1px solid ${MATERIAL.panelEdge}`,
            textAlign: 'center',
          }}
        >
          <Icon name="barcode" size={30} />
          <div
            className="scanner-line"
            style={{
              position: 'absolute',
              insetInlineStart: 0,
              insetInlineEnd: 0,
              top: `${sweep * 100}%`,
              height: 2,
              background: c.solid,
              opacity: sweep > 0.05 ? 0.55 : 0,
            }}
          />
          <span
            className="scanner-hint"
            style={{ display: 'block', color: MATERIAL.muted, fontSize: 11, marginTop: 6 }}
          >
            اسکن لحظهای بارکد
          </span>
        </div>
        <div
          className="phone-list"
          style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}
        >
          {items.map((it, i) => (
            <div
              key={i}
              className="phone-item"
              style={{
                ...enter(t, startAt + 0.7 + i * 0.12, { y: 10, scale: 1 }),
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div className="phone-item-name" style={{ color: MATERIAL.ink }}>
                  {it.name}
                </div>
                {it.qty && (
                  <div className="phone-item-qty" style={{ color: MATERIAL.muted, fontSize: 11 }}>
                    {it.qty}
                  </div>
                )}
              </div>
              <div className="phone-item-price" style={{ color: c.solid, fontWeight: 700 }}>
                {it.price}
              </div>
            </div>
          ))}
        </div>
        {totalLabel && (
          <div
            className="phone-footer-total"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 14,
              paddingTop: 10,
              borderTop: `2px solid ${c.solid}`,
            }}
          >
            <span style={{ color: MATERIAL.muted }}>{totalLabel}</span>
            <span style={{ color: c.solid, fontWeight: 900 }}>{totalValue}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Data as stroke, not a dashboard chart ───────────────────────────────

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
  const max = Math.max(...data.map((d) => d.value)) * 1.1 || 100
  const points = data.map((d, i) => ({
    x: 30 + (i / (n - 1)) * (W - 60),
    y: H - 30 - (d.value / max) * (H - 60),
  }))
  let line = `M ${points[0]!.x} ${points[0]!.y}`
  for (let i = 0; i < n - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const cp = a.x + (b.x - a.x) * 0.5
    line += ` C ${cp} ${a.y}, ${cp} ${b.y}, ${b.x} ${b.y}`
  }
  const stroke = strokeDraw(t, startAt, dur, 1600)
  const p = ease(progress(t, startAt, dur))
  const c = TONE[tone]
  const last = points[n - 1]!
  return (
    <div className="chart-svg-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" aria-hidden>
        <path
          d={line}
          fill="none"
          stroke={c.solid}
          strokeWidth={3}
          strokeLinecap="round"
          style={stroke}
        />
        {points.map((pt, i) => (
          <g key={i} style={enter(t, startAt + (i / n) * dur, { scale: 0.4, y: 0 })}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r={i === n - 1 ? 6 : 3}
              fill={MATERIAL.void}
              stroke={c.solid}
              strokeWidth={2}
            />
          </g>
        ))}
        <text x={last.x} y={H - 8} fill={c.solid} fontSize={12} textAnchor="middle" opacity={p}>
          {data[n - 1]!.label}
        </text>
      </svg>
    </div>
  )
}

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
  const H = 150
  const c = TONE[tone]
  return (
    <div className="barchart-wrap" style={{ borderBottom: `1px solid ${MATERIAL.panelEdge}` }}>
      {data.map((d, i) => {
        const at = startAt + i * gap
        const p = ease(progress(t, at, 0.6))
        return (
          <div
            key={i}
            className="barchart-col"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
          >
            <span className="bar-val" style={{ opacity: p, color: c.solid, fontSize: 12 }}>
              {faNumber(Math.round(d.value * p))}
            </span>
            <div
              className="bar-track"
              style={{ width: 26, height: H, display: 'flex', alignItems: 'flex-end' }}
            >
              <div
                className="bar-fill"
                style={{
                  width: '100%',
                  height: (d.value / max) * H * p,
                  background: c.solid,
                  opacity: 0.85,
                }}
              />
            </div>
            <span className="bar-label" style={{ color: MATERIAL.muted, fontSize: 11 }}>
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Supporting marks ────────────────────────────────────────────────────

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
  const s = enter(t, at, { y: -14, scale: 0.94 })
  const c = TONE[tone]
  return (
    <div
      className="floating-toast"
      data-mg-toast
      style={{
        ...s,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px 8px 8px',
        background: MATERIAL.panel,
        borderInlineStart: `2px solid ${c.solid}`,
        color: MATERIAL.ink,
        boxShadow: '0 14px 32px rgba(0,0,0,0.5)',
      }}
    >
      <Badge icon={icon} tone={tone} size={28} />
      <span>{text}</span>
    </div>
  )
}

/** A focus reticle — a motion-graphic attention mark, not a mouse pointer. */
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
  const isHit = t >= clickAt && t < clickAt + 0.6
  const ripple = isHit ? pulse(t, clickAt, clickAt + 0.6, 0.6) : 0
  const c = ACCENT.cyan
  return (
    <div
      className="interactive-cursor"
      data-mg-reticle
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 28,
        height: 28,
        pointerEvents: 'none',
      }}
    >
      <svg width={28} height={28} viewBox="0 0 28 28" fill="none" aria-hidden>
        <circle cx={14} cy={14} r={8} stroke={c.solid} strokeWidth={1.5} fill="none" />
        <path d="M14 1V6 M14 22V27 M1 14H6 M22 14H27" stroke={c.solid} strokeWidth={1.5} />
        <circle cx={14} cy={14} r={1.5} fill={c.solid} />
      </svg>
      {isHit && (
        <span
          className="cursor-ripple"
          style={{
            position: 'absolute',
            inset: 0,
            border: `1px solid ${c.solid}`,
            borderRadius: '50%',
            transform: `scale(${1 + ripple * 2})`,
            opacity: 1 - ripple,
          }}
        />
      )}
    </div>
  )
}
