// ============================================
// Paper-Pocket Art Direction (Reel 84) — World-Class SaaS Motion
// Tactile Dark Micro-Ledger & Titanium Pocket Cockpit
//
// Palette: Dark Carbon Obsidian (#08090f), Electric Royal Blue (#2962FF),
// Mint Emerald (#00E676), Crimson Alert (#FF3D00), Amber (#FFB800)
// High-depth 3D perspective, zero hold-frame overlap,
// strict physical container-local coordinates, 100% dark studio theme.
// ============================================

import { useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

const DARK = '#08090f'
export const BLUE = '#2962FF'
const EMERALD = '#00E676'
export const RED = '#FF3D00'
const AMBER = '#FFB800'
const WHITE = '#ffffff'
const BORDER_GLASS = 'rgba(255, 255, 255, 0.08)'

// Backward compatibility exports
export const PAPER = DARK
export const INK = WHITE

const MONO: CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
  direction: 'ltr',
}

export type SceneComponentProps = { t: number; scene: Scene }

/** Spring pop helper */
const pop = (t: number, at: number, dur = 0.55): number =>
  spring(clamp(progress(t, at, at + dur), 0, 1) * 1.12)

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function Timecode({ t }: { t: number }) {
  const frames = Math.max(0, Math.floor(t * 30))
  const ss = Math.floor(frames / 30) % 60
  const mm = Math.floor(frames / (30 * 60))
  const ff = frames % 30
  return (
    <span style={MONO}>
      {pad2(mm)}:{pad2(ss)}:{pad2(ff)}
    </span>
  )
}

/** Root Dark Paper Stage: strictly LTR pinned with dark micro-texture */
export function PaperStage({
  scene,
  t,
  label,
  children,
}: {
  scene: Scene
  t: number
  label: string
  children: ReactNode
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 20%, #111526 0%, #08090f 70%, #030406 100%)',
        overflow: 'hidden',
        color: '#ffffff',
        direction: 'ltr',
      }}
    >
      {/* Dark micro-grid texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage:
            'linear-gradient(rgba(41, 98, 255, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(41, 98, 255, 0.4) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      {/* Top HUD */}
      <div
        style={{
          ...MONO,
          position: 'absolute',
          top: 24,
          left: 28,
          fontSize: 12,
          letterSpacing: '0.12em',
          color: BLUE,
          opacity: 0.85,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: BLUE,
            boxShadow: `0 0 10px ${BLUE}`,
          }}
        />
        {label}
      </div>
      <div
        style={{
          ...MONO,
          position: 'absolute',
          top: 24,
          right: 28,
          fontSize: 12,
          color: 'rgba(255, 255, 255, 0.5)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <Timecode t={scene.start + t} />
      </div>

      {children}
    </div>
  )
}

type Word = { text: string; accent?: boolean; color?: string }

/** Clean Staggered Headline in Safe Zone */
export function Words({
  t,
  at,
  words,
  size = 42,
  top,
}: {
  t: number
  at: number
  words: Word[]
  size?: number
  top: number
}) {
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 28px',
        zIndex: 10,
      }}
    >
      {words.map((w, i) => {
        const p = pop(t, at + i * 0.1)
        const accentBg = w.color || BLUE
        return (
          <span
            key={`${w.text}-${i}`}
            style={{
              fontSize: size,
              fontWeight: 900,
              lineHeight: 1.25,
              transform: `translateY(${mix(20, 0, p).toFixed(1)}px) scale(${mix(0.85, 1, p).toFixed(3)})`,
              opacity: clamp(p * 1.5),
              background: w.accent ? accentBg : 'transparent',
              color: w.accent ? '#ffffff' : '#ffffff',
              padding: w.accent ? '4px 18px' : 0,
              borderRadius: w.accent ? 14 : 0,
              boxShadow: w.accent ? `0 0 25px ${accentBg}66` : 'none',
              border: w.accent ? `1px solid rgba(255,255,255,0.3)` : 'none',
            }}
          >
            {w.text}
          </span>
        )
      })}
    </div>
  )
}

export type Mood = 'worried' | 'dizzy' | 'calm' | 'happy'

/**
 * World-Class SaaS Production Persona (Linear/Stripe fintech caliber)
 * Strictly vector gradients, no comic dots.
 */
export function SaaSProductionPersona({
  t,
  mood,
  phone = false,
  scale = 1,
  style,
}: {
  t: number
  mood: Mood
  phone?: boolean
  scale?: number
  style?: CSSProperties
}) {
  const uid = useId().replace(/:/g, '')
  const blinkPhase = t % 3.6
  const eyeRy = blinkPhase < 0.12 ? 1.0 : 6.5
  const breathe = Math.sin(t * 2.2) * 2.5
  const dizzyShake = mood === 'dizzy' ? Math.sin(t * 16) * 3 : 0
  const mouth =
    mood === 'happy'
      ? 'M104,118 Q120,132 136,118'
      : mood === 'worried'
        ? 'M106,122 Q120,112 134,122'
        : 'M108,118 H132'

  return (
    <svg
      viewBox="0 0 240 300"
      width={240 * scale}
      height={300 * scale}
      style={{
        display: 'block',
        overflow: 'visible',
        filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.8))',
        ...style,
      }}
      aria-hidden
    >
      <defs>
        <radialGradient id={`head-${uid}`} cx="45%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#2c3345" />
          <stop offset="60%" stopColor="#161a25" />
          <stop offset="100%" stopColor="#0a0d14" />
        </radialGradient>
        <linearGradient id={`torso-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e2436" />
          <stop offset="50%" stopColor="#131722" />
          <stop offset="100%" stopColor="#080a10" />
        </linearGradient>
        <linearGradient id={`rim-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
          <stop offset="50%" stopColor="rgba(41, 98, 255, 0.3)" />
          <stop offset="100%" stopColor="rgba(0, 230, 118, 0.1)" />
        </linearGradient>
      </defs>

      <g transform={`translate(${dizzyShake.toFixed(2)} ${breathe.toFixed(2)})`}>
        {/* Torso */}
        <path
          d="M56,290 C56,200 78,154 120,154 C162,154 184,200 184,290 Z"
          fill={`url(#torso-${uid})`}
          stroke={`url(#rim-${uid})`}
          strokeWidth="1.5"
        />

        {/* Neck */}
        <rect x="108" y="132" width="24" height="26" rx="8" fill="#131722" />

        {/* Head */}
        <circle
          cx="120"
          cy="96"
          r="48"
          fill={`url(#head-${uid})`}
          stroke={`url(#rim-${uid})`}
          strokeWidth="1.5"
        />

        {/* Specular Rim */}
        <path
          d="M84,74 A48,48 0 0,1 156,74"
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Cap / Modern hair contour */}
        <path
          d="M72,92 C72,66 92,50 120,50 C148,50 168,66 168,92 C162,76 146,62 120,62 C94,62 78,76 72,92 Z"
          fill="#0c0e14"
        />

        {/* Eyes */}
        <g>
          <ellipse cx="104" cy="94" rx="5" ry={eyeRy} fill="#ffffff" />
          <ellipse cx="136" cy="94" rx="5" ry={eyeRy} fill="#ffffff" />
          {eyeRy > 3 && (
            <>
              <circle cx="105" cy="93" r="2.2" fill={BLUE} />
              <circle cx="137" cy="93" r="2.2" fill={BLUE} />
            </>
          )}
        </g>

        {/* Mouth */}
        <path d={mouth} fill="none" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" />

        {/* Micro-Status Telemetry Pin */}
        {mood === 'worried' && (
          <g transform="translate(152 44)">
            <rect
              x="0"
              y="0"
              width="44"
              height="20"
              rx="10"
              fill="rgba(255, 61, 0, 0.2)"
              stroke={RED}
              strokeWidth="1.2"
            />
            <circle cx="10" cy="10" r="3" fill={RED} />
            <path
              d="M22,6 L26,14 L32,6"
              fill="none"
              stroke={RED}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
        )}
        {mood === 'happy' && (
          <g transform="translate(152 44)">
            <rect
              x="0"
              y="0"
              width="44"
              height="20"
              rx="10"
              fill="rgba(0, 230, 118, 0.2)"
              stroke={EMERALD}
              strokeWidth="1.2"
            />
            <circle cx="10" cy="10" r="3" fill={EMERALD} />
            <path
              d="M22,10 L26,14 L32,7"
              fill="none"
              stroke={EMERALD}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* OLED Handheld Phone Mockup */}
        {phone && (
          <g transform="translate(160 110)">
            <rect
              x="6"
              y="-8"
              width="44"
              height="74"
              rx="10"
              fill="#080a10"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1.5"
            />
            <rect x="9" y="-5" width="38" height="68" rx="7" fill="#0c101a" />
            <path
              d="M14,36 L21,28 L27,32 L35,20 L40,24"
              fill="none"
              stroke={BLUE}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="40" cy="24" r="2.5" fill={EMERALD} />
          </g>
        )}
      </g>
    </svg>
  )
}

export const HalftoneCharacter = SaaSProductionPersona

// ─── Scene 1 — Hook: Frame-0 Arrest ─────────────────────────────────────

export function PaperHookScene({ t, scene }: SceneComponentProps) {
  const q = pop(t, 0.05)
  const ledgerP = pop(t, 0.3)

  return (
    <PaperStage scene={scene} t={t} label="// 01 · توقف در دفتر دستی">
      {/* Background Volumetric Watermark */}
      <div
        style={{
          position: 'absolute',
          top: 320,
          left: '50%',
          transform: `translate(-50%, -50%) scale(${mix(0.7, 1, q).toFixed(3)})`,
          fontSize: 400,
          fontWeight: 900,
          color: BLUE,
          opacity: 0.07,
          userSelect: 'none',
        }}
      >
        ?
      </div>

      <Words
        t={t}
        at={0.15}
        top={140}
        words={[{ text: 'دفترت' }, { text: 'هنوز' }, { text: 'دستیه؟', accent: true, color: BLUE }]}
        size={50}
      />

      {/* Massive Dark Embossed Ledger Object (Guaranteed safe center y: 320..540) */}
      <div
        style={{
          position: 'absolute',
          top: 320,
          left: '50%',
          width: 320,
          height: 220,
          marginLeft: -160,
          background: 'linear-gradient(145deg, #161b2b, #0d101a)',
          borderRadius: 24,
          border: `2px solid ${RED}`,
          boxShadow: `0 30px 80px rgba(0,0,0,0.8), 0 0 35px ${RED}33`,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transform: `scale(${mix(0.8, 1, ledgerP).toFixed(3)})`,
          opacity: clamp(ledgerP * 1.5),
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              ...MONO,
              fontSize: 12,
              background: `${RED}22`,
              color: RED,
              border: `1px solid ${RED}`,
              padding: '3px 10px',
              borderRadius: 6,
              fontWeight: 800,
            }}
          >
            MANUAL LEDGER
          </span>
          <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            دفتر کاغذی مغازه
          </span>
        </div>

        {/* Fraying manual lines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: 0.5 }}>
          <div style={{ height: 8, width: '85%', background: '#ffffff', borderRadius: 4 }} />
          <div style={{ height: 8, width: '60%', background: '#ffffff', borderRadius: 4 }} />
          <div style={{ height: 8, width: '75%', background: '#ffffff', borderRadius: 4 }} />
        </div>

        <div
          dir="rtl"
          style={{
            background: 'rgba(255, 61, 0, 0.15)',
            border: `1px dashed ${RED}`,
            borderRadius: 12,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 800,
            color: RED,
            textAlign: 'center',
          }}
        >
          خطای مغایرت و محاسبه دستی
        </div>
      </div>

      {/* Modern SaaS Persona below (safe y: 580..860) */}
      <div
        style={{
          position: 'absolute',
          top: 570,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <SaaSProductionPersona t={t} mood="worried" scale={0.95} />
      </div>
    </PaperStage>
  )
}

// ─── Scene 2 — Chaos: Four Fragmented Truths ────────────────────────────

const CHAOS_TOOLS = [
  { text: 'فایل اکسل', num: 380000, color: AMBER, x: 36, y: 220 },
  { text: 'دفتر کاغذی', num: 420000, color: BLUE, x: 284, y: 220 },
  { text: 'ماشین‌حساب', num: 415000, color: RED, x: 36, y: 400 },
  { text: 'پیامک بانک', num: 405000, color: '#00B4FF', x: 284, y: 400 },
]

export function PaperChaosScene({ t, scene }: SceneComponentProps) {
  const centerWarningP = pop(t, 1.2)

  return (
    <PaperStage scene={scene} t={t} label="// 02 · چهار عدد متفاوت">
      <Words
        t={t}
        at={0.1}
        top={130}
        words={[
          { text: 'هرکدام' },
          { text: 'عددی' },
          { text: 'می‌گویند!', accent: true, color: RED },
        ]}
        size={44}
      />

      {/* Disjoint 2x2 Grid (Safe coordinate bands: x 36..256 and 284..504; y 220..380 and 400..560) */}
      {CHAOS_TOOLS.map((tool, i) => {
        const p = pop(t, 0.3 + i * 0.12)
        const count = mix(0, tool.num, ease(clamp(progress(t, 0.4 + i * 0.12, 1.6))))
        return (
          <div
            key={tool.text}
            style={{
              position: 'absolute',
              top: tool.y,
              left: tool.x,
              width: 220,
              height: 154,
              background: 'linear-gradient(145deg, #131724, #0b0e16)',
              border: `1.5px solid ${tool.color}`,
              borderRadius: 20,
              boxShadow: `0 15px 40px rgba(0,0,0,0.7), 0 0 20px ${tool.color}22`,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              opacity: clamp(p * 1.5),
              transform: `scale(${mix(0.85, 1, p).toFixed(3)})`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: tool.color,
                  boxShadow: `0 0 10px ${tool.color}`,
                }}
              />
              <span dir="rtl" style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>
                {tool.text}
              </span>
            </div>

            <div
              style={{
                ...MONO,
                fontSize: 26,
                fontWeight: 900,
                color: tool.color,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {faNumber(Math.round(count))}
            </div>

            <div
              dir="rtl"
              style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}
            >
              رقم گزارش شده در پایان روز
            </div>
          </div>
        )
      })}

      {/* Center Discrepancy Pill (y: 600..710) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 600,
          left: 40,
          right: 40,
          background: 'rgba(255, 61, 0, 0.12)',
          border: `1.5px solid ${RED}`,
          borderRadius: 20,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: `0 20px 50px rgba(0,0,0,0.8), 0 0 30px ${RED}33`,
          opacity: clamp(centerWarningP * 1.5),
          transform: `scale(${mix(0.85, 1, centerWarningP).toFixed(3)})`,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: RED,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: 20,
          }}
        >
          !
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            اختلاف حساب غیرقابل ردیابی
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
            کدام عدد سود واقعی شماست؟ هیچ‌کس نمی‌داند!
          </div>
        </div>
      </div>
    </PaperStage>
  )
}

// ─── Scene 3 — Morph: Four Cards Become One Ledger ──────────────────────

export function PaperMorphScene({ t, scene }: SceneComponentProps) {
  const morphP = ease(clamp(progress(t, 0.4, 2.0)))
  const unifiedP = pop(t, 2.0, 0.6)

  return (
    <PaperStage scene={scene} t={t} label="// 03 · تجمیع در یک دفتر">
      <Words
        t={t}
        at={0.1}
        top={140}
        words={[{ text: 'همه' }, { text: 'در' }, { text: 'یک‌جا', accent: true, color: BLUE }]}
        size={48}
      />

      {/* Converging Shards */}
      {CHAOS_TOOLS.map((tool) => (
        <div
          key={tool.text}
          style={{
            position: 'absolute',
            top: mix(tool.y, 420, morphP),
            left: mix(tool.x, 270 - 110, morphP),
            width: mix(220, 20, morphP),
            height: mix(154, 20, morphP),
            background: tool.color,
            borderRadius: mix(20, 10, morphP),
            opacity: 1 - morphP * 0.9,
          }}
        />
      ))}

      {/* The One True Unified Ledger Card (y: 340..580) */}
      <div
        style={{
          position: 'absolute',
          top: 340,
          left: '50%',
          width: 340,
          height: 240,
          marginLeft: -170,
          background: 'linear-gradient(145deg, #131a30, #0a0e1c)',
          border: `2px solid ${BLUE}`,
          borderRadius: 28,
          boxShadow: `0 35px 90px rgba(0,0,0,0.9), 0 0 50px ${BLUE}44`,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transform: `scale(${mix(0.6, 1, unifiedP).toFixed(3)})`,
          opacity: clamp(unifiedP * 1.5),
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              ...MONO,
              fontSize: 12,
              background: `${BLUE}22`,
              color: BLUE,
              border: `1px solid ${BLUE}`,
              padding: '4px 12px',
              borderRadius: 8,
              fontWeight: 800,
            }}
          >
            SINGLE SOURCE OF TRUTH
          </span>
          <span dir="rtl" style={{ fontSize: 24, fontWeight: 900, color: '#ffffff' }}>
            حسابچه
          </span>
        </div>

        <div dir="rtl" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: EMERALD }}>
            دفتر مالی یکپارچه و هوشمند
          </div>
          <div
            style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}
          >
            فروش · انبار · مشتری · سود در یک دیتابیس
          </div>
        </div>

        <div
          style={{
            ...MONO,
            fontSize: 28,
            fontWeight: 900,
            color: '#ffffff',
            textAlign: 'center',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: 12,
          }}
        >
          {faNumber(420000)}
        </div>
      </div>
    </PaperStage>
  )
}

// ─── Scene 4 — Product Reveal: The Wordmark ─────────────────────────────

export function PaperRevealScene({ t, scene }: SceneComponentProps) {
  const markP = pop(t, 0.1)
  const lineP = ease(clamp(progress(t, 0.6, 1.6)))

  return (
    <PaperStage scene={scene} t={t} label="// 04 · معرفی محصول">
      <div
        style={{
          position: 'absolute',
          top: 280,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: clamp(markP * 1.5),
          transform: `scale(${mix(0.8, 1, markP).toFixed(3)})`,
        }}
      >
        <div
          dir="rtl"
          style={{
            fontSize: 88,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            textShadow: `0 10px 40px ${BLUE}66`,
          }}
        >
          حسابچه
        </div>

        {/* Dynamic Specular Laser Bar */}
        <div
          style={{
            width: mix(0, 260, lineP),
            height: 6,
            background: `linear-gradient(90deg, ${BLUE}, ${EMERALD})`,
            borderRadius: 3,
            boxShadow: `0 0 20px ${BLUE}`,
            marginTop: 12,
          }}
        />

        <div
          dir="rtl"
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: 'rgba(255,255,255,0.85)',
            marginTop: 24,
          }}
        >
          نرم‌افزار مالی ابری مغازه و کارگاه
        </div>

        <div
          style={{
            ...MONO,
            fontSize: 13,
            letterSpacing: '0.2em',
            color: BLUE,
            marginTop: 12,
          }}
        >
          ACCURATE · CLOUD-NATIVE · FAST
        </div>
      </div>

      {/* Relaxed Confident Merchant Persona below */}
      <div
        style={{
          position: 'absolute',
          bottom: 110,
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: clamp(progress(t, 0.8, 1.4)),
        }}
      >
        <SaaSProductionPersona t={t} mood="happy" scale={1.05} />
      </div>
    </PaperStage>
  )
}

// ─── Scene 5 — The Dashboard: 4 Cards, 1 Screen ─────────────────────────

const DASH_METRICS = [
  { label: 'فروش روزانه', val: 420000, color: BLUE, x: 36, y: 220, sub: '۱۸ فاکتور صادره' },
  { label: 'موجودی انبار', val: 73, color: '#00B4FF', x: 284, y: 220, sub: 'اقلام بدون کسری' },
  { label: 'مشتریان فعال', val: 26, color: AMBER, x: 36, y: 400, sub: 'ثبت در باشگاه' },
  { label: 'سود ناخالص', val: 90000, color: EMERALD, x: 284, y: 400, sub: 'محاسبه لحظه‌ای' },
]

export function PaperGridScene({ t, scene }: SceneComponentProps) {
  return (
    <PaperStage scene={scene} t={t} label="// 05 · صفحه داشبورد زنده">
      <Words
        t={t}
        at={0.1}
        top={130}
        words={[{ text: 'همه‌چیز،' }, { text: 'یک‌جا', accent: true, color: BLUE }]}
        size={46}
      />

      {/* 2x2 Clean Dashboard Grid */}
      {DASH_METRICS.map((metric, i) => {
        const p = pop(t, 0.3 + i * 0.12)
        const count = mix(0, metric.val, ease(clamp(progress(t, 0.4 + i * 0.12, 1.6))))
        return (
          <div
            key={metric.label}
            style={{
              position: 'absolute',
              top: metric.y,
              left: metric.x,
              width: 220,
              height: 154,
              background: 'linear-gradient(145deg, #121626, #0b0e18)',
              border: `1.5px solid ${metric.color}`,
              borderRadius: 20,
              boxShadow: `0 20px 45px rgba(0,0,0,0.7), 0 0 25px ${metric.color}22`,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              opacity: clamp(p * 1.5),
              transform: `scale(${mix(0.85, 1, p).toFixed(3)})`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: metric.color,
                  boxShadow: `0 0 10px ${metric.color}`,
                }}
              />
              <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
                {metric.label}
              </span>
            </div>

            <div
              style={{
                ...MONO,
                fontSize: 28,
                fontWeight: 900,
                color: metric.color,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {faNumber(Math.round(count))}
            </div>

            <div
              dir="rtl"
              style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}
            >
              {metric.sub}
            </div>
          </div>
        )
      })}

      {/* Bottom Telemetry Status Bar */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 600,
          left: 36,
          right: 36,
          background: 'rgba(18, 22, 38, 0.85)',
          border: `1.5px solid ${BORDER_GLASS}`,
          borderRadius: 18,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
          دفتر آنلاین همیشه در دسترس و همگام
        </span>
        <span style={{ ...MONO, fontSize: 12, color: EMERALD, fontWeight: 800 }}>LIVE FEED</span>
      </div>
    </PaperStage>
  )
}

// ─── Scene 6 — Phone Mockup: Live Stock Offline ─────────────────────────

const STOCK_ROWS = [
  { name: 'کالای بازرگانی کد ۱۰۱', qty: 24 },
  { name: 'محصول استاندارد کد ۲۰۲', qty: 12 },
  { name: 'کالای مصرفی کد ۳۰۳', qty: 37 },
]

export function PaperPhoneScene({ t, scene }: SceneComponentProps) {
  const up = pop(t, 0.2, 0.7)
  const badge = pop(t, 1.4)

  return (
    <PaperStage scene={scene} t={t} label="// 06 · انبار در جیب و آفلاین">
      <Words
        t={t}
        at={0.1}
        top={110}
        words={[
          { text: 'موجودی' },
          { text: 'زنده،' },
          { text: 'آفلاین', accent: true, color: EMERALD },
        ]}
        size={42}
      />

      {/* Titanium Mobile Cockpit: Strictly container-local coordinates (Defect Law #8) */}
      <div
        style={{
          position: 'absolute',
          top: 190,
          left: '50%',
          width: 320,
          height: 520,
          marginLeft: -160,
          background: '#0a0d16',
          border: '4px solid #1f2538',
          borderRadius: 44,
          boxShadow: `0 35px 90px rgba(0,0,0,0.9), 0 0 45px ${BLUE}22`,
          overflow: 'hidden',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          opacity: clamp(up * 1.5),
          transform: `translateY(${mix(60, 0, up).toFixed(1)}px)`,
          direction: 'ltr',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              ...MONO,
              fontSize: 11,
              background: `${EMERALD}22`,
              color: EMERALD,
              borderRadius: 6,
              padding: '3px 8px',
              fontWeight: 800,
            }}
          >
            OFFLINE READY
          </span>
          <span dir="rtl" style={{ fontSize: 18, fontWeight: 900, color: '#ffffff' }}>
            کاردکس انبار
          </span>
        </div>

        {/* Stock Rows */}
        {STOCK_ROWS.map((row, i) => {
          const p = pop(t, 0.6 + i * 0.16)
          const qty = mix(0, row.qty, ease(clamp(progress(t, 0.8 + i * 0.16, 2.0))))
          return (
            <div
              key={row.name}
              dir="rtl"
              style={{
                background: 'linear-gradient(145deg, #131726, #0e121e)',
                border: `1px solid ${BORDER_GLASS}`,
                borderRadius: 14,
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: clamp(p * 1.5),
                transform: `translateX(${mix(-20, 0, p).toFixed(1)}px)`,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>{row.name}</span>
              <span
                style={{
                  ...MONO,
                  fontSize: 18,
                  fontWeight: 900,
                  color: BLUE,
                }}
              >
                {faNumber(Math.round(qty))}
              </span>
            </div>
          )
        })}

        {/* Local Sync Status */}
        <div
          dir="rtl"
          style={{
            marginTop: 'auto',
            background: 'rgba(0, 230, 118, 0.08)',
            border: `1px solid ${EMERALD}44`,
            borderRadius: 14,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ color: EMERALD, fontSize: 16 }}>✓</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#ffffff' }}>
            همگام‌سازی ابری پس از اتصال
          </span>
        </div>
      </div>

      {/* Offline Assurance Badge (y: 740..840) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 740,
          left: 40,
          right: 40,
          background: 'rgba(15, 20, 35, 0.9)',
          border: `1.5px solid ${EMERALD}`,
          borderRadius: 20,
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          boxShadow: `0 20px 45px rgba(0,0,0,0.8), 0 0 25px ${EMERALD}33`,
          opacity: clamp(badge * 1.5),
          transform: `scale(${mix(0.85, 1, badge).toFixed(3)})`,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: EMERALD }} />
        <span style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
          حتی بدون اینترنت هم فاکتور ثبت می‌شود
        </span>
      </div>
    </PaperStage>
  )
}

// ─── Scene 7 — Sales → Profit: The Real Number ──────────────────────────

const BARS = [0.3, 0.52, 0.78, 1]

export function PaperProfitScene({ t, scene }: SceneComponentProps) {
  const draw = ease(clamp(progress(t, 0.6, 2.2)))
  const profit = mix(0, 90000, ease(clamp(progress(t, 0.8, 2.4))))

  return (
    <PaperStage scene={scene} t={t} label="// 07 · سود واقعی مغازه">
      <Words
        t={t}
        at={0.1}
        top={120}
        words={[
          { text: 'سود،' },
          { text: 'از' },
          { text: 'دلِ', accent: true, color: EMERALD },
          { text: 'فروش' },
        ]}
        size={46}
      />

      {/* Bar Chart Container (y: 220..440) */}
      <div
        style={{
          position: 'absolute',
          top: 220,
          left: 60,
          right: 60,
          height: 220,
          display: 'flex',
          gap: 24,
          justifyContent: 'center',
          alignItems: 'flex-end',
        }}
      >
        {BARS.map((h, i) => {
          const p = ease(clamp(progress(t, 0.2 + i * 0.16, 1.0 + i * 0.16)))
          return (
            <div
              key={i}
              style={{
                width: 60,
                height: 200 * h * p,
                background:
                  i === BARS.length - 1
                    ? `linear-gradient(to top, ${EMERALD}, #00b35c)`
                    : `linear-gradient(to top, ${BLUE}, #1a40b8)`,
                borderRadius: '12px 12px 4px 4px',
                boxShadow: `0 10px 30px rgba(0,0,0,0.6)`,
              }}
            />
          )
        })}
      </div>

      {/* SVG Trendline */}
      <svg
        viewBox="0 0 360 220"
        style={{
          position: 'absolute',
          top: 220,
          left: '50%',
          width: 360,
          height: 220,
          marginLeft: -180,
          pointerEvents: 'none',
        }}
        aria-hidden
      >
        <path
          d="M20,180 L110,135 L200,85 L320,25"
          fill="none"
          stroke={EMERALD}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={400}
          strokeDashoffset={400 * (1 - draw)}
          filter="drop-shadow(0 0 10px rgba(0,230,118,0.8))"
        />
      </svg>

      {/* Formula & Calculated Profit Result (y: 490..740) */}
      <div
        style={{
          position: 'absolute',
          top: 490,
          left: 40,
          right: 40,
          background: 'linear-gradient(145deg, #121728, #0b0e18)',
          border: `1.5px solid ${EMERALD}`,
          borderRadius: 24,
          padding: 24,
          textAlign: 'center',
          boxShadow: `0 25px 60px rgba(0,0,0,0.8), 0 0 35px ${EMERALD}33`,
        }}
      >
        <div
          dir="rtl"
          style={{ fontSize: 16, fontWeight: 800, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}
        >
          سود قطعی این دوره
        </div>
        <div
          style={{
            ...MONO,
            fontSize: 54,
            fontWeight: 900,
            color: EMERALD,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {faNumber(Math.round(profit))}
        </div>
        <div
          style={{
            ...MONO,
            fontSize: 14,
            color: 'rgba(255,255,255,0.5)',
            marginTop: 10,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: 10,
          }}
        >
          ۴۲۰٬۰۰۰ − ۲۶۰٬۰۰۰ − ۷۰٬۰۰۰ = ۹۰٬۰۰۰
        </div>
      </div>
    </PaperStage>
  )
}

// ─── Scene 8 — Transformation: Chaos Wipes into Order ───────────────────

export function PaperTransformScene({ t, scene }: SceneComponentProps) {
  const wipe = ease(clamp(progress(t, 0.6, 2.2)))
  const bladeX = mix(40, 500, wipe)

  return (
    <PaperStage scene={scene} t={t} label="// 08 · تحول به یک سیستم منظم">
      <Words
        t={t}
        at={0.1}
        top={130}
        words={[{ text: 'از' }, { text: 'آشفتگی' }, { text: 'به‌نظم', accent: true, color: BLUE }]}
        size={46}
      />

      {/* Left Chamber: Old Chaos (0 to bladeX) */}
      <div
        style={{
          position: 'absolute',
          top: 220,
          left: 40,
          width: Math.max(0, bladeX - 40),
          height: 480,
          background: 'linear-gradient(135deg, rgba(255, 61, 0, 0.08), rgba(20, 10, 15, 0.95))',
          borderRadius: '24px 0 0 24px',
          border: `1.5px solid rgba(255, 61, 0, 0.3)`,
          borderRight: 'none',
          overflow: 'hidden',
          padding: 24,
        }}
      >
        <div dir="rtl" style={{ fontSize: 18, fontWeight: 900, color: RED, marginBottom: 16 }}>
          ثبت سنتی و جزیره‌ای
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: 0.5 }}>
          {['دوباره‌کاری فاکتور', 'کسری نامعلوم انبار', 'اختلاف نسیه با مشتری'].map((item, idx) => (
            <div
              key={idx}
              dir="rtl"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px dashed rgba(255, 61, 0, 0.4)',
                borderRadius: 12,
                padding: '12px 14px',
                fontSize: 13,
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              ✕ {item}
            </div>
          ))}
        </div>
      </div>

      {/* Right Chamber: Hisabche Order (bladeX to 500) */}
      <div
        style={{
          position: 'absolute',
          top: 220,
          left: bladeX,
          width: Math.max(0, 500 - bladeX),
          height: 480,
          background: 'linear-gradient(135deg, rgba(41, 98, 255, 0.08), rgba(10, 16, 28, 0.95))',
          borderRadius: '0 24px 24px 0',
          border: `1.5px solid rgba(41, 98, 255, 0.4)`,
          borderLeft: 'none',
          overflow: 'hidden',
          padding: 24,
        }}
      >
        <div dir="rtl" style={{ fontSize: 18, fontWeight: 900, color: BLUE, marginBottom: 16 }}>
          نظم خودکار حسابچه
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {['فروش ثبت شد', 'انبار کسر شد', 'سود معلوم شد'].map((item, idx) => (
            <div
              key={idx}
              dir="rtl"
              style={{
                background: 'rgba(41, 98, 255, 0.08)',
                border: '1px solid rgba(41, 98, 255, 0.3)',
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 14,
                fontWeight: 800,
                color: '#ffffff',
              }}
            >
              <span>{item}</span>
              <span style={{ color: EMERALD }}>✓</span>
            </div>
          ))}
        </div>
      </div>

      {/* Travelling Laser Blade */}
      <div
        style={{
          position: 'absolute',
          top: 200,
          left: bladeX - 2,
          width: 4,
          height: 520,
          background: `linear-gradient(to bottom, transparent, ${BLUE}, #ffffff, ${EMERALD}, transparent)`,
          boxShadow: `0 0 25px 6px ${BLUE}`,
        }}
      />
    </PaperStage>
  )
}

// ─── Scene 9 — Brand Lockup: The Name and Vision ────────────────────────

export function PaperBrandScene({ t, scene }: SceneComponentProps) {
  const markP = pop(t, 0.2)
  const lineP = ease(clamp(progress(t, 0.6, 1.4)))

  return (
    <PaperStage scene={scene} t={t} label="// 09 · نام و هویت حسابچه">
      <div
        style={{
          position: 'absolute',
          top: 260,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: clamp(markP * 1.5),
          transform: `scale(${mix(0.8, 1, markP).toFixed(3)})`,
        }}
      >
        <div
          dir="rtl"
          style={{
            fontSize: 84,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.02em',
          }}
        >
          حسابچه
        </div>

        <div
          style={{
            width: mix(0, 240, lineP),
            height: 6,
            background: `linear-gradient(90deg, ${BLUE}, ${EMERALD})`,
            borderRadius: 3,
            boxShadow: `0 0 20px ${BLUE}`,
            marginTop: 12,
          }}
        />

        <div
          style={{
            ...MONO,
            marginTop: 20,
            fontSize: 14,
            letterSpacing: '0.22em',
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          CLOUD · SIMPLE · FAST
        </div>
      </div>

      {/* Relaxed Persona with Handheld Mobile Phone */}
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <SaaSProductionPersona t={t} mood="happy" phone scale={1.15} />
      </div>
    </PaperStage>
  )
}

// ─── Scene 10 — High-Impact CTA ─────────────────────────────────────────

export function PaperCtaScene({ t, scene }: SceneComponentProps) {
  const blockP = pop(t, 0.3, 0.65)
  const subP = clamp(progress(t, 0.9, 1.5))

  return (
    <PaperStage scene={scene} t={t} label="// 10 · شروع رایگان">
      <div
        style={{
          position: 'absolute',
          top: 240,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div
          dir="rtl"
          style={{
            fontSize: 36,
            fontWeight: 900,
            color: 'rgba(255,255,255,0.9)',
            marginBottom: 24,
          }}
        >
          همین امروز شروع کن
        </div>

        {/* Primary Action Button */}
        <div
          dir="rtl"
          style={{
            background: `linear-gradient(135deg, ${BLUE}, #1040db)`,
            color: '#ffffff',
            fontSize: 54,
            fontWeight: 900,
            padding: '16px 72px',
            borderRadius: 28,
            boxShadow: `0 25px 70px ${BLUE}66, 0 0 35px ${BLUE}44`,
            border: '2px solid rgba(255,255,255,0.4)',
            transform: `scale(${mix(0.6, 1, blockP).toFixed(3)})`,
            opacity: clamp(blockP * 1.5),
          }}
        >
          شروع رایگان
        </div>

        <div
          dir="rtl"
          style={{
            marginTop: 36,
            fontSize: 26,
            fontWeight: 800,
            color: 'rgba(255,255,255,0.8)',
            opacity: subP,
            transform: `translateY(${mix(20, 0, subP).toFixed(1)}px)`,
          }}
        >
          کلمه <span style={{ color: BLUE }}>«دفتر»</span> را کامنت کن تا لینک بگیری
        </div>
      </div>

      {/* Confident Persona below */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: clamp(progress(t, 0.6, 1.2)),
        }}
      >
        <SaaSProductionPersona t={t} mood="happy" scale={0.9} />
      </div>
    </PaperStage>
  )
}
