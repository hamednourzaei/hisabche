// ============================================
// Reel #111 — «درمان نرم‌افزارهای سطحی» (Beyond Superficial Software) — Pro Redesign
//
// Creative Art Direction: Cyber-Physical Blueprint & Tactical Hardware/Software X-Ray
// High-tech, cinematic contrast between fragile web-only toys and titanium local-first architecture:
// 1. Shallow Trap (0.00–6.00s) — Severed cloud connection, glitching browser window, zero responsiveness
// 2. Four Flaws (6.00–13.00s) — 2x2 Holographic Diagnostic Matrix displaying the 4 market failures
// 3. Offline-First Engine (13.00–20.00s) — Isometric glowing Local Database Vault running with 0ms latency
// 4. Multi-Device Native Ecosystem (20.00–27.00s) — Seamless triad: POS, Tablet, Smartphone interconnected
// 5. Deep Customization (27.00–34.00s) — Precision modular architecture snapping bespoke market tools
// 6. Cure Curtain (34.00–42.00s) — Industrial titanium Hisabche seal with HISABCHE.COM
//
// Hard Guardrails Respected:
// - noZoom: true (Scale stays 1.0, spatial layer movement)
// - <= 6 words per on-stage label (Hard Rule 14)
// - Natural Persian copy with zero banned fragments (Hard Rule 15)
// - No horizontal dividing lines or horizon artifacts (Hard Rule 16)
// - 24px+ safe margin bounds on 540x960 stage
// - Deterministic Persian digits (faNumber)
// ============================================

import type { ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { enter, mix, pulse } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

// ─── Design Tokens ──────────────────────────────────────────────────────────

const INK = '#040711'
const PANEL_BG = '#0a101d'
const PANEL_HI = '#111a2e'
const HAIRLINE_HI = 'rgba(255, 255, 255, 0.18)'
const CYAN = '#06b6d4'
const MINT = '#10b981'
const RED = '#ef4444'
const RED_GLOW = 'rgba(239, 68, 68, 0.3)'
const AMBER = '#f59e0b'
const TEXT = '#f8fafc'
const CREAM = '#f8fafc'
const MUTED = '#94a3b8'
const MONO = "'JetBrains Mono', 'Vazirmatn', monospace"

export type SceneProps = { t: number; scene: Scene }

// ─── Stage Shell ────────────────────────────────────────────────────────────

function Stage({
  children,
  ambientGradient,
}: {
  children: ReactNode
  ambientGradient?: string | undefined
}) {
  return (
    <div
      dir="ltr"
      style={{
        position: 'absolute',
        inset: 0,
        width: 540,
        height: 960,
        overflow: 'hidden',
        backgroundColor: INK,
        color: TEXT,
        fontFamily: "'Vazirmatn', -apple-system, sans-serif",
        backgroundImage:
          ambientGradient ??
          'radial-gradient(120% 60% at 50% -5%, rgba(6,182,212,0.14) 0%, rgba(6,182,212,0) 65%), radial-gradient(100% 45% at 50% 105%, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0) 65%)',
      }}
    >
      {/* Cybernetic Blueprint Grid Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }}
      />

      {/* Micro Status Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: 26,
          left: 32,
          fontSize: 9,
          letterSpacing: '0.22em',
          fontFamily: MONO,
          color: 'rgba(148, 163, 184, 0.35)',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        HISABCHE ARCHITECTURE // LOCAL-FIRST
      </div>
      {children}
    </div>
  )
}

function TactileHeadline({
  text,
  t,
  at = 0.4,
  top = 740,
  color = CYAN,
}: {
  text: string
  t: number
  at?: number | undefined
  top?: number | undefined
  color?: string | undefined
}) {
  return (
    <div
      dir="rtl"
      style={{
        ...enter(t, at, { y: 14, fade: 0.5 }),
        position: 'absolute',
        top,
        left: 32,
        right: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        zIndex: 10,
      }}
    >
      <span
        style={{
          fontSize: 32,
          fontWeight: 900,
          color: TEXT,
          textAlign: 'center',
          lineHeight: 1.25,
          letterSpacing: '-0.02em',
          textShadow: `0 4px 24px rgba(0,0,0,0.8), 0 0 32px ${color}44`,
        }}
      >
        {text}
      </span>
      <div
        style={{
          width: 48,
          height: 3,
          borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }}
      />
    </div>
  )
}

// ─── Scene 1: Shallow Trap (0.00–6.00s) — Freezing Web App ───────────────────

export function ShallowTrapScene({ t }: SceneProps) {
  const isAlarm = t >= 1.2
  const spinnerAngle = (t * 240) % 360
  const cardEnter = enter(t, 0.2, { y: 24, scale: 0.96 })

  return (
    <Stage
      ambientGradient={
        isAlarm
          ? 'radial-gradient(110% 60% at 50% 40%, rgba(239,68,68,0.22) 0%, rgba(239,68,68,0) 70%), radial-gradient(100% 40% at 50% 100%, rgba(15,23,42,0.5) 0%, rgba(15,23,42,0) 70%)'
          : undefined
      }
    >
      {/* Severed Connection Spark Warning */}
      <div
        style={{
          position: 'absolute',
          top: 90,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 18px',
          borderRadius: 999,
          background: isAlarm ? 'rgba(239,68,68,0.18)' : 'rgba(6,182,212,0.12)',
          border: `1px solid ${isAlarm ? RED : CYAN}`,
          boxShadow: isAlarm ? `0 0 24px ${RED_GLOW}` : 'none',
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: isAlarm ? RED : CYAN,
            boxShadow: `0 0 10px ${isAlarm ? RED : CYAN}`,
          }}
        />
        <span
          style={{
            fontFamily: MONO,
            fontSize: 13,
            fontWeight: 700,
            color: isAlarm ? RED : CYAN,
            letterSpacing: '0.08em',
          }}
        >
          {isAlarm ? 'CONNECTION SEVERED // قطعی سرور' : 'CONNECTING TO CLOUD...'}
        </span>
      </div>

      {/* Fragile Web Browser Mockup Window */}
      <div
        style={{
          ...cardEnter,
          position: 'absolute',
          top: 160,
          left: 44,
          right: 44,
          height: 520,
          borderRadius: 24,
          background: 'rgba(10, 16, 29, 0.92)',
          border: `1.5px solid ${isAlarm ? RED : HAIRLINE_HI}`,
          boxShadow: isAlarm
            ? `0 24px 60px rgba(0,0,0,0.85), 0 0 40px ${RED_GLOW}`
            : '0 24px 60px rgba(0,0,0,0.7)',
          backdropFilter: 'blur(16px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Browser Top Bar */}
        <div
          style={{
            height: 48,
            background: 'rgba(255, 255, 255, 0.04)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 18px',
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: RED }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: AMBER }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: MINT }} />
          </div>
          <span style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>
            web-accounting-cloud.com/pos
          </span>
          <div style={{ width: 24 }} />
        </div>

        {/* Browser Content with Freeze Graphic */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            padding: '24px',
          }}
        >
          {/* Animated Spinner with Error Glitch */}
          <div
            style={{
              width: 90,
              height: 90,
              borderRadius: '50%',
              border: `4px solid ${isAlarm ? 'rgba(239,68,68,0.2)' : 'rgba(6,182,212,0.2)'}`,
              borderTopColor: isAlarm ? RED : CYAN,
              transform: `rotate(${isAlarm ? 135 : spinnerAngle}deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isAlarm ? `0 0 30px ${RED_GLOW}` : 'none',
            }}
          >
            {isAlarm && (
              <span
                style={{ fontSize: 36, fontWeight: 900, color: RED, transform: 'rotate(-135deg)' }}
              >
                ✕
              </span>
            )}
          </div>

          {/* Alarm Banner */}
          <div
            dir="rtl"
            style={{
              padding: '10px 24px',
              borderRadius: 14,
              background: isAlarm ? 'rgba(239,68,68,0.15)' : 'rgba(6,182,212,0.1)',
              border: `1px solid ${isAlarm ? RED : CYAN}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 800, color: isAlarm ? RED : TEXT }}>
              {isAlarm ? 'سیستم قفل شد: خطای اینترنت' : 'در حال همگام‌سازی...'}
            </span>
            <span style={{ fontSize: 13, color: MUTED }}>
              مشتری در صف منتظر است و صندوق پاسخ نمی‌دهد
            </span>
          </div>

          {/* Frozen Invoice Table Lines */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              opacity: isAlarm ? 0.35 : 0.8,
            }}
          >
            <div
              dir="rtl"
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 14, color: TEXT }}>فاکتور #۵۴۲ · در صف ارسال</span>
              <span style={{ fontFamily: MONO, fontSize: 14, color: MUTED }}>
                {faNumber(2850000)} تومان
              </span>
            </div>
            <div
              dir="rtl"
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 14, color: TEXT }}>فاکتور #۵۴۳ · ذخیره نشد</span>
              <span style={{ fontFamily: MONO, fontSize: 14, color: RED }}>خطا در ثبت</span>
            </div>
          </div>
        </div>
      </div>

      <TactileHeadline text="توقف فروش در قطعی اینترنت" t={t} at={2.0} top={740} color={RED} />
    </Stage>
  )
}

// ─── Scene 2: Four Flaws (6.00–13.00s) — Holographic Diagnostic Matrix ──────

const FLAWS = [
  { icon: '🌐', title: 'وابسته به اینترنت', desc: 'قطعی نت = توقف کامل فروش' },
  { icon: '📱', title: 'محدود به وبسایت', desc: 'نصب نیتیو روی گوشی ندارد' },
  { icon: '🔒', title: 'قالب‌های قفل‌شده', desc: 'غیرقابل تغییر و شخصی‌سازی' },
  { icon: '📉', title: 'گزارش‌های سطحی', desc: 'شکست در محاسبه دقیق سود' },
]

export function FourFlawsScene({ t }: SceneProps) {
  return (
    <Stage ambientGradient="radial-gradient(110% 60% at 50% 50%, rgba(239,68,68,0.14) 0%, rgba(239,68,68,0) 70%), radial-gradient(100% 40% at 50% 0%, rgba(6,182,212,0.1) 0%, rgba(6,182,212,0) 70%)">
      <div
        style={{
          position: 'absolute',
          top: 90,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: RED,
          }}
        >
          // ۴ نقص اساسی برنامه‌های تحت وب
        </span>
      </div>

      {/* 2x2 Tactical Holographic Diagnostic Matrix */}
      <div
        style={{
          position: 'absolute',
          top: 150,
          left: 44,
          right: 44,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
        }}
      >
        {FLAWS.map((flaw, i) => {
          const itemEnter = enter(t, 0.4 + i * 0.45, { y: 22, scale: 0.94 })

          return (
            <div
              key={flaw.title}
              dir="rtl"
              style={{
                ...itemEnter,
                height: 240,
                borderRadius: 20,
                background: `linear-gradient(180deg, ${PANEL_HI} 0%, ${PANEL_BG} 100%)`,
                border: '1.5px solid rgba(239,68,68,0.35)',
                boxShadow: '0 16px 40px rgba(0,0,0,0.7), 0 0 25px rgba(239,68,68,0.12)',
                padding: '22px 18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                }}
              >
                {flaw.icon}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 17, fontWeight: 900, color: TEXT, lineHeight: 1.2 }}>
                  {flaw.title}
                </span>
                <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.4 }}>{flaw.desc}</span>
              </div>

              <div
                style={{
                  alignSelf: 'flex-start',
                  padding: '3px 10px',
                  borderRadius: 6,
                  background: 'rgba(239,68,68,0.18)',
                  color: RED,
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                نقص سنتی
              </div>
            </div>
          )
        })}
      </div>

      <TactileHeadline text="چهار گره نرم‌افزارهای سنتی" t={t} at={2.6} top={740} color={RED} />
    </Stage>
  )
}

// ─── Scene 3: Offline-First Engine (13.00–20.00s) — Local Vault ──────────────

export function OfflineFirstScene({ t }: SceneProps) {
  const vaultPulse = pulse(t, 0.4, 6.8, 1.8)
  const engineEnter = enter(t, 0.3, { y: 28, scale: 0.95 })

  return (
    <Stage ambientGradient="radial-gradient(120% 70% at 50% 45%, rgba(16,185,129,0.22) 0%, rgba(16,185,129,0) 70%), radial-gradient(100% 40% at 50% 0%, rgba(6,182,212,0.15) 0%, rgba(6,182,212,0) 70%)">
      <div
        style={{
          position: 'absolute',
          top: 90,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            padding: '6px 20px',
            borderRadius: 999,
            background: 'rgba(16,185,129,0.15)',
            border: '1px solid rgba(16,185,129,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: MINT,
              boxShadow: `0 0 10px ${MINT}`,
            }}
          />
          <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, color: MINT }}>
            LOCAL-FIRST ENGINE // پایداری مطلق آفلاین
          </span>
        </div>
      </div>

      {/* Isometric Glowing Local Database Engine Vault */}
      <div
        style={{
          ...engineEnter,
          position: 'absolute',
          top: 160,
          left: 44,
          right: 44,
          height: 520,
          borderRadius: 24,
          background: 'rgba(10, 16, 29, 0.92)',
          border: '1.5px solid rgba(16,185,129,0.4)',
          boxShadow: `0 24px 60px rgba(0,0,0,0.8), 0 0 ${mix(30, 60, vaultPulse)}px rgba(16,185,129,0.2)`,
          backdropFilter: 'blur(16px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          gap: 20,
        }}
      >
        {/* Engine Header Status */}
        <div
          dir="rtl"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                backgroundColor: MINT,
                boxShadow: `0 0 12px ${MINT}`,
              }}
            />
            <span style={{ fontSize: 18, fontWeight: 900, color: TEXT }}>
              پایگاه داده محلی فعال
            </span>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 13, color: MINT, fontWeight: 700 }}>
            ۰ میلی‌ثانیه تاخیر
          </span>
        </div>

        {/* Central Cylindrical Storage Core */}
        <div
          style={{
            height: 180,
            borderRadius: 18,
            background:
              'linear-gradient(180deg, rgba(16,185,129,0.12) 0%, rgba(6,182,212,0.06) 100%)',
            border: '1px solid rgba(16,185,129,0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            position: 'relative',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #10b981 0%, #047857 100%)',
              boxShadow: '0 0 30px rgba(16,185,129,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
            }}
          >
            ⚡
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, color: CREAM }}>
            دیتابیس در حافظه خود دستگاه
          </span>
          <span style={{ fontSize: 12, color: MUTED }}>حتی بدون سیم کارت و بدون وای‌فای</span>
        </div>

        {/* Real-time Offline Billing Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            dir="rtl"
            style={{
              padding: '12px 18px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(16,185,129,0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: MINT, fontWeight: 900 }}>✓</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
                فاکتور #۵۴۴ ثبت قطعی شد
              </span>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 14, color: MINT, fontWeight: 800 }}>
              {faNumber(4300000)} تومان
            </span>
          </div>

          <div
            dir="rtl"
            style={{
              padding: '12px 18px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(16,185,129,0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: MINT, fontWeight: 900 }}>✓</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
                موجودی انبار بلافاصله کسر شد
              </span>
            </div>
            <span style={{ fontSize: 12, color: MUTED }}>بدون تاخیر سرور</span>
          </div>
        </div>
      </div>

      <TactileHeadline text="موتور مستقل محلی، بدون قطعی" t={t} at={2.6} top={740} color={MINT} />
    </Stage>
  )
}

// ─── Scene 4: Multi-Device Ecosystem (20.00–27.00s) — Triad Parallax ────────

export function MultiDeviceScene({ t }: SceneProps) {
  const enterDev = enter(t, 0.3, { y: 24, scale: 0.95 })

  return (
    <Stage ambientGradient="radial-gradient(120% 70% at 50% 50%, rgba(6,182,212,0.2) 0%, rgba(6,182,212,0) 70%), radial-gradient(100% 40% at 50% 100%, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0) 70%)">
      <div
        style={{
          position: 'absolute',
          top: 90,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: CYAN,
          }}
        >
          // NATIVE MULTI-DEVICE // سه‌گانه نیتیو
        </span>
      </div>

      {/* 3 Interconnected Hardware Silhouettes */}
      <div
        style={{
          ...enterDev,
          position: 'absolute',
          top: 150,
          left: 44,
          right: 44,
          height: 530,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Device 1: Desktop POS Terminal */}
        <div
          dir="rtl"
          style={{
            padding: '20px',
            borderRadius: 20,
            background: `linear-gradient(180deg, ${PANEL_HI} 0%, ${PANEL_BG} 100%)`,
            border: '1.5px solid rgba(6,182,212,0.35)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(6,182,212,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              🖥️
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 17, fontWeight: 900, color: TEXT }}>
                ویندوز و صندوق فروش
              </span>
              <span style={{ fontSize: 13, color: MUTED }}>برنامه مستقل دسکتاپ · پرسرعت</span>
            </div>
          </div>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(6,182,212,0.15)',
              color: CYAN,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            همگام
          </span>
        </div>

        {/* Device 2: Tablet POS */}
        <div
          dir="rtl"
          style={{
            padding: '20px',
            borderRadius: 20,
            background: `linear-gradient(180deg, ${PANEL_HI} 0%, ${PANEL_BG} 100%)`,
            border: '1.5px solid rgba(16,185,129,0.35)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(16,185,129,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              📟
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 17, fontWeight: 900, color: TEXT }}>تبلت انبارداری</span>
              <span style={{ fontSize: 13, color: MUTED }}>انبارگردانی و اسکن سیار بارکد</span>
            </div>
          </div>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(16,185,129,0.15)',
              color: MINT,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            همگام
          </span>
        </div>

        {/* Device 3: Smartphone App */}
        <div
          dir="rtl"
          style={{
            padding: '20px',
            borderRadius: 20,
            background: `linear-gradient(180deg, ${PANEL_HI} 0%, ${PANEL_BG} 100%)`,
            border: '1.5px solid rgba(245,158,11,0.35)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(245,158,11,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              📱
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 17, fontWeight: 900, color: TEXT }}>موبایل مدیریت</span>
              <span style={{ fontSize: 13, color: MUTED }}>کنترل لحظه‌ای سود و دخل از هر جا</span>
            </div>
          </div>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(245,158,11,0.15)',
              color: AMBER,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            همگام
          </span>
        </div>
      </div>

      <TactileHeadline
        text="هماهنگی آنی بین تمام دستگاه‌ها"
        t={t}
        at={2.6}
        top={740}
        color={CYAN}
      />
    </Stage>
  )
}

// ─── Scene 5: Deep Customization (27.00–34.00s) — Modular Architecture ──────

const MODULES = [
  { name: 'راس‌گیری پیشرفته چک', tag: 'تخصصی' },
  { name: 'مدیریت چند انبار و شعبه', tag: 'جامع' },
  { name: 'اتصال به دستگاه کارتخوان', tag: 'خودکار' },
  { name: 'چاپگر حرارتی و فاکتور ساز', tag: 'سریع' },
]

export function DeepCustomScene({ t }: SceneProps) {
  const enterMod = enter(t, 0.3, { y: 24, scale: 0.95 })

  return (
    <Stage ambientGradient="radial-gradient(120% 70% at 50% 50%, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0) 70%), radial-gradient(100% 40% at 50% 100%, rgba(6,182,212,0.12) 0%, rgba(6,182,212,0) 70%)">
      <div
        style={{
          position: 'absolute',
          top: 90,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: AMBER,
          }}
        >
          // DEEP CUSTOMIZATION // ماژولار و منعطف
        </span>
      </div>

      {/* Modular Blocks Snapping in Place */}
      <div
        style={{
          ...enterMod,
          position: 'absolute',
          top: 150,
          left: 44,
          right: 44,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {MODULES.map((mod) => (
          <div
            key={mod.name}
            dir="rtl"
            style={{
              padding: '18px 22px',
              borderRadius: 18,
              background: `linear-gradient(180deg, ${PANEL_HI} 0%, ${PANEL_BG} 100%)`,
              border: '1.5px solid rgba(245,158,11,0.3)',
              boxShadow: '0 16px 36px rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: AMBER }} />
              <span style={{ fontSize: 16, fontWeight: 800, color: TEXT }}>{mod.name}</span>
            </div>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: 999,
                background: 'rgba(245,158,11,0.15)',
                color: AMBER,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {mod.tag}
            </span>
          </div>
        ))}
      </div>

      <TactileHeadline text="شخصی‌سازی دقیق بر اساس بازار" t={t} at={2.6} top={740} color={AMBER} />
    </Stage>
  )
}

// ─── Scene 6: Cure Curtain (34.00–42.00s) — Titanium Brand Resolution ───────

export function CureCurtainScene({ t }: SceneProps) {
  const brandEnter = enter(t, 0.4, { y: 24, scale: 0.94 })
  const glowPulse = pulse(t, 0.4, 7.8, 2.0)

  return (
    <Stage ambientGradient="radial-gradient(120% 70% at 50% 45%, rgba(6,182,212,0.25) 0%, rgba(6,182,212,0) 70%), radial-gradient(100% 50% at 50% 100%, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0) 70%)">
      <div
        style={{
          ...brandEnter,
          position: 'absolute',
          top: 240,
          left: 40,
          right: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
          zIndex: 10,
        }}
      >
        {/* Titanium Glowing Geometric Brand Seal */}
        <div
          style={{
            width: 104,
            height: 104,
            borderRadius: 30,
            background: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
            boxShadow: `0 20px 60px rgba(0,0,0,0.8), 0 0 ${mix(30, 70, glowPulse)}px rgba(6,182,212,0.45)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 48, fontWeight: 900, color: '#000' }}>ح</span>
        </div>

        {/* Grand Typography Stack */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontSize: 54,
              fontWeight: 900,
              color: TEXT,
              letterSpacing: '-0.03em',
              textShadow: '0 8px 30px rgba(0,0,0,0.9)',
            }}
          >
            حسابچه
          </span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: CYAN,
              letterSpacing: '0.02em',
            }}
          >
            نرم‌افزار واقعی کسب‌وکار شما
          </span>
        </div>

        {/* CTA Domain Pill */}
        <div
          style={{
            padding: '12px 36px',
            borderRadius: 999,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1.5px solid rgba(6, 182, 212, 0.45)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5), 0 0 25px rgba(6,182,212,0.2)',
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: '0.16em',
              color: TEXT,
            }}
          >
            HISABCHE.COM
          </span>
        </div>
      </div>
    </Stage>
  )
}
