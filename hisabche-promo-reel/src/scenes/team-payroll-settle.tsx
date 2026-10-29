// ============================================
// Team-Payroll-Settle Art Direction (Reel 81) — Bespoke SaaS Motion
// The Precision Payroll Vault & Dispute-Free Wage Engine
//
// Arithmetic:
//   ۳۵٬۰۰۰٬۰۰۰ پایه + ۸٬۵۰۰٬۰۰۰ اضافه کاری − ۱۲٬۰۰۰٬۰۰۰ مساعده = ۳۱٬۵۰۰٬۰۰۰ خالص
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
export function PayrollStage({
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
        background: 'radial-gradient(circle at 50% 25%, #101628 0%, #08090f 75%, #030406 100%)',
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

// ─── Scene 1 — First-of-the-Month Clashing Dilemma: Frame-0 Arrest ───────

export function PayrollDilemmaScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.2)
  const shake = t > 1.2 && t < 2.0 ? Math.sin(t * 30) * 3 : 0

  return (
    <PayrollStage scene={scene} t={t} label="// 01 · چالش پایان ماه و حقوق">
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
          روز پرداخت حقوق رسید…
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
          سر مساعده‌ها دعواست!
        </div>
      </div>

      {/* Two Conflicting Viewpoint Cards (Safe Zone y: 280..520) */}
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
        {/* Employee Side (x: 40..250) */}
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
              کارمند
            </span>
          </div>

          <div
            dir="rtl"
            style={{ fontSize: 16, fontWeight: 800, color: CYAN, textAlign: 'center' }}
          >
            «من ۳۴ ساعت اضافه کاری داشتم، چرا حساب نشده؟»
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
            احساس بی‌عدالتی در دستمزد
          </div>
        </div>

        {/* Manager Side (x: 290..500) */}
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
              مدیر فروشگاه
            </span>
          </div>

          <div
            dir="rtl"
            style={{ fontSize: 15, fontWeight: 800, color: CRIMSON, textAlign: 'center' }}
          >
            «مگر وسط ماه مساعده نگرفتی؟ کجای سررسید نوشتم؟»
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
            دفترچه دستی خط‌خورده و گم‌شده
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
            کاهش انگیزه تیم و تنش اول ماه
          </div>
          <div
            style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}
          >
            وقتی تردد و مساعده روی کاغذ نوشته می‌شود، خطای انسانی حتمی است
          </div>
        </div>
      </div>
    </PayrollStage>
  )
}

// ─── Scene 2 — Optical Biometric Timesheet & Realtime Roster ────────────

export function BiometricTimesheetScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.4)
  const barP = ease(clamp(progress(t, 1.6, 3.4)))

  return (
    <PayrollStage scene={scene} t={t} label="// 02 · پرونده کارکرد و تردد پرسنل">
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
          <span style={{ color: CYAN, fontSize: 18 }}>⏱</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
            ثبت دیجیتال تردد و شیفت
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
          VERIFIED
        </span>
      </div>

      {/* Employee Dossier Cockpit (Safe Zone y: 240..560) */}
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
          boxShadow: `0 30px 80px rgba(0,0,0,0.9), 0 0 40px ${CYAN}22`,
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
            STAFF #204
          </span>
          <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            سرپرست فروشگاه · ماه جاری
          </span>
        </div>

        {/* Progress Fill Bar */}
        <div
          style={{
            width: '100%',
            height: 6,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${barP * 100}%`,
              background: `linear-gradient(90deg, ${CYAN}, ${EMERALD})`,
            }}
          />
        </div>

        {/* Roster Metrics */}
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
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>کارکرد موظف ماهانه:</span>
            <span style={{ ...MONO, color: CYAN, fontWeight: 900 }}>۲۲۰ ساعت</span>
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
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>اضافه کاری ثبت‌شده:</span>
            <span style={{ ...MONO, color: EMERALD, fontWeight: 900 }}>+ ۳۴ ساعت</span>
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
            <span style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>غیبت و کسر کار:</span>
            <span style={{ ...MONO, fontSize: 16, fontWeight: 900, color: EMERALD }}>
              ۰ ساعت (تایید کامل)
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
            ثبت ثانیه‌ای ساعت ورود و خروج
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
            بدون امکان دستکاری یا فراموشی در طول ماه
          </div>
        </div>
      </div>
    </PayrollStage>
  )
}

// ─── Scene 3 — Mid-Month Advances Auto-Deduction: Arithmetic Clarity ────

export function AdvanceDeductionScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.4)
  const p3 = pop(t, 2.6)
  const totalP = pop(t, 3.8)

  return (
    <PayrollStage scene={scene} t={t} label="// 03 · کسر خودکار مساعده و پاداش">
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
          محاسبه ریاضی شفاف
        </div>
        <div style={{ fontSize: 40, fontWeight: 900, color: EMERALD, marginTop: 4 }}>
          کسر سیستمی مساعده میان‌دوره
        </div>
      </div>

      {/* 3 Step Calculation Stack (Safe Zone y: 240..500) */}
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
        {/* Step 1: Base Salary */}
        <div
          dir="rtl"
          style={{
            background: 'linear-gradient(145deg, #121a28, #0a101c)',
            border: `1.5px solid ${CYAN}`,
            borderRadius: 16,
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: clamp(p1 * 1.5),
            transform: `translateY(${mix(20, 0, p1).toFixed(1)}px)`,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>حقوق پایه ماهانه:</span>
          <span style={{ ...MONO, fontSize: 20, fontWeight: 900, color: CYAN }}>
            {faNumber(35000000)}
          </span>
        </div>

        {/* Step 2: Overtime Bonus */}
        <div
          dir="rtl"
          style={{
            background: 'linear-gradient(145deg, #101c16, #09120e)',
            border: `1.5px solid ${EMERALD}`,
            borderRadius: 16,
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: clamp(p2 * 1.5),
            transform: `translateY(${mix(20, 0, p2).toFixed(1)}px)`,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
            دستمزد اضافه کاری (+۳۴ ساعت):
          </span>
          <span style={{ ...MONO, fontSize: 20, fontWeight: 900, color: EMERALD }}>
            + {faNumber(8500000)}
          </span>
        </div>

        {/* Step 3: Mid-Month Advance Deduction */}
        <div
          dir="rtl"
          style={{
            background: 'linear-gradient(145deg, #1a1216, #120a0e)',
            border: `1.5px solid ${CRIMSON}`,
            borderRadius: 16,
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: clamp(p3 * 1.5),
            transform: `translateY(${mix(20, 0, p3).toFixed(1)}px)`,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
            کسر مساعده دریافتی (۱۵ام ماه):
          </span>
          <span style={{ ...MONO, fontSize: 20, fontWeight: 900, color: CRIMSON }}>
            − {faNumber(12000000)}
          </span>
        </div>
      </div>

      {/* Payout Result Container (Safe Zone y: 530..720) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 530,
          left: 40,
          right: 40,
          background: 'linear-gradient(145deg, #0e1e18, #07120d)',
          border: `2px solid ${EMERALD}`,
          borderRadius: 24,
          padding: '20px 24px',
          boxShadow: `0 30px 80px rgba(0,0,0,0.9), 0 0 50px ${EMERALD}44`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          opacity: clamp(totalP * 1.5),
          transform: `scale(${mix(0.85, 1, totalP).toFixed(3)})`,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>
          خالص پرداختی پایان ماه:
        </div>
        <div
          style={{
            ...MONO,
            fontSize: 44,
            fontWeight: 900,
            color: EMERALD,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {faNumber(31500000)}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
          محاسبه دقیق ریاضی بدون ۱ ریال اختلاف
        </div>
      </div>
    </PayrollStage>
  )
}

// ─── Scene 4 — Instant Official Payslip & Double-Entry Ledger Stamp ─────

export function PayslipDoubleEntryScene({ t, scene }: { t: number; scene: Scene }) {
  const p = pop(t, 0.3)

  return (
    <PayrollStage scene={scene} t={t} label="// 04 · فیش حقوقی و سند حسابداری">
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
          فیش حقوقی رسمی + سند دوبل خودکار
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: CYAN, marginTop: 4 }}>
          همگام با دفتر کل و حساب بانکی
        </div>
      </div>

      {/* Official Payslip Cockpit (Safe Zone y: 230..540) */}
      <div
        style={{
          position: 'absolute',
          top: 230,
          left: 40,
          right: 40,
          height: 300,
          background: 'linear-gradient(145deg, #101626, #090e18)',
          border: `2px solid ${CYAN}`,
          borderRadius: 24,
          boxShadow: `0 30px 80px rgba(0,0,0,0.9), 0 0 45px ${CYAN}33`,
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
              background: `${CYAN}22`,
              color: CYAN,
              borderRadius: 6,
              padding: '3px 8px',
              fontWeight: 800,
            }}
          >
            OFFICIAL SLIP
          </span>
          <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            فیش حقوقی پرسنل #۲۰۴
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
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>جمع ناخالص حقوق:</span>
            <span style={{ ...MONO, color: '#ffffff' }}>{faNumber(43500000)}</span>
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
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>کسورات قانونی و مساعده:</span>
            <span style={{ ...MONO, color: CRIMSON }}>− {faNumber(12000000)}</span>
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
            <span style={{ color: EMERALD }}>خالص واریزی:</span>
            <span style={{ ...MONO, color: EMERALD }}>{faNumber(31500000)}</span>
          </div>
        </div>

        {/* Double-Entry Ledger Registration Stamp */}
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
          <div style={{ fontSize: 12, fontWeight: 800, color: '#ffffff' }}>
            سند دوبل هزینه حقوق خودکار ثبت شد
          </div>
          <span style={{ ...MONO, fontSize: 11, color: EMERALD, fontWeight: 800 }}>POSTED ✓</span>
        </div>
      </div>

      {/* Delivery via SMS / App (y: 570..680) */}
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
        فیش دیجیتال بلافاصله برای پرسنل پیامک می‌شود
      </div>
    </PayrollStage>
  )
}

// ─── Scene 5 — Workplace Harmony Manifesto: Respect & Trust ─────────────

export function WorkplaceHarmonyScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.2)
  const p3 = pop(t, 2.2)

  return (
    <PayrollStage scene={scene} t={t} label="// 05 · انضباط مالی و احترام تیم">
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
          حقوق شفاف…
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
          احترام متقابل…
        </div>

        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            color: '#08090f',
            background: `linear-gradient(135deg, ${EMERALD}, ${CYAN})`,
            padding: '12px 42px',
            borderRadius: 22,
            boxShadow: `0 20px 60px ${EMERALD}55`,
            opacity: clamp(p3 * 1.5),
            transform: `scale(${mix(0.8, 1, p3).toFixed(3)})`,
            textAlign: 'center',
          }}
        >
          پایان دعوای اول ماه!
        </div>
      </div>

      {/* Reassurance Seal (Safe Zone y: 600..710) */}
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
            تیم باانگیزه · تسویه بدون حتی یک ریال اختلاف
          </span>
        </div>
        <span style={{ ...MONO, fontSize: 12, color: CYAN, fontWeight: 800 }}>100% HARMONY</span>
      </div>
    </PayrollStage>
  )
}

// ─── Scene 6 — High-Impact Brand Monolith & CTA ─────────────────────────

export function PayrollCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const brandP = pop(t, 0.2)
  const btnP = pop(t, 1.2)

  return (
    <PayrollStage scene={scene} t={t} label="// 06 · شروع رایگان">
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
          ماژول هوشمند حقوق و دستمزد
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
            background: `linear-gradient(135deg, ${EMERALD}, #00b35c)`,
            color: '#08090f',
            fontSize: 40,
            fontWeight: 900,
            padding: '16px 64px',
            borderRadius: 24,
            boxShadow: `0 20px 60px ${EMERALD}66, 0 0 35px ${EMERALD}44`,
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
        ثبت‌نام سریع · بدون نیاز به نصب نرم‌افزار جانبی
      </div>
    </PayrollStage>
  )
}
