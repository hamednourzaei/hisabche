// ============================================
// Reel 93 — «عدد داخل مه — سود واقعی پشت صد فاکتور»
// Bespoke Motion Engine: LiDAR Prism & Volumetric Profit Beacon
// (سامانه لایدار فوتونیک و منشور شکست مه مالی)
//
// 100% Dark Studio Theme (Obsidian & Volumetric Fog / Cyan Laser / Incandescent Gold)
// Zero-overlap certified geometry (Canvas: 540x960, disjoint vertical bands)
// Deterministic numerals via faNumber.
//
// Persistent arithmetic:
//   ۲٬۴۶۰٬۰۰۰ فروش − ۱٬۶۲۰٬۰۰۰ بهای تمام‌شده − ۳۸۵٬۰۰۰ خرج = ۴۵۵٬۰۰۰ سود خالص
// ============================================

import type { ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

type SceneProps = { t: number; scene: Scene }

// ─── Tokens (Obsidian Volumetric Palette) ────────────────────────────────────
export const FOG_NIGHT = '#05080e'
export const FOG_GREY = '#0c121e'
export const MIST_BLUE = '#94a3b8'
export const FOG_AMBER = '#f59e0b'
export const REVEAL_CREAM = '#f8fafc'
export const DEEP_TEAL = '#06b6d4'
export const LASER_CYAN = '#38bdf8'
export const PROFIT_GOLD = '#fbbf24'
export const COST_ROSE = '#f43f5e'
export const BORDER_SUBTLE = 'rgba(255, 255, 255, 0.08)'

/** Pinned 540x960 LTR Stage with procedural atmospheric mist particles */
export function DuskFogStage({ t, children }: { scene?: Scene; t: number; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: 540,
        height: 960,
        backgroundColor: FOG_NIGHT,
        color: '#f8fafc',
        fontFamily: 'Vazirmatn, system-ui, sans-serif',
        overflow: 'hidden',
        direction: 'ltr',
      }}
    >
      {/* Volumetric Radial Glows */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(650px 420px at 50% 40%, rgba(245, 158, 11, 0.07), transparent 70%), radial-gradient(550px 380px at 50% 80%, rgba(6, 182, 212, 0.05), transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Atmospheric Mist Drift Particles */}
      <svg
        width="540"
        height="960"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.25 }}
      >
        {[...Array(18)].map((_, i) => {
          const x = (i * 32 + ((i * 17) % 50)) % 540
          const baseY = 120 + i * 44
          const driftY = baseY + Math.sin(t * 0.8 + i) * 16
          const r = 2.5 + (i % 4) * 1.5
          return (
            <circle
              key={i}
              cx={x}
              cy={driftY}
              r={r}
              fill={i % 2 === 0 ? '#38bdf8' : '#fbbf24'}
              opacity={0.3 + (i % 5) * 0.12}
              style={{ filter: 'blur(3px)' }}
            />
          )
        })}
      </svg>

      {/* Top Fixed Telemetry Bar (Y: 48..86) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 48,
          left: 40,
          right: 40,
          height: 38,
          borderBottom: `1px solid ${BORDER_SUBTLE}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 13,
          fontWeight: 600,
          color: MIST_BLUE,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#f59e0b',
              boxShadow: '0 0 10px #f59e0b',
            }}
          />
          <span>رصد سود واقعی کسب‌وکار</span>
        </div>
        <span
          style={{ fontFamily: 'monospace', fontSize: 11, color: LASER_CYAN, letterSpacing: 1 }}
        >
          LIDAR_PROFIT // V93
        </span>
      </div>

      {/* Safe Stage Container */}
      {children}

      {/* Bottom Fixed Telemetry Footer (Y: 884..920) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 40,
          left: 40,
          right: 40,
          height: 36,
          borderTop: `1px solid ${BORDER_SUBTLE}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: '#64748b',
          zIndex: 20,
        }}
      >
        <span>حسابچه · شفافیت مالی در پایان روز</span>
        <span style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: 0.5 }}>
          AUDIT: [REVENUE → NET_PROFIT]
        </span>
      </div>
    </div>
  )
}

/** Standard Scene Header Cluster at Y = 150..220 (Disjoint, zero overlap) */
function SceneHeader({
  badge,
  badgeColor,
  title,
  opacity = 1,
  translateY = 0,
}: {
  badge: string
  badgeColor: string
  title: string
  opacity?: number
  translateY?: number
}) {
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        top: 150,
        left: 40,
        right: 40,
        height: 70,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 6,
        opacity,
        transform: `translateY(${translateY}px)`,
        zIndex: 25,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 999,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: `1px solid ${badgeColor}`,
          fontSize: 13,
          fontWeight: 700,
          color: badgeColor,
        }}
      >
        {badge}
      </div>
      <div
        style={{
          fontSize: 27,
          fontWeight: 900,
          color: '#ffffff',
          lineHeight: 1.3,
        }}
      >
        {title}
      </div>
    </div>
  )
}

/** Bottom Insight Banner at Y = 685..745 */
function BottomBanner({
  text,
  color = LASER_CYAN,
  opacity = 1,
}: {
  text: string
  color?: string
  opacity?: number
}) {
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        top: 685,
        left: 40,
        right: 40,
        height: 55,
        borderRadius: 12,
        backgroundColor: 'rgba(12, 18, 30, 0.85)',
        border: `1px solid ${BORDER_SUBTLE}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 16px',
        fontSize: 15,
        fontWeight: 700,
        color,
        opacity,
        zIndex: 25,
      }}
    >
      {text}
    </div>
  )
}

/** Backward compatibility helper for registry */
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
  accentWord?: string
  accentColor?: string
}) {
  const p = ease(clamp(progress(t, cueAt, cueAt + 0.6)))
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        top: y,
        left: 40,
        right: 40,
        display: 'flex',
        justifyContent: 'center',
        gap: '0.4em',
        opacity: p,
        transform: `translateY(${(1 - p) * 12}px)`,
        fontSize: size,
        fontWeight: 900,
        color: REVEAL_CREAM,
        zIndex: 25,
      }}
    >
      {words.map((w) => (
        <span key={w} style={{ color: w === accentWord ? accentColor : REVEAL_CREAM }}>
          {w}
        </span>
      ))}
    </div>
  )
}

// ============================================
// SCENE 1: FogNumberScene (0–8s) — The Obscured Profit Beacon in Fog
// ============================================
export function FogNumberScene({ t, scene }: SceneProps) {
  const enter = clamp(progress(t, 0, 0.8), 0, 1)
  const pulse = Math.sin(t * 2.2) * 8
  const ringScale = 1 + (t % 2.5) * 0.4
  const ringOpacity = Math.max(0, 1 - (t % 2.5) / 2.5)
  const blurPx = Math.max(14, 28 - t * 1.5)

  return (
    <DuskFogStage scene={scene} t={t}>
      <SceneHeader
        badge="ابهام مالی پایان روز"
        badgeColor={FOG_AMBER}
        title="امشب چقدر سود واقعی داری؟"
        opacity={enter}
      />

      {/* Center Obscured Beacon Chamber (Y: 270..590) */}
      <div
        style={{
          position: 'absolute',
          top: 280,
          left: 50,
          right: 50,
          height: 320,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Pulsing Sonar Rings */}
        <svg
          width="320"
          height="320"
          viewBox="0 0 320 320"
          style={{ position: 'absolute', inset: 0 }}
        >
          <circle
            cx="160"
            cy="160"
            r={100}
            fill="none"
            stroke="rgba(245, 158, 11, 0.15)"
            strokeWidth="1.5"
          />
          <circle
            cx="160"
            cy="160"
            r={80 * ringScale}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeDasharray="6 8"
            opacity={ringOpacity * 0.7}
          />
          <circle
            cx="160"
            cy="160"
            r={65}
            fill={FOG_GREY}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
        </svg>

        {/* Blurred Mysterious Numeric Core */}
        <div
          style={{
            fontSize: 68 + pulse * 0.2,
            fontWeight: 900,
            lineHeight: 1,
            color: PROFIT_GOLD,
            filter: `blur(${blurPx.toFixed(1)}px)`,
            textShadow: '0 0 45px rgba(245, 158, 11, 0.6)',
            userSelect: 'none',
            zIndex: 10,
          }}
        >
          {faNumber(455000)}
        </div>

        <div
          dir="rtl"
          style={{
            marginTop: 24,
            fontSize: 14,
            fontWeight: 700,
            color: MIST_BLUE,
            zIndex: 10,
          }}
        >
          سیگنال مبهم در میان تراکنش‌ها
        </div>
      </div>

      <BottomBanner text="سودی که در مه دخل و فاکتورها ناپدید شده" color="#fbbf24" />
    </DuskFogStage>
  )
}

// ============================================
// SCENE 2: PaperWallScene (8–16s) — The Acrylic Invoice Cascade
// ============================================
export function PaperWallScene({ t, scene }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.6), 0, 1))

  // 3 Floating Glass Invoice Panes
  const p1 = clamp(progress(t, 0.3, 1.2), 0, 1)
  const p2 = clamp(progress(t, 1.1, 2.0), 0, 1)
  const p3 = clamp(progress(t, 1.9, 2.8), 0, 1)

  return (
    <DuskFogStage scene={scene} t={t}>
      <SceneHeader
        badge="طوفان اسناد و فاکتورها"
        badgeColor={COST_ROSE}
        title="سود واقعی پشت برگه‌ها گم است!"
        opacity={enter}
      />

      {/* Floating Acrylic Panes Stack (Y: 260..590) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 260,
          left: 40,
          right: 40,
          height: 350,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Pane 1: فاکتورهای فروش */}
        <div
          style={{
            height: 94,
            backgroundColor: 'rgba(20, 29, 45, 0.85)',
            backdropFilter: 'blur(12px)',
            borderRadius: 14,
            border: `1.5px solid rgba(56, 189, 248, 0.35)`,
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: p1,
            transform: `translateY(${(1 - p1) * 24}px) rotate(${Math.sin(t + 1) * 1.2}deg)`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
              فاکتور فروش شماره ۱۰۸
            </span>
            <span style={{ fontSize: 13, color: MIST_BLUE }}>جریان فروش ثبت‌شده در سیستم</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, color: LASER_CYAN }}>
            {faNumber(2460000)}
          </span>
        </div>

        {/* Pane 2: حواله‌های خرید کالا */}
        <div
          style={{
            height: 94,
            backgroundColor: 'rgba(20, 29, 45, 0.85)',
            backdropFilter: 'blur(12px)',
            borderRadius: 14,
            border: `1.5px solid rgba(245, 158, 11, 0.35)`,
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: p2,
            transform: `translateY(${(1 - p2) * 24}px) rotate(${Math.cos(t + 2) * 1.2}deg)`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
              حواله خرید و بهای انبار
            </span>
            <span style={{ fontSize: 13, color: MIST_BLUE }}>بهای تمام‌شده کالای فروش‌رفته</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, color: FOG_AMBER }}>
            {faNumber(1620000)}
          </span>
        </div>

        {/* Pane 3: فیش هزینه‌های جاری */}
        <div
          style={{
            height: 94,
            backgroundColor: 'rgba(20, 29, 45, 0.85)',
            backdropFilter: 'blur(12px)',
            borderRadius: 14,
            border: `1.5px solid rgba(244, 63, 94, 0.35)`,
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: p3,
            transform: `translateY(${(1 - p3) * 24}px) rotate(${Math.sin(t + 3) * 1.2}deg)`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
              قبض و هزینه‌های جاری
            </span>
            <span style={{ fontSize: 13, color: MIST_BLUE }}>کرایه، دستمزد و مخارج روزانه</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, color: COST_ROSE }}>
            {faNumber(385000)}
          </span>
        </div>
      </div>

      <BottomBanner text="فروش بالا داری، اما سود خالص ناپیداست!" color="#f87171" />
    </DuskFogStage>
  )
}

// ============================================
// SCENE 3: PartClearScene (16–25s) — The LiDAR Laser Sweep & Fog De-noising
// ============================================
export function PartClearScene({ t, scene }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.6), 0, 1))

  // Laser sweep progress
  const sweep = clamp(progress(t, 0.8, 6.5), 0, 1)
  const laserY = 260 + sweep * 340
  const clarityPercent = Math.min(100, Math.round(52 + sweep * 47))
  const blurPx = Math.max(0, (1 - sweep) * 14)

  return (
    <DuskFogStage scene={scene} t={t}>
      <SceneHeader
        badge="اسکن فرکانسی حسابچه"
        badgeColor={DEEP_TEAL}
        title="برگه‌ها کنار می‌روند؛ مه باز می‌شود"
        opacity={enter}
      />

      {/* Center De-noising Core Chamber (Y: 260..590) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 260,
          left: 40,
          right: 40,
          height: 350,
          backgroundColor: FOG_GREY,
          borderRadius: 16,
          border: `1.5px solid rgba(6, 182, 212, 0.35)`,
          boxShadow: '0 0 35px rgba(6, 182, 212, 0.15)',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: LASER_CYAN }}>
          تفکیک خودکار بهای تمام‌شده و هزینه‌ها
        </div>

        {/* Sharpening Core Number */}
        <div
          style={{
            fontSize: 66,
            fontWeight: 900,
            lineHeight: 1,
            color: PROFIT_GOLD,
            filter: `blur(${blurPx.toFixed(1)}px)`,
            textShadow: '0 0 35px rgba(245, 158, 11, 0.5)',
            userSelect: 'none',
          }}
        >
          {faNumber(455000)}
        </div>

        {/* Signal Clarity Gauge Meter */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              color: MIST_BLUE,
            }}
          >
            <span>وضوح محاسبه تراز:</span>
            <span style={{ fontWeight: 800, color: DEEP_TEAL }}>{faNumber(clarityPercent)}٪</span>
          </div>
          <div
            style={{
              width: '100%',
              height: 8,
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${clarityPercent}%`,
                height: '100%',
                backgroundColor: DEEP_TEAL,
                boxShadow: '0 0 12px #06b6d4',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
        </div>
      </div>

      {/* Sweeping Cyan Laser Beam */}
      {sweep > 0 && sweep < 1 && (
        <div
          style={{
            position: 'absolute',
            top: laserY,
            left: 36,
            right: 36,
            height: 2,
            backgroundColor: '#00f2fe',
            boxShadow: '0 0 16px 3px #00f2fe',
            pointerEvents: 'none',
            zIndex: 30,
          }}
        />
      )}

      <BottomBanner text="محاسبه بلادرنگ سود با تفکیک هزینه‌ها" color="#38bdf8" />
    </DuskFogStage>
  )
}

// ============================================
// SCENE 4: ClearRevealScene (25–35s) — The Monolithic Crystal Prism & Pure Net Profit
// ============================================
export function ClearRevealScene({ t, scene }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.6), 0, 1))
  const popSpring = spring(clamp(progress(t, 0.2, 1.2), 0, 1))

  return (
    <DuskFogStage scene={scene} t={t}>
      <SceneHeader
        badge="کشف حقیقت مالی"
        badgeColor={PROFIT_GOLD}
        title="سود خالص واقعی آشکار شد!"
        opacity={enter}
      />

      {/* Center Crystalline Prism Chamber (Y: 260..590) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 260,
          left: 40,
          right: 40,
          height: 350,
          backgroundColor: FOG_GREY,
          borderRadius: 18,
          border: `2px solid ${FOG_AMBER}`,
          boxShadow: '0 0 45px rgba(245, 158, 11, 0.22)',
          padding: '28px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          transform: `scale(${0.92 + popSpring * 0.08})`,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 14px',
            borderRadius: 999,
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            border: `1px solid ${FOG_AMBER}`,
            color: PROFIT_GOLD,
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          <span>سود خالص قطعی امروز</span>
        </div>

        {/* Razor-Sharp Pure Profit Numeral */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 900,
              lineHeight: 1,
              color: '#ffffff',
              textShadow: '0 0 35px rgba(251, 191, 36, 0.6)',
              userSelect: 'none',
              letterSpacing: 1,
            }}
          >
            {faNumber(455000)}
          </div>
          <span style={{ fontSize: 14, color: MIST_BLUE, fontWeight: 700 }}>
            بدون حتی یک ریال کسری یا خطا
          </span>
        </div>

        {/* Decomposition Tag */}
        <div
          style={{
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 10,
            border: `1px solid ${BORDER_SUBTLE}`,
            padding: '10px 14px',
            fontSize: 14,
            fontWeight: 700,
            color: REVEAL_CREAM,
            textAlign: 'center',
          }}
        >
          فروش منهای بهای تمام‌شده و کل خرج‌ها
        </div>
      </div>

      <BottomBanner text="سود خالص واقعی: چهارصد و پنجاه و پنج هزار" color="#fbbf24" />
    </DuskFogStage>
  )
}

// ============================================
// SCENE 5: LedgerFootScene (35–40s) — The 3 Decomposition Rails (Arithmetic Invariant)
// ============================================
export function LedgerFootScene({ t, scene }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.5), 0, 1))

  const r1 = clamp(progress(t, 0.2, 0.8), 0, 1)
  const r2 = clamp(progress(t, 0.9, 1.5), 0, 1)
  const r3 = clamp(progress(t, 1.6, 2.2), 0, 1)
  const rResult = clamp(progress(t, 2.3, 3.0), 0, 1)

  return (
    <DuskFogStage scene={scene} t={t}>
      <SceneHeader
        badge="سه‌گانه تراز محاسباتی"
        badgeColor={DEEP_TEAL}
        title="پایه‌های حساب؛ زنده و شفاف"
        opacity={enter}
      />

      {/* 3 Decomposition Rails + Net Profit Result (Y: 250..635) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 250,
          left: 40,
          right: 40,
          height: 380,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Rail 1: فروش ناخالص */}
        <div
          style={{
            height: 72,
            backgroundColor: FOG_GREY,
            borderRadius: 12,
            border: `1.5px solid rgba(6, 182, 212, 0.35)`,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: r1,
            transform: `translateX(${(1 - r1) * 20}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: DEEP_TEAL }}>+</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>فروش ناخالص روز</span>
          </div>
          <span style={{ fontSize: 17, fontWeight: 900, color: LASER_CYAN }}>
            {faNumber(2460000)}
          </span>
        </div>

        {/* Rail 2: بهای تمام‌شده کالا */}
        <div
          style={{
            height: 72,
            backgroundColor: FOG_GREY,
            borderRadius: 12,
            border: `1.5px solid rgba(245, 158, 11, 0.35)`,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: r2,
            transform: `translateX(${(1 - r2) * 20}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: FOG_AMBER }}>−</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
              بهای تمام‌شده کالا
            </span>
          </div>
          <span style={{ fontSize: 17, fontWeight: 900, color: FOG_AMBER }}>
            {faNumber(1620000)}
          </span>
        </div>

        {/* Rail 3: هزینه‌ها و مخارج */}
        <div
          style={{
            height: 72,
            backgroundColor: FOG_GREY,
            borderRadius: 12,
            border: `1.5px solid rgba(244, 63, 94, 0.35)`,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: r3,
            transform: `translateX(${(1 - r3) * 20}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: COST_ROSE }}>−</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
              هزینه‌ها و مخارج جاری
            </span>
          </div>
          <span style={{ fontSize: 17, fontWeight: 900, color: COST_ROSE }}>
            {faNumber(385000)}
          </span>
        </div>

        {/* Result: سود خالص قطعی */}
        <div
          style={{
            height: 80,
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            borderRadius: 14,
            border: `2px solid ${PROFIT_GOLD}`,
            boxShadow: '0 0 25px rgba(245, 158, 11, 0.25)',
            padding: '0 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: rResult,
            transform: `scale(${0.95 + rResult * 0.05})`,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 900, color: PROFIT_GOLD }}>
            = سود خالص واقعی
          </span>
          <span style={{ fontSize: 24, fontWeight: 900, color: '#ffffff' }}>
            {faNumber(455000)}
          </span>
        </div>
      </div>

      <BottomBanner text="تراز لحظه‌ای فروش، بهای تمام‌شده و خرج‌ها" color="#38bdf8" />
    </DuskFogStage>
  )
}

// ============================================
// SCENE 6: FogCtaScene (40–45s) — The Clear Horizon & Tactile CTA
// ============================================
export function FogCtaScene({ t, scene }: SceneProps) {
  const dur = scene.end - scene.start
  const enter = ease(clamp(progress(t, 0, 0.6), 0, 1))

  // Loop back strictly at the very tail (last 0.2s)
  const loopBack = ease(clamp(progress(t, dur - 0.2, dur), 0, 1))

  return (
    <DuskFogStage scene={scene} t={t}>
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 1 - loopBack,
          display: loopBack >= 1 ? 'none' : 'block',
        }}
      >
        <SceneHeader
          badge="آرامش مالی هر شب"
          badgeColor={PROFIT_GOLD}
          title="حساب روشن، دخل شفاف با حسابچه"
          opacity={enter}
        />

        {/* Center CTA Button Cluster (Y: 340..540) */}
        <div
          style={{
            position: 'absolute',
            top: 350,
            left: 40,
            right: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          {/* Main Action Button */}
          <div
            style={{
              width: '100%',
              height: 72,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #f59e0b 0%, #06b6d4 100%)',
              boxShadow: '0 0 35px rgba(245, 158, 11, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 900,
              color: '#05080e',
              cursor: 'pointer',
            }}
          >
            همین امشب سود واقعی‌ات را ببین
          </div>

          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: MIST_BLUE,
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            نرم‌افزار یکپارچه حسابداری ابری و آفلاین حسابچه
          </div>
        </div>

        <BottomBanner text="حسابچه · پایان ابهام دخل و سود فروشگاه" color="#fbbf24" />
      </div>

      {/* Frame 0 Loop Anchor */}
      {loopBack > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: loopBack,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontSize: 68,
              fontWeight: 900,
              color: PROFIT_GOLD,
              filter: 'blur(24px)',
            }}
          >
            {faNumber(455000)}
          </div>
        </div>
      )}
    </DuskFogStage>
  )
}
