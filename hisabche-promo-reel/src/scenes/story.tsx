// CTA and the story scenes: pile, versus, ledger, queue, day.

import { clamp, enter, ease, mix, progress, pulse, spring } from '../engine/anim'
import type { Cue, SceneSpec } from '../engine/types'
import { Badge, Card, TONE } from '../ui/card'
import { Icon } from '../ui/icons'
import { Rich } from '../ui/rich'

type Spec<K extends SceneSpec['kind']> = Extract<SceneSpec, { kind: K }>

const faNumber = (n: number) => new Intl.NumberFormat('fa-IR').format(Math.round(n))

// ─── CTA ─────────────────────────────────────────────────────────────────

const CTA = { logo: 0.2, box1: 1.0, box2: 1.4, footer: 1.8 }

export function Cta({ spec, t }: { spec: Spec<'cta'>; t: number }) {
  const logo = spring(t - CTA.logo)
  const second = t >= spec.switchAt
  return (
    <div className="scene">
      <div
        className="logo"
        style={{ opacity: clamp(logo), transform: `scale(${0.6 + 0.4 * logo})` }}
      >
        <div className="logo-emblem">
          <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
            <defs>
              <linearGradient id="emblem" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
            <rect
              x="12"
              y="10"
              width="40"
              height="44"
              rx="8"
              fill="none"
              stroke="url(#emblem)"
              strokeWidth="3"
            />
            <path
              d="M20 22h24M20 32h16M20 42h20"
              stroke="url(#emblem)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="46" cy="42" r="4" fill="#22d3ee" />
          </svg>
        </div>
        <div className="logo-name">Hisabche</div>
        <div className="logo-sub">{spec.tagline}</div>
      </div>
      {spec.boxes.map((box, i) => {
        const active = i === 0 ? !second : second
        const from = i === 0 ? CTA.box1 : spec.switchAt
        const to = i === 0 ? spec.switchAt : 1e9
        const glow = active ? 0.55 + 0.45 * pulse(t, from, to) : 0.25
        // CTA pulse: the box being offered breathes — an invitation, not a slide.
        const pulseScale = active ? 1 + 0.022 * pulse(t, from, to, 1.2) : 1
        const entered = enter(t, i === 0 ? CTA.box1 : CTA.box2, { y: 40 })
        return (
          <Card
            key={i}
            tone={box.tone}
            glow={glow}
            className="cta-box"
            style={{
              top: 470 + i * 170,
              ...entered,
              transform: `${entered.transform ?? ''} scale(${pulseScale.toFixed(4)})`,
              // The box not being talked about dims to half, as in the reference.
              opacity: Number(entered.opacity) * (active ? 1 : 0.5),
            }}
          >
            <div className="cta-text">
              <div className="muted">{box.lead}</div>
              <div className="cta-action">
                {box.action}{' '}
                <span
                  style={{
                    color: TONE[box.tone].solid,
                    textShadow: `0 0 12px ${TONE[box.tone].glow}`,
                  }}
                >
                  {box.word}
                </span>
              </div>
            </div>
            <span className="cta-icon" style={{ color: TONE[box.tone].solid }}>
              <Icon name="chat" size={30} />
            </span>
          </Card>
        )
      })}
      <div className="footer" style={enter(t, CTA.footer, { y: 10 })}>
        h i s a b c h e . c o m
      </div>
    </div>
  )
}

export const ctaCues = (spec: Spec<'cta'>): Cue[] => [
  { at: CTA.box1, kind: 'success' },
  { at: spec.switchAt, kind: 'pop' },
]

// ─── Pile: the same sale written in many places ──────────────────────────

const PILE = { title: 0.1, papers: 0.6, gap: 0.55 }

export function Pile({ spec, t }: { spec: Spec<'pile'>; t: number }) {
  const n = spec.papers.length
  const mergeAt = PILE.papers + n * PILE.gap + 1.4
  const merge = ease(progress(t, mergeAt, 0.7))
  const count = Math.min(n, Math.max(0, Math.floor((t - PILE.papers) / PILE.gap) + 1))
  return (
    <div className="scene">
      <div className="title-block" style={{ top: 100 }}>
        <div className="title" style={enter(t, PILE.title)}>
          <Rich text={spec.title} />
        </div>
      </div>
      {spec.papers.map((paper, i) => {
        const angle = (i - (n - 1) / 2) * 7
        const s = spring(t - (PILE.papers + i * PILE.gap))
        const y = mix(-300, 300 + i * 26, s)
        return (
          <Card
            key={i}
            tone={i % 2 ? 'purple' : 'red'}
            glow={0.5}
            className="paper"
            style={{
              top: mix(y, 420, merge),
              left: 120 + (i % 2) * 40,
              opacity: clamp(s * 3) * (1 - merge),
              transform: `rotate(${angle * (1 - merge)}deg) scale(${1 - 0.5 * merge})`,
            }}
          >
            <Icon name={paper.icon} size={22} />
            <span>{paper.label}</span>
          </Card>
        )
      })}
      <div className="counter" style={{ opacity: count > 0 ? 1 - merge : 0 }}>
        <Rich text={spec.counter.replace('{n}', faNumber(count))} />
      </div>
      <Card
        tone="cyan"
        className="merged"
        style={{ top: 420, ...enter(t, mergeAt + 0.4, { scale: 0.5, y: 0 }) }}
      >
        <Badge icon="receipt" tone="cyan" size={48} />
        <span className="merged-title hl-gradient">{spec.merge}</span>
      </Card>
    </div>
  )
}

export const pileCues = (spec: Spec<'pile'>): Cue[] => {
  const n = spec.papers.length
  return [
    ...spec.papers.map((_, i) => ({ at: PILE.papers + i * PILE.gap, kind: 'tick' as const })),
    { at: PILE.papers + n * PILE.gap + 1.4, kind: 'whoosh' },
    { at: PILE.papers + n * PILE.gap + 1.8, kind: 'cash' },
  ]
}

import { getOpticalFontSize, shouldStackCards, splitTitleSubtitle } from '../ui/typography'

// ─── Versus: two numbers that should agree and do not ────────────────────

const VERSUS = { title: 0.1, left: 0.7, right: 1.2, verdict: 2.0 }

export function Versus({ spec, t }: { spec: Spec<'versus'>; t: number }) {
  const isStacked =
    shouldStackCards(spec.left.value, spec.right.value) ||
    spec.left.label.length > 22 ||
    spec.right.label.length > 22 ||
    spec.left.label.split(/\s+/).length > 4 ||
    spec.right.label.split(/\s+/).length > 4

  // In stacked mode, present the red/problem card first, then the cyan/solution card
  const stackedSides = [spec.left, spec.right].sort((a, b) =>
    a.tone === 'red' ? -1 : b.tone === 'red' ? 1 : 0,
  )

  // Opposition physics: the two sides lean/push toward each other and keep a slow
  // counter-sway — the versus is a relationship, not two static cards.
  const oppose = ease(progress(t, VERSUS.verdict - 0.8, 1.2))
  const sway = Math.sin(t * 1.5) * 1.6

  return (
    <div
      className={`scene versus-scene ${isStacked ? 'versus-stacked-mode' : 'versus-columns-mode'}`}
      data-motion="opposition"
    >
      <div className="title-block versus-title-block" style={{ top: 85, insetInline: 20 }}>
        <div className="title versus-title" style={enter(t, VERSUS.title)}>
          <Rich text={spec.title} />
        </div>
      </div>

      {isStacked ? (
        // Stacked Full-Width Horizontal Cards (Adaptive Layout for Long Copy)
        <div
          className="versus-stacked-cards-wrap"
          style={{
            position: 'absolute',
            top: 220,
            insetInline: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {stackedSides.map((side, i) => {
            const split = splitTitleSubtitle(side.value)
            const iconName = side.tone === 'red' ? 'trash' : 'check'
            const animTime = i === 0 ? VERSUS.left : VERSUS.right
            const entered = enter(t, animTime, { y: 25 })
            const opposing = (i === 0 ? 1 : -1) * (5 * oppose + sway)
            return (
              <Card
                key={i}
                tone={side.tone}
                className="versus-stacked-card"
                style={{
                  width: '100%',
                  minHeight: 110,
                  padding: '22px 24px',
                  borderRadius: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  boxSizing: 'border-box',
                  ...entered,
                  transform: `${entered.transform ?? ''} translateX(${opposing.toFixed(2)}px)`,
                }}
              >
                <div
                  className={`versus-stacked-icon-badge ${side.tone}`}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: TONE[side.tone].soft,
                    border: `1.5px solid ${TONE[side.tone].solid}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: TONE[side.tone].solid,
                    boxShadow: `0 0 20px ${TONE[side.tone].glow}`,
                    flexShrink: 0,
                  }}
                >
                  <Icon name={iconName} size={24} />
                </div>
                <div
                  style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: TONE[side.tone].solid,
                        background: 'rgba(0,0,0,0.35)',
                        border: `1px solid ${TONE[side.tone].solid}44`,
                        padding: '3px 10px',
                        borderRadius: 6,
                        letterSpacing: '0.02em',
                      }}
                    >
                      {side.label}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: '#ffffff',
                      lineHeight: 1.5,
                      textWrap: 'balance',
                    }}
                  >
                    {split.title}
                  </div>
                  {split.subtitle ? (
                    <div
                      style={{
                        fontSize: 14,
                        color: 'rgba(203, 213, 225, 0.88)',
                        lineHeight: 1.7,
                        textWrap: 'balance',
                      }}
                    >
                      {split.subtitle}
                    </div>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        // Side-by-Side 2-Column Cards with Strict 3-Part Card Anatomy
        <div
          className="row-cards versus-row-cards"
          style={{ top: 280, insetInline: 20, display: 'flex', justifyContent: 'center', gap: 16 }}
        >
          {[spec.right, spec.left].map((side, i) => {
            const fontCfg = getOpticalFontSize(side.value, 'card-half')
            const iconName = side.tone === 'red' ? 'trash' : 'check'
            const entered = enter(t, i ? VERSUS.left : VERSUS.right, { y: 35 })
            const lean = (i === 0 ? -1 : 1) * (4 * oppose + 0.6 * sway)
            const converge = (i === 0 ? -1 : 1) * 7 * oppose
            return (
              <Card
                key={i}
                tone={side.tone}
                className="square versus-card"
                style={{
                  width: 236,
                  minHeight: 230,
                  padding: '24px 20px',
                  borderRadius: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 14,
                  boxSizing: 'border-box',
                  ...entered,
                  transform: `${entered.transform ?? ''} perspective(760px) rotateY(${lean.toFixed(2)}deg) translateX(${converge.toFixed(2)}px)`,
                }}
              >
                {/* 1. Top Header Pill / Icon Badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: TONE[side.tone].soft,
                    padding: '4px 12px',
                    borderRadius: 8,
                    border: `1px solid ${TONE[side.tone].solid}44`,
                  }}
                >
                  <Icon name={iconName} size={14} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: TONE[side.tone].solid }}>
                    {side.label}
                  </span>
                </div>

                {/* 2. Center Focal Hook */}
                <div
                  className="big-number versus-big-number"
                  style={{
                    color: TONE[side.tone].solid,
                    fontSize: fontCfg.fontSize,
                    lineHeight: fontCfg.lineHeight,
                    fontWeight: fontCfg.fontWeight,
                    textWrap: 'balance',
                    textAlign: 'center',
                    paddingInline: 8,
                  }}
                >
                  {side.value}
                </div>

                {/* 3. Bottom Indicator */}
                <div
                  style={{
                    width: 36,
                    height: 3,
                    borderRadius: 2,
                    background: TONE[side.tone].solid,
                    opacity: 0.6,
                  }}
                />
              </Card>
            )
          })}
        </div>
      )}

      {/* Balanced Verdict Glass Footer Pill (Eliminates Single-Word Orphans) */}
      <div
        className="versus-verdict-wrap"
        style={{
          position: 'absolute',
          top: isStacked ? 530 : 560,
          insetInline: 20,
          display: 'flex',
          justifyContent: 'center',
          ...enter(t, VERSUS.verdict, { y: 25 }),
        }}
      >
        <div
          className="versus-verdict-pill"
          style={{
            maxWidth: '88%',
            padding: '16px 24px',
            borderRadius: 16,
            background: 'rgba(15, 12, 28, 0.88)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            textAlign: 'center',
          }}
        >
          <span style={{ color: '#22d3ee', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Icon name="check" size={20} />
          </span>
          <span
            style={{
              fontSize: 15.5,
              fontWeight: 700,
              lineHeight: 1.75,
              color: 'rgba(241, 245, 249, 0.95)',
              textWrap: 'balance',
            }}
          >
            <Rich text={spec.verdict} />
          </span>
        </div>
      </div>
    </div>
  )
}

export const versusCues = (spec?: Spec<'versus'>): Cue[] => [
  { at: VERSUS.left, kind: spec?.left.tone === 'red' ? 'alert' : 'tick' },
  { at: VERSUS.right, kind: spec?.right.tone === 'red' ? 'alert' : 'tick' },
  { at: VERSUS.verdict, kind: 'impact' },
]

// ─── Ledger: a customer's account settling in front of you ───────────────

const LEDGER = { title: 0.1, card: 0.5, lines: 1.1, gap: 0.5 }

export function Ledger({ spec, t }: { spec: Spec<'ledger'>; t: number }) {
  const countAt = LEDGER.lines + spec.lines.length * LEDGER.gap + 0.2
  const p = ease(progress(t, countAt, 1.6))
  const balance = mix(spec.balanceFrom, spec.balanceTo, p)
  return (
    <div className="scene">
      <div className="title-block" style={{ top: 90 }}>
        <div className="title" style={enter(t, LEDGER.title)}>
          <Rich text={spec.title} />
        </div>
      </div>
      <Card tone="cyan" className="big" style={{ top: 220, ...enter(t, LEDGER.card, { y: 60 }) }}>
        <div className="big-header">
          <span className="muted">حساب مشتری</span>
          <span className="ledger-name">
            <Icon name="user" size={18} /> {spec.name}
          </span>
        </div>
        <div className="rows">
          {spec.lines.map((line, i) => (
            <div
              key={i}
              className="row spread"
              style={enter(t, LEDGER.lines + i * LEDGER.gap, { y: 20 })}
            >
              <span>{line.label}</span>
              <span className="tabular">{line.amount}</span>
            </div>
          ))}
        </div>
        <div className="balance" style={enter(t, countAt - 0.2, { y: 10 })}>
          <span className="muted">مانده</span>
          <span
            className="balance-value"
            style={{
              color: p >= 1 ? TONE.green.solid : TONE.cyan.solid,
              paddingInline: 8,
            }}
          >
            {faNumber(balance)} {spec.unit}
          </span>
        </div>
      </Card>
      <div className="title-block" style={{ top: 760 }}>
        <div className="subtitle" style={enter(t, countAt + 1.8)}>
          <Rich text={spec.footer} />
        </div>
      </div>
    </div>
  )
}

export const ledgerCues = (spec: Spec<'ledger'>): Cue[] => {
  const countAt = LEDGER.lines + spec.lines.length * LEDGER.gap + 0.2
  return [
    ...spec.lines.map((_, i) => ({ at: LEDGER.lines + i * LEDGER.gap, kind: 'pop' as const })),
    { at: countAt + 1.6, kind: 'success' },
  ]
}

// ─── Queue: invoices while the internet is down, then the sync ───────────

const QUEUE = { title: 0.1, banner: 0.5, items: 1.1, gap: 0.7 }

export function Queue({ spec, t }: { spec: Spec<'queue'>; t: number }) {
  const online = t >= spec.reconnectAt
  const queued = spec.items.filter((_, i) => t >= QUEUE.items + i * QUEUE.gap).length
  const sent = online
    ? Math.min(spec.items.length, Math.floor((t - spec.reconnectAt) / 0.35) + 1)
    : 0
  return (
    <div className="scene">
      <div className="title-block" style={{ top: 90 }}>
        <div className="title" style={enter(t, QUEUE.title)}>
          <Rich text={spec.title} />
        </div>
      </div>
      <Card
        tone={online ? 'green' : 'red'}
        className="banner"
        style={{ top: 210, ...enter(t, QUEUE.banner, { y: -20 }) }}
      >
        <Icon name={online ? 'sync' : 'offline'} size={22} />
        <span>{online ? spec.syncedLabel : spec.offlineLabel}</span>
        <span className="banner-count">{faNumber(Math.max(0, queued - sent))}</span>
      </Card>
      <div className="queue">
        {spec.items.map((item, i) => {
          const isSent = i < sent
          const away = isSent ? ease(progress(t, spec.reconnectAt + i * 0.35, 0.4)) : 0
          return (
            <Card
              key={i}
              tone={isSent ? 'green' : 'purple'}
              glow={0.5}
              className="queue-item"
              style={{
                ...enter(t, QUEUE.items + i * QUEUE.gap, { y: 30 }),
                ...(isSent
                  ? { transform: `translateY(${-40 * away}px)`, opacity: 1 - 0.6 * away }
                  : {}),
              }}
            >
              <Icon name={isSent ? 'check' : 'receipt'} size={20} />
              <span>{item}</span>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export const queueCues = (spec: Spec<'queue'>): Cue[] => [
  ...spec.items.map((_, i) => ({ at: QUEUE.items + i * QUEUE.gap, kind: 'pop' as const })),
  { at: spec.reconnectAt, kind: 'whoosh' },
  { at: spec.reconnectAt + spec.items.length * 0.35, kind: 'success' },
]

// ─── Day: a working day, hour by hour with premium analog clock ─────────

const DAY = { title: 0.1, first: 0.8 }

function parseTimeToHours(timeStr: string): { hour: number; minute: number; totalH: number } {
  const normalized = timeStr.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  const parts = normalized.split(':').map((p) => parseInt(p, 10))
  const hour = isNaN(parts[0]) ? 0 : parts[0]
  const minute = isNaN(parts[1]) ? 0 : parts[1]
  const totalH = (hour % 12) + minute / 60
  return { hour, minute, totalH }
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg % 360) * Math.PI) / 180
  return {
    x: cx + r * Math.sin(rad),
    y: cy - r * Math.cos(rad),
  }
}

function describeClockArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const sweep = endAngle - startAngle
  if (sweep <= 0.5) return ''
  const clampedSweep = Math.min(sweep, 359.9)
  const start = polarToXY(cx, cy, r, startAngle)
  const end = polarToXY(cx, cy, r, startAngle + clampedSweep)
  const largeArcFlag = clampedSweep > 180 ? 1 : 0
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

export function Day({ spec, t }: { spec: Spec<'day'>; t: number }) {
  const moments = spec.moments
  const n = moments.length
  const gap = spec.interval ?? 2.3
  const firstAt = DAY.first

  // Monotonically increasing forward angles so hands always sweep clockwise
  const angles = moments.reduce<number[]>((acc, m, idx) => {
    const { totalH } = parseTimeToHours(m.time)
    const baseAngle = totalH * 30
    if (idx === 0) {
      acc.push(baseAngle)
    } else {
      const prev = acc[idx - 1]
      const prevMod = prev % 360
      let diff = (baseAngle - prevMod) % 360
      if (diff <= 0) diff += 360
      acc.push(prev + diff)
    }
    return acc
  }, [])

  // Identify active moment and interpolate clock hand
  let activeIdx = 0
  let currentHandAngle = angles[0] ?? 0
  const transitPct: number[] = new Array(Math.max(0, n - 1)).fill(0)

  for (let i = 0; i < n; i++) {
    const startT = firstAt + i * gap
    if (t >= startT) {
      activeIdx = i
    }
  }

  // Calculate hand angle and process transitions between hours
  for (let i = 0; i < n - 1; i++) {
    const transitStart = firstAt + i * gap + gap * 0.45
    const transitEnd = firstAt + (i + 1) * gap
    if (t >= transitEnd) {
      transitPct[i] = 1
      if (activeIdx > i) {
        currentHandAngle = angles[i + 1]
      }
    } else if (t >= transitStart) {
      const p = ease(progress(t, transitStart, transitEnd - transitStart))
      transitPct[i] = p
      currentHandAngle = mix(angles[i], angles[i + 1], p)
    }
  }

  const cx = 270
  const cy = 290
  const rDial = 105
  const rBezel = 114
  const activeMoment = moments[activeIdx] ?? moments[0]
  const activeTone = activeIdx % 2 ? 'purple' : 'cyan'
  const cardSpring = spring(t - (firstAt + activeIdx * gap))
  const minuteAngle = currentHandAngle * 12

  // Hour hand geometry
  const hEnd = polarToXY(cx, cy, 48, currentHandAngle)
  const hTail = polarToXY(cx, cy, 14, currentHandAngle + 180)

  // Minute hand geometry
  const mEnd = polarToXY(cx, cy, 76, minuteAngle)
  const mTail = polarToXY(cx, cy, 18, minuteAngle + 180)

  return (
    <div className="scene">
      {/* Title block */}
      <div className="title-block" style={{ top: 70 }}>
        <div className="title" style={enter(t, DAY.title)}>
          <Rich text={spec.title} />
        </div>
      </div>

      {/* Analog Clock */}
      <div className="day-clock-container" style={enter(t, 0.3, { scale: 0.85, y: -10 })}>
        <svg viewBox="0 0 540 540" width="540" height="540" style={{ overflow: 'visible' }}>
          <defs>
            <radialGradient id="clock-dial-gradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#181f33" />
              <stop offset="70%" stopColor="#0d111d" />
              <stop offset="100%" stopColor="#080a11" />
            </radialGradient>
            <linearGradient id="clock-bezel-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.8} />
              <stop offset="50%" stopColor="#818cf8" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#a855f7" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="clock-process-arc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="60%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
            <filter id="clock-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Ambient Dial Glow */}
          <circle
            cx={cx}
            cy={cy}
            r={rBezel + 14}
            fill={TONE[activeTone].glow}
            opacity={0.16 + 0.08 * pulse(t, 0, 1e9)}
          />

          {/* Bezel Outer Track */}
          <circle
            cx={cx}
            cy={cy}
            r={rBezel}
            fill="none"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth={3}
          />

          {/* Dial Face */}
          <circle
            cx={cx}
            cy={cy}
            r={rDial}
            fill="url(#clock-dial-gradient)"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={1.5}
          />

          {/* 60 Minute Track Dots & 12 Hour Ticks */}
          {Array.from({ length: 12 }).map((_, i) => {
            const hAng = i * 30
            const isCardinal = i % 3 === 0
            const p1 = polarToXY(cx, cy, isCardinal ? 90 : 94, hAng)
            const p2 = polarToXY(cx, cy, 101, hAng)
            return (
              <line
                key={i}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={isCardinal ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.35)'}
                strokeWidth={isCardinal ? 2.5 : 1.5}
                strokeLinecap="round"
              />
            )
          })}

          {/* Cardinal Numerals (12, 3, 6, 9) */}
          <text
            x={cx}
            y={cy - 74}
            fill="rgba(255,255,255,0.7)"
            fontSize={13}
            fontWeight="800"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            ۱۲
          </text>
          <text
            x={cx + 76}
            y={cy}
            fill="rgba(255,255,255,0.7)"
            fontSize={13}
            fontWeight="800"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            ۳
          </text>
          <text
            x={cx}
            y={cy + 76}
            fill="rgba(255,255,255,0.7)"
            fontSize={13}
            fontWeight="800"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            ۶
          </text>
          <text
            x={cx - 76}
            y={cy}
            fill="rgba(255,255,255,0.7)"
            fontSize={13}
            fontWeight="800"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            ۹
          </text>

          {/* Process Arcs Between Milestones */}
          {moments.slice(0, -1).map((_, i) => {
            const pct = transitPct[i] ?? 0
            if (pct <= 0.001) return null
            const fromAngle = angles[i]
            const targetAngle = angles[i + 1]
            const sweepTo = mix(fromAngle, targetAngle, pct)
            const arcPath = describeClockArc(cx, cy, rBezel, fromAngle, sweepTo)
            const tipPoint = polarToXY(cx, cy, rBezel, sweepTo)
            return (
              <g key={i}>
                <path
                  d={arcPath}
                  fill="none"
                  stroke="url(#clock-process-arc)"
                  strokeWidth={5}
                  strokeLinecap="round"
                  filter="url(#clock-glow)"
                />
                {pct < 0.99 && (
                  <circle
                    cx={tipPoint.x}
                    cy={tipPoint.y}
                    r={5.5}
                    fill="#ffffff"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    filter="url(#clock-glow)"
                  />
                )}
              </g>
            )
          })}

          {/* Milestone Hour Nodes on Clock Rim */}
          {moments.map((_, i) => {
            const baseAng = angles[i] % 360
            const nodePos = polarToXY(cx, cy, rBezel, baseAng)
            const isActive = i === activeIdx
            const isDone = i < activeIdx
            const tone = i % 2 ? 'purple' : 'cyan'

            return (
              <g key={i}>
                {isActive && (
                  <circle
                    cx={nodePos.x}
                    cy={nodePos.y}
                    r={18}
                    fill={TONE[tone].glow}
                    opacity={0.4 + 0.3 * pulse(t, 0, 1e9)}
                  />
                )}
                <circle
                  cx={nodePos.x}
                  cy={nodePos.y}
                  r={isActive ? 13 : isDone ? 9 : 7}
                  fill={isActive ? TONE[tone].solid : isDone ? '#10b981' : '#1e243b'}
                  stroke={isActive ? '#ffffff' : isDone ? '#34d399' : 'rgba(255, 255, 255, 0.3)'}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                {isActive && <circle cx={nodePos.x} cy={nodePos.y} r={4} fill="#ffffff" />}
              </g>
            )
          })}

          {/* Hour Hand */}
          <line
            x1={hTail.x}
            y1={hTail.y}
            x2={hEnd.x}
            y2={hEnd.y}
            stroke="#f8fafc"
            strokeWidth={4.5}
            strokeLinecap="round"
          />
          <line
            x1={cx}
            y1={cy}
            x2={hEnd.x}
            y2={hEnd.y}
            stroke={TONE[activeTone].solid}
            strokeWidth={2.5}
            strokeLinecap="round"
          />

          {/* Minute Hand */}
          <line
            x1={mTail.x}
            y1={mTail.y}
            x2={mEnd.x}
            y2={mEnd.y}
            stroke="#94a3b8"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <circle cx={mEnd.x} cy={mEnd.y} r={3} fill="#22d3ee" />

          {/* Center Pinion */}
          <circle cx={cx} cy={cy} r={8} fill="#181f33" stroke="#ffffff" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={3.5} fill={TONE[activeTone].solid} />
        </svg>
      </div>

      {/* Floating Pop-up Card for Active Milestone */}
      <Card
        tone={activeTone}
        glow={0.7}
        className="day-popup-card"
        style={{
          opacity: clamp(cardSpring * 2),
          transform: `translateY(${mix(24, 0, cardSpring)}px) scale(${mix(0.95, 1, cardSpring)})`,
        }}
      >
        <div className="day-popup-header">
          <div
            className="day-popup-time-badge"
            style={{
              background: `rgba(${activeTone === 'cyan' ? '34, 211, 238' : '168, 85, 247'}, 0.16)`,
              color: TONE[activeTone].solid,
              border: `1px solid ${TONE[activeTone].glow}`,
            }}
          >
            <Icon name="calendar" size={15} />
            <span>ساعت {activeMoment.time}</span>
          </div>
          <span className="day-popup-step-tag">
            گام {faNumber(activeIdx + 1)} از {faNumber(n)}
          </span>
        </div>

        <div className="day-popup-body">
          <div
            className="day-popup-icon-wrap"
            style={{
              background: `radial-gradient(circle, ${TONE[activeTone].glow}, rgba(17, 15, 32, 0.9))`,
              border: `1px solid ${TONE[activeTone].solid}`,
            }}
          >
            <Icon name={activeMoment.icon} size={28} color="#ffffff" />
          </div>
          <div className="day-popup-text">{activeMoment.text}</div>
        </div>
      </Card>

      {/* Horizontal Milestone Stepper */}
      <div className="day-stepper" style={enter(t, 0.5, { y: 20 })}>
        {moments.map((m, i) => {
          const isDone = i < activeIdx
          const isActive = i === activeIdx
          const pct = isDone ? 1 : isActive ? (transitPct[i] ?? 0.3) : 0
          const tone = i % 2 ? 'purple' : 'cyan'

          return (
            <div key={i} className="day-stepper-item">
              <div className="day-stepper-bar">
                <div
                  className="day-stepper-fill"
                  style={{
                    width: `${pct * 100}%`,
                    background: `linear-gradient(90deg, #22d3ee, ${TONE[tone].solid})`,
                  }}
                />
              </div>
              <span
                className="day-stepper-label"
                style={{
                  color: isActive ? TONE[tone].solid : isDone ? '#10b981' : 'var(--muted)',
                  fontWeight: isActive ? 800 : 600,
                }}
              >
                {m.time}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const dayCues = (spec: Spec<'day'>): Cue[] => {
  const gap = spec.interval ?? 2.3
  const firstAt = DAY.first
  const n = spec.moments.length
  const cues: Cue[] = []

  // Opening cue
  cues.push({ at: firstAt, kind: 'pop' })

  // Cues for each milestone arrival and transition sweep
  for (let i = 0; i < n - 1; i++) {
    const transitStart = firstAt + i * gap + gap * 0.45
    const transitMid = firstAt + i * gap + gap * 0.75
    const arrival = firstAt + (i + 1) * gap

    cues.push({ at: transitStart, kind: 'tick' })
    cues.push({ at: transitMid, kind: 'tick' })
    cues.push({ at: arrival, kind: 'cash' })
    cues.push({ at: arrival + 0.1, kind: 'pop' })
  }

  return cues
}
