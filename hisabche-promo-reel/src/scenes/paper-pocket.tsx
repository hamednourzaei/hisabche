// ============================================
// Paper-Pocket art direction (reel 84) — a light, print-like stage:
// warm paper background, halftone black-and-white character, royal-blue
// accent, mono corner labels with a running timecode, neo-brutalist white
// cards with hard offset shadows. Inspired by the Pocketsflow reference:
// frame-0 arrest, one focal element per beat, motion carries the story.
// ============================================

import { useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

export const PAPER = '#f2efe6'
export const INK = '#16150f'
export const BLUE = '#1f4dff'
export const RED = '#e5432c'

const MONO: CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
  direction: 'ltr',
}

export type SceneComponentProps = { t: number; scene: Scene }

/** Spring pop-in: 0 before `at`, overshoots, settles at 1. */
const pop = (t: number, at: number, dur = 0.55): number =>
  spring(clamp(progress(t, at, at + dur), 0, 1) * 1.15)

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function Timecode({ t }: { t: number }) {
  const frames = Math.max(0, Math.floor(t * 30))
  const ss = Math.floor(frames / 30) % 60
  const mm = Math.floor(frames / (30 * 60))
  const ff = frames % 30
  return (
    <span>
      {pad2(mm)}:{pad2(ss)}:{pad2(ff)}
    </span>
  )
}

/** The opaque paper canvas: covers the dark engine backdrop, carries the
 *  mono HUD (scene label, running reel timecode, wordmark). */
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
        background: PAPER,
        overflow: 'hidden',
        color: INK,
      }}
    >
      {/* paper grain */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.055,
          backgroundImage: `radial-gradient(${INK} 0.7px, transparent 0.7px)`,
          backgroundSize: '7px 7px',
        }}
      />
      {/* soft vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(120% 90% at 50% 45%, transparent 62%, rgba(22,21,15,0.10))`,
        }}
      />
      {/* HUD */}
      <div
        style={{
          ...MONO,
          position: 'absolute',
          top: 26,
          insetInlineStart: 28,
          fontSize: 15,
          letterSpacing: '0.08em',
          opacity: 0.72,
        }}
      >
        {label}
      </div>
      <div
        style={{
          ...MONO,
          position: 'absolute',
          top: 26,
          insetInlineEnd: 28,
          fontSize: 15,
          opacity: 0.72,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <Timecode t={scene.start + t} />
      </div>
      <div
        style={{
          ...MONO,
          position: 'absolute',
          bottom: 26,
          insetInlineEnd: 28,
          fontSize: 13,
          letterSpacing: '0.18em',
          opacity: 0.5,
        }}
      >
        HISABCHE
      </div>
      {children}
    </div>
  )
}

/** Slow virtual-camera push-in / drift applied inside a scene. */
function Cam({
  t,
  from = 1.05,
  to = 1,
  panY = 0,
  children,
}: {
  t: number
  from?: number
  to?: number
  panY?: number
  children: ReactNode
}) {
  const p = ease(clamp(progress(t, 0, 6)))
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: `scale(${mix(from, to, p).toFixed(4)}) translateY(${mix(panY, 0, p).toFixed(1)}px)`,
        transformOrigin: '50% 50%',
      }}
    >
      {children}
    </div>
  )
}

type Word = { text: string; accent?: boolean }

/** Staggered word-by-word headline entrance. */
export function Words({
  t,
  at,
  words,
  size = 46,
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
      style={{
        position: 'absolute',
        top,
        insetInlineStart: 0,
        insetInlineEnd: 0,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 34px',
      }}
    >
      {words.map((w, i) => {
        const p = pop(t, at + i * 0.09)
        return (
          <span
            key={`${w.text}-${i}`}
            style={{
              fontSize: size,
              fontWeight: 900,
              lineHeight: 1.28,
              transform: `translateY(${mix(26, 0, p).toFixed(1)}px) scale(${mix(0.86, 1, p).toFixed(3)})`,
              opacity: clamp(p * 1.4),
              background: w.accent ? BLUE : 'transparent',
              color: w.accent ? PAPER : INK,
              padding: w.accent ? '2px 16px' : 0,
              borderRadius: w.accent ? 12 : 0,
              boxShadow: w.accent ? `5px 5px 0 ${INK}` : 'none',
            }}
          >
            {w.text}
          </span>
        )
      })}
    </div>
  )
}

/** Neo-brutalist card: white paper, hard ink border, hard offset shadow. */
function BrutCard({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: `3px solid ${INK}`,
        borderRadius: 18,
        boxShadow: `6px 6px 0 ${INK}`,
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Halftone character (World-Class SaaS Production Persona) ────────────

export type Mood = 'worried' | 'dizzy' | 'calm' | 'happy'

/**
 * World-Class SaaS Production Persona (Stripe/Linear/Apple fintech caliber):
 * Volumetric 3D gradients, specular rims, aerodynamic tech apparel,
 * expressive eyelid dynamics, micro-status badges (amber alert / emerald check),
 * and high-craft OLED smart device.
 */
export function HalftoneCharacter({
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
  const blinkPhase = t % 3.4
  const eyeRy = blinkPhase < 0.14 ? 1.0 : 6.5
  const breathe = Math.sin(t * 2.2) * 2.2
  const dizzyShake = mood === 'dizzy' ? Math.sin(t * 14) * 2.5 : 0
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
        filter: 'drop-shadow(0 14px 28px rgba(0,0,0,0.45))',
        ...style,
      }}
      aria-hidden
    >
      <defs>
        {/* Head 3D volumetric radial gradient */}
        <radialGradient id={`head-${uid}`} cx="42%" cy="36%" r="58%">
          <stop offset="0%" stopColor="#3b4254" />
          <stop offset="50%" stopColor="#1e2330" />
          <stop offset="100%" stopColor="#0d1017" />
        </radialGradient>

        {/* Torso obsidian tech jacket gradient */}
        <linearGradient id={`torso-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#222838" />
          <stop offset="40%" stopColor="#151924" />
          <stop offset="100%" stopColor="#0a0d14" />
        </linearGradient>

        {/* Specular rim lighting */}
        <linearGradient id={`rim-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
          <stop offset="45%" stopColor="rgba(99,102,241,0.25)" />
          <stop offset="100%" stopColor="rgba(6,182,212,0.05)" />
        </linearGradient>

        {/* Cyber zip / accent glow */}
        <linearGradient id={`zip-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>

        {/* Floating status badge glow */}
        <filter id={`badgeGlow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="4"
            floodColor={mood === 'happy' ? '#10b981' : '#f59e0b'}
            floodOpacity="0.4"
          />
        </filter>
      </defs>

      <g transform={`translate(${dizzyShake.toFixed(2)} ${breathe.toFixed(2)})`}>
        {/* Ambient shadow underneath bust */}
        <ellipse cx="120" cy="286" rx="68" ry="12" fill="rgba(0,0,0,0.5)" filter="blur(6px)" />

        {/* Torso / Tech Hoodie with ergonomic curves */}
        <path
          d="M56,290 C56,200 78,154 120,154 C162,154 184,200 184,290 Z"
          fill={`url(#torso-${uid})`}
          stroke={`url(#rim-${uid})`}
          strokeWidth="1.5"
        />

        {/* Shoulder seam & interior depth */}
        <path
          d="M74,290 C76,212 90,178 120,178 C150,178 164,212 166,290"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1.2"
        />

        {/* Precision Cyber Collar / Zipper track */}
        <path
          d="M102,156 L120,184 L138,156"
          fill="none"
          stroke={`url(#zip-${uid})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="120" cy="186" r="3" fill="#06b6d4" />

        {/* Neck */}
        <rect
          x="108"
          y="132"
          width="24"
          height="26"
          rx="8"
          fill="#141822"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />

        {/* Head — 3D Volumetric Sphere */}
        <circle
          cx="120"
          cy="96"
          r="48"
          fill={`url(#head-${uid})`}
          stroke={`url(#rim-${uid})`}
          strokeWidth="1.5"
        />

        {/* Subtle Specular Rim Arch (Apple glassmorphism highlight) */}
        <path
          d="M84,74 A48,48 0 0,1 156,74"
          fill="none"
          stroke="rgba(255,255,255,0.42)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Sleek Modern Vector Hair / Cap sculpt */}
        <path
          d="M72,92 C72,66 92,50 120,50 C148,50 168,66 168,92 C162,76 146,62 120,62 C94,62 78,76 72,92 Z"
          fill="#0c0e14"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />

        {/* Eyes — High-craft vector almond pupils with glint */}
        <g>
          <ellipse cx="104" cy="94" rx="5" ry={eyeRy} fill="#ffffff" />
          <ellipse cx="136" cy="94" rx="5" ry={eyeRy} fill="#ffffff" />
          {eyeRy > 3 && (
            <>
              <circle cx="105" cy="93" r="2.2" fill="#06b6d4" />
              <circle cx="137" cy="93" r="2.2" fill="#06b6d4" />
              <circle cx="106" cy="92" r="0.8" fill="#ffffff" />
              <circle cx="138" cy="92" r="0.8" fill="#ffffff" />
            </>
          )}
        </g>

        {/* Eyebrows */}
        {mood === 'worried' || mood === 'dizzy' ? (
          <>
            <path
              d="M92,78 Q103,72 112,80"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M148,78 Q137,72 128,80"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <path
              d="M92,79 Q103,75 112,78"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M148,79 Q137,75 128,78"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Mouth */}
        <path d={mouth} fill="none" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" />

        {/* High-End Micro-Status Badge (replaces cheap comic sweat drop) */}
        {(mood === 'worried' || mood === 'dizzy') && (
          <g transform="translate(150 42)" filter={`url(#badgeGlow-${uid})`}>
            <rect
              x="0"
              y="0"
              width="46"
              height="22"
              rx="11"
              fill="rgba(245,158,11,0.22)"
              stroke="#f59e0b"
              strokeWidth="1.2"
            />
            <circle cx="10" cy="11" r="3" fill="#f59e0b">
              <animate
                attributeName="opacity"
                values="1;0.4;1"
                dur="1.2s"
                repeatCount="indefinite"
              />
            </circle>
            <path
              d="M22,7 L26,15 L32,7"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}

        {mood === 'happy' && (
          <g transform="translate(150 42)" filter={`url(#badgeGlow-${uid})`}>
            <rect
              x="0"
              y="0"
              width="46"
              height="22"
              rx="11"
              fill="rgba(16,185,129,0.22)"
              stroke="#10b981"
              strokeWidth="1.2"
            />
            <circle cx="10" cy="11" r="3" fill="#10b981" />
            <path
              d="M22,11 L26,15 L34,7"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}

        {/* Orbiting data rings for dizzy state */}
        {mood === 'dizzy' && (
          <g transform="translate(120 96)">
            <ellipse
              rx="58"
              ry="18"
              fill="none"
              stroke="rgba(6,182,212,0.4)"
              strokeWidth="1.2"
              strokeDasharray="6 8"
              transform={`rotate(${(t * 40) % 360})`}
            />
            <ellipse
              rx="54"
              ry="16"
              fill="none"
              stroke="rgba(99,102,241,0.3)"
              strokeWidth="1.2"
              strokeDasharray="4 6"
              transform={`rotate(${(-t * 35) % 360})`}
            />
          </g>
        )}

        {/* World-Class OLED Smartphone Mockup */}
        {phone && (
          <g transform="translate(162 108)">
            {/* Forearm angled upwards */}
            <path
              d="M-4,106 C12,88 20,68 20,44"
              fill="none"
              stroke={`url(#torso-${uid})`}
              strokeWidth="16"
              strokeLinecap="round"
            />
            {/* Titanium Smartphone Chasis */}
            <rect
              x="6"
              y="-10"
              width="44"
              height="76"
              rx="10"
              fill="#080a10"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="2"
            />
            {/* Screen bezel */}
            <rect x="9" y="-7" width="38" height="70" rx="7" fill="#0c101a" />
            {/* Notch / Dynamic Island */}
            <rect x="23" y="-5" width="10" height="3" rx="1.5" fill="rgba(255,255,255,0.4)" />
            {/* Micro Live Fintech Chart on Screen */}
            <path
              d="M13,38 L21,30 L27,34 L35,22 L41,26"
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="41" cy="26" r="2.5" fill="#10b981" />
            {/* Micro data cards */}
            <rect x="13" y="2" width="24" height="4" rx="2" fill="rgba(255,255,255,0.3)" />
            <rect x="13" y="10" width="16" height="3" rx="1.5" fill="rgba(255,255,255,0.15)" />
            <rect
              x="13"
              y="48"
              width="30"
              height="8"
              rx="3"
              fill="rgba(6,182,212,0.18)"
              stroke="#06b6d4"
              strokeWidth="0.8"
            />
            {/* Hand thumb wrap */}
            <circle
              cx="6"
              cy="30"
              r="5"
              fill="#1e2330"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />
          </g>
        )}
      </g>
    </svg>
  )
}

export const SaaSProductionPersona = HalftoneCharacter

// ─── Scene 1 — hook: frame-0 arrest ─────────────────────────────────────

export function PaperHookScene({ t, scene }: SceneComponentProps) {
  const q = pop(t, 0.05)
  return (
    <PaperStage scene={scene} t={t} label="// 01 — شروع">
      <Cam t={t} from={1.06} to={1}>
        {/* colossal question mark behind the character */}
        <div
          style={{
            position: 'absolute',
            top: 300,
            insetInlineStart: 0,
            insetInlineEnd: 0,
            textAlign: 'center',
            fontSize: 430,
            fontWeight: 900,
            lineHeight: 1,
            color: BLUE,
            opacity: 0.13,
            transform: `scale(${mix(0.6, 1, q).toFixed(3)}) rotate(${mix(-8, 0, q).toFixed(1)}deg)`,
          }}
        >
          ?
        </div>
        <Words
          t={t}
          at={0.15}
          top={168}
          words={[{ text: 'دفترت' }, { text: 'هنوز' }, { text: 'دستیه؟', accent: true }]}
          size={52}
        />
        <HalftoneCharacter
          t={t}
          mood="worried"
          scale={1.35}
          style={{
            position: 'absolute',
            bottom: 96,
            insetInlineStart: 0,
            insetInlineEnd: 0,
            margin: '0 auto',
            transform: `scale(${mix(0.7, 1, pop(t, 0.1)).toFixed(3)})`,
          }}
        />
      </Cam>
    </PaperStage>
  )
}

// ─── Scene 2 — chaos: four tools, four truths ───────────────────────────

const CHAOS_TOOLS = [
  { text: 'اکسل', dx: -150, dy: 330, rot: -9 },
  { text: 'دفتر', dx: 150, dy: 300, rot: 8 },
  { text: 'ماشین‌حساب', dx: -140, dy: 610, rot: 6 },
  { text: 'پیامک', dx: 145, dy: 640, rot: -7 },
]

export function PaperChaosScene({ t, scene }: SceneComponentProps) {
  return (
    <PaperStage scene={scene} t={t} label="// 02 — آشفتگی">
      <Cam t={t} from={1} to={1.05}>
        <Words
          t={t}
          at={0.1}
          top={148}
          words={[{ text: 'هرکدام' }, { text: 'عددی' }, { text: 'می‌گویند', accent: true }]}
          size={44}
        />
        {CHAOS_TOOLS.map((tool, i) => {
          const p = pop(t, 0.35 + i * 0.14)
          const jitter = Math.sin(t * 9 + i * 1.7) * 3
          const sway = Math.sin(t * 1.4 + i) * 5
          return (
            <BrutCard
              key={tool.text}
              style={{
                position: 'absolute',
                top: tool.dy,
                insetInlineStart: `calc(50% + ${tool.dx}px)`,
                transform: `translate(-50%, -50%) rotate(${tool.rot + jitter * 0.6}deg) translate(${sway}px, ${jitter}px) scale(${mix(0.4, 1, p).toFixed(3)})`,
                opacity: clamp(p * 1.5),
                width: tool.text.length > 6 ? 172 : 132,
              }}
            >
              <span style={{ fontSize: 24, fontWeight: 800 }}>{tool.text}</span>
              {i === 0 && (
                <span
                  style={{
                    ...MONO,
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#ffffff',
                    background: RED,
                    borderRadius: 8,
                    padding: '1px 9px',
                    marginTop: 4,
                  }}
                >
                  !
                </span>
              )}
            </BrutCard>
          )
        })}
        <HalftoneCharacter
          t={t}
          mood="dizzy"
          scale={0.92}
          style={{
            position: 'absolute',
            top: 400,
            insetInlineStart: 0,
            insetInlineEnd: 0,
            margin: '0 auto',
          }}
        />
      </Cam>
    </PaperStage>
  )
}

// ─── Scene 3 — morph: four cards become one ─────────────────────────────

export function PaperMorphScene({ t, scene }: SceneComponentProps) {
  const fly = ease(clamp(progress(t, 0.4, 1.9)))
  const cardP = pop(t, 2.1, 0.6)
  return (
    <PaperStage scene={scene} t={t} label="// 03 — اتحاد">
      <Words
        t={t}
        at={0.1}
        top={158}
        words={[{ text: 'همه' }, { text: 'در' }, { text: 'یک‌جا', accent: true }]}
        size={48}
      />
      {/* flying fragments converging to the center */}
      {CHAOS_TOOLS.map((tool) => (
        <div
          key={tool.text}
          style={{
            position: 'absolute',
            top: mix(tool.dy, 520, fly),
            insetInlineStart: `calc(50% + ${mix(tool.dx, 0, fly)}px)`,
            width: mix(tool.text.length > 6 ? 172 : 132, 10, fly),
            height: mix(78, 10, fly),
            border: `${mix(3, 0, fly)}px solid ${INK}`,
            borderRadius: mix(18, 4, fly),
            background: '#ffffff',
            transform: `translate(-50%, -50%) rotate(${mix(tool.rot, 0, fly)}deg)`,
            opacity: 1 - fly * fly,
          }}
        />
      ))}
      {/* the one card that survives */}
      <BrutCard
        style={{
          position: 'absolute',
          top: 460,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          margin: '0 auto',
          width: 250,
          height: 150,
          background: BLUE,
          transform: `translateY(-50%) scale(${mix(0.2, 1, cardP).toFixed(3)}) rotate(${mix(14, 0, cardP).toFixed(1)}deg)`,
          opacity: clamp(cardP * 2),
          boxShadow: `8px 8px 0 ${INK}`,
        }}
      >
        <span style={{ fontSize: 42, fontWeight: 900, color: PAPER }}>حسابچه</span>
        <span style={{ ...MONO, fontSize: 14, color: PAPER, opacity: 0.85 }}>ONE LEDGER</span>
      </BrutCard>
    </PaperStage>
  )
}

// ─── Scene 4 — product reveal: the wordmark ─────────────────────────────

export function PaperRevealScene({ t, scene }: SceneComponentProps) {
  const mark = pop(t, 0.1)
  const wipe = ease(clamp(progress(t, 0.55, 1.35)))
  return (
    <PaperStage scene={scene} t={t} label="// 04 — محصول">
      <div
        style={{
          position: 'absolute',
          top: 330,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            lineHeight: 1.1,
            transform: `scale(${mix(0.72, 1, mark).toFixed(3)})`,
            opacity: clamp(mark * 1.5),
          }}
        >
          حسابچه
        </div>
        {/* blue underline wipe */}
        <div
          style={{
            width: `${(wipe * 300).toFixed(0)}px`,
            height: 10,
            background: BLUE,
            borderRadius: 6,
            margin: '18px auto 0',
            boxShadow: `4px 4px 0 ${INK}`,
          }}
        />
        <div
          style={{
            marginTop: 26,
            fontSize: 30,
            fontWeight: 800,
            opacity: clamp(progress(t, 1.1, 1.7)),
          }}
        >
          نرم‌افزار مالی ابری
        </div>
      </div>
      <HalftoneCharacter
        t={t}
        mood="happy"
        scale={0.78}
        style={{
          position: 'absolute',
          bottom: 60,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          margin: '0 auto',
          opacity: clamp(progress(t, 0.8, 1.4)),
        }}
      />
    </PaperStage>
  )
}

// ─── Scene 5 — the dashboard: four cards, one grid ──────────────────────

const GRID_CARDS = [
  { label: 'فروش', value: 420000, blue: true },
  { label: 'فاکتور', value: 18, blue: false },
  { label: 'انبار', value: 73, blue: false },
  { label: 'مشتری', value: 26, blue: false },
]

export function PaperGridScene({ t, scene }: SceneComponentProps) {
  return (
    <PaperStage scene={scene} t={t} label="// 05 — صفحهٔ اصلی">
      <Cam t={t} from={1.04} to={1}>
        <Words
          t={t}
          at={0.1}
          top={148}
          words={[{ text: 'همه‌چیز،' }, { text: 'یک‌جا', accent: true }]}
          size={46}
        />
        <div
          style={{
            position: 'absolute',
            top: 320,
            insetInlineStart: 0,
            insetInlineEnd: 0,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 26,
            padding: '0 56px',
          }}
        >
          {GRID_CARDS.map((card, i) => {
            const p = pop(t, 0.35 + i * 0.12)
            const count = mix(0, card.value, ease(clamp(progress(t, 0.5 + i * 0.12, 1.9))))
            return (
              <BrutCard
                key={card.label}
                style={{
                  height: 168,
                  background: card.blue ? BLUE : '#ffffff',
                  transform: `translateY(${mix(60, 0, p).toFixed(1)}px) scale(${mix(0.8, 1, p).toFixed(3)}) rotate(${mix(-4 + i * 2, 0, p).toFixed(1)}deg)`,
                  opacity: clamp(p * 1.5),
                }}
              >
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 900,
                    color: card.blue ? PAPER : INK,
                  }}
                >
                  {card.label}
                </span>
                <span
                  style={{
                    ...MONO,
                    fontSize: 22,
                    fontWeight: 700,
                    color: card.blue ? PAPER : BLUE,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {faNumber(count)}
                </span>
              </BrutCard>
            )
          })}
        </div>
      </Cam>
    </PaperStage>
  )
}

// ─── Scene 6 — phone mockup: live stock, even offline ───────────────────

const STOCK_ROWS = [
  { name: 'کالای بازرگانی کد ۱۰۱', qty: 24 },
  { name: 'محصول استاندارد کد ۲۰۲', qty: 12 },
  { name: 'کالای مصرفی کد ۳۰۳', qty: 37 },
]

export function PaperPhoneScene({ t, scene }: SceneComponentProps) {
  const up = pop(t, 0.2, 0.7)
  const badge = pop(t, 1.6)
  return (
    <PaperStage scene={scene} t={t} label="// 06 — انبار در جیب">
      <Words
        t={t}
        at={0.1}
        top={128}
        words={[{ text: 'موجودی' }, { text: 'زنده،' }, { text: 'آفلاین', accent: true }]}
        size={42}
      />
      {/* phone */}
      <div
        style={{
          position: 'absolute',
          top: 300,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          margin: '0 auto',
          width: 272,
          height: 500,
          background: '#ffffff',
          border: `4px solid ${INK}`,
          borderRadius: 36,
          boxShadow: `10px 10px 0 ${INK}`,
          transform: `translateY(${mix(240, 0, up).toFixed(1)}px) rotate(${mix(6, 0, up).toFixed(1)}deg)`,
          opacity: clamp(up * 1.6),
          padding: '20px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 26, fontWeight: 900 }}>انبار</span>
          <span
            style={{
              ...MONO,
              fontSize: 13,
              background: BLUE,
              color: PAPER,
              borderRadius: 8,
              padding: '3px 10px',
            }}
          >
            LIVE
          </span>
        </div>
        {STOCK_ROWS.map((row, i) => {
          const p = pop(t, 0.8 + i * 0.18)
          const qty = mix(0, row.qty, ease(clamp(progress(t, 1.0 + i * 0.18, 2.3))))
          return (
            <div
              key={row.name}
              style={{
                border: `2.5px solid ${INK}`,
                borderRadius: 14,
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                transform: `translateX(${mix(-30, 0, p).toFixed(1)}px)`,
                opacity: clamp(p * 1.6),
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700 }}>{row.name}</span>
              <span
                style={{
                  ...MONO,
                  fontSize: 19,
                  fontWeight: 800,
                  color: BLUE,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {faNumber(qty)}
              </span>
            </div>
          )
        })}
      </div>
      {/* offline badge */}
      <BrutCard
        style={{
          position: 'absolute',
          bottom: 70,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          margin: '0 auto',
          background: INK,
          transform: `scale(${mix(0.4, 1, badge).toFixed(3)})`,
          opacity: clamp(badge * 1.6),
          padding: '10px 22px',
        }}
      >
        <span style={{ fontSize: 21, fontWeight: 800, color: PAPER }}>
          بدون اینترنت هم ثبت می‌شود
        </span>
      </BrutCard>
    </PaperStage>
  )
}

// ─── Scene 7 — sales → profit: the number that matters ──────────────────

const BARS = [0.3, 0.52, 0.78, 1]

export function PaperProfitScene({ t, scene }: SceneComponentProps) {
  const draw = ease(clamp(progress(t, 0.6, 2.4)))
  const profit = mix(0, 90000, ease(clamp(progress(t, 1.0, 2.8))))
  return (
    <PaperStage scene={scene} t={t} label="// 07 — سود">
      <Words
        t={t}
        at={0.1}
        top={132}
        words={[{ text: 'سود،' }, { text: 'از' }, { text: 'دلِ', accent: true }, { text: 'فروش' }]}
        size={46}
      />
      {/* bars + trend line */}
      <div
        style={{
          position: 'absolute',
          top: 320,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          height: 240,
          display: 'flex',
          gap: 22,
          justifyContent: 'center',
          alignItems: 'flex-end',
          padding: '0 70px',
        }}
      >
        {BARS.map((h, i) => {
          const p = ease(clamp(progress(t, 0.25 + i * 0.18, 1.1 + i * 0.18)))
          return (
            <div
              key={i}
              style={{
                width: 64,
                height: 230 * h * p,
                background: i === BARS.length - 1 ? BLUE : INK,
                borderRadius: '10px 10px 0 0',
                boxShadow: `5px 5px 0 rgba(22,21,15,0.28)`,
              }}
            />
          )
        })}
      </div>
      {/* trend line drawn over the bars */}
      <svg
        viewBox="0 0 400 240"
        style={{
          position: 'absolute',
          top: 316,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          margin: '0 auto',
          width: 400,
          height: 240,
        }}
        aria-hidden
      >
        <path
          d="M30,200 L130,150 L230,90 L360,26"
          fill="none"
          stroke={RED}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={520}
          strokeDashoffset={520 * (1 - draw)}
        />
      </svg>
      {/* the number */}
      <div
        style={{
          position: 'absolute',
          top: 618,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            ...MONO,
            fontSize: 64,
            fontWeight: 800,
            color: BLUE,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {faNumber(profit)}
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>سود این ماه</div>
        <div
          style={{
            ...MONO,
            fontSize: 16,
            opacity: 0.65,
            marginTop: 12,
          }}
        >
          420K − 260K − 70K = 90K
        </div>
      </div>
    </PaperStage>
  )
}

// ─── Scene 8 — transformation: chaos wipes into order ───────────────────

export function PaperTransformScene({ t, scene }: SceneComponentProps) {
  const wipe = ease(clamp(progress(t, 0.7, 2.3)))
  return (
    <PaperStage scene={scene} t={t} label="// 08 — تحول">
      <Words
        t={t}
        at={0.1}
        top={140}
        words={[{ text: 'از' }, { text: 'آشفتگی' }, { text: 'به‌نظم', accent: true }]}
        size={46}
      />
      {/* BEFORE: scattered gray cards */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {[
          { x: -120, y: 400, r: -12 },
          { x: 110, y: 350, r: 10 },
          { x: -60, y: 610, r: 7 },
          { x: 130, y: 640, r: -8 },
        ].map((c, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: c.y,
              insetInlineStart: `calc(50% + ${c.x}px)`,
              width: 120,
              height: 74,
              background: '#dcd7c9',
              border: `3px solid #a29c8c`,
              borderRadius: 16,
              transform: `translate(-50%, -50%) rotate(${c.r}deg)`,
            }}
          />
        ))}
        <HalftoneCharacter
          t={t}
          mood="worried"
          scale={0.85}
          style={{
            position: 'absolute',
            top: 400,
            insetInlineStart: 0,
            insetInlineEnd: 0,
            margin: '0 auto',
          }}
        />
      </div>
      {/* AFTER: clean blue ledger, revealed by a wipe */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: `inset(0 0 0 ${((1 - wipe) * 100).toFixed(1)}%)`,
        }}
      >
        <BrutCard
          style={{
            position: 'absolute',
            top: 330,
            insetInlineStart: 0,
            insetInlineEnd: 0,
            margin: '0 auto',
            width: 330,
            height: 400,
            background: BLUE,
            gap: 16,
            padding: '26px 24px',
            alignItems: 'stretch',
          }}
        >
          {['فروش ثبت شد', 'انبار کم شد', 'سود معلوم شد'].map((line) => (
            <div
              key={line}
              style={{
                background: PAPER,
                borderRadius: 12,
                padding: '12px 16px',
                fontSize: 22,
                fontWeight: 800,
                color: INK,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{line}</span>
              <span style={{ color: BLUE }}>✓</span>
            </div>
          ))}
        </BrutCard>
      </div>
    </PaperStage>
  )
}

// ─── Scene 9 — brand lockup ─────────────────────────────────────────────

export function PaperBrandScene({ t, scene }: SceneComponentProps) {
  const mark = pop(t, 0.2)
  const wipe = ease(clamp(progress(t, 0.7, 1.5)))
  const calmCard = pop(t, 1.3)
  return (
    <PaperStage scene={scene} t={t} label="// 09 — حسابچه">
      <Cam t={t} from={1.05} to={1}>
        <div
          style={{
            position: 'absolute',
            top: 300,
            insetInlineStart: 0,
            insetInlineEnd: 0,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 88,
              fontWeight: 900,
              lineHeight: 1.1,
              transform: `scale(${mix(0.75, 1, mark).toFixed(3)})`,
              opacity: clamp(mark * 1.5),
            }}
          >
            حسابچه
          </div>
          <div
            style={{
              width: `${(wipe * 260).toFixed(0)}px`,
              height: 9,
              background: BLUE,
              borderRadius: 6,
              margin: '16px auto 0',
              boxShadow: `4px 4px 0 ${INK}`,
            }}
          />
          <div
            style={{
              ...MONO,
              marginTop: 22,
              fontSize: 17,
              letterSpacing: '0.22em',
              opacity: clamp(progress(t, 1.0, 1.6)) * 0.75,
            }}
          >
            CLOUD · SIMPLE · FAST
          </div>
        </div>
        <HalftoneCharacter
          t={t}
          mood="happy"
          phone
          scale={1.05}
          style={{
            position: 'absolute',
            bottom: 70,
            insetInlineStart: 0,
            insetInlineEnd: 0,
            margin: '0 auto',
          }}
        />
        {/* two calm cards echo the grid, settled */}
        {[
          { text: 'فروش', x: -180, y: 560 },
          { text: 'انبار', x: 180, y: 620 },
        ].map((c) => (
          <BrutCard
            key={c.text}
            style={{
              position: 'absolute',
              top: c.y,
              insetInlineStart: `calc(50% + ${c.x}px)`,
              transform: `translate(-50%, -50%) scale(${mix(0.5, 1, calmCard).toFixed(3)})`,
              opacity: clamp(calmCard * 1.4),
              padding: '10px 20px',
            }}
          >
            <span style={{ fontSize: 20, fontWeight: 800 }}>{c.text}</span>
          </BrutCard>
        ))}
      </Cam>
    </PaperStage>
  )
}

// ─── Scene 10 — CTA ─────────────────────────────────────────────────────

export function PaperCtaScene({ t, scene }: SceneComponentProps) {
  const block = pop(t, 0.3, 0.65)
  const sub = clamp(progress(t, 1.0, 1.6))
  return (
    <PaperStage scene={scene} t={t} label="// 10 — شروع رایگان">
      <div
        style={{
          position: 'absolute',
          top: 260,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 900, marginBottom: 34 }}>همین امروز شروع کن</div>
        <div
          style={{
            display: 'inline-block',
            background: BLUE,
            color: PAPER,
            fontSize: 92,
            fontWeight: 900,
            padding: '10px 56px',
            borderRadius: 24,
            boxShadow: `10px 10px 0 ${INK}`,
            transform: `scale(${mix(0.3, 1, block).toFixed(3)}) rotate(${mix(-10, 0, block).toFixed(1)}deg)`,
            opacity: clamp(block * 1.6),
          }}
        >
          رایگان
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 30,
            fontWeight: 800,
            opacity: sub,
            transform: `translateY(${mix(20, 0, sub).toFixed(1)}px)`,
          }}
        >
          کامنت کن، لینک می‌گیری
        </div>
      </div>
      <HalftoneCharacter
        t={t}
        mood="happy"
        scale={0.85}
        style={{
          position: 'absolute',
          bottom: 40,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          margin: '0 auto',
          opacity: clamp(progress(t, 0.6, 1.2)),
        }}
      />
    </PaperStage>
  )
}
