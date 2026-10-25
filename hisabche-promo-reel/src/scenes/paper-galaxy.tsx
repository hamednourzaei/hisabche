// ============================================
// Paper-Galaxy art direction (reel 87) — «شب مغازه، آسمان کاغذها»
//
// A deep-indigo merchant sky. Every receipt the shop has ever written drifts
// up here as a ghost sheet; unclaimed papers burn out like dying stars. The
// Hisabche core ignites as a gravity field, bends every drifting sheet along
// luminous field lines, and settles them into one orbiting ledger ring —
// which then re-enters the shop's phone as a live dashboard.
//
// Bespoke engineering, self-authored: nothing from the 84–86 film sets is
// reused. Own palette, own primitives, own orbit math, own transition set.
//
// One persistent arithmetic: ۷٬۳۲۰٬۰۰۰ فروش − ۴٬۶۱۰٬۰۰۰ بهای تمام‌شده
//                                  = ۲٬۷۱۰٬۰۰۰ سود (+ طلب ۱٬۹۵۰٬۰۰۰، انبار ۲۱۴)
// ============================================

import type { CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, deterministicHash, ease, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

// ─── Tokens ──────────────────────────────────────────────────────────────────

export const NIGHT_SKY = '#070914'
export const NEBULA_VIOLET = '#8b7cf6'
export const STAR_CYAN = '#7fd8ff'
export const STAR_GOLD = '#ffd76a'
export const EMBER_RED = '#ff6a5c'
export const CANVAS_PAPER = '#eef1ff'

const NEBULA_WASH: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(900px 520px at 50% 34%, rgba(139,124,246,0.20), transparent 60%), radial-gradient(700px 420px at 26% 62%, rgba(79,209,197,0.10), transparent 62%), radial-gradient(760px 460px at 74% 70%, rgba(255,106,92,0.07), transparent 60%)',
}

const VIGNETTE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(120% 88% at 50% 42%, transparent 52%, rgba(3,4,10,0.85) 100%)',
}

/** A deterministic deep sky: drifting star dust + soft elliptic orbit hints. */
function GalaxyBackdrop({ t, stars = 90 }: { t: number; stars?: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={NEBULA_WASH} />
      {Array.from({ length: stars }).map((_, i) => {
        const seed = deterministicHash(i, 91)
        const x = ((i * 61) % 540) + deterministicHash(i, 7) * 22
        const y = ((i * 137) % 960) + deterministicHash(i, 11) * 18
        const twinkle = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * (0.6 + seed) + seed * 7))
        const size = 1 + seed * 2
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: y,
              insetInlineStart: x,
              width: size,
              height: size,
              borderRadius: '50%',
              background: seed > 0.82 ? STAR_GOLD : seed > 0.45 ? STAR_CYAN : '#c8d2ff',
              opacity: clamp(twinkle * (0.22 + seed * 0.5)),
              boxShadow: seed > 0.82 ? `0 0 ${6 * twinkle}px ${STAR_GOLD}` : 'none',
            }}
          />
        )
      })}
      <div style={VIGNETTE} />
    </div>
  )
}

/** The stage every scene paints itself over. */
export function GalaxyStage({
  scene,
  t,
  children,
}: {
  scene: Scene
  t: number
  children: React.ReactNode
}) {
  void scene
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        // Deterministic canvas (layout-defect-laws.md band 1): the player
        // document is RTL and mirrors insetInlineStart; the stage pins LTR so
        // numeric insets are physical left coordinates.
        direction: 'ltr',
        background: NIGHT_SKY,
        overflow: 'hidden',
        color: CANVAS_PAPER,
      }}
    >
      <GalaxyBackdrop t={t} />
      {children}
    </div>
  )
}

/** Spring pop: 0 before `at`, overshoot, settle at 1. */
function pop(t: number, at: number, dur = 0.55): number {
  return spring(clamp(progress(t, at, at + dur)))
}

/**
 * Staged word cluster: words light up in voice order and STAY.
 * One cluster per beat; mount-once; no reappear churn (Hard Rule 18).
 */
export function WordCluster({
  t,
  cueAt,
  words,
  y,
  size = 40,
  accentWord,
  accentColor = STAR_GOLD,
}: {
  t: number
  cueAt: number
  words: string[]
  y: number
  size?: number
  accentWord?: string | undefined
  accentColor?: string | undefined
}) {
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        top: y,
        insetInlineStart: 0,
        insetInlineEnd: 0,
        display: 'flex',
        flexDirection: 'row-reverse',
        justifyContent: 'center',
        alignItems: 'baseline',
        gap: '0.28em',
      }}
    >
      {words.map((word, i) => {
        const at = cueAt + i * 0.42
        const p = pop(t, at)
        const isAccent = word === accentWord
        const color = isAccent ? (accentColor ?? STAR_GOLD) : CANVAS_PAPER
        return (
          <span
            key={word}
            style={{
              opacity: clamp(p * 1.6),
              transform: `translateY(${mix(16, 0, p).toFixed(1)}px)`,
              fontSize: size,
              fontWeight: 900,
              color,
              whiteSpace: 'pre',
              textShadow: isAccent ? `0 0 26px ${color}` : '0 2px 18px rgba(0,0,0,0.6)',
            }}
          >
            {word}
          </span>
        )
      })}
    </div>
  )
}

/** Mono value that rolls monotonically to its target and holds (no blinking). */
function RollingNumber({
  t,
  at,
  value,
  color = CANVAS_PAPER,
  size = 30,
}: {
  t: number
  at: number
  value: number
  color?: string
  size?: number
}) {
  const p = ease(clamp(progress(t, at, 1.5)))
  const n = Math.round(mix(0, value, p))
  return (
    <span
      dir="ltr"
      style={{
        fontSize: size,
        fontWeight: 900,
        color,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.1,
        textShadow: `0 0 18px ${color}55`,
        whiteSpace: 'nowrap',
      }}
    >
      {faNumber(n)}
    </span>
  )
}

/** A ghost receipt that drifts, breathes, and can burn out like a dying star. */
function GhostSheet({
  t,
  at,
  seed,
  x,
  y,
  scale = 1,
  burn = false,
}: {
  t: number
  at: number
  seed: number
  x: number
  y: number
  scale?: number
  burn?: boolean | undefined
}) {
  const drift = Math.sin(t * (0.35 + seed * 0.3) + seed * 9) * 14
  const sway = Math.cos(t * (0.25 + seed * 0.35) + seed * 4) * 9
  const entered = pop(t, at + seed * 0.35, 0.9)
  // Burn-out: ember glow while the sheet dissolves — stays gone (prologue only).
  const burnAt = burn ? at + 1.2 : Number.POSITIVE_INFINITY
  const burnP = burn ? progress(t, burnAt, 1.6) : 0
  const material = clamp(entered * (1 - ease(clamp(burnP))))
  const ember = burn
    ? clamp(progress(t, burnAt, 0.5)) * (1 - clamp(progress(t, burnAt + 1.1, 0.8)))
    : 0
  const w = 86 * scale
  const h = 116 * scale
  return (
    <div
      style={{
        position: 'absolute',
        top: y + drift,
        insetInlineStart: `calc(50% + ${x + sway}px)`,
        width: w,
        height: h,
        marginInlineStart: -w / 2,
        transform: `rotate(${(deterministicHash(seed, 3) - 0.5) * 26}deg) scale(${mix(0.5, 1, entered).toFixed(3)})`,
        opacity: material * (burn ? 0.9 : 0.3 + seed * 0.28),
      }}
    >
      {/* sheet body */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(155deg, rgba(238,241,255,${0.5 + ember * 0.5}), rgba(180,192,235,${0.18 + ember * 0.3}))`,
          borderRadius: 7,
          border: `1px solid rgba(200,214,255,${0.28 + ember * 0.6})`,
          boxShadow: ember
            ? `0 0 ${34 + ember * 30}px ${EMBER_RED}, inset 0 0 18px rgba(255,106,92,${ember * 0.7})`
            : '0 14px 44px rgba(4,6,16,0.55)',
          overflow: 'hidden',
        }}
      >
        {/* indistinct ledger lines — reading ghost receipts */}
        {Array.from({ length: 4 }).map((_, li) => {
          const lw = 42 + deterministicHash(li, seed) * 44
          return (
            <div
              key={li}
              style={{
                position: 'absolute',
                top: 16 + li * 16,
                insetInlineStart: 10,
                width: `${lw}%`,
                height: 3,
                borderRadius: 3,
                background: `rgba(70,86,150,${0.5 - li * 0.08})`,
              }}
            />
          )
        })}
        {/* the burned core */}
        {burn && ember > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: '28% 34%',
              borderRadius: '50%',
              background: EMBER_RED,
              filter: 'blur(6px)',
              opacity: ember,
            }}
          />
        )}
      </div>
      {/* unclaimed — the only allowed mark on a ghost sheet */}
      {seed > 0.55 && !burn && (
        <div
          style={{
            position: 'absolute',
            bottom: 7,
            insetInlineStart: 0,
            insetInlineEnd: 0,
            textAlign: 'center',
            fontSize: 15,
            fontWeight: 900,
            color: `rgba(255,161,148,${0.55 + 0.4 * Math.sin(t * 3 + seed)})`,
          }}
        >
          ؟
        </div>
      )}
    </div>
  )
}

/** A gravity stream: bezier path pulling ghost sheets into the core. */
function FieldLine({
  t,
  at,
  d,
  from = STAR_CYAN,
  to = NEBULA_VIOLET,
  width = 2,
}: {
  t: number
  at: number
  d: string
  from?: string
  to?: string
  width?: number
}) {
  const p = ease(clamp(progress(t, at, 1.6)))
  const length = 900
  const gradId = `pg-field-${from.replace('#', '')}-${to.replace('#', '')}`
  return (
    <svg
      viewBox="0 0 540 960"
      style={{ position: 'absolute', inset: 0, width: 540, height: 960, pointerEvents: 'none' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} stopOpacity="0.05" />
          <stop offset="100%" stopColor={to} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - p)}
        opacity={0.85}
      />
    </svg>
  )
}

// ─── Scene 1 (0–4s) — Frame-0 burst: one receipt burns mid-everyday ─────────

const OPENING_SHEETS: { x: number; y: number; seed: number; burn?: boolean | undefined }[] = [
  { x: -170, y: 300, seed: 0.12 },
  { x: 150, y: 250, seed: 0.31 },
  { x: -90, y: 210, seed: 0.47 },
  { x: 110, y: 380, seed: 0.58 },
  { x: -200, y: 430, seed: 0.74 },
  { x: 175, y: 470, seed: 0.9 },
  { x: -30, y: 180, seed: 0.66, burn: true },
]

export function GalaxyBurstScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Ember burst at frame 0 — the visual transient of the hook.
  const shock = pop(t, 0.02, 0.7)
  return (
    <GalaxyStage scene={scene} t={t}>
      {/* shock ring around the burning sheet */}
      <div
        style={{
          position: 'absolute',
          top: 210,
          insetInlineStart: '50%',
          width: mix(0, 190, shock),
          height: mix(0, 190, shock),
          marginInlineStart: mix(0, -95, shock),
          borderRadius: '50%',
          border: `2px solid rgba(255,122,104,${clamp(1 - shock + 0.2)})`,
          boxShadow: `0 0 ${40 * (1 - ease(shock)) + 10}px ${EMBER_RED}`,
          opacity: clamp(1.1 - ease(shock)),
        }}
      />
      {OPENING_SHEETS.map((sheet) => (
        <GhostSheet
          key={sheet.seed}
          t={t}
          at={0}
          x={sheet.x}
          y={sheet.y}
          seed={sheet.seed}
          burn={sheet.burn}
        />
      ))}
      {/* single focal word cluster — 4 words, staged, persistent */}
      <WordCluster
        t={t}
        cueAt={0.55}
        words={['می‌نویسی…', 'ولی', 'گم', 'می‌شه!']}
        y={316}
        size={38}
        accentWord="گم"
      />
    </GalaxyStage>
  )
}

// ─── Scene 2 (4–11s) — Ghost drift: the unclaimed pile keeps growing ────────

const DRIFT_SHEETS = [
  { x: -205, y: 215, seed: 0.08 },
  { x: -120, y: 265, seed: 0.2 },
  { x: -15, y: 235, seed: 0.33 },
  { x: 105, y: 220, seed: 0.44 },
  { x: 198, y: 285, seed: 0.52 },
  { x: -175, y: 395, seed: 0.61 },
  { x: -60, y: 430, seed: 0.69 },
  { x: 80, y: 395, seed: 0.77 },
  { x: 205, y: 430, seed: 0.85 },
  { x: 15, y: 500, seed: 0.93 },
]

export function GhostDriftScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  return (
    <GalaxyStage scene={scene} t={t}>
      {DRIFT_SHEETS.map((sheet, i) => (
        <GhostSheet
          key={sheet.seed}
          t={t}
          at={i * 0.28}
          x={sheet.x}
          y={sheet.y}
          seed={sheet.seed}
        />
      ))}
      {/* growing unclaimed marker — state changes, no text wall */}
      <div
        style={{
          position: 'absolute',
          top: 262,
          insetInlineStart: '50%',
          transform: 'translateX(-50%)',
          width: 120,
          height: 3,
          borderRadius: 3,
          background: `linear-gradient(90deg, transparent, rgba(255,106,92,${0.5 * ease(clamp(progress(t, 2.6, 6.4))) * 2}), transparent)`,
        }}
      />
    </GalaxyStage>
  )
}

// ─── Scene 3 (11–19s) — Gravity ignition: the core bends the stream ─────────

const STREAM_PATHS = [
  'M 40 150 C 140 220, 220 330, 270 470',
  'M 500 140 C 400 230, 310 330, 270 470',
  'M 60 760 C 140 640, 210 560, 268 490',
  'M 480 780 C 410 660, 330 560, 274 492',
]

export function GravityIgniteScene({ t, scene }: { t: number; scene: Scene }) {
  const core = pop(t, 0.15, 1.1)
  return (
    <GalaxyStage scene={scene} t={t}>
      {STREAM_PATHS.map((d, i) => (
        <FieldLine
          key={i}
          t={t}
          at={0.3 + i * 0.4}
          d={d}
          from={i % 2 ? NEBULA_VIOLET : STAR_CYAN}
        />
      ))}
      {STREAM_PATHS.map((_, i) => (
        <GhostSheet
          key={`g-${i}`}
          t={t}
          at={1.0 + i * 0.85}
          x={(i % 2 ? 1 : -1) * (150 - i * 22)}
          y={i % 2 ? 400 : 260}
          seed={0.2 + i * 0.17}
        />
      ))}
      {/* the core: a tri-point crystal of Hisabche light */}
      <div
        style={{
          position: 'absolute',
          top: 430,
          insetInlineStart: '50%',
          transform: `translate(-50%, -50%) scale(${mix(0.4, 1, core).toFixed(3)})`,
          width: 132,
          height: 132,
          borderRadius: '50%',
          background: `radial-gradient(circle at 50% 42%, rgba(255,255,255,0.9), ${NEBULA_VIOLET} 34%, transparent 70%)`,
          boxShadow: `0 0 ${60 + pulseGlow(t)}px ${NEBULA_VIOLET}, 0 0 140px rgba(127,216,255,0.35)`,
          opacity: clamp(core * 1.5),
        }}
      />
      {/* three function labels ignite with the core — one cluster, 3 words */}
      {['فروش', 'بهای', 'سود'].map((label, i) => {
        const p = pop(t, 1.2 + i * 0.5)
        const angle = (-90 + i * 120) * (Math.PI / 180)
        const bx = 270 + Math.cos(angle) * 148
        const by = 430 + Math.sin(angle) * 148
        return (
          <div
            key={label}
            style={{
              position: 'absolute',
              top: by - 16,
              insetInlineStart: bx,
              transform: `translate(-50%, -50%) scale(${mix(0.4, 1, p).toFixed(3)})`,
              opacity: clamp(p * 1.6),
              fontSize: 20,
              fontWeight: 900,
              color: STAR_GOLD,
              textShadow: `0 0 22px ${STAR_GOLD}88`,
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
        )
      })}
    </GalaxyStage>
  )
}

function pulseGlow(t: number): number {
  return 18 * (0.5 + 0.5 * Math.sin(t * 2.2))
}

// ─── Scene 4 (19–30s) — The orbit ledger: everything claims its place ───────

interface OrbitToken {
  label: string
  value: number
  color: string
  cy: number
  radiusX: number
  radiusY: number
  spin: number
  phase: number
  at: number
}

/**
 * Two horizontal orbit lanes above and below the ledger core: the y-bands of
 * the lanes are disjoint, so tokens can never collide no matter the spin or
 * phase (layout-defect-laws.md band 3 — overlapping is banned).
 */
const ORBIT_TOKENS: OrbitToken[] = [
  {
    label: 'فروش',
    value: 7320000,
    color: STAR_CYAN,
    cy: 318,
    radiusX: 160,
    radiusY: 55,
    spin: 0.5,
    phase: 0.0,
    at: 0.25,
  },
  {
    label: 'بهای',
    value: 4610000,
    color: NEBULA_VIOLET,
    cy: 318,
    radiusX: 160,
    radiusY: 55,
    spin: 0.5,
    phase: 0.52,
    at: 0.7,
  },
  {
    label: 'سود',
    value: 2710000,
    color: STAR_GOLD,
    cy: 612,
    radiusX: 140,
    radiusY: 58,
    spin: -0.62,
    phase: 0.22,
    at: 1.15,
  },
  {
    label: 'طلب',
    value: 1950000,
    color: STAR_CYAN,
    cy: 612,
    radiusX: 140,
    radiusY: 58,
    spin: -0.62,
    phase: 0.74,
    at: 1.6,
  },
]

export function OrbitLedgerScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const inventoryIn = pop(t, 3.6)
  return (
    <GalaxyStage scene={scene} t={t}>
      {/* the orbit track */}
      <svg
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, width: 540, height: 960, pointerEvents: 'none' }}
      >
        <ellipse
          cx="270"
          cy="318"
          rx="160"
          ry="55"
          fill="none"
          stroke="rgba(127,216,255,0.3)"
          strokeWidth="1.6"
          strokeDasharray="5 9"
        />
        <ellipse
          cx="270"
          cy="612"
          rx="140"
          ry="58"
          fill="none"
          stroke="rgba(139,124,246,0.3)"
          strokeWidth="1.4"
          strokeDasharray="4 8"
        />
        {/* three brand-start rays as the ring completes */}
        {ease(clamp(progress(t, 7.2, 1.8))) > 0.05 &&
          [0, 1, 2].map((i) => {
            const a = (-90 + i * 36) * (Math.PI / 180)
            return (
              <circle
                key={i}
                cx={270 + Math.cos(a) * 178}
                cy={470 + Math.sin(a) * 82}
                r={3 + ease(clamp(progress(t, 7.2, 1.8))) * 2}
                fill={[STAR_CYAN, STAR_GOLD, NEBULA_VIOLET][i]}
                opacity={ease(clamp(progress(t, 7.2, 1.8))) * 0.9}
              />
            )
          })}
      </svg>
      {/* orbiting token cards — they enter once and stay in orbit */}
      {ORBIT_TOKENS.map((token) => {
        const entered = pop(t, token.at, 0.9)
        const angle = token.phase * Math.PI * 2 + t * Math.PI * 2 * token.spin * 0.06
        const x = 270 + Math.cos(angle) * token.radiusX * mix(0.2, 1, entered)
        const y = token.cy + Math.sin(angle) * token.radiusY * mix(0.2, 1, entered)
        return (
          <div
            key={token.label}
            style={{
              position: 'absolute',
              top: y - 34,
              insetInlineStart: x,
              transform: 'translate(-50%, -50%)',
              opacity: clamp(entered * 1.6),
            }}
          >
            <div
              style={{
                background: 'rgba(10,14,30,0.82)',
                border: `1.6px solid ${token.color}`,
                boxShadow: `0 12px 40px rgba(4,6,16,0.6), 0 0 26px ${token.color}55`,
                borderRadius: 14,
                padding: '10px 18px',
                minWidth: 148,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: token.color,
                  letterSpacing: '0.04em',
                }}
              >
                {token.label}
              </div>
              <div style={{ marginTop: 3 }}>
                <RollingNumber
                  t={t}
                  at={token.at + 0.5}
                  value={token.value}
                  color={token.color}
                  size={25}
                />
              </div>
            </div>
          </div>
        )
      })}
      {/* inventory count rides the core — persists after entering */}
      <div
        style={{
          position: 'absolute',
          top: 470,
          insetInlineStart: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          opacity: clamp(inventoryIn * 1.6),
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: STAR_CYAN, letterSpacing: '0.1em' }}>
          انبار
        </div>
        <RollingNumber t={t} at={3.9} value={214} color={STAR_CYAN} size={30} />
      </div>
    </GalaxyStage>
  )
}

// ─── Scene 5 (30–40s) — Re-entry: the orbit lands as a phone dashboard ──────

const ROW_COLORS = [STAR_CYAN, NEBULA_VIOLET, STAR_GOLD]

export function ReentryDashScene({ t, scene }: { t: number; scene: Scene }) {
  const dive = ease(clamp(progress(t, 0.4, 2.4)))
  const streakP = clamp(progress(t, 0.2, 2.2))
  const phone = pop(t, 2.2, 1.1)
  const rowsIn = [1.9, 2.35, 2.8].map((at) => pop(t, at, 0.7))
  const liveIn = pop(t, 4.4, 0.6)
  return (
    <GalaxyStage scene={scene} t={t}>
      {/* atmospheric streaks during dive */}
      {streakP > 0 &&
        streakP < 1 &&
        CLOUD_STREAKS.map((s, i) => {
          const st = (t * s.speed + s.offset) % 1
          const yy = st * 1060 - 60
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: yy,
                insetInlineStart: `calc(50% + ${s.x}px)`,
                width: 3,
                height: 90,
                borderRadius: 3,
                background: `linear-gradient(${s.deg}deg, transparent, ${s.color})`,
                opacity: Math.sin(st * Math.PI) * streakP * 0.75,
              }}
            />
          )
        })}
      {/* the descending orbit shrinks into the phone's crown */}
      <div
        style={{
          position: 'absolute',
          top: mix(430, 232, dive),
          insetInlineStart: '50%',
          transform: `translate(-50%, -50%) scale(${mix(1, 0.28, dive).toFixed(3)})`,
          width: 250,
          height: 90,
          borderRadius: '50%',
          border: `2px dashed rgba(127,216,255,${clamp(0.85 - dive * 0.55)})`,
          opacity: clamp(1.2 - dive),
        }}
      />
      {/* the shop's phone */}
      <div
        style={{
          position: 'absolute',
          top: mix(820, 370, phone),
          insetInlineStart: '50%',
          transform: `translateX(-50%) rotate(${mix(7, 0, phone).toFixed(1)}deg)`,
          width: 284,
          height: 356,
          background: '#0b0f22',
          borderRadius: 40,
          border: '3px solid rgba(127,216,255,0.5)',
          boxShadow: '0 46px 130px rgba(3,5,12,0.9), 0 0 70px rgba(127,216,255,0.22)',
          opacity: clamp(phone * 1.7),
          padding: '26px 22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 13,
        }}
      >
        {['فروش', 'بهای', 'سود'].map((label, i) => (
          <div
            key={label}
            dir="rtl"
            style={{
              background: 'rgba(238,241,255,0.06)',
              border: `1.4px solid ${ROW_COLORS[i]}`,
              boxShadow: i === 2 ? `0 0 26px ${ROW_COLORS[i]}55` : 'none',
              borderRadius: 14,
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              opacity: clamp(rowsIn[i] * 1.6),
              transform: `translateY(${mix(14, 0, rowsIn[i]).toFixed(1)}px)`,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 800, color: ROW_COLORS[i] }}>{label}</span>
            <RollingNumber
              t={t}
              at={2.3 + i * 0.45}
              value={[7320000, 4610000, 2710000][i]}
              color={i === 2 ? '#eef1ff' : ROW_COLORS[i]}
              size={24}
            />
          </div>
        ))}
        {/* live sync pill */}
        <div
          style={{
            marginTop: 2,
            alignSelf: 'center',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(63,242,199,0.12)',
            border: '1px solid rgba(63,242,199,0.6)',
            color: '#3ff2c7',
            borderRadius: 999,
            padding: '7px 18px',
            fontSize: 14,
            fontWeight: 900,
            opacity: clamp(liveIn * 1.5),
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: '#3ff2c7',
              opacity: 0.55 + 0.45 * Math.sin(t * 5),
              boxShadow: '0 0 12px #3ff2c7',
            }}
          />
          آنلاین
        </div>
      </div>
    </GalaxyStage>
  )
}

const CLOUD_STREAKS = [
  { x: -150, speed: 0.8, offset: 0.01, deg: 100, color: 'rgba(127,216,255,0.7)' },
  { x: -90, speed: 1.15, offset: 0.35, deg: 104, color: 'rgba(238,241,255,0.6)' },
  { x: 60, speed: 0.95, offset: 0.5, deg: 98, color: 'rgba(139,124,246,0.65)' },
  { x: 132, speed: 1.3, offset: 0.16, deg: 106, color: 'rgba(255,215,106,0.55)' },
  { x: -30, speed: 1.05, offset: 0.68, deg: 102, color: 'rgba(238,241,255,0.5)' },
  { x: 190, speed: 0.85, offset: 0.42, deg: 108, color: 'rgba(127,216,255,0.55)' },
]

// ─── Scene 6 (40–45s) — End card: brand lockup + CTA (full-opacity hold) ────

export function GalaxyCtaScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const lock = pop(t, 0.3, 0.8)
  const cta = pop(t, 0.9, 0.7)
  return (
    <GalaxyStage scene={scene} t={t}>
      {/* constellation emblem: dots + drawn links */}
      <svg
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, width: 540, height: 960, pointerEvents: 'none' }}
      >
        {[
          { x: 270, y: 300 },
          { x: 216, y: 336 },
          { x: 324, y: 336 },
          { x: 238, y: 380 },
          { x: 302, y: 380 },
        ].map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={5}
            fill={i === 0 ? STAR_GOLD : STAR_CYAN}
            opacity={clamp(lock * 1.6)}
            style={{ filter: 'drop-shadow(0 0 10px rgba(255,215,106,0.8))' }}
          />
        ))}
        <line
          x1="270"
          y1="300"
          x2="216"
          y2="336"
          stroke={STAR_CYAN}
          strokeWidth="1.6"
          opacity={clamp(lock * 1.2)}
        />
        <line
          x1="270"
          y1="300"
          x2="324"
          y2="336"
          stroke={STAR_CYAN}
          strokeWidth="1.6"
          opacity={clamp(lock * 1.2)}
        />
        <line
          x1="216"
          y1="336"
          x2="238"
          y2="380"
          stroke={NEBULA_VIOLET}
          strokeWidth="1.4"
          opacity={clamp(lock * 1.2)}
        />
        <line
          x1="324"
          y1="336"
          x2="302"
          y2="380"
          stroke={NEBULA_VIOLET}
          strokeWidth="1.4"
          opacity={clamp(lock * 1.2)}
        />
      </svg>
      {/* wordmark */}
      <div
        style={{
          position: 'absolute',
          top: 402,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 66,
          fontWeight: 900,
          color: CANVAS_PAPER,
          textShadow: '0 0 60px rgba(127,216,255,0.45)',
          opacity: clamp(lock * 1.6),
          transform: `translateY(${mix(14, 0, lock).toFixed(1)}px)`,
        }}
      >
        حسابچه
      </div>
      {/* gradient underline */}
      <div
        style={{
          position: 'absolute',
          top: 508,
          insetInlineStart: '50%',
          transform: 'translateX(-50%)',
          width: mix(0, 210, lock),
          height: 6,
          borderRadius: 6,
          background: `linear-gradient(90deg, ${STAR_CYAN}, ${STAR_GOLD}, ${NEBULA_VIOLET})`,
          boxShadow: '0 0 32px rgba(255,215,106,0.65)',
          opacity: clamp(lock * 1.4),
        }}
      />
      {/* CTA pill — in by 0.3s, holds to the end (>= 3s full opacity) */}
      <div
        style={{
          position: 'absolute',
          top: 556,
          insetInlineStart: '50%',
          transform: `translateX(-50%) scale(${mix(0.3, 1, cta).toFixed(3)})`,
          opacity: clamp(cta * 1.7),
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${STAR_CYAN}, ${STAR_GOLD})`,
            color: '#0a0d1c',
            fontSize: 30,
            fontWeight: 900,
            padding: '14px 54px',
            borderRadius: 999,
            boxShadow: '0 24px 60px rgba(4,6,16,0.65), 0 0 44px rgba(127,216,255,0.5)',
          }}
        >
          شروع رایگان
        </div>
      </div>
      <div
        dir="ltr"
        style={{
          position: 'absolute',
          top: 648,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
          fontSize: 15,
          letterSpacing: '0.24em',
          color: 'rgba(200,214,255,0.75)',
          opacity: clamp(cta * 1.3),
        }}
      >
        hisabche.com
      </div>
    </GalaxyStage>
  )
}
