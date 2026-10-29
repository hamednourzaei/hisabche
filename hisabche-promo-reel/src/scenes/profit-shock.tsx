// ============================================
// Reel 91 — «شوک عدد — فروش ۲۵ میلیون، سود فقط ۶ میلیون»
// Masterpiece Motion Engine: Bourdon Manometer & Fluidic Profit Distillation Siphon
// (گیج فشار صنعتی بوردون و ستون پالایش سانتریفیوژ سود خالص)
//
// 100% Dark Studio Theme (Obsidian Titanium & Mercury Glow / Laser Cyan / Incandescent Gold)
// Frame-accurate A/V synchronization with millisecond precision
// Zero-overlap certified geometry (Canvas: 540x960, disjoint vertical bands)
// Deterministic numerals via faNumber.
//
// Persistent arithmetic:
//   ۲۵٬۰۰۰٬۰۰۰ فروش − ۱۵٬۲۰۰٬۰۰۰ بهای کالا − ۳٬۸۰۰٬۰۰۰ خرج = ۶٬۰۰۰٬۰۰۰ سود خالص (۲۴٪)
// ============================================

import type { ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

type SceneProps = { t: number; scene: Scene }

// Design Tokens (Industrial Refinery Palette)
const BG_OBSIDIAN = '#06080e'
const BG_PANEL = '#0c111c'
const BORDER_SUBTLE = 'rgba(255, 255, 255, 0.08)'
const GOLD_AMBER = '#f59e0b'
const LASER_CYAN = '#06b6d4'
const COST_ROSE = '#f43f5e'
const PROFIT_GREEN = '#10b981'
const TEXT_SLATE = '#94a3b8'

/** Pinned 540x960 LTR Stage with radial atmospheric depth */
function RefineryStage({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: 540,
        height: 960,
        backgroundColor: BG_OBSIDIAN,
        color: '#f8fafc',
        fontFamily: 'Vazirmatn, system-ui, sans-serif',
        overflow: 'hidden',
        direction: 'ltr',
      }}
    >
      {/* Background Radial Glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(600px 450px at 50% 25%, rgba(6, 182, 212, 0.09), transparent 70%), radial-gradient(600px 450px at 50% 75%, rgba(245, 158, 11, 0.07), transparent 70%)',
          pointerEvents: 'none',
        }}
      />

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
          color: TEXT_SLATE,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#06b6d4',
              boxShadow: '0 0 10px #06b6d4',
            }}
          />
          <span>جداسازی هیدرولیک سود خالص</span>
        </div>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#38bdf8', letterSpacing: 1 }}>
          FLOW_REFINERY // V91
        </span>
      </div>

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
        <span>حسابچه · تفکیک آناتومی سود</span>
        <span style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: 0.5 }}>
          NET_MARGIN: 24% // VERIFIED
        </span>
      </div>
    </div>
  )
}

/** Standard Scene Header Cluster at Y = 145..215 */
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
        top: 145,
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
  color = '#38bdf8',
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
        backgroundColor: 'rgba(12, 17, 28, 0.85)',
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

// ============================================
// SCENE 1: ShockHookScene (0–4s) — The Bourdon Pressure Manometer
// Audio Sync: at 0.05s impact (needle slam), at 1.8s whoosh (pressure relief drop), at 2.8s alert
// ============================================
export function ShockHookScene({ t }: SceneProps) {
  const enter = clamp(progress(t, 0, 0.5), 0, 1)

  // Needle angle calculation synced with cues:
  // Phase 1 (0.05..1.8s): Spikes violently from 0 to 220 deg (showing 25M)
  // Phase 2 (1.8..2.6s): Pressure relief drops needle down to 55 deg (showing 6M / 24%)
  const needleAngle =
    t < 1.8
      ? spring(clamp(progress(t, 0.05, 0.7), 0, 1)) * 220
      : 220 - ease(clamp(progress(t, 1.8, 2.6), 0, 1)) * 165

  const isRelieved = t >= 2.0
  const alertFlash = t >= 2.8

  return (
    <RefineryStage>
      <SceneHeader
        badge="شوک واقعیت مالی"
        badgeColor={isRelieved ? GOLD_AMBER : LASER_CYAN}
        title={isRelieved ? 'سود واقعی فقط ۶ میلیون (۲۴٪)!' : 'فروش ۲۵ میلیون؛ اما سود واقعی؟'}
        opacity={enter}
      />

      {/* Industrial Bourdon Pressure Manometer Gauge (Y: 250..635) */}
      <div
        style={{
          position: 'absolute',
          top: 250,
          left: 40,
          right: 40,
          height: 385,
          backgroundColor: BG_PANEL,
          borderRadius: 20,
          border: `2px solid ${isRelieved ? 'rgba(245, 158, 11, 0.35)' : 'rgba(6, 182, 212, 0.35)'}`,
          boxShadow: `0 24px 60px rgba(0, 0, 0, 0.6), 0 0 35px ${isRelieved ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.15)'}`,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Top Status */}
        <div
          dir="rtl"
          style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 13 }}
        >
          <span style={{ color: TEXT_SLATE }}>فشارسنج جریان ورودی:</span>
          <span
            style={{
              fontFamily: 'monospace',
              color: isRelieved ? GOLD_AMBER : LASER_CYAN,
              fontWeight: 800,
            }}
          >
            {isRelieved ? 'RELIEF: 24% NET' : 'PRESSURE: 25.0M'}
          </span>
        </div>

        {/* Circular Bourdon Gauge Dial (Center at X: 230, Y: 135) */}
        <div
          style={{
            position: 'relative',
            width: 210,
            height: 210,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="210"
            height="210"
            viewBox="0 0 210 210"
            style={{ position: 'absolute', inset: 0 }}
          >
            {/* Outer dial ring */}
            <circle
              cx="105"
              cy="105"
              r="95"
              fill="none"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="4"
            />
            {/* Safe 24% arc (Gold) */}
            <circle
              cx="105"
              cy="105"
              r="95"
              fill="none"
              stroke={GOLD_AMBER}
              strokeWidth="6"
              strokeDasharray="596"
              strokeDashoffset="453"
              transform="rotate(135 105 105)"
            />
            {/* Pressure Overload arc (Cyan/Red) */}
            <circle
              cx="105"
              cy="105"
              r="95"
              fill="none"
              stroke={COST_ROSE}
              strokeWidth="6"
              strokeDasharray="596"
              strokeDashoffset="298"
              transform="rotate(270 105 105)"
              opacity={isRelieved ? 0.3 : 0.8}
            />
            {/* 30 Dial tick notches */}
            {[...Array(24)].map((_, i) => (
              <line
                key={i}
                x1="105"
                y1="16"
                x2="105"
                y2="24"
                stroke={i > 16 ? COST_ROSE : 'rgba(255,255,255,0.25)'}
                strokeWidth="1.5"
                transform={`rotate(${i * 11.25 - 135} 105 105)`}
              />
            ))}

            {/* Needle Pivot & Arm */}
            <g transform={`rotate(${needleAngle - 135} 105 105)`}>
              <line
                x1="105"
                y1="105"
                x2="105"
                y2="28"
                stroke={isRelieved ? GOLD_AMBER : '#ffffff'}
                strokeWidth="3.5"
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 8px ${isRelieved ? GOLD_AMBER : LASER_CYAN})` }}
              />
              <circle
                cx="105"
                cy="105"
                r="10"
                fill="#1e293b"
                stroke={isRelieved ? GOLD_AMBER : '#ffffff'}
                strokeWidth="2"
              />
            </g>
          </svg>

          {/* Central Digital Display inside dial */}
          <div
            dir="rtl"
            style={{
              position: 'absolute',
              top: 135,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <span
              style={{ fontSize: 24, fontWeight: 900, color: isRelieved ? GOLD_AMBER : '#ffffff' }}
            >
              {isRelieved ? faNumber(6000000) : faNumber(25000000)}
            </span>
            <span style={{ fontSize: 11, color: TEXT_SLATE, marginTop: 2 }}>
              {isRelieved ? 'سود خالص واقعی' : 'فروش ناخالص کل'}
            </span>
          </div>
        </div>

        {/* Warning Indicator */}
        <div
          dir="rtl"
          style={{
            width: '100%',
            backgroundColor: alertFlash ? 'rgba(244, 63, 94, 0.18)' : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${alertFlash ? COST_ROSE : BORDER_SUBTLE}`,
            borderRadius: 10,
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13,
            transition: 'all 0.3s ease',
          }}
        >
          <span style={{ color: alertFlash ? '#fda4af' : TEXT_SLATE }}>
            ۱۹ میلیون تومان از فروش، سهم اجناس و هزینه‌هاست!
          </span>
          <span style={{ fontWeight: 800, color: alertFlash ? COST_ROSE : GOLD_AMBER }}>
            ۷۶٪ تخلیه فشار
          </span>
        </div>
      </div>

      <BottomBanner text="فروش بالا؛ سرابی که بدون محاسبه سود می‌سوزاند" color="#fbbf24" />
    </RefineryStage>
  )
}

// ============================================
// SCENE 2: GrossLadderScene (4–9s) — The Primary Siphon: COGS Filter
// Audio Sync: at 0.8s precisionSequence (fluid injection), at 2.0s pop (piston compression), at 3.5s chime
// ============================================
export function GrossLadderScene({ t }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.5), 0, 1))

  // Piston movement down: starts at t=2.0s
  const pistonProgress = ease(clamp(progress(t, 1.8, 3.2), 0, 1))
  const cogsSiphoned = t >= 2.0
  const grossStabilized = t >= 3.5

  return (
    <RefineryStage>
      <SceneHeader
        badge="سیفون اول · فیلتر بهای کالا"
        badgeColor={COST_ROSE}
        title="بهای جنس؛ بیش از نیمی از فروش"
        opacity={enter}
      />

      {/* Sintered Titanium Extraction Column (Y: 250..635) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 250,
          left: 40,
          right: 40,
          height: 385,
          backgroundColor: BG_PANEL,
          borderRadius: 20,
          border: `1.5px solid ${BORDER_SUBTLE}`,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Top Input Chamber */}
        <div
          style={{
            height: 74,
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 12,
            border: `1px solid ${BORDER_SUBTLE}`,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: LASER_CYAN }}
            />
            <span style={{ fontSize: 15, fontWeight: 700, color: TEXT_SLATE }}>
              حجم کل فروش ورودی:
            </span>
          </div>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#ffffff' }}>
            {faNumber(25000000)}
          </span>
        </div>

        {/* Dynamic Hydraulic Siphon Core */}
        <div
          style={{
            height: 120,
            backgroundColor: 'rgba(244, 63, 94, 0.08)',
            borderRadius: 14,
            border: `1.5px solid ${cogsSiphoned ? COST_ROSE : BORDER_SUBTLE}`,
            boxShadow: cogsSiphoned ? '0 0 25px rgba(244, 63, 94, 0.2)' : 'none',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Animated Piston Blade */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              backgroundColor: COST_ROSE,
              boxShadow: '0 0 12px #f43f5e',
              transform: `translateY(${pistonProgress * 116}px)`,
              opacity: cogsSiphoned ? 1 : 0,
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
              − تخلیه بهای خرید کالا (۶۰٪):
            </span>
            <span style={{ fontSize: 22, fontWeight: 900, color: COST_ROSE }}>
              {faNumber(15200000)}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#fda4af' }}>
            سرمایه‌ای که مستقیماً باید به تامین‌کننده برای جایگزینی کالا برگردد
          </div>
        </div>

        {/* Bottom Output Chamber */}
        <div
          style={{
            height: 80,
            backgroundColor: grossStabilized
              ? 'rgba(6, 182, 212, 0.12)'
              : 'rgba(255, 255, 255, 0.04)',
            borderRadius: 12,
            border: `1.5px solid ${grossStabilized ? LASER_CYAN : BORDER_SUBTLE}`,
            boxShadow: grossStabilized ? '0 0 20px rgba(6, 182, 212, 0.2)' : 'none',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: LASER_CYAN }}
            />
            <span style={{ fontSize: 15, fontWeight: 800, color: LASER_CYAN }}>
              سود ناخالص مانده در مخزن:
            </span>
          </div>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#ffffff' }}>
            {faNumber(9800000)}
          </span>
        </div>
      </div>

      <BottomBanner text="سود ناخالص ۹.۸ میلیون است، اما خرج‌ها هنوز مانده!" color="#38bdf8" />
    </RefineryStage>
  )
}

// ============================================
// SCENE 3: CostSwarmScene (9–14s) — The Tri-Valve Outflow Manifold
// Audio Sync: at 0.6s valve 1 snap, at 1.8s valve 2 snap, at 3.0s valve 3 snap, at 4.2s alert
// ============================================
export function CostSwarmScene({ t }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.5), 0, 1))

  const v1 = t >= 0.6
  const v2 = t >= 1.8
  const v3 = t >= 3.0
  const isComplete = t >= 4.0

  return (
    <RefineryStage>
      <SceneHeader
        badge="سیفون دوم · مخارج جاری"
        badgeColor={GOLD_AMBER}
        title="۳ شیر خروجی که سود را می‌بلعند"
        opacity={enter}
      />

      {/* Tri-Valve Outflow Manifold (Y: 250..635) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 250,
          left: 40,
          right: 40,
          height: 385,
          backgroundColor: BG_PANEL,
          borderRadius: 20,
          border: `1.5px solid ${BORDER_SUBTLE}`,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Valve 1: حقوق و پرسنل */}
        <div
          style={{
            height: 78,
            backgroundColor: v1 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.04)',
            borderRadius: 12,
            border: `1.5px solid ${v1 ? GOLD_AMBER : BORDER_SUBTLE}`,
            boxShadow: v1 ? '0 0 18px rgba(245, 158, 11, 0.15)' : 'none',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>{v1 ? '🔓' : '🔒'}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
              شیر ۱: حقوق و دستمزد پرسنل
            </span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, color: GOLD_AMBER }}>
            − {faNumber(2100000)}
          </span>
        </div>

        {/* Valve 2: کرایه و شارژ */}
        <div
          style={{
            height: 78,
            backgroundColor: v2 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.04)',
            borderRadius: 12,
            border: `1.5px solid ${v2 ? GOLD_AMBER : BORDER_SUBTLE}`,
            boxShadow: v2 ? '0 0 18px rgba(245, 158, 11, 0.15)' : 'none',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>{v2 ? '🔓' : '🔒'}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
              شیر ۲: کرایه مغازه و قبوض
            </span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, color: GOLD_AMBER }}>
            − {faNumber(1200000)}
          </span>
        </div>

        {/* Valve 3: ارسال و لجستیک */}
        <div
          style={{
            height: 78,
            backgroundColor: v3 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.04)',
            borderRadius: 12,
            border: `1.5px solid ${v3 ? GOLD_AMBER : BORDER_SUBTLE}`,
            boxShadow: v3 ? '0 0 18px rgba(245, 158, 11, 0.15)' : 'none',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>{v3 ? '🔓' : '🔒'}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
              شیر ۳: ارسال، لجستیک و متفرقه
            </span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, color: GOLD_AMBER }}>
            − {faNumber(500000)}
          </span>
        </div>

        {/* Total Drain Footing */}
        <div
          style={{
            height: 64,
            backgroundColor: isComplete ? 'rgba(244, 63, 94, 0.14)' : 'rgba(255, 255, 255, 0.04)',
            borderRadius: 12,
            border: `1.5px solid ${isComplete ? COST_ROSE : BORDER_SUBTLE}`,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{ fontSize: 15, fontWeight: 800, color: isComplete ? COST_ROSE : TEXT_SLATE }}
          >
            مجموع تخلیه هزینه‌های جاری:
          </span>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#ffffff' }}>
            − {faNumber(3800000)}
          </span>
        </div>
      </div>

      <BottomBanner text="هزینه‌هایی که اگر شمرده نشوند، سود را صفر می‌کنند" color="#fbbf24" />
    </RefineryStage>
  )
}

// ============================================
// SCENE 4: WaterfallSiphonScene (14–22s) — The Pure Gold Droplet Collector
// Audio Sync: at 0.5s dataFlow, at 3.8s financialMilestone (splash hit), at 5.5s chime
// ============================================
export function WaterfallSiphonScene({ t }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.5), 0, 1))

  // Drop animation: forms t=0.5..3.8s, splashes at t=3.8s
  const isHit = t >= 3.8
  const isChimed = t >= 5.5

  return (
    <RefineryStage>
      <SceneHeader
        badge="تراز بلادرنگ آبشاری"
        badgeColor={PROFIT_GREEN}
        title="تصفیه نهایی تا سود خالص واقعی"
        opacity={enter}
      />

      {/* Waterfall Balance Apparatus (Y: 250..635) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 250,
          left: 40,
          right: 40,
          height: 385,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Step 1: Revenue */}
        <div
          style={{
            height: 64,
            backgroundColor: BG_PANEL,
            borderRadius: 12,
            border: `1.5px solid ${LASER_CYAN}`,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>+ فروش ناخالص</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: LASER_CYAN }}>
            {faNumber(25000000)}
          </span>
        </div>

        {/* Step 2: COGS */}
        <div
          style={{
            height: 64,
            backgroundColor: BG_PANEL,
            borderRadius: 12,
            border: `1.5px solid ${COST_ROSE}`,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>− بهای خرید کالا</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: COST_ROSE }}>
            {faNumber(15200000)}
          </span>
        </div>

        {/* Step 3: Expenses */}
        <div
          style={{
            height: 64,
            backgroundColor: BG_PANEL,
            borderRadius: 12,
            border: `1.5px solid ${GOLD_AMBER}`,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
            − کل هزینه‌های جاری
          </span>
          <span style={{ fontSize: 18, fontWeight: 900, color: GOLD_AMBER }}>
            {faNumber(3800000)}
          </span>
        </div>

        {/* Final Golden Collector Flask */}
        <div
          style={{
            height: 100,
            backgroundColor: isHit ? 'rgba(16, 185, 129, 0.16)' : 'rgba(255, 255, 255, 0.04)',
            borderRadius: 16,
            border: `2px solid ${isChimed ? '#ffffff' : PROFIT_GREEN}`,
            boxShadow: isHit ? '0 0 35px rgba(16, 185, 129, 0.35)' : 'none',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 17, fontWeight: 900, color: PROFIT_GREEN }}>
              = سود خالص قطعی
            </span>
            <span style={{ fontSize: 12, color: TEXT_SLATE }}>حاشیه سود خالص: دقیقاً ۲۴٪</span>
          </div>
          <div style={{ textAlign: 'left' }}>
            <span
              style={{ fontSize: 30, fontWeight: 900, color: isChimed ? GOLD_AMBER : '#ffffff' }}
            >
              {faNumber(6000000)}
            </span>
          </div>
        </div>
      </div>

      <BottomBanner text="سود واقعی شش میلیون است؛ یعنی ۲۴ درصد فروش" color="#10b981" />
    </RefineryStage>
  )
}

// ============================================
// SCENE 5: ProfitNotSalesScene (22–26s) — The Typographic Impact
// Audio Sync: at 0.5s impact, at 2.2s pop
// ============================================
export function ProfitNotSalesScene({ t }: SceneProps) {
  const enter = clamp(progress(t, 0, 0.5), 0, 1)
  const impact = spring(clamp(progress(t, 0.5, 1.2), 0, 1))

  return (
    <RefineryStage>
      <SceneHeader
        badge="اصل بنیادین حسابداری"
        badgeColor={GOLD_AMBER}
        title="فروش بالا؛ یعنی سود بالا؟"
        opacity={enter}
      />

      {/* Kinetic Collision Chamber (Y: 250..635) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 250,
          left: 40,
          right: 40,
          height: 385,
          backgroundColor: BG_PANEL,
          borderRadius: 20,
          border: `2px solid ${GOLD_AMBER}`,
          boxShadow: '0 0 45px rgba(245, 158, 11, 0.25)',
          padding: '32px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          textAlign: 'center',
          transform: `scale(${0.92 + impact * 0.08})`,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_SLATE }}>
          قانون طلایی کسب‌وکارهای موفق
        </div>

        {/* Heavy Typographic Clash */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div
            style={{
              padding: '12px 18px',
              backgroundColor: 'rgba(6, 182, 212, 0.15)',
              border: `1.5px solid ${LASER_CYAN}`,
              borderRadius: 14,
              fontSize: 26,
              fontWeight: 900,
              color: '#ffffff',
            }}
          >
            فروش
          </div>
          <span style={{ fontSize: 44, fontWeight: 900, color: COST_ROSE }}>≠</span>
          <div
            style={{
              padding: '12px 18px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: `1.5px solid ${PROFIT_GREEN}`,
              borderRadius: 14,
              fontSize: 26,
              fontWeight: 900,
              color: GOLD_AMBER,
            }}
          >
            سود خالص
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 12,
            padding: '14px 18px',
            fontSize: 16,
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.5,
          }}
        >
          دو عدد با دو حقیقت کاملاً متفاوت!
        </div>
      </div>

      <BottomBanner text="مبنای ماندگاری بیزینس سود است، نه گردش پول" color="#fbbf24" />
    </RefineryStage>
  )
}

// ============================================
// SCENE 6: ShockCtaScene (26–32s) — Tactile CTA & Loop
// Audio Sync: at 0.3s ctaResolution, at 1.0s bigReveal, at 5.4s pop
// ============================================
export function ShockCtaScene({ t, scene }: SceneProps) {
  const dur = scene.end - scene.start
  const enter = ease(clamp(progress(t, 0, 0.6), 0, 1))
  const loopBack = ease(clamp(progress(t, dur - 0.2, dur), 0, 1))

  return (
    <RefineryStage>
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
          badge="مدیریت هوشمند سود"
          badgeColor={PROFIT_GREEN}
          title="محاسبه لحظه‌ای سود با حسابچه"
          opacity={enter}
        />

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
          <div
            style={{
              width: '100%',
              height: 72,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
              boxShadow: '0 0 35px rgba(6, 182, 212, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 21,
              fontWeight: 900,
              color: '#06080e',
              cursor: 'pointer',
            }}
          >
            همین حالا سود واقعی‌ات را ببین
          </div>

          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: TEXT_SLATE,
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            تفکیک خودکار بهای تمام‌شده، هزینه‌ها و حاشیه سود
          </div>
        </div>

        <BottomBanner text="حسابچه · شفاف‌ترین تصویر از سود واقعی فروشگاه" color="#10b981" />
      </div>

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
          <div style={{ fontSize: 48, fontWeight: 900, color: GOLD_AMBER }}>۲۴٪</div>
        </div>
      )}
    </RefineryStage>
  )
}
