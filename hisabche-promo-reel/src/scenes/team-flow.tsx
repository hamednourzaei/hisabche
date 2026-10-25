// src/scenes/team-flow.tsx
// Bespoke art direction for Reel 99 — «لینک هوشمند سازمان» (live team & activity tracker)
// Refactored to world-class SaaS motion standard matching test.mp4 reference:
// - Modern tech presenter avatar (neutral, pointing, shrug) from top-tier SaaS explainer.
// - High-tech pipeline stepper header (Steps 1–5).
// - Kinetic word-emphasis boxes with anchor handles.
// - Container-local mockups with overflow: hidden.
// - Absolute zero camera zoom (noZoom: true).

import React, { type CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, mix, progress, spring } from '../engine/anim'
import { TechPresenterAvatar } from '../ui/tech-avatar'
import { TechPipelineHeader, KineticWordBox } from '../ui/tech-pipeline'

// ─── Design Tokens ────────────────────────────────────────────────────────────

export const BG_DARK = '#090d16'
export const CARD_BG = 'rgba(18, 24, 38, 0.88)'
export const CARD_BORDER = 'rgba(255, 255, 255, 0.1)'
export const ACCENT_BLUE = '#0284c7'
export const ACCENT_CYAN = '#06b6d4'
export const ACCENT_EMERALD = '#10b981'
export const ACCENT_AMBER = '#f59e0b'
export const ACCENT_RED = '#ef4444'
export const TEXT_PRIMARY = '#f8fafc'
export const TEXT_MUTED = '#94a3b8'

const AMBIENT_WASH: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(650px 450px at 50% 12%, rgba(2, 132, 199, 0.16), transparent 70%), radial-gradient(700px 500px at 80% 85%, rgba(16, 185, 129, 0.09), transparent 75%)',
}

const VIGNETTE_OVERLAY: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(120% 90% at 50% 45%, transparent 50%, rgba(5, 7, 12, 0.94) 100%)',
}

function pop(t: number, at: number, dur = 0.5): number {
  return spring(clamp(progress(t, at, at + dur)))
}

// ─── Root Stage ───────────────────────────────────────────────────────────────

export function TeamFlowStage({
  scene,
  t,
  children,
}: {
  scene: Scene
  t: number
  children: React.ReactNode
}) {
  void scene
  void t
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        direction: 'ltr',
        background: BG_DARK,
        overflow: 'hidden',
        color: TEXT_PRIMARY,
        fontFamily: 'inherit',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={AMBIENT_WASH} />
        {/* Subtle mesh grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.04,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />
        <div style={VIGNETTE_OVERLAY} />
      </div>
      {children}
    </div>
  )
}

// ─── Scene 1 (0–8.2s): Task Chaos & Frustration ───────────────────────────────

export function TaskChaosScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.9))
  const panic = clamp(progress(t, 1.8, 3.2))
  const borderPulse = panic > 0 ? Math.sin(t * 8) * 0.4 + 0.6 : 0

  const employees = [
    { name: 'علی (فروش)', x: 44, y: 310, task: 'بررسی فاکتور' },
    { name: 'سارا (حسابداری)', x: 386, y: 310, task: 'پیگیری تسویه' },
    { name: 'رضا (انبار)', x: 44, y: 470, task: 'موجودی قفسه' },
    { name: 'مینا (پشتیبانی)', x: 386, y: 470, task: 'تماس با مشتری' },
  ]

  return (
    <TeamFlowStage scene={scene} t={t}>
      {/* High-Tech Pipeline Stepper Header */}
      <TechPipelineHeader currentStep={1} deployCount="ارسال تسک‌های تیم" />

      {/* Alert border on chaos */}
      {panic > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            border: `3px solid rgba(239, 68, 68, ${borderPulse.toFixed(2)})`,
            boxShadow: `inset 0 0 40px rgba(239, 68, 68, ${(borderPulse * 0.35).toFixed(2)})`,
            pointerEvents: 'none',
            zIndex: 50,
          }}
        />
      )}

      {/* Top Header */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 76,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          opacity: enter,
          transform: `translateY(${mix(-20, 0, enter).toFixed(1)}px)`,
          zIndex: 30,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            padding: '4px 14px',
            borderRadius: 999,
            background: 'rgba(239, 68, 68, 0.18)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            fontSize: 13,
            fontWeight: 800,
            marginBottom: 10,
          }}
        >
          🚨 چالش روزمره مدیران
        </span>
        <h2
          style={{ fontSize: 25, fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1.35 }}
        >
          خسته نشدی از ارسالِ <KineticWordBox color="#ef4444">تسک‌های تکی</KineticWordBox>؟
        </h2>
        <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 6 }}>
          در آخر هم معلوم نیست هر کارمند به چه مرحله‌ای رسید!
        </p>
      </div>

      {/* Surrounding Staff Chips & Flying Task Packets */}
      {employees.map((emp, i) => {
        const empPop = pop(t, 0.4 + i * 0.2)
        const sendProgress = clamp(progress(t, 0.8 + i * 0.3, 1.8 + i * 0.3))
        // Task flying from center (270, 410) to employee node
        const taskX = mix(270, emp.x + 55, ease(sendProgress))
        const taskY = mix(410, emp.y + 20, ease(sendProgress))

        return (
          <React.Fragment key={emp.name}>
            {/* Flying Task Card */}
            {sendProgress < 1 && (
              <div
                dir="rtl"
                style={{
                  position: 'absolute',
                  left: taskX - 50,
                  top: taskY - 14,
                  width: 100,
                  padding: '4px 8px',
                  borderRadius: 8,
                  background: 'rgba(2, 132, 199, 0.85)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 800,
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  zIndex: 25,
                }}
              >
                📩 {emp.task}
              </div>
            )}

            {/* Employee Node */}
            <div
              dir="rtl"
              style={{
                position: 'absolute',
                left: emp.x,
                top: emp.y,
                width: 110,
                padding: '10px 8px',
                borderRadius: 14,
                background: CARD_BG,
                border: `1px solid ${panic > 0.5 ? 'rgba(239,68,68,0.5)' : CARD_BORDER}`,
                textAlign: 'center',
                boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                transform: `scale(${empPop.toFixed(3)})`,
                zIndex: 15,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                  margin: '0 auto 6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                👤
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#f1f5f9' }}>{emp.name}</div>

              {/* Red Question Mark when Panic */}
              {panic > 0.3 && (
                <div
                  style={{
                    position: 'absolute',
                    top: -12,
                    right: -10,
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    background: ACCENT_RED,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    fontWeight: 900,
                    boxShadow: '0 0 12px rgba(239, 68, 68, 0.8)',
                    transform: `scale(${pop(t, 2.0 + i * 0.15).toFixed(2)}) rotate(${Math.sin(t * 12 + i) * 8}deg)`,
                  }}
                >
                  ؟
                </div>
              )}
            </div>
          </React.Fragment>
        )
      })}

      {/* Progress Bar Stuck at 99% */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 270,
          left: 50,
          right: 50,
          padding: '12px 18px',
          borderRadius: 16,
          background: 'rgba(15, 20, 30, 0.92)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          opacity: panic,
          transform: `translateY(${mix(20, 0, panic).toFixed(1)}px)`,
          zIndex: 30,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 8,
            fontSize: 13,
          }}
        >
          <span style={{ fontWeight: 800, color: '#fca5a5' }}>وضعیت تسک‌های سازمان:</span>
          <span style={{ fontWeight: 900, color: ACCENT_RED }}>۹۹٪ گیر کرده و نامعلوم</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: '#1e293b', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: '99%',
              borderRadius: 4,
              background: 'linear-gradient(90deg, #ef4444, #f87171)',
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
            }}
          />
        </div>
      </div>

      {/* Anchored World-Class SaaS Presenter Avatar (Shrug pose when panic) */}
      <div
        style={{
          position: 'absolute',
          bottom: -10,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
          opacity: enter,
        }}
      >
        <TechPresenterAvatar t={t} pose={panic > 0.4 ? 'shrug' : 'neutral'} scale={0.92} />
      </div>
    </TeamFlowStage>
  )
}

// ─── Scene 2 (8.2–15.3s): Manual Grid Inspection & Anxiety ────────────────────

export function ManualInspectionScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.8))
  const scanIndex = Math.floor(t * 1.5) % 4
  const clockCycle = Math.floor(t * 3)

  const rows = [
    { name: 'علی محمدی', role: 'تیم فروش', status: 'در حال انجام', tone: ACCENT_AMBER, mark: '⏳' },
    {
      name: 'سارا احمدی',
      role: 'در انتظار بررسی',
      status: 'معطل بازبینی',
      tone: '#f97316',
      mark: '⚠️',
    },
    { name: 'رضا تقوی', role: 'پشتیبانی', status: 'تسک تأخیر دارد', tone: ACCENT_RED, mark: '🚨' },
    { name: 'مینا کریمی', role: 'انبارداری', status: 'تکمیل شده', tone: ACCENT_EMERALD, mark: '✓' },
  ]

  const calendarDays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه']

  return (
    <TeamFlowStage scene={scene} t={t}>
      {/* High-Tech Pipeline Stepper Header */}
      <TechPipelineHeader currentStep={2} deployCount="پیگیری فرسایشی دستی" />

      {/* Top Headline */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 74,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          opacity: enter,
          zIndex: 30,
        }}
      >
        <h2
          style={{ fontSize: 24, fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1.35 }}
        >
          هر روز باید <KineticWordBox color="#f59e0b">تک‌تک</KineticWordBox> بهشون سر بزنی؟
        </h2>
        <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 6 }}>
          آیا تمام خواسته‌هات انجام شدن یا زمان داره می‌سوزه؟
        </p>
      </div>

      {/* Monitor Mockup Box (Defect Law: container-local + overflow hidden) */}
      <div
        style={{
          position: 'absolute',
          top: 154,
          left: 40,
          width: 460,
          height: 400,
          borderRadius: 24,
          background: 'rgba(15, 20, 32, 0.94)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          boxShadow: '0 20px 48px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          zIndex: 20,
          opacity: enter,
          transform: `scale(${pop(t, 0.15).toFixed(3)})`,
        }}
      >
        {/* Window Chrome Bar */}
        <div
          dir="rtl"
          style={{
            height: 42,
            padding: '0 16px',
            background: 'rgba(255, 255, 255, 0.04)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 5, background: '#ef4444' }} />
            <div style={{ width: 10, height: 10, borderRadius: 5, background: '#f59e0b' }} />
            <div style={{ width: 10, height: 10, borderRadius: 5, background: '#10b981' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8' }}>
            جدول پیگیری وضعیت کارکنان
          </span>
        </div>

        {/* 4 Staff Status Rows */}
        <div style={{ padding: '12px 14px' }}>
          {rows.map((row, idx) => {
            const isScanned = idx === scanIndex
            return (
              <div
                key={row.name}
                dir="rtl"
                style={{
                  height: 58,
                  marginBottom: 8,
                  padding: '8px 14px',
                  borderRadius: 14,
                  background: isScanned ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  border: isScanned ? '1.5px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: isScanned ? '0 0 16px rgba(245, 158, 11, 0.25)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      background: 'rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                    }}
                  >
                    👤
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
                      {row.name}
                    </div>
                    <div style={{ fontSize: 10, color: TEXT_MUTED }}>{row.role}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: `${row.tone}22`,
                      color: row.tone,
                      fontSize: 12,
                      fontWeight: 800,
                      border: `1px solid ${row.tone}55`,
                    }}
                  >
                    {row.mark} {row.status}
                  </span>
                  {isScanned && <span style={{ fontSize: 18, transform: 'scale(1.2)' }}>🔍</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Floating Hourglass & Calendar Flips */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 240,
          left: 48,
          right: 48,
          padding: '10px 16px',
          borderRadius: 16,
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{ fontSize: 20, display: 'inline-block', transform: `rotate(${t * 60}deg)` }}
          >
            ⏳
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#fcd34d' }}>
            اتلاف زمان مدیر در روز:
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: TEXT_MUTED }}>ورق خوردن تقویم:</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 6,
              background: '#ef4444',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 900,
            }}
          >
            {calendarDays[clockCycle % calendarDays.length]}
          </span>
        </div>
      </div>

      {/* Anchored World-Class SaaS Presenter Avatar */}
      <div
        style={{
          position: 'absolute',
          bottom: -10,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
          opacity: enter,
        }}
      >
        <TechPresenterAvatar t={t} pose="neutral" scale={0.88} />
      </div>
    </TeamFlowStage>
  )
}

// ─── Scene 3 (15.3–27.3s): Live Link Solution & Mobile Dashboard ──────────────

export function LiveLinkSolutionScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.8))
  const linkCopied = t >= 1.5
  const callPop = pop(t, 2.8)

  const feedItems = [
    {
      time: '۱۰:۲۴',
      title: 'تماس با مشتری',
      desc: 'مذاکره موفق — سفارش ثبت شد',
      tone: ACCENT_EMERALD,
      icon: '📞',
    },
    {
      time: '۰۹:۴۸',
      title: 'ثبت فاکتور',
      desc: 'تأیید نهایی و ارسال به مشتری',
      tone: ACCENT_CYAN,
      icon: '📄',
    },
    {
      time: '۰۹:۱۲',
      title: 'پیگیری سفارش',
      desc: 'بسته‌بندی و ارسال به انبار',
      tone: ACCENT_BLUE,
      icon: '📦',
    },
    {
      time: '۰۸:۳۷',
      title: 'مکالمه تلفنی',
      desc: 'هماهنگی پرداخت شرکت الف',
      tone: ACCENT_EMERALD,
      icon: '✓',
    },
  ]

  return (
    <TeamFlowStage scene={scene} t={t}>
      {/* High-Tech Pipeline Stepper Header */}
      <TechPipelineHeader currentStep={3} deployCount="اتصال زنده لینک سازمان" />

      {/* Top Header */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 74,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          opacity: enter,
          zIndex: 30,
        }}
      >
        <h2
          style={{ fontSize: 24, fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1.35 }}
        >
          اشتراکِ <KineticWordBox color="#06b6d4">یک لینک اختصاصی</KineticWordBox> با تیم
        </h2>
        <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 6 }}>
          نتیجه تماس‌ها، ثبت سفارش و پیش‌فاکتور در یک داشبورد زنده
        </p>
      </div>

      {/* Share Link Bar */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 148,
          left: 40,
          right: 40,
          height: 48,
          padding: '0 16px',
          borderRadius: 24,
          background: 'rgba(15, 23, 42, 0.94)',
          border: '1.5px solid #0284c7',
          boxShadow: '0 8px 30px rgba(2, 132, 199, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 25,
          opacity: enter,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🔗</span>
          <span
            style={{ fontSize: 12, fontWeight: 800, color: '#e0f2fe', fontFamily: 'monospace' }}
          >
            hisabche.com/org/live-feed
          </span>
        </div>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 8,
            background: linkCopied ? ACCENT_EMERALD : ACCENT_BLUE,
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          {linkCopied ? 'متصل شد ✓' : 'لینک سازمان'}
        </span>
      </div>

      {/* Hero Phone Mockup (Container-local coordinates, overflow: hidden) */}
      <div
        style={{
          position: 'absolute',
          top: 206,
          left: 36,
          width: 270,
          height: 480,
          borderRadius: 36,
          background: '#090d16',
          border: '3px solid rgba(255, 255, 255, 0.22)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 30px rgba(2, 132, 199, 0.25)',
          overflow: 'hidden',
          zIndex: 20,
          opacity: enter,
          transform: `scale(${pop(t, 0.3).toFixed(3)})`,
        }}
      >
        {/* Notch */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 80,
            height: 16,
            background: '#000000',
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
            zIndex: 40,
          }}
        />

        {/* In-Phone Header */}
        <div
          dir="rtl"
          style={{
            height: 60,
            paddingTop: 20,
            paddingLeft: 12,
            paddingRight: 12,
            background: 'linear-gradient(180deg, #1e293b, #0f172a)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: '#ffffff' }}>
              فعالیت‌های زنده تیم
            </span>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: ACCENT_EMERALD }} />
          </div>
          <span style={{ fontSize: 10, color: TEXT_MUTED }}>امروز</span>
        </div>

        {/* Live Activity Feed */}
        <div style={{ padding: 8 }}>
          {feedItems.map((item, i) => {
            const itemEnter = pop(t, 0.5 + i * 0.2)
            return (
              <div
                key={item.title}
                dir="rtl"
                style={{
                  height: 56,
                  marginBottom: 6,
                  padding: '6px 8px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transform: `scale(${itemEnter.toFixed(3)})`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      background: `${item.tone}22`,
                      color: item.tone,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#f8fafc' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 9, color: TEXT_MUTED }}>{item.desc}</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{item.time}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Floating Call Outcome Card beside phone */}
      {t >= 2.5 && (
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 250,
            right: 28,
            width: 190,
            padding: '12px 14px',
            borderRadius: 18,
            background: 'rgba(15, 23, 42, 0.96)',
            border: '1.5px solid #10b981',
            boxShadow: '0 12px 30px rgba(0,0,0,0.6), 0 0 20px rgba(16, 185, 129, 0.3)',
            zIndex: 35,
            transform: `scale(${callPop.toFixed(3)})`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>📞</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: '#10b981' }}>
              نتیجه تماس: موفق
            </span>
          </div>
          <p style={{ fontSize: 11, color: '#e2e8f0', margin: 0, lineHeight: 1.4 }}>
            مشتری پیگیری شد و سفارش به ارزش قطعی ثبت گردید. ✅
          </p>
        </div>
      )}

      {/* Anchored World-Class SaaS Presenter Avatar (Pointing up to live phone dashboard) */}
      <div
        style={{
          position: 'absolute',
          bottom: -10,
          right: 30,
          zIndex: 40,
          opacity: enter,
        }}
      >
        <TechPresenterAvatar t={t} pose="pointing" scale={0.94} />
      </div>
    </TeamFlowStage>
  )
}

// ─── Scene 4 (27.3–37.4s): 6 Modular Capabilities ─────────────────────────────

export function ModuleShowcaseScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.8))

  const modules = [
    { name: 'تماس‌ها', desc: 'رصد صوت و نتیجه مکالمه', icon: '📞', tone: ACCENT_CYAN },
    { name: 'مشتریان', desc: 'پرونده و سابقه خرید', icon: '👥', tone: ACCENT_BLUE },
    { name: 'فاکتورها', desc: 'صدور و دریافت آنی', icon: '📄', tone: '#a855f7' },
    { name: 'انبارداری', desc: 'موجودی لحظه‌ای قفسه‌ها', icon: '📦', tone: ACCENT_AMBER },
    { name: 'سفارشات', desc: 'پیگیری خط ارسال کالا', icon: '🛒', tone: '#f43f5e' },
    { name: 'گزارش‌ها', desc: 'سود واقعی و تراز مالی', icon: '📊', tone: ACCENT_EMERALD },
  ]

  return (
    <TeamFlowStage scene={scene} t={t}>
      {/* High-Tech Pipeline Stepper Header */}
      <TechPipelineHeader currentStep={4} deployCount="۶ ماژول یکپارچه سازمان" />

      {/* Top Header */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 74,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          opacity: enter,
          zIndex: 30,
        }}
      >
        <h2
          style={{ fontSize: 24, fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1.35 }}
        >
          مدیریت یکپارچه در <KineticWordBox color="#10b981">۶ ماژول زنده</KineticWordBox>
        </h2>
        <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 6 }}>
          فاکتورها، انبار، تماس‌ها و سفارشات زیر انگشتان شما
        </p>
      </div>

      {/* 2x3 Grid of Module Cards */}
      <div
        style={{
          position: 'absolute',
          top: 154,
          left: 36,
          right: 36,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          zIndex: 20,
        }}
      >
        {modules.map((mod, i) => {
          const modPop = pop(t, 0.2 + i * 0.16)
          return (
            <div
              key={mod.name}
              dir="rtl"
              style={{
                height: 100,
                padding: '12px 10px',
                borderRadius: 16,
                background: 'rgba(15, 23, 42, 0.88)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transform: `scale(${modPop.toFixed(3)})`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: `${mod.tone}22`,
                    color: mod.tone,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    border: `1px solid ${mod.tone}44`,
                  }}
                >
                  {mod.icon}
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>{mod.name}</div>
              </div>
              <div style={{ fontSize: 10, color: TEXT_MUTED }}>{mod.desc}</div>
              {/* Green indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: ACCENT_EMERALD }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: ACCENT_EMERALD }}>
                  به‌روز و متصل
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom Checklist Banner */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 240,
          left: 40,
          right: 40,
          padding: '10px 16px',
          borderRadius: 16,
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          display: 'flex',
          justifyContent: 'space-around',
          zIndex: 25,
          opacity: clamp(progress(t, 1.8, 2.5)),
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, color: '#34d399' }}>
          کارها در جریان است ✓
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#34d399' }}>تماس‌ها پیگیری شد ✓</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#34d399' }}>انبار به‌روز است ✓</span>
      </div>

      {/* Anchored World-Class SaaS Presenter Avatar */}
      <div
        style={{
          position: 'absolute',
          bottom: -10,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
          opacity: enter,
        }}
      >
        <TechPresenterAvatar t={t} pose="pointing" scale={0.92} />
      </div>
    </TeamFlowStage>
  )
}

// ─── Scene 5 (37.4–44.72s): CTA & Instant Test Account Reveal ────────────────

export function OrgCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.8))
  const giftPop = pop(t, 1.2)

  return (
    <TeamFlowStage scene={scene} t={t}>
      {/* High-Tech Pipeline Stepper Header */}
      <TechPipelineHeader currentStep={5} deployCount="اکانت تست رایگان VIP" />

      {/* Top Header */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 76,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          opacity: enter,
          zIndex: 30,
        }}
      >
        <h2
          style={{ fontSize: 26, fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1.35 }}
        >
          دریافت <KineticWordBox color="#f59e0b">اکانت تست رایگان</KineticWordBox>
        </h2>
        <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 6 }}>
          همین حالا کلمه <span style={{ color: '#38bdf8', fontWeight: 900 }}>«حسابچه»</span> رو
          ارسال کن!
        </p>
      </div>

      {/* Instagram Message Box Mockup */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 170,
          left: 50,
          right: 50,
          height: 52,
          padding: '0 14px',
          borderRadius: 26,
          background: 'rgba(255,255,255,0.06)',
          border: '1.5px solid rgba(56, 189, 248, 0.5)',
          boxShadow: '0 0 24px rgba(6, 182, 212, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 25,
          opacity: enter,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>💬</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>حسابچه</span>
        </div>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            background: ACCENT_BLUE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            color: '#ffffff',
          }}
        >
          🚀
        </div>
      </div>

      {/* Golden VIP Account Reveal Card */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 240,
          left: 44,
          right: 44,
          padding: '20px 18px',
          borderRadius: 22,
          background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))',
          border: '2px solid rgba(245, 158, 11, 0.6)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 35px rgba(245, 158, 11, 0.25)',
          textAlign: 'center',
          zIndex: 20,
          transform: `scale(${giftPop.toFixed(3)})`,
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 6 }}>🎁</div>
        <h3 style={{ fontSize: 19, fontWeight: 900, margin: '0 0 4px', color: '#fde68a' }}>
          اکانت تست فعال شد
        </h3>
        <p style={{ fontSize: 12, color: TEXT_MUTED, margin: '0 0 14px', lineHeight: 1.5 }}>
          دسترسی کامل به سامانه مدیریت سازمان و اپلیکیشن آنلاین/آفلاین
        </p>
        <div
          style={{
            display: 'inline-block',
            padding: '7px 20px',
            borderRadius: 10,
            background: 'linear-gradient(90deg, #f59e0b, #d97706)',
            color: '#000000',
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          شروع رایگان در hisabche.com
        </div>
      </div>

      {/* Anchored World-Class SaaS Presenter Avatar */}
      <div
        style={{
          position: 'absolute',
          bottom: -10,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
          opacity: enter,
        }}
      >
        <TechPresenterAvatar t={t} pose="neutral" scale={0.92} />
      </div>
    </TeamFlowStage>
  )
}
