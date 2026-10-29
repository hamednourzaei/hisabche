// ============================================
// One-True-Number Art Direction (Reel 83) — Bespoke SaaS Cinematic Motion
// The Quantum Financial Singularity & Indisputable Truth Ledger
//
// Arithmetic:
//   ۴۲٬۰۰۰ فروش − ۳۱٬۰۰۰ پرداخت = ۱۱٬۰۰۰ ماندهٔ مشتری
//   ۴۲۰٬۰۰۰ فروش − ۲۶۰٬۰۰۰ بهای تمام‌شده − ۷۰٬۰۰۰ هزینه = ۹۰٬۰۰۰ سود
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
export const DARK_PANEL = '#0f131f'
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
export function TrueStage({
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
        background: 'radial-gradient(circle at 50% 25%, #101426 0%, #08090f 75%, #030406 100%)',
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

// ─── Scene 1 — The Binary Dilemma: Two Conflicting Numbers ──────────────

export function TrueDilemmaScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 0.5)
  const conflictP = pop(t, 1.2)
  const shake = t > 1.2 && t < 2.0 ? Math.sin(t * 30) * 3 : 0

  return (
    <TrueStage scene={scene} t={t} label="// 01 · دو عدد متناقض برای یک مغازه">
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
          یک مغازه · پایان یک روز
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
          کدام عدد درست است؟
        </div>
      </div>

      {/* Two Conflicting Monoliths in Disjoint Lanes (y: 280..520) */}
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
        {/* Left Monolith: Register / Cash Drawer (x: 40..250) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 40,
            width: 210,
            height: 230,
            background: 'linear-gradient(145deg, #121829, #0a0e1a)',
            border: `2px solid ${CYAN}`,
            borderRadius: 24,
            boxShadow: `0 25px 60px rgba(0,0,0,0.8), 0 0 35px ${CYAN}33`,
            padding: 20,
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
            <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
              دخل صندوق
            </span>
          </div>

          <div
            style={{
              ...MONO,
              fontSize: 34,
              fontWeight: 900,
              color: CYAN,
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {faNumber(42000)}
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
            موجودی فیزیکی کشو
          </div>
        </div>

        {/* Right Monolith: Manual Ledger (x: 290..500) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 290,
            width: 210,
            height: 230,
            background: 'linear-gradient(145deg, #181218, #100a10)',
            border: `2px solid ${CRIMSON}`,
            borderRadius: 24,
            boxShadow: `0 25px 60px rgba(0,0,0,0.8), 0 0 35px ${CRIMSON}33`,
            padding: 20,
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
            <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
              دفتر سنتی
            </span>
          </div>

          <div
            style={{
              ...MONO,
              fontSize: 34,
              fontWeight: 900,
              color: CRIMSON,
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {faNumber(31000)}
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
            مجموع جمع دستی صفحات
          </div>
        </div>

        {/* Center High-Voltage Conflict Arc */}
        <div
          style={{
            position: 'absolute',
            top: 90,
            left: 250,
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            fontWeight: 900,
            color: '#ffffff',
            opacity: clamp(conflictP * 1.5),
          }}
        >
          ≠
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
          background: 'rgba(255, 61, 0, 0.12)',
          border: `1.5px solid ${CRIMSON}`,
          borderRadius: 22,
          padding: '18px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxShadow: `0 20px 50px rgba(0,0,0,0.8), 0 0 30px ${CRIMSON}33`,
          opacity: clamp(conflictP * 1.5),
          transform: `scale(${mix(0.85, 1, conflictP).toFixed(3)})`,
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
          <div style={{ fontSize: 17, fontWeight: 900, color: '#ffffff' }}>
            مغایرت ۱۱٬۰۰۰ تایی پای صندوق!
          </div>
          <div
            style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}
          >
            فروش متوقف شد؛ مشتری پای صندوق منتظر پاسخ است
          </div>
        </div>
      </div>
    </TrueStage>
  )
}

// ─── Scene 2 — Dialogue & Single Query Resolution ───────────────────────

export function TrueDialogueScene({ t, scene }: { t: number; scene: Scene }) {
  const qP = pop(t, 0.2)
  const scanP = ease(clamp(progress(t, 1.4, 3.2)))
  const ansP = pop(t, 3.4)
  const balanceP = pop(t, 5.0)

  return (
    <TrueStage scene={scene} t={t} label="// 02 · استعلام لحظه‌ای مانده مشتری">
      {/* Top Customer Question (Safe Zone y: 130..240) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 130,
          left: 40,
          right: 40,
          background: 'linear-gradient(145deg, #121828, #0c101c)',
          border: `1.5px solid ${CYAN}`,
          borderRadius: 20,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          opacity: clamp(qP * 1.5),
          transform: `translateY(${mix(20, 0, qP).toFixed(1)}px)`,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: `${CYAN}22`,
            border: `1px solid ${CYAN}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: CYAN,
            fontWeight: 900,
            fontSize: 16,
          }}
        >
          ؟
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: CYAN }}>سؤال مشتری ۱۰۴۲:</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            «این ماه دقیقاً چقدر خرید کردم و چقدر مانده؟»
          </div>
        </div>
      </div>

      {/* Center Titanium POS Cockpit (Safe Zone y: 260..580) */}
      <div
        style={{
          position: 'absolute',
          top: 260,
          left: 40,
          right: 40,
          height: 310,
          background: 'linear-gradient(145deg, #0d111a, #07090f)',
          border: '2px solid rgba(255,255,255,0.12)',
          borderRadius: 26,
          boxShadow: `0 30px 80px rgba(0,0,0,0.9), 0 0 40px ${CYAN}22`,
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
            REALTIME LEDGER
          </span>
          <span dir="rtl" style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            استعلام پرونده مشتری ۱۰۴۲
          </span>
        </div>

        {/* Scan Beam */}
        <div
          style={{
            height: 3,
            width: '100%',
            background: `linear-gradient(90deg, transparent, ${CYAN}, ${EMERALD}, transparent)`,
            boxShadow: `0 0 15px ${CYAN}`,
            opacity: scanP < 1 ? 1 : 0.2,
          }}
        />

        {/* Ledger Breakdown Rows */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: clamp(ansP * 1.5) }}
        >
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
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>پرداخت‌های ثبتی:</span>
            <span style={{ ...MONO, color: EMERALD, fontWeight: 900 }}>{faNumber(31000)}</span>
          </div>

          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: 12,
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
                background: 'rgba(255, 215, 0, 0.1)',
                border: `1px solid ${GOLD}44`,
                padding: '4px 14px',
                borderRadius: 10,
              }}
            >
              {faNumber(11000)}
            </span>
          </div>
        </div>
      </div>

      {/* Immediate Clarity Confirmation (Safe Zone y: 600..720) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 600,
          left: 40,
          right: 40,
          background: 'rgba(0, 230, 118, 0.12)',
          border: `1.5px solid ${EMERALD}`,
          borderRadius: 20,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: `0 20px 45px rgba(0,0,0,0.8), 0 0 25px ${EMERALD}33`,
          opacity: clamp(balanceP * 1.5),
          transform: `scale(${mix(0.85, 1, balanceP).toFixed(3)})`,
        }}
      >
        <span style={{ color: EMERALD, fontSize: 24, fontWeight: 900 }}>✓</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            پاسخ در ۰٫۲ ثانیه بدون مکث
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
            همان عددی که در دفتر دوبل، فاکتور و صندوق ثبت شده است
          </div>
        </div>
      </div>
    </TrueStage>
  )
}

// ─── Scene 3 — 1 Invoice, 5 Simultaneous Quantum Syncs ──────────────────

const SYNC_NODES = [
  { label: 'انبار مرکزی', act: 'کسر خودکار ۲ قلم', color: CYAN, x: 36, y: 190 },
  { label: 'سند دوبل مالی', act: 'ثبت در روزنامه', color: EMERALD, x: 284, y: 190 },
  { label: 'صندوق نقد', act: '+۳۱٬۰۰۰ دریافتی', color: GOLD, x: 36, y: 490 },
  { label: 'مانده مشتری', act: '+۱۱٬۰۰۰ طلب قطعی', color: '#B388FF', x: 284, y: 490 },
]

export function TrueQuantumSyncScene({ t, scene }: { t: number; scene: Scene }) {
  const invoiceP = pop(t, 0.2)
  const pulseLines = ease(clamp(progress(t, 1.0, 2.5)))

  return (
    <TrueStage scene={scene} t={t} label="// 03 · یک فاکتور، پنج ثبت همزمان">
      {/* Central Master Invoice Card (Safe Zone y: 310..470, x: 130..410) */}
      <div
        style={{
          position: 'absolute',
          top: 310,
          left: '50%',
          width: 280,
          height: 160,
          marginLeft: -140,
          background: 'linear-gradient(145deg, #131a2e, #0a0e1c)',
          border: `2px solid ${CYAN}`,
          borderRadius: 22,
          boxShadow: `0 25px 70px rgba(0,0,0,0.9), 0 0 45px ${CYAN}44`,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          opacity: clamp(invoiceP * 1.5),
          transform: `scale(${mix(0.8, 1, invoiceP).toFixed(3)})`,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              ...MONO,
              fontSize: 10,
              background: `${CYAN}22`,
              color: CYAN,
              padding: '2px 8px',
              borderRadius: 6,
              fontWeight: 800,
            }}
          >
            INVOICE #1042
          </span>
          <span dir="rtl" style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>
            فاکتور فروش
          </span>
        </div>

        <div dir="rtl" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
            مبلغ کل معامله
          </div>
          <div style={{ ...MONO, fontSize: 32, fontWeight: 900, color: '#ffffff' }}>
            {faNumber(42000)}
          </div>
        </div>

        <div
          dir="rtl"
          style={{ fontSize: 11, fontWeight: 800, color: EMERALD, textAlign: 'center' }}
        >
          ۱ کلیک = ۵ ثبت همزمان
        </div>
      </div>

      {/* 4 Peripheral Satellite Nodes (Disjoint coordinate quadrants) */}
      {SYNC_NODES.map((node, i) => {
        const p = pop(t, 1.2 + i * 0.18)
        return (
          <div
            key={node.label}
            style={{
              position: 'absolute',
              top: node.y,
              left: node.x,
              width: 220,
              height: 100,
              background: 'linear-gradient(145deg, #111524, #0a0c16)',
              border: `1.5px solid ${node.color}`,
              borderRadius: 18,
              boxShadow: `0 15px 40px rgba(0,0,0,0.7), 0 0 20px ${node.color}22`,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              opacity: clamp(p * 1.5),
              transform: `scale(${mix(0.85, 1, p).toFixed(3)})`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: node.color }} />
              <span dir="rtl" style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>
                {node.label}
              </span>
            </div>

            <div dir="rtl" style={{ fontSize: 12, fontWeight: 800, color: node.color }}>
              ✓ {node.act}
            </div>
          </div>
        )
      })}

      {/* Connecting Quantum Data Beams */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        <line
          x1="270"
          y1="390"
          x2="146"
          y2="240"
          stroke={CYAN}
          strokeWidth="1.5"
          strokeDasharray="6 6"
          opacity={pulseLines}
        />
        <line
          x1="270"
          y1="390"
          x2="394"
          y2="240"
          stroke={EMERALD}
          strokeWidth="1.5"
          strokeDasharray="6 6"
          opacity={pulseLines}
        />
        <line
          x1="270"
          y1="390"
          x2="146"
          y2="540"
          stroke={GOLD}
          strokeWidth="1.5"
          strokeDasharray="6 6"
          opacity={pulseLines}
        />
        <line
          x1="270"
          y1="390"
          x2="394"
          y2="540"
          stroke="#B388FF"
          strokeWidth="1.5"
          strokeDasharray="6 6"
          opacity={pulseLines}
        />
      </svg>

      {/* Bottom Summary Pill (y: 640..740) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 640,
          left: 40,
          right: 40,
          background: 'rgba(0, 180, 255, 0.08)',
          border: `1.5px solid ${CYAN}`,
          borderRadius: 18,
          padding: '14px 20px',
          textAlign: 'center',
          fontSize: 15,
          fontWeight: 900,
          color: '#ffffff',
        }}
      >
        هیچ ثبتی فراموش نمی‌شود · هیچ اختلافی رخ نمی‌دهد
      </div>
    </TrueStage>
  )
}

// ─── Scene 4 — The Profit Waterfall: Arithmetic Certainty ───────────────

export function TrueWaterfallScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.2)
  const p3 = pop(t, 2.2)
  const profitP = pop(t, 3.4)

  return (
    <TrueStage scene={scene} t={t} label="// 04 · سود واقعی بدون حدس">
      {/* Top Headline (y: 120..220) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 120,
          left: 0,
          right: 0,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 900, color: 'rgba(255,255,255,0.7)' }}>
          مسیر رسیدن به
        </div>
        <div
          style={{
            fontSize: 42,
            fontWeight: 900,
            color: EMERALD,
            textShadow: `0 0 25px ${EMERALD}55`,
          }}
        >
          سود واقعی و خالص
        </div>
      </div>

      {/* 3 Step Waterfall Stack (Safe Zone y: 240..500) */}
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
        {/* Step 1: Gross Sales */}
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
          <span style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>فروش کل دوره:</span>
          <span style={{ ...MONO, fontSize: 22, fontWeight: 900, color: CYAN }}>
            {faNumber(420000)}
          </span>
        </div>

        {/* Step 2: Cost of Goods Sold */}
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
            opacity: clamp(p2 * 1.5),
            transform: `translateY(${mix(20, 0, p2).toFixed(1)}px)`,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            بهای تمام‌شده کالا (خرید):
          </span>
          <span style={{ ...MONO, fontSize: 22, fontWeight: 900, color: CRIMSON }}>
            − {faNumber(260000)}
          </span>
        </div>

        {/* Step 3: Operating Expenses */}
        <div
          dir="rtl"
          style={{
            background: 'linear-gradient(145deg, #1a1710, #120f0a)',
            border: `1.5px solid ${GOLD}`,
            borderRadius: 16,
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: clamp(p3 * 1.5),
            transform: `translateY(${mix(20, 0, p3).toFixed(1)}px)`,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
            هزینه‌های جاری و اجاره:
          </span>
          <span style={{ ...MONO, fontSize: 22, fontWeight: 900, color: GOLD }}>
            − {faNumber(70000)}
          </span>
        </div>
      </div>

      {/* Bottom Result Monolith: The Pure Net Profit (Safe Zone y: 530..720) */}
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
          opacity: clamp(profitP * 1.5),
          transform: `scale(${mix(0.85, 1, profitP).toFixed(3)})`,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>
          سود خالص و قطعی در جیب شما:
        </div>
        <div
          style={{
            ...MONO,
            fontSize: 48,
            fontWeight: 900,
            color: EMERALD,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {faNumber(90000)}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
          بدون یک ریال تخمین یا خطای ذهنی
        </div>
      </div>
    </TrueStage>
  )
}

// ─── Scene 5 — Manifesto: One True Number ───────────────────────────────

export function TrueManifestoScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 1.2)
  const p3 = pop(t, 2.2)

  return (
    <TrueStage scene={scene} t={t} label="// 05 · بیانیه شفافیت">
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
          gap: 24,
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            color: '#ffffff',
            opacity: clamp(p1 * 1.5),
            transform: `scale(${mix(0.8, 1, p1).toFixed(3)})`,
            textAlign: 'center',
          }}
        >
          نه حدس…
        </div>

        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            color: 'rgba(255,255,255,0.7)',
            opacity: clamp(p2 * 1.5),
            transform: `scale(${mix(0.8, 1, p2).toFixed(3)})`,
            textAlign: 'center',
          }}
        >
          نه دفتر دوم…
        </div>

        <div
          style={{
            fontSize: 52,
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
          فقط یک عدد واقعی!
        </div>
      </div>

      {/* Architectural Guarantee Pill Below (y: 600..720) */}
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
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: EMERALD, fontSize: 20 }}>✓</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
            فروش و انبار و سود همیشه ترازند
          </span>
        </div>
        <span style={{ ...MONO, fontSize: 12, color: CYAN, fontWeight: 800 }}>SYNCHRONIZED</span>
      </div>
    </TrueStage>
  )
}

// ─── Scene 6 — Brand Monolith & Conversion CTA ──────────────────────────

export function TrueCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const brandP = pop(t, 0.2)
  const btnP = pop(t, 1.4)

  return (
    <TrueStage scene={scene} t={t} label="// 06 · شروع رایگان حسابچه">
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
          نرم‌افزار مالی یکپارچه مغازه و کارگاه
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
          شروع رایگان
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
        بدون نیاز به کارت بانکی · نصب در کمتر از ۱ دقیقه
      </div>
    </TrueStage>
  )
}
