// ============================================
// Reel 94 — «سه سؤال درباره‌ی تاریخ انقضا»
// Bespoke Motion Engine: Optical Chrono-Batch Chamber & Shelf-Decay Velocity
// (محفظه اپتیکال بچ و زمان‌سنج فساد قفسه)
//
// 100% Dark Studio Theme (Obsidian & Cryo-Teal / Cadmium Amber / Laser Crimson)
// Zero-overlap certified geometry (Canvas: 540x960, disjoint vertical bands)
// Deterministic numerals via faNumber.
// ============================================

import type { ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

type SceneProps = { t: number; scene: Scene }

// Design Tokens (Dark Obsidian Studio Palette)
const BG_OBSIDIAN = '#07090e'
const BG_PANEL = '#0c111c'
const BORDER_SUBTLE = 'rgba(255, 255, 255, 0.08)'
const BORDER_EMERALD = '#10b981'
const BORDER_AMBER = '#f59e0b'
const BORDER_CRIMSON = '#f43f5e'
const TEXT_SLATE = '#94a3b8'
const TEXT_MUTED = '#64748b'

/** Root Inspection Berth pinned to 540x960 LTR with strictly isolated RTL inner clusters */
function ChronoBerth({ children }: { children: ReactNode }) {
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
      {/* Background Reticle Grid */}
      <svg
        width="540"
        height="960"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.12,
        }}
      >
        <defs>
          <pattern id="chrono-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#38bdf8" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="540" height="960" fill="url(#chrono-grid)" />
        {/* Optical alignment guide lines */}
        <line
          x1="40"
          y1="0"
          x2="40"
          y2="960"
          stroke="#38bdf8"
          strokeWidth="0.75"
          strokeDasharray="4 6"
        />
        <line
          x1="500"
          y1="0"
          x2="500"
          y2="960"
          stroke="#38bdf8"
          strokeWidth="0.75"
          strokeDasharray="4 6"
        />
      </svg>

      {/* Top Fixed Inspection Header (Y: 48..86) */}
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
          zIndex: 10,
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
          <span>سامانه پایش بچ و انقضا</span>
        </div>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#38bdf8',
            letterSpacing: 1,
          }}
        >
          CHRONO_INSPECT // V94
        </span>
      </div>

      {/* Center Safe Stage Container */}
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
          color: TEXT_MUTED,
          zIndex: 10,
        }}
      >
        <span>حسابچه · پایش پیوسته انبار</span>
        <span style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: 0.5 }}>
          AXIS: [T-365D → T-0D]
        </span>
      </div>
    </div>
  )
}

/** Standard Scene Header Cluster at Y = 150..220 (Zero Overlap Guaranteed) */
function QuestionHeader({
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

/** Bottom Telemetry / Insight Banner at Y = 680..745 */
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
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
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
      }}
    >
      {text}
    </div>
  )
}

// ============================================
// SCENE 1: ThreeHookScene (0–3s) — Hook: Three Deadliest Questions
// ============================================
export function ThreeHookScene({ t }: SceneProps) {
  const enter = clamp(progress(t, 0, 0.6), 0, 1)
  const settleScale = 1 + 0.15 * (1 - spring(enter))
  const textShow = ease(clamp(progress(t, 0.5, 1.1), 0, 1))
  const tickerShow = ease(clamp(progress(t, 1.4, 2.0), 0, 1))

  // Aperture reticle rotation
  const angle = t * 24

  return (
    <ChronoBerth>
      {/* Top Header Cluster */}
      <QuestionHeader
        badge="هشدار اضطراری سرمایه"
        badgeColor={BORDER_AMBER}
        title="۳ سؤال مرگبار درباره تاریخ انقضا"
        opacity={textShow}
        translateY={(1 - textShow) * 16}
      />

      {/* Center Chrono-Aperture (Center at X: 270, Y: 450) */}
      <div
        style={{
          position: 'absolute',
          top: 310,
          left: 130,
          width: 280,
          height: 280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${settleScale})`,
        }}
      >
        <svg
          width="280"
          height="280"
          viewBox="0 0 280 280"
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* Outer rotating chronometer ring */}
          <g transform={`rotate(${angle} 140 140)`}>
            <circle
              cx="140"
              cy="140"
              r="130"
              fill="none"
              stroke="rgba(245, 158, 11, 0.25)"
              strokeWidth="1.5"
            />
            <circle
              cx="140"
              cy="140"
              r="120"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="8 12"
            />
            {/* 12 Hour ticks */}
            {[...Array(12)].map((_, i) => (
              <line
                key={i}
                x1="140"
                y1="16"
                x2="140"
                y2="28"
                stroke="#38bdf8"
                strokeWidth="2"
                transform={`rotate(${i * 30} 140 140)`}
              />
            ))}
          </g>
          {/* Inner aperture circle */}
          <circle
            cx="140"
            cy="140"
            r="95"
            fill={BG_PANEL}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1.5"
          />

          {/* Center Glowing Numeral «۳» rendered deterministically in SVG */}
          <text
            x="140"
            y="152"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#f59e0b"
            fontSize="120"
            fontWeight="900"
            style={{
              textShadow: '0 0 35px rgba(245, 158, 11, 0.55)',
              userSelect: 'none',
            }}
          >
            {faNumber(3)}
          </text>
        </svg>
      </div>

      {/* Bottom Danger Insight */}
      <BottomBanner
        text="سرمایه‌ای که در سکوت قفسه خاکستر می‌شود"
        color="#fbbf24"
        opacity={tickerShow}
      />
    </ChronoBerth>
  )
}

// ============================================
// SCENE 2: QuestionOneScene (3–8s) — Which goods are near expiry?
// ============================================
export function QuestionOneScene({ t }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.5), 0, 1))
  const laserProgress = clamp(progress(t, 0.6, 3.8), 0, 1)
  const laserY = 250 + laserProgress * 360

  // 3 Canisters status active thresholds
  const hit1 = t >= 0.8
  const hit2 = t >= 1.9
  const hit3 = t >= 3.0

  return (
    <ChronoBerth>
      {/* Top Question Header */}
      <QuestionHeader
        badge="سؤال اول · رهگیری بچ کالا"
        badgeColor="#06b6d4"
        title="کدام کالا نزدیک انقضاست؟"
        opacity={enter}
      />

      {/* Canisters Container (Y: 260..630) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 255,
          left: 40,
          right: 40,
          height: 380,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Canister 1: Fresh / سالم */}
        <div
          style={{
            height: 98,
            backgroundColor: BG_PANEL,
            borderRadius: 14,
            border: `1.5px solid ${hit1 ? BORDER_EMERALD : BORDER_SUBTLE}`,
            boxShadow: hit1 ? '0 0 20px rgba(16, 185, 129, 0.15)' : 'none',
            padding: '12px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'border 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
              بچ ۸۰۱ · کالای بازرگانی ۱۰۱
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 6,
                backgroundColor: hit1 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                color: hit1 ? BORDER_EMERALD : TEXT_MUTED,
                border: `1px solid ${hit1 ? BORDER_EMERALD : 'transparent'}`,
              }}
            >
              سالم
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              color: TEXT_SLATE,
            }}
          >
            <span>مانده تا سررسید: {faNumber(320)} روز</span>
            <span style={{ color: BORDER_EMERALD, fontWeight: 700 }}>۱۰۰٪ سلامت فیزیکی</span>
          </div>
        </div>

        {/* Canister 2: Near Expiry / نزدیک انقضا */}
        <div
          style={{
            height: 98,
            backgroundColor: BG_PANEL,
            borderRadius: 14,
            border: `1.5px solid ${hit2 ? BORDER_AMBER : BORDER_SUBTLE}`,
            boxShadow: hit2 ? '0 0 20px rgba(245, 158, 11, 0.2)' : 'none',
            padding: '12px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'border 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
              بچ ۸۰۲ · کالای مصرفی ۲۰۲
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 6,
                backgroundColor: hit2 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)',
                color: hit2 ? BORDER_AMBER : TEXT_MUTED,
                border: `1px solid ${hit2 ? BORDER_AMBER : 'transparent'}`,
              }}
            >
              نزدیک انقضا
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              color: TEXT_SLATE,
            }}
          >
            <span>مانده تا سررسید: {faNumber(24)} روز</span>
            <span style={{ color: BORDER_AMBER, fontWeight: 700 }}>اولویت فروش تخفیفی</span>
          </div>
        </div>

        {/* Canister 3: Expired / منقضی */}
        <div
          style={{
            height: 98,
            backgroundColor: BG_PANEL,
            borderRadius: 14,
            border: `1.5px solid ${hit3 ? BORDER_CRIMSON : BORDER_SUBTLE}`,
            boxShadow: hit3 ? '0 0 20px rgba(244, 63, 94, 0.25)' : 'none',
            padding: '12px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'border 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
              بچ ۸۰۳ · کالای استاندارد ۳۰۳
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 6,
                backgroundColor: hit3 ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255,255,255,0.05)',
                color: hit3 ? BORDER_CRIMSON : TEXT_MUTED,
                border: `1px solid ${hit3 ? BORDER_CRIMSON : 'transparent'}`,
              }}
            >
              منقضی
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              color: TEXT_SLATE,
            }}
          >
            <span>مانده تا سررسید: {faNumber(0)} روز</span>
            <span style={{ color: BORDER_CRIMSON, fontWeight: 700 }}>خروج فوری از قفسه</span>
          </div>
        </div>
      </div>

      {/* Sweeping Laser Scanner Line */}
      {laserProgress > 0 && laserProgress < 1 && (
        <div
          style={{
            position: 'absolute',
            top: laserY,
            left: 36,
            right: 36,
            height: 2,
            backgroundColor: '#06b6d4',
            boxShadow: '0 0 14px 3px #06b6d4',
            pointerEvents: 'none',
            zIndex: 15,
          }}
        />
      )}

      {/* Bottom Summary */}
      <BottomBanner text="تفکیک آنی سالم، در آستانه خطر و فاسد" color="#38bdf8" />
    </ChronoBerth>
  )
}

// ============================================
// SCENE 3: QuestionTwoScene (8–14s) — How many days remaining?
// ============================================
export function QuestionTwoScene({ t }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.5), 0, 1))

  // Days countdown from 90 down to 45
  const countProgress = ease(clamp(progress(t, 0.4, 4.2), 0, 1))
  const daysLeft = Math.round(90 - countProgress * 45)
  const arcDashoffset = 754 * (1 - 0.45 * countProgress)

  return (
    <ChronoBerth>
      {/* Top Question Header */}
      <QuestionHeader
        badge="سؤال دوم · زمان‌سنج قفسه"
        badgeColor={BORDER_AMBER}
        title="دقیقاً چند روز مانده؟"
        opacity={enter}
      />

      {/* Center Chronograph Dial (Center at X: 270, Y: 410) */}
      <div
        style={{
          position: 'absolute',
          top: 260,
          left: 140,
          width: 260,
          height: 260,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="260"
          height="260"
          viewBox="0 0 260 260"
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* Base track circle */}
          <circle
            cx="130"
            cy="130"
            r="115"
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="6"
          />
          {/* Progress Countdown Arc */}
          <circle
            cx="130"
            cy="130"
            r="115"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="754"
            strokeDashoffset={arcDashoffset}
            transform="rotate(-90 130 130)"
          />
          {/* 60 Minute/Day notches */}
          {[...Array(30)].map((_, i) => (
            <line
              key={i}
              x1="130"
              y1="22"
              x2="130"
              y2="28"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1.5"
              transform={`rotate(${i * 12} 130 130)`}
            />
          ))}
        </svg>

        {/* Center Countdown Ticker */}
        <div
          dir="rtl"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              lineHeight: 1,
              color: '#f59e0b',
              textShadow: '0 0 25px rgba(245, 158, 11, 0.4)',
            }}
          >
            {faNumber(daysLeft)}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: TEXT_SLATE, marginTop: 4 }}>
            روز باقی‌مانده
          </div>
        </div>
      </div>

      {/* Shelf Decay Velocity Metric Box (Y: 550..635) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 555,
          left: 40,
          right: 40,
          height: 80,
          backgroundColor: BG_PANEL,
          borderRadius: 14,
          border: `1px solid ${BORDER_SUBTLE}`,
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, color: TEXT_MUTED }}>سرعت فروش میانگین:</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
            {faNumber(15)} عدد در روز
          </span>
        </div>
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, color: TEXT_MUTED }}>پیش‌بینی تخلیه قفسه:</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: BORDER_EMERALD }}>
            {faNumber(3)} روز قبل از فساد ✓
          </span>
        </div>
      </div>

      {/* Bottom Summary */}
      <BottomBanner text="روزشمار هوشمند برای اقدام به موقع" color="#fbbf24" />
    </ChronoBerth>
  )
}

// ============================================
// SCENE 4: QuestionThreeScene (14–20s) — What is the value of expired inventory?
// ============================================
export function QuestionThreeScene({ t }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.5), 0, 1))

  // Locked capital ticker counting up
  const valueProgress = ease(clamp(progress(t, 0.4, 3.5), 0, 1))
  const burnedValue = Math.round(valueProgress * 48500000)

  return (
    <ChronoBerth>
      {/* Top Question Header */}
      <QuestionHeader
        badge="سؤال سوم · زیان پنهان دفاتر"
        badgeColor={BORDER_CRIMSON}
        title="ارزش کالای منقضی چقدر؟"
        opacity={enter}
      />

      {/* Center Locked Capital Vault (Y: 260..630) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 260,
          left: 40,
          right: 40,
          height: 375,
          backgroundColor: BG_PANEL,
          borderRadius: 16,
          border: `1.5px solid ${BORDER_CRIMSON}`,
          boxShadow: '0 0 35px rgba(244, 63, 94, 0.15)',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          textAlign: 'center',
        }}
      >
        {/* Vault Lock Status Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 999,
            backgroundColor: 'rgba(244, 63, 94, 0.15)',
            border: `1px solid ${BORDER_CRIMSON}`,
            color: '#fda4af',
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          <span>🔒</span>
          <span>سرمایه منجمد و بلوکه‌شده</span>
        </div>

        {/* Big Monetary Ticker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, color: TEXT_SLATE, fontWeight: 600 }}>
            ارزش اجناس سوخته در انبار:
          </span>
          <div
            style={{
              fontSize: 44,
              fontWeight: 900,
              lineHeight: 1.1,
              color: '#f43f5e',
              textShadow: '0 0 25px rgba(244, 63, 94, 0.4)',
              letterSpacing: 1,
            }}
          >
            {faNumber(burnedValue)}
          </div>
        </div>

        {/* Visceral Paradox Callout */}
        <div
          style={{
            width: '100%',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            borderRadius: 10,
            border: '1px dashed rgba(244, 63, 94, 0.4)',
            padding: '12px 14px',
            fontSize: 17,
            fontWeight: 800,
            color: '#fecdd3',
            lineHeight: 1.4,
          }}
        >
          در ترازنامه هست، اما قابل فروش نیست!
        </div>
      </div>

      {/* Bottom Summary */}
      <BottomBanner text="سود کاغذی در دفاتر · صفر نقدینگی در دخل" color="#f87171" />
    </ChronoBerth>
  )
}

// ============================================
// SCENE 5: RecapScene (20–27s) — The 3 Answers in One Line: Tri-Matrix
// ============================================
export function RecapScene({ t }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.5), 0, 1))
  const col1 = clamp(progress(t, 0.3, 0.9), 0, 1)
  const col2 = clamp(progress(t, 0.8, 1.4), 0, 1)
  const col3 = clamp(progress(t, 1.3, 1.9), 0, 1)

  return (
    <ChronoBerth>
      {/* Top Question Header */}
      <QuestionHeader
        badge="سامانه جامع حسابچه"
        badgeColor={BORDER_EMERALD}
        title="پاسخ هر ۳ سؤال در یک نگاه"
        opacity={enter}
      />

      {/* Center 3-Column Telemetry Matrix (Y: 260..635) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 260,
          left: 40,
          right: 40,
          height: 380,
          display: 'flex',
          gap: 12,
        }}
      >
        {/* Column 1: تفکیک بچ */}
        <div
          style={{
            flex: 1,
            backgroundColor: BG_PANEL,
            borderRadius: 14,
            border: `1.5px solid ${BORDER_EMERALD}`,
            padding: '20px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            textAlign: 'center',
            opacity: col1,
            transform: `translateY(${(1 - col1) * 20}px)`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: BORDER_EMERALD }}>۱. تفکیک بچ</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
            <div
              style={{
                padding: '6px',
                backgroundColor: 'rgba(16,185,129,0.15)',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                color: BORDER_EMERALD,
              }}
            >
              سالم
            </div>
            <div
              style={{
                padding: '6px',
                backgroundColor: 'rgba(245,158,11,0.15)',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                color: BORDER_AMBER,
              }}
            >
              نزدیک
            </div>
            <div
              style={{
                padding: '6px',
                backgroundColor: 'rgba(244,63,94,0.15)',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                color: BORDER_CRIMSON,
              }}
            >
              منقضی
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_SLATE }}>رهگیری خودکار</div>
        </div>

        {/* Column 2: روزشمار */}
        <div
          style={{
            flex: 1,
            backgroundColor: BG_PANEL,
            borderRadius: 14,
            border: `1.5px solid ${BORDER_AMBER}`,
            padding: '20px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            textAlign: 'center',
            opacity: col2,
            transform: `translateY(${(1 - col2) * 20}px)`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: BORDER_AMBER }}>۲. روزشمار</div>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              border: `2.5px solid ${BORDER_AMBER}`,
              boxShadow: '0 0 15px rgba(245, 158, 11, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              fontWeight: 900,
              color: '#f59e0b',
            }}
          >
            {faNumber(45)}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_SLATE }}>هشدار قبل از صفر</div>
        </div>

        {/* Column 3: ارزش و تراز */}
        <div
          style={{
            flex: 1,
            backgroundColor: BG_PANEL,
            borderRadius: 14,
            border: `1.5px solid #06b6d4`,
            padding: '20px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            textAlign: 'center',
            opacity: col3,
            transform: `translateY(${(1 - col3) * 20}px)`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: '#06b6d4' }}>۳. تراز واقعی</div>
          <div
            style={{
              fontSize: 42,
              filter: 'drop-shadow(0 0 12px rgba(6, 182, 212, 0.4))',
            }}
          >
            🛡️
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_SLATE }}>حفظ سود دخل</div>
        </div>
      </div>

      {/* Bottom Summary */}
      <BottomBanner text="سامانه هوشمند پایش انقضا // فعال و خودکار" color="#10b981" />
    </ChronoBerth>
  )
}

// ============================================
// SCENE 6: SaveScene (27–33s) — Call to Action & Loop Back
// ============================================
export function SaveScene({ t, scene }: SceneProps) {
  const dur = scene.end - scene.start
  const enter = ease(clamp(progress(t, 0, 0.6), 0, 1))

  // Loop back strictly at the very tail (last 0.2s) with zero ghost overlap during hold
  const loopBack = ease(clamp(progress(t, dur - 0.2, dur), 0, 1))

  return (
    <ChronoBerth>
      {/* Active CTA Body */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 1 - loopBack,
          display: loopBack >= 1 ? 'none' : 'block',
        }}
      >
        {/* Top Header */}
        <QuestionHeader
          badge="انبارداری بدون زیان"
          badgeColor={BORDER_EMERALD}
          title="انبار همیشه تازه، بدون کالای سوخته"
          opacity={enter}
        />

        {/* Center CTA Button Cluster (Y: 340..540) */}
        <div
          style={{
            position: 'absolute',
            top: 360,
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
              background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
              boxShadow: '0 0 35px rgba(16, 185, 129, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 900,
              color: '#07090e',
              cursor: 'pointer',
            }}
          >
            همین حالا رایگان امتحان کن
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
            مدیریت هوشمند بچ، انقضا و انبارداری در حسابچه
          </div>
        </div>

        {/* Bottom Banner */}
        <BottomBanner text="حسابچه · سپر سرمایه در برابر فساد کالا" color="#10b981" />
      </div>

      {/* Frame 0 Loop Anchor (Only present in final 0.2s) */}
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
              fontSize: 130,
              fontWeight: 900,
              color: '#f59e0b',
              textShadow: '0 0 35px rgba(245, 158, 11, 0.45)',
            }}
          >
            {faNumber(3)}
          </div>
        </div>
      )}
    </ChronoBerth>
  )
}
