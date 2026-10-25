// ============================================
// Midnight-Desk art direction (reel 92) — POV deadpan film
//
// Top-down POV: the owner's desk at 23:00 — laptop, two receipt piles, a
// mug, and one tired finger dragging over receipts whose numbers blur.
// The halftone owner breaks the fourth wall, raises the phone, and with
// one swipe the desk becomes a clean live dashboard; a red critical-stock
// alert turns into a green check; the owner gives a tiny nod and smile.
//
// Bespoke, self-authored stage: own palette (charcoal wood + warm lamp),
// own primitives, own geometry. Nothing from paper-pocket / distilbook /
// ink-flood sets is reused except the shared HalftoneCharacter primitive.
//
// Persistent arithmetic (digits via faNumber only — layout-defect-laws band 6):
//   ۱٬۸۴۰٬۰۰۰ فروش − ۱٬۲۲۵٬۰۰۰ بهای تمام‌شده − ۱۴۰٬۰۰۰ خرج = ۴۷۵٬۰۰۰ سود
//   طلب ۲۱۸٬۰۰۰ · انبار ۳۱۲ (۳ قلم بحرانی)
// ============================================

import type { CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, deterministicHash, ease, mix, progress, spring, strokeDraw } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'
import { HalftoneCharacter } from './paper-pocket'

// ─── Tokens ──────────────────────────────────────────────────────────────────

export const DESK_NIGHT = '#0b0d12'
export const WOOD_TOP = '#161a23'
export const LAMP_GOLD = '#ffd98a'
export const ALERT_RED = '#ff5f5f'
export const OK_GREEN = '#53d98a'
export const NIGHT_MIST = '#e7e3d8'

const LAMP_WASH: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(560px 420px at 50% 6%, rgba(255,217,138,0.12), transparent 66%), radial-gradient(700px 480px at 78% 78%, rgba(83,217,138,0.05), transparent 70%)',
}

const NIGHT_VIGNETTE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(118% 86% at 50% 44%, transparent 48%, rgba(1,2,5,0.92) 100%)',
}

function pop(t: number, at: number, dur = 0.55): number {
  return spring(clamp(progress(t, at, at + dur)))
}

// ─── Stage ───────────────────────────────────────────────────────────────────

/** The stage every scene paints over. */
export function MidnightDeskStage({
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
        background: DESK_NIGHT,
        overflow: 'hidden',
        color: NIGHT_MIST,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={LAMP_WASH} />
        {/* night dust motes */}
        {Array.from({ length: 28 }).map((_, i) => {
          const seed = deterministicHash(i, 37)
          const x = ((i * 113) % 540) + seed * 16
          const cycle = (t * (0.012 + seed * 0.035) + seed) % 1
          const y = 1020 - cycle * 1080
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: y,
                insetInlineStart: x,
                width: 1.5 + seed * 2,
                height: 1.5 + seed * 2,
                borderRadius: '50%',
                background: LAMP_GOLD,
                opacity: Math.sin(cycle * Math.PI) * (0.06 + seed * 0.1),
              }}
            />
          )
        })}
        <div style={NIGHT_VIGNETTE} />
      </div>
      {children}
    </div>
  )
}

// ─── Primitives ──────────────────────────────────────────────────────────────

/**
 * Staged word cluster: full-bleed flex row (no translate centering),
 * explicit dir="rtl" (layout-defect-laws.md bands 1–2). Mount-once, stays.
 */
export function DeskWords({
  t,
  cueAt,
  words,
  y,
  size = 40,
  accentWord,
  accentColor = LAMP_GOLD,
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
              color: accent ? (accentColor ?? LAMP_GOLD) : NIGHT_MIST,
              whiteSpace: 'pre',
              textShadow: accent
                ? `0 0 26px ${accentColor ?? LAMP_GOLD}`
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

/** Monotonic rolling figure: 0 → value, then holds (never blinks). */
function DeskRoll({
  t,
  at,
  value,
  size = 28,
}: {
  t: number
  at: number
  value: number
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
        color: NIGHT_MIST,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.05,
        textShadow: `0 0 14px ${LAMP_GOLD}44`,
        whiteSpace: 'nowrap',
      }}
    >
      {faNumber(n)}
    </span>
  )
}

/** A receipt strip; its digits are decorative blurred strokes, never data. */
function ReceiptStrip({
  x,
  y,
  w = 152,
  rot = 0,
  opacity = 1,
  seed = 1,
}: {
  x: number
  y: number
  w?: number
  rot?: number
  opacity?: number
  seed?: number
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        insetInlineStart: x,
        width: w,
        height: 34,
        borderRadius: 4,
        opacity,
        transform: `rotate(${rot.toFixed(2)}deg)`,
        background: `linear-gradient(180deg, rgba(231,227,216,0.16), rgba(231,227,216,0.09))`,
        border: '1px solid rgba(231,227,216,0.22)',
        boxShadow: '0 6px 14px rgba(0,0,0,0.4)',
        padding: '6px 8px',
      }}
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 3.5,
            width: `${34 + ((i * 23 + seed * 40) % 52)}%`,
            borderRadius: 3,
            background: 'rgba(231,227,216,0.5)',
            filter: 'blur(2px)',
            marginInlineStart: i === 2 ? `${(seed * 30) % 40}%` : 0,
          }}
        />
      ))}
    </div>
  )
}

// ─── Scene 1 (0–8s): the POV desk — frame 0 is already furnished ─────────────
// Geometry (worst case = end of scene): desk x=36..504, y=250..770. Laptop
// x=306..462/y=292..404; receipt pile-A x=64..216/y=300..414; pile-B x=64..216
// /y=456..570; notepad x=248..290/y=462..600; mug circle (434,648,r=36) →
// x=398..470/y=612..684. No pair of objects shares space; word band y≤152.

export function DeskPovScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const trace = ease(clamp(progress(t, 1.1, 3.0)))
  const fingerX = mix(116, 228, trace)
  const fingerY = mix(586, 336, trace)
  return (
    <MidnightDeskStage scene={scene} t={t}>
      {/* desk surface */}
      <div
        style={{
          position: 'absolute',
          top: 250,
          insetInlineStart: 36,
          width: 468,
          height: 520,
          borderRadius: 20,
          background: `linear-gradient(160deg, ${WOOD_TOP}, #10131a)`,
          border: '1.5px solid rgba(231,227,216,0.16)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,217,138,0.16)',
        }}
      />
      {/* laptop base + screen sliver */}
      <div
        style={{
          position: 'absolute',
          top: 292,
          insetInlineStart: 306,
          width: 156,
          height: 112,
          borderRadius: 10,
          background: '#0d1017',
          border: '1.5px solid rgba(231,227,216,0.22)',
          boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
        }}
      >
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3, padding: 10 }}
        >
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 9,
                borderRadius: 2.5,
                background: 'rgba(231,227,216,0.22)',
              }}
            />
          ))}
        </div>
        {/* blurred figures on its face — unreadable on purpose */}
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            insetInlineStart: 12,
            width: 84,
            height: 12,
            borderRadius: 3,
            background: LAMP_GOLD,
            opacity: 0.5,
            filter: 'blur(3px)',
          }}
        />
      </div>
      {/* receipt pile A (5 strips) */}
      {Array.from({ length: 5 }).map((_, i) => (
        <ReceiptStrip
          key={`pa${i}`}
          x={64}
          y={300 + i * 23}
          rot={(deterministicHash(i, 3) - 0.5) * 7}
          seed={deterministicHash(i, 5)}
          opacity={0.92}
        />
      ))}
      {/* receipt pile B */}
      {Array.from({ length: 5 }).map((_, i) => (
        <ReceiptStrip
          key={`pb${i}`}
          x={64}
          y={456 + i * 23}
          rot={(deterministicHash(i, 9) - 0.5) * 7}
          seed={deterministicHash(i, 13)}
          opacity={0.85}
        />
      ))}
      {/* small notepad pad */}
      <div
        style={{
          position: 'absolute',
          top: 462,
          insetInlineStart: 248,
          width: 42,
          height: 138,
          borderRadius: 6,
          background: 'rgba(231,227,216,0.08)',
          border: '1px solid rgba(231,227,216,0.18)',
          transform: 'rotate(4deg)',
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              margin: '10px 6px 0',
              height: 4,
              borderRadius: 3,
              background: 'rgba(231,227,216,0.4)',
              filter: 'blur(1.6px)',
              width: `${40 + ((i * 37) % 48)}%`,
            }}
          />
        ))}
      </div>
      {/* mug */}
      <div
        style={{
          position: 'absolute',
          top: 612,
          insetInlineStart: 398,
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 36%, #1d222c, #12151d 70%)',
          border: '1.5px solid rgba(231,227,216,0.2)',
          boxShadow: '0 8px 18px rgba(0,0,0,0.45)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 14,
            insetInlineStart: 14,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #241a10, #16100a)',
          }}
        />
      </div>
      {/* the tired finger: capsule sweeping across the piles */}
      <div
        style={{
          position: 'absolute',
          top: fingerY,
          insetInlineStart: fingerX,
          width: 74,
          height: 26,
          borderRadius: 13,
          zIndex: 30,
          transform: 'rotate(-24deg)',
          background: 'linear-gradient(90deg, #2a2f3b, #1c2029)',
          border: '1.5px solid rgba(231,227,216,0.24)',
          boxShadow: '0 12px 22px rgba(0,0,0,0.5)',
        }}
      />
      {/* trace path the finger dragged */}
      <svg
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, width: 540, height: 960, pointerEvents: 'none' }}
      >
        <path
          d="M116,586 Q170,470 228,336"
          fill="none"
          stroke="rgba(255,217,138,0.5)"
          strokeWidth="2"
          strokeDasharray="6 8"
          opacity={clamp(trace * 0.9 - 0.15)}
        />
      </svg>
      <DeskWords
        t={t}
        cueAt={0.5}
        y={90}
        words={['ساعت', '۱۱', 'شب…', 'هنوز', 'حساب', 'نشده.']}
        accentWord="۱۱"
        size={34}
      />
    </MidnightDeskStage>
  )
}

// ─── Scene 2 (8–14s): the owner breaks the fourth wall ───────────────────────

export function DeadpanLookScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const enter = pop(t, 0.25, 0.9)
  return (
    <MidnightDeskStage scene={scene} t={t}>
      {/* faint desk silhouette behind */}
      <div
        style={{
          position: 'absolute',
          top: 640,
          insetInlineStart: 44,
          width: 452,
          height: 210,
          borderRadius: 18,
          background: 'rgba(22,26,35,0.55)',
          border: '1px solid rgba(231,227,216,0.1)',
          opacity: clamp(enter * 1.2),
        }}
      />
      <HalftoneCharacter
        t={t}
        mood="worried"
        scale={1.5}
        style={{
          position: 'absolute',
          insetInlineStart: 90,
          top: 372,
          zIndex: 40,
          opacity: clamp(enter * 1.5),
          transform: `translateX(${mix(-26, 0, enter).toFixed(1)}px)`,
        }}
      />
      {/* single lamp cone at top */}
      <div
        style={{
          position: 'absolute',
          top: -40,
          insetInlineStart: 190,
          width: 160,
          height: 210,
          zIndex: 20,
          filter: 'blur(6px)',
          background:
            'radial-gradient(90px 150px at 50% 0%, rgba(255,217,138,0.22), transparent 74%)',
        }}
      />
      <DeskWords
        t={t}
        cueAt={0.8}
        y={180}
        words={['خسته،', 'بی‌عدد.']}
        accentWord="بی‌عدد."
        size={44}
      />
      {/* the clock hint: tiny mono line under the words */}
      <div
        dir="ltr"
        style={{
          position: 'absolute',
          top: 214,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 18,
          fontWeight: 700,
          color: 'rgba(255,217,138,0.6)',
          opacity: clamp(pop(t, 2.4) * 1.4),
          letterSpacing: 4,
        }}
      >
        23:07
      </div>
    </MidnightDeskStage>
  )
}

// ─── Scene 3 (14–23s): the phone whip — desk becomes one dashboard ───────────
// Phone rect: x=135..405, y=246..740 (270×494, border included). All interior
// components use container-local coordinates (0..270 / 0..494) and overflow is
// hidden so zero spillage occurs. Text sits at y=130 (≥ 50px safety margin).

export function PhoneWhipScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const whip = clamp(progress(t, 0, 0.7))
  const settle = pop(t, 0.3, 1.0)
  const drift = ease(clamp(progress(t, 0.2, 1.6)))
  return (
    <MidnightDeskStage scene={scene} t={t}>
      {/* desk silhouette drops away */}
      <div
        style={{
          position: 'absolute',
          top: mix(260, 860, drift),
          insetInlineStart: 40,
          width: 460,
          height: 480,
          borderRadius: 20,
          background: 'rgba(22,26,35,0.6)',
          opacity: clamp(1 - drift * 0.55),
        }}
      />
      {/* whip streaks */}
      {[0, 1].map((k) => (
        <div
          key={k}
          style={{
            position: 'absolute',
            top: mix(980, 120, whip),
            insetInlineStart: 214 + k * 66,
            width: 14,
            height: 320,
            borderRadius: 8,
            zIndex: 30,
            filter: 'blur(7px)',
            background: `linear-gradient(180deg, transparent, ${LAMP_GOLD}55, transparent)`,
            opacity: clamp((1 - whip) * 0.9),
          }}
        />
      ))}
      {/* the device mockup */}
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
          opacity: clamp(settle * 1.6),
          transform: `translateY(${mix(430, 0, settle).toFixed(1)}px)`,
          background: 'linear-gradient(180deg, #11141d, #06080e)',
          border: '2.5px solid rgba(231,227,216,0.36)',
          boxShadow: '0 32px 72px rgba(0,0,0,0.65), 0 0 36px rgba(255,217,138,0.2)',
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
              background: LAMP_GOLD,
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
          <span style={{ fontSize: 18, fontWeight: 900, color: LAMP_GOLD }}>حسابچه</span>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: OK_GREEN,
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
          { label: 'فروش', value: 1840000, roll: 1.6 },
          { label: 'سود', value: 475000, roll: 2.6, accent: true },
          { label: 'طلب', value: 218000, roll: 3.4 },
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
              background: 'rgba(231,227,216,0.06)',
              border: `1.5px solid ${row.accent ? `${OK_GREEN}77` : 'rgba(231,227,216,0.15)'}`,
              padding: '8px 12px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span dir="rtl" style={{ fontSize: 15, fontWeight: 800, color: NIGHT_MIST }}>
                  {row.label}
                </span>
                {row.accent && (
                  <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      fill="none"
                      stroke={OK_GREEN}
                      strokeWidth="2"
                      opacity={clamp(pop(t, 4.4) * 1.3)}
                    />
                    <path
                      d="M7 12.4 L10.6 15.8 L17 9"
                      fill="none"
                      stroke={OK_GREEN}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      {...strokeDraw(t, 4.5, 0.8, 20)}
                      style={{ filter: 'drop-shadow(0 0 6px rgba(83,217,138,0.7))' }}
                    />
                  </svg>
                )}
              </div>
              <DeskRoll t={t} at={row.roll} value={row.value} size={16} />
            </div>
            <div
              style={{
                marginTop: 6,
                height: 4,
                borderRadius: 3,
                background: 'rgba(231,227,216,0.12)',
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
                  width: `${(row.label === 'فروش' ? 1 : row.label === 'سود' ? 0.26 : 0.12) * clamp(progress(t, row.roll, 1.2)) * 100}%`,
                  background: row.accent ? OK_GREEN : 'rgba(255,217,138,0.6)',
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
        ))}

        {/* overview card (local coords: top: 300 within 494px phone) */}
        <div
          style={{
            position: 'absolute',
            top: 300,
            insetInlineStart: 16,
            width: 238,
            height: 140,
            borderRadius: 14,
            background: 'rgba(255,217,138,0.06)',
            border: '1.5px solid rgba(255,217,138,0.25)',
            padding: '12px 14px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div dir="rtl" style={{ fontSize: 13, fontWeight: 700, color: 'rgba(231,227,216,0.7)' }}>
            خلاصه دخل امروز
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: OK_GREEN,
                boxShadow: `0 0 10px ${OK_GREEN}`,
              }}
            />
            <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: NIGHT_MIST }}>
              یک نگاه، همه چیز
            </span>
          </div>
          <div
            dir="rtl"
            style={{
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: 'rgba(231,227,216,0.5)',
            }}
          >
            ترازنامه و صندوق تایید شد
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
            background: 'rgba(231,227,216,0.3)',
          }}
        />
      </div>

      <DeskWords
        t={t}
        cueAt={1.4}
        y={130}
        words={['با', 'یک', 'سوایپ.']}
        accentWord="سوایپ."
        size={44}
      />
    </MidnightDeskStage>
  )
}

// ─── Scene 4 (23–34s): critical-stock alert → green check ────────────────────
// Panel x=48..492, y=280..700. Rows h=96 at y=320/436/552 (disjoint, gap 20).
// Word band ends ≤ 210. Codes are B2B generic (per Hard Rule 34 Bans band 5).

export function StockAlertScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const panelP = pop(t, 0.2, 0.8)
  const fix = clamp(progress(t, 5.2, 2.6))
  return (
    <MidnightDeskStage scene={scene} t={t}>
      <div
        style={{
          position: 'absolute',
          top: 280,
          insetInlineStart: 48,
          width: 444,
          height: 420,
          borderRadius: 16,
          zIndex: 30,
          opacity: clamp(panelP * 1.6),
          transform: `translateY(${mix(20, 0, panelP).toFixed(1)}px)`,
          background: 'rgba(231,227,216,0.05)',
          border: '1.5px solid rgba(231,227,216,0.18)',
          boxShadow: '0 22px 48px rgba(0,0,0,0.45)',
          padding: '18px 16px',
        }}
      >
        {[
          { code: 'کد ۱۰۱', count: 2, tone: 1 },
          { code: 'کد ۱۴۲', count: 0, tone: 0 },
          { code: 'کد ۲۰۳', count: 3, tone: 1 },
        ].map((row, i) => {
          const rowP = pop(t, 0.6 + i * 0.8)
          const fixed = clamp(fix * 1.3 - i * 0.2)
          const borderColor =
            row.tone === 0 ? `${ALERT_RED}${fixed > 0.6 ? '66' : 'aa'}` : 'rgba(231,227,216,0.3)'
          return (
            <div
              key={row.code}
              style={{
                position: 'absolute',
                top: 40 + i * 116,
                insetInlineStart: 16,
                width: 396,
                height: 96,
                borderRadius: 12,
                opacity: clamp(rowP * 1.5),
                transform: `translateX(${mix(16, 0, rowP).toFixed(1)}px)`,
                background:
                  row.tone === 0
                    ? `rgba(255,95,95,${(1 - fixed) * 0.1 + 0.04})`
                    : 'rgba(231,227,216,0.06)',
                border: `1.5px solid ${borderColor}`,
                boxShadow: row.tone === 0 && fixed < 0.6 ? '0 0 24px rgba(255,95,95,0.28)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '0 14px',
              }}
            >
              {/* alert dot / check ring */}
              <svg viewBox="0 0 24 24" style={{ width: 30, height: 30, flexShrink: 0 }}>
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke={fixed > 0.5 ? OK_GREEN : ALERT_RED}
                  strokeWidth="2.2"
                />
                {fixed > 0.5 ? (
                  <path
                    d="M8 12.2 L11 15 L16.4 9.4"
                    fill="none"
                    stroke={OK_GREEN}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                ) : (
                  <circle
                    cx="12"
                    cy="12"
                    r="3.6"
                    fill={ALERT_RED}
                    opacity={0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 4.2 + i))}
                  />
                )}
              </svg>
              <span
                dir="rtl"
                style={{ fontSize: 18, fontWeight: 800, color: NIGHT_MIST, whiteSpace: 'nowrap' }}
              >
                {row.code}
              </span>
              <span
                dir="ltr"
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: fixed > 0.5 ? OK_GREEN : row.tone === 0 ? ALERT_RED : LAMP_GOLD,
                  fontVariantNumeric: 'tabular-nums',
                  marginInlineStart: 'auto',
                  transition: 'color 0.3s',
                }}
              >
                {faNumber(row.count)}
                <span
                  dir="rtl"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'rgba(231,227,216,0.6)',
                    marginInlineStart: 6,
                  }}
                >
                  مانده
                </span>
              </span>
            </div>
          )
        })}
      </div>
      <DeskWords
        t={t}
        cueAt={0.4}
        y={180}
        words={['موجودی', 'بحرانی']}
        accentWord="بحرانی"
        accentColor={ALERT_RED}
        size={44}
      />
    </MidnightDeskStage>
  )
}

// ─── Scene 5 (34–40s): the tiny nod and smile ────────────────────────────────

export function MicroSmileScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const nod = pop(t, 0.5, 0.8)
  return (
    <MidnightDeskStage scene={scene} t={t}>
      {/* profit badge left */}
      <div
        style={{
          position: 'absolute',
          top: 470,
          insetInlineStart: 40,
          width: 180,
          height: 96,
          borderRadius: 14,
          zIndex: 30,
          opacity: clamp(pop(t, 1.2) * 1.5),
          transform: `translateY(${mix(14, 0, nod).toFixed(1)}px)`,
          background: 'rgba(83,217,138,0.09)',
          border: `1.5px solid ${OK_GREEN}66`,
          boxShadow: '0 14px 30px rgba(0,0,0,0.4), 0 0 22px rgba(83,217,138,0.2)',
          padding: '10px 12px',
        }}
      >
        <div dir="rtl" style={{ fontSize: 15, fontWeight: 800, color: NIGHT_MIST }}>
          سود امروز
        </div>
        <DeskRoll t={t} at={1.5} value={475000} size={24} />
      </div>
      <HalftoneCharacter
        t={t}
        mood="happy"
        scale={1.15}
        style={{
          position: 'absolute',
          insetInlineStart: 252,
          top: 396,
          zIndex: 40,
          opacity: clamp(nod * 1.5),
          transform: `translateY(${mix(18, 0, nod).toFixed(1)}px)`,
        }}
      />
      <DeskWords
        t={t}
        cueAt={1.0}
        y={180}
        words={['دیگه', 'لازم', 'نیست', 'حدس', 'بزنی.']}
        accentWord="حدس"
        size={42}
      />
      {/* soft desk silhouette at bottom */}
      <div
        style={{
          position: 'absolute',
          top: 758,
          insetInlineStart: 60,
          width: 420,
          height: 140,
          borderRadius: 16,
          background: 'rgba(22,26,35,0.5)',
          border: '1px solid rgba(231,227,216,0.08)',
          zIndex: 20,
        }}
      />
    </MidnightDeskStage>
  )
}

// ─── Scene 6 (40–45s): brand lockup over the lamp glow ───────────────────────

function DeskCommentBox({
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
  const accent = tone === 'cyan' ? '#6fd3ff' : '#c39bf7'
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
        background: 'rgba(231,227,216,0.07)',
        border: '1.5px solid rgba(231,227,216,0.2)',
        boxShadow: `0 16px 36px rgba(0,0,0,0.42), 0 0 22px ${accent}22`,
        padding: '14px 16px',
      }}
    >
      <div dir="rtl" style={{ fontSize: 16, fontWeight: 800, color: NIGHT_MIST }}>
        {lead}
      </div>
      <div
        dir="rtl"
        style={{ fontSize: 13, fontWeight: 600, color: 'rgba(231,227,216,0.6)', marginTop: 6 }}
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

export function DeskCtaScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const lock = pop(t, 0.3, 0.8)
  return (
    <MidnightDeskStage scene={scene} t={t}>
      {/* lamp emblem */}
      <svg
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, width: 540, height: 960, pointerEvents: 'none' }}
      >
        <circle
          cx="270"
          cy="252"
          r={mix(2, 10, lock)}
          fill={LAMP_GOLD}
          opacity={clamp(lock * 1.6)}
          style={{ filter: 'drop-shadow(0 0 14px rgba(255,217,138,0.85))' }}
        />
        <circle
          cx="270"
          cy="252"
          r={mix(2, 36, lock)}
          fill="none"
          stroke={OK_GREEN}
          strokeWidth="1.5"
          opacity={clamp(lock * 1.1)}
        />
      </svg>
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 322,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 64,
          fontWeight: 900,
          color: NIGHT_MIST,
          textShadow: '0 0 54px rgba(255,217,138,0.35)',
          opacity: clamp(lock * 1.6),
          transform: `translateY(${mix(14, 0, lock).toFixed(1)}px)`,
        }}
      >
        حسابچه
      </div>
      <div
        style={{
          position: 'absolute',
          top: 418,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: mix(0, 200, lock),
            height: 5,
            borderRadius: 4,
            background: `linear-gradient(90deg, ${LAMP_GOLD}, ${OK_GREEN}, #6fd3ff)`,
            boxShadow: '0 0 24px rgba(255,217,138,0.55)',
            opacity: clamp(lock * 1.4),
          }}
        />
      </div>
      <DeskWords
        t={t}
        cueAt={0.9}
        y={500}
        words={['حساب', 'روشن', 'از', 'امشب.']}
        accentWord="امشب."
        size={40}
      />
      <DeskCommentBox t={t} at={1.5} x={28} lead="شروع، همین امشب" tone="cyan" />
      <DeskCommentBox t={t} at={1.9} x={282} lead="نصب و دمو" tone="purple" />
    </MidnightDeskStage>
  )
}
