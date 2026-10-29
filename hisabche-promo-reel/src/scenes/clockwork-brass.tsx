// ============================================
// Clockwork-Brass art direction (reel 88) — «ساعت صفر»
//
// High-craft SaaS Motion Film: Jammed Operations to Autonomous Double-Entry Closure.
// Metaphor: Precision Horological Escapement & Tourbillon Double-Entry Differential.
//
// Scene 1 (0–3.5s): Chronograph Escapement Lock at ۱۱:۵۹
// Scene 2 (3.5–9.5s): Tri-Cluster Friction Grinding (صندوق، انبار، دفتر)
// Scene 3 (9.5–17s): Hisabche Master Differential Hub Descents & Meshes
// Scene 4 (17–25s): Synchronized Horological Train Engages & Clock Strikes 12
// Scene 5 (25–33s): Inscribed Master Balance Sheet & Mechanical Patina Seal
// Scene 6 (33–40s): Autonomous End-of-Shift Store Closure & Security Lock
// Scene 7 (40–45s): Brand Horology Climax & High-Conversion Action Hub
//
// Persistent arithmetic (via faNumber only — layout-defect-laws band 6):
//   ۷۶۲٬۰۰۰ فروش − ۴۵۰٬۰۰۰ بهای تمام‌شده − ۸۷٬۰۰۰ خرج = ۲۲۵٬۰۰۰ سود
// ============================================

import type { CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, deterministicHash, ease, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

// ─── Design Tokens ───────────────────────────────────────────────────────────

export const WORKSHOP_NIGHT = '#0c0a07'
export const BRASS = '#d9a441'
export const COPPER = '#b86a28'
export const AMBER = '#ffb84d'
export const PATINA = '#34d399'
export const CREAM = '#f4ebd8'
export const FORGE_RED = '#f87171'
export const BRASS_MUTED = 'rgba(244,235,216,0.68)'

const WARM_WASH: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(880px 520px at 50% 30%, rgba(255,184,77,0.12), transparent 64%), radial-gradient(720px 460px at 22% 64%, rgba(184,106,40,0.15), transparent 62%), radial-gradient(700px 430px at 80% 72%, rgba(217,164,65,0.10), transparent 64%)',
}

const NIGHT_VIGNETTE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(115% 86% at 50% 44%, transparent 48%, rgba(6,4,2,0.94) 100%)',
}

function pop(t: number, at: number, dur = 0.55): number {
  return spring(clamp(progress(t, at, at + dur)))
}

// ─── Stage & Backdrop ─────────────────────────────────────────────────────────

function BenchBackdrop({ t }: { t: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={WARM_WASH} />
      {/* Wooden workbench grain streaks */}
      {Array.from({ length: 6 }).map((_, i) => {
        const seed = deterministicHash(i, 41)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 130 + i * 140 + Math.sin(t * 0.4 + seed * 5) * 2,
              insetInlineStart: seed * 50,
              width: 440 + seed * 80,
              height: 48,
              borderRadius: 14,
              background: `linear-gradient(120deg, rgba(74,48,22,${0.28 - seed * 0.08}), rgba(26,16,8,0.45))`,
              opacity: 0.55,
            }}
          />
        )
      })}
      {/* Two warm incandescent lamps */}
      {[0.2, 0.8].map((lx, i) => (
        <div
          key={lx}
          style={{
            position: 'absolute',
            top: 50,
            insetInlineStart: `${lx * 100}%`,
            transform: 'translateX(-50%)',
            width: 14,
            height: 60,
            background: 'rgba(54,34,16,0.85)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 54,
              insetInlineStart: -22,
              width: 58,
              height: 36,
              borderRadius: '16px 16px 10px 10px',
              background: AMBER,
              filter: 'blur(3px)',
              opacity: 0.55 + 0.2 * Math.sin(t * 2.4 + i * 2),
              boxShadow: `0 0 ${40 + 12 * Math.sin(t * 3 + i)}px rgba(255,184,77,0.7)`,
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
  const p = ease(clamp(progress(t, at, at + 1.2)))
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
        textShadow: `0 0 16px ${color}55`,
        whiteSpace: 'nowrap',
      }}
    >
      {faNumber(n)}
    </span>
  )
}

// ─── Precision Gear Component ─────────────────────────────────────────────────

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
  const p = pop(t, at, 0.8)
  const angle = phase + spin * t
  const toothH = radius * 0.16
  return (
    <div
      style={{
        position: 'absolute',
        top: y - radius - toothH,
        insetInlineStart: x - radius - toothH,
        width: (radius + toothH) * 2,
        height: (radius + toothH) * 2,
        opacity: clamp(p * 1.6),
        transform: `scale(${mix(0.85, 1, p).toFixed(3)})`,
      }}
    >
      <svg
        viewBox="0 0 320 320"
        style={{ width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
      >
        <g transform={`translate(160 160) rotate(${((angle / (Math.PI * 2)) * 360).toFixed(3)})`}>
          {Array.from({ length: teeth }).map((_, i) => {
            const a = (i / teeth) * 360
            return (
              <rect
                key={i}
                x={-7}
                y={-radius - toothH + 2}
                width={14}
                height={toothH + 6}
                rx={4}
                fill={metal}
                transform={`rotate(${a})`}
                opacity="0.95"
              />
            )
          })}
          <circle r={radius} fill="none" stroke={metal} strokeWidth={radius * 0.18} />
          <circle r={radius * 0.64} fill="rgba(20,14,8,0.9)" stroke={metal} strokeWidth="3" />
          {/* Spokes */}
          {[0, 60, 120].map((a) => (
            <rect
              key={a}
              x={-5}
              y={-radius * 0.64}
              width={10}
              height={radius * 1.28}
              rx={5}
              fill={metal}
              opacity="0.4"
              transform={`rotate(${a})`}
            />
          ))}
          <circle r={radius * 0.22} fill={metal} />
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
            fontSize: 14,
            fontWeight: 900,
            color: CREAM,
            textShadow: '0 2px 8px rgba(0,0,0,0.9)',
          }}
        >
          {hubLabel}
        </div>
      )}
    </div>
  )
}

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
  const jitter = stuck ? Math.sin(t * 28) * 0.9 : 0
  const handTurn = stuck ? 0 : ease(clamp(progress(t, sweepAt, sweepAt + 1.8)))
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
          fill="rgba(24,17,8,0.94)"
          stroke={BRASS}
          strokeWidth="7"
        />
        <circle
          cx="160"
          cy="160"
          r="136"
          fill="none"
          stroke="rgba(217,164,65,0.3)"
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
        {/* Minute hand */}
        <g transform={`rotate(${minuteAngle + jitter} 160 160)`}>
          <rect x={157} y={44} width={6} height={120} rx={3} fill={CREAM} />
        </g>
        {/* Hour hand */}
        <g transform={`rotate(${hourAngle} 160 160)`}>
          <rect x={156.5} y={84} width={7} height={80} rx={3.5} fill={AMBER} />
        </g>
        <circle cx="160" cy="160" r="9" fill={BRASS} stroke="rgba(0,0,0,0.5)" strokeWidth="2" />
      </svg>
    </div>
  )
}

// ─── Scene 1 (0–3.5s): Chronograph Escapement Lock at ۱۱:۵۹ ───────────────────

export function ClockStuckScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: impact
  // 0.4s: clockTickRapid
  // 1.6s: tick
  // 2.4s: softTransition
  const impactP = pop(t, 0.0, 0.6)

  return (
    <BrassStage scene={scene} t={t}>
      {/* Shift End Telemetry Alert */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          insetInlineStart: 44,
          width: 452,
          height: 44,
          borderRadius: 12,
          background: 'rgba(24,14,8,0.9)',
          border: '1.5px solid rgba(248,113,113,0.35)',
          boxShadow: '0 10px 28px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 45,
          opacity: clamp(impactP * 1.5),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: FORGE_RED,
              boxShadow: `0 0 10px ${FORGE_RED}`,
            }}
          />
          <span dir="rtl" style={{ fontSize: 14, fontWeight: 800, color: FORGE_RED }}>
            پایان شیفت کاری: عدم تطابق تراز دخل
          </span>
        </div>
        <div dir="rtl" style={{ fontSize: 13, fontWeight: 700, color: CREAM }}>
          زمان متوقف: ۱۱:۵۹
        </div>
      </div>

      <Gear
        t={t}
        x={140}
        y={180}
        radius={54}
        teeth={10}
        spin={0}
        phase={0.3}
        at={0.05}
        metal={COPPER}
      />

      <ShopClock t={t} x={270} y={450} radius={148} stuck />

      {/* Persistent Word Cluster */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 648,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'baseline',
          gap: '0.34em',
        }}
      >
        <span
          dir="ltr"
          style={{
            fontSize: 44,
            fontWeight: 900,
            color: FORGE_RED,
            fontFamily: "'JetBrains Mono', monospace",
            textShadow: `0 0 26px ${FORGE_RED}`,
          }}
        >
          ۱۱:۵۹
        </span>
        <span style={{ fontSize: 36, fontWeight: 900, color: CREAM }}>مغازه</span>
        <span style={{ fontSize: 36, fontWeight: 900, color: AMBER }}>گیر کرده!</span>
      </div>
    </BrassStage>
  )
}

// ─── Scene 2 (3.5–9.5s): Tri-Cluster Friction Grinding ────────────────────────

const GRINDING_CLUSTERS = [
  { x: 140, y: 260, label: 'صندوق نقد', teeth: 12, radius: 72, seed: 0.19, color: COPPER },
  { x: 390, y: 320, label: 'موجودی انبار', teeth: 10, radius: 82, seed: 0.47, color: BRASS },
  { x: 210, y: 530, label: 'دفتر حسابداری', teeth: 11, radius: 76, seed: 0.71, color: COPPER },
]

export function GrindingGearsScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: cinematicReveal
  // 0.3s, 0.75s, 1.2s: cardEnter
  // 3.9s: majorReveal (sparks)
  // 4.9s: alert (warning meter)
  const sparkP = pop(t, 3.9, 0.6)
  const alertP = pop(t, 4.9, 0.6)

  return (
    <BrassStage scene={scene} t={t}>
      {/* Headline */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 110,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 38,
          fontWeight: 900,
          color: CREAM,
        }}
      >
        سه دندهٔ <span style={{ color: FORGE_RED }}>قفل‌شده</span>
      </div>

      {GRINDING_CLUSTERS.map((c, ci) => (
        <div key={c.label}>
          <Gear
            t={t}
            x={c.x}
            y={c.y}
            radius={c.radius}
            teeth={c.teeth}
            spin={0.9 + Math.sin(t * 22) * 0.06}
            phase={c.seed}
            at={ci * 0.45}
            metal={c.color}
          />
          {/* Label Tag */}
          <div
            dir="rtl"
            style={{
              position: 'absolute',
              top: c.y + c.radius + 18,
              insetInlineStart: c.x - 56,
              background: 'rgba(26,18,10,0.92)',
              border: `1.5px solid ${c.color}`,
              borderRadius: 8,
              padding: '4px 12px',
              fontSize: 14,
              fontWeight: 900,
              color: CREAM,
              boxShadow: '0 8px 22px rgba(0,0,0,0.6)',
              zIndex: 35,
            }}
          >
            {c.label}
          </div>
        </div>
      ))}

      {/* Friction Seize Sparks */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = deterministicHash(i, 63) * Math.PI * 2
        const d = ease(clamp(progress(t, 3.9, 4.7))) * (45 + deterministicHash(i, 71) * 60)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 390 + Math.sin(a) * d,
              insetInlineStart: 280 + Math.cos(a) * d,
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: i % 2 ? AMBER : FORGE_RED,
              opacity: clamp(sparkP * (1 - ease(clamp(progress(t, 3.9, 5.0))))),
              boxShadow: `0 0 12px ${AMBER}`,
              zIndex: 40,
            }}
          />
        )
      })}

      {/* Bottom Telemetry Warning Banner */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 54,
          insetInlineStart: 44,
          width: 452,
          height: 48,
          borderRadius: 12,
          background: 'rgba(24,14,8,0.92)',
          border: `1.5px solid ${alertP > 0.4 ? FORGE_RED : 'rgba(255,184,77,0.3)'}`,
          boxShadow: `0 10px 28px rgba(0,0,0,0.6), 0 0 ${alertP * 24}px ${FORGE_RED}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          zIndex: 45,
          opacity: clamp(pop(t, 1.4, 0.7) * 1.5),
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: FORGE_RED }} />
        <span style={{ fontSize: 14, fontWeight: 800, color: CREAM }}>
          عدم انطباق فاکتورها با موجودی انبار: توقف جریان تسویه
        </span>
      </div>
    </BrassStage>
  )
}

// ─── Scene 3 (9.5–17s): Hisabche Differential Hub Descents & Meshes ───────────

export function HeroGearScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: whoosh
  // 3.9s: bigReveal
  // 4.2s: titleHit (mesh click)
  // 4.6s: insightReveal (resonance wave)
  const descend = pop(t, 0.2, 1.2)
  const meshP = pop(t, 4.2, 0.5)

  return (
    <BrassStage scene={scene} t={t}>
      {/* Headline */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 110,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 38,
          fontWeight: 900,
          color: CREAM,
        }}
      >
        حسابچه <span style={{ color: AMBER }}>وارد می‌شود.</span>
      </div>

      {/* Lower Drive Gears */}
      <Gear
        t={t}
        x={180}
        y={570}
        radius={92}
        teeth={13}
        spin={0.8}
        phase={0.4}
        at={0}
        metal={COPPER}
      />
      <Gear
        t={t}
        x={356}
        y={590}
        radius={66}
        teeth={10}
        spin={-1.1}
        phase={0.7}
        at={0.2}
        metal={BRASS}
      />

      {/* Descending Master Hisabche Hub Gear */}
      <Gear
        t={t}
        x={270}
        y={mix(130, 360, descend)}
        radius={88}
        teeth={14}
        spin={0.45}
        phase={0}
        at={0}
        metal={AMBER}
        hubLabel="حسابچه"
      />

      {/* Resonance Mesh Pulse on 4.2s titleHit */}
      {meshP > 0.05 && (
        <div
          style={{
            position: 'absolute',
            top: 360 - 90,
            insetInlineStart: 270 - 90,
            width: 180,
            height: 180,
            borderRadius: '50%',
            border: `3px solid ${AMBER}`,
            boxShadow: `0 0 40px ${AMBER}`,
            transform: `scale(${mix(0.6, 1.8, meshP)})`,
            opacity: clamp(1 - meshP),
            pointerEvents: 'none',
          }}
        />
      )}
    </BrassStage>
  )
}

// ─── Scene 4 (17–25s): Synchronized Horological Train Engages ─────────────────
// Train X Layout: Hand-tuned mesh distances so pitch circles connect without collision.
// Centers: x = 60, 144, 228, 312, 396, 480 (step: 84px).

const TRAIN_SPECS = [
  { x: 60, y: 550, r: 50, teeth: 8, spin: -0.8, metal: COPPER },
  { x: 144, y: 590, r: 50, teeth: 8, spin: 0.8, metal: BRASS },
  { x: 228, y: 550, r: 50, teeth: 8, spin: -0.8, metal: COPPER },
  { x: 312, y: 590, r: 50, teeth: 8, spin: 0.8, metal: BRASS },
  { x: 396, y: 550, r: 50, teeth: 8, spin: -0.8, metal: COPPER },
  { x: 480, y: 590, r: 50, teeth: 8, spin: 0.8, metal: BRASS },
]

export function TrainMeshScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: precisionSequence
  // 3.2s: cash (Clock strikes 12)
  // 4.2s: chime (Harmonic resolution)
  // 6.0s: successResolution
  const successP = pop(t, 6.0, 0.6)

  return (
    <BrassStage scene={scene} t={t}>
      <ShopClock t={t} x={270} y={280} radius={130} stuck={false} sweepAt={3.2} />

      {/* Engaging Gear Train */}
      {TRAIN_SPECS.map((g, i) => (
        <Gear
          key={g.x}
          t={t}
          x={g.x}
          y={g.y}
          radius={g.r}
          teeth={g.teeth}
          spin={g.spin}
          phase={i * 0.15}
          at={i * 0.3}
          metal={g.metal}
        />
      ))}

      {/* Resolution Word Cluster */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 710,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
          opacity: clamp(successP * 1.5),
        }}
      >
        <span
          style={{ fontSize: 36, fontWeight: 900, color: PATINA, textShadow: `0 0 24px ${PATINA}` }}
        >
          جفت شد،
        </span>
        <span style={{ fontSize: 36, fontWeight: 900, color: CREAM }}>آزاد شد.</span>
      </div>
    </BrassStage>
  )
}

// ─── Scene 5 (25–33s): Inscribed Master Balance Sheet & Mechanical Seal ───────

const LEDGER_ROWS = [
  { label: 'فروش ناخالص کل', value: 762000, color: CREAM, at: 0.35 },
  { label: 'بهای تمام‌شده کالا', value: 450000, color: COPPER, at: 0.85 },
  { label: 'هزینه‌های جاری و اداری', value: 87000, color: COPPER, at: 1.35 },
  { label: 'سود خالص قطعی دوره', value: 225000, color: PATINA, at: 1.85, isProfit: true },
]

export function ToothLedgerScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: dataFlow
  // 0.35s, 0.85s, 1.35s: cardEnter
  // 1.85s: financialMilestone
  // 5.0s: majorReveal (Seal stamp)
  const seal = pop(t, 5.0, 0.6)

  return (
    <BrassStage scene={scene} t={t}>
      {/* Master Financial Tablet (x: 48, w: 444, y: 180, h: 370) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 180,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 444,
          borderRadius: 24,
          border: `2.5px solid ${BRASS}`,
          background: 'linear-gradient(160deg, rgba(36,25,12,0.95), rgba(18,12,6,0.98))',
          boxShadow: '0 36px 90px rgba(0,0,0,0.85), inset 0 0 40px rgba(217,164,65,0.14)',
          padding: '24px 28px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          zIndex: 30,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 900,
            color: AMBER,
            borderBottom: '1px solid rgba(217,164,65,0.3)',
            paddingBottom: 10,
          }}
        >
          ترازنامه رسمی پایان روز
        </div>

        {LEDGER_ROWS.map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 0',
            }}
          >
            <span
              style={{
                fontSize: row.isProfit ? 18 : 15,
                fontWeight: 900,
                color: row.color,
              }}
            >
              {row.label}
            </span>
            <EngravedNumber
              t={t}
              at={row.at}
              value={row.value}
              color={row.color}
              size={row.isProfit ? 30 : 25}
            />
          </div>
        ))}
      </div>

      {/* Mechanical Patina Wax Seal Stamp */}
      <div
        style={{
          position: 'absolute',
          top: 610,
          insetInlineStart: '50%',
          transform: `translateX(-50%) scale(${mix(0.5, 1, seal).toFixed(3)})`,
          opacity: clamp(seal * 1.6),
          zIndex: 40,
        }}
      >
        <div
          dir="rtl"
          style={{
            border: `2.5px solid ${PATINA}`,
            color: PATINA,
            borderRadius: 16,
            padding: '12px 34px',
            fontSize: 26,
            fontWeight: 900,
            boxShadow: `0 0 34px ${PATINA}66, inset 0 0 20px ${PATINA}25`,
            background: 'rgba(12,24,18,0.92)',
          }}
        >
          تراز قطعی · ۰ مغایرت
        </div>
      </div>
    </BrassStage>
  )
}

// ─── Scene 6 (33–40s): Autonomous End-of-Shift Store Closure (Soulful Night) ─

export function ShutterLockScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: cameraSwish (shop lights dim, night settles)
  // 4.05s: titleHit (heavy deadbolt locks into side rails)
  // 5.0s: softTransition (peace-of-mind emerald glow & reassurance)
  const closeP = ease(clamp(progress(t, 0.3, 3.4)))
  const lockP = pop(t, 4.05, 0.55)
  const peaceP = pop(t, 5.0, 0.7)

  const shutterTop = 190
  const shutterH = 480
  const curH = shutterH * closeP
  const slatCount = 10
  const slatH = shutterH / slatCount

  return (
    <BrassStage scene={scene} t={t}>
      {/* Night Sky Atmospheric Dimming Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(900px 600px at 50% 25%, rgba(12,18,34,0.7) 0%, rgba(4,6,10,0.92) 80%)',
          opacity: clamp(progress(t, 0.2, 2.5)),
          pointerEvents: 'none',
          zIndex: 15,
        }}
      />

      {/* Headline: Peace of Mind */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 104,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 36,
          fontWeight: 900,
          color: CREAM,
          zIndex: 45,
          textShadow: '0 2px 16px rgba(0,0,0,0.8)',
        }}
      >
        دخل تراز، <span style={{ color: PATINA }}>خیال راحت،</span> شب آرام.
      </div>

      {/* Architectural Shutter Frame & Guide Rails */}
      <div
        style={{
          position: 'absolute',
          top: shutterTop - 12,
          insetInlineStart: 38,
          width: 464,
          height: shutterH + 24,
          borderRadius: 24,
          border: '2px solid rgba(217,164,65,0.3)',
          background: 'rgba(8,10,16,0.85)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.9), inset 0 0 40px rgba(0,0,0,0.9)',
          overflow: 'hidden',
          zIndex: 25,
        }}
      >
        {/* Left & Right Industrial Steel Channel Tracks */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            insetInlineStart: 0,
            width: 22,
            background: 'linear-gradient(90deg, #1c150c, #2e2214 60%, #0e0a06)',
            borderInlineEnd: '1.5px solid rgba(217,164,65,0.4)',
            zIndex: 10,
          }}
        >
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                top: 30 + idx * 60,
                insetInlineStart: 6,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#4a3820',
                border: '1px solid rgba(217,164,65,0.5)',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.3)',
              }}
            />
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            insetInlineEnd: 0,
            width: 22,
            background: 'linear-gradient(270deg, #1c150c, #2e2214 60%, #0e0a06)',
            borderInlineStart: '1.5px solid rgba(217,164,65,0.4)',
            zIndex: 10,
          }}
        >
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                top: 30 + idx * 60,
                insetInlineStart: 6,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#4a3820',
                border: '1px solid rgba(217,164,65,0.5)',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.3)',
              }}
            />
          ))}
        </div>

        {/* Rolling Steel Shutter Curtain (Unrolls downward with real weight) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            insetInlineStart: 22,
            insetInlineEnd: 22,
            height: curH,
            overflow: 'hidden',
          }}
        >
          {Array.from({ length: slatCount }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: i * slatH,
                insetInlineStart: 0,
                insetInlineEnd: 0,
                height: slatH - 2,
                background:
                  i % 2 === 0
                    ? 'linear-gradient(180deg, #2a2216 0%, #1e170e 50%, #140f09 100%)'
                    : 'linear-gradient(180deg, #241c12 0%, #1a130c 50%, #100c07 100%)',
                borderTop: '1px solid rgba(217,164,65,0.35)',
                borderBottom: '1px solid rgba(0,0,0,0.8)',
                boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.06), 0 4px 10px rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                boxSizing: 'border-box',
              }}
            >
              {/* Horizontal Industrial Rivet Line */}
              {[40, 100, 160, 220, 280, 340].map((rx) => (
                <div
                  key={rx}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#3d2e1a',
                    border: '1px solid rgba(217,164,65,0.4)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.2)',
                  }}
                />
              ))}
            </div>
          ))}

          {/* Heavy Bottom SILL with Double Rubber Bumper */}
          <div
            style={{
              position: 'absolute',
              top: Math.max(0, curH - 18),
              insetInlineStart: 0,
              insetInlineEnd: 0,
              height: 18,
              background: '#0d0a06',
              borderTop: '2px solid #5a4224',
              boxShadow: '0 6px 16px rgba(0,0,0,0.9)',
            }}
          />
        </div>

        {/* Master Central Brass Vault Padlock & Escutcheon */}
        {closeP > 0.85 && (
          <div
            style={{
              position: 'absolute',
              top: 210,
              insetInlineStart: '50%',
              transform: `translateX(-50%) scale(${mix(0.6, 1, lockP).toFixed(3)})`,
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 36%, #e6b350, #96651e 70%, #54340a 100%)',
              border: '3px solid rgba(255,235,170,0.6)',
              boxShadow: `0 16px 40px rgba(0,0,0,0.9), 0 0 ${peaceP * 34}px ${PATINA}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 35,
              opacity: clamp(lockP * 1.5),
            }}
          >
            {/* Keyhole Deadbolt (Turns 90 degrees at 4.05s) */}
            <div
              style={{
                width: 14,
                height: 38,
                borderRadius: 7,
                background: '#160e05',
                border: '1.5px solid #2e1e0a',
                transform: `rotate(${(lockP * 90).toFixed(1)}deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.9)',
              }}
            >
              <div
                style={{
                  width: 4,
                  height: 16,
                  borderRadius: 2,
                  background: peaceP > 0.3 ? PATINA : AMBER,
                  boxShadow: `0 0 10px ${peaceP > 0.3 ? PATINA : AMBER}`,
                }}
              />
            </div>
          </div>
        )}

        {/* Soulful Peace of Mind Reassurance Banner (Surfaces at 5.0s) */}
        {peaceP > 0.05 && (
          <div
            dir="rtl"
            style={{
              position: 'absolute',
              top: 330,
              insetInlineStart: 36,
              insetInlineEnd: 36,
              borderRadius: 18,
              background: 'rgba(10,18,24,0.94)',
              border: `1.5px solid ${PATINA}`,
              boxShadow: `0 14px 40px rgba(0,0,0,0.8), 0 0 30px ${PATINA}44`,
              padding: '16px 20px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              zIndex: 36,
              opacity: clamp(peaceP * 1.5),
              transform: `translateY(${mix(16, 0, peaceP).toFixed(1)}px)`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: PATINA,
                  boxShadow: `0 0 14px ${PATINA}`,
                }}
              />
              <span style={{ fontSize: 16, fontWeight: 900, color: CREAM }}>
                دخل تراز شد · حساب‌ها بسته شد
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRASS_MUTED }}>
              بدون کسری پنهان · بدون اضطراب فردا · آسوده بخوابید
            </div>
          </div>
        )}
      </div>
    </BrassStage>
  )
}

// ─── Scene 7 (40–45s): Brand Horology Climax & High-Conversion Action Hub ─────

export function BrassCtaScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: ctaResolution
  // 0.3s: bigReveal
  // 0.95s: chime
  const lockP = pop(t, 0.0, 0.8)
  const cardsP = pop(t, 0.3, 0.7)
  const chimeP = pop(t, 0.95, 0.5)

  return (
    <BrassStage scene={scene} t={t}>
      {/* Master Horology Emblem */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          insetInlineStart: '50%',
          transform: 'translateX(-50%)',
          width: 86,
          height: 86,
          borderRadius: 24,
          background: 'linear-gradient(145deg, #322212, #140e06)',
          border: `2px solid ${BRASS}`,
          boxShadow: `0 0 40px ${BRASS}66, inset 0 0 20px ${AMBER}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: clamp(lockP * 1.5),
          zIndex: 40,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${AMBER}, ${BRASS})`,
            boxShadow: `0 0 20px ${AMBER}`,
          }}
        />
      </div>

      {/* Brand Wordmark */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 280,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 66,
          fontWeight: 900,
          color: CREAM,
          textShadow: '0 0 46px rgba(255,184,77,0.45)',
          opacity: clamp(lockP * 1.5),
          transform: `translateY(${mix(16, 0, lockP).toFixed(1)}px)`,
        }}
      >
        حسابچه
      </div>

      {/* Subtitle */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 376,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 18,
          fontWeight: 700,
          color: BRASS_MUTED,
          opacity: clamp(lockP * 1.4),
        }}
      >
        ساعت صفر شد؛ تراز بی‌نقص دخل و اسناد در پایان روز
      </div>

      {/* Two High-Conversion Action Cards (Disjoint: x: 44 & x: 280, w: 216, h: 140) */}
      <div
        style={{
          position: 'absolute',
          top: 480,
          insetInlineStart: 44,
          width: 216,
          height: 140,
          borderRadius: 20,
          background: 'linear-gradient(155deg, rgba(32,22,12,0.92), rgba(16,10,5,0.96))',
          border: `1.5px solid ${BRASS}66`,
          boxShadow: `0 16px 36px rgba(0,0,0,0.6), 0 0 ${chimeP * 24}px ${BRASS}44`,
          padding: '16px 14px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: clamp(cardsP * 1.5),
          transform: `translateY(${mix(18, 0, cardsP).toFixed(1)}px)`,
          zIndex: 40,
        }}
      >
        <span
          dir="rtl"
          style={{ fontSize: 16, fontWeight: 900, color: CREAM, textAlign: 'center' }}
        >
          شروع رایگان
        </span>
        <span
          dir="rtl"
          style={{ fontSize: 12, fontWeight: 700, color: BRASS_MUTED, textAlign: 'center' }}
        >
          ثبت‌نام ۳ دقیقه‌ای
        </span>
        <div
          style={{
            width: '100%',
            height: 38,
            borderRadius: 12,
            background: `${BRASS}22`,
            border: `1.5px solid ${BRASS}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 16px ${BRASS}44`,
          }}
        >
          <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: BRASS }}>
            نصب و راه‌اندازی
          </span>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 480,
          insetInlineStart: 280,
          width: 216,
          height: 140,
          borderRadius: 20,
          background: 'linear-gradient(155deg, rgba(32,22,12,0.92), rgba(16,10,5,0.96))',
          border: `1.5px solid ${PATINA}66`,
          boxShadow: `0 16px 36px rgba(0,0,0,0.6), 0 0 ${chimeP * 24}px ${PATINA}44`,
          padding: '16px 14px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: clamp(cardsP * 1.5),
          transform: `translateY(${mix(18, 0, cardsP).toFixed(1)}px)`,
          zIndex: 40,
        }}
      >
        <span
          dir="rtl"
          style={{ fontSize: 16, fontWeight: 900, color: CREAM, textAlign: 'center' }}
        >
          دموی زنده
        </span>
        <span
          dir="rtl"
          style={{ fontSize: 12, fontWeight: 700, color: BRASS_MUTED, textAlign: 'center' }}
        >
          مشاوره استقرار اصناف
        </span>
        <div
          style={{
            width: '100%',
            height: 38,
            borderRadius: 12,
            background: `${PATINA}22`,
            border: `1.5px solid ${PATINA}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 16px ${PATINA}44`,
          }}
        >
          <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: PATINA }}>
            رزرو جلسه
          </span>
        </div>
      </div>

      {/* Multi-platform Availability Footer */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 50,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 800,
          color: BRASS_MUTED,
          opacity: clamp(cardsP * 1.3),
        }}
      >
        سازگار با پوزهای بانکی · بارکدخوان · فیش‌پرینتر · کارکرد آفلاین
      </div>
    </BrassStage>
  )
}
