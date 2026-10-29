// ============================================
// Full-Cycle Art Direction (Reel 71) — Bespoke SaaS Motion
// The Grand Unified Commerce Loop & 5-in-1 Atomic Synchronization
//
// Palette: Deep Obsidian (#060810), Neon Cyan (#00E5FF),
// Core Purple (#7C4DFF), Mint Emerald (#00E676), Crimson Alert (#FF3D00), Gold (#FFD700)
// High-depth 3D perspective, zero hold-frame overlap,
// strict physical container-local coordinates, 100% dark studio theme.
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

export const DARK = '#060810'
export const CYAN = '#00E5FF'
export const PURPLE = '#7C4DFF'
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
export function CycleStage({
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
        background: 'radial-gradient(circle at 50% 25%, #101228 0%, #060810 75%, #020306 100%)',
        overflow: 'hidden',
        color: '#ffffff',
        direction: 'ltr',
      }}
    >
      {/* Precision quantum grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage:
            'linear-gradient(rgba(124, 77, 255, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 255, 0.4) 1px, transparent 1px)',
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
          color: PURPLE,
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
            background: PURPLE,
            boxShadow: `0 0 10px ${PURPLE}`,
          }}
        />
        <span>HISABCHE // UNIFIED COMMERCE NEXUS</span>
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
          background: 'rgba(124, 77, 255, 0.12)',
          border: `1px solid rgba(124, 77, 255, 0.3)`,
          padding: '4px 14px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          color: PURPLE,
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
// Scene 1: Fragmented Silos Impasse (Frame-0 Arrest)
// ============================================
export function FragmentedSilosImpasseScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2.2, 0, 1))
  const pulse = Math.sin(t * 8) * 0.15 + 0.85

  const silos = [
    { title: 'فروش در اکسل', sub: 'فاکتورهای جداگانه', icon: '📊' },
    { title: 'انبار روی کاغذ', sub: 'کاردکس خط‌خورده', icon: '📦' },
    { title: 'دفتر کل سنتی', sub: 'اسناد عقب‌افتاده', icon: '📑' },
    { title: 'بانک و چک', sub: 'چک‌های فراموش‌شده', icon: '🏦' },
  ]

  return (
    <CycleStage scene={scene} t={t} label="بحران جزایر جداگانه کسب‌وکار">
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
          یک فاکتور فروش،
          <br />
          <span style={{ color: CRIMSON }}>پنج سیستم جداگانه و جزیره‌ای!</span>
        </h1>
      </div>

      {/* 4 Fragmented Boxes */}
      <div
        style={{
          position: 'absolute',
          top: 220,
          left: 24,
          right: 24,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          direction: 'rtl',
          opacity: intro,
        }}
      >
        {silos.map((s, idx) => (
          <div
            key={idx}
            style={{
              background: 'rgba(255, 61, 0, 0.05)',
              border: `1px solid ${CRIMSON}44`,
              borderRadius: 14,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: WHITE }}>{s.title}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Disconnection Warning */}
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          left: 28,
          right: 28,
          background: 'rgba(255, 61, 0, 0.1)',
          border: `1px solid ${CRIMSON}55`,
          borderRadius: 16,
          padding: 14,
          textAlign: 'center',
          direction: 'rtl',
          opacity: intro,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: CRIMSON, opacity: pulse }}>
          هم‌پیوستگی صفر // داده‌ها دوباره‌نویسی می‌شوند و سود واقعی گم است!
        </span>
      </div>
    </CycleStage>
  )
}

// ============================================
// Scene 2: Quantum Core Nexus (Unified Engine)
// ============================================
export function QuantumCoreNexusScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const coreRot = t * 25

  const nodes = [
    { title: 'صندوق و پیشخوان', icon: '💻', tone: CYAN, angle: 0 },
    { title: 'انبار هوشمند', icon: '📦', tone: EMERALD, angle: 72 },
    { title: 'دفتر کل دوبل', icon: '📑', tone: PURPLE, angle: 144 },
    { title: 'بانک و چک', icon: '🏦', tone: GOLD, angle: 216 },
    { title: 'تولید و کارگاه', icon: '⚙️', tone: '#FF9100', angle: 288 },
  ]

  return (
    <CycleStage scene={scene} t={t} label="معماری هسته متمرکز حسابچه">
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
          هسته متمرکز: <span style={{ color: PURPLE }}>اتصال تمام بخش‌ها به یک حقیقت</span>
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          فروش، انبار، حسابداری، بانک و تولید؛ هماهنگ و بلادرنگ
        </p>
      </div>

      {/* Orbit Nexus Visualizer */}
      <div
        style={{
          position: 'absolute',
          top: 175,
          left: 24,
          right: 24,
          height: 230,
          background: 'rgba(12, 14, 28, 0.85)',
          border: `1px solid ${BORDER_GLASS}`,
          borderRadius: 20,
          overflow: 'hidden',
          opacity: intro,
        }}
      >
        {/* Central Core */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) rotate(${coreRot}deg)`,
            width: 76,
            height: 76,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(124, 77, 255, 0.3), rgba(0, 229, 255, 0.2))',
            border: `2px solid ${PURPLE}`,
            boxShadow: `0 0 30px ${PURPLE}66`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#060810',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              transform: `rotate(${-coreRot}deg)`,
            }}
          >
            ⚡
          </div>
        </div>

        {/* Orbit Node Pills */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: 16,
            direction: 'rtl',
          }}
        >
          {nodes.map((n, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${n.tone}55`,
                borderRadius: 12,
                padding: '6px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                fontWeight: 700,
                color: WHITE,
                boxShadow: `0 0 10px ${n.tone}33`,
              }}
            >
              <span>{n.icon}</span>
              <span>{n.title}</span>
            </div>
          ))}
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
        یک پایگاه داده متمرکز؛ دیگر نیازی به اکسل‌های پراکنده یا دفاتر متعدد نیست.
      </div>
    </CycleStage>
  )
}

// ============================================
// Scene 3: Atomic 5-in-1 Invoice Pulse
// ============================================
export function Atomic5In1InvoicePulseScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const syncItems = [
    { text: '۱. کسر آنی از موجودی انبار و به‌روزرسانی کاردکس', tone: EMERALD },
    { text: '۲. ثبت خودکار سند حسابداری دوبل رسمی در دفتر کل', tone: PURPLE },
    { text: '۳. درج طلب یا بستانکاری در پرونده متمرکز مشتری', tone: CYAN },
    { text: '۴. ثبت چک یا تراکنش بانکی در سررسیدهای نقدینگی', tone: GOLD },
    { text: '۵. محاسبه ریال به ریال سود ناخالص فاکتور در لحظه', tone: WHITE },
  ]

  return (
    <CycleStage scene={scene} t={t} label="همگام‌سازی ۵ در ۱ با تایید فاکتور">
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
          ۱ کلیک تایید فاکتور = <span style={{ color: EMERALD }}>۵ ثبت همزمان در ۳ ثانیه</span>
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          تمام دفاتر به صورت اتمیک و خودکار با هم تراز می‌شوند
        </p>
      </div>

      {/* Synchronized Action Stack */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          left: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          direction: 'rtl',
          opacity: intro,
        }}
      >
        {syncItems.map((item, idx) => {
          const itemIntro = spring(clamp((t - 0.4 - idx * 0.3) * 2, 0, 1))
          return (
            <div
              key={idx}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${item.tone}44`,
                borderRadius: 12,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: itemIntro,
                transform: `translateX(${(1 - itemIntro) * -20}px)`,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>{item.text}</span>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'rgba(0, 230, 118, 0.15)',
                  border: `1px solid ${EMERALD}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: EMERALD,
                  fontWeight: 800,
                }}
              >
                ✓
              </div>
            </div>
          )
        })}
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
        صفر کار دستی بعد از فاکتور؛ حسابچه تمام زنجیره را خودش تکمیل می‌کند.
      </div>
    </CycleStage>
  )
}

// ============================================
// Scene 4: Live Business Health Telemetry
// ============================================
export function LiveBusinessHealthTelemetryScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  return (
    <CycleStage scene={scene} t={t} label="داشبورد یکپارچه سلامت مالی">
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
          ترازنامه لحظه‌ای: <span style={{ color: CYAN }}>سود واقعی، نه روی کاغذ</span>
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          تصمیم‌گیری دقیق با ارقام پاک و بدون مغایرت در هر ساعت شبانه‌روز
        </p>
      </div>

      {/* Cockpit Metrics Grid */}
      <div
        style={{
          position: 'absolute',
          top: 175,
          left: 24,
          right: 24,
          background: 'rgba(12, 16, 30, 0.85)',
          border: `1px solid ${BORDER_GLASS}`,
          borderRadius: 20,
          padding: 20,
          opacity: intro,
        }}
      >
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
              borderRadius: 14,
              padding: 14,
              border: `1px solid ${EMERALD}44`,
            }}
          >
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>سود خالص واقعی</div>
            <div style={{ ...MONO, fontSize: 18, fontWeight: 800, color: EMERALD, marginTop: 4 }}>
              +{faNumber(34850)}
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 14,
              padding: 14,
              border: `1px solid ${CYAN}44`,
            }}
          >
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>ارزش موجودی انبار</div>
            <div style={{ ...MONO, fontSize: 18, fontWeight: 800, color: CYAN, marginTop: 4 }}>
              {faNumber(182000)}
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 14,
              padding: 14,
              border: `1px solid ${GOLD}44`,
            }}
          >
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>موجودی نقد و بانک</div>
            <div style={{ ...MONO, fontSize: 18, fontWeight: 800, color: GOLD, marginTop: 4 }}>
              {faNumber(49300)}
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 14,
              padding: 14,
              border: `1px solid ${PURPLE}44`,
            }}
          >
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>مغایرت ترازنامه</div>
            <div style={{ ...MONO, fontSize: 18, fontWeight: 800, color: WHITE, marginTop: 4 }}>
              {faNumber(0)} (تراز ۱۰۰٪)
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
        مالک کسب‌وکار با یک نگاه وضعیت نقدینگی، سود و بدهی‌های کل سازمان را می‌فهمد.
      </div>
    </CycleStage>
  )
}

// ============================================
// Scene 5: Unified Empire Manifesto
// ============================================
export function UnifiedEmpireManifestoScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const lines = [
    { title: 'کسب‌وکار جزیره نیست؛ همه چیز به هم پیوسته است', tone: PURPLE },
    { title: '۱ کلیک فاکتور = ۵ ثبت همزمان و بی‌نقص', tone: CYAN },
    { title: 'آرامش مدیر · تسلط کامل بر تمام بازار', tone: EMERALD },
  ]

  return (
    <CycleStage scene={scene} t={t} label="قدرت سازمان یکپارچه مالی">
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
        حسابچه // شاهکار یکپارچگی ابری، دسکتاپ و موبایل برای کسب‌وکارهای پیشرو
      </div>
    </CycleStage>
  )
}

// ============================================
// Scene 6: Full Cycle CTA
// ============================================
export function FullCycleCtaScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))
  const pulse = Math.sin(t * 5) * 0.15 + 0.85

  return (
    <CycleStage scene={scene} t={t} label="شروع رایگان حسابچه">
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
        {/* Brand Nexus Emblem */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: 'linear-gradient(135deg, rgba(124, 77, 255, 0.25), rgba(0, 229, 255, 0.1))',
            border: `2px solid ${PURPLE}`,
            boxShadow: `0 0 35px ${PURPLE}55`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 38,
            marginBottom: 24,
          }}
        >
          ⚡
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
          سامانه یکپارچه حسابچه
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
          چرخه کامل عملیات مالی، انبار، بانک و تولید بدون یک خطای انسانی
        </p>

        {/* CTA Button */}
        <div
          style={{
            marginTop: 32,
            background: `linear-gradient(135deg, ${PURPLE}, #651FFF)`,
            padding: '16px 36px',
            borderRadius: 16,
            color: '#ffffff',
            fontSize: 18,
            fontWeight: 800,
            direction: 'rtl',
            boxShadow: `0 0 ${25 * pulse}px ${PURPLE}aa`,
            cursor: 'pointer',
          }}
        >
          شروع رایگان در hisabche.com
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
          UNIFIED ERP ARCHITECTURE // WEB · DESKTOP · MOBILE
        </div>
      </div>
    </CycleStage>
  )
}
