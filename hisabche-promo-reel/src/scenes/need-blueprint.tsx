// ============================================
// Need-blueprint art direction (reel 107) — «شکل نیاز»
// Complete Motion Graphics & Architectural Blueprint Refactor
//
// This film sells the NEED for ERP/CRM, not a number.
// Strictly compliant with Reel 107's creative DNA:
// - Not a single arithmetic digit on screen for the whole 42 seconds!
// - Full 9:16 vertical canvas (540x960) with balanced active zones.
// - High-craft 2.5D CAD architectural wireframe & holographic transformation.
// - Dynamic stage camera shake and punches on hits.
// - Rich lower telemetry decks preventing any empty black voids.
// ============================================

import React from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, mix, progress, spring } from '../engine/anim'
import { stagePunch, stageShake } from './card-motion'

// ─── Tokens ──────────────────────────────────────────────────────────────────

const INK_DEEP = '#030813'
const CYAN_BLUEPRINT = '#38bdf8'
const CYAN_LASER = '#7dd3fc'
const AMBER_ALERT = '#f59e0b'
const EMERALD_MINT = '#10b981'
const ROSE_FRACTURE = '#f43f5e'
const PAPER_WHITE = '#f1f5f9'
const TEXT_MUTED = '#94a3b8'
const HOLLOW_STROKE = 'rgba(125, 211, 252, 0.45)'

function popSpring(t: number, at: number, dur = 0.5): number {
  return spring(clamp(progress(t, at, dur)))
}

// ─── Interactive Background Matrix ───────────────────────────────────────────

function BlueprintBackdrop({ t }: { t: number }) {
  const scanY = (t * 110) % 960
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Radial depth light */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(750px 520px at 50% 28%, rgba(56, 189, 248, 0.14), transparent 70%), radial-gradient(650px 480px at 50% 82%, rgba(16, 185, 129, 0.08), transparent 72%)',
        }}
      />

      {/* Isometric/Perspective Grid Floor */}
      <div
        style={{
          position: 'absolute',
          left: -100,
          right: -100,
          top: 0,
          bottom: -100,
          backgroundImage:
            'linear-gradient(rgba(56, 189, 248, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.12) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          opacity: 0.45,
          transform: 'perspective(600px) rotateX(32deg) translateY(20px)',
          transformOrigin: '50% 60%',
        }}
      />

      {/* Floating Blueprint Crosshairs */}
      <svg
        width={540}
        height={960}
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0, opacity: 0.28 }}
      >
        <path d="M40 80 L60 80 M50 70 L50 90" stroke={CYAN_LASER} strokeWidth={1.5} />
        <path d="M480 80 L500 80 M490 70 L490 90" stroke={CYAN_LASER} strokeWidth={1.5} />
        <path d="M40 900 L60 900 M50 890 L50 910" stroke={CYAN_LASER} strokeWidth={1.5} />
        <path d="M480 900 L500 900 M490 890 L490 910" stroke={CYAN_LASER} strokeWidth={1.5} />
      </svg>

      {/* Sweeping Laser Scanline */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: scanY,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${CYAN_LASER}, transparent)`,
          boxShadow: `0 0 16px ${CYAN_LASER}, 0 0 32px ${CYAN_BLUEPRINT}`,
          opacity: 0.65,
        }}
      />

      {/* Vignette Edge Shading */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 50%, transparent 45%, rgba(2, 6, 14, 0.92) 100%)',
        }}
      />
    </div>
  )
}

// ─── Stage Shell with Motion Physics ─────────────────────────────────────────

export function NeedStage({
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
        background: INK_DEEP,
        overflow: 'hidden',
        color: PAPER_WHITE,
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
        <BlueprintBackdrop t={t} />
        {children}

        {/* Ambient Footer Trace */}
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
          <span>HISABCHE // ARCHITECTURE CAD</span>
          <span>9:16 ENGINE CORE</span>
        </div>
      </div>
    </div>
  )
}

// ─── Reusable Topbar & Headers ────────────────────────────────────────────────

function BlueprintTopbar({
  tag,
  status,
  color = CYAN_BLUEPRINT,
}: {
  tag: string
  status: string
  color?: string
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 36,
        left: 24,
        right: 24,
        height: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 20,
      }}
    >
      {/* Right Persian System Path */}
      <div
        dir="rtl"
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: TEXT_MUTED,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ color }}>●</span>
        <span>{tag}</span>
      </div>

      {/* Left Monospace CAD Beacon */}
      <div
        dir="ltr"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          background: 'rgba(15, 23, 42, 0.75)',
          border: `1px solid ${color}44`,
          padding: '3px 10px',
          borderRadius: 999,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color,
          letterSpacing: '0.08em',
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
        <span>{status}</span>
      </div>
    </div>
  )
}

function BlueprintSceneHeader({
  badge,
  badgeColor = CYAN_BLUEPRINT,
  title,
  subtitle,
  subtitleAccent,
  accentColor = CYAN_LASER,
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
        top: 74,
        left: 24,
        right: 24,
        textAlign: 'start',
        zIndex: 20,
        opacity: enter,
        transform: `translateY(${mix(12, 0, enter)}px)`,
      }}
    >
      {/* Badge Pill */}
      <div style={{ display: 'inline-block', marginBottom: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: badgeColor,
            background: `${badgeColor}18`,
            border: `1px solid ${badgeColor}40`,
            padding: '2px 9px',
            borderRadius: 6,
            letterSpacing: '0.02em',
          }}
        >
          {badge}
        </span>
      </div>

      {/* Main Title */}
      <div
        style={{
          fontSize: 27,
          fontWeight: 900,
          color: PAPER_WHITE,
          lineHeight: 1.25,
          letterSpacing: '-0.02em',
          marginBottom: 4,
        }}
      >
        {title}
      </div>

      {/* Subtitle with accent */}
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: TEXT_MUTED,
          lineHeight: 1.45,
        }}
      >
        <span>{subtitle} </span>
        <span style={{ color: accentColor, fontWeight: 800 }}>{subtitleAccent}</span>
      </div>
    </div>
  )
}

// ─── Scene 1 · Frame 0: The Hollow Blueprint & Missing Core ───────────────────

export function EmptySlotScene({ t, scene }: { t: number; scene: Scene }) {
  const draw = ease(clamp(progress(t, 0.1, 1.8)))
  const gapOn = clamp(progress(t, 1.2, 0.8))
  const pulse = 0.5 + 0.5 * Math.sin(t * 4.2)
  const alertPop = popSpring(t, 1.45, 0.6)
  const tail = 1 - draw

  return (
    <NeedStage scene={scene} t={t} shakes={[1.45]} punches={[0.05, 1.45]}>
      <BlueprintTopbar
        tag="معماری کسب‌وکار // اسکن یکپارچگی"
        status="CAD_CORE // DISCONNECTED"
        color={CYAN_BLUEPRINT}
      />

      <BlueprintSceneHeader
        badge="تحلیل دیاگرام مغازه"
        title="همه‌چیز سر جایش است..."
        subtitle="جز همان یک حلقه مفقوده که باید"
        subtitleAccent="تمام ارکان را به هم وصل کند!"
        accentColor={AMBER_ALERT}
        t={t}
      />

      {/* ─── Hero CAD Stage Deck (y: 180 to 550) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 182,
          left: 24,
          right: 24,
          height: 366,
          background: 'rgba(6, 17, 33, 0.82)',
          border: '1.5px solid rgba(56, 189, 248, 0.28)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 20px 48px rgba(2, 6, 14, 0.8), inset 0 0 24px rgba(56, 189, 248, 0.06)',
        }}
      >
        {/* Technical Corner Brackets */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 12,
            fontSize: 9,
            fontFamily: 'monospace',
            color: 'rgba(125,211,252,0.4)',
          }}
        >
          SEC_01 // COORD [X:α, Y:β]
        </div>
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 12,
            fontSize: 9,
            fontFamily: 'monospace',
            color: 'rgba(125,211,252,0.4)',
          }}
        >
          STATUS: VOID_DETECTED
        </div>

        {/* Blueprint Wireframe SVG */}
        <svg
          width={492}
          height={366}
          viewBox="0 0 492 366"
          style={{ position: 'absolute', inset: 0 }}
        >
          <defs>
            <linearGradient id="laserGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={CYAN_LASER} stopOpacity={0.9} />
              <stop offset="100%" stopColor={CYAN_BLUEPRINT} stopOpacity={0.4} />
            </linearGradient>
            <pattern id="cadDotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="rgba(125,211,252,0.18)" />
            </pattern>
          </defs>

          <rect width="492" height="366" fill="url(#cadDotGrid)" />

          {/* Outer Shop Floor Boundary (Hollow Blueprint) */}
          <rect
            x={24}
            y={24}
            width={444}
            height={318}
            rx={16}
            fill="none"
            stroke={HOLLOW_STROKE}
            strokeWidth={1.8}
            strokeDasharray="9 7"
            strokeDashoffset={tail * 180}
            opacity={draw}
          />

          {/* Station 1: Warehouse Shelf Bay (Top-Right) */}
          <g opacity={draw} transform="translate(280, 48)">
            <rect
              width={168}
              height={94}
              rx={10}
              fill="rgba(8, 24, 44, 0.65)"
              stroke={CYAN_BLUEPRINT}
              strokeWidth={1.4}
              strokeDasharray="6 6"
            />
            {/* 3 Wireframe stock cubes */}
            <rect
              x={14}
              y={20}
              width={38}
              height={26}
              rx={4}
              fill="none"
              stroke={HOLLOW_STROKE}
              strokeWidth={1.2}
            />
            <rect
              x={64}
              y={20}
              width={38}
              height={26}
              rx={4}
              fill="none"
              stroke={HOLLOW_STROKE}
              strokeWidth={1.2}
            />
            <rect
              x={114}
              y={20}
              width={38}
              height={26}
              rx={4}
              fill="none"
              stroke={HOLLOW_STROKE}
              strokeWidth={1.2}
            />
            <rect
              x={14}
              y={54}
              width={138}
              height={24}
              rx={4}
              fill="none"
              stroke={HOLLOW_STROKE}
              strokeWidth={1.2}
            />
            <text
              x={84}
              y={70}
              textAnchor="middle"
              fill={PAPER_WHITE}
              fontSize={11}
              fontWeight={800}
              opacity={0.85}
            >
              انبار و قفسه‌ها
            </text>
          </g>

          {/* Station 2: Cashier & Counter (Top-Left) */}
          <g opacity={draw} transform="translate(44, 48)">
            <rect
              width={168}
              height={94}
              rx={10}
              fill="rgba(8, 24, 44, 0.65)"
              stroke={CYAN_BLUEPRINT}
              strokeWidth={1.4}
              strokeDasharray="6 6"
            />
            <rect
              x={20}
              y={18}
              width={64}
              height={32}
              rx={6}
              fill="none"
              stroke={HOLLOW_STROKE}
              strokeWidth={1.2}
            />
            <circle cx={124} cy={34} r={14} fill="none" stroke={HOLLOW_STROKE} strokeWidth={1.2} />
            <rect
              x={20}
              y={58}
              width={128}
              height={20}
              rx={4}
              fill="none"
              stroke={HOLLOW_STROKE}
              strokeWidth={1.2}
            />
            <text
              x={84}
              y={72}
              textAnchor="middle"
              fill={PAPER_WHITE}
              fontSize={11}
              fontWeight={800}
              opacity={0.85}
            >
              صندوق و پیشخوان
            </text>
          </g>

          {/* Station 3: Ledger & Accounts (Bottom Bar) */}
          <g opacity={draw} transform="translate(44, 252)">
            <rect
              width={404}
              height={70}
              rx={10}
              fill="rgba(8, 24, 44, 0.65)"
              stroke={CYAN_BLUEPRINT}
              strokeWidth={1.4}
              strokeDasharray="6 6"
            />
            <line x1={30} y1={28} x2={140} y2={28} stroke={HOLLOW_STROKE} strokeWidth={2} />
            <line
              x1={30}
              y1={42}
              x2={120}
              y2={42}
              stroke={HOLLOW_STROKE}
              strokeWidth={1.5}
              opacity={0.6}
            />
            <text
              x={202}
              y={42}
              textAnchor="middle"
              fill={PAPER_WHITE}
              fontSize={12}
              fontWeight={800}
              opacity={0.85}
            >
              دفتر نسیه کاغذی و طلب‌ها
            </text>
          </g>

          {/* Disconnected Broken Laser Tracks Leading to Center */}
          <path
            d="M128 142 L128 180 L180 180"
            stroke={AMBER_ALERT}
            strokeWidth={1.6}
            strokeDasharray="5 5"
            fill="none"
            opacity={0.7}
          />
          <path
            d="M364 142 L364 180 L312 180"
            stroke={AMBER_ALERT}
            strokeWidth={1.6}
            strokeDasharray="5 5"
            fill="none"
            opacity={0.7}
          />
          <path
            d="M246 252 L246 220"
            stroke={AMBER_ALERT}
            strokeWidth={1.6}
            strokeDasharray="5 5"
            fill="none"
            opacity={0.7}
          />

          {/* ─── THE DRAMATIC MISSING CORE VOID (Nexus) ─── */}
          <g transform="translate(246, 180)">
            {/* Rotating Radar Perimeter */}
            <circle
              r={46}
              fill="rgba(245, 158, 11, 0.06)"
              stroke={AMBER_ALERT}
              strokeWidth={1.8}
              strokeDasharray="8 8"
              opacity={gapOn * (0.6 + 0.4 * pulse)}
              transform={`rotate(${t * 35})`}
            />

            {/* Glowing Amber Void Box */}
            <rect
              x={-34}
              y={-28}
              width={68}
              height={56}
              rx={8}
              fill="none"
              stroke={AMBER_ALERT}
              strokeWidth={2.4}
              strokeDasharray="6 6"
              style={{ filter: `drop-shadow(0 0 16px ${AMBER_ALERT}aa)` }}
              opacity={gapOn}
            />

            {/* Pulsating Question / Alert Beacon */}
            <text
              y={8}
              textAnchor="middle"
              fill={AMBER_ALERT}
              fontSize={24}
              fontWeight={900}
              opacity={gapOn * pulse}
            >
              ؟
            </text>

            {/* Warning Bracket Tags */}
            <path
              d="M-44 -38 L-44 -44 L-38 -44"
              stroke={AMBER_ALERT}
              strokeWidth={2}
              fill="none"
              opacity={alertPop}
            />
            <path
              d="M44 -38 L44 -44 L38 -44"
              stroke={AMBER_ALERT}
              strokeWidth={2}
              fill="none"
              opacity={alertPop}
            />
            <path
              d="M-44 38 L-44 44 L-38 44"
              stroke={AMBER_ALERT}
              strokeWidth={2}
              fill="none"
              opacity={alertPop}
            />
            <path
              d="M44 38 L44 44 L38 44"
              stroke={AMBER_ALERT}
              strokeWidth={2}
              fill="none"
              opacity={alertPop}
            />
          </g>
        </svg>

        {/* Central Label Callout */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 228,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 800,
            color: AMBER_ALERT,
            opacity: gapOn,
            transform: `translateY(${mix(6, 0, gapOn)}px)`,
            textShadow: `0 0 12px ${AMBER_ALERT}88`,
          }}
        >
          [جای خالی هسته اتصال]
        </div>
      </div>

      {/* ─── Lower Active Telemetry Deck (y: 565 to 890) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 565,
          left: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 20,
        }}
      >
        {/* 3 Telemetry Pods */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'انبارداری', val: 'فعال اما ایزوله', status: 'ok', col: CYAN_BLUEPRINT },
            { label: 'صندوق فروش', val: 'فعال اما مستقل', status: 'ok', col: CYAN_BLUEPRINT },
            { label: 'هسته مرکزی', val: 'مفقود و نامتصل', status: 'warn', col: AMBER_ALERT },
          ].map((pod, i) => (
            <div
              key={pod.label}
              dir="rtl"
              style={{
                background: 'rgba(10, 22, 40, 0.75)',
                border: `1px solid ${pod.col}33`,
                borderRadius: 12,
                padding: '10px 8px',
                textAlign: 'center',
                opacity: clamp(progress(t, 0.3 + i * 0.25, 0.5)),
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, marginBottom: 4 }}>
                {pod.label}
              </div>
              <div style={{ fontSize: 12, fontWeight: 900, color: pod.col }}>{pod.val}</div>
            </div>
          ))}
        </div>

        {/* CAD Diagnostic Alert Bar */}
        <div
          dir="rtl"
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: `1.5px solid ${AMBER_ALERT}55`,
            borderRadius: 14,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: clamp(progress(t, 1.8, 0.6)),
            boxShadow: `0 0 20px ${AMBER_ALERT}18`,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${AMBER_ALERT}22`,
              border: `1px solid ${AMBER_ALERT}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: AMBER_ALERT,
              flexShrink: 0,
            }}
          >
            ⚠
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: PAPER_WHITE, marginBottom: 2 }}>
              هشدار معماری: قطعی جریان داده‌ها
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(241, 245, 249, 0.7)' }}>
              کالا در قفسه هست اما صندوق نمی‌داند؛ فاکتور صادر می‌شود اما انبار خبر ندارد!
            </div>
          </div>
        </div>

        {/* Status Radar Scan Bar */}
        <div
          dir="ltr"
          style={{
            background: 'rgba(8, 20, 36, 0.8)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: 12,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: 'rgba(125, 211, 252, 0.8)',
            opacity: clamp(progress(t, 2.5, 0.6)),
          }}
        >
          <span>DIAGNOSTIC: ZERO_INTEGRATION</span>
          <span style={{ color: AMBER_ALERT, fontWeight: 700 }}>CRITICAL_NEED</span>
        </div>
      </div>
    </NeedStage>
  )
}

// ─── Scene 2 · The Fracture: Two Disconnected Islands ─────────────────────────

export function TwoHalvesScene({ t, scene }: { t: number; scene: Scene }) {
  const inA = ease(clamp(progress(t, 0.1, 0.8)))
  const inB = ease(clamp(progress(t, 1.1, 0.8)))
  const fracture = ease(clamp(progress(t, 2.8, 1.4)))
  const alertTremor = popSpring(t, 3.1, 0.5)

  // Islands drift apart on fracture
  const drift = fracture * 32
  const leftX = 24 - drift
  const rightX = 258 + drift

  return (
    <NeedStage scene={scene} t={t} shakes={[3.1]} punches={[0.2, 3.1]}>
      <BlueprintTopbar
        tag="شبکه شعب // اعلام انشقاق سازمانی"
        status="NETWORK_PARTITION // 2_SILOS"
        color={ROSE_FRACTURE}
      />

      <BlueprintSceneHeader
        badge="بحران توسعه بدون زیرساخت"
        title="شعبه دوم که باز شد..."
        subtitle="دو جزیره جداگانه شد؛"
        subtitleAccent="نه یک مغازه هماهنگ و یکپارچه!"
        accentColor={ROSE_FRACTURE}
        t={t}
      />

      {/* ─── Hero Center: Fractured Isometric Islands (y: 180 to 550) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 182,
          left: 24,
          right: 24,
          height: 366,
          background: 'rgba(6, 17, 33, 0.82)',
          border: '1.5px solid rgba(244, 63, 94, 0.3)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 20px 48px rgba(2, 6, 14, 0.8)',
        }}
      >
        <svg
          width={492}
          height={366}
          viewBox="0 0 492 366"
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* Jagged Fracture Abyss in the Center */}
          <path
            d="M246 20 L238 90 L254 160 L236 240 L252 310 L246 346"
            stroke={ROSE_FRACTURE}
            strokeWidth={fracture * 2.5}
            strokeDasharray="8 6"
            fill="none"
            opacity={fracture * 0.9}
            style={{ filter: `drop-shadow(0 0 12px ${ROSE_FRACTURE})` }}
          />

          {/* Island 1: Branch A (Left) */}
          <g transform={`translate(${leftX}, 36)`} opacity={inA}>
            <rect
              width={210}
              height={290}
              rx={14}
              fill="rgba(8, 22, 42, 0.85)"
              stroke={CYAN_BLUEPRINT}
              strokeWidth={1.8}
              strokeDasharray={fracture > 0.5 ? '7 7' : 'none'}
            />
            {/* Header pill */}
            <rect
              x={16}
              y={16}
              width={178}
              height={28}
              rx={6}
              fill="rgba(56, 189, 248, 0.15)"
              stroke={CYAN_BLUEPRINT}
              strokeWidth={1}
            />
            <text
              x={105}
              y={35}
              textAnchor="middle"
              fill={CYAN_LASER}
              fontSize={12}
              fontWeight={800}
            >
              شعبه اول (اصلی)
            </text>
            {/* Shelf & Ledger representation */}
            <rect
              x={20}
              y={60}
              width={170}
              height={48}
              rx={6}
              fill="none"
              stroke={HOLLOW_STROKE}
              strokeWidth={1.2}
            />
            <text
              x={105}
              y={88}
              textAnchor="middle"
              fill={PAPER_WHITE}
              fontSize={11}
              fontWeight={700}
            >
              دفتر فروش مستقل
            </text>
            <rect
              x={20}
              y={124}
              width={170}
              height={70}
              rx={6}
              fill="none"
              stroke={HOLLOW_STROKE}
              strokeWidth={1.2}
            />
            <text
              x={105}
              y={155}
              textAnchor="middle"
              fill={TEXT_MUTED}
              fontSize={10}
              fontWeight={600}
            >
              موجودی ثبت‌شده در مغازه
            </text>
            <text
              x={105}
              y={175}
              textAnchor="middle"
              fill={ROSE_FRACTURE}
              fontSize={10}
              fontWeight={800}
            >
              بی‌خبر از انبار شعبه دو
            </text>
            {/* Status dot */}
            <circle cx={105} cy={240} r={6} fill={CYAN_BLUEPRINT} />
            <text
              x={105}
              y={266}
              textAnchor="middle"
              fill={CYAN_BLUEPRINT}
              fontSize={10}
              fontWeight={700}
            >
              جزیره ۱
            </text>
          </g>

          {/* Island 2: Branch B (Right) */}
          <g transform={`translate(${rightX}, 36)`} opacity={inB}>
            <rect
              width={210}
              height={290}
              rx={14}
              fill="rgba(8, 22, 42, 0.85)"
              stroke={ROSE_FRACTURE}
              strokeWidth={1.8}
              strokeDasharray={fracture > 0.5 ? '7 7' : 'none'}
            />
            <rect
              x={16}
              y={16}
              width={178}
              height={28}
              rx={6}
              fill="rgba(244, 63, 94, 0.15)"
              stroke={ROSE_FRACTURE}
              strokeWidth={1}
            />
            <text
              x={105}
              y={35}
              textAnchor="middle"
              fill={ROSE_FRACTURE}
              fontSize={12}
              fontWeight={800}
            >
              شعبه دوم (تازه تاسیس)
            </text>
            <rect
              x={20}
              y={60}
              width={170}
              height={48}
              rx={6}
              fill="none"
              stroke="rgba(244, 63, 94, 0.4)"
              strokeWidth={1.2}
            />
            <text
              x={105}
              y={88}
              textAnchor="middle"
              fill={PAPER_WHITE}
              fontSize={11}
              fontWeight={700}
            >
              دفتر کاغذی دوم
            </text>
            <rect
              x={20}
              y={124}
              width={170}
              height={70}
              rx={6}
              fill="none"
              stroke="rgba(244, 63, 94, 0.4)"
              strokeWidth={1.2}
            />
            <text
              x={105}
              y={155}
              textAnchor="middle"
              fill={TEXT_MUTED}
              fontSize={10}
              fontWeight={600}
            >
              حساب نسیه مشتریان
            </text>
            <text
              x={105}
              y={175}
              textAnchor="middle"
              fill={ROSE_FRACTURE}
              fontSize={10}
              fontWeight={800}
            >
              سوابق خرید نامشخص
            </text>
            <circle cx={105} cy={240} r={6} fill={ROSE_FRACTURE} />
            <text
              x={105}
              y={266}
              textAnchor="middle"
              fill={ROSE_FRACTURE}
              fontSize={10}
              fontWeight={700}
            >
              جزیره ۲
            </text>
          </g>

          {/* Broken Severed Connection Beam */}
          <path
            d="M190 183 L246 183"
            stroke={ROSE_FRACTURE}
            strokeWidth={2.4}
            strokeDasharray="6 6"
            opacity={fracture * 0.85}
          />
          <path
            d="M246 183 L302 183"
            stroke={ROSE_FRACTURE}
            strokeWidth={2.4}
            strokeDasharray="6 6"
            opacity={fracture * 0.85}
          />
          <circle cx={246} cy={183} r={12} fill={ROSE_FRACTURE} opacity={fracture * alertTremor} />
          <text
            x={246}
            y={188}
            textAnchor="middle"
            fill="#fff"
            fontSize={14}
            fontWeight={900}
            opacity={fracture}
          >
            ✕
          </text>
        </svg>

        {/* Floating Disconnect Badge */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            bottom: 16,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            opacity: fracture,
            transform: `scale(${mix(0.85, 1, fracture)})`,
          }}
        >
          <div
            style={{
              background: 'rgba(244, 63, 94, 0.2)',
              border: `1px solid ${ROSE_FRACTURE}`,
              borderRadius: 999,
              padding: '4px 18px',
              fontSize: 12,
              fontWeight: 800,
              color: ROSE_FRACTURE,
              boxShadow: `0 0 16px ${ROSE_FRACTURE}66`,
            }}
          >
            ارتباط دو شعبه: قطع کامل (Silo)
          </div>
        </div>
      </div>

      {/* ─── Lower Active Telemetry Deck (y: 565 to 890) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 565,
          left: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 20,
        }}
      >
        {/* Comparative Consequence Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <div
            dir="rtl"
            style={{
              background: 'rgba(10, 22, 40, 0.75)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 14,
              padding: '12px 14px',
              opacity: inA,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: CYAN_LASER, marginBottom: 4 }}>
              شعبه اول
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_MUTED }}>
              فروشنده از موجودی قفسه شعبه دو بی‌خبر است و مشتری منتظر را رد می‌کند.
            </div>
          </div>

          <div
            dir="rtl"
            style={{
              background: 'rgba(10, 22, 40, 0.75)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 14,
              padding: '12px 14px',
              opacity: inB,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: ROSE_FRACTURE, marginBottom: 4 }}>
              شعبه دوم
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_MUTED }}>
              سقف نسیه و سابقه حساب مشتریان قدیمی را ندارد و ریسک زیان بالا می‌رود.
            </div>
          </div>
        </div>

        {/* Consequence Alert Banner */}
        <div
          dir="rtl"
          style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: `1.5px solid ${ROSE_FRACTURE}55`,
            borderRadius: 14,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: clamp(progress(t, 2.5, 0.7)),
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${ROSE_FRACTURE}22`,
              border: `1px solid ${ROSE_FRACTURE}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: ROSE_FRACTURE,
              flexShrink: 0,
            }}
          >
            ✕
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: PAPER_WHITE, marginBottom: 2 }}>
              بهای سنگین دوگانگی سیستم
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(241, 245, 249, 0.7)' }}>
              دو دفتر کاغذی، دو تلفن بی‌جواب برای موجودی، و از دست رفتن کنترل سود روزانه.
            </div>
          </div>
        </div>

        {/* Monospace telemetry tag */}
        <div
          dir="ltr"
          style={{
            background: 'rgba(8, 20, 36, 0.8)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            borderRadius: 12,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: ROSE_FRACTURE,
            opacity: clamp(progress(t, 3.4, 0.5)),
          }}
        >
          <span>SILO_DESYNC: 100% UNTRACKED</span>
          <span style={{ color: PAPER_WHITE }}>ERP_NEEDED</span>
        </div>
      </div>
    </NeedStage>
  )
}

// ─── Scene 3 · The Customer Leaves Unrecorded ─────────────────────────────────

export function CustomerLeavesScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.7))
  const walk = ease(clamp(progress(t, 0.8, 3.2)))
  const lock = popSpring(t, 2.7, 0.5)

  // Customer walks from counter (x: 230) towards exit door (x: 430)
  const custX = mix(210, 420, walk)
  const custOpacity = 1 - ease(clamp(progress(t, 3.4, 1.2)))

  return (
    <NeedStage scene={scene} t={t} shakes={[2.7]} punches={[0.15, 2.7]}>
      <BlueprintTopbar
        tag="سفر مشتری // تحلیل ریزش خاموش"
        status="UNRECORDED_EXIT // CRM_VOID"
        color={ROSE_FRACTURE}
      />

      <BlueprintSceneHeader
        badge="نقطه کور فروشگاه"
        title="مشتری رفت و هیچ‌کس نفهمید چرا!"
        subtitle="کسی علت را نپرسید، جایی ثبت نشد"
        subtitleAccent="و هیچ سرنخی برای بازگشت باقی نماند."
        accentColor={ROSE_FRACTURE}
        t={t}
      />

      {/* ─── Hero Center: Store Corridor & Departure (y: 180 to 550) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 182,
          left: 24,
          right: 24,
          height: 366,
          background: 'rgba(6, 17, 33, 0.82)',
          border: '1.5px solid rgba(244, 63, 94, 0.3)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 20px 48px rgba(2, 6, 14, 0.8)',
        }}
      >
        <svg
          width={492}
          height={366}
          viewBox="0 0 492 366"
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* Floor Pathway Grid */}
          <line
            x1={40}
            y1={250}
            x2={452}
            y2={250}
            stroke={HOLLOW_STROKE}
            strokeWidth={1.5}
            strokeDasharray="6 6"
          />
          <line
            x1={40}
            y1={290}
            x2={452}
            y2={290}
            stroke={HOLLOW_STROKE}
            strokeWidth={1.5}
            strokeDasharray="6 6"
          />

          {/* Left: Sales Counter */}
          <g opacity={enter} transform="translate(40, 110)">
            <rect
              width={130}
              height={170}
              rx={12}
              fill="rgba(8, 22, 42, 0.85)"
              stroke={CYAN_BLUEPRINT}
              strokeWidth={1.6}
            />
            <rect x={14} y={20} width={102} height={26} rx={6} fill="rgba(56, 189, 248, 0.15)" />
            <text
              x={65}
              y={37}
              textAnchor="middle"
              fill={CYAN_LASER}
              fontSize={11}
              fontWeight={800}
            >
              پیشخوان مغازه
            </text>
            <circle cx={65} cy={95} r={22} fill="none" stroke={HOLLOW_STROKE} strokeWidth={1.5} />
            <text
              x={65}
              y={150}
              textAnchor="middle"
              fill={TEXT_MUTED}
              fontSize={10}
              fontWeight={600}
            >
              بدون سیستم CRM
            </text>
          </g>

          {/* Dissolving Footstep Track */}
          <path
            d="M170 210 L390 210"
            stroke={ROSE_FRACTURE}
            strokeWidth={2}
            strokeDasharray="4 8"
            opacity={(1 - walk) * 0.7}
          />

          {/* Right: Exit Threshold & Reticle Lock */}
          <g transform="translate(380, 80)">
            <rect
              width={76}
              height={200}
              rx={10}
              fill="rgba(244, 63, 94, 0.08)"
              stroke={ROSE_FRACTURE}
              strokeWidth={1.8}
              strokeDasharray="8 8"
            />
            <text
              x={38}
              y={30}
              textAnchor="middle"
              fill={ROSE_FRACTURE}
              fontSize={11}
              fontWeight={800}
            >
              خروجی
            </text>

            {/* Radar Target Lock Reticle (fires at 2.7s) */}
            <g transform="translate(38, 120)" opacity={lock}>
              <circle
                r={28}
                fill="none"
                stroke={ROSE_FRACTURE}
                strokeWidth={2}
                strokeDasharray="6 4"
              />
              <line x1={-34} y1={0} x2={34} y2={0} stroke={ROSE_FRACTURE} strokeWidth={1.5} />
              <line x1={0} y1={-34} x2={0} y2={34} stroke={ROSE_FRACTURE} strokeWidth={1.5} />
              <circle r={6} fill={ROSE_FRACTURE} opacity={0.8} />
            </g>
          </g>

          {/* ─── Stylized Holographic Customer Avatar ─── */}
          <g
            transform={`translate(${custX}, 130)`}
            opacity={custOpacity}
            style={{ filter: `drop-shadow(0 0 14px ${CYAN_LASER}88)` }}
          >
            {/* Ambient Base Shadow */}
            <ellipse cx={0} cy={124} rx={22} ry={6} fill="rgba(56, 189, 248, 0.25)" />

            {/* Persona Head */}
            <circle
              cx={0}
              cy={20}
              r={18}
              fill="rgba(8, 24, 44, 0.9)"
              stroke={CYAN_LASER}
              strokeWidth={2.2}
            />
            <circle cx={0} cy={20} r={6} fill={CYAN_LASER} />

            {/* Persona Body Silhouette */}
            <path
              d="M-22 96 Q0 48 22 96 L22 118 L-22 118 Z"
              fill="rgba(8, 24, 44, 0.9)"
              stroke={CYAN_LASER}
              strokeWidth={2.2}
              strokeLinejoin="round"
            />

            {/* Walking Indicator Wave */}
            <circle
              r={34}
              cx={0}
              cy={60}
              fill="none"
              stroke={ROSE_FRACTURE}
              strokeWidth={1.5}
              strokeDasharray="4 6"
              opacity={0.6}
            />
          </g>
        </svg>

        {/* Reticle Lock Question Box */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            bottom: 24,
            left: 24,
            right: 24,
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 800,
            color: ROSE_FRACTURE,
            opacity: lock,
            transform: `scale(${mix(0.9, 1, lock)})`,
            textShadow: `0 0 14px ${ROSE_FRACTURE}88`,
          }}
        >
          [خروج ثبت‌نشده — علت نامعلوم]
        </div>
      </div>

      {/* ─── Lower Active Telemetry Deck (y: 565 to 890) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 565,
          left: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 20,
        }}
      >
        {/* 3 Lost Record Nodes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'کالای درخواستی', val: 'ثبت‌نشده' },
            { label: 'علت عدم خرید', val: 'نامشخص' },
            { label: 'فرصت پیگیری', val: 'سوخت‌شده' },
          ].map((item, i) => (
            <div
              key={item.label}
              dir="rtl"
              style={{
                background: 'rgba(10, 22, 40, 0.75)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: 12,
                padding: '10px 8px',
                textAlign: 'center',
                opacity: clamp(progress(t, 1.2 + i * 0.3, 0.5)),
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, marginBottom: 4 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 12, fontWeight: 900, color: ROSE_FRACTURE }}>{item.val}</div>
            </div>
          ))}
        </div>

        {/* Blindspot Explanation Panel */}
        <div
          dir="rtl"
          style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: `1.5px solid ${ROSE_FRACTURE}55`,
            borderRadius: 14,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: clamp(progress(t, 2.2, 0.7)),
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${ROSE_FRACTURE}22`,
              border: `1px solid ${ROSE_FRACTURE}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: ROSE_FRACTURE,
              flexShrink: 0,
            }}
          >
            ؟
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: PAPER_WHITE, marginBottom: 2 }}>
              بزرگ‌ترین ضرر پنهان کسب‌وکار
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(241, 245, 249, 0.7)' }}>
              مشتری آمد، پیدا نکرد، رفت؛ و مدیر هرگز نمی‌فهمد چه کالایی را باید شارژ می‌کرد!
            </div>
          </div>
        </div>

        {/* Monospace Reticle Telemetry */}
        <div
          dir="ltr"
          style={{
            background: 'rgba(8, 20, 36, 0.8)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            borderRadius: 12,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: ROSE_FRACTURE,
            opacity: clamp(progress(t, 3.2, 0.5)),
          }}
        >
          <span>AUDIT_RESULT: RECORD_VOID</span>
          <span style={{ color: PAPER_WHITE }}>CRM_REQUIRED</span>
        </div>
      </div>
    </NeedStage>
  )
}

// ─── Scene 4 · Built Solid: The Hisabche Unified Blueprint ───────────────────

export function BuiltSolidScene({ t, scene }: { t: number; scene: Scene }) {
  const laserWave = clamp(progress(t, 0.1, 1.6))
  const solidShell = ease(clamp(progress(t, 0.3, 1.4)))
  const shelves = clamp(progress(t, 1.2, 0.7))
  const counter = clamp(progress(t, 1.8, 0.7))
  const coreLock = popSpring(t, 2.65, 0.6)
  const settled = clamp(progress(t, 3.5, 0.7))
  const glow = 0.5 + 0.5 * Math.sin(t * 3.5)

  return (
    <NeedStage scene={scene} t={t} shakes={[2.65]} punches={[0.15, 2.65]}>
      <BlueprintTopbar
        tag="زیرساخت یکپارچه // هسته حسابچه"
        status="SOLID_CORE // FULLY_INTEGRATED"
        color={EMERALD_MINT}
      />

      <BlueprintSceneHeader
        badge="معماری استوار حسابچه"
        title="حسابچه همان نقشه را می‌سازد!"
        subtitle="یک سطح محکم، یک دفتر جامع،"
        subtitleAccent="و یک جای مشخص برای هر رکن کسب‌وکار."
        accentColor={EMERALD_MINT}
        t={t}
      />

      {/* ─── Hero Center: Solid Unified Platform (y: 180 to 550) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 182,
          left: 24,
          right: 24,
          height: 366,
          background: 'linear-gradient(145deg, rgba(8, 28, 48, 0.9), rgba(4, 14, 26, 0.95))',
          border: '1.5px solid rgba(16, 185, 129, 0.45)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 20px 48px rgba(2, 6, 14, 0.8), 0 0 32px rgba(16, 185, 129, 0.15)',
        }}
      >
        <svg
          width={492}
          height={366}
          viewBox="0 0 492 366"
          style={{ position: 'absolute', inset: 0 }}
        >
          <defs>
            <linearGradient id="solidDeckGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(16, 185, 129, 0.2)" />
              <stop offset="50%" stopColor="rgba(8, 24, 44, 0.85)" />
              <stop offset="100%" stopColor="rgba(4, 12, 22, 0.95)" />
            </linearGradient>
            <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={EMERALD_MINT} stopOpacity={0.5} />
              <stop offset="100%" stopColor="transparent" stopOpacity={0} />
            </radialGradient>
          </defs>

          {/* Sintering Laser Line Traversing Vertically */}
          <line
            x1={0}
            y1={laserWave * 366}
            x2={492}
            y2={laserWave * 366}
            stroke={EMERALD_MINT}
            strokeWidth={3}
            opacity={laserWave < 1 ? 0.9 : 0}
            style={{ filter: `drop-shadow(0 0 16px ${EMERALD_MINT})` }}
          />

          {/* Monolithic Solid Slab */}
          <rect
            x={24}
            y={24}
            width={444}
            height={318}
            rx={16}
            fill="url(#solidDeckGrad)"
            stroke={EMERALD_MINT}
            strokeWidth={2}
            opacity={solidShell}
          />

          {/* Solid Synchronized Warehouse Rack (Top-Right) */}
          <g opacity={shelves} transform="translate(276, 46)">
            <rect
              width={172}
              height={96}
              rx={12}
              fill="rgba(16, 185, 129, 0.12)"
              stroke={EMERALD_MINT}
              strokeWidth={1.6}
            />
            <rect x={14} y={16} width={42} height={28} rx={6} fill="rgba(16, 185, 129, 0.25)" />
            <rect x={66} y={16} width={42} height={28} rx={6} fill="rgba(16, 185, 129, 0.25)" />
            <rect x={118} y={16} width={42} height={28} rx={6} fill="rgba(16, 185, 129, 0.25)" />
            <text
              x={86}
              y={72}
              textAnchor="middle"
              fill={PAPER_WHITE}
              fontSize={12}
              fontWeight={800}
            >
              انبار هوشمند متصل
            </text>
            <circle cx={146} cy={20} r={4} fill={EMERALD_MINT} />
          </g>

          {/* Solid Connected Cash & POS (Top-Left) */}
          <g opacity={shelves} transform="translate(44, 46)">
            <rect
              width={172}
              height={96}
              rx={12}
              fill="rgba(16, 185, 129, 0.12)"
              stroke={EMERALD_MINT}
              strokeWidth={1.6}
            />
            <rect x={20} y={16} width={70} height={34} rx={6} fill="rgba(16, 185, 129, 0.25)" />
            <circle
              cx={130}
              cy={33}
              r={16}
              fill="rgba(16, 185, 129, 0.2)"
              stroke={EMERALD_MINT}
              strokeWidth={1.4}
            />
            <text
              x={86}
              y={72}
              textAnchor="middle"
              fill={PAPER_WHITE}
              fontSize={12}
              fontWeight={800}
            >
              صندوق و فاکتور آنلاین
            </text>
            <circle cx={146} cy={20} r={4} fill={EMERALD_MINT} />
          </g>

          {/* Solid General Ledger Slab (Bottom) */}
          <g opacity={counter} transform="translate(44, 252)">
            <rect
              width={404}
              height={70}
              rx={12}
              fill="rgba(16, 185, 129, 0.14)"
              stroke={EMERALD_MINT}
              strokeWidth={1.6}
            />
            <text
              x={202}
              y={42}
              textAnchor="middle"
              fill={PAPER_WHITE}
              fontSize={13}
              fontWeight={800}
            >
              دفتر مالی، تراز لحظه‌ای و مدیریت مشتریان
            </text>
          </g>

          {/* High-Speed Solid Fiber Conduits */}
          <path
            d="M130 142 L130 180 L180 180"
            stroke={EMERALD_MINT}
            strokeWidth={2.4}
            fill="none"
            opacity={solidShell}
          />
          <path
            d="M362 142 L362 180 L312 180"
            stroke={EMERALD_MINT}
            strokeWidth={2.4}
            fill="none"
            opacity={solidShell}
          />
          <path
            d="M246 252 L246 226"
            stroke={EMERALD_MINT}
            strokeWidth={2.4}
            fill="none"
            opacity={solidShell}
          />

          {/* ─── SOLID CENTRAL CORE ACTIVATED ─── */}
          <g transform="translate(246, 180)">
            {/* Ambient Radial Core Light */}
            <circle r={64} fill="url(#coreGlow)" opacity={coreLock * (0.6 + 0.4 * glow)} />

            {/* Locked Solid Core Box */}
            <rect
              x={-42}
              y={-34}
              width={84}
              height={68}
              rx={12}
              fill="rgba(16, 185, 129, 0.25)"
              stroke={EMERALD_MINT}
              strokeWidth={2.6}
              style={{ filter: `drop-shadow(0 0 24px ${EMERALD_MINT})` }}
              opacity={coreLock}
              transform={`scale(${mix(0.6, 1, coreLock)})`}
            />

            {/* Checkmark in Center */}
            <path
              d="M-14 2 L-4 12 L16 -8"
              stroke={PAPER_WHITE}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={coreLock}
            />

            {/* Core Label */}
            <text
              y={48}
              textAnchor="middle"
              fill={EMERALD_MINT}
              fontSize={11}
              fontWeight={900}
              opacity={coreLock}
            >
              هسته یکپارچه فعال شد
            </text>
          </g>
        </svg>
      </div>

      {/* ─── Lower Active Telemetry Deck (y: 565 to 890) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 565,
          left: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 20,
        }}
      >
        {/* 3 Unified Architectural Pillars */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { title: 'یک سطح واحد', sub: 'بدون جزیره‌های جدا' },
            { title: 'یک دفتر جامع', sub: 'پایان چنددفتره بودن' },
            { title: 'جای مشخص', sub: 'برای انبار، صندوق، طلب' },
          ].map((pill, i) => (
            <div
              key={pill.title}
              dir="rtl"
              style={{
                background: 'rgba(10, 24, 42, 0.8)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: 12,
                padding: '10px 8px',
                textAlign: 'center',
                opacity: clamp(progress(t, 1.5 + i * 0.3, 0.5)),
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: EMERALD_MINT, marginBottom: 3 }}>
                {pill.title}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: TEXT_MUTED }}>{pill.sub}</div>
            </div>
          ))}
        </div>

        {/* Unified System Foundation Banner */}
        <div
          dir="rtl"
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: `1.5px solid ${EMERALD_MINT}55`,
            borderRadius: 14,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: settled,
            boxShadow: `0 0 24px rgba(16, 185, 129, 0.15)`,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${EMERALD_MINT}25`,
              border: `1px solid ${EMERALD_MINT}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: EMERALD_MINT,
              flexShrink: 0,
            }}
          >
            ✓
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: PAPER_WHITE, marginBottom: 2 }}>
              نقشه کامل کسب‌وکار محقق شد
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(241, 245, 249, 0.75)' }}>
              تمامی شعب، انبارها، و فاکتورها روی یک زیرساخت هماهنگ و بدون دوباره‌کاری متصل شدند.
            </div>
          </div>
        </div>

        {/* Monospace System Coherence */}
        <div
          dir="ltr"
          style={{
            background: 'rgba(8, 20, 36, 0.8)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 12,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: EMERALD_MINT,
            opacity: settled,
          }}
        >
          <span>ARCHITECTURE: SOLID_UNIFIED</span>
          <span style={{ color: PAPER_WHITE }}>100%_SYNCHRONIZED</span>
        </div>
      </div>
    </NeedStage>
  )
}

// ─── Scene 5 · One Continuous Line: The Unified Nervous System ────────────────

const STATIONS = [
  { x: 100, y: 84, label: 'انبار کالا', sub: 'کسر آنی موجودی', at: 0.85 },
  { x: 392, y: 140, label: 'صندوق فروش', sub: 'صدور خودکار فاکتور', at: 1.55 },
  { x: 100, y: 228, label: 'طلب و نسیه', sub: 'ثبت در پرونده مشتری', at: 2.25 },
  { x: 392, y: 284, label: 'دفتر کل', sub: 'به‌روزرسانی تراز', at: 2.95 },
] as const

export function OneLineScene({ t, scene }: { t: number; scene: Scene }) {
  const lineDraw = ease(clamp(progress(t, 0.2, 2.8)))
  const close = clamp(progress(t, 3.6, 0.8))

  return (
    <NeedStage scene={scene} t={t} shakes={[2.95]} punches={[0.1, 1.55, 2.95]}>
      <BlueprintTopbar
        tag="شاهراه ارتباطی // یک خط سیر مستقیم"
        status="DATA_CONDUIT // 4_NODES_IN_LINE"
        color={CYAN_BLUEPRINT}
      />

      <BlueprintSceneHeader
        badge="اتوماسیون بدون اصطکاک"
        title="از یک مسیر حرف می‌زنند..."
        subtitle="انبار، صندوق، طلب و دفتر کل"
        subtitleAccent="در یک جریان زنده، نه چهار دفتر جدا!"
        accentColor={CYAN_LASER}
        t={t}
      />

      {/* ─── Hero Center: S-Curve Conduit & 4 Nodes (y: 180 to 550) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 182,
          left: 24,
          right: 24,
          height: 366,
          background: 'rgba(6, 17, 33, 0.82)',
          border: '1.5px solid rgba(56, 189, 248, 0.35)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 20px 48px rgba(2, 6, 14, 0.8)',
        }}
      >
        <svg
          width={492}
          height={366}
          viewBox="0 0 492 366"
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* S-Curved High-Speed Optical Conduit */}
          <path
            d="M100 84 C260 84, 230 140, 392 140 C230 140, 260 228, 100 228 C260 228, 230 284, 392 284"
            fill="none"
            stroke="rgba(56, 189, 248, 0.2)"
            strokeWidth={8}
            strokeLinecap="round"
          />

          <path
            d="M100 84 C260 84, 230 140, 392 140 C230 140, 260 228, 100 228 C260 228, 230 284, 392 284"
            fill="none"
            stroke={CYAN_LASER}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeDasharray="900"
            strokeDashoffset={900 * (1 - lineDraw)}
            style={{ filter: `drop-shadow(0 0 16px ${CYAN_LASER})` }}
          />

          {/* 4 Connected Holographic Stations */}
          {STATIONS.map((st, i) => {
            const on = clamp(progress(t, st.at, 0.45))
            const s = popSpring(t, st.at, 0.5)
            const isLast = i === 3
            const col = isLast ? EMERALD_MINT : CYAN_BLUEPRINT

            return (
              <g key={st.label} opacity={on} transform={`translate(${st.x}, ${st.y})`}>
                {/* Station Node Badge */}
                <circle
                  r={32}
                  fill="rgba(8, 22, 42, 0.95)"
                  stroke={col}
                  strokeWidth={2.4}
                  style={{ filter: `drop-shadow(0 0 18px ${col}88)` }}
                  transform={`scale(${mix(0.7, 1, s)})`}
                />
                <circle r={10} fill={col} opacity={0.9} />
                <path
                  d="M-4 0 L-1 3 L5 -3"
                  stroke="#fff"
                  strokeWidth={2}
                  strokeLinecap="round"
                  fill="none"
                />

                {/* Node Text Callout */}
                <text
                  x={i % 2 === 0 ? 46 : -46}
                  y={-4}
                  textAnchor={i % 2 === 0 ? 'start' : 'end'}
                  fill={PAPER_WHITE}
                  fontSize={13}
                  fontWeight={800}
                >
                  {st.label}
                </text>
                <text
                  x={i % 2 === 0 ? 46 : -46}
                  y={14}
                  textAnchor={i % 2 === 0 ? 'start' : 'end'}
                  fill={TEXT_MUTED}
                  fontSize={10}
                  fontWeight={600}
                >
                  {st.sub}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Stream Synchronized Tag */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            bottom: 12,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 800,
            color: EMERALD_MINT,
            opacity: close,
          }}
        >
          [یک خط مستقیم — پایان جزیره‌کاری و دوباره‌کاری]
        </div>
      </div>

      {/* ─── Lower Active Telemetry Deck (y: 565 to 890) ─── */}
      <div
        style={{
          position: 'absolute',
          top: 565,
          left: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 20,
        }}
      >
        {/* Real-Time Chain Status Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'انتقال اطلاعات', val: 'آنی و پیوسته' },
            { label: 'خطای انسانی', val: 'حذف کامل' },
            { label: 'تراز روزانه', val: 'لحظه‌ای آماده' },
          ].map((m, i) => (
            <div
              key={m.label}
              dir="rtl"
              style={{
                background: 'rgba(10, 24, 42, 0.8)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: 12,
                padding: '10px 8px',
                textAlign: 'center',
                opacity: clamp(progress(t, 1.2 + i * 0.4, 0.5)),
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, marginBottom: 3 }}>
                {m.label}
              </div>
              <div style={{ fontSize: 12, fontWeight: 900, color: CYAN_LASER }}>{m.val}</div>
            </div>
          ))}
        </div>

        {/* Narrative Flow Explanation Panel */}
        <div
          dir="rtl"
          style={{
            background: 'rgba(56, 189, 248, 0.1)',
            border: `1.5px solid ${CYAN_BLUEPRINT}55`,
            borderRadius: 14,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: close,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(56, 189, 248, 0.2)',
              border: `1px solid ${CYAN_BLUEPRINT}66`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: CYAN_LASER,
              flexShrink: 0,
            }}
          >
            ↔
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: PAPER_WHITE, marginBottom: 2 }}>
              یک ثبت، چهار اثر همزمان
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(241, 245, 249, 0.75)' }}>
              با ثبت فاکتور: موجودی انبار کم می‌شود، حساب طلبکار ثبت می‌گردد و تراز مالی شکل
              می‌گیرد.
            </div>
          </div>
        </div>

        {/* Monospace Protocol Banner */}
        <div
          dir="ltr"
          style={{
            background: 'rgba(8, 20, 36, 0.8)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 12,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: CYAN_LASER,
            opacity: close,
          }}
        >
          <span>PIPELINE: SINGLE_THREAD_SYNC</span>
          <span style={{ color: EMERALD_MINT }}>ACTIVE</span>
        </div>
      </div>
    </NeedStage>
  )
}

// ─── Scene 6 · Climax CTA: The Solution for Your Business ────────────────────

export function NeedCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const ring = ease(clamp(progress(t, 0.1, 1.2)))
  const logoPop = popSpring(t, 0.6, 0.6)
  const ctaPop = popSpring(t, 2.2, 0.5)
  const shimmer = (t * 220) % 500

  return (
    <NeedStage scene={scene} t={t} shakes={[2.2]} punches={[0.15, 2.2, 3.0]}>
      <BlueprintTopbar
        tag="سامانه جامع کسب‌وکار // HISABCHE ERP"
        status="BLUEPRINT_RESOLVED // VIP_PASS"
        color={EMERALD_MINT}
      />

      {/* ─── Hero Center: Tech Prism & Hisabche Brand (y: 130 to 560) ─── */}
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
        {/* Holographic Concentric Tech Rings */}
        <div style={{ position: 'relative', width: 220, height: 220, marginBottom: 16 }}>
          <svg
            width={220}
            height={220}
            viewBox="0 0 220 220"
            style={{ position: 'absolute', inset: 0 }}
          >
            {/* Outer Gyro Ring */}
            <circle
              cx={110}
              cy={110}
              r={96}
              fill="none"
              stroke={CYAN_BLUEPRINT}
              strokeWidth={2}
              strokeDasharray="603"
              strokeDashoffset={603 * (1 - ring)}
              transform={`rotate(${t * 30} 110 110)`}
              opacity={0.7}
              style={{ filter: `drop-shadow(0 0 16px ${CYAN_BLUEPRINT})` }}
            />
            {/* Inner Counter-Rotating Ring */}
            <circle
              cx={110}
              cy={110}
              r={76}
              fill="none"
              stroke={EMERALD_MINT}
              strokeWidth={2}
              strokeDasharray="477"
              strokeDashoffset={477 * (1 - ring)}
              transform={`rotate(${-t * 45} 110 110)`}
              opacity={0.8}
              style={{ filter: `drop-shadow(0 0 16px ${EMERALD_MINT})` }}
            />
          </svg>

          {/* Central 3D Obsidian Prism Emblem */}
          <div
            style={{
              position: 'absolute',
              inset: 36,
              borderRadius: 24,
              background: 'linear-gradient(135deg, rgba(8, 28, 48, 0.95), rgba(4, 14, 26, 0.98))',
              border: `2px solid ${EMERALD_MINT}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 16px 40px rgba(0,0,0,0.8), 0 0 32px ${EMERALD_MINT}66`,
              transform: `scale(${mix(0.6, 1, logoPop)})`,
            }}
          >
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                color: EMERALD_MINT,
                textShadow: `0 0 20px ${EMERALD_MINT}`,
              }}
            >
              H
            </div>
          </div>
        </div>

        {/* Brand Name Typography */}
        <div
          dir="rtl"
          style={{
            fontSize: 44,
            fontWeight: 900,
            letterSpacing: '-0.02em',
            background: `linear-gradient(135deg, ${PAPER_WHITE}, ${CYAN_LASER})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: 6,
            textShadow: '0 4px 24px rgba(56, 189, 248, 0.3)',
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
            color: EMERALD_MINT,
            marginBottom: 16,
          }}
        >
          همان چیزی که مغازه‌ات کم دارد
        </div>

        {/* VIP Pass Feature Matrix */}
        <div
          dir="rtl"
          style={{
            background: 'rgba(8, 22, 42, 0.75)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 14,
            padding: '8px 20px',
            fontSize: 12,
            fontWeight: 700,
            color: TEXT_MUTED,
            display: 'flex',
            gap: 12,
          }}
        >
          <span>اتصال شعب</span>
          <span>●</span>
          <span>انبار هوشمند</span>
          <span>●</span>
          <span>صندوق مکانیزه</span>
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
        {/* Full-Width Pulsating CTA Button with Shimmer Sweep */}
        <div
          dir="rtl"
          style={{
            position: 'relative',
            width: '100%',
            overflow: 'hidden',
            background: `linear-gradient(135deg, ${CYAN_BLUEPRINT}, ${EMERALD_MINT})`,
            borderRadius: 16,
            padding: '16px 24px',
            textAlign: 'center',
            fontSize: 22,
            fontWeight: 900,
            color: '#030d17',
            boxShadow: `0 16px 48px rgba(0,0,0,0.8), 0 0 45px rgba(16, 185, 129, 0.45)`,
            transform: `scale(${mix(0.9, 1, ctaPop)})`,
            cursor: 'pointer',
          }}
        >
          {/* Shimmer Light Sweep */}
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

        {/* Domain URL with Monospace Tracking */}
        <div
          dir="ltr"
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: '0.22em',
            color: CYAN_LASER,
            textShadow: `0 0 14px ${CYAN_LASER}aa`,
          }}
        >
          hisabche.com
        </div>

        {/* Trust Badges */}
        <div
          dir="rtl"
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            fontSize: 12,
            fontWeight: 700,
            color: TEXT_MUTED,
          }}
        >
          <span>✓ بدون نیاز به نصب پیچیده</span>
          <span>✓ شروع در ۲ دقیقه</span>
        </div>
      </div>
    </NeedStage>
  )
}
