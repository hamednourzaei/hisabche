// ============================================
// Return-flow art direction (reel 104) — «سند مرجوعی»
//
// Frame 0: a carton is already sliding back across the counter. The stamp
// lands — but only ONE of the three books notices. Stock returns, the ledger
// and the customer's balance do not. Then one Hisabche return document drops
// from above, splits into three connectors, and fills all three lanes in the
// same beat: stock at cost, cost of goods reversed, receivable reduced, trial
// balance still level.
//
// Own palette, own lane/beam/document physics. Nothing shared with the
// 89 (cash-tide) or 103 (inference) film kits.
//
// One persistent arithmetic:
//   مرجوعی ۴٬۸۰۰٬۰۰۰ = بهای ۳٬۲۰۰٬۰۰۰ + سود ۱٬۶۰۰٬۰۰۰
//   انبار +۳٬۲۰۰٬۰۰۰ · بهای تمام‌شده −۳٬۲۰۰٬۰۰۰ · طلب −۴٬۸۰۰٬۰۰۰ · سود −۱٬۶۰۰٬۰۰۰
// ============================================

import type { CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, mix, progress, spring, strokeDraw } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

// ─── Tokens ──────────────────────────────────────────────────────────────────

const INK = '#0a0e14'
const PAPER = '#efe7d6'
const MINT = '#4ade80'
const AMBER = '#f0b429'
const ROSE = '#fb7185'

/** The one arithmetic this film keeps: 4.8M = 3.2M cost + 1.6M profit. */
const RETURN_TOTAL = 4_800_000
const RETURN_COST = 3_200_000

const DOT_GRID: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: `radial-gradient(rgba(240,180,41,0.18) 1px, transparent 1px)`,
  backgroundSize: '26px 26px',
  opacity: 0.3,
}

/** Deterministic dot-matrix paper behind every scene. */
function ReturnBackdrop({ t }: { t: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(900px 620px at 50% 28%, rgba(240,180,41,0.12), transparent 66%)',
        }}
      />
      <div style={{ ...DOT_GRID, transform: `translateY(${(t * 5) % 26}px)` }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(122% 92% at 50% 42%, transparent 46%, rgba(4,7,10,0.94) 100%)',
        }}
      />
    </div>
  )
}

/** The stage every scene paints itself over. */
export function ReturnStage({
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
        background: INK,
        overflow: 'hidden',
        color: PAPER,
      }}
    >
      <ReturnBackdrop t={t} />
      {children}
    </div>
  )
}

function pop(t: number, at: number, dur = 0.55): number {
  return spring(clamp(progress(t, at, dur)))
}

/** Monotonic rolling figure: 0 → value, then holds (never blinks). */
function Roll({
  t,
  at,
  value,
  color = PAPER,
  size = 26,
}: {
  t: number
  at: number
  value: number
  color?: string | undefined
  size?: number | undefined
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

/** Staged word cluster in reading order; lights with the voice and STAYS. */
function Words({
  t,
  cueAt,
  words,
  y,
  size = 38,
  accentWord,
  accentColor = AMBER,
}: {
  t: number
  cueAt: number
  words: string[]
  y: number
  size?: number | undefined
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
        const p = pop(t, cueAt + i * 0.34)
        const accent = word === accentWord
        return (
          <span
            key={word}
            style={{
              opacity: clamp(p * 1.6),
              transform: `translateY(${mix(15, 0, p).toFixed(1)}px)`,
              fontSize: size,
              fontWeight: 900,
              color: accent ? (accentColor ?? AMBER) : PAPER,
              whiteSpace: 'pre',
              textShadow: accent
                ? `0 0 28px ${accentColor ?? AMBER}`
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

/** The counter surface: a soft ellipse shadow, never a dividing line. */
function CounterSurface({ opacity = 1 }: { opacity?: number | undefined }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 616,
        insetInlineStart: '50%',
        transform: 'translateX(-50%)',
        width: 470,
        height: 96,
        borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(240,180,41,0.16), transparent 76%)',
        opacity,
      }}
    />
  )
}

/** The returned carton: two-tone faces, tipped tag, arrival spring. */
function Carton({ t, at = 0.05 }: { t: number; at?: number | undefined }) {
  const p = ease(clamp(progress(t, at, 1.9)))
  const settle = pop(t, at + 1.85, 0.6)
  const x = mix(620, 270, p) - (1 - settle) * 0
  const rot = mix(11, 0, p)
  const y = 470 - (1 - settle) * 6
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        insetInlineStart: x - 66,
        width: 132,
        height: 116,
        transform: `rotate(${rot.toFixed(2)}deg)`,
        filter: 'drop-shadow(0 26px 40px rgba(2,5,8,0.7))',
      }}
    >
      {/* top face */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          height: 30,
          background: 'linear-gradient(180deg, #f2d9a6, #d9b878)',
          borderRadius: '6px 6px 0 0',
          borderTop: '1.5px solid rgba(255,248,232,0.7)',
        }}
      />
      {/* front face */}
      <div
        style={{
          position: 'absolute',
          top: 30,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          bottom: 0,
          background: 'linear-gradient(180deg, #cdae74, #a98d59)',
          borderRadius: '0 0 6px 6px',
          border: '1.5px solid rgba(90,70,38,0.6)',
        }}
      />
      {/* packing tape */}
      <div
        style={{
          position: 'absolute',
          top: 30,
          insetInlineStart: 52,
          width: 28,
          height: 86,
          background: 'rgba(255,250,238,0.34)',
          borderInlineStart: '1px solid rgba(255,250,238,0.5)',
          borderInlineEnd: '1px solid rgba(255,250,238,0.5)',
        }}
      />
      {/* return arrow: it came back, it did not arrive */}
      <svg
        viewBox="0 0 200 90"
        style={{
          position: 'absolute',
          top: -74,
          insetInlineStart: -34,
          width: 200,
          height: 90,
          overflow: 'visible',
        }}
      >
        <path
          d="M 12 68 C 30 8, 150 6, 182 62"
          fill="none"
          stroke={ROSE}
          strokeWidth="3"
          strokeLinecap="round"
          {...strokeDraw(t, at + 0.5, 1.2, 320)}
          opacity={0.9}
        />
        <path
          d="M 168 50 L 182 64 L 160 68"
          fill="none"
          stroke={ROSE}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={clamp(progress(t, at + 1.6, 0.3))}
        />
      </svg>
    </div>
  )
}

/** Physical stamp impact: lands at full opacity and holds. */
function Stamp({
  t,
  at,
  text,
  color = ROSE,
  y = 388,
}: {
  t: number
  at: number
  text: string
  color?: string | undefined
  y?: number | undefined
}) {
  const s = pop(t, at, 0.5)
  const shake = Math.sin(t * 34) * 5 * (1 - clamp(progress(t, at, 0.4)))
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        top: y,
        insetInlineStart: '50%',
        transform: `translateX(calc(-50% + ${shake.toFixed(1)}px)) rotate(-7deg) scale(${mix(1.9, 1, s).toFixed(3)})`,
        opacity: clamp(s * 2),
        border: `3px solid ${color}`,
        borderRadius: 10,
        padding: '6px 22px',
        color,
        fontSize: 30,
        fontWeight: 900,
        letterSpacing: '0.04em',
        background: 'rgba(10,14,20,0.55)',
        boxShadow: `0 0 34px ${color}55`,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  )
}

/**
 * One book of the return: a vertical lane. `fillTo` is how far it fills; a
 * lane with `empty` stays a dashed ghost — the return reached it or it did not.
 */
function Lane({
  t,
  at,
  x,
  label,
  value,
  fillTo,
  delay,
  color,
  empty = false,
}: {
  t: number
  at: number
  x: number
  label: string
  value: number
  fillTo: number
  delay: number
  color: string
  empty?: boolean | undefined
}) {
  const entered = pop(t, at, 0.75)
  const fillP = ease(clamp(progress(t, delay, 1.9)))
  const level = mix(0, fillTo, fillP)
  const columnTop = 352
  const floor = 616
  // Level measured inside the wrapper's own origin (layout-defect-laws band 5).
  const liquidY = floor - columnTop - level
  return (
    <div
      style={{
        position: 'absolute',
        top: columnTop,
        insetInlineStart: x - 58,
        width: 116,
        height: floor - columnTop,
        opacity: clamp(entered * 1.6),
        transform: `translateY(${mix(16, 0, entered).toFixed(1)}px)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          border: empty ? `1.6px dashed rgba(239,231,214,0.34)` : `1.6px solid ${color}88`,
          background: 'rgba(8,12,18,0.6)',
          boxShadow: 'inset 0 8px 24px rgba(2,5,8,0.6)',
          overflow: 'hidden',
        }}
      />
      {!empty && (
        <div
          style={{
            position: 'absolute',
            top: liquidY,
            bottom: 0,
            insetInlineStart: 0,
            insetInlineEnd: 0,
            background: `linear-gradient(180deg, ${color}55, ${color}18)`,
            borderTop: `2px solid ${color}`,
            borderRadius: '0 0 13px 13px',
            boxShadow: `0 0 22px ${color}44`,
          }}
        />
      )}
      {empty && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            insetInlineStart: 0,
            insetInlineEnd: 0,
            transform: 'translateY(-50%)',
            textAlign: 'center',
            fontSize: 26,
            fontWeight: 900,
            color: 'rgba(239,231,214,0.3)',
          }}
        >
          —
        </div>
      )}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: -54,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 16,
          fontWeight: 900,
          color: empty ? 'rgba(239,231,214,0.5)' : color,
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
        <div style={{ marginTop: 4 }}>
          {empty ? (
            <span style={{ fontSize: 17, color: 'rgba(239,231,214,0.4)' }}>{faNumber(0)}</span>
          ) : (
            <Roll t={t} at={delay + 0.3} value={value} color={color} size={18} />
          )}
        </div>
      </div>
    </div>
  )
}

const LANE_X = [110, 270, 430]

/** The trial-balance beam: tilts while the books disagree, levels at 0°. */
function Beam({
  t,
  at,
  tiltTo,
  settleAt,
  y = 430,
}: {
  t: number
  at: number
  tiltTo: number
  settleAt: number
  y?: number | undefined
}) {
  const inP = pop(t, at, 0.8)
  const settle = ease(clamp(progress(t, settleAt, 2.0)))
  const tilt = mix(tiltTo, 0, settle)
  const panLift = Math.sin((tilt * Math.PI) / 180) * 118
  return (
    <div
      style={{
        position: 'absolute',
        top: y - 150,
        insetInlineStart: 0,
        insetInlineEnd: 0,
        height: 320,
        opacity: clamp(inP * 1.6),
      }}
    >
      <svg
        viewBox="0 0 540 320"
        style={{ position: 'absolute', inset: 0, width: 540, height: 320, overflow: 'visible' }}
      >
        {/* stand */}
        <path
          d="M 270 150 L 270 258"
          stroke="rgba(239,231,214,0.4)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M 214 262 L 326 262"
          stroke="rgba(239,231,214,0.4)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* beam */}
        <g transform={`rotate(${tilt.toFixed(2)} 270 150)`}>
          <path d="M 76 150 L 464 150" stroke={AMBER} strokeWidth="4" strokeLinecap="round" />
          <circle cx="270" cy="150" r="9" fill={AMBER} />
          <path d="M 76 150 L 76 214" stroke="rgba(240,180,41,0.65)" strokeWidth="2.5" />
          <path d="M 464 150 L 464 214" stroke="rgba(240,180,41,0.65)" strokeWidth="2.5" />
          <path
            d="M 34 214 L 118 214 L 104 250 L 48 250 Z"
            fill="rgba(240,180,41,0.18)"
            stroke={AMBER}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M 422 214 L 506 214 L 492 250 L 436 250 Z"
            fill="rgba(251,113,133,0.14)"
            stroke="rgba(251,113,133,0.75)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>
        <circle
          cx="270"
          cy="150"
          r={26 + panLift * 0.05}
          fill="none"
          stroke="rgba(240,180,41,0.18)"
        />
      </svg>
    </div>
  )
}

// ─── Scene 1 (0–5.5s) — Frame 0: the carton is already coming back ─────────

export function ReturnArrivesScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  return (
    <ReturnStage scene={scene} t={t}>
      <CounterSurface opacity={clamp(progress(t, 0.1, 1.2))} />
      <Carton t={t} />
      <Stamp t={t} at={2.9} text="برگشت" color={ROSE} y={300} />
      <Words
        t={t}
        cueAt={0.35}
        words={['جنس', 'برگشت،']}
        y={214}
        size={40}
        accentWord="برگشت،"
        accentColor={ROSE}
      />
    </ReturnStage>
  )
}

// ─── Scene 2 (5.5–12.5s) — Only the stock lane fills; the other two stay empty ─

export function StockOnlyScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  return (
    <ReturnStage scene={scene} t={t}>
      <Lane
        t={t}
        at={0.2}
        x={LANE_X[0]!}
        label="انبار"
        value={RETURN_COST}
        fillTo={196}
        delay={0.7}
        color={MINT}
      />
      <Lane
        t={t}
        at={0.45}
        x={LANE_X[1]!}
        label="دفتر"
        value={0}
        fillTo={0}
        delay={0.9}
        color={AMBER}
        empty
      />
      <Lane
        t={t}
        at={0.7}
        x={LANE_X[2]!}
        label="طلب"
        value={0}
        fillTo={0}
        delay={1.1}
        color={ROSE}
        empty
      />
      <Words
        t={t}
        cueAt={3.2}
        words={['فقط', 'انبار']}
        y={196}
        size={36}
        accentWord="انبار"
        accentColor={MINT}
      />
    </ReturnStage>
  )
}

// ─── Scene 3 (12.5–19.5s) — The books never heard about it ─────────────────

export function BooksDontMoveScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const gap = pop(t, 3.0, 0.8)
  return (
    <ReturnStage scene={scene} t={t}>
      <Beam t={t} at={0.2} tiltTo={9} settleAt={99} y={392} />
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 690,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          opacity: clamp(gap * 1.5),
          transform: `translateY(${mix(14, 0, gap).toFixed(1)}px)`,
        }}
      >
        <div
          style={{
            background: 'rgba(10,14,20,0.9)',
            border: `2px solid ${ROSE}`,
            borderRadius: 16,
            padding: '10px 26px',
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
            boxShadow: `0 16px 50px rgba(2,5,8,0.7), 0 0 36px ${ROSE}44`,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 900, color: ROSE, letterSpacing: '0.08em' }}>
            مغایرت
          </span>
          <Roll t={t} at={3.4} value={RETURN_TOTAL} color={PAPER} size={30} />
        </div>
      </div>
      <Words
        t={t}
        cueAt={0.5}
        words={['دفتر،', 'تکان', 'نخورد']}
        y={196}
        size={36}
        accentWord="نخورد"
        accentColor={ROSE}
      />
    </ReturnStage>
  )
}

// ─── Scene 4 (19.5–27.5s) — One document, three effects, one beat ───────────

export function AtomicReturnScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const dropIn = pop(t, 0.15, 0.6)
  const docY = mix(-80, 168, dropIn)
  const splitAt = 1.5
  const split = ease(clamp(progress(t, splitAt, 0.9)))
  return (
    <ReturnStage scene={scene} t={t}>
      <Lane
        t={t}
        at={0.1}
        x={LANE_X[0]!}
        label="انبار"
        value={RETURN_COST}
        fillTo={196}
        delay={2.3}
        color={MINT}
      />
      <Lane
        t={t}
        at={0.1}
        x={LANE_X[1]!}
        label="دفتر"
        value={RETURN_COST}
        fillTo={196}
        delay={2.3}
        color={AMBER}
      />
      <Lane
        t={t}
        at={0.1}
        x={LANE_X[2]!}
        label="طلب"
        value={RETURN_TOTAL}
        fillTo={196}
        delay={2.3}
        color={ROSE}
      />
      {/* the document itself */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: docY,
          insetInlineStart: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(160deg, #f6efdd, #ddd2b8)',
          color: '#241d10',
          borderRadius: 8,
          padding: '8px 26px',
          fontSize: 22,
          fontWeight: 900,
          boxShadow: '0 18px 44px rgba(2,5,8,0.65)',
          whiteSpace: 'nowrap',
        }}
      >
        سند مرجوعی
      </div>
      {/* three connectors: one document splits into three effects */}
      <svg
        viewBox="0 0 540 400"
        style={{
          position: 'absolute',
          top: 180,
          inset: 0,
          width: 540,
          height: 400,
          overflow: 'visible',
        }}
      >
        {LANE_X.map((x, i) => (
          <path
            key={x}
            d={`M 270 8 C 270 ${60 + i * 8}, ${x} 60, ${x} 150`}
            fill="none"
            stroke={[MINT, AMBER, ROSE][i]}
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity={0.85}
            {...strokeDraw(t, splitAt + i * 0.12, 0.9, 340)}
          />
        ))}
        <circle cx="270" cy="8" r={5 + split * 4} fill={AMBER} opacity={clamp(split * 1.4)} />
      </svg>
      <Words
        t={t}
        cueAt={3.1}
        words={['یک', 'سند،', 'سه', 'اثر']}
        y={704}
        size={34}
        accentWord="سه"
        accentColor={MINT}
      />
    </ReturnStage>
  )
}

// ─── Scene 5 (27.5–34.5s) — Level again: the trial balance holds ────────────

const BALANCE_ROWS = [
  { label: 'انبار', value: RETURN_COST, at: 2.2, color: MINT, sign: '+' },
  { label: 'بهای', value: RETURN_COST, at: 2.6, color: AMBER, sign: '−' },
  { label: 'طلب', value: RETURN_TOTAL, at: 3.0, color: ROSE, sign: '−' },
]

export function BalancedScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const level = pop(t, 1.2, 1.0)
  return (
    <ReturnStage scene={scene} t={t}>
      <Beam t={t} at={0.1} tiltTo={0} settleAt={1.2} y={352} />
      {BALANCE_ROWS.map((row, i) => {
        const entered = pop(t, row.at, 0.7)
        const yFinal = 610 + i * 62
        return (
          <div
            key={row.label}
            dir="rtl"
            style={{
              position: 'absolute',
              top: mix(yFinal + 90, yFinal, entered),
              insetInlineStart: 64,
              width: 412,
              background: 'rgba(10,14,20,0.9)',
              border: `1.5px solid ${row.color}aa`,
              borderRadius: 12,
              padding: '8px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              opacity: clamp(entered * 1.6),
              boxShadow: `0 12px 34px rgba(2,5,8,0.6)`,
            }}
          >
            <span
              style={{ fontSize: 15, fontWeight: 900, color: row.color, letterSpacing: '0.08em' }}
            >
              {row.label}
            </span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 17, fontWeight: 900, color: row.color }}>{row.sign}</span>
              <Roll t={t} at={row.at + 0.35} value={row.value} color={PAPER} size={21} />
            </span>
          </div>
        )
      })}
      {/* the hold: stamp lands 1.6s before the scene ends and stays at 100% */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 244,
          insetInlineStart: '50%',
          transform: `translateX(-50%) rotate(-4deg) scale(${mix(1.8, 1, level).toFixed(3)})`,
          opacity: clamp(level * 2),
          border: `3px solid ${MINT}`,
          borderRadius: 10,
          padding: '5px 24px',
          color: MINT,
          fontSize: 28,
          fontWeight: 900,
          background: 'rgba(10,14,20,0.55)',
          boxShadow: `0 0 34px ${MINT}55`,
          whiteSpace: 'nowrap',
        }}
      >
        تراز
      </div>
    </ReturnStage>
  )
}

// ─── Scene 6 (34.5–40.5s) — End card: mark, promise, CTA ────────────────────

export function ReturnCtaScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  const lock = pop(t, 0.2, 0.8)
  const cta = pop(t, 0.85, 0.7)
  const breathe = 1 + 0.03 * Math.sin(t * 2.2)
  return (
    <ReturnStage scene={scene} t={t}>
      {/* the mark: a document sealing three lanes, drawn small */}
      <div
        style={{
          position: 'absolute',
          top: 232,
          insetInlineStart: '50%',
          transform: `translateX(-50%) scale(${mix(0.6, 1, lock).toFixed(3)})`,
          opacity: clamp(lock * 1.6),
          width: 96,
          height: 96,
          borderRadius: 24,
          background: 'linear-gradient(150deg, rgba(240,180,41,0.28), rgba(74,222,128,0.18))',
          border: `2px solid ${AMBER}`,
          boxShadow: `0 0 48px ${AMBER}66`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg viewBox="0 0 48 48" style={{ width: 52, height: 52 }}>
          <path d="M 12 8 L 36 8 L 36 40 L 12 40 Z" fill="none" stroke={PAPER} strokeWidth="2.5" />
          <path d="M 17 18 L 31 18" stroke={MINT} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 17 25 L 31 25" stroke={AMBER} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 17 32 L 31 32" stroke={ROSE} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 358,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 62,
          fontWeight: 900,
          color: PAPER,
          textShadow: `0 0 54px rgba(240,180,41,0.45)`,
          opacity: clamp(lock * 1.6),
          transform: `translateY(${mix(12, 0, lock).toFixed(1)}px)`,
        }}
      >
        حسابچه
      </div>
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 452,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 21,
          fontWeight: 800,
          color: 'rgba(239,231,214,0.82)',
          opacity: clamp(cta * 1.4),
        }}
      >
        مرجوعی، یک سند
      </div>
      {/* CTA pill: in by 0.85s, full opacity to the end (>= 3s hold) */}
      <div
        style={{
          position: 'absolute',
          top: 552,
          insetInlineStart: '50%',
          transform: `translateX(-50%) scale(${Number(mix(0.4, 1, cta).toFixed(3)) * breathe})`,
          opacity: clamp(cta * 1.7),
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${AMBER}, ${MINT})`,
            color: '#0b1410',
            fontSize: 29,
            fontWeight: 900,
            padding: '14px 52px',
            borderRadius: 999,
            boxShadow: `0 24px 60px rgba(2,5,8,0.72), 0 0 44px rgba(240,180,41,0.5)`,
            whiteSpace: 'nowrap',
          }}
        >
          شروع رایگان
        </div>
      </div>
      <div
        dir="ltr"
        style={{
          position: 'absolute',
          top: 650,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
          fontSize: 15,
          letterSpacing: '0.24em',
          color: 'rgba(239,231,214,0.72)',
          opacity: clamp(cta * 1.3),
        }}
      >
        hisabche.com
      </div>
    </ReturnStage>
  )
}
