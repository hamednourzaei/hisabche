// src/scenes/inference-engine.tsx
// =============================================================================
// Reel 103 — «موتور استنتاج هوش مصنوعی حسابچه» (Hisabche Inference Engine)
// Bespoke Monolithic Silicon Die & Laser Neural Bus Architecture
//
// Strict Anti-Repetition & Anti-Template Design:
// - ZERO floating cards, ZERO rounded card containers, ZERO 3-pod decks (distinct from 104, 105, 106, 107).
// - The ENTIRE 540x960 canvas IS the monolithic silicon processor die surface.
// - Authentic photolithography gold bus traces, wafer fiducial crosshairs & perimeter bond pads.
// - Scene 1: Choked GPU core with incandescent thermal red meltdown & latency odometer (5,420ms).
// - Scene 2: High-speed 5-lane vertical photon bus & KV-Cache laser memory compressor (1,850 tok/s).
// - Scene 3: Real 8x8 Systolic Tensor Core Matrix firing diagonal compute waves & 11ms latency collapse.
// - Scene 4: Full-field vector coordinate radar detecting & laser-locking anomalous fraud in 0.4ms.
// - Scene 5: Monolithic packaged BGA silicon chip with gold contact pins & direct terminal key CTA.
// =============================================================================

import React from 'react'
import type { Scene } from '../engine/types'
import { clamp, mix, progress, spring } from '../engine/anim'
import { stagePunch, stageShake } from './card-motion'
import { faNumber } from '../ui/motion-primitives'

// ─── Design Tokens ────────────────────────────────────────────────────────────

const SILICON_OBSIDIAN = '#02050f'
const DIE_SUBSTRATE = '#060d1f'
const GOLD_PAD = '#eab308'
const LASER_CYAN = '#00f5ff'
const COBALT_BLUE = '#38bdf8'
const SILICON_EMERALD = '#10b981'
const THERMAL_RED = '#ef4444'
const THERMAL_ORANGE = '#f97316'
const WAFER_WHITE = '#f8fafc'
const TEXT_MUTED = '#94a3b8'

function popSpring(t: number, at: number, dur = 0.5): number {
  return spring(clamp(progress(t, at, dur)))
}

// ─── Monolithic Silicon Die Stage ─────────────────────────────────────────────

export function InferenceStage({
  scene,
  t,
  children,
  shakes,
  punches,
  alertFlash = false,
}: {
  scene: Scene
  t: number
  children: React.ReactNode
  shakes?: readonly number[]
  punches?: readonly number[]
  alertFlash?: boolean
}) {
  void scene
  const shake = stageShake(t, shakes)
  const punch = stagePunch(t, punches)
  const scanY = (t * 140) % 960

  return (
    <div
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        backgroundColor: SILICON_OBSIDIAN,
        color: WAFER_WHITE,
        overflow: 'hidden',
        direction: 'ltr',
        transform: `translate(${shake.x.toFixed(1)}px, ${shake.y.toFixed(1)}px) scale(${punch.toFixed(3)})`,
        transformOrigin: 'center center',
      }}
    >
      {/* ─── Silicon Wafer Physical Substrate ─── */}
      <svg
        width={540}
        height={960}
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <defs>
          {/* Micro-Circuit Photolithography Pattern */}
          <pattern id="siliconBusNet" width="60" height="60" patternUnits="userSpaceOnUse">
            <path
              d="M 0 30 H 60 M 30 0 V 60 M 15 15 H 45 V 45 H 15 Z"
              fill="none"
              stroke="rgba(56, 189, 248, 0.05)"
              strokeWidth="0.75"
            />
            <circle cx="30" cy="30" r="1.2" fill="rgba(234, 179, 8, 0.25)" />
          </pattern>
        </defs>

        <rect width="540" height="960" fill="url(#siliconBusNet)" />

        {/* Outer Wafer Die Boundary Framing Lines */}
        <rect
          x={16}
          y={16}
          width={508}
          height={928}
          fill="none"
          stroke="rgba(234, 179, 8, 0.2)"
          strokeWidth={1}
          strokeDasharray="8 6"
        />

        {/* 4 Corner Wafer Alignment Fiducial Crosshairs */}
        {[
          { cx: 32, cy: 32 },
          { cx: 508, cy: 32 },
          { cx: 32, cy: 928 },
          { cx: 508, cy: 928 },
        ].map((f, i) => (
          <g key={i}>
            <circle
              cx={f.cx}
              cy={f.cy}
              r={8}
              fill="none"
              stroke={GOLD_PAD}
              strokeWidth={1}
              opacity={0.6}
            />
            <line
              x1={f.cx - 12}
              y1={f.cy}
              x2={f.cx + 12}
              y2={f.cy}
              stroke={GOLD_PAD}
              strokeWidth={1}
              opacity={0.6}
            />
            <line
              x1={f.cx}
              y1={f.cy - 12}
              x2={f.cx}
              y2={f.cy + 12}
              stroke={GOLD_PAD}
              strokeWidth={1}
              opacity={0.6}
            />
          </g>
        ))}

        {/* Perimeter Gold Wire Bond Pads (Micro gold teeth along outer margins) */}
        {Array.from({ length: 18 }).map((_, i) => (
          <React.Fragment key={i}>
            {/* Top row */}
            <rect
              x={55 + i * 24}
              y={12}
              width={12}
              height={5}
              fill={GOLD_PAD}
              opacity={0.4}
              rx={1}
            />
            {/* Bottom row */}
            <rect
              x={55 + i * 24}
              y={943}
              width={12}
              height={5}
              fill={GOLD_PAD}
              opacity={0.4}
              rx={1}
            />
          </React.Fragment>
        ))}
      </svg>

      {/* Travelling Laser Inspection Scanline */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: scanY,
          height: 1.5,
          background: 'linear-gradient(90deg, transparent, rgba(0, 245, 255, 0.75), transparent)',
          boxShadow: '0 0 16px rgba(0, 245, 255, 0.8)',
          pointerEvents: 'none',
          zIndex: 15,
        }}
      />

      {/* Thermal Alarm Vignette on Overload */}
      {alertFlash && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle, transparent 40%, rgba(239, 68, 68, 0.4) 100%)',
            pointerEvents: 'none',
            zIndex: 14,
          }}
        />
      )}

      {children}

      {/* Laser-Etched Silicon Monospace Footer */}
      <div
        dir="ltr"
        style={{
          position: 'absolute',
          bottom: 22,
          left: 36,
          right: 36,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 9.5,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.14em',
          color: 'rgba(234, 179, 8, 0.5)',
          zIndex: 40,
        }}
      >
        <span>HISABCHE // TENSOR_SILICON_4NM</span>
        <span>RETICLE: 26x33mm // WAFER_OK</span>
      </div>
    </div>
  )
}

// ─── Silicon Header Lockup (Direct Surface Typography, No Card) ───────────────

function SiliconHeader({
  chipTag,
  title,
  subtitle,
  accentText,
  accentColor = LASER_CYAN,
  t,
}: {
  chipTag: string
  title: string
  subtitle: string
  accentText?: string
  accentColor?: string
  t: number
}) {
  const enter = clamp(progress(t, 0.05, 0.45))
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        top: 44,
        left: 36,
        right: 36,
        textAlign: 'start',
        zIndex: 35,
        opacity: enter,
        transform: `translateY(${mix(10, 0, enter)}px)`,
      }}
    >
      {/* Laser-Etched Technical Bus Path */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: accentColor,
            boxShadow: `0 0 10px ${accentColor}`,
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: accentColor,
            letterSpacing: '0.08em',
          }}
        >
          {chipTag}
        </span>
      </div>

      {/* Main Bold Headline */}
      <div
        style={{
          fontSize: 27,
          fontWeight: 900,
          color: WAFER_WHITE,
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
          fontSize: 14,
          fontWeight: 600,
          color: TEXT_MUTED,
          lineHeight: 1.4,
        }}
      >
        <span>{subtitle} </span>
        {accentText && <span style={{ color: accentColor, fontWeight: 800 }}>{accentText}</span>}
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 1: InferenceLatencyCrisisScene (0.00–7.20s)
// The Choked Silicon Core & Incandescent Thermal Meltdown
// ═════════════════════════════════════════════════════════════════════════════

export function InferenceLatencyCrisisScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.45))
  const latency = Math.round(mix(280, 5420, clamp(progress(t, 0.4, 4.2))))
  const isOverheated = latency > 2000
  const alertFlash = t >= 2.4 && t <= 4.0

  // 24 Blocked token particles circling the burning silicon die
  const blockedPackets = Array.from({ length: 24 }).map((_, i) => {
    const angle = (i / 24) * Math.PI * 2 + t * 2.8
    const radius = 175 + Math.sin(t * 4 + i) * 12
    return {
      x: 270 + Math.cos(angle) * radius,
      y: 450 + Math.sin(angle) * radius,
      color: isOverheated ? THERMAL_RED : THERMAL_ORANGE,
    }
  })

  return (
    <InferenceStage
      scene={scene}
      t={t}
      shakes={[0.1, 1.4, 3.5]}
      punches={[0.1, 3.5]}
      alertFlash={alertFlash}
    >
      <SiliconHeader
        chipTag="HARDWARE_THROTTLE // CLUSTER_BACKPRESSURE"
        title="مدل داری، ولی سرعتش فاجعه‌ست؟"
        subtitle="کاربران ثانیه‌ها پشت لودینگ معطل می‌مانند؛"
        accentText="سرعت پایین، بیزنس را متوقف می‌کند!"
        accentColor={THERMAL_RED}
        t={t}
      />

      {/* ─── Main Center: Overheating Silicon Core Die (x=270, y=450) ─── */}
      <svg
        width={540}
        height={960}
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <defs>
          <radialGradient id="thermalDieGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={THERMAL_RED} stopOpacity={0.85} />
            <stop offset="60%" stopColor={THERMAL_ORANGE} stopOpacity={0.35} />
            <stop offset="100%" stopColor="transparent" stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* Pulsing Thermal Heat Aura */}
        <circle
          cx={270}
          cy={450}
          r={180 + Math.sin(t * 8) * 14}
          fill="url(#thermalDieGrad)"
          opacity={isOverheated ? 0.9 : 0.4}
        />

        {/* 4 Laser Feeding Buses Jammed with Requests */}
        <line
          x1={270}
          y1={180}
          x2={270}
          y2={330}
          stroke={THERMAL_RED}
          strokeWidth={3}
          strokeDasharray="6 4"
        />
        <line
          x1={270}
          y1={570}
          x2={270}
          y2={720}
          stroke={THERMAL_RED}
          strokeWidth={3}
          strokeDasharray="6 4"
        />
        <line
          x1={70}
          y1={450}
          x2={150}
          y2={450}
          stroke={THERMAL_RED}
          strokeWidth={3}
          strokeDasharray="6 4"
        />
        <line
          x1={390}
          y1={450}
          x2={470}
          y2={450}
          stroke={THERMAL_RED}
          strokeWidth={3}
          strokeDasharray="6 4"
        />

        {/* Silicon Die Monolith (240x240 center chip) */}
        <g transform="translate(150, 330)">
          {/* Metallic substrate rim */}
          <rect
            x={0}
            y={0}
            width={240}
            height={240}
            rx={16}
            fill={DIE_SUBSTRATE}
            stroke={THERMAL_RED}
            strokeWidth={2.5}
            style={{ filter: `drop-shadow(0 0 24px ${THERMAL_RED}aa)` }}
          />
          {/* Internal photolithography lines */}
          <rect
            x={16}
            y={16}
            width={208}
            height={208}
            rx={10}
            fill="none"
            stroke="rgba(239, 68, 68, 0.4)"
            strokeWidth={1}
          />
          <line
            x1={120}
            y1={16}
            x2={120}
            y2={224}
            stroke="rgba(239, 68, 68, 0.3)"
            strokeWidth={1}
          />
          <line
            x1={16}
            y1={120}
            x2={224}
            y2={120}
            stroke="rgba(239, 68, 68, 0.3)"
            strokeWidth={1}
          />
        </g>
      </svg>

      {/* Floating Overload Particles Circling Core */}
      {blockedPackets.map((pkt, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: pkt.x,
            top: pkt.y,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: pkt.color,
            boxShadow: `0 0 12px ${pkt.color}`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 25,
          }}
        />
      ))}

      {/* Big Digital Latency Ticker Inside Core */}
      <div
        dir="ltr"
        style={{
          position: 'absolute',
          top: 380,
          left: 160,
          right: 160,
          textAlign: 'center',
          zIndex: 30,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.12em',
            color: THERMAL_ORANGE,
            marginBottom: 2,
          }}
        >
          CORE_TEMP: 104°C // TTFT
        </div>
        <div
          style={{
            fontSize: 42,
            fontWeight: 900,
            fontFamily: "'JetBrains Mono', monospace",
            color: THERMAL_RED,
            lineHeight: 1.1,
            textShadow: `0 0 28px ${THERMAL_RED}`,
          }}
        >
          {faNumber(latency)}
        </div>
        <div
          dir="rtl"
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: WAFER_WHITE,
            marginTop: 4,
          }}
        >
          میلی‌ثانیه تأخیر در پاسخ
        </div>
      </div>

      {/* Diagnostic Silicon Surface Telemetry (Direct On-Wafer Readout) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 615,
          left: 36,
          right: 36,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          opacity: enter,
          zIndex: 30,
        }}
      >
        {/* Metric 1 */}
        <div
          style={{
            borderInlineStart: `3px solid ${THERMAL_RED}`,
            paddingInlineStart: 12,
          }}
        >
          <div
            style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: TEXT_MUTED }}
          >
            ترافیک انباشته در صف
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: WAFER_WHITE, marginTop: 2 }}>
            {faNumber(14200)} <span style={{ fontSize: 13, color: THERMAL_RED }}>درخواست</span>
          </div>
          <div style={{ fontSize: 11, color: THERMAL_RED, marginTop: 2 }}>
            گلوگاه شدید حافظه گرافیکی
          </div>
        </div>

        {/* Metric 2 */}
        <div
          style={{
            borderInlineStart: `3px solid ${THERMAL_ORANGE}`,
            paddingInlineStart: 12,
          }}
        >
          <div
            style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: TEXT_MUTED }}
          >
            اتلاف منابع سرور
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: WAFER_WHITE, marginTop: 2 }}>
            {faNumber(4)}X <span style={{ fontSize: 13, color: THERMAL_ORANGE }}>هزینه گزاف</span>
          </div>
          <div style={{ fontSize: 11, color: THERMAL_ORANGE, marginTop: 2 }}>
            سوخت سرمایه پردازش
          </div>
        </div>
      </div>

      {/* Bottom Alert Banner */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 46,
          left: 36,
          right: 36,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: THERMAL_RED,
              boxShadow: `0 0 10px ${THERMAL_RED}`,
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 700, color: WAFER_WHITE }}>
            نتیجه تأخیر سرور: ۶۲٪ کاربران پیش از پاسخ خارج می‌شوند
          </div>
        </div>
        <div
          dir="ltr"
          style={{
            fontSize: 11,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: THERMAL_RED,
          }}
        >
          SHED_FAIL
        </div>
      </div>
    </InferenceStage>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 2: NeuralTokenStreamScene (7.20–14.40s)
// 5-Lane High-Speed Photon Bus & KV-Cache Compactor
// ═════════════════════════════════════════════════════════════════════════════

export function NeuralTokenStreamScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.45))
  const tokensPerSec = Math.min(1850, Math.round(mix(240, 1850, clamp(progress(t, 0.5, 4.0)))))
  const compactorRot = t * 65

  // 5 Vertical Bus Lanes across the silicon surface
  const lanes = [95, 180, 270, 360, 445]

  // Tokens streaming down the lanes
  const streamTokens = [
    { label: 'توکن ورودی', lane: 0, speed: 220, offset: 0, col: LASER_CYAN },
    { label: 'کاهش کوئری', lane: 1, speed: 280, offset: 140, col: COBALT_BLUE },
    { label: 'استنتاج مالی', lane: 2, speed: 260, offset: 70, col: SILICON_EMERALD },
    { label: 'فشرده‌سازی کش', lane: 3, speed: 300, offset: 210, col: GOLD_PAD },
    { label: 'خروجی آنی', lane: 4, speed: 240, offset: 100, col: LASER_CYAN },
  ]

  return (
    <InferenceStage scene={scene} t={t} punches={[0.3, 2.1, 4.8]}>
      <SiliconHeader
        chipTag="KV_CACHE_COMPACTOR // PARALLEL_STREAM"
        title="جریان روان توکن‌ها در ثانیه"
        subtitle="وقتی توکن‌ها پشت صف پردازش گیر نکنند،"
        accentText="هزینه سرورها به صفر نزدیک می‌شود"
        accentColor={LASER_CYAN}
        t={t}
      />

      {/* ─── 5 Vertical Photon Laser Bus Channels (x = 95 to 445) ─── */}
      <svg
        width={540}
        height={960}
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <defs>
          <linearGradient id="busLaserGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="30%" stopColor="rgba(0, 245, 255, 0.5)" />
            <stop offset="70%" stopColor="rgba(16, 185, 129, 0.5)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* 5 Vertical Conduits */}
        {lanes.map((x, idx) => (
          <g key={idx}>
            <line
              x1={x}
              y1={180}
              x2={x}
              y2={750}
              stroke="url(#busLaserGrad)"
              strokeWidth={12}
              opacity={0.15}
            />
            <line
              x1={x}
              y1={180}
              x2={x}
              y2={750}
              stroke={COBALT_BLUE}
              strokeWidth={2}
              strokeDasharray="8 6"
              opacity={0.6}
            />
          </g>
        ))}

        {/* Center Quantum Ring Compactor (x=270, y=470) */}
        <g transform={`translate(270, 470) rotate(${compactorRot})`}>
          <circle
            r={105}
            fill="none"
            stroke={LASER_CYAN}
            strokeWidth={2}
            strokeDasharray="14 10"
            opacity={0.7}
          />
          <circle
            r={75}
            fill="none"
            stroke={SILICON_EMERALD}
            strokeWidth={2.5}
            strokeDasharray="10 8"
          />
          <circle r={45} fill="none" stroke={GOLD_PAD} strokeWidth={1.5} opacity={0.6} />
        </g>
      </svg>

      {/* Moving Hexagonal Token Badges sliding on the vertical buses */}
      {streamTokens.map((st, idx) => {
        const yPos = 200 + ((t * st.speed + st.offset) % 520)
        return (
          <div
            key={idx}
            dir="rtl"
            style={{
              position: 'absolute',
              left: lanes[st.lane],
              top: yPos,
              transform: 'translate(-50%, -50%)',
              background: 'rgba(6, 13, 31, 0.95)',
              border: `1.5px solid ${st.col}`,
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 800,
              color: WAFER_WHITE,
              boxShadow: `0 0 16px ${st.col}66`,
              whiteSpace: 'nowrap',
              zIndex: 25,
            }}
          >
            {st.label}
          </div>
        )
      })}

      {/* Center Throughput HUD Display */}
      <div
        dir="ltr"
        style={{
          position: 'absolute',
          top: 430,
          left: 170,
          right: 170,
          textAlign: 'center',
          zIndex: 30,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontSize: 34,
            fontWeight: 900,
            fontFamily: "'JetBrains Mono', monospace",
            color: LASER_CYAN,
            textShadow: `0 0 20px ${LASER_CYAN}`,
            lineHeight: 1.1,
          }}
        >
          {faNumber(tokensPerSec)}
        </div>
        <div
          dir="rtl"
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: WAFER_WHITE,
            marginTop: 4,
          }}
        >
          توکن در هر ثانیه
        </div>
      </div>

      {/* Direct Silicon Metric Benchmarks */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 640,
          left: 36,
          right: 36,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          opacity: enter,
          zIndex: 30,
        }}
      >
        <div style={{ borderInlineStart: `3px solid ${SILICON_EMERALD}`, paddingInlineStart: 12 }}>
          <div
            style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: TEXT_MUTED }}
          >
            صرفه‌جویی در رم گرافیک
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: SILICON_EMERALD, marginTop: 2 }}>
            -{faNumber(78)}٪ <span style={{ fontSize: 13, color: WAFER_WHITE }}>مصرف VRAM</span>
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
            کش هوشمند حافظه پِـیج‌شده
          </div>
        </div>

        <div style={{ borderInlineStart: `3px solid ${LASER_CYAN}`, paddingInlineStart: 12 }}>
          <div
            style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: TEXT_MUTED }}
          >
            ترافیک پیوستهٔ داده
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: LASER_CYAN, marginTop: 2 }}>
            {faNumber(1850)} <span style={{ fontSize: 13, color: WAFER_WHITE }}>Tok/s</span>
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
            بدون کوچک‌ترین مکث پردازنده
          </div>
        </div>
      </div>

      {/* Bottom Summary Bar */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 46,
          left: 36,
          right: 36,
          background: 'rgba(0, 245, 255, 0.08)',
          border: '1px solid rgba(0, 245, 255, 0.3)',
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: LASER_CYAN,
              boxShadow: `0 0 10px ${LASER_CYAN}`,
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 700, color: WAFER_WHITE }}>
            شتاب سخت‌افزاری: حذف کامل صف انتظار درخواست‌ها
          </div>
        </div>
        <div
          dir="ltr"
          style={{
            fontSize: 11,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: LASER_CYAN,
          }}
        >
          KV_SYNC_OK
        </div>
      </div>
    </InferenceStage>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 3: SpeculativeInferenceMatrixScene (14.40–25.20s)
// 8x8 Systolic Tensor Core Array & 11ms Latency Collapse
// ═════════════════════════════════════════════════════════════════════════════

export function SpeculativeInferenceMatrixScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.45))
  const chimePulse = popSpring(t, 8.5, 0.7)

  // Latency collapse from 5420ms to 11ms at t=4.8s
  const latency = Math.round(mix(5420, 11, clamp(progress(t, 3.5, 5.0))))
  const isAccelerated = latency <= 50

  return (
    <InferenceStage scene={scene} t={t} punches={[1.9, 4.8, 8.5]} shakes={[4.8]}>
      <SiliconHeader
        chipTag="SYSTOLIC_ARRAY // SPECULATIVE_CORE"
        title="شتاب ۱۰ برابری پردازش توکن‌ها"
        subtitle="با موتور استنتاج اختصاصی حسابچه؛"
        accentText="کمترین تأخیر ممکن در مقیاس میلی‌ثانیه"
        accentColor={SILICON_EMERALD}
        t={t}
      />

      {/* ─── 8x8 Systolic Tensor Core Grid (64 Hardware Nodes) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 200,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 25,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 32px)',
            gridTemplateRows: 'repeat(8, 32px)',
            gap: 5,
            padding: 12,
            borderRadius: 18,
            background: 'rgba(6, 13, 31, 0.85)',
            border: `1.5px solid ${isAccelerated ? SILICON_EMERALD : COBALT_BLUE}`,
            boxShadow: `0 0 35px ${isAccelerated ? SILICON_EMERALD : COBALT_BLUE}44`,
          }}
        >
          {Array.from({ length: 64 }).map((_, idx) => {
            const row = Math.floor(idx / 8)
            const col = idx % 8
            // Diagonal light wave traveling across matrix
            const wave = Math.sin(t * 10 - (row + col) * 0.55)
            const active = wave > 0.3
            const nodeCol = isAccelerated
              ? active
                ? SILICON_EMERALD
                : 'rgba(16, 185, 129, 0.3)'
              : active
                ? LASER_CYAN
                : 'rgba(56, 189, 248, 0.25)'

            return (
              <div
                key={idx}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 5,
                  background: active ? `${nodeCol}33` : 'rgba(2, 6, 18, 0.9)',
                  border: `1px solid ${nodeCol}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: active ? `0 0 10px ${nodeCol}` : 'none',
                }}
              >
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: nodeCol,
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Center Floating Metric Badge: Latency Collapse */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 550,
          left: 36,
          right: 36,
          textAlign: 'center',
          zIndex: 30,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 800,
            color: SILICON_EMERALD,
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            padding: '4px 14px',
            borderRadius: 999,
            marginBottom: 8,
          }}
        >
          <span>تأخیر استنتاج سخت‌افزاری</span>
          <span>⚡</span>
        </div>
        <div
          dir="ltr"
          style={{
            fontSize: 44,
            fontWeight: 900,
            fontFamily: "'JetBrains Mono', monospace",
            color: isAccelerated ? SILICON_EMERALD : THERMAL_RED,
            textShadow: `0 0 24px ${isAccelerated ? SILICON_EMERALD : THERMAL_RED}`,
            lineHeight: 1.1,
          }}
        >
          {faNumber(latency)} <span style={{ fontSize: 20 }}>ms</span>
        </div>
      </div>

      {/* Direct Silicon Benchmarks */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 685,
          left: 36,
          right: 36,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          opacity: enter,
          zIndex: 30,
        }}
      >
        <div style={{ borderInlineStart: `3px solid ${SILICON_EMERALD}`, paddingInlineStart: 12 }}>
          <div
            style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: TEXT_MUTED }}
          >
            شتاب کل فرآیند
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: WAFER_WHITE, marginTop: 2 }}>
            {faNumber(10)}X <span style={{ fontSize: 13, color: SILICON_EMERALD }}>سریع‌تر</span>
          </div>
          <div style={{ fontSize: 11, color: SILICON_EMERALD, marginTop: 2 }}>
            رمزگشایی گمانه‌زن (Speculative)
          </div>
        </div>

        <div style={{ borderInlineStart: `3px solid ${COBALT_BLUE}`, paddingInlineStart: 12 }}>
          <div
            style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: TEXT_MUTED }}
          >
            مقایسه با ابرهای سنتی
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: WAFER_WHITE, marginTop: 2 }}>
            {faNumber(33)}X <span style={{ fontSize: 13, color: COBALT_BLUE }}>کاهش معطلی</span>
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
            پایداری ۹۹.۹۹٪ تحت بار سنگین
          </div>
        </div>
      </div>

      {/* Bottom Shockwave Banner */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 46,
          left: 36,
          right: 36,
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transform: `scale(${mix(1, 1.03, chimePulse)})`,
          boxShadow: isAccelerated ? '0 0 24px rgba(16, 185, 129, 0.25)' : 'none',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: SILICON_EMERALD,
              boxShadow: `0 0 10px ${SILICON_EMERALD}`,
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 800, color: WAFER_WHITE }}>
            پردازش در مقیاس میکروثانیه: پاسخ آنی و بدون لودینگ
          </div>
        </div>
        <div
          dir="ltr"
          style={{
            fontSize: 11,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: SILICON_EMERALD,
          }}
        >
          11MS_LOCKED
        </div>
      </div>
    </InferenceStage>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 4: AutonomousReasoningLassoScene (25.20–34.60s)
// Vector Space Radar & Microsecond Rogue Anomaly Containment
// ═════════════════════════════════════════════════════════════════════════════

export function AutonomousReasoningLassoScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.45))
  const radarAngle = (t * 220) % 360
  const isDetected = t >= 2.8
  const lockSpring = popSpring(t, 2.8, 0.5)

  // 24 Vector Points on the wafer field
  const vectorNodes = [
    { x: 130, y: 310, col: SILICON_EMERALD },
    { x: 210, y: 280, col: COBALT_BLUE },
    { x: 280, y: 330, col: LASER_CYAN },
    { x: 160, y: 400, col: SILICON_EMERALD },
    { x: 240, y: 450, col: COBALT_BLUE },
    { x: 140, y: 510, col: SILICON_EMERALD },
    { x: 310, y: 490, col: COBALT_BLUE },
    { x: 200, y: 550, col: LASER_CYAN },
    { x: 390, y: 530, col: SILICON_EMERALD },
    { x: 440, y: 440, col: COBALT_BLUE },
    { x: 410, y: 330, col: COBALT_BLUE },
    { x: 330, y: 270, col: LASER_CYAN },
  ]

  // Rogue Target Node
  const rogueTarget = { x: 360, y: 380 }

  return (
    <InferenceStage scene={scene} t={t} shakes={[2.8, 6.5]} punches={[0.4, 2.8]}>
      <SiliconHeader
        chipTag="VECTOR_RADAR // ANOMALY_QUARANTINE"
        title="کشف و قرنطینه در کسری از میلی‌ثانیه"
        subtitle="کوچک‌ترین مغایرت، تقلب یا خطای فاکتور؛"
        accentText="در لحظه شناسایی و جدا می‌شود"
        accentColor={isDetected ? THERMAL_RED : LASER_CYAN}
        t={t}
      />

      {/* ─── Vector Coordinate Radar & Caliper Containment (x=270, y=440) ─── */}
      <svg
        width={540}
        height={960}
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <defs>
          {/* Radar Sweep Gradient */}
          <linearGradient id="radarSweepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(0, 245, 255, 0.4)" />
          </linearGradient>
        </defs>

        {/* Concentric Coordinate Rings */}
        <circle
          cx={270}
          cy={440}
          r={180}
          fill="none"
          stroke="rgba(56, 189, 248, 0.15)"
          strokeWidth={1}
          strokeDasharray="6 4"
        />
        <circle
          cx={270}
          cy={440}
          r={120}
          fill="none"
          stroke="rgba(56, 189, 248, 0.2)"
          strokeWidth={1}
        />
        <circle
          cx={270}
          cy={440}
          r={60}
          fill="none"
          stroke="rgba(56, 189, 248, 0.25)"
          strokeWidth={1}
        />

        {/* Radar Crosshairs */}
        <line x1={90} y1={440} x2={450} y2={440} stroke="rgba(56, 189, 248, 0.2)" strokeWidth={1} />
        <line
          x1={270}
          y1={260}
          x2={270}
          y2={620}
          stroke="rgba(56, 189, 248, 0.2)"
          strokeWidth={1}
        />

        {/* Rotating Radar Sweep Beam */}
        <g transform={`translate(270, 440) rotate(${radarAngle})`}>
          <path d="M 0 0 L 180 0 A 180 180 0 0 0 127 -127 Z" fill="url(#radarSweepGrad)" />
          <line x1={0} y1={0} x2={180} y2={0} stroke={LASER_CYAN} strokeWidth={2} />
        </g>

        {/* Compliant Normal Vector Nodes */}
        {vectorNodes.map((n, i) => (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={5}
            fill={n.col}
            style={{ filter: `drop-shadow(0 0 8px ${n.col})` }}
          />
        ))}

        {/* Rogue Anomaly Node & 4-Laser Lock Calipers */}
        <g>
          <circle
            cx={rogueTarget.x}
            cy={rogueTarget.y}
            r={isDetected ? 14 : 6}
            fill={isDetected ? THERMAL_RED : COBALT_BLUE}
            style={{ filter: `drop-shadow(0 0 18px ${isDetected ? THERMAL_RED : COBALT_BLUE})` }}
          />

          {isDetected && (
            <>
              {/* 4 Laser Calipers Converging from Boundaries */}
              <line
                x1={mix(40, rogueTarget.x - 30, lockSpring)}
                y1={rogueTarget.y}
                x2={rogueTarget.x - 18}
                y2={rogueTarget.y}
                stroke={THERMAL_RED}
                strokeWidth={2.5}
              />
              <line
                x1={mix(500, rogueTarget.x + 30, lockSpring)}
                y1={rogueTarget.y}
                x2={rogueTarget.x + 18}
                y2={rogueTarget.y}
                stroke={THERMAL_RED}
                strokeWidth={2.5}
              />
              <line
                x1={rogueTarget.x}
                y1={mix(180, rogueTarget.y - 30, lockSpring)}
                x2={rogueTarget.x}
                y2={rogueTarget.y - 18}
                stroke={THERMAL_RED}
                strokeWidth={2.5}
              />
              <line
                x1={rogueTarget.x}
                y1={mix(700, rogueTarget.y + 30, lockSpring)}
                x2={rogueTarget.x}
                y2={rogueTarget.y + 18}
                stroke={THERMAL_RED}
                strokeWidth={2.5}
              />

              {/* Holographic Containment Box */}
              <rect
                x={rogueTarget.x - 24}
                y={rogueTarget.y - 24}
                width={48}
                height={48}
                fill="none"
                stroke={THERMAL_RED}
                strokeWidth={2}
                strokeDasharray="8 4"
                style={{ filter: `drop-shadow(0 0 14px ${THERMAL_RED})` }}
              />
            </>
          )}
        </g>
      </svg>

      {/* Anomaly Callout Pill when locked */}
      {isDetected && (
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            left: rogueTarget.x + 35,
            top: rogueTarget.y - 10,
            background: 'rgba(15, 23, 42, 0.95)',
            border: `1.5px solid ${THERMAL_RED}`,
            borderRadius: 10,
            padding: '8px 14px',
            boxShadow: `0 0 20px ${THERMAL_RED}66`,
            zIndex: 30,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: THERMAL_RED }}>
            ⚠️ مغایرت در تراکنش انبار
          </div>
          <div style={{ fontSize: 10, color: WAFER_WHITE, marginTop: 2 }}>
            کشف در ۰.۴ میلی‌ثانیه // قرنطینه خودکار
          </div>
        </div>
      )}

      {/* Direct Silicon Benchmarks */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 660,
          left: 36,
          right: 36,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          opacity: enter,
          zIndex: 30,
        }}
      >
        <div
          style={{
            borderInlineStart: `3px solid ${isDetected ? THERMAL_RED : LASER_CYAN}`,
            paddingInlineStart: 12,
          }}
        >
          <div
            style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: TEXT_MUTED }}
          >
            سرعت کشف مغایرت
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: WAFER_WHITE, marginTop: 2 }}>
            ۰.۴ <span style={{ fontSize: 13, color: LASER_CYAN }}>میلی‌ثانیه</span>
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>واکنش در کسری از لحظه</div>
        </div>

        <div style={{ borderInlineStart: `3px solid ${SILICON_EMERALD}`, paddingInlineStart: 12 }}>
          <div
            style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: TEXT_MUTED }}
          >
            پایداری جریان فروش
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: SILICON_EMERALD, marginTop: 2 }}>
            {faNumber(100)}٪ <span style={{ fontSize: 13, color: WAFER_WHITE }}>بدون توقف</span>
          </div>
          <div style={{ fontSize: 11, color: SILICON_EMERALD, marginTop: 2 }}>
            جداسازی بدون توقف صندوق
          </div>
        </div>
      </div>

      {/* Bottom Summary Bar */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 46,
          left: 36,
          right: 36,
          background: 'rgba(15, 23, 42, 0.9)',
          border: `1.5px solid ${isDetected ? THERMAL_RED : 'rgba(56, 189, 248, 0.3)'}`,
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isDetected ? THERMAL_RED : LASER_CYAN,
              boxShadow: `0 0 10px ${isDetected ? THERMAL_RED : LASER_CYAN}`,
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 800, color: WAFER_WHITE }}>
            {isDetected
              ? 'تراکنش مشکوک بلافاصله ایزوله شد'
              : 'اسکن پیوسته فضای برداری تراکنش‌ها...'}
          </div>
        </div>
        <div
          dir="ltr"
          style={{
            fontSize: 11,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: isDetected ? THERMAL_RED : LASER_CYAN,
          }}
        >
          {isDetected ? 'ISOLATED_OK' : 'RADAR_SCAN'}
        </div>
      </div>
    </InferenceStage>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 5: InferenceEdgeCtaScene (34.60–41.20s)
// Monolithic Packaged BGA Chip & Developer Terminal Access CTA
// ═════════════════════════════════════════════════════════════════════════════

export function InferenceEdgeCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.15, 0.5))
  const ctaPop = popSpring(t, 2.0, 0.6)

  return (
    <InferenceStage scene={scene} t={t} shakes={[2.0]} punches={[0.3, 2.0]}>
      <SiliconHeader
        chipTag="HISABCHE_SILICON // DIRECT_API"
        title="موتور استنتاج هوش مصنوعی حسابچه"
        subtitle="پردازش سریع و بدون معطلی در دستان شما؛"
        accentText="بدون نیاز به خرید سرور شخصی"
        accentColor={SILICON_EMERALD}
        t={t}
      />

      {/* ─── Packaged BGA Processor Package (x=270, y=390) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 250,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          perspective: 800,
          zIndex: 25,
        }}
      >
        <div
          style={{
            width: 250,
            height: 250,
            borderRadius: 24,
            background: 'linear-gradient(145deg, #0d1527, #030712)',
            border: `2px solid ${SILICON_EMERALD}`,
            boxShadow: `0 20px 60px rgba(0,0,0,0.9), 0 0 35px rgba(16, 185, 129, 0.4)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transform: `rotateY(${Math.sin(t * 1.5) * 10}deg) rotateX(${Math.cos(t * 1.2) * 8}deg)`,
          }}
        >
          {/* Gold Corner Heat Spreader Accents */}
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              width: 14,
              height: 14,
              borderTop: `2px solid ${GOLD_PAD}`,
              borderLeft: `2px solid ${GOLD_PAD}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 14,
              height: 14,
              borderTop: `2px solid ${GOLD_PAD}`,
              borderRight: `2px solid ${GOLD_PAD}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              width: 14,
              height: 14,
              borderBottom: `2px solid ${GOLD_PAD}`,
              borderLeft: `2px solid ${GOLD_PAD}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              width: 14,
              height: 14,
              borderBottom: `2px solid ${GOLD_PAD}`,
              borderRight: `2px solid ${GOLD_PAD}`,
            }}
          />

          {/* Central Emblem Core */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.35) 0%, transparent 70%)',
              border: `2px solid ${SILICON_EMERALD}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 24px ${SILICON_EMERALD}`,
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 32 }}>⚡</span>
          </div>

          {/* Laser-Etched Chip Brand */}
          <div
            style={{
              fontSize: 14,
              fontWeight: 900,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.12em',
              color: WAFER_WHITE,
            }}
          >
            HISABCHE AI
          </div>
          <div
            style={{
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              color: SILICON_EMERALD,
              letterSpacing: '0.18em',
              marginTop: 4,
            }}
          >
            SUB_MS // FINFET_4NM
          </div>
        </div>
      </div>

      {/* Developer Terminal Command Bar */}
      <div
        dir="ltr"
        style={{
          position: 'absolute',
          top: 550,
          left: 36,
          right: 36,
          background: 'rgba(6, 13, 31, 0.95)',
          border: '1px solid rgba(0, 245, 255, 0.35)',
          borderRadius: 12,
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          opacity: enter,
          boxShadow: '0 0 20px rgba(0, 245, 255, 0.15)',
          zIndex: 25,
        }}
      >
        <span style={{ color: LASER_CYAN }}>$ curl api.hisabche.ai/v1/inference</span>
        <span style={{ color: SILICON_EMERALD, fontWeight: 800 }}>READY 200</span>
      </div>

      {/* High-Impact Tactical CTA Button */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 650,
          left: 36,
          right: 36,
          transform: `scale(${mix(0.9, 1, ctaPop)})`,
          opacity: clamp(progress(t, 1.8, 0.45)),
          zIndex: 35,
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${SILICON_EMERALD}, #059669)`,
            borderRadius: 18,
            padding: '18px 24px',
            textAlign: 'center',
            boxShadow: `0 16px 40px rgba(16, 185, 129, 0.45), 0 0 24px rgba(0, 245, 255, 0.3)`,
            border: '1.5px solid rgba(255, 255, 255, 0.4)',
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: '#02120d',
              letterSpacing: '-0.01em',
              marginBottom: 4,
            }}
          >
            کلمه «هوش» رو بفرست
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#04281c',
            }}
          >
            دریافت کلید دسترسی به موتور پردازش سریع
          </div>
        </div>
      </div>

      {/* 3 Silicon Trust Badges */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 46,
          left: 36,
          right: 36,
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          fontSize: 12,
          fontWeight: 700,
          color: TEXT_MUTED,
          opacity: enter,
          zIndex: 30,
        }}
      >
        <span>⚡ ۱۱ میلی‌ثانیه پاسخ</span>
        <span>•</span>
        <span>🛡️ امنیت بانکی داده‌ها</span>
        <span>•</span>
        <span>🚀 اتصال در ۱ دقیقه</span>
      </div>
    </InferenceStage>
  )
}
