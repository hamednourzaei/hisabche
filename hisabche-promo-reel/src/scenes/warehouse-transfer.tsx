// ============================================
// Warehouse-Transfer Art Direction (Reel 72) — Bespoke SaaS Motion
// The Orbital Inter-Warehouse Conduit & In-Transit Telemetry Gate
//
// Palette: Deep Dark Navy (#060914), Logistics Cyan (#00E5FF),
// Transit Amber (#FFB300), Arrival Emerald (#00E676), Crimson Alert (#FF3D00)
// High-depth 3D perspective, zero hold-frame overlap,
// strict physical container-local coordinates, 100% dark studio theme.
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

export const DARK = '#060914'
export const CYAN = '#00E5FF'
export const AMBER = '#FFB300'
export const EMERALD = '#00E676'
export const CRIMSON = '#FF3D00'
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
export function TransferStage({
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
        background: 'radial-gradient(circle at 50% 25%, #0f162d 0%, #060914 75%, #020307 100%)',
        overflow: 'hidden',
        color: '#ffffff',
        direction: 'ltr',
      }}
    >
      {/* Precision logistics grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage:
            'linear-gradient(rgba(0, 229, 255, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 179, 0, 0.4) 1px, transparent 1px)',
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
            background: CYAN,
            boxShadow: `0 0 10px ${CYAN}`,
          }}
        />
        <span>HISABCHE // LOGISTICS CONDUIT RADAR</span>
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
          background: 'rgba(0, 229, 255, 0.1)',
          border: `1px solid rgba(0, 229, 255, 0.3)`,
          padding: '4px 14px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          color: CYAN,
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
// Scene 1: In-Transit Blindspot Crisis (Frame-0 Arrest)
// ============================================
export function InTransitBlindspotCrisisScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2.2, 0, 1))
  const pulse = Math.sin(t * 8) * 0.15 + 0.85

  return (
    <TransferStage scene={scene} t={t} label="بحران کالای مفقود بین انبارها">
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
          انبار مرکزی می‌گه بار رفت،
          <br />
          <span style={{ color: CRIMSON }}>شعبه می‌گه هنوز به ما نرسیده!</span>
        </h1>
      </div>

      {/* Split Dilemma Cards */}
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
        {/* Origin Warehouse Out */}
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
              🏢
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>انبار مبدا (مرکزی)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: CYAN, marginTop: 4 }}>
                {faNumber(50)} کارتن کسر شد و ارسال گردید
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
            خروج از مبدا
          </div>
        </div>

        {/* Destination In Limbo */}
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
              🚚
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                وضعیت انبار مقصد (شعبه)
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: CRIMSON, marginTop: 4 }}>
                نامشخص (بار در راه کجاست؟)
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
            نقطه کور بار
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
          بدون حواله رسمی بین‌انبار، راننده معطل می‌شه و معلوم نیست ۵۰ کارتن دست کیه!
        </span>
      </div>
    </TransferStage>
  )
}

// ============================================
// Scene 2: Interactive Conduit Transfer
// ============================================
export function InteractiveConduitTransferScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const inTransitProgress = spring(clamp((t - 1) * 1.5, 0, 1))

  return (
    <TransferStage scene={scene} t={t} label="حواله انتقال بین انبارها">
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
          حواله هوشمند: <span style={{ color: AMBER }}>کالای در راه در لجر ثبت است</span>
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          کالا نه دوبار شمرده می‌شود و نه تا زمان تحویل در مقصد ناپدید می‌گردد
        </p>
      </div>

      {/* Transit Conduit Visualizer */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          left: 24,
          right: 24,
          background: 'rgba(10, 16, 28, 0.85)',
          border: `1px solid ${BORDER_GLASS}`,
          borderRadius: 20,
          padding: 22,
          opacity: intro,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            direction: 'rtl',
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 800, color: CYAN }}>
            حواله جابجایی کالا #۷۰۲
          </span>
          <span style={{ ...MONO, fontSize: 12, color: AMBER }}>IN-TRANSIT STATUS</span>
        </div>

        {/* 3-Node Conduit Pipe */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            marginBottom: 20,
          }}
        >
          {/* Node 1: Origin */}
          <div style={{ textAlign: 'center', width: 80 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(0, 229, 255, 0.2)',
                border: `2px solid ${CYAN}`,
                margin: '0 auto 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
              }}
            >
              🏢
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>انبار مرکزی</div>
          </div>

          {/* Node 2: In-Transit Center */}
          <div style={{ textAlign: 'center', width: 90 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(255, 179, 0, 0.2)',
                border: `2px solid ${AMBER}`,
                margin: '0 auto 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                boxShadow: `0 0 16px ${AMBER}66`,
              }}
            >
              🚚
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: AMBER }}>کالای در راه</div>
          </div>

          {/* Node 3: Destination */}
          <div style={{ textAlign: 'center', width: 80 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(0, 230, 118, 0.15)',
                border: `2px solid ${EMERALD}`,
                margin: '0 auto 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
              }}
            >
              🏬
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>شعبه شماره ۲</div>
          </div>
        </div>

        {/* Progress Conduit Bar */}
        <div
          style={{
            height: 10,
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: 5,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: `${mix(15, 65, inTransitProgress)}%`,
              background: `linear-gradient(90deg, ${CYAN}, ${AMBER})`,
              borderRadius: 5,
              boxShadow: `0 0 10px ${AMBER}88`,
            }}
          />
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
          opacity: intro,
        }}
      >
        حساب ردیاب «کالای در راه» تضمین می‌کند که بار در هیچ فاصله‌ای مفقود نگردد.
      </div>
    </TransferStage>
  )
}

// ============================================
// Scene 3: Barcode Reception & Destination Lock
// ============================================
export function BarcodeReceptionLockScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const received = t > 1.6
  const recP = spring(clamp((t - 1.6) * 2, 0, 1))

  return (
    <TransferStage scene={scene} t={t} label="رسید تحویل بارکدی در مقصد">
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
          تایید ورود به انبار مقصد: <span style={{ color: EMERALD }}>تطبیق ۱۰۰٪ بار</span>
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          انباردار شعبه بارکد را اسکن می‌کند؛ حواله بسته شده و موجودی مقصد شارژ می‌شود
        </p>
      </div>

      {/* Reception Confirmation Card */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          left: 24,
          right: 24,
          background: 'rgba(12, 18, 28, 0.85)',
          border: `1px solid ${received ? EMERALD : BORDER_GLASS}`,
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
          <span style={{ fontSize: 14, fontWeight: 800, color: WHITE }}>
            قبض انبار مقصد (شعبه ۲)
          </span>
          <div
            style={{
              padding: '4px 12px',
              borderRadius: 8,
              background: received ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 179, 0, 0.15)',
              color: received ? EMERALD : AMBER,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {received ? 'تحویل کامل شد ✓' : 'در حال اسکن اقلام...'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, direction: 'rtl' }}>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              تعداد اقلام ثبت‌شده حواله:
            </span>
            <span style={{ ...MONO, fontSize: 16, fontWeight: 800, color: CYAN }}>
              {faNumber(50)} کارتن استاندارد
            </span>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              تعداد شمرده‌شده فیزیکی:
            </span>
            <span style={{ ...MONO, fontSize: 16, fontWeight: 800, color: EMERALD }}>
              {faNumber(50)} کارتن سالم
            </span>
          </div>

          <div
            style={{
              background: 'rgba(0, 230, 118, 0.08)',
              border: `1px solid ${EMERALD}44`,
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>کسری یا آسیب بار:</span>
            <span style={{ ...MONO, fontSize: 16, fontWeight: 800, color: EMERALD }}>
              {faNumber(0)} (تطبیق کامل)
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
        با تایید مقصد، کاردکس هر دو انبار و دفاتر مرکزی در کمتر از ۱ ثانیه تراز می‌شوند.
      </div>
    </TransferStage>
  )
}

// ============================================
// Scene 4: Unified Multi-Warehouse Inventory
// ============================================
export function UnifiedMultiWarehouseInventoryScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const warehouses = [
    { name: 'انبار مرکزی', stock: faNumber(250) + ' کارتن', tone: CYAN },
    { name: 'شعبه شماره ۱ (بازار)', stock: faNumber(120) + ' کارتن', tone: EMERALD },
    { name: 'شعبه شماره ۲ (غرب)', stock: faNumber(50) + ' کارتن', tone: AMBER },
  ]

  return (
    <TransferStage scene={scene} t={t} label="موجودی متمرکز چندشعبه‌ای">
      <div
        style={{
          position: 'absolute',
          top: 100,
          left: 28,
          right: 28,
          direction: 'rtl',
          textAlign: 'center',
          opacity: intro,
        }}
      >
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: WHITE }}>
          داشبورد چندانباره: <span style={{ color: CYAN }}>موجودی شفاف تمام شعب</span>
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          مدیر بدون تماس تلفنی می‌داند هر شعبه دقیقا چقدر موجودی آماده فروش دارد
        </p>
      </div>

      {/* Multi-Warehouse Stock Panel */}
      <div
        style={{
          position: 'absolute',
          top: 175,
          left: 24,
          right: 24,
          background: 'rgba(10, 15, 26, 0.85)',
          border: `1px solid ${BORDER_GLASS}`,
          borderRadius: 20,
          padding: 20,
          opacity: intro,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, direction: 'rtl' }}>
          {warehouses.map((wh, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 12,
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: `1px solid ${wh.tone}33`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: wh.tone,
                    boxShadow: `0 0 8px ${wh.tone}`,
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 700, color: WHITE }}>{wh.name}</span>
              </div>
              <span style={{ ...MONO, fontSize: 15, fontWeight: 800, color: wh.tone }}>
                {wh.stock}
              </span>
            </div>
          ))}

          {/* Total Consolidated */}
          <div
            style={{
              background: 'rgba(0, 229, 255, 0.08)',
              border: `1px solid ${CYAN}55`,
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 4,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 800, color: WHITE }}>
              مجموع کل موجودی کالا در تمام شعب:
            </span>
            <span style={{ ...MONO, fontSize: 18, fontWeight: 900, color: CYAN }}>
              {faNumber(420)} کارتن
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 28,
          right: 28,
          textAlign: 'center',
          direction: 'rtl',
          fontSize: 13,
          color: 'rgba(255,255,255,0.7)',
          opacity: intro,
        }}
      >
        فروشنده پای صندوق شعبه می‌تواند موجودی انبار مرکزی را ببیند و پیش‌فاکتور بزند.
      </div>
    </TransferStage>
  )
}

// ============================================
// Scene 5: Logistics Integrity Manifesto
// ============================================
export function LogisticsIntegrityManifestoScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const lines = [
    { title: 'انتقال بدون حواله، چاه سیاه موجودی است', tone: CRIMSON },
    { title: 'ردیابی بار در راه تا آخرین متر جاده', tone: AMBER },
    { title: 'موجودی متمرکز شعب در نوک انگشتان شما', tone: CYAN },
  ]

  return (
    <TransferStage scene={scene} t={t} label="امنیت جابجایی بار بین شعب">
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
        حسابچه // تسلط یکپارچه بر انبارها و ناوگان توزیع چندشعبه‌ای
      </div>
    </TransferStage>
  )
}

// ============================================
// Scene 6: Warehouse Transfer CTA
// ============================================
export function WarehouseTransferCtaScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))
  const pulse = Math.sin(t * 5) * 0.15 + 0.85

  return (
    <TransferStage scene={scene} t={t} label="شروع رایگان حسابچه">
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
        {/* Brand Logistics Conduit Emblem */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.2), rgba(255, 179, 0, 0.08))',
            border: `2px solid ${CYAN}`,
            boxShadow: `0 0 35px ${CYAN}55`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 38,
            marginBottom: 24,
          }}
        >
          🔄
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
          سامانه انتقال بین‌انبار و چندشعبه
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
          ردیابی دقیق بار در راه، تایید بارکدی و صفر شدن کسری کالا
        </p>

        {/* CTA Button */}
        <div
          style={{
            marginTop: 32,
            background: `linear-gradient(135deg, ${CYAN}, #0099FF)`,
            padding: '16px 36px',
            borderRadius: 16,
            color: '#000000',
            fontSize: 18,
            fontWeight: 800,
            direction: 'rtl',
            boxShadow: `0 0 ${25 * pulse}px ${CYAN}aa`,
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
          MULTI-LOCATION CONDUIT // WEB · DESKTOP · MOBILE
        </div>
      </div>
    </TransferStage>
  )
}
