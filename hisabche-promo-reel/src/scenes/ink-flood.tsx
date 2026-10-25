// ============================================
// Ink-Flood art direction (reel 90) — «سیل کاغذها»
//
// Night-shop ink-wash film. Frame 0: a hundred invoices and receipts flood
// the counter and submerge the owner. Everything freezes; a single bright
// core drags every sheet into one point of light; the sheets resurface as
// four clean floating cards (sales / stock / profit / receivable), then land
// inside the shop's phone as a live dashboard. A vertical cure-line then
// sweeps across the stage and wherever it passes, paper becomes a clean
// panel and holds.
//
// Bespoke, self-authored stage: own palette (warm paper over ink night),
// own primitives, own layout math. Nothing from paper-galaxy / cash-tide /
// distilbook sets is reused except the shared HalftoneCharacter primitive.
//
// Persistent arithmetic (digits via faNumber only — layout-defect-laws band 6):
//   ۱٬۸۴۰٬۰۰۰ فروش − ۱٬۲۲۵٬۰۰۰ بهای تمام‌شده − ۱۴۰٬۰۰۰ خرج = ۴۷۵٬۰۰۰ سود
//   طلب ۲۱۸٬۰۰۰ · انبار ۳۱۲ (۳ قلم بحرانی)
// ============================================

import type { CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, deterministicHash, ease, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'
import { HalftoneCharacter } from './paper-pocket'

// ─── Tokens ──────────────────────────────────────────────────────────────────

export const INK_CANVAS = '#080b16'
export const PAPER_WARM = '#f3ead8'
export const FLOOD_AMBER = '#ffb954'
export const CLARITY_TEAL = '#4fe3c4'
export const INK_MIST = '#ece6d8'

const INK_WASH: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(820px 500px at 50% 30%, rgba(255,185,84,0.10), transparent 62%), radial-gradient(640px 430px at 22% 72%, rgba(79,227,196,0.07), transparent 64%)',
}

const INK_VIGNETTE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(120% 86% at 50% 40%, transparent 50%, rgba(2,3,8,0.88) 100%)',
}

function pop(t: number, at: number, dur = 0.55): number {
  return spring(clamp(progress(t, at, at + dur)))
}

// ─── Stage ───────────────────────────────────────────────────────────────────

/** The stage every scene paints over. */
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
        // Deterministic canvas (layout-defect-laws.md band 1): the player
        // document is RTL and mirrors insetInlineStart; the stage pins LTR so
        // every numeric inset below is a physical left coordinate.
        direction: 'ltr',
        background: INK_CANVAS,
        overflow: 'hidden',
        color: INK_MIST,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={INK_WASH} />
        {/* ink dust: slow drifting motes */}
        {Array.from({ length: 36 }).map((_, i) => {
          const seed = deterministicHash(i, 53)
          const x = ((i * 97) % 540) + seed * 18
          const cycle = (t * (0.015 + seed * 0.04) + seed) % 1
          const y = 1000 - cycle * 1060
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
                background: INK_MIST,
                opacity: Math.sin(cycle * Math.PI) * (0.08 + seed * 0.14),
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

// ─── Primitives ──────────────────────────────────────────────────────────────

/**
 * Staged word cluster: full-bleed row (insetInlineStart 0 + insetInlineEnd 0),
 * safe centering with flex only; `dir="rtl"` is explicit for Persian reading
 * order (layout-defect-laws.md bands 1–2). Mount-once, stays to the end.
 */
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
        gap: '0.28em',
      }}
    >
      {words.map((word, i) => {
        const p = pop(t, cueAt + i * 0.4)
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
                ? `0 0 26px ${accentColor ?? FLOOD_AMBER}`
                : '0 2px 14px rgba(0,0,0,0.65)',
            }}
          >
            {word}
          </span>
        )
      })}
    </div>
  )
}

/** Monotonic rolling figure: 0 → value, then holds (never blinks). */
function FloodRoll({
  t,
  at,
  value,
  size = 30,
}: {
  t: number
  at: number
  value: number
  size?: number
}) {
  const p = ease(clamp(progress(t, at, at + 1.3)))
  const n = Math.round(mix(0, value, p))
  return (
    <span
      dir="ltr"
      style={{
        fontSize: size,
        fontWeight: 900,
        color: INK_MIST,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.05,
        textShadow: `0 0 14px ${FLOOD_AMBER}55`,
        whiteSpace: 'nowrap',
      }}
    >
      {faNumber(n)}
    </span>
  )
}

/**
 * A flying invoice sheet. Pure motion decoration: its printable face carries
 * ltr mono micro-lines and blurred digit strokes (never a readable number —
 * digits, not the value, render via char-map-safe CSS only).
 */
function FlightSheet({
  x,
  y,
  w,
  h,
  rot,
  opacity,
  zIndex = 20,
}: {
  x: number
  y: number
  w: number
  h: number
  rot: number
  opacity: number
  zIndex?: number
}) {
  const visible = opacity > 0.01
  if (!visible) return null
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
        background: `linear-gradient(180deg, ${PAPER_WARM}f2, ${PAPER_WARM}d6)`,
        boxShadow: '0 14px 30px rgba(0,0,0,0.4)',
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        justifyContent: 'center',
      }}
    >
      {[0.92, 0.66, 0.78, 0.4].map((frac, i) => (
        <div
          key={i}
          style={{
            height: 4 + (i === 1 ? 3 : 0),
            width: `${frac * 100}%`,
            borderRadius: 3,
            background: 'rgba(12,16,28,0.5)',
            filter: 'blur(1.2px)',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          insetInlineStart: 10,
          width: 54,
          height: 12,
          borderRadius: 4,
          background: 'rgba(12,16,28,0.62)',
          filter: 'blur(2.4px)',
        }}
      />
    </div>
  )
}

/** One clarity card with hand-proven geometry. */
function ClarityCard({
  at,
  t,
  x,
  y,
  label,
  rollAt,
  value,
  suffix,
  accent,
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
}) {
  const p = pop(t, at)
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        insetInlineStart: x,
        width: 230,
        height: 128,
        borderRadius: 14,
        zIndex: 30,
        opacity: clamp(p * 1.6),
        transform: `scale(${mix(0.82, 1, p).toFixed(3)})`,
        background: `linear-gradient(160deg, rgba(243,234,216,0.10), rgba(243,234,216,0.03))`,
        border: `1.5px solid rgba(243,234,216,0.22)`,
        boxShadow: `0 18px 40px rgba(0,0,0,0.45), 0 0 26px ${accent}30`,
        padding: '16px 18px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 14,
          bottom: 14,
          insetInlineStart: 0,
          width: 5,
          borderRadius: 4,
          background: accent,
          opacity: 0.9,
        }}
      />
      <div
        dir="rtl"
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          justifyContent: 'flex-start',
        }}
      >
        <span style={{ fontSize: 24, fontWeight: 800, color: INK_MIST }}>{label}</span>
        {suffix ? (
          <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(236,230,216,0.62)' }}>
            {suffix}
          </span>
        ) : null}
      </div>
      <div style={{ marginTop: 10 }}>
        <FloodRoll t={t} at={rollAt} value={value} size={32} />
      </div>
      {/* hold-glow floor: keeps the card readable on the hold frame */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          insetInlineStart: 18,
          width: 74,
          height: 4,
          borderRadius: 3,
          background: accent,
          opacity: 0.55,
        }}
      />
    </div>
  )
}

// ─── Scene 1 (0–7s): the flood arrives on frame 0 ────────────────────────────

export function FloodArrivalScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const wordsCue = 1.6
  return (
    <InkFloodStage scene={scene} t={t}>
      {/* 12 flooding sheets: each charges the camera on its own lane then slows.
          Hold-frame geometry: sheets never center-stack on one point — lane
          offsets keep their worst-case bounding boxes disjoint (≥ 30px). */}
      {Array.from({ length: 12 }).map((_, i) => {
        const seed = deterministicHash(i, 17)
        const laneX = 36 + ((i * 89) % 380) + seed * 20
        const p = ease(clamp(progress(t, 0.1 + i * 0.24, 1.35)))
        const scale = mix(0.5, 1.35, p)
        const x = mix(laneX, laneX + mix(-30, 30, seed), p) * (1 - p * 0.14)
        const y = mix(-90 + seed * 240, 200 + seed * 560, p)
        const rot = mix((seed - 0.5) * 22, seed > 0.5 ? 8 : -8, p) + Math.sin(t * 1.6 + i) * 1.6
        const w = 150 * scale
        const h = 196 * scale
        // lane pass keeps cards clear of the word cluster band (y 96–200) at
        // worst case: y > 224 for all i once p ≥ 0.55 → no overlap with text.
        const settled = p > 0.55
        return (
          <FlightSheet
            key={i}
            x={x}
            y={settled ? Math.max(y, 236 + (i % 3) * 34) : y}
            w={w}
            h={h}
            rot={rot}
            opacity={0.3 + p * 0.5}
            zIndex={26 - (i % 4)}
          />
        )
      })}
      <HalftoneCharacter
        t={t}
        mood="dizzy"
        scale={1.02}
        style={{ position: 'absolute', insetInlineStart: 28, top: 620, zIndex: 34 }}
      />
      <FloodWords
        t={t}
        cueAt={wordsCue}
        y={110}
        words={['فروختی…', 'ولی', 'آخرش', 'چقدر', 'موند؟']}
        accentWord="چقدر"
        size={44}
      />
    </InkFloodStage>
  )
}

// ─── Scene 2 (7–15s): freeze + suction into one bright core ──────────────────

export function SuctionFreezeScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const corePop = pop(t, 2.0, 1.1)
  const pull = ease(clamp(progress(t, 2.2, 4.8)))
  return (
    <InkFloodStage scene={scene} t={t}>
      {/* frozen sheets spiral into the core */}
      {Array.from({ length: 14 }).map((_, i) => {
        const seed = deterministicHash(i, 29)
        const theta0 = seed * Math.PI * 2
        const r0 = 120 + seed * 190
        const ang = theta0 + pull * (2.4 + seed)
        const r = r0 * (1 - pull)
        const x = 270 + Math.cos(ang) * r - 58
        const y = 452 + Math.sin(ang) * r * 0.62 - 66
        const scale = mix(1, 0.1, pull)
        const opacity = (0.55 + seed * 0.4) * (1 - pull * 0.92)
        return (
          <FlightSheet
            key={i}
            x={x}
            y={y}
            w={116 * scale}
            h={150 * scale}
            rot={(seed - 0.5) * 26 + pull * 40}
            opacity={opacity}
          />
        )
      })}
      {/* the bright core */}
      <div
        style={{
          position: 'absolute',
          top: 452,
          insetInlineStart: 270,
          width: 4,
          height: 4,
          zIndex: 40,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: mix(-30, -110, corePop),
            insetInlineStart: mix(-30, -110, corePop),
            width: mix(60, 220, corePop),
            height: mix(60, 220, corePop),
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(255,236,190,0.9), rgba(255,185,84,0.35) 46%, transparent 70%)',
            filter: 'blur(2px)',
            opacity: clamp(corePop * 1.4),
          }}
        />
        {/* suction rings expanding (decorative motion, never a divider) */}
        {[0, 1, 2].map((k) => {
          const cycle = (t * 0.5 + k / 3) % 1
          return (
            <div
              key={k}
              style={{
                position: 'absolute',
                top: -cycle * 130 - 12,
                insetInlineStart: -cycle * 130 - 12,
                width: cycle * 260 + 24,
                height: cycle * 260 + 24,
                borderRadius: '50%',
                border: `1.5px solid rgba(255,185,84,${(1 - cycle) * 0.35})`,
              }}
            />
          )
        })}
      </div>
      <FloodWords
        t={t}
        cueAt={0.6}
        y={140}
        words={['مکث،', 'سپس', 'نقطهٔ', 'روشن.']}
        accentWord="روشن."
        size={42}
      />
    </InkFloodStage>
  )
}

// ─── Scene 3 (15–24s): the four clarity cards (2×2, disjoint) ────────────────
// Geometry proof (worst case, all four mounted simultaneously at hold):
//   columns x=28..258 and x=282..512 → horizontal gap 24px; margins 28px
//   rows y=318..446 and y=478..606 → vertical gap 32px; word band ends ≤ 210.
//   No pair overlaps; every card edge keeps ≥ 24px from the 540×960 frame.

export function ClarityCardsScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  return (
    <InkFloodStage scene={scene} t={t}>
      <FloodWords
        t={t}
        cueAt={0.3}
        y={140}
        words={['واقعیت،', 'روشن', 'شد.']}
        accentWord="روشن"
        size={42}
      />
      <ClarityCard
        at={0.5}
        t={t}
        x={28}
        y={318}
        label="فروش"
        rollAt={0.7}
        value={1840000}
        accent={CLARITY_TEAL}
      />
      <ClarityCard
        at={1.7}
        t={t}
        x={282}
        y={318}
        label="سود"
        rollAt={1.9}
        value={475000}
        accent={FLOOD_AMBER}
      />
      <ClarityCard
        at={3.0}
        t={t}
        x={28}
        y={478}
        label="موجودی"
        rollAt={3.2}
        value={312}
        suffix="قلم"
        accent={CLARITY_TEAL}
      />
      <ClarityCard
        at={4.3}
        t={t}
        x={282}
        y={478}
        label="طلب"
        rollAt={4.5}
        value={218000}
        accent={FLOOD_AMBER}
      />
      {/* arithmetic echo: bottom-left mono strip (lw=230 < 258 column end) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 668,
          insetInlineStart: 28,
          width: 484,
          textAlign: 'center',
          fontSize: 20,
          fontWeight: 700,
          color: 'rgba(236,230,216,0.66)',
          opacity: clamp(pop(t, 6.0) * 1.4),
        }}
      >
        فروش − بهای − خرج = سود
      </div>
    </InkFloodStage>
  )
}

// ─── Scene 4 (24–34s): the floating world lands in the shop's phone ──────────
// Phone rect: x=135..405, y=246..740 (270×494, border included). All interior
// components use container-local coordinates (0..270 / 0..494) and overflow is
// hidden so zero spillage occurs. Text sits at y=130 (≥ 50px safety margin).

export function PhoneDashboardScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const frameP = pop(t, 0.3, 0.9)
  return (
    <InkFloodStage scene={scene} t={t}>
      {/* sheets dive into the device */}
      {[0, 1, 2, 3, 4].map((i) => {
        const seed = deterministicHash(i, 41)
        const p = ease(clamp(progress(t, 0.4 + i * 0.5, 1.2)))
        const x = mix(20 + seed * 90, 210, p)
        const y = mix(140 + seed * 120, 470, p)
        return (
          <FlightSheet
            key={i}
            x={x}
            y={y}
            w={54 * mix(1, 0.5, p)}
            h={70 * mix(1, 0.5, p)}
            rot={mix((seed - 0.5) * 20, 0, p)}
            opacity={(1 - p) * 0.8}
          />
        )
      })}
      {/* device mockup */}
      <div
        style={{
          position: 'absolute',
          top: 246,
          insetInlineStart: 135,
          width: 270,
          height: 494,
          borderRadius: 36,
          overflow: 'hidden',
          zIndex: 40,
          opacity: clamp(frameP * 1.6),
          transform: `translateY(${mix(26, 0, frameP).toFixed(1)}px) scale(${mix(
            0.94,
            1,
            frameP,
          ).toFixed(3)})`,
          background: 'linear-gradient(180deg, #10141f, #070911)',
          border: '2.5px solid rgba(243,234,216,0.38)',
          boxShadow: '0 32px 72px rgba(0,0,0,0.65), 0 0 44px rgba(79,227,196,0.22)',
          padding: 0,
        }}
      >
        {/* top notch */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            insetInlineStart: '50%',
            transform: 'translateX(-50%)',
            width: 84,
            height: 18,
            borderRadius: 9,
            background: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: CLARITY_TEAL,
              opacity: 0.85,
            }}
          />
        </div>

        {/* app header */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 38,
            insetInlineStart: 16,
            insetInlineEnd: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 900, color: CLARITY_TEAL }}>حسابچه</span>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#53d98a',
              background: 'rgba(83,217,138,0.14)',
              border: '1px solid rgba(83,217,138,0.35)',
              padding: '2px 8px',
              borderRadius: 6,
            }}
          >
            همگام
          </div>
        </div>

        {/* mini rows (local coords: top: 76 + i*72 within 494px phone) */}
        {[
          { label: 'فروش', value: 1840000, roll: 1.4, bar: 1 },
          { label: 'سود', value: 475000, roll: 2.4, bar: 0.26, accent: true },
          { label: 'طلب', value: 218000, roll: 3.2, bar: 0.12 },
        ].map((row, i) => (
          <div
            key={row.label}
            style={{
              position: 'absolute',
              top: 76 + i * 72,
              insetInlineStart: 16,
              width: 238,
              height: 60,
              borderRadius: 12,
              background: 'rgba(243,234,216,0.06)',
              border: `1.5px solid ${row.accent ? `${CLARITY_TEAL}77` : 'rgba(243,234,216,0.15)'}`,
              padding: '8px 12px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span dir="rtl" style={{ fontSize: 15, fontWeight: 800, color: INK_MIST }}>
                {row.label}
              </span>
              <FloodRoll t={t} at={row.roll} value={row.value} size={17} />
            </div>
            <div
              style={{
                marginTop: 6,
                height: 4,
                borderRadius: 3,
                background: 'rgba(243,234,216,0.12)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  insetInlineStart: 0,
                  width: `${row.bar * (row.accent ? clamp(progress(t, 2.6, 1.4)) : clamp(progress(t, 1.6, 1.4))) * 100}%`,
                  background: row.accent ? CLARITY_TEAL : 'rgba(79,227,196,0.45)',
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
        ))}

        {/* profit sparkline card (local coords: top: 300, within 494px phone) */}
        <div
          style={{
            position: 'absolute',
            top: 300,
            insetInlineStart: 16,
            width: 238,
            height: 140,
            borderRadius: 14,
            background: 'rgba(79,227,196,0.06)',
            border: '1.5px solid rgba(79,227,196,0.25)',
            padding: '10px 12px',
            boxSizing: 'border-box',
          }}
        >
          <div dir="rtl" style={{ fontSize: 13, fontWeight: 700, color: 'rgba(236,230,216,0.7)' }}>
            جریان زنده سود
          </div>
          <svg
            viewBox="0 0 214 44"
            style={{
              width: '100%',
              height: 48,
              marginTop: 6,
            }}
          >
            <polyline
              points="4,34 35,28 68,31 100,18 134,22 168,11 210,6"
              fill="none"
              stroke={CLARITY_TEAL}
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity={clamp(progress(t, 4.2, 1.6) * 1.3)}
              style={{ filter: 'drop-shadow(0 0 6px rgba(79,227,196,0.7))' }}
            />
          </svg>
          <div
            dir="rtl"
            style={{
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 800,
              color: CLARITY_TEAL,
              marginTop: 4,
            }}
          >
            سود جریان دارد
          </div>
        </div>

        {/* bottom home indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            insetInlineStart: '50%',
            transform: 'translateX(-50%)',
            width: 96,
            height: 4,
            borderRadius: 2,
            background: 'rgba(243,234,216,0.3)',
          }}
        />
      </div>

      <FloodWords
        t={t}
        cueAt={1.0}
        y={130}
        words={['همین', 'عددها', 'الان،', 'بی‌کاغذ.']}
        accentWord="بی‌کاغذ."
        size={42}
      />
    </InkFloodStage>
  )
}

// ─── Scene 5 (34–41s): the cure-line sweeps, chaos becomes clean panels ──────
// Deterministic sweep boundary: bx(t) = 470 − 414 · ease(progress(t, .6, 4.4)).
// A ghost sheet at x is visible only while x > bx; a clean row pops exactly
// when the boundary passes its right edge — states never mix at hold frames.

export function CureSweepSlideScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const sweep = ease(clamp(progress(t, 0.7, 3.9)))
  const bx = mix(470, 56, sweep)
  const cleanRows = [0, 1, 2, 3, 4].map((i) => ({
    x: 44,
    y: 330 + i * 78,
    w: 208,
    h: 58,
  }))
  return (
    <InkFloodStage scene={scene} t={t}>
      {/* ghost sheets living on the right of the sweep limit */}
      {Array.from({ length: 9 }).map((_, i) => {
        const seed = deterministicHash(i, 67)
        const x = 236 + (i % 5) * 56 + seed * 40
        const y = 270 + ((i * 71) % 470)
        const visible = x - 30 > bx
        return (
          <FlightSheet
            key={i}
            x={x}
            y={y}
            w={92}
            h={118}
            rot={(seed - 0.5) * 18}
            opacity={visible ? 0.5 + seed * 0.3 : 0}
          />
        )
      })}
      {/* clean rows appear as the boundary passes */}
      {cleanRows.map((row, i) => {
        const passed = bx < row.x + row.w
        const popP = pop(t, 0.7 + sweep * 3.9 * (1 - i * 0.12), 0.5)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: row.y,
              insetInlineStart: row.x,
              width: row.w,
              height: row.h,
              borderRadius: 12,
              zIndex: 30,
              opacity: passed ? clamp(popP * 1.5) : 0,
              transform: `translateX(${passed ? mix(14, 0, popP).toFixed(1) : 14}px)`,
              background: 'rgba(79,227,196,0.10)',
              border: '1.5px solid rgba(79,227,196,0.35)',
              boxShadow: '0 10px 26px rgba(0,0,0,0.35)',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'rgba(79,227,196,0.28)',
                border: '1.5px solid rgba(79,227,196,0.55)',
              }}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  height: 8,
                  width: `${58 + (i % 3) * 12}%`,
                  borderRadius: 4,
                  background: 'rgba(236,230,216,0.5)',
                }}
              />
              <div
                style={{
                  height: 6,
                  width: `${34 + ((i * 17) % 30)}%`,
                  borderRadius: 4,
                  background: 'rgba(236,230,216,0.28)',
                }}
              />
            </div>
          </div>
        )
      })}
      {/* the vertical cure-beam (moving light, never a static divider) */}
      <div
        style={{
          position: 'absolute',
          top: 120,
          bottom: 60,
          insetInlineStart: bx - 20,
          width: 40,
          zIndex: 44,
          borderRadius: 20,
          background:
            'linear-gradient(180deg, rgba(255,235,190,0.85), rgba(255,185,84,0.45) 55%, rgba(79,227,196,0.55))',
          filter: 'blur(1.5px)',
          boxShadow: '0 0 44px rgba(255,185,84,0.55)',
          opacity: sweep > 0 && sweep < 1 ? 0.95 : t < 0.7 ? 0 : clamp(1 - (sweep - 1) * 6),
        }}
      />
      <FloodWords
        t={t}
        cueAt={0.4}
        y={140}
        words={['هر', 'جا', 'گذشت،', 'تمیز.']}
        accentWord="تمیز."
        size={42}
      />
    </InkFloodStage>
  )
}

// ─── Scene 6 (41–45s): brand lockup + two comment boxes ──────────────────────

function CommentBox({
  t,
  at,
  x,
  lead,
  tone,
}: {
  t: number
  at: number
  x: number
  lead: string
  tone: 'cyan' | 'purple'
}) {
  const p = pop(t, at)
  const accent = tone === 'cyan' ? CLARITY_TEAL : '#b591f6'
  return (
    <div
      style={{
        position: 'absolute',
        top: 668,
        insetInlineStart: x,
        width: 230,
        height: 132,
        borderRadius: 14,
        zIndex: 30,
        opacity: clamp(p * 1.6),
        transform: `translateY(${mix(18, 0, p).toFixed(1)}px)`,
        background: 'rgba(243,234,216,0.07)',
        border: '1.5px solid rgba(243,234,216,0.2)',
        boxShadow: `0 16px 36px rgba(0,0,0,0.4), 0 0 22px ${accent}22`,
        padding: '14px 16px',
      }}
    >
      <div dir="rtl" style={{ fontSize: 16, fontWeight: 800, color: INK_MIST }}>
        {lead}
      </div>
      <div
        dir="rtl"
        style={{ fontSize: 13, fontWeight: 600, color: 'rgba(236,230,216,0.6)', marginTop: 6 }}
      >
        کامنت کنید:
      </div>
      <div
        style={{
          marginTop: 10,
          width: 118,
          height: 42,
          borderRadius: 21,
          background: `${accent}26`,
          border: `1.5px solid ${accent}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 18px ${accent}55`,
        }}
      >
        <span dir="rtl" style={{ fontSize: 19, fontWeight: 900, color: accent, lineHeight: 1 }}>
          {tone === 'cyan' ? 'رایگان' : 'دمو'}
        </span>
      </div>
    </div>
  )
}

export function InkCtaScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const lock = pop(t, 0.3, 0.8)
  return (
    <InkFloodStage scene={scene} t={t}>
      {/* emblem: amber ink dot with drawn halo ring */}
      <svg
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, width: 540, height: 960, pointerEvents: 'none' }}
      >
        <circle
          cx="270"
          cy="268"
          r={mix(2, 9, lock)}
          fill={FLOOD_AMBER}
          opacity={clamp(lock * 1.6)}
          style={{ filter: 'drop-shadow(0 0 14px rgba(255,185,84,0.8))' }}
        />
        <circle
          cx="270"
          cy="268"
          r={mix(2, 34, lock)}
          fill="none"
          stroke={CLARITY_TEAL}
          strokeWidth="1.6"
          opacity={clamp(lock * 1.1)}
        />
      </svg>
      {/* wordmark */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 330,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 64,
          fontWeight: 900,
          color: INK_MIST,
          textShadow: '0 0 54px rgba(255,185,84,0.4)',
          opacity: clamp(lock * 1.6),
          transform: `translateY(${mix(14, 0, lock).toFixed(1)}px)`,
        }}
      >
        حسابچه
      </div>
      {/* underline: centered via actual center math inside the LTR-pinned stage */}
      <div
        style={{
          position: 'absolute',
          top: 426,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: mix(0, 208, lock),
            height: 5,
            borderRadius: 4,
            background: `linear-gradient(90deg, ${CLARITY_TEAL}, ${FLOOD_AMBER}, #b591f6)`,
            boxShadow: '0 0 26px rgba(255,185,84,0.6)',
            opacity: clamp(lock * 1.4),
          }}
        />
      </div>
      <FloodWords
        t={t}
        cueAt={0.9}
        y={500}
        words={['حساب', 'روشن', 'از', 'امشب.']}
        accentWord="امشب."
        size={40}
      />
      <CommentBox t={t} at={1.5} x={28} lead="شروع، همین امشب" tone="cyan" />
      <CommentBox t={t} at={1.9} x={282} lead="نصب و دمو" tone="purple" />
    </InkFloodStage>
  )
}
