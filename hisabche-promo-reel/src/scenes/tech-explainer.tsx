// src/scenes/tech-explainer.tsx
// High-craft SaaS explainer scenes for Reel 100 with waist-up animated Avatar Rig and spacious visual hierarchy.

import React from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, mix, progress } from '../engine/anim'
import { VrmAvatar } from '../avatars/vrm-avatar'
import { cardFx, stagePunch, stageShake } from './card-motion'
import {
  ACTS_CTA,
  ACTS_LIVE_LINK,
  ACTS_MANUAL_INSPECTION,
  ACTS_MODULES,
  ACTS_TASK_CHAOS,
} from './tech-explainer-acts'
import { TechPipelineHeader, KineticWordBox } from '../ui/tech-pipeline'

// ─── Design Tokens ────────────────────────────────────────────────────────────

const BG_OBSIDIAN = '#07090e'
const RACK_BG = 'rgba(13, 17, 28, 0.94)'
const ACCENT_CYAN = '#38bdf8'
const ACCENT_EMERALD = '#10b981'
const ACCENT_AMBER = '#f59e0b'
const ACCENT_RED = '#ef4444'
const TEXT_MUTED = '#94a3b8'

// ─── Stage Shell with Virtual Camera ──────────────────────────────────────────

export function TechExplainerStage({
  scene,
  t,
  cameraX = 0,
  cameraY = 0,
  shakes,
  punches,
  children,
}: {
  scene: Scene
  t: number
  cameraX?: number
  cameraY?: number
  /** Seconds at which the whole page shakes (an alert). */
  shakes?: readonly number[]
  /** Seconds at which the whole page swells and settles (a result). */
  punches?: readonly number[]
  children: React.ReactNode
}) {
  void scene
  const shake = stageShake(t, shakes)
  const punch = stagePunch(t, punches)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        direction: 'ltr',
        background: BG_OBSIDIAN,
        overflow: 'hidden',
        color: '#ffffff',
        fontFamily: 'inherit',
      }}
    >
      {/* Background Lighting Gradients */}
      <div
        style={{
          position: 'absolute',
          inset: -40,
          backgroundImage:
            'radial-gradient(circle at 50% 18%, rgba(56, 189, 248, 0.14), transparent 60%), radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.09), transparent 70%)',
          transform: `translate(${(-cameraX * 0.2).toFixed(1)}px, ${(-cameraY * 0.2).toFixed(1)}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: -40,
          opacity: 0.05,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          transform: `translate(${(-cameraX * 0.35).toFixed(1)}px, ${(-cameraY * 0.35).toFixed(1)}px)`,
        }}
      />

      {/* Main Viewport */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${(-cameraX + shake.x).toFixed(1)}px, ${(-cameraY + shake.y).toFixed(1)}px) scale(${punch.toFixed(4)})`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ─── Scene 1 (0–8.2s): Task Micro-Disaster & Tired Hands-on-Head ───────────────

export function TechTaskChaosScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.8))
  const panic = clamp(progress(t, 1.8, 3.2))

  const camY = mix(0, -15, ease(panic))

  const rackSlots = [
    {
      title: 'واحد فروش',
      task: 'فاکتور #۱۰۴',
      status: 'توقف در صف',
      code: 'TASK_PENDING',
      tone: ACCENT_RED,
    },
    {
      title: 'حسابداری',
      task: 'سند تسویه #۲۸',
      status: 'بدون پاسخ',
      code: 'TIMEOUT_ERR',
      tone: '#f97316',
    },
    {
      title: 'انبارداری',
      task: 'حواله خروج #۸۳',
      status: 'بلاتکلیف',
      code: 'QUEUE_BLOCKED',
      tone: ACCENT_AMBER,
    },
    {
      title: 'پشتیبانی',
      task: 'تماس با مشتری',
      status: 'نامشخص',
      code: 'UNRESOLVED',
      tone: '#f43f5e',
    },
  ]

  const isExhausted = panic > 0.4

  return (
    <TechExplainerStage scene={scene} t={t} cameraY={camY} shakes={[0.2, 2.8]} punches={[2.8, 5.5]}>
      <TechPipelineHeader currentStep={1} deployCount="ارسال پراکنده تسک‌ها" />

      {/* Headline with Generous Spacing */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 80,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          opacity: enter,
          zIndex: 30,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            padding: '4px 14px',
            borderRadius: 999,
            background: 'rgba(239, 68, 68, 0.16)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            fontSize: 12,
            fontWeight: 800,
            marginBottom: 8,
          }}
        >
          🚨 معماری سنتی و دستی
        </span>
        <h2
          style={{ fontSize: 24, fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1.35 }}
        >
          خسته نشدی از ارسالِ <KineticWordBox color="#ef4444">تسک‌های کارکنان</KineticWordBox>؟
        </h2>
        <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 6 }}>
          در آخر هم نفهمیدی به چه مرحله‌ای رسیدن و نتیجه کار چی شد!
        </p>
      </div>

      {/* Central Server Rack Container (Spacious on Left, y=175 to y=490) */}
      <div
        style={{
          position: 'absolute',
          top: 175,
          left: 24,
          width: 250,
          padding: '14px 14px',
          borderRadius: 20,
          background: RACK_BG,
          border: '1.5px solid rgba(255, 255, 255, 0.14)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          zIndex: 20,
          opacity: enter,
          ...cardFx(t, { at: 0.2, enter: 'drop', float: 3, shakes: [0.2, 2.8], tremorFrom: 2.4 }),
        }}
      >
        <div
          dir="rtl"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 10,
            marginBottom: 10,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 900, color: '#f8fafc' }}>
              صف پردازش تسک‌ها
            </span>
            <div style={{ width: 7, height: 7, borderRadius: 3.5, background: ACCENT_RED }} />
          </div>
          <span style={{ fontSize: 9.5, color: '#ef4444', fontFamily: 'monospace' }}>
            {isExhausted ? 'CRITICAL_LAG' : 'QUEUED'}
          </span>
        </div>

        {/* 4 Rack Slots */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rackSlots.map((slot, i) => {
            return (
              <div
                key={slot.title}
                dir="rtl"
                style={{
                  padding: '8px 10px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${slot.tone}44`,
                  ...cardFx(t, {
                    at: 0.3,
                    i,
                    enter: 'flip',
                    shakes: [0.2, 2.8],
                    punches: [5.5],
                    tremorFrom: 2.4,
                  }),
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 900, color: '#f1f5f9' }}>
                    {slot.title}
                  </span>
                  <span style={{ fontSize: 9.5, color: slot.tone, fontWeight: 800 }}>
                    {slot.status}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>{slot.task}</div>
                <div
                  style={{
                    fontSize: 8.5,
                    color: '#64748b',
                    fontFamily: 'monospace',
                    padding: '2px 5px',
                    borderRadius: 4,
                    background: 'rgba(0,0,0,0.4)',
                    display: 'inline-block',
                  }}
                >
                  {slot.code}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Full-Body 3D Female VRM Avatar (girl.vrm) in Lower Screen (Half-Size) */}
      <VrmAvatar
        t={t}
        crop="full"
        x={180}
        y={560}
        width={180}
        height={380}
        acts={ACTS_TASK_CHAOS}
      />
    </TechExplainerStage>
  )
}

// ─── Scene 2 (8.2–15.3s): Manual Inspection Inquiries ─────────────────────────

export function TechManualInspectionScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.8))
  const scanIndex = Math.floor(t * 1.5) % 4

  const camX = mix(-15, 15, clamp(progress(t, 0.5, 5.5)))

  const checks = [
    { name: 'کارشناس فروش', detail: 'تماس با ۳۰ مشتری هدف', state: 'نامشخص', tone: ACCENT_AMBER },
    {
      name: 'صدور فاکتور',
      detail: 'بررسی تخفیف‌های بازرگانی',
      state: 'معطل امضا',
      tone: '#f97316',
    },
    { name: 'حواله انبار', detail: 'تطبیق موجودی قفسه B-04', state: 'بلاتکلیف', tone: ACCENT_RED },
    {
      name: 'واحد مالی',
      detail: 'وصول چک و مطالبات روز',
      state: 'در حال پیگیری',
      tone: ACCENT_EMERALD,
    },
  ]

  return (
    <TechExplainerStage scene={scene} t={t} cameraX={camX} shakes={[4.5]} punches={[2.2]}>
      <TechPipelineHeader currentStep={2} deployCount="پیگیری روزمره و اتلاف وقت" />

      {/* Headline */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 80,
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
          هر روز باید <KineticWordBox color="#f59e0b">تک‌تک بهشون سر بزنی</KineticWordBox>؟
        </h2>
        <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 6 }}>
          تا متوجه بشی آیا خواسته‌هات انجام شدن یا فقط زمان سوخته!
        </p>
      </div>

      {/* Terminal / Inspection Screen (Clean Left-Side Stack, y=175 to y=480) */}
      <div
        style={{
          position: 'absolute',
          top: 175,
          left: 24,
          width: 250,
          padding: '14px 14px',
          borderRadius: 20,
          background: RACK_BG,
          border: '1.5px solid rgba(255, 255, 255, 0.14)',
          boxShadow: '0 20px 48px rgba(0,0,0,0.6)',
          zIndex: 20,
          opacity: enter,
          ...cardFx(t, { at: 0.2, enter: 'from-left', float: 3, shakes: [4.5] }),
        }}
      >
        <div
          dir="rtl"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 8,
            marginBottom: 8,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 900, color: '#38bdf8' }}>
              کنسول نظارت دستی مدیر
            </span>
          </div>
          <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>
            SCANNING...
          </span>
        </div>

        {checks.map((chk, i) => {
          const isScanned = i === scanIndex
          return (
            <div
              key={chk.name}
              dir="rtl"
              style={{
                height: 42,
                marginBottom: 6,
                padding: '0 10px',
                borderRadius: 10,
                background: isScanned ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255,255,255,0.02)',
                border: isScanned ? '1.5px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#f8fafc' }}>{chk.name}</div>
                <div style={{ fontSize: 9, color: TEXT_MUTED }}>{chk.detail}</div>
              </div>
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: `${chk.tone}18`,
                  color: chk.tone,
                  fontSize: 9.5,
                  fontWeight: 800,
                  border: `1px solid ${chk.tone}44`,
                }}
              >
                {chk.state}
              </span>
            </div>
          )
        })}
      </div>

      {/* Full-Body 3D Female VRM Avatar in Lower Screen (Half-Size) */}
      <VrmAvatar
        t={t}
        crop="full"
        x={180}
        y={560}
        width={180}
        height={380}
        acts={ACTS_MANUAL_INSPECTION}
      />
    </TechExplainerStage>
  )
}

// ─── Scene 3 (15.3–27.3s): Dedicated Live Link Architecture ───────────────────

export function TechLiveLinkScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.8))

  const feedEvents = [
    { hash: 'ev_90a', title: 'تماس موفق با مشتری VIP', tag: 'CALL_RESOLVED', tone: ACCENT_EMERALD },
    { hash: 'ev_42c', title: 'صدور پیش‌فاکتور رسمی', tag: 'INVOICE_CREATED', tone: ACCENT_CYAN },
    {
      hash: 'ev_18b',
      title: 'تأیید سفارش و حواله کالا',
      tag: 'ORDER_COMMITTED',
      tone: ACCENT_AMBER,
    },
  ]

  return (
    <TechExplainerStage scene={scene} t={t} punches={[2.5, 9.0]}>
      <TechPipelineHeader currentStep={3} deployCount="اتصال زنده لینک سازمان" />

      {/* Headline */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 80,
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
          اشتراکِ <KineticWordBox color="#38bdf8">یک لینک اختصاصی</KineticWordBox> با اعضای سازمان
        </h2>
        <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 6 }}>
          رصد تمامی فعالیت‌ها: نتیجه تماس، ثبت سفارش و پیش‌فاکتور
        </p>
      </div>

      {/* URL Link Bar (y=175 to y=227) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 175,
          left: 36,
          right: 36,
          height: 50,
          padding: '0 16px',
          borderRadius: 25,
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1.5px solid #38bdf8',
          boxShadow: '0 8px 30px rgba(56, 189, 248, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 25,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#38bdf8', fontSize: 16 }}>⚡</span>
          <span
            style={{ fontSize: 13, fontWeight: 800, color: '#f0f9ff', fontFamily: 'monospace' }}
          >
            https://hisabche.com/org/live-stream
          </span>
        </div>
        <span
          style={{
            padding: '3px 10px',
            borderRadius: 6,
            background: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid #10b981',
            color: '#34d399',
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          LIVE ✓
        </span>
      </div>

      {/* Live Stream Events Stack (Left Side, y=240 to y=440) */}
      <div
        style={{
          position: 'absolute',
          top: 240,
          left: 36,
          width: 285,
          zIndex: 20,
        }}
      >
        {feedEvents.map((ev, i) => {
          return (
            <div
              key={ev.hash}
              dir="rtl"
              style={{
                marginBottom: 10,
                padding: '12px 14px',
                borderRadius: 14,
                background: RACK_BG,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 10px 24px rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                ...cardFx(t, {
                  at: 0.4,
                  i,
                  enter: 'from-right',
                  float: 4,
                  punches: [5.0 + i * 0.7],
                }),
              }}
            >
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#f8fafc' }}>{ev.title}</div>
                <div
                  style={{
                    fontSize: 9.5,
                    color: ev.tone,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    marginTop: 3,
                  }}
                >
                  {ev.tag}
                </div>
              </div>
              <span
                style={{
                  fontSize: 9.5,
                  fontFamily: 'monospace',
                  color: '#94a3b8',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.06)',
                }}
              >
                {ev.hash}
              </span>
            </div>
          )
        })}
      </div>

      {/* Full-Body 3D Female VRM Avatar in Lower Screen (Half-Size) */}
      <VrmAvatar t={t} crop="full" x={180} y={560} width={180} height={380} acts={ACTS_LIVE_LINK} />
    </TechExplainerStage>
  )
}

// ─── Scene 4 (27.3–37.4s): 6 Modular Cloud Capabilities ───────────────────────

export function TechModuleScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.8))

  const modules = [
    { title: 'تماس‌ها', desc: 'CRM و صوت مذاکره', icon: '📞', tone: ACCENT_CYAN },
    { title: 'انبارداری', desc: 'موجودی بلادرنگ', icon: '📦', tone: ACCENT_AMBER },
    { title: 'فاکتورها', desc: 'صدور و ارسال آنلاین', icon: '📄', tone: '#a855f7' },
    { title: 'سفارشات', desc: 'رصد گام‌به‌گام بار', icon: '🛒', tone: '#f43f5e' },
    { title: 'مشتریان', desc: 'پرونده اعتباری', icon: '👥', tone: ACCENT_EMERALD },
    { title: 'گزارشات', desc: 'تراز سود و نقدینگی', icon: '📊', tone: '#06b6d4' },
  ]

  return (
    <TechExplainerStage scene={scene} t={t} punches={[3.0, 7.5]}>
      <TechPipelineHeader currentStep={4} deployCount="۶ ماژول یکپارچه سازمان" />

      {/* Headline */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 80,
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
          مدیریت یکپارچه در <KineticWordBox color="#10b981">۶ ماژول ابری</KineticWordBox>
        </h2>
        <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 6 }}>
          فاکتورها، انبار، تماس‌ها و سفارشات لحظه‌ای رصد می‌شوند
        </p>
      </div>

      {/* 2-Column Grid Centered (y=165 to y=430) */}
      <div
        style={{
          position: 'absolute',
          top: 165,
          left: 36,
          right: 36,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 8,
          zIndex: 20,
        }}
      >
        {modules.map((m, i) => {
          return (
            <div
              key={m.title}
              dir="rtl"
              style={{
                height: 72,
                padding: '8px 10px',
                borderRadius: 12,
                background: RACK_BG,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 18px rgba(0,0,0,0.4)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                ...cardFx(t, {
                  at: 0.2,
                  i,
                  enter: i % 2 === 0 ? 'from-left' : 'flip',
                  float: 4,
                  punches: [3.0 + i * 0.25],
                }),
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: `${m.tone}22`,
                    color: m.tone,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    border: `1px solid ${m.tone}44`,
                  }}
                >
                  {m.icon}
                </div>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#ffffff' }}>{m.title}</div>
              </div>
              <div style={{ fontSize: 9.5, color: TEXT_MUTED }}>{m.desc}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div
                  style={{ width: 5, height: 5, borderRadius: 2.5, background: ACCENT_EMERALD }}
                />
                <span style={{ fontSize: 8.5, fontWeight: 700, color: ACCENT_EMERALD }}>متصل</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Full-Body 3D Female VRM Avatar in Lower Screen (Half-Size) */}
      <VrmAvatar t={t} crop="full" x={180} y={560} width={180} height={380} acts={ACTS_MODULES} />
    </TechExplainerStage>
  )
}

// ─── Scene 5 (37.4–44.72s): VIP CTA ──────────────────────────────────────────

export function TechCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.8))

  return (
    <TechExplainerStage scene={scene} t={t} punches={[2.2, 5.0]}>
      <TechPipelineHeader currentStep={5} deployCount="فعالسازی حساب کاربری تست" />

      {/* Headline */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 80,
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
          دریافت فوری <KineticWordBox color="#f59e0b">اکانت تست رایگان</KineticWordBox>
        </h2>
        <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 6 }}>
          کلمه <span style={{ color: '#38bdf8', fontWeight: 900 }}>«حسابچه»</span> را دایرکت ارسال
          کن!
        </p>
      </div>

      {/* Message Chat Pill (Centered, y=168 to y=214) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 168,
          left: 40,
          right: 40,
          height: 46,
          padding: '0 16px',
          borderRadius: 23,
          background: 'rgba(255,255,255,0.06)',
          border: '1.5px solid rgba(56, 189, 248, 0.6)',
          boxShadow: '0 0 24px rgba(56, 189, 248, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 25,
          ...cardFx(t, { at: 0.2, enter: 'drop', float: 2 }),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>💬</span>
          <span style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>حسابچه</span>
        </div>
        <div
          style={{
            padding: '4px 12px',
            borderRadius: 8,
            background: '#0284c7',
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          ارسال فوری 🚀
        </div>
      </div>

      {/* VIP Access Unlock Card (Centered, y=228 to y=455) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 228,
          left: 40,
          right: 40,
          padding: '20px 18px',
          borderRadius: 20,
          background: 'linear-gradient(145deg, rgba(20, 27, 45, 0.96), rgba(12, 17, 30, 0.98))',
          border: '2px solid rgba(245, 158, 11, 0.6)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 35px rgba(245, 158, 11, 0.25)',
          textAlign: 'center',
          zIndex: 20,
          ...cardFx(t, { at: 0.4, enter: 'flip', float: 3, punches: [2.2, 5.0] }),
        }}
      >
        <div style={{ fontSize: 26, marginBottom: 4 }}>🔑</div>
        <h3 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 6px', color: '#fde68a' }}>
          حساب تست VIP با تمامی ماژول‌ها
        </h3>
        <p style={{ fontSize: 11, color: TEXT_MUTED, margin: '0 0 12px', lineHeight: 1.45 }}>
          دسترسی آنی به داشبورد نظارت، فاکتورها، CRM و نسخه آنلاین/آفلاین
        </p>
        <div
          style={{
            display: 'inline-block',
            padding: '6px 18px',
            borderRadius: 8,
            background: 'linear-gradient(90deg, #f59e0b, #d97706)',
            color: '#000000',
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 0.5,
          }}
        >
          ورود رایگان به حسابچه
        </div>
      </div>

      {/* Full-Body 3D Female VRM Avatar in Lower Screen (Half-Size) */}
      <VrmAvatar t={t} crop="full" x={180} y={560} width={180} height={380} acts={ACTS_CTA} />
    </TechExplainerStage>
  )
}
