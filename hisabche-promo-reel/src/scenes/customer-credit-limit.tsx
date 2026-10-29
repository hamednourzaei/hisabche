// ============================================
// Customer-Credit-Limit Art Direction (Reel 75) — Bespoke SaaS Motion
// The Titanium Credit Sentinel & Holographic Risk Gate
//
// Palette: Deep Obsidian (#070913), Neon Cyan (#00D2FF),
// Sentinel Crimson Alert (#FF2A6D), Trust Emerald (#05FFA1), Amber (#FFB300)
// High-depth 3D perspective, zero hold-frame overlap,
// strict physical container-local coordinates, 100% dark studio theme.
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

export const DARK = '#070913'
export const CYAN = '#00D2FF'
export const CRIMSON = '#FF2A6D'
export const EMERALD = '#05FFA1'
export const AMBER = '#FFB300'
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
export function CreditStage({
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
        background: 'radial-gradient(circle at 50% 25%, #10162a 0%, #070913 75%, #020307 100%)',
        overflow: 'hidden',
        color: '#ffffff',
        direction: 'ltr',
      }}
    >
      {/* Precision telemetry grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage:
            'linear-gradient(rgba(0, 210, 255, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 42, 109, 0.4) 1px, transparent 1px)',
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
            background: CRIMSON,
            boxShadow: `0 0 10px ${CRIMSON}`,
          }}
        />
        <span>HISABCHE // CREDIT RISK SENTINEL</span>
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
          background: 'rgba(255, 42, 109, 0.1)',
          border: `1px solid rgba(255, 42, 109, 0.3)`,
          padding: '4px 14px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          color: CRIMSON,
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
// Scene 1: Credit Limit Impasse (Frame-0 Arrest)
// ============================================
export function CreditLimitImpasseScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2.2, 0, 1))
  const pulse = Math.sin(t * 8) * 0.15 + 0.85

  return (
    <CreditStage scene={scene} t={t} label="بحران نسیه و بدهی معوق">
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
          مشتری پای پیشخوان نسیه می‌خواد،
          <br />
          <span style={{ color: CRIMSON }}>اما حساب قبلیش هنوز تسویه نشده!</span>
        </h1>
      </div>

      {/* Split Credit Status Cards */}
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
        {/* Approved Limit */}
        <div
          style={{
            background: 'rgba(0, 210, 255, 0.05)',
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
                background: 'rgba(0, 210, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                color: CYAN,
              }}
            >
              🛡️
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                سقف مجاز اعتبار مشتری
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: CYAN, marginTop: 4 }}>
                {faNumber(20000)} سقف تعیین‌شده
              </div>
            </div>
          </div>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(0, 210, 255, 0.15)',
              color: CYAN,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            سقف مجاز
          </div>
        </div>

        {/* Current Debt Over Limit */}
        <div
          style={{
            background: 'rgba(255, 42, 109, 0.06)',
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
                background: 'rgba(255, 42, 109, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                color: CRIMSON,
              }}
            >
              🚨
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>بدهی جاری معوق</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: CRIMSON, marginTop: 4 }}>
                {faNumber(25400)} ({faNumber(5400)} فراتر از سقف!)
              </div>
            </div>
          </div>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(255, 42, 109, 0.25)',
              color: CRIMSON,
              fontSize: 12,
              fontWeight: 700,
              opacity: pulse,
            }}
          >
            خطر معوقه
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
          شاگرد مغازه می‌پرسه: «به فلانی جنس بدیم؟» رودربایستی می‌کنی یا سیستم جلوت رو می‌گیره؟
        </span>
      </div>
    </CreditStage>
  )
}

// ============================================
// Scene 2: Interactive Risk Gauge
// ============================================
export function InteractiveRiskGaugeScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const gaugeAnim = spring(clamp((t - 1) * 1.5, 0, 1))
  const utilization = Math.round(mix(60, 127, gaugeAnim))

  return (
    <CreditStage scene={scene} t={t} label="پایش لحظه‌ای پرونده اعتباری">
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
          پرونده متمرکز مشتری: <span style={{ color: CRIMSON }}>پایش ریسک و بدهی</span>
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          شناسایی خودکار تاخیر تسویه و چک‌های برگشتی بدون اتکا به حافظه
        </p>
      </div>

      {/* Risk Gauge Visual Card */}
      <div
        style={{
          position: 'absolute',
          top: 175,
          left: 24,
          right: 24,
          background: 'rgba(12, 16, 28, 0.75)',
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
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>طرف حساب تجاری</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: WHITE, marginTop: 2 }}>
              مشتری تجاری کد ۲۰۴
            </div>
          </div>
          <div
            style={{
              ...MONO,
              fontSize: 22,
              fontWeight: 800,
              color: utilization > 100 ? CRIMSON : EMERALD,
            }}
          >
            {faNumber(utilization)}%
          </div>
        </div>

        {/* Progress Bar with Limit Mark */}
        <div
          style={{
            height: 14,
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 7,
            overflow: 'hidden',
            position: 'relative',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: `${Math.min(utilization, 100)}%`,
              background: utilization > 100 ? CRIMSON : EMERALD,
              borderRadius: 7,
              boxShadow: `0 0 12px ${utilization > 100 ? CRIMSON : EMERALD}88`,
            }}
          />
        </div>

        {/* Telemetry Metrics */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            direction: 'rtl',
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 12,
              padding: 12,
              border: `1px solid ${BORDER_GLASS}`,
            }}
          >
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>مدت تاخیر پرداخت</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: AMBER, marginTop: 4 }}>
              {faNumber(34)} روز گذشته
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 12,
              padding: 12,
              border: `1px solid ${BORDER_GLASS}`,
            }}
          >
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>وضعیت چک‌های دریافتی</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: CRIMSON, marginTop: 4 }}>
              {faNumber(1)} چک در نوبت وصول
            </div>
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
        سقف اعتبار هوشمند مانع از انباشت بدهی سوخت‌شده می‌شود.
      </div>
    </CreditStage>
  )
}

// ============================================
// Scene 3: Automated Lock Gate
// ============================================
export function AutomatedLockGateScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const lockTrigger = t > 1.8
  const lockP = spring(clamp((t - 1.8) * 2, 0, 1))

  return (
    <CreditStage scene={scene} t={t} label="قفل خودکار و رفع رودربایستی">
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
          حسابچه تعارف ندارد: <span style={{ color: CRIMSON }}>قفل خودکار فاکتور</span>
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          سیستم مسئولیت رد نسیه را بر عهده می‌گیرد تا روابط تجاری حفظ شود
        </p>
      </div>

      {/* POS Terminal Window */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          left: 24,
          right: 24,
          background: 'rgba(10, 14, 25, 0.85)',
          border: `1px solid ${BORDER_GLASS}`,
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
          <span style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>صدور فاکتور فروش نسیه</span>
          <span style={{ ...MONO, fontSize: 11, color: CYAN }}>INVOICE #4092</span>
        </div>

        {/* Invoice Items Draft */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 12,
            padding: 12,
            direction: 'rtl',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>اقلام انتخابی مشتری:</span>
            <span style={{ fontWeight: 700, color: WHITE }}>{faNumber(4500)}</span>
          </div>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 8 }}
          >
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>روش تسویه:</span>
            <span style={{ fontWeight: 700, color: AMBER }}>نسیه (اعتباری)</span>
          </div>
        </div>

        {/* Lock Overlay Modal */}
        {lockTrigger && (
          <div
            style={{
              background: 'rgba(255, 42, 109, 0.15)',
              border: `2px solid ${CRIMSON}`,
              borderRadius: 14,
              padding: 16,
              direction: 'rtl',
              textAlign: 'center',
              boxShadow: `0 0 25px ${CRIMSON}55`,
              transform: `scale(${mix(0.9, 1, lockP)})`,
              opacity: lockP,
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 6 }}>🔒</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: CRIMSON }}>
              صدور نسیه امکان‌پذیر نیست!
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              اعتبار مشتری به پایان رسیده است؛ نیاز به تایید مدیر یا تسویه حساب قبلی.
            </div>
          </div>
        )}
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
          opacity: intro,
        }}
      >
        فروشنده شرمنده مشتری نمی‌شود؛ سیستم قانون‌گذار مستقل کسب‌وکار شماست.
      </div>
    </CreditStage>
  )
}

// ============================================
// Scene 4: Instant Settlement & Gate Release
// ============================================
export function SettlementGateReleaseScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const settled = t > 1.5
  const settleP = spring(clamp((t - 1.5) * 2, 0, 1))

  return (
    <CreditStage scene={scene} t={t} label="تسویه آنی و بازگشایی اعتبار">
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
          تسویه بدهی معوق = <span style={{ color: EMERALD }}>آزادسازی فوری فاکتور</span>
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          جریان وصول مطالبات تسریع می‌شود، بدون نیاز به پیگیری‌های فرساینده
        </p>
      </div>

      {/* Payment Settlement Card */}
      <div
        style={{
          position: 'absolute',
          top: 175,
          left: 24,
          right: 24,
          background: 'rgba(10, 20, 15, 0.8)',
          border: `1px solid ${settled ? EMERALD : BORDER_GLASS}`,
          borderRadius: 20,
          padding: 22,
          opacity: intro,
          transition: 'border-color 0.3s ease',
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
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>تراکنش دریافتی</div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: settled ? EMERALD : WHITE,
                marginTop: 2,
              }}
            >
              {settled ? 'تسویه موفقیت‌آمیز مطالبات' : 'در انتظار واریز مشتری...'}
            </div>
          </div>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 10,
              background: settled ? 'rgba(5, 255, 161, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              color: settled ? EMERALD : 'rgba(255,255,255,0.6)',
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {settled ? 'تایید شد ✓' : 'در انتظار'}
          </div>
        </div>

        {/* Gauge Reset */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 14,
            padding: 14,
            direction: 'rtl',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>مبلغ واریز نقدی:</span>
            <span style={{ fontWeight: 800, color: EMERALD }}>{faNumber(15000)}</span>
          </div>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 8 }}
          >
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>اعتبار آزادشده جهت خرید جدید:</span>
            <span style={{ fontWeight: 800, color: CYAN }}>{faNumber(9600)} سقف باقیمانده</span>
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
          opacity: settleP,
        }}
      >
        مشتری به موقع تسویه می‌کند، چون می‌داند اعتبار سیستم وابسته به نظم پرداخت اوست.
      </div>
    </CreditStage>
  )
}

// ============================================
// Scene 5: Receivables Protection Manifesto
// ============================================
export function ReceivablesProtectionManifestoScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const lines = [
    { title: 'رودربایستی در نسیه، ورشکستگی خاموش است', tone: CRIMSON },
    { title: 'سیستم به‌جای تو «نه» می‌گوید', tone: CYAN },
    { title: 'جریان نقدینگی تضمین‌شده و بدون سوخت', tone: EMERALD },
  ]

  return (
    <CreditStage scene={scene} t={t} label="امنیت نقدینگی و وصول مطالبات">
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
        حسابچه // پاسداری مقتدر از ثروت و سرمایه در گردش کسب‌وکار
      </div>
    </CreditStage>
  )
}

// ============================================
// Scene 6: Credit Limit CTA
// ============================================
export function CreditLimitCtaScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))
  const pulse = Math.sin(t * 5) * 0.15 + 0.85

  return (
    <CreditStage scene={scene} t={t} label="شروع رایگان حسابچه">
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
        {/* Brand Shield Emblem */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: 'linear-gradient(135deg, rgba(0, 210, 255, 0.2), rgba(255, 42, 109, 0.08))',
            border: `2px solid ${CYAN}`,
            boxShadow: `0 0 35px ${CYAN}55`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 38,
            marginBottom: 24,
          }}
        >
          🛡️
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
          مدیریت هوشمند سقف اعتبار مشتری
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
          کنترل قاطعانه نسیه، جلوگیری از سوخت مطالبات و آرامش دخل
        </p>

        {/* CTA Button */}
        <div
          style={{
            marginTop: 32,
            background: `linear-gradient(135deg, ${CYAN}, #0099FF)`,
            padding: '16px 36px',
            borderRadius: 16,
            color: '#000000',
            fontSize: 18,
            fontWeight: 800,
            direction: 'rtl',
            boxShadow: `0 0 ${25 * pulse}px ${CYAN}aa`,
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
          AUTOMATED RISK ENGINE // WEB · DESKTOP · MOBILE
        </div>
      </div>
    </CreditStage>
  )
}
