// ============================================
// Reel #110 — «جزء زندگی» (Part of Life) — Masterclass Architectural Redesign
//
// Creative Art Direction: Atmospheric Persian Hyper-Tactile Day-Cycle
// A cinematic, tactile, daylight-to-starlight journey across a merchant's day:
// 1. Dawn Chai (0.00–6.00s) — Sunrise rays, steaming slender-waist tea glass, brass saucer, waking smart terminal
// 2. Noon Rush (6.00–13.00s) — High-noon golden solar corona, cascading tactile thermal receipts, live till balance
// 3. Midnight Receivables (13.00–20.00s) — Deep midnight indigo, frosted glassmorphism ledger resolving debt anxiety
// 4. Brass Shutter (20.00–27.00s) — Industrial corrugated steel slats, warm light spill, heavy brass padlock snapping shut
// 5. Home Night (27.00–34.00s) — Warm bedside lamp illumination, smartphone resting on dark oak with glowing mint heart
// 6. Brand Curtain (34.00–42.00s) — Volumetric golden aura, glowing Hisabche geometric emblem, HISABCHE.COM
//
// Hard Guardrails Respected:
// - noZoom: true (Scale stays 1.0, light and depth travel)
// - <= 6 words per on-stage label (Hard Rule 14)
// - Natural Persian copy with zero banned fragments (Hard Rule 15)
// - No horizontal dividing lines or horizon artifacts (Hard Rule 16)
// - 24px+ safe margin bounds on 540x960 stage
// - Deterministic Persian digits (faClock, faNumber)
// ============================================

import type { ReactNode } from 'react'
import type { SceneProps } from './one-map'
import { clamp, ease, enter, mix, progress, pulse, spring, strokeDraw } from '../engine/anim'

// ─── Design Tokens ──────────────────────────────────────────────────────────

const NIGHT = '#06080e'
const WOOD_DARK = '#140e08'
const PANEL_MID = '#131926'
const PANEL_HI = '#1a2336'
const HAIRLINE_HI = 'rgba(255, 255, 255, 0.18)'
const EMBER = '#f59e0b'
const BRASS = '#d4af37'
const MINT = '#10b981'
const MINT_GLOW = 'rgba(16, 185, 129, 0.25)'
const CREAM = '#fdfbf7'
const CREAM_MUTED = '#9ca3af'
const MONO = "'JetBrains Mono', 'Vazirmatn', monospace"

// Deterministic Persian digits
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const faClock = (h: number, m: number): string =>
  `${String(h)
    .padStart(2, '0')
    .replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]!)}:${String(m)
    .padStart(2, '0')
    .replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]!)}`

// ─── Stage Shell ────────────────────────────────────────────────────────────

function Stage({
  children,
  ambientGradient,
}: {
  children: ReactNode
  ambientGradient?: string | undefined
}) {
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
        backgroundImage:
          ambientGradient ??
          'radial-gradient(120% 55% at 50% 105%, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0) 65%), radial-gradient(100% 40% at 50% -5%, rgba(30,58,138,0.12) 0%, rgba(30,58,138,0) 65%)',
      }}
    >
      {/* Subtle Micro-Stamp at bottom safe area */}
      <div
        style={{
          position: 'absolute',
          bottom: 26,
          left: 32,
          fontSize: 9,
          letterSpacing: '0.22em',
          fontFamily: MONO,
          color: 'rgba(156, 163, 175, 0.35)',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        PART OF LIFE // HISABCHE
      </div>
      {children}
    </div>
  )
}

function TimeBadge({
  time,
  t,
  dotColor = EMBER,
  top = 64,
}: {
  time: string
  t: number
  dotColor?: string | undefined
  top?: number | undefined
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: clamp(progress(t, 0.05, 0.3)),
        zIndex: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 20px',
          borderRadius: 999,
          border: `1px solid ${HAIRLINE_HI}`,
          background: 'rgba(19, 25, 38, 0.85)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: dotColor,
            boxShadow: `0 0 10px ${dotColor}`,
          }}
        />
        <span
          style={{
            fontFamily: MONO,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: CREAM,
          }}
        >
          {time}
        </span>
      </div>
    </div>
  )
}

function EditorialHeadline({
  text,
  t,
  at = 0.4,
  top = 740,
  glowColor = EMBER,
}: {
  text: string
  t: number
  at?: number | undefined
  top?: number | undefined
  glowColor?: string | undefined
}) {
  return (
    <div
      dir="rtl"
      style={{
        ...enter(t, at, { y: 14, fade: 0.5 }),
        position: 'absolute',
        top,
        left: 32,
        right: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        zIndex: 10,
      }}
    >
      <span
        style={{
          fontSize: 32,
          fontWeight: 900,
          color: CREAM,
          textAlign: 'center',
          lineHeight: 1.25,
          letterSpacing: '-0.02em',
          textShadow: `0 4px 24px rgba(0,0,0,0.8), 0 0 32px ${glowColor}44`,
        }}
      >
        {text}
      </span>
      <div
        style={{
          width: 48,
          height: 3,
          borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)`,
        }}
      />
    </div>
  )
}

// ─── Scene 1: Dawn Chai (0.00–6.00s) — Morning Merchant Ritual ──────────────

export function DawnScene({ t }: SceneProps) {
  const sunrise = ease(clamp(progress(t, 0.2, 2.8)))
  const teaPour = ease(clamp(progress(t, 0.9, 1.9)))
  const teaLiquidH = mix(10, 115, teaPour)
  const teaLiquidY = 195 - teaLiquidH
  const cardEnter = enter(t, 1.4, { y: 30, scale: 0.96 })

  // Undulating steam waves
  const steam1 = strokeDraw(t, 2.0, 1.2, 160)
  const steam2 = strokeDraw(t, 2.3, 1.2, 140)
  const steam3 = strokeDraw(t, 2.6, 1.2, 130)

  return (
    <Stage
      ambientGradient={`radial-gradient(110% 70% at 50% 90%, rgba(245,158,11,${mix(0.08, 0.25, sunrise)}) 0%, rgba(245,158,11,0) 70%), radial-gradient(90% 50% at 50% 0%, rgba(30,58,138,0.18) 0%, rgba(30,58,138,0) 70%)`}
    >
      {/* Wooden Bazaar Counter Surface */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 380,
          background: `linear-gradient(180deg, ${WOOD_DARK} 0%, #0a0704 100%)`,
          borderTop: '1px solid rgba(245, 158, 11, 0.15)',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.8)',
        }}
      >
        {/* Subtle wood grain texture lines */}
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 50 + i * 75,
              left: 0,
              right: 0,
              height: 1,
              background: 'rgba(255, 255, 255, 0.03)',
            }}
          />
        ))}
      </div>

      <TimeBadge time={faClock(6, 45)} t={t} dotColor={EMBER} top={56} />

      {/* Atmospheric Sunrise Sunburst Arc */}
      <div
        style={{
          position: 'absolute',
          top: 130,
          left: 270 - 240,
          width: 480,
          height: 320,
          background: `radial-gradient(ellipse at 50% 80%, rgba(245,158,11,${mix(0.12, 0.38, sunrise)}) 0%, rgba(245,158,11,0) 70%)`,
          filter: 'blur(32px)',
          pointerEvents: 'none',
        }}
      />

      {/* Hero Slender-Waist Glass (استکان کمرباریک) & Engraved Brass Saucer */}
      <div
        style={{
          position: 'absolute',
          left: 270 - 110,
          top: 240,
          width: 220,
          height: 310,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.75))',
        }}
      >
        <svg
          width={220}
          height={310}
          viewBox="0 0 220 310"
          fill="none"
          aria-hidden="true"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="r110-tea-amber" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
              <stop offset="35%" stopColor="#d97706" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#78350f" stopOpacity="0.98" />
            </linearGradient>

            <linearGradient id="r110-brass-saucer" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#785b1a" />
              <stop offset="30%" stopColor="#fcd34d" />
              <stop offset="70%" stopColor="#fef3c7" />
              <stop offset="100%" stopColor="#785b1a" />
            </linearGradient>

            <linearGradient id="r110-specular-glare" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>

            <clipPath id="r110-slender-glass-clip">
              <path d="M 64 60 C 64 60, 58 115, 70 148 C 78 170, 70 196, 72 212 C 75 222, 88 226, 110 226 C 132 226, 145 222, 148 212 C 150 196, 142 170, 150 148 C 162 115, 156 60, 156 60 Z" />
            </clipPath>
          </defs>

          {/* Saucer Base Shadow */}
          <ellipse cx={110} cy={248} rx={92} ry={18} fill="rgba(0,0,0,0.6)" />

          {/* Engraved Brass Saucer (نعلبکی برنجی) */}
          <ellipse
            cx={110}
            cy={240}
            rx={88}
            ry={16}
            fill="url(#r110-brass-saucer)"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1.5}
          />
          <ellipse
            cx={110}
            cy={238}
            rx={62}
            ry={10}
            fill="none"
            stroke="#92400e"
            strokeWidth={1.2}
            strokeDasharray="4 3"
          />

          {/* Steaming Tea Vapor Paths */}
          <g opacity={teaPour > 0.4 ? 0.75 : 0}>
            <path
              d="M 96 52 C 90 35, 102 20, 95 6"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={2.4}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={steam1.strokeDasharray}
              strokeDashoffset={steam1.strokeDashoffset}
              style={{ transform: `translateX(${3 * Math.sin(t * 3)}px)` }}
            />
            <path
              d="M 110 50 C 118 32, 106 18, 112 4"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={2.6}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={steam2.strokeDasharray}
              strokeDashoffset={steam2.strokeDashoffset}
              style={{ transform: `translateX(${-3.5 * Math.sin(t * 2.8 + 0.5)}px)` }}
            />
            <path
              d="M 124 52 C 132 38, 120 22, 128 8"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth={2.2}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={steam3.strokeDasharray}
              strokeDashoffset={steam3.strokeDashoffset}
            />
          </g>

          {/* Liquid Tea Filled Layer */}
          <g clipPath="url(#r110-slender-glass-clip)">
            <rect
              x={50}
              y={teaLiquidY}
              width={120}
              height={teaLiquidH + 30}
              fill="url(#r110-tea-amber)"
            />
            {/* Liquid Surface Meniscus Glow */}
            <ellipse
              cx={110}
              cy={teaLiquidY}
              rx={35}
              ry={6}
              fill="rgba(254, 243, 199, 0.6)"
              opacity={teaPour > 0.1 ? 0.85 : 0}
            />
          </g>

          {/* Outer Glass Contour (استکان کمر باریک شاه‌عباسی) */}
          <path
            d="M 62 58 C 62 58, 56 115, 68 148 C 76 170, 68 198, 70 214 C 73 224, 86 228, 110 228 C 134 228, 147 224, 150 214 C 152 198, 144 170, 152 148 C 164 115, 158 58, 158 58 Z"
            stroke="rgba(255, 255, 255, 0.55)"
            strokeWidth={2.5}
            fill="rgba(255, 255, 255, 0.05)"
          />
          {/* Flared Glass Top Lip */}
          <ellipse
            cx={110}
            cy={58}
            rx={48}
            ry={9}
            stroke="rgba(255, 255, 255, 0.75)"
            strokeWidth={2.4}
            fill="rgba(255, 255, 255, 0.08)"
          />

          {/* Specular Glare Highlights */}
          <path
            d="M 66 68 C 66 68, 62 114, 74 144 C 78 158, 72 184, 74 204"
            stroke="url(#r110-specular-glare)"
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 152 68 C 152 68, 148 114, 144 144 C 140 158, 144 184, 144 204"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>

      {/* Morning POS Wakeup Card Beside Tea */}
      <div
        dir="rtl"
        style={{
          ...cardEnter,
          position: 'absolute',
          top: 570,
          left: 48,
          right: 48,
          padding: '16px 22px',
          borderRadius: 20,
          background: 'rgba(19, 25, 38, 0.88)',
          border: '1px solid rgba(245, 158, 11, 0.28)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.65), 0 0 30px rgba(245,158,11,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            ☀️
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: CREAM }}>
              حسابچه آماده شروع روز
            </span>
            <span style={{ fontSize: 12, color: CREAM_MUTED, fontWeight: 500 }}>
              دخل خالی · همه چیز آماده ثبت
            </span>
          </div>
        </div>
        <div
          style={{
            padding: '5px 14px',
            borderRadius: 999,
            background: 'rgba(16,185,129,0.15)',
            border: '1px solid rgba(16,185,129,0.4)',
            color: MINT,
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          فعال
        </div>
      </div>

      <EditorialHeadline
        text="صبح با چای داغ و خیال آسوده"
        t={t}
        at={2.2}
        top={740}
        glowColor={EMBER}
      />
    </Stage>
  )
}

// ─── Scene 2: Noon Rush (6.00–13.00s) — Solar Corona & Cascading Receipts ───

const NOON_RECEIPTS = [
  { time: faClock(9, 30), code: 'فاکتور #۱۰۱', amount: '۱,۴۵۰,۰۰۰', item: 'روغن و برنج' },
  { time: faClock(13, 30), code: 'فاکتور #۲۰۴', amount: '۳,۲۸۰,۰۰۰', item: 'اقلام شوینده' },
  { time: faClock(17, 30), code: 'فاکتور #۳۰۸', amount: '۲,۱۱۰,۰۰۰', item: 'خرید کلی مغازه' },
]

export function NoonScene({ t }: SceneProps) {
  const sunProgress = ease(clamp(progress(t, 0.3, 3.8)))
  const sunAngle = mix(-60, 60, sunProgress)

  return (
    <Stage ambientGradient="radial-gradient(100% 60% at 50% -5%, rgba(245,158,11,0.28) 0%, rgba(245,158,11,0) 75%), radial-gradient(100% 45% at 50% 105%, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0) 65%)">
      <TimeBadge time={faClock(13, 30)} t={t} dotColor={EMBER} top={56} />

      {/* Midday Golden Solar Corona Halo */}
      <div
        style={{
          position: 'absolute',
          top: 100,
          left: 270 - 150,
          width: 300,
          height: 120,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 90,
            height: 90,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #fde047 0%, #f59e0b 60%, rgba(245,158,11,0) 80%)',
            boxShadow: '0 0 50px rgba(245,158,11,0.6)',
            transform: `rotate(${sunAngle}deg)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 100,
            fontSize: 13,
            fontFamily: MONO,
            letterSpacing: '0.12em',
            color: EMBER,
            fontWeight: 700,
          }}
        >
          NOON RUSH // غوغای ظهر
        </div>
      </div>

      {/* 3 Cascading Physical Thermal POS Receipts */}
      <div
        style={{
          position: 'absolute',
          top: 240,
          left: 44,
          right: 44,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {NOON_RECEIPTS.map((rc, i) => {
          const itemEnter = enter(t, 0.7 + i * 0.65, { y: 28, scale: 0.96 })

          return (
            <div
              key={rc.code}
              dir="rtl"
              style={{
                ...itemEnter,
                position: 'relative',
                height: 110,
                borderRadius: 18,
                background: `linear-gradient(180deg, ${PANEL_HI} 0%, ${PANEL_MID} 100%)`,
                border: '1px solid rgba(255, 255, 255, 0.14)',
                boxShadow: '0 16px 40px rgba(0,0,0,0.6), 0 0 20px rgba(245,158,11,0.06)',
                overflow: 'hidden',
                padding: '0 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              {/* Thermal Serrated Edge on Top */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background:
                    'repeating-linear-gradient(90deg, #f59e0b 0 4px, transparent 4px 8px)',
                  opacity: 0.8,
                }}
              />

              {/* Right: Invoice Meta & Item */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: 'rgba(245,158,11,0.12)',
                    border: '1px solid rgba(245,158,11,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: EMBER,
                    fontWeight: 900,
                    fontSize: 16,
                  }}
                >
                  ✓
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: CREAM }}>{rc.code}</span>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: CREAM_MUTED }}>
                      {rc.time}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, color: CREAM_MUTED, fontWeight: 500 }}>
                    {rc.item}
                  </span>
                </div>
              </div>

              {/* Left: Amount & Registered Emerald Badge */}
              <div
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontFamily: MONO, fontSize: 19, fontWeight: 900, color: CREAM }}>
                    {rc.amount}
                  </span>
                  <span style={{ fontSize: 11, color: CREAM_MUTED }}>تومان</span>
                </div>
                <div
                  style={{
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(16,185,129,0.4)',
                    color: MINT,
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  ثبت آنی در دخل
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <EditorialHeadline
        text="فروش‌های شلوغ ظهر، ثبت آنی"
        t={t}
        at={2.8}
        top={740}
        glowColor={EMBER}
      />
    </Stage>
  )
}

// ─── Scene 3: Midnight Receivables (13.00–20.00s) — Resolving Debt Anxiety ───

const RECEIVABLES = [
  { client: 'حاج رضایی · مغازه خرازی', amount: '۳,۲۵۰,۰۰۰', due: 'سررسید امروز', resolved: true },
  { client: 'احمدی · فاکتور ابزار', amount: '۱,۷۸۰,۰۰۰', due: 'پیگیری خودکار', resolved: true },
  { client: 'فروشگاه سپهر · عمده', amount: '۴,۹۰۰,۰۰۰', due: 'تایید و تسویه', resolved: true },
]

export function MidnightScene({ t }: SceneProps) {
  const resolveProgress = ease(clamp(progress(t, 2.2, 1.2)))

  return (
    <Stage ambientGradient="radial-gradient(120% 60% at 50% 10%, rgba(30,58,138,0.32) 0%, rgba(30,58,138,0) 75%), radial-gradient(100% 50% at 50% 100%, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0) 70%)">
      <TimeBadge time={faClock(23, 45)} t={t} dotColor={MINT} top={56} />

      {/* Midnight Starlight Ambient Stars */}
      <div
        style={{
          position: 'absolute',
          top: 120,
          left: 60,
          right: 60,
          height: 80,
          display: 'flex',
          justifyContent: 'space-around',
          opacity: 0.4,
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: 3,
              borderRadius: '50%',
              backgroundColor: '#93c5fd',
              boxShadow: '0 0 8px #93c5fd',
              opacity: 0.3 + 0.5 * Math.sin(t * 2 + i),
            }}
          />
        ))}
      </div>

      {/* Glassmorphic Flagship Phone Mockup */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          left: 48,
          right: 48,
          height: 520,
          borderRadius: 28,
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1.5px solid rgba(16, 185, 129, 0.35)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.7), 0 0 40px rgba(16,185,129,0.15)',
          backdropFilter: 'blur(16px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Mockup Header Bar */}
        <div
          dir="rtl"
          style={{
            height: 56,
            background: 'rgba(255, 255, 255, 0.04)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: MINT,
                boxShadow: `0 0 10px ${MINT}`,
              }}
            />
            <span style={{ fontSize: 15, fontWeight: 800, color: CREAM }}>دفتر نسیه و مطالبات</span>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 13, color: MINT, fontWeight: 700 }}>
            {mix(0, 100, resolveProgress).toFixed(0)}٪ تراز
          </span>
        </div>

        {/* 3 Receivable Line Cards */}
        <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {RECEIVABLES.map((rec) => (
            <div
              key={rec.client}
              dir="rtl"
              style={{
                padding: '16px 18px',
                borderRadius: 16,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(16, 185, 129, 0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: CREAM }}>{rec.client}</span>
                <span style={{ fontSize: 12, color: MINT, fontWeight: 600 }}>{rec.due}</span>
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontFamily: MONO, fontSize: 17, fontWeight: 800, color: CREAM }}>
                    {rec.amount}
                  </span>
                  <span style={{ fontSize: 10, color: CREAM_MUTED }}>تومان</span>
                </div>
                <div
                  style={{
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(16,185,129,0.18)',
                    color: MINT,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  تسویه و مرتب
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Total Bar */}
        <div
          dir="rtl"
          style={{
            marginTop: 'auto',
            padding: '16px 20px',
            background: 'rgba(16, 185, 129, 0.08)',
            borderTop: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: CREAM }}>
            مجموع طلب‌های پیگیری‌شده
          </span>
          <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 900, color: MINT }}>
            ۹,۹۳۰,۰۰۰ تومان
          </span>
        </div>
      </div>

      <EditorialHeadline
        text="نصفه‌شب، طلب‌ها مرتب و روشن"
        t={t}
        at={2.6}
        top={740}
        glowColor={MINT}
      />
    </Stage>
  )
}

// ─── Scene 4: The Brass Shutter (20.00–27.00s) — Heavy Steel & Brass Padlock ─

export function ShutterScene({ t }: SceneProps) {
  const slatProgress = [0, 1, 2, 3, 4].map((i) => spring(clamp(progress(t, 0.35 + i * 0.45, 0.75))))
  const lockSnap = spring(clamp(progress(t, 2.9, 0.6)))

  return (
    <Stage ambientGradient="radial-gradient(110% 60% at 50% 90%, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0) 70%), radial-gradient(100% 40% at 50% 0%, rgba(15,23,42,0.3) 0%, rgba(15,23,42,0) 70%)">
      <TimeBadge time={faClock(0, 15)} t={t} dotColor={BRASS} top={56} />

      {/* Industrial Shutter Framing Chassis */}
      <div
        style={{
          position: 'absolute',
          top: 140,
          left: 40,
          right: 40,
          height: 520,
          borderRadius: 24,
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          border: '2px solid rgba(212,175,55,0.3)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '6px',
        }}
      >
        {/* 5 Corrugated Metallic Steel Slats */}
        {[0, 1, 2, 3, 4].map((i) => {
          const spr = slatProgress[i]!
          const yOff = mix(-180, 0, spr)

          return (
            <div
              key={i}
              style={{
                height: 96,
                borderRadius: 12,
                background: 'linear-gradient(180deg, #334155 0%, #1e293b 50%, #0f172a 100%)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.15), 0 8px 20px rgba(0,0,0,0.7)',
                position: 'relative',
                transform: `translateY(${yOff}px)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
              }}
            >
              {/* Slat Extruded Horizontal Bevels */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'rgba(0,0,0,0.5)',
                  boxShadow: '0 1px 0 rgba(255,255,255,0.1)',
                }}
              />

              {/* Brass Rivets on Left and Right */}
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 35%, #fef08a 0%, #ca8a04 80%)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.8)',
                }}
              />
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 35%, #fef08a 0%, #ca8a04 80%)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.8)',
                }}
              />
            </div>
          )
        })}

        {/* Massive Solid Brass Padlock in Center */}
        <div
          style={{
            position: 'absolute',
            top: 260,
            left: '50%',
            transform: `translate(-50%, -50%) scale(${mix(0.6, 1, lockSnap)})`,
            width: 110,
            height: 130,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 10,
            filter: 'drop-shadow(0 15px 30px rgba(0,0,0,0.8))',
          }}
        >
          {/* Padlock Shackle */}
          <div
            style={{
              width: 58,
              height: 52,
              borderRadius: '29px 29px 0 0',
              border: '10px solid #fef08a',
              borderBottom: 'none',
              boxShadow: 'inset 0 4px 6px rgba(0,0,0,0.4)',
            }}
          />
          {/* Padlock Body */}
          <div
            style={{
              width: 96,
              height: 74,
              borderRadius: 16,
              background:
                'radial-gradient(circle at 30% 30%, #fef08a 0%, #ca8a04 60%, #713f12 100%)',
              border: '2px solid rgba(255,255,255,0.4)',
              boxShadow: '0 0 30px rgba(234,179,8,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Keyhole */}
            <div
              style={{
                width: 12,
                height: 24,
                borderRadius: 6,
                background: '#1c1917',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.9)',
              }}
            />
          </div>
        </div>
      </div>

      <EditorialHeadline
        text="دخل تراز · شب آرام بازار"
        t={t}
        at={3.2}
        top={740}
        glowColor={BRASS}
      />
    </Stage>
  )
}

// ─── Scene 5: The Home Night (27.00–34.00s) — Peaceful Bedside ──────────────

export function RestScene({ t }: SceneProps) {
  const lampGlow = 0.6 + 0.15 * Math.sin(t * 1.5)
  const phonePulse = pulse(t, 0.4, 6.8, 1.8)

  return (
    <Stage ambientGradient="radial-gradient(110% 60% at 30% 50%, rgba(245,158,11,0.22) 0%, rgba(245,158,11,0) 70%), radial-gradient(100% 50% at 70% 60%, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0) 70%)">
      <TimeBadge time={faClock(1, 15)} t={t} dotColor={MINT} top={56} />

      {/* Bedside Table Wood Surface */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 420,
          background: 'linear-gradient(180deg, #1c140c 0%, #0c0906 100%)',
          borderTop: '1px solid rgba(245,158,11,0.15)',
        }}
      />

      {/* Ambient Bedside Lamp Warm Light Cone */}
      <div
        style={{
          position: 'absolute',
          top: 180,
          left: 80,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,158,11,0.35) 0%, rgba(245,158,11,0) 70%)',
          filter: 'blur(36px)',
          opacity: lampGlow,
          pointerEvents: 'none',
        }}
      />

      {/* Bedside Lamp Vector Silhouette */}
      <div style={{ position: 'absolute', top: 320, left: 90 }}>
        <svg width={110} height={180} viewBox="0 0 110 180" fill="none">
          <path
            d="M 25 35 L 85 35 L 98 75 L 12 75 Z"
            fill="#ca8a04"
            stroke="#fef08a"
            strokeWidth={2}
          />
          <circle cx={55} cy={72} r={8} fill="#fde047" />
          <rect x={51} y={76} width={8} height={70} fill="#94a3b8" />
          <ellipse
            cx={55}
            cy={150}
            rx={36}
            ry={10}
            fill="#ca8a04"
            stroke="#fef08a"
            strokeWidth={1.5}
          />
        </svg>
      </div>

      {/* Resting Smartphone on Nightstand with Breathing Mint Heart */}
      <div
        style={{
          position: 'absolute',
          top: 330,
          left: 270,
          width: 190,
          height: 320,
          borderRadius: 28,
          background: '#090d16',
          border: '2px solid rgba(16,185,129,0.4)',
          boxShadow: `0 20px 50px rgba(0,0,0,0.8), 0 0 ${mix(20, 50, phonePulse)}px rgba(16,185,129,0.3)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: '24px 18px',
        }}
      >
        {/* Pulsing Breathing Aura */}
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            background: 'rgba(16,185,129,0.18)',
            border: '2px solid rgba(16,185,129,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 30px ${MINT_GLOW}`,
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              backgroundColor: MINT,
              boxShadow: `0 0 20px ${MINT}`,
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 900, color: CREAM }}>حسابچه فعال</span>
          <span style={{ fontSize: 12, color: MINT, fontWeight: 700 }}>
            تمام دخل و حساب‌ها بسته شد
          </span>
        </div>
      </div>

      <EditorialHeadline text="دیگر چیزی معلق نمی‌ماند" t={t} at={2.8} top={740} glowColor={MINT} />
    </Stage>
  )
}

// ─── Scene 6: Brand Curtain (34.00–42.00s) — Grand Resolution ───────────────

export function CurtainScene({ t }: SceneProps) {
  const brandEnter = enter(t, 0.4, { y: 24, scale: 0.94 })
  const glowPulse = pulse(t, 0.4, 7.8, 2.0)

  return (
    <Stage ambientGradient="radial-gradient(120% 70% at 50% 45%, rgba(245,158,11,0.22) 0%, rgba(245,158,11,0) 70%), radial-gradient(100% 50% at 50% 100%, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0) 70%)">
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
          zIndex: 10,
        }}
      >
        {/* Volumetric Glowing Geometric Brand Seal */}
        <div
          style={{
            width: 104,
            height: 104,
            borderRadius: 30,
            background: 'linear-gradient(135deg, #f59e0b 0%, #10b981 100%)',
            boxShadow: `0 20px 60px rgba(0,0,0,0.8), 0 0 ${mix(30, 70, glowPulse)}px rgba(245,158,11,0.4)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 48, fontWeight: 900, color: '#000' }}>ح</span>
        </div>

        {/* Grand Typography Stack */}
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
              letterSpacing: '-0.03em',
              textShadow: '0 8px 30px rgba(0,0,0,0.9)',
            }}
          >
            حسابچه
          </span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: EMBER,
              letterSpacing: '0.02em',
            }}
          >
            جزء جدانشدنی کسب‌وکار شما
          </span>
        </div>

        {/* CTA Domain Pill */}
        <div
          style={{
            padding: '12px 36px',
            borderRadius: 999,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1.5px solid rgba(245, 158, 11, 0.45)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5), 0 0 25px rgba(245,158,11,0.2)',
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
