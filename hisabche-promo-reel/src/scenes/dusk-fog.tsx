// ============================================
// Dusk-Fog art direction (reel 95) — «عدد داخل مه» (open-loop mystery number)
//
// A blurred figure floats in dusk fog and slowly sharpens — but every time
// the owner reaches for it, a fanned deck of blank sheets closes over it
// like a hand of cards (uniform mesh rhythm: all sheets share one anchor,
// one radius and a constant 16° step — layout-defect-laws.md band 3). The
// deck then fans out, the fog lifts, and the figure publishes itself as the
// day's true net profit, with its three ledger footings beneath it.
//
// Bespoke, self-authored stage: own palette (dusk blue-grey + amber fog),
// own primitives, own geometry. No set is borrowed from reels 84–90 except
// the deterministic helpers every bespoke stage already depends on.
//
// Persistent arithmetic (digits via faNumber only — layout-defect-laws band 6):
//   ۲٬۴۶۰٬۰۰۰ فروش − ۱٬۶۲۰٬۰۰۰ بهای تمام‌شده − ۳۸۵٬۰۰۰ خرج = ۴۵۵٬۰۰۰ سود
// ============================================

import type { CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, deterministicHash, ease, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'
import { HalftoneCharacter } from './paper-pocket'

// ─── Tokens ──────────────────────────────────────────────────────────────────

export const FOG_NIGHT = '#0a0f16'
export const FOG_GREY = '#141d28'
export const MIST_BLUE = '#9fb6c9'
export const FOG_AMBER = '#ffc466'
export const REVEAL_CREAM = '#f1ecdf'
export const DEEP_TEAL = '#5fd4c0'

const MYSTERY_WASH: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(760px 480px at 50% 38%, rgba(255,196,102,0.08), transparent 60%), radial-gradient(620px 420px at 24% 76%, rgba(95,212,192,0.06), transparent 66%)',
}

const FOG_VIGNETTE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(122% 88% at 50% 42%, transparent 46%, rgba(2,4,8,0.9) 100%)',
}

function pop(t: number, at: number, dur = 0.55): number {
  return spring(clamp(progress(t, at, at + dur)))
}

// ─── Stage ───────────────────────────────────────────────────────────────────

/** The stage every scene paints over. */
export function DuskFogStage({
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
        background: FOG_NIGHT,
        overflow: 'hidden',
        color: MIST_BLUE,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={MYSTERY_WASH} />
        {/* fog banks: soft edge-less ellipses (never rectangles / dividers) */}
        {Array.from({ length: 5 }).map((_, i) => {
          const seed = deterministicHash(i, 91)
          const drift = Math.sin(t * (0.14 + seed * 0.1) + i * 1.7) * 26
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: 120 + i * 150 + seed * 60,
                insetInlineStart: 40 + drift * 0.6,
                width: 480 - seed * 60,
                height: 150 + seed * 60,
                borderRadius: '50%',
                filter: 'blur(34px)',
                background:
                  i % 2 === 0
                    ? `radial-gradient(closest-side, rgba(159,182,201,${0.1 + seed * 0.08}), transparent 72%)`
                    : `radial-gradient(closest-side, rgba(20,29,40,0.55), transparent 70%)`,
              }}
            />
          )
        })}
        {/* suspended dust */}
        {Array.from({ length: 30 }).map((_, i) => {
          const seed = deterministicHash(i, 47)
          const x = ((i * 107) % 540) + seed * 14
          const cycle = (t * (0.01 + seed * 0.03) + seed) % 1
          const y = 1000 - cycle * 1040
          return (
            <div
              key={`d${i}`}
              style={{
                position: 'absolute',
                top: y,
                insetInlineStart: x,
                width: 1.5 + seed * 1.8,
                height: 1.5 + seed * 1.8,
                borderRadius: '50%',
                background: MIST_BLUE,
                opacity: Math.sin(cycle * Math.PI) * (0.05 + seed * 0.1),
              }}
            />
          )
        })}
        <div style={FOG_VIGNETTE} />
      </div>
      {children}
    </div>
  )
}

// ─── Primitives ──────────────────────────────────────────────────────────────

/**
 * Staged word cluster: full-bleed flex row, explicit dir="rtl"
 * (layout-defect-laws.md bands 1–2). Mount-once, stays to the end.
 */
export function FogWords({
  t,
  cueAt,
  words,
  y,
  size = 40,
  accentWord,
  accentColor = FOG_AMBER,
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
              color: accent ? (accentColor ?? FOG_AMBER) : MIST_BLUE,
              whiteSpace: 'pre',
              textShadow: accent
                ? `0 0 26px ${accentColor ?? FOG_AMBER}`
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

/**
 * The mystery figure: a literal value carrying CSS blur that decays over the
 * film. Digits come from the deterministic string (char-map-safe); the blur
 * radius alone decides legibility, so the hold frames of scenes 1–2 stay
 * unreadable by design.
 */
function MysteryFigure({
  value,
  blurPx,
  y = 330,
  scale = 1,
  opacity = 0.9,
  accent = FOG_AMBER,
  wobbleT,
}: {
  value: number
  blurPx: number
  y?: number
  scale?: number
  opacity?: number
  accent?: string
  wobbleT: number
}) {
  void accent
  const tilt = Math.sin(wobbleT * 0.9) * 2.2
  const lift = Math.sin(wobbleT * 0.7) * 5
  return (
    <div
      style={{
        position: 'absolute',
        top: y + lift,
        insetInlineStart: 0,
        insetInlineEnd: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 18,
        opacity,
      }}
    >
      <span
        dir="ltr"
        style={{
          fontSize: 96 * scale,
          fontWeight: 900,
          color: REVEAL_CREAM,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.05,
          whiteSpace: 'nowrap',
          filter: `blur(${blurPx.toFixed(1)}px)`,
          textShadow: `0 0 60px rgba(255,196,102,0.4)`,
          transform: `rotate(${tilt.toFixed(2)}deg)`,
        }}
      >
        {faNumber(value)}
      </span>
    </div>
  )
}

/** Monotonic rolling figure: 0 → value, then holds (never blinks). */
function FogRoll({
  t,
  at,
  value,
  size = 26,
  color = REVEAL_CREAM,
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
        whiteSpace: 'nowrap',
      }}
    >
      {faNumber(n)}
    </span>
  )
}

/**
 * Fanned blank deck: 7 sheets, one anchor, one radius R=158, constant 16°
 * step (mesh-rhythm law, band 3). The fan is one deck cluster occluding the
 * mystery figure — deliberate narrative occlusion, uniform rhythm documented
 * here so no future maintainer mistakes it for an unordered Venn pile.
 */
function PaperDeckFan({
  t,
  openAmount,
  anchorX = 270,
  anchorY = 470,
}: {
  t: number
  openAmount: number
  anchorX?: number
  anchorY?: number
}) {
  void t
  const R = 158
  const STEP = 16
  const SHEETS = 7
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none' }}>
      {Array.from({ length: SHEETS }).map((_, i) => {
        const theta = -48 + i * STEP
        const openT = i * 0.16
        const q = clamp(mix(0, 1.35, openAmount * (1 - openT / 2.2)))
        const spreadRot = theta + q * 34
        const spreadR = R + q * 150
        const rad = (spreadRot * Math.PI) / 180
        const sheetX = anchorX + Math.sin(rad) * spreadR
        const sheetY = anchorY - Math.cos(rad) * spreadR
        const appear = pop(t, 0.5 + i * 0.5)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: sheetY - 103,
              insetInlineStart: sheetX - 75,
              width: 150,
              height: 206,
              borderRadius: 10,
              opacity: clamp(appear * 1.4) * (1 - clamp(openAmount * (1.1 + openT * 0.5))),
              transform: `rotate(${(theta * 0.55 + q * 26).toFixed(2)}deg)`,
              background: `linear-gradient(180deg, rgba(241,236,223,0.92), rgba(241,236,223,0.78))`,
              boxShadow: '0 16px 34px rgba(0,0,0,0.45)',
              padding: 12,
            }}
          >
            <div
              style={{
                height: 5,
                width: `${52 + ((i * 31) % 26)}%`,
                borderRadius: 4,
                background: 'rgba(12,18,30,0.35)',
                filter: 'blur(1.2px)',
              }}
            />
            <div
              style={{
                marginTop: 10,
                height: 4.5,
                width: `${30 + ((i * 19) % 38)}%`,
                borderRadius: 4,
                background: 'rgba(12,18,30,0.28)',
                filter: 'blur(1.2px)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                insetInlineStart: 12,
                width: 46,
                height: 12,
                borderRadius: 4,
                background: 'rgba(12,18,30,0.4)',
                filter: 'blur(2.2px)',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Scene 1 (0–8s): the figure spins in fog, unreadable on purpose ──────────

export function FogNumberScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const appear = pop(t, 0.4, 0.9)
  const blurPx = mix(26, 16, ease(clamp(progress(t, 0.6, 6.2))))
  return (
    <DuskFogStage scene={scene} t={t}>
      <MysteryFigure
        value={455000}
        blurPx={blurPx}
        y={336}
        opacity={clamp(appear * 0.8 + 0.2) * 0.9}
        wobbleT={t}
      />
      <FogWords
        t={t}
        cueAt={0.6}
        y={150}
        words={['امشب', 'یک', 'عدد', 'داری']}
        accentWord="عدد"
        size={42}
      />
    </DuskFogStage>
  )
}

// ─── Scene 2 (8–16s): the deck of sheets closes over the figure ──────────────
// Deck anchor (270, 470), R=158, sheet 150×206 → worst fan extent
// y ≤ 470−(158+103)=209 … the word band ends at ~184 → ≥ 24px clear.

export function PaperWallScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const blurPx = mix(16, 13, ease(clamp(progress(t, 0.5, 5))))
  return (
    <DuskFogStage scene={scene} t={t}>
      <MysteryFigure value={455000} blurPx={blurPx} y={336} opacity={0.8} wobbleT={t} />
      <PaperDeckFan t={t} openAmount={0} />
      <HalftoneCharacter
        t={t}
        mood="worried"
        scale={0.95}
        style={{ position: 'absolute', insetInlineStart: 26, top: 612, zIndex: 40 }}
      />
      <FogWords
        t={t}
        cueAt={0.5}
        y={126}
        words={['پشت', 'برگه‌ها', 'گم', 'است.']}
        accentWord="گم"
        size={42}
      />
    </DuskFogStage>
  )
}

// ─── Scene 3 (16–25s): the deck fans out, the figure starts to resolve ───────

export function PartClearScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const open = ease(clamp(progress(t, 0.8, 4.6)))
  const blurPx = mix(13, 5.5, ease(clamp(progress(t, 2.0, 6.2))))
  return (
    <DuskFogStage scene={scene} t={t}>
      <MysteryFigure value={455000} blurPx={blurPx} y={336} opacity={0.82} wobbleT={t} />
      <PaperDeckFan t={t} openAmount={open} />
      {/* focus ramp readout: a tiny mono focus meter, ltr */}
      <div
        dir="ltr"
        style={{
          position: 'absolute',
          top: 700,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          zIndex: 42,
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              width: 26,
              height: 6,
              borderRadius: 4,
              background:
                clamp(progress(t, 1.2 + i * 0.9, 0.8)) > 0.4 ? DEEP_TEAL : 'rgba(159,182,201,0.2)',
              boxShadow: progress(t, 1.2 + i * 0.9, 0.8) > 0.4 ? `0 0 12px ${DEEP_TEAL}88` : 'none',
            }}
          />
        ))}
      </div>
      <FogWords
        t={t}
        cueAt={0.5}
        y={126}
        words={['کمی', 'واضح‌تر…']}
        accentWord="واضح‌تر…"
        size={44}
      />
    </DuskFogStage>
  )
}

// ─── Scene 4 (25–35s): the figure publishes itself ───────────────────────────

export function ClearRevealScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const sharp = pop(t, 0.4, 0.9)
  const blurPx = mix(5.5, 0, ease(clamp(progress(t, 0.3, 1.6))))
  return (
    <DuskFogStage scene={scene} t={t}>
      {/* publish ring */}
      <svg
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, width: 540, height: 960, pointerEvents: 'none' }}
      >
        <circle
          cx="270"
          cy="386"
          r={mix(60, 208, ease(clamp(progress(t, 0.6, 1.5))))}
          fill="none"
          stroke={FOG_AMBER}
          strokeWidth="2"
          opacity={clamp(0.5 - ease(clamp(progress(t, 0.8, 1.9))) * 0.42)}
        />
      </svg>
      <MysteryFigure
        value={455000}
        blurPx={blurPx}
        y={330}
        scale={1.08}
        opacity={clamp(0.75 + sharp * 0.25)}
        wobbleT={t * 0.4}
      />
      <FogWords t={t} cueAt={1.6} y={560} words={['سود', 'خالص']} accentWord="خالص" size={44} />
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 612,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 17,
          fontWeight: 700,
          color: 'rgba(241,236,223,0.62)',
          opacity: clamp(pop(t, 3.2) * 1.4),
        }}
      >
        فروش − بهای − خرج
      </div>
    </DuskFogStage>
  )
}

// ─── Scene 5 (35–40s): the three ledger footings (disjoint rows) ─────────────
// Rows: x=100..440 (w=340), h=64 at y=372/448/524 → vertical gap 12px; all
// inside the panel band 340..588; word cluster sits at y=660.

export function LedgerFootScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const rows = [
    { label: 'فروش', value: 2460000, at: 0.5 },
    { label: 'بهای', value: 1620000, at: 1.4 },
    { label: 'خرج', value: 385000, at: 2.3 },
  ]
  return (
    <DuskFogStage scene={scene} t={t}>
      <div
        style={{
          position: 'absolute',
          top: 236,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 24,
        }}
      >
        <FogRoll t={t} at={0.1} value={455000} size={54} color="#ffc466" />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 372,
          insetInlineStart: 100,
          width: 340,
          height: 1,
          zIndex: 30,
        }}
      >
        {rows.map((row, i) => (
          <div
            key={row.label}
            style={{
              position: 'absolute',
              top: i * 76,
              insetInlineStart: 0,
              width: 340,
              height: 64,
              borderRadius: 12,
              opacity: clamp(pop(t, row.at) * 1.5),
              transform: `translateX(${mix(18, 0, pop(t, row.at)).toFixed(1)}px)`,
              background: 'rgba(159,182,201,0.08)',
              border: '1.5px solid rgba(159,182,201,0.26)',
              boxShadow: '0 12px 26px rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
            }}
          >
            <span dir="rtl" style={{ fontSize: 20, fontWeight: 800, color: REVEAL_CREAM }}>
              {row.label}
            </span>
            <FogRoll t={t} at={row.at + 0.15} value={row.value} size={24} />
          </div>
        ))}
      </div>
      <FogWords
        t={t}
        cueAt={3.0}
        y={660}
        words={['همهٔ', 'حساب،', 'زنده.']}
        accentWord="زنده."
        size={40}
      />
    </DuskFogStage>
  )
}

// ─── Scene 6 (40–45s): brand lockup over the fog ─────────────────────────────

function FogCommentBox({
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
  const accent = tone === 'cyan' ? DEEP_TEAL : '#b59cf7'
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
        background: 'rgba(159,182,201,0.08)',
        border: '1.5px solid rgba(159,182,201,0.24)',
        boxShadow: `0 16px 36px rgba(0,0,0,0.4), 0 0 22px ${accent}22`,
        padding: '14px 16px',
      }}
    >
      <div dir="rtl" style={{ fontSize: 16, fontWeight: 800, color: REVEAL_CREAM }}>
        {lead}
      </div>
      <div
        dir="rtl"
        style={{ fontSize: 13, fontWeight: 600, color: 'rgba(241,236,223,0.6)', marginTop: 6 }}
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

export function FogCtaScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const lock = pop(t, 0.3, 0.8)
  return (
    <DuskFogStage scene={scene} t={t}>
      {/* emblem: figure dot rising out of a fog ring */}
      <svg
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, width: 540, height: 960, pointerEvents: 'none' }}
      >
        <circle
          cx="270"
          cy="258"
          r={mix(2, 9, lock)}
          fill={FOG_AMBER}
          opacity={clamp(lock * 1.6)}
          style={{ filter: 'drop-shadow(0 0 14px rgba(255,196,102,0.8))' }}
        />
        <circle
          cx="270"
          cy="258"
          r={mix(2, 36, lock)}
          fill="none"
          stroke={DEEP_TEAL}
          strokeWidth="1.6"
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
          color: REVEAL_CREAM,
          textShadow: '0 0 54px rgba(255,196,102,0.35)',
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
            width: mix(0, 202, lock),
            height: 5,
            borderRadius: 4,
            background: `linear-gradient(90deg, ${DEEP_TEAL}, ${FOG_AMBER}, #b59cf7)`,
            boxShadow: '0 0 24px rgba(255,196,102,0.55)',
            opacity: clamp(lock * 1.4),
          }}
        />
      </div>
      <FogWords
        t={t}
        cueAt={0.9}
        y={500}
        words={['هر', 'لحظه،', 'همین', 'عدد.']}
        accentWord="عدد."
        size={40}
      />
      <FogCommentBox t={t} at={1.5} x={28} lead="شروع، همین امشب" tone="cyan" />
      <FogCommentBox t={t} at={1.9} x={282} lead="نصب و دمو" tone="purple" />
    </DuskFogStage>
  )
}
