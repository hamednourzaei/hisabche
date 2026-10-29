// ============================================
// Till-Shift-Balance Art Direction (Reel 73) — Bespoke SaaS Motion
// The Golden Till Vault, Precision Shift Cash Reconciler & Soulful Night Closure
//
// Complies strictly with Layout Defect Law 11 (Soulful Night-Closure & Anti-Sterile Shutter Law)
// Palette: Midnight Obsidian (#05070e), Cash Gold (#FFD700),
// Till Emerald (#00E676), Crimson Alert (#FF3D00), Optical Cyan (#00E5FF)
// High-depth 3D perspective, zero hold-frame overlap,
// strict physical container-local coordinates, 100% dark studio theme.
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

export const DARK = '#05070e'
export const GOLD = '#FFD700'
export const EMERALD = '#00E676'
export const CRIMSON = '#FF3D00'
export const CYAN = '#00E5FF'
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
export function TillStage({
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
        background: 'radial-gradient(circle at 50% 25%, #0e1424 0%, #05070e 75%, #020306 100%)',
        overflow: 'hidden',
        color: '#ffffff',
        direction: 'ltr',
      }}
    >
      {/* Precision till telemetry grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage:
            'linear-gradient(rgba(255, 215, 0, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 230, 118, 0.4) 1px, transparent 1px)',
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
            background: GOLD,
            boxShadow: `0 0 10px ${GOLD}`,
          }}
        />
        <span>HISABCHE // TILL SHIFT CONTROL</span>
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
          background: 'rgba(255, 215, 0, 0.1)',
          border: `1px solid rgba(255, 215, 0, 0.3)`,
          padding: '4px 14px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          color: GOLD,
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
// Scene 1: Shift Discrepancy Panic (Frame-0 Arrest)
// ============================================
export function ShiftDiscrepancyPanicScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2.2, 0, 1))
  const pulse = Math.sin(t * 8) * 0.15 + 0.85

  return (
    <TillStage scene={scene} t={t} label="بحران کسری صندوق در پایان شیفت">
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
          ساعت ۱۰ شب موقع بستن دخل،
          <br />
          <span style={{ color: CRIMSON }}>صندوق و سیستم با هم نمی‌خوانند!</span>
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
        {/* System Ledger Total */}
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
              💻
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                جمع فروش ثبت‌شده نرم‌افزار
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: CYAN, marginTop: 4 }}>
                {faNumber(12850)} فروش نقدی شیفت
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
            دفتر سیستم
          </div>
        </div>

        {/* Physical Cash Shortage */}
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
              💸
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                شمارش نقدی کشوی دخل
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: CRIMSON, marginTop: 4 }}>
                {faNumber(12350)} ({faNumber(500)} کسری صندوق!)
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
            اختلاف دخل
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
          کسری صندوق از جیب کی می‌ره؟ صاحب مغازه شک می‌کنه، شاگرد دلخور می‌شه!
        </span>
      </div>
    </TillStage>
  )
}

// ============================================
// Scene 2: Interactive Cash Reconciliation Matrix
// ============================================
export function InteractiveCashReconciliationScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const reconciled = t > 1.6
  const recP = spring(clamp((t - 1.6) * 2, 0, 1))

  return (
    <TillStage scene={scene} t={t} label="مغایرت‌گیری بلادرنگ شیفت">
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
          تراز کامل دخل: <span style={{ color: EMERALD }}>تفکیک دقیق نقد و پوز</span>
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          شناسایی خودکار فاکتورهای اصلاحی و ثبت تخفیفات بدون گم شدن تراکنش
        </p>
      </div>

      {/* Till Telemetry Card */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          left: 24,
          right: 24,
          background: 'rgba(10, 16, 28, 0.85)',
          border: `1px solid ${reconciled ? EMERALD : BORDER_GLASS}`,
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
          <span style={{ fontSize: 14, fontWeight: 800, color: GOLD }}>
            گزارش بستن صندوق // شیفت عصر
          </span>
          <div
            style={{
              padding: '4px 12px',
              borderRadius: 8,
              background: reconciled ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 215, 0, 0.15)',
              color: reconciled ? EMERALD : GOLD,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {reconciled ? 'مغایرت صفر ✓' : 'در حال تطبیق...'}
          </div>
        </div>

        {/* Breakdown Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, direction: 'rtl' }}>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              تراکنش‌های کارتخوان بانکی:
            </span>
            <span style={{ ...MONO, fontSize: 15, fontWeight: 700, color: CYAN }}>
              {faNumber(34200)}
            </span>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              اسکناس‌های شمرده‌شده کشو:
            </span>
            <span style={{ ...MONO, fontSize: 15, fontWeight: 700, color: GOLD }}>
              {faNumber(12850)}
            </span>
          </div>

          <div
            style={{
              background: 'rgba(0, 230, 118, 0.08)',
              border: `1px solid ${EMERALD}44`,
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>اختلاف نهایی صندوق:</span>
            <span style={{ ...MONO, fontSize: 16, fontWeight: 800, color: EMERALD }}>
              {faNumber(0)} (کاملاً تراز)
            </span>
          </div>
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
          opacity: recP,
        }}
      >
        حسابچه حتی یک ریال مغایرت را با بازبینی ردیف‌های مرجوعی و تخفیف آشکار می‌کند.
      </div>
    </TillStage>
  )
}

// ============================================
// Scene 3: Shift Handover Protocol
// ============================================
export function ShiftHandoverProtocolScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const stamped = t > 1.5
  const stampP = spring(clamp((t - 1.5) * 2, 0, 1))

  return (
    <TillStage scene={scene} t={t} label="صورت‌جلسه دیجیتال تحویل شیفت">
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
          تحویل شیفت با <span style={{ color: GOLD }}>رسید دیجیتال و تایید دوطرفه</span>
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          صندوقدار صبح تحویل می‌دهد، صندوقدار عصر تایید می‌کند؛ بدون ادعا یا ابهام
        </p>
      </div>

      {/* Handover Voucher Card */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          left: 24,
          right: 24,
          background: 'rgba(14, 18, 30, 0.85)',
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
            borderBottom: `1px solid ${BORDER_GLASS}`,
            paddingBottom: 10,
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 800, color: WHITE }}>سند رسمی تحویل صندوق</span>
          <span style={{ ...MONO, fontSize: 11, color: GOLD }}>SHIFT TRANSFER #104</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, direction: 'rtl' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>صندوقدار تحویل‌دهنده:</span>
            <span style={{ fontWeight: 700, color: WHITE }}>پرسنل شماره ۰۱</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>صندوقدار تحویل‌گیرنده:</span>
            <span style={{ fontWeight: 700, color: WHITE }}>پرسنل شماره ۰۲</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>موجودی نقدینگی پایه کشو:</span>
            <span style={{ fontWeight: 800, color: GOLD }}>{faNumber(2000)} پول خرد اولیه</span>
          </div>
        </div>

        {/* Official Stamped Badge */}
        {stamped && (
          <div
            style={{
              marginTop: 16,
              background: 'rgba(0, 230, 118, 0.12)',
              border: `1.5px solid ${EMERALD}`,
              borderRadius: 12,
              padding: '10px 16px',
              textAlign: 'center',
              direction: 'rtl',
              transform: `scale(${mix(0.9, 1, stampP)})`,
              opacity: stampP,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 800, color: EMERALD }}>
              تایید شد // شیفت بدون اختلاف بسته و تحویل گردید ✓
            </span>
          </div>
        )}
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
        مسئولیت هر شیفت کاری شفاف و تفکیک‌شده ثبت می‌شود.
      </div>
    </TillStage>
  )
}

// ============================================
// Scene 4: Soulful Night Closure Shutter
// Complies strictly with Layout Defect Law 11
// ============================================
export function SoulfulNightClosureScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  // Shutter rolling down animation
  const shutterProgress = spring(clamp((t - 0.5) * 1.2, 0, 1))
  const lockActive = t > 2.0
  const lockP = spring(clamp((t - 2.0) * 2, 0, 1))

  return (
    <TillStage scene={scene} t={t} label="آرامش پایان روز کاری">
      {/* Night Market Atmosphere Lighting */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 30%, #0a1022 0%, #04060c 80%, #010204 100%)',
        }}
      />

      {/* Industrial Detailed Steel Slats Shutter */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 32,
          right: 32,
          bottom: 120,
          borderRadius: 24,
          overflow: 'hidden',
          border: `2px solid rgba(255, 215, 0, 0.3)`,
          background: '#0d111d',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8), inset 0 0 30px rgba(0,0,0,0.6)',
        }}
      >
        {/* Steel Slats repeating pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            transform: `translateY(${(1 - shutterProgress) * -100}%)`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                borderBottom: '2px solid #060911',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                background:
                  i % 2 === 0
                    ? 'linear-gradient(180deg, #182032 0%, #111726 100%)'
                    : 'linear-gradient(180deg, #141b2b 0%, #0e1320 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 20px',
              }}
            >
              {/* Industrial Rivets */}
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: '#2d3748',
                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4)',
                }}
              />
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: '#2d3748',
                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4)',
                }}
              />
            </div>
          ))}

          {/* Central Heavy Brass Lock */}
          {lockActive && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) scale(${mix(0.85, 1, lockP)})`,
                opacity: lockP,
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ffd700, #b8860b)',
                border: '3px solid #ffe066',
                boxShadow: '0 0 30px rgba(255, 215, 0, 0.5), inset 0 2px 4px rgba(255,255,255,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
              }}
            >
              🔒
            </div>
          )}
        </div>
      </div>

      {/* Human Closure Reassuring Message (Band 11) */}
      <div
        style={{
          position: 'absolute',
          bottom: 50,
          left: 28,
          right: 28,
          textAlign: 'center',
          direction: 'rtl',
          opacity: intro,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, color: GOLD, letterSpacing: '0.02em' }}>
          دخل تراز · شب آرام بازار
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          با خیال آسوده درِ مغازه را ببندید؛ ریال به ریال دخل با حسابچه محفوظ است.
        </div>
      </div>
    </TillStage>
  )
}

// ============================================
// Scene 5: Cashier Integrity Manifesto
// ============================================
export function CashierIntegrityManifestoScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const lines = [
    { title: 'صندوق شفاف، عزت و احترام پرسنل است', tone: GOLD },
    { title: 'صفر مغایرت نقدینگی · صفر سوءتفاهم', tone: CYAN },
    { title: 'پایان شیفت در آرامش و اطمینان کامل', tone: EMERALD },
  ]

  return (
    <TillStage scene={scene} t={t} label="امنیت دخل و کرامت فروشنده">
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
        حسابچه // پاسداری مقتدر و عادلانه از صندوق و زحمت پرسنل فروشگاه
      </div>
    </TillStage>
  )
}

// ============================================
// Scene 6: Till Shift CTA
// ============================================
export function TillShiftCtaScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))
  const pulse = Math.sin(t * 5) * 0.15 + 0.85

  return (
    <TillStage scene={scene} t={t} label="شروع رایگان حسابچه">
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
        {/* Brand Vault Emblem */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(0, 230, 118, 0.08))',
            border: `2px solid ${GOLD}`,
            boxShadow: `0 0 35px ${GOLD}55`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 38,
            marginBottom: 24,
          }}
        >
          💰
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
          مدیریت شیفت و بستن صندوق
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
          تسویه خودکار کارتخوان و دخل نقدی، بدون یک ریال اختلاف حساب
        </p>

        {/* CTA Button */}
        <div
          style={{
            marginTop: 32,
            background: `linear-gradient(135deg, ${GOLD}, #FFC107)`,
            padding: '16px 36px',
            borderRadius: 16,
            color: '#000000',
            fontSize: 18,
            fontWeight: 800,
            direction: 'rtl',
            boxShadow: `0 0 ${25 * pulse}px ${GOLD}aa`,
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
          TILL INTEGRITY ENGINE // WEB · DESKTOP · MOBILE
        </div>
      </div>
    </TillStage>
  )
}
