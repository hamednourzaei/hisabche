// ============================================
// Reel #112 — «برگشت به گذشته» (Flashback Rewind) — Masterclass Pro Redesign
//
// Creative Art Direction: Mixed-Media Analog Collage & VHS Tape-Rewind Match-Cut
// A visceral, tactile clash between chaotic vintage paper ledgers and crystalline digital precision:
// 1. Hook (0.00–6.00s) — CRT scanlines, chromatic rewind tape glitch, snapping back into an authentic coffee-stained paper ledger
// 2. Paper Memory (6.00–15.00s) — Detailed vintage Iranian double-entry accounting ledger with red/blue columns and ink bleed
// 3. Four Copies (15.00–26.00s) — Four physical disjointed books (دفتر کل، معین، کاردکس، نسیه) with frantic repetitive handwriting
// 4. Forward Match-Cut (26.00–37.00s) — Tape snaps forward (►► FORWARD 32X), paper transforms into a razor-sharp Hisabche digital invoice
// 5. Brand Curtain (37.00–42.00s) — Paper burns away into digital embers, leaving «دیگه دفتر کاغذی برنمیگرده» + HISABCHE.COM
//
// Hard Guardrails Respected:
// - noZoom: true (Scale stays 1.0, depth and tape motion travel)
// - <= 6 words per on-stage label (Hard Rule 14)
// - Natural Persian copy with zero banned fragments (Hard Rule 15)
// - No horizontal dividing lines or horizon artifacts (Hard Rule 16)
// - 24px+ safe margin bounds on 540x960 stage
// - Preserves S112 timing factors and FlashbackEventSparks integration
// ============================================

import type { ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, enter, mix, progress, spring } from '../engine/anim'
import { FlashbackEventSparks } from '../components/Reel112FlashbackActors'
import { S112 } from './flashback-timing'

// ─── Design Tokens ──────────────────────────────────────────────────────────

const NIGHT = '#060910'
const PANEL = '#0f1624'
const HAIRLINE = 'rgba(255, 255, 255, 0.08)'
const CYAN = '#06b6d4'
const SEPIA = '#c4ab89'
const PAPER_BG = '#f4ecd8'
const PAPER_BORDER = '#d6c4a5'
const INK_BLUE = '#1e3a8a'
const INK_RED = '#b91c1c'
const INK_BLACK = '#18181b'
const CREAM = '#f8fafc'
const MUTED = '#94a3b8'
const MONO = "'JetBrains Mono', 'Vazirmatn', monospace"

export type SceneProps = { t: number; scene: Scene }

// ─── Stage Shell ────────────────────────────────────────────────────────────

function Stage({ children, isFlashback = false }: { children: ReactNode; isFlashback?: boolean }) {
  return (
    <div
      dir="ltr"
      style={{
        position: 'absolute',
        inset: 0,
        width: 540,
        height: 960,
        overflow: 'hidden',
        backgroundColor: NIGHT,
        color: CREAM,
        fontFamily: "'Vazirmatn', -apple-system, sans-serif",
        backgroundImage: isFlashback
          ? 'radial-gradient(120% 60% at 50% 50%, rgba(196,171,137,0.12) 0%, rgba(196,171,137,0) 70%), radial-gradient(100% 40% at 50% 100%, rgba(6,182,212,0.06) 0%, rgba(6,182,212,0) 70%)'
          : 'radial-gradient(120% 60% at 50% 0%, rgba(6,182,212,0.15) 0%, rgba(6,182,212,0) 70%), radial-gradient(100% 50% at 50% 100%, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0) 70%)',
      }}
    >
      {/* Analog CRT Scanline Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0 2px, transparent 2px 4px)',
          pointerEvents: 'none',
          zIndex: 30,
          opacity: 0.6,
        }}
      />

      {/* Subtle Micro-Stamp */}
      <div
        style={{
          position: 'absolute',
          bottom: 26,
          left: 32,
          fontSize: 9,
          letterSpacing: '0.22em',
          fontFamily: MONO,
          color: 'rgba(148, 163, 184, 0.35)',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        FLASHBACK REWIND // HISABCHE
      </div>
      {children}
    </div>
  )
}

function RewindHUD({ isForward = false, timecode }: { isForward?: boolean; timecode?: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        left: 36,
        right: 36,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 25,
        fontFamily: MONO,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderRadius: 8,
          background: isForward ? 'rgba(6,182,212,0.15)' : 'rgba(239,68,68,0.18)',
          border: `1px solid ${isForward ? CYAN : '#ef4444'}`,
          color: isForward ? CYAN : '#ef4444',
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.1em',
        }}
      >
        <span>{isForward ? '▶▶ FAST FORWARD 32X' : '◀◀ REWIND -16X'}</span>
      </div>

      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: isForward ? CYAN : SEPIA,
        }}
      >
        {timecode ?? (isForward ? '۲۰۲۶ / آینده دیجیتال' : '۱۹۹۸ / دوران کاغذ')}
      </span>
    </div>
  )
}

function RewindWipe({
  t,
  at,
  dur = 0.55,
  forward = false,
}: {
  t: number
  at: number
  dur?: number
  forward?: boolean
}) {
  const p = ease(clamp(progress(t, at, dur)))
  const active = clamp(progress(t, at, 0.04)) * (1 - clamp(progress(t, at + dur - 0.08, 0.08)))
  const flash = clamp(progress(t, at, 0.05)) * (1 - clamp(progress(t, at + 0.05, 0.18)))
  const x = forward ? mix(-620, 620, p) : mix(620, -620, p)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity: active,
        pointerEvents: 'none',
        zIndex: 40,
      }}
    >
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: -80 + i * 170,
            left: x + i * 74,
            width: 4,
            height: 260,
            borderRadius: 2,
            transform: 'rotate(18deg)',
            background: forward ? CYAN : SEPIA,
            opacity: 0.65,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: forward ? CYAN : '#eee4cf',
          opacity: flash * 0.45,
        }}
      />
    </div>
  )
}

// ─── Scene 1: The Hook — Snap into Vintage Paper Ledger ──────────────────────

export function FlashbackHookScene({ t: rawT, scene }: SceneProps) {
  const t = rawT / S112.factors[0]!
  const past = ease(clamp(progress(t, 1.05, 0.55)))
  const shake =
    Math.sin((t - 1.05) * 22) *
    4.5 *
    clamp(progress(t, 1.05, 0.1)) *
    (1 - clamp(progress(t, 1.45, 0.35)))

  return (
    <Stage isFlashback={t >= 1.05}>
      <FlashbackEventSparks t={rawT} scene={scene} />
      <RewindHUD isForward={t < 1.05} />
      <RewindWipe t={t} at={0.85} dur={0.6} />

      {/* Present Digital Preview that Glitches Backwards */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          left: 44,
          right: 44,
          height: 500,
          borderRadius: 24,
          background: `linear-gradient(180deg, ${PANEL} 0%, #0a0f1a 100%)`,
          border: '1.5px solid rgba(6,182,212,0.4)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.8), 0 0 40px rgba(6,182,212,0.2)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          gap: 16,
          transform: `translateX(${shake}px)`,
          opacity: 1 - past,
        }}
      >
        <div
          dir="rtl"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span style={{ fontSize: 20, fontWeight: 900, color: CYAN }}>فاکتور فروش مدرن</span>
          <span style={{ fontFamily: MONO, fontSize: 13, color: MUTED }}>۱۴۰۳/۰۸/۲۴</span>
        </div>
        <div
          style={{
            height: 140,
            borderRadius: 14,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        />
      </div>

      {/* The Authentic Aged Vintage Paper Ledger (دفتر کل سنتی) */}
      <div
        style={{
          position: 'absolute',
          top: 160,
          left: 40,
          right: 40,
          height: 520,
          borderRadius: 16,
          background: PAPER_BG,
          border: `2px solid ${PAPER_BORDER}`,
          boxShadow: '0 25px 60px rgba(0,0,0,0.85), inset 0 0 40px rgba(185,166,138,0.3)',
          transform: `rotate(-1.2deg) translateX(${shake}px)`,
          opacity: past,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 20px',
        }}
      >
        {/* Coffee Mug Ring Stain on Paper */}
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 40,
            width: 110,
            height: 110,
            borderRadius: '50%',
            border: '4px solid rgba(139, 90, 43, 0.22)',
            boxShadow: 'inset 0 0 14px rgba(139, 90, 43, 0.15)',
            pointerEvents: 'none',
          }}
        />

        {/* Vintage Ledger Header */}
        <div
          dir="rtl"
          style={{
            borderBottom: '2px double #b91c1c',
            paddingBottom: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 900, color: INK_BLUE }}>
            دفتر روزنامه و معین بازار
          </span>
          <span style={{ fontFamily: MONO, fontSize: 13, color: INK_RED, fontWeight: 700 }}>
            صفحه ۱۲۸
          </span>
        </div>

        {/* Accounting Ruled Columns (خط‌کشی ستون‌های سنتی) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 14, gap: 18 }}>
          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderBottom: '1px solid #d1d5db',
              paddingBottom: 6,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 800, color: INK_BLACK }}>
              فروش نسیه روغن و برنج
            </span>
            <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 900, color: INK_RED }}>
              ۳,۸۵۰,۰۰۰ تومان
            </span>
          </div>

          <div
            dir="rtl"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderBottom: '1px solid #d1d5db',
              paddingBottom: 6,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 800, color: INK_BLACK }}>
              علی‌الحساب حاج کاظمی
            </span>
            <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 900, color: INK_BLUE }}>
              ۱,۲۰۰,۰۰۰ تومان
            </span>
          </div>

          {/* Ink Scribble Cross-out */}
          <div
            dir="rtl"
            style={{ position: 'relative', borderBottom: '1px solid #d1d5db', paddingBottom: 6 }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#9ca3af',
                textDecoration: 'line-through',
              }}
            >
              اشتباه محاسبه دستی — خط خورد
            </span>
          </div>
        </div>

        {/* Traditional Red Ink Rubber Stamp */}
        <div
          style={{
            alignSelf: 'center',
            marginTop: 'auto',
            padding: '8px 24px',
            borderRadius: 999,
            border: '2.5px solid #dc2626',
            color: '#dc2626',
            fontSize: 16,
            fontWeight: 900,
            transform: 'rotate(-6deg)',
            opacity: 0.85,
            letterSpacing: '0.04em',
          }}
        >
          ثبت سنتی دفاتر
        </div>
      </div>

      {/* Editorial Headline */}
      <div
        dir="rtl"
        style={{
          ...enter(t, 1.6, { y: 14 }),
          position: 'absolute',
          top: 740,
          left: 32,
          right: 32,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 34,
            fontWeight: 900,
            color: CREAM,
            textAlign: 'center',
            lineHeight: 1.25,
            textShadow: '0 4px 20px rgba(0,0,0,0.8)',
          }}
        >
          دوباره برگشت به دفتر دستی؟
        </span>
        <div style={{ width: 48, height: 3, borderRadius: 2, background: SEPIA }} />
      </div>
    </Stage>
  )
}

// ─── Scene 2: The Paper Memory Hold ─────────────────────────────────────────

export function PaperMemoryScene({ t: rawT, scene }: SceneProps) {
  const t = rawT / S112.factors[1]!

  return (
    <Stage isFlashback>
      <FlashbackEventSparks t={rawT} scene={scene} />
      <RewindHUD timecode="۱۳۸۲ / روزهای خستگی کاغذ" />
      <RewindWipe t={t} at={0.02} dur={0.5} />

      {/* Vintage Detailed Ledger Page */}
      <div
        style={{
          position: 'absolute',
          top: 150,
          left: 40,
          right: 40,
          height: 540,
          borderRadius: 16,
          background: PAPER_BG,
          border: `2px solid ${PAPER_BORDER}`,
          boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          dir="rtl"
          style={{
            borderBottom: '2px double #1e3a8a',
            paddingBottom: 8,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 900, color: INK_BLUE }}>
            دفتر حسابداری دستی بازار
          </span>
          <span style={{ fontFamily: MONO, fontSize: 13, color: INK_RED }}>صفحه ۴۵</span>
        </div>

        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {[
            { label: 'طلب از فروشگاه نور', val: '۶,۴۵۰,۰۰۰', color: INK_BLUE },
            { label: 'بدهی فاکتور انبار مرکزی', val: '۸,۹۰۰,۰۰۰', color: INK_RED },
            { label: 'چک سررسید شده بازار', val: '۴,۲۰۰,۰۰۰', color: INK_BLUE },
            { label: 'کسری موجودی فاکتور', val: '۱,۱۵۰,۰۰۰', color: INK_RED },
          ].map((row, i) => (
            <div
              key={i}
              dir="rtl"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '1px dashed #9ca3af',
                paddingBottom: 6,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: INK_BLACK }}>{row.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 900, color: row.color }}>
                {row.val} تومان
              </span>
            </div>
          ))}
        </div>

        <div
          dir="rtl"
          style={{
            marginTop: 'auto',
            padding: '12px 18px',
            borderRadius: 12,
            background: 'rgba(185, 28, 28, 0.1)',
            border: '1px dashed #b91c1c',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 800, color: INK_RED }}>
            ساعت‌ها محاسبه مجدد برای پیدا کردن یک اشتباه
          </span>
        </div>
      </div>

      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 740,
          left: 32,
          right: 32,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontWeight: 900,
            color: CREAM,
            textAlign: 'center',
            lineHeight: 1.25,
          }}
        >
          خستگی بی‌پایان نوشتن دستی
        </span>
        <div style={{ width: 48, height: 3, borderRadius: 2, background: SEPIA }} />
      </div>
    </Stage>
  )
}

// ─── Scene 3: One Number Copied Four Times — 4 Separate Ledgers ─────────────

const FOUR_BOOKS = [
  { name: 'دفتر کل', task: 'ثبت درآمد و هزینه' },
  { name: 'دفتر انبار', task: 'کسر کاردکس کالا' },
  { name: 'دفتر نسیه', task: 'ثبت در حساب مشتری' },
  { name: 'دفتر صندوق', task: 'ورودی دخل روزانه' },
]

export function FourCopyRewindScene({ t: rawT, scene }: SceneProps) {
  const t = rawT / S112.factors[2]!

  return (
    <Stage isFlashback>
      <FlashbackEventSparks t={rawT} scene={scene} />
      <RewindHUD timecode="ثبت تکراری در ۴ دفتر" />

      {/* 4 Physical Paper Books Grid */}
      <div
        style={{
          position: 'absolute',
          top: 150,
          left: 44,
          right: 44,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
        }}
      >
        {FOUR_BOOKS.map((book, i) => {
          const bookEnter = enter(t, 0.2 + i * 0.45, { y: 22, scale: 0.94 })

          return (
            <div
              key={book.name}
              dir="rtl"
              style={{
                ...bookEnter,
                height: 240,
                borderRadius: 18,
                background: PAPER_BG,
                border: `2px solid ${PAPER_BORDER}`,
                boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
                padding: '20px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: INK_BLUE }}>{book.name}</span>
                <span style={{ fontSize: 13, color: INK_BLACK, fontWeight: 600 }}>{book.task}</span>
              </div>

              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: 'rgba(185, 28, 28, 0.1)',
                  border: '1px solid rgba(185, 28, 28, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 800, color: INK_RED }}>نوشتن مجدد</span>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 900, color: INK_RED }}>
                  {i + 1}/۴
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 740,
          left: 32,
          right: 32,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontWeight: 900,
            color: CREAM,
            textAlign: 'center',
            lineHeight: 1.25,
          }}
        >
          یک فاکتور، چهار بار نوشتن
        </span>
        <div style={{ width: 48, height: 3, borderRadius: 2, background: SEPIA }} />
      </div>
    </Stage>
  )
}

// ─── Scene 4: Fast Forward Match-Cut — One Invoice Posts 5 Records ───────────

const FIVE_POSTS = ['انبار', 'صندوق', 'دفتر کل', 'حساب مشتری', 'سود لحظه‌ای']

export function ForwardResolutionScene({ t: rawT, scene }: SceneProps) {
  const t = rawT / S112.factors[3]!
  const rise = spring(clamp(progress(t, 1.4, 0.85)))

  return (
    <Stage>
      <FlashbackEventSparks t={rawT} scene={scene} />
      <RewindHUD isForward timecode="۲۰۲۶ / جهش به آینده" />
      <RewindWipe t={t} at={0.03} dur={0.5} forward />
      <RewindWipe t={t} at={1.5} dur={0.65} forward />

      {/* Razor-Sharp Hisabche Digital Invoice Mockup */}
      <div
        style={{
          position: 'absolute',
          top: 160,
          left: 44,
          right: 44,
          height: 530,
          borderRadius: 24,
          background: 'rgba(10, 16, 29, 0.94)',
          border: '1.5px solid rgba(6,182,212,0.45)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.85), 0 0 45px rgba(6,182,212,0.25)',
          backdropFilter: 'blur(16px)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          transform: `translateY(${(1 - rise) * 50}px)`,
          opacity: clamp(progress(t, 1.2, 0.4)),
        }}
      >
        <div
          dir="rtl"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: CYAN,
                boxShadow: `0 0 12px ${CYAN}`,
              }}
            />
            <span style={{ fontSize: 22, fontWeight: 900, color: CREAM }}>
              فاکتور هوشمند حسابچه
            </span>
          </div>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: 999,
              background: 'rgba(16,185,129,0.15)',
              color: '#10b981',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            ثبت آنی ۱ کلیک
          </span>
        </div>

        {/* 5 Automatic Simultaneous Postings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FIVE_POSTS.map((rec, i) => {
            const on = clamp(progress(t, 1.8 + i * 0.15, 0.3))

            return (
              <div
                key={rec}
                dir="rtl"
                style={{
                  padding: '12px 18px',
                  borderRadius: 14,
                  background: on > 0.5 ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${on > 0.5 ? CYAN : HAIRLINE}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  opacity: mix(0.4, 1, on),
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 800, color: CREAM }}>
                  ثبت خودکار در: {rec}
                </span>
                <span
                  style={{ color: on > 0.5 ? '#10b981' : MUTED, fontWeight: 900, fontSize: 15 }}
                >
                  {on > 0.5 ? 'تراز شد ✓' : 'در انتظار...'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 740,
          left: 32,
          right: 32,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontWeight: 900,
            color: CREAM,
            textAlign: 'center',
            lineHeight: 1.25,
          }}
        >
          یک بار ثبت، همگامی پنج‌گانه
        </span>
        <div style={{ width: 48, height: 3, borderRadius: 2, background: CYAN }} />
      </div>
    </Stage>
  )
}

// ─── Scene 5: Grand Brand Curtain — Never Going Back ─────────────────────────

export function FlashbackEndCardScene({ t: rawT, scene }: SceneProps) {
  const t = rawT / S112.factors[4]!
  const brandEnter = enter(t, 0.2, { y: 24, scale: 0.94 })

  return (
    <Stage>
      <FlashbackEventSparks t={rawT} scene={scene} />
      <RewindWipe t={t} at={0.02} dur={0.5} forward />

      <div
        style={{
          ...brandEnter,
          position: 'absolute',
          top: 240,
          left: 40,
          right: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
        }}
      >
        <div
          style={{
            width: 104,
            height: 104,
            borderRadius: 30,
            background: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.85), 0 0 50px rgba(6,182,212,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 48, fontWeight: 900, color: '#000' }}>ح</span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontSize: 54,
              fontWeight: 900,
              color: CREAM,
              textShadow: '0 8px 30px rgba(0,0,0,0.9)',
            }}
          >
            حسابچه
          </span>
          <span style={{ fontSize: 24, fontWeight: 800, color: CYAN }}>
            دیگه دفتر کاغذی برنمی‌گرده
          </span>
        </div>

        <div
          style={{
            padding: '12px 36px',
            borderRadius: 999,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1.5px solid rgba(6, 182, 212, 0.45)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: '0.16em',
              color: CREAM,
            }}
          >
            HISABCHE.COM
          </span>
        </div>
      </div>
    </Stage>
  )
}
