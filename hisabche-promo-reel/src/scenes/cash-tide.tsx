// ============================================
// Cash-Tide art direction (reel 89) — «موج روشن»
//
// High-craft SaaS Motion Film: Inflow, Leakage, Hermetic Seal & Pure Profit.
// Metaphor: Bioluminescent Liquid Cash Reservoir & Cryogenic Flow-Lock Valves.
//
// Scene 1 (0–4s): Abyssal Coin Drop & Caustic Hydraulic Impact
// Scene 2 (4–12s): Tri-Vent Unmonitored Outflow Leaks
// Scene 3 (12–20s): Hermetic Flow-Lock Electromagnetic Clamps
// Scene 4 (20–31s): Bioluminescent Liquid Columns & Floating Profit Beacon
// Scene 5 (31–40s): Dawn Horizon Surfacing & Telemetric Slabs
// Scene 6 (40–45s): Brand Harbor Climax & High-Conversion Action Hub
//
// Persistent arithmetic (via faNumber only — layout-defect-laws band 6):
//   ۵٬۵۰۰٬۰۰۰ فروش − ۳٬۳۶۰٬۰۰۰ بهای تمام‌شده − ۷۶۰٬۰۰۰ خرج = ۱٬۳۸۰٬۰۰۰ سود
// ============================================

import type { CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, deterministicHash, ease, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

// ─── Design Tokens ───────────────────────────────────────────────────────────

export const ABYSS = '#020b12'
export const TRENCH = '#010609'
export const LAGOON = '#3fe8d0'
export const MIST = '#d9fff8'
export const DAWN = '#ffc37c'
export const COIN = '#ffce6b'
export const ALERT_CRIMSON = '#f87171'
export const EMERALD_OK = '#34d399'
export const TIDE_MUTED = 'rgba(217,255,248,0.7)'

const DEPTH_WASH: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(880px 560px at 50% 26%, rgba(63,232,208,0.14), transparent 64%), radial-gradient(720px 500px at 24% 74%, rgba(2,11,18,0.7), transparent 68%)',
}

const WATER_VIGNETTE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(118% 88% at 50% 40%, transparent 48%, rgba(1,6,9,0.94) 100%)',
}

function pop(t: number, at: number, dur = 0.55): number {
  return spring(clamp(progress(t, at, at + dur)))
}

// ─── Stage & Backdrop ─────────────────────────────────────────────────────────

function TideBackdrop({ t }: { t: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={DEPTH_WASH} />
      {/* Volumetric god rays */}
      {Array.from({ length: 5 }).map((_, i) => {
        const seed = deterministicHash(i, 23)
        const sway = Math.sin(t * 0.5 + seed * 6) * 2.4
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: -80,
              insetInlineStart: 40 + i * 108,
              width: 50 + seed * 30,
              height: 680,
              background: `linear-gradient(180deg, rgba(63,232,208,${0.08 + seed * 0.06}), transparent 80%)`,
              transform: `rotate(${11 + sway}deg)`,
              transformOrigin: 'top center',
              filter: 'blur(3px)',
            }}
          />
        )
      })}
      {/* Suspended bioluminescent motes */}
      {Array.from({ length: 36 }).map((_, i) => {
        const seed = deterministicHash(i, 71)
        const x = ((i * 83) % 540) + seed * 26
        const cycle = (t * (0.02 + seed * 0.04) + seed) % 1
        const y = 960 - cycle * 1000
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: y,
              insetInlineStart: x,
              width: 2 + seed * 2.5,
              height: 2 + seed * 2.5,
              borderRadius: '50%',
              background: seed > 0.4 ? LAGOON : COIN,
              opacity: Math.sin(cycle * Math.PI) * (0.15 + seed * 0.2),
              filter: 'blur(0.5px)',
            }}
          />
        )
      })}
      <div style={WATER_VIGNETTE} />
    </div>
  )
}

export function TideStage({
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
        background: ABYSS,
        overflow: 'hidden',
        color: MIST,
      }}
    >
      <TideBackdrop t={t} />
      {children}
    </div>
  )
}

function Bubble({
  t,
  seed,
  x,
  yStart,
  rise,
  speed,
  opacityScale = 1,
}: {
  t: number
  seed: number
  x: number
  yStart: number
  rise: number
  speed: number
  opacityScale?: number | undefined
}) {
  const cycle = (t * speed + seed) % 1
  const y = yStart - cycle * rise
  const wobble = Math.sin(t * 3 + seed * 9) * (4 + seed * 6)
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        insetInlineStart: `calc(50% + ${x + wobble}px)`,
        width: 4 + seed * 6,
        height: 4 + seed * 6,
        borderRadius: '50%',
        border: `1.5px solid rgba(217,255,248,${0.5 + seed * 0.4})`,
        background: 'radial-gradient(circle at 34% 30%, rgba(255,255,255,0.4), transparent 60%)',
        opacity: Math.sin(cycle * Math.PI) * 0.85 * clamp(opacityScale),
        boxShadow: `0 0 ${4 + seed * 6}px rgba(63,232,208,${0.25 + seed * 0.3})`,
      }}
    />
  )
}

export function TideWords({
  t,
  cueAt,
  words,
  y,
  size = 38,
  accentWord,
  accentColor = LAGOON,
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
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'baseline',
        gap: '0.3em',
        zIndex: 50,
      }}
    >
      {words.map((word, i) => {
        const p = pop(t, cueAt + i * 0.35)
        const accent = word === accentWord
        return (
          <span
            key={word}
            style={{
              opacity: clamp(p * 1.6),
              transform: `translateY(${mix(15, 0, p).toFixed(1)}px)`,
              fontSize: size,
              fontWeight: 900,
              color: accent ? (accentColor ?? LAGOON) : MIST,
              whiteSpace: 'pre',
              textShadow: accent
                ? `0 0 28px ${accentColor ?? LAGOON}`
                : '0 2px 16px rgba(0,0,0,0.7)',
            }}
          >
            {word}
          </span>
        )
      })}
    </div>
  )
}

function TideRoll({
  t,
  at,
  value,
  color = MIST,
  size = 28,
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

// ─── Scene 1 (0–4s): Abyssal Coin Drop & Caustic Impact ───────────────────────

export function CoinFallScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: impact
  // 0.4s: whoosh
  // 1.05s: dataFlow
  // 1.35s: cash (landing on bed)
  // 2.8s: softTransition
  const fallP = clamp(progress(t, 0, 1.35))
  const y = mix(-80, 520, fallP * fallP)
  const tilt = Math.sin(t * 6 + 1) * (1 - clamp(progress(t, 1.35, 1.7))) * 10
  const splash = clamp(progress(t, 1.35, 2.2))
  const glowP = pop(t, 1.35, 0.9)

  return (
    <TideStage scene={scene} t={t}>
      {/* Telemetry Inflow Sensor Bar */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          insetInlineStart: 44,
          width: 452,
          height: 44,
          borderRadius: 12,
          background: 'rgba(3,14,24,0.88)',
          border: '1.5px solid rgba(255,206,107,0.35)',
          boxShadow: '0 10px 28px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 45,
          opacity: clamp(pop(t, 0.0, 0.6) * 1.5),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: COIN,
              boxShadow: `0 0 10px ${COIN}`,
            }}
          />
          <span dir="rtl" style={{ fontSize: 14, fontWeight: 800, color: COIN }}>
            حسگر نقدینگی صندوق: تراکنش ثبت‌نشده
          </span>
        </div>
        <div dir="rtl" style={{ fontSize: 13, fontWeight: 700, color: MIST }}>
          وضعیت: تاریکی عمیق
        </div>
      </div>

      {/* Sinking Golden Coin */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          height: 960,
          pointerEvents: 'none',
        }}
      >
        {/* Caustic splash ring on impact */}
        <div
          style={{
            position: 'absolute',
            top: 520 + 20,
            insetInlineStart: '50%',
            width: mix(0, 260, ease(splash)),
            height: mix(0, 74, ease(splash)),
            transform: 'translateX(-50%)',
            borderRadius: '50%',
            border: `2.5px solid rgba(255,206,107,${clamp(0.95 - splash)})`,
            boxShadow: `0 0 ${34 * (1 - splash)}px rgba(255,206,107,0.8)`,
            opacity: clamp(1 - splash),
          }}
        />

        {/* Heavy Coin Body */}
        <div
          style={{
            position: 'absolute',
            top: y,
            insetInlineStart: '50%',
            transform: `translateX(-50%) rotate(${tilt.toFixed(2)}deg)`,
            width: 82,
            height: 82,
            borderRadius: '50%',
            background: `radial-gradient(circle at 36% 32%, #fff5d8, ${COIN} 52%, #b9823a 96%)`,
            border: '2px solid rgba(255,245,216,0.8)',
            boxShadow: `0 0 ${24 + glowP * 44}px ${COIN}, 0 12px 34px rgba(1,10,12,0.7)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 35,
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              border: '1.5px solid rgba(185,130,58,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b4716',
              fontWeight: 900,
              fontSize: 22,
            }}
          >
            ✦
          </div>
        </div>

        {/* Residual Bubbles */}
        {splash > 0 &&
          Array.from({ length: 14 }).map((_, i) => {
            const seed = deterministicHash(i, 37)
            return (
              <Bubble
                key={i}
                t={t}
                seed={seed}
                x={(seed - 0.5) * 160}
                yStart={536}
                rise={120 + seed * 90}
                speed={0.5 + seed * 0.4}
              />
            )
          })}
      </div>

      <TideWords
        t={t}
        cueAt={0.4}
        words={['یک', 'سکه', 'تو', 'تاریکی', 'می‌افته!']}
        y={640}
        size={40}
        accentWord="تاریکی"
        accentColor={COIN}
      />
    </TideStage>
  )
}

// ─── Scene 2 (4–12s): Tri-Vent Unmonitored Outflow Leaks ──────────────────────

interface VentSpec {
  x: number
  y: number
  label: string
  sublabel: string
  color: string
  seed: number
}

const VENTS: VentSpec[] = [
  { x: 38, y: 310, label: 'نسیه بازاری', sublabel: 'وصول‌نشده', color: LAGOON, seed: 0.21 },
  { x: 202, y: 280, label: 'خرج متفرقه', sublabel: 'ثبت‌نشده', color: DAWN, seed: 0.48 },
  {
    x: 366,
    y: 310,
    label: 'کسری انبار',
    sublabel: 'بدون ردیابی',
    color: ALERT_CRIMSON,
    seed: 0.76,
  },
]

function HydraulicVent({
  t,
  at,
  x,
  y,
  label,
  sublabel,
  color,
  sealedAt = -1,
  seed,
}: {
  t: number
  at: number
  x: number
  y: number
  label: string
  sublabel: string
  color: string
  sealedAt?: number
  seed: number
}) {
  const entered = pop(t, at, 0.75)
  const isSealed = sealedAt > 0 && t >= sealedAt
  const sealP = sealedAt > 0 ? pop(t, sealedAt, 0.6) : 0

  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        insetInlineStart: x,
        width: 136,
        height: 168,
        borderRadius: 20,
        background: 'linear-gradient(160deg, rgba(10,22,34,0.9), rgba(3,10,16,0.95))',
        border: `1.5px solid ${isSealed ? EMERALD_OK : color}66`,
        boxShadow: `0 14px 34px rgba(0,0,0,0.65), 0 0 ${isSealed ? 24 : 14}px ${isSealed ? EMERALD_OK : color}33`,
        padding: '14px 12px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        opacity: clamp(entered * 1.5),
        transform: `scale(${mix(0.85, 1, entered).toFixed(3)})`,
        zIndex: 30,
      }}
    >
      {/* Top Valve Status Ring */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.5)',
          border: `2px solid ${isSealed ? EMERALD_OK : color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 16px ${isSealed ? EMERALD_OK : color}55`,
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 900, color: isSealed ? EMERALD_OK : color }}>
          {isSealed ? '✓' : '▼'}
        </span>
      </div>

      {/* Valve Name */}
      <div style={{ textAlign: 'center' }}>
        <div dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: MIST }}>
          {label}
        </div>
        <div
          dir="rtl"
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: isSealed ? EMERALD_OK : color,
            marginTop: 4,
          }}
        >
          {isSealed ? 'قفل هوشمند' : sublabel}
        </div>
      </div>

      {/* Leaking Drop Stream */}
      {!isSealed && (
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: 8,
              height: 18,
              borderRadius: 4,
              background: color,
              boxShadow: `0 0 10px ${color}`,
              opacity: 0.8 + Math.sin(t * 8 + seed * 10) * 0.2,
            }}
          />
        </div>
      )}

      {/* Sealing Clamp Flash */}
      {sealP > 0.05 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 20,
            background: `radial-gradient(circle, ${EMERALD_OK}44, transparent 70%)`,
            opacity: Math.sin(sealP * Math.PI),
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}

export function LeakCurScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: cinematicReveal
  // 0.3s, 0.8s, 1.3s: cardEnter
  // 2.4s: alert
  // 5.6s: whoosh
  const alertP = pop(t, 2.4, 0.6)

  return (
    <TideStage scene={scene} t={t}>
      <TideWords
        t={t}
        cueAt={0.2}
        words={['سه', 'نشتِ', 'پنهان']}
        y={124}
        size={42}
        accentWord="پنهان"
        accentColor={ALERT_CRIMSON}
      />

      {/* 3 Leaking Vents (Disjoint: x=38, 202, 366. w=136. gaps=28px) */}
      {VENTS.map((vent, i) => (
        <HydraulicVent
          key={vent.label}
          t={t}
          at={0.3 + i * 0.5}
          x={vent.x}
          y={vent.y}
          label={vent.label}
          sublabel={vent.sublabel}
          color={vent.color}
          seed={vent.seed}
        />
      ))}

      {/* Bottom Outflow Telemetry Banner */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 60,
          insetInlineStart: 44,
          width: 452,
          height: 52,
          borderRadius: 14,
          background: 'rgba(10,20,32,0.92)',
          border: `1.5px solid ${alertP > 0.4 ? ALERT_CRIMSON : 'rgba(255,206,107,0.3)'}`,
          boxShadow: `0 12px 32px rgba(0,0,0,0.65), 0 0 ${alertP * 24}px ${ALERT_CRIMSON}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          zIndex: 45,
          opacity: clamp(pop(t, 1.8, 0.7) * 1.5),
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: alertP > 0.3 ? ALERT_CRIMSON : DAWN,
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 800, color: MIST }}>
          نشت پنهان نسیه و هزینه‌ها: کاهش ۲۸٪ سود ناخالص
        </span>
      </div>
    </TideStage>
  )
}

// ─── Scene 3 (12–20s): Hermetic Flow-Lock Clamps ──────────────────────────────

const SEAL_TIMES = [1.6, 3.4, 5.2]

export function FlowLockScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: precisionSequence
  // 1.6s: titleHit (Valve 1 locked)
  // 3.4s: titleHit (Valve 2 locked)
  // 5.2s: titleHit (Valve 3 locked)
  // 6.6s: insightReveal (All sealed status)
  const allSealed = pop(t, 6.6, 0.6)

  return (
    <TideStage scene={scene} t={t}>
      <TideWords
        t={t}
        cueAt={0.2}
        words={['هر', 'نشت', 'قفل', 'می‌شه!']}
        y={124}
        size={42}
        accentWord="قفل"
        accentColor={EMERALD_OK}
      />

      {VENTS.map((vent, i) => (
        <HydraulicVent
          key={vent.label}
          t={t}
          at={0.1 + i * 0.15}
          x={vent.x}
          y={vent.y}
          label={vent.label}
          sublabel={vent.sublabel}
          color={vent.color}
          sealedAt={SEAL_TIMES[i]}
          seed={vent.seed}
        />
      ))}

      {/* Confirmation Seal Banner */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 60,
          insetInlineStart: 44,
          width: 452,
          height: 52,
          borderRadius: 14,
          background: 'rgba(8,24,28,0.95)',
          border: `1.5px solid ${allSealed > 0.5 ? EMERALD_OK : 'rgba(63,232,208,0.3)'}`,
          boxShadow: `0 12px 32px rgba(0,0,0,0.65), 0 0 ${allSealed * 24}px ${EMERALD_OK}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          zIndex: 45,
          opacity: clamp(allSealed * 1.5),
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: EMERALD_OK }} />
        <span style={{ fontSize: 15, fontWeight: 900, color: MIST }}>
          تمامی نشتی‌ها مهار شدند · خزانه‌داری هوشمند فعال است
        </span>
      </div>
    </TideStage>
  )
}

// ─── Scene 4 (20–31s): Bioluminescent Liquid Columns & Floating Profit Beacon ──
// Disjoint Geometry Proof:
// Columns: x: 36, 202, 368 (w: 136, gaps: 30px). y: 280..680 (h: 400).
// Floating Profit Beacon: x: 80, y: 150, w: 380, h: 80 (well above columns).
// Equation Strip: x: 44, y: 720, w: 452, h: 48 (well below columns).
// Zero overlap guaranteed.

function BiolumColumn({
  t,
  at,
  x,
  label,
  value,
  fillTo,
  delay,
  color,
}: {
  t: number
  at: number
  x: number
  label: string
  value: number
  fillTo: number
  delay: number
  color: string
}) {
  const entered = pop(t, at, 0.75)
  const fillP = ease(clamp(progress(t, delay, delay + 2.0)))
  const level = mix(0, fillTo, fillP)
  const crest = Math.sin(t * 3.2 + x * 0.03) * 3

  const columnH = 390
  const liquidY = columnH - level

  return (
    <div
      style={{
        position: 'absolute',
        top: 270,
        insetInlineStart: x,
        width: 136,
        height: columnH,
        opacity: clamp(entered * 1.5),
        transform: `translateY(${mix(20, 0, entered).toFixed(1)}px)`,
        zIndex: 30,
      }}
    >
      {/* Outer Chamber Frame */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 22,
          border: `2px solid ${color}55`,
          background: 'rgba(3,14,24,0.7)',
          boxShadow: `0 14px 34px rgba(0,0,0,0.65), inset 0 0 20px rgba(0,0,0,0.8)`,
          overflow: 'hidden',
        }}
      >
        {/* Glowing Fluid */}
        <div
          style={{
            position: 'absolute',
            top: liquidY + crest,
            bottom: 0,
            insetInlineStart: 0,
            insetInlineEnd: 0,
            background: `linear-gradient(180deg, ${color}66, ${color}22)`,
            borderRadius: '0 0 20px 20px',
            borderTop: `2.5px solid ${color}`,
            boxShadow: `0 0 26px ${color}66`,
          }}
        >
          {/* Surface Meniscus Wave Glow */}
          <div
            style={{
              position: 'absolute',
              top: -6,
              insetInlineStart: 0,
              width: '100%',
              height: 12,
              borderRadius: '50%',
              background: color,
              opacity: 0.65,
              filter: 'blur(3px)',
            }}
          />
        </div>
      </div>

      {/* Label and Value Header/Footer */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 900,
          color: MIST,
          textShadow: '0 2px 10px rgba(0,0,0,0.8)',
          zIndex: 10,
        }}
      >
        {label}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 14,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          zIndex: 10,
        }}
      >
        <TideRoll t={t} at={delay + 0.4} value={value} color={color} size={18} />
      </div>
    </div>
  )
}

export function BasinLevelsScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: whoosh
  // 0.6s: dataFlow (columns start filling)
  // 3.2s: cash (column 2)
  // 4.9s: alert (column 3)
  // 7.8s: bigReveal (profit beacon rises)
  // 8.2s: financialMilestone (profit number rolls)
  // 9.1s: insightReveal (equation locks)
  const beaconP = pop(t, 7.8, 0.8)
  const eqP = pop(t, 9.1, 0.6)

  return (
    <TideStage scene={scene} t={t}>
      {/* Floating Master Profit Beacon (at y: 140) */}
      <div
        style={{
          position: 'absolute',
          top: 140,
          insetInlineStart: 70,
          width: 400,
          height: 86,
          borderRadius: 22,
          background: 'linear-gradient(155deg, rgba(14,28,44,0.92), rgba(6,14,24,0.96))',
          border: `2px solid ${LAGOON}`,
          boxShadow: `0 18px 50px rgba(0,0,0,0.7), 0 0 34px ${LAGOON}55`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          boxSizing: 'border-box',
          opacity: clamp(beaconP * 1.5),
          transform: `translateY(${mix(18, 0, beaconP).toFixed(1)}px)`,
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: LAGOON,
              boxShadow: `0 0 14px ${LAGOON}`,
            }}
          />
          <span dir="rtl" style={{ fontSize: 20, fontWeight: 900, color: LAGOON }}>
            سود خالص واقعی
          </span>
        </div>
        <TideRoll t={t} at={8.2} value={1380000} color={MIST} size={32} />
      </div>

      {/* 3 Bioluminescent Liquid Columns */}
      <BiolumColumn
        t={t}
        at={0.3}
        x={36}
        label="فروش کل"
        value={5500000}
        fillTo={340}
        delay={0.6}
        color={LAGOON}
      />
      <BiolumColumn
        t={t}
        at={0.6}
        x={202}
        label="بهای تمام‌شده"
        value={3360000}
        fillTo={230}
        delay={3.2}
        color={MIST}
      />
      <BiolumColumn
        t={t}
        at={0.9}
        x={368}
        label="هزینه‌های جاری"
        value={760000}
        fillTo={110}
        delay={4.9}
        color={DAWN}
      />

      {/* Arithmetic Equation Rail (y: 690) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 690,
          insetInlineStart: 44,
          width: 452,
          height: 48,
          borderRadius: 12,
          background: 'rgba(8,18,30,0.92)',
          border: '1.5px solid rgba(63,232,208,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 14px',
          boxSizing: 'border-box',
          opacity: clamp(eqP * 1.5),
          zIndex: 35,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, color: MIST }}>
          فروش <span style={{ color: LAGOON }}>{faNumber(5500000)}</span>
        </span>
        <span style={{ fontSize: 15, fontWeight: 900, color: ALERT_CRIMSON }}>−</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: MIST }}>
          بها <span style={{ color: ALERT_CRIMSON }}>{faNumber(3360000)}</span>
        </span>
        <span style={{ fontSize: 15, fontWeight: 900, color: ALERT_CRIMSON }}>−</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: MIST }}>
          خرج <span style={{ color: ALERT_CRIMSON }}>{faNumber(760000)}</span>
        </span>
        <span style={{ fontSize: 15, fontWeight: 900, color: EMERALD_OK }}>=</span>
        <span style={{ fontSize: 15, fontWeight: 900, color: LAGOON }}>
          سود {faNumber(1380000)}
        </span>
      </div>
    </TideStage>
  )
}

// ─── Scene 5 (31–40s): Dawn Horizon Surfacing & Telemetric Slabs ───────────────

function WaveSurface({ t, y, amp = 7 }: { t: number; y: number; amp?: number }) {
  const pts: string[] = []
  for (let px = 0; px <= 540; px += 24) {
    pts.push(`${px} ${(y + Math.sin(px * 0.03 + t * 2.4) * amp).toFixed(1)}`)
  }
  return (
    <svg
      viewBox="0 0 540 960"
      style={{
        position: 'absolute',
        inset: 0,
        width: 540,
        height: 960,
        pointerEvents: 'none',
        zIndex: 32,
      }}
    >
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={LAGOON}
        strokeWidth="2.5"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  )
}

const SURFACE_ROWS = [
  { label: 'فروش کل عملیاتی', value: 5500000, at: 4.4, color: LAGOON },
  { label: 'کل بهای تمام‌شده و هزینه‌ها', value: 4120000, at: 5.4, color: DAWN },
  { label: 'سود خالص قطعی دوره', value: 1380000, at: 6.4, color: EMERALD_OK },
]

export function DawnSurfaceScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: cameraSwish
  // 2.6s: insightReveal (sunrise over horizon)
  // 4.4s, 5.4s: cardEnter
  // 6.4s: financialMilestone
  // 7.9s: successResolution
  const surfaceY = 560
  const sunIn = pop(t, 2.6, 1.2)

  return (
    <TideStage scene={scene} t={t}>
      {/* Dawn Sky Glow above waterline */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          height: surfaceY,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          background:
            'linear-gradient(180deg, rgba(4,18,26,0.0) 0%, rgba(255,195,124,0.18) 70%, rgba(255,195,124,0.36) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Luminous Rising Sun (positioned safely at y: 130, far above slabs) */}
      <div
        style={{
          position: 'absolute',
          top: 130,
          insetInlineStart: '50%',
          transform: 'translateX(-50%)',
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(255,245,220,0.95), ${DAWN} 58%, transparent 78%)`,
          filter: 'blur(5px)',
          opacity: clamp(sunIn * 1.5),
          boxShadow: `0 0 60px ${DAWN}`,
          zIndex: 20,
        }}
      />

      {/* 3 Telemetry Slabs Rising above water (y: 250, 326, 402. h: 62. No overlap with sun or waterline) */}
      {SURFACE_ROWS.map((row, i) => {
        const entered = pop(t, row.at, 0.75)
        const slabY = 250 + i * 76

        return (
          <div
            key={row.label}
            dir="rtl"
            style={{
              position: 'absolute',
              top: slabY,
              insetInlineStart: 50,
              width: 440,
              height: 62,
              borderRadius: 16,
              background: 'linear-gradient(155deg, rgba(12,24,38,0.92), rgba(6,12,20,0.96))',
              border: `1.5px solid ${row.color}77`,
              boxShadow: `0 12px 34px rgba(0,0,0,0.65), 0 0 20px ${row.color}33`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 20px',
              boxSizing: 'border-box',
              zIndex: 35,
              opacity: clamp(entered * 1.5),
              transform: `translateY(${mix(16, 0, entered).toFixed(1)}px)`,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 900, color: MIST }}>{row.label}</span>
            <TideRoll t={t} at={row.at + 0.3} value={row.value} color={row.color} size={22} />
          </div>
        )
      })}

      {/* Waterline Wave */}
      <WaveSurface t={t} y={surfaceY} />

      <TideWords
        t={t}
        cueAt={6.8}
        words={['صبح', 'حسابت', 'روشن']}
        y={640}
        size={40}
        accentWord="روشن"
        accentColor={DAWN}
      />
    </TideStage>
  )
}

// ─── Scene 6 (40–45s): Brand Harbor Climax & High-Conversion Action Hub ────────

export function TideCtaScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: ctaResolution
  // 0.3s: bigReveal
  // 0.95s: chime
  const lockP = pop(t, 0.0, 0.8)
  const cardsP = pop(t, 0.3, 0.7)
  const chimeP = pop(t, 0.95, 0.5)

  return (
    <TideStage scene={scene} t={t}>
      {/* Calm Dawn Horizon Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(255,195,124,0.14) 0%, rgba(2,16,24,0.0) 45%, rgba(1,6,9,0.7) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Floating Luminous Harbor Emblem */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          insetInlineStart: '50%',
          transform: 'translateX(-50%)',
          width: 86,
          height: 86,
          borderRadius: 24,
          background: 'linear-gradient(145deg, #0c2636, #041018)',
          border: `2px solid ${LAGOON}`,
          boxShadow: `0 0 40px ${LAGOON}66, inset 0 0 20px ${COIN}33`,
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
            background: `linear-gradient(135deg, ${LAGOON}, ${COIN})`,
            boxShadow: `0 0 20px ${LAGOON}`,
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
          color: MIST,
          textShadow: '0 0 46px rgba(63,232,208,0.45)',
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
          color: TIDE_MUTED,
          opacity: clamp(lockP * 1.4),
        }}
      >
        جریان زنده پول، بدون حتی یک ریال کسری پنهان
      </div>

      <TideWords
        t={t}
        cueAt={0.2}
        y={428}
        words={['حساب', 'روشن', 'از', 'امشب.']}
        accentWord="امشب."
        size={40}
        accentColor={DAWN}
      />

      {/* Two High-Conversion Action Cards (Disjoint: x: 44 & x: 280, w: 216, h: 140) */}
      <div
        style={{
          position: 'absolute',
          top: 520,
          insetInlineStart: 44,
          width: 216,
          height: 140,
          borderRadius: 20,
          background: 'linear-gradient(155deg, rgba(14,28,44,0.92), rgba(6,14,22,0.96))',
          border: `1.5px solid ${LAGOON}66`,
          boxShadow: `0 16px 36px rgba(0,0,0,0.6), 0 0 ${chimeP * 24}px ${LAGOON}44`,
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
        <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: MIST, textAlign: 'center' }}>
          شروع رایگان
        </span>
        <span
          dir="rtl"
          style={{ fontSize: 12, fontWeight: 700, color: TIDE_MUTED, textAlign: 'center' }}
        >
          ثبت آنی بدون کارت بانکی
        </span>
        <div
          style={{
            width: '100%',
            height: 38,
            borderRadius: 12,
            background: `${LAGOON}22`,
            border: `1.5px solid ${LAGOON}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 16px ${LAGOON}44`,
          }}
        >
          <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: LAGOON }}>
            افتتاح حساب
          </span>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 520,
          insetInlineStart: 280,
          width: 216,
          height: 140,
          borderRadius: 20,
          background: 'linear-gradient(155deg, rgba(14,28,44,0.92), rgba(6,14,22,0.96))',
          border: `1.5px solid ${DAWN}66`,
          boxShadow: `0 16px 36px rgba(0,0,0,0.6), 0 0 ${chimeP * 24}px ${DAWN}44`,
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
        <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: MIST, textAlign: 'center' }}>
          دموی اختصاصی
        </span>
        <span
          dir="rtl"
          style={{ fontSize: 12, fontWeight: 700, color: TIDE_MUTED, textAlign: 'center' }}
        >
          مشاوره رایگان کسب‌وکار
        </span>
        <div
          style={{
            width: '100%',
            height: 38,
            borderRadius: 12,
            background: `${DAWN}22`,
            border: `1.5px solid ${DAWN}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 16px ${DAWN}44`,
          }}
        >
          <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: DAWN }}>
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
          color: TIDE_MUTED,
          opacity: clamp(cardsP * 1.3),
        }}
      >
        نسخه وب · ویندوز · اندروید · همگام‌سازی ابری و آفلاین
      </div>
    </TideStage>
  )
}
