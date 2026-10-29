// ============================================
// Paper-Galaxy art direction (reel 87) — «شبِ کاغذها»
//
// High-craft SaaS Motion Film: Cosmic Chaos to Celestial Orbital Ledger.
// Metaphor: Orbital Astrometry & Gravitational Ledger Constellation.
//
// Scene 1 (0–4s): Supernova Debris Influx & Unrecorded Invoice Anomaly
// Scene 2 (4–11s): Expanding Ghost Document Field Across Sectors
// Scene 3 (11–19s): Gravitational Astrometry Core Ignition & Vector Flow Lines
// Scene 4 (19–30s): Grand Constellation Ledger Ring (5 Disjoint Metric Pillars)
// Scene 5 (30–40s): Atmospheric Re-Entry into Titanium Mobile Cockpit Terminal
// Scene 6 (40–45s): Brand Constellation Climax & High-Conversion Action Hub
//
// Persistent arithmetic (via faNumber only — layout-defect-laws band 6):
//   ۷٬۳۲۰٬۰۰۰ فروش − ۴٬۶۱۰٬۰۰۰ بهای تمام‌شده = ۲٬۷۱۰٬۰۰۰ سود
//   طلب ۱٬۹۵۰٬۰۰۰ · انبار ۲۱۴
// ============================================

import type { CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, deterministicHash, ease, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

// ─── Design Tokens ───────────────────────────────────────────────────────────

export const NIGHT_SKY = '#050713'
export const NEBULA_VIOLET = '#8b7cf6'
export const STAR_CYAN = '#38bdf8'
export const STAR_GOLD = '#facc15'
export const EMBER_RED = '#f87171'
export const EMERALD_OK = '#34d399'
export const CANVAS_PAPER = '#eef2ff'
export const GALAXY_MUTED = 'rgba(238,242,255,0.7)'

const NEBULA_WASH: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(920px 540px at 50% 32%, rgba(139,124,246,0.22), transparent 64%), radial-gradient(720px 440px at 24% 64%, rgba(56,189,248,0.12), transparent 64%), radial-gradient(760px 460px at 76% 72%, rgba(248,113,113,0.08), transparent 62%)',
}

const VIGNETTE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(120% 88% at 50% 42%, transparent 48%, rgba(2,3,8,0.92) 100%)',
}

function pop(t: number, at: number, dur = 0.55): number {
  return spring(clamp(progress(t, at, at + dur)))
}

// ─── Stage & Celestial Backdrop ───────────────────────────────────────────────

function GalaxyBackdrop({ t, stars = 70 }: { t: number; stars?: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={NEBULA_WASH} />
      {Array.from({ length: stars }).map((_, i) => {
        const seed = deterministicHash(i, 91)
        const x = ((i * 61) % 540) + deterministicHash(i, 7) * 22
        const y = ((i * 137) % 960) + deterministicHash(i, 11) * 18
        const twinkle = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * (0.6 + seed) + seed * 7))
        const size = 1 + seed * 2.5
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
              opacity: clamp(twinkle * (0.2 + seed * 0.55)),
              boxShadow: seed > 0.82 ? `0 0 ${8 * twinkle}px ${STAR_GOLD}` : 'none',
            }}
          />
        )
      })}
      <div style={VIGNETTE} />
    </div>
  )
}

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

// ─── Typography & Primitives ──────────────────────────────────────────────────

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
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'baseline',
        gap: '0.32em',
        zIndex: 50,
      }}
    >
      {words.map((word, i) => {
        const at = cueAt + i * 0.35
        const p = pop(t, at)
        const isAccent = word === accentWord
        const color = isAccent ? (accentColor ?? STAR_GOLD) : CANVAS_PAPER
        return (
          <span
            key={`${word}-${i}`}
            style={{
              opacity: clamp(p * 1.6),
              transform: `translateY(${mix(16, 0, p).toFixed(1)}px)`,
              fontSize: size,
              fontWeight: 900,
              color,
              whiteSpace: 'pre',
              textShadow: isAccent ? `0 0 28px ${color}` : '0 2px 18px rgba(0,0,0,0.7)',
            }}
          >
            {word}
          </span>
        )
      })}
    </div>
  )
}

function RollingNumber({
  t,
  at,
  value,
  color = CANVAS_PAPER,
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

/** Holographic spaceborne receipt fragment */
function CelestialReceipt({
  x,
  y,
  scale = 1,
  rot = 0,
  opacity = 1,
  burn = false,
  tag,
}: {
  x: number
  y: number
  scale?: number
  rot?: number
  opacity?: number
  burn?: boolean
  tag?: string
}) {
  const w = 110 * scale
  const h = 144 * scale
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        insetInlineStart: x,
        width: w,
        height: h,
        borderRadius: 10,
        background: burn
          ? 'linear-gradient(155deg, rgba(248,113,113,0.35), rgba(248,113,113,0.08))'
          : 'linear-gradient(155deg, rgba(238,242,255,0.22), rgba(139,124,246,0.12))',
        border: `1.5px solid ${burn ? EMBER_RED : 'rgba(127,216,255,0.45)'}`,
        boxShadow: burn
          ? `0 0 32px ${EMBER_RED}88, inset 0 0 18px ${EMBER_RED}44`
          : '0 16px 36px rgba(4,6,16,0.65), 0 0 20px rgba(56,189,248,0.2)',
        padding: '10px 12px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transform: `rotate(${rot}deg)`,
        opacity: clamp(opacity),
        zIndex: 25,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div
          style={{ width: 24, height: 4, borderRadius: 2, background: 'rgba(238,242,255,0.5)' }}
        />
        {tag && (
          <span
            dir="rtl"
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: '#ffffff',
              background: burn ? EMBER_RED : STAR_CYAN,
              padding: '1px 6px',
              borderRadius: 4,
            }}
          >
            {tag}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[0.85, 0.6, 0.72].map((f, idx) => (
          <div
            key={idx}
            style={{
              height: 3,
              width: `${f * 100}%`,
              borderRadius: 2,
              background: 'rgba(238,242,255,0.4)',
              filter: 'blur(0.6px)',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div
          style={{ width: 34, height: 8, borderRadius: 2, background: 'rgba(238,242,255,0.3)' }}
        />
        <span style={{ fontSize: 12, fontWeight: 900, color: burn ? EMBER_RED : STAR_GOLD }}>
          ✦
        </span>
      </div>
    </div>
  )
}

// ─── Scene 1 (0–4s): Supernova Debris Influx & Unrecorded Invoice Anomaly ──────

export function GalaxyBurstScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: impact
  // 0.35s: whoosh
  // 0.8s: paperRustle
  // 1.2s: insightReveal (supernova flare)
  // 2.9s: softTransition
  const impactP = pop(t, 0.0, 0.6)
  const flareP = pop(t, 1.2, 0.7)

  return (
    <GalaxyStage scene={scene} t={t}>
      {/* Top Telemetry Anomaly Bar */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          insetInlineStart: 44,
          width: 452,
          height: 44,
          borderRadius: 12,
          background: 'rgba(10,14,28,0.9)',
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
              background: EMBER_RED,
              boxShadow: `0 0 10px ${EMBER_RED}`,
            }}
          />
          <span dir="rtl" style={{ fontSize: 14, fontWeight: 800, color: EMBER_RED }}>
            پایش مداری اسناد: ۳۸٪ فاکتورها خارج از دخل
          </span>
        </div>
        <div dir="rtl" style={{ fontSize: 13, fontWeight: 700, color: CANVAS_PAPER }}>
          وضعیت: نشت شناور
        </div>
      </div>

      <WordCluster
        t={t}
        cueAt={0.4}
        words={['می‌نویسی…', 'ولی', 'صبح', 'اثری', 'نیست!']}
        y={122}
        size={40}
        accentWord="اثری"
        accentColor={EMBER_RED}
      />

      {/* Center Supernova Burning Receipt */}
      <div
        style={{
          position: 'absolute',
          top: 320,
          insetInlineStart: '50%',
          transform: `translateX(-50%) scale(${mix(0.85, 1.15, flareP).toFixed(3)})`,
          zIndex: 35,
        }}
      >
        <CelestialReceipt x={-65} y={-80} scale={1.25} rot={-6} burn tag="سوخت‌شده" />
      </div>

      {/* Floating Debris Receipts in background */}
      {[
        { x: 30, y: 240, r: -14, s: 0.9 },
        { x: 380, y: 220, r: 16, s: 0.85 },
        { x: 40, y: 480, r: 18, s: 0.85 },
        { x: 390, y: 490, r: -12, s: 0.95 },
      ].map((pos, i) => (
        <CelestialReceipt
          key={i}
          x={pos.x}
          y={pos.y}
          rot={pos.r + Math.sin(t * 2 + i) * 3}
          scale={pos.s}
          opacity={0.5}
        />
      ))}
    </GalaxyStage>
  )
}

// ─── Scene 2 (4–11s): Expanding Ghost Document Field Across Sectors ───────────

export function GhostDriftScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: cinematicReveal
  // 0.5s: paperRustle
  // 1.8s: cardEnter
  // 3.2s: softTransition
  // 5.6s: insightReveal
  const insightP = pop(t, 5.6, 0.6)

  return (
    <GalaxyStage scene={scene} t={t}>
      <WordCluster
        t={t}
        cueAt={0.3}
        words={['اسناد', 'بی‌صاحب', 'می‌سوزند.']}
        y={120}
        size={42}
        accentWord="می‌سوزند."
        accentColor={EMBER_RED}
      />

      {/* 3 Sector Clusters */}
      {[
        { x: 40, y: 260, label: 'فاکتورهای نسیه مشتریان', val: '۶۳ سند', color: STAR_CYAN },
        { x: 200, y: 390, label: 'فیش‌های تنخواه و هزینه', val: '۲۸ سند', color: NEBULA_VIOLET },
        { x: 350, y: 260, label: 'حواله انبار شعبه دوم', val: '۱۴ مغایرت', color: EMBER_RED },
      ].map((sector, idx) => {
        const p = pop(t, 0.4 + idx * 0.6, 0.7)
        return (
          <div
            key={sector.label}
            dir="rtl"
            style={{
              position: 'absolute',
              top: sector.y,
              insetInlineStart: sector.x,
              width: 150,
              height: 120,
              borderRadius: 16,
              background: 'linear-gradient(155deg, rgba(16,22,44,0.9), rgba(8,12,24,0.95))',
              border: `1.5px solid ${sector.color}66`,
              boxShadow: `0 12px 30px rgba(0,0,0,0.65), 0 0 16px ${sector.color}33`,
              padding: '12px 14px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              opacity: clamp(p * 1.5),
              transform: `scale(${mix(0.85, 1, p).toFixed(3)})`,
              zIndex: 30,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, color: CANVAS_PAPER }}>{sector.label}</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: sector.color }}>{sector.val}</div>
          </div>
        )
      })}

      {/* Warning Telemetry Strip at y: 640 */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 60,
          insetInlineStart: 44,
          width: 452,
          height: 48,
          borderRadius: 12,
          background: 'rgba(18,12,24,0.92)',
          border: `1.5px solid ${insightP > 0.4 ? EMBER_RED : 'rgba(248,113,113,0.3)'}`,
          boxShadow: `0 10px 28px rgba(0,0,0,0.6), 0 0 ${insightP * 20}px ${EMBER_RED}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          zIndex: 45,
          opacity: clamp(pop(t, 1.2, 0.7) * 1.5),
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: EMBER_RED }} />
        <span style={{ fontSize: 14, fontWeight: 800, color: CANVAS_PAPER }}>
          نشت خاموش سود در رسیدهای دستی: عدم ثبت در تراز نهایی
        </span>
      </div>
    </GalaxyStage>
  )
}

// ─── Scene 3 (11–19s): Gravitational Astrometry Core Ignition ─────────────────

export function GravityIgniteScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: bigReveal
  // 0.3s: dataFlow
  // 1.2s: insightReveal
  // 2.7s: precisionSequence
  // 4.4s: financialMilestone
  // 6.8s: sync
  const coreP = pop(t, 0.0, 0.9)
  const syncP = pop(t, 6.8, 0.6)

  return (
    <GalaxyStage scene={scene} t={t}>
      <WordCluster
        t={t}
        cueAt={0.2}
        words={['هستهٔ', 'روشن', 'شکل', 'گرفت.']}
        y={120}
        accentWord="شکل"
        size={42}
      />

      {/* Gravitational Field Lines (curved inward to 270, 440) */}
      <svg
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, width: 540, height: 960, pointerEvents: 'none' }}
      >
        {[
          'M 40 180 C 140 250, 220 350, 270 440',
          'M 500 180 C 400 250, 320 350, 270 440',
          'M 60 740 C 140 640, 210 540, 270 440',
          'M 480 740 C 400 640, 330 540, 270 440',
        ].map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={i % 2 ? NEBULA_VIOLET : STAR_CYAN}
            strokeWidth="2"
            strokeDasharray="8 8"
            opacity={0.65}
          />
        ))}
      </svg>

      {/* Luminous Singularity Core */}
      <div
        style={{
          position: 'absolute',
          top: 440 - 70,
          insetInlineStart: 270 - 70,
          width: 140,
          height: 140,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 48% 46%, rgba(255,255,255,0.95), rgba(139,124,246,0.6) 42%, transparent 75%)',
          boxShadow: `0 0 60px ${NEBULA_VIOLET}, 0 0 120px rgba(56,189,248,0.4)`,
          transform: `scale(${mix(0.4, 1.15, coreP).toFixed(3)})`,
          opacity: clamp(coreP * 1.5),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 35,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: STAR_GOLD,
            boxShadow: `0 0 20px ${STAR_GOLD}`,
          }}
        />
      </div>

      {/* 3 Master Metric Rings Ignited */}
      {['فروش کل', 'بهای کالا', 'سود واقعی'].map((label, i) => {
        const p = pop(t, 2.7 + i * 0.85, 0.6)
        const angle = (-90 + i * 120) * (Math.PI / 180)
        const bx = 270 + Math.cos(angle) * 160
        const by = 440 + Math.sin(angle) * 160
        return (
          <div
            key={label}
            dir="rtl"
            style={{
              position: 'absolute',
              top: by - 22,
              insetInlineStart: bx - 55,
              width: 110,
              height: 44,
              borderRadius: 12,
              background: 'rgba(18,24,48,0.92)',
              border: `1.5px solid ${STAR_GOLD}`,
              boxShadow: `0 0 22px ${STAR_GOLD}44`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 900,
              color: CANVAS_PAPER,
              opacity: clamp(p * 1.5),
              zIndex: 40,
            }}
          >
            {label}
          </div>
        )
      })}

      {/* Gravitational Lock Banner */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 60,
          insetInlineStart: 44,
          width: 452,
          height: 48,
          borderRadius: 12,
          background: 'rgba(10,18,36,0.95)',
          border: `1.5px solid ${syncP > 0.4 ? EMERALD_OK : 'rgba(56,189,248,0.3)'}`,
          boxShadow: `0 10px 28px rgba(0,0,0,0.6), 0 0 ${syncP * 24}px ${EMERALD_OK}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          zIndex: 45,
          opacity: clamp(syncP * 1.5),
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: EMERALD_OK }} />
        <span style={{ fontSize: 14, fontWeight: 900, color: CANVAS_PAPER }}>
          قفل گرانشی مدار برقرار شد · هدایت خودکار اسناد به دفاتر مرکزی
        </span>
      </div>
    </GalaxyStage>
  )
}

// ─── Scene 4 (19–30s): Grand Constellation Ledger Ring (5 Disjoint Pillars) ───
// Disjoint Geometry Proof:
// Upper Orbit: cy: 260. Cards at x: 40 (w: 216) & x: 284 (w: 216). Height: 104.
// Central Core: y: 395, height: 80.
// Lower Orbit: cy: 510. Cards at x: 40 (w: 216) & x: 284 (w: 216). Height: 104.
// Arithmetic Bus: y: 650, height: 50.
// All y bands are disjoint: 260..364 | 395..475 | 510..614 | 650..700. Zero overlap.

export function OrbitLedgerScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: majorReveal
  // 0.25s, 0.70s: cardEnter
  // 1.15s, 1.60s: financialMilestone
  // 3.6s: cash (inventory core)
  // 7.4s: precisionSequence (equation bus)
  // 9.8s: insightReveal (equation verified green)
  const coreP = pop(t, 3.6, 0.6)
  const eqP = pop(t, 7.4, 0.6)
  const lockP = pop(t, 9.8, 0.5)

  return (
    <GalaxyStage scene={scene} t={t}>
      <WordCluster
        t={t}
        cueAt={0.2}
        words={['تمام', 'حساب‌ها', 'روی', 'مدار.']}
        y={110}
        size={42}
        accentWord="مدار."
        accentColor={STAR_GOLD}
      />

      {/* Orbit Track Rings */}
      <svg
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, width: 540, height: 960, pointerEvents: 'none' }}
      >
        <ellipse
          cx="270"
          cy="312"
          rx="180"
          ry="54"
          fill="none"
          stroke="rgba(56,189,248,0.25)"
          strokeWidth="1.5"
          strokeDasharray="6 8"
        />
        <ellipse
          cx="270"
          cy="562"
          rx="180"
          ry="54"
          fill="none"
          stroke="rgba(139,124,246,0.25)"
          strokeWidth="1.5"
          strokeDasharray="6 8"
        />
      </svg>

      {/* Upper Orbit Cards */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 240,
          insetInlineStart: 40,
          width: 216,
          height: 104,
          borderRadius: 18,
          background: 'linear-gradient(155deg, rgba(16,26,48,0.92), rgba(8,14,28,0.96))',
          border: `1.5px solid ${STAR_CYAN}66`,
          boxShadow: `0 14px 34px rgba(0,0,0,0.65), 0 0 20px ${STAR_CYAN}33`,
          padding: '14px 16px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          opacity: clamp(pop(t, 0.25, 0.6) * 1.5),
          zIndex: 35,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900, color: CANVAS_PAPER }}>فروش کل ناخالص</div>
        <RollingNumber t={t} at={0.5} value={7320000} color={STAR_CYAN} size={25} />
      </div>

      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 240,
          insetInlineStart: 284,
          width: 216,
          height: 104,
          borderRadius: 18,
          background: 'linear-gradient(155deg, rgba(16,26,48,0.92), rgba(8,14,28,0.96))',
          border: `1.5px solid ${NEBULA_VIOLET}66`,
          boxShadow: `0 14px 34px rgba(0,0,0,0.65), 0 0 20px ${NEBULA_VIOLET}33`,
          padding: '14px 16px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          opacity: clamp(pop(t, 0.7, 0.6) * 1.5),
          zIndex: 35,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900, color: CANVAS_PAPER }}>بهای تمام‌شده کالا</div>
        <RollingNumber t={t} at={0.9} value={4610000} color={NEBULA_VIOLET} size={25} />
      </div>

      {/* Central Core (Inventory) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 380,
          insetInlineStart: 160,
          width: 220,
          height: 76,
          borderRadius: 20,
          background: 'linear-gradient(155deg, rgba(20,30,56,0.95), rgba(10,16,32,0.98))',
          border: `2px solid ${STAR_CYAN}`,
          boxShadow: `0 16px 40px rgba(0,0,0,0.7), 0 0 26px ${STAR_CYAN}55`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 16px',
          boxSizing: 'border-box',
          opacity: clamp(coreP * 1.5),
          zIndex: 40,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: CANVAS_PAPER }}>موجودی انبار</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: STAR_CYAN }}>آماده ارسال</div>
        </div>
        <RollingNumber t={t} at={3.8} value={214} color={STAR_CYAN} size={28} />
      </div>

      {/* Lower Orbit Cards */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 490,
          insetInlineStart: 40,
          width: 216,
          height: 104,
          borderRadius: 18,
          background: 'linear-gradient(155deg, rgba(24,28,48,0.92), rgba(12,14,26,0.96))',
          border: `1.5px solid ${STAR_GOLD}66`,
          boxShadow: `0 14px 34px rgba(0,0,0,0.65), 0 0 24px ${STAR_GOLD}44`,
          padding: '14px 16px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          opacity: clamp(pop(t, 1.15, 0.6) * 1.5),
          zIndex: 35,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900, color: STAR_GOLD }}>سود خالص قطعی</div>
        <RollingNumber t={t} at={1.4} value={2710000} color={STAR_GOLD} size={25} />
      </div>

      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 490,
          insetInlineStart: 284,
          width: 216,
          height: 104,
          borderRadius: 18,
          background: 'linear-gradient(155deg, rgba(16,26,48,0.92), rgba(8,14,28,0.96))',
          border: `1.5px solid ${EMERALD_OK}66`,
          boxShadow: `0 14px 34px rgba(0,0,0,0.65), 0 0 20px ${EMERALD_OK}33`,
          padding: '14px 16px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          opacity: clamp(pop(t, 1.6, 0.6) * 1.5),
          zIndex: 35,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900, color: CANVAS_PAPER }}>مطالبات بازار</div>
        <RollingNumber t={t} at={1.9} value={1950000} color={EMERALD_OK} size={25} />
      </div>

      {/* Arithmetic Equation Bus */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 640,
          insetInlineStart: 44,
          width: 452,
          height: 52,
          borderRadius: 14,
          background: 'rgba(10,18,34,0.92)',
          border: `1.5px solid ${lockP > 0.5 ? EMERALD_OK : 'rgba(56,189,248,0.35)'}`,
          boxShadow: `0 12px 32px rgba(0,0,0,0.65), 0 0 ${lockP * 24}px ${EMERALD_OK}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 16px',
          boxSizing: 'border-box',
          opacity: clamp(eqP * 1.5),
          zIndex: 35,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 800, color: CANVAS_PAPER }}>
          فروش <span style={{ color: STAR_CYAN }}>{faNumber(7320000)}</span>
        </span>
        <span style={{ fontSize: 16, fontWeight: 900, color: EMBER_RED }}>−</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: CANVAS_PAPER }}>
          بهای کالا <span style={{ color: EMBER_RED }}>{faNumber(4610000)}</span>
        </span>
        <span style={{ fontSize: 16, fontWeight: 900, color: EMERALD_OK }}>=</span>
        <span
          style={{ fontSize: 15, fontWeight: 900, color: lockP > 0.5 ? EMERALD_OK : STAR_GOLD }}
        >
          سود {faNumber(2710000)}
        </span>
      </div>
    </GalaxyStage>
  )
}

// ─── Scene 5 (30–40s): Atmospheric Re-Entry into Titanium Mobile Cockpit ──────

export function ReentryDashScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: cameraSwish
  // 0.4s: whoosh
  // 2.2s: cinematicReveal (phone docks)
  // 3.0s: cardEnter (live rows)
  // 4.4s: sync (status indicator)
  // 7.6s: successResolution
  const phoneP = pop(t, 0.4, 0.9)
  const liveIn = pop(t, 4.4, 0.6)

  return (
    <GalaxyStage scene={scene} t={t}>
      <WordCluster
        t={t}
        cueAt={0.2}
        y={116}
        words={['همان', 'مدار،', 'روی', 'گوشی.']}
        accentWord="گوشی."
        size={42}
      />

      {/* Titanium Mobile Cockpit (Local Coords: w: 290, h: 540) */}
      <div
        style={{
          position: 'absolute',
          top: 194,
          insetInlineStart: 125,
          width: 290,
          height: 540,
          borderRadius: 40,
          background: 'linear-gradient(180deg, #10162a, #060814)',
          border: '3px solid rgba(255,255,255,0.22)',
          boxShadow:
            '0 36px 80px rgba(0,0,0,0.85), 0 0 44px rgba(56,189,248,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
          overflow: 'hidden',
          zIndex: 40,
          opacity: clamp(phoneP * 1.5),
          transform: `translateY(${mix(28, 0, phoneP).toFixed(1)}px) scale(${mix(0.92, 1, phoneP).toFixed(3)})`,
        }}
      >
        {/* Dynamic Island Notch */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            insetInlineStart: '50%',
            transform: 'translateX(-50%)',
            width: 88,
            height: 20,
            borderRadius: 10,
            background: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            zIndex: 20,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: EMERALD_OK,
              boxShadow: `0 0 8px ${EMERALD_OK}`,
            }}
          />
          <div
            style={{ width: 14, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }}
          />
        </div>

        {/* Local App Header (top: 40) */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 40,
            insetInlineStart: 18,
            insetInlineEnd: 18,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 900, color: STAR_CYAN }}>حسابچه</span>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: EMERALD_OK,
              background: 'rgba(52,211,153,0.15)',
              border: '1px solid rgba(52,211,153,0.4)',
              padding: '2px 8px',
              borderRadius: 6,
            }}
          >
            همگام ماهواره‌ای
          </div>
        </div>

        {/* Rows: فروش، بها، سود */}
        {[
          { label: 'فروش کل دوره‌ای', val: 7320000, col: STAR_CYAN, at: 1.4 },
          { label: 'بهای تمام‌شده کالا', val: 4610000, col: NEBULA_VIOLET, at: 2.2 },
          { label: 'سود قطعی کسب‌وکار', val: 2710000, col: STAR_GOLD, at: 3.0, isProfit: true },
        ].map((row, i) => {
          const rP = pop(t, row.at, 0.6)
          return (
            <div
              key={row.label}
              dir="rtl"
              style={{
                position: 'absolute',
                top: 80 + i * 72,
                insetInlineStart: 16,
                width: 258,
                height: 62,
                borderRadius: 14,
                background: row.isProfit
                  ? 'linear-gradient(145deg, rgba(250,204,21,0.2), rgba(250,204,21,0.06))'
                  : 'rgba(255,255,255,0.05)',
                border: `1.5px solid ${row.col}77`,
                boxShadow: row.isProfit ? `0 0 20px ${STAR_GOLD}44` : 'none',
                padding: '10px 14px',
                boxSizing: 'border-box',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: clamp(rP * 1.5),
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 900, color: CANVAS_PAPER }}>
                {row.label}
              </span>
              <RollingNumber t={t} at={row.at + 0.3} value={row.val} color={row.col} size={18} />
            </div>
          )
        })}

        {/* Multi-Branch Live Feed Stream (top: 310, h: 144) */}
        <div
          style={{
            position: 'absolute',
            top: 310,
            insetInlineStart: 16,
            width: 258,
            height: 144,
            borderRadius: 14,
            background: 'rgba(12,16,32,0.7)',
            border: '1px solid rgba(56,189,248,0.2)',
            padding: '10px 12px',
            boxSizing: 'border-box',
          }}
        >
          <div
            dir="rtl"
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: STAR_CYAN,
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>انبار مرکزی و شعب</span>
            <span style={{ color: EMERALD_OK }}>آنلاین</span>
          </div>

          {[
            { name: 'شعبه مرکزی بازار', status: 'تراز لحظه‌ای' },
            { name: 'انبار کد ۱۰۱', status: 'موجودی به‌روز' },
          ].map((item, idx) => (
            <div
              key={idx}
              dir="rtl"
              style={{
                height: 42,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                marginBottom: 6,
                padding: '6px 10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: CANVAS_PAPER }}>{item.name}</div>
              <div style={{ fontSize: 11, fontWeight: 900, color: EMERALD_OK }}>{item.status}</div>
            </div>
          ))}
        </div>

        {/* Bottom Home Indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            insetInlineStart: '50%',
            transform: 'translateX(-50%)',
            width: 100,
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.3)',
          }}
        />
      </div>

      {/* Floating Sync Pill */}
      {liveIn > 0.1 && (
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            bottom: 54,
            insetInlineStart: 44,
            width: 452,
            height: 42,
            borderRadius: 12,
            background: 'rgba(16,24,48,0.95)',
            border: '1.5px solid rgba(56,189,248,0.4)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            opacity: clamp(liveIn * 1.5),
            zIndex: 45,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: EMERALD_OK }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: CANVAS_PAPER }}>
            پشتیبانی از چند شعبه و چند انبار · بدون نیاز به سرور محلی
          </span>
        </div>
      )}
    </GalaxyStage>
  )
}

// ─── Scene 6 (40–45s): Brand Constellation Climax & High-Conversion Action Hub ─

export function GalaxyCtaScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: ctaResolution
  // 0.3s: bigReveal
  // 0.95s: chime
  // 2.2s: financialMilestone
  const lockP = pop(t, 0.0, 0.8)
  const cardsP = pop(t, 0.3, 0.7)
  const chimeP = pop(t, 0.95, 0.5)

  return (
    <GalaxyStage scene={scene} t={t}>
      {/* Astrometry Constellation Emblem */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          insetInlineStart: '50%',
          transform: 'translateX(-50%)',
          width: 86,
          height: 86,
          borderRadius: 24,
          background: 'linear-gradient(145deg, #1c2648, #0a1020)',
          border: `2px solid ${STAR_CYAN}`,
          boxShadow: `0 0 40px ${STAR_CYAN}66, inset 0 0 20px ${STAR_GOLD}33`,
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
            background: `linear-gradient(135deg, ${STAR_CYAN}, ${STAR_GOLD})`,
            boxShadow: `0 0 20px ${STAR_CYAN}`,
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
          color: CANVAS_PAPER,
          textShadow: '0 0 46px rgba(56,189,248,0.45)',
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
          color: GALAXY_MUTED,
          opacity: clamp(lockP * 1.4),
        }}
      >
        دفتر واقعی و خودکار کسب‌وکار شما در ابر و موبایل
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
          background: 'linear-gradient(155deg, rgba(20,28,54,0.92), rgba(10,14,28,0.96))',
          border: `1.5px solid ${STAR_CYAN}66`,
          boxShadow: `0 16px 36px rgba(0,0,0,0.6), 0 0 ${chimeP * 24}px ${STAR_CYAN}44`,
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
          style={{ fontSize: 16, fontWeight: 900, color: CANVAS_PAPER, textAlign: 'center' }}
        >
          شروع رایگان
        </span>
        <span
          dir="rtl"
          style={{ fontSize: 12, fontWeight: 700, color: GALAXY_MUTED, textAlign: 'center' }}
        >
          ثبت‌نام آنلاین در ۲ دقیقه
        </span>
        <div
          style={{
            width: '100%',
            height: 38,
            borderRadius: 12,
            background: `${STAR_CYAN}22`,
            border: `1.5px solid ${STAR_CYAN}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 16px ${STAR_CYAN}44`,
          }}
        >
          <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: STAR_CYAN }}>
            نصب و ورود
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
          background: 'linear-gradient(155deg, rgba(20,28,54,0.92), rgba(10,14,28,0.96))',
          border: `1.5px solid ${STAR_GOLD}66`,
          boxShadow: `0 16px 36px rgba(0,0,0,0.6), 0 0 ${chimeP * 24}px ${STAR_GOLD}44`,
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
          style={{ fontSize: 16, fontWeight: 900, color: CANVAS_PAPER, textAlign: 'center' }}
        >
          دموی چندشعبه
        </span>
        <span
          dir="rtl"
          style={{ fontSize: 12, fontWeight: 700, color: GALAXY_MUTED, textAlign: 'center' }}
        >
          مشاوره رایگان استقرار
        </span>
        <div
          style={{
            width: '100%',
            height: 38,
            borderRadius: 12,
            background: `${STAR_GOLD}22`,
            border: `1.5px solid ${STAR_GOLD}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 16px ${STAR_GOLD}44`,
          }}
        >
          <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: STAR_GOLD }}>
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
          color: GALAXY_MUTED,
          opacity: clamp(cardsP * 1.3),
        }}
      >
        وب · ویندوز · اندروید · همگام‌سازی بین‌شعبی و کارکرد کاملاً آفلاین
      </div>
    </GalaxyStage>
  )
}
