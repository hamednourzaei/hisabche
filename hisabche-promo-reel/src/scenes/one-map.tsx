// ============================================
// Reel #109 — «نقشه‌ی یکپارچه‌ی کسبوکار» (The One Workspace)
//
// COMPLETE DESIGN REFACTOR — a medium never used in this series before:
// a letterpress type foundry. No product-UI glass, no dashboards, no cards.
// The four disagreeing answers are heavy movable TYPE BLOCKS (brass, steel,
// lead) on a foundry bed. They slide, collide, cast one solid glyph, stamp
// five records, interlock into one mechanical bar, and finally lock into a
// single line of type that prints the brand: حسابچه.
//
// Design intent: the difference between «چهار عدد پراکنده» and «یک سطح»
// is expressed by MATERIAL and WEIGHT, not by a layout diagram. Type is the
// story: heavy, carved, warm, physical. Light rakes across metal; nothing
// zooms; the press moves, the camera never does.
//
//   1. four carved answers, one question
//   2. they collide and cast into one brass glyph
//   3. one invoice plate presses five records
//   4. the five records interlock into one bar
//   5. everything locks into one line of movable type
//   6. the brand curtain: حسابچه
//
// Guardrails: ≤ 6 on-stage words, 24px+ margins, no decorative divider,
// no camera zoom, no currency names, no fake amounts (bars, never invented
// money), faNumber digits only, deterministic scene-clock math.
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, enter, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

// ─── Tokens ─────────────────────────────────────────────────────────────────

const FOUNDRY = '#0b0d10'
const BRASS = '#c9a05e'
const BRASS_HI = '#e8c78d'
const STEEL = '#8e9aa6'
const AMBER = '#f0b45a'
const MOLTEN = '#ff9a54'
const MINT = '#4fe0a6'
const IVORY = '#e9e3d6'
const MONO = "'JetBrains Mono', 'Vazirmatn', monospace"
const FA = "'Vazirmatn', -apple-system, sans-serif"

type Metal = 'brass' | 'steel' | 'lead'

const FACES: Record<Metal, readonly [string, string]> = {
  brass: ['#d8b57a', '#7b5f34'],
  steel: ['#aab6c1', '#4a5560'],
  lead: ['#77818b', '#373f48'],
}

export type SceneProps = { t: number; scene: Scene }

// ─── Stage: the foundry bed ─────────────────────────────────────────────────

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
        backgroundColor: FOUNDRY,
        color: IVORY,
        fontFamily: FA,
        backgroundImage:
          'radial-gradient(110% 62% at 12% -8%, rgba(232,199,141,0.10) 0%, rgba(232,199,141,0) 56%), radial-gradient(90% 44% at 88% 112%, rgba(79,224,166,0.05) 0%, rgba(79,224,166,0) 62%)',
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
          color: 'rgba(139,143,152,0.34)',
          pointerEvents: 'none',
        }}
      >
        FOUNDRY / ONE WORKSPACE // HISABCHE
      </div>
    </div>
  )
}

// ─── A single piece of movable type ─────────────────────────────────────────

function TypeBlock({
  style,
  children,
  tone = 'brass',
  lit = false,
}: {
  style: CSSProperties
  children?: ReactNode
  tone?: Metal
  lit?: boolean | undefined
}) {
  const [hi, lo] = FACES[tone]
  return (
    <div
      style={{
        position: 'absolute',
        borderRadius: 7,
        background: `linear-gradient(145deg, ${hi} 0%, ${lo} 100%)`,
        border: '1px solid rgba(255, 255, 255, 0.20)',
        boxShadow: lit
          ? 'inset 0 1px 0 rgba(255,255,255,0.42), 0 18px 38px rgba(0,0,0,0.66), 0 0 34px rgba(240,180,90,0.20)'
          : 'inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -3px 0 rgba(0,0,0,0.35), 0 16px 32px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 9,
          width: 4,
          height: 4,
          borderRadius: '50%',
          backgroundColor: 'rgba(0,0,0,0.45)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 9,
          width: 4,
          height: 4,
          borderRadius: '50%',
          backgroundColor: 'rgba(0,0,0,0.45)',
        }}
      />
    </div>
  )
}

/** The carved face of a type block: monotone, engraved, never a floating label. */
function Glyph({
  text,
  size = 58,
  color = IVORY,
  persian = false,
}: {
  text: string
  size?: number
  color?: string
  persian?: boolean
}) {
  return (
    <div
      dir={persian ? 'rtl' : 'ltr'}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: persian ? FA : MONO,
        fontSize: size,
        fontWeight: 900,
        color,
        letterSpacing: persian ? '-0.01em' : '-0.04em',
        lineHeight: 1,
        textShadow: '0 1px 0 rgba(255,255,255,0.20), 0 -1px 2px rgba(0,0,0,0.72)',
      }}
    >
      {text}
    </div>
  )
}

function Bar({ w, h = 7, tone = 0.16 }: { w: number; h?: number; tone?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: h / 2,
        backgroundColor: `rgba(233,227,214,${tone})`,
      }}
    />
  )
}

function Dot({ size = 8, color = MINT }: { size?: number; color?: string }) {
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

function Check({ size = 16, color = MINT }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 12.6 9.6 17.6 19.5 7.2"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** One raking light sweep: the foundry's only atmospheric movement. */
function RakingLight({
  t,
  at,
  left,
  width,
  height,
}: {
  t: number
  at: number
  left: number
  width: number
  height: number
}) {
  const p = ease(clamp(progress(t, at, 0.9)))
  return (
    <div
      style={{
        position: 'absolute',
        top: -20,
        left: mix(-160, width + 60, p) - left,
        width: 120,
        height: height + 40,
        transform: 'skewX(-16deg)',
        background:
          'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0) 100%)',
        opacity: clamp(progress(t, at, 0.2)),
        pointerEvents: 'none',
      }}
    />
  )
}

// ─── Scene 1: Four carved answers to one question (0.00–5.50s) ──────────────

const ANSWERS = [faNumber(12), faNumber(18), faNumber(9), '؟'] as const
const BLOCKS = [
  { x: 56, y: 250, tone: 'brass' as Metal, tilt: -1.4 },
  { x: 286, y: 250, tone: 'steel' as Metal, tilt: 1.1 },
  { x: 56, y: 440, tone: 'lead' as Metal, tilt: 0.9 },
  { x: 286, y: 440, tone: 'brass' as Metal, tilt: -1.2 },
] as const

export function FourAnswersScene({ t }: SceneProps) {
  const stylus = ease(clamp(progress(t, 3.5, 0.8)))
  return (
    <Stage>
      {/* the question is a block of its own, dressed from frame zero */}
      <TypeBlock
        tone="brass"
        style={{ top: 104, left: 188, width: 164, height: 64, transform: 'rotate(-0.6deg)' }}
      >
        <Glyph text="سود؟" size={32} persian />
      </TypeBlock>

      {BLOCKS.map((block, i) => {
        const pop = spring(clamp(progress(t, 0.16 + i * 0.12, 0.8)))
        const shake = Math.sin((t - 1.4) * 3.1 + i * 1.6) * 1.2 * clamp(progress(t, 1.4, 0.6))
        return (
          <TypeBlock
            key={i}
            tone={block.tone}
            lit={i === 3}
            style={{
              top: block.y,
              left: block.x,
              width: 200,
              height: 160,
              transform: `rotate(${block.tilt}deg) translate(${(1 - pop) * 6}px, ${(1 - pop) * 18 + shake}px) scale(${mix(0.9, 1, pop)})`,
              opacity: clamp(progress(t, 0.16 + i * 0.12, 0.3)),
            }}
          >
            <Glyph text={ANSWERS[i]} size={70} color={i === 3 ? AMBER : IVORY} />
          </TypeBlock>
        )
      })}

      {/* the compositor's brass stylus finds the unknown answer */}
      <div
        style={{
          position: 'absolute',
          top: 556,
          left: mix(486, 344, stylus),
          width: 92,
          height: 6,
          borderRadius: 3,
          background: `linear-gradient(90deg, ${BRASS_HI}, ${BRASS})`,
          transform: `rotate(${mix(-14, -3, stylus)}deg)`,
          opacity: clamp(progress(t, 3.2, 0.3)),
          boxShadow: '0 6px 14px rgba(0,0,0,0.5)',
        }}
      />
    </Stage>
  )
}

// ─── Scene 2: The four answers are cast into one (5.50–12.00s) ──────────────

export function MergeToOneScene({ t }: SceneProps) {
  const cast = spring(clamp(progress(t, 1.15, 0.9)))
  const molten = Math.sin(Math.PI * clamp(progress(t, 0.9, 1.5)))
  return (
    <Stage>
      {BLOCKS.map((block, i) => {
        const p = ease(clamp(progress(t, 0.1 + i * 0.06, 0.95)))
        const cx = block.x + 100
        const cy = block.y + 80
        return (
          <TypeBlock
            key={i}
            tone={block.tone}
            style={{
              top: block.y,
              left: block.x,
              width: 200,
              height: 160,
              transform: `translate(${(270 - cx) * p}px, ${(420 - cy) * p}px) rotate(${block.tilt * (1 - p)}deg) scale(${1 - 0.86 * p})`,
              opacity: 1 - p,
            }}
          >
            <Glyph text={ANSWERS[i]} size={70} color={i === 3 ? AMBER : IVORY} />
          </TypeBlock>
        )
      })}

      {/* the molten seams of one casting */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: 334,
            left: 196 + i * 58,
            width: 3,
            height: 172,
            borderRadius: 2,
            background: `linear-gradient(180deg, rgba(255,154,84,0) 0%, ${MOLTEN} 50%, rgba(255,154,84,0) 100%)`,
            opacity: molten * 0.8,
            pointerEvents: 'none',
          }}
        />
      ))}

      <TypeBlock
        tone="brass"
        lit
        style={{
          top: 332,
          left: 152,
          width: 236,
          height: 176,
          transform: `scale(${mix(0.9, 1, cast)})`,
          opacity: clamp(progress(t, 1.15, 0.3)),
        }}
      >
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 14,
            right: 16,
            padding: '4px 11px',
            borderRadius: 4,
            border: `1px solid ${MINT}55`,
            background: 'rgba(79,224,166,0.12)',
            opacity: clamp(progress(t, 3.0, 0.35)),
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 800, color: MINT }}>یکجا</span>
        </div>
        <Glyph
          text={faNumber(Math.round(mix(0, 24, ease(clamp(progress(t, 2.0, 1.2))))))}
          size={78}
          color={IVORY}
        />
        <RakingLight t={t} at={3.3} left={152} width={236} height={176} />
      </TypeBlock>
    </Stage>
  )
}

// ─── Scene 3: One invoice plate stamps five records (12.00–19.00s) ──────────

export const FIVE_DOMAINS = ['انبار', 'صندوق', 'دفتر', 'طلب', 'سود'] as const

export function InvoiceFanoutScene({ t }: SceneProps) {
  const press = clamp(progress(t, 1.0, 0.1))
  const release = clamp(progress(t, 1.1, 0.35))
  const impact = press * (1 - release)
  const stamped = clamp(progress(t, 1.0, 0.25))
  return (
    <Stage>
      {/* the invoice is one brass plate, never a spreadsheet */}
      <TypeBlock
        tone="brass"
        style={{
          top: 152,
          left: 64,
          width: 412,
          height: 106,
          transform: `translateY(${-12 * impact}px)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 28,
            fontFamily: MONO,
            fontSize: 40,
            fontWeight: 800,
            color: IVORY,
            letterSpacing: '-0.03em',
          }}
        >
          {faNumber(1042)}
        </div>
        <div
          style={{
            position: 'absolute',
            top: 34,
            left: 154,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <Bar w={164} h={8} tone={0.22} />
          <Bar w={104} h={8} tone={0.14} />
        </div>
        <div
          style={{
            position: 'absolute',
            top: 26,
            right: 26,
            width: 52,
            height: 52,
            borderRadius: '50%',
            border: `2px solid ${stamped > 0 ? MINT : 'rgba(233,227,214,0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${mix(0.7, 1, spring(clamp(progress(t, 1.0, 0.6))))})`,
          }}
        >
          {stamped > 0 && <Check size={24} />}
        </div>
      </TypeBlock>

      {/* five impressions pushed out from under the plate */}
      {FIVE_DOMAINS.map((_, i) => {
        const out = spring(clamp(progress(t, 1.28 + i * 0.14, 0.7)))
        return (
          <TypeBlock
            key={i}
            tone="steel"
            style={{
              top: 300 + i * 66,
              left: 96,
              width: 348,
              height: 52,
              transform: `translateX(${(1 - out) * -26}px)`,
              opacity: mix(0.25, 1, clamp(progress(t, 1.28 + i * 0.14, 0.3))),
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '0 16px',
              }}
            >
              <Dot size={8} />
              <Bar w={124} h={7} tone={0.24} />
              <Bar w={64} h={7} tone={0.14} />
              <div style={{ flex: 1 }} />
              <Check size={16} />
            </div>
          </TypeBlock>
        )
      })}
    </Stage>
  )
}

// ─── Scene 4: Five records interlock into one bar (19.00–26.00s) ────────────

export function SystemMapScene({ t }: SceneProps) {
  const travel = ease(clamp(progress(t, 3.0, 1.3)))
  return (
    <Stage>
      {/* a single mechanical spine, only beneath the type row */}
      <div
        style={{
          position: 'absolute',
          top: 520,
          left: 34,
          width: 478,
          height: 4,
          borderRadius: 2,
          background: 'rgba(201,160,94,0.22)',
          opacity: clamp(progress(t, 1.6, 0.6)),
        }}
      />

      {FIVE_DOMAINS.map((label, i) => {
        const lock = spring(clamp(progress(t, 0.25 + i * 0.1, 0.7)))
        return (
          <TypeBlock
            key={label}
            tone={i % 2 === 0 ? 'brass' : 'steel'}
            lit={t >= 2.6}
            style={{
              top: 412 + (i % 2 === 0 ? -14 : 14) * (1 - lock),
              left: 34 + i * 96,
              width: 88,
              height: 96,
              transform: `translateY(${(1 - lock) * (i % 2 === 0 ? -40 : 40)}px)`,
              opacity: clamp(progress(t, 0.25 + i * 0.1, 0.3)),
            }}
          >
            <div
              dir="rtl"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 900, color: IVORY }}>{label}</span>
            </div>
            {/* interlocking tabs */}
            {i < 4 && (
              <div
                style={{
                  position: 'absolute',
                  top: 44,
                  right: -7,
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: i % 2 === 0 ? BRASS : STEEL,
                  opacity: clamp(progress(t, 2.2, 0.4)),
                }}
              />
            )}
          </TypeBlock>
        )
      })}

      {/* the mint pulse travels along the one locked bar */}
      <div
        style={{
          position: 'absolute',
          top: 432,
          left: mix(40, 460, travel),
          width: 72,
          height: 56,
          borderRadius: 12,
          background: `radial-gradient(circle, ${MINT}44 0%, rgba(79,224,166,0) 70%)`,
          opacity: clamp(progress(t, 3.0, 0.3)) * 0.9,
          pointerEvents: 'none',
        }}
      />
    </Stage>
  )
}

// ─── Scene 5: Everything locks into one line of type (26.00–33.00s) ─────────

export function OneScreenScene({ t }: SceneProps) {
  const plate = ease(clamp(progress(t, 2.2, 0.7)))
  return (
    <Stage>
      {/* the press plate comes down once */}
      <TypeBlock
        tone="brass"
        style={{
          top: 184,
          left: 42,
          width: 456,
          height: 60,
          transform: `translateY(${mix(-36, 0, plate)}px)`,
          opacity: clamp(progress(t, 0.4, 0.4)),
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 24,
            right: 24,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Bar w={126} h={8} tone={0.24} />
          <Bar w={76} h={8} tone={0.16} />
          <Bar w={98} h={8} tone={0.12} />
        </div>
      </TypeBlock>

      {/* the three numbers a person reads — one line, one plate */}
      {['فروش', 'طلب', 'سود'].map((label, i) => (
        <TypeBlock
          key={label}
          tone={i === 2 ? 'brass' : 'steel'}
          lit={i === 2 && t >= 2.4}
          style={{
            top: 300,
            left: 52 + i * 152,
            width: 132,
            height: 132,
            ...enter(t, 0.6 + i * 0.12, { y: 16, scale: 0.95 }),
          }}
        >
          <div
            dir="rtl"
            style={{
              position: 'absolute',
              top: 16,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 21, fontWeight: 800, color: IVORY }}>{label}</span>
          </div>
          <div
            style={{
              position: 'absolute',
              top: 66,
              left: 20,
              right: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <Bar w={92} h={9} tone={0.26} />
            <Bar w={58} h={9} tone={0.16} />
          </div>
        </TypeBlock>
      ))}

      {/* the single impression — one surface, one result */}
      <div
        style={{
          position: 'absolute',
          top: 474,
          left: 52,
          width: 436,
          height: 6,
          borderRadius: 3,
          background: MINT,
          opacity: clamp(progress(t, 2.4, 0.5)) * 0.85,
          boxShadow: `0 0 24px ${MINT}55`,
        }}
      />
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 520,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: clamp(progress(t, 2.8, 0.4)),
        }}
      >
        <span style={{ fontSize: 25, fontWeight: 800, color: MINT }}>همزمان</span>
      </div>
    </Stage>
  )
}

// ─── Scene 6: The brand curtain — one engraved name (33.00–42.00s) ──────────

export function BrandCurtainScene({ t }: SceneProps) {
  const bloom = clamp(progress(t, 0.1, 2.4))
  const brand = enter(t, 0.45, { y: 22 })
  const tagline = enter(t, 1.35, { y: 12 })
  const domain = enter(t, 2.45, { y: 10 })
  return (
    <Stage>
      <div
        style={{
          position: 'absolute',
          top: 470,
          left: 270,
          width: mix(320, 500, bloom),
          height: mix(320, 500, bloom),
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(232,199,141,0.16) 0%, rgba(232,199,141,0) 68%)`,
          opacity: 0.5 + 0.08 * Math.sin(t * 0.8),
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      <div
        dir="rtl"
        style={{
          ...tagline,
          position: 'absolute',
          top: 316,
          left: 270,
          transform: 'translate(-50%, -50%)',
          fontSize: 28,
          fontWeight: 800,
          color: BRASS_HI,
          whiteSpace: 'nowrap',
        }}
      >
        از جامع، به حسابچه
      </div>

      <TypeBlock
        tone="brass"
        lit
        style={{
          ...brand,
          top: 388,
          left: 66,
          width: 408,
          height: 164,
        }}
      >
        <Glyph text="حسابچه" size={82} persian color={IVORY} />
        <RakingLight t={t} at={0.8} left={66} width={408} height={164} />
      </TypeBlock>

      <div
        style={{
          ...domain,
          position: 'absolute',
          top: 610,
          left: 270,
          transform: 'translate(-50%, -50%)',
          fontFamily: MONO,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '0.3em',
          color: IVORY,
        }}
      >
        HISABCHE.COM
      </div>
    </Stage>
  )
}
