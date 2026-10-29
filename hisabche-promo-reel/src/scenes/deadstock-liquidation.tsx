// ============================================
// Deadstock-Liquidation Art Direction (Reel 79) — Bespoke SaaS Motion
// The Cryogenic Dead-Stock Chamber & Dynamic Liquidity Accelerator
//
// Palette: Dark Cybernetic Obsidian (#08090f), Electric Ice-Cyan (#00E5FF),
// Mint Emerald (#00E676), Crimson Alert (#FF3D00), Radiant Gold (#FFD700)
// High-depth 3D perspective, zero hold-frame overlap,
// strict physical container-local coordinates, 100% dark studio theme.
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

export const DARK = '#08090f'
export const CYAN = '#00E5FF'
export const EMERALD = '#00E676'
export const CRIMSON = '#FF3D00'
export const GOLD = '#FFD700'
export const WHITE = '#ffffff'
export const BORDER_GLASS = 'rgba(255, 255, 255, 0.08)'

const MONO: CSSProperties = {
  fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
  direction: 'ltr',
}

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

/** Root Dark Stage: Strictly LTR pinned to avoid RTL mirror flip */
export function DeadstockStage({
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
        background: 'radial-gradient(circle at 50% 25%, #0e1628 0%, #08090f 75%, #030406 100%)',
        overflow: 'hidden',
        color: '#ffffff',
        direction: 'ltr',
      }}
    >
      {/* Precision grid background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage:
            'linear-gradient(rgba(0, 229, 255, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 230, 118, 0.4) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
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
          color: CYAN,
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
            background: EMERALD,
            boxShadow: `0 0 10px ${EMERALD}`,
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

/** Smooth spring helper */
function pop(t: number, at: number, dur = 0.55): number {
  return spring(clamp(progress(t, at, at + dur)) * 1.12)
}

// ─── Scene 1 — The Frozen Stagnant Inventory: Frame-0 Arrest ────────────

export function FrozenInventoryScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.2)
  const shake = t > 1.2 && t < 2.0 ? Math.sin(t * 30) * 3 : 0

  return (
    <DeadstockStage scene={scene} t={t} label="// 01 · کالای راکد و خاک‌خورده">
      {/* Top Headline Anchor (Safe Zone y: 130..250) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 130,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 900, color: 'rgba(255,255,255,0.7)' }}>
          انبار پر از کارتن‌هاییه که…
        </div>
        <div
          style={{
            fontSize: 40,
            fontWeight: 900,
            color: '#ffffff',
            background: `linear-gradient(135deg, ${CRIMSON}, #B30000)`,
            padding: '6px 28px',
            borderRadius: 16,
            boxShadow: `0 0 35px ${CRIMSON}55`,
          }}
        >
          شش ماهه تکون نخورده!
        </div>
      </div>

      {/* Two Fate Cards in Disjoint Lanes (Safe Zone y: 280..520) */}
      <div
        style={{
          position: 'absolute',
          top: 280,
          left: 0,
          right: 0,
          height: 240,
          transform: `translateX(${shake}px)`,
        }}
      >
        {/* Frozen Capital Monolith (x: 40..250) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 40,
            width: 210,
            height: 220,
            background: 'linear-gradient(145deg, #181216, #100a0e)',
            border: `2px solid ${CRIMSON}`,
            borderRadius: 22,
            boxShadow: `0 25px 60px rgba(0,0,0,0.8), 0 0 30px ${CRIMSON}33`,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            opacity: clamp(p1 * 1.5),
            transform: `scale(${mix(0.85, 1, p1).toFixed(3)})`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: CRIMSON,
                boxShadow: `0 0 10px ${CRIMSON}`,
              }}
            />
            <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
              سرمایه حبس‌شده
            </span>
          </div>

          <div
            style={{
              ...MONO,
              fontSize: 28,
              fontWeight: 900,
              color: CRIMSON,
              textAlign: 'center',
            }}
          >
            {faNumber(48000000)}
          </div>

          <div
            dir="rtl"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.5)',
              textAlign: 'center',
            }}
          >
            پول خوابیده زیر خاک قفسه
          </div>
        </div>

        {/* Opportunity Cost / Cash Drain (x: 290..500) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 290,
            width: 210,
            height: 220,
            background: 'linear-gradient(145deg, #121828, #0a0e1c)',
            border: `2px solid ${CYAN}`,
            borderRadius: 22,
            boxShadow: `0 25px 60px rgba(0,0,0,0.8), 0 0 30px ${CYAN}33`,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            opacity: clamp(p2 * 1.5),
            transform: `scale(${mix(0.85, 1, p2).toFixed(3)})`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: CYAN,
                boxShadow: `0 0 10px ${CYAN}`,
              }}
            />
            <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
              نقدینگی لنگ چک
            </span>
          </div>

          <div
            dir="rtl"
            style={{ fontSize: 15, fontWeight: 800, color: CYAN, textAlign: 'center' }}
          >
            «کمبود پول برای خرید بار تازه و پرفروش»
          </div>

          <div
            dir="rtl"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.5)',
              textAlign: 'center',
            }}
          >
            فرصت‌های از دست رفته بازار
          </div>
        </div>
      </div>

      {/* Discomfort Warning Banner (Safe Zone y: 560..710) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 560,
          left: 40,
          right: 40,
          background: 'rgba(255, 61, 0, 0.12)',
          border: `1.5px solid ${CRIMSON}`,
          borderRadius: 22,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxShadow: `0 20px 50px rgba(0,0,0,0.8), 0 0 30px ${CRIMSON}33`,
          opacity: clamp(p2 * 1.5),
          transform: `scale(${mix(0.85, 1, p2).toFixed(3)})`,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: CRIMSON,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: 22,
          }}
        >
          !
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            ۱۸۰ روز رسوب کالا بدون هشدار
          </div>
          <div
            style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}
          >
            بدون سیستم انبارداری، خواب کالا تا زمان فاسد شدن پنهان می‌ماند
          </div>
        </div>
      </div>
    </DeadstockStage>
  )
}

// ─── Scene 2 — Optical Aging Radar & Dead-Stock Scanner ─────────────────

export function AgingRadarScannerScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const scanP = ease(clamp(progress(t, 1.2, 3.2)))
  const confirmP = pop(t, 3.4)

  return (
    <DeadstockStage scene={scene} t={t} label="// 02 · رادار رسوب و سن کالا">
      {/* Top Banner (y: 130..220) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 130,
          left: 40,
          right: 40,
          background: 'linear-gradient(145deg, #111828, #0a0e1c)',
          border: `1.5px solid ${CYAN}`,
          borderRadius: 18,
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: CYAN, fontSize: 18 }}>📡</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
            رادار تحلیل گردش انبار
          </span>
        </div>
        <span
          style={{
            ...MONO,
            fontSize: 11,
            background: `${EMERALD}22`,
            color: EMERALD,
            padding: '3px 8px',
            borderRadius: 6,
            fontWeight: 800,
          }}
        >
          SCANNING
        </span>
      </div>

      {/* Tiered Inventory Rack (Safe Zone y: 240..560) */}
      <div
        style={{
          position: 'absolute',
          top: 240,
          left: 40,
          right: 40,
          height: 300,
          background: 'linear-gradient(145deg, #0d121c, #07090f)',
          border: '2px solid rgba(255,255,255,0.12)',
          borderRadius: 24,
          boxShadow: `0 30px 80px rgba(0,0,0,0.9), 0 0 40px ${CYAN}22`,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          opacity: clamp(p1 * 1.5),
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ ...MONO, fontSize: 11, color: CYAN, fontWeight: 800 }}>
            STOCK AGING REPORT
          </span>
          <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            طبقه‌بندی سرعت گردش اقلام
          </span>
        </div>

        {/* Radar Scanner Line */}
        <div
          style={{
            height: 3,
            width: '100%',
            background: `linear-gradient(90deg, transparent, ${CYAN}, ${EMERALD}, transparent)`,
            boxShadow: `0 0 15px ${CYAN}`,
            opacity: scanP < 1 ? 1 : 0.3,
          }}
        />

        {/* 3 Velocity Tiers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Fast */}
          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(0, 230, 118, 0.08)',
              padding: '8px 12px',
              borderRadius: 10,
              border: `1px solid ${EMERALD}33`,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800 }}>کالای پرگردش (کمتر از ۱۵ روز):</span>
            <span style={{ color: EMERALD, fontWeight: 900 }}>۱۲۰ قلم ✓ پرفروش</span>
          </div>

          {/* Medium */}
          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 215, 0, 0.08)',
              padding: '8px 12px',
              borderRadius: 10,
              border: `1px solid ${GOLD}33`,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800 }}>کالای کندگردش (۳۰ تا ۶۰ روز):</span>
            <span style={{ color: GOLD, fontWeight: 900 }}>۳۸ قلم · نیاز به آلارم</span>
          </div>

          {/* Dead */}
          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 61, 0, 0.12)',
              padding: '8px 12px',
              borderRadius: 10,
              border: `1px solid ${CRIMSON}`,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 900, color: CRIMSON }}>
              کالای کاملاً راکد (+۱۸۰ روز):
            </span>
            <span style={{ color: CRIMSON, fontWeight: 900 }}>۴۵ قلم · هشدار رسوب!</span>
          </div>
        </div>
      </div>

      {/* Confirmation Pill Below (Safe Zone y: 580..700) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 580,
          left: 40,
          right: 40,
          background: 'rgba(0, 229, 255, 0.1)',
          border: `1.5px solid ${CYAN}`,
          borderRadius: 20,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          opacity: clamp(confirmP * 1.5),
          transform: `scale(${mix(0.85, 1, confirmP).toFixed(3)})`,
        }}
      >
        <span style={{ color: CYAN, fontSize: 24, fontWeight: 900 }}>✓</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            شناسایی زودهنگام قبل از افت ارزش کالا
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
            حسابچه پیش از زیان، استراتژی نقدشوندگی پیشنهاد می‌دهد
          </div>
        </div>
      </div>
    </DeadstockStage>
  )
}

// ─── Scene 3 — Smart Liquidation Bundle & Dynamic Defrost ───────────────

export function LiquidationBundleDefrostScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.4)
  const p3 = pop(t, 2.6)

  return (
    <DeadstockStage scene={scene} t={t} label="// 03 · آزادسازی نقدینگی راکد">
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 130,
          left: 0,
          right: 0,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 900, color: 'rgba(255,255,255,0.7)' }}>
          پیشنهاد هوشمند حراج و باندل
        </div>
        <div style={{ fontSize: 40, fontWeight: 900, color: GOLD, marginTop: 4 }}>
          تبدیل جنس خاک‌خورده به پول نقد
        </div>
      </div>

      {/* 3 Step Clearance Flow (Safe Zone y: 240..510) */}
      <div
        style={{
          position: 'absolute',
          top: 240,
          left: 40,
          right: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Step 1: Bundle Suggestion */}
        <div
          dir="rtl"
          style={{
            background: 'linear-gradient(145deg, #121a28, #0a101c)',
            border: `1.5px solid ${CYAN}`,
            borderRadius: 16,
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: clamp(p1 * 1.5),
            transform: `translateY(${mix(20, 0, p1).toFixed(1)}px)`,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
            باندل ترکیبی هوشمند:
          </span>
          <span style={{ color: CYAN, fontWeight: 800 }}>کالای راکد ۱۰۱ + کالای پرفروش ۲۰۲</span>
        </div>

        {/* Step 2: Clearance Discount */}
        <div
          dir="rtl"
          style={{
            background: 'linear-gradient(145deg, #101c16, #09120e)',
            border: `1.5px solid ${EMERALD}`,
            borderRadius: 16,
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: clamp(p2 * 1.5),
            transform: `translateY(${mix(20, 0, p2).toFixed(1)}px)`,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
            تخفیف بهینه برای خروج سریع:
          </span>
          <span style={{ ...MONO, color: EMERALD, fontWeight: 900 }}>
            ۲۰٪ تخفیف (جلوگیری از زیان ۱۰۰٪)
          </span>
        </div>

        {/* Step 3: Fast Liquidation Speed */}
        <div
          dir="rtl"
          style={{
            background: 'linear-gradient(145deg, #1a1710, #120f0a)',
            border: `1.5px solid ${GOLD}`,
            borderRadius: 16,
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: clamp(p3 * 1.5),
            transform: `translateY(${mix(20, 0, p3).toFixed(1)}px)`,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
            زمان تخلیه کامل قفسه:
          </span>
          <span style={{ color: GOLD, fontWeight: 900 }}>کمتر از ۴۸ ساعت!</span>
        </div>
      </div>

      {/* Liquidity Recovered Monolith (Safe Zone y: 540..720) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 540,
          left: 40,
          right: 40,
          background: 'linear-gradient(145deg, #141c10, #0a1208)',
          border: `2px solid ${EMERALD}`,
          borderRadius: 24,
          padding: '18px 24px',
          boxShadow: `0 30px 80px rgba(0,0,0,0.9), 0 0 50px ${EMERALD}44`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          opacity: clamp(p3 * 1.5),
          transform: `scale(${mix(0.85, 1, p3).toFixed(3)})`,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>
          نقدینگی آزادشده و آماده چرخش:
        </div>
        <div
          style={{
            ...MONO,
            fontSize: 42,
            fontWeight: 900,
            color: EMERALD,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {faNumber(48000000)}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
          بازگشت کامل سرمایه حبس‌شده به دخل مغازه
        </div>
      </div>
    </DeadstockStage>
  )
}

// ─── Scene 4 — Reinvestment & Working Capital Cycle ─────────────────────

export function WorkingCapitalCycleScene({ t, scene }: { t: number; scene: Scene }) {
  const p = pop(t, 0.3)

  return (
    <DeadstockStage scene={scene} t={t} label="// 04 · خرید بار تازه و پرفروش">
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 130,
          left: 0,
          right: 0,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 900, color: '#ffffff' }}>
          تزریق پول آزاد به چرخه خرید تازه
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: CYAN, marginTop: 4 }}>
          گردش ۳ برابری سود سرمایه در گردش
        </div>
      </div>

      {/* High-Velocity Reinvestment Cockpit (Safe Zone y: 230..540) */}
      <div
        style={{
          position: 'absolute',
          top: 230,
          left: 40,
          right: 40,
          height: 300,
          background: 'linear-gradient(145deg, #101626, #090e18)',
          border: `2px solid ${CYAN}`,
          borderRadius: 24,
          boxShadow: `0 30px 80px rgba(0,0,0,0.9), 0 0 45px ${CYAN}33`,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          opacity: clamp(p * 1.5),
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              ...MONO,
              fontSize: 11,
              background: `${CYAN}22`,
              color: CYAN,
              borderRadius: 6,
              padding: '3px 8px',
              fontWeight: 800,
            }}
          >
            WORKING CAPITAL SURGE
          </span>
          <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            جایگزینی هوشمند موجودی
          </span>
        </div>

        {/* Reinvestment Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>سرمایه آزادشده:</span>
            <span style={{ ...MONO, color: '#ffffff' }}>{faNumber(48000000)}</span>
          </div>

          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>خرید بار جدید پرتقاضا:</span>
            <span style={{ ...MONO, color: EMERALD }}>کالای استاندارد کد ۱۰۱ ✓</span>
          </div>

          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 16,
              fontWeight: 900,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: 10,
            }}
          >
            <span style={{ color: GOLD }}>پیش‌بینی سود دوره جدید:</span>
            <span style={{ ...MONO, color: GOLD }}>+ ۳۵٪ رشد بازده</span>
          </div>
        </div>

        <div
          dir="rtl"
          style={{
            background: 'rgba(0, 229, 255, 0.08)',
            border: `1px solid ${CYAN}33`,
            borderRadius: 14,
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 800,
            color: '#ffffff',
            textAlign: 'center',
          }}
        >
          انبار سبک شد · دخل پرپول شد
        </div>
      </div>

      {/* Assurance Tag Below (y: 570..680) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 570,
          left: 40,
          right: 40,
          textAlign: 'center',
          fontSize: 15,
          fontWeight: 800,
          color: 'rgba(255,255,255,0.85)',
        }}
      >
        همیشه بدانید کدام قفسه بیشترین سود را برای شما می‌سازد
      </div>
    </DeadstockStage>
  )
}

// ─── Scene 5 — Warehouse Liberation Manifesto ───────────────────────────

export function WarehouseManifestoScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.2)
  const p3 = pop(t, 2.2)

  return (
    <DeadstockStage scene={scene} t={t} label="// 05 · انضباط گردش کالا">
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 180,
          left: 40,
          right: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
        }}
      >
        <div
          style={{
            fontSize: 44,
            fontWeight: 900,
            color: '#ffffff',
            opacity: clamp(p1 * 1.5),
            transform: `scale(${mix(0.8, 1, p1).toFixed(3)})`,
            textAlign: 'center',
          }}
        >
          نه انبار خاک‌خورده…
        </div>

        <div
          style={{
            fontSize: 44,
            fontWeight: 900,
            color: 'rgba(255,255,255,0.7)',
            opacity: clamp(p2 * 1.5),
            transform: `scale(${mix(0.8, 1, p2).toFixed(3)})`,
            textAlign: 'center',
          }}
        >
          نه سرمایه حبس‌شده…
        </div>

        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            color: '#08090f',
            background: `linear-gradient(135deg, ${EMERALD}, ${CYAN})`,
            padding: '12px 42px',
            borderRadius: 22,
            boxShadow: `0 20px 60px ${EMERALD}55`,
            opacity: clamp(p3 * 1.5),
            transform: `scale(${mix(0.8, 1, p3).toFixed(3)})`,
            textAlign: 'center',
          }}
        >
          گردش مداوم نقدینگی!
        </div>
      </div>

      {/* Stability Guarantee Seal (Safe Zone y: 600..710) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 600,
          left: 40,
          right: 40,
          background: 'rgba(15, 20, 35, 0.9)',
          border: `1.5px solid ${BORDER_GLASS}`,
          borderRadius: 20,
          padding: '16px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: EMERALD, fontSize: 20 }}>✓</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
            مدیریت هوشمند کاردکس و پیشگیری از خواب کالا
          </span>
        </div>
        <span style={{ ...MONO, fontSize: 12, color: CYAN, fontWeight: 800 }}>ZERO DEADSTOCK</span>
      </div>
    </DeadstockStage>
  )
}

// ─── Scene 6 — High-Impact Brand Monolith & CTA ─────────────────────────

export function DeadstockCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const brandP = pop(t, 0.2)
  const btnP = pop(t, 1.2)

  return (
    <DeadstockStage scene={scene} t={t} label="// 06 · شروع رایگان">
      {/* Brand Monolith (y: 220..420) */}
      <div
        style={{
          position: 'absolute',
          top: 220,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: clamp(brandP * 1.5),
          transform: `scale(${mix(0.85, 1, brandP).toFixed(3)})`,
        }}
      >
        <div
          dir="rtl"
          style={{
            fontSize: 84,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            textShadow: `0 15px 40px ${CYAN}55`,
          }}
        >
          حسابچه
        </div>

        <div
          style={{
            width: 220,
            height: 6,
            background: `linear-gradient(90deg, ${CYAN}, ${EMERALD})`,
            borderRadius: 3,
            boxShadow: `0 0 20px ${CYAN}`,
            marginTop: 12,
          }}
        />

        <div
          dir="rtl"
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: 'rgba(255,255,255,0.85)',
            marginTop: 22,
          }}
        >
          انبارداری هوشمند و مدیریت نقدینگی
        </div>
      </div>

      {/* Primary CTA Button (y: 500..620) */}
      <div
        style={{
          position: 'absolute',
          top: 500,
          left: '50%',
          transform: `translateX(-50%) scale(${mix(0.8, 1, btnP).toFixed(3)})`,
          opacity: clamp(btnP * 1.5),
        }}
      >
        <div
          dir="rtl"
          style={{
            background: `linear-gradient(135deg, ${EMERALD}, #00b35c)`,
            color: '#08090f',
            fontSize: 40,
            fontWeight: 900,
            padding: '16px 64px',
            borderRadius: 24,
            boxShadow: `0 20px 60px ${EMERALD}66, 0 0 35px ${EMERALD}44`,
            border: '2px solid #ffffff',
            whiteSpace: 'nowrap',
          }}
        >
          شروع دوره رایگان
        </div>
      </div>

      {/* Subtitle Guarantee (y: 650..720) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 650,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 18,
          fontWeight: 800,
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        شناسایی خودکار کالاهای راکد مغازه در کمتر از ۱ دقیقه
      </div>
    </DeadstockStage>
  )
}
