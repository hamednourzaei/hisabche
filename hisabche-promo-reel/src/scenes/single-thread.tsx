// ============================================
// Single-thread art direction (reel 106) — «یک خط»
// Bespoke Macro Kinetic Rope & Tactile Thread Architecture
//
// Visual DNA & Creative Direction:
// - ZERO traditional UI cards, ZERO 3-pod telemetry boxes (unlike 107/105).
// - Open, tactile physical stage: deep cosmic textile abyss (#030511 to #080c1f).
// - Hero Character: Dynamic physics-driven glowing fiber/rope (SVG cubic bezier,
//   tension ripples, harmonic string vibrations, elastic catenary curves).
// - Scene 1: Tangled multi-strand knot of 5 books with swinging kraft tags & stress sparks.
// - Scene 2: Mechanical winches pulling the knot into ONE taut, vibrating superconductor line.
// - Scene 3: Macro vertical rosary/abacus thread with 5 glowing optical glass beads.
// - Scene 4: Guillotine laser shear cutting test: thread sags elastically & holds offline.
// - Scene 5: Central spinal datum cord with alternating typographic data milestones.
// - Scene 6: Glowing thread curling into the Hisabche Mobius loop & tactile CTA button.
// ============================================

import React from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'
import { stagePunch, stageShake } from './card-motion'

// ─── Design Tokens ────────────────────────────────────────────────────────────

const VOID_DARK = '#030511'
const THREAD_CYAN = '#38bdf8'
const THREAD_TEAL = '#2dd4bf'
const THREAD_GOLD = '#fbbf24'
const EMERALD_MINT = '#10b981'
const ROSE_ALERT = '#f43f5e'
const PAPER_WHITE = '#f8fafc'
const TEXT_MUTED = '#94a3b8'

function popSpring(t: number, at: number, dur = 0.5): number {
  return spring(clamp(progress(t, at, dur)))
}

// ─── Ambient Textile & Fiber Backdrop ─────────────────────────────────────────

function FiberBackdrop({ t }: { t: number }) {
  const pulse = Math.sin(t * 1.8) * 0.08 + 0.14
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Deep Volumetric Indigo/Cyan Bloom */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(800px 600px at 50% 45%, rgba(45, 212, 191, ${pulse.toFixed(3)}), transparent 75%), radial-gradient(700px 500px at 50% 85%, rgba(56, 189, 248, 0.08), transparent 70%)`,
        }}
      />

      {/* Micro Tactile Textile Weave Pattern (Diagonal Warp & Weft) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.015) 0px, rgba(255, 255, 255, 0.015) 1px, transparent 1px, transparent 12px), repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.015) 0px, rgba(255, 255, 255, 0.015) 1px, transparent 1px, transparent 12px)',
          opacity: 0.85,
        }}
      />

      {/* Floating Micro Light Particles */}
      {[
        { x: 80, y: 160, r: 1.5, o: 0.4, sp: 1.1 },
        { x: 440, y: 220, r: 2.0, o: 0.5, sp: 0.9 },
        { x: 120, y: 580, r: 1.8, o: 0.45, sp: 1.3 },
        { x: 410, y: 640, r: 2.2, o: 0.6, sp: 0.8 },
        { x: 260, y: 780, r: 1.5, o: 0.35, sp: 1.2 },
        { x: 180, y: 380, r: 1.2, o: 0.3, sp: 1.5 },
      ].map((p, idx) => {
        const floatY = Math.sin(t * p.sp + idx) * 16
        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y + floatY,
              width: p.r * 2,
              height: p.r * 2,
              borderRadius: '50%',
              background: THREAD_CYAN,
              boxShadow: `0 0 10px ${THREAD_CYAN}`,
              opacity: p.o,
            }}
          />
        )
      })}

      {/* Vignette Edge Shading */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 50%, transparent 40%, rgba(2, 4, 10, 0.95) 100%)',
        }}
      />
    </div>
  )
}

// ─── Stage Shell ─────────────────────────────────────────────────────────────

export function ThreadStage({
  scene,
  t,
  shakes,
  punches,
  children,
}: {
  scene: Scene
  t: number
  shakes?: readonly number[]
  punches?: readonly number[]
  children: React.ReactNode
}) {
  void scene
  const shake = stageShake(t, shakes)
  const punch = stagePunch(t, punches)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        direction: 'ltr',
        background: VOID_DARK,
        overflow: 'hidden',
        color: PAPER_WHITE,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${shake.x.toFixed(2)}px, ${shake.y.toFixed(2)}px) scale(${punch.toFixed(3)})`,
          transformOrigin: '50% 50%',
        }}
      >
        <FiberBackdrop t={t} />
        {children}

        {/* Tactile Ambient Footer Datum */}
        <div
          dir="ltr"
          style={{
            position: 'absolute',
            bottom: 16,
            left: 28,
            right: 28,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 10,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            letterSpacing: '0.14em',
            color: 'rgba(148, 163, 184, 0.4)',
          }}
        >
          <span>HISABCHE // TACTILE_THREAD_ENGINE</span>
          <span>CONTINUOUS_FIBER_SYS</span>
        </div>
      </div>
    </div>
  )
}

// ─── Top Stage Header Lockup (Direct Typographic, No Card) ────────────────────

function ThreadHeaderLockup({
  category,
  title,
  subtitle,
  accentText,
  accentColor = THREAD_CYAN,
  t,
}: {
  category: string
  title: string
  subtitle: string
  accentText?: string
  accentColor?: string
  t: number
}) {
  const enter = clamp(progress(t, 0.05, 0.45))
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        top: 36,
        left: 28,
        right: 28,
        textAlign: 'start',
        zIndex: 30,
        opacity: enter,
        transform: `translateY(${mix(10, 0, enter)}px)`,
      }}
    >
      {/* Category Monospace Line */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: accentColor,
            boxShadow: `0 0 10px ${accentColor}`,
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: accentColor,
            letterSpacing: '0.06em',
          }}
        >
          {category}
        </span>
      </div>

      {/* Primary Bold Title */}
      <div
        style={{
          fontSize: 27,
          fontWeight: 900,
          color: PAPER_WHITE,
          lineHeight: 1.25,
          letterSpacing: '-0.02em',
          marginBottom: 4,
        }}
      >
        {title}
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: TEXT_MUTED,
          lineHeight: 1.4,
        }}
      >
        <span>{subtitle} </span>
        {accentText && <span style={{ color: accentColor, fontWeight: 800 }}>{accentText}</span>}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 1: TangleScene (0.00–7.00s) — The Tangled Ropes & Swinging Kraft Tags
// ═════════════════════════════════════════════════════════════════════════════

export function TangleScene({ t, scene }: { t: number; scene: Scene }) {
  const draw = ease(clamp(progress(t, 0.1, 2.2)))
  const alertPulse = popSpring(t, 4.5, 0.6)
  const sparkGlow = t > 4.5 ? Math.sin(t * 18) * 0.4 + 0.6 : 0

  // 5 Hanging Kraft Tags connected to the messy rope tangle
  const tags = [
    { label: 'دفتر نسیه', color: ROSE_ALERT, x: 92, y: 270, swingSpeed: 2.2, phase: 0 },
    { label: 'تقویم چک‌ها', color: THREAD_GOLD, x: 420, y: 260, swingSpeed: 1.9, phase: 1.2 },
    { label: 'کاردکس انبار', color: THREAD_CYAN, x: 80, y: 580, swingSpeed: 2.5, phase: 2.4 },
    { label: 'صندوق نقدی', color: EMERALD_MINT, x: 430, y: 590, swingSpeed: 2.0, phase: 3.6 },
    { label: 'دفتر روزنامه', color: '#c084fc', x: 270, y: 690, swingSpeed: 1.7, phase: 4.8 },
  ]

  return (
    <ThreadStage scene={scene} t={t} shakes={[4.5]} punches={[0.05, 4.5]}>
      <ThreadHeaderLockup
        category="آسیب‌شناسی دفاتر سنتی // گره کلاف"
        title="پنج دفتر جداگانه و پراکنده..."
        subtitle="نسیه، چک، انبار، صندوق، دفتر کل؛"
        accentText="هیچ‌کدام به هم وصل نیستند!"
        accentColor={ROSE_ALERT}
        t={t}
      />

      {/* Main Stage: Tangled SVG Ropes & Strings (Full Canvas Coverage) */}
      <svg
        width={540}
        height={960}
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <defs>
          <radialGradient id="knotStressGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={ROSE_ALERT} stopOpacity={0.4} />
            <stop offset="100%" stopColor={ROSE_ALERT} stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* Knot Stress Ambient Halo in Center */}
        <circle
          cx={270}
          cy={450}
          r={140}
          fill="url(#knotStressGlow)"
          opacity={t > 4.5 ? sparkGlow : 0.25}
        />

        {/* 5 Tangled Organic Fiber Paths */}
        {/* Rope 1: Rose (Nasiyeh to Center to Cheque) */}
        <path
          d="M 92 270 C 160 340, 210 520, 270 450 C 330 380, 360 300, 420 260"
          fill="none"
          stroke={ROSE_ALERT}
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeDasharray="600"
          strokeDashoffset={600 * (1 - draw)}
          style={{ filter: `drop-shadow(0 0 8px ${ROSE_ALERT}88)` }}
        />

        {/* Rope 2: Gold (Cheque to Center to Cash) */}
        <path
          d="M 420 260 C 360 380, 190 410, 270 450 C 350 490, 380 520, 430 590"
          fill="none"
          stroke={THREAD_GOLD}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray="600"
          strokeDashoffset={600 * (1 - draw)}
          style={{ filter: `drop-shadow(0 0 8px ${THREAD_GOLD}88)` }}
        />

        {/* Rope 3: Cyan (Warehouse to Center to Ledger) */}
        <path
          d="M 80 580 C 140 500, 210 390, 270 450 C 330 510, 310 630, 270 690"
          fill="none"
          stroke={THREAD_CYAN}
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeDasharray="600"
          strokeDashoffset={600 * (1 - draw)}
          style={{ filter: `drop-shadow(0 0 8px ${THREAD_CYAN}88)` }}
        />

        {/* Rope 4: Emerald (Cash to Center to Nasiyeh loop) */}
        <path
          d="M 430 590 C 320 620, 210 470, 270 450 C 330 430, 150 250, 92 270"
          fill="none"
          stroke={EMERALD_MINT}
          strokeWidth={3.8}
          strokeLinecap="round"
          strokeDasharray="600"
          strokeDashoffset={600 * (1 - draw)}
          style={{ filter: `drop-shadow(0 0 8px ${EMERALD_MINT}88)` }}
        />

        {/* Rope 5: Braided Tight Knot Swirl in Center */}
        <path
          d="M 240 430 Q 270 400 300 440 Q 310 480 270 470 Q 230 460 250 420"
          fill="none"
          stroke={PAPER_WHITE}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDasharray="300"
          strokeDashoffset={300 * (1 - draw)}
          opacity={0.8}
        />

        {/* Center Friction Burst Ring */}
        <circle
          cx={270}
          cy={450}
          r={28 * alertPulse}
          fill="none"
          stroke={ROSE_ALERT}
          strokeWidth={2.5}
          opacity={alertPulse}
        />
        <circle
          cx={270}
          cy={450}
          r={8}
          fill={ROSE_ALERT}
          style={{ filter: `drop-shadow(0 0 12px ${ROSE_ALERT})` }}
        />
      </svg>

      {/* 5 Hanging Tactile Kraft Tags */}
      {tags.map((tg, idx) => {
        const enter = clamp(progress(t, 0.4 + idx * 0.3, 0.5))
        const swing = Math.sin(t * tg.swingSpeed + tg.phase) * 6
        return (
          <div
            key={tg.label}
            dir="rtl"
            style={{
              position: 'absolute',
              left: tg.x,
              top: tg.y,
              transform: `translate(-50%, -50%) rotate(${swing.toFixed(2)}deg) scale(${mix(0.6, 1, enter)})`,
              opacity: enter,
              background: 'rgba(11, 19, 38, 0.94)',
              border: `1.5px solid ${tg.color}`,
              borderRadius: 12,
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: `0 12px 28px rgba(0, 0, 0, 0.6), 0 0 16px ${tg.color}33`,
              zIndex: 20,
            }}
          >
            {/* Eyelet & Knot Rivet */}
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: tg.color,
                boxShadow: `0 0 8px ${tg.color}`,
              }}
            />
            <div
              style={{ fontSize: 14, fontWeight: 800, color: PAPER_WHITE, whiteSpace: 'nowrap' }}
            >
              {tg.label}
            </div>
          </div>
        )
      })}

      {/* Center Stress Indicator */}
      {t > 4.2 && (
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 505,
            left: 50,
            right: 50,
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 800,
            color: ROSE_ALERT,
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            padding: '6px 14px',
            borderRadius: 999,
            opacity: clamp(progress(t, 4.2, 0.4)),
            boxShadow: '0 0 20px rgba(244, 63, 94, 0.25)',
          }}
        >
          ⚠️ ۵ ثبت دستی مجزا = مغایرت حتمی بین حساب‌ها
        </div>
      )}

      {/* Bottom Kinetic Stage Banner */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 46,
          left: 28,
          right: 28,
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(244, 63, 94, 0.25)',
          borderRadius: 16,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: ROSE_ALERT,
              boxShadow: `0 0 10px ${ROSE_ALERT}`,
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 700, color: PAPER_WHITE }}>
            نتیجهٔ کار دستی: دوباره‌کاری مداوم در طول روز
          </div>
        </div>
        <div
          dir="ltr"
          style={{
            fontSize: 12,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: ROSE_ALERT,
          }}
        >
          {faNumber(5)}× REPEAT
        </div>
      </div>
    </ThreadStage>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 2: PullStraightScene (7.00–14.00s) — Winch Pull into ONE Superconductor Thread
// ═════════════════════════════════════════════════════════════════════════════

export function PullStraightScene({ t, scene }: { t: number; scene: Scene }) {
  // Tension pull timing: t=1.0 to t=2.7
  const pullProgress = ease(clamp(progress(t, 1.0, 1.7)))
  const settled = t > 2.7

  // Guitar-string vibration decay after impact (t=2.7s)
  const vibTime = Math.max(0, t - 2.7)
  const vibration = settled ? Math.exp(-3.0 * vibTime) * Math.sin(34 * vibTime) * 22 : 0

  // Winch positions
  const clampLeft = mix(160, 36, pullProgress)
  const clampRight = mix(380, 504, pullProgress)

  // Energy wave traveling down the taut thread
  const energyWaveX = (t * 400) % 540

  return (
    <ThreadStage scene={scene} t={t} shakes={[2.7]} punches={[0.15, 2.7]}>
      <ThreadHeaderLockup
        category="معماری یکپارچه // کشش و تبدیل"
        title="تبدیل پنج رشته به یک خط ممتد"
        subtitle="حسابچه تمام دفاتر را به"
        accentText="یک ریسمان نوری متصل می‌کند"
        accentColor={THREAD_TEAL}
        t={t}
      />

      {/* Main Vector Arena: The Horizontal Superconductor Thread */}
      <svg
        width={540}
        height={960}
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <defs>
          <linearGradient id="threadLinearGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={THREAD_CYAN} />
            <stop offset="50%" stopColor={THREAD_TEAL} />
            <stop offset="100%" stopColor={EMERALD_MINT} />
          </linearGradient>
        </defs>

        {/* Ambient Glow Aura around the thread */}
        <line
          x1={clampLeft}
          y1={470 + vibration}
          x2={clampRight}
          y2={470 + vibration}
          stroke="url(#threadLinearGlow)"
          strokeWidth={18}
          strokeLinecap="round"
          opacity={0.25}
          style={{ filter: `drop-shadow(0 0 24px ${THREAD_TEAL})` }}
        />

        {/* Core Luminous Superconductor Thread */}
        <line
          x1={clampLeft}
          y1={470 + vibration}
          x2={clampRight}
          y2={470 + vibration}
          stroke="url(#threadLinearGlow)"
          strokeWidth={5}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 12px ${THREAD_CYAN})` }}
        />

        {/* White Inner Hot Core */}
        <line
          x1={clampLeft}
          y1={470 + vibration}
          x2={clampRight}
          y2={470 + vibration}
          stroke={PAPER_WHITE}
          strokeWidth={1.8}
          strokeLinecap="round"
        />

        {/* High-speed Laser Energy Pulse travelling across the line */}
        {settled && (
          <circle
            cx={energyWaveX}
            cy={470 + vibration}
            r={8}
            fill={PAPER_WHITE}
            style={{ filter: `drop-shadow(0 0 16px ${THREAD_CYAN})` }}
          />
        )}

        {/* Left Mechanical Grip Jaw */}
        <rect
          x={clampLeft - 20}
          y={445 + vibration}
          width={20}
          height={50}
          rx={6}
          fill="rgba(15, 23, 42, 0.95)"
          stroke={THREAD_CYAN}
          strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 10px ${THREAD_CYAN}88)` }}
        />

        {/* Right Mechanical Grip Jaw */}
        <rect
          x={clampRight}
          y={445 + vibration}
          width={20}
          height={50}
          rx={6}
          fill="rgba(15, 23, 42, 0.95)"
          stroke={EMERALD_MINT}
          strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 10px ${EMERALD_MINT}88)` }}
        />
      </svg>

      {/* Central Typographic Callout Above the Taut Thread */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 360,
          left: 36,
          right: 36,
          textAlign: 'center',
          opacity: clamp(progress(t, 2.5, 0.5)),
          zIndex: 20,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            fontSize: 12,
            fontWeight: 800,
            color: THREAD_TEAL,
            background: 'rgba(45, 212, 191, 0.12)',
            border: '1px solid rgba(45, 212, 191, 0.35)',
            padding: '3px 12px',
            borderRadius: 999,
            marginBottom: 8,
          }}
        >
          کشش کامل // تثبیت در کسری از ثانیه
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: PAPER_WHITE,
            textShadow: '0 0 20px rgba(45, 212, 191, 0.4)',
          }}
        >
          یک مسیر پیوسته و بدون انقطاع
        </div>
      </div>

      {/* Dual Comparative Badges Below the Thread (Direct Stage Placement) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 550,
          left: 28,
          right: 28,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          opacity: clamp(progress(t, 2.9, 0.5)),
          zIndex: 20,
        }}
      >
        {/* Left Status: Before */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 14,
            padding: '14px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: ROSE_ALERT, marginBottom: 4 }}>
            دفاتر سنتی
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: PAPER_WHITE }}>
            {faNumber(5)} ثبت موازی
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>احتمال خطای بالا</div>
        </div>

        {/* Right Status: After */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1.5px solid rgba(45, 212, 191, 0.5)',
            borderRadius: 14,
            padding: '14px',
            textAlign: 'center',
            boxShadow: '0 0 20px rgba(45, 212, 191, 0.15)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: THREAD_TEAL, marginBottom: 4 }}>
            موتور حسابچه
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: PAPER_WHITE }}>
            {faNumber(1)} خط ممتد
          </div>
          <div style={{ fontSize: 11, color: EMERALD_MINT, marginTop: 4 }}>۱۰۰٪ خودکار و آنی</div>
        </div>
      </div>

      {/* Bottom Summary Bar */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 46,
          left: 28,
          right: 28,
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(45, 212, 191, 0.3)',
          borderRadius: 16,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: EMERALD_MINT,
              boxShadow: `0 0 10px ${EMERALD_MINT}`,
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 700, color: PAPER_WHITE }}>
            یکپارچگی مطلق: حذف خطای ورود مکرر داده
          </div>
        </div>
        <div
          dir="ltr"
          style={{
            fontSize: 12,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: THREAD_TEAL,
          }}
        >
          ACTIVE_LINE
        </div>
      </div>
    </ThreadStage>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 3: BeadsScene (14.00–21.50s) — The Vertical Rosary Abacus & 5 Luminous Orbs
// ═════════════════════════════════════════════════════════════════════════════

export function BeadsScene({ t, scene }: { t: number; scene: Scene }) {
  // 5 Orbs sliding onto the vertical thread (cues at 0.9, 1.5, 2.1, 2.7, 3.3s)
  const beads = [
    { label: 'فاکتور فروش', at: 0.9, y: 220, color: THREAD_CYAN, sub: 'ثبت کلید خورد' },
    { label: 'کاردکس انبار', at: 1.5, y: 340, color: THREAD_TEAL, sub: 'موجودی کسر شد' },
    { label: 'دفتر کل', at: 2.1, y: 460, color: '#818cf8', sub: 'سند دوبل خورد' },
    { label: 'حساب مشتری', at: 2.7, y: 580, color: THREAD_GOLD, sub: 'بدهی ثبت شد' },
    { label: 'سود واقعی', at: 3.3, y: 700, color: EMERALD_MINT, sub: 'محاسبهٔ آنی سود' },
  ]

  const chimeShockwave = popSpring(t, 3.3, 0.7)
  const pulseTravelY = t > 3.3 ? mix(200, 750, clamp(progress(t, 3.3, 1.2))) : -50

  return (
    <ThreadStage scene={scene} t={t} shakes={[3.3]} punches={[0.1, 3.3]}>
      <ThreadHeaderLockup
        category="هماهنگی پنج‌گانه // نخ تسبیح"
        title="یک ثبت = پنج مقصد هم‌زمان"
        subtitle="هر فروش یک ثبت است؛ و همان یک ثبت،"
        accentText="پنج جا را با هم به‌روز می‌کند"
        accentColor={THREAD_CYAN}
        t={t}
      />

      {/* Main Vertical Spine Canvas */}
      <svg
        width={540}
        height={960}
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <defs>
          <linearGradient id="verticalSpineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={THREAD_CYAN} />
            <stop offset="50%" stopColor={THREAD_TEAL} />
            <stop offset="100%" stopColor={EMERALD_MINT} />
          </linearGradient>
        </defs>

        {/* Central Vertical Luminous Cord (x = 270) */}
        <line
          x1={270}
          y1={170}
          x2={270}
          y2={760}
          stroke="url(#verticalSpineGrad)"
          strokeWidth={14}
          strokeLinecap="round"
          opacity={0.25}
          style={{ filter: `drop-shadow(0 0 20px ${THREAD_CYAN})` }}
        />
        <line
          x1={270}
          y1={170}
          x2={270}
          y2={760}
          stroke="url(#verticalSpineGrad)"
          strokeWidth={4.5}
          strokeLinecap="round"
        />
        <line
          x1={270}
          y1={170}
          x2={270}
          y2={760}
          stroke={PAPER_WHITE}
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* Chime Shockwave traveling down the spine */}
        {t > 3.3 && (
          <circle
            cx={270}
            cy={pulseTravelY}
            r={24 * (1 + 0.5 * chimeShockwave)}
            fill="none"
            stroke={EMERALD_MINT}
            strokeWidth={3}
            opacity={0.8}
            style={{ filter: `drop-shadow(0 0 16px ${EMERALD_MINT})` }}
          />
        )}
      </svg>

      {/* 5 Macro Optical Glass Spheres & Floating Milestone Callouts */}
      {beads.map((b, idx) => {
        const enter = clamp(progress(t, b.at, 0.45))
        const s = popSpring(t, b.at, 0.5)
        const isLeft = idx % 2 === 0
        const active = t >= b.at

        return (
          <React.Fragment key={b.label}>
            {/* The Spherical Glass Bead on the Thread (x = 270, y = b.y) */}
            <div
              style={{
                position: 'absolute',
                left: 270,
                top: b.y,
                width: 44,
                height: 44,
                borderRadius: '50%',
                transform: `translate(-50%, -50%) scale(${mix(0.3, 1, s)})`,
                opacity: enter,
                background: `radial-gradient(circle at 35% 35%, #ffffff, ${b.color} 55%, rgba(10, 20, 35, 0.95) 90%)`,
                boxShadow: `0 0 20px ${b.color}aa, inset 0 0 10px rgba(255, 255, 255, 0.8)`,
                border: `2px solid ${b.color}`,
                zIndex: 25,
              }}
            >
              {/* Inner Specular Glint */}
              <div
                style={{
                  position: 'absolute',
                  left: 10,
                  top: 8,
                  width: 10,
                  height: 6,
                  borderRadius: '50%',
                  background: '#ffffff',
                  opacity: 0.85,
                  transform: 'rotate(-30deg)',
                }}
              />
            </div>

            {/* Alternating Typographic Callout attached to the Bead */}
            <div
              dir={isLeft ? 'rtl' : 'ltr'}
              style={{
                position: 'absolute',
                left: isLeft ? 48 : 316,
                top: b.y,
                transform: 'translateY(-50%)',
                width: 176,
                textAlign: isLeft ? 'start' : 'start',
                opacity: enter,
                zIndex: 20,
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  color: PAPER_WHITE,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{b.label}</span>
                {active && <span style={{ fontSize: 12, color: b.color, fontWeight: 800 }}>✓</span>}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: b.color, marginTop: 2 }}>
                {b.sub}
              </div>
            </div>
          </React.Fragment>
        )
      })}

      {/* Bottom Central Flash Indicator (Appears when all 5 are linked) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 46,
          left: 28,
          right: 28,
          background: 'rgba(15, 23, 42, 0.9)',
          border: `1.5px solid ${t > 3.3 ? EMERALD_MINT : 'rgba(56, 189, 248, 0.3)'}`,
          borderRadius: 16,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: t > 3.3 ? `0 0 28px ${EMERALD_MINT}44` : 'none',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: t > 3.3 ? EMERALD_MINT : THREAD_CYAN,
              boxShadow: `0 0 12px ${t > 3.3 ? EMERALD_MINT : THREAD_CYAN}`,
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 800, color: PAPER_WHITE }}>
            {t > 3.3 ? '✓ پنج گره به‌طور هم‌زمان به‌روز شدند' : 'در حال انتظار اتصال...'}
          </div>
        </div>
        <div
          dir="ltr"
          style={{
            fontSize: 12,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: t > 3.3 ? EMERALD_MINT : THREAD_CYAN,
          }}
        >
          {faNumber(5)}/۵_SYNCED
        </div>
      </div>
    </ThreadStage>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 4: ThreadHoldsScene (21.50–28.50s) — Offline Laser Shear Test: Elastic Hold
// ═════════════════════════════════════════════════════════════════════════════

export function ThreadHoldsScene({ t, scene }: { t: number; scene: Scene }) {
  // Blade drops at t=1.0s (alert cue)
  // Tension rebound at t=3.5s (success cue)
  const isStruck = t >= 1.0
  const isRecovered = t >= 3.5

  // Catenary sag depth
  let sag = 0
  if (isStruck && !isRecovered) {
    const press = ease(clamp(progress(t, 1.0, 0.6)))
    sag = mix(0, 110, press)
  } else if (isRecovered) {
    const recTime = Math.max(0, t - 3.5)
    sag = Math.exp(-3.5 * recTime) * Math.sin(26 * recTime) * 35
  }

  // Blade position
  let bladeY = 240
  if (isStruck && !isRecovered) {
    bladeY = mix(240, 470 + sag, ease(clamp(progress(t, 1.0, 0.6))))
  } else if (isRecovered) {
    bladeY = mix(470, 200, clamp(progress(t, 3.5, 0.4)))
  }

  const threadColor = isRecovered ? THREAD_GOLD : isStruck ? ROSE_ALERT : THREAD_TEAL

  return (
    <ThreadStage scene={scene} t={t} shakes={[1.0]} punches={[0.2, 1.0, 3.5]}>
      <ThreadHeaderLockup
        category="تاب‌آوری و کارکرد آفلاین // پایداری مطلق"
        title="اینترنت قطع شود، نخ پاره نمی‌شود!"
        subtitle="تراکنش متوقف نمی‌شود؛"
        accentText="داده‌ها در حافظه امن قفل می‌شوند"
        accentColor={isRecovered ? THREAD_GOLD : ROSE_ALERT}
        t={t}
      />

      {/* Main Vector Stage: Curved Elastic Catenary Thread & Descending Blade */}
      <svg
        width={540}
        height={960}
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <defs>
          <linearGradient id="bladeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(244, 63, 94, 0.2)" />
            <stop offset="100%" stopColor={ROSE_ALERT} />
          </linearGradient>
        </defs>

        {/* The Elastic Hanging Thread (Parabolic sag curve) */}
        <path
          d={`M 40 470 Q 270 ${470 + sag * 1.7} 500 470`}
          fill="none"
          stroke={threadColor}
          strokeWidth={14}
          strokeLinecap="round"
          opacity={0.25}
          style={{ filter: `drop-shadow(0 0 20px ${threadColor})` }}
        />
        <path
          d={`M 40 470 Q 270 ${470 + sag * 1.7} 500 470`}
          fill="none"
          stroke={threadColor}
          strokeWidth={5}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 12px ${threadColor})` }}
        />
        <path
          d={`M 40 470 Q 270 ${470 + sag * 1.7} 500 470`}
          fill="none"
          stroke={PAPER_WHITE}
          strokeWidth={1.8}
          strokeLinecap="round"
        />

        {/* Laser Shear Blade (Descending V-shape) */}
        {!isRecovered && (
          <g transform={`translate(270, ${bladeY})`}>
            {/* Blade body */}
            <path
              d="M -30 -120 L 30 -120 L 15 -10 L 0 0 L -15 -10 Z"
              fill="url(#bladeGrad)"
              stroke={ROSE_ALERT}
              strokeWidth={2}
              style={{ filter: `drop-shadow(0 0 16px ${ROSE_ALERT})` }}
            />
            {/* Impact Spark Emitter */}
            {isStruck && sag > 20 && (
              <>
                <circle cx={0} cy={0} r={12} fill={PAPER_WHITE} />
                <line x1={-25} y1={-15} x2={-45} y2={-30} stroke={THREAD_GOLD} strokeWidth={2} />
                <line x1={25} y1={-15} x2={45} y2={-30} stroke={THREAD_GOLD} strokeWidth={2} />
                <line x1={0} y1={-20} x2={0} y2={-45} stroke={PAPER_WHITE} strokeWidth={2} />
              </>
            )}
          </g>
        )}

        {/* Terminal Anchors */}
        <circle
          cx={40}
          cy={470}
          r={9}
          fill="rgba(15, 23, 42, 0.95)"
          stroke={threadColor}
          strokeWidth={2.5}
        />
        <circle
          cx={500}
          cy={470}
          r={9}
          fill="rgba(15, 23, 42, 0.95)"
          stroke={threadColor}
          strokeWidth={2.5}
        />
      </svg>

      {/* Floating Status Warning Beacon in Center */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 610,
          left: 36,
          right: 36,
          textAlign: 'center',
          opacity: clamp(progress(t, 1.2, 0.4)),
          zIndex: 20,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 800,
            color: isRecovered ? THREAD_GOLD : ROSE_ALERT,
            background: isRecovered ? 'rgba(251, 191, 36, 0.14)' : 'rgba(244, 63, 94, 0.14)',
            border: `1px solid ${isRecovered ? THREAD_GOLD : ROSE_ALERT}66`,
            padding: '6px 16px',
            borderRadius: 999,
            boxShadow: `0 0 20px ${isRecovered ? THREAD_GOLD : ROSE_ALERT}33`,
            marginBottom: 8,
          }}
        >
          <span>
            {isRecovered ? '✓ نخ پاره نشد — تراکنش ایمن است' : '⚡ اینترنت قطع شد (حالت آفلاین)'}
          </span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color: PAPER_WHITE }}>
          {isRecovered
            ? 'ارسال خودکار به محض اتصال مجدد'
            : 'ذخیره در پایگاه دادهٔ محلی رمزنگاری‌شده'}
        </div>
      </div>

      {/* Bottom Summary Bar */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 46,
          left: 28,
          right: 28,
          background: 'rgba(15, 23, 42, 0.85)',
          border: `1px solid ${isRecovered ? THREAD_GOLD : 'rgba(244, 63, 94, 0.35)'}`,
          borderRadius: 16,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isRecovered ? THREAD_GOLD : ROSE_ALERT,
              boxShadow: `0 0 10px ${isRecovered ? THREAD_GOLD : ROSE_ALERT}`,
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 700, color: PAPER_WHITE }}>
            کارکرد بدون اینترنت: صندوق حتی یک ثانیه معطل نمی‌ماند
          </div>
        </div>
        <div
          dir="ltr"
          style={{
            fontSize: 12,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: isRecovered ? THREAD_GOLD : ROSE_ALERT,
          }}
        >
          {isRecovered ? 'VAULT_LOCKED' : 'OFFLINE_HOLD'}
        </div>
      </div>
    </ThreadStage>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 5: ThreadLedgerScene (28.50–36.00s) — Real Financial Numbers on the Thread
// ═════════════════════════════════════════════════════════════════════════════

export function ThreadLedgerScene({ t, scene }: { t: number; scene: Scene }) {
  // 4 Financial Milestones branching off the central spinal thread
  // Cues at 0.5, 1.4, 2.3s
  const milestones = [
    {
      label: 'فروش کل روز',
      amount: faNumber(12450000),
      sub: 'تایید خودکار در دفتر فروش',
      color: THREAD_CYAN,
      at: 0.5,
      y: 220,
      side: 'right',
    },
    {
      label: 'کسر از انبار',
      amount: `- ${faNumber(12)} قلم`,
      sub: 'کاردکس زنده بدون مغایرت',
      color: THREAD_TEAL,
      at: 1.2,
      y: 360,
      side: 'left',
    },
    {
      label: 'طلب ثبت‌شده',
      amount: faNumber(3200000),
      sub: 'حساب مشتری با تاریخ سررسید',
      color: THREAD_GOLD,
      at: 1.9,
      y: 500,
      side: 'right',
    },
    {
      label: 'سود خالص واقعی',
      amount: `+ ${faNumber(2840000)}`,
      sub: 'بر اساس بهای تمام‌شده قطعی',
      color: EMERALD_MINT,
      at: 2.6,
      y: 640,
      side: 'left',
    },
  ]

  // Continuous laser energy pulse traveling vertically
  const pulseY = mix(160, 740, (t * 0.45) % 1)

  return (
    <ThreadStage scene={scene} t={t} shakes={[2.3]} punches={[0.1, 2.3]}>
      <ThreadHeaderLockup
        category="استخراج اعداد واقعی // ستون فقرات دفتر"
        title="عددهای واقعی سر جایشان می‌نشینند"
        subtitle="فروش، طلب، سود؛"
        accentText="همه از همان یک مسیر واحد می‌آیند"
        accentColor={EMERALD_MINT}
        t={t}
      />

      {/* Main Canvas: Central Spinal Cord & Horizontal Laser Tether Arms */}
      <svg
        width={540}
        height={960}
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <defs>
          <linearGradient id="spineLedgerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={THREAD_CYAN} />
            <stop offset="50%" stopColor={THREAD_TEAL} />
            <stop offset="100%" stopColor={EMERALD_MINT} />
          </linearGradient>
        </defs>

        {/* Central Spinal Vertical Cord (x = 270) */}
        <line
          x1={270}
          y1={170}
          x2={270}
          y2={720}
          stroke="url(#spineLedgerGrad)"
          strokeWidth={14}
          strokeLinecap="round"
          opacity={0.25}
          style={{ filter: `drop-shadow(0 0 20px ${THREAD_TEAL})` }}
        />
        <line
          x1={270}
          y1={170}
          x2={270}
          y2={720}
          stroke="url(#spineLedgerGrad)"
          strokeWidth={4.5}
          strokeLinecap="round"
        />
        <line
          x1={270}
          y1={170}
          x2={270}
          y2={720}
          stroke={PAPER_WHITE}
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* Traveling Energy Ring */}
        <circle
          cx={270}
          cy={pulseY}
          r={16}
          fill="none"
          stroke={PAPER_WHITE}
          strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 12px ${EMERALD_MINT})` }}
        />

        {/* Horizontal Laser Tether Arms */}
        {milestones.map((m) => {
          const enter = clamp(progress(t, m.at, 0.4))
          const isRight = m.side === 'right'
          const targetX = isRight ? 360 : 180
          return (
            <g key={m.label} opacity={enter}>
              {/* Connector Pin in Center */}
              <circle
                cx={270}
                cy={m.y}
                r={6}
                fill={m.color}
                style={{ filter: `drop-shadow(0 0 8px ${m.color})` }}
              />
              {/* Horizontal Tether Line */}
              <line
                x1={270}
                y1={m.y}
                x2={mix(270, targetX, enter)}
                y2={m.y}
                stroke={m.color}
                strokeWidth={2}
                strokeDasharray="4 3"
              />
            </g>
          )
        })}
      </svg>

      {/* Floating Typographic Milestones (Directly on canvas, NO heavy cards!) */}
      {milestones.map((m) => {
        const enter = clamp(progress(t, m.at, 0.45))
        const s = popSpring(t, m.at, 0.5)
        const isRight = m.side === 'right'

        return (
          <div
            key={m.label}
            dir="rtl"
            style={{
              position: 'absolute',
              top: m.y,
              left: isRight ? 310 : 36,
              right: isRight ? 36 : 310,
              transform: `translateY(-50%) scale(${mix(0.85, 1, s)})`,
              opacity: enter,
              textAlign: isRight ? 'start' : 'start',
              zIndex: 20,
            }}
          >
            {/* Tag Badge */}
            <div
              style={{
                display: 'inline-block',
                fontSize: 11,
                fontWeight: 800,
                color: m.color,
                background: `${m.color}16`,
                border: `1px solid ${m.color}44`,
                padding: '2px 8px',
                borderRadius: 6,
                marginBottom: 4,
              }}
            >
              {m.label}
            </div>

            {/* Massive Amount Number */}
            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                color: PAPER_WHITE,
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                textShadow: `0 0 16px ${m.color}66`,
              }}
            >
              {m.amount}
            </div>

            {/* Subtitle Descriptor */}
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: TEXT_MUTED,
                marginTop: 2,
              }}
            >
              {m.sub}
            </div>
          </div>
        )
      })}

      {/* Bottom Summary Bar */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 46,
          left: 28,
          right: 28,
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1.5px solid rgba(16, 185, 129, 0.4)',
          borderRadius: 16,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 0 24px rgba(16, 185, 129, 0.2)',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: EMERALD_MINT,
              boxShadow: `0 0 12px ${EMERALD_MINT}`,
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 800, color: PAPER_WHITE }}>
            یک منبع حقیقت: حساب‌ها بدون یک ریال مغایرت
          </div>
        </div>
        <div
          dir="ltr"
          style={{
            fontSize: 12,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: EMERALD_MINT,
          }}
        >
          {faNumber(100)}%_AUDIT_PASS
        </div>
      </div>
    </ThreadStage>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 6: ThreadCtaScene (36.00–42.00s) — Closed Mobius Loop & Tactile CTA
// ═════════════════════════════════════════════════════════════════════════════

export function ThreadCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.15, 0.6))
  const ctaPop = popSpring(t, 2.4, 0.6)

  // Rotating 2.5D Mobius Loop
  const loopRot = (t * 24) % 360

  return (
    <ThreadStage scene={scene} t={t} shakes={[2.4]} punches={[0.2, 2.4]}>
      {/* Top Header */}
      <ThreadHeaderLockup
        category="حسابداری نسل نو // جمع‌بندی"
        title="حسابچه؛ یک خط به‌جای پنج دفتر"
        subtitle="شروع ساده در ۳ دقیقه،"
        accentText="بدون نیاز به دانش حسابداری"
        accentColor={EMERALD_MINT}
        t={t}
      />

      {/* Main Stage: The Endless Mobius Knot / Loop */}
      <div
        style={{
          position: 'absolute',
          top: 250,
          left: 0,
          right: 0,
          height: 320,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          perspective: 800,
          zIndex: 20,
        }}
      >
        <svg
          width={340}
          height={260}
          viewBox="0 0 340 260"
          style={{
            transform: `rotateY(${Math.sin(t * 1.5) * 14}deg) rotateZ(${loopRot}deg)`,
          }}
        >
          <defs>
            <linearGradient id="mobiusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={THREAD_CYAN} />
              <stop offset="35%" stopColor={THREAD_TEAL} />
              <stop offset="70%" stopColor={THREAD_GOLD} />
              <stop offset="100%" stopColor={EMERALD_MINT} />
            </linearGradient>
          </defs>

          {/* Glowing Infinity / Mobius Ribbon */}
          <path
            d="M 80 130 C 80 60, 150 60, 170 130 C 190 200, 260 200, 260 130 C 260 60, 190 60, 170 130 C 150 200, 80 200, 80 130 Z"
            fill="none"
            stroke="url(#mobiusGrad)"
            strokeWidth={14}
            strokeLinecap="round"
            opacity={0.3}
            style={{ filter: `drop-shadow(0 0 24px ${THREAD_TEAL})` }}
          />
          <path
            d="M 80 130 C 80 60, 150 60, 170 130 C 190 200, 260 200, 260 130 C 260 60, 190 60, 170 130 C 150 200, 80 200, 80 130 Z"
            fill="none"
            stroke="url(#mobiusGrad)"
            strokeWidth={5}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 12px ${THREAD_CYAN})` }}
          />
          <path
            d="M 80 130 C 80 60, 150 60, 170 130 C 190 200, 260 200, 260 130 C 260 60, 190 60, 170 130 C 150 200, 80 200, 80 130 Z"
            fill="none"
            stroke={PAPER_WHITE}
            strokeWidth={1.8}
            strokeLinecap="round"
          />

          {/* Center Orb */}
          <circle
            cx={170}
            cy={130}
            r={10}
            fill={PAPER_WHITE}
            style={{ filter: `drop-shadow(0 0 16px ${THREAD_GOLD})` }}
          />
        </svg>
      </div>

      {/* Feature Pillar Badges */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 570,
          left: 36,
          right: 36,
          display: 'flex',
          justifyContent: 'center',
          gap: 10,
          opacity: enter,
          zIndex: 20,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: THREAD_TEAL,
            background: 'rgba(45, 212, 191, 0.12)',
            border: '1px solid rgba(45, 212, 191, 0.35)',
            padding: '5px 12px',
            borderRadius: 8,
          }}
        >
          ✓ بدون نیاز به اینترنت
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: THREAD_GOLD,
            background: 'rgba(251, 191, 36, 0.12)',
            border: '1px solid rgba(251, 191, 36, 0.35)',
            padding: '5px 12px',
            borderRadius: 8,
          }}
        >
          ✓ همگام‌سازی بلادرنگ
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: EMERALD_MINT,
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            padding: '5px 12px',
            borderRadius: 8,
          }}
        >
          ✓ پشتیبانی کامل موبایل
        </span>
      </div>

      {/* Tactile Glowing CTA Button */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 670,
          left: 40,
          right: 40,
          transform: `scale(${mix(0.85, 1, ctaPop)})`,
          opacity: clamp(progress(t, 2.0, 0.5)),
          zIndex: 25,
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${THREAD_TEAL}, ${EMERALD_MINT})`,
            borderRadius: 18,
            padding: '18px 24px',
            textAlign: 'center',
            boxShadow: `0 16px 40px ${EMERALD_MINT}66, 0 0 24px ${THREAD_TEAL}44`,
            border: '1.5px solid rgba(255, 255, 255, 0.4)',
          }}
        >
          <div
            style={{
              fontSize: 19,
              fontWeight: 900,
              color: '#021015',
              letterSpacing: '-0.01em',
              marginBottom: 4,
            }}
          >
            همین حالا رایگان شروع کن
          </div>
          <div
            dir="ltr"
            style={{
              fontSize: 13,
              fontWeight: 800,
              fontFamily: "'JetBrains Mono', monospace",
              color: '#04222a',
              letterSpacing: '0.08em',
            }}
          >
            HISABCHE.COM
          </div>
        </div>
      </div>

      {/* Bottom Legal / Trust Tag */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 46,
          left: 28,
          right: 28,
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 700,
          color: TEXT_MUTED,
          opacity: enter,
          zIndex: 20,
        }}
      >
        یک خط ممتد برای تمام امور مالی فروشگاه شما
      </div>
    </ThreadStage>
  )
}
