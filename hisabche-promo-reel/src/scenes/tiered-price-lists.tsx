// ============================================
// Tiered-Price-Lists Art Direction (Reel 77) — Bespoke SaaS Motion
// The Confidential Multi-Tier Price Matrix & Margin Shield
//
// Palette: Dark Cybernetic Obsidian (#08090f), Electric Cyan (#00B4FF),
// Royal Indigo (#6C5CE7), Mint Emerald (#00E676), Crimson Alert (#FF3D00), Radiant Gold (#FFD700)
// High-depth 3D perspective, zero hold-frame overlap,
// strict physical container-local coordinates, 100% dark studio theme.
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

export const DARK = '#08090f'
export const CYAN = '#00B4FF'
export const INDIGO = '#6C5CE7'
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
export function TieredStage({
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
        background: 'radial-gradient(circle at 50% 25%, #101428 0%, #08090f 75%, #030406 100%)',
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
            'linear-gradient(rgba(0, 180, 255, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(108, 92, 231, 0.4) 1px, transparent 1px)',
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

// ─── Scene 1 — The Leaked Discount Shock: Frame-0 Arrest ────────────────

export function LeakedDiscountShockScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.2)
  const shake = t > 1.2 && t < 2.0 ? Math.sin(t * 30) * 3 : 0

  return (
    <TieredStage scene={scene} t={t} label="// 01 · لو رفتن قیمت همکار پای پیشخوان">
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
          مشتری عادی مچ مغازه را گرفت:
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
          «چرا به اون ارزون‌تر دادی؟!»
        </div>
      </div>

      {/* Two Customer Cards in Disjoint Lanes (Safe Zone y: 280..520) */}
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
        {/* Retail Customer (x: 40..250) */}
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
              مشتری عادی
            </span>
          </div>

          <div
            style={{
              ...MONO,
              fontSize: 32,
              fontWeight: 900,
              color: '#ffffff',
              textAlign: 'center',
            }}
          >
            {faNumber(42000)}
          </div>

          <div
            dir="rtl"
            style={{ fontSize: 11, fontWeight: 700, color: CRIMSON, textAlign: 'center' }}
          >
            «شنیدم به مشتری قبلی ۳۴ هزار گفتی!»
          </div>
        </div>

        {/* Wholesale Partner (x: 290..500) */}
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
              مشتری همکار
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
            {faNumber(34000)}
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
            قیمت پخش و همکاری محرمانه
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
            لو رفتن اسرار تجاری و چانه‌زنی فرسایشی
          </div>
          <div
            style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}
          >
            حفظ کردن تخفیف‌ها در ذهن یا نوشتن روی کاغذ، همیشه به فاجعه ختم می‌شود
          </div>
        </div>
      </div>
    </TieredStage>
  )
}

// ─── Scene 2 — Multi-Tier Price Matrix Engine ───────────────────────────

const PRICE_TIERS = [
  { tier: 'مشتری عادی (مصرف‌کننده)', price: 42000, color: '#ffffff', x: 36, y: 220 },
  { tier: 'مشتری وفادار (نقره‌ای)', price: 38000, color: INDIGO, x: 284, y: 220 },
  { tier: 'همکار بازاری (طلایی)', price: 34000, color: GOLD, x: 36, y: 400 },
  { tier: 'نمایندگی پخش (عمده)', price: 30000, color: EMERALD, x: 284, y: 400 },
]

export function MultiTierPriceMatrixScene({ t, scene }: { t: number; scene: Scene }) {
  const p = pop(t, 0.2)

  return (
    <TieredStage scene={scene} t={t} label="// 02 · ساختار سطوح قیمت حسابچه">
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
          <span style={{ color: CYAN, fontSize: 18 }}>📊</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
            فهرست‌های قیمت اختصاصی مشتریان
          </span>
        </div>
        <span
          style={{
            ...MONO,
            fontSize: 11,
            background: `${CYAN}22`,
            color: CYAN,
            padding: '3px 8px',
            borderRadius: 6,
            fontWeight: 800,
          }}
        >
          TIER MATRIX
        </span>
      </div>

      {/* 4 Disjoint Tier Cards (Safe Zone y: 220..560, x: 36..256 and 284..504) */}
      {PRICE_TIERS.map((tier, i) => {
        const cardP = pop(t, 0.4 + i * 0.14)
        return (
          <div
            key={tier.tier}
            style={{
              position: 'absolute',
              top: tier.y,
              left: tier.x,
              width: 220,
              height: 154,
              background: 'linear-gradient(145deg, #121626, #0b0e18)',
              border: `1.5px solid ${tier.color}`,
              borderRadius: 20,
              boxShadow: `0 20px 45px rgba(0,0,0,0.7), 0 0 25px ${tier.color}22`,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              opacity: clamp(cardP * 1.5),
              transform: `scale(${mix(0.85, 1, cardP).toFixed(3)})`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: tier.color }} />
              <span dir="rtl" style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>
                {tier.tier}
              </span>
            </div>

            <div
              style={{
                ...MONO,
                fontSize: 28,
                fontWeight: 900,
                color: tier.color,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {faNumber(tier.price)}
            </div>

            <div
              dir="rtl"
              style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}
            >
              اعمال خودکار بر اساس پرونده
            </div>
          </div>
        )
      })}

      {/* Confirmation Seal Below (Safe Zone y: 580..700) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 580,
          left: 40,
          right: 40,
          background: 'rgba(0, 180, 255, 0.08)',
          border: `1.5px solid ${CYAN}44`,
          borderRadius: 20,
          padding: '16px 20px',
          textAlign: 'center',
          fontSize: 15,
          fontWeight: 800,
          color: '#ffffff',
          opacity: clamp(p * 1.5),
        }}
      >
        هر مشتری تنها نرخ مجاز سطح خود را مشاهده می‌کند
      </div>
    </TieredStage>
  )
}

// ─── Scene 3 — Zero-Friction 1-Click Auto Pricing ───────────────────────

export function AutoPricingCheckoutScene({ t, scene }: { t: number; scene: Scene }) {
  const p = pop(t, 0.2)
  const scanP = ease(clamp(progress(t, 1.2, 3.0)))
  const confirmP = pop(t, 3.2)

  return (
    <TieredStage scene={scene} t={t} label="// 03 · بارگذاری آنی نرخ محرمانه">
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
          انتخاب مشتری پای فاکتور
        </div>
        <div style={{ fontSize: 40, fontWeight: 900, color: GOLD, marginTop: 4 }}>
          لود آنی قیمت بدون ۱ کلمه چانه‌زنی
        </div>
      </div>

      {/* POS Cockpit Screen (Safe Zone y: 240..540) */}
      <div
        style={{
          position: 'absolute',
          top: 240,
          left: 40,
          right: 40,
          height: 290,
          background: 'linear-gradient(145deg, #0d121c, #07090f)',
          border: '2px solid rgba(255,255,255,0.12)',
          borderRadius: 24,
          boxShadow: `0 30px 80px rgba(0,0,0,0.9), 0 0 40px ${GOLD}22`,
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
            PARTNER PROFILE
          </span>
          <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            فروش به: فروشگاه پارس (همکار طلایی)
          </span>
        </div>

        {/* Scan Bar */}
        <div
          style={{
            height: 3,
            width: '100%',
            background: `linear-gradient(90deg, transparent, ${GOLD}, ${EMERALD}, transparent)`,
            boxShadow: `0 0 15px ${GOLD}`,
            opacity: scanP < 1 ? 1 : 0.3,
          }}
        />

        {/* Line Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            <span>قیمت پایه مصرف‌کننده:</span>
            <span
              style={{ ...MONO, color: 'rgba(255,255,255,0.5)', textDecoration: 'line-through' }}
            >
              {faNumber(42000)}
            </span>
          </div>

          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 16,
              fontWeight: 900,
            }}
          >
            <span style={{ color: GOLD }}>نرخ ویژه همکاری (سطح طلایی):</span>
            <span style={{ ...MONO, color: GOLD, fontSize: 24 }}>{faNumber(34000)}</span>
          </div>
        </div>

        <div
          dir="rtl"
          style={{
            background: 'rgba(0, 230, 118, 0.08)',
            border: `1px solid ${EMERALD}33`,
            borderRadius: 14,
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 800,
            color: '#ffffff',
            textAlign: 'center',
          }}
        >
          تخفیف هوشمند اعمال شد · بدون امکان مشاهده توسط سایر مشتریان
        </div>
      </div>

      {/* Confirmation Tag Below (y: 560..680) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 560,
          left: 40,
          right: 40,
          textAlign: 'center',
          fontSize: 15,
          fontWeight: 800,
          color: 'rgba(255,255,255,0.85)',
          opacity: clamp(confirmP * 1.5),
        }}
      >
        صندوقدار فقط فاکتور صادر می‌کند؛ فرمول قیمت در کنترل مدیر است
      </div>
    </TieredStage>
  )
}

// ─── Scene 4 — Margin Protection & Discount Guard ───────────────────────

export function MarginProtectionGuardScene({ t, scene }: { t: number; scene: Scene }) {
  const p = pop(t, 0.3)

  return (
    <TieredStage scene={scene} t={t} label="// 04 · محافظت از حاشیه سود">
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
          حفاظت از سود و سقف تخفیف
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: EMERALD, marginTop: 4 }}>
          جلوگیری از تخفیف‌های سلیقه‌ای پرسنل
        </div>
      </div>

      {/* Margin Guard Cockpit (Safe Zone y: 230..540) */}
      <div
        style={{
          position: 'absolute',
          top: 230,
          left: 40,
          right: 40,
          height: 300,
          background: 'linear-gradient(145deg, #101626, #090e18)',
          border: `2px solid ${EMERALD}`,
          borderRadius: 24,
          boxShadow: `0 30px 80px rgba(0,0,0,0.9), 0 0 45px ${EMERALD}33`,
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
              background: `${EMERALD}22`,
              color: EMERALD,
              borderRadius: 6,
              padding: '3px 8px',
              fontWeight: 800,
            }}
          >
            MARGIN GUARD ACTIVE
          </span>
          <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            سود سالم در هر معامله
          </span>
        </div>

        {/* Breakdown Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            <span>بهای تمام‌شده خرید کالا:</span>
            <span style={{ ...MONO, color: '#ffffff' }}>{faNumber(26000)}</span>
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
            <span>قیمت فروش همکاری (حداقل کف):</span>
            <span style={{ ...MONO, color: GOLD }}>{faNumber(34000)}</span>
          </div>

          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 16,
              fontWeight: 900,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: 8,
            }}
          >
            <span style={{ color: EMERALD }}>حاشیه سود خالص تضمین‌شده:</span>
            <span style={{ ...MONO, color: EMERALD }}>+ {faNumber(8000)} (۲۳٪)</span>
          </div>
        </div>

        <div
          dir="rtl"
          style={{
            background: 'rgba(0, 230, 118, 0.08)',
            border: `1px solid ${EMERALD}44`,
            borderRadius: 14,
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 800,
            color: '#ffffff',
            textAlign: 'center',
          }}
        >
          سیستم اجازه فروش زیر کف قیمت مصوب را نمی‌دهد
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
        حفظ سودآوری کسب‌وکار در هر شرایطی از بازار
      </div>
    </TieredStage>
  )
}

// ─── Scene 5 — Commercial Prestige Manifesto ────────────────────────────

export function CommercialPrestigeManifestoScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.2)
  const p3 = pop(t, 2.2)

  return (
    <TieredStage scene={scene} t={t} label="// 05 · پرستیژ تجاری و اعتبار">
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
          نه حفظ کردن تخفیف‌ها…
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
          نه چانه‌زنی پای پیشخوان…
        </div>

        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            color: '#08090f',
            background: `linear-gradient(135deg, ${EMERALD}, ${CYAN})`,
            padding: '12px 42px',
            borderRadius: 22,
            boxShadow: `0 20px 60px ${CYAN}55`,
            opacity: clamp(p3 * 1.5),
            transform: `scale(${mix(0.8, 1, p3).toFixed(3)})`,
            textAlign: 'center',
          }}
        >
          پرستیژ و نظم حرفه‌ای!
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
            اعتبار بالا نزد شرکای تجاری و مشتریان بازار
          </span>
        </div>
        <span style={{ ...MONO, fontSize: 12, color: CYAN, fontWeight: 800 }}>PRESTIGE ERP</span>
      </div>
    </TieredStage>
  )
}

// ─── Scene 6 — High-Impact Brand Monolith & CTA ─────────────────────────

export function TieredCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const brandP = pop(t, 0.2)
  const btnP = pop(t, 1.2)

  return (
    <TieredStage scene={scene} t={t} label="// 06 · شروع رایگان">
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
          مدیریت لیست‌های قیمت و تخفیف گروهی
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
            background: `linear-gradient(135deg, ${CYAN}, #0070cc)`,
            color: '#ffffff',
            fontSize: 40,
            fontWeight: 900,
            padding: '16px 64px',
            borderRadius: 24,
            boxShadow: `0 20px 60px ${CYAN}66, 0 0 35px ${CYAN}44`,
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
        ایجاد نامحدود فهرست قیمت برای همکار، عمده و نمایندگی
      </div>
    </TieredStage>
  )
}
