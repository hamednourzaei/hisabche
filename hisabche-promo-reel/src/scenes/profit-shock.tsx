// ============================================
// Reel 91 — «شوک عدد — فروش ۲۵ میلیون، سود فقط ۶ میلیون»
// Bespoke Motion Engine: High-Pressure Hydraulic Manometer & Profit Separation Siphon
// (فشارسنج هیدرولیک و سیفون جداسازی سود خالص)
//
// 100% Dark Studio Theme (Obsidian & Pressure Amber / Cyan Laser / Rose Outflow)
// Zero-overlap certified geometry (Canvas: 540x960, disjoint vertical bands)
// Deterministic numerals via faNumber.
//
// Persistent arithmetic:
//   ۲۵٬۰۰۰٬۰۰۰ فروش − ۱۵٬۲۰۰٬۰۰۰ بهای کالا − ۳٬۸۰۰٬۰۰۰ خرج = ۶٬۰۰۰٬۰۰۰ سود خالص (۲۴٪)
// ============================================

import type { ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, progress } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

type SceneProps = { t: number; scene: Scene }

// Design Tokens
const BG_OBSIDIAN = '#06080e'
const BG_PANEL = '#0c111c'
const BORDER_SUBTLE = 'rgba(255, 255, 255, 0.08)'
const GOLD_AMBER = '#f59e0b'
const LASER_CYAN = '#06b6d4'
const COST_ROSE = '#f43f5e'
const PROFIT_GREEN = '#10b981'
const TEXT_SLATE = '#94a3b8'

/** Root Hydraulic Chamber pinned to 540x960 LTR with RTL inner clusters */
function ManometerChamber({ children }: { children: ReactNode }) {
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
      {/* Background Hydraulic Radial Gradients */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(600px 450px at 50% 25%, rgba(6, 182, 212, 0.08), transparent 70%), radial-gradient(600px 450px at 50% 75%, rgba(245, 158, 11, 0.06), transparent 70%)',
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
          <span>جداسازی هیدرولیک سود</span>
        </div>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#38bdf8', letterSpacing: 1 }}>
          FLOW_PROFIT // V91
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
        <span>حسابچه · محاسبه آناتومی سود</span>
        <span style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: 0.5 }}>
          24% // NET_MARGIN
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
// SCENE 1: ShockHookScene (0–4s) — The Shock Ratio
// ============================================
export function ShockHookScene({ t }: SceneProps) {
  const enter = clamp(progress(t, 0, 0.6), 0, 1)
  const barProgress = ease(clamp(progress(t, 0.3, 2.8), 0, 1))

  return (
    <ManometerChamber>
      <SceneHeader
        badge="شوک واقعیت مالی"
        badgeColor={GOLD_AMBER}
        title="فروش ۲۵ میلیون؛ سود فقط ۶ میلیون!"
        opacity={enter}
      />

      {/* Dual Manometer Column (Y: 260..635) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 260,
          left: 40,
          right: 40,
          height: 380,
          backgroundColor: BG_PANEL,
          borderRadius: 18,
          border: `1.5px solid ${BORDER_SUBTLE}`,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Column 1: Gross Sales */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span style={{ color: TEXT_SLATE }}>فروش کل فروشگاه:</span>
            <span style={{ fontWeight: 900, color: '#ffffff', fontSize: 18 }}>
              {faNumber(25000000)}
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: 16,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${barProgress * 100}%`,
                height: '100%',
                backgroundColor: LASER_CYAN,
                boxShadow: '0 0 14px #06b6d4',
              }}
            />
          </div>
        </div>

        {/* Column 2: Net Profit (Only 24%) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span style={{ color: GOLD_AMBER, fontWeight: 800 }}>سود خالص واقعی (۲۴٪):</span>
            <span style={{ fontWeight: 900, color: GOLD_AMBER, fontSize: 22 }}>
              {faNumber(6000000)}
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: 16,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${barProgress * 24}%`,
                height: '100%',
                backgroundColor: GOLD_AMBER,
                boxShadow: '0 0 14px #f59e0b',
              }}
            />
          </div>
        </div>

        {/* The Warning Callout */}
        <div
          style={{
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            border: `1px solid rgba(244, 63, 94, 0.3)`,
            borderRadius: 10,
            padding: '10px 14px',
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 700,
            color: '#fda4af',
          }}
        >
          ۱۹ میلیون از فروش، اصلاً به جیب شما نمی‌رسد!
        </div>
      </div>

      <BottomBanner text="فاصله عظیم بین فروش بالا و سود واقعی" color="#fbbf24" />
    </ManometerChamber>
  )
}

// ============================================
// SCENE 2: GrossLadderScene (4–9s) — The Primary Siphon: COGS
// ============================================
export function GrossLadderScene({ t }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.6), 0, 1))

  return (
    <ManometerChamber>
      <SceneHeader
        badge="سیفون اول · بهای کالا"
        badgeColor={COST_ROSE}
        title="بهای جنس؛ بیش از نیمی از فروش"
        opacity={enter}
      />

      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 260,
          left: 40,
          right: 40,
          height: 380,
          backgroundColor: BG_PANEL,
          borderRadius: 18,
          border: `1.5px solid ${BORDER_SUBTLE}`,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            height: 84,
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderRadius: 12,
            border: `1px solid ${BORDER_SUBTLE}`,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 15, color: TEXT_SLATE }}>فروش ناخالص اولیه:</span>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#ffffff' }}>
            {faNumber(25000000)}
          </span>
        </div>

        <div
          style={{
            height: 96,
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            borderRadius: 12,
            border: `1.5px solid ${COST_ROSE}`,
            boxShadow: '0 0 25px rgba(244, 63, 94, 0.2)',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
              − بهای تمام‌شده کالای فروش‌رفته:
            </span>
            <span style={{ fontSize: 20, fontWeight: 900, color: COST_ROSE }}>
              {faNumber(15200000)}
            </span>
          </div>
          <span style={{ fontSize: 12, color: '#fda4af' }}>
            ۶۰٪ کل فروش، به خرید دوباره جنس تعلق دارد
          </span>
        </div>

        <div
          style={{
            height: 84,
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            borderRadius: 12,
            border: `1.5px solid ${LASER_CYAN}`,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 800, color: LASER_CYAN }}>
            سود ناخالص باقی‌مانده:
          </span>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#ffffff' }}>
            {faNumber(9800000)}
          </span>
        </div>
      </div>

      <BottomBanner text="هنوز کرایه، حقوق و قبض‌ها کسر نشده است..." color="#38bdf8" />
    </ManometerChamber>
  )
}

// ============================================
// SCENE 3: CostSwarmScene (9–14s) — The Secondary Siphon: Expenses
// ============================================
export function CostSwarmScene({ t }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.6), 0, 1))

  return (
    <ManometerChamber>
      <SceneHeader
        badge="سیفون دوم · مخارج جاری"
        badgeColor={GOLD_AMBER}
        title="۳ خرج اصلی که سود را می‌بلعند"
        opacity={enter}
      />

      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 260,
          left: 40,
          right: 40,
          height: 380,
          backgroundColor: BG_PANEL,
          borderRadius: 18,
          border: `1.5px solid ${BORDER_SUBTLE}`,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {[
          { label: 'حقوق و دستمزد پرسنل', value: 2100000 },
          { label: 'کرایه مغازه و شارژ', value: 1200000 },
          { label: 'ارسال، بسته‌بندی و متفرقه', value: 500000 },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              height: 80,
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
                style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: GOLD_AMBER }}
              />
              <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>{item.label}</span>
            </div>
            <span style={{ fontSize: 17, fontWeight: 900, color: GOLD_AMBER }}>
              − {faNumber(item.value)}
            </span>
          </div>
        ))}

        <div
          style={{
            height: 60,
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderRadius: 10,
            border: `1px solid ${GOLD_AMBER}`,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 800, color: GOLD_AMBER }}>
            مجموع هزینه‌های جاری:
          </span>
          <span style={{ fontSize: 18, fontWeight: 900, color: '#ffffff' }}>
            − {faNumber(3800000)}
          </span>
        </div>
      </div>

      <BottomBanner text="هزینه‌هایی که اغلب در محاسبات ذهنی فراموش می‌شوند" color="#fbbf24" />
    </ManometerChamber>
  )
}

// ============================================
// SCENE 4: WaterfallSiphonScene (14–22s) — The Unified Flow
// ============================================
export function WaterfallSiphonScene({ t }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.6), 0, 1))

  return (
    <ManometerChamber>
      <SceneHeader
        badge="آناتومی نهایی سود"
        badgeColor={PROFIT_GREEN}
        title="آبشار کسرها تا سود واقعی"
        opacity={enter}
      />

      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 250,
          left: 40,
          right: 40,
          height: 390,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            height: 68,
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

        <div
          style={{
            height: 68,
            backgroundColor: BG_PANEL,
            borderRadius: 12,
            border: `1.5px solid ${COST_ROSE}`,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
            − بهای تمام‌شده کالا
          </span>
          <span style={{ fontSize: 18, fontWeight: 900, color: COST_ROSE }}>
            {faNumber(15200000)}
          </span>
        </div>

        <div
          style={{
            height: 68,
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
            − هزینه‌ها و مخارج
          </span>
          <span style={{ fontSize: 18, fontWeight: 900, color: GOLD_AMBER }}>
            {faNumber(3800000)}
          </span>
        </div>

        {/* Final Pure Profit Collector */}
        <div
          style={{
            height: 84,
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            borderRadius: 14,
            border: `2px solid ${PROFIT_GREEN}`,
            boxShadow: '0 0 35px rgba(16, 185, 129, 0.25)',
            padding: '0 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: PROFIT_GREEN }}>
              = سود خالص قطعی
            </span>
            <span style={{ fontSize: 12, color: TEXT_SLATE }}>حاشیه سود خالص: ۲۴٪</span>
          </div>
          <span style={{ fontSize: 26, fontWeight: 900, color: '#ffffff' }}>
            {faNumber(6000000)}
          </span>
        </div>
      </div>

      <BottomBanner text="سود واقعی ۶ میلیون است، نه ۲۵ میلیون!" color="#10b981" />
    </ManometerChamber>
  )
}

// ============================================
// SCENE 5: ProfitNotSalesScene (22–26s) — The Core Lesson
// ============================================
export function ProfitNotSalesScene({ t, scene }: SceneProps) {
  const enter = ease(clamp(progress(t, 0, 0.6), 0, 1))

  return (
    <ManometerChamber>
      <SceneHeader
        badge="قانون طلایی کسب‌وکار"
        badgeColor={GOLD_AMBER}
        title="فروش بالا؛ یعنی سود بالا؟"
        opacity={enter}
      />

      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 260,
          left: 40,
          right: 40,
          height: 380,
          backgroundColor: BG_PANEL,
          borderRadius: 18,
          border: `2px solid ${GOLD_AMBER}`,
          boxShadow: '0 0 45px rgba(245, 158, 11, 0.2)',
          padding: '32px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_SLATE }}>
          اصل تفکیک فروش از درآمد
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: LASER_CYAN }}>فروش</span>
          <span style={{ fontSize: 40, fontWeight: 900, color: COST_ROSE }}>≠</span>
          <span style={{ fontSize: 32, fontWeight: 900, color: PROFIT_GREEN }}>سود خالص</span>
        </div>

        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 12,
            padding: '14px 16px',
            fontSize: 16,
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.5,
          }}
        >
          دو عدد کاملاً متفاوت با دو سرنوشت جداگانه!
        </div>
      </div>

      <BottomBanner text="مبنای تصمیم‌گیری باید سود باشد، نه گردش حساب" color="#fbbf24" />
    </ManometerChamber>
  )
}

// ============================================
// SCENE 6: ShockCtaScene (26–32s) — Call to Action
// ============================================
export function ShockCtaScene({ t, scene }: SceneProps) {
  const dur = scene.end - scene.start
  const enter = ease(clamp(progress(t, 0, 0.6), 0, 1))
  const loopBack = ease(clamp(progress(t, dur - 0.2, dur), 0, 1))

  return (
    <ManometerChamber>
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
          <div style={{ fontSize: 44, fontWeight: 900, color: GOLD_AMBER }}>۲۴٪</div>
        </div>
      )}
    </ManometerChamber>
  )
}
