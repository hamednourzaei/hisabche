// ============================================
// Reel #111 — «برگشت به گذشته» (Flashback Rewind)
//
// The user asked for motion graphics built around a FLASHBACK TRANSITION and
// Persian copy with the Hisabche brand. The film uses filmic rewind as its
// whole grammar: every cut drags the viewer back into the paper ledger of the
// past, until the final reel spins FORWARD into one Hisabche invoice.
//
//   1. the present sale rewinds into a paper notebook — the hook
//   2. the paper memory holds: the same night, the same numbers, again
//   3. one number is copied into four places; three rewinds, three flashes
//   4. the rewind reverses: four copies fold into one invoice, five records post
//   5. the brand curtain: the paper past shrinks away — «دیگه دفتر کاغذی برنمیگرده»
//
// Craft notes: one focal stage, no camera zoom, no decorative dividers,
// deterministic scene-clock math, ≤ 6 non-subtitle words on stage, 24px+
// margins, dark studio theme. The flash is a single smooth ramp (no blinking),
// and no numeric values are written on the paper — only bar placeholders.
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, enter, mix, progress, spring, strokeDraw } from '../engine/anim'
import { FlashbackEventSparks } from '../components/Reel112FlashbackActors'
import { S112 } from './flashback-timing'

// ─── Tokens ─────────────────────────────────────────────────────────────────

const NIGHT = '#080b12'
const PANEL = '#111722'
const CYAN = '#22d3ee'
const CYAN_DIM = 'rgba(34, 211, 238, 0.32)'
const SEPIA = '#b9a68a'
const SEPIA_DIM = 'rgba(185, 166, 138, 0.28)'
const PAPER = '#cbbda2'
const INK = '#2a241b'
const CREAM = '#e9eef7'
const HAIRLINE = 'rgba(255, 255, 255, 0.09)'
const MONO = "'JetBrains Mono', 'Vazirmatn', monospace"

export type SceneProps = { t: number; scene: Scene }

// ─── Stage ──────────────────────────────────────────────────────────────────

function Stage({ children }: { children: ReactNode }) {
  return (
    <div
      dir="ltr"
      style={{
        position: 'absolute',
        inset: 0,
        width: 540,
        height: 960,
        overflow: 'hidden',
        backgroundColor: NIGHT,
        color: CREAM,
        fontFamily: "'Vazirmatn', -apple-system, sans-serif",
        backgroundImage:
          'radial-gradient(120% 46% at 50% -6%, rgba(34,211,238,0.08) 0%, rgba(34,211,238,0) 62%), radial-gradient(90% 40% at 50% 110%, rgba(185,166,138,0.05) 0%, rgba(185,166,138,0) 62%)',
      }}
    >
      {children}
      <div
        style={{
          position: 'absolute',
          bottom: 26,
          left: 30,
          fontSize: 9,
          letterSpacing: '0.18em',
          fontFamily: MONO,
          color: 'rgba(141, 147, 165, 0.32)',
          pointerEvents: 'none',
        }}
      >
        FLASHBACK REWIND // HISABCHE
      </div>
    </div>
  )
}

// ─── The flashback transition itself ────────────────────────────────────────
// One smooth sweep, one smooth flash: no strobe, no binary mask, no blink.

function RewindWipe({
  t,
  at,
  dur = 0.55,
  forward = false,
}: {
  t: number
  at: number
  dur?: number
  forward?: boolean | undefined
}) {
  const p = ease(clamp(progress(t, at, dur)))
  const active = clamp(progress(t, at, 0.04)) * (1 - clamp(progress(t, at + dur - 0.08, 0.08)))
  const flash = clamp(progress(t, at, 0.05)) * (1 - clamp(progress(t, at + 0.05, 0.18)))
  const x = forward ? mix(-620, 620, p) : mix(620, -620, p)
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity: active,
        pointerEvents: 'none',
      }}
    >
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: -80 + i * 170,
            left: x + i * 74,
            width: 3,
            height: 240,
            borderRadius: 2,
            transform: 'rotate(18deg)',
            background: forward ? CYAN : SEPIA,
            opacity: 0.55,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: forward
            ? 'radial-gradient(70% 42% at 50% 50%, rgba(34,211,238,0.16) 0%, rgba(34,211,238,0) 70%)'
            : 'rgba(236, 226, 204, 0.10)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: forward ? CYAN : '#eee4cf',
          opacity: flash * 0.42,
        }}
      />
    </div>
  )
}

// ─── Surfaces ───────────────────────────────────────────────────────────────

function PaperCard({ style, children }: { style: CSSProperties; children?: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        borderRadius: 10,
        background: `linear-gradient(180deg, #d9cdb4 0%, ${PAPER} 48%, #bdae90 100%)`,
        border: '1px solid rgba(255, 255, 255, 0.26)',
        boxShadow: '0 20px 44px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.3)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function PresentCard({ style, children }: { style: CSSProperties; children?: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        borderRadius: 16,
        background: `linear-gradient(180deg, #161e2b 0%, ${PANEL} 100%)`,
        border: `1px solid ${CYAN_DIM}`,
        boxShadow:
          '0 24px 56px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 42px rgba(34,211,238,0.10)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** A bar stands for a written value — never a fake, blinking number. */
function Bar({
  w,
  h = 7,
  tone = 0.12,
  dark = false,
}: {
  w: number
  h?: number
  tone?: number
  dark?: boolean | undefined
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: h / 2,
        backgroundColor: dark ? `rgba(42,36,27,${tone})` : `rgba(255,255,255,${tone})`,
      }}
    />
  )
}

function Dot({ size = 7, color = CYAN }: { size?: number; color?: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        boxShadow: `0 0 10px ${color}55`,
      }}
    />
  )
}

function CheckGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 12.6 9.6 17.6 19.5 7.2"
        stroke={CYAN}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** One functional label at a time — functional, never a second narration. */
function Label({
  t,
  text,
  top,
  at,
  size = 30,
  color = CREAM,
}: {
  t: number
  text: string
  top: number
  at: number
  size?: number
  color?: string
}) {
  return (
    <div
      dir="rtl"
      style={{
        ...enter(t, at, { y: 10, fade: 0.4 }),
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
      }}
      data-text={text}
    >
      <span style={{ fontSize: size, fontWeight: 800, color, lineHeight: 1 }}>{text}</span>
    </div>
  )
}

// ─── Scene 1: The Hook — a tap in the present rewinds into paper ─────────────

export function FlashbackHookScene({ t: rawT, scene }: SceneProps) {
  const t = rawT / S112.factors[0]!
  const past = ease(clamp(progress(t, 1.05, 0.55)))
  const shake =
    Math.sin((t - 1.05) * 19) *
    3.5 *
    clamp(progress(t, 1.05, 0.1)) *
    (1 - clamp(progress(t, 1.42, 0.3)))
  const scribble = strokeDraw(t, 1.5, 0.9, 500)
  return (
    <Stage>
      <FlashbackEventSparks t={rawT} scene={scene} />
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - past }}>
        <PresentCard
          style={{
            top: 230,
            left: 62,
            width: 416,
            height: 300,
            transform: `translateX(${shake}px)`,
          }}
        >
          <div style={{ position: 'absolute', top: 24, left: 24, display: 'flex', gap: 8 }}>
            <Dot />
            <Bar w={54} />
            <Bar w={34} tone={0.08} />
          </div>
          <div
            style={{
              position: 'absolute',
              top: 112,
              left: 28,
              right: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <Bar w={310} h={10} tone={0.16} />
            <Bar w={232} h={10} tone={0.1} />
            <Bar w={276} h={10} tone={0.08} />
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 28,
              left: 176,
              width: 64,
              height: 46,
              borderRadius: 12,
              border: `1px solid ${CYAN}`,
              background: 'rgba(34,211,238,0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckGlyph size={22} />
          </div>
        </PresentCard>
      </div>

      <div style={{ position: 'absolute', inset: 0, opacity: past }}>
        <PaperCard
          style={{
            top: 230,
            left: 62,
            width: 416,
            height: 300,
            transform: 'rotate(-1.4deg)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 28,
              left: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            <Bar dark w={196} h={9} tone={0.32} />
            <Bar dark w={142} h={9} tone={0.24} />
          </div>
          <svg
            width={416}
            height={300}
            style={{ position: 'absolute', inset: 0 }}
            viewBox="0 0 416 300"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M34 138 C 92 106, 128 168, 184 132 S 286 170, 350 128"
              stroke={INK}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={scribble.strokeDasharray}
              strokeDashoffset={scribble.strokeDashoffset}
              opacity={0.72}
            />
          </svg>
        </PaperCard>
      </div>

      <RewindWipe t={t} at={0.85} dur={0.6} />
      <Label t={t} text="دوباره دفتر؟" top={620} at={1.6} size={34} />
    </Stage>
  )
}

// ─── Scene 2: The Paper Memory Hold ────────────────────────────────────────

export function PaperMemoryScene({ t: rawT, scene }: SceneProps) {
  const t = rawT / S112.factors[1]!
  const scribble = strokeDraw(t, 1.7, 1.1, 600)
  const now = ease(clamp(progress(t, 2.6, 1.4)))
  return (
    <Stage>
      <FlashbackEventSparks t={rawT} scene={scene} />
      <RewindWipe t={t} at={0.02} dur={0.5} />
      <PaperCard
        style={{
          top: 250,
          left: 70,
          width: 400,
          height: 340,
          transform: 'rotate(0.6deg)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 30,
            left: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 19,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Bar dark w={52 + i * 9} h={8} tone={0.28} />
              <Bar dark w={110 + i * 14} h={8} tone={0.18} />
            </div>
          ))}
        </div>
        <svg
          width={400}
          height={340}
          style={{ position: 'absolute', inset: 0 }}
          viewBox="0 0 400 340"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M28 176 C 76 142, 112 200, 160 166 S 248 206, 306 160 L 352 176"
            stroke={INK}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeDasharray={scribble.strokeDasharray}
            strokeDashoffset={scribble.strokeDashoffset}
            opacity={0.68}
          />
        </svg>
      </PaperCard>

      {/* the present still waiting at the edge of the memory */}
      <div
        style={{
          position: 'absolute',
          left: 496,
          top: 210,
          width: 20,
          height: 540,
          borderRadius: 10,
          background: CYAN,
          opacity: mix(0.12, 0.4, now),
          boxShadow: '0 0 30px rgba(34,211,238,0.35)',
          pointerEvents: 'none',
        }}
      />
      <RewindWipe t={t} at={3.35} dur={0.4} />
      <Label t={t} text="دفتر دستی" top={150} at={0.3} size={30} color={SEPIA} />
    </Stage>
  )
}

// ─── Scene 3: One number copied four times — three rewinds ──────────────────

const COPIES = [
  { label: 'دفتر', at: 0.1, x: 54, y: 270 },
  { label: 'اکسل', at: 1.3, x: 286, y: 270 },
  { label: 'ماشین حساب', at: 2.8, x: 54, y: 470 },
  { label: 'گوشی', at: 4.1, x: 286, y: 470 },
] as const

export function FourCopyRewindScene({ t: rawT, scene }: SceneProps) {
  const t = rawT / S112.factors[2]!
  return (
    <Stage>
      <FlashbackEventSparks t={rawT} scene={scene} />
      {[0.02, 1.2, 2.6, 4.0].map((at) => (
        <RewindWipe key={at} t={t} at={at} dur={0.45} />
      ))}
      {COPIES.map((copy) => (
        <PaperCard
          key={copy.label}
          style={{
            top: copy.y,
            left: copy.x,
            width: 200,
            height: 150,
            ...enter(t, copy.at, { y: 18, x: copy.x < 200 ? -18 : 18, scale: 0.94 }),
          }}
        >
          <div
            dir="rtl"
            style={{
              position: 'absolute',
              top: 18,
              right: 16,
              fontSize: 23,
              fontWeight: 800,
              color: INK,
              lineHeight: 1.2,
            }}
          >
            {copy.label}
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 20,
              left: 16,
              right: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
            }}
          >
            <Bar dark w={124} h={7} tone={0.3} />
            <Bar dark w={76} h={7} tone={0.22} />
          </div>
        </PaperCard>
      ))}
      <div
        style={{
          position: 'absolute',
          top: 704,
          left: 266,
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: CYAN,
          opacity: clamp(progress(t, 5.0, 0.4)),
          boxShadow: '0 0 18px rgba(34,211,238,0.5)',
        }}
      />
    </Stage>
  )
}

// ─── Scene 4: The rewind reverses — one invoice, five records ───────────────

const FIVE_RECORDS = ['انبار', 'صندوق', 'دفتر', 'طلب', 'سود'] as const

export function ForwardResolutionScene({ t: rawT, scene }: SceneProps) {
  const t = rawT / S112.factors[3]!
  const rise = spring(clamp(progress(t, 1.6, 0.9)))
  return (
    <Stage>
      <FlashbackEventSparks t={rawT} scene={scene} />
      {/* the four paper copies peel away to the left */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: 254 + i * 9,
            left: 72 + (i % 2) * 26,
            width: 360,
            height: 272,
            borderRadius: 10,
            background: 'rgba(185,166,138,0.16)',
            border: `1px solid ${SEPIA_DIM}`,
            transform: `translateX(${(1 - rise) * -480}px)`,
            opacity: (1 - rise) * 0.55,
          }}
        />
      ))}

      <RewindWipe t={t} at={0.03} dur={0.5} forward />
      <RewindWipe t={t} at={1.7} dur={0.7} forward />

      <PresentCard
        style={{
          top: 220,
          left: 60,
          width: 420,
          height: 390,
          transform: `translateY(${(1 - rise) * 60}px)`,
          opacity: clamp(progress(t, 1.6, 0.4)),
        }}
      >
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 22,
            right: 22,
            fontSize: 26,
            fontWeight: 900,
            color: CYAN,
          }}
        >
          حسابچه
        </div>
        <div style={{ position: 'absolute', top: 34, left: 22, display: 'flex', gap: 7 }}>
          <Dot />
          <Dot />
          <Dot />
        </div>

        {FIVE_RECORDS.map((label, i) => {
          const on = clamp(progress(t, 2.2 + i * 0.15, 0.35))
          const col = i % 3
          const row = i < 3 ? 0 : 1
          return (
            <div
              key={label}
              dir="rtl"
              style={{
                position: 'absolute',
                top: 118 + row * 76,
                left: 22 + col * 130,
                width: 120,
                height: 58,
                borderRadius: 12,
                border: `1px solid ${on > 0.5 ? CYAN_DIM : HAIRLINE}`,
                background: on > 0.5 ? 'rgba(34,211,238,0.10)' : 'rgba(255,255,255,0.025)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: mix(0.42, 1, on),
                transform: `translateY(${(1 - on) * 10}px)`,
              }}
            >
              <span style={{ fontSize: 19, fontWeight: 800, color: CREAM }}>{label}</span>
              {on > 0.6 && <CheckGlyph size={15} />}
            </div>
          )
        })}

        {/* the single action is icon-only — no extra word on the stage */}
        <div
          style={{
            position: 'absolute',
            bottom: 28,
            left: 178,
            width: 64,
            height: 48,
            borderRadius: 12,
            border: `1px solid ${CYAN}`,
            background: 'rgba(34,211,238,0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CheckGlyph size={24} />
        </div>
      </PresentCard>
    </Stage>
  )
}

// ─── Scene 5: The end card — the paper past shrinks away ────────────────────

export function FlashbackEndCardScene({ t: rawT, scene }: SceneProps) {
  const t = rawT / S112.factors[4]!
  const past = clamp(progress(t, 0.1, 1.2))
  const brand = enter(t, 0.2, { y: 18 })
  const tagline = enter(t, 0.35, { y: 12 })
  const domain = enter(t, 0.45, { y: 10 })
  return (
    <Stage>
      <FlashbackEventSparks t={rawT} scene={scene} />
      <div
        style={{
          position: 'absolute',
          top: 180,
          left: 64,
          width: 90,
          height: 66,
          borderRadius: 8,
          background: 'rgba(185,166,138,0.18)',
          border: `1px solid ${SEPIA_DIM}`,
          transform: `scale(${mix(1, 0.6, past)})`,
          opacity: mix(0.5, 0.12, past),
        }}
      />
      <RewindWipe t={t} at={0.02} dur={0.5} forward />

      <div
        dir="rtl"
        style={{
          ...brand,
          position: 'absolute',
          top: 430,
          left: 270,
          transform: 'translate(-50%, -50%)',
          fontSize: 104,
          fontWeight: 900,
          color: CREAM,
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
        }}
      >
        حسابچه
      </div>
      <div
        dir="rtl"
        style={{
          ...tagline,
          position: 'absolute',
          top: 580,
          left: 270,
          transform: 'translate(-50%, -50%)',
          fontSize: 30,
          fontWeight: 800,
          color: CYAN,
          whiteSpace: 'nowrap',
        }}
      >
        دیگه دفتر کاغذی برنمیگرده
      </div>
      <div
        style={{
          ...domain,
          position: 'absolute',
          top: 672,
          left: 270,
          transform: 'translate(-50%, -50%)',
          fontFamily: MONO,
          fontSize: 21,
          fontWeight: 700,
          letterSpacing: '0.24em',
          color: CREAM,
        }}
      >
        HISABCHE.COM
      </div>
    </Stage>
  )
}
