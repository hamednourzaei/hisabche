// ============================================
// Reel #111 — «درمان نرم‌افزارهای سطحی» (Beyond Superficial Software)
//
// Topic:
// Merchants are exhausted by superficial, fragile accounting software:
// 1. Freezes on weak internet or server drops
// 2. Trapped as web-only websites that cannot install natively on mobile
// 3. Rigid systems with zero deep customization
// 4. Incomplete toy solutions that break under real market pressure
//
// Hisabche is the cure:
// - Local-First Offline Engine (Zero downtime when internet drops)
// - True Multi-Device Native Deployment (Android, Windows, Web synced)
// - Deep modular customization tailored to real businesses
//
// Art direction: procedural-spatial & dark-neon
// Guardrails: noZoom (camera scale 1.0), ≤ 6 on-stage words, 24px+ safe margins,
// dark studio palette, deterministic faNumber digits, no currency names.
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, enter, mix, progress, pulse, spring, strokeDraw } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

// ─── Design Tokens ──────────────────────────────────────────────────────────

const INK = '#070a12'
const PANEL_BG = '#0d1320'
const PANEL_HI = '#141d30'
const HAIRLINE = 'rgba(255, 255, 255, 0.08)'
const HAIRLINE_HI = 'rgba(255, 255, 255, 0.18)'
const CYAN = '#00d2ff'
const CYAN_DIM = 'rgba(0, 210, 255, 0.28)'
const CYAN_GLOW = 'rgba(0, 210, 255, 0.18)'
const MINT = '#00f5a0'
const MINT_DIM = 'rgba(0, 245, 160, 0.26)'
const MINT_GLOW = 'rgba(0, 245, 160, 0.16)'
const RED = '#ff4d6d'
const RED_DIM = 'rgba(255, 77, 109, 0.28)'
const AMBER = '#f59e0b'
const AMBER_DIM = 'rgba(245, 158, 11, 0.26)'
const TEXT = '#eef3fb'
const MUTED = '#8a99b2'
const MONO = "'JetBrains Mono', 'Vazirmatn', monospace"

const LIFT = '0 18px 40px rgba(0,0,0,0.52), 0 2px 6px rgba(0,0,0,0.38)'
const LIFT_CYAN = `0 22px 54px rgba(0,0,0,0.6), 0 0 44px ${CYAN_GLOW}`
const LIFT_MINT = `0 22px 54px rgba(0,0,0,0.6), 0 0 44px ${MINT_GLOW}`
const LIFT_ALERT = '0 22px 54px rgba(0,0,0,0.6), 0 0 40px rgba(255,77,109,0.18)'

export type SceneProps = { t: number; scene: Scene }

// ─── Stage Shell ────────────────────────────────────────────────────────────

function Stage({ children }: { children: ReactNode }) {
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
          'radial-gradient(120% 55% at 50% -6%, rgba(0,210,255,0.11) 0%, rgba(0,210,255,0) 60%), radial-gradient(100% 45% at 50% 108%, rgba(0,245,160,0.08) 0%, rgba(0,245,160,0) 62%)',
      }}
    >
      {children}
      <div
        style={{
          position: 'absolute',
          bottom: 26,
          left: 32,
          fontSize: 9,
          letterSpacing: '0.22em',
          fontFamily: MONO,
          color: 'rgba(138, 153, 178, 0.36)',
          pointerEvents: 'none',
        }}
      >
        HISABCHE ARCHITECTURE // LOCAL-FIRST
      </div>
    </div>
  )
}

function Card({
  style,
  children,
  active = false,
  alert = false,
  mint = false,
}: {
  style: CSSProperties
  children: ReactNode
  active?: boolean | undefined
  alert?: boolean | undefined
  mint?: boolean | undefined
}) {
  return (
    <div
      style={{
        position: 'absolute',
        borderRadius: 16,
        background: `linear-gradient(180deg, ${PANEL_HI} 0%, ${PANEL_BG} 100%)`,
        border: `1px solid ${alert ? RED_DIM : mint ? MINT_DIM : active ? CYAN_DIM : HAIRLINE}`,
        boxShadow: alert ? LIFT_ALERT : mint ? LIFT_MINT : active ? LIFT_CYAN : LIFT,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function Dot({ size = 8, color = CYAN }: { size?: number; color?: string }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        boxShadow: `0 0 10px ${color}66`,
      }}
    />
  )
}

function Check({ size = 18, color = MINT }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 12.6 9.6 17.6 19.5 7.2"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Scene 1: Shallow Trap (0.00–6.00s) — Freezing on Web/Server Drops ───────

export function ShallowTrapScene({ t }: SceneProps) {
  const freezeP = clamp(progress(t, 1.2, 0.6))
  const spinnerAngle = (t * 220) % 360
  const isAlarm = t >= 1.2

  return (
    <Stage>
      {/* Background Warning Aura */}
      <div
        style={{
          position: 'absolute',
          top: 360,
          left: 270,
          width: 440,
          height: 440,
          borderRadius: '50%',
          background: isAlarm
            ? 'radial-gradient(circle, rgba(255,77,109,0.18) 0%, rgba(255,77,109,0) 66%)'
            : 'radial-gradient(circle, rgba(0,210,255,0.06) 0%, rgba(0,210,255,0) 66%)',
          transform: 'translate(-50%, -50%)',
          opacity: 0.6 + (isAlarm ? 0.3 * pulse(t, 1.2, 5.8, 1.6) : 0),
          pointerEvents: 'none',
        }}
      />

      {/* Legacy Fragile Cloud Web Panel */}
      <Card
        alert={isAlarm}
        style={{
          top: 170,
          left: 45,
          width: 450,
          height: 460,
          borderRadius: 22,
          border: `1.5px solid ${isAlarm ? RED : HAIRLINE}`,
        }}
      >
        {/* Fake Browser Toolbar Header */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 44,
            background: 'rgba(0,0,0,0.35)',
            borderBottom: `1px solid ${HAIRLINE}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 18px',
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: RED }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: AMBER }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: MUTED }} />
          </div>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11,
              color: MUTED,
              letterSpacing: '0.04em',
            }}
          >
            web-app-slow.cloud/pos
          </span>
          <Dot size={7} color={isAlarm ? RED : MINT} />
        </div>

        {/* Central Freezing State Container */}
        <div
          style={{
            position: 'absolute',
            top: 80,
            left: 20,
            right: 20,
            bottom: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
          }}
        >
          {/* Animated/Frozen Spinner Graphic */}
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              border: `3px solid ${isAlarm ? 'rgba(255,77,109,0.2)' : 'rgba(0,210,255,0.2)'}`,
              borderTopColor: isAlarm ? RED : CYAN,
              transform: `rotate(${isAlarm ? 140 : spinnerAngle}deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isAlarm ? '0 0 20px rgba(255,77,109,0.3)' : 'none',
            }}
          >
            {isAlarm && <span style={{ fontSize: 26, color: RED, fontWeight: 900 }}>!</span>}
          </div>

          {/* Alarm Status Badge */}
          <div
            dir="rtl"
            style={{
              padding: '8px 22px',
              borderRadius: 999,
              border: `1px solid ${isAlarm ? RED_DIM : HAIRLINE}`,
              background: isAlarm ? 'rgba(255,77,109,0.15)' : 'rgba(255,255,255,0.04)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Dot size={8} color={isAlarm ? RED : CYAN} />
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: isAlarm ? RED : TEXT,
              }}
            >
              {isAlarm ? 'عدم پاسخگویی سرور' : 'در حال بارگذاری اطلاعات'}
            </span>
          </div>

          {/* Abstracted Cashier Invoice Lines (Dimmed) */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: '0 20px',
              opacity: mix(0.9, 0.28, freezeP),
            }}
          >
            <div
              style={{
                height: 38,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${HAIRLINE}`,
                display: 'flex',
                alignItems: 'center',
                padding: '0 14px',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 13, color: MUTED }}>فاکتور فروش #۱۰۱</span>
              <span style={{ fontFamily: MONO, fontSize: 13, color: MUTED }}>{faNumber(1450)}</span>
            </div>
            <div
              style={{
                height: 38,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${HAIRLINE}`,
                display: 'flex',
                alignItems: 'center',
                padding: '0 14px',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 13, color: MUTED }}>فاکتور فروش #۱۰۲</span>
              <span style={{ fontFamily: MONO, fontSize: 13, color: MUTED }}>{faNumber(2800)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Spoken Narration Anchor: قطع سرور (Strictly 2 Words) */}
      <div
        dir="rtl"
        style={{
          ...enter(t, 0.4, { y: 12 }),
          position: 'absolute',
          top: 686,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 34,
            fontWeight: 800,
            color: isAlarm ? RED : TEXT,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            textShadow: '0 4px 20px rgba(0,0,0,0.8)',
          }}
        >
          قطع سرور
        </span>
        <div
          style={{
            width: 36,
            height: 3,
            borderRadius: 2,
            background: isAlarm ? RED : CYAN,
          }}
        />
      </div>
    </Stage>
  )
}

// ─── Scene 2: Four Flaws (6.00–13.00s) — The 4 Market Frustrations ──────────

const FLAWS = [
  { title: 'وابستگی مطلق به اینترنت', sub: 'قطعی نت = توقف صندوق' },
  { title: 'نصب نشدن روی گوشی', sub: 'فقط یک سایت محدود' },
  { title: 'خشکی و عدم شخصی‌سازی', sub: 'قالب‌های بسته و غیرقابل تغییر' },
  { title: 'امکانات سطحی و ناقص', sub: 'نبود ثبت عمیق حسابداری' },
]

export function FourFlawsScene({ t }: SceneProps) {
  return (
    <Stage>
      {/* 4 Distinct Diagnostic Pain Cards */}
      {FLAWS.map((flaw, i) => {
        const rowIn = enter(t, 0.5 + i * 0.55, { y: 18, scale: 0.98 })

        return (
          <Card
            key={flaw.title}
            alert
            style={{
              top: 170 + i * 114,
              left: 45,
              width: 450,
              height: 98,
              borderRadius: 16,
              ...rowIn,
            }}
          >
            <div
              dir="rtl"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                gap: 16,
              }}
            >
              {/* Warning Restriction Icon */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'rgba(255,77,109,0.12)',
                  border: '1px solid rgba(255,77,109,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx={12} cy={12} r={9} stroke={RED} strokeWidth={2} />
                  <path
                    d="M12 7v6M12 16.5v.5"
                    stroke={RED}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* Problem Title & Explanatory Subtitle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <span
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: TEXT,
                    lineHeight: 1.2,
                  }}
                >
                  {flaw.title}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: MUTED,
                  }}
                >
                  {flaw.sub}
                </span>
              </div>
            </div>
          </Card>
        )
      })}

      {/* On-stage Caption: چهار گره بازار (Strictly 3 Words) */}
      <div
        dir="rtl"
        style={{
          ...enter(t, 3.2, { y: 12 }),
          position: 'absolute',
          top: 686,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 34,
            fontWeight: 800,
            color: TEXT,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            textShadow: '0 4px 20px rgba(0,0,0,0.8)',
          }}
        >
          چهار گره بازار
        </span>
        <div
          style={{
            width: 36,
            height: 3,
            borderRadius: 2,
            background: RED,
          }}
        />
      </div>
    </Stage>
  )
}

// ─── Scene 3: Offline-First Engine (13.00–20.00s) — Local-First Reliability ──

export function OfflineFirstScene({ t }: SceneProps) {
  const panelSpring = spring(clamp(progress(t, 0.4, 0.85)))
  const confirmed = clamp(progress(t, 1.8, 0.3))
  const pulseLoop = pulse(t, 1.8, 6.8, 1.8)

  return (
    <Stage>
      {/* Background Emerald Local Engine Aura */}
      <div
        style={{
          position: 'absolute',
          top: 360,
          left: 270,
          width: 440,
          height: 440,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,245,160,0.14) 0%, rgba(0,245,160,0) 68%)',
          transform: 'translate(-50%, -50%)',
          opacity: 0.6 + 0.25 * pulseLoop,
          pointerEvents: 'none',
        }}
      />

      {/* Real High-Tech POS Terminal Card */}
      <Card
        mint
        style={{
          top: 170,
          left: 45,
          width: 450,
          height: 460,
          borderRadius: 22,
          transform: `scale(${mix(0.94, 1, panelSpring)})`,
        }}
      >
        {/* Terminal Header with Dual Connectivity Status */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 52,
            background: 'rgba(0,0,0,0.3)',
            borderBottom: `1px solid ${HAIRLINE}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
          }}
        >
          {/* Offline Indicator Pill */}
          <div
            style={{
              padding: '4px 12px',
              borderRadius: 999,
              border: `1px solid ${AMBER_DIM}`,
              background: 'rgba(245,158,11,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Dot size={6} color={AMBER} />
            <span style={{ fontSize: 12, fontWeight: 700, color: AMBER }}>اینترنت: قطع</span>
          </div>

          {/* Local-First Engine 100% Active Badge */}
          <div
            style={{
              padding: '4px 12px',
              borderRadius: 999,
              border: `1px solid ${MINT_DIM}`,
              background: 'rgba(0,245,160,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Dot size={6} color={MINT} />
            <span style={{ fontSize: 12, fontWeight: 700, color: MINT }}>پایگاه محلی: فعال</span>
          </div>
        </div>

        {/* Real-time Offline Cashier Invoice Box */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 76,
            left: 20,
            right: 20,
            padding: '18px 20px',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${HAIRLINE}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>فاکتور سریع صندوق</span>
            <span style={{ fontFamily: MONO, fontSize: 13, color: MUTED }}>۰ms تاخیر</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: MUTED }}>مبلغ فروش:</span>
            <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 800, color: TEXT }}>
              {faNumber(3250)}
            </span>
          </div>

          {/* Instant Local Storage Commit Button */}
          <div
            style={{
              height: 48,
              borderRadius: 12,
              background: confirmed > 0 ? 'rgba(0,245,160,0.22)' : 'rgba(0,245,160,0.12)',
              border: `1.5px solid ${confirmed > 0 ? MINT : MINT_DIM}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: confirmed > 0 ? '0 0 24px rgba(0,245,160,0.25)' : 'none',
            }}
          >
            {confirmed > 0 && <Check size={18} color={MINT} />}
            <span style={{ fontSize: 16, fontWeight: 800, color: MINT }}>
              {confirmed > 0 ? 'ثبت فوری در حافظه داخلی' : 'تایید فروش'}
            </span>
          </div>
        </div>

        {/* 3 Synchronous Local Ledger Postings */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 254,
            left: 20,
            right: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {['کاهش از کاردکس انبار', 'واریز به صندوق نقدی', 'سند اتوماتیک دوبل'].map((row, i) => {
            const rowIn = enter(t, 2.2 + i * 0.2, { y: 10 })

            return (
              <div
                key={row}
                style={{
                  height: 46,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${HAIRLINE}`,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 16px',
                  justifyContent: 'space-between',
                  ...rowIn,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Dot size={6} color={MINT} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{row}</span>
                </div>
                <Check size={16} color={MINT} />
              </div>
            )
          })}
        </div>
      </Card>

      {/* On-stage Caption: صندوق فعال · آفلاین (Strictly 3 Words) */}
      <div
        dir="rtl"
        style={{
          ...enter(t, 2.5, { y: 12 }),
          position: 'absolute',
          top: 686,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 34,
            fontWeight: 800,
            color: TEXT,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            textShadow: '0 4px 20px rgba(0,0,0,0.8)',
          }}
        >
          صندوق فعال · آفلاین
        </span>
        <div
          style={{
            width: 36,
            height: 3,
            borderRadius: 2,
            background: MINT,
          }}
        />
      </div>
    </Stage>
  )
}

// ─── Scene 4: True Multi-Device (20.00–27.00s) — Phone, Tablet, POS ─────────

export function MultiDeviceScene({ t }: SceneProps) {
  const syncBeam = strokeDraw(t, 0.6, 2.8, 800)

  return (
    <Stage>
      {/* Synchronized Data Transmission Cable */}
      <svg width={540} height={960} style={{ position: 'absolute', inset: 0 }}>
        <path
          d="M 120 320 C 270 260, 270 520, 420 460"
          fill="none"
          stroke={CYAN_DIM}
          strokeWidth={2.4}
          strokeDasharray={syncBeam.strokeDasharray}
          strokeDashoffset={syncBeam.strokeDashoffset}
        />
      </svg>

      {/* Device 1: Mobile Smartphone (Android) */}
      <Card
        active
        style={{
          top: 180,
          left: 55,
          width: 190,
          height: 310,
          borderRadius: 24,
          ...enter(t, 0.3, { y: 18, scale: 0.95 }),
        }}
      >
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '16px 14px',
            gap: 12,
          }}
        >
          <div style={{ width: 40, height: 4, borderRadius: 2, background: HAIRLINE_HI }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: CYAN }}>موبایل جیبی</span>
          <div
            style={{
              width: '100%',
              height: 120,
              borderRadius: 12,
              background: 'rgba(0,210,255,0.06)',
              border: `1px solid ${CYAN_DIM}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Dot size={8} color={MINT} />
            <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>فروش ثبت شد</span>
            <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: TEXT }}>
              {faNumber(1850)}
            </span>
          </div>
          <span style={{ fontSize: 11, color: MUTED }}>نصب بومی اندروید</span>
        </div>
      </Card>

      {/* Device 2: Desktop POS / Window System */}
      <Card
        mint
        style={{
          top: 310,
          left: 275,
          width: 215,
          height: 290,
          borderRadius: 20,
          ...enter(t, 0.7, { y: 18, scale: 0.95 }),
        }}
      >
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 16px',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: MINT }}>صندوق ویندوز</span>
            <Dot size={6} color={MINT} />
          </div>
          <div
            style={{
              height: 70,
              borderRadius: 10,
              background: 'rgba(0,245,160,0.06)',
              border: `1px solid ${MINT_DIM}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '0 12px',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 11, color: MUTED }}>موجودی لحظه‌ای</span>
            <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800, color: TEXT }}>
              {faNumber(42800)}
            </span>
          </div>
          <span style={{ fontSize: 11, color: MUTED }}>همگام‌سازی لحظه‌ای</span>
        </div>
      </Card>

      {/* On-stage Caption: همگام روی سه دستگاه (Strictly 4 Words) */}
      <div
        dir="rtl"
        style={{
          ...enter(t, 2.8, { y: 12 }),
          position: 'absolute',
          top: 686,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 34,
            fontWeight: 800,
            color: TEXT,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            textShadow: '0 4px 20px rgba(0,0,0,0.8)',
          }}
        >
          همگام روی سه دستگاه
        </span>
        <div
          style={{
            width: 36,
            height: 3,
            borderRadius: 2,
            background: CYAN,
          }}
        />
      </div>
    </Stage>
  )
}

// ─── Scene 5: Deep Customization (27.00–34.00s) — Form Fit to Your Work ──────

const CUSTOM_FEATURES = [
  { name: 'مدیریت شعب و انبارهای متعدد', badge: 'شخصی' },
  { name: 'تعریف فرمول و سطوح قیمتی', badge: 'انعطاف' },
  { name: 'اسناد دوبل و کدینگ تفصیلی', badge: 'دقیق' },
]

export function DeepCustomScene({ t }: SceneProps) {
  return (
    <Stage>
      {/* 3 Modular Adaptability Cards */}
      {CUSTOM_FEATURES.map((feat, i) => {
        const rowIn = enter(t, 0.4 + i * 0.5, { y: 18, scale: 0.98 })

        return (
          <Card
            key={feat.name}
            active
            style={{
              top: 190 + i * 130,
              left: 45,
              width: 450,
              height: 108,
              borderRadius: 18,
              ...rowIn,
            }}
          >
            <div
              dir="rtl"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                padding: '0 22px',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Dot size={8} color={CYAN} />
                <span style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>{feat.name}</span>
              </div>
              <div
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: `1px solid ${CYAN_DIM}`,
                  background: 'rgba(0,210,255,0.12)',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: CYAN }}>{feat.badge}</span>
              </div>
            </div>
          </Card>
        )
      })}

      {/* On-stage Caption: منطبق بر کار تو (Strictly 4 Words) */}
      <div
        dir="rtl"
        style={{
          ...enter(t, 2.6, { y: 12 }),
          position: 'absolute',
          top: 686,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 34,
            fontWeight: 800,
            color: TEXT,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            textShadow: '0 4px 20px rgba(0,0,0,0.8)',
          }}
        >
          منطبق بر کار تو
        </span>
        <div
          style={{
            width: 36,
            height: 3,
            borderRadius: 2,
            background: CYAN,
          }}
        />
      </div>
    </Stage>
  )
}

// ─── Scene 6: Brand Cure Curtain (34.00–42.00s) — The Final Resolution ───────

export function CureCurtainScene({ t }: SceneProps) {
  const bloom = clamp(progress(t, 0.1, 2.5))
  const emblemEnter = enter(t, 0.35, { y: 18, scale: 0.95 })
  const taglineEnter = enter(t, 1.0, { y: 14 })
  const brandEnter = enter(t, 1.6, { y: 20 })
  const domainEnter = enter(t, 2.5, { y: 12 })

  return (
    <Stage>
      {/* Volumetric Cyan-Mint Radial Aura */}
      <div
        style={{
          position: 'absolute',
          top: 450,
          left: 270,
          width: mix(360, 540, bloom),
          height: mix(360, 540, bloom),
          borderRadius: '50%',
          background: `radial-gradient(circle, ${CYAN_GLOW} 0%, rgba(0,245,160,0.08) 50%, rgba(0,210,255,0) 70%)`,
          opacity: 0.65 + 0.1 * Math.sin(t * 0.9),
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Hisabche Geometric Shield Insignia */}
      <div
        style={{
          ...emblemEnter,
          position: 'absolute',
          top: 250,
          left: 270,
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <svg width={76} height={76} viewBox="0 0 76 76" fill="none" aria-hidden="true">
          <circle cx={38} cy={38} r={35} stroke={CYAN} strokeWidth={1.5} opacity={0.4} />
          <path
            d="M 38 16 L 58 28 L 58 50 L 38 62 L 18 50 L 18 28 Z"
            stroke={CYAN}
            strokeWidth={2.4}
            fill="rgba(0,210,255,0.12)"
          />
          <circle cx={38} cy={38} r={6} fill={MINT} />
        </svg>
      </div>

      {/* Tagline: درمان قطعی */}
      <div
        dir="rtl"
        style={{
          ...taglineEnter,
          position: 'absolute',
          top: 360,
          left: 270,
          transform: 'translate(-50%, -50%)',
          fontSize: 28,
          fontWeight: 800,
          color: CYAN,
          whiteSpace: 'nowrap',
          letterSpacing: '0.04em',
          textShadow: '0 2px 14px rgba(0,210,255,0.3)',
        }}
      >
        درمان قطعی
      </div>

      {/* Master Display Title: حسابچه */}
      <div
        dir="rtl"
        style={{
          ...brandEnter,
          position: 'absolute',
          top: 480,
          left: 270,
          transform: 'translate(-50%, -50%)',
          fontSize: 118,
          fontWeight: 900,
          color: TEXT,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          textShadow: '0 6px 30px rgba(0,0,0,0.8), 0 0 40px rgba(0,210,255,0.22)',
        }}
      >
        حسابچه
      </div>

      {/* Official Domain Obsidian Capsule Pill */}
      <div
        style={{
          ...domainEnter,
          position: 'absolute',
          top: 610,
          left: 270,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div
          style={{
            padding: '10px 28px',
            borderRadius: 999,
            border: `1.5px solid ${HAIRLINE_HI}`,
            background: 'rgba(20, 29, 48, 0.8)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 21,
              fontWeight: 700,
              letterSpacing: '0.28em',
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
