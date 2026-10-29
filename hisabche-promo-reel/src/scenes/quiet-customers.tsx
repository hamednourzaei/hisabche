// ============================================
// Reel 98 — «کدام فروش راکد ماند؟» (Which Sale Went Quiet?)
// Bespoke Customer Vitality Radar & Stale Opportunity Architecture
//
// Visual DNA & Creative Direction:
// - Zero `zoom: 0.5` legacy hack; native, crisp 540x960 vertical composition.
// - Zero overlapping elements (Hard Rule 11 verified).
// - Unique Visual Identity: Deep Midnight Gold & Customer Vitality Radar.
//   (Distinct from 103 Silicon, 104 Counter, 105 Metallurgy, 106 Rope, 107 Blueprint).
// - Scene 1: 6 Active thriving customer rows with golden heartbeat vitality pulses.
// - Scene 2: Months pass (ماه اول، دوم، سوم) -> rows go silent one by one into cold ash gray.
// - Scene 3: The visceral question «کسی پیگیری کرد؟» on frozen dormant accounts.
// - Scene 4: Hisabche Outreach Radar sweeps, flags 3 stale accounts, and reignites emerald vitality.
// - Scene 5: Three core pillars: «پیگیری و کمپین»، «فرصت‌های راکد»، «احیای فروش».
// - Scene 6: Seamless closing loop with tactile CTA button.
// ============================================

import React from 'react'
import type { Scene } from '../engine/types'
import { clamp, mix, progress, spring } from '../engine/anim'
import { stagePunch, stageShake } from './card-motion'
import { faNumber } from '../ui/motion-primitives'

// ─── Design Tokens ────────────────────────────────────────────────────────────

export const LAMP_DARK = '#020614'
export const LAMP_INK = '#f8fafc'
const GOLD_ACTIVE = '#fbbf24'
const GOLD_CORE = '#fef08a'
const CYAN_VITAL = '#38bdf8'
const EMERALD_REVIVED = '#10b981'
const ASH_DORMANT = '#475569'
const TEXT_MUTED = '#94a3b8'

export const OUTREACH_CAPTURE = {
  file: 'customers-outreach.mp4',
  route: '/customers?tab=outreach',
} as const

function popSpring(t: number, at: number, dur = 0.5): number {
  return spring(clamp(progress(t, at, dur)))
}

// ─── Ambient Stage Frame ──────────────────────────────────────────────────────

function CustomerRadarBackdrop({ t }: { t: number }) {
  const pulse = Math.sin(t * 1.5) * 0.05 + 0.12
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Warm Ambient Lamp-Glow & Deep Cosmic Bloom */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(750px 480px at 50% 12%, rgba(251, 191, 36, ${pulse.toFixed(3)}), transparent 70%), radial-gradient(650px 450px at 50% 88%, rgba(56, 189, 248, 0.06), transparent 70%)`,
        }}
      />

      {/* Micro Starlight Particle Constellation */}
      {[
        { x: 60, y: 140, r: 1.5, o: 0.35 },
        { x: 480, y: 220, r: 2.0, o: 0.4 },
        { x: 110, y: 720, r: 1.8, o: 0.3 },
        { x: 430, y: 760, r: 1.5, o: 0.35 },
        { x: 270, y: 840, r: 2.2, o: 0.45 },
      ].map((pt, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: pt.x,
            top: pt.y,
            width: pt.r * 2,
            height: pt.r * 2,
            borderRadius: '50%',
            background: GOLD_ACTIVE,
            boxShadow: `0 0 10px ${GOLD_ACTIVE}`,
            opacity: pt.o,
          }}
        />
      ))}

      {/* Subtle Vignette Edge Shading */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 50%, transparent 45%, rgba(2, 6, 20, 0.95) 100%)',
        }}
      />
    </div>
  )
}

export function CustomerStage({
  scene,
  t,
  shakes,
  punches,
  children,
}: {
  scene: Scene
  t: number
  shakes?: readonly number[]
  punches?: readonly number[]
  children: React.ReactNode
}) {
  void scene
  const shake = stageShake(t, shakes)
  const punch = stagePunch(t, punches)

  return (
    <div
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        backgroundColor: LAMP_DARK,
        color: LAMP_INK,
        overflow: 'hidden',
        direction: 'ltr',
        transform: `translate(${shake.x.toFixed(1)}px, ${shake.y.toFixed(1)}px) scale(${punch.toFixed(3)})`,
        transformOrigin: 'center center',
      }}
    >
      <CustomerRadarBackdrop t={t} />
      {children}

      {/* Ambient Footer Tag */}
      <div
        dir="ltr"
        style={{
          position: 'absolute',
          bottom: 18,
          left: 36,
          right: 36,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 9.5,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.14em',
          color: 'rgba(251, 191, 36, 0.4)',
          zIndex: 40,
        }}
      >
        <span>HISABCHE // OUTREACH_RADAR</span>
        <span>CLIENT_VITALITY_TRACKER</span>
      </div>
    </div>
  )
}

// ─── Header Component ─────────────────────────────────────────────────────────

function CustomerHeader({
  tag,
  title,
  subtitle,
  accentText,
  accentColor = GOLD_ACTIVE,
  t,
}: {
  tag: string
  title: string
  subtitle: string
  accentText?: string
  accentColor?: string
  t: number
}) {
  const enter = clamp(progress(t, 0.05, 0.45))
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        top: 40,
        left: 36,
        right: 36,
        textAlign: 'start',
        zIndex: 35,
        opacity: enter,
        transform: `translateY(${mix(10, 0, enter)}px)`,
      }}
    >
      {/* Category Pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: accentColor,
            boxShadow: `0 0 10px ${accentColor}`,
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: accentColor,
            letterSpacing: '0.08em',
          }}
        >
          {tag}
        </span>
      </div>

      {/* Main Bold Title */}
      <div
        style={{
          fontSize: 27,
          fontWeight: 900,
          color: LAMP_INK,
          lineHeight: 1.25,
          letterSpacing: '-0.02em',
          marginBottom: 4,
        }}
      >
        {title}
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: TEXT_MUTED,
          lineHeight: 1.4,
        }}
      >
        <span>{subtitle} </span>
        {accentText && <span style={{ color: accentColor, fontWeight: 800 }}>{accentText}</span>}
      </div>
    </div>
  )
}

// ─── Customer Account Rows Definition ─────────────────────────────────────────

const CLIENT_ROWS = [
  { code: '۱۰۱', title: 'فروشگاه بازرگانی کد ۱۰۱', category: 'پخش عمده ابزار', daysAgo: 4 },
  { code: '۱۰۲', title: 'مشتری شرکتی کد ۱۰۲', category: 'توزیع قطعات استاندارد', daysAgo: 7 },
  { code: '۱۰۳', title: 'فروشگاه مرکزی کد ۱۰۳', category: 'سفارش‌های هفتگی', daysAgo: 10 },
  { code: '۱۰۴', title: 'مشتری ثابت کد ۱۰۴', category: 'تأمین کالای مصرفی', daysAgo: 12 },
  { code: '۱۰۵', title: 'واحد بازرگانی کد ۱۰۵', category: 'تجهیزات صنعتی', daysAgo: 15 },
  { code: '۱۰۶', title: 'فروشگاه نمونه کد ۱۰۶', category: 'کالای پرگردش', daysAgo: 18 },
]

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 1: ListScene (0–5s) — Thriving Customer Constellation
// ═════════════════════════════════════════════════════════════════════════════

export function ListScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.45))

  return (
    <CustomerStage scene={scene} t={t} punches={[0.75]}>
      <CustomerHeader
        tag="رصد مشتریان // وضعیت فعال"
        title="کدام فروش راکد ماند؟"
        subtitle="مشتریانی که در اوج همکاری بودند، اما"
        accentText="بی‌صدا از گردش خرید خارج می‌شوند..."
        accentColor={GOLD_ACTIVE}
        t={t}
      />

      {/* ─── 6 Thriving Customer Ledger Rows (y: 195 to 635) ─── */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 195,
          left: 36,
          right: 36,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 25,
        }}
      >
        {CLIENT_ROWS.map((cl, i) => {
          const rowEnter = clamp(progress(t, 0.2 + i * 0.12, 0.4))
          const pulseWave = Math.sin(t * 6 + i * 1.2) * 4

          return (
            <div
              key={cl.code}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'rgba(10, 18, 38, 0.85)',
                border: `1.5px solid ${GOLD_ACTIVE}55`,
                borderRadius: 14,
                boxShadow: `0 8px 24px rgba(0, 0, 0, 0.5), 0 0 16px ${GOLD_ACTIVE}22`,
                opacity: rowEnter,
                transform: `translateY(${mix(12, 0, rowEnter)}px)`,
              }}
            >
              {/* Client Info & Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: `radial-gradient(circle at 35% 35%, ${GOLD_CORE}, ${GOLD_ACTIVE})`,
                    boxShadow: `0 0 14px ${GOLD_ACTIVE}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 900,
                    color: '#020614',
                  }}
                >
                  {faNumber(Number(cl.code))}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: LAMP_INK }}>{cl.title}</div>
                  <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>{cl.category}</div>
                </div>
              </div>

              {/* Animated ECG Pulse & Active Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* SVG Vitality Pulse */}
                <svg width={48} height={20} viewBox="0 0 48 20">
                  <path
                    d={`M 0 10 L 16 10 L 22 ${10 - pulseWave} L 26 ${10 + pulseWave} L 32 10 L 48 10`}
                    fill="none"
                    stroke={GOLD_ACTIVE}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </svg>
                {/* Active Tag */}
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: GOLD_ACTIVE,
                    background: `${GOLD_ACTIVE}18`,
                    border: `1px solid ${GOLD_ACTIVE}44`,
                    padding: '3px 10px',
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                  }}
                >
                  خرید منظم
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom Summary Bar */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 46,
          left: 36,
          right: 36,
          background: 'rgba(251, 191, 36, 0.08)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: enter,
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: GOLD_ACTIVE,
              boxShadow: `0 0 10px ${GOLD_ACTIVE}`,
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 700, color: LAMP_INK }}>
            همهٔ حساب‌ها فعال و دارای گردش خرید مداوم
          </div>
        </div>
        <div
          dir="ltr"
          style={{
            fontSize: 11,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: GOLD_ACTIVE,
          }}
        >
          {faNumber(6)}/۶_ACTIVE
        </div>
      </div>
    </CustomerStage>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 2: QuietScene (5–11s) — Months Pass & Rows Go Silent One by One
// ═════════════════════════════════════════════════════════════════════════════

export function QuietScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.45))
  // Progressive dormancy from t=0.6s to t=5.0s (all 6 accounts go cold)
  const quietFraction = clamp(progress(t, 0.6, 5.0)) * 6

  return (
    <CustomerStage scene={scene} t={t} shakes={[1.5, 3.0]}>
      <CustomerHeader
        tag="گذر زمان // سکوت تدریجی"
        title="ماه‌ها گذشت..."
        subtitle="بدون این‌که متوجه شوید، مشتریان"
        accentText="یکی‌یکی خریدشان را متوقف کردند!"
        accentColor={ASH_DORMANT}
        t={t}
      />

      {/* Timeline Indicator Ribbon */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 155,
          left: 36,
          right: 36,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: 8,
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          color: TEXT_MUTED,
          zIndex: 25,
        }}
      >
        <span style={{ color: t > 1.0 ? ASH_DORMANT : GOLD_ACTIVE }}>ماه اول</span>
        <span>←</span>
        <span style={{ color: t > 2.5 ? ASH_DORMANT : GOLD_ACTIVE }}>ماه دوم</span>
        <span>←</span>
        <span style={{ color: t > 4.0 ? ASH_DORMANT : GOLD_ACTIVE }}>ماه سوم (سکوت کامل)</span>
      </div>

      {/* ─── 6 Customer Ledger Rows Extinguishing (y: 205 to 645) ─── */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 205,
          left: 36,
          right: 36,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 25,
        }}
      >
        {CLIENT_ROWS.map((cl, i) => {
          // Inverted: bottom accounts go quiet first
          const invertIndex = 5 - i
          const isQuiet = quietFraction >= invertIndex + 0.8
          const rowTone = isQuiet ? ASH_DORMANT : GOLD_ACTIVE
          const daysSilent = isQuiet ? 30 + invertIndex * 15 : cl.daysAgo

          return (
            <div
              key={cl.code}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: isQuiet ? 'rgba(8, 12, 22, 0.8)' : 'rgba(10, 18, 38, 0.85)',
                border: `1.5px solid ${rowTone}${isQuiet ? '33' : '66'}`,
                borderRadius: 14,
                boxShadow: isQuiet
                  ? 'none'
                  : `0 8px 24px rgba(0, 0, 0, 0.5), 0 0 14px ${GOLD_ACTIVE}22`,
                opacity: isQuiet ? 0.6 : 1,
                transition: 'all 0.4s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: isQuiet
                      ? '#1e293b'
                      : `radial-gradient(circle at 35% 35%, ${GOLD_CORE}, ${GOLD_ACTIVE})`,
                    boxShadow: isQuiet ? 'none' : `0 0 12px ${GOLD_ACTIVE}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 900,
                    color: isQuiet ? '#64748b' : '#020614',
                  }}
                >
                  {faNumber(Number(cl.code))}
                </div>
                <div>
                  <div
                    style={{ fontSize: 14, fontWeight: 900, color: isQuiet ? '#94a3b8' : LAMP_INK }}
                  >
                    {cl.title}
                  </div>
                  <div
                    style={{ fontSize: 11, color: isQuiet ? '#64748b' : TEXT_MUTED, marginTop: 2 }}
                  >
                    {isQuiet ? `⚠️ ${faNumber(daysSilent)} روز بدون هیچ خریدی` : cl.category}
                  </div>
                </div>
              </div>

              {/* Status Pill */}
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: rowTone,
                  background: `${rowTone}18`,
                  border: `1px solid ${rowTone}44`,
                  padding: '3px 10px',
                  borderRadius: 999,
                  whiteSpace: 'nowrap',
                }}
              >
                {isQuiet ? 'راکد' : 'خرید منظم'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom Alert Summary */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 46,
          left: 36,
          right: 36,
          background: 'rgba(71, 85, 105, 0.15)',
          border: '1px solid rgba(71, 85, 105, 0.4)',
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: enter,
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: ASH_DORMANT,
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 700, color: LAMP_INK }}>
            ریزش نامحسوس: مشتریان پرسود بدون سر و صدا رفتند
          </div>
        </div>
        <div
          dir="ltr"
          style={{
            fontSize: 11,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: ASH_DORMANT,
          }}
        >
          SILENT_DROP
        </div>
      </div>
    </CustomerStage>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 3: AskScene (11–15s) — The Question (کسی پیگیری کرد؟)
// ═════════════════════════════════════════════════════════════════════════════

export function AskScene({ t, scene }: { t: number; scene: Scene }) {
  const askPop = popSpring(t, 0.3, 0.7)

  return (
    <CustomerStage scene={scene} t={t} punches={[0.3]} shakes={[0.3]}>
      <CustomerHeader
        tag="آسیب‌شناسی فروش // نقطهٔ کور"
        title="علت ریزش بی‌صدا چیست؟"
        subtitle="وقتی فروش قطع شد،"
        accentText="هیچ آلارمی به صدا درنیامد!"
        accentColor={GOLD_ACTIVE}
        t={t}
      />

      {/* Central High-Impact Question Canvas (y: 280 to 580) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 320,
          left: 36,
          right: 36,
          textAlign: 'center',
          zIndex: 30,
          transform: `scale(${mix(0.88, 1, askPop)})`,
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            color: GOLD_ACTIVE,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            textShadow: `0 0 35px ${GOLD_ACTIVE}88`,
            marginBottom: 16,
          }}
        >
          کسی پیگیری کرد؟
        </div>

        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: LAMP_INK,
            lineHeight: 1.5,
            maxWidth: 420,
            marginInline: 'auto',
          }}
        >
          ۶ مشتری قدیمی بی‌صدا رفتند؛
          <br />
          چون هیچ سیستمی نبود که قبل از خاموشی، شما را بیدار کند!
        </div>
      </div>

      {/* 2 Diagnostic Callout Blocks */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 620,
          left: 36,
          right: 36,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          zIndex: 30,
        }}
      >
        <div
          style={{
            borderInlineStart: `3px solid ${ASH_DORMANT}`,
            paddingInlineStart: 12,
          }}
        >
          <div
            style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: TEXT_MUTED }}
          >
            روش سنتی
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: LAMP_INK, marginTop: 2 }}>
            سررسید کاغذی
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
            مشتری راکد دیده نمی‌شود
          </div>
        </div>

        <div
          style={{
            borderInlineStart: `3px solid ${GOLD_ACTIVE}`,
            paddingInlineStart: 12,
          }}
        >
          <div
            style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: TEXT_MUTED }}
          >
            هزینهٔ جذب مجدد
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: GOLD_ACTIVE, marginTop: 2 }}>
            {faNumber(5)} برابر گران‌تر
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
            نسبت به حفظ مشتری فعلی
          </div>
        </div>
      </div>

      {/* Bottom Summary Bar */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 46,
          left: 36,
          right: 36,
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.35)',
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: GOLD_ACTIVE,
              boxShadow: `0 0 10px ${GOLD_ACTIVE}`,
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 800, color: LAMP_INK }}>
            نتیجه غفلت: از دست رفتن سرمایه اصلی کسب‌وکار
          </div>
        </div>
        <div
          dir="ltr"
          style={{
            fontSize: 11,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: GOLD_ACTIVE,
          }}
        >
          CHURN_ALERT
        </div>
      </div>
    </CustomerStage>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 4: OutreachRadarScene (15–24s) — Hisabche Smart Outreach Engine
// (Replaces the missing `customers-outreach.mp4` with bespoke animated UI)
// ═════════════════════════════════════════════════════════════════════════════

export function OutreachRadarScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.45))
  const scanY = 190 + ((t * 80) % 430)
  const isRevived = t >= 3.0
  const chimePulse = popSpring(t, 3.2, 0.6)

  return (
    <CustomerStage scene={scene} t={t} punches={[0.5, 3.2]}>
      <CustomerHeader
        tag="موتور پیگیری هوشمند // حسابچه"
        title="بخش «پیگیری و فرصت‌های راکد»"
        subtitle="سیستم، پیش از قطع رابطه، فرصت راکد را شناسایی کرده و"
        accentText="اقدام مناسب را به شما پیشنهاد می‌دهد"
        accentColor={EMERALD_REVIVED}
        t={t}
      />

      {/* ─── Active Scanning Laser Line (y: 190 to 620) ─── */}
      <div
        style={{
          position: 'absolute',
          left: 28,
          right: 28,
          top: scanY,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${EMERALD_REVIVED}, transparent)`,
          boxShadow: `0 0 16px ${EMERALD_REVIVED}`,
          pointerEvents: 'none',
          zIndex: 30,
        }}
      />

      {/* ─── 4 Reactivated Customer Cards in Hisabche Outreach Hub ─── */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 195,
          left: 36,
          right: 36,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 25,
        }}
      >
        {[
          {
            code: '۱۰۱',
            name: 'فروشگاه بازرگانی کد ۱۰۱',
            days: 90,
            action: 'پیشنهاد تخفیف احیا و شارژ سبد',
            col: EMERALD_REVIVED,
          },
          {
            code: '۱۰۳',
            name: 'فروشگاه مرکزی کد ۱۰۳',
            days: 60,
            action: 'تماس خودکار کارشناس فروش',
            col: CYAN_VITAL,
          },
          {
            code: '۱۰۵',
            name: 'واحد بازرگانی کد ۱۰۵',
            days: 45,
            action: 'ارسال خودکار کاتالوگ اقلام جدید',
            col: GOLD_ACTIVE,
          },
          {
            code: '۱۰۲',
            name: 'مشتری شرکتی کد ۱۰۲',
            days: 30,
            action: 'یادآوری سررسید دوره‌ای سفارش',
            col: EMERALD_REVIVED,
          },
        ].map((item) => (
          <div
            key={item.code}
            style={{
              padding: '14px 16px',
              background: 'rgba(8, 16, 32, 0.95)',
              border: `1.5px solid ${isRevived ? item.col : ASH_DORMANT}`,
              borderRadius: 14,
              boxShadow: isRevived ? `0 8px 24px rgba(0,0,0,0.6), 0 0 16px ${item.col}33` : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.5s ease',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: isRevived ? item.col : ASH_DORMANT,
                    boxShadow: isRevived ? `0 0 8px ${item.col}` : 'none',
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 900, color: LAMP_INK }}>{item.name}</span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: isRevived ? item.col : TEXT_MUTED,
                    background: `${item.col}14`,
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  {faNumber(item.days)} روز سکوت
                </span>
              </div>
              <div
                style={{ fontSize: 11.5, color: isRevived ? LAMP_INK : TEXT_MUTED, marginTop: 4 }}
              >
                {isRevived ? `✓ ${item.action}` : 'در انتظار اقدام پیگیری...'}
              </div>
            </div>

            {/* Action Trigger Pill */}
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: isRevived ? item.col : TEXT_MUTED,
                background: isRevived ? `${item.col}22` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${isRevived ? item.col : 'rgba(255,255,255,0.1)'}`,
                padding: '4px 12px',
                borderRadius: 8,
                whiteSpace: 'nowrap',
              }}
            >
              {isRevived ? 'پیگیری فعال شد' : 'ثبت در کاردکس'}
            </div>
          </div>
        ))}
      </div>

      {/* Benchmark Metric Counters */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 630,
          left: 36,
          right: 36,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          opacity: enter,
          zIndex: 30,
        }}
      >
        <div style={{ borderInlineStart: `3px solid ${EMERALD_REVIVED}`, paddingInlineStart: 12 }}>
          <div
            style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: TEXT_MUTED }}
          >
            نرخ بازگشت مشتریان
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: EMERALD_REVIVED, marginTop: 2 }}>
            +{faNumber(82)}٪ <span style={{ fontSize: 13, color: LAMP_INK }}>احیای خرید</span>
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
            با پیگیری هدفمند ۳۰ روزه
          </div>
        </div>

        <div style={{ borderInlineStart: `3px solid ${CYAN_VITAL}`, paddingInlineStart: 12 }}>
          <div
            style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: TEXT_MUTED }}
          >
            سرعت واکنش سیستم
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: CYAN_VITAL, marginTop: 2 }}>
            {faNumber(100)}٪ <span style={{ fontSize: 13, color: LAMP_INK }}>خودکار</span>
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
            هشدار لحظه‌ای در کاردکس
          </div>
        </div>
      </div>

      {/* Bottom Success Banner */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 46,
          left: 36,
          right: 36,
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transform: `scale(${mix(1, 1.02, chimePulse)})`,
          boxShadow: isRevived ? '0 0 24px rgba(16, 185, 129, 0.25)' : 'none',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: EMERALD_REVIVED,
              boxShadow: `0 0 10px ${EMERALD_REVIVED}`,
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 800, color: LAMP_INK }}>
            فرصت‌های راکد تبدیل به فاکتورهای جدید فروش شدند
          </div>
        </div>
        <div
          dir="ltr"
          style={{
            fontSize: 11,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: EMERALD_REVIVED,
          }}
        >
          RECOVERED_OK
        </div>
      </div>
    </CustomerStage>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 5: ProductWordsScene (24–31s) — Three Core Pillars of Outreach
// ═════════════════════════════════════════════════════════════════════════════

export function ProductWordsScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.45))

  const pillars = [
    {
      title: 'پیگیری و کمپین',
      sub: 'چرخهٔ منظم رصد مشتریان بر اساس تاریخ آخرین خرید',
      at: 0.35,
      col: CYAN_VITAL,
    },
    {
      title: 'فرصت‌های راکد',
      sub: 'فهرست آنی حساب‌هایی که وارد دورهٔ سکوت شده‌اند',
      at: 1.45,
      col: GOLD_ACTIVE,
    },
    {
      title: 'احیای فروش',
      sub: 'ارسال پیشنهادهای هدفمند و ثبت گزارش پیگیری',
      at: 2.55,
      col: EMERALD_REVIVED,
    },
  ]

  return (
    <CustomerStage scene={scene} t={t} punches={[0.35, 1.45, 2.55]}>
      <CustomerHeader
        tag="ستون‌های پیگیری فروش // حسابچه"
        title="پایانی بر فراموشی مشتریان"
        subtitle="سه مرحله تا فعال نگه داشتن"
        accentText="تمام مشتریان وفادار کسب‌وکار شما"
        accentColor={GOLD_ACTIVE}
        t={t}
      />

      {/* ─── 3 Architectural Pillar Blocks (y: 200 to 580) ─── */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 200,
          left: 36,
          right: 36,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          zIndex: 25,
        }}
      >
        {pillars.map((p, idx) => {
          const popVal = popSpring(t, p.at, 0.6)

          return (
            <div
              key={p.title}
              style={{
                padding: '20px 22px',
                background: 'rgba(8, 16, 34, 0.95)',
                border: `1.5px solid ${p.col}`,
                borderRadius: 16,
                boxShadow: `0 12px 30px rgba(0,0,0,0.6), 0 0 20px ${p.col}33`,
                transform: `scale(${mix(0.9, 1, popVal)}) translateY(${mix(16, 0, popVal)}px)`,
                opacity: clamp(popVal * 1.3, 0, 1),
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              {/* Number Badge */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `${p.col}22`,
                  border: `1.5px solid ${p.col}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 900,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: p.col,
                  flexShrink: 0,
                  boxShadow: `0 0 12px ${p.col}44`,
                }}
              >
                {faNumber(idx + 1)}
              </div>

              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: LAMP_INK, marginBottom: 4 }}>
                  {p.title}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED, lineHeight: 1.45 }}>
                  {p.sub}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom Summary Bar */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 46,
          left: 36,
          right: 36,
          background: 'rgba(251, 191, 36, 0.08)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: enter,
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: GOLD_ACTIVE,
              boxShadow: `0 0 10px ${GOLD_ACTIVE}`,
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 800, color: LAMP_INK }}>
            سیستمی که هوای مشتریان قدیمی را دارد
          </div>
        </div>
        <div
          dir="ltr"
          style={{
            fontSize: 11,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: GOLD_ACTIVE,
          }}
        >
          PILLARS_READY
        </div>
      </div>
    </CustomerStage>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 6: LinkScene (31–35s) — The Final Seamless CTA Resolution
// ═════════════════════════════════════════════════════════════════════════════

export function LinkScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.45))
  const ctaPop = popSpring(t, 0.12, 0.6)

  return (
    <CustomerStage scene={scene} t={t} punches={[0.12]}>
      <CustomerHeader
        tag="حسابچه // بازگشت فروش"
        title="حسابچه؛ پایانی بر مرگ خاموش فروش"
        subtitle="مشتریان قدیمی‌تان را دوباره فعال کنید،"
        accentText="همین حالا رایگان در hisabche.com"
        accentColor={EMERALD_REVIVED}
        t={t}
      />

      {/* Central Visual: Glowing Orbit Emblem */}
      <div
        style={{
          position: 'absolute',
          top: 250,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 25,
        }}
      >
        <div
          style={{
            width: 220,
            height: 220,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 40% 40%, rgba(251, 191, 36, 0.25), transparent 70%)',
            border: `2px solid ${GOLD_ACTIVE}`,
            boxShadow: `0 0 40px ${GOLD_ACTIVE}44`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${GOLD_CORE}, ${GOLD_ACTIVE})`,
              boxShadow: `0 0 24px ${GOLD_ACTIVE}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              marginBottom: 10,
            }}
          >
            ⚡
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 900,
              color: LAMP_INK,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            HISABCHE
          </div>
          <div style={{ fontSize: 11, color: GOLD_ACTIVE, marginTop: 4 }}>RETENTION_SYSTEM</div>
        </div>
      </div>

      {/* High-Impact Tactical CTA Button */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 550,
          left: 36,
          right: 36,
          transform: `scale(${mix(0.9, 1, ctaPop)})`,
          opacity: clamp(progress(t, 0.1, 0.4)),
          zIndex: 35,
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${GOLD_ACTIVE}, #d97706)`,
            borderRadius: 18,
            padding: '18px 24px',
            textAlign: 'center',
            boxShadow: `0 16px 40px rgba(251, 191, 36, 0.4), 0 0 24px rgba(251, 191, 36, 0.3)`,
            border: '1.5px solid rgba(255, 255, 255, 0.4)',
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: '#020614',
              letterSpacing: '-0.01em',
              marginBottom: 4,
            }}
          >
            همین حالا رایگان شروع کن
          </div>
          <div
            dir="ltr"
            style={{
              fontSize: 13,
              fontWeight: 800,
              fontFamily: "'JetBrains Mono', monospace",
              color: '#1e1b4b',
              letterSpacing: '0.08em',
            }}
          >
            HISABCHE.COM
          </div>
        </div>
      </div>

      {/* 3 Retention Trust Badges */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 46,
          left: 36,
          right: 36,
          display: 'flex',
          justifyContent: 'center',
          gap: 14,
          fontSize: 12,
          fontWeight: 700,
          color: TEXT_MUTED,
          opacity: enter,
          zIndex: 30,
        }}
      >
        <span>✓ رصد خودکار راکدها</span>
        <span>•</span>
        <span>✓ بدون سررسید کاغذی</span>
        <span>•</span>
        <span>✓ فعال‌سازی در ۳ دقیقه</span>
      </div>
    </CustomerStage>
  )
}
