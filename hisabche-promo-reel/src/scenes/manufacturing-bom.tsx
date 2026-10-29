// ============================================
// Manufacturing-BOM Art Direction (Reel 74) — Bespoke SaaS Motion
// The Precision Workshop Alchemy & Real-time BOM Engine
//
// Palette: Bronze Obsidian (#0a0806), Molten Amber (#FFB300),
// Raw Material Cyan (#00E5FF), Finished Emerald (#00E676), Crimson Alert (#FF3D00)
// High-depth 3D perspective, zero hold-frame overlap,
// strict physical container-local coordinates, 100% dark studio theme.
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

export const DARK = '#0a0806'
export const AMBER = '#FFB300'
export const CYAN = '#00E5FF'
export const EMERALD = '#00E676'
export const CRIMSON = '#FF3D00'
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
export function BomStage({
  t,
  label,
  children,
}: {
  scene?: Scene
  t: number
  label: string
  children: ReactNode
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 20%, #1c140a 0%, #0a0806 75%, #040302 100%)',
        overflow: 'hidden',
        color: '#ffffff',
        direction: 'ltr',
      }}
    >
      {/* Precision industrial grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage:
            'linear-gradient(rgba(255, 179, 0, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 255, 0.4) 1px, transparent 1px)',
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
          color: AMBER,
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
            background: AMBER,
            boxShadow: `0 0 10px ${AMBER}`,
          }}
        />
        <span>HISABCHE // MANUFACTURING COST TERMINAL</span>
      </div>

      <div
        style={{
          ...MONO,
          position: 'absolute',
          top: 24,
          right: 28,
          fontSize: 12,
          color: 'rgba(255, 255, 255, 0.45)',
        }}
      >
        <Timecode t={t} />
      </div>

      {/* Stage Category Pill */}
      <div
        style={{
          position: 'absolute',
          top: 56,
          left: 28,
          background: 'rgba(255, 179, 0, 0.1)',
          border: `1px solid rgba(255, 179, 0, 0.3)`,
          padding: '4px 14px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          color: AMBER,
          letterSpacing: '0.04em',
          direction: 'rtl',
        }}
      >
        {label}
      </div>

      {/* Content Canvas */}
      {children}
    </div>
  )
}

// ============================================
// Scene 1: Guesswork Costing Crisis (Frame-0 Arrest)
// ============================================
export function GuessworkCostingCrisisScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2.2, 0, 1))
  const pulse = Math.sin(t * 8) * 0.15 + 0.85

  return (
    <BomStage scene={scene} t={t} label="بحران بهای تمام‌شده در کارگاه">
      <div
        style={{
          position: 'absolute',
          top: 110,
          left: 28,
          right: 28,
          direction: 'rtl',
          textAlign: 'center',
          opacity: intro,
          transform: `translateY(${(1 - intro) * 20}px)`,
        }}
      >
        <h1
          style={{
            fontSize: 27,
            fontWeight: 800,
            lineHeight: 1.35,
            margin: 0,
            color: WHITE,
          }}
        >
          کارگاه شلوغه و تولید بالاست،
          <br />
          <span style={{ color: CRIMSON }}>ولی قیمت تمام‌شده رو حدسی می‌زنی!</span>
        </h1>
      </div>

      {/* Split Comparison Cards */}
      <div
        style={{
          position: 'absolute',
          top: 220,
          left: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Output Volume */}
        <div
          style={{
            background: 'rgba(0, 229, 255, 0.05)',
            border: `1px solid ${CYAN}44`,
            borderRadius: 16,
            padding: 20,
            direction: 'rtl',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: intro,
            transform: `translateX(${(1 - intro) * -30}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'rgba(0, 229, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                color: CYAN,
              }}
            >
              🏭
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                تولید و سفارشات روزانه
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: CYAN, marginTop: 4 }}>
                {faNumber(450)} واحد خروجی کارگاه
              </div>
            </div>
          </div>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(0, 229, 255, 0.15)',
              color: CYAN,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            تولید فعال
          </div>
        </div>

        {/* Real Unit Cost Blindspot */}
        <div
          style={{
            background: 'rgba(255, 61, 0, 0.06)',
            border: `1px solid ${CRIMSON}66`,
            borderRadius: 16,
            padding: 20,
            direction: 'rtl',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: intro,
            transform: `translateX(${(1 - intro) * 30}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'rgba(255, 61, 0, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                color: CRIMSON,
              }}
            >
              ❓
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                بهای تمام‌شده هر دانه محصول
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: CRIMSON, marginTop: 4 }}>
                نامشخص (قیمت‌گذاری چشمی و تخمینی!)
              </div>
            </div>
          </div>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(255, 61, 0, 0.25)',
              color: CRIMSON,
              fontSize: 12,
              fontWeight: 700,
              opacity: pulse,
            }}
          >
            نشت سود
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 120,
          left: 28,
          right: 28,
          background: 'rgba(255, 255, 255, 0.03)',
          border: `1px solid ${BORDER_GLASS}`,
          borderRadius: 16,
          padding: 16,
          textAlign: 'center',
          direction: 'rtl',
          opacity: intro,
        }}
      >
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>
          تولید می‌کنی و می‌فروشی، اما در آخر ماه نمی‌دانی سود کردی یا از جیب مایه گذاشتی؟
        </span>
      </div>
    </BomStage>
  )
}

// ============================================
// Scene 2: Interactive BOM Recipe Matrix
// ============================================
export function InteractiveBomRecipeMatrixScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const items = [
    { name: 'ماده اولیه فلزی کد ۱۰۱', qty: faNumber(2.5) + ' کیلوگرم', cost: faNumber(1500) },
    { name: 'قطعه جانبی استاندارد کد ۲۰۲', qty: faNumber(4) + ' عدد', cost: faNumber(1800) },
    { name: 'کارتن و بسته‌بندی صنعتی', qty: faNumber(1) + ' عدد', cost: faNumber(450) },
    { name: 'سهم دستمزد مستقیم و سربار', qty: faNumber(1) + ' سهم کارگاه', cost: faNumber(500) },
  ]

  return (
    <BomStage scene={scene} t={t} label="ترمینال فرمول ساخت و آنالیز BOM">
      <div
        style={{
          position: 'absolute',
          top: 96,
          left: 28,
          right: 28,
          direction: 'rtl',
          textAlign: 'center',
          opacity: intro,
        }}
      >
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: WHITE }}>
          فرمول ساخت استاندارد: <span style={{ color: AMBER }}>آنالیز دقیق اجزا</span>
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          تعریف ضریب مصرف مواد اولیه، بسته‌بندی و هزینه سربار تولید
        </p>
      </div>

      {/* BOM Table Matrix */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          left: 24,
          right: 24,
          background: 'rgba(15, 12, 10, 0.85)',
          border: `1px solid ${BORDER_GLASS}`,
          borderRadius: 20,
          padding: 18,
          opacity: intro,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            direction: 'rtl',
            borderBottom: `1px solid ${BORDER_GLASS}`,
            paddingBottom: 10,
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 800, color: AMBER }}>
            فرمول ساخت محصول نهایی کد ۵۰۱
          </span>
          <span style={{ ...MONO, fontSize: 11, color: CYAN }}>BOM SPECIFICATION</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it, idx) => {
            const rowIntro = spring(clamp((t - 0.4 - idx * 0.3) * 2, 0, 1))
            return (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  direction: 'rtl',
                  opacity: rowIntro,
                  transform: `translateX(${(1 - rowIntro) * -15}px)`,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: WHITE }}>{it.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    مقدار مصرف: {it.qty}
                  </div>
                </div>
                <div style={{ ...MONO, fontSize: 14, fontWeight: 700, color: AMBER }}>
                  {it.cost}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 75,
          left: 28,
          right: 28,
          textAlign: 'center',
          direction: 'rtl',
          fontSize: 13,
          color: 'rgba(255,255,255,0.7)',
          opacity: intro,
        }}
      >
        هر ماده مصرفی قیمت خودش را از میانگین وزنی خرید انبار می‌گیرد.
      </div>
    </BomStage>
  )
}

// ============================================
// Scene 3: Automatic Material Deduction
// ============================================
export function AutomaticMaterialDeductionScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const executed = t > 1.6
  const execP = spring(clamp((t - 1.6) * 2, 0, 1))

  return (
    <BomStage scene={scene} t={t} label="دستور تولید و همگام‌سازی انبار">
      <div
        style={{
          position: 'absolute',
          top: 96,
          left: 28,
          right: 28,
          direction: 'rtl',
          textAlign: 'center',
          opacity: intro,
        }}
      >
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: WHITE }}>
          ۱ کلیک ثبت دستور تولید = <span style={{ color: EMERALD }}>کسر خودکار انبار</span>
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          تبدیل آنی مواد خام به محصول نهایی بدون ثبت دستی در دفاتر
        </p>
      </div>

      {/* Production Order Execution Card */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          left: 24,
          right: 24,
          background: 'rgba(12, 16, 20, 0.85)',
          border: `1px solid ${executed ? EMERALD : BORDER_GLASS}`,
          borderRadius: 20,
          padding: 20,
          opacity: intro,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            direction: 'rtl',
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 800, color: WHITE }}>
            دستور تولید کارگاهی #۵۰۸
          </span>
          <div
            style={{
              padding: '4px 12px',
              borderRadius: 8,
              background: executed ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 179, 0, 0.15)',
              color: executed ? EMERALD : AMBER,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {executed ? 'اجرا و ثبت شد ✓' : 'در حال پردازش...'}
          </div>
        </div>

        {/* 2-Way Sync Visual */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, direction: 'rtl' }}>
          {/* Warehouse Material Out */}
          <div
            style={{
              background: 'rgba(255, 61, 0, 0.05)',
              border: `1px solid ${CRIMSON}44`,
              borderRadius: 12,
              padding: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                خروج مواد اولیه از انبار:
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: CRIMSON, marginTop: 2 }}>
                کسر ۲۵۰ کیلو فلز + ۴۰۰ قطعه جانبی
              </div>
            </div>
            <div style={{ fontSize: 20 }}>📉</div>
          </div>

          {/* Finished Goods In */}
          <div
            style={{
              background: 'rgba(0, 230, 118, 0.06)',
              border: `1px solid ${EMERALD}44`,
              borderRadius: 12,
              padding: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                ورود به انبار کالای ساخته‌شده:
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: EMERALD, marginTop: 2 }}>
                افزایش {faNumber(100)} واحد محصول نهایی کد ۵۰۱
              </div>
            </div>
            <div style={{ fontSize: 20 }}>📈</div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 70,
          left: 28,
          right: 28,
          textAlign: 'center',
          direction: 'rtl',
          fontSize: 13,
          color: 'rgba(255,255,255,0.7)',
          opacity: execP,
        }}
      >
        کاردکس انبار مواد خام و انبار محصولات ساخته‌شده همزمان و خودکار تراز شد.
      </div>
    </BomStage>
  )
}

// ============================================
// Scene 4: Exact Unit Cost Breakdown
// ============================================
export function ExactUnitCostBreakdownScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const countUp = spring(clamp((t - 0.8) * 1.5, 0, 1))
  const costPerUnit = Math.round(mix(3000, 4250, countUp))
  const salePrice = 6800
  const profitMargin = Math.round(((salePrice - costPerUnit) / salePrice) * 100)

  return (
    <BomStage scene={scene} t={t} label="بهای تمام‌شده واقعی هر واحد">
      <div
        style={{
          position: 'absolute',
          top: 100,
          left: 28,
          right: 28,
          direction: 'rtl',
          textAlign: 'center',
          opacity: intro,
        }}
      >
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: WHITE }}>
          قیمت تمام‌شده واقعی: <span style={{ color: EMERALD }}>صفر درصد حدس و گمان</span>
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          محاسبه اتوماتیک بهای تمام‌شده و نمایش حاشیه سود خالص
        </p>
      </div>

      {/* Unit Cost Telemetry Card */}
      <div
        style={{
          position: 'absolute',
          top: 175,
          left: 24,
          right: 24,
          background: 'rgba(15, 14, 10, 0.85)',
          border: `1px solid ${BORDER_GLASS}`,
          borderRadius: 20,
          padding: 22,
          opacity: intro,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            direction: 'rtl',
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>محصول تولیدشده</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: WHITE, marginTop: 2 }}>
              کالای نهایی کد ۵۰۱
            </div>
          </div>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(0, 230, 118, 0.15)',
              color: EMERALD,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            حاشیه سود: {faNumber(profitMargin)}%
          </div>
        </div>

        {/* Breakdown Metric Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, direction: 'rtl' }}>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              بهای تمام‌شده هر واحد:
            </span>
            <span style={{ ...MONO, fontSize: 17, fontWeight: 800, color: AMBER }}>
              {faNumber(costPerUnit)}
            </span>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>قیمت فروش مصوب:</span>
            <span style={{ ...MONO, fontSize: 17, fontWeight: 800, color: CYAN }}>
              {faNumber(salePrice)}
            </span>
          </div>

          <div
            style={{
              background: 'rgba(0, 230, 118, 0.08)',
              border: `1px solid ${EMERALD}44`,
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>سود خالص هر قطعه:</span>
            <span style={{ ...MONO, fontSize: 18, fontWeight: 800, color: EMERALD }}>
              {faNumber(salePrice - costPerUnit)}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 28,
          right: 28,
          textAlign: 'center',
          direction: 'rtl',
          fontSize: 13,
          color: 'rgba(255,255,255,0.7)',
          opacity: intro,
        }}
      >
        دقیقا می‌دانی هر دانه محصول چقدر برایت آب خورده و چقدر سود برای کارگاه می‌ماند.
      </div>
    </BomStage>
  )
}

// ============================================
// Scene 5: Workshop Industrial Manifesto
// ============================================
export function WorkshopIndustrialManifestoScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const lines = [
    { title: 'تولید بدون فرمول، قمار با سرمایه است', tone: CRIMSON },
    { title: 'کسر خودکار مواد اولیه در لحظه تولید', tone: CYAN },
    { title: 'محاسبه ریال به ریال بهای تمام‌شده', tone: EMERALD },
  ]

  return (
    <BomStage scene={scene} t={t} label="انضباط مالی کارگاه‌های تولیدی">
      <div
        style={{
          position: 'absolute',
          top: 120,
          left: 28,
          right: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          direction: 'rtl',
          opacity: intro,
        }}
      >
        {lines.map((line, idx) => {
          const itemIntro = spring(clamp((t - idx * 0.45) * 2, 0, 1))
          return (
            <div
              key={idx}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${line.tone}44`,
                borderRadius: 18,
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                transform: `translateX(${(1 - itemIntro) * -25}px)`,
                opacity: itemIntro,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: line.tone,
                  boxShadow: `0 0 12px ${line.tone}`,
                }}
              />
              <span
                style={{
                  fontSize: 19,
                  fontWeight: 800,
                  color: WHITE,
                  lineHeight: 1.3,
                }}
              >
                {line.title}
              </span>
            </div>
          )
        })}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 100,
          left: 28,
          right: 28,
          textAlign: 'center',
          direction: 'rtl',
          fontSize: 14,
          color: 'rgba(255,255,255,0.6)',
          opacity: intro,
        }}
      >
        حسابچه // حسابداری صنعتی و بهای تمام‌شده شفاف برای تمام تولیدکنندگان
      </div>
    </BomStage>
  )
}

// ============================================
// Scene 6: Manufacturing BOM CTA
// ============================================
export function ManufacturingBomCtaScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))
  const pulse = Math.sin(t * 5) * 0.15 + 0.85

  return (
    <BomStage scene={scene} t={t} label="شروع رایگان حسابچه">
      <div
        style={{
          position: 'absolute',
          top: 150,
          left: 28,
          right: 28,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          opacity: intro,
          transform: `scale(${mix(0.92, 1, intro)})`,
        }}
      >
        {/* Brand Gear Emblem */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: 'linear-gradient(135deg, rgba(255, 179, 0, 0.2), rgba(0, 229, 255, 0.05))',
            border: `2px solid ${AMBER}`,
            boxShadow: `0 0 35px ${AMBER}55`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 38,
            marginBottom: 24,
          }}
        >
          ⚙️
        </div>

        <h2
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: WHITE,
            margin: 0,
            direction: 'rtl',
          }}
        >
          سامانه تولید و بهای تمام‌شده BOM
        </h2>

        <p
          style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.7)',
            marginTop: 10,
            direction: 'rtl',
            lineHeight: 1.5,
          }}
        >
          محاسبه خودکار مواد مصرفی، کاردکس انبار و سود واقعی کارگاه
        </p>

        {/* CTA Button */}
        <div
          style={{
            marginTop: 32,
            background: `linear-gradient(135deg, ${AMBER}, #FFA000)`,
            padding: '16px 36px',
            borderRadius: 16,
            color: '#000000',
            fontSize: 18,
            fontWeight: 800,
            direction: 'rtl',
            boxShadow: `0 0 ${25 * pulse}px ${AMBER}aa`,
            cursor: 'pointer',
          }}
        >
          فعال‌سازی در hisabche.com
        </div>

        <div
          style={{
            ...MONO,
            marginTop: 20,
            fontSize: 13,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.08em',
          }}
        >
          INDUSTRIAL COSTING // WEB · DESKTOP · MOBILE
        </div>
      </div>
    </BomStage>
  )
}
