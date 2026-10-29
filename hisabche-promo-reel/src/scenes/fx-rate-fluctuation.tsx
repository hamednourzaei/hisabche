// ============================================
// FX-Rate-Fluctuation Art Direction (Reel 78) — Bespoke SaaS Motion
// The Multi-Currency Vault & Automated FX Gain/Loss Shield
//
// Palette: Dark Cybernetic Obsidian (#08090f), Electric Cyan (#00E5FF),
// Mint Emerald (#00E676), Crimson Alert (#FF3D00), Radiant Gold (#FFD700)
// High-depth 3D perspective, zero hold-frame overlap,
// strict physical container-local coordinates, 100% dark studio theme,
// NO hardcoded currency names (strictly numeric & ISO tokens).
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, mix, progress, spring } from '../engine/anim'
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
export function FxStage({
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
        background: 'radial-gradient(circle at 50% 25%, #0e1526 0%, #08090f 75%, #030406 100%)',
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
            'linear-gradient(rgba(0, 229, 255, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 215, 0, 0.4) 1px, transparent 1px)',
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
          color: GOLD,
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

// ─── Scene 1 — The FX Fluctuation Shock: Frame-0 Arrest ─────────────────

export function FxShockDilemmaScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.2)
  const shake = t > 1.2 && t < 2.0 ? Math.sin(t * 30) * 3 : 0

  return (
    <FxStage scene={scene} t={t} label="// 01 · نوسان نرخ ارز در تسویه">
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
          فاکتور با یک نرخ، تسویه با نرخ دیگر…
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
          سود کردی یا ضرر؟
        </div>
      </div>

      {/* Two Timeline Rate Cards (Safe Zone y: 280..520) */}
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
        {/* Morning Issue Rate (x: 40..250) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 40,
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
                background: CYAN,
                boxShadow: `0 0 10px ${CYAN}`,
              }}
            />
            <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
              صدور فاکتور (صبح)
            </span>
          </div>

          <div
            style={{
              ...MONO,
              fontSize: 32,
              fontWeight: 900,
              color: CYAN,
              textAlign: 'center',
            }}
          >
            {faNumber(1000)} FX
          </div>

          <div
            dir="rtl"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.7)',
              textAlign: 'center',
            }}
          >
            نرخ تسعیر: {faNumber(70)}
          </div>
        </div>

        {/* Evening Settlement Jump (x: 290..500) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 290,
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
                background: CRIMSON,
                boxShadow: `0 0 10px ${CRIMSON}`,
              }}
            />
            <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
              لحظه وصول (عصر)
            </span>
          </div>

          <div
            style={{
              ...MONO,
              fontSize: 32,
              fontWeight: 900,
              color: CRIMSON,
              textAlign: 'center',
            }}
          >
            {faNumber(74)} FX
          </div>

          <div
            dir="rtl"
            style={{ fontSize: 12, fontWeight: 700, color: CRIMSON, textAlign: 'center' }}
          >
            پرش ناگهانی نرخ تبدیل!
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
            محو شدن سود در نوسان نرخ
          </div>
          <div
            style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}
          >
            بدون تسعیر خودکار، بازرگان متوجه ضرر نوسان ارز در معاملات نسیه نمی‌شود
          </div>
        </div>
      </div>
    </FxStage>
  )
}

// ─── Scene 2 — Multi-Currency Dual-Ledger Telemetry ─────────────────────

export function DualCurrencyTelemetryScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.4)

  return (
    <FxStage scene={scene} t={t} label="// 02 · تراز ارزی و دفتر کل">
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
          <span style={{ color: GOLD, fontSize: 18 }}>💱</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
            ثبت فاکتور با نرخ قفل‌شده روز
          </span>
        </div>
        <span
          style={{
            ...MONO,
            fontSize: 11,
            background: `${GOLD}22`,
            color: GOLD,
            padding: '3px 8px',
            borderRadius: 6,
            fontWeight: 800,
          }}
        >
          LOCKED RATE
        </span>
      </div>

      {/* Dual Currency Cockpit (Safe Zone y: 240..560) */}
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
          boxShadow: `0 30px 80px rgba(0,0,0,0.9), 0 0 40px ${GOLD}22`,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          opacity: clamp(p1 * 1.5),
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
            MULTI-FX LEDGER
          </span>
          <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            فاکتور فروش ارزی #۸۹۲
          </span>
        </div>

        {/* Dual Column Telemetry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 15,
              fontWeight: 800,
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>مبلغ به ارز معامله:</span>
            <span style={{ ...MONO, color: CYAN, fontWeight: 900 }}>{faNumber(1000)} FX</span>
          </div>

          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 15,
              fontWeight: 800,
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>نرخ تبدیل رسمی روز:</span>
            <span style={{ ...MONO, color: GOLD, fontWeight: 900 }}>{faNumber(70)}</span>
          </div>

          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: 10,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
              ثبت معادل در دفاتر پایه:
            </span>
            <span style={{ ...MONO, fontSize: 24, fontWeight: 900, color: EMERALD }}>
              {faNumber(70000)}
            </span>
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
          background: 'rgba(0, 230, 118, 0.1)',
          border: `1.5px solid ${EMERALD}`,
          borderRadius: 20,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          opacity: clamp(p2 * 1.5),
          transform: `scale(${mix(0.85, 1, p2).toFixed(3)})`,
        }}
      >
        <span style={{ color: EMERALD, fontSize: 24, fontWeight: 900 }}>✓</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            هیچ فاکتور ارزی بدون نرخ روز نمی‌ماند
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
            ترازنامه دفتری همیشه به ارز پایه رسمی محاسبه و نگهداری می‌شود
          </div>
        </div>
      </div>
    </FxStage>
  )
}

// ─── Scene 3 — Automated FX Gain/Loss Recognition ───────────────────────

export function FxGainLossRecognitionScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.4)
  const p3 = pop(t, 2.6)

  return (
    <FxStage scene={scene} t={t} label="// 03 · تفکیک سود بازرگانی و تسعیر">
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
          لحظه واریز و تسویه فاکتور
        </div>
        <div style={{ fontSize: 40, fontWeight: 900, color: EMERALD, marginTop: 4 }}>
          شناسایی خودکار سود تسعیر
        </div>
      </div>

      {/* 3 Step Settlement Arithmetic (Safe Zone y: 240..510) */}
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
        {/* Step 1: Invoiced Amount at Issue */}
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
            مبلغ تعهد فاکتور (نرخ ۷۰):
          </span>
          <span style={{ ...MONO, fontSize: 18, fontWeight: 900, color: CYAN }}>
            {faNumber(70000)}
          </span>
        </div>

        {/* Step 2: Collected Value at Settlement */}
        <div
          dir="rtl"
          style={{
            background: 'linear-gradient(145deg, #101c16, #09120e)',
            border: `1.5px solid ${GOLD}`,
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
            ارزش وصولی روز تسویه (نرخ ۷۴):
          </span>
          <span style={{ ...MONO, fontSize: 18, fontWeight: 900, color: GOLD }}>
            {faNumber(74000)}
          </span>
        </div>

        {/* Step 3: Pure Gain Recognized */}
        <div
          dir="rtl"
          style={{
            background: 'linear-gradient(145deg, #101c18, #0a120f)',
            border: `2px solid ${EMERALD}`,
            borderRadius: 16,
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: clamp(p3 * 1.5),
            transform: `translateY(${mix(20, 0, p3).toFixed(1)}px)`,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            سود خالص حاصل از تسعیر ارز:
          </span>
          <span style={{ ...MONO, fontSize: 24, fontWeight: 900, color: EMERALD }}>
            + {faNumber(4000)}
          </span>
        </div>
      </div>

      {/* Confirmation Pill Below (Safe Zone y: 550..700) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 550,
          left: 40,
          right: 40,
          background: 'rgba(0, 230, 118, 0.08)',
          border: `1.5px solid ${EMERALD}44`,
          borderRadius: 20,
          padding: '16px 20px',
          textAlign: 'center',
          fontSize: 15,
          fontWeight: 800,
          color: '#ffffff',
        }}
      >
        سود معامله بازرگانی از سود نوسان ارز تفکیک می‌شود
      </div>
    </FxStage>
  )
}

// ─── Scene 4 — Automatic Double-Entry Journal Voucher ───────────────────

export function FxJournalVoucherScene({ t, scene }: { t: number; scene: Scene }) {
  const p = pop(t, 0.3)

  return (
    <FxStage scene={scene} t={t} label="// 04 · سند دوبل تسعیر ارز">
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
          سند حسابداری مطابق استاندارد
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: GOLD, marginTop: 4 }}>
          ثبت بدون خطای سرفصل سود و زیان تسعیر
        </div>
      </div>

      {/* Double-Entry Voucher Cockpit (Safe Zone y: 230..540) */}
      <div
        style={{
          position: 'absolute',
          top: 230,
          left: 40,
          right: 40,
          height: 300,
          background: 'linear-gradient(145deg, #101626, #090e18)',
          border: `2px solid ${GOLD}`,
          borderRadius: 24,
          boxShadow: `0 30px 80px rgba(0,0,0,0.9), 0 0 45px ${GOLD}33`,
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
              background: `${GOLD}22`,
              color: GOLD,
              borderRadius: 6,
              padding: '3px 8px',
              fontWeight: 800,
            }}
          >
            JOURNAL VOUCHER #902
          </span>
          <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            سند تسعیر پایان دوره
          </span>
        </div>

        {/* Journal Lines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            <span>بدهکار: بانک و صندوق ارزی</span>
            <span style={{ ...MONO, color: '#ffffff' }}>{faNumber(74000)}</span>
          </div>

          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            <span>بستانکار: حساب‌های دریافتنی تجاری</span>
            <span style={{ ...MONO, color: 'rgba(255,255,255,0.7)' }}>{faNumber(70000)}</span>
          </div>

          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              fontWeight: 900,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: 8,
            }}
          >
            <span style={{ color: EMERALD }}>بستانکار: سود تسعیر ارز</span>
            <span style={{ ...MONO, color: EMERALD }}>{faNumber(4000)}</span>
          </div>
        </div>

        <div
          dir="rtl"
          style={{
            background: 'rgba(0, 230, 118, 0.08)',
            border: `1px solid ${EMERALD}44`,
            borderRadius: 14,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>
            تراز کامل دفتر روزنامه و کل
          </span>
          <span style={{ ...MONO, fontSize: 11, color: EMERALD, fontWeight: 800 }}>BALANCED ✓</span>
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
        حسابدار رسمی و صراف بدون اختلاف به یک تراز مشترک می‌رسند
      </div>
    </FxStage>
  )
}

// ─── Scene 5 — Currency Fluctuation Shield Manifesto ────────────────────

export function FxShieldManifestoScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.2)
  const p3 = pop(t, 2.2)

  return (
    <FxStage scene={scene} t={t} label="// 05 · امنیت معاملات بین‌المللی">
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
          نه سود کاغذی موهوم…
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
          نه زیان پنهان از نوسان…
        </div>

        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            color: '#08090f',
            background: `linear-gradient(135deg, ${EMERALD}, ${GOLD})`,
            padding: '12px 42px',
            borderRadius: 22,
            boxShadow: `0 20px 60px ${GOLD}55`,
            opacity: clamp(p3 * 1.5),
            transform: `scale(${mix(0.8, 1, p3).toFixed(3)})`,
            textAlign: 'center',
          }}
        >
          شفافیت در هر ۷۵ ارز!
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
            پوشش کامل ریسک نوسان برای واردکنندگان و صرافان
          </span>
        </div>
        <span style={{ ...MONO, fontSize: 12, color: GOLD, fontWeight: 800 }}>FX SHIELD</span>
      </div>
    </FxStage>
  )
}

// ─── Scene 6 — High-Impact Brand Monolith & CTA ─────────────────────────

export function FxCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const brandP = pop(t, 0.2)
  const btnP = pop(t, 1.2)

  return (
    <FxStage scene={scene} t={t} label="// 06 · شروع رایگان">
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
            textShadow: `0 15px 40px ${GOLD}55`,
          }}
        >
          حسابچه
        </div>

        <div
          style={{
            width: 220,
            height: 6,
            background: `linear-gradient(90deg, ${GOLD}, ${EMERALD})`,
            borderRadius: 3,
            boxShadow: `0 0 20px ${GOLD}`,
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
          حسابداری چندارزی و تسعیر خودکار
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
            background: `linear-gradient(135deg, ${GOLD}, #d4a000)`,
            color: '#08090f',
            fontSize: 40,
            fontWeight: 900,
            padding: '16px 64px',
            borderRadius: 24,
            boxShadow: `0 20px 60px ${GOLD}66, 0 0 35px ${GOLD}44`,
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
        پشتیبانی از انواع ارزها با جدول نرخ‌های لحظه‌ای بازار
      </div>
    </FxStage>
  )
}
