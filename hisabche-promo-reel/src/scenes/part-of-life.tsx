// ============================================
// Reel #110 — «جزء زندگی» (Part of Life) — Pro Redesign
//
// The owner's brief: make the user feel Hisabche is part of their life —
// an indispensable ritual, like morning chai and the quiet evening market closure.
// One warm light-arc travels through a single dark day:
// 1. Dawn Chai (0.00–6.00s) — sunrise horizon, slender-waist glass, dancing steam
// 2. Noon Rush (6.00–13.00s) — celestial solar arc, precision thermal receipts stamped
// 3. Midnight Receivables (13.00–20.00s) — late-night debt anxiety resolving into ordered ledger
// 4. Brass Shutter (20.00–27.00s) — industrial steel slats, escaping warm light, central brass lock, «دخل تراز · شب آرام بازار»
// 5. Home Night (27.00–34.00s) — bedside lamp glow, phone resting with breathing mint heart, «راحت باش»
// 6. Brand Curtain (34.00–42.00s) — ember volumetric aura, geometric emblem, «جزء زندگیت» + «حسابچه» + HISABCHE.COM
//
// Guardrails strictly honoured:
// - noZoom: true (light travels, camera scale stays 1.0)
// - No decorative dividers
// - ≤ 6 on-stage words per scene (Hard Rule 14)
// - ≥ 24px safe margins on all 540x960 boundaries
// - Dark studio theme (obsidian midnight-gold)
// - Deterministic digits (faClock, faNumber) without Intl
// - No hardcoded currency units
// - Soulful Night-Closure & Anti-Sterile Shutter Law (Law 11)
// - Container-local coordinates & overflow: hidden on mockups (Law 8)
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import type { SceneProps } from './one-map'
import { clamp, ease, enter, mix, progress, pulse, spring, strokeDraw } from '../engine/anim'

// ─── Design Tokens ──────────────────────────────────────────────────────────

const NIGHT = '#090c15'
const PANEL_DARK = '#0f1420'
const PANEL_MID = '#141a29'
const PANEL_HI = '#1a2235'
const HAIRLINE = 'rgba(255, 255, 255, 0.08)'
const HAIRLINE_HI = 'rgba(255, 255, 255, 0.16)'
const EMBER = '#f2a35e'
const EMBER_DIM = 'rgba(242, 163, 94, 0.32)'
const EMBER_GLOW = 'rgba(242, 163, 94, 0.16)'
const BRASS = '#d8a95c'
const BRASS_DARK = '#8e6b30'
const AMBER = '#f0b45a'
const AMBER_DIM = 'rgba(240, 180, 90, 0.28)'
const MINT = '#4fe0a6'
const MINT_DIM = 'rgba(79, 224, 166, 0.28)'
const MINT_GLOW = 'rgba(79, 224, 166, 0.15)'
const CREAM = '#f4ecdd'
const CREAM_DIM = 'rgba(244, 236, 221, 0.65)'
const MONO = "'JetBrains Mono', 'Vazirmatn', monospace"

const LIFT = '0 18px 42px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.4)'
const LIFT_WARM =
  '0 22px 52px rgba(0,0,0,0.6), 0 3px 8px rgba(0,0,0,0.45), 0 0 48px rgba(242,163,94,0.14)'
const LIFT_MINT =
  '0 22px 52px rgba(0,0,0,0.6), 0 3px 8px rgba(0,0,0,0.45), 0 0 48px rgba(79,224,166,0.14)'

// Deterministic Persian digits without Intl dependence
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const faClock = (h: number, m: number): string =>
  `${String(h)
    .padStart(2, '0')
    .replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]!)}:${String(m)
    .padStart(2, '0')
    .replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]!)}`

// ─── Stage Shell ────────────────────────────────────────────────────────────

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
          'radial-gradient(120% 50% at 50% 108%, rgba(242,163,94,0.09) 0%, rgba(242,163,94,0) 62%), radial-gradient(100% 40% at 50% -8%, rgba(88,112,180,0.08) 0%, rgba(88,112,180,0) 64%)',
      }}
    >
      {children}
      {/* Subtle Micro-Stamp at bottom safe area */}
      <div
        style={{
          position: 'absolute',
          bottom: 26,
          left: 32,
          fontSize: 9,
          letterSpacing: '0.22em',
          fontFamily: MONO,
          color: 'rgba(141, 147, 165, 0.36)',
          pointerEvents: 'none',
        }}
      >
        PART OF LIFE // HISABCHE
      </div>
    </div>
  )
}

// ─── Common Pro Primitives ──────────────────────────────────────────────────

function Card({
  style,
  children,
  warm = false,
  mint = false,
}: {
  style: CSSProperties
  children?: ReactNode
  warm?: boolean | undefined
  mint?: boolean | undefined
}) {
  return (
    <div
      style={{
        position: 'absolute',
        borderRadius: 16,
        background: `linear-gradient(180deg, ${PANEL_HI} 0%, ${PANEL_DARK} 100%)`,
        border: `1px solid ${mint ? MINT_DIM : warm ? EMBER_DIM : HAIRLINE}`,
        boxShadow: mint ? LIFT_MINT : warm ? LIFT_WARM : LIFT,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function Bar({ w, h = 6, tone = 0.12 }: { w: number; h?: number; tone?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: h / 2,
        backgroundColor: `rgba(255, 255, 255, ${tone})`,
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
        boxShadow: `0 0 10px ${color}66`,
      }}
    />
  )
}

/** Precision TimeChip with frosted glass border and status LED */
function TimeChip({
  time,
  t,
  top = 88,
  dotColor = EMBER,
}: {
  time: string
  t: number
  top?: number
  dotColor?: string
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: clamp(progress(t, 0.05, 0.28)),
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 18px',
          borderRadius: 999,
          border: `1px solid ${HAIRLINE_HI}`,
          background: 'rgba(26, 34, 53, 0.72)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}
      >
        <Dot size={7} color={dotColor} />
        <span
          style={{
            fontFamily: MONO,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: CREAM,
          }}
        >
          {time}
        </span>
      </div>
    </div>
  )
}

// ─── Scene 1: Dawn Chai (0.00–6.00s) — Morning Ritual ───────────────────────

export function DawnScene({ t }: SceneProps) {
  const dawn = ease(clamp(progress(t, 0.15, 2.3)))
  const liquidFill = ease(clamp(progress(t, 0.9, 1.8)))
  const liquidH = mix(8, 92, liquidFill)
  const liquidY = 168 - liquidH
  const steamA = strokeDraw(t, 2.1, 1.1, 150)
  const steamB = strokeDraw(t, 2.4, 1.1, 140)
  const steamC = strokeDraw(t, 2.7, 1.1, 120)

  // Subtle undulating motion for rising steam
  const steamWiggleA = 3.5 * Math.sin(t * 2.8)
  const steamWiggleB = -3.0 * Math.sin(t * 3.2 + 0.8)

  return (
    <Stage>
      {/* Volumetric Sunrise Horizon Bloom */}
      <div
        style={{
          position: 'absolute',
          bottom: -40,
          left: 0,
          width: 540,
          height: mix(320, 500, dawn),
          opacity: mix(0.35, 0.85, dawn) + 0.05 * Math.sin(t * 0.9),
          background:
            'radial-gradient(64% 48% at 50% 100%, rgba(242,163,94,0.38) 0%, rgba(200,100,40,0.16) 48%, rgba(242,163,94,0) 78%)',
          transform: `translateY(${mix(24, 0, dawn)}px)`,
          pointerEvents: 'none',
        }}
      />

      <TimeChip time={faClock(6, 45)} t={t} top={92} dotColor={EMBER} />

      {/* Traditional Slender-Waist Glass (استکان کمر باریک) & Saucer */}
      <div
        style={{
          position: 'absolute',
          left: 270 - 90,
          top: 300,
          width: 180,
          height: 250,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <svg
          width={180}
          height={250}
          viewBox="0 0 180 250"
          fill="none"
          aria-hidden="true"
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Rich Amber-Red Tea Gradient */}
            <linearGradient id="tea-liquid-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f2a35e" stopOpacity="0.95" />
              <stop offset="35%" stopColor="#d66824" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#7a1f05" stopOpacity="0.98" />
            </linearGradient>

            {/* Specular Edge Glass Highlight */}
            <linearGradient id="glass-specular-left" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="glass-specular-right" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>

            {/* Saucer Metallic Gold Trim */}
            <linearGradient id="saucer-gold" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8a642f" />
              <stop offset="30%" stopColor="#e8be74" />
              <stop offset="70%" stopColor="#f4ecdd" />
              <stop offset="100%" stopColor="#8a642f" />
            </linearGradient>

            {/* Glass Clip Path for Liquid */}
            <clipPath id="slender-glass-clip">
              <path d="M 52 50 C 52 50, 48 95, 57 122 C 63 140, 56 160, 58 174 C 60 182, 70 185, 90 185 C 110 185, 120 182, 122 174 C 124 160, 117 140, 123 122 C 132 95, 128 50, 128 50 Z" />
            </clipPath>
          </defs>

          {/* Steaming Wisps Rising from Slender Lip */}
          <g transform={`translate(${steamWiggleA}, 0)`}>
            <path
              d="M 82 46 C 70 32, 92 20, 78 4"
              stroke={CREAM}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeDasharray={steamA.strokeDasharray}
              strokeDashoffset={steamA.strokeDashoffset}
              opacity={0.65}
            />
          </g>
          <g transform={`translate(${steamWiggleB}, 0)`}>
            <path
              d="M 98 48 C 110 34, 88 18, 102 6"
              stroke={CREAM}
              strokeWidth={2.0}
              strokeLinecap="round"
              strokeDasharray={steamB.strokeDasharray}
              strokeDashoffset={steamB.strokeDashoffset}
              opacity={0.48}
            />
          </g>
          <path
            d="M 90 44 C 84 30, 96 16, 90 0"
            stroke={CREAM}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeDasharray={steamC.strokeDasharray}
            strokeDashoffset={steamC.strokeDashoffset}
            opacity={0.35}
          />

          {/* Golden/Brass Saucer (نعلبکی) Base */}
          <ellipse cx={90} cy={196} rx={58} ry={12} fill="#0d111b" />
          <ellipse
            cx={90}
            cy={194}
            rx={56}
            ry={10}
            stroke="url(#saucer-gold)"
            strokeWidth={2.2}
            fill="#121724"
          />
          <ellipse cx={90} cy={193} rx={42} ry={6} fill="rgba(242,163,94,0.12)" />

          {/* Liquid Inside Glass (Clipped to Slender Waist) */}
          <g clipPath="url(#slender-glass-clip)">
            <rect
              x={40}
              y={liquidY}
              width={100}
              height={liquidH + 20}
              fill="url(#tea-liquid-grad)"
            />
            {/* Liquid Surface Meniscus Line */}
            <ellipse
              cx={90}
              cy={liquidY}
              rx={28}
              ry={5}
              fill="rgba(244,236,221,0.5)"
              opacity={liquidFill > 0.1 ? 0.8 : 0}
            />
          </g>

          {/* Outer Glass Contour & Lip */}
          <path
            d="M 50 48 C 50 48, 46 95, 56 122 C 62 140, 54 162, 56 176 C 58 184, 70 188, 90 188 C 110 188, 122 184, 124 176 C 126 162, 118 140, 124 122 C 134 95, 130 48, 130 48 Z"
            stroke="rgba(244, 236, 221, 0.45)"
            strokeWidth={2.2}
            fill="none"
          />
          {/* Top Flared Lip Ellipse */}
          <ellipse
            cx={90}
            cy={48}
            rx={40}
            ry={7}
            stroke="rgba(244, 236, 221, 0.6)"
            strokeWidth={2.2}
            fill="rgba(255, 255, 255, 0.04)"
          />

          {/* Left Specular Glare Reflection Line */}
          <path
            d="M 54 54 C 54 54, 50 94, 60 120 C 64 134, 58 156, 60 170"
            stroke="url(#glass-specular-left)"
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />

          {/* Right Specular Reflection Line */}
          <path
            d="M 126 54 C 126 54, 122 94, 118 120 C 114 134, 118 156, 118 170"
            stroke="url(#glass-specular-right)"
            strokeWidth={1.8}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>

      {/* Dawn Persian Headline: صبح */}
      <div
        dir="rtl"
        style={{
          ...enter(t, 2.5, { y: 12, fade: 0.5 }),
          position: 'absolute',
          top: 680,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 34,
            fontWeight: 800,
            color: CREAM,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            textShadow: '0 4px 18px rgba(0,0,0,0.6)',
          }}
        >
          صبح
        </span>
        <div
          style={{
            width: 32,
            height: 3,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${EMBER_DIM}, ${EMBER})`,
          }}
        />
      </div>
    </Stage>
  )
}

// ─── Scene 2: Noon Rush (6.00–13.00s) — Solar Arc & POS Receipts ────────────

const SUN_START = { x: 120, y: 200 }
const SUN_PEAK = { x: 270, y: 84 }
const SUN_END = { x: 420, y: 200 }

function calculateSunPos(p: number): { x: number; y: number } {
  const mt = 1 - p
  return {
    x: mt * mt * SUN_START.x + 2 * mt * p * SUN_PEAK.x + p * p * SUN_END.x,
    y: mt * mt * SUN_START.y + 2 * mt * p * SUN_PEAK.y + p * p * SUN_END.y,
  }
}

const NOON_RECEIPTS = [
  { time: faClock(9, 30), code: 'کد ۱۰۱', amount: '۱,۴۵۰' },
  { time: faClock(13, 30), code: 'کد ۲۰۴', amount: '۳,۲۸۰' },
  { time: faClock(17, 30), code: 'کد ۳۰۸', amount: '۲,۱۱۰' },
]

export function NoonScene({ t }: SceneProps) {
  const sunProgress = ease(clamp(progress(t, 0.4, 3.6)))
  const sunPos = calculateSunPos(sunProgress)
  const arcTrail = strokeDraw(t, 0.4, 3.6, 750)

  return (
    <Stage>
      {/* Radiant Midday Lighting Wash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.18 + 0.08 * Math.sin(t * 0.8),
          background:
            'radial-gradient(80% 60% at 50% 0%, rgba(242,163,94,0.25) 0%, rgba(242,163,94,0) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Celestial Solar Track Arc */}
      <svg
        width={540}
        height={960}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
      >
        <defs>
          <radialGradient id="sun-corona" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={EMBER} stopOpacity="1" />
            <stop offset="45%" stopColor={EMBER} stopOpacity="0.45" />
            <stop offset="100%" stopColor={EMBER} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Orbit Arc */}
        <path
          d={`M ${SUN_START.x} ${SUN_START.y} Q ${SUN_PEAK.x} ${SUN_PEAK.y} ${SUN_END.x} ${SUN_END.y}`}
          fill="none"
          stroke={EMBER_DIM}
          strokeWidth={2.4}
          strokeDasharray={arcTrail.strokeDasharray}
          strokeDashoffset={arcTrail.strokeDashoffset}
        />

        {/* Dynamic Downward Projection Light Ray */}
        <line
          x1={sunPos.x}
          y1={sunPos.y + 12}
          x2={sunPos.x}
          y2={sunPos.y + 70}
          stroke="url(#sun-corona)"
          strokeWidth={2}
          opacity={0.65}
        />

        {/* Sun Disc & Glowing Corona */}
        <circle cx={sunPos.x} cy={sunPos.y} r={24} fill="url(#sun-corona)" />
        <circle cx={sunPos.x} cy={sunPos.y} r={10} fill={EMBER} />
        <circle
          cx={sunPos.x}
          cy={sunPos.y}
          r={20}
          fill="none"
          stroke={EMBER}
          strokeWidth={1.5}
          opacity={0.4}
        />
      </svg>

      {/* 3 High-End Thermal POS Receipts Landing Sequentially */}
      {NOON_RECEIPTS.map((rc, i) => {
        const arrivalProgress = clamp(progress(t, 0.85 + i * 0.6, 0.85))
        const receiptEnter = enter(t, 0.85 + i * 0.6, { y: 22, scale: 0.98 })

        return (
          <div
            key={rc.time}
            style={{
              position: 'absolute',
              top: 310 + i * 114,
              left: 60,
              width: 420,
              height: 98,
              borderRadius: 14,
              background: `linear-gradient(180deg, ${PANEL_HI} 0%, ${PANEL_MID} 100%)`,
              border: `1px solid ${HAIRLINE_HI}`,
              boxShadow: LIFT,
              overflow: 'hidden',
              ...receiptEnter,
            }}
          >
            {/* Thermal Slip Top Serrated Sawtooth Edge */}
            <svg
              width={420}
              height={8}
              style={{ position: 'absolute', top: 0, left: 0 }}
              aria-hidden="true"
            >
              <path
                d="M 0 0 L 10 6 L 20 0 L 30 6 L 40 0 L 50 6 L 60 0 L 70 6 L 80 0 L 90 6 L 100 0 L 110 6 L 120 0 L 130 6 L 140 0 L 150 6 L 160 0 L 170 6 L 180 0 L 190 6 L 200 0 L 210 6 L 220 0 L 230 6 L 240 0 L 250 6 L 260 0 L 270 6 L 280 0 L 290 6 L 300 0 L 310 6 L 320 0 L 330 6 L 340 0 L 350 6 L 360 0 L 370 6 L 380 0 L 390 6 L 400 0 L 410 6 L 420 0"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth={1.2}
                fill="none"
              />
            </svg>

            {/* Receipt Content Layout */}
            <div
              dir="rtl"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 22px',
              }}
            >
              {/* Right Side: Timestamp & Trade Code */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Dot size={10} color={EMBER} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 22,
                      fontWeight: 700,
                      color: CREAM,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {rc.time}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: CREAM_DIM,
                      fontWeight: 500,
                    }}
                  >
                    فاکتور فروش · {rc.code}
                  </span>
                </div>
              </div>

              {/* Left Side: Real-time "Registered" Emerald Stamp Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 5,
                  }}
                >
                  <Bar w={64} h={6} tone={0.2} />
                  <Bar w={44} h={6} tone={0.12} />
                </div>
                <div
                  style={{
                    padding: '4px 12px',
                    borderRadius: 999,
                    border: `1px solid ${MINT_DIM}`,
                    background: 'rgba(79, 224, 166, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transform: `scale(${mix(0.85, 1, spring(arrivalProgress))})`,
                  }}
                >
                  <Dot size={6} color={MINT} />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: MINT,
                      lineHeight: 1,
                    }}
                  >
                    ثبت شد
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* Noon Persian Headline: ظهر */}
      <div
        dir="rtl"
        style={{
          ...enter(t, 3.2, { y: 12, fade: 0.5 }),
          position: 'absolute',
          top: 684,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 34,
            fontWeight: 800,
            color: CREAM,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            textShadow: '0 4px 18px rgba(0,0,0,0.6)',
          }}
        >
          ظهر
        </span>
        <div
          style={{
            width: 32,
            height: 3,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${EMBER_DIM}, ${EMBER})`,
          }}
        />
      </div>
    </Stage>
  )
}

// ─── Scene 3: Midnight Receivables (13.00–20.00s) — Resolving Anxiety ───────

const RESOLVE_STATE_AT = 3.2
const CHIP_STATE_AT = 3.7

const RECEIVABLES_DATA = [
  { label: 'مشتری کد ۲۰۱', time: '۱۱:۲۰' },
  { label: 'فاکتور کد ۱۱۴', time: '۱۵:۴۵' },
  { label: 'حساب کد ۳۰۵', time: '۱۹:۳۰' },
]

export function MidnightScene({ t }: SceneProps) {
  const worried = t < CHIP_STATE_AT

  return (
    <Stage>
      {/* Midnight Room Lighting Diffusion */}
      <div
        style={{
          position: 'absolute',
          width: 440,
          height: 440,
          left: 270 - 220,
          top: 210,
          borderRadius: '50%',
          background: worried
            ? `radial-gradient(circle, ${EMBER_GLOW} 0%, rgba(242,163,94,0) 68%)`
            : `radial-gradient(circle, ${MINT_GLOW} 0%, rgba(79,224,166,0) 68%)`,
          opacity: 0.55 + (worried ? 0.3 * pulse(t, 0.8, CHIP_STATE_AT, 1.3) : 0.1),
          transform: 'translateY(40px)',
          pointerEvents: 'none',
        }}
      />

      <TimeChip time={faClock(23, 40)} t={t} top={72} dotColor={worried ? AMBER : MINT} />

      {/* World-Class Smartphone Mockup Chassis */}
      <Card
        warm={worried}
        mint={!worried}
        style={{
          top: 154,
          left: 110,
          width: 320,
          height: 490,
          borderRadius: 32,
          padding: 0,
          transform: `scale(${mix(0.96, 1, spring(clamp(progress(t, 0.1, 0.8))))})`,
          opacity: clamp(progress(t, 0.05, 0.3)),
          border: `1.5px solid ${worried ? 'rgba(240,180,90,0.35)' : 'rgba(79,224,166,0.35)'}`,
        }}
      >
        {/* Dynamic Island / Speaker Pill at Top of Phone */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 320 / 2 - 40,
            width: 80,
            height: 18,
            borderRadius: 999,
            background: '#070a10',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)',
            }}
          />
        </div>

        {/* Ledger Header Title Inside Phone */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 48,
            left: 20,
            right: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: CREAM,
            }}
          >
            دفتر نسیه و طلب
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 12,
              color: CREAM_DIM,
            }}
          >
            ۳ سند باز
          </span>
        </div>

        {/* Dynamic Status Chip: «نامعلوم» -> «مرتب و تراز» */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 88,
            left: 20,
            right: 20,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              padding: '7px 22px',
              borderRadius: 999,
              border: `1px solid ${worried ? AMBER_DIM : MINT_DIM}`,
              background: worried ? 'rgba(240,180,90,0.12)' : 'rgba(79,224,166,0.12)',
              opacity: worried
                ? clamp(progress(t, 0.4, 0.4))
                : clamp(progress(t, CHIP_STATE_AT, 0.3)),
              boxShadow: worried
                ? '0 0 16px rgba(240,180,90,0.2)'
                : '0 0 16px rgba(79,224,166,0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Dot size={8} color={worried ? AMBER : MINT} />
            <span
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: worried ? AMBER : MINT,
                lineHeight: 1.1,
              }}
            >
              {worried ? 'نامعلوم' : 'مرتب و تراز'}
            </span>
          </div>
        </div>

        {/* 3 Receivable Line Cards Inside Screen */}
        {RECEIVABLES_DATA.map((item, i) => {
          const solved = t >= RESOLVE_STATE_AT + i * 0.14
          const checkSpring = spring(clamp(progress(t, RESOLVE_STATE_AT + i * 0.14, 0.6)))

          return (
            <div
              key={item.label}
              dir="rtl"
              style={{
                position: 'absolute',
                top: 154 + i * 94,
                left: 18,
                right: 18,
                height: 78,
                borderRadius: 14,
                border: `1px solid ${solved ? 'rgba(79,224,166,0.24)' : HAIRLINE}`,
                background: solved ? 'rgba(79,224,166,0.04)' : 'rgba(255, 255, 255, 0.02)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: 12,
                transition: 'all 0.3s ease',
              }}
            >
              {/* Status Indicator Icon */}
              <div
                style={{
                  transform: `scale(${mix(0.7, 1, checkSpring)})`,
                }}
              >
                <Dot size={10} color={solved ? MINT : AMBER} />
              </div>

              {/* Debt Line Content */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: CREAM,
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      color: CREAM_DIM,
                    }}
                  >
                    {item.time}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Bar w={110} h={6} tone={solved ? 0.22 : 0.1} />
                  <Bar w={45} h={6} tone={solved ? 0.18 : 0.08} />
                </div>
              </div>

              {/* Resolved Checkmark Icon */}
              {solved && (
                <div
                  style={{
                    opacity: clamp(progress(t, RESOLVE_STATE_AT + i * 0.14, 0.25)),
                    transform: `scale(${checkSpring})`,
                  }}
                >
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx={12} cy={12} r={10} fill="rgba(79,224,166,0.15)" />
                    <path
                      d="M6 12.5 L10 16.5 L18 8.5"
                      stroke={MINT}
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
          )
        })}
      </Card>

      {/* Midnight Scene Caption */}
      <div
        dir="rtl"
        style={{
          ...enter(t, 4.0, { y: 10, fade: 0.5 }),
          position: 'absolute',
          top: 684,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 34,
            fontWeight: 800,
            color: CREAM,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            textShadow: '0 4px 18px rgba(0,0,0,0.6)',
          }}
        >
          نیمه‌شب
        </span>
        <div
          style={{
            width: 32,
            height: 3,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${MINT_DIM}, ${MINT})`,
          }}
        />
      </div>
    </Stage>
  )
}

// ─── Scene 4: The Brass Shutter (20.00–27.00s) — Market Closure Law ─────────

const SLAT_COUNT = 5
const SLAT_TOP_START = 150
const SLAT_HEIGHT = 84
const SLAT_GAP = 3
const SHUTTER_FULL_BOTTOM = SLAT_TOP_START + SLAT_COUNT * (SLAT_HEIGHT + SLAT_GAP) - SLAT_GAP

export function ShutterScene({ t }: SceneProps) {
  // Cascading spring dynamics for 5 heavy steel louvers
  const slatSprings = [0, 1, 2, 3, 4].map((i) => spring(clamp(progress(t, 0.35 + i * 0.5, 0.85))))
  const totalLanded = slatSprings.reduce((sum: number, v) => sum + clamp(v), 0)
  const currentBandTop = SLAT_TOP_START + totalLanded * (SLAT_HEIGHT + SLAT_GAP)
  const lockSpring = spring(clamp(progress(t, 3.05, 0.65)))

  return (
    <Stage>
      <TimeChip time={faClock(0, 10)} t={t} top={56} dotColor={BRASS} />

      {/* Architectural Shutter Housing Header */}
      <div
        style={{
          position: 'absolute',
          top: 102,
          left: 50,
          width: 440,
          height: 44,
          borderRadius: 12,
          background: 'linear-gradient(180deg, #242c3d 0%, #151b27 100%)',
          border: `1px solid ${HAIRLINE_HI}`,
          boxShadow: LIFT,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 2px, rgba(255,255,255,0) 2px 28px)',
          }}
        />
      </div>

      {/* Escaping Warm Golden Light Pool (Shrinks as slats fall) */}
      <div
        style={{
          position: 'absolute',
          left: 50,
          width: 440,
          top: currentBandTop,
          height: Math.max(0, SHUTTER_FULL_BOTTOM - currentBandTop + 60),
          background:
            'linear-gradient(180deg, rgba(242,163,94,0.36) 0%, rgba(242,163,94,0.08) 70%, rgba(242,163,94,0) 100%)',
          opacity: clamp(1 - totalLanded / 5),
          pointerEvents: 'none',
        }}
      />

      {/* 5 Industrial Steel Slats with Extruded Metallic Bevels & Dual Rivets */}
      {[0, 1, 2, 3, 4].map((i) => {
        const spr = slatSprings[i]!
        const yOffset = (1 - spr) * -170

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 50,
              width: 440,
              height: SLAT_HEIGHT,
              top: SLAT_TOP_START + i * (SLAT_HEIGHT + SLAT_GAP),
              borderRadius: 8,
              background: 'linear-gradient(180deg, #202738 0%, #121722 100%)',
              border: `1px solid ${i === 0 ? HAIRLINE_HI : HAIRLINE}`,
              boxShadow: '0 10px 24px rgba(0,0,0,0.65)',
              overflow: 'hidden',
              transform: `translateY(${yOffset}px)`,
              opacity: clamp(progress(t, 0.3 + i * 0.5, 0.22)),
            }}
          >
            {/* Horizontal Extruded Steel Bevel Lines */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                backgroundColor: 'rgba(255, 255, 255, 0.18)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: SLAT_HEIGHT / 2 - 4,
                left: 0,
                right: 0,
                height: 8,
                background:
                  'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(255,255,255,0.05) 100%)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 2,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
              }}
            />

            {/* Precision Industrial Rivets (Left & Right Pairs) */}
            <div
              style={{
                position: 'absolute',
                top: SLAT_HEIGHT / 2 - 4,
                left: 18,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #9aa6c0 0%, #2a3448 80%)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.7)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: SLAT_HEIGHT / 2 - 4,
                right: 18,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 35%, #9aa6c0 0%, #2a3448 80%)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.7)',
              }}
            />
          </div>
        )
      })}

      {/* Central Brass Disc Lock Snapping Shut with Shockwave */}
      <div
        style={{
          position: 'absolute',
          top: SHUTTER_FULL_BOTTOM - 42 - 36,
          left: 270 - 42,
          width: 84,
          height: 84,
          borderRadius: '50%',
          background: `radial-gradient(circle at 34% 30%, #f4cb84 0%, ${BRASS} 45%, ${BRASS_DARK} 85%)`,
          border: '1.5px solid rgba(255,255,255,0.3)',
          boxShadow: `0 18px 40px rgba(0,0,0,0.65), 0 0 38px rgba(216,169,92,0.35)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${mix(0.65, 1, lockSpring)})`,
          opacity: clamp(progress(t, 3.05, 0.25)),
        }}
      >
        {/* Lock Keyhole Cylinder */}
        <div
          style={{
            width: 12,
            height: 28,
            borderRadius: 6,
            background: 'rgba(16,12,6,0.85)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.9)',
          }}
        />
      </div>

      {/* Closing Night Caption: «دخل تراز · شب آرام بازار» (Strictly 5 Words) */}
      <div
        dir="rtl"
        style={{
          ...enter(t, 3.4, { y: 14, fade: 0.5 }),
          position: 'absolute',
          top: 696,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 30,
            fontWeight: 800,
            color: CREAM,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            textShadow: '0 4px 22px rgba(0,0,0,0.7)',
          }}
        >
          دخل تراز · شب آرام بازار
        </span>
        <div
          style={{
            width: 48,
            height: 3,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${BRASS_DARK}, ${BRASS})`,
          }}
        />
      </div>
    </Stage>
  )
}

// ─── Scene 5: The Home Night (27.00–34.00s) — Peaceful Bedside ──────────────

export function RestScene({ t }: SceneProps) {
  const lampGlow = 0.58 + 0.12 * Math.sin(t * 0.95)
  const breathingHeart = 0.52 + 0.32 * Math.sin(t * 2.1)

  return (
    <Stage>
      {/* Warm Ambient Bedside Lamp Light Pool */}
      <div
        style={{
          position: 'absolute',
          width: 360,
          height: 360,
          left: 170 - 180,
          top: 530 - 180,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(242,163,94,0.28) 0%, rgba(242,163,94,0.06) 55%, rgba(242,163,94,0) 75%)`,
          opacity: lampGlow,
          pointerEvents: 'none',
        }}
      />

      <TimeChip time={faClock(1, 10)} t={t} top={88} dotColor={MINT} />

      {/* Bedside Lamp Vector Illustration */}
      <svg
        width={130}
        height={210}
        style={{ position: 'absolute', left: 90, top: 440 }}
        viewBox="0 0 130 210"
        fill="none"
        aria-hidden="true"
      >
        {/* Conical Brass Lamp Shade */}
        <path
          d="M 30 50 L 100 50 L 115 90 L 15 90 Z"
          fill="rgba(216,169,92,0.32)"
          stroke={BRASS}
          strokeWidth={2}
        />
        {/* Glowing Filament Bulb */}
        <circle cx={65} cy={86} r={7} fill={EMBER} />
        {/* Lamp Stand & Stem */}
        <rect x={61} y={90} width={8} height={70} fill="rgba(244,236,221,0.35)" />
        {/* Lamp Circular Base */}
        <ellipse
          cx={65}
          cy={165}
          rx={36}
          ry={9}
          fill="rgba(216,169,92,0.35)"
          stroke={BRASS}
          strokeWidth={1.5}
        />
      </svg>

      {/* Flagship Phone Resting in Always-On Ambient Display Mode */}
      <div
        style={{
          position: 'absolute',
          left: 310,
          top: 450,
          width: 120,
          height: 200,
          borderRadius: 22,
          backgroundColor: '#070a11',
          border: `1.5px solid ${HAIRLINE_HI}`,
          boxShadow: LIFT,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        {/* Concentric Breathing Glow Ring */}
        <div
          style={{
            position: 'absolute',
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: `1px solid ${MINT}`,
            opacity: breathingHeart * 0.45,
            transform: `scale(${mix(0.9, 1.4, breathingHeart)})`,
          }}
        />

        {/* Breathing Mint Heart Indicator (Hisabche Icon) */}
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: MINT,
            opacity: breathingHeart,
            boxShadow: `0 0 ${mix(10, 24, breathingHeart)}px rgba(79,224,166,0.65)`,
          }}
        />

        {/* Quiet Calming Status Text */}
        <span
          dir="rtl"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: MINT,
            letterSpacing: '0.02em',
            opacity: 0.85,
          }}
        >
          تراز امن
        </span>
      </div>

      {/* Bedside Nightstand Tabletop Ground Shadow */}
      <div
        style={{
          position: 'absolute',
          top: 654,
          left: 60,
          width: 420,
          height: 20,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)',
          filter: 'blur(6px)',
          pointerEvents: 'none',
        }}
      />

      {/* Serene Night Caption: «راحت باش» (Strictly 2 Words) */}
      <div
        dir="rtl"
        style={{
          ...enter(t, 2.3, { y: 12, fade: 0.5 }),
          position: 'absolute',
          top: 736,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 34,
            fontWeight: 800,
            color: CREAM,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            textShadow: '0 4px 18px rgba(0,0,0,0.6)',
          }}
        >
          راحت باش
        </span>
        <div
          style={{
            width: 32,
            height: 3,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${MINT_DIM}, ${MINT})`,
          }}
        />
      </div>
    </Stage>
  )
}

// ─── Scene 6: Brand Curtain (34.00–42.00s) — «جزء زندگیت» ──────────────────

export function CurtainScene({ t }: SceneProps) {
  const haloBloom = clamp(progress(t, 0.1, 2.5))
  const emblemEnter = enter(t, 0.4, { y: 18, scale: 0.95 })
  const taglineEnter = enter(t, 1.0, { y: 14 })
  const brandEnter = enter(t, 1.6, { y: 18 })
  const domainEnter = enter(t, 2.8, { y: 12 })

  return (
    <Stage>
      {/* Volumetric Radial Aura Halo */}
      <div
        style={{
          position: 'absolute',
          top: 450,
          left: 270,
          width: mix(340, 540, haloBloom),
          height: mix(340, 540, haloBloom),
          borderRadius: '50%',
          background: `radial-gradient(circle, ${EMBER_GLOW} 0%, rgba(216,169,92,0.08) 50%, rgba(242,163,94,0) 70%)`,
          opacity: 0.6 + 0.1 * Math.sin(t * 0.9),
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Geometric Glowing Brass Brand Emblem */}
      <div
        style={{
          ...emblemEnter,
          position: 'absolute',
          top: 250,
          left: 270,
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <svg width={74} height={74} viewBox="0 0 74 74" fill="none" aria-hidden="true">
          <circle cx={37} cy={37} r={34} stroke={BRASS} strokeWidth={1.5} opacity={0.4} />
          <path
            d="M 37 14 L 56 26 L 56 48 L 37 60 L 18 48 L 18 26 Z"
            stroke={BRASS}
            strokeWidth={2.4}
            fill="rgba(216, 169, 92, 0.12)"
          />
          <circle cx={37} cy={37} r={6} fill={EMBER} />
        </svg>
      </div>

      {/* Refined Tagline: جزءِ زندگی‌ت */}
      <div
        dir="rtl"
        style={{
          ...taglineEnter,
          position: 'absolute',
          top: 360,
          left: 270,
          transform: 'translate(-50%, -50%)',
          fontSize: 28,
          fontWeight: 800,
          color: BRASS,
          whiteSpace: 'nowrap',
          letterSpacing: '0.04em',
          textShadow: '0 2px 14px rgba(216,169,92,0.3)',
        }}
      >
        جزءِ زندگی‌ت
      </div>

      {/* Bold Display Title: حسابچه */}
      <div
        dir="rtl"
        style={{
          ...brandEnter,
          position: 'absolute',
          top: 480,
          left: 270,
          transform: 'translate(-50%, -50%)',
          fontSize: 116,
          fontWeight: 900,
          color: CREAM,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          textShadow: '0 6px 30px rgba(0,0,0,0.8), 0 0 40px rgba(242,163,94,0.2)',
        }}
      >
        حسابچه
      </div>

      {/* Official Domain Obsidian Capsule Pill */}
      <div
        style={{
          ...domainEnter,
          position: 'absolute',
          top: 610,
          left: 270,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div
          style={{
            padding: '10px 28px',
            borderRadius: 999,
            border: `1.5px solid ${HAIRLINE_HI}`,
            background: 'rgba(26, 34, 53, 0.75)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 21,
              fontWeight: 700,
              letterSpacing: '0.28em',
              color: CREAM,
            }}
          >
            HISABCHE.COM
          </span>
        </div>
      </div>
    </Stage>
  )
}
