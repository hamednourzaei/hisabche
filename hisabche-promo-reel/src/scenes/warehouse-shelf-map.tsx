// ============================================
// Warehouse-Shelf-Map Art Direction (Reel 76) — Bespoke SaaS Motion
// The 3-Second Bin Locating & 2D Optical Shelf Matrix
//
// Palette: Cyber Emerald (#00E676), Optical Cyan (#00E5FF),
// Dark Obsidian (#040906), Warning Crimson (#FF3D00), Amber (#FFB300)
// High-depth perspective, zero hold-frame overlap,
// strict physical container-local coordinates, 100% dark studio theme.
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

export const DARK = '#040906'
export const EMERALD = '#00E676'
export const CYAN = '#00E5FF'
export const CRIMSON = '#FF3D00'
export const AMBER = '#FFB300'
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
export function ShelfStage({
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
        background: 'radial-gradient(circle at 50% 20%, #081810 0%, #040906 75%, #020403 100%)',
        overflow: 'hidden',
        color: '#ffffff',
        direction: 'ltr',
      }}
    >
      {/* Precision warehouse grid background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage:
            'linear-gradient(rgba(0, 230, 118, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 255, 0.4) 1px, transparent 1px)',
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
          color: EMERALD,
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
        <span>HISABCHE // OPTICAL WAREHOUSE RADAR</span>
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
          background: 'rgba(0, 230, 118, 0.08)',
          border: `1px solid rgba(0, 230, 118, 0.25)`,
          padding: '4px 14px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          color: EMERALD,
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
// Scene 1: Missing Item Stand-Off (Frame-0 Arrest)
// ============================================
export function MissingItemStandOffScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2.2, 0, 1))

  const pulse = Math.sin(t * 8) * 0.15 + 0.85

  return (
    <ShelfStage scene={scene} t={t} label="بحران مکان‌یابی کالا در انبار">
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
          مشتری پای صندوق منتظره،
          <br />
          <span style={{ color: CRIMSON }}>اما مکان کالا مشخص نیست!</span>
        </h1>
      </div>

      {/* Split Dilemma Boxes */}
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
        {/* Box 1: System says In Stock */}
        <div
          style={{
            background: 'rgba(0, 229, 255, 0.04)',
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
              📦
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>موجودی سیستمی</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: CYAN, marginTop: 4 }}>
                {faNumber(20)} کارتن موجود ثبت شده
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
            تایید موجودی
          </div>
        </div>

        {/* Box 2: Physical Blindspot */}
        <div
          style={{
            background: 'rgba(255, 61, 0, 0.05)',
            border: `1px solid ${CRIMSON}55`,
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
                background: 'rgba(255, 61, 0, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                color: CRIMSON,
              }}
            >
              ⚠️
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                محل قرارگیری فیزیکی
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: CRIMSON, marginTop: 4 }}>
                فقط در ذهن انباردار! (۲۰ دقیقه جستجو)
              </div>
            </div>
          </div>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(255, 61, 0, 0.2)',
              color: CRIMSON,
              fontSize: 12,
              fontWeight: 700,
              opacity: pulse,
            }}
          >
            سردرگمی راهرو
          </div>
        </div>
      </div>

      {/* Timer / Maze Indicator */}
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
          هزینه اتلاف وقت: مشتری کلافه، صف صندوق متوقف، انباردار سرگردان!
        </span>
      </div>
    </ShelfStage>
  )
}

// ============================================
// Scene 2: Interactive 2D Shelf Grid Matrix
// ============================================
export function Interactive2DShelfGridScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const activeSlotP = spring(clamp((t - 1.5) * 1.5, 0, 1))
  const pulse = Math.sin(t * 6) * 0.15 + 0.85

  // Aisles: A, B, C. Racks: 1 to 4
  const aisles = ['A', 'B', 'C']
  const racks = ['01', '02', '03', '04']

  return (
    <ShelfStage scene={scene} t={t} label="نقشه دوبعدی قفسه‌بندی هوشمند">
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
          آدرس‌دهی ۳ سطحی: <span style={{ color: EMERALD }}>راهرو · قفسه · طبقه</span>
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
          نقشه تعاملی انبار مرکزی با تفکیک دقیق سلول‌ها
        </p>
      </div>

      {/* 2D Grid Visualizer */}
      <div
        style={{
          position: 'absolute',
          top: 180,
          left: 24,
          right: 24,
          background: 'rgba(0, 20, 10, 0.65)',
          border: `1px solid rgba(0, 230, 118, 0.25)`,
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
            marginBottom: 16,
            direction: 'rtl',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: EMERALD }}>
            نمای هوایی: سالن شماره ۱ انبار
          </span>
          <span style={{ ...MONO, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            GRID MATRIX // 3x4
          </span>
        </div>

        {/* Matrix Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {aisles.map((aisle) => (
            <div key={aisle} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  ...MONO,
                  width: 32,
                  height: 38,
                  borderRadius: 8,
                  background: aisle === 'B' ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${aisle === 'B' ? EMERALD : BORDER_GLASS}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 14,
                  color: aisle === 'B' ? EMERALD : 'rgba(255,255,255,0.7)',
                }}
              >
                {aisle}
              </div>

              <div style={{ display: 'flex', flex: 1, gap: 8 }}>
                {racks.map((rack) => {
                  const isTarget = aisle === 'B' && rack === '04'
                  return (
                    <div
                      key={rack}
                      style={{
                        flex: 1,
                        height: 38,
                        borderRadius: 8,
                        background: isTarget
                          ? `rgba(0, 230, 118, ${0.15 + activeSlotP * 0.25})`
                          : 'rgba(255, 255, 255, 0.03)',
                        border: `1px solid ${isTarget ? EMERALD : BORDER_GLASS}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        ...MONO,
                        fontSize: 12,
                        fontWeight: isTarget ? 700 : 500,
                        color: isTarget ? WHITE : 'rgba(255,255,255,0.4)',
                        position: 'relative',
                        boxShadow: isTarget ? `0 0 16px ${EMERALD}55` : 'none',
                      }}
                    >
                      {rack}
                      {isTarget && activeSlotP > 0.5 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: -6,
                            right: -6,
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: EMERALD,
                            border: '2px solid #000',
                            opacity: pulse,
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Target Coordinates Detail Card */}
      <div
        style={{
          position: 'absolute',
          bottom: 90,
          left: 24,
          right: 24,
          background: 'rgba(0, 230, 118, 0.06)',
          border: `1px solid ${EMERALD}55`,
          borderRadius: 16,
          padding: 16,
          direction: 'rtl',
          opacity: activeSlotP,
          transform: `translateY(${(1 - activeSlotP) * 20}px)`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>موقعیت قفل‌شده:</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: EMERALD, marginTop: 4 }}>
              راهروی B · ردیف ۰۴ · طبقه ۲ (B-04-2)
            </div>
          </div>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 10,
              background: EMERALD,
              color: '#000',
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            آماده تحویل
          </div>
        </div>
      </div>
    </ShelfStage>
  )
}

// ============================================
// Scene 3: Sub-Second Barcode Locator
// ============================================
export function SubSecondBarcodeLocatorScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  // Laser beam scan loop
  const scanCycle = (t * 1.5) % 2
  const laserY = mix(30, 180, Math.sin(scanCycle * Math.PI))

  const detected = t > 1.8
  const detectP = spring(clamp((t - 1.8) * 2, 0, 1))

  return (
    <ShelfStage scene={scene} t={t} label="مکان‌یابی ۳ ثانیه‌ای با بارکد">
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
          اسکن بارکد، <span style={{ color: CYAN }}>مسیریابی آنی</span> به قفسه
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          شناسایی موقعیت دقیق فیزیکی بدون نیاز به حفظ کردن حافظه
        </p>
      </div>

      {/* Barcode Scanner Viewport */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          left: 28,
          right: 28,
          height: 220,
          background: 'rgba(0, 10, 20, 0.7)',
          border: `1px solid ${CYAN}44`,
          borderRadius: 20,
          overflow: 'hidden',
          opacity: intro,
        }}
      >
        {/* Reticle brackets */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            width: 24,
            height: 24,
            borderTop: `2px solid ${CYAN}`,
            borderLeft: `2px solid ${CYAN}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 24,
            height: 24,
            borderTop: `2px solid ${CYAN}`,
            borderRight: `2px solid ${CYAN}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            width: 24,
            height: 24,
            borderBottom: `2px solid ${CYAN}`,
            borderLeft: `2px solid ${CYAN}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            width: 24,
            height: 24,
            borderBottom: `2px solid ${CYAN}`,
            borderRight: `2px solid ${CYAN}`,
          }}
        />

        {/* Barcode Visual in center */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {[4, 2, 6, 2, 8, 3, 5, 2, 7, 3, 2, 6, 4, 2, 5, 3].map((w, i) => (
            <div
              key={i}
              style={{
                width: w * 2.5,
                height: 80,
                background: detected ? EMERALD : WHITE,
                opacity: 0.9,
              }}
            />
          ))}
        </div>

        {/* Laser Scan Line */}
        <div
          style={{
            position: 'absolute',
            top: laserY,
            left: 0,
            right: 0,
            height: 2,
            background: detected ? EMERALD : CYAN,
            boxShadow: `0 0 12px ${detected ? EMERALD : CYAN}`,
          }}
        />

        <div
          style={{
            ...MONO,
            position: 'absolute',
            bottom: 12,
            left: 20,
            fontSize: 11,
            color: CYAN,
          }}
        >
          {detected ? 'MATCH FOUND // 0.08s' : 'SCANNING OPTICAL CODE...'}
        </div>
      </div>

      {/* Target Result Telemetry */}
      <div
        style={{
          position: 'absolute',
          bottom: 70,
          left: 24,
          right: 24,
          background: 'rgba(0, 230, 118, 0.08)',
          border: `1px solid ${EMERALD}55`,
          borderRadius: 16,
          padding: 16,
          direction: 'rtl',
          opacity: detectP,
          transform: `translateY(${(1 - detectP) * 16}px)`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              کالای استاندارد کد ۱۰۱
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: WHITE, marginTop: 4 }}>
              آدرس قفسه: <span style={{ color: EMERALD }}>راهرو B · قفسه ۰۴ · طبقه ۲</span>
            </div>
          </div>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(0, 230, 118, 0.2)',
              color: EMERALD,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            ۳ ثانیه تا تحویل
          </div>
        </div>
      </div>
    </ShelfStage>
  )
}

// ============================================
// Scene 4: Shelf Capacity & Stock Gauge
// ============================================
export function ShelfCapacityGaugeScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const fillAnim = spring(clamp((t - 0.8) * 1.6, 0, 1))
  const percent = Math.round(mix(20, 85, fillAnim))

  return (
    <ShelfStage scene={scene} t={t} label="ظرفیت و پرشدگی هوشمند قفسه">
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
          کنترل ظرفیت قفسه: <span style={{ color: AMBER }}>نه انباشت، نه جای خالی</span>
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
          پایش ظرفیت فیزیکی هر سلول برای جلوگیری از آسیب و بی‌نظمی
        </p>
      </div>

      {/* Volumetric Shelf Gauge Card */}
      <div
        style={{
          position: 'absolute',
          top: 175,
          left: 24,
          right: 24,
          background: 'rgba(10, 16, 12, 0.75)',
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
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>سلول انتخاب‌شده</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: EMERALD, marginTop: 2 }}>
              قفسه B-04-2 (انبار اصلی)
            </div>
          </div>
          <div
            style={{
              ...MONO,
              fontSize: 22,
              fontWeight: 800,
              color: AMBER,
            }}
          >
            {faNumber(percent)}%
          </div>
        </div>

        {/* Progress Fill Bar */}
        <div
          style={{
            height: 14,
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: 7,
            overflow: 'hidden',
            position: 'relative',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: `${percent}%`,
              background: `linear-gradient(90deg, ${EMERALD}, ${AMBER})`,
              borderRadius: 7,
              boxShadow: `0 0 12px ${AMBER}66`,
            }}
          />
        </div>

        {/* Shelf Metrics Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            direction: 'rtl',
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 12,
              padding: 12,
              border: `1px solid ${BORDER_GLASS}`,
            }}
          >
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>موجودی فعلی قفسه</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: WHITE, marginTop: 4 }}>
              {faNumber(18)} کارتن استاندارد
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 12,
              padding: 12,
              border: `1px solid ${BORDER_GLASS}`,
            }}
          >
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>ظرفیت باقیمانده مجاز</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: CYAN, marginTop: 4 }}>
              {faNumber(4)} کارتن خالی
            </div>
          </div>
        </div>
      </div>

      {/* Real-time sync note */}
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
        با اسکن هر خروج از قفسه، کاردکس و موجودی سلول لحظه‌ای به‌روزرسانی می‌شود.
      </div>
    </ShelfStage>
  )
}

// ============================================
// Scene 5: Warehouse Precision Manifesto
// ============================================
export function WarehousePrecisionManifestoScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))

  const lines = [
    { title: 'انبار بدون نقشه، چاه سرمایه است', tone: CRIMSON },
    { title: '۳ ثانیه تا پیدا کردن هر قلم کالا', tone: CYAN },
    { title: 'صفر سردرگمی · صفر کسری پنهان', tone: EMERALD },
  ]

  return (
    <ShelfStage scene={scene} t={t} label="انضباط لجستیک و انبارداری حرفه‌ای">
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
        حسابچه // تسلط کامل انباردار و صاحب کسب‌وکار بر هر متر مربع فضا
      </div>
    </ShelfStage>
  )
}

// ============================================
// Scene 6: Obsidian Monolith CTA
// ============================================
export function WarehouseShelfCtaScene({ scene, t }: { scene: Scene; t: number }) {
  const dur = scene.end - scene.start
  const p = progress(t, 0, dur)
  const intro = spring(clamp(p * 2, 0, 1))
  const pulse = Math.sin(t * 5) * 0.15 + 0.85

  return (
    <ShelfStage scene={scene} t={t} label="شروع رایگان حسابچه">
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
        {/* Brand Emblem */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.2), rgba(0, 229, 255, 0.05))',
            border: `2px solid ${EMERALD}`,
            boxShadow: `0 0 35px ${EMERALD}55`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 38,
            marginBottom: 24,
          }}
        >
          📍
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
          قفسه‌بندی و کدینگ هوشمند انبار
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
          سامانه یکپارچه انبارداری، بارکد و مکان‌یابی کالا
        </p>

        {/* CTA Button */}
        <div
          style={{
            marginTop: 32,
            background: `linear-gradient(135deg, ${EMERALD}, #00C853)`,
            padding: '16px 36px',
            borderRadius: 16,
            color: '#000000',
            fontSize: 18,
            fontWeight: 800,
            direction: 'rtl',
            boxShadow: `0 0 ${25 * pulse}px ${EMERALD}aa`,
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
          NO HARDWARE LOCK // WEB · DESKTOP · MOBILE
        </div>
      </div>
    </ShelfStage>
  )
}
