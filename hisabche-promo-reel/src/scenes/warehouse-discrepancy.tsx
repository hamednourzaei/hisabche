// src/scenes/warehouse-discrepancy.tsx
// Dedicated Scene System for Reel 103 — «انبارگردانی ابری و مغایرت قفسه‌ها»
// Style: Kinetic Cyber-Emerald Matrix & Industrial Terminal
// Palette: Cyber Emerald #00ff88 + Titanium Dark #0b0f14 + Amber Laser #f59e0b + Alert Red #ef4444
// NO 3D Avatar — Pure High-Velocity Barcode Laser & Warehouse Inventory Logistics

import React from 'react'
import type { Scene } from '../engine/types'
import { clamp, progress } from '../engine/anim'
import { cardFx, stagePunch, stageShake } from './card-motion'
import { TechPipelineHeader, KineticWordBox } from '../ui/tech-pipeline'

const TEXT_MUTED = '#94a3b8'

/** Stage container for Reel 103 */
export function WarehouseStage({
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
        position: 'absolute',
        inset: 0,
        direction: 'ltr',
        background: '#070b0f',
        overflow: 'hidden',
        color: '#ffffff',
        fontFamily: 'inherit',
      }}
    >
      {/* Laser Barcode Grid Matrix */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 50% 18%, rgba(0, 255, 136, 0.12), transparent 60%), radial-gradient(circle at 50% 85%, rgba(56, 189, 248, 0.08), transparent 65%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.05,
          backgroundImage:
            'linear-gradient(rgba(0,255,136,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.3) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${shake.x.toFixed(1)}px, ${shake.y.toFixed(1)}px) scale(${punch.toFixed(4)})`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** Scene 1 (0.00–7.20s): مغایرت وحشتناک قفسه انبار با سیستم */
export function ShelfDiscrepancyAlarmScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.6))
  const isAlarm = t >= 3.2

  // Laser scanner sweep line
  const laserY = Math.sin(t * 3.5) * 80 + 100

  return (
    <WarehouseStage scene={scene} t={t} shakes={[3.2]} punches={[0.1, 3.2]}>
      <TechPipelineHeader currentStep={1} deployCount="انبارگردانی و مغایرت قفسه" />

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
          سیستم می‌گه جنس هست، <KineticWordBox color="#ef4444">قفسه خالیه!</KineticWordBox>
        </h2>
        <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 6 }}>
          انبارگردانی سنتی = گم شدن کالاها، کسری کارتن و ضرر بی‌صدا
        </p>
      </div>

      {/* Warehouse Shelf Scanner Card */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 170,
          left: 32,
          right: 32,
          padding: '20px 22px',
          borderRadius: 20,
          background: isAlarm
            ? 'linear-gradient(145deg, rgba(28, 16, 20, 0.98), rgba(16, 10, 12, 0.98))'
            : 'linear-gradient(145deg, rgba(16, 26, 32, 0.96), rgba(10, 16, 22, 0.98))',
          border: isAlarm ? '2px solid #ef4444' : '1.5px solid rgba(0, 255, 136, 0.4)',
          boxShadow: isAlarm
            ? '0 20px 50px rgba(239, 68, 68, 0.35), 0 0 30px rgba(0,0,0,0.8)'
            : '0 20px 45px rgba(0,0,0,0.6)',
          zIndex: 20,
          ...cardFx(t, { at: 0.1, enter: 'drop', float: 2 }),
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>📦</span>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 900, color: '#ffffff' }}>
                کالای بازرگانی کد ۱۰۱
              </div>
              <div style={{ fontSize: 10.5, color: TEXT_MUTED }}>قفسه شماره B-14 (انبار مرکزی)</div>
            </div>
          </div>
          <div
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(239, 68, 68, 0.18)',
              color: '#ef4444',
              fontSize: 11,
              fontWeight: 800,
              border: '1px solid rgba(239, 68, 68, 0.35)',
            }}
          >
            {isAlarm ? '🚨 ۱۲ عدد کسری!' : 'اسکن بارکد...'}
          </div>
        </div>

        {/* Laser Sweep Visual */}
        <div
          style={{
            position: 'relative',
            height: 80,
            borderRadius: 10,
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10.5, color: TEXT_MUTED }}>موجودی در نرم‌افزار</div>
            <div
              style={{ fontSize: 22, fontWeight: 900, color: '#38bdf8', fontFamily: 'monospace' }}
            >
              ۵۰ عدد
            </div>
          </div>
          <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10.5, color: '#ef4444' }}>موجودی واقعی شمارش‌شده</div>
            <div
              style={{ fontSize: 22, fontWeight: 900, color: '#ef4444', fontFamily: 'monospace' }}
            >
              ۳۸ عدد
            </div>
          </div>

          {/* Red Laser Scanning Beam */}
          <div
            style={{
              position: 'absolute',
              top: `${laserY}px`,
              left: 0,
              right: 0,
              height: 2,
              background: '#ef4444',
              boxShadow: '0 0 10px #ef4444, 0 0 20px #ef4444',
            }}
          />
        </div>

        {/* Alarm Banner */}
        {isAlarm && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: '#dc2626',
              color: '#ffffff',
              textAlign: 'center',
              fontWeight: 900,
              fontSize: 12,
              boxShadow: '0 0 20px rgba(220, 38, 38, 0.7)',
            }}
          >
            ۱۲ کارتن بدون ثبت حواله ناپدید شده است! (-۱۰۲ میلیون تومان ضرر)
          </div>
        )}
      </div>
    </WarehouseStage>
  )
}

/** Scene 2 (7.20–14.40s): نقطه کور انبارداری چندشعبه‌ای و حواله‌های کاغذی */
export function MultiBranchBlindnessScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.6))

  const branches = [
    { name: 'انبار مرکزی غرب', stock: '۳۸ عدد', status: 'کسری ۱۲ عدد', tone: '#ef4444' },
    { name: 'شعبه بازار تهران', stock: '۱۵ عدد', status: 'نامشخص در راه', tone: '#f59e0b' },
    { name: 'انبار پخش مشهد', stock: '۰ عدد', status: 'توقف فروش', tone: '#ef4444' },
  ]

  return (
    <WarehouseStage scene={scene} t={t} punches={[0.3, 2.5]}>
      <TechPipelineHeader currentStep={2} deployCount="انتقال بین‌شعب و حواله‌های دستی" />

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
          نقطه کور در <KineticWordBox color="#f59e0b">انبار چندشعبه‌ای</KineticWordBox>
        </h2>
        <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 6 }}>
          بار از انبار خارج شده، اما شعبه دوم هنوز منتظر برگه کاغذی حواله است!
        </p>
      </div>

      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 170,
          left: 32,
          right: 32,
          padding: '18px 20px',
          borderRadius: 20,
          background: 'rgba(12, 18, 26, 0.98)',
          border: '1.5px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 45px rgba(0,0,0,0.6)',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>
            🏢 رصد موجودی در شعب ۳گانه
          </span>
          <span style={{ fontSize: 10.5, color: '#f59e0b', fontWeight: 800 }}>ناهماهنگی ۱۰۰٪</span>
        </div>

        {branches.map((b, i) => (
          <div
            key={b.name}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${b.tone}44`,
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              ...cardFx(t, { at: 0.4 + i * 0.3, enter: 'drop', float: 1 }),
            }}
          >
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#ffffff' }}>{b.name}</div>
              <div style={{ fontSize: 10, color: b.tone, marginTop: 2 }}>{b.status}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#f1f5f9' }}>{b.stock}</div>
          </div>
        ))}
      </div>
    </WarehouseStage>
  )
}

/** Scene 3 (14.40–25.20s): اسکن بارکد با موبایل و کسر آنی انبار ابری */
export function MobileBarcodeSyncScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.2, 0.8))
  const isScanned = t >= 4.5

  return (
    <WarehouseStage scene={scene} t={t} punches={[1.9, 4.5, 8.5]}>
      <TechPipelineHeader currentStep={3} deployCount="انبارداری هوشمند ابری حسابچه" />

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
          ۱ اسکن با موبایل = <KineticWordBox color="#10b981">کسر آنی در تمام شعب</KineticWordBox>
        </h2>
        <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 6 }}>
          بدون نیاز به دستگاه گران‌قیمت بارکدخوان؛ با دوربین ساده گوشی در انبار
        </p>
      </div>

      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 170,
          left: 32,
          right: 32,
          padding: '18px 20px',
          borderRadius: 20,
          background: 'linear-gradient(145deg, rgba(12, 28, 20, 0.98), rgba(8, 18, 14, 0.98))',
          border: '2px solid rgba(0, 255, 136, 0.7)',
          boxShadow: '0 20px 45px rgba(0,0,0,0.7), 0 0 30px rgba(0, 255, 136, 0.2)',
          zIndex: 20,
          ...cardFx(t, { at: 0.2, enter: 'drop', float: 2 }),
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>
            📱 اسکنر بارکد اپلیکیشن حسابچه:
          </span>
          <span style={{ fontSize: 11, color: '#00ff88', fontWeight: 800 }}>
            انبارداری ابری زنده ⚡
          </span>
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(0, 255, 136, 0.3)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 26 }}>📷</span>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 900, color: '#ffffff' }}>
              کالای بارکد #۶۲۶۰۱۰۲۴
            </div>
            <div style={{ fontSize: 10.5, color: '#38bdf8', marginTop: 2 }}>
              حواله خروج ۵ عدد برای شعبه بازار تایید شد
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: isScanned ? '#059669' : '#1e293b',
            color: '#ffffff',
            textAlign: 'center',
            fontSize: 11.5,
            fontWeight: 800,
          }}
        >
          {isScanned
            ? '✅ موجودی هر ۳ شعبه در لحظه هماهنگ شد!'
            : 'در حال اسکن و ارسال به سرور مرکزی...'}
        </div>
      </div>
    </WarehouseStage>
  )
}

/** Scene 4 (25.20–34.60s): لجر حسابرسی و ضدکسری / ضدسرقت */
export function AntiTheftAuditLogScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.6))

  return (
    <WarehouseStage scene={scene} t={t} punches={[0.4, 2.8, 6.5]}>
      <TechPipelineHeader currentStep={4} deployCount="لجر حسابرسی دقیق کاردکس کالا" />

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
          ثبت ثانیه‌به‌ثانیه <KineticWordBox color="#38bdf8">ورود و خروج کارتن‌ها</KineticWordBox>
        </h2>
        <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 6 }}>
          دقیقاً مشخص است چه کسی، در چه ساعتی و با چه فاکتوری کالا را خارج کرده
        </p>
      </div>

      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 170,
          left: 32,
          right: 32,
          padding: '18px 20px',
          borderRadius: 20,
          background: 'rgba(12, 20, 30, 0.98)',
          border: '1.5px solid #00ff88',
          boxShadow: '0 20px 45px rgba(0,0,0,0.6)',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>
            🛡️ سند کاردکس ضدکسری:
          </span>
          <span style={{ fontSize: 11, color: '#34d399', fontWeight: 800 }}>
            مغایرت قفسه: ۰ عدد ✅
          </span>
        </div>
        <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 8 }}>
          ردگیری کامل سریال و بارکد کالاها تا لحظه تحویل به مشتری نهایی.
        </div>
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(0, 255, 136, 0.15)',
            color: '#00ff88',
            fontSize: 11,
            fontWeight: 800,
            textAlign: 'center',
          }}
        >
          حذف ۱۰۰٪ کسری‌های مشکوک انبار
        </div>
      </div>
    </WarehouseStage>
  )
}

/** Scene 5 (34.60–41.20s): دعوت به اقدام */
export function WarehouseCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.8))

  return (
    <WarehouseStage scene={scene} t={t} punches={[2.0, 4.6]}>
      <TechPipelineHeader currentStep={5} deployCount="تست رایگان ماژول انبارداری ابری" />

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
          کنترل کامل انبار با <KineticWordBox color="#00ff88">حسابچه</KineticWordBox>
        </h2>
        <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 6 }}>
          کلمه <span style={{ color: '#00ff88', fontWeight: 900 }}>«حسابچه»</span> را بفرست و
          انبارگردانی آسان را تجربه کن!
        </p>
      </div>

      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 180,
          left: 36,
          right: 36,
          padding: '24px 20px',
          borderRadius: 20,
          background: 'linear-gradient(145deg, rgba(16, 28, 22, 0.96), rgba(10, 18, 14, 0.98))',
          border: '2px solid rgba(0, 255, 136, 0.6)',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.7), 0 0 35px rgba(0, 255, 136, 0.25)',
          zIndex: 20,
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 6 }}>📦</div>
        <h3 style={{ fontSize: 17, fontWeight: 900, margin: '0 0 8px', color: '#a7f3d0' }}>
          تست رایگان انبارداری و اسکنر بارکد
        </h3>
        <p style={{ fontSize: 11.5, color: TEXT_MUTED, margin: '0 0 16px', lineHeight: 1.45 }}>
          کاردکس آنلاین، انبارگردانی سریع با دوربین گوشی و ردیابی لحظه‌ای شعب
        </p>
        <div
          style={{
            display: 'inline-block',
            padding: '8px 24px',
            borderRadius: 8,
            background: 'linear-gradient(90deg, #00ff88, #10b981)',
            color: '#000000',
            fontSize: 12.5,
            fontWeight: 900,
          }}
        >
          شروع تست رایگان حسابچه
        </div>
      </div>
    </WarehouseStage>
  )
}
