// ============================================
// Customer-Dialogue Art Direction (Reel 82) — Bespoke SaaS Cinematic Motion
// Optical Counter Telemetry & Zero-Latency Customer Ledger
//
// Palette: Dark Carbon Obsidian (#08090f), Electric Cyan (#00B4FF),
// Mint Emerald (#00E676), Crimson Alert (#FF3D00), Radiant Gold (#FFD700)
// High-depth 3D perspective, zero hold-frame overlap,
// strict physical container-local coordinates, 100% dark studio theme.
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

export const DARK = '#08090f'
export const CYAN = '#00B4FF'
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
export function DialogueStage({
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
        background: 'radial-gradient(circle at 50% 25%, #101528 0%, #08090f 75%, #030406 100%)',
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
            'linear-gradient(rgba(0, 180, 255, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 230, 118, 0.4) 1px, transparent 1px)',
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

// ─── Scene 1 — The Counter Stand-Off: Frame-0 Arrest ────────────────────

export function CounterStandOffScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.2)
  const shake = t > 1.2 && t < 2.0 ? Math.sin(t * 30) * 3 : 0

  return (
    <DialogueStage scene={scene} t={t} label="// 01 · چالش پای صندوق">
      {/* Top Typographic Anchor (Safe Zone y: 130..250) */}
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
          پای صندوق · ساعت شلوغی
        </div>
        <div
          style={{
            fontSize: 42,
            fontWeight: 900,
            color: '#ffffff',
            background: `linear-gradient(135deg, ${CRIMSON}, #B30000)`,
            padding: '6px 28px',
            borderRadius: 16,
            boxShadow: `0 0 35px ${CRIMSON}55`,
          }}
        >
          «چقدر بدهکارم؟»
        </div>
      </div>

      {/* Two Dilemma Cards (Safe Zone y: 280..520) */}
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
        {/* Customer Query Card (x: 40..250) */}
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
              مشتری
            </span>
          </div>

          <div
            dir="rtl"
            style={{ fontSize: 16, fontWeight: 800, color: CYAN, textAlign: 'center' }}
          >
            «مانده حساب نسیه‌ام را می‌خواهم تسویه کنم»
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
            حق طبیعی خریدار
          </div>
        </div>

        {/* Shopkeeper Hesitation Card (x: 290..500) */}
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
              مالک سنتی
            </span>
          </div>

          <div
            dir="rtl"
            style={{ fontSize: 15, fontWeight: 800, color: CRIMSON, textAlign: 'center' }}
          >
            «بگذار دفتر کاغذی را ورق بزنم…»
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
            اتلاف وقت و شک در ارقام
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
            صف طولانی و افت اعتبار مغازه
          </div>
          <div
            style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}
          >
            جستجو در دفتر کاغذی مشتری را بی‌اعتماد می‌کند
          </div>
        </div>
      </div>
    </DialogueStage>
  )
}

// ─── Scene 2 — Sub-Second Query: Biometric Customer Ledger ──────────────

export function SubSecondQueryScene({ t, scene }: { t: number; scene: Scene }) {
  const scanP = ease(clamp(progress(t, 0.4, 2.0)))
  const cardP = pop(t, 1.8)
  const resultP = pop(t, 3.4)

  return (
    <DialogueStage scene={scene} t={t} label="// 02 · استعلام آنی حسابچه">
      {/* Top Search Bar (y: 130..220) */}
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
          <span style={{ color: CYAN, fontSize: 16 }}>🔍</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
            جستجوی پرونده: مشتری ۱۰۴۲
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
          FOUND (0.2s)
        </span>
      </div>

      {/* Titanium Terminal Cockpit (Safe Zone y: 240..560) */}
      <div
        style={{
          position: 'absolute',
          top: 240,
          left: 40,
          right: 40,
          height: 300,
          background: 'linear-gradient(145deg, #0d121c, #07090f)',
          border: `2px solid rgba(255,255,255,0.12)`,
          borderRadius: 24,
          boxShadow: `0 30px 80px rgba(0,0,0,0.9), 0 0 40px ${CYAN}22`,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          opacity: clamp(cardP * 1.5),
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
            CUSTOMER DOSSIER
          </span>
          <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            صورت‌حساب شفاف مشتری ۱۰۴۲
          </span>
        </div>

        {/* Scan Bar */}
        <div
          style={{
            height: 3,
            width: '100%',
            background: `linear-gradient(90deg, transparent, ${CYAN}, ${EMERALD}, transparent)`,
            boxShadow: `0 0 15px ${CYAN}`,
            opacity: scanP < 1 ? 1 : 0.2,
          }}
        />

        {/* Metric Rows */}
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
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>مجموع خرید ماه:</span>
            <span style={{ ...MONO, color: CYAN, fontWeight: 900 }}>{faNumber(42000)}</span>
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
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>واریزی و پرداخت‌ها:</span>
            <span style={{ ...MONO, color: EMERALD, fontWeight: 900 }}>{faNumber(31000)}</span>
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
            <span style={{ fontSize: 17, fontWeight: 900, color: '#ffffff' }}>
              مانده قطعی بدهی:
            </span>
            <span
              style={{
                ...MONO,
                fontSize: 26,
                fontWeight: 900,
                color: GOLD,
                background: 'rgba(255, 215, 0, 0.12)',
                border: `1.5px solid ${GOLD}55`,
                padding: '4px 14px',
                borderRadius: 10,
              }}
            >
              {faNumber(11000)}
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
          opacity: clamp(resultP * 1.5),
          transform: `scale(${mix(0.85, 1, resultP).toFixed(3)})`,
        }}
      >
        <span style={{ color: EMERALD, fontSize: 24, fontWeight: 900 }}>✓</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            پاسخ قطعی در ۳ ثانیه
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
            مشتری با اطمینان کامل مانده را پرداخت می‌کند
          </div>
        </div>
      </div>
    </DialogueStage>
  )
}

// ─── Scene 3 — Invoice Deep-Dive: Historical Audit Trail ────────────────

export function InvoiceDeepDiveScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.4)

  return (
    <DialogueStage scene={scene} t={t} label="// 03 · سابقه خرید و ریز اقلام">
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
          مشتری: «فاکتور قبلی‌ام کی بود؟»
        </div>
        <div style={{ fontSize: 38, fontWeight: 900, color: CYAN, marginTop: 4 }}>
          ریز اقلام در یک نگاه
        </div>
      </div>

      {/* 2 Chronological Invoice Cards (Safe Zone y: 240..540) */}
      <div
        style={{
          position: 'absolute',
          top: 240,
          left: 40,
          right: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Card 1: 3 Days ago (Active balance) */}
        <div
          dir="rtl"
          style={{
            background: 'linear-gradient(145deg, #131a2c, #0a0e1c)',
            border: `1.5px solid ${CYAN}`,
            borderRadius: 20,
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: `0 20px 45px rgba(0,0,0,0.7), 0 0 25px ${CYAN}22`,
            opacity: clamp(p1 * 1.5),
            transform: `translateY(${mix(20, 0, p1).toFixed(1)}px)`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
              فاکتور شماره ۱۰۴۲ · ۳ روز پیش
            </span>
            <span style={{ ...MONO, fontSize: 16, fontWeight: 900, color: CYAN }}>
              {faNumber(27000)}
            </span>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
            کالای بازرگانی کد ۱۰۱ (۲ عدد) + کالای مصرفی کد ۳۰۳ (۱ عدد)
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: 8,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <span style={{ color: EMERALD }}>پرداخت شده: {faNumber(16000)}</span>
            <span style={{ color: GOLD }}>مانده فاکتور: {faNumber(11000)}</span>
          </div>
        </div>

        {/* Card 2: 10 Days ago (Fully Settled) */}
        <div
          dir="rtl"
          style={{
            background: 'linear-gradient(145deg, #101524, #080b14)',
            border: `1.5px solid ${BORDER_GLASS}`,
            borderRadius: 20,
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            opacity: clamp(p2 * 1.5),
            transform: `translateY(${mix(20, 0, p2).toFixed(1)}px)`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: 'rgba(255,255,255,0.85)' }}>
              فاکتور شماره ۱۰۳۹ · ۱۰ روز پیش
            </span>
            <span
              style={{ ...MONO, fontSize: 16, fontWeight: 900, color: 'rgba(255,255,255,0.6)' }}
            >
              {faNumber(15000)}
            </span>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>
            محصول استاندارد کد ۲۰۲ (۱ عدد)
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: 8,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <span style={{ color: EMERALD }}>تسویه کامل شده ✓</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>مانده: ۰</span>
          </div>
        </div>
      </div>

      {/* Assurance Tag (Safe Zone y: 580..680) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 580,
          left: 40,
          right: 40,
          textAlign: 'center',
          fontSize: 15,
          fontWeight: 800,
          color: 'rgba(255,255,255,0.8)',
        }}
      >
        هر فاکتور با تاریخ، ساعت و وضعیت تسویه ثبت شده است
      </div>
    </DialogueStage>
  )
}

// ─── Scene 4 — The Trust Equation: Transparent vs Murky ─────────────────

export function TrustEquationScene({ t, scene }: { t: number; scene: Scene }) {
  const p = pop(t, 0.4)

  return (
    <DialogueStage scene={scene} t={t} label="// 04 · معادله اعتماد">
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 140,
          left: 0,
          right: 0,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 900, color: '#ffffff' }}>
          شفافیت، خریدار را وفادار می‌کند
        </div>
        <div
          style={{ fontSize: 16, fontWeight: 800, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}
        >
          تفاوت تجربه خرید با نرم‌افزار هوشمند
        </div>
      </div>

      {/* Trust Gauge Monolith (Safe Zone y: 240..540) */}
      <div
        style={{
          position: 'absolute',
          top: 240,
          left: 40,
          right: 40,
          height: 280,
          background: 'linear-gradient(145deg, #101626, #090d18)',
          border: `2px solid ${EMERALD}`,
          borderRadius: 26,
          boxShadow: `0 30px 80px rgba(0,0,0,0.9), 0 0 45px ${EMERALD}33`,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: clamp(p * 1.5),
        }}
      >
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ ...MONO, fontSize: 11, color: EMERALD, fontWeight: 800 }}>
            TRUST SCORE
          </span>
          <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
            شاخص رضایت مشتری
          </span>
        </div>

        {/* Circular Dial Visual */}
        <div
          style={{
            width: 110,
            height: 110,
            borderRadius: '50%',
            border: `4px solid ${EMERALD}`,
            boxShadow: `0 0 25px ${EMERALD}66`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <span style={{ ...MONO, fontSize: 32, fontWeight: 900, color: '#ffffff' }}>۱۰۰٪</span>
          <span dir="rtl" style={{ fontSize: 10, fontWeight: 800, color: EMERALD }}>
            شفافیت کامل
          </span>
        </div>

        <div
          dir="rtl"
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: 'rgba(255,255,255,0.85)',
            textAlign: 'center',
          }}
        >
          ارسال فاکتور و لینک مانده در لحظه به گوشی مشتری
        </div>
      </div>

      {/* Bottom Reassurance Banner (y: 570..680) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 570,
          left: 40,
          right: 40,
          background: 'rgba(0, 230, 118, 0.08)',
          border: `1.5px solid ${EMERALD}44`,
          borderRadius: 18,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ color: EMERALD, fontSize: 20 }}>✓</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
          بدون حتی ۱ ریال اختلاف حساب در پایان سال
        </span>
      </div>
    </DialogueStage>
  )
}

// ─── Scene 5 — Single Source Core: Architectural Ledger ─────────────────

export function SingleSourceCoreScene({ t, scene }: { t: number; scene: Scene }) {
  const p = pop(t, 0.3)

  return (
    <DialogueStage scene={scene} t={t} label="// 05 · هسته متمرکز حسابچه">
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 140,
          left: 40,
          right: 40,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 40, fontWeight: 900, color: '#ffffff' }}>یک دفتر واحد</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: CYAN, marginTop: 4 }}>
          برای فروشنده، انباردار و مشتری
        </div>
      </div>

      {/* Central Hexagonal Core Monolith (Safe Zone y: 250..540) */}
      <div
        style={{
          position: 'absolute',
          top: 250,
          left: '50%',
          width: 300,
          height: 280,
          marginLeft: -150,
          background: 'linear-gradient(145deg, #131a30, #0a0e1c)',
          border: `2px solid ${CYAN}`,
          borderRadius: 32,
          boxShadow: `0 35px 90px rgba(0,0,0,0.9), 0 0 50px ${CYAN}33`,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: clamp(p * 1.5),
        }}
      >
        <div
          dir="rtl"
          style={{
            fontSize: 32,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.02em',
          }}
        >
          حسابچه
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          {['ثبت فاکتور در ۳ ثانیه', 'کاردکس انبار خودکار', 'مانده نسیه همیشه تراز'].map(
            (item, idx) => (
              <div
                key={idx}
                dir="rtl"
                style={{
                  background: 'rgba(0, 180, 255, 0.08)',
                  border: `1px solid ${BORDER_GLASS}`,
                  borderRadius: 12,
                  padding: '8px 14px',
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ color: EMERALD }}>✓</span>
                <span>{item}</span>
              </div>
            ),
          )}
        </div>

        <div
          style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em' }}
        >
          CLOUD ERP · SIMPLE · FAST
        </div>
      </div>

      {/* Slogan Pill Below (y: 580..680) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 580,
          left: 40,
          right: 40,
          textAlign: 'center',
          fontSize: 16,
          fontWeight: 800,
          color: 'rgba(255,255,255,0.8)',
        }}
      >
        دیگر نگران حساب‌های معوق و نسیه نباشید
      </div>
    </DialogueStage>
  )
}

// ─── Scene 6 — Conversion Closer & CTA ──────────────────────────────────

export function DialogueCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const brandP = pop(t, 0.2)
  const btnP = pop(t, 1.2)

  return (
    <DialogueStage scene={scene} t={t} label="// 06 · شروع رایگان">
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
          نرم‌افزار ابری حسابداری و فروشگاهی
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
        بدون نیاز به نصب سخت‌افزار · دسترسی از هر دستگاه
      </div>
    </DialogueStage>
  )
}
