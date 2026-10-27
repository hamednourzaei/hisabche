// ============================================
// Landed-cost plates (reel 105) — «صفحه‌های بهای تمام‌شده»
// Bespoke Art Direction: Heavy Metallurgy, Hydraulic Cargo Scale & Warehouse Logistics
//
// Arithmetic for the whole film:
//   خرید ۱٬۲۰۰٬۰۰۰ + کرایه ۱۸۰٬۰۰۰ + گمرک ۲۲۰٬۰۰۰ + بیمه ۴۰٬۰۰۰ = ۱٬۶۴۰٬۰۰۰
//   فروش ۱٬۵۰۰٬۰۰۰ − بهای ۱٬۶۴۰٬۰۰۰ = ۱۴۰٬۰۰۰ ضرر در هر واحد
//   ۲۰ واحد × ۱۴۰٬۰۰۰ = ۲٬۸۰۰٬۰۰۰ ضرر پنهان
//
// Distinct Visual DNA:
// - Industrial warehouse & heavy brushed copper/brass plates.
// - Digital platform scale with hydraulic compression on impacts.
// - Mechanical balance tipping when cost exceeds sales.
// - 3D isometric cargo crate thermal audit grid.
// - Automated dispatch allocation manifest.
// ============================================

import React from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'
import { stagePunch, stageShake } from './card-motion'

// ─── Industrial Tokens ────────────────────────────────────────────────────────

const IRON_DARK = '#021214'
const COPPER_RAW = '#c2410c'
const COPPER_BRIGHT = '#ea580c'
const BRASS_METALLIC = '#f59e0b'
const BRASS_LIGHT = '#fbbf24'
const MINT_PROFIT = '#10b981'
const ROSE_LOSS = '#f43f5e'
const STEEL_WHITE = '#f1f5f9'
const STEEL_MUTED = '#94a3b8'

const BASE_PURCHASE = 1_200_000
const FREIGHT = 180_000
const CUSTOMS = 220_000
const INSURANCE = 40_000
const LANDED_TOTAL = BASE_PURCHASE + FREIGHT + CUSTOMS + INSURANCE // 1,640,000
const SALE_PRICE = 1_500_000
const UNIT_LOSS = LANDED_TOTAL - SALE_PRICE // 140,000
const TOTAL_UNITS = 20
const TOTAL_LOSS = UNIT_LOSS * TOTAL_UNITS // 2,800,000

function popSpring(t: number, at: number, dur = 0.5): number {
  return spring(clamp(progress(t, at, dur)))
}

function fa(n: number): string {
  return faNumber(Math.round(n))
}

// ─── Industrial Logistics Backdrop ───────────────────────────────────────────

function IndustrialBackdrop({ t }: { t: number }) {
  const laserY = (t * 130) % 960
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Heavy Cargo Bay Lighting */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(800px 550px at 50% 25%, rgba(234, 88, 12, 0.16), transparent 70%), radial-gradient(700px 500px at 50% 85%, rgba(2, 40, 44, 0.9), transparent 70%)',
        }}
      />

      {/* Industrial Plate Rivet Texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(245, 158, 11, 0.12) 1.5px, transparent 1.5px)',
          backgroundSize: '32px 32px',
          opacity: 0.4,
          transform: `translateY(${(t * 8) % 32}px)`,
        }}
      />

      {/* Heavy Laser Measuring Beam */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: laserY,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${BRASS_LIGHT}, transparent)`,
          boxShadow: `0 0 16px ${BRASS_LIGHT}, 0 0 32px ${COPPER_BRIGHT}`,
          opacity: 0.55,
        }}
      />

      {/* Vignette Edge Shading */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 50%, transparent 45%, rgba(1, 8, 9, 0.95) 100%)',
        }}
      />
    </div>
  )
}

// ─── Stage Shell with Motion Physics ─────────────────────────────────────────

export function PlateStage({
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
        background: IRON_DARK,
        overflow: 'hidden',
        color: STEEL_WHITE,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${shake.x.toFixed(2)}px, ${shake.y.toFixed(2)}px) scale(${punch.toFixed(3)})`,
          transformOrigin: '50% 45%',
        }}
      >
        <IndustrialBackdrop t={t} />
        {children}

        {/* Industrial Stamped Footer Anchor */}
        <div
          dir="ltr"
          style={{
            position: 'absolute',
            bottom: 12,
            left: 24,
            right: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 10,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            letterSpacing: '0.18em',
            color: 'rgba(148, 163, 184, 0.45)',
          }}
        >
          <span>LOGISTICS_SPEC: CARGO_LANDED_COST</span>
          <span>UNIT_BASE: COMMERCIAL_SKU_101</span>
        </div>
      </div>
    </div>
  )
}

// ─── Industrial Header ────────────────────────────────────────────────────────

function IndustrialHeader({
  badge,
  badgeColor = BRASS_METALLIC,
  title,
  subtitle,
  subtitleAccent,
  accentColor = COPPER_BRIGHT,
  t,
}: {
  badge: string
  badgeColor?: string
  title: string
  subtitle: string
  subtitleAccent: string
  accentColor?: string
  t: number
}) {
  const enter = clamp(progress(t, 0.05, 0.5))
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        top: 36,
        left: 24,
        right: 24,
        zIndex: 20,
        opacity: enter,
        transform: `translateY(${mix(12, 0, enter)}px)`,
      }}
    >
      {/* Top Tracking Badge & Category */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: badgeColor,
            background: `${badgeColor}18`,
            border: `1.5px solid ${badgeColor}55`,
            padding: '2px 10px',
            borderRadius: 6,
            letterSpacing: '0.04em',
          }}
        >
          {badge}
        </span>

        <span
          dir="ltr"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: 'rgba(245, 158, 11, 0.7)',
            letterSpacing: '0.1em',
          }}
        >
          CARGO_AUDIT // SKU_101
        </span>
      </div>

      {/* Main Bold Headline */}
      <div
        style={{
          fontSize: 27,
          fontWeight: 900,
          color: STEEL_WHITE,
          lineHeight: 1.25,
          letterSpacing: '-0.02em',
          marginBottom: 4,
        }}
      >
        {title}
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: STEEL_MUTED,
          lineHeight: 1.45,
        }}
      >
        <span>{subtitle} </span>
        <span style={{ color: accentColor, fontWeight: 800 }}>{subtitleAccent}</span>
      </div>
    </div>
  )
}

// ─── Scene 1 · The Hydraulic Platform Scale & Falling Copper Plates ───────────

export function LandedHookScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = clamp(progress(t, 1.5, 0.45))
  const p2 = clamp(progress(t, 2.7, 0.45))
  const p3 = clamp(progress(t, 3.9, 0.45))
  const alert = popSpring(t, 4.4, 0.6)

  // Scale height compression on each impact
  const bounce1 = p1 > 0 && p1 < 1 ? Math.sin(p1 * Math.PI) * 12 : 0
  const bounce2 = p2 > 0 && p2 < 1 ? Math.sin(p2 * Math.PI) * 12 : 0
  const bounce3 = p3 > 0 && p3 < 1 ? Math.sin(p3 * Math.PI) * 12 : 0
  const scaleCompression = bounce1 + bounce2 + bounce3

  let currentWeight = BASE_PURCHASE
  if (p1 > 0) currentWeight += Math.round(FREIGHT * ease(p1))
  if (p2 > 0) currentWeight += Math.round(CUSTOMS * ease(p2))
  if (p3 > 0) currentWeight += Math.round(INSURANCE * ease(p3))

  return (
    <PlateStage scene={scene} t={t} shakes={[1.5, 2.7, 3.9, 4.4]} punches={[0.05, 1.5, 2.7, 3.9]}>
      <IndustrialHeader
        badge="محاسبه بهای واقعی واردات"
        title="قیمت روی برچسب فقط فاکتور خرید است..."
        subtitle="کرایه، گمرک و ترخیص هم روی بار می‌نشیند"
        subtitleAccent="و بهای واقعی کالا به شدت بالا می‌رود!"
        accentColor={BRASS_METALLIC}
        t={t}
      />

      {/* ─── Hero Center: Hydraulic Cargo Scale Platform (y: 170 to 580) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 165,
          left: 24,
          right: 24,
          height: 420,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          zIndex: 10,
        }}
      >
        {/* Falling Copper Plates Container */}
        <div style={{ position: 'relative', width: 340, height: 260, marginBottom: 12 }}>
          {/* Base Purchase Carton / Crate */}
          <div
            style={{
              position: 'absolute',
              bottom: scaleCompression,
              left: 20,
              right: 20,
              height: 100,
              borderRadius: 14,
              background: 'linear-gradient(145deg, #7c3a0e, #431407)',
              border: `2px solid ${COPPER_RAW}`,
              boxShadow: '0 20px 40px rgba(0,0,0,0.7), inset 0 2px 4px rgba(255,255,255,0.2)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5,
            }}
          >
            <div
              style={{ fontSize: 13, fontWeight: 800, color: '#fed7aa', letterSpacing: '0.04em' }}
            >
              کارتن کالا (فاکتور خرید پایه)
            </div>
            <div
              dir="ltr"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 26,
                fontWeight: 900,
                color: STEEL_WHITE,
              }}
            >
              {fa(BASE_PURCHASE)}
            </div>
          </div>

          {/* Plate 1: Freight (+180,000) */}
          <div
            style={{
              position: 'absolute',
              bottom: 106 + scaleCompression,
              left: 26,
              right: 26,
              height: 46,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${BRASS_LIGHT}, ${COPPER_BRIGHT})`,
              boxShadow: '0 12px 24px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingInline: 18,
              opacity: p1,
              transform: `translateY(${mix(-120, 0, popSpring(t, 1.5, 0.45))}px)`,
              zIndex: 6,
              color: '#1a0802',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 900 }}>کرایه باربری و حمل</span>
            <span
              dir="ltr"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 900 }}
            >
              +{fa(FREIGHT)}
            </span>
          </div>

          {/* Plate 2: Customs (+220,000) */}
          <div
            style={{
              position: 'absolute',
              bottom: 156 + scaleCompression,
              left: 32,
              right: 32,
              height: 46,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${BRASS_METALLIC}, ${COPPER_RAW})`,
              boxShadow: '0 12px 24px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingInline: 18,
              opacity: p2,
              transform: `translateY(${mix(-150, 0, popSpring(t, 2.7, 0.45))}px)`,
              zIndex: 7,
              color: '#1a0802',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 900 }}>گمرک و مالیات ترخیص</span>
            <span
              dir="ltr"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 900 }}
            >
              +{fa(CUSTOMS)}
            </span>
          </div>

          {/* Plate 3: Insurance (+40,000) */}
          <div
            style={{
              position: 'absolute',
              bottom: 206 + scaleCompression,
              left: 38,
              right: 38,
              height: 44,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #fcd34d, #d97706)',
              boxShadow: '0 12px 24px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingInline: 18,
              opacity: p3,
              transform: `translateY(${mix(-180, 0, popSpring(t, 3.9, 0.45))}px)`,
              zIndex: 8,
              color: '#1a0802',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 900 }}>بیمه بار و انبارداری</span>
            <span
              dir="ltr"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 900 }}
            >
              +{fa(INSURANCE)}
            </span>
          </div>
        </div>

        {/* Heavy Machined Scale Bed Base with Digital LED Meter */}
        <div
          dir="rtl"
          style={{
            width: '100%',
            height: 84,
            background: 'linear-gradient(180deg, #112d32, #041618)',
            border: `2px solid ${p3 > 0.9 ? ROSE_LOSS : BRASS_METALLIC}`,
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingInline: 24,
            boxShadow: `0 16px 40px rgba(0,0,0,0.8), 0 0 30px ${p3 > 0.9 ? ROSE_LOSS : BRASS_METALLIC}33`,
            zIndex: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: STEEL_WHITE, marginBottom: 2 }}>
              باسکول بهای تمام‌شده واحد
            </div>
            <div
              style={{ fontSize: 11, fontWeight: 600, color: p3 > 0.9 ? ROSE_LOSS : STEEL_MUTED }}
            >
              {p3 > 0.9
                ? 'وزن هزینه‌ها از قیمت فروش عبور کرد!'
                : 'در حال محاسبه هزینه‌های انباشته...'}
            </div>
          </div>

          <div
            dir="ltr"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 28,
              fontWeight: 900,
              color: p3 > 0.9 ? ROSE_LOSS : BRASS_METALLIC,
              textShadow: `0 0 16px ${p3 > 0.9 ? ROSE_LOSS : BRASS_METALLIC}`,
            }}
          >
            {fa(currentWeight)}
          </div>
        </div>
      </div>

      {/* ─── Lower Warehouse Logistics Deck (y: 605 to 890) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 605,
          left: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 20,
        }}
      >
        {/* Apportionment Breakdown Strip */}
        <div
          dir="rtl"
          style={{
            background: 'rgba(5, 33, 37, 0.85)',
            border: `1.5px solid ${COPPER_BRIGHT}44`,
            borderRadius: 14,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>⚓</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: STEEL_WHITE }}>
                تسهیم باربری و گمرک بر روی کالا
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: STEEL_MUTED }}>
                هزینه‌های غیرمستقیم به ازای هر واحد: +۴۴۰٬۰۰۰ تومان
              </div>
            </div>
          </div>
          <div
            dir="ltr"
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(234, 88, 12, 0.2)',
              border: `1px solid ${COPPER_BRIGHT}`,
              fontSize: 12,
              fontWeight: 900,
              color: BRASS_LIGHT,
            }}
          >
            +36.6% COST
          </div>
        </div>

        {/* Warning Panel */}
        <div
          dir="rtl"
          style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: `1.5px solid ${ROSE_LOSS}55`,
            borderRadius: 14,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: clamp(progress(t, 2.5, 0.6)),
            transform: `scale(${mix(0.96, 1, alert)})`,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(244, 63, 94, 0.25)',
              border: `1px solid ${ROSE_LOSS}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: ROSE_LOSS,
              flexShrink: 0,
            }}
          >
            ⚠
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: STEEL_WHITE, marginBottom: 2 }}>
              هشدار بنکداری: بهای تمام‌شده بالاتر از قیمت بازار
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(241, 245, 249, 0.75)' }}>
              اگر کالا را ۱٬۵۰۰٬۰۰۰ تومان بفروشید، به ازای هر کارتن ۱۴۰٬۰۰۰ تومان زیان خالص
              داده‌اید!
            </div>
          </div>
        </div>

        {/* Diagnostic Bar */}
        <div
          dir="ltr"
          style={{
            background: 'rgba(2, 18, 20, 0.9)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 12,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: BRASS_METALLIC,
          }}
        >
          <span>ACCUMULATION: BASE + FREIGHT + CUSTOMS</span>
          <span style={{ color: ROSE_LOSS }}>OVERWEIGHT_COST</span>
        </div>
      </div>
    </PlateStage>
  )
}

// ─── Scene 2 · The Tipping Mechanical Balance: Cost Overtakes Sale ───────────

export function CrossOverScene({ t, scene }: { t: number; scene: Scene }) {
  const tip = ease(clamp(progress(t, 0.8, 2.6)))
  const hit = popSpring(t, 3.4, 0.6)

  // Tilt angle of the mechanical balance (tips 20 degrees down to right)
  const angle = tip * 18
  const leftPanY = -tip * 34
  const rightPanY = tip * 34

  return (
    <PlateStage scene={scene} t={t} shakes={[3.4]} punches={[0.1, 3.4]}>
      <IndustrialHeader
        badge="تلاقی بهای تمام‌شده و قیمت فروش"
        title="ترازوی قیمت معکوس شد!"
        subtitle="فروش ۱٬۵۰۰٬۰۰۰ در برابر بهای ۱٬۶۴۰٬۰۰۰"
        subtitleAccent="کفه هزینه سنگین‌تر شد و زیان آغاز گشت!"
        accentColor={ROSE_LOSS}
        t={t}
      />

      {/* ─── Hero Center: Tipping Industrial Balance (y: 170 to 580) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 165,
          left: 24,
          right: 24,
          height: 420,
          background: 'rgba(4, 24, 26, 0.85)',
          border: '1.5px solid rgba(244, 63, 94, 0.4)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 20px 48px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width={492}
          height={420}
          viewBox="0 0 492 420"
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* Fulcrum & Base */}
          <polygon
            points="246,180 220,320 272,320"
            fill="linear-gradient(180deg, #164e57, #082f35)"
            stroke={BRASS_METALLIC}
            strokeWidth={2}
          />
          <circle
            cx={246}
            cy={180}
            r={16}
            fill={IRON_DARK}
            stroke={BRASS_METALLIC}
            strokeWidth={3}
          />

          {/* Tilting Balance Lever Beam */}
          <g transform={`rotate(${angle} 246 180)`}>
            <rect
              x={60}
              y={174}
              width={372}
              height={12}
              rx={6}
              fill={BRASS_LIGHT}
              stroke="#78350f"
              strokeWidth={1.5}
            />
            {/* Left suspension hook */}
            <circle cx={80} cy={180} r={6} fill="#fff" />
            {/* Right suspension hook */}
            <circle cx={412} cy={180} r={6} fill="#fff" />
          </g>

          {/* Left Pan: Sale Price (Rising) */}
          <g transform={`translate(80, ${220 + leftPanY})`}>
            <line x1={0} y1={-40} x2={0} y2={0} stroke={STEEL_MUTED} strokeWidth={2} />
            <rect
              x={-65}
              y={0}
              width={130}
              height={70}
              rx={12}
              fill="rgba(16, 185, 129, 0.2)"
              stroke={MINT_PROFIT}
              strokeWidth={2}
            />
            <text
              x={0}
              y={26}
              textAnchor="middle"
              fill={STEEL_WHITE}
              fontSize={11}
              fontWeight={800}
            >
              کفه فروش
            </text>
            <text
              x={0}
              y={52}
              textAnchor="middle"
              fill={MINT_PROFIT}
              fontSize={16}
              fontWeight={900}
            >
              {fa(SALE_PRICE)}
            </text>
          </g>

          {/* Right Pan: Landed Cost (Slamming Down) */}
          <g transform={`translate(412, ${220 + rightPanY})`}>
            <line x1={0} y1={-40} x2={0} y2={0} stroke={ROSE_LOSS} strokeWidth={2} />
            <rect
              x={-65}
              y={0}
              width={130}
              height={70}
              rx={12}
              fill="rgba(244, 63, 94, 0.25)"
              stroke={ROSE_LOSS}
              strokeWidth={2}
            />
            <text
              x={0}
              y={26}
              textAnchor="middle"
              fill={STEEL_WHITE}
              fontSize={11}
              fontWeight={800}
            >
              کفه بهای تمام‌شده
            </text>
            <text x={0} y={52} textAnchor="middle" fill={ROSE_LOSS} fontSize={16} fontWeight={900}>
              {fa(LANDED_TOTAL)}
            </text>
          </g>
        </svg>

        {/* Central Deficit Tag Banner when tipped */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            bottom: 24,
            left: 24,
            right: 24,
            background: 'rgba(244, 63, 94, 0.2)',
            border: `1.5px solid ${ROSE_LOSS}`,
            borderRadius: 14,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: tip,
            transform: `scale(${mix(0.9, 1, hit)})`,
            boxShadow: `0 0 24px ${ROSE_LOSS}44`,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: STEEL_WHITE }}>
              سقوط حاشیه سود (Negative Spread)
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(241, 245, 249, 0.7)' }}>
              فروش زیر بهای تمام‌شده جایگزینی
            </div>
          </div>
          <div
            dir="ltr"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 22,
              fontWeight: 900,
              color: ROSE_LOSS,
              textShadow: `0 0 16px ${ROSE_LOSS}`,
            }}
          >
            -{fa(UNIT_LOSS)}
          </div>
        </div>
      </div>

      {/* ─── Lower Telemetry Deck (y: 605 to 890) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 605,
          left: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'فروش در بازار', val: fa(SALE_PRICE), col: MINT_PROFIT },
            { label: 'بهای کل کالا', val: fa(LANDED_TOTAL), col: BRASS_METALLIC },
            { label: 'ضرر در هر کارتن', val: `-${fa(UNIT_LOSS)}`, col: ROSE_LOSS },
          ].map((m, i) => (
            <div
              key={m.label}
              dir="rtl"
              style={{
                background: 'rgba(6, 26, 28, 0.85)',
                border: `1px solid ${m.col}33`,
                borderRadius: 12,
                padding: '10px 8px',
                textAlign: 'center',
                opacity: clamp(progress(t, 1.2 + i * 0.3, 0.5)),
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: STEEL_MUTED, marginBottom: 4 }}>
                {m.label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: m.col }}>{m.val}</div>
            </div>
          ))}
        </div>

        <div
          dir="rtl"
          style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: `1.5px solid ${ROSE_LOSS}55`,
            borderRadius: 14,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(244, 63, 94, 0.25)',
              border: `1px solid ${ROSE_LOSS}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: ROSE_LOSS,
              flexShrink: 0,
            }}
          >
            ⚖
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: STEEL_WHITE, marginBottom: 2 }}>
              زیان خاموش در بنکداری و عمده‌فروشی
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(241, 245, 249, 0.75)' }}>
              فروشنده خوشحال است که جنس را سریع نقد کرده، اما در واقع از جیب خودش به خریدار سوبسید
              داده است!
            </div>
          </div>
        </div>

        <div
          dir="ltr"
          style={{
            background: 'rgba(2, 18, 20, 0.9)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 12,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: ROSE_LOSS,
          }}
        >
          <span>EQUILIBRIUM: FRACTURED</span>
          <span style={{ color: STEEL_WHITE }}>MARGIN_DEFICIT</span>
        </div>
      </div>
    </PlateStage>
  )
}

// ─── Scene 3 · Twenty Cartons: Multiplied Loss in Cargo Warehouse ────────────

export function HiddenLossScene({ t, scene }: { t: number; scene: Scene }) {
  const cartonsOn = Math.min(TOTAL_UNITS, Math.floor(clamp(progress(t, 0.4, 4.0)) * TOTAL_UNITS))
  const lossProg = ease(clamp(progress(t, 1.8, 2.5)))
  const accumulatedLoss = Math.round(mix(0, TOTAL_LOSS, lossProg))

  return (
    <PlateStage scene={scene} t={t} shakes={[2.2, 4.6]} punches={[0.1, 2.2, 4.6]}>
      <IndustrialHeader
        badge="خسارت تجمیعی محموله"
        title="بیست کارتن، بیست بار تکرار ضرر..."
        subtitle="اختلافی که در دفاتر سنتی دیده نمی‌شود"
        subtitleAccent="و ۲٬۸۰۰٬۰۰۰ تومان از سود انبار را می‌سوزاند!"
        accentColor={ROSE_LOSS}
        t={t}
      />

      {/* ─── Hero Center: Warehouse Pallet Thermal Scan (y: 170 to 580) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 165,
          left: 24,
          right: 24,
          height: 420,
          background: 'rgba(4, 24, 26, 0.85)',
          border: '1.5px solid rgba(244, 63, 94, 0.4)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 20px 48px rgba(0,0,0,0.8)',
        }}
      >
        {/* Total Overhead Crane Crane Display */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 20,
            left: 24,
            right: 24,
            background: 'rgba(244, 63, 94, 0.15)',
            border: `1.5px solid ${ROSE_LOSS}`,
            borderRadius: 14,
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: `0 0 24px ${ROSE_LOSS}44`,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: STEEL_WHITE }}>
              زیان پنهان کل محموله (۲۰ کارتن بار)
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(241, 245, 249, 0.7)' }}>
              ۱۴۰٬۰۰۰ تومان زیان در هر کارتن
            </div>
          </div>
          <div
            dir="ltr"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 26,
              fontWeight: 900,
              color: ROSE_LOSS,
              textShadow: `0 0 16px ${ROSE_LOSS}`,
            }}
          >
            -{fa(accumulatedLoss)}
          </div>
        </div>

        {/* 4x5 Cargo Matrix with Thermal Red Warning Rings */}
        <div
          style={{
            position: 'absolute',
            top: 104,
            left: 24,
            right: 24,
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 12,
          }}
        >
          {Array.from({ length: TOTAL_UNITS }).map((_, i) => {
            const on = i < cartonsOn
            const s = popSpring(t, 0.4 + i * 0.18, 0.35)
            return (
              <div
                key={i}
                style={{
                  height: 52,
                  borderRadius: 10,
                  border: `1.5px solid ${on ? ROSE_LOSS : 'rgba(148, 163, 184, 0.2)'}`,
                  background: on ? 'rgba(244, 63, 94, 0.25)' : 'rgba(8, 32, 34, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: on ? `0 0 16px ${ROSE_LOSS}66` : 'none',
                  transform: `scale(${on ? mix(0.7, 1, s) : 0.85})`,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 900, color: on ? '#fff' : STEEL_MUTED }}>
                  📦
                </span>
              </div>
            )
          })}
        </div>

        {/* Multiplied Hemorrhage Callout */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            bottom: 16,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 800,
            color: ROSE_LOSS,
          }}
        >
          [سود فرضی مثبت، اما ۲٬۸۰۰٬۰۰۰ تومان از اصل سرمایه کم شد!]
        </div>
      </div>

      {/* ─── Lower Active Telemetry Deck (y: 605 to 890) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 605,
          left: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'حجم بار', val: `${TOTAL_UNITS} کارتن`, col: BRASS_METALLIC },
            { label: 'کسری هر کارتن', val: `-${fa(UNIT_LOSS)}`, col: COPPER_BRIGHT },
            { label: 'مجموع زیان پنهان', val: `-${fa(TOTAL_LOSS)}`, col: ROSE_LOSS },
          ].map((item, i) => (
            <div
              key={item.label}
              dir="rtl"
              style={{
                background: 'rgba(6, 26, 28, 0.85)',
                border: `1px solid ${item.col}33`,
                borderRadius: 12,
                padding: '10px 8px',
                textAlign: 'center',
                opacity: clamp(progress(t, 1.4 + i * 0.3, 0.5)),
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: STEEL_MUTED, marginBottom: 4 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: item.col }}>{item.val}</div>
            </div>
          ))}
        </div>

        <div
          dir="rtl"
          style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: `1.5px solid ${ROSE_LOSS}55`,
            borderRadius: 14,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(244, 63, 94, 0.25)',
              border: `1px solid ${ROSE_LOSS}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: ROSE_LOSS,
              flexShrink: 0,
            }}
          >
            📉
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: STEEL_WHITE, marginBottom: 2 }}>
              چرا انبار خالی می‌شود ولی دخل پول ندارد؟
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(241, 245, 249, 0.75)' }}>
              پاسخ ساده است: شما بار را زیر قیمت واقعی جایگزینی فروخته‌اید و هزینه‌های جانبی را
              ندیده‌اید!
            </div>
          </div>
        </div>

        <div
          dir="ltr"
          style={{
            background: 'rgba(2, 18, 20, 0.9)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 12,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: ROSE_LOSS,
          }}
        >
          <span>DRAIN_ANALYSIS: 2,800,000 BLEED</span>
          <span style={{ color: STEEL_WHITE }}>AUTOMATED_ERP_REQUIRED</span>
        </div>
      </div>
    </PlateStage>
  )
}

// ─── Scene 4 · The Landed Cost Apportionment Document ────────────────────────

export function LandedDocumentScene({ t, scene }: { t: number; scene: Scene }) {
  const docIn = ease(clamp(progress(t, 0.2, 0.8)))
  const success = popSpring(t, 3.6, 0.6)

  const rows = [
    { label: 'فاکتور خرید پایه کالا', val: BASE_PURCHASE, at: 1.0, col: BRASS_METALLIC },
    { label: 'سهم کرایه حمل باربری', val: FREIGHT, at: 1.6, col: COPPER_BRIGHT },
    { label: 'سهم گمرک و ترخیص کالا', val: CUSTOMS, at: 2.2, col: COPPER_BRIGHT },
    { label: 'سهم بیمه و انبارداری', val: INSURANCE, at: 2.8, col: COPPER_BRIGHT },
  ]

  return (
    <PlateStage scene={scene} t={t} shakes={[3.6]} punches={[0.2, 3.6]}>
      <IndustrialHeader
        badge="سند رسمی بهای تمام‌شده حسابچه"
        title="یک سند، تمام هزینه‌ها را می‌نشاند..."
        subtitle="خرید، کرایه، گمرک و بیمه"
        subtitleAccent="به صورت خودکار و عادلانه روی هر کالا سرشکن می‌شود!"
        accentColor={MINT_PROFIT}
        t={t}
      />

      {/* ─── Hero Center: Machined Shipping Ledger Document (y: 170 to 580) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 165,
          left: 24,
          right: 24,
          height: 420,
          background: 'rgba(4, 24, 26, 0.95)',
          border: '1.5px solid rgba(16, 185, 129, 0.45)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 20px 48px rgba(0,0,0,0.8), 0 0 24px rgba(16, 185, 129, 0.15)',
          opacity: docIn,
          transform: `translateY(${mix(20, 0, docIn)}px)`,
        }}
      >
        {/* Document Header */}
        <div
          dir="rtl"
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(16, 185, 129, 0.1)',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: STEEL_WHITE }}>
              سند تسهیم بهای تمام‌شده (Landed Cost Sheet)
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: BRASS_METALLIC }}>
              کالای بازرگانی کد ۱۰۱ · تسهیم خودکار بر مبنای ارزش فاکتور
            </div>
          </div>
          <div
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              background: 'rgba(16, 185, 129, 0.2)',
              border: `1.5px solid ${MINT_PROFIT}`,
              fontSize: 11,
              fontWeight: 800,
              color: MINT_PROFIT,
            }}
          >
            محاسبه قطعی
          </div>
        </div>

        {/* Itemized Apportioned Rows */}
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((row) => {
            const on = clamp(progress(t, row.at, 0.45))
            return (
              <div
                key={row.label}
                dir="rtl"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  opacity: on,
                  transform: `translateY(${mix(10, 0, on)}px)`,
                  fontSize: 13,
                  fontWeight: 700,
                  color: STEEL_WHITE,
                }}
              >
                <span>{row.label}</span>
                <span
                  dir="ltr"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 16,
                    fontWeight: 900,
                    color: row.col,
                  }}
                >
                  +{fa(row.val)}
                </span>
              </div>
            )
          })}
        </div>

        {/* Verified Real Unit Cost Footer Slab */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '16px 22px',
            background: 'rgba(16, 185, 129, 0.18)',
            borderTop: `2px solid ${MINT_PROFIT}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: clamp(progress(t, 3.2, 0.6)),
            transform: `scale(${mix(0.96, 1, success)})`,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: STEEL_WHITE }}>
              بهای واقعی و نهایی هر واحد کالا
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(241, 245, 249, 0.75)' }}>
              پایه قیمت‌گذاری مطمئن برای فروش
            </div>
          </div>
          <div
            dir="ltr"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 26,
              fontWeight: 900,
              color: MINT_PROFIT,
              textShadow: `0 0 16px ${MINT_PROFIT}`,
            }}
          >
            {fa(LANDED_TOTAL)}
          </div>
        </div>
      </div>

      {/* ─── Lower Telemetry Deck (y: 605 to 890) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 605,
          left: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'تسهیم باربری', val: 'بر اساس ارزش', col: BRASS_METALLIC },
            { label: 'کاردکس انبار', val: 'اصلاح با بهای کل', col: MINT_PROFIT },
            { label: 'قیمت جایگزینی', val: 'کاملاً شفاف', col: COPPER_BRIGHT },
          ].map((pill, i) => (
            <div
              key={pill.label}
              dir="rtl"
              style={{
                background: 'rgba(6, 26, 28, 0.85)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: 12,
                padding: '10px 8px',
                textAlign: 'center',
                opacity: clamp(progress(t, 1.5 + i * 0.3, 0.5)),
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: STEEL_MUTED, marginBottom: 3 }}>
                {pill.label}
              </div>
              <div style={{ fontSize: 12, fontWeight: 900, color: MINT_PROFIT }}>{pill.val}</div>
            </div>
          ))}
        </div>

        <div
          dir="rtl"
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: `1.5px solid ${MINT_PROFIT}55`,
            borderRadius: 14,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.25)',
              border: `1px solid ${MINT_PROFIT}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: MINT_PROFIT,
              flexShrink: 0,
            }}
          >
            ✓
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: STEEL_WHITE, marginBottom: 2 }}>
              فرمول دقیق و استانداردهای حسابداری صنعتی
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(241, 245, 249, 0.75)' }}>
              تمام فاکتورهای ترخیص و حمل به‌طور کامپیوتری و عادلانه روی کاردکس تمام اقلام سرشکن
              می‌شوند.
            </div>
          </div>
        </div>

        <div
          dir="ltr"
          style={{
            background: 'rgba(2, 18, 20, 0.9)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 12,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: MINT_PROFIT,
          }}
        >
          <span>COST_ALLOCATION: 100% COMPLETE</span>
          <span style={{ color: STEEL_WHITE }}>ACCURATE_LEDGER</span>
        </div>
      </div>
    </PlateStage>
  )
}

// ─── Scene 5 · Margin Held: Real Profit Locked into Cash Flow ────────────────

export function MarginHoldScene({ t, scene }: { t: number; scene: Scene }) {
  const targetSalePrice = 2_050_000
  const realProfit = targetSalePrice - LANDED_TOTAL // +410,000 (25% margin)
  const barProg = ease(clamp(progress(t, 0.5, 1.8)))
  const cashHit = popSpring(t, 1.4, 0.5)

  return (
    <PlateStage scene={scene} t={t} shakes={[1.4]} punches={[0.1, 1.4, 2.4]}>
      <IndustrialHeader
        badge="تضمین سودآوری پایدار"
        title="حالا قیمت روی بهای واقعی می‌نشیند!"
        subtitle="سود هر واحد دیگر روی کاغذ باقی نمی‌ماند؛"
        subtitleAccent="بلکه تبدیل به نقدینگی مطمئن در دخل می‌شود."
        accentColor={MINT_PROFIT}
        t={t}
      />

      {/* ─── Hero Center: Repriced Safe Card & Margin Dial (y: 170 to 580) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 165,
          left: 24,
          right: 24,
          height: 420,
          background: 'rgba(4, 24, 26, 0.95)',
          border: '1.5px solid rgba(16, 185, 129, 0.45)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 20px 48px rgba(0,0,0,0.8), 0 0 30px rgba(16, 185, 129, 0.15)',
        }}
      >
        {/* Guaranteed New Price Tag */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 24,
            left: 24,
            right: 24,
            background: 'rgba(6, 36, 38, 0.95)',
            border: `2px solid ${MINT_PROFIT}`,
            borderRadius: 16,
            padding: '16px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: `0 12px 30px rgba(0,0,0,0.6), inset 0 0 24px rgba(16, 185, 129, 0.2)`,
            transform: `scale(${mix(0.96, 1, cashHit)})`,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: STEEL_WHITE, marginBottom: 2 }}>
              قیمت فروش جدید (محاسبه دقیق)
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: MINT_PROFIT }}>
              بهای تمام‌شده واقعی + ۲۵٪ حاشیه سود امن
            </div>
          </div>

          <div
            dir="ltr"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 28,
              fontWeight: 900,
              color: MINT_PROFIT,
              textShadow: `0 0 16px ${MINT_PROFIT}`,
            }}
          >
            {fa(targetSalePrice)}
          </div>
        </div>

        {/* Real Margin Cash Yield Meter */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 136,
            left: 24,
            right: 24,
            background: 'rgba(6, 26, 28, 0.85)',
            border: '1.5px solid rgba(45, 212, 191, 0.3)',
            borderRadius: 14,
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: STEEL_WHITE }}>
              سود واقعی قطعی در هر کارتن:
            </span>
            <span
              dir="ltr"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 20,
                fontWeight: 900,
                color: MINT_PROFIT,
              }}
            >
              +{fa(realProfit)}
            </span>
          </div>

          {/* Progress bar */}
          <div
            style={{
              height: 14,
              borderRadius: 999,
              background: 'rgba(2, 14, 16, 0.8)',
              overflow: 'hidden',
              padding: 2,
            }}
          >
            <div
              style={{
                height: '100%',
                borderRadius: 999,
                width: `${Math.round(barProg * 100)}%`,
                background: `linear-gradient(90deg, ${BRASS_METALLIC}, ${MINT_PROFIT})`,
                boxShadow: `0 0 16px ${MINT_PROFIT}`,
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 12,
              fontSize: 11,
              color: STEEL_MUTED,
            }}
          >
            <span>بهای تمام‌شده: {fa(LANDED_TOTAL)}</span>
            <span>قیمت فروش بازار: {fa(targetSalePrice)}</span>
          </div>
        </div>

        {/* Margin Security Shield Stamp */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            bottom: 20,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 800,
            color: MINT_PROFIT,
            opacity: clamp(progress(t, 2.0, 0.5)),
          }}
        >
          [سپر سود فعال شد — تضمین بازگشت سرمایه و درآمد خالص]
        </div>
      </div>

      {/* ─── Lower Telemetry Deck (y: 605 to 890) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 605,
          left: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'سود هر کارتن', val: `+${fa(realProfit)}`, col: MINT_PROFIT },
            { label: 'سود ۲۰ کارتن', val: `+${fa(realProfit * TOTAL_UNITS)}`, col: BRASS_LIGHT },
            { label: 'حفظ سرمایه', val: '۱۰۰٪ تضمینی', col: BRASS_METALLIC },
          ].map((item, i) => (
            <div
              key={item.label}
              dir="rtl"
              style={{
                background: 'rgba(6, 26, 28, 0.85)',
                border: `1px solid ${item.col}33`,
                borderRadius: 12,
                padding: '10px 8px',
                textAlign: 'center',
                opacity: clamp(progress(t, 1.2 + i * 0.3, 0.5)),
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: STEEL_MUTED, marginBottom: 3 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: item.col }}>{item.val}</div>
            </div>
          ))}
        </div>

        <div
          dir="rtl"
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: `1.5px solid ${MINT_PROFIT}55`,
            borderRadius: 14,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.25)',
              border: `1px solid ${MINT_PROFIT}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: MINT_PROFIT,
              flexShrink: 0,
            }}
          >
            💰
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: STEEL_WHITE, marginBottom: 2 }}>
              پایان فروش‌های بی‌سود در بازار
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(241, 245, 249, 0.75)' }}>
              با بهای تمام‌شده واقعی، تخفیف‌های احساسی حذف می‌شوند و کسب‌وکار به سود خالص واقعی
              می‌رسد.
            </div>
          </div>
        </div>

        <div
          dir="ltr"
          style={{
            background: 'rgba(2, 18, 20, 0.9)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 12,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: MINT_PROFIT,
          }}
        >
          <span>PRICING_PROTECTION: SOLID_PROFIT</span>
          <span style={{ color: STEEL_WHITE }}>LOCKED</span>
        </div>
      </div>
    </PlateStage>
  )
}

// ─── Scene 6 · Industrial Climax CTA: See Real Cost, Take Real Profit ────────

export function LandedCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const loop = ease(clamp(progress(t, 0.1, 1.2)))
  const logoPop = popSpring(t, 0.6, 0.6)
  const ctaPop = popSpring(t, 2.2, 0.5)
  const shimmer = (t * 220) % 500

  return (
    <PlateStage scene={scene} t={t} shakes={[2.2]} punches={[0.15, 2.2]}>
      {/* Top Bar */}
      <div
        style={{
          position: 'absolute',
          top: 36,
          left: 24,
          right: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 20,
        }}
      >
        <div dir="rtl" style={{ fontSize: 12, fontWeight: 700, color: STEEL_MUTED }}>
          <span style={{ color: BRASS_METALLIC }}>●</span> سامانه بهای تمام‌شده // حسابچه
        </div>
        <div
          dir="ltr"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: BRASS_LIGHT,
            background: 'rgba(245, 158, 11, 0.15)',
            border: `1px solid ${BRASS_METALLIC}`,
            padding: '3px 10px',
            borderRadius: 999,
          }}
        >
          REAL_PROFIT // SECURED
        </div>
      </div>

      {/* ─── Hero Center: Stamped Copper & Gold Seal (y: 120 to 560) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 120,
          left: 24,
          right: 24,
          height: 440,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
        }}
      >
        {/* Orbital Heavy Metallic Rings */}
        <div style={{ position: 'relative', width: 220, height: 220, marginBottom: 16 }}>
          <svg
            width={220}
            height={220}
            viewBox="0 0 220 220"
            style={{ position: 'absolute', inset: 0 }}
          >
            <circle
              cx={110}
              cy={110}
              r={96}
              fill="none"
              stroke={BRASS_METALLIC}
              strokeWidth={2.4}
              strokeDasharray="603"
              strokeDashoffset={603 * (1 - loop)}
              transform={`rotate(${t * 30} 110 110)`}
              opacity={0.8}
              style={{ filter: `drop-shadow(0 0 16px ${BRASS_METALLIC})` }}
            />
            <circle
              cx={110}
              cy={110}
              r={76}
              fill="none"
              stroke={COPPER_BRIGHT}
              strokeWidth={2}
              strokeDasharray="477"
              strokeDashoffset={477 * (1 - loop)}
              transform={`rotate(${-t * 45} 110 110)`}
              opacity={0.7}
              style={{ filter: `drop-shadow(0 0 16px ${COPPER_BRIGHT})` }}
            />
          </svg>

          {/* Stamped Heavy Brass Core Emblem */}
          <div
            style={{
              position: 'absolute',
              inset: 36,
              borderRadius: 24,
              background: 'linear-gradient(135deg, rgba(8, 32, 34, 0.95), rgba(4, 16, 18, 0.98))',
              border: `2px solid ${BRASS_METALLIC}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 16px 40px rgba(0,0,0,0.8), 0 0 32px ${BRASS_METALLIC}66`,
              transform: `scale(${mix(0.6, 1, logoPop)})`,
            }}
          >
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                color: BRASS_LIGHT,
                textShadow: `0 0 20px ${BRASS_LIGHT}`,
              }}
            >
              H
            </div>
          </div>
        </div>

        {/* Brand Name */}
        <div
          dir="rtl"
          style={{
            fontSize: 44,
            fontWeight: 900,
            letterSpacing: '-0.02em',
            background: `linear-gradient(135deg, ${STEEL_WHITE}, ${BRASS_LIGHT})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: 6,
            textShadow: '0 4px 24px rgba(245, 158, 11, 0.3)',
          }}
        >
          حسابچه
        </div>

        {/* Slogan */}
        <div
          dir="rtl"
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: MINT_PROFIT,
            marginBottom: 16,
          }}
        >
          بهای واقعی را ببین، سود واقعی را بساز
        </div>

        {/* Industrial Trust Badges */}
        <div
          dir="rtl"
          style={{
            background: 'rgba(8, 32, 34, 0.75)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 14,
            padding: '8px 20px',
            fontSize: 12,
            fontWeight: 700,
            color: STEEL_MUTED,
            display: 'flex',
            gap: 12,
          }}
        >
          <span>تسهیم هوشمند باربری</span>
          <span>●</span>
          <span>گمرک و بیمه</span>
          <span>●</span>
          <span>حاشیه سود قطعی</span>
        </div>
      </div>

      {/* ─── Lower Action Zone (y: 580 to 890) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 590,
          left: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          zIndex: 20,
        }}
      >
        {/* Heavy Copper CTA Button */}
        <div
          dir="rtl"
          style={{
            position: 'relative',
            width: '100%',
            overflow: 'hidden',
            background: `linear-gradient(135deg, ${BRASS_LIGHT}, ${COPPER_BRIGHT})`,
            borderRadius: 16,
            padding: '16px 24px',
            textAlign: 'center',
            fontSize: 22,
            fontWeight: 900,
            color: '#1a0c02',
            boxShadow: `0 16px 48px rgba(0,0,0,0.8), 0 0 45px rgba(234, 88, 12, 0.45)`,
            transform: `scale(${mix(0.9, 1, ctaPop)})`,
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 80,
              left: shimmer - 100,
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)',
              transform: 'skewX(-25deg)',
            }}
          />
          همین حالا رایگان شروع کن
        </div>

        {/* Domain URL */}
        <div
          dir="ltr"
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: '0.22em',
            color: BRASS_LIGHT,
            textShadow: `0 0 14px ${BRASS_LIGHT}aa`,
          }}
        >
          hisabche.com
        </div>

        {/* Footer Trust Perks */}
        <div
          dir="rtl"
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            fontSize: 12,
            fontWeight: 700,
            color: STEEL_MUTED,
          }}
        >
          <span>✓ بدون نیاز به نصب پیچیده</span>
          <span>✓ شروع در ۲ دقیقه</span>
        </div>
      </div>
    </PlateStage>
  )
}
