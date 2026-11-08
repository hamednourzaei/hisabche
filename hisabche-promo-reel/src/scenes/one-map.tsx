// ============================================
// Reel #109 — «نقشه‌ی یکپارچه‌ی کسب‌وکار» (The One Map of the Business)
//
// Art direction: Brass Compass Observatory — a quiet brass-and-patina
// observatory built on the studio's dark ink. Nothing warm-browser-style:
// every scene keeps the 540×960 ink canvas, the floating brass tags and the
// single focal instrument in the 25–65% vertical band.
//
// Story (from comprehensive → حسابچه):
//   1. a brass compass needle pulled by four duties at once;
//   2. the old tool trio (Excel, ledger, paper) topples and is stamped
//      obsolete;
//   3. scattered fragments vacuum into one brick — «یکجا»;
//   4. one invoice lands five simultaneous records (انبار، صندوق، دفتر،
//      طلب، سود) — the product's real five-actions claim;
//   5. the five records become a constellation: the one map;
//   6. the quiet brand curtain: از جامع، به حسابچه.
//
// Guardrails honoured: no camera zoom, no divider lines, ≤ 6 Persian words
// on stage at once, deterministic math only, 24px+ safe margins, dark theme,
// no fake product claims (the five-job invoice is the documented product
// truth from the prompt library's anti-hallucination list).
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import {
  clamp,
  deterministicHash,
  ease,
  enter,
  mix,
  progress,
  spring,
  strokeDraw,
} from '../engine/anim'

// ─── Palette ────────────────────────────────────────────────────────────────

const INK = '#0a0c10'
const INK_SOFT = '#131922'
const BRASS = '#e8b84b'
const BRASS_DIM = 'rgba(232, 184, 75, 0.34)'
const BRASS_GLOW = 'rgba(232, 184, 75, 0.14)'
const PATINA = 'rgba(61, 127, 114, 0.32)'
const PATINA_SOLID = '#3d7f72'
const RED = '#e4574e'
const BONE = '#f2ead9'
const MUTED = '#97a1ab'

export type SceneProps = { t: number; scene: Scene }

// ─── Shared Stage ───────────────────────────────────────────────────────────

function Stage({ children }: { children: ReactNode }) {
  return (
    <div
      dir="ltr"
      style={{
        position: 'absolute',
        inset: 0,
        width: 540,
        height: 960,
        backgroundColor: INK,
        overflow: 'hidden',
        color: BONE,
        fontFamily: "'Vazirmatn', -apple-system, sans-serif",
      }}
    >
      {/* Ambient observatory vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 46%, rgba(61, 127, 114, 0.10) 0%, transparent 62%), radial-gradient(circle at 50% 96%, rgba(10, 12, 16, 0.95) 0%, #0a0c10 100%)',
          pointerEvents: 'none',
        }}
      />
      {/* Sparse deterministic dust — never two dots clamped to one seed */}
      {Array.from({ length: 14 }, (_, i) => {
        const hx = deterministicHash(i, 7)
        const hy = deterministicHash(i, 13)
        const drift = Math.sin(i * 1.7) * 4
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 34 + hx * 472,
              top: 120 + hy * 700 + drift,
              width: 2,
              height: 2,
              borderRadius: '50%',
              backgroundColor: PATINA_SOLID,
              opacity: 0.16 + 0.08 * Math.sin(i * 2.3),
              pointerEvents: 'none',
            }}
          />
        )
      })}
      {children}
      {/* Instrument tag (estonia-safe punching margin) */}
      <div
        style={{
          position: 'absolute',
          bottom: 26,
          left: 30,
          fontSize: 10,
          color: 'rgba(151, 161, 171, 0.42)',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.16em',
          pointerEvents: 'none',
        }}
      >
        ONE-MAP // HISABCHE
      </div>
    </div>
  )
}

/** Floating Persian tag pill. */
function Tag({
  label,
  style,
  emphasize = false,
}: {
  label: string
  style?: CSSProperties | undefined
  emphasize?: boolean | undefined
}) {
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        padding: emphasize ? '10px 20px' : '7px 18px',
        borderRadius: 999,
        background: emphasize ? 'rgba(35, 43, 51, 0.92)' : 'rgba(19, 25, 34, 0.85)',
        border: `1px solid ${emphasize ? BRASS : BRASS_DIM}`,
        color: emphasize ? BRASS : BONE,
        fontSize: emphasize ? 26 : 21,
        fontWeight: 800,
        whiteSpace: 'nowrap',
        transform: 'translate(-50%, -50%)',
        boxShadow: emphasize ? `0 0 18px ${BRASS_GLOW}` : 'none',
        ...style,
      }}
    >
      {label}
    </div>
  )
}

// The five records one invoice moves — every scene downstream reuses them.
export const FIVE_DOMAINS = ['انبار', 'صندوق', 'دفتر', 'طلب', 'سود'] as const

// ─── Scene 1: The Compass of Four Duties (0.00–5.50s) ───────────────────────

export function NeedleScene({ t }: SceneProps) {
  // The needle can settle on nothing: two tension waves, no camera zoom.
  const wobble = 26 * Math.sin(t * 2.2) + 17 * Math.sin(t * 3.7 + 1.3)
  const labelAt = [0.25, 0.55, 0.85, 1.15]
  return (
    <Stage>
      {/* Bearing ring */}
      <div
        style={{
          position: 'absolute',
          top: 450 - 150,
          left: 270 - 150,
          width: 300,
          height: 300,
          borderRadius: '50%',
          border: `1px solid ${PATINA}`,
          boxShadow: `0 0 40px ${BRASS_GLOW}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 34,
            borderRadius: '50%',
            border: `1px dashed ${BRASS_DIM}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 78,
            borderRadius: '50%',
            background:
              'conic-gradient(from 0deg, rgba(61,127,114,0.16), transparent 55%, rgba(232,184,75,0.10), transparent)',
          }}
        />
      </div>

      {/* The needle — pulled, never settled */}
      <div
        style={{
          position: 'absolute',
          top: 450 - 128,
          left: 267,
          width: 6,
          height: 152,
          borderRadius: 3,
          background: `linear-gradient(to bottom, ${RED} 0%, ${BRASS} 46%, ${PATINA_SOLID} 100%)`,
          transformOrigin: '50% 78%',
          transform: `rotate(${wobble}deg)`,
          boxShadow: `0 0 14px ${BRASS_GLOW}`,
        }}
      />

      {/* The four duties pulling it */}
      <Tag label="فروش" style={{ ...enter(t, labelAt[0], { y: 18 }), top: 265, left: 270 }} />
      <Tag label="انبار" style={{ ...enter(t, labelAt[1], { y: 18 }), top: 450, left: 476 }} />
      <Tag label="نسیه" style={{ ...enter(t, labelAt[2], { y: 18 }), top: 635, left: 270 }} />
      <Tag label="حقوق" style={{ ...enter(t, labelAt[3], { y: 18 }), top: 450, left: 64 }} />
    </Stage>
  )
}

// ─── Scene 2: The Old Trio Toppled (5.50–12.00s) ────────────────────────────

const OLD_TOOLS = ['اکسل', 'دفتر', 'کاغذ'] as const

export function ToolToppleScene({ t }: SceneProps) {
  return (
    <Stage>
      {OLD_TOOLS.map((label, i) => {
        const enterAt = 0.25 + i * 0.35
        const fallAt = 1.1 + i * 1.15
        const fallen = spring(clamp(progress(t, fallAt, 0.9)))
        // Fall flat backwards (rotateX, not a 2D swing): the projected footprint
        // shrinks inside the plate's own column, never crossing the frame edge.
        const rotation = -82 * fallen
        const stamped = enter(t, fallAt + 0.55, { y: 14, scale: 1.25 })
        return (
          <div key={label}>
            {/* The tool plate */}
            <div
              style={{
                position: 'absolute',
                top: 250,
                left: [62, 204, 346][i],
                width: 132,
                height: 210,
                borderRadius: 14,
                backgroundColor: INK_SOFT,
                border: '1px solid rgba(151, 161, 171, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transformOrigin: '50% 100%',
                transform: `perspective(800px) rotateX(${rotation}deg)`,
                opacity: clamp(enter(t, enterAt, { fade: 0.3 }).opacity as number),
                boxShadow: '0 18px 40px rgba(0,0,0,0.4)',
              }}
            >
              <span dir="rtl" style={{ fontSize: 40, fontWeight: 800, color: MUTED }}>
                {label}
              </span>
            </div>
            {/* The obsolescence stamp — held at full opacity for reading */}
            <div
              dir="rtl"
              style={{
                position: 'absolute',
                top: 218,
                left: [128, 270, 412][i],
                padding: '8px 18px',
                borderRadius: 10,
                border: `2px solid ${RED}`,
                color: RED,
                background: 'rgba(229, 87, 78, 0.08)',
                fontSize: 27,
                fontWeight: 900,
                whiteSpace: 'nowrap',
                transform: `translate(-50%, -50%) rotate(-12deg) scale(${1 + 0.45 * (1 - spring(clamp(progress(t, fallAt + 0.55, 0.5))))})`,
                opacity: (stamped.opacity as number) * clamp((fallen - 0.3) / 0.7),
              }}
            >
              منسوخ!
            </div>
          </div>
        )
      })}
    </Stage>
  )
}

// ─── Scene 3: The Fragment Vacuum (12.00–19.00s) ────────────────────────────

export function FragmentVacuumScene({ t }: SceneProps) {
  const fallAt = [0.7, 1.7, 2.7]
  const fallTo = { x: 270, y: 330 }
  const brickPop = spring(clamp(progress(t, 3.9, 0.8)))
  const ringP = clamp(progress(t, 4.1, 1.0))
  return (
    <Stage>
      {/* The funnel */}
      <svg
        width={540}
        height={960}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <defs>
          <linearGradient id="funnel-sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(61,127,114,0.10)" />
            <stop offset="100%" stopColor="rgba(61,127,114,0.02)" />
          </linearGradient>
        </defs>
        <path
          d="M 90 320 L 450 320 L 302 522 L 238 522 Z"
          fill="url(#funnel-sheen)"
          stroke={PATINA_SOLID}
          strokeWidth={2}
        />
        <rect x={238} y={522} width={64} height={44} fill="rgba(61,127,114,0.05)" stroke={PATINA} />
      </svg>

      {OLD_TOOLS.map((label, i) => {
        const p = ease(clamp(progress(t, fallAt[i], 1.5)))
        const from = { x: [150, 270, 390][i], y: [196, 146, 196][i] }
        const x = mix(from.x, fallTo.x, p)
        const y = mix(from.y, fallTo.y, p)
        const spin = (p - 0.5) * (i - 1) * 26
        const fade = clamp(p > 0.88 ? (1 - p) / 0.12 : 1)
        const placed = enter(t, 0.15 + i * 0.2, { y: 16 })
        return (
          <div
            key={label}
            style={{
              ...placed,
              position: 'absolute',
              top: y,
              left: x,
              padding: '7px 16px',
              borderRadius: 999,
              background: INK_SOFT,
              border: '1px solid rgba(151, 161, 171, 0.25)',
              color: MUTED,
              fontSize: 22,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              transform: `translate(-50%, -50%) rotate(${spin}deg)`,
              opacity: (placed.opacity as number) * fade,
            }}
          >
            {label}
          </div>
        )
      })}

      {/* The brick: one place */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: mix(660, 612, brickPop),
          left: 270,
          width: 158,
          padding: '16px 0',
          textAlign: 'center',
          borderRadius: 14,
          background: INK_SOFT,
          border: `2px solid ${BRASS}`,
          color: BRASS,
          fontSize: 40,
          fontWeight: 900,
          transform: 'translate(-50%, -50%)',
          opacity: brickPop,
          boxShadow: `0 0 26px ${BRASS_GLOW}`,
        }}
      >
        یکجا
      </div>

      {/* Landing ring pulse */}
      <div
        style={{
          position: 'absolute',
          top: 604,
          left: 270,
          width: mix(24, 128, ringP),
          height: mix(24, 128, ringP),
          borderRadius: '50%',
          border: `2px solid ${BRASS}`,
          opacity: (1 - ringP) * 0.7,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />
    </Stage>
  )
}

// ─── Scene 4: One Invoice, Five Records (19.00–26.00s) ──────────────────────

export function InvoiceStampsScene({ t }: SceneProps) {
  const cardIn = enter(t, 0.25, { y: 26 })
  return (
    <Stage>
      {/* The invoice sheet */}
      <div
        style={{
          ...cardIn,
          position: 'absolute',
          top: 250,
          left: 270,
          width: 176,
          height: 232,
          borderRadius: 12,
          background: BONE,
          transform: `translate(-50%, -50%) scale(${0.94 + 0.06 * (cardIn.opacity as number)})`,
          boxShadow: '0 20px 44px rgba(0,0,0,0.45)',
          padding: '18px 16px 0',
        }}
      >
        <div
          dir="rtl"
          style={{
            fontSize: 23,
            fontWeight: 900,
            color: '#2a2118',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          فاکتور
        </div>
        {/* Faint ledger rows — functional UI, not decorative microcopy */}
        <svg width={144} height={92} style={{ display: 'block', margin: '0 auto' }}>
          {[0, 1, 2].map((r) => (
            <g key={r}>
              <rect
                x={0}
                y={r * 32}
                width={92}
                height={8}
                rx={4}
                fill="rgba(42, 33, 24, 0.22)"
                style={{
                  opacity: clamp(progress(t, 0.6 + r * 0.25, 0.5)),
                }}
              />
              <rect
                x={104}
                y={r * 32}
                width={40}
                height={8}
                rx={4}
                fill="rgba(42, 33, 24, 0.36)"
                style={{
                  opacity: clamp(progress(t, 0.7 + r * 0.25, 0.5)),
                }}
              />
            </g>
          ))}
        </svg>
        <div
          style={{
            marginTop: 10,
            height: 2,
            width: 144,
            marginInline: 'auto',
            backgroundColor: 'rgba(42, 33, 24, 0.55)',
          }}
        />
      </div>

      {/* The five records the invoice moves — brass chips */}
      {FIVE_DOMAINS.map((label, i) => {
        const landAt = 1.1 + i * 0.85
        const shot = spring(clamp(progress(t, landAt, 0.55)))
        const pop = enter(t, landAt, { y: 34, scale: 1.3 })
        return (
          <div key={label}>
            {/* Landing tick pulse under the chip (not a divider line) */}
            <div
              style={{
                position: 'absolute',
                top: 604,
                left: [70, 170, 270, 370, 470][i],
                width: 26 + 18 * shot,
                height: 26 + 18 * shot,
                borderRadius: '50%',
                border: `1px solid ${BRASS_DIM}`,
                opacity: (1 - shot) * 0.55,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
              }}
            />
            <div
              dir="rtl"
              style={{
                ...pop,
                position: 'absolute',
                top: 590,
                left: [70, 170, 270, 370, 470][i],
                width: 86,
                height: 58,
                borderRadius: 12,
                background: INK_SOFT,
                border: '1px solid rgba(232, 184, 75, 0.28)',
                color: BRASS,
                fontWeight: 900,
                fontSize: 27,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `translate(-50%, -50%) scale(${1 + 0.18 * (1 - shot)})`,
                boxShadow: `0 0 20px ${BRASS_GLOW}`,
              }}
            >
              {label}
              <span
                style={{
                  position: 'absolute',
                  top: 4,
                  left: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  color: MUTED,
                }}
              >
                {['۱', '۲', '۳', '۴', '۵'][i]}
              </span>
            </div>
          </div>
        )
      })}
    </Stage>
  )
}

// ─── Scene 5: The Constellation — the One Map (26.00–33.00s) ────────────────

const NODE_POS: Array<{ x: number; y: number }> = [
  { x: 270, y: 308 },
  { x: 412, y: 412 },
  { x: 356, y: 578 },
  { x: 184, y: 578 },
  { x: 128, y: 412 },
]

export function ConstellationMapScene({ t }: SceneProps) {
  return (
    <Stage>
      {/* Edges: pentagon ring + spokes to the heart */}
      <svg width={540} height={960} style={{ position: 'absolute', inset: 0 }}>
        {NODE_POS.map((a, i) => {
          const b = NODE_POS[(i + 1) % NODE_POS.length]
          const dash = strokeDraw(t, 0.9 + i * 0.35, 0.75, 300)
          return (
            <line
              key={`ring-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={BRASS_DIM}
              strokeWidth={2}
              strokeDasharray={dash.strokeDasharray}
              strokeDashoffset={dash.strokeDashoffset}
            />
          )
        })}
        {NODE_POS.map((n, i) => {
          const dash = strokeDraw(t, 1.4 + i * 0.3, 0.7, 300)
          return (
            <line
              key={`spoke-${i}`}
              x1={270}
              y1={462}
              x2={n.x}
              y2={n.y}
              stroke="rgba(61, 127, 114, 0.5)"
              strokeWidth={1.5}
              strokeDasharray={dash.strokeDasharray}
              strokeDashoffset={dash.strokeDashoffset}
            />
          )
        })}
        {/* A travelling pulse from the top node to the heart */}
        <circle
          cx={mix(NODE_POS[0].x, 270, ease(clamp((t * 0.55) % 1)))}
          cy={mix(NODE_POS[0].y, 462, ease(clamp((t * 0.55) % 1)))}
          r={4}
          fill={BRASS}
          opacity={0.9}
        />
      </svg>

      {/* Node chips */}
      {FIVE_DOMAINS.map((label, i) => {
        const pop = enter(t, 0.25 + i * 0.3, { y: 20 })
        return (
          <div
            key={label}
            dir="rtl"
            style={{
              ...pop,
              position: 'absolute',
              top: NODE_POS[i].y,
              left: NODE_POS[i].x,
              width: 86,
              height: 54,
              borderRadius: 12,
              background: INK_SOFT,
              border: '1px solid rgba(232, 184, 75, 0.28)',
              color: BRASS,
              fontWeight: 900,
              fontSize: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: 'translate(-50%, -50%)',
              boxShadow: `0 0 18px ${BRASS_GLOW}`,
            }}
          >
            {label}
          </div>
        )
      })}

      {/* The heart: a slow-definitive brass diamond */}
      <div
        style={{
          position: 'absolute',
          top: 462,
          left: 270,
          width: 30,
          height: 30,
          backgroundColor: BRASS,
          transform: `translate(-50%, -50%) rotate(45deg) scale(${0.9 + 0.1 * Math.sin(t * 1.4)})`,
          boxShadow: `0 0 22px ${BRASS_GLOW}`,
        }}
      />
    </Stage>
  )
}

// ─── Scene 6: The Quiet Brand Curtain (33.00–42.00s) ────────────────────────

export function CurtainBrandScene({ t }: SceneProps) {
  const bloom = clamp(progress(t, 0.1, 2.6))
  const brand = enter(t, 0.6, { y: 34 })
  const tagline = enter(t, 1.5, { y: 16 })
  const domain = enter(t, 2.7, { y: 14 })
  return (
    <Stage>
      {/* The curtain bloom behind the mark — held, not flashing */}
      <div
        style={{
          position: 'absolute',
          top: 470,
          left: 270,
          width: mix(360, 470, bloom),
          height: mix(360, 470, bloom),
          borderRadius: '50%',
          background: `radial-gradient(circle, ${BRASS_GLOW} 0%, transparent 68%)`,
          opacity: 0.42 + 0.12 * Math.sin(t * 0.9),
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Tagline: the arithmetic of the reel */}
      <div
        dir="rtl"
        style={{
          ...tagline,
          position: 'absolute',
          top: 352,
          left: 270,
          transform: `translate(-50%, -50%)`,
          fontSize: 27,
          fontWeight: 700,
          color: PATINA_SOLID,
          whiteSpace: 'nowrap',
        }}
      >
        از جامع، به حسابچه
      </div>

      {/* The mark */}
      <div
        dir="rtl"
        style={{
          ...brand,
          position: 'absolute',
          top: 452,
          left: 270,
          transform: 'translate(-50%, -50%)',
          fontSize: 132,
          fontWeight: 900,
          color: BONE,
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
        }}
      >
        حسابچه
      </div>

      {/* The door: the search line */}
      <div
        style={{
          ...domain,
          position: 'absolute',
          top: 566,
          left: 270,
          transform: 'translate(-50%, -50%)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: '0.28em',
          color: BRASS,
        }}
      >
        HISABCHE.COM
      </div>
    </Stage>
  )
}
