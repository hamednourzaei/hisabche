// ============================================
// Cashflow Radar Art Direction (Reel 108) — «رادار نقدینگی»
//
// The Quantum Sonar & Live Telemetry Cockpit
// High-tech financial observability engine for modern enterprise merchants.
//
// Strictly compliant with studio guardrails:
// - 100% Dark Studio Theme (obsidian-cinematic & cyber-emerald HUD).
// - No divider line, no camera zoom (noZoom: true).
// - Safe area: zero elements within 24px of the 540x960 canvas edge.
// - Deterministic time-driven math with spring and ease physics.
// - Direction LTR root with explicit RTL for Persian clusters.
// ============================================

import React from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, mix, progress, spring } from '../engine/anim'

// ─── Color Tokens ────────────────────────────────────────────────────────────

const INK_VOID = '#020617'
const RADAR_GRID = 'rgba(16, 185, 129, 0.12)'
const RADAR_RING = 'rgba(16, 185, 129, 0.22)'
const EMERALD_BEACON = '#10b981'
const EMERALD_GLOW = '#34d399'
const AMBER_PING = '#f59e0b'
const ROSE_ANOMALY = '#f43f5e'
const CYAN_TELEMETRY = '#38bdf8'
const TEXT_PRIMARY = '#f8fafc'
const TEXT_MUTED = '#94a3b8'

function pop(t: number, at: number, dur = 0.5): number {
  return spring(clamp(progress(t, at, dur)))
}

// ─── Stage Shell ─────────────────────────────────────────────────────────────

function RadarStage({ children, t }: { children: React.ReactNode; scene: Scene; t: number }) {
  const ambientPulse = 0.08 + 0.02 * Math.sin(t * 1.5)
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: 540,
        height: 960,
        backgroundColor: INK_VOID,
        direction: 'ltr',
        overflow: 'hidden',
        color: TEXT_PRIMARY,
        fontFamily: "'Vazirmatn', -apple-system, sans-serif",
      }}
    >
      {/* Deep Cockpit Vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 45%, rgba(16, 185, 129, ${ambientPulse}) 0%, transparent 65%), radial-gradient(circle at 50% 90%, rgba(2, 6, 23, 0.95) 0%, #020617 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Hexagonal / Radial HUD Matrix */}
      <svg
        width={540}
        height={960}
        style={{ position: 'absolute', inset: 0, opacity: 0.35, pointerEvents: 'none' }}
      >
        <defs>
          <pattern id="radar-dots" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="15" cy="15" r="1" fill="rgba(16, 185, 129, 0.3)" />
          </pattern>
        </defs>
        <rect width="540" height="960" fill="url(#radar-dots)" />
      </svg>

      {/* Telemetry Corner Markers (24px safe margin) */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          width: 14,
          height: 14,
          borderTop: `2px solid ${RADAR_RING}`,
          borderLeft: `2px solid ${RADAR_RING}`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          width: 14,
          height: 14,
          borderTop: `2px solid ${RADAR_RING}`,
          borderRight: `2px solid ${RADAR_RING}`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          width: 14,
          height: 14,
          borderBottom: `2px solid ${RADAR_RING}`,
          borderLeft: `2px solid ${RADAR_RING}`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          width: 14,
          height: 14,
          borderBottom: `2px solid ${RADAR_RING}`,
          borderRight: `2px solid ${RADAR_RING}`,
          pointerEvents: 'none',
        }}
      />

      {children}

      {/* Bottom Telemetry Ticker (Above safe area) */}
      <div
        style={{
          position: 'absolute',
          bottom: 28,
          left: 28,
          right: 28,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: '0.12em',
          color: 'rgba(148, 163, 184, 0.45)',
          zIndex: 30,
        }}
      >
        <span>RADAR_CH_01 // SECURE_TELEMETRY</span>
        <span>HISABCHE // OBSIDIAN_HUD</span>
      </div>
    </div>
  )
}

// ─── Cockpit Topbar & Header ──────────────────────────────────────────────────

function CockpitHeader({
  badge,
  title,
  subtitle,
  subtitleAccent,
  accentColor = EMERALD_GLOW,
  t,
}: {
  badge: string
  title: string
  subtitle: string
  subtitleAccent: string
  accentColor?: string
  t: number
}) {
  const enter = clamp(progress(t, 0.05, 0.45))
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        top: 48,
        left: 28,
        right: 28,
        zIndex: 25,
        opacity: enter,
        transform: `translateY(${mix(10, 0, enter)}px)`,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 10px',
          borderRadius: 999,
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: EMERALD_BEACON,
            boxShadow: `0 0 8px ${EMERALD_BEACON}`,
          }}
        />
        <span
          style={{ fontSize: 11, fontWeight: 700, color: EMERALD_GLOW, letterSpacing: '0.04em' }}
        >
          {badge}
        </span>
      </div>

      <div
        style={{
          fontSize: 24,
          fontWeight: 900,
          color: TEXT_PRIMARY,
          lineHeight: 1.35,
          marginBottom: 4,
        }}
      >
        {title}
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_MUTED, lineHeight: 1.45 }}>
        <span>{subtitle} </span>
        <span style={{ color: accentColor, fontWeight: 800 }}>{subtitleAccent}</span>
      </div>
    </div>
  )
}

// ─── Scene 1: Blind Radar Sweep (0.00–7.00s) ──────────────────────────────────

export function RadarSweepScene({ t, scene }: { t: number; scene: Scene }) {
  const angle = (t * 120) % 360
  const pulse = 0.5 + 0.5 * Math.sin(t * 3.5)

  return (
    <RadarStage scene={scene} t={t}>
      <CockpitHeader
        badge="اسکن مداوم جریان وجوه"
        title="کسب‌وکارت دخل شلوغی داره،"
        subtitle="اما ته ماه، می‌دونی"
        subtitleAccent="پول واقعی کجاست؟"
        accentColor={AMBER_PING}
        t={t}
      />

      {/* Radar Disc (Center: 270, 480, Radius: 170) */}
      <div
        style={{
          position: 'absolute',
          top: 290,
          left: 100,
          width: 340,
          height: 340,
          borderRadius: '50%',
          border: `1px solid ${RADAR_RING}`,
          boxShadow: `0 0 35px rgba(16, 185, 129, 0.08)`,
          background: 'rgba(2, 6, 23, 0.65)',
        }}
      >
        {/* Concentric rings */}
        <div
          style={{
            position: 'absolute',
            inset: 40,
            borderRadius: '50%',
            border: `1px dashed ${RADAR_GRID}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 90,
            borderRadius: '50%',
            border: `1px solid ${RADAR_GRID}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 140,
            borderRadius: '50%',
            border: `1px solid ${RADAR_RING}`,
            background: 'rgba(16, 185, 129, 0.04)',
          }}
        />

        {/* Crosshair axes */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: RADAR_GRID,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: RADAR_GRID,
          }}
        />

        {/* Sweeping Beam */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `conic-gradient(from ${angle}deg, rgba(16, 185, 129, 0.35) 0deg, transparent 65deg)`,
            pointerEvents: 'none',
          }}
        />

        {/* Center Pulse Core */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: EMERALD_BEACON,
            transform: 'translate(-50%, -50%)',
            boxShadow: `0 0 ${12 + pulse * 10}px ${EMERALD_BEACON}`,
          }}
        />
      </div>

      {/* Lower Readout Console */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 120,
          left: 28,
          right: 28,
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 12,
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: TEXT_MUTED }}>وضعیت پایش مالی</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: EMERALD_GLOW }}>
            رادار پایش فعال · اسکن لحظه‌ای
          </div>
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            color: CYAN_TELEMETRY,
            fontWeight: 700,
          }}
        >
          SWEEP: 360°
        </div>
      </div>
    </RadarStage>
  )
}

// ─── Scene 2: Anomaly Blips Target Lock (7.00–14.00s) ─────────────────────────

export function AnomalyBlipScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.3, 0.5)
  const p2 = pop(t, 1.2, 0.5)
  const p3 = pop(t, 2.1, 0.5)
  const sweepAngle = (t * 140) % 360

  return (
    <RadarStage scene={scene} t={t}>
      <CockpitHeader
        badge="کشف نقاط ابهام"
        title="خرده‌نشت‌های پنهان،"
        subtitle="بدون رادار، آرام‌آرام"
        subtitleAccent="به بهمن مغایرت تبدیل می‌شوند!"
        accentColor={ROSE_ANOMALY}
        t={t}
      />

      {/* Radar Disc with Targeting Rings */}
      <div
        style={{
          position: 'absolute',
          top: 280,
          left: 100,
          width: 340,
          height: 340,
          borderRadius: '50%',
          border: `1px solid ${RADAR_RING}`,
          background: 'rgba(2, 6, 23, 0.75)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 40,
            borderRadius: '50%',
            border: `1px dashed ${RADAR_GRID}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 90,
            borderRadius: '50%',
            border: `1px solid ${RADAR_GRID}`,
          }}
        />

        {/* Sweep */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `conic-gradient(from ${sweepAngle}deg, rgba(244, 63, 94, 0.25) 0deg, transparent 60deg)`,
            pointerEvents: 'none',
          }}
        />

        {/* Blip 1: Unconfirmed Sale */}
        {p1 > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 70,
              right: 80,
              transform: `scale(${p1})`,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: ROSE_ANOMALY,
                boxShadow: `0 0 14px ${ROSE_ANOMALY}`,
              }}
            />
            <div
              dir="rtl"
              style={{
                position: 'absolute',
                top: -18,
                right: 14,
                fontSize: 10,
                fontWeight: 700,
                color: ROSE_ANOMALY,
                whiteSpace: 'nowrap',
                background: 'rgba(2, 6, 23, 0.9)',
                padding: '2px 6px',
                borderRadius: 4,
                border: `1px solid ${ROSE_ANOMALY}`,
              }}
            >
              فاکتور تاییدنشده
            </div>
          </div>
        )}

        {/* Blip 2: Inventory Gap */}
        {p2 > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 85,
              right: 90,
              transform: `scale(${p2})`,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: AMBER_PING,
                boxShadow: `0 0 14px ${AMBER_PING}`,
              }}
            />
            <div
              dir="rtl"
              style={{
                position: 'absolute',
                top: 12,
                right: -20,
                fontSize: 10,
                fontWeight: 700,
                color: AMBER_PING,
                whiteSpace: 'nowrap',
                background: 'rgba(2, 6, 23, 0.9)',
                padding: '2px 6px',
                borderRadius: 4,
                border: `1px solid ${AMBER_PING}`,
              }}
            >
              کسری کاردکس انبار
            </div>
          </div>
        )}

        {/* Blip 3: Bounced Cheque Alert */}
        {p3 > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 140,
              left: 65,
              transform: `scale(${p3})`,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: ROSE_ANOMALY,
                boxShadow: `0 0 14px ${ROSE_ANOMALY}`,
              }}
            />
            <div
              dir="rtl"
              style={{
                position: 'absolute',
                top: -18,
                left: 14,
                fontSize: 10,
                fontWeight: 700,
                color: ROSE_ANOMALY,
                whiteSpace: 'nowrap',
                background: 'rgba(2, 6, 23, 0.9)',
                padding: '2px 6px',
                borderRadius: 4,
                border: `1px solid ${ROSE_ANOMALY}`,
              }}
            >
              سررسید چک ۴۸ ساعت
            </div>
          </div>
        )}
      </div>

      {/* Target Tracker Panel */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 100,
          left: 28,
          right: 28,
          background: 'rgba(244, 63, 94, 0.08)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: ROSE_ANOMALY }}>
          ۳ هدف بحرانی در محدوده قرمز شناسایی شد
        </span>
        <span
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: TEXT_MUTED }}
        >
          TARGETS: 03
        </span>
      </div>
    </RadarStage>
  )
}

// ─── Scene 3: Oscilloscope Turbulence to Harmony (14.00–21.00s) ───────────────

export function WaveformHarmonicsScene({ t, scene }: { t: number; scene: Scene }) {
  const syncProgress = clamp(progress(t, 1.2, 2.5))
  const harmonic = ease(syncProgress)

  // Generate deterministic wave path points
  const points = []
  for (let x = 0; x <= 460; x += 10) {
    const chaotic = Math.sin((x + t * 90) * 0.08) * 35 + Math.cos((x - t * 45) * 0.12) * 20
    const stable = Math.sin((x + t * 50) * 0.04) * 25
    const y = 200 + mix(chaotic, stable, harmonic)
    points.push(`${x + 40},${y}`)
  }
  const pathD = `M ${points.join(' L ')}`

  return (
    <RadarStage scene={scene} t={t}>
      <CockpitHeader
        badge="نوسان‌سنج نقدینگی"
        title="وقتی دفاتر همگام نیستند،"
        subtitle="جریان پول دچار نوسان کور است؛"
        subtitleAccent="اما با حسابچه تراز می‌شود!"
        accentColor={EMERALD_GLOW}
        t={t}
      />

      {/* Oscilloscope Wave Deck */}
      <div
        style={{
          position: 'absolute',
          top: 260,
          left: 28,
          right: 28,
          height: 380,
          background: 'rgba(2, 6, 23, 0.85)',
          border: `1px solid ${mix(0.3, 0.7, harmonic) > 0.5 ? EMERALD_BEACON : ROSE_ANOMALY}`,
          borderRadius: 16,
          boxShadow: `0 0 30px ${mix(0.3, 0.7, harmonic) > 0.5 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)'}`,
          overflow: 'hidden',
        }}
      >
        {/* Reticle grid lines */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(${RADAR_GRID} 1px, transparent 1px), linear-gradient(90deg, ${RADAR_GRID} 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Oscilloscope Center Line */}
        <div
          style={{
            position: 'absolute',
            top: 190,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: 'rgba(148, 163, 184, 0.2)',
          }}
        />

        {/* Dynamic Waveform SVG */}
        <svg width={484} height={380} style={{ position: 'absolute', inset: 0 }}>
          <path
            d={pathD}
            fill="none"
            stroke={harmonic > 0.6 ? EMERALD_BEACON : ROSE_ANOMALY}
            strokeWidth={3}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 8px ${harmonic > 0.6 ? EMERALD_BEACON : ROSE_ANOMALY})`,
            }}
          />
        </svg>

        {/* Wave Status Badge */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            bottom: 18,
            right: 20,
            fontSize: 12,
            fontWeight: 800,
            color: harmonic > 0.6 ? EMERALD_GLOW : ROSE_ANOMALY,
          }}
        >
          {harmonic > 0.6 ? 'هارمونی کامل · جریان پایدار نقدینگی' : 'آشفتگی مالی · مغایرت دفاتر'}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 18,
            left: 20,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: TEXT_MUTED,
          }}
        >
          FREQ: {harmonic > 0.6 ? '50.00 Hz [SYNC]' : 'RANDOM [ERR]'}
        </div>
      </div>
    </RadarStage>
  )
}

// ─── Scene 4: Telemetry Lock (21.00–28.00s) ───────────────────────────────────

export function TelemetryLockScene({ t, scene }: { t: number; scene: Scene }) {
  const s = ease(clamp(progress(t, 0.1, 1.0)))

  const nodes = [
    { label: 'صندوق و بانک', x: 270, y: 260, color: CYAN_TELEMETRY },
    { label: 'کاردکس انبار', x: 390, y: 350, color: EMERALD_BEACON },
    { label: 'دفتر کل دوبل', x: 350, y: 500, color: CYAN_TELEMETRY },
    { label: 'پرونده مشتری', x: 190, y: 500, color: AMBER_PING },
    { label: 'حاشیه سود', x: 150, y: 350, color: EMERALD_BEACON },
  ]

  return (
    <RadarStage scene={scene} t={t}>
      <CockpitHeader
        badge="همگرایی اتمیک ارکان"
        title="یکپارچگی یعنی"
        subtitle="هر ثبت فاکتور، در همان ثانیه"
        subtitleAccent="در تمام ستون‌ها منعکس شود!"
        accentColor={EMERALD_GLOW}
        t={t}
      />

      {/* Orbit Nexus Hub */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <svg width={540} height={960}>
          {/* Connector beams to center (270, 390) */}
          {nodes.map((node, i) => (
            <line
              key={i}
              x1={270}
              y1={390}
              x2={mix(270, node.x, s)}
              y2={mix(390, node.y, s)}
              stroke={node.color}
              strokeWidth={2}
              strokeDasharray="4 4"
              opacity={0.6 * s}
            />
          ))}
          {/* Orbit Circle */}
          <circle cx={270} cy={390} r={140 * s} fill="none" stroke={RADAR_RING} strokeWidth={1} />
        </svg>

        {/* Central Quantum Nexus Core */}
        <div
          style={{
            position: 'absolute',
            top: 360,
            left: 240,
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.2)',
            border: `2px solid ${EMERALD_BEACON}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 25px ${EMERALD_BEACON}`,
            fontWeight: 900,
            fontSize: 12,
            color: '#fff',
          }}
        >
          حسابچه
        </div>

        {/* 5 Satellites */}
        {nodes.map((node, i) => (
          <div
            key={i}
            dir="rtl"
            style={{
              position: 'absolute',
              top: mix(390, node.y, s) - 18,
              left: mix(270, node.x, s) - 55,
              width: 110,
              padding: '6px 8px',
              borderRadius: 8,
              background: 'rgba(2, 6, 23, 0.9)',
              border: `1px solid ${node.color}`,
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 800,
              color: TEXT_PRIMARY,
              boxShadow: `0 0 15px ${node.color}33`,
              opacity: s,
            }}
          >
            {node.label}
          </div>
        ))}
      </div>
    </RadarStage>
  )
}

// ─── Scene 5: Executive Cockpit Stability (28.00–35.00s) ──────────────────────

export function CockpitStabilityScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2, 0.6)
  const p2 = pop(t, 0.8, 0.6)
  const p3 = pop(t, 1.4, 0.6)

  return (
    <RadarStage scene={scene} t={t}>
      <CockpitHeader
        badge="اتاق فرمان مدیریت"
        title="خواب آرام شبانه،"
        subtitle="محصول اشراف در لحظه به"
        subtitleAccent="تمام ارکان تجارت است!"
        accentColor={CYAN_TELEMETRY}
        t={t}
      />

      {/* 3 Sleek Telemetry Gauges */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 240,
          left: 28,
          right: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Gauge 1 */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 14,
            padding: '16px 20px',
            transform: `scale(${p1})`,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: TEXT_MUTED }}>شاخص پایداری نقدینگی</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: EMERALD_GLOW }}>۱۰۰٪ پایدار</span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: 'rgba(16, 185, 129, 0.15)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                background: `linear-gradient(90deg, ${EMERALD_BEACON}, ${EMERALD_GLOW})`,
              }}
            />
          </div>
        </div>

        {/* Gauge 2 */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: 14,
            padding: '16px 20px',
            transform: `scale(${p2})`,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: TEXT_MUTED }}>انطباق فیزیکی و سیستمی انبار</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: CYAN_TELEMETRY }}>تراز قطعی</span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: 'rgba(56, 189, 248, 0.15)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                background: `linear-gradient(90deg, ${CYAN_TELEMETRY}, #7dd3fc)`,
              }}
            />
          </div>
        </div>

        {/* Gauge 3 */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: 14,
            padding: '16px 20px',
            transform: `scale(${p3})`,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: TEXT_MUTED }}>سررسید تعهدات و چک‌های دریافتی</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: AMBER_PING }}>پایش هوشمند</span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: 'rgba(245, 158, 11, 0.15)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                background: `linear-gradient(90deg, ${AMBER_PING}, #fbbf24)`,
              }}
            />
          </div>
        </div>
      </div>
    </RadarStage>
  )
}

// ─── Scene 6: Radar CTA Finale (35.00–42.00s) ─────────────────────────────────

export function RadarCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = pop(t, 0.1, 0.8)

  return (
    <RadarStage scene={scene} t={t}>
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 240,
          left: 28,
          right: 28,
          background: 'rgba(15, 23, 42, 0.9)',
          border: `1px solid ${RADAR_RING}`,
          borderRadius: 20,
          padding: '36px 24px',
          textAlign: 'center',
          boxShadow: `0 10px 40px rgba(0, 0, 0, 0.6), 0 0 35px rgba(16, 185, 129, 0.15)`,
          transform: `scale(${enter})`,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            border: `2px solid ${EMERALD_BEACON}`,
            margin: '0 auto 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 20px ${EMERALD_BEACON}`,
          }}
        >
          <div
            style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: EMERALD_BEACON }}
          />
        </div>

        <div style={{ fontSize: 26, fontWeight: 900, color: TEXT_PRIMARY, marginBottom: 8 }}>
          حسابچه
        </div>
        <div style={{ fontSize: 14, color: TEXT_MUTED, marginBottom: 24 }}>
          رادار یکپارچه مدیریت مالی و حسابداری ابری + اپ آفلاین
        </div>

        {/* Dual action command buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              padding: '14px',
              borderRadius: 10,
              background: `linear-gradient(90deg, ${EMERALD_BEACON}, #059669)`,
              color: '#fff',
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: '0.02em',
            }}
          >
            شروع رایگان در hisabche.com
          </div>
          <div
            style={{
              padding: '12px',
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: TEXT_PRIMARY,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            کامنت کنید: «رادار» برای دریافت دمو
          </div>
        </div>
      </div>
    </RadarStage>
  )
}
