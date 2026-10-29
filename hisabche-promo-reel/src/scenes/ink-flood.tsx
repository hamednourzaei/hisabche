// ============================================
// Ink-Flood art direction (reel 90) — «سیل کاغذها»
//
// High-craft SaaS Motion Film: Chaos to Clarity.
// Metaphor: Gravitational Singularity Core & Optical Telemetry Ledger.
//
// Scene 1 (0–7s): Chaotic Invoice Influx & Real-Time Velocity Anomaly
// Scene 2 (7–15s): Temporal Quantum Freeze & Gravitational Suction Singularity
// Scene 3 (15–24s): Holographic Obsidian Telemetry Pillars (Disjoint Geometry)
// Scene 4 (24–34s): Mobile Titanium Cockpit Terminal (Strict Local Coords)
// Scene 5 (34–41s): Photonic Laser Beam Cleanse & Transformation
// Scene 6 (41–45s): Brand Climax & High-Conversion Action Hub
//
// Persistent arithmetic (via faNumber only — layout-defect-laws band 6):
//   ۱٬۸۴۰٬۰۰۰ فروش − ۱٬۲۲۵٬۰۰۰ بهای تمام‌شده − ۱۴۰٬۰۰۰ خرج = ۴۷۵٬۰۰۰ سود
//   طلب ۲۱۸٬۰۰۰ · انبار ۳۱۲ (۰ قلم بحرانی)
// ============================================

import type { CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, deterministicHash, ease, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

// ─── Design Tokens ───────────────────────────────────────────────────────────

export const INK_CANVAS = '#060810'
export const PAPER_WARM = '#f4ebd9'
export const FLOOD_AMBER = '#ffb954'
export const CLARITY_TEAL = '#4fe3c4'
export const EMERALD_OK = '#34d399'
export const ALERT_CRIMSON = '#f87171'
export const INK_MIST = '#ece6d8'
export const INK_MUTED = 'rgba(236,230,216,0.68)'
export const OBSIDIAN_CARD = 'rgba(14, 18, 30, 0.78)'

const INK_WASH: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(860px 540px at 50% 25%, rgba(255,185,84,0.12), transparent 65%), radial-gradient(700px 480px at 20% 75%, rgba(79,227,196,0.08), transparent 66%)',
}

const INK_VIGNETTE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(120% 86% at 50% 40%, transparent 48%, rgba(2,3,8,0.92) 100%)',
}

function pop(t: number, at: number, dur = 0.55): number {
  return spring(clamp(progress(t, at, at + dur)))
}

// ─── Stage ───────────────────────────────────────────────────────────────────

export function InkFloodStage({
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
        background: INK_CANVAS,
        overflow: 'hidden',
        color: INK_MIST,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={INK_WASH} />
        {/* Ambient photonic motes */}
        {Array.from({ length: 32 }).map((_, i) => {
          const seed = deterministicHash(i, 53)
          const x = ((i * 97) % 540) + seed * 18
          const cycle = (t * (0.015 + seed * 0.035) + seed) % 1
          const y = 980 - cycle * 1020
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
                background: seed > 0.5 ? FLOOD_AMBER : CLARITY_TEAL,
                opacity: Math.sin(cycle * Math.PI) * (0.12 + seed * 0.18),
                filter: 'blur(0.5px)',
              }}
            />
          )
        })}
        <div style={INK_VIGNETTE} />
      </div>
      {children}
    </div>
  )
}

// ─── Typography & Primitives ──────────────────────────────────────────────────

export function FloodWords({
  t,
  cueAt,
  words,
  y,
  size = 40,
  accentWord,
  accentColor = FLOOD_AMBER,
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
        const p = pop(t, cueAt + i * 0.35)
        const accent = word === accentWord
        return (
          <span
            key={word}
            style={{
              opacity: clamp(p * 1.6),
              transform: `translateY(${mix(16, 0, p).toFixed(1)}px)`,
              fontSize: size,
              fontWeight: 900,
              color: accent ? (accentColor ?? FLOOD_AMBER) : INK_MIST,
              whiteSpace: 'pre',
              textShadow: accent
                ? `0 0 28px ${accentColor ?? FLOOD_AMBER}bb`
                : '0 2px 14px rgba(0,0,0,0.7)',
            }}
          >
            {word}
          </span>
        )
      })}
    </div>
  )
}

function FloodRoll({
  t,
  at,
  value,
  size = 28,
  color = INK_MIST,
}: {
  t: number
  at: number
  value: number
  size?: number
  color?: string
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
        textShadow: `0 0 16px ${color}44`,
        whiteSpace: 'nowrap',
      }}
    >
      {faNumber(n)}
    </span>
  )
}

/** Realistic tactile receipt bill fragment with micro-perforations & barcode */
function ReceiptBill({
  x,
  y,
  w,
  h,
  rot,
  opacity,
  tag,
  tagColor = ALERT_CRIMSON,
  zIndex = 20,
}: {
  x: number
  y: number
  w: number
  h: number
  rot: number
  opacity: number
  tag?: string
  tagColor?: string
  zIndex?: number
}) {
  if (opacity <= 0.01) return null
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        insetInlineStart: x,
        width: w,
        height: h,
        borderRadius: 8,
        zIndex,
        transform: `rotate(${rot.toFixed(2)}deg)`,
        opacity: clamp(opacity),
        background: `linear-gradient(175deg, ${PAPER_WARM}f6, #e7ddc7f2)`,
        boxShadow: '0 16px 36px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.6)',
        border: '1px solid rgba(220,205,180,0.7)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
      }}
    >
      {/* Top perforated jagged edge representation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: 28, height: 4, borderRadius: 2, background: 'rgba(20,25,38,0.55)' }} />
        {tag ? (
          <span
            dir="rtl"
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: '#ffffff',
              background: tagColor,
              padding: '1px 6px',
              borderRadius: 4,
            }}
          >
            {tag}
          </span>
        ) : (
          <div
            style={{ width: 18, height: 4, borderRadius: 2, background: 'rgba(20,25,38,0.35)' }}
          />
        )}
      </div>

      {/* Blurred invoice lines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[0.88, 0.62, 0.75].map((frac, i) => (
          <div
            key={i}
            style={{
              height: 4,
              width: `${frac * 100}%`,
              borderRadius: 2,
              background: 'rgba(20,25,38,0.45)',
              filter: 'blur(0.8px)',
            }}
          />
        ))}
      </div>

      {/* Micro-barcode & stamp */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 12 }}>
          {[3, 1, 2, 4, 1, 3, 2].map((bw, i) => (
            <div
              key={i}
              style={{
                width: bw,
                height: 12,
                background: 'rgba(20,25,38,0.65)',
              }}
            />
          ))}
        </div>
        <div
          style={{
            width: 32,
            height: 10,
            borderRadius: 3,
            background: 'rgba(20,25,38,0.4)',
            filter: 'blur(1.2px)',
          }}
        />
      </div>
    </div>
  )
}

// ─── Scene 1 (0–7s): Chaotic Invoice Influx & Anomaly Meter ───────────────────

export function FloodArrivalScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: impact
  // 0.5s: whoosh
  // 2.2s: paperRustle
  // 4.6s: alert
  // 6.1s: sceneTransition
  const impactP = pop(t, 0.0, 0.6)
  const alertFlash = pop(t, 4.6, 0.5)

  return (
    <InkFloodStage scene={scene} t={t}>
      {/* Top Anomaly Telemetry Bar */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          insetInlineStart: 44,
          width: 452,
          height: 44,
          borderRadius: 12,
          background: 'rgba(16,20,32,0.85)',
          border: `1.5px solid ${alertFlash > 0.5 ? ALERT_CRIMSON : 'rgba(255,185,84,0.35)'}`,
          boxShadow: `0 10px 28px rgba(0,0,0,0.6), 0 0 ${alertFlash * 22}px ${ALERT_CRIMSON}55`,
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
              background: alertFlash > 0.3 ? ALERT_CRIMSON : FLOOD_AMBER,
              boxShadow: `0 0 10px ${alertFlash > 0.3 ? ALERT_CRIMSON : FLOOD_AMBER}`,
            }}
          />
          <span
            dir="rtl"
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: alertFlash > 0.3 ? ALERT_CRIMSON : FLOOD_AMBER,
            }}
          >
            {t < 4.6 ? 'آشفتگی فاکتورهای دستی' : 'هشدار: فاکتورهای مفقود'}
          </span>
        </div>
        <div dir="rtl" style={{ fontSize: 13, fontWeight: 700, color: INK_MIST }}>
          نرخ ورود: <FloodRoll t={t} at={0.5} value={142} size={15} color={FLOOD_AMBER} /> برگه
        </div>
      </div>

      <FloodWords
        t={t}
        cueAt={1.2}
        y={122}
        words={['فروختی…', 'ولی', 'آخرش', 'چقدر', 'موند؟']}
        accentWord="چقدر"
        size={42}
      />

      {/* Chaotic storm of bills across lanes (never overlapping text at y: 122..170) */}
      {Array.from({ length: 14 }).map((_, i) => {
        const seed = deterministicHash(i, 23)
        const laneX = 24 + ((i * 77) % 360) + seed * 24
        const p = ease(clamp(progress(t, 0.1 + i * 0.22, 1.4)))
        const scale = mix(0.65, 1.15, p)
        const x = mix(laneX - 30, laneX + mix(-20, 25, seed), p)
        const y = mix(-100 + seed * 220, 220 + seed * 480, p)
        const rot = mix((seed - 0.5) * 36, seed > 0.5 ? 12 : -14, p) + Math.sin(t * 2 + i) * 2.2
        const w = 140 * scale
        const h = 180 * scale
        const isSettled = p > 0.65
        const settledY = Math.max(y, 215 + (i % 4) * 48)

        const tags = [undefined, 'تسویه‌نشده', undefined, 'مخدوش', undefined, 'تکراری']
        const tag = tags[i % tags.length]

        return (
          <ReceiptBill
            key={i}
            x={x}
            y={isSettled ? settledY : y}
            w={w}
            h={h}
            rot={rot}
            opacity={0.35 + p * 0.55}
            tag={tag}
            zIndex={24 - (i % 6)}
          />
        )
      })}

      {/* Bottom status alert banner */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 40,
          insetInlineStart: 44,
          width: 452,
          height: 48,
          borderRadius: 12,
          background: 'rgba(16,20,32,0.92)',
          border: '1.5px solid rgba(248,113,113,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          zIndex: 45,
          opacity: clamp(pop(t, 4.6, 0.7) * 1.5),
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: ALERT_CRIMSON }} />
        <span style={{ fontSize: 14, fontWeight: 800, color: INK_MIST }}>
          ۳ قلم کسری انبار · ۲ فاکتور بدون تسویه مشخص
        </span>
      </div>
    </InkFloodStage>
  )
}

// ─── Scene 2 (7–15s): Temporal Freeze & Gravitational Singularity ─────────────

export function SuctionFreezeScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: softTransition (freeze)
  // 0.8s: cinematicReveal (singularity ignition)
  // 2.2s: dataFlow (suction spiral)
  // 4.9s: whoosh (final rush)
  // 6.3s: chime (collapse to quantum cube)
  const revealP = pop(t, 0.8, 0.9)
  const suctionP = ease(clamp(progress(t, 2.2, 5.0)))
  const collapseP = pop(t, 6.3, 0.6)

  const coreX = 270
  const coreY = 480

  return (
    <InkFloodStage scene={scene} t={t}>
      <FloodWords
        t={t}
        cueAt={0.4}
        y={124}
        words={['مکث،', 'سپس', 'نقطهٔ', 'روشن.']}
        accentWord="روشن."
        size={42}
      />

      {/* Frozen and spiraling invoice fragments */}
      {Array.from({ length: 16 }).map((_, i) => {
        const seed = deterministicHash(i, 37)
        const theta0 = seed * Math.PI * 2
        const r0 = 140 + seed * 180
        const ang = theta0 + suctionP * (3.5 + seed * 1.5)
        const r = r0 * Math.max(0, 1 - suctionP)
        const x = coreX + Math.cos(ang) * r - 52
        const y = coreY + Math.sin(ang) * r * 0.65 - 65
        const scale = mix(1, 0.08, suctionP)
        const opacity = (0.7 + seed * 0.3) * Math.max(0, 1 - suctionP * 1.1)

        return (
          <ReceiptBill
            key={i}
            x={x}
            y={y}
            w={104 * scale}
            h={130 * scale}
            rot={(seed - 0.5) * 32 + suctionP * 90}
            opacity={opacity}
            zIndex={25}
          />
        )
      })}

      {/* Accretion Singularity Centerpiece */}
      <div
        style={{
          position: 'absolute',
          top: coreY - 140,
          insetInlineStart: coreX - 140,
          width: 280,
          height: 280,
          pointerEvents: 'none',
          zIndex: 35,
          opacity: clamp(revealP * 1.5),
        }}
      >
        {/* Glowing halo disc */}
        <div
          style={{
            position: 'absolute',
            inset: 30,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(255,235,190,0.85) 0%, rgba(255,185,84,0.4) 40%, rgba(79,227,196,0.15) 65%, transparent 75%)',
            filter: 'blur(8px)',
            transform: `scale(${mix(0.4, 1.25, revealP) * (1 - collapseP * 0.75)})`,
          }}
        />

        {/* Counter-rotating vector orbital rings */}
        <svg viewBox="0 0 280 280" style={{ width: 280, height: 280, position: 'absolute' }}>
          <circle
            cx="140"
            cy="140"
            r={mix(20, 105, revealP)}
            fill="none"
            stroke={FLOOD_AMBER}
            strokeWidth="1.8"
            strokeDasharray="14 10 28 8"
            transform={`rotate(${t * 45}, 140, 140)`}
            opacity={0.65 * (1 - collapseP * 0.6)}
          />
          <circle
            cx="140"
            cy="140"
            r={mix(15, 78, revealP)}
            fill="none"
            stroke={CLARITY_TEAL}
            strokeWidth="2.2"
            strokeDasharray="22 14 6 12"
            transform={`rotate(${-t * 60}, 140, 140)`}
            opacity={0.8 * (1 - collapseP * 0.5)}
          />
        </svg>

        {/* Dense Collapsed Quantum Core (Pops at 6.3s chime) */}
        {collapseP > 0.05 && (
          <div
            style={{
              position: 'absolute',
              top: 105,
              insetInlineStart: 105,
              width: 70,
              height: 70,
              borderRadius: 18,
              background: 'linear-gradient(145deg, #18223c, #0a0f1d)',
              border: `2px solid ${CLARITY_TEAL}`,
              boxShadow: `0 0 32px ${CLARITY_TEAL}aa, inset 0 0 16px ${FLOOD_AMBER}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${mix(0.2, 1, collapseP)})`,
              zIndex: 40,
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                background: FLOOD_AMBER,
                boxShadow: `0 0 16px ${FLOOD_AMBER}`,
              }}
            />
          </div>
        )}
      </div>

      {/* Subtitle status indicator */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 730,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 16,
          fontWeight: 800,
          color: CLARITY_TEAL,
          opacity: clamp(progress(t, 2.5, 4.0)),
        }}
      >
        فشرده‌سازی خودکار اسناد در یک پایگاه داده متمرکز
      </div>
    </InkFloodStage>
  )
}

// ─── Scene 3 (15–24s): Holographic Obsidian Telemetry Pillars ─────────────────
// Disjoint Geometry Proof (Worst-case hold frame):
// Columns: x = 32..256 (w: 224) and x = 284..508 (w: 224) → gap: 28px, margin: 32px
// Rows: y = 240..386 (h: 146) and y = 418..564 (h: 146) → gap: 32px
// Bottom Arithmetic Rail: y = 600..664 (h: 64) → gap: 36px from cards
// Zero overlap guaranteed across the entire 540x960 stage.

function TelemetryCard({
  at,
  t,
  x,
  y,
  label,
  rollAt,
  value,
  suffix,
  accent,
  sublabel,
}: {
  at: number
  t: number
  x: number
  y: number
  label: string
  rollAt: number
  value: number
  suffix?: string
  accent: string
  sublabel: string
}) {
  const p = pop(t, at, 0.65)
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        insetInlineStart: x,
        width: 224,
        height: 146,
        borderRadius: 18,
        zIndex: 30,
        opacity: clamp(p * 1.6),
        transform: `scale(${mix(0.85, 1, p).toFixed(3)})`,
        background: 'linear-gradient(160deg, rgba(22,28,46,0.85), rgba(10,14,26,0.92))',
        border: `1.5px solid ${accent}55`,
        boxShadow: `0 16px 36px rgba(0,0,0,0.6), 0 0 24px ${accent}25, inset 0 1px 0 rgba(255,255,255,0.12)`,
        padding: '16px 18px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Top accent bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: INK_MIST }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: accent,
            background: `${accent}18`,
            border: `1px solid ${accent}44`,
            padding: '2px 8px',
            borderRadius: 6,
          }}
        >
          {sublabel}
        </div>
      </div>

      {/* Main Rolling Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <FloodRoll t={t} at={rollAt} value={value} size={28} color={accent} />
        {suffix && (
          <span style={{ fontSize: 14, fontWeight: 700, color: INK_MUTED }}>{suffix}</span>
        )}
      </div>

      {/* Micro-spark status track */}
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: 'rgba(255,255,255,0.08)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${clamp(progress(t, rollAt, rollAt + 1.2)) * 100}%`,
            background: `linear-gradient(90deg, ${accent}88, ${accent})`,
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  )
}

export function ClarityCardsScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.5s: cardThock (Pillar 1)
  // 1.7s: cardThock (Pillar 2)
  // 3.0s: cardThock (Pillar 3)
  // 4.3s: cardThock (Pillar 4)
  // 5.6s: precisionSequence (Arithmetic Bus Rail)
  // 7.0s: chime (Lock equation green)
  const eqP = pop(t, 5.6, 0.7)
  const lockP = pop(t, 7.0, 0.5)

  return (
    <InkFloodStage scene={scene} t={t}>
      <FloodWords
        t={t}
        cueAt={0.2}
        y={124}
        words={['واقعیت،', 'روشن', 'شد.']}
        accentWord="روشن"
        size={42}
      />

      {/* 4 Telemetry Pillars */}
      <TelemetryCard
        at={0.5}
        t={t}
        x={32}
        y={240}
        label="فروش کل"
        rollAt={0.7}
        value={1840000}
        accent={CLARITY_TEAL}
        sublabel="تاییدشده"
      />
      <TelemetryCard
        at={1.7}
        t={t}
        x={284}
        y={240}
        label="سود واقعی"
        rollAt={1.9}
        value={475000}
        accent={FLOOD_AMBER}
        sublabel="۲۵.۸٪ مارجین"
      />
      <TelemetryCard
        at={3.0}
        t={t}
        x={32}
        y={418}
        label="موجودی انبار"
        rollAt={3.2}
        value={312}
        suffix="قلم"
        accent={EMERALD_OK}
        sublabel="۰ کسری"
      />
      <TelemetryCard
        at={4.3}
        t={t}
        x={284}
        y={418}
        label="مطالبات بازاری"
        rollAt={4.5}
        value={218000}
        accent="#a78bfa"
        sublabel="پیگیری خودکار"
      />

      {/* Bottom Arithmetic Equation Rail */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 600,
          insetInlineStart: 32,
          width: 476,
          height: 64,
          borderRadius: 16,
          background: 'rgba(14,19,34,0.92)',
          border: `1.5px solid ${lockP > 0.5 ? EMERALD_OK : 'rgba(79,227,196,0.35)'}`,
          boxShadow: `0 14px 34px rgba(0,0,0,0.6), 0 0 ${lockP * 24}px ${EMERALD_OK}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 16px',
          boxSizing: 'border-box',
          opacity: clamp(eqP * 1.5),
          transform: `translateY(${mix(18, 0, eqP).toFixed(1)}px)`,
          zIndex: 35,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 800, color: INK_MIST }}>
          فروش <span style={{ color: CLARITY_TEAL }}>{faNumber(1840000)}</span>
        </span>
        <span style={{ fontSize: 16, fontWeight: 900, color: ALERT_CRIMSON }}>−</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: INK_MIST }}>
          بها <span style={{ color: ALERT_CRIMSON }}>{faNumber(1225000)}</span>
        </span>
        <span style={{ fontSize: 16, fontWeight: 900, color: ALERT_CRIMSON }}>−</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: INK_MIST }}>
          خرج <span style={{ color: ALERT_CRIMSON }}>{faNumber(140000)}</span>
        </span>
        <span style={{ fontSize: 16, fontWeight: 900, color: EMERALD_OK }}>=</span>
        <span
          style={{ fontSize: 16, fontWeight: 900, color: lockP > 0.5 ? EMERALD_OK : FLOOD_AMBER }}
        >
          سود {faNumber(475000)}
        </span>
      </div>
    </InkFloodStage>
  )
}

// ─── Scene 4 (24–34s): Mobile Titanium Cockpit Terminal ───────────────────────
// Phone Dimensions: x: 125, y: 194, w: 290, h: 540.
// Interior is strictly Container-Local (0..290 / 0..540) with overflow: hidden.

export function PhoneDashboardScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: whoosh (docking)
  // 1.0s: dataFlow (live stream)
  // 3.6s: financialMilestone (profit bar lock)
  // 5.2s: cash (instant cash settlement)
  // 6.8s: insightReveal (badge lock)
  const phoneP = pop(t, 0.0, 0.8)
  const streamP = pop(t, 1.0, 0.7)
  const milestoneP = pop(t, 3.6, 0.6)
  const badgeP = pop(t, 6.8, 0.6)

  return (
    <InkFloodStage scene={scene} t={t}>
      <FloodWords
        t={t}
        cueAt={0.2}
        y={116}
        words={['همین', 'عددها', 'الان،', 'بی‌کاغذ.']}
        accentWord="بی‌کاغذ."
        size={42}
      />

      {/* Floating Titanium Phone Container */}
      <div
        style={{
          position: 'absolute',
          top: 194,
          insetInlineStart: 125,
          width: 290,
          height: 540,
          borderRadius: 40,
          background: 'linear-gradient(180deg, #101626, #060812)',
          border: '3px solid rgba(255,255,255,0.22)',
          boxShadow:
            '0 36px 80px rgba(0,0,0,0.8), 0 0 40px rgba(79,227,196,0.18), inset 0 1px 0 rgba(255,255,255,0.35)',
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
          <span style={{ fontSize: 18, fontWeight: 900, color: CLARITY_TEAL }}>حسابچه</span>
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
            همگام آنلاین / آفلاین
          </div>
        </div>

        {/* Metric Row 1: فروش (top: 80, h: 56) */}
        <div
          style={{
            position: 'absolute',
            top: 80,
            insetInlineStart: 16,
            width: 258,
            height: 56,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '8px 12px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span dir="rtl" style={{ fontSize: 14, fontWeight: 800, color: INK_MIST }}>
              فروش کل دوره
            </span>
            <FloodRoll t={t} at={0.8} value={1840000} size={16} color={CLARITY_TEAL} />
          </div>
          <div
            style={{
              marginTop: 6,
              height: 4,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: 4,
                width: `${clamp(progress(t, 0.8, 2.0)) * 100}%`,
                background: CLARITY_TEAL,
              }}
            />
          </div>
        </div>

        {/* Metric Row 2: سود خالص طلایی (top: 146, h: 64) */}
        <div
          style={{
            position: 'absolute',
            top: 146,
            insetInlineStart: 16,
            width: 258,
            height: 64,
            borderRadius: 14,
            background:
              milestoneP > 0.5
                ? 'linear-gradient(145deg, rgba(255,185,84,0.2), rgba(255,185,84,0.06))'
                : 'rgba(255,255,255,0.05)',
            border: `1.5px solid ${milestoneP > 0.5 ? FLOOD_AMBER : 'rgba(255,185,84,0.3)'}`,
            boxShadow: milestoneP > 0.5 ? `0 0 20px ${FLOOD_AMBER}44` : 'none',
            padding: '10px 14px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: FLOOD_AMBER }}>
              سود خالص واقعی
            </span>
            <FloodRoll t={t} at={2.0} value={475000} size={18} color={FLOOD_AMBER} />
          </div>
          <div dir="rtl" style={{ fontSize: 11, fontWeight: 700, color: INK_MUTED, marginTop: 4 }}>
            حاشیه سود: ۲۵.۸٪ خالص پس از کسر تمام مخارج
          </div>
        </div>

        {/* Live Transaction Ledger Stream (top: 224, h: 230) */}
        <div
          style={{
            position: 'absolute',
            top: 224,
            insetInlineStart: 16,
            width: 258,
            height: 230,
            borderRadius: 14,
            background: 'rgba(10,14,24,0.7)',
            border: '1px solid rgba(79,227,196,0.2)',
            padding: '10px 12px',
            boxSizing: 'border-box',
            opacity: clamp(streamP * 1.5),
          }}
        >
          <div
            dir="rtl"
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: CLARITY_TEAL,
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>جریان زنده فاکتورها</span>
            <span style={{ color: EMERALD_OK }}>لحظه‌ای</span>
          </div>

          {[
            { num: 1082, desc: 'فاکتور فروش کالا', val: 65000, at: 1.4 },
            { num: 1081, desc: 'تسویه دستگاه پوز', val: 120000, at: 3.2 },
            { num: 1080, desc: 'فروش نقدی روزانه', val: 85000, at: 5.2 },
          ].map((item) => {
            const rowP = pop(t, item.at, 0.5)
            return (
              <div
                key={item.num}
                dir="rtl"
                style={{
                  height: 48,
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  marginBottom: 6,
                  padding: '6px 10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: clamp(rowP * 1.5),
                  transform: `translateX(${mix(12, 0, rowP).toFixed(1)}px)`,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: INK_MIST }}>{item.desc}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: INK_MUTED }}>
                    شماره #{faNumber(item.num)}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 900, color: EMERALD_OK }}>
                  +{faNumber(item.val)}
                </div>
              </div>
            )
          })}
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

      {/* Floating Enterprise Security Badge */}
      {badgeP > 0.1 && (
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            bottom: 60,
            insetInlineStart: 50,
            width: 440,
            height: 42,
            borderRadius: 12,
            background: 'rgba(16,22,36,0.95)',
            border: '1.5px solid rgba(79,227,196,0.4)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            opacity: clamp(badgeP * 1.5),
            zIndex: 45,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: EMERALD_OK }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: INK_MIST }}>
            بدون کاغذ · بدون بایگانی دستی · دسترسی امن از همه جا
          </span>
        </div>
      )}
    </InkFloodStage>
  )
}

// ─── Scene 5 (34–41s): Photonic Laser Beam Cleanse ────────────────────────────

export function CureSweepSlideScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: cameraSwish
  // 1.2s: scan (laser beam moves from right to left: 480 → 44)
  // 4.6s: success (all purified rows locked)
  // 5.8s: softTransition
  const sweep = ease(clamp(progress(t, 1.2, 4.6)))
  const laserX = mix(480, 44, sweep)

  const ledgerRows = [
    { label: 'ثبت خودکار فاکتورهای فروش', badge: '۱۰۰٪ دیجیتال', at: 1.5 },
    { label: 'محاسبه لحظه‌ای سود ناخالص', badge: 'بدون خطای محاسباتی', at: 2.2 },
    { label: 'کسر آنی موجودی از انبار', badge: 'کاردکس لحظه‌ای', at: 3.0 },
    { label: 'تفکیک طلب مشتریان و موعد تسویه', badge: 'یادآوری خودکار', at: 3.8 },
  ]

  return (
    <InkFloodStage scene={scene} t={t}>
      <FloodWords
        t={t}
        cueAt={0.3}
        y={124}
        words={['هر', 'جا', 'گذشت،', 'تمیز.']}
        accentWord="تمیز."
        size={42}
      />

      {/* Chaotic scrap remnants to the right of laser (visible only when x > laserX) */}
      {Array.from({ length: 8 }).map((_, i) => {
        const seed = deterministicHash(i, 83)
        const x = 200 + (i % 4) * 65 + seed * 30
        const y = 250 + ((i * 73) % 400)
        const isErased = laserX < x + 30
        return (
          <ReceiptBill
            key={i}
            x={x}
            y={y}
            w={88}
            h={112}
            rot={(seed - 0.5) * 24}
            opacity={!isErased ? 0.45 : 0}
            zIndex={22}
          />
        )
      })}

      {/* 4 Purified High-Craft Obsidian Ledger Rows */}
      {ledgerRows.map((row, i) => {
        const rowY = 250 + i * 94
        const passed = laserX <= 380
        const rowP = pop(t, row.at, 0.5)

        return (
          <div
            key={row.label}
            dir="rtl"
            style={{
              position: 'absolute',
              top: rowY,
              insetInlineStart: 44,
              width: 452,
              height: 74,
              borderRadius: 16,
              background: 'linear-gradient(155deg, rgba(18,24,40,0.92), rgba(10,14,26,0.95))',
              border: `1.5px solid ${passed ? 'rgba(79,227,196,0.45)' : 'rgba(255,255,255,0.1)'}`,
              boxShadow: passed
                ? '0 12px 30px rgba(0,0,0,0.6), 0 0 20px rgba(79,227,196,0.18)'
                : '0 8px 20px rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 20px',
              boxSizing: 'border-box',
              zIndex: 30,
              opacity: passed ? clamp(rowP * 1.5) : 0,
              transform: `translateX(${passed ? mix(16, 0, rowP).toFixed(1) : 16}px)`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: 'rgba(52,211,153,0.15)',
                  border: '1.5px solid rgba(52,211,153,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: EMERALD_OK,
                  fontSize: 16,
                  fontWeight: 900,
                }}
              >
                ✓
              </div>
              <span style={{ fontSize: 16, fontWeight: 900, color: INK_MIST }}>{row.label}</span>
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: CLARITY_TEAL,
                background: 'rgba(79,227,196,0.12)',
                border: '1px solid rgba(79,227,196,0.3)',
                padding: '4px 10px',
                borderRadius: 8,
              }}
            >
              {row.badge}
            </div>
          </div>
        )
      })}

      {/* Moving Photonic Laser Beam */}
      <div
        style={{
          position: 'absolute',
          top: 190,
          bottom: 120,
          insetInlineStart: laserX - 16,
          width: 32,
          zIndex: 42,
          borderRadius: 16,
          background:
            'linear-gradient(180deg, rgba(255,235,190,0.9), rgba(255,185,84,0.6) 40%, rgba(79,227,196,0.7))',
          filter: 'blur(2px)',
          boxShadow: '0 0 36px rgba(255,185,84,0.7), 0 0 60px rgba(79,227,196,0.5)',
          opacity: sweep > 0 && sweep < 1 ? 0.95 : t < 1.2 ? 0 : clamp(1 - (sweep - 1) * 6),
          pointerEvents: 'none',
        }}
      />
    </InkFloodStage>
  )
}

// ─── Scene 6 (41–45s): Brand Climax & High-Conversion Action Hub ──────────────

export function InkCtaScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.0s: ctaResolution
  // 0.4s: bigReveal
  // 1.1s: chime
  const lockP = pop(t, 0.0, 0.8)
  const cardsP = pop(t, 0.4, 0.7)
  const chimeP = pop(t, 1.1, 0.5)

  return (
    <InkFloodStage scene={scene} t={t}>
      {/* Central Luminous Hisabche Emblem */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          insetInlineStart: '50%',
          transform: 'translateX(-50%)',
          width: 90,
          height: 90,
          borderRadius: 26,
          background: 'linear-gradient(145deg, #18223c, #0a0f1d)',
          border: `2px solid ${CLARITY_TEAL}`,
          boxShadow: `0 0 44px ${CLARITY_TEAL}77, inset 0 0 20px ${FLOOD_AMBER}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: clamp(lockP * 1.5),
          zIndex: 40,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${FLOOD_AMBER}, ${CLARITY_TEAL})`,
            boxShadow: `0 0 22px ${FLOOD_AMBER}`,
          }}
        />
      </div>

      {/* Brand Wordmark */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 284,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 66,
          fontWeight: 900,
          color: INK_MIST,
          textShadow: '0 0 48px rgba(255,185,84,0.45)',
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
          top: 382,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 18,
          fontWeight: 700,
          color: INK_MUTED,
          opacity: clamp(lockP * 1.4),
        }}
      >
        نرم‌افزار یکپارچه حسابداری و مدیریت مالی کسب‌وکار
      </div>

      <FloodWords
        t={t}
        cueAt={0.2}
        y={436}
        words={['حساب', 'روشن', 'از', 'امشب.']}
        accentWord="امشب."
        size={40}
      />

      {/* Two High-Conversion Action Cards (Disjoint geometry, 0 overlap) */}
      <div
        style={{
          position: 'absolute',
          top: 530,
          insetInlineStart: 44,
          width: 216,
          height: 140,
          borderRadius: 20,
          background: 'linear-gradient(155deg, rgba(20,28,46,0.9), rgba(10,14,24,0.95))',
          border: `1.5px solid ${CLARITY_TEAL}66`,
          boxShadow: `0 16px 36px rgba(0,0,0,0.6), 0 0 ${chimeP * 24}px ${CLARITY_TEAL}44`,
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
          style={{ fontSize: 16, fontWeight: 900, color: INK_MIST, textAlign: 'center' }}
        >
          شروع رایگان
        </span>
        <span
          dir="rtl"
          style={{ fontSize: 12, fontWeight: 700, color: INK_MUTED, textAlign: 'center' }}
        >
          بدون نیاز به کارت بانکی
        </span>
        <div
          style={{
            width: '100%',
            height: 38,
            borderRadius: 12,
            background: `${CLARITY_TEAL}22`,
            border: `1.5px solid ${CLARITY_TEAL}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 16px ${CLARITY_TEAL}44`,
          }}
        >
          <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: CLARITY_TEAL }}>
            ثبت‌نام آنلاین
          </span>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 530,
          insetInlineStart: 280,
          width: 216,
          height: 140,
          borderRadius: 20,
          background: 'linear-gradient(155deg, rgba(20,28,46,0.9), rgba(10,14,24,0.95))',
          border: `1.5px solid ${FLOOD_AMBER}66`,
          boxShadow: `0 16px 36px rgba(0,0,0,0.6), 0 0 ${chimeP * 24}px ${FLOOD_AMBER}44`,
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
          style={{ fontSize: 16, fontWeight: 900, color: INK_MIST, textAlign: 'center' }}
        >
          درخواست دمو
        </span>
        <span
          dir="rtl"
          style={{ fontSize: 12, fontWeight: 700, color: INK_MUTED, textAlign: 'center' }}
        >
          مشاوره استقرار کسب‌وکار
        </span>
        <div
          style={{
            width: '100%',
            height: 38,
            borderRadius: 12,
            background: `${FLOOD_AMBER}22`,
            border: `1.5px solid ${FLOOD_AMBER}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 16px ${FLOOD_AMBER}44`,
          }}
        >
          <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: FLOOD_AMBER }}>
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
          color: INK_MUTED,
          opacity: clamp(cardsP * 1.3),
        }}
      >
        نسخه وب · ویندوز · اندروید · با پشتیبانی از حالت آفلاین
      </div>
    </InkFloodStage>
  )
}
