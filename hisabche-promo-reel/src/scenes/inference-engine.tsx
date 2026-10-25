// src/scenes/inference-engine.tsx
// =============================================================================
// Reel 103 — «موتور استنتاج هوش مصنوعی حسابچه» (Hisabche Inference Engine)
// Modern High-Performance AI Inference Startup Showreel
//
// Full-Canvas Vertical 9:16 (540x960) Dynamic Composition:
// - Top Zone (y=35 to 160): Sleek Tech Topbar + Bold Natural Typography (Zero Stepped Boxes!)
// - Center Hero (y=175 to 575): Large-Scale Cybernetic Motion Graphics & 3D Shaders
// - Bottom Active Zone (y=595 to 915): Live Telemetry Sparklines, Real-Time Audio Meters, Benchmark Comparisons & High-Impact CTA
//
// 100% Procedural Math & SVG Transforms. Zero Static Empty Spaces. Zero Pipeline Clutter.
// =============================================================================

import React from 'react'
import type { Scene } from '../engine/types'
import { clamp, mix, progress } from '../engine/anim'
import { stagePunch, stageShake } from './card-motion'
import { faNumber } from '../ui/motion-primitives'

// ─── Design Tokens ────────────────────────────────────────────────────────────

const BG_VOID = '#020617'
const NEON_CYAN = '#00f5ff'
const NEON_EMERALD = '#00ff88'
const NEON_INDIGO = '#818cf8'
const NEON_VIOLET = '#c084fc'
const NEON_AMBER = '#fbbf24'
const NEON_RED = '#f43f5e'
const TEXT_MUTED = '#94a3b8'

// ─── Stage Frame (Full-Canvas 540x960 with Visceral Shake & Punch) ───────────

export function InferenceStage({
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
  const shake = stageShake(t, shakes)
  const punch = stagePunch(t, punches)
  const scanY = (t * 130) % 960

  return (
    <div
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        backgroundColor: BG_VOID,
        color: '#f8fafc',
        fontFamily: 'Vazirmatn, sans-serif',
        overflow: 'hidden',
        direction: 'ltr',
        transform: `translate(${shake.x.toFixed(1)}px, ${shake.y.toFixed(1)}px) scale(${punch.toFixed(3)})`,
        transformOrigin: 'center center',
      }}
    >
      {/* Background Cyber Grid */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.15,
          pointerEvents: 'none',
        }}
      >
        <defs>
          <pattern id="infGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(129, 140, 248, 0.45)"
              strokeWidth="0.8"
            />
            <circle cx="40" cy="40" r="1.2" fill="rgba(0, 245, 255, 0.6)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#infGrid)" />
      </svg>

      {/* Red Alert Thermal Vignette Flash on Panic */}
      {alertFlash && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle, transparent 40%, rgba(244, 63, 94, 0.35) 100%)',
            pointerEvents: 'none',
            zIndex: 15,
          }}
        />
      )}

      {/* Travelling Laser Scanline */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: scanY,
          height: 1.5,
          background: 'linear-gradient(90deg, transparent, rgba(0, 245, 255, 0.8), transparent)',
          boxShadow: '0 0 15px rgba(0, 245, 255, 0.9)',
          pointerEvents: 'none',
          zIndex: 12,
        }}
      />

      {/* Atmospheric Ambient Glow */}
      <div
        style={{
          position: 'absolute',
          top: '38%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.14) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

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
        <span>HISABCHE.AI // SUB-MILLISECOND INFERENCE</span>
        <span>GLOBAL EDGE CLUSTER</span>
        <span>V4.2_FP8</span>
      </div>
    </div>
  )
}

// ─── Reusable Clean Modern Topbar ─────────────────────────────────────────────

function StartupTopbar({
  tag = 'INFERENCE CLUSTER ONLINE',
  badge = '۱۱.۴ میلی‌ثانیه',
  badgeColor = NEON_EMERALD,
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
            background: NEON_CYAN,
            boxShadow: `0 0 10px ${NEON_CYAN}`,
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontFamily: 'monospace',
            fontWeight: 800,
            letterSpacing: 0.8,
            color: '#e2e8f0',
          }}
        >
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
          fontFamily: 'monospace',
          fontWeight: 800,
        }}
      >
        ● {badge}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 1: The Choked Latency Dial & Breakout Shockwave (0.00–7.20s)
// ─────────────────────────────────────────────────────────────────────────────

export function InferenceLatencyCrisisScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.5))
  const shock = clamp(progress(t, 2.5, 3.8))
  const latency = Math.round(mix(5420, 11, clamp(progress(t, 3.2, 5.6))))
  const needleAngle =
    shock > 0.5
      ? mix(110, -95, clamp(progress(t, 3.2, 4.8)))
      : mix(-110, 110, clamp(progress(t, 0.5, 2.8)))
  const alertFlash = t >= 2.4 && t <= 3.8

  // Orbiting blocked requests
  const packets = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
    const rad = ((deg + t * 50) * Math.PI) / 180
    const r = shock > 0.5 ? 180 : 130
    return {
      x: 270 + Math.cos(rad) * r,
      y: 360 + Math.sin(rad) * r,
      color: shock > 0.5 ? NEON_EMERALD : NEON_RED,
    }
  })

  return (
    <InferenceStage
      scene={scene}
      t={t}
      shakes={[2.5, 2.8, 3.2]}
      punches={[0.2, 3.2]}
      alertFlash={alertFlash}
    >
      <StartupTopbar
        tag="GPU CLUSTER // OVERLOAD SPIKE"
        badge={`${faNumber(latency)} میلی‌ثانیه`}
        badgeColor={latency > 100 ? NEON_RED : NEON_EMERALD}
      />

      {/* Bold, Clean Top Typography (Zero Stepped Words) */}
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
          سرعت پاسخ مدل کُنده؟{' '}
          <span style={{ color: latency > 100 ? NEON_RED : NEON_EMERALD }}>
            {latency > 100 ? 'کاربرت ثانیه‌ها معطله!' : 'شتاب ۱۱ میلی‌ثانیه‌ای!'}
          </span>
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
          صف‌های سنگین سرور، هزینه سرسام‌آور GPU و لودینگ‌های کلافه‌کننده‌ای که بیزنس را می‌کُشد
        </p>
      </div>

      {/* Center Hero: High-Precision Latency Tachometer (y=180 to y=550) */}
      <div
        style={{
          position: 'absolute',
          top: 180,
          left: 45,
          right: 45,
          height: 360,
          borderRadius: 24,
          background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.9), rgba(2, 6, 23, 0.98))',
          border: `1.5px solid ${latency > 100 ? 'rgba(244, 63, 94, 0.5)' : 'rgba(0, 255, 136, 0.5)'}`,
          boxShadow: `0 25px 60px rgba(0,0,0,0.85), 0 0 40px ${latency > 100 ? 'rgba(244, 63, 94, 0.25)' : 'rgba(0, 255, 136, 0.25)'}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
        }}
      >
        {/* Tachometer SVG */}
        <svg width="300" height="190" viewBox="0 0 300 190">
          <defs>
            <linearGradient id="dialGrad103" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00ff88" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
          </defs>
          {/* Track */}
          <path
            d="M 40 160 A 110 110 0 0 1 260 160"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="18"
            strokeLinecap="round"
          />
          {/* Active Arc */}
          <path
            d="M 40 160 A 110 110 0 0 1 260 160"
            fill="none"
            stroke="url(#dialGrad103)"
            strokeWidth="18"
            strokeLinecap="round"
            strokeDasharray="345"
            strokeDashoffset={mix(345, 0, clamp(progress(t, 0.4, 2.6)))}
          />
          {/* Needle with Hub */}
          <g transform={`translate(150, 160) rotate(${needleAngle})`}>
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="-95"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="0" cy="0" r="10" fill={latency > 100 ? NEON_RED : NEON_EMERALD} />
          </g>
        </svg>

        {/* Digital Speedometer Readout */}
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <div
            style={{
              fontSize: 44,
              fontWeight: 900,
              fontFamily: 'monospace',
              color: latency > 100 ? NEON_RED : NEON_EMERALD,
              textShadow: `0 0 25px ${latency > 100 ? NEON_RED : NEON_EMERALD}77`,
            }}
          >
            {faNumber(latency)} <span style={{ fontSize: 18, fontWeight: 500 }}>میلی‌ثانیه</span>
          </div>
          <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 4 }}>
            زمان تأخیر تا اولین توکن (TTFT)
          </div>
        </div>
      </div>

      {/* Orbiting Quantum Data Packets */}
      {packets.map((pkt, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: pkt.x,
            top: pkt.y,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: pkt.color,
            boxShadow: `0 0 14px ${pkt.color}`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 25,
          }}
        />
      ))}

      {/* Bottom Active Zone: Telemetry Cards & Live Log Terminal (y=570 to y=890) */}
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
        {/* Trio of Telemetry Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: '14px 10px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 11, color: TEXT_MUTED }}>ترافیک در صف</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: NEON_RED, marginTop: 4 }}>
              {faNumber(86)}٪
            </div>
            <div style={{ fontSize: 9.5, color: '#f87171', marginTop: 2 }}>انباشت سرور</div>
          </div>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: '14px 10px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 11, color: TEXT_MUTED }}>هزینه پردازش</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: NEON_AMBER, marginTop: 4 }}>
              {faNumber(4.2)}X
            </div>
            <div style={{ fontSize: 9.5, color: '#fcd34d', marginTop: 2 }}>اتلاف منابع</div>
          </div>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: '14px 10px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 11, color: TEXT_MUTED }}>ریزش کاربر</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc', marginTop: 4 }}>
              {faNumber(62)}٪
            </div>
            <div style={{ fontSize: 9.5, color: TEXT_MUTED, marginTop: 2 }}>ترک صفحه</div>
          </div>
        </div>

        {/* Live Terminal Log Line */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.65)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 14,
            padding: '12px 16px',
            fontFamily: 'monospace',
            fontSize: 11,
            color: latency > 100 ? '#fca5a5' : '#86efac',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            direction: 'ltr',
          }}
        >
          <span>
            {latency > 100
              ? '⚠️ [WARN] BACKPRESSURE CRITICAL: 14,200 REQ/S QUEUED'
              : '⚡ [INFO] TENSOR PIPELINE STREAMING AT PEAK BANDWIDTH'}
          </span>
          <span style={{ fontWeight: 800 }}>{latency > 100 ? 'SHED_FAIL' : 'OK_200'}</span>
        </div>
      </div>
    </InferenceStage>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 2: High-Throughput Token Streaming & 16-Bar Equalizer (7.20–14.40s)
// ─────────────────────────────────────────────────────────────────────────────

export function NeuralTokenStreamScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.5))
  const streamX = (t * 160) % 400
  const tokensPerSec = Math.min(1850, Math.round(mix(240, 1850, clamp(progress(t, 0.5, 4.5)))))

  const tokens = [
    { text: '[PROMPT]', color: NEON_INDIGO },
    { text: 'vector_embed_768', color: NEON_CYAN },
    { text: 'flash_attention_v3', color: NEON_EMERALD },
    { text: 'kv_cache_paged', color: NEON_AMBER },
    { text: 'quant_fp8_gemm', color: NEON_VIOLET },
    { text: 'speculative_draft', color: NEON_CYAN },
    { text: '[STREAM_OUT]', color: '#f8fafc' },
  ]

  // 18-Bar Neural Spectrum Analyzer
  const bars = Array.from({ length: 18 }).map((_, i) => {
    const height = 18 + Math.abs(Math.sin(t * 9 + i * 0.55)) * 62
    return { id: i, height }
  })

  return (
    <InferenceStage scene={scene} t={t} punches={[0.3, 2.2, 5.0]}>
      <StartupTopbar
        tag="PARALLEL DECODING PIPELINE"
        badge={`${faNumber(tokensPerSec)} توکن/ثانیه`}
        badgeColor={NEON_CYAN}
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
          جریان روان توکن‌ها با <span style={{ color: NEON_CYAN }}>سرعت ۱٬۸۵۰ توکن/ثانیه</span>
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
          فشرده‌سازی خودکار کش حافظه بدون کوچک‌ترین افت در دقت محاسبات آماری
        </p>
      </div>

      {/* Center Hero: Animated Conveyor & Spectrum Analyzer (y=180 to y=550) */}
      <div
        style={{
          position: 'absolute',
          top: 180,
          left: 45,
          right: 45,
          height: 360,
          borderRadius: 24,
          background: 'linear-gradient(145deg, rgba(8, 16, 36, 0.92), rgba(2, 6, 20, 0.98))',
          border: '1.5px solid rgba(0, 245, 255, 0.45)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(0, 245, 255, 0.25)',
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 20,
        }}
      >
        {/* Pipeline Telemetry Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: NEON_CYAN,
                boxShadow: `0 0 12px ${NEON_CYAN}`,
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>
              HIGH-THROUGHPUT TOKEN STREAM
            </span>
          </div>
          <span
            style={{ fontSize: 12, fontFamily: 'monospace', color: NEON_CYAN, fontWeight: 800 }}
          >
            {faNumber(tokensPerSec)} TOKENS/SEC
          </span>
        </div>

        {/* Dynamic Horizontal Token Rail */}
        <div
          style={{
            height: 80,
            overflow: 'hidden',
            borderRadius: 14,
            background: 'rgba(0, 0, 0, 0.65)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 12,
              transform: `translateX(-${streamX}px)`,
              whiteSpace: 'nowrap',
            }}
          >
            {[...tokens, ...tokens, ...tokens].map((tok, idx) => (
              <div
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: `1.5px solid ${tok.color}`,
                  color: tok.color,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  boxShadow: `0 0 12px ${tok.color}33`,
                }}
              >
                <span>✦</span>
                <span>{tok.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 18-Bar Live Spectrum Frequency Visualizer */}
        <div>
          <div
            style={{
              fontSize: 11,
              color: TEXT_MUTED,
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>توزیع بار هسته‌های تنسور // بازدهی پردازش</span>
            <span style={{ color: NEON_EMERALD, fontWeight: 800 }}>۹۹.۴٪ PEAK EFFICIENCY</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              height: 90,
              padding: '8px 16px',
              borderRadius: 12,
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {bars.map((bar) => (
              <div
                key={bar.id}
                style={{
                  width: 14,
                  height: bar.height,
                  borderRadius: 4,
                  background: 'linear-gradient(to top, #00f5ff, #818cf8)',
                  boxShadow: '0 0 10px rgba(0, 245, 255, 0.5)',
                  transition: 'height 0.08s ease',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Active Zone: Memory & Throughput Analytics (y=565 to y=890) */}
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
            <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>صرفه‌جویی در حافظه رم</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: NEON_EMERALD, marginTop: 4 }}>
              -{faNumber(78)}٪
            </div>
            <div style={{ fontSize: 10, color: '#86efac', marginTop: 2 }}>
              مدیریت هوشمند Paged KV-Cache
            </div>
          </div>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(0, 245, 255, 0.35)',
              borderRadius: 16,
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>پهنای باند داده</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: NEON_CYAN, marginTop: 4 }}>
              {faNumber(1.8)} <span style={{ fontSize: 14 }}>ترابایت/ث</span>
            </div>
            <div style={{ fontSize: 10, color: '#a5f3fc', marginTop: 2 }}>
              بدون کوچک‌ترین گلوگاه ورودی
            </div>
          </div>
        </div>

        {/* Speculative Acceleration Bar */}
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
            ⚡ معماری استنتاج رمزگشایی گمانه‌زن (Speculative)
          </span>
          <span style={{ fontSize: 12, fontWeight: 900, color: NEON_EMERALD }}>
            +{faNumber(340)}٪ شتاب خالص
          </span>
        </div>
      </div>
    </InferenceStage>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 3: Speculative Decoding 3D Isometric Architecture (14.40–25.20s)
// ─────────────────────────────────────────────────────────────────────────────

export function SpeculativeInferenceMatrixScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.5))
  const separation = clamp(progress(t, 1.0, 2.5))
  const floatZ = Math.sin(t * 3.5) * 8

  return (
    <InferenceStage scene={scene} t={t} punches={[1.5, 4.8, 8.5]}>
      <StartupTopbar
        tag="SPECULATIVE DECODING MATRIX"
        badge="شتاب ۴ برابری"
        badgeColor={NEON_EMERALD}
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
          رمزگشایی گمانه‌زن در <span style={{ color: NEON_EMERALD }}>مقیاس میکروثانیه</span>
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
          تلفیق مدل سبک پیش‌نویس با مدل هدف برای سرعت ۴ برابری در سطح سیلیکون
        </p>
      </div>

      {/* Center Hero: 3D Isometric Exploded Glass Deck (y=175 to y=550) */}
      <div
        style={{
          position: 'absolute',
          top: 175,
          left: 45,
          right: 45,
          height: 360,
          perspective: 1100,
          transformStyle: 'preserve-3d',
          zIndex: 20,
        }}
      >
        {/* Layer 1 (Bottom): Silicon FP8 Hardware Substrate */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 22,
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(4, 9, 20, 0.98))',
            border: '1.5px solid rgba(129, 140, 248, 0.65)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.85), 0 0 35px rgba(129, 140, 248, 0.3)',
            transform: `rotateX(54deg) rotateZ(-26deg) translateZ(${-65 * separation + floatZ}px)`,
            padding: '18px 22px',
            transition: 'transform 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: NEON_INDIGO }}>
              ⚡ هسته تانسوری سیلیکون // محاسبات ماتریسی
            </span>
            <span style={{ fontSize: 10.5, color: NEON_EMERALD, fontWeight: 800 }}>
              FP8 ACTIVATED
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <div
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                fontSize: 11,
              }}
            >
              ضرب ماتریسی با دقت کامل
            </div>
            <div
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                fontSize: 11,
              }}
            >
              مدیریت هوشمند HBM3e
            </div>
          </div>
        </div>

        {/* Layer 2 (Middle): Continuous Batching & Draft Verifier */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 22,
            background: 'linear-gradient(135deg, rgba(8, 28, 38, 0.95), rgba(3, 14, 22, 0.98))',
            border: '2px solid rgba(0, 245, 255, 0.85)',
            boxShadow: '0 30px 60px rgba(0,0,0,0.85), 0 0 45px rgba(0, 245, 255, 0.35)',
            transform: `rotateX(54deg) rotateZ(-26deg) translateZ(${30 * separation + floatZ}px)`,
            padding: '20px 24px',
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
              🔄 صف‌بندی پویا (Continuous Batching)
            </span>
            <span
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                background: '#0284c7',
                color: '#fff',
                fontSize: 10,
              }}
            >
              راندمان ۹۹.۶٪
            </span>
          </div>
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              fontSize: 11.5,
              color: '#e0f2fe',
              lineHeight: 1.5,
            }}
          >
            پیش‌بینی هم‌زمان ۵ توکن در یک چرخه؛ حذف کامل حباب‌های اتلاف پردازشگر
          </div>
        </div>

        {/* Layer 3 (Top Floating Core Beacon) */}
        <div
          style={{
            position: 'absolute',
            top: '38%',
            left: '50%',
            transform: `translate(-50%, -50%) rotateX(54deg) rotateZ(-26deg) translateZ(${115 * separation + floatZ}px)`,
            width: 110,
            height: 110,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0, 245, 255, 0.5), transparent 70%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #00f5ff',
            boxShadow: '0 0 40px #00f5ff',
          }}
        >
          <span style={{ fontSize: 36 }}>⚡</span>
        </div>
      </div>

      {/* Bottom Active Zone: Benchmark Comparison (y=565 to y=890) */}
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
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 18,
            padding: '16px 20px',
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
            <span style={{ fontSize: 12, color: TEXT_MUTED }}>مقایسه زمان پاسخ‌دهی (Latency)</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: NEON_EMERALD }}>
              ۳۳ برابر سریع‌تر
            </span>
          </div>

          {/* Bar 1: Hisabche */}
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                marginBottom: 4,
              }}
            >
              <span style={{ color: '#ffffff', fontWeight: 800 }}>⚡ موتور استنتاج حسابچه</span>
              <span style={{ color: NEON_EMERALD, fontWeight: 900 }}>۱۱.۴ میلی‌ثانیه</span>
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
                  width: '12%',
                  background: NEON_EMERALD,
                  boxShadow: '0 0 10px #00ff88',
                }}
              />
            </div>
          </div>

          {/* Bar 2: Legacy Cloud */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                marginBottom: 4,
              }}
            >
              <span style={{ color: TEXT_MUTED }}>سایر سرورهای ابری معمولی</span>
              <span style={{ color: NEON_RED, fontWeight: 900 }}>۳۸۰ میلی‌ثانیه</span>
            </div>
            <div
              style={{
                height: 10,
                borderRadius: 5,
                background: 'rgba(255,255,255,0.08)',
                overflow: 'hidden',
              }}
            >
              <div style={{ height: '100%', width: '92%', background: NEON_RED }} />
            </div>
          </div>
        </div>

        {/* Accuracy Lock Pill */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.65)',
            border: '1px solid rgba(0, 255, 136, 0.35)',
            borderRadius: 14,
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: '#f8fafc', fontWeight: 800 }}>
            🎯 تضمین تطابق ۱۰۰٪ دقت اعشاری بدون خطای تبدیل مدل
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: NEON_EMERALD }}>VERIFIED ✅</span>
        </div>
      </div>
    </InferenceStage>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 4: Autonomous Semantic Radar & Anomaly Lock (25.20–34.60s)
// ─────────────────────────────────────────────────────────────────────────────

export function AutonomousReasoningLassoScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.5))
  const lockOn = clamp(progress(t, 1.8, 3.2))

  const nodes = [
    { x: 90, y: 70, label: 'تراکنش ۱', isAnomaly: false },
    { x: 180, y: 120, label: 'فاکتور ۱۰۲', isAnomaly: false },
    { x: 260, y: 80, label: 'حواله انبار', isAnomaly: false },
    { x: 340, y: 140, label: 'پرداخت نقدی', isAnomaly: false },
    { x: 220, y: 200, label: 'مغایرت مشکوک', isAnomaly: true },
    { x: 130, y: 220, label: 'سند دوبل', isAnomaly: false },
    { x: 330, y: 210, label: 'تراز حساب', isAnomaly: false },
  ]

  return (
    <InferenceStage scene={scene} t={t} shakes={[2.2, 2.5]} punches={[0.4, 2.5, 6.5]}>
      <StartupTopbar tag="AUTONOMOUS VECTOR AUDIT" badge="تشخیص آنی تقلب" badgeColor={NEON_RED} />

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
          کشف آنی الگوها در{' '}
          <span style={{ color: lockOn > 0.5 ? NEON_RED : NEON_CYAN }}>
            {lockOn > 0.5 ? 'کسری از میلی‌ثانیه!' : 'فضای برداری اسناد'}
          </span>
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
          استنتاج معنایی رویدادهای مالی بدون نیاز به فرمول‌نویسی دستی یا نیروی انسانی
        </p>
      </div>

      {/* Center Hero: Large Radar Hologram Canvas (y=180 to y=550) */}
      <div
        style={{
          position: 'absolute',
          top: 180,
          left: 45,
          right: 45,
          height: 360,
          borderRadius: 24,
          background: 'linear-gradient(145deg, rgba(8, 14, 28, 0.92), rgba(2, 6, 16, 0.98))',
          border: '1.5px solid rgba(129, 140, 248, 0.4)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(129, 140, 248, 0.2)',
          overflow: 'hidden',
          zIndex: 20,
        }}
      >
        {/* Radar Concentric Rings */}
        {[100, 200, 300].map((dim, idx) => (
          <div
            key={idx}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: dim,
              height: dim,
              borderRadius: '50%',
              border: '1px dashed rgba(0, 245, 255, 0.18)',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Radar Sweeping Beam */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 320,
            height: 320,
            borderRadius: '50%',
            transform: `translate(-50%, -50%) rotate(${t * 60}deg)`,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              width: 2,
              height: '50%',
              background: 'linear-gradient(to top, rgba(0, 245, 255, 0.9), transparent)',
            }}
          />
        </div>

        {/* Vector Embedding Nodes */}
        {nodes.map((node, i) => {
          const isTarget = node.isAnomaly && lockOn > 0.3
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: node.x,
                top: node.y,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transform: isTarget ? `scale(${1 + Math.sin(t * 10) * 0.15})` : 'scale(1)',
                transition: 'transform 0.2s ease',
              }}
            >
              <div
                style={{
                  width: isTarget ? 16 : 10,
                  height: isTarget ? 16 : 10,
                  borderRadius: '50%',
                  background: isTarget ? NEON_RED : NEON_CYAN,
                  boxShadow: `0 0 ${isTarget ? 18 : 8}px ${isTarget ? NEON_RED : NEON_CYAN}`,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isTarget ? 900 : 500,
                  color: isTarget ? NEON_RED : 'rgba(255,255,255,0.7)',
                  background: 'rgba(0,0,0,0.65)',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                {node.label}
              </span>
            </div>
          )
        })}

        {/* Anomaly Targeted Popup */}
        {lockOn > 0.4 && (
          <div
            dir="rtl"
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              right: 16,
              borderRadius: 14,
              background: 'rgba(244, 63, 94, 0.2)',
              border: '1.5px solid #f43f5e',
              boxShadow: '0 0 25px rgba(244, 63, 94, 0.45)',
              padding: '12px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>🚨</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>
                  مغایرت انحراف برداری شناسایی شد!
                </div>
                <div style={{ fontSize: 10.5, color: '#fecdd3', marginTop: 2 }}>
                  فاصله معنایی غیرعادی با اسناد بالادستی // فاصله: ۰.۹۴
                </div>
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                color: '#ffffff',
                background: '#f43f5e',
                padding: '4px 10px',
                borderRadius: 6,
              }}
            >
              قرنطینه آنی
            </span>
          </div>
        )}
      </div>

      {/* Bottom Active Zone: Diagnostic Audit Telemetry (y=565 to y=890) */}
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
            <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>زمان تشخیص و قرنطینه</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: NEON_EMERALD, marginTop: 4 }}>
              {faNumber(1.2)} <span style={{ fontSize: 14 }}>میلی‌ثانیه</span>
            </div>
            <div style={{ fontSize: 10, color: '#86efac', marginTop: 2 }}>بدون توقف خط فروش</div>
          </div>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(0, 245, 255, 0.35)',
              borderRadius: 16,
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>دقت تفکیک تقلب</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: NEON_CYAN, marginTop: 4 }}>
              ۹۹.۹۷٪
            </div>
            <div style={{ fontSize: 10, color: '#a5f3fc', marginTop: 2 }}>حذف ۱۰۰٪ خطای انسانی</div>
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
            🛡️ لاگ تغییرناپذیر ثبت در دفتر کل رمزنگاری‌شده
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: NEON_EMERALD }}>IMMUTABLE_LOG</span>
        </div>
      </div>
    </InferenceStage>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE 5: Developer API Console & Global Low-Latency Edge (34.60–41.20s)
// ─────────────────────────────────────────────────────────────────────────────

export function InferenceEdgeCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.5))
  const pulse = Math.sin(t * 6) * 0.04

  return (
    <InferenceStage scene={scene} t={t} punches={[0.3, 2.0]}>
      <StartupTopbar
        tag="INSTANT DEVELOPER ACCESS"
        badge="ساندباکس رایگان"
        badgeColor={NEON_EMERALD}
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
        <h1 style={{ fontSize: 29, fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1.3 }}>
          کلید اختصاصی <span style={{ color: NEON_EMERALD }}>موتور هوش</span> در دستان تو
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
          تست رایگان سرعت استنتاج و اتصال به کلاستر ابری با یک پیام در دایرکت
        </p>
      </div>

      {/* Center Hero: Developer Holographic API Console (y=175 to y=520) */}
      <div
        style={{
          position: 'absolute',
          top: 175,
          left: 45,
          right: 45,
          height: 330,
          borderRadius: 24,
          background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(2, 6, 23, 0.98))',
          border: '1.5px solid rgba(0, 255, 136, 0.65)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 40px rgba(0, 255, 136, 0.25)',
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 20,
        }}
      >
        {/* Terminal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f43f5e' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbbf24' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#00ff88' }} />
          </div>
          <span
            style={{ fontSize: 11, fontFamily: 'monospace', color: NEON_EMERALD, fontWeight: 800 }}
          >
            API_TERMINAL // CLOUD_READY
          </span>
        </div>

        {/* Code Snippet Box */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.75)',
            borderRadius: 14,
            padding: '16px 18px',
            fontFamily: 'monospace',
            fontSize: 12,
            lineHeight: 1.6,
            color: '#a5f3fc',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ color: 'rgba(255,255,255,0.45)' }}>
            # فراخوانی با حداقل تأخیر در سطح میلی‌ثانیه
          </div>
          <div>
            <span style={{ color: NEON_INDIGO }}>curl</span> -X POST
            https://api.hisabche.ai/v1/inference \
          </div>
          <div style={{ paddingLeft: 14 }}>
            -H <span style={{ color: NEON_EMERALD }}>"Authorization: Bearer sk-inf-live-99x7"</span>{' '}
            \
          </div>
          <div style={{ paddingLeft: 14 }}>
            -d{' '}
            <span style={{ color: NEON_AMBER }}>{`'{"stream": true, "speculative": true}'`}</span>
          </div>
        </div>

        {/* Global Edge Node Ping Status */}
        <div
          dir="rtl"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          <span style={{ fontSize: 11.5, color: TEXT_MUTED }}>
            شبکه توزیع جهانی لبه (Edge Nodes)
          </span>
          <span style={{ fontSize: 12, fontWeight: 900, color: NEON_EMERALD }}>
            پینگ: {faNumber(4)} میلی‌ثانیه 🟢
          </span>
        </div>
      </div>

      {/* Bottom Active Zone: Massive Kinetic CTA Button & Perks (y=535 to y=890) */}
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
            background: 'linear-gradient(135deg, #00ff88, #00c853)',
            color: '#020617',
            fontSize: 22,
            fontWeight: 900,
            boxShadow: '0 20px 50px rgba(0, 255, 136, 0.45)',
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
              color: '#00ff88',
              padding: '4px 14px',
              borderRadius: 10,
              fontSize: 24,
              fontWeight: 900,
            }}
          >
            «هوش»
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
            <div style={{ fontSize: 13 }}>⚡</div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
              تست بلادرنگ
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
            <div style={{ fontSize: 13 }}>🔑</div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
              کلید اختصاصی
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
            <div style={{ fontSize: 13 }}>📚</div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
              مستندات API
            </div>
          </div>
        </div>
      </div>
    </InferenceStage>
  )
}
