// src/scenes/cashflow-cheques.tsx
// =============================================================================
// Reel 102 — «موشن استودیو شو‌ریل: سیستم عامل مالی حسابچه»
// Senior Motion Designer Portfolio Showreel — Extreme Craft & Full-Canvas Composition
//
// 1. 3D Isometric Holographic Vault & Laser Scan Disruption
// 2. Multidimensional Debt Constellation & Spatial Radar Sweep
// 3. Central Emerald Core Ignition & 3-Layer Exploded Isometric Glass UI
// 4. Procedural Financial Waterfall & Liquid Caustic Reservoir
// 5. Grand Finale: Iridescent Titanium VIP Pass with Specular Sweep & High-Impact CTA
//
// Zero generic static cards. 100% dynamic procedural motion graphics.
// Strictly bounded inside 540x960 canvas without empty bottoms or stepped typography.
// =============================================================================

import React from 'react'
import type { Scene } from '../engine/types'
import { clamp, mix, progress } from '../engine/anim'
import { stagePunch, stageShake } from './card-motion'
import { faNumber } from '../ui/motion-primitives'

// ─── Visual Tokens ────────────────────────────────────────────────────────────

const BG_VOID = '#040711'
const EMERALD = '#00ff88'
const CYAN = '#38bdf8'
const AMBER = '#f59e0b'
const RED = '#ef4444'
const TEXT_MUTED = '#94a3b8'

// ─── 3D Isometric Projection Helper ──────────────────────────────────────────

const ISO_CX = 270
const ISO_CY = 360
const ISO_UX = 28
const ISO_UY = 14
const ISO_UZ = 24

function iso(gx: number, gy: number, gz = 0): { x: number; y: number } {
  return {
    x: ISO_CX + (gx - gy) * ISO_UX,
    y: ISO_CY + (gx + gy) * ISO_UY - gz * ISO_UZ,
  }
}

// ─── Procedural Stage Canvas Frame ────────────────────────────────────────────

export function ShowreelStage({
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

  // Floating ambient dust particles
  const particles = Array.from({ length: 16 }, (_, i) => {
    const seed = i * 137.5
    const px = (seed * 9.3) % 540
    const py = (seed * 17.7 + t * 18) % 960
    const size = 1.5 + (i % 3)
    const alpha = 0.15 + (Math.sin(t * 2 + i) + 1) * 0.15
    return { px, py, size, alpha }
  })

  return (
    <div
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        direction: 'ltr',
        background: `radial-gradient(circle at 50% 30%, #0d1527 0%, ${BG_VOID} 75%)`,
        overflow: 'hidden',
        color: '#ffffff',
        fontFamily: 'Vazirmatn, sans-serif',
        transform: `translate(${shake.x.toFixed(1)}px, ${shake.y.toFixed(1)}px) scale(${punch.toFixed(3)})`,
        transformOrigin: 'center center',
      }}
    >
      {/* Dynamic Radial Energy Flare */}
      <div
        style={{
          position: 'absolute',
          top: '25%',
          left: '50%',
          width: 500,
          height: 500,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, transparent 65%)',
          filter: 'blur(30px)',
          pointerEvents: 'none',
        }}
      />

      {/* Procedural 3D Perspective Floor Grid */}
      <div
        style={{
          position: 'absolute',
          inset: -100,
          opacity: 0.08,
          backgroundImage:
            'linear-gradient(rgba(56,189,248,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          transform: 'perspective(600px) rotateX(60deg) translateY(120px)',
          transformOrigin: 'center center',
          pointerEvents: 'none',
        }}
      />

      {/* Ambient Floating Dust Motes */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.px,
            top: p.py,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: i % 2 === 0 ? CYAN : EMERALD,
            opacity: p.alpha,
            boxShadow: `0 0 6px ${i % 2 === 0 ? CYAN : EMERALD}`,
            pointerEvents: 'none',
          }}
        />
      ))}

      {children}

      {/* Global Minimalist Tech Footer Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 24,
          right: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 9.5,
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.4)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: 8,
          zIndex: 50,
        }}
      >
        <span>HISABCHE.LIQUIDITY // CASHFLOW_OS</span>
        <span>REALTIME RADAR</span>
        <span>FINANCE_V4.2</span>
      </div>
    </div>
  )
}

// ─── Sleek Financial Topbar ───────────────────────────────────────────────────

function FinanceTopbar({
  tag = 'سیستم عامل مالی حسابچه',
  badge = 'پایش زنده نقدینگی',
  badgeColor = CYAN,
}: {
  tag?: string
  badge?: string
  badgeColor?: string
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 36,
        left: 28,
        right: 28,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 40,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: badgeColor,
            boxShadow: `0 0 10px ${badgeColor}`,
          }}
        />
        <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 800, color: '#e2e8f0' }}>
          {tag}
        </span>
      </div>
      <div
        style={{
          padding: '4px 12px',
          borderRadius: 20,
          background: `${badgeColor}18`,
          border: `1px solid ${badgeColor}66`,
          color: badgeColor,
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        ● {badge}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ACT 1: 3D Holographic Vault & Laser Scan Disruption (0.00–7.20s)
// ─────────────────────────────────────────────────────────────────────────────

export function CashflowShockScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.5))
  const isAlarm = t >= 3.2
  const laserProgress = (t * 1.8) % 1
  const laserY = 170 + laserProgress * 260

  const collapseRatio = clamp(progress(t, 1.2, 3.2))
  const displayBalance = Math.round(mix(250000000, -185000000, collapseRatio))

  // Procedural 3D wireframe box corners
  const p1 = iso(-4, -4, 0)
  const p2 = iso(4, -4, 0)
  const p3 = iso(4, 4, 0)
  const p4 = iso(-4, 4, 0)
  const p5 = iso(-4, -4, 4)
  const p6 = iso(4, -4, 4)
  const p7 = iso(4, 4, 4)
  const p8 = iso(-4, 4, 4)

  const hudAngle = t * 75

  return (
    <ShowreelStage scene={scene} t={t} shakes={[3.2, 3.5]} punches={[0.1, 3.2]}>
      <FinanceTopbar
        tag="HISABCHE // LIQUIDITY ALERT"
        badge={isAlarm ? '⚠️ بحران نقدینگی' : '🟢 حساب نرمال'}
        badgeColor={isAlarm ? RED : CYAN}
      />

      {/* Bold Top Typography */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 80,
          left: 24,
          right: 24,
          textAlign: 'center',
          opacity: enter,
          zIndex: 35,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1.3 }}>
          دخل پر از فاکتور، ولی{' '}
          <span style={{ color: isAlarm ? RED : AMBER }}>چک‌ها پاس نمیشه!</span>
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: TEXT_MUTED,
            marginTop: 8,
            marginInline: 'auto',
            maxWidth: 440,
          }}
        >
          فروش در اوج؛ اما پول واقعی در باتلاق نسیه‌ها و حساب‌های معوقه قفل شده است
        </p>
      </div>

      {/* 3D Holographic Vault Diorama (y=175 to y=430) */}
      <svg
        style={{
          position: 'absolute',
          top: 130,
          left: 0,
          width: 540,
          height: 330,
          overflow: 'visible',
          zIndex: 15,
        }}
      >
        <circle
          cx={ISO_CX}
          cy={ISO_CY - 50}
          r={130}
          fill="none"
          stroke="rgba(56, 189, 248, 0.15)"
          strokeWidth={1.5}
          strokeDasharray="6 6"
        />
        <circle
          cx={ISO_CX}
          cy={ISO_CY - 50}
          r={100}
          fill="none"
          stroke={isAlarm ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 255, 136, 0.2)'}
          strokeWidth={1}
        />

        <g transform={`rotate(${hudAngle}, ${ISO_CX}, ${ISO_CY - 50})`}>
          <line
            x1={ISO_CX - 130}
            y1={ISO_CY - 50}
            x2={ISO_CX + 130}
            y2={ISO_CY - 50}
            stroke="rgba(56, 189, 248, 0.2)"
            strokeWidth={1}
          />
          <line
            x1={ISO_CX}
            y1={ISO_CY - 180}
            x2={ISO_CX}
            y2={ISO_CY + 80}
            stroke="rgba(56, 189, 248, 0.2)"
            strokeWidth={1}
          />
        </g>

        {/* 3D Wireframe Box */}
        <polygon
          points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`}
          fill="rgba(15, 23, 42, 0.6)"
          stroke={isAlarm ? 'rgba(239, 68, 68, 0.6)' : 'rgba(56, 189, 248, 0.4)'}
          strokeWidth={1.5}
        />
        <polygon
          points={`${p5.x},${p5.y} ${p6.x},${p6.y} ${p7.x},${p7.y} ${p8.x},${p8.y}`}
          fill="rgba(56, 189, 248, 0.08)"
          stroke={isAlarm ? RED : CYAN}
          strokeWidth={2}
          filter={isAlarm ? 'drop-shadow(0 0 10px rgba(239, 68, 68, 0.8))' : 'none'}
        />
        <line
          x1={p1.x}
          y1={p1.y}
          x2={p5.x}
          y2={p5.y}
          stroke={isAlarm ? RED : CYAN}
          strokeWidth={1.5}
        />
        <line
          x1={p2.x}
          y1={p2.y}
          x2={p6.x}
          y2={p6.y}
          stroke={isAlarm ? RED : CYAN}
          strokeWidth={1.5}
        />
        <line
          x1={p3.x}
          y1={p3.y}
          x2={p7.x}
          y2={p7.y}
          stroke={isAlarm ? RED : CYAN}
          strokeWidth={1.5}
        />
        <line
          x1={p4.x}
          y1={p4.y}
          x2={p8.x}
          y2={p8.y}
          stroke={isAlarm ? RED : CYAN}
          strokeWidth={1.5}
        />

        <line
          x1={40}
          y1={laserY}
          x2={500}
          y2={laserY}
          stroke={isAlarm ? RED : '#00ff88'}
          strokeWidth={2.5}
          filter="drop-shadow(0 0 8px #00ff88)"
        />
      </svg>

      {/* Center Telemetry Cheque Card (y=410 to y=640) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 410,
          left: 45,
          right: 45,
          padding: '20px 24px',
          borderRadius: 22,
          background: 'linear-gradient(145deg, rgba(17, 24, 39, 0.94), rgba(9, 14, 26, 0.98))',
          border: isAlarm
            ? '2px solid rgba(239, 68, 68, 0.8)'
            : '1.5px solid rgba(56, 189, 248, 0.4)',
          boxShadow: isAlarm
            ? '0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(239, 68, 68, 0.35)'
            : '0 25px 60px rgba(0,0,0,0.7)',
          zIndex: 25,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>🏦</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>
              چک صیادی سررسید فردا صبح
            </span>
          </div>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 6,
              background: isAlarm ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.15)',
              color: isAlarm ? RED : AMBER,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {isAlarm ? '⚠️ کسر موجودی' : 'در حال اسکن حساب'}
          </span>
        </div>

        <div style={{ textAlign: 'center', margin: '14px 0' }}>
          <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>تراز نقدینگی لحظه‌ای بانک:</div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 900,
              fontFamily: 'monospace',
              color: displayBalance < 0 ? RED : '#34d399',
              marginTop: 4,
            }}
          >
            {faNumber(displayBalance)} <span style={{ fontSize: 16 }}>تومان</span>
          </div>
        </div>

        {/* 24-Bar Audio Oscilloscope */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            height: 26,
          }}
        >
          {Array.from({ length: 24 }, (_, i) => {
            const h = Math.abs(Math.sin(t * 12 + i * 0.4)) * 22 + 4
            return (
              <div
                key={i}
                style={{
                  width: 3,
                  height: h,
                  borderRadius: 1.5,
                  background: isAlarm ? RED : CYAN,
                  boxShadow: `0 0 6px ${isAlarm ? RED : CYAN}`,
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Bottom Active Zone: 3 Crisis Metrics + Alert Log (y=665 to y=890) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 665,
          left: 45,
          right: 45,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 30,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: '12px 10px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 10.5, color: TEXT_MUTED }}>کسری قطعی</div>
            <div style={{ fontSize: 19, fontWeight: 900, color: RED, marginTop: 4 }}>
              ۱۸۵ میلیون
            </div>
          </div>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: '12px 10px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 10.5, color: TEXT_MUTED }}>چک‌های فردا</div>
            <div style={{ fontSize: 19, fontWeight: 900, color: AMBER, marginTop: 4 }}>۳ فقره</div>
          </div>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: '12px 10px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 10.5, color: TEXT_MUTED }}>ریسک مسدودی</div>
            <div style={{ fontSize: 19, fontWeight: 900, color: '#f8fafc', marginTop: 4 }}>
              ۱۰۰٪ فوری
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(0,0,0,0.65)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 14,
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 11.5, color: '#fecdd3', fontWeight: 800 }}>
            ⚠️ هشدار حسابچه: ۱۸۵ میلیون نقدینگی برای پاس شدن چک‌ها نیاز است
          </span>
          <span
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 4,
              background: RED,
              color: '#fff',
              fontWeight: 900,
            }}
          >
            ACTION_REQUIRED
          </span>
        </div>
      </div>
    </ShowreelStage>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ACT 2: Multidimensional Debt Constellation & Spatial Radar (7.20–14.40s)
// ─────────────────────────────────────────────────────────────────────────────

export function TrappedReceivablesScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.5))
  const radarSweep = (t * 120) % 360

  const nodes = [
    { name: 'فروشگاه تابان', debt: '۶۴ میلیون', x: 120, y: 260, delay: '۴۲ روز تاخیر', tone: RED },
    { name: 'پخش البرز', debt: '۸۸ میلیون', x: 390, y: 220, delay: '۳۱ روز تاخیر', tone: AMBER },
    { name: 'هایپر مرکزی', debt: '۳۳ میلیون', x: 340, y: 410, delay: '۱۸ روز تاخیر', tone: CYAN },
    {
      name: 'تامین‌کننده آذر',
      debt: '۲۵ میلیون',
      x: 150,
      y: 390,
      delay: '۱۰ روز تاخیر',
      tone: '#a855f7',
    },
  ]

  return (
    <ShowreelStage scene={scene} t={t} punches={[0.3, 2.5]}>
      <FinanceTopbar tag="ACCOUNTS RECEIVABLE" badge="مطالبات راکد" badgeColor={AMBER} />

      {/* Bold Top Headline */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 80,
          left: 24,
          right: 24,
          textAlign: 'center',
          opacity: enter,
          zIndex: 35,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1.3 }}>
          نسیه‌هایی که بی‌صدا <span style={{ color: AMBER }}>در بازار فراموش شدند</span>
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: TEXT_MUTED,
            marginTop: 8,
            marginInline: 'auto',
            maxWidth: 440,
          }}
        >
          سرمایه در دست خریداران خوابیده و سررسیدها بدون هیچ آلارمی سپری می‌شوند
        </p>
      </div>

      {/* Center Hero: Constellation Radar Canvas (y=175 to y=550) */}
      <svg
        style={{
          position: 'absolute',
          top: 150,
          left: 0,
          width: 540,
          height: 380,
          overflow: 'visible',
          zIndex: 15,
        }}
      >
        <circle
          cx={270}
          cy={300}
          r={42}
          fill="rgba(15, 23, 42, 0.9)"
          stroke={CYAN}
          strokeWidth={2}
        />
        <circle cx={270} cy={300} r={18} fill="rgba(56, 189, 248, 0.25)" />
        <text x={270} y={305} fill="#ffffff" fontSize={12} fontWeight={900} textAnchor="middle">
          حساب شما
        </text>

        <g transform={`rotate(${radarSweep}, 270, 300)`}>
          <line
            x1={270}
            y1={300}
            x2={270}
            y2={120}
            stroke="rgba(0, 255, 136, 0.6)"
            strokeWidth={2}
          />
          <polygon points="270,300 240,120 300,120" fill="rgba(0, 255, 136, 0.08)" />
        </g>

        {nodes.map((node, i) => (
          <g key={i}>
            <path
              d={`M 270 300 Q ${(270 + node.x) / 2} ${(300 + node.y) / 2 - 25} ${node.x} ${node.y}`}
              fill="none"
              stroke={node.tone}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              opacity={0.65}
            />
            <circle
              cx={node.x}
              cy={node.y}
              r={18}
              fill="rgba(15, 23, 42, 0.9)"
              stroke={node.tone}
              strokeWidth={2}
            />
            <circle cx={node.x} cy={node.y} r={6} fill={node.tone} />
          </g>
        ))}
      </svg>

      {/* Node Tags */}
      {nodes.map((node, i) => {
        const floatY = Math.sin(t * 3 + i * 1.5) * 5
        return (
          <div
            key={i}
            dir="rtl"
            style={{
              position: 'absolute',
              left: node.x - 70,
              top: node.y + 140 + floatY,
              width: 140,
              padding: '6px 10px',
              borderRadius: 10,
              background: 'rgba(15, 23, 42, 0.92)',
              border: `1px solid ${node.tone}66`,
              boxShadow: `0 8px 24px rgba(0,0,0,0.6), 0 0 15px ${node.tone}33`,
              textAlign: 'center',
              zIndex: 25,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 900, color: '#ffffff' }}>{node.name}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: node.tone, marginTop: 1 }}>
              {node.debt}
            </div>
            <div style={{ fontSize: 8.5, color: TEXT_MUTED }}>{node.delay}</div>
          </div>
        )
      })}

      {/* Bottom Active Zone: Frozen Capital Analytics (y=565 to y=890) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 565,
          left: 45,
          right: 45,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 30,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: 16,
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>کل مطالبات معوقه</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: AMBER, marginTop: 4 }}>
              ۲۱۰ <span style={{ fontSize: 14 }}>میلیون</span>
            </div>
            <div style={{ fontSize: 10, color: '#fcd34d', marginTop: 2 }}>
              سرمایه منجمد در بازار
            </div>
          </div>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: 16,
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>میانگین دوره وصول</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: CYAN, marginTop: 4 }}>
              ۳۴ <span style={{ fontSize: 14 }}>روز تاخیر</span>
            </div>
            <div style={{ fontSize: 10, color: '#a5f3fc', marginTop: 2 }}>
              نیاز به یادآوری خودکار
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.65)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 14,
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: '#f8fafc', fontWeight: 800 }}>
            📱 ماژول وصول حسابچه: ارسال خودکار پیامک رسمی و لینک پرداخت آنلاین
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: EMERALD }}>READY_SYNC</span>
        </div>
      </div>
    </ShowreelStage>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ACT 3: Core Ignition & 3-Layer Exploded Isometric Glass UI (14.40–25.20s)
// ─────────────────────────────────────────────────────────────────────────────

export function CashCalendarScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.2, 0.6))
  const ignition = clamp(progress(t, 1.8, 3.0))
  const coreScale = 1 + Math.sin(t * 8) * 0.05

  return (
    <ShowreelStage scene={scene} t={t} punches={[1.9, 4.5, 8.5]}>
      <FinanceTopbar
        tag="AUTOMATED COLLECTION CORE"
        badge="وصول هوشمند سررسید"
        badgeColor={EMERALD}
      />

      {/* Bold Top Headline */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 80,
          left: 24,
          right: 24,
          textAlign: 'center',
          opacity: enter,
          zIndex: 35,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1.3 }}>
          یادآوری هوشمند در <span style={{ color: EMERALD }}>لحظه سررسید</span>
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: TEXT_MUTED,
            marginTop: 8,
            marginInline: 'auto',
            maxWidth: 440,
          }}
        >
          ارسال خودکار پیامک رسمی با درگاه پرداخت آنلاین برای وصول قطعی مطالبات
        </p>
      </div>

      {/* 3D Exploded Glass Deck (y=175 to y=550) */}
      <div
        style={{
          position: 'absolute',
          top: 175,
          left: 45,
          right: 45,
          height: 360,
          perspective: 1000,
          transformStyle: 'preserve-3d',
          zIndex: 20,
        }}
      >
        {/* Layer 1 (Bottom) */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 22,
            background: 'linear-gradient(135deg, rgba(8, 20, 36, 0.95), rgba(4, 12, 24, 0.98))',
            border: '1.5px solid rgba(56, 189, 248, 0.6)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 35px rgba(56, 189, 248, 0.2)',
            transform: `rotateX(52deg) rotateZ(-30deg) translateZ(${-60 * ignition}px) scale(${coreScale})`,
            padding: '16px 20px',
            transition: 'all 0.4s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: CYAN }}>
              ⚡ پایپ‌لاین دفاتر کل و تراز مالی
            </span>
            <span style={{ fontSize: 10, color: EMERALD, fontWeight: 800 }}>موتور فعال</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <div
              style={{
                flex: 1,
                padding: 8,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                fontSize: 10.5,
              }}
            >
              ثبت سند دوبل حسابداری
            </div>
            <div
              style={{
                flex: 1,
                padding: 8,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                fontSize: 10.5,
              }}
            >
              کسر اتوماتیک موجودی کالا
            </div>
          </div>
        </div>

        {/* Layer 2 (Middle) */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 22,
            background: 'linear-gradient(135deg, rgba(16, 38, 28, 0.96), rgba(8, 22, 16, 0.98))',
            border: '2px solid rgba(0, 255, 136, 0.85)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 45px rgba(0, 255, 136, 0.35)',
            transform: `rotateX(52deg) rotateZ(-30deg) translateZ(${30 * ignition}px)`,
            padding: '18px 22px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>
              📱 پیامک خودکار یادآوری نسیه
            </span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 4,
                background: '#059669',
                color: '#fff',
                fontSize: 10,
              }}
            >
              ارسال شد ✅
            </span>
          </div>
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              fontSize: 11.5,
              color: '#d1fae5',
              lineHeight: 1.5,
            }}
          >
            «همکار گرامی فروشگاه تابان، فاکتور شماره ۱۰۴۲ آماده پرداخت است. کلیک کنید.»
          </div>
        </div>

        {/* Layer 3 (Top Floating Shield) */}
        <div
          style={{
            position: 'absolute',
            top: '38%',
            left: '50%',
            transform: `translate(-50%, -50%) rotateX(52deg) rotateZ(-30deg) translateZ(${110 * ignition}px)`,
            width: 110,
            height: 110,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0, 255, 136, 0.35), transparent 70%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #00ff88',
            boxShadow: '0 0 35px #00ff88',
          }}
        >
          <span style={{ fontSize: 36 }}>💳</span>
        </div>
      </div>

      {/* Bottom Active Zone: Collection Performance (y=565 to y=890) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 565,
          left: 45,
          right: 45,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 30,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(0, 255, 136, 0.35)',
              borderRadius: 16,
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>نرخ تسویه به موقع</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: EMERALD, marginTop: 4 }}>
              {faNumber(92)}٪
            </div>
            <div style={{ fontSize: 10, color: '#86efac', marginTop: 2 }}>
              وصول بدون تنش و پیگیری تلفنی
            </div>
          </div>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: 16,
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>کاهش مطالبات سوخت‌شده</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: CYAN, marginTop: 4 }}>
              -{faNumber(88)}٪
            </div>
            <div style={{ fontSize: 10, color: '#a5f3fc', marginTop: 2 }}>
              تضمین جریان نقدینگی صندوق
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.65)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 14,
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: '#f8fafc', fontWeight: 800 }}>
            ⚡ تسویه مستقیم با درگاه شاپرک متصل به سند دریافت حسابداری
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: EMERALD }}>AUTO_RECONCILE</span>
        </div>
      </div>
    </ShowreelStage>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ACT 4: Procedural Waterfall & Liquid Caustic Reservoir (25.20–34.60s)
// ─────────────────────────────────────────────────────────────────────────────

export function LiquidityForecastScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.5))
  const fillProgress = clamp(progress(t, 0.8, 3.5))

  const bars = [
    { label: 'فروش نقدی', val: 120, tone: EMERALD },
    { label: 'وصول طلب ۱', val: 88, tone: EMERALD },
    { label: 'وصول طلب ۲', val: 64, tone: CYAN },
    { label: 'خرید کالا', val: -70, tone: AMBER },
    { label: 'هزینه جاری', val: -35, tone: AMBER },
    { label: 'چک صادره', val: -65, tone: RED },
    { label: 'سود خالص', val: 102, tone: EMERALD },
  ]

  return (
    <ShowreelStage scene={scene} t={t} punches={[0.4, 2.8, 6.5]}>
      <FinanceTopbar tag="30-DAY CASHFLOW FORECAST" badge="تراز مثبت نقدینگی" badgeColor={CYAN} />

      {/* Bold Top Headline */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 80,
          left: 24,
          right: 24,
          textAlign: 'center',
          opacity: enter,
          zIndex: 35,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1.3 }}>
          پیش‌بینی ۳۰ روزه <span style={{ color: CYAN }}>تراز نقدینگی و دخل</span>
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: TEXT_MUTED,
            marginTop: 8,
            marginInline: 'auto',
            maxWidth: 440,
          }}
        >
          سیستم قبل از رسیدن تاریخ سررسید، کسری موجودی حساب را پیش‌بینی و رفع می‌کند
        </p>
      </div>

      {/* Center Hero: Financial Waterfall Chart (y=175 to y=550) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 175,
          left: 45,
          right: 45,
          height: 360,
          padding: '20px 22px',
          borderRadius: 24,
          background: 'linear-gradient(145deg, rgba(13, 20, 36, 0.95), rgba(7, 12, 22, 0.98))',
          border: '1.5px solid rgba(56, 189, 248, 0.45)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.75)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>
            📊 آبشار گردش وجوه نقد ماهانه
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: EMERALD }}>
            پاس شدن ۱۰۰٪ چک‌ها ✅
          </span>
        </div>

        {/* 7 Animated Waterfall Columns */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            height: 200,
            padding: '0 10px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {bars.map((bar, i) => {
            const h = Math.abs(bar.val) * fillProgress * 1.25
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: 44,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: Math.max(8, h),
                    borderRadius: 6,
                    background: `linear-gradient(180deg, ${bar.tone}, ${bar.tone}66)`,
                    boxShadow: `0 0 15px ${bar.tone}55`,
                    transition: 'height 0.3s ease',
                  }}
                />
                <span style={{ fontSize: 9, color: TEXT_MUTED, marginTop: 6, textAlign: 'center' }}>
                  {bar.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Liquid Reservoir Level Meter */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11.5,
              marginBottom: 6,
            }}
          >
            <span style={{ color: TEXT_MUTED }}>سطح اطمینان نقدینگی حساب:</span>
            <span style={{ color: EMERALD, fontWeight: 900, fontFamily: 'monospace' }}>
              {Math.round(fillProgress * 100)}٪ امن
            </span>
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 5,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.round(fillProgress * 100)}%`,
                background: 'linear-gradient(90deg, #38bdf8, #00ff88)',
                boxShadow: '0 0 14px #00ff88',
              }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Active Zone: Forecast Telemetry (y=565 to y=890) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 565,
          left: 45,
          right: 45,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 30,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(0, 255, 136, 0.35)',
              borderRadius: 16,
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>مازاد نقدینگی پایان ماه</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: EMERALD, marginTop: 4 }}>
              +۱۴۵ <span style={{ fontSize: 14 }}>میلیون</span>
            </div>
            <div style={{ fontSize: 10, color: '#86efac', marginTop: 2 }}>
              پوشش ۱۰۰٪ تعهدات بانکی
            </div>
          </div>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: 16,
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>وضعیت اعتباری دسته چک</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: CYAN, marginTop: 4 }}>رتبه A+</div>
            <div style={{ fontSize: 10, color: '#a5f3fc', marginTop: 2 }}>
              صفر چک برگشتی در تاریخچه
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.65)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 14,
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: '#f8fafc', fontWeight: 800 }}>
            🛡️ تعادل دائمی نقدینگی؛ کنترل بی‌نقص دخل و خروج بدون استرس
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: EMERALD }}>BALANCED ✅</span>
        </div>
      </div>
    </ShowreelStage>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ACT 5: Showreel Grand Finale & Iridescent VIP Pass (34.60–41.20s)
// ─────────────────────────────────────────────────────────────────────────────

export function CashflowCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.5))
  const cardSweep = ((t * 80) % 240) - 60
  const pulse = Math.sin(t * 6) * 0.04

  return (
    <ShowreelStage scene={scene} t={t} punches={[2.0, 4.6]}>
      <FinanceTopbar tag="HISABCHE VIP ACCESS" badge="نسخه طلایی سازمانی" badgeColor={AMBER} />

      {/* Bold Top Headline */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 80,
          left: 24,
          right: 24,
          textAlign: 'center',
          opacity: enter,
          zIndex: 35,
        }}
      >
        <h1 style={{ fontSize: 29, fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1.3 }}>
          مدیریت مالی بدون استرس با <span style={{ color: AMBER }}>حسابچه VIP</span>
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: TEXT_MUTED,
            marginTop: 8,
            marginInline: 'auto',
            maxWidth: 440,
          }}
        >
          کلمه «حسابچه» را در دایرکت بفرست تا اکانت تست برای کسب‌وکارت فعال شود
        </p>
      </div>

      {/* Center Hero: Floating Iridescent Titanium VIP Pass (y=175 to y=520) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 175,
          left: 45,
          right: 45,
          height: 330,
          padding: '24px 22px',
          borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(20, 27, 45, 0.98), rgba(10, 15, 26, 0.98))',
          border: '2px solid rgba(245, 158, 11, 0.7)',
          boxShadow: '0 30px 70px rgba(0,0,0,0.85), 0 0 45px rgba(245, 158, 11, 0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 25,
        }}
      >
        {/* Specular Holographic Sheen Sweep Beam */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${cardSweep}%`,
            width: 100,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)',
            transform: 'skewX(-25deg)',
            pointerEvents: 'none',
          }}
        />

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#fde68a' }}>
              👑 HISABCHE VIP PASS
            </span>
            <span
              style={{
                fontSize: 12,
                padding: '3px 10px',
                borderRadius: 6,
                background: '#f59e0b',
                color: '#000',
                fontWeight: 900,
              }}
            >
              دسترسی کامل
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: TEXT_MUTED, marginTop: 4 }}>
            اکانت تست رایگان سازمانی
          </div>
        </div>

        <div style={{ margin: '14px 0' }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', marginBottom: 4 }}>
            فاکتور آنلاین • انبار هوشمند • تراز نقدینگی
          </div>
          <div style={{ fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.5 }}>
            پاس شدن به موقع چک‌ها، دریافت آنی مطالبات و صدور ۱۰ ثانیه‌ای پیش‌فاکتور
          </div>
        </div>

        <div
          style={{
            padding: '12px 18px',
            borderRadius: 12,
            background: 'linear-gradient(90deg, #f59e0b, #d97706)',
            color: '#000000',
            textAlign: 'center',
            fontSize: 13.5,
            fontWeight: 900,
            letterSpacing: 0.5,
            boxShadow: '0 0 25px rgba(245, 158, 11, 0.5)',
          }}
        >
          شروع تست رایگان — hisabche.com 🚀
        </div>
      </div>

      {/* Bottom Active Zone: Massive CTA Button & Perks (y=535 to y=890) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 535,
          left: 45,
          right: 45,
          textAlign: 'center',
          zIndex: 35,
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderRadius: 22,
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: '#020617',
            fontSize: 22,
            fontWeight: 900,
            boxShadow: '0 20px 50px rgba(245, 158, 11, 0.45)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            transform: `scale(${1 + pulse})`,
            transition: 'transform 0.1s ease',
          }}
        >
          <span>ارسال کلمه</span>
          <span
            style={{
              background: '#020617',
              color: '#f59e0b',
              padding: '4px 14px',
              borderRadius: 10,
              fontSize: 24,
              fontWeight: 900,
            }}
          >
            «حسابچه»
          </span>
          <span>در دایرکت</span>
        </div>

        {/* Perks Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginTop: 18,
          }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 12,
              padding: '10px 6px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ fontSize: 13 }}>🏦</div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
              پایش چک‌ها
            </div>
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 12,
              padding: '10px 6px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ fontSize: 13 }}>📱</div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
              پیامک وصول
            </div>
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 12,
              padding: '10px 6px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ fontSize: 13 }}>👑</div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
              اکانت VIP
            </div>
          </div>
        </div>
      </div>
    </ShowreelStage>
  )
}
