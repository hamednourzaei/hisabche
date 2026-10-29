// ============================================
// Offline-POS-Checkout Art Direction (Reel 80) — Bespoke SaaS Motion
// The Cryogenic Local Database Core & Unstoppable Retail POS Engine
//
// Palette: Dark Cybernetic Obsidian (#08090f), Electric Cyan (#00B4FF),
// Mint Emerald (#00E676), Crimson Alert (#FF3D00), Amber (#FFB800)
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
export const AMBER = '#FFB800'
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
export function OfflineStage({
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
        background: 'radial-gradient(circle at 50% 25%, #0e1526 0%, #08090f 75%, #030406 100%)',
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

// ─── Scene 1 — The Micro-Disaster: Signal Lost at Peak Rush Hour ────────

export function OfflineDisasterScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.2)
  const shake = t > 1.2 && t < 2.0 ? Math.sin(t * 30) * 3 : 0

  return (
    <OfflineStage scene={scene} t={t} label="// 01 · قطع ناگهانی اینترنت">
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
          صف شلوغ پای صندوق…
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
          ناگهان اینترنت قطع شد!
        </div>
      </div>

      {/* Two Fate Cards in Disjoint Lanes (Safe Zone y: 280..520) */}
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
        {/* Traditional Web Systems (x: 40..250) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 40,
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
                background: CRIMSON,
                boxShadow: `0 0 10px ${CRIMSON}`,
              }}
            />
            <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
              نرم‌افزار وب سنتی
            </span>
          </div>

          <div
            dir="rtl"
            style={{ fontSize: 16, fontWeight: 800, color: CRIMSON, textAlign: 'center' }}
          >
            «خطای اتصال به سرور · فروش متوقف شد!»
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
            مشتریان کالاها را رها می‌کنند
          </div>
        </div>

        {/* Hisabche Native Engine (x: 290..500) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 290,
            width: 210,
            height: 220,
            background: 'linear-gradient(145deg, #101c18, #0a120f)',
            border: `2px solid ${EMERALD}`,
            borderRadius: 22,
            boxShadow: `0 25px 60px rgba(0,0,0,0.8), 0 0 30px ${EMERALD}33`,
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
                background: EMERALD,
                boxShadow: `0 0 10px ${EMERALD}`,
              }}
            />
            <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
              اپلیکیشن حسابچه
            </span>
          </div>

          <div
            dir="rtl"
            style={{ fontSize: 16, fontWeight: 800, color: EMERALD, textAlign: 'center' }}
          >
            «تداوم صدور فاکتور بدون ۱ ثانیه وقفه!»
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
            دیتابیس بومی در ویندوز و موبایل
          </div>
        </div>
      </div>

      {/* Discrepancy Consequence Banner (Safe Zone y: 560..710) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 560,
          left: 40,
          right: 40,
          background: 'rgba(0, 230, 118, 0.1)',
          border: `1.5px solid ${EMERALD}`,
          borderRadius: 22,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxShadow: `0 20px 50px rgba(0,0,0,0.8), 0 0 30px ${EMERALD}33`,
          opacity: clamp(p2 * 1.5),
          transform: `scale(${mix(0.85, 1, p2).toFixed(3)})`,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: EMERALD,
            color: '#08090f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: 22,
          }}
        >
          ✓
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            آرامش مطلق پای صندوق
          </div>
          <div
            style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}
          >
            بارکد بزن، فاکتور چاپ کن؛ ذخیره‌سازی محلی خودکار فعال است
          </div>
        </div>
      </div>
    </OfflineStage>
  )
}

// ─── Scene 2 — Local SQLite Vault & 0ms Barcode Laser ───────────────────

export function LocalDatabaseLaserScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const laserP = ease(clamp(progress(t, 1.2, 3.0)))
  const confirmP = pop(t, 3.2)

  return (
    <OfflineStage scene={scene} t={t} label="// 02 · پردازش محلی بدون تاخیر">
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
          <span style={{ color: CYAN, fontSize: 18 }}>⚡</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
            اسکن بارکد در ۰ میلی‌ثانیه
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
          LOCAL DB READY
        </span>
      </div>

      {/* POS Terminal Screen (Safe Zone y: 240..560) */}
      <div
        style={{
          position: 'absolute',
          top: 240,
          left: 40,
          right: 40,
          height: 300,
          background: 'linear-gradient(145deg, #0c121e, #070a12)',
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
              background: `${AMBER}22`,
              color: AMBER,
              border: `1px solid ${AMBER}`,
              borderRadius: 6,
              padding: '3px 8px',
              fontWeight: 800,
            }}
          >
            OFFLINE MODE
          </span>
          <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            ثبت آنی اقلام فاکتور
          </span>
        </div>

        {/* Laser Scanner Bar */}
        <div
          style={{
            height: 3,
            width: '100%',
            background: `linear-gradient(90deg, transparent, ${CYAN}, ${EMERALD}, transparent)`,
            boxShadow: `0 0 15px ${CYAN}`,
            opacity: laserP < 1 ? 1 : 0.3,
          }}
        />

        {/* Scanned Items List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              fontWeight: 800,
              background: 'rgba(255,255,255,0.04)',
              padding: '8px 12px',
              borderRadius: 10,
            }}
          >
            <span>کالای بازرگانی کد ۱۰۱</span>
            <span style={{ ...MONO, color: CYAN }}>{faNumber(24000)}</span>
          </div>

          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              fontWeight: 800,
              background: 'rgba(255,255,255,0.04)',
              padding: '8px 12px',
              borderRadius: 10,
            }}
          >
            <span>محصول استاندارد کد ۲۰۲</span>
            <span style={{ ...MONO, color: CYAN }}>{faNumber(18000)}</span>
          </div>

          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: 8,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>مجموع فاکتور:</span>
            <span style={{ ...MONO, fontSize: 24, fontWeight: 900, color: EMERALD }}>
              {faNumber(42000)}
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
          opacity: clamp(confirmP * 1.5),
          transform: `scale(${mix(0.85, 1, confirmP).toFixed(3)})`,
        }}
      >
        <span style={{ color: EMERALD, fontSize: 24, fontWeight: 900 }}>✓</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            فاکتور چاپ و تحویل مشتری شد
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
            مشتری حتی متوجه قطعی اینترنت نشد
          </div>
        </div>
      </div>
    </OfflineStage>
  )
}

// ─── Scene 3 — Dynamic Offline Queue Stream ─────────────────────────────

export function OfflineQueueStreamScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.2)
  const p3 = pop(t, 2.2)

  return (
    <OfflineStage scene={scene} t={t} label="// 03 · صف امن ذخیره‌سازی محلی">
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
          تداوم فروش در صف محلی
        </div>
        <div style={{ fontSize: 40, fontWeight: 900, color: AMBER, marginTop: 4 }}>
          ۳ فاکتور در صف امن محلی
        </div>
      </div>

      {/* 3 Queued Invoices Stack (Safe Zone y: 240..520) */}
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
        {/* Invoice 1 */}
        <div
          dir="rtl"
          style={{
            background: 'linear-gradient(145deg, #161a28, #0c101a)',
            border: `1.5px solid ${AMBER}`,
            borderRadius: 16,
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: clamp(p1 * 1.5),
            transform: `translateY(${mix(20, 0, p1).toFixed(1)}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...MONO, fontSize: 12, color: AMBER, fontWeight: 800 }}>QUEUED</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
              فاکتور شماره ۱۲۴۰
            </span>
          </div>
          <span style={{ ...MONO, fontSize: 18, fontWeight: 900, color: '#ffffff' }}>
            {faNumber(42000)}
          </span>
        </div>

        {/* Invoice 2 */}
        <div
          dir="rtl"
          style={{
            background: 'linear-gradient(145deg, #161a28, #0c101a)',
            border: `1.5px solid ${AMBER}`,
            borderRadius: 16,
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: clamp(p2 * 1.5),
            transform: `translateY(${mix(20, 0, p2).toFixed(1)}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...MONO, fontSize: 12, color: AMBER, fontWeight: 800 }}>QUEUED</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
              فاکتور شماره ۱۲۴۱
            </span>
          </div>
          <span style={{ ...MONO, fontSize: 18, fontWeight: 900, color: '#ffffff' }}>
            {faNumber(18000)}
          </span>
        </div>

        {/* Invoice 3 */}
        <div
          dir="rtl"
          style={{
            background: 'linear-gradient(145deg, #161a28, #0c101a)',
            border: `1.5px solid ${AMBER}`,
            borderRadius: 16,
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: clamp(p3 * 1.5),
            transform: `translateY(${mix(20, 0, p3).toFixed(1)}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...MONO, fontSize: 12, color: AMBER, fontWeight: 800 }}>QUEUED</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
              فاکتور شماره ۱۲۴۲
            </span>
          </div>
          <span style={{ ...MONO, fontSize: 18, fontWeight: 900, color: '#ffffff' }}>
            {faNumber(35000)}
          </span>
        </div>
      </div>

      {/* Assurance Tag Below (y: 560..680) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 560,
          left: 40,
          right: 40,
          background: 'rgba(255, 184, 0, 0.08)',
          border: `1.5px solid ${AMBER}44`,
          borderRadius: 20,
          padding: '16px 20px',
          textAlign: 'center',
          fontSize: 15,
          fontWeight: 800,
          color: '#ffffff',
        }}
      >
        حتی با خاموش شدن سیستم، هیچ داده‌ای از بین نمی‌رود
      </div>
    </OfflineStage>
  )
}

// ─── Scene 4 — Instant Reconnect & High-Speed Sync Surge ────────────────

export function InstantReconnectSyncScene({ t, scene }: { t: number; scene: Scene }) {
  const syncP = ease(clamp(progress(t, 0.4, 2.2)))
  const checkP = pop(t, 2.2)

  return (
    <OfflineStage scene={scene} t={t} label="// 04 · اتصال مجدد و همگام‌سازی">
      {/* Top Banner (y: 130..220) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 130,
          left: 40,
          right: 40,
          background: 'linear-gradient(145deg, #0e1e18, #07120d)',
          border: `1.5px solid ${EMERALD}`,
          borderRadius: 18,
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: EMERALD, fontSize: 18 }}>🌐</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            اینترنت وصل شد · همگام‌سازی خودکار
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
          SYNCING…
        </span>
      </div>

      {/* Synced Queue Cockpit (Safe Zone y: 240..540) */}
      <div
        style={{
          position: 'absolute',
          top: 240,
          left: 40,
          right: 40,
          height: 280,
          background: 'linear-gradient(145deg, #101626, #080d18)',
          border: `2px solid ${EMERALD}`,
          borderRadius: 24,
          boxShadow: `0 30px 80px rgba(0,0,0,0.9), 0 0 45px ${EMERALD}33`,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              ...MONO,
              fontSize: 11,
              background: `${EMERALD}22`,
              color: EMERALD,
              borderRadius: 6,
              padding: '3px 8px',
              fontWeight: 800,
            }}
          >
            CLOUD SURGE
          </span>
          <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            انتقال بی‌صدا به سرور مرکزی
          </span>
        </div>

        {/* Animated Progress Sync Bar */}
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
              width: `${syncP * 100}%`,
              background: `linear-gradient(90deg, ${CYAN}, ${EMERALD})`,
            }}
          />
        </div>

        {/* 3 Synced Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            'فاکتور ۱۲۴۰ · انبار و حسابداری به‌روز شد',
            'فاکتور ۱۲۴۱ · انبار و حسابداری به‌روز شد',
            'فاکتور ۱۲۴۲ · انبار و حسابداری به‌روز شد',
          ].map((item, idx) => (
            <div
              key={idx}
              dir="rtl"
              style={{
                background: 'rgba(0, 230, 118, 0.08)',
                border: `1px solid ${EMERALD}33`,
                borderRadius: 12,
                padding: '8px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                fontWeight: 800,
                color: '#ffffff',
              }}
            >
              <span>{item}</span>
              <span style={{ color: EMERALD }}>✓ همگام شد</span>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation Seal Below (Safe Zone y: 560..680) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 560,
          left: 40,
          right: 40,
          textAlign: 'center',
          fontSize: 16,
          fontWeight: 900,
          color: EMERALD,
          opacity: clamp(checkP * 1.5),
        }}
      >
        تمام فاکتورها بدون ۱ ثانیه کار دستی با ابر حسابچه تراز شدند
      </div>
    </OfflineStage>
  )
}

// ─── Scene 5 — Unstoppable Business Manifesto ───────────────────────────

export function UnstoppableBusinessScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.2)
  const p3 = pop(t, 2.2)

  return (
    <OfflineStage scene={scene} t={t} label="// 05 · فروشگاه متوقف‌نشدنی">
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
          نه قطعی اینترنت…
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
          نه نوسان برق بازار…
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
          فروشگاهت هرگز نمی‌خوابه!
        </div>
      </div>

      {/* Stability Guarantee Seal (Safe Zone y: 600..710) */}
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
            پایداری ۱۰۰٪ فروش در بدترین شرایط
          </span>
        </div>
        <span style={{ ...MONO, fontSize: 12, color: CYAN, fontWeight: 800 }}>100% RELIABLE</span>
      </div>
    </OfflineStage>
  )
}

// ─── Scene 6 — Brand Monolith & CTA ─────────────────────────────────────

export function OfflineCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const brandP = pop(t, 0.2)
  const btnP = pop(t, 1.2)

  return (
    <OfflineStage scene={scene} t={t} label="// 06 · دانلود اپلیکیشن رایگان">
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
          اپلیکیشن ویندوز، موبایل و وب
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
          دانلود اپلیکیشن رایگان
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
        نسخه ویندوز و اندروید · سازگار با تمام بارکدخوان‌ها و فیش‌پرینترها
      </div>
    </OfflineStage>
  )
}
