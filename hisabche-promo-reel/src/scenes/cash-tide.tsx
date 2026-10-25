// ============================================
// Cash-Tide art direction (reel 89) — «موج روشن»
//
// The shop's cash is an underwater basin. Frame 0: a coin drops into
// complete darkness — its splash rippling where nobody can see. Three hidden
// vents (نسیه، خرج، اضافه) drain light out of the basin. Hisabche sends
// flow-lock rings that seal every vent one by one, the basins fill with
// measurable light, and the whole mechanism surfaces at dawn: the ledger
// breaks through the waterline as three glowing reflections.
//
// Fully self-authored engineering: its own petrol palette, own bubble/vent/
// basin physics, own water-surface primitive — nothing is shared with the
// 84–88 film kits.
//
// One persistent arithmetic: ۵٬۵۰۰٬۰۰۰ فروش − ۳٬۳۶۰٬۰۰۰ بهای تمام‌شده
//                          − ۷۶۰٬۰۰۰ خرج = ۱٬۳۸۰٬۰۰۰ سود
//
// Note: wave/level edges are intrinsic water surfaces, not decorative
// dividers (stage rule 16 exception documented for this film).
// ============================================

import type { CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, deterministicHash, ease, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

// ─── Tokens ──────────────────────────────────────────────────────────────────

export const ABYSS = '#062028'
export const TRENCH = '#021114'
export const LAGOON = '#3fe8d0'
export const MIST = '#d9fff8'
export const DAWN = '#ffc37c'
export const COIN = '#ffce6b'

const DEPTH_WASH: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(880px 560px at 50% 26%, rgba(63,232,208,0.10), transparent 62%), radial-gradient(720px 500px at 24% 74%, rgba(6,16,20,0.55), transparent 66%)',
}

const WATER_VIGNETTE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(118% 88% at 50% 40%, transparent 50%, rgba(1,8,10,0.92) 100%)',
}

/** Deep-water backdrop: god-ray shafts from above + suspended plankton dust. */
function TideBackdrop({ t }: { t: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={DEPTH_WASH} />
      {/* god rays: slanted light shafts swaying with the current */}
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
              width: 46 + seed * 34,
              height: 640,
              background: `linear-gradient(180deg, rgba(63,232,208,${0.06 + seed * 0.05}), transparent 78%)`,
              transform: `rotate(${11 + sway}deg)`,
              transformOrigin: 'top center',
              filter: 'blur(2px)',
            }}
          />
        )
      })}
      {/* suspended particles drifting upward */}
      {Array.from({ length: 42 }).map((_, i) => {
        const seed = deterministicHash(i, 71)
        const x = ((i * 83) % 540) + seed * 26
        const cycle = (t * (0.02 + seed * 0.05) + seed) % 1
        const y = 960 - cycle * 1000
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: y,
              insetInlineStart: x,
              width: 2 + seed * 2,
              height: 2 + seed * 2,
              borderRadius: '50%',
              background: MIST,
              opacity: Math.sin(cycle * Math.PI) * (0.1 + seed * 0.16),
            }}
          />
        )
      })}
      <div style={WATER_VIGNETTE} />
    </div>
  )
}

/** The stage every scene paints itself over. */
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
        // Deterministic canvas (layout-defect-laws.md band 1): the player
        // document is RTL and mirrors insetInlineStart; the stage pins LTR so
        // numeric insets are physical left coordinates.
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

function pop(t: number, at: number, dur = 0.55): number {
  return spring(clamp(progress(t, at, at + dur)))
}

/** A single deterministic bubble: rises, wobbles, fades at its own cycle. */
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
        background: 'radial-gradient(circle at 34% 30%, rgba(255,255,255,0.35), transparent 58%)',
        opacity: Math.sin(cycle * Math.PI) * 0.85 * clamp(opacityScale),
        boxShadow: `0 0 ${4 + seed * 6}px rgba(63,232,208,${0.2 + seed * 0.25})`,
      }}
    />
  )
}

/** Staged word cluster in reading order; lights with the voice and STAYS. */
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
      }}
    >
      {words.map((word, i) => {
        const p = pop(t, cueAt + i * 0.36)
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

/** Monotonic rolling figure: 0 → value, then holds (never blinks). */
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
        lineHeight: 1.05,
        textShadow: `0 0 16px ${color}55`,
        whiteSpace: 'nowrap',
      }}
    >
      {faNumber(n)}
    </span>
  )
}

/** The sinking coin: gold disc, wobbling fall, splash ring, glowing rest. */
function FallingCoin({ t, restY = 556 }: { t: number; restY?: number }) {
  const fallP = clamp(progress(t, 0, 1.0))
  const y = mix(-70, restY, fallP * fallP)
  const tilt = Math.sin(t * 5 + 1) * (1 - clamp(progress(t, 1.0, 1.4))) * 8
  const splash = clamp(progress(t, 1.02, 0.9))
  const glowP = pop(t, 1.35, 0.9)
  const breathe = 1 + 0.03 * Math.sin(t * 2.4)
  return (
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
      {/* splash ring */}
      <div
        style={{
          position: 'absolute',
          top: restY + 18,
          insetInlineStart: '50%',
          width: mix(0, 240, ease(splash)),
          height: mix(0, 70, ease(splash)),
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          border: `2.5px solid rgba(255,206,107,${clamp(0.9 - splash)})`,
          boxShadow: `0 0 ${30 * (1 - splash)}px rgba(255,206,107,0.7)`,
          opacity: clamp(1 - splash),
        }}
      />
      {/* blackout depth pulse below the splash */}
      <div
        style={{
          position: 'absolute',
          top: restY + 30,
          insetInlineStart: '50%',
          width: mix(60, 320, ease(splash)),
          height: mix(30, 160, ease(splash)),
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: TRENCH,
          filter: 'blur(16px)',
          opacity: ease(splash) * 0.7,
        }}
      />
      {/* coin body */}
      <div
        style={{
          position: 'absolute',
          top: y,
          insetInlineStart: '50%',
          transform: `translateX(-50%) rotate(${tilt.toFixed(2)}deg) scale(${breathe.toFixed(3)})`,
          width: 78,
          height: 78,
          borderRadius: '50%',
          background: `radial-gradient(circle at 36% 32%, #fff3d0, ${COIN} 52%, #b9823a 96%)`,
          border: '2px solid rgba(255,243,208,0.75)',
          boxShadow: `0 0 ${20 + glowP * 40}px ${COIN}, 0 10px 30px rgba(1,10,12,0.6)`,
          opacity: clamp(1.2 - splash * 0.35),
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '30% 34%',
            borderRadius: '50%',
            border: '1.5px solid rgba(185,130,58,0.8)',
          }}
        />
      </div>
      {/* residual bubbles after the drop */}
      {splash > 0 &&
        Array.from({ length: 12 }).map((_, i) => {
          const seed = deterministicHash(i, 37)
          return (
            <Bubble
              key={i}
              t={t}
              seed={seed}
              x={(seed - 0.5) * 150}
              yStart={restY + 16}
              rise={110 + seed * 90}
              speed={0.5 + seed * 0.4}
            />
          )
        })}
    </div>
  )
}

/** A cracked rock vent draining light; can be sealed by a flow-lock ring. */
function Vent({
  t,
  at,
  x,
  y,
  label,
  sealedAt = -1,
  seed,
}: {
  t: number
  at: number
  x: number
  y: number
  label: string
  sealedAt?: number
  seed: number
}) {
  const entered = pop(t, at, 0.8)
  const sealed = sealedAt < 0 ? 0 : ease(clamp(progress(t, sealedAt, 0.9)))
  const rim = 0.55 + 0.45 * Math.sin(t * 2.6 + seed * 7)
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        insetInlineStart: x,
        transform: `scale(${mix(0.4, 1, entered).toFixed(3)})`,
        opacity: clamp(entered * 1.6),
        width: 132,
        height: 98,
      }}
    >
      <svg viewBox="0 0 132 98" style={{ width: 132, height: 98, overflow: 'visible' }}>
        <path
          d="M 8 92 C 22 46, 46 22, 66 20 C 88 22, 112 48, 124 92 Z"
          fill="rgba(3,14,17,0.95)"
          stroke="rgba(63,232,208,0.4)"
          strokeWidth="2"
        />
        {/* cracked mouth */}
        <path
          d="M 52 30 L 66 22 L 82 32 L 74 44 L 60 38 Z"
          fill={LAGOON}
          opacity={clamp(rim * (1 - sealed))}
        />
      </svg>
      {/* label chip — functional, one word */}
      <div
        style={{
          position: 'absolute',
          top: 96,
          insetInlineStart: 14,
          transform: `scale(${mix(0.5, 1, clamp(entered)).toFixed(3)})`,
          background: 'rgba(3,14,17,0.9)',
          border: `1px solid ${sealed > 0.5 ? LAGOON : 'rgba(217,255,248,0.45)'}`,
          borderRadius: 8,
          padding: '4px 14px',
          fontSize: 16,
          fontWeight: 900,
          color: MIST,
          whiteSpace: 'nowrap',
          boxShadow: '0 6px 18px rgba(1,8,10,0.6)',
        }}
      >
        {label}
      </div>
      {/* bubble stream — never a wall of text, only pressure */}
      {sealed < 1
        ? Array.from({ length: 7 }).map((_, i) => {
            const bSeed = deterministicHash(i + seed * 10, 53)
            return (
              <Bubble
                key={i}
                t={t}
                seed={bSeed}
                x={(bSeed - 0.5) * 46}
                yStart={y + 24 - y}
                rise={130 + bSeed * 110}
                speed={0.55 + bSeed * 0.5}
                opacityScale={1 - sealed}
              />
            )
          })
        : null}
      {/* cap flash while sealing */}
      {sealed > 0 && sealed < 1 && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            insetInlineStart: 52,
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: LAGOON,
            filter: 'blur(12px)',
            opacity: Math.sin(sealed * Math.PI),
          }}
        />
      )}
    </div>
  )
}

/** Deterministic flow-lock: descends, contracts, and seals. */
function FlowRing({ t, at, x, y }: { t: number; at: number; x: number; y: number }) {
  const travel = ease(clamp(progress(t, at, at + 1.0)))
  const seal = pop(t, at + 1.0, 0.5)
  const yNow = mix(90, y, travel)
  const size = mix(96, 34, ease(clamp(progress(t, at + 0.55, at + 1.0))))
  return (
    <div
      style={{
        position: 'absolute',
        top: yNow - size / 2,
        insetInlineStart: x - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        border: `${2.5 + seal * 1.5}px solid ${LAGOON}`,
        boxShadow: `0 0 ${20 + seal * 30}px ${LAGOON}`,
        opacity: clamp((0.7 + seal * 0.8) * (travel > 0 ? 1 : 0)),
      }}
    />
  )
}

/**
 * A basin column filling with bioluminal water. The crescent ellipse at the
 * liquid top is the meniscus — an intrinsic water surface, not a divider.
 */
function Basin({
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
  const entered = pop(t, at, 0.8)
  const fillP = ease(clamp(progress(t, delay, delay + 2.2)))
  const level = mix(0, fillTo, fillP)
  const crest = Math.sin(t * 3.1 + x * 0.02) * 3
  const columnTop = 330
  const floor = 762
  // The level is measured inside the wrapper (its top is columnTop), so the
  // liquid top must be relative to the wrapper's own origin
  // (layout-defect-laws.md band 5) — `floor - level` pushed the liquid almost
  // entirely above the column and left it invisible.
  const liquidY = floor - columnTop - level
  return (
    <div
      style={{
        position: 'absolute',
        top: columnTop,
        insetInlineStart: x - 56,
        width: 112,
        height: floor - columnTop + 8,
        opacity: clamp(entered * 1.6),
        transform: `translateY(${mix(18, 0, entered).toFixed(1)}px)`,
      }}
    >
      {/* column walls */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 16,
          border: `1.8px solid rgba(217,255,248,0.35)`,
          background: 'rgba(3,14,17,0.55)',
          boxShadow: 'inset 0 8px 26px rgba(1,8,10,0.6)',
          overflow: 'hidden',
        }}
      />
      {/* liquid */}
      <div
        style={{
          position: 'absolute',
          top: liquidY + crest,
          bottom: 0,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          background: `linear-gradient(180deg, ${color}44, ${color}18)`,
          borderRadius: '0 0 15px 15px',
          borderTop: `2px solid ${color}`,
          boxShadow: `0 0 22px ${color}44`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -8,
            insetInlineStart: -4,
            width: 'calc(100% + 8px)',
            height: 14,
            borderRadius: '50%',
            background: color,
            opacity: 0.5,
            filter: 'blur(3px)',
          }}
        />
      </div>
      {/* label + value */}
      <div
        style={{
          position: 'absolute',
          bottom: -46,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 16,
          fontWeight: 900,
          color,
          letterSpacing: '0.06em',
        }}
      >
        {label}
        <div style={{ marginTop: 4 }}>
          <TideRoll t={t} at={delay + 0.3} value={value} color={color} size={19} />
        </div>
      </div>
    </div>
  )
}

/** The reflective water surface used while surfacing at dawn. */
function WaveSurface({ t, y, amp = 8 }: { t: number; y: number; amp?: number }) {
  const pts: string[] = []
  for (let px = 0; px <= 540; px += 30) {
    pts.push(`${px} ${(y + Math.sin(px * 0.03 + t * 2.2) * amp).toFixed(1)}`)
  }
  return (
    <svg
      viewBox="0 0 540 960"
      style={{ position: 'absolute', inset: 0, width: 540, height: 960, pointerEvents: 'none' }}
    >
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={LAGOON}
        strokeWidth="2.5"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  )
}

// ─── Scene 1 (0–4s) — Frame-0: the coin drops where nobody watches ──────────

export function CoinFallScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  return (
    <TideStage scene={scene} t={t}>
      {/* the strike transient lives in the visuals: black pressure from frame 0 */}
      <div
        style={{
          position: 'absolute',
          top: 300,
          insetInlineStart: '50%',
          transform: `translateX(-50%) scale(${(1 + (1 - ease(clamp(progress(t, 0.02, 0.7)))) * 0.2).toFixed(3)})`,
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'rgba(63,232,208,0.12)',
          filter: 'blur(30px)',
          opacity: clamp(1 - ease(clamp(progress(t, 0.02, 1.1)))),
        }}
      />
      <FallingCoin t={t} />
      {/* single focal word cluster — 4 words, staged, persistent */}
      <TideWords
        t={t}
        cueAt={0.5}
        words={['یک', 'سکه', 'گم', 'می‌شه!']}
        y={652}
        size={40}
        accentWord="گم"
        accentColor={COIN}
      />
    </TideStage>
  )
}

// ─── Scene 2 (4–12s) — Three hidden vents draining the light ────────────────

const VENTS = [
  { x: 130, y: 400, label: 'نسیه', seed: 0.21 },
  { x: 270, y: 350, label: 'خرج', seed: 0.48 },
  { x: 410, y: 410, label: 'اضافه', seed: 0.76 },
]

export function LeakCurScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const pressure = 1 - ease(clamp(progress(t, 0.4, 2.4)))
  return (
    <TideStage scene={scene} t={t}>
      {/* closing water walls: the basin is running out of light */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: TRENCH,
          opacity: pressure * 0.28,
          pointerEvents: 'none',
        }}
      />
      {VENTS.map((vent, i) => (
        <Vent
          key={vent.label}
          t={t}
          at={i * 0.5}
          x={vent.x - 66}
          y={vent.y}
          label={vent.label}
          seed={vent.seed}
        />
      ))}
      {/* focal word cluster — 3 words */}
      <TideWords
        t={t}
        cueAt={0.45}
        words={['سه', 'نشتِ', 'پنهان']}
        y={176}
        size={38}
        accentWord="پنهان"
      />
    </TideStage>
  )
}

// ─── Scene 3 (12–20s) — Flow-lock rings descend and seal every vent ─────────

const SEAL_TIMES = [1.6, 3.4, 5.2]

export function FlowLockScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  return (
    <TideStage scene={scene} t={t}>
      {VENTS.map((vent, i) => (
        <div key={vent.label}>
          <Vent
            t={t}
            at={0.15 + i * 0.12}
            x={vent.x - 66}
            y={vent.y}
            label={vent.label}
            sealedAt={SEAL_TIMES[i]}
            seed={vent.seed}
          />
          <FlowRing t={t} at={SEAL_TIMES[i] - 1.0} x={vent.x} y={vent.y + 34} />
        </div>
      ))}
      {/* focal word cluster — 4 words */}
      <TideWords
        t={t}
        cueAt={0.5}
        words={['هر', 'نشت', 'قفل', 'می‌شه!']}
        y={176}
        size={38}
        accentWord="قفل"
      />
    </TideStage>
  )
}

// ─── Scene 4 (20–31s) — Basins fill; the profit surfaces as a big number ────

export function BasinLevelsScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const profitIn = pop(t, 7.8, 0.9)
  return (
    <TideStage scene={scene} t={t}>
      <Basin
        t={t}
        at={0.3}
        x={100}
        label="فروش"
        value={5500000}
        fillTo={392}
        delay={0.6}
        color={LAGOON}
      />
      <Basin
        t={t}
        at={0.7}
        x={270}
        label="بهای"
        value={3360000}
        fillTo={224}
        delay={3.2}
        color={MIST}
      />
      <Basin
        t={t}
        at={1.1}
        x={440}
        label="خرج"
        value={760000}
        fillTo={92}
        delay={4.9}
        color={DAWN}
      />
      {/* the profit number: a lantern of measured light above the basins */}
      <div
        style={{
          position: 'absolute',
          top: 168,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          opacity: clamp(profitIn * 1.6),
          transform: `translateY(${mix(16, 0, profitIn).toFixed(1)}px)`,
        }}
      >
        <div
          dir="rtl"
          style={{
            background: 'rgba(3,14,17,0.88)',
            border: `2px solid ${LAGOON}`,
            boxShadow: `0 18px 60px rgba(1,10,12,0.7), 0 0 40px ${LAGOON}55`,
            borderRadius: 18,
            padding: '12px 30px',
            display: 'flex',
            alignItems: 'baseline',
            gap: 14,
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 900, color: LAGOON, letterSpacing: '0.08em' }}>
            سود
          </span>
          <TideRoll t={t} at={8.2} value={1380000} color={MIST} size={34} />
        </div>
      </div>
      {/* focal word cluster — 2 words, after the fill */}
      <TideWords
        t={t}
        cueAt={9.1}
        words={['عدد،', 'می‌ماند.']}
        y={92}
        size={34}
        accentWord="می‌ماند."
      />
    </TideStage>
  )
}

// ─── Scene 5 (31–40s) — Surfacing: the ledger breaks through the waterline ──

const SURFACE_ROWS = [
  { label: 'فروش', value: 5500000, at: 4.4, color: LAGOON },
  { label: 'خرج', value: 760000, at: 5.4, color: DAWN },
  { label: 'سود', value: 1380000, at: 6.4, color: MIST },
]

export function DawnSurfaceScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const surfaceP = ease(clamp(progress(t, 0.4, 2.6)))
  const surfaceY = mix(300, 580, surfaceP)
  const skyIn = clamp(progress(t, 1.4, 3.0))
  const sunIn = pop(t, 2.6, 1.2)
  return (
    <TideStage scene={scene} t={t}>
      {/* dawn sky above the waterline */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          height: surfaceY,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          background:
            'linear-gradient(180deg, rgba(7,32,40,0.0) 0%, rgba(255,195,124,0.16) 66%, rgba(255,195,124,0.34) 100%)',
          opacity: skyIn * 0.9,
        }}
      />
      {/* the rising sun */}
      <div
        style={{
          position: 'absolute',
          top: surfaceY - 92 * sunIn,
          insetInlineStart: '50%',
          transform: 'translateX(-50%)',
          width: 84,
          height: 84,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(255,240,210,0.95), ${DAWN} 58%, transparent 76%)`,
          filter: 'blur(6px)',
          opacity: clamp(sunIn * 1.4),
          boxShadow: `0 0 70px ${DAWN}`,
        }}
      />
      {/* rows breaking through: they rise from below their slots and hold */}
      {SURFACE_ROWS.map((row, i) => {
        const entered = pop(t, row.at, 0.8)
        const yFinal = 300 + i * 64
        return (
          <div
            key={row.label}
            dir="rtl"
            style={{
              position: 'absolute',
              top: mix(yFinal + 120, yFinal, entered),
              insetInlineStart: 70,
              width: 400,
              background: 'rgba(3,14,17,0.88)',
              border: `1.6px solid ${row.color}`,
              boxShadow: `0 12px 40px rgba(1,10,12,0.65), 0 0 24px ${row.color}44`,
              borderRadius: 14,
              padding: '10px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              opacity: clamp(entered * 1.6),
            }}
          >
            <span
              style={{ fontSize: 15, fontWeight: 900, color: row.color, letterSpacing: '0.08em' }}
            >
              {row.label}
            </span>
            <TideRoll t={t} at={row.at + 0.4} value={row.value} color={row.color} size={23} />
          </div>
        )
      })}
      {/* the waterline itself */}
      <WaveSurface t={t} y={surfaceY} />
      {/* focal word cluster — 3 words, after dawn settles */}
      <TideWords
        t={t}
        cueAt={6.9}
        words={['صبح', 'حسابت', 'روشن']}
        y={688}
        size={38}
        accentWord="روشن"
        accentColor={DAWN}
      />
    </TideStage>
  )
}

// ─── Scene 6 (40–45s) — End card: buoy lockup + CTA over calm dawn water ────

export function TideCtaScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const lock = pop(t, 0.3, 0.8)
  const cta = pop(t, 0.95, 0.7)
  const bob = Math.sin(t * 1.5) * 3
  return (
    <TideStage scene={scene} t={t}>
      {/* calm dawn gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(255,195,124,0.13) 8%, rgba(6,32,40,0.0) 46%, rgba(2,17,20,0.6) 100%)',
        }}
      />
      {/* waterline */}
      <WaveSurface t={t} y={620} amp={6} />
      {/* floating brand orb */}
      <div
        style={{
          position: 'absolute',
          top: 208 + bob,
          insetInlineStart: '50%',
          transform: 'translateX(-50%)',
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: `radial-gradient(circle at 36% 30%, rgba(255,255,255,0.9), ${LAGOON} 52%, transparent 86%)`,
          boxShadow: `0 0 46px ${LAGOON}88`,
          opacity: clamp(lock * 1.6),
        }}
      />
      {/* wordmark */}
      <div
        style={{
          position: 'absolute',
          top: 306 + bob,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 66,
          fontWeight: 900,
          color: MIST,
          textShadow: `0 0 54px rgba(63,232,208,0.5)`,
          opacity: clamp(lock * 1.6),
          transform: `translateY(${mix(12, 0, lock).toFixed(1)}px)`,
        }}
      >
        حسابچه
      </div>
      {/* wave-crest underline — a physical wave, not a straight rule */}
      <svg
        viewBox="0 0 260 26"
        style={{
          position: 'absolute',
          top: 396 + bob,
          insetInlineStart: '50%',
          transform: 'translateX(-50%)',
          width: 260,
          height: 26,
        }}
      >
        <polyline
          points={Array.from({ length: 14 })
            .map((_, i) => `${i * 20} ${(13 + Math.sin(i * 1.1 + t * 2.4) * 5).toFixed(1)}`)
            .join(' ')}
          fill="none"
          stroke={LAGOON}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity={clamp(lock * 1.4)}
        />
      </svg>
      {/* CTA pill — in by 0.3s, holds at full opacity to the end (>= 3s) */}
      <div
        style={{
          position: 'absolute',
          top: 470,
          insetInlineStart: '50%',
          transform: `translateX(-50%) scale(${mix(0.3, 1, cta).toFixed(3)})`,
          opacity: clamp(cta * 1.7),
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${LAGOON}, ${COIN})`,
            color: '#05231f',
            fontSize: 30,
            fontWeight: 900,
            padding: '14px 54px',
            borderRadius: 999,
            boxShadow: '0 24px 60px rgba(1,10,12,0.7), 0 0 44px rgba(63,232,208,0.5)',
          }}
        >
          شروع رایگان
        </div>
      </div>
      <div
        dir="ltr"
        style={{
          position: 'absolute',
          top: 566,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
          fontSize: 15,
          letterSpacing: '0.24em',
          color: 'rgba(217,255,248,0.75)',
          opacity: clamp(cta * 1.3),
        }}
      >
        hisabche.com
      </div>
    </TideStage>
  )
}
