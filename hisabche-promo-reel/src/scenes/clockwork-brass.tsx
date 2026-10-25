// ============================================
// Clockwork-Brass art direction (reel 88) — «ساعت صفر»
//
// The shop's day is a hand-wound brass movement that can never reach midnight:
// three jammed gear clusters (صندوق، انبار، دفتر) grind against each other at
// ۱۱:۵۹. One polished Hisabche hub-gear descends, meshes, and the whole
// train engages — the hands sweep cleanly to ۱۲:۰۰:۰۰, the gear teeth become
// ledger rows, the balance seals «تراز.», and the shutter locks itself.
//
// Fully self-authored engineering: its own palette, primitives, gear math and
// transition vocabulary — nothing is shared with the 84–87 film kits.
//
// One persistent arithmetic: ۷۶۲٬۰۰۰ فروش − ۴۵۰٬۰۰۰ بهای تمام‌شده
//                             − ۸۷٬۰۰۰ خرج = ۲۲۵٬۰۰۰ سود
// ============================================

import type { CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, deterministicHash, ease, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

// ─── Tokens ──────────────────────────────────────────────────────────────────

export const WORKSHOP_NIGHT = '#14110c'
export const BRASS = '#d9a441'
export const COPPER = '#a05c22'
export const AMBER = '#ffb84d'
export const PATINA = '#7fae83'
export const CREAM = '#f2ead6'
export const FORGE_RED = '#e2543e'

const WARM_WASH: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(880px 520px at 50% 30%, rgba(255,184,77,0.10), transparent 62%), radial-gradient(720px 460px at 22% 64%, rgba(160,92,34,0.14), transparent 60%), radial-gradient(700px 430px at 80% 72%, rgba(217,164,65,0.08), transparent 62%)',
}

const NIGHT_VIGNETTE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(115% 86% at 50% 44%, transparent 50%, rgba(8,6,3,0.9) 100%)',
}

/** Warm workbench backdrop: mechanism bench grain + hanging tool silhouettes. */
function BenchBackdrop({ t }: { t: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={WARM_WASH} />
      {/* bench plank streaks — physical texture, no divider lines */}
      {Array.from({ length: 7 }).map((_, i) => {
        const seed = deterministicHash(i, 41)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 120 + i * 128 + Math.sin(t * 0.4 + seed * 5) * 2,
              insetInlineStart: seed * 60,
              width: 420 + seed * 90,
              height: 44,
              borderRadius: 12,
              background: `linear-gradient(120deg, rgba(64,44,20,${0.32 - seed * 0.1}), rgba(30,20,10,0.5))`,
              opacity: 0.5,
            }}
          />
        )
      })}
      {/* two hanging lamps breathing with forge warmth */}
      {[0.22, 0.78].map((lx, i) => (
        <div
          key={lx}
          style={{
            position: 'absolute',
            top: 64,
            insetInlineStart: `${lx * 100}%`,
            transform: 'translateX(-50%)',
            width: 12,
            height: 54,
            background: 'rgba(64,44,20,0.8)',
            transition: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 50,
              insetInlineStart: -21,
              width: 54,
              height: 34,
              borderRadius: '16px 16px 8px 8px',
              background: AMBER,
              filter: 'blur(3px)',
              opacity: 0.55 + 0.2 * Math.sin(t * 2.4 + i * 2) + 0.12,
              boxShadow: `0 0 ${36 + 12 * Math.sin(t * 3 + i)}px rgba(255,184,77,0.7)`,
            }}
          />
        </div>
      ))}
      <div style={NIGHT_VIGNETTE} />
    </div>
  )
}

export function BrassStage({
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
        background: WORKSHOP_NIGHT,
        overflow: 'hidden',
        color: CREAM,
      }}
    >
      <BenchBackdrop t={t} />
      {children}
    </div>
  )
}

function pop(t: number, at: number, dur = 0.55): number {
  return spring(clamp(progress(t, at, at + dur)))
}

/** A real gear drawn in SVG: hub, rim, N rectangular teeth, deterministic spin. */
function Gear({
  t,
  x,
  y,
  radius,
  teeth,
  spin,
  phase = 0,
  metal = BRASS,
  at = 0,
  hubLabel,
}: {
  t: number
  x: number
  y: number
  radius: number
  teeth: number
  spin: number
  phase?: number
  metal?: string
  at?: number
  hubLabel?: string | undefined
}) {
  const p = pop(t, at, 0.9)
  const angle = phase + spin * t
  const toothH = radius * 0.16
  return (
    <div
      style={{
        position: 'absolute',
        top: y - radius,
        insetInlineStart: x - radius,
        width: radius * 2 + toothH * 2,
        height: radius * 2 + toothH * 2,
        opacity: clamp(p * 1.7),
        transform: `scale(${mix(0.5, 1, p).toFixed(3)}) rotate(${mix(24, 0, p).toFixed(2)}deg)`,
      }}
    >
      <svg viewBox="0 0 320 320" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        <g transform={`translate(160 160) rotate(${((angle / (Math.PI * 2)) * 360).toFixed(3)})`}>
          {Array.from({ length: teeth }).map((_, i) => {
            const a = (i / teeth) * 360
            return (
              <rect
                key={i}
                x={-8}
                y={-radius - toothH / 2}
                width={16}
                height={toothH + 4}
                rx={4}
                fill={metal}
                transform={`rotate(${a})`}
                opacity="0.95"
              />
            )
          })}
          <circle r={radius} fill="none" stroke={metal} strokeWidth={radius * 0.18} />
          <circle r={radius * 0.62} fill="rgba(24,17,8,0.85)" stroke={metal} strokeWidth="3" />
          {/* spokes */}
          {[0, 60, 120].map((a) => (
            <rect
              key={a}
              x={-6}
              y={-radius * 0.62}
              width={12}
              height={radius * 1.24}
              rx={6}
              fill={metal}
              opacity="0.35"
              transform={`rotate(${a})`}
            />
          ))}
          <circle r={radius * 0.2} fill={metal} />
        </g>
      </svg>
      {hubLabel && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            fontWeight: 900,
            color: CREAM,
            textShadow: '0 1px 8px rgba(0,0,0,0.8)',
            transform: `translateY(${(Math.sin(t * spin + phase) * 0.9).toFixed(2)}px)`,
          }}
        >
          {hubLabel}
        </div>
      )}
    </div>
  )
}

/** The shop clock: dot markers, a minute hand that trembles then sweeps. */
function ShopClock({
  t,
  x = 270,
  y = 402,
  radius = 150,
  stuck = true,
  sweepAt = -1,
}: {
  t: number
  x?: number
  y?: number
  radius?: number
  stuck?: boolean
  sweepAt?: number
}) {
  const jitter = stuck ? Math.sin(t * 26) * 0.8 : 0
  // 11:59:59 -> 12:00:00 hand evolution (never negative, clamped motion).
  const handTurn = stuck ? 0 : ease(clamp(progress(t, sweepAt, 2.4)))
  // -1 minute from 12:00 baseline, then travels the final minute arc.
  const minuteAngle = -359.85 + handTurn * 5.99
  const hourAngle = -1.0 + handTurn * 0.5
  return (
    <div
      style={{
        position: 'absolute',
        top: y - radius,
        insetInlineStart: x - radius,
        width: radius * 2,
        height: radius * 2,
      }}
    >
      <svg viewBox="0 0 320 320" style={{ width: '100%', height: '100%' }}>
        <circle
          cx="160"
          cy="160"
          r="150"
          fill="rgba(26,19,9,0.92)"
          stroke={BRASS}
          strokeWidth="7"
        />
        <circle
          cx="160"
          cy="160"
          r="136"
          fill="none"
          stroke="rgba(217,164,65,0.25)"
          strokeWidth="1.5"
        />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2
          return (
            <circle
              key={i}
              cx={160 + Math.cos(a) * 124}
              cy={160 + Math.sin(a) * 124}
              r={i % 3 === 0 ? 5 : 3}
              fill={BRASS}
              opacity={i === 0 ? 1 : 0.55}
            />
          )
        })}
        {/* minute hand — trembling at the 11:59 mark until released */}
        <g transform={`rotate(${minuteAngle + jitter} 160 160)`}>
          <rect x={157} y={44} width={6} height={120} rx={3} fill={CREAM} />
        </g>
        {/* hour hand */}
        <g transform={`rotate(${hourAngle} 160 160)`}>
          <rect x={156.5} y={84} width={7} height={80} rx={3.5} fill={AMBER} />
        </g>
        <circle cx="160" cy="160" r="9" fill={BRASS} stroke="rgba(0,0,0,0.4)" strokeWidth="2" />
      </svg>
    </div>
  )
}

/** A rolling money figure rendered as an engraved brass counter. */
function EngravedNumber({
  t,
  at,
  value,
  color = BRASS,
  size = 30,
}: {
  t: number
  at: number
  value: number
  color?: string
  size?: number
}) {
  const p = ease(clamp(progress(t, at, 1.4)))
  const n = Math.round(mix(0, value, p))
  return (
    <span
      dir="ltr"
      style={{
        fontSize: size,
        fontWeight: 900,
        color,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.05,
        textShadow: `0 0 16px ${color}44`,
        whiteSpace: 'nowrap',
      }}
    >
      {faNumber(n)}
    </span>
  )
}

// ─── Scene 1 (0–3.5s) — Frame-0: the movement stops one tooth short ─────────

export function ClockStuckScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const stamped = pop(t, 0.1, 0.8)
  return (
    <BrassStage scene={scene} t={t}>
      {/* a dead small gear mid-frame — the visual transient */}
      <Gear
        t={t}
        x={150}
        y={172}
        radius={52}
        teeth={10}
        spin={0}
        phase={0.31}
        at={0.05}
        metal={COPPER}
      />
      <ShopClock t={t} x={270} y={452} radius={148} stuck />
      {/* single word cluster — 3 words, staged, persistent */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 646,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'baseline',
          gap: '0.32em',
        }}
      >
        <span
          dir="ltr"
          style={{
            opacity: clamp(stamped * 1.6),
            fontSize: 44,
            fontWeight: 900,
            color: FORGE_RED,
            fontFamily: "'JetBrains Mono', monospace",
            textShadow: `0 0 26px ${FORGE_RED}`,
          }}
        >
          ۱۱:۵۹
        </span>
        {['مغازه', 'بازه…'].map((word, i) => (
          <span
            key={word}
            style={{
              opacity: clamp(pop(t, 0.55 + i * 0.4) * 1.5),
              fontSize: 32,
              fontWeight: 900,
              color: CREAM,
              whiteSpace: 'pre',
            }}
          >
            {word}
          </span>
        ))}
      </div>
    </BrassStage>
  )
}

// ─── Scene 2 (3.5–9.5s) — Three jammed clusters grinding against each other ─

const GRINDING_CLUSTERS = [
  { x: 150, y: 262, label: 'صندوق', teeth: 12, radius: 74, seed: 0.19 },
  { x: 400, y: 340, label: 'انبار', teeth: 9, radius: 88, seed: 0.47 },
  { x: 205, y: 560, label: 'دفتر', teeth: 11, radius: 80, seed: 0.71 },
]

export function GrindingGearsScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const seizeSpark = pop(t, 3.9, 0.5)
  return (
    <BrassStage scene={scene} t={t}>
      {GRINDING_CLUSTERS.map((c, ci) => (
        <div key={c.label}>
          {/* a pair of teeth-pinning gears: near mesh, impossible closure */}
          <Gear
            t={t}
            x={c.x - 46}
            y={c.y}
            radius={c.radius}
            teeth={c.teeth}
            // grinding: fast, jittering rotation that never advances
            spin={0.9 + seedWobble(c.seed) + Math.sin(t * 21) * 0.05}
            phase={c.seed}
            at={ci * 0.45}
            metal={ci % 2 ? BRASS : COPPER}
          />
          <Gear
            t={t}
            x={c.x + c.radius - 8}
            y={c.y + 6}
            radius={c.radius * 0.72}
            teeth={c.teeth - 3}
            spin={-(1.05 + seedWobble(c.seed))}
            phase={c.seed + 0.2}
            at={ci * 0.45 + 0.2}
            metal={ci % 2 ? COPPER : BRASS}
          />
          <ClampLabel
            t={t}
            at={ci * 0.55 + 0.3}
            x={c.x - 84}
            y={c.y + c.radius + 20}
            text={c.label}
          />
        </div>
      ))}
      {/* the seize: one burst of sparks where everything jams */}
      {Array.from({ length: 9 }).map((_, i) => {
        const a = deterministicHash(i, 63) * Math.PI * 2
        const d = ease(clamp(progress(t, 3.9, 0.8))) * (40 + deterministicHash(i, 71) * 60)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 402 + Math.sin(a) * d,
              insetInlineStart: 296 + Math.cos(a) * d,
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: i % 2 ? AMBER : FORGE_RED,
              opacity: clamp(seizeSpark * (1 - ease(clamp(progress(t, 3.9, 1.2))))),
              boxShadow: `0 0 10px ${AMBER}`,
            }}
          />
        )
      })}
    </BrassStage>
  )
}

function seedWobble(seed: number): number {
  return deterministicHash(seed + 5, 89) * 0.3
}

/** Tiny engraved metal tag — functional label, one word. */
function ClampLabel({
  t,
  at,
  x,
  y,
  text,
}: {
  t: number
  at: number
  x: number
  y: number
  text: string
}) {
  const p = pop(t, at, 0.6)
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        insetInlineStart: x,
        transform: `scale(${mix(0.5, 1, p).toFixed(3)})`,
        opacity: clamp(p * 1.6),
        background: 'rgba(26,19,9,0.9)',
        border: `1px solid ${BRASS}`,
        borderRadius: 8,
        padding: '4px 12px',
        fontSize: 15,
        fontWeight: 900,
        color: CREAM,
        whiteSpace: 'nowrap',
        boxShadow: '0 6px 20px rgba(0,0,0,0.55)',
      }}
    >
      {text}
    </div>
  )
}

// ─── Scene 3 (9.5–17s) — The Hisabche hub descends and takes first mesh ─────

export function HeroGearScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const descend = pop(t, 0.2, 1.2)
  const mesh = clamp(progress(t, 3.9, 0.28))
  return (
    <BrassStage scene={scene} t={t}>
      {/* the jammed drive below */}
      <Gear
        t={t}
        x={196}
        y={560}
        radius={92}
        teeth={13}
        spin={0.9}
        phase={0.4}
        at={0}
        metal={COPPER}
      />
      <Gear
        t={t}
        x={352}
        y={596}
        radius={64}
        teeth={10}
        spin={-1.2}
        phase={0.77}
        at={0.2}
        metal={BRASS}
      />
      {/* the polished Hisabche hub, built and engraved */}
      <div
        style={{
          position: 'absolute',
          top: mix(120, 330, descend) - 96,
          insetInlineStart: 270 - 96,
          width: 192,
          height: 192,
        }}
      >
        <Gear
          t={t}
          x={96}
          y={96}
          radius={82}
          teeth={14}
          spin={mesh < 0.7 ? 0.5 : 0.4}
          phase={0}
          at={0}
          metal={AMBER}
          hubLabel="حسابچه"
        />
      </div>
      {/* first mesh flash */}
      <div
        style={{
          position: 'absolute',
          top: 500,
          insetInlineStart: 234,
          width: 90,
          height: 90,
          transform: `scale(${mix(0.3, 1.4, mesh).toFixed(2)})`,
          borderRadius: '50%',
          background: AMBER,
          filter: 'blur(14px)',
          opacity: clamp((1 - mesh) * 1.2),
        }}
      />
    </BrassStage>
  )
}

// ─── Scene 4 (17–25s) — Full train engages; the hands reach ۱۲:۰۰:۰۰ ────────

const TRAIN_X = [72, 152, 232, 312, 392, 472]

export function TrainMeshScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  return (
    <BrassStage scene={scene} t={t}>
      <ShopClock t={t} x={266} y={300} radius={132} stuck={false} sweepAt={3.2} />
      {/* the engaging cascade */}
      {TRAIN_X.map((x, i) => (
        <Gear
          key={x}
          t={t}
          x={x}
          y={560 + (i % 2 ? 40 : 0)}
          radius={i % 2 ? 54 : 66}
          teeth={8 + (i % 4)}
          spin={i % 2 ? 0.8 : -0.66}
          phase={i * 0.13}
          at={i * 0.42}
          metal={i % 2 ? COPPER : BRASS}
        />
      ))}
      {/* mesh sparks, staggered along the train */}
      {TRAIN_X.map((x, i) => {
        const sp = clamp(progress(t, i * 0.42 + 0.18, 0.3))
        return (
          <div
            key={`spark-${x}`}
            style={{
              position: 'absolute',
              top: 526 + (i % 2 ? 36 : -12),
              insetInlineStart: x + (i % 2 ? -52 : 44) - 4,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: AMBER,
              boxShadow: `0 0 16px ${AMBER}`,
              opacity: clamp(sp * (1 - sp)),
            }}
          />
        )
      })}
      {/* landing phrase — one cluster, two words */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 712,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: '0.3em',
          opacity: clamp(pop(t, 6.0, 0.6) * 1.5),
        }}
      >
        <span
          style={{ fontSize: 34, fontWeight: 900, color: PATINA, textShadow: `0 0 24px ${PATINA}` }}
        >
          جفت
        </span>
        <span style={{ fontSize: 34, fontWeight: 900, color: CREAM }}>شد.</span>
      </div>
    </BrassStage>
  )
}

// ─── Scene 5 (25–33s) — Teeth become ledger rows; the balance seals ─────────

const LEDGER_ROWS = [
  { label: 'فروش', value: 762000, color: CREAM, at: 0.35 },
  { label: 'بهای', value: 450000, color: COPPER, at: 0.85 },
  { label: 'خرج', value: 87000, color: COPPER, at: 1.35 },
  { label: 'سود', value: 225000, color: PATINA, at: 1.85 },
]

export function ToothLedgerScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const seal = pop(t, 5.0, 0.6)
  return (
    <BrassStage scene={scene} t={t}>
      {/* the movement plate as ledger frame */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 218,
          // Physical left: a logical inset is resolved against the element's
          // own direction — the rtl plate remapped it and slid its 396px body
          // off-frame (layout-defect-laws.md bands 1–2).
          left: '50%',
          transform: 'translateX(-50%)',
          width: 396,
          borderRadius: 22,
          border: `2.5px solid ${BRASS}`,
          background: 'linear-gradient(160deg, rgba(38,27,12,0.94), rgba(22,15,7,0.96))',
          boxShadow: '0 40px 110px rgba(5,3,1,0.85), inset 0 0 44px rgba(217,164,65,0.12)',
          padding: '26px 30px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {LEDGER_ROWS.map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <span
              style={{ fontSize: 17, fontWeight: 900, color: row.color, letterSpacing: '0.08em' }}
            >
              {row.label}
            </span>
            <EngravedNumber t={t} at={row.at} value={row.value} color={row.color} size={31} />
          </div>
        ))}
        {/* the closing equation strip (rought teeth line morphs into balance) */}
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            insetInlineStart: 30,
            insetInlineEnd: 30,
            height: 3,
            borderRadius: 3,
            background: `linear-gradient(90deg, ${BRASS}22, ${BRASS}, ${BRASS}22)`,
            opacity: clamp(progress(t, 3.4, 1.2)),
          }}
        />
      </div>
      {/* patina seal stamp with a physical micro-shake */}
      <div
        style={{
          position: 'absolute',
          top: 634,
          insetInlineStart: '50%',
          transform: `translateX(-50%) translateX(${((1 - seal) * (Math.sin(t * 34) * 5)).toFixed(
            1,
          )}px) scale(${mix(0.5, 1, seal).toFixed(3)})`,
          opacity: clamp(seal * 1.6),
        }}
      >
        <div
          style={{
            border: `2.5px solid ${PATINA}`,
            color: PATINA,
            borderRadius: 16,
            padding: '10px 30px',
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: '0.2em',
            boxShadow: `0 0 30px ${PATINA}66, inset 0 0 18px ${PATINA}22`,
          }}
        >
          تراز.
        </div>
      </div>
    </BrassStage>
  )
}

// ─── Scene 6 (33–40s) — The day closes itself: shutter, lock, calm glow ─────

const SHUTTER_SLOTS = 9

export function ShutterLockScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const closeP = ease(clamp(progress(t, 0.35, 3.4)))
  const closedCount = Math.min(SHUTTER_SLOTS, Math.ceil(closeP * SHUTTER_SLOTS))
  const lockP = pop(t, 4.05, 0.55)
  return (
    <BrassStage scene={scene} t={t}>
      {/* shutter blades: state change, never re-open */}
      {Array.from({ length: SHUTTER_SLOTS }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: 240 + i * 52,
            insetInlineStart: '50%',
            transform: 'translateX(-50%)',
            width: mix(430, 470, closeP),
            height: 46,
            borderRadius: 10,
            background: `linear-gradient(120deg, ${blendHex('#3a3428', '#241d12', i / SHUTTER_SLOTS)}, #191307)`,
            border: '1px solid rgba(217,164,65,0.25)',
            opacity: i < closedCount ? 1 : 0.12,
            boxShadow: i < closedCount ? '0 10px 30px rgba(0,0,0,0.5)' : 'none',
          }}
        />
      ))}
      {/* the key turns itself; a soft pocket glow answers from the dark */}
      <div
        style={{
          position: 'absolute',
          top: 752,
          insetInlineStart: '50%',
          transform: `translateX(-50%) rotate(${(lockP * 120 - 60).toFixed(1)}deg)`,
          width: 66,
          height: 10,
          borderRadius: 6,
          background: BRASS,
          opacity: clamp(lockP * 1.5),
          boxShadow: `0 0 24px ${BRASS}88`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 736,
          insetInlineStart: 'calc(50% + 96px)',
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: PATINA,
          filter: 'blur(10px)',
          opacity: clamp(lockP * (0.6 + 0.4 * Math.sin(t * 4))),
          boxShadow: `0 0 34px ${PATINA}`,
        }}
      />
    </BrassStage>
  )
}

/** A real sRGB blend of two hex colors — used for shutter plank shading. */
function blendHex(a: string, b: string, p: number): string {
  const ia = parseInt(a.slice(1), 16)
  const ib = parseInt(b.slice(1), 16)
  const ch = (sh: number) => Math.round(((ia >> sh) & 255) * (1 - p) + ((ib >> sh) & 255) * p)
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`
}

// ─── Scene 7 (40–45s) — End plate: engraved lockup + CTA hold ───────────────

export function BrassCtaScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const plate = pop(t, 0.3, 0.8)
  const cta = pop(t, 0.95, 0.7)
  return (
    <BrassStage scene={scene} t={t}>
      {/* engraved brass plate */}
      <div
        style={{
          position: 'absolute',
          top: 300,
          insetInlineStart: '50%',
          transform: `translateX(-50%) scale(${mix(0.4, 1, plate).toFixed(3)})`,
          opacity: clamp(plate * 1.7),
          background: 'linear-gradient(150deg, #6d4c19, #4a3312)',
          border: '3px solid rgba(217,164,65,0.85)',
          borderRadius: 24,
          padding: '30px 66px',
          boxShadow: '0 40px 110px rgba(4,2,0,0.8), inset 0 2px 10px rgba(255,255,255,0.08)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 62,
            fontWeight: 900,
            color: CREAM,
            textShadow: '0 2px 4px rgba(0,0,0,0.7)',
          }}
        >
          حسابچه
        </div>
        <div
          style={{
            marginTop: 12,
            width: 190,
            height: 5,
            borderRadius: 5,
            marginInline: 'auto',
            background: `linear-gradient(90deg, ${BRASS}, ${AMBER}, ${COPPER})`,
            boxShadow: `0 0 22px ${BRASS}`,
          }}
        />
      </div>
      {/* CTA — enters within 0.5s, holds at full opacity to the end */}
      <div
        style={{
          position: 'absolute',
          top: 568,
          insetInlineStart: '50%',
          transform: `translateX(-50%) scale(${mix(0.3, 1, cta).toFixed(3)})`,
          opacity: clamp(cta * 1.7),
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${AMBER}, ${BRASS})`,
            color: '#241a08',
            fontSize: 30,
            fontWeight: 900,
            padding: '14px 56px',
            borderRadius: 999,
            boxShadow: '0 26px 60px rgba(4,2,0,0.7), 0 0 40px rgba(255,184,77,0.5)',
          }}
        >
          شروع رایگان
        </div>
      </div>
      <div
        dir="ltr"
        style={{
          position: 'absolute',
          top: 656,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
          fontSize: 15,
          letterSpacing: '0.24em',
          color: 'rgba(242,234,214,0.75)',
          opacity: clamp(cta * 1.3),
        }}
      >
        hisabche.com
      </div>
    </BrassStage>
  )
}
