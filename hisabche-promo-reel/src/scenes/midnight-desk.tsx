// ============================================
// Reel 92 — «میز نیمه‌شب — ساعت ۱۱ شب، حساب روشن در جیب»
// Bespoke Motion Engine: Executive Night-Desk Terminal & Telemetry Horizon
// (میز مدیریت شبانه و تراز نهایی دخل)
//
// 100% Dark Studio Theme (Obsidian & Amber Task-Light Glow)
// Zero-overlap certified geometry (Canvas: 540x960, disjoint vertical bands)
// Deterministic numerals via faNumber.
//
// Persistent arithmetic:
//   ۱٬۸۴۰٬۰۰۰ فروش − ۱٬۲۲۵٬۰۰۰ بهای تمام‌شده − ۱۴۰٬۰۰۰ خرج = ۴۷۵٬۰۰۰ سود
//   طلب ۲۱۸٬۰۰۰ · انبار ۳۱۲ (۳ قلم بحرانی)
// ============================================

import type { ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

type SceneProps = { t: number; scene: Scene }

// ─── Tokens ──────────────────────────────────────────────────────────────────
export const DESK_NIGHT = '#070a10'
export const WOOD_TOP = '#0f141f'
export const LAMP_GOLD = '#f59e0b'
export const ALERT_RED = '#f43f5e'
export const OK_GREEN = '#10b981'
export const NIGHT_MIST = '#f8fafc'
export const BORDER_SUBTLE = 'rgba(255, 255, 255, 0.08)'
export const TEXT_SLATE = '#94a3b8'

/** Pinned 540x960 LTR Stage with warm executive desk ambient lighting */
export function MidnightDeskStage({
  t,
  children,
}: {
  scene?: Scene
  t: number
  children: ReactNode
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: 540,
        height: 960,
        backgroundColor: DESK_NIGHT,
        color: '#f8fafc',
        fontFamily: 'Vazirmatn, system-ui, sans-serif',
        overflow: 'hidden',
        direction: 'ltr',
      }}
    >
      {/* Warm Task-Lamp Radial Wash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(600px 420px at 50% 12%, rgba(245, 158, 11, 0.1), transparent 70%), radial-gradient(700px 500px at 80% 80%, rgba(16, 185, 129, 0.05), transparent 75%)',
          pointerEvents: 'none',
        }}
      />

      {/* Floating Ambient Dust */}
      <svg
        width="540"
        height="960"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.2 }}
      >
        {[...Array(16)].map((_, i) => {
          const x = (i * 35 + ((i * 19) % 45)) % 540
          const baseY = 100 + i * 48
          const driftY = baseY + Math.sin(t * 0.7 + i) * 14
          return (
            <circle
              key={i}
              cx={x}
              cy={driftY}
              r={2 + (i % 3)}
              fill="#f59e0b"
              opacity={0.3 + (i % 4) * 0.12}
              style={{ filter: 'blur(2px)' }}
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
              backgroundColor: '#f59e0b',
              boxShadow: '0 0 10px #f59e0b',
            }}
          />
          <span>تسویه حساب پایان روز</span>
        </div>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#38bdf8', letterSpacing: 1 }}>
          MIDNIGHT_DESK // V92
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
        <span>حسابچه · آرامش مالی شبانه</span>
        <span style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: 0.5 }}>
          23:00 // SHIFT_CLOSE
        </span>
      </div>
    </div>
  )
}

/** Standard Scene Header Cluster at Y = 150..220 */
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
        backgroundColor: 'rgba(15, 20, 32, 0.85)',
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
export function DeskWords({
  t,
  cueAt,
  words,
  y,
  size = 40,
  accentWord,
  accentColor = LAMP_GOLD,
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
        color: NIGHT_MIST,
        zIndex: 25,
      }}
    >
      {words.map((w) => (
        <span key={w} style={{ color: w === accentWord ? accentColor : NIGHT_MIST }}>
          {w}
        </span>
      ))}
    </div>
  )
}

// ============================================
// SCENE 1: DeskPovScene (0–8s) — The Executive Midnight Desk
// ============================================
export function DeskPovScene({ t, scene }: SceneProps) {
  const enter = clamp(progress(t, 0, 0.8), 0, 1)

  return (
    <MidnightDeskStage scene={scene} t={t}>
      <SceneHeader
        badge="پایان شیفت کاری"
        badgeColor={LAMP_GOLD}
        title="ساعت ۱۱ شب… هنوز حساب روشن نیست"
        opacity={enter}
      />

      {/* Desk Surface Chamber (Y: 260..635) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 260,
          left: 40,
          right: 40,
          height: 380,
          backgroundColor: WOOD_TOP,
          borderRadius: 18,
          border: `1.5px solid ${BORDER_SUBTLE}`,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
            دفتر دخل و فاکتورهای روزانه
          </span>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 6,
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: `1px solid ${LAMP_GOLD}`,
              fontSize: 12,
              fontWeight: 800,
              color: LAMP_GOLD,
            }}
          >
            ۲۳:۰۰ شب
          </span>
        </div>

        {/* 3 Physical Ledger Piles on Desk */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              height: 64,
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              borderRadius: 10,
              border: `1px solid ${BORDER_SUBTLE}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 14px',
            }}
          >
            <span style={{ fontSize: 14, color: TEXT_SLATE }}>دسته‌چک و فاکتورهای فروش:</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#ffffff' }}>
              {faNumber(1840000)}
            </span>
          </div>

          <div
            style={{
              height: 64,
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              borderRadius: 10,
              border: `1px solid ${BORDER_SUBTLE}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 14px',
            }}
          >
            <span style={{ fontSize: 14, color: TEXT_SLATE }}>حواله‌های خرید و بدهی انبار:</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#f59e0b' }}>
              {faNumber(1225000)}
            </span>
          </div>

          <div
            style={{
              height: 64,
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              borderRadius: 10,
              border: `1px solid ${BORDER_SUBTLE}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 14px',
            }}
          >
            <span style={{ fontSize: 14, color: TEXT_SLATE }}>هزینه‌های متفرقه و نقدی:</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: ALERT_RED }}>
              {faNumber(140000)}
            </span>
          </div>
        </div>

        <div style={{ fontSize: 13, color: TEXT_SLATE, textAlign: 'center' }}>
          جمع نهایی دخل پس از ساعت‌ها محاسبه همچنان مبهم است
        </div>
      </div>

      <BottomBanner text="برگه‌ها روی میز مانده‌اند و خستگی پایان روز" color="#fbbf24" />
    </MidnightDeskStage>
  )
}

// ============================================
// SCENE 2: DeadpanLookScene (8–14s) — The Executive Chrono Dial (No Cartoons)
// ============================================
export function DeadpanLookScene({ t, scene }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.6), 0, 1))

  return (
    <MidnightDeskStage scene={scene} t={t}>
      <SceneHeader
        badge="زمان‌سنج پایان شیفت"
        badgeColor={LAMP_GOLD}
        title="حساب امشب را به فردا نینداز!"
        opacity={enter}
      />

      {/* Center Chrono Dial (Y: 260..635) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 260,
          left: 40,
          right: 40,
          height: 380,
          backgroundColor: WOOD_TOP,
          borderRadius: 18,
          border: `1.5px solid rgba(245, 158, 11, 0.35)`,
          boxShadow: '0 0 35px rgba(245, 158, 11, 0.15)',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: LAMP_GOLD }}>
          ساعت ۲۳:۰۷ // موعد تسویه نهایی
        </div>

        {/* Circular Clock Dial */}
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: '50%',
            border: `3px solid ${LAMP_GOLD}`,
            boxShadow: '0 0 25px rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: 2,
          }}
        >
          23:07
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#ffffff' }}>
            خستگی از کار، اما بدون ابهام
          </div>
          <div style={{ fontSize: 14, color: TEXT_SLATE }}>
            اگر امشب دخل بسته نشود، فردا خطاها چند برابر می‌شوند
          </div>
        </div>
      </div>

      <BottomBanner text="تسویه حساب خودکار در چند ثانیه با حسابچه" color="#38bdf8" />
    </MidnightDeskStage>
  )
}

// ============================================
// SCENE 3: PhoneWhipScene (14–23s) — Mobile Live Dashboard
// ============================================
export function PhoneWhipScene({ t, scene }: SceneProps) {
  const enter = spring(clamp(progress(t, 0, 0.7), 0, 1))

  return (
    <MidnightDeskStage scene={scene} t={t}>
      <SceneHeader
        badge="داشبورد جیبی"
        badgeColor={OK_GREEN}
        title="با یک سوایپ؛ کل حساب مرتب شد"
        opacity={clamp(enter * 1.5)}
      />

      {/* Titanium Mobile Frame (Y: 260..635) */}
      <div
        style={{
          position: 'absolute',
          top: 260,
          left: 135,
          width: 270,
          height: 380,
          borderRadius: 24,
          overflow: 'hidden',
          backgroundColor: '#0c111a',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 25px rgba(16, 185, 129, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '16px 14px',
          transform: `scale(${0.92 + enter * 0.08})`,
        }}
      >
        {/* Mobile Header */}
        <div
          dir="rtl"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span style={{ fontSize: 15, fontWeight: 900, color: LAMP_GOLD }}>حسابچه</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: OK_GREEN,
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            همگام
          </span>
        </div>

        {/* 3 Metric Rows */}
        <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              padding: '6px 10px',
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
            }}
          >
            <span style={{ color: TEXT_SLATE }}>فروش:</span>
            <span style={{ fontWeight: 800, color: '#ffffff' }}>{faNumber(1840000)}</span>
          </div>

          <div
            style={{
              padding: '6px 10px',
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
            }}
          >
            <span style={{ color: TEXT_SLATE }}>بهای کالا:</span>
            <span style={{ fontWeight: 800, color: '#f59e0b' }}>{faNumber(1225000)}</span>
          </div>

          <div
            style={{
              padding: '6px 10px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: `1px solid ${OK_GREEN}`,
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
            }}
          >
            <span style={{ color: OK_GREEN, fontWeight: 800 }}>سود خالص:</span>
            <span style={{ fontWeight: 900, color: '#ffffff' }}>{faNumber(475000)}</span>
          </div>
        </div>

        <div dir="rtl" style={{ textAlign: 'center', fontSize: 11, color: TEXT_SLATE }}>
          ترازنامه و صندوق کاملاً تایید شد ✓
        </div>
      </div>

      <BottomBanner text="همه آمار فروش و سود در گوشی همراه شما" color="#10b981" />
    </MidnightDeskStage>
  )
}

// ============================================
// SCENE 4: StockAlertScene (23–34s) — Critical Stock Triage
// ============================================
export function StockAlertScene({ t, scene }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.6), 0, 1))
  const fixProgress = clamp(progress(t, 3.0, 5.0), 0, 1)

  return (
    <MidnightDeskStage scene={scene} t={t}>
      <SceneHeader
        badge="کنترل موجودی انبار"
        badgeColor={OK_GREEN}
        title="کسری انبار؛ خودکار سبز شد"
        opacity={enter}
      />

      {/* Stock Triage Panel (Y: 260..635) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 260,
          left: 40,
          right: 40,
          height: 380,
          backgroundColor: WOOD_TOP,
          borderRadius: 18,
          border: `1.5px solid ${BORDER_SUBTLE}`,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Row 1: کالای بازرگانی */}
        <div
          style={{
            height: 90,
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 12,
            border: `1px solid ${BORDER_SUBTLE}`,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
              کد ۱۰۱ · کالای بازرگانی
            </span>
            <span style={{ fontSize: 13, color: TEXT_SLATE }}>موجودی مانده: {faNumber(2)} عدد</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: OK_GREEN }}>
            سفارش مجدد ثبت شد ✓
          </span>
        </div>

        {/* Row 2: کالای مصرفی (Turns green) */}
        <div
          style={{
            height: 90,
            backgroundColor:
              fixProgress > 0.5 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
            borderRadius: 12,
            border: `1.5px solid ${fixProgress > 0.5 ? OK_GREEN : ALERT_RED}`,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'border 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
              کد ۱۴۲ · کالای مصرفی
            </span>
            <span style={{ fontSize: 13, color: fixProgress > 0.5 ? OK_GREEN : ALERT_RED }}>
              {fixProgress > 0.5 ? 'موجودی تامین شد' : 'اتمام موجودی در قفسه'}
            </span>
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: fixProgress > 0.5 ? OK_GREEN : ALERT_RED,
            }}
          >
            {fixProgress > 0.5 ? 'رفع بحران ✓' : 'هشدار فوری ⚠'}
          </span>
        </div>

        {/* Row 3: کالای استاندارد */}
        <div
          style={{
            height: 90,
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 12,
            border: `1px solid ${BORDER_SUBTLE}`,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
              کد ۲۰۳ · کالای استاندارد
            </span>
            <span style={{ fontSize: 13, color: TEXT_SLATE }}>موجودی مانده: {faNumber(3)} عدد</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: OK_GREEN }}>وضعیت ایمن ✓</span>
        </div>
      </div>

      <BottomBanner text="کسری انبار قبل از ورود مشتری شناسایی می‌شود" color="#10b981" />
    </MidnightDeskStage>
  )
}

// ============================================
// SCENE 5: MicroSmileScene (34–40s) — Peaceful Sleep & Complete Closure
// ============================================
export function MicroSmileScene({ t, scene }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.6), 0, 1))

  return (
    <MidnightDeskStage scene={scene} t={t}>
      <SceneHeader
        badge="آرامش پایان روز"
        badgeColor={OK_GREEN}
        title="با خیال راحت استراحت کن"
        opacity={enter}
      />

      {/* Closure Certificate Chamber (Y: 260..635) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 260,
          left: 40,
          right: 40,
          height: 380,
          backgroundColor: WOOD_TOP,
          borderRadius: 18,
          border: `2px solid ${OK_GREEN}`,
          boxShadow: '0 0 45px rgba(16, 185, 129, 0.2)',
          padding: '28px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            padding: '4px 14px',
            borderRadius: 999,
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${OK_GREEN}`,
            fontSize: 13,
            fontWeight: 800,
            color: OK_GREEN,
          }}
        >
          تسویه قطعی // سند روزانه بسته شد
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, color: TEXT_SLATE }}>سود خالص واقعی امروز:</span>
          <div
            style={{
              fontSize: 52,
              fontWeight: 900,
              lineHeight: 1,
              color: '#ffffff',
              textShadow: '0 0 35px rgba(16, 185, 129, 0.6)',
            }}
          >
            {faNumber(475000)}
          </div>
        </div>

        <div
          style={{
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 14,
            fontWeight: 700,
            color: NIGHT_MIST,
          }}
        >
          صندوق تراز شد · انبار به‌روزرسانی شد · دخل شفاف
        </div>
      </div>

      <BottomBanner text="حسابچه؛ بدون ابهام، بدون استرس کسری دخل" color="#10b981" />
    </MidnightDeskStage>
  )
}

// ============================================
// SCENE 6: DeskCtaScene (40–45s) — CTA & Seamless Loop
// ============================================
export function DeskCtaScene({ t, scene }: SceneProps) {
  const dur = scene.end - scene.start
  const enter = ease(clamp(progress(t, 0, 0.6), 0, 1))
  const loopBack = ease(clamp(progress(t, dur - 0.2, dur), 0, 1))

  return (
    <MidnightDeskStage scene={scene} t={t}>
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
          badge="شروع بدون ریسک"
          badgeColor={LAMP_GOLD}
          title="حساب روشن، از همین امشب"
          opacity={enter}
        />

        {/* CTA Pod (Y: 340..540) */}
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
              background: 'linear-gradient(135deg, #f59e0b 0%, #10b981 100%)',
              boxShadow: '0 0 35px rgba(245, 158, 11, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 900,
              color: '#070a10',
              cursor: 'pointer',
            }}
          >
            همین امشب رایگان امتحان کن
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
            نرم‌افزار یکپارچه حسابداری ابری و آفلاین حسابچه
          </div>
        </div>

        <BottomBanner text="حسابچه · حساب همیشه روشن، دخل همیشه شفاف" color="#fbbf24" />
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
              fontSize: 48,
              fontWeight: 900,
              color: LAMP_GOLD,
            }}
          >
            ۲۳:۰۰
          </div>
        </div>
      )}
    </MidnightDeskStage>
  )
}
