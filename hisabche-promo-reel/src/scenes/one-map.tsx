// ============================================
// Reel #109 — «نقشه‌ی یکپارچه‌ی کسب‌وکار» (The One Workspace) — Pro Redesign
//
// The market's need for one comprehensive business workspace — از جامع، به حسابچه.
// The film speaks the product's own visual language:
// graphite glass surfaces, 1px hairlines, mono digits, one indigo accent and
// mint only for "recorded". Real UI states that business owners recognize:
//
//   1. FourAnswersScene (0.00–5.50s) — four tools give four conflicting answers to one question
//   2. MergeToOneScene (5.50–12.00s) — the four answers collapse into one unified glass surface
//   3. InvoiceFanoutScene (12.00–19.00s) — one invoice confirmation fans out into five connected records
//   4. SystemMapScene (19.00–26.00s) — the five records are one living, synchronized system
//   5. OneScreenScene (26.00–33.00s) — the whole business live on one executive dashboard
//   6. BrandCurtainScene (33.00–42.00s) — the quiet brand curtain: از جامع، به حسابچه
//
// Guardrails strictly honoured:
// - noZoom: true (camera stays 1.0, light and data move)
// - No decorative dividers
// - ≤ 6 on-stage words per scene (Hard Rule 14)
// - ≥ 24px safe margins on all 540x960 boundaries
// - Dark studio theme (obsidian-graphite & financial intelligence)
// - Deterministic digits (faNumber) without Intl
// - No hardcoded currency units
// - Local coordinates & overflow: hidden on panels
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, enter, mix, progress, spring, strokeDraw } from '../engine/anim'
import { faNumber, InteractiveCursor } from '../ui/motion-primitives'

// ─── Design Tokens ──────────────────────────────────────────────────────────

const INK = '#07090d'
const PANEL = '#0f131c'
const PANEL_HI = '#192130'
const HAIRLINE = 'rgba(255, 255, 255, 0.09)'
const HAIRLINE_HI = 'rgba(255, 255, 255, 0.18)'
const INDIGO = '#6c8cff'
const INDIGO_DIM = 'rgba(108, 140, 255, 0.32)'
const INDIGO_GLOW = 'rgba(108, 140, 255, 0.18)'
const MINT = '#4fe0a6'
const MINT_DIM = 'rgba(79, 224, 166, 0.28)'
const AMBER = '#f0b45a'
const AMBER_DIM = 'rgba(240, 180, 90, 0.30)'
const TEXT = '#eef2f8'
const MUTED = '#8b96a8'
const MONO = "'JetBrains Mono', 'Vazirmatn', monospace"

const LIFT = '0 18px 40px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.35)'
const LIFT_HI = `0 24px 60px rgba(0,0,0,0.58), 0 3px 8px rgba(0,0,0,0.42), 0 0 46px ${INDIGO_GLOW}`
const LIFT_MINT = '0 24px 60px rgba(0,0,0,0.58), 0 0 44px rgba(79,224,166,0.18)'

export type SceneProps = { t: number; scene: Scene }

// ─── Stage Shell ────────────────────────────────────────────────────────────

function Stage({ children }: { children: ReactNode }) {
  return (
    <div
      dir="ltr"
      style={{
        position: 'absolute',
        inset: 0,
        width: 540,
        height: 960,
        overflow: 'hidden',
        backgroundColor: INK,
        color: TEXT,
        fontFamily: "'Vazirmatn', -apple-system, sans-serif",
        backgroundImage:
          'radial-gradient(130% 64% at 50% -8%, rgba(108,140,255,0.14) 0%, rgba(108,140,255,0) 60%), radial-gradient(90% 50% at 50% 108%, rgba(79,224,166,0.07) 0%, rgba(79,224,166,0) 64%)',
      }}
    >
      {children}
      <div
        style={{
          position: 'absolute',
          bottom: 26,
          left: 32,
          fontSize: 9,
          letterSpacing: '0.22em',
          fontFamily: MONO,
          color: 'rgba(139, 150, 168, 0.38)',
          pointerEvents: 'none',
        }}
      >
        ONE WORKSPACE // HISABCHE
      </div>
    </div>
  )
}

// ─── Reusable Pro UI Primitives ─────────────────────────────────────────────

function Panel({
  style,
  children,
  active = false,
  mint = false,
}: {
  style: CSSProperties
  children: ReactNode
  active?: boolean | undefined
  mint?: boolean | undefined
}) {
  return (
    <div
      style={{
        position: 'absolute',
        borderRadius: 16,
        background: `linear-gradient(180deg, ${PANEL_HI} 0%, ${PANEL} 100%)`,
        border: `1px solid ${mint ? MINT_DIM : active ? HAIRLINE_HI : HAIRLINE}`,
        boxShadow: mint ? LIFT_MINT : active ? LIFT_HI : LIFT,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function Bar({ w, h = 6, tone = 0.12 }: { w: number; h?: number; tone?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: h / 2,
        backgroundColor: `rgba(255, 255, 255, ${tone})`,
      }}
    />
  )
}

function Dot({ size = 8, color = MINT }: { size?: number; color?: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        boxShadow: `0 0 10px ${color}66`,
      }}
    />
  )
}

function Check({ size = 16, color = MINT }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 12.6 9.6 17.6 19.5 7.2"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type ToolKind = 'grid' | 'paper' | 'notebook' | 'phone'

function ToolGlyph({
  kind,
  size = 20,
  color = MUTED,
}: {
  kind: ToolKind
  size?: number
  color?: string
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {kind === 'grid' && (
        <g stroke={color} strokeWidth={1.5} strokeLinecap="round">
          <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
          <path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15M15 4.5v15" />
        </g>
      )}
      {kind === 'paper' && (
        <g stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3.5h9.5L19 7v13.5H6z" />
          <path d="M15 3.5V7h3.5M9 11h7M9 14.5h7M9 18h4" />
        </g>
      )}
      {kind === 'notebook' && (
        <g stroke={color} strokeWidth={1.5} strokeLinecap="round">
          <rect x="4.5" y="4" width="14" height="16" rx="2.5" />
          <path d="M8 4v16M11 9h5M11 12.5h5M11 16h3" />
        </g>
      )}
      {kind === 'phone' && (
        <g stroke={color} strokeWidth={1.5} strokeLinecap="round">
          <rect x="7" y="3" width="10" height="18" rx="2.5" />
          <path d="M10.5 6h3" />
        </g>
      )}
    </svg>
  )
}

export const FIVE_DOMAINS = ['انبار', 'صندوق', 'دفتر', 'طلب', 'سود'] as const
const FIVE_GLYPHS: ToolKind[] = ['grid', 'phone', 'paper', 'notebook', 'grid']

// ─── Scene 1: Four Answers to One Question (0.00–5.50s) ─────────────────────

const ANSWER_CARDS: Array<{
  x: number
  y: number
  tilt: number
  glyph: ToolKind
  name: string
}> = [
  { x: 42, y: 184, tilt: -1.4, glyph: 'grid', name: 'اکسل' },
  { x: 282, y: 184, tilt: 1.2, glyph: 'paper', name: 'دفتر' },
  { x: 42, y: 356, tilt: 1.0, glyph: 'notebook', name: 'کاغذ' },
  { x: 282, y: 356, tilt: -1.2, glyph: 'phone', name: 'یادداشت' },
]

const ANSWERS = [faNumber(12), faNumber(18), faNumber(9), '؟']

export function FourAnswersScene({ t }: SceneProps) {
  const caretOn = Math.sin(t * 5.2) > -0.2

  return (
    <Stage>
      {/* Background Ambience: Conflicting Data Tension */}
      <div
        style={{
          position: 'absolute',
          top: 240,
          left: 270,
          width: 440,
          height: 380,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(240,180,90,0.08) 0%, rgba(240,180,90,0) 65%)',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* 4 Fragmented Business Tool Cards */}
      {ANSWER_CARDS.map((card, i) => {
        const at = 0.16 + i * 0.12
        const pop = enter(t, at, { y: 16, scale: 0.9 })
        const shake = Math.sin((t - 1.4) * 3.4 + i * 1.6) * 1.5 * clamp(progress(t, 1.4, 0.6))

        return (
          <Panel
            key={card.name}
            active={i === 3}
            style={{
              top: card.y,
              left: card.x,
              width: 216,
              height: 152,
              borderRadius: 16,
              transform: `rotate(${card.tilt}deg)`,
              border: `1px solid ${i === 3 ? AMBER_DIM : HAIRLINE}`,
              boxShadow: i === 3 ? '0 14px 34px rgba(240,180,90,0.12)' : LIFT,
            }}
          >
            {/* Tool Header Chrome */}
            <div
              style={{
                position: 'absolute',
                top: 14,
                left: 14,
                right: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ToolGlyph kind={card.glyph} size={18} color={i === 3 ? AMBER : MUTED} />
                <span
                  dir="rtl"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: MUTED,
                  }}
                >
                  {card.name}
                </span>
              </div>
              <Dot size={6} color={i === 3 ? AMBER : 'rgba(255,255,255,0.2)'} />
            </div>

            {/* Conflicting Metric Number */}
            <div
              style={{
                position: 'absolute',
                top: 56,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                ...pop,
                transform: `${pop.transform ?? ''} translateY(${shake}px)`,
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 48,
                  fontWeight: 800,
                  lineHeight: 1,
                  color: i === 3 ? AMBER : TEXT,
                  letterSpacing: '-0.02em',
                  textShadow:
                    i === 3 ? '0 0 20px rgba(240,180,90,0.4)' : '0 2px 10px rgba(0,0,0,0.5)',
                }}
              >
                {ANSWERS[i]}
              </span>
            </div>

            {/* Bottom Abstracted Data Bars */}
            <div
              style={{
                position: 'absolute',
                bottom: 14,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                gap: 6,
                opacity: clamp(progress(t, at + 0.2, 0.3)),
              }}
            >
              <Bar w={54} h={5} tone={0.14} />
              <Bar w={32} h={5} tone={0.08} />
            </div>
          </Panel>
        )
      })}

      {/* Central Floating Question Pill: «سود؟» */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 574,
          left: 270,
          transform: `translate(-50%, -50%) scale(${1 + 0.012 * Math.sin(t * 2.1)})`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 28px',
          borderRadius: 999,
          background: 'rgba(20, 26, 38, 0.92)',
          border: `1px solid ${HAIRLINE_HI}`,
          backdropFilter: 'blur(16px)',
          boxShadow: `0 18px 42px rgba(0,0,0,0.5), 0 0 32px ${INDIGO_GLOW}`,
        }}
      >
        <span
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: TEXT,
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}
        >
          سود؟
        </span>
        <span
          style={{
            width: 3,
            height: 26,
            borderRadius: 1.5,
            backgroundColor: INDIGO,
            opacity: caretOn ? 0.95 : 0.12,
          }}
        />
      </div>

      {/* Interactive Cursor Targeting Card 3 Question Mark */}
      <div style={{ position: 'absolute', inset: 0, opacity: clamp(progress(t, 0.55, 0.3)) }}>
        <InteractiveCursor
          t={t}
          x={mix(490, 396, ease(clamp(progress(t, 0.7, 3.4))))}
          y={mix(720, 484, ease(clamp(progress(t, 0.7, 3.4))))}
          clickAt={4.3}
        />
      </div>
    </Stage>
  )
}

// ─── Scene 2: Four Answers Fold Into One (5.50–12.00s) ──────────────────────

export function MergeToOneScene({ t }: SceneProps) {
  const panelSpring = spring(clamp(progress(t, 1.15, 0.85)))
  const panelOpacity = clamp(progress(t, 1.15, 0.3))
  const lightSweep = ease(clamp(progress(t, 3.3, 0.9)))

  return (
    <Stage>
      {/* 4 Fragmented Tools Collapse Into Center */}
      {ANSWER_CARDS.map((card, i) => {
        const p = ease(clamp(progress(t, 0.1 + i * 0.06, 0.95)))
        const cx = card.x + 108
        const cy = card.y + 76

        return (
          <Panel
            key={card.name}
            style={{
              top: card.y,
              left: card.x,
              width: 216,
              height: 152,
              transform: `translate(${(270 - cx) * p}px, ${(310 - cy) * p}px) scale(${1 - 0.82 * p})`,
              opacity: 1 - p,
              pointerEvents: 'none',
            }}
          >
            <div style={{ position: 'absolute', top: 14, left: 14 }}>
              <ToolGlyph kind={card.glyph} size={18} />
            </div>
            <div style={{ position: 'absolute', top: 56, left: 0, right: 0, textAlign: 'center' }}>
              <span style={{ fontFamily: MONO, fontSize: 46, fontWeight: 700, color: TEXT }}>
                {ANSWERS[i]}
              </span>
            </div>
          </Panel>
        )
      })}

      {/* Unified Single Glass Card */}
      <Panel
        active
        mint
        style={{
          top: 198,
          left: 42,
          width: 456,
          height: 246,
          borderRadius: 20,
          transform: `scale(${mix(0.92, 1, panelSpring)})`,
          opacity: panelOpacity,
        }}
      >
        {/* Integrated Source Dock: 4 Tools Consolidated */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '5px 12px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${HAIRLINE}`,
          }}
        >
          {ANSWER_CARDS.map((card) => (
            <div key={card.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ToolGlyph kind={card.glyph} size={15} color="rgba(139,150,168,0.85)" />
              <Dot size={5} color={MINT} />
            </div>
          ))}
        </div>

        {/* State Badge: «یکجا» */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 16,
            right: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 14px',
            borderRadius: 999,
            border: `1px solid ${MINT_DIM}`,
            background: 'rgba(79, 224, 166, 0.12)',
            opacity: clamp(progress(t, 2.9, 0.35)),
          }}
        >
          <Dot size={6} color={MINT} />
          <span style={{ fontSize: 14, fontWeight: 700, color: MINT }}>یکجا</span>
        </div>

        {/* The One True Reconciled Profit Metric */}
        <div dir="rtl" style={{ position: 'absolute', top: 82, right: 28, textAlign: 'right' }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: MUTED,
              marginBottom: 8,
              opacity: clamp(progress(t, 1.6, 0.3)),
            }}
          >
            سود واقعی
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 66,
              fontWeight: 800,
              lineHeight: 1,
              color: TEXT,
              letterSpacing: '-0.03em',
              opacity: clamp(progress(t, 1.9, 0.3)),
            }}
          >
            {faNumber(Math.round(mix(0, 24, ease(clamp(progress(t, 2.0, 1.2))))))}
          </div>
        </div>

        {/* Emerald Reconciliation Seal Checkmark */}
        <div
          style={{
            position: 'absolute',
            left: 32,
            top: 114,
            width: 68,
            height: 68,
            borderRadius: '50%',
            border: `1.5px solid ${MINT_DIM}`,
            background: 'rgba(79, 224, 166, 0.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${mix(0.65, 1, spring(clamp(progress(t, 2.4, 0.7))))})`,
            opacity: clamp(progress(t, 2.4, 0.3)),
            boxShadow: `0 0 32px rgba(79, 224, 166, 0.22)`,
          }}
        >
          <Check size={32} color={MINT} />
        </div>

        {/* Specular Light Sweep Passing Across Surface */}
        <div
          style={{
            position: 'absolute',
            top: -50,
            bottom: -50,
            width: 140,
            left: mix(-200, 560, lightSweep),
            transform: 'rotate(16deg)',
            background:
              'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0) 100%)',
            opacity: clamp(progress(t, 3.3, 0.2)) * 0.95,
            pointerEvents: 'none',
          }}
        />
      </Panel>
    </Stage>
  )
}

// ─── Scene 3: One Invoice, Five Records (12.00–19.00s) ──────────────────────

const ROW_Y = [280, 346, 412, 478, 544]

export function InvoiceFanoutScene({ t }: SceneProps) {
  const cardIn = enter(t, 0.15, { y: 18 })
  const down = clamp(progress(t, 1.0, 0.1))
  const up = clamp(progress(t, 1.1, 0.35))
  const press = down * (1 - up)
  const confirmed = clamp(progress(t, 1.0, 0.25))

  return (
    <Stage>
      {/* Master Invoice Row */}
      <Panel
        style={{
          top: 136,
          left: 42,
          width: 456,
          height: 108,
          borderRadius: 16,
          ...cardIn,
        }}
      >
        <div style={{ position: 'absolute', top: 20, left: 18 }}>
          <ToolGlyph kind="paper" size={20} color="rgba(139,150,168,0.9)" />
        </div>
        <div
          style={{
            position: 'absolute',
            top: 46,
            left: 18,
            fontFamily: MONO,
            fontSize: 26,
            fontWeight: 700,
            color: TEXT,
            letterSpacing: '-0.02em',
          }}
        >
          {faNumber(1042)}
        </div>

        {/* Invoice Total Amount */}
        <div
          style={{
            position: 'absolute',
            top: 56,
            right: 140,
            fontFamily: MONO,
            fontSize: 26,
            fontWeight: 700,
            color: TEXT,
            letterSpacing: '-0.02em',
          }}
        >
          {faNumber(280000)}
        </div>
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 30,
            right: 140,
            fontSize: 13,
            fontWeight: 600,
            color: MUTED,
          }}
        >
          مبلغ
        </div>

        {/* Confirm Action Button: «ثبت» */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 32,
            right: 18,
            width: 104,
            height: 46,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontSize: 18,
            fontWeight: 800,
            color: MINT,
            border: `1.5px solid ${confirmed > 0 ? MINT : MINT_DIM}`,
            background: confirmed > 0 ? 'rgba(79, 224, 166, 0.22)' : 'rgba(79, 224, 166, 0.10)',
            transform: `scale(${1 - 0.06 * press})`,
            boxShadow:
              confirmed > 0 ? `0 0 28px rgba(79, 224, 166, 0.28)` : '0 4px 14px rgba(0,0,0,0.3)',
          }}
        >
          {confirmed > 0.6 && <Check size={16} />}
          <span>ثبت</span>
        </div>
      </Panel>

      {/* 5 Simultaneous Synchronized System Records */}
      {FIVE_DOMAINS.map((label, i) => {
        const rowIn = enter(t, 1.28 + i * 0.14, { y: -12, scale: 0.99 })

        return (
          <Panel
            key={label}
            style={{
              top: ROW_Y[i],
              left: 42,
              width: 456,
              height: 54,
              borderRadius: 12,
              ...rowIn,
            }}
          >
            <div
              dir="rtl"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                padding: '0 18px',
                gap: 12,
              }}
            >
              <Dot size={7} color={MINT} />
              <ToolGlyph kind={FIVE_GLYPHS[i]!} size={17} color={TEXT} />
              <span style={{ fontSize: 20, fontWeight: 800, color: TEXT }}>{label}</span>
              <div style={{ flex: 1 }} />
              {i === 4 && (
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 18,
                    fontWeight: 700,
                    color: MINT,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {`+${faNumber(90000)}`}
                </span>
              )}
              <Check size={18} color={MINT} />
            </div>
          </Panel>
        )
      })}

      {/* Interactive Cursor Clicking Confirm Button */}
      <div style={{ position: 'absolute', inset: 0, opacity: clamp(progress(t, 0.3, 0.25)) }}>
        <InteractiveCursor
          t={t}
          x={mix(490, 428, ease(clamp(progress(t, 0.35, 0.65))))}
          y={mix(290, 196, ease(clamp(progress(t, 0.35, 0.65))))}
          clickAt={1.0}
        />
      </div>
    </Stage>
  )
}

// ─── Scene 4: The Five Records Are One System (19.00–26.00s) ────────────────

const HUB_POS = { x: 270, y: 470 }
const SYSTEM_NODES = [
  { x: 270, y: 284 },
  { x: 440, y: 410 },
  { x: 375, y: 610 },
  { x: 165, y: 610 },
  { x: 100, y: 410 },
]

type Coord = { x: number; y: number }

function getControlPoint(a: Coord, b: Coord, bend: number): Coord {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { x: (a.x + b.x) / 2 - (dy / len) * bend, y: (a.y + b.y) / 2 + (dx / len) * bend }
}

function getQuadPoint(p: number, a: Coord, c: Coord, b: Coord): Coord {
  const mt = 1 - p
  return {
    x: mt * mt * a.x + 2 * mt * p * c.x + p * p * b.x,
    y: mt * mt * a.y + 2 * mt * p * c.y + p * p * b.y,
  }
}

export function SystemMapScene({ t }: SceneProps) {
  const pulseLoop = clamp(((t - 1.5) / 2.2) % 1)

  return (
    <Stage>
      {/* Dynamic Data Transmission Cables (SVG Bezier Lines) */}
      <svg width={540} height={960} style={{ position: 'absolute', inset: 0 }}>
        {SYSTEM_NODES.map((node, i) => {
          const cp = getControlPoint(node, HUB_POS, i % 2 === 0 ? 28 : -28)
          const trail = strokeDraw(t, 0.6 + i * 0.12, 0.7, 420)
          const pt = getQuadPoint(pulseLoop, node, cp, HUB_POS)

          return (
            <g key={i}>
              <path
                d={`M ${node.x} ${node.y} Q ${cp.x} ${cp.y} ${HUB_POS.x} ${HUB_POS.y}`}
                fill="none"
                stroke={INDIGO_DIM}
                strokeWidth={2.4}
                strokeDasharray={trail.strokeDasharray}
                strokeDashoffset={trail.strokeDashoffset}
              />
              {t > 1.5 && (
                <circle cx={pt.x} cy={pt.y} r={5} fill={INDIGO} opacity={0.9}>
                  <animate
                    attributeName="opacity"
                    values="0.9;0.4;0.9"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          )
        })}
      </svg>

      {/* Central Unified Kernel Hub */}
      <Panel
        active
        style={{
          top: HUB_POS.y - 56,
          left: HUB_POS.x - 56,
          width: 112,
          height: 112,
          borderRadius: 24,
          transform: `scale(${mix(0.85, 1, spring(clamp(progress(t, 0.15, 0.8))))})`,
          opacity: clamp(progress(t, 0.15, 0.3)),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 40px ${INDIGO_GLOW}`,
        }}
      >
        <svg width={48} height={48} viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect
            x="4"
            y="4"
            width="17"
            height="17"
            rx="5"
            stroke={INDIGO}
            strokeWidth={2.2}
            fill="rgba(108,140,255,0.15)"
          />
          <rect
            x="27"
            y="4"
            width="17"
            height="17"
            rx="5"
            stroke={INDIGO}
            strokeWidth={2.2}
            opacity={0.6}
          />
          <rect
            x="4"
            y="27"
            width="17"
            height="17"
            rx="5"
            stroke={INDIGO}
            strokeWidth={2.2}
            opacity={0.6}
          />
          <rect
            x="27"
            y="27"
            width="17"
            height="17"
            rx="5"
            stroke={MINT}
            strokeWidth={2.2}
            fill="rgba(79,224,166,0.2)"
          />
        </svg>
      </Panel>

      {/* 5 Peripheral System Domain Nodes */}
      {FIVE_DOMAINS.map((label, i) => {
        const pop = enter(t, 0.25 + i * 0.1, { y: 16, scale: 0.94 })
        const node = SYSTEM_NODES[i]!

        return (
          <Panel
            key={label}
            style={{
              top: node.y - 32,
              left: node.x - 58,
              width: 116,
              height: 64,
              borderRadius: 14,
              ...pop,
            }}
          >
            <div
              dir="rtl"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Dot size={6} color={INDIGO} />
              <span style={{ fontSize: 20, fontWeight: 800, color: TEXT }}>{label}</span>
            </div>
          </Panel>
        )
      })}
    </Stage>
  )
}

// ─── Scene 5: One Screen for the Whole Business (26.00–33.00s) ──────────────

const SPARK_POINTS = [0.32, 0.4, 0.36, 0.54, 0.62, 0.58, 0.74, 0.88]
const CHART_BOX = { x: 24, y: 196, w: 420, h: 168 }

function buildSparkline(): string {
  return SPARK_POINTS.map((v, i) => {
    const x = CHART_BOX.x + (i / (SPARK_POINTS.length - 1)) * CHART_BOX.w
    const y = CHART_BOX.y + CHART_BOX.h - 12 - v * (CHART_BOX.h - 26)
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
}

export function OneScreenScene({ t }: SceneProps) {
  const panelIn = enter(t, 0.1, { y: 22, scale: 0.97 })
  const chartLine = strokeDraw(t, 1.5, 1.3, 1200)
  const chartFill = clamp(progress(t, 2.1, 0.9))

  const kpis = [
    { label: 'فروش', val: 280000, at: 0.9 },
    { label: 'طلب', val: 120000, at: 1.1 },
    { label: 'سود', val: 90000, at: 1.3 },
  ]

  return (
    <Stage>
      <Panel
        style={{
          top: 174,
          left: 36,
          width: 468,
          height: 550,
          borderRadius: 22,
          ...panelIn,
        }}
      >
        {/* Window Top Navigation Bar */}
        <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', gap: 7 }}>
          <Bar w={8} h={8} tone={0.22} />
          <Bar w={8} h={8} tone={0.15} />
          <Bar w={8} h={8} tone={0.09} />
        </div>

        {/* Live System Online Badge */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 14,
            right: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 14px',
            borderRadius: 999,
            border: `1px solid ${MINT_DIM}`,
            background: 'rgba(79, 224, 166, 0.10)',
          }}
        >
          <Dot size={6} color={MINT} />
          <span style={{ fontSize: 13, fontWeight: 700, color: MINT }}>آنلاین</span>
        </div>

        {/* 3 Executive KPI Tiles */}
        {kpis.map((kpi, i) => (
          <div
            key={kpi.label}
            dir="rtl"
            style={{
              position: 'absolute',
              top: 76,
              left: 20 + i * 144,
              width: 136,
              height: 98,
              borderRadius: 14,
              border: `1px solid ${HAIRLINE}`,
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '12px 14px',
              ...enter(t, 0.45 + i * 0.12, { y: 12, scale: 0.97 }),
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: MUTED }}>{kpi.label}</div>
            <div
              style={{
                marginTop: 8,
                fontFamily: MONO,
                fontSize: 24,
                fontWeight: 800,
                color: TEXT,
                letterSpacing: '-0.02em',
              }}
            >
              {faNumber(Math.round(mix(0, kpi.val, ease(clamp(progress(t, kpi.at, 1.2))))))}
            </div>
          </div>
        ))}

        {/* Financial Area Chart Graphic */}
        <svg
          width={468}
          height={550}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <defs>
            <linearGradient id="pro-screen-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(108, 140, 255, 0.32)" />
              <stop offset="100%" stopColor="rgba(108, 140, 255, 0)" />
            </linearGradient>
          </defs>
          <path
            d={`${buildSparkline()} L ${CHART_BOX.x + CHART_BOX.w} ${CHART_BOX.y + CHART_BOX.h} L ${CHART_BOX.x} ${CHART_BOX.y + CHART_BOX.h} Z`}
            fill="url(#pro-screen-area)"
            opacity={chartFill}
          />
          <path
            d={buildSparkline()}
            fill="none"
            stroke={INDIGO}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={chartLine.strokeDasharray}
            strokeDashoffset={chartLine.strokeDashoffset}
          />
          <circle
            cx={CHART_BOX.x + CHART_BOX.w}
            cy={
              CHART_BOX.y +
              CHART_BOX.h -
              12 -
              SPARK_POINTS[SPARK_POINTS.length - 1]! * (CHART_BOX.h - 26)
            }
            r={5}
            fill={INDIGO}
            opacity={clamp(progress(t, 2.5, 0.3))}
          />
        </svg>

        {/* Live Reconciled Transaction Row */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 410,
            left: 20,
            right: 20,
            height: 66,
            borderRadius: 14,
            border: `1px solid ${HAIRLINE}`,
            background: 'rgba(255, 255, 255, 0.025)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 12,
            ...enter(t, 2.8, { y: 12, scale: 0.98 }),
          }}
        >
          <Dot size={8} color={MINT} />
          <span style={{ fontSize: 16, fontWeight: 700, color: MUTED }}>آخرین فاکتور</span>
          <div style={{ flex: 1 }} />
          <span
            style={{
              fontFamily: MONO,
              fontSize: 20,
              fontWeight: 800,
              color: TEXT,
              letterSpacing: '-0.01em',
            }}
          >
            {faNumber(1042)}
          </span>
          <Check size={18} color={MINT} />
        </div>
      </Panel>
    </Stage>
  )
}

// ─── Scene 6: Brand Curtain (33.00–42.00s) — «از جامع، به حسابچه» ────────────

export function BrandCurtainScene({ t }: SceneProps) {
  const auraBloom = clamp(progress(t, 0.1, 2.5))
  const emblemEnter = enter(t, 0.35, { y: 18, scale: 0.95 })
  const taglineEnter = enter(t, 1.1, { y: 14 })
  const brandEnter = enter(t, 1.7, { y: 20 })
  const domainEnter = enter(t, 2.6, { y: 12 })

  return (
    <Stage>
      {/* Volumetric Indigo Radial Aura Halo */}
      <div
        style={{
          position: 'absolute',
          top: 450,
          left: 270,
          width: mix(360, 540, auraBloom),
          height: mix(360, 540, auraBloom),
          borderRadius: '50%',
          background: `radial-gradient(circle, ${INDIGO_GLOW} 0%, rgba(108,140,255,0.06) 50%, rgba(108,140,255,0) 70%)`,
          opacity: 0.6 + 0.1 * Math.sin(t * 0.9),
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Hisabche Geometric Kernel Insignia */}
      <div
        style={{
          ...emblemEnter,
          position: 'absolute',
          top: 250,
          left: 270,
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <svg width={76} height={76} viewBox="0 0 76 76" fill="none" aria-hidden="true">
          <circle cx={38} cy={38} r={35} stroke={INDIGO} strokeWidth={1.5} opacity={0.35} />
          <rect
            x="22"
            y="22"
            width="32"
            height="32"
            rx="9"
            stroke={INDIGO}
            strokeWidth={2.4}
            fill="rgba(108,140,255,0.14)"
          />
          <circle cx={38} cy={38} r={5} fill={MINT} />
        </svg>
      </div>

      {/* Campaign Tagline: از جامع، به حسابچه */}
      <div
        dir="rtl"
        style={{
          ...taglineEnter,
          position: 'absolute',
          top: 360,
          left: 270,
          transform: 'translate(-50%, -50%)',
          fontSize: 28,
          fontWeight: 800,
          color: INDIGO,
          whiteSpace: 'nowrap',
          letterSpacing: '0.04em',
          textShadow: '0 2px 14px rgba(108,140,255,0.3)',
        }}
      >
        از جامع، به حسابچه
      </div>

      {/* Master Display Title: حسابچه */}
      <div
        dir="rtl"
        style={{
          ...brandEnter,
          position: 'absolute',
          top: 480,
          left: 270,
          transform: 'translate(-50%, -50%)',
          fontSize: 118,
          fontWeight: 900,
          color: TEXT,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          textShadow: '0 6px 30px rgba(0,0,0,0.8), 0 0 40px rgba(108,140,255,0.22)',
        }}
      >
        حسابچه
      </div>

      {/* Official Domain Obsidian Capsule Pill */}
      <div
        style={{
          ...domainEnter,
          position: 'absolute',
          top: 610,
          left: 270,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div
          style={{
            padding: '10px 28px',
            borderRadius: 999,
            border: `1.5px solid ${HAIRLINE_HI}`,
            background: 'rgba(25, 33, 48, 0.78)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 21,
              fontWeight: 700,
              letterSpacing: '0.28em',
              color: TEXT,
            }}
          >
            HISABCHE.COM
          </span>
        </div>
      </div>
    </Stage>
  )
}
