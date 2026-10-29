// ============================================
// Isometric Neon Diorama (reel 86) — «شبکه‌ی حسابچه»
//
// High-craft SaaS Motion Film: Distributed Multi-Branch Synchronization.
// Metaphor: Autonomous AS/RS Logistics Matrix & Multi-Branch Isometric Telemetry Grid.
//
// Scene 1 (0–5s): Unsynchronized Lone Stations & Telemetry Isolation
// Scene 2 (5–12s): Tangled Data Routing & Manual Disconnect Overhead
// Scene 3 (12–20s): Central Hisabche Hexagonal Quantum Hub Snaps Vector Lines
// Scene 4 (20–30s): Holographic Enterprise KPIs & Real-Time Metrics
// Scene 5 (30–38s): Multi-Branch Distributed Network Star Topography
// Scene 6 (38–45s): Brand Hexagonal Climax & High-Conversion Action Hub
//
// Persistent arithmetic (via faNumber only — layout-defect-laws band 6):
//   ۱۲٬۸۵۰٬۰۰۰ فروش − بهای تمام‌شده = سود ۲۴٪ · موجودی ۳۴۸
// ============================================

import type { CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, mix, progress, spring, deterministicHash } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

// ─── Design Tokens ───────────────────────────────────────────────────────────

export const VOID = '#04060f'
export const NEON_GREEN = '#00ff9f'
export const NEON_BLUE = '#00d2ff'
export const NEON_PINK = '#ff3b81'
export const WIRE = '#6366f1'
export const ALERT_CRIMSON = '#f87171'
export const ISO_MUTED = 'rgba(238,242,255,0.7)'

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
  const mm = Math.floor(frames / (30 * 60)) % 60
  const ff = frames % 30
  return (
    <span style={MONO}>
      {pad2(mm)}:{pad2(ss)}:{pad2(ff)}
    </span>
  )
}

function pop(t: number, at: number, dur = 0.55): number {
  return spring(clamp(progress(t, at, at + dur)))
}

// ─── Isometric Projection Matrix ──────────────────────────────────────────────

const OX = 270
const OY = 490
const UX = 34 // screen-x per grid-x unit
const UY = 17 // screen-y per grid-x+gy unit
const UZ = 30 // screen-y lift per height unit

/** 2:1 isometric projection of a grid point at height h. */
function iso(gx: number, gy: number, h = 0): { x: number; y: number } {
  return { x: OX + (gx - gy) * UX, y: OY + (gx + gy) * UY - h * UZ }
}

// ─── Stage ───────────────────────────────────────────────────────────────────

export function IsoStage({
  scene,
  t,
  label,
  children,
  orbit = 0,
}: {
  scene: Scene
  t: number
  label: string
  children: React.ReactNode
  orbit?: number
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        direction: 'ltr',
        background: `radial-gradient(120% 80% at 50% 40%, #0a1024 0%, ${VOID} 66%)`,
        overflow: 'hidden',
        color: '#ffffff',
      }}
    >
      {/* Corner Ambient Glows */}
      <div
        style={{
          position: 'absolute',
          top: -160,
          insetInlineStart: -120,
          width: 380,
          height: 380,
          background: `radial-gradient(circle, ${NEON_BLUE}25, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -180,
          insetInlineEnd: -140,
          width: 420,
          height: 420,
          background: `radial-gradient(circle, ${NEON_PINK}22, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Enterprise HUD */}
      <div
        style={{
          ...MONO,
          position: 'absolute',
          top: 24,
          insetInlineStart: 28,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: NEON_BLUE,
          opacity: 0.8,
          zIndex: 50,
        }}
      >
        {label}
      </div>
      <div
        style={{
          ...MONO,
          position: 'absolute',
          top: 24,
          insetInlineEnd: 28,
          fontSize: 13,
          color: '#ffffff',
          opacity: 0.75,
          fontVariantNumeric: 'tabular-nums',
          zIndex: 50,
        }}
      >
        <Timecode t={scene.start + t} />
      </div>

      {/* Orbiting Isometric Space */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `rotate(${orbit.toFixed(3)}deg)`,
          transformOrigin: '50% 48%',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ─── Isometric Floor Grid ─────────────────────────────────────────────────────

const GRID_N = 4

function IsoFloor({ t, at }: { t: number; at: number }) {
  const lines: React.ReactNode[] = []
  const reveal = ease(clamp(progress(t, at, at + 1.0)))
  const extent = Math.round(reveal * GRID_N)

  for (let i = -extent; i <= extent; i++) {
    const a = iso(-GRID_N, i)
    const b = iso(GRID_N, i)
    const c = iso(i, -GRID_N)
    const d = iso(i, GRID_N)
    const bright = 0.12 + 0.16 * (1 - Math.abs(i) / (GRID_N + 1))
    lines.push(
      <line
        key={`a${i}`}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={WIRE}
        strokeWidth={1}
        opacity={bright}
      />,
      <line
        key={`b${i}`}
        x1={c.x}
        y1={c.y}
        x2={d.x}
        y2={d.y}
        stroke={WIRE}
        strokeWidth={1}
        opacity={bright}
      />,
    )
  }

  return (
    <svg
      width={540}
      height={960}
      viewBox="0 0 540 960"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {lines}
    </svg>
  )
}

function facePath(pts: { x: number; y: number }[]): string {
  return `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')} Z`
}

export function IsoBlock({
  t,
  at,
  gx,
  gy,
  w,
  d,
  h,
  color,
  delay = 0,
  label,
}: {
  t: number
  at: number
  gx: number
  gy: number
  w: number
  d: number
  h: number
  color: string
  delay?: number
  label?: string
}) {
  const local = at + delay
  const p = spring(clamp(progress(t, local, local + 0.8)))
  const hh = h * p
  if (p <= 0.001) return null

  const top = [iso(gx, gy, hh), iso(gx + w, gy, hh), iso(gx + w, gy + d, hh), iso(gx, gy + d, hh)]
  const right = [
    iso(gx + w, gy, hh),
    iso(gx + w, gy + d, hh),
    iso(gx + w, gy + d, 0),
    iso(gx + w, gy, 0),
  ]
  const left = [
    iso(gx, gy + d, hh),
    iso(gx + w, gy + d, hh),
    iso(gx + w, gy + d, 0),
    iso(gx, gy + d, 0),
  ]
  const cap = iso(gx + w / 2, gy + d / 2, hh)
  const ground = iso(gx + w / 2, gy + d / 2, 0)

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* Ground Glow */}
      <div
        style={{
          position: 'absolute',
          top: ground.y - 24,
          insetInlineStart: ground.x - 60,
          width: 120,
          height: 48,
          background: `radial-gradient(ellipse, ${color}33, transparent 70%)`,
          opacity: p,
        }}
      />
      <svg
        width={540}
        height={960}
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0 }}
      >
        <path d={facePath(left)} fill={`${color}18`} />
        <path d={facePath(right)} fill={`${color}10`} />
        <path d={facePath(top)} fill={`${color}30`} />
        <path d={facePath(top)} fill="none" stroke={color} strokeWidth={2.2} opacity={0.95} />
        <path d={facePath(left)} fill="none" stroke={color} strokeWidth={1.6} opacity={0.7} />
        <path d={facePath(right)} fill="none" stroke={color} strokeWidth={1.6} opacity={0.5} />
      </svg>
      {/* Station Floating Label Tag */}
      {label && (
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: cap.y - 28,
            left: cap.x,
            transform: 'translateX(-50%)',
            background: 'rgba(6,10,24,0.92)',
            border: `1.5px solid ${color}`,
            borderRadius: 8,
            padding: '3px 10px',
            fontSize: 13,
            fontWeight: 900,
            color,
            boxShadow: `0 0 16px ${color}55`,
            whiteSpace: 'nowrap',
            opacity: clamp(p * 1.5),
            zIndex: 35,
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}

export function NeonLink({
  t,
  at,
  from,
  to,
  color,
  h1 = 0,
  h2 = 0,
  delay = 0,
  bend = 0,
}: {
  t: number
  at: number
  from: [number, number]
  to: [number, number]
  color: string
  h1?: number
  h2?: number
  delay?: number
  bend?: number
}) {
  const local = at + delay
  const draw = ease(clamp(progress(t, local, local + 0.8)))
  if (draw <= 0.001) return null

  const a = iso(from[0], from[1], h1)
  const b = iso(to[0], to[1], h2)
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - bend }
  const d = `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${mid.x.toFixed(1)},${mid.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`

  const u = ((t * 0.55 + deterministicHash(Math.round(from[0] * 7 + to[1]), 13)) % 1) * draw
  const px = (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * mid.x + u * u * b.x
  const py = (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * mid.y + u * u * b.y

  return (
    <svg
      width={540}
      height={960}
      viewBox="0 0 540 960"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <path d={d} fill="none" stroke={color} strokeWidth={2} opacity={0.65} strokeDasharray="6 7" />
      <circle cx={px} cy={py} r={4} fill={color} opacity={0.95} />
      <circle cx={px} cy={py} r={10} fill={`${color}55`} />
    </svg>
  )
}

export function NeonCore({ t, at }: { t: number; at: number }) {
  const p = spring(clamp(progress(t, at, at + 1.0)))
  if (p <= 0.001) return null
  const c = iso(0, 0, 0.9)
  const pulse = 0.5 + 0.5 * Math.sin((t - at) * 2.5)
  const r = 42 * p

  return (
    <div
      style={{
        position: 'absolute',
        top: c.y,
        left: c.x,
        transform: `translate(-50%,-50%) scale(${p.toFixed(3)})`,
        zIndex: 35,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -r * 2.4,
          left: -r * 2.4,
          width: r * 4.8,
          height: r * 4.8,
          background: `radial-gradient(circle, ${NEON_BLUE}44, transparent 66%)`,
        }}
      />
      <svg width={r * 2.6} height={r * 2.6} viewBox="0 0 100 100" style={{ display: 'block' }}>
        <polygon
          points="50,4 92,27 92,73 50,96 8,73 8,27"
          fill={`${NEON_BLUE}24`}
          stroke={NEON_BLUE}
          strokeWidth={3}
        />
        <polygon
          points="50,22 76,37 76,63 50,78 24,63 24,37"
          fill={`${NEON_GREEN}2c`}
          stroke={NEON_GREEN}
          strokeWidth={2}
          opacity={0.6 + pulse * 0.4}
        />
      </svg>
    </div>
  )
}

export function KpiHolo({
  t,
  at,
  gx,
  gy,
  z,
  label,
  to,
  suffix = '',
  color,
  delay = 0,
}: {
  t: number
  at: number
  gx: number
  gy: number
  z: number
  label: string
  to: number
  suffix?: string
  color: string
  delay?: number
}) {
  const local = at + delay
  const p = spring(clamp(progress(t, local, local + 0.8)))
  if (p <= 0.001) return null
  const float = Math.sin((t - local) * 1.2 + gx) * 4
  const pos = iso(gx, gy, z)
  const count = ease(clamp(progress(t, local + 0.3, local + 1.8)))

  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        top: pos.y + float,
        left: pos.x,
        transform: `translate(-50%,-50%) perspective(600px) scale(${mix(0.65, 1, p).toFixed(3)})`,
        opacity: clamp(p * 1.5),
        background: 'linear-gradient(150deg, rgba(14,24,46,0.95), rgba(6,10,20,0.98))',
        border: `1.5px solid ${color}`,
        borderRadius: 16,
        padding: '12px 18px',
        boxShadow: `0 12px 34px rgba(0,0,0,0.7), 0 0 24px ${color}44`,
        minWidth: 140,
        zIndex: 40,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 900, color }}>{label}</div>
      <div
        dir="ltr"
        style={{
          ...MONO,
          fontSize: 26,
          fontWeight: 900,
          color: '#ffffff',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.15,
          marginTop: 4,
        }}
      >
        {faNumber(Math.round(to * count))}
        {suffix}
      </div>
    </div>
  )
}

export function NeonWord({
  t,
  at,
  text,
  x,
  y,
  size = 38,
  color = '#ffffff',
  accent = false,
}: {
  t: number
  at: number
  text: string
  x: number | string
  y: number | string
  size?: number
  color?: string
  accent?: boolean
}) {
  const p = spring(clamp(progress(t, at, at + 0.55)))
  if (p <= 0.001) return null
  const left = typeof x === 'number' ? `${x}px` : x

  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        top: y,
        left,
        transform: `translate(-50%,-50%) scale(${mix(0.5, 1, p).toFixed(3)})`,
        opacity: clamp(p * 1.5),
        fontSize: size,
        fontWeight: 900,
        color: accent ? '#04060f' : color,
        background: accent ? color : 'transparent',
        padding: accent ? '6px 20px' : 0,
        borderRadius: accent ? 14 : 0,
        whiteSpace: 'nowrap',
        boxShadow: accent ? `0 0 24px ${color}` : 'none',
        textShadow: accent ? 'none' : `0 0 16px ${color}88`,
        zIndex: 45,
      }}
    >
      {text}
    </div>
  )
}

// ─── Scene 1 (0–5s): Unsynchronized Lone Stations ─────────────────────────────

export function IsoHookScene({ t, scene }: { t: number; scene: Scene }) {
  const alertP = pop(t, 3.0, 0.6)

  return (
    <IsoStage scene={scene} t={t} label="// 01 — شبکه نامتصل" orbit={Math.sin(t * 0.5) * 0.6}>
      {/* Telemetry Alert Bar */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          insetInlineStart: 44,
          width: 452,
          height: 44,
          borderRadius: 12,
          background: 'rgba(10,16,32,0.92)',
          border: `1.5px solid ${alertP > 0.4 ? ALERT_CRIMSON : 'rgba(0,210,255,0.35)'}`,
          boxShadow: '0 10px 28px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 45,
          opacity: clamp(pop(t, 0.0, 0.6) * 1.5),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: alertP > 0.4 ? ALERT_CRIMSON : NEON_BLUE,
              boxShadow: `0 0 10px ${alertP > 0.4 ? ALERT_CRIMSON : NEON_BLUE}`,
            }}
          />
          <span
            dir="rtl"
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: alertP > 0.4 ? ALERT_CRIMSON : NEON_BLUE,
            }}
          >
            ایستگاه‌های مستقل: عدم تبادل داده
          </span>
        </div>
        <div dir="rtl" style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
          ۴ ایستگاه بدون سینک
        </div>
      </div>

      <IsoFloor t={t} at={0} />

      {/* 3 Isolated Stations */}
      <IsoBlock
        t={t}
        at={0.1}
        gx={-1}
        gy={-1}
        w={2}
        d={2}
        h={1.1}
        color={NEON_BLUE}
        label="پیشخوان فروش"
      />
      <IsoBlock
        t={t}
        at={0.5}
        gx={2.4}
        gy={-1.6}
        w={1.3}
        d={1.3}
        h={0.9}
        color={NEON_PINK}
        label="انبار کالا"
      />
      <IsoBlock
        t={t}
        at={0.8}
        gx={-2.6}
        gy={1.4}
        w={1.3}
        d={1.3}
        h={0.9}
        color={NEON_GREEN}
        label="صندوق نقد"
      />

      <NeonWord t={t} at={0.4} text="چهار ایستگاه،" x="50%" y="126" size={40} color="#ffffff" />
      <NeonWord
        t={t}
        at={2.0}
        text="بدون ارتباط!"
        x="50%"
        y="176"
        size={36}
        color={NEON_PINK}
        accent
      />
    </IsoStage>
  )
}

// ─── Scene 2 (5–12s): Tangled Data Routing & Manual Overhead ──────────────────

export function IsoBuildScene({ t, scene }: { t: number; scene: Scene }) {
  const alertP = pop(t, 4.4, 0.6)

  return (
    <IsoStage
      scene={scene}
      t={t}
      label="// 02 — دوباره‌کاری دستی"
      orbit={mix(0, 2.5, ease(clamp(progress(t, 0, 7))))}
    >
      <IsoFloor t={t} at={0} />
      <IsoBlock
        t={t}
        at={0.1}
        gx={-1}
        gy={-1}
        w={2}
        d={2}
        h={1.1}
        color={NEON_BLUE}
        label="پیشخوان"
      />
      <IsoBlock
        t={t}
        at={0.1}
        gx={2.2}
        gy={-1.8}
        w={1.3}
        d={1.3}
        h={0.9}
        color={NEON_PINK}
        label="انبار"
        delay={0.4}
      />
      <IsoBlock
        t={t}
        at={0.1}
        gx={-2.4}
        gy={1.6}
        w={1.3}
        d={1.3}
        h={0.9}
        color={NEON_GREEN}
        label="صندوق"
        delay={0.8}
      />
      <IsoBlock
        t={t}
        at={0.1}
        gx={1.6}
        gy={2.2}
        w={1.1}
        d={1.1}
        h={0.7}
        color={WIRE}
        label="دفتر مالی"
        delay={1.2}
      />

      {/* Tangled chaotic links crossing */}
      <NeonLink
        t={t}
        at={0.4}
        from={[0, 0]}
        to={[2.8, -1.1]}
        color={NEON_PINK}
        h1={0.6}
        h2={0.5}
        bend={-28}
      />
      <NeonLink
        t={t}
        at={0.8}
        from={[0, 0]}
        to={[-1.7, 2.2]}
        color={NEON_GREEN}
        h1={0.6}
        h2={0.5}
        bend={32}
      />
      <NeonLink
        t={t}
        at={1.2}
        from={[2.8, -1.1]}
        to={[-1.7, 2.2]}
        color={ALERT_CRIMSON}
        h1={0.5}
        h2={0.5}
        bend={-36}
      />

      <NeonWord t={t} at={0.4} text="داده‌ها بین راه" x="50%" y="124" size={38} color="#ffffff" />
      <NeonWord
        t={t}
        at={1.8}
        text="گم می‌شوند."
        x="50%"
        y="174"
        size={34}
        color={ALERT_CRIMSON}
        accent
      />

      {/* Bottom Overhead Alert Banner */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 54,
          insetInlineStart: 44,
          width: 452,
          height: 48,
          borderRadius: 12,
          background: 'rgba(16,12,28,0.92)',
          border: `1.5px solid ${alertP > 0.4 ? ALERT_CRIMSON : 'rgba(255,59,129,0.35)'}`,
          boxShadow: `0 10px 28px rgba(0,0,0,0.6), 0 0 ${alertP * 24}px ${ALERT_CRIMSON}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          zIndex: 45,
          opacity: clamp(pop(t, 2.6, 0.7) * 1.5),
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: ALERT_CRIMSON }} />
        <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
          مغایرت فاکتورها با موجودی انبار: نیاز به کنترل دستی مداوم
        </span>
      </div>
    </IsoStage>
  )
}

// ─── Scene 3 (12–20s): Central Hisabche Quantum Hub Snaps Vector Lines ────────

export function IsoCoreScene({ t, scene }: { t: number; scene: Scene }) {
  const snapP = pop(t, 1.8, 0.6)

  return (
    <IsoStage
      scene={scene}
      t={t}
      label="// 03 — هسته مرکزی"
      orbit={mix(2.5, -1.5, ease(clamp(progress(t, 0, 8))))}
    >
      <IsoFloor t={t} at={0} />
      <IsoBlock t={t} at={0} gx={-1} gy={-1} w={2} d={2} h={1.1} color={NEON_BLUE} />
      <IsoBlock t={t} at={0} gx={2.2} gy={-1.8} w={1.3} d={1.3} h={0.9} color={NEON_PINK} />
      <IsoBlock t={t} at={0} gx={-2.4} gy={1.6} w={1.3} d={1.3} h={0.9} color={NEON_GREEN} />
      <IsoBlock t={t} at={0} gx={1.6} gy={2.2} w={1.1} d={1.1} h={0.7} color={WIRE} />

      <NeonCore t={t} at={0.6} />

      {/* Clean Straight Synchronized Routes Through Hub */}
      <NeonLink t={t} at={1.8} from={[0, 0]} to={[2.8, -1.1]} color={NEON_PINK} h1={0.9} h2={0.5} />
      <NeonLink
        t={t}
        at={2.0}
        from={[0, 0]}
        to={[-1.7, 2.2]}
        color={NEON_GREEN}
        h1={0.9}
        h2={0.5}
      />
      <NeonLink t={t} at={2.2} from={[0, 0]} to={[2.1, 2.7]} color={WIRE} h1={0.9} h2={0.4} />

      {/* Snap Flash Wave */}
      {snapP > 0.05 && (
        <div
          style={{
            position: 'absolute',
            top: iso(0, 0, 0.9).y,
            left: iso(0, 0, 0.9).x,
            width: 140,
            height: 140,
            transform: 'translate(-50%,-50%)',
            borderRadius: '50%',
            border: `3px solid ${NEON_BLUE}`,
            boxShadow: `0 0 50px ${NEON_BLUE}`,
            opacity: clamp(1 - snapP),
            pointerEvents: 'none',
          }}
        />
      )}

      <NeonWord t={t} at={0.6} text="یک هسته،" x="50%" y="124" size={42} color={NEON_BLUE} accent />
      <NeonWord
        t={t}
        at={2.2}
        text="اتصال کامل همه‌چیز."
        x="50%"
        y="174"
        size={32}
        color="#ffffff"
      />
    </IsoStage>
  )
}

// ─── Scene 4 (20–30s): Holographic Enterprise KPIs (Disjoint Geometry) ────────

export function IsoLiveScene({ t, scene }: { t: number; scene: Scene }) {
  return (
    <IsoStage
      scene={scene}
      t={t}
      label="// 04 — تله‌متری زنده"
      orbit={mix(-1.5, 3.5, ease(clamp(progress(t, 0, 10))))}
    >
      <IsoFloor t={t} at={0} />
      <IsoBlock t={t} at={0} gx={-1} gy={-1} w={2} d={2} h={1.1} color={NEON_BLUE} />
      <IsoBlock t={t} at={0} gx={2.2} gy={-1.8} w={1.3} d={1.3} h={0.9} color={NEON_PINK} />
      <IsoBlock t={t} at={0} gx={-2.4} gy={1.6} w={1.3} d={1.3} h={0.9} color={NEON_GREEN} />
      <NeonCore t={t} at={0} />

      <NeonLink t={t} at={0} from={[0, 0]} to={[2.8, -1.1]} color={NEON_PINK} h1={0.9} h2={0.5} />
      <NeonLink t={t} at={0} from={[0, 0]} to={[-1.7, 2.2]} color={NEON_GREEN} h1={0.9} h2={0.5} />

      {/* 3 Holographic KPI Cards (Disjoint coordinates in isometric space) */}
      <KpiHolo
        t={t}
        at={0.5}
        gx={-2.8}
        gy={-2.2}
        z={2.7}
        label="فروش امروز"
        to={12850000}
        color={NEON_GREEN}
      />
      <KpiHolo
        t={t}
        at={2.5}
        gx={3.0}
        gy={-2.0}
        z={2.9}
        label="موجودی انبار"
        to={348}
        suffix=" قلم"
        color={NEON_BLUE}
      />
      <KpiHolo
        t={t}
        at={4.5}
        gx={0.2}
        gy={3.4}
        z={3.2}
        label="حاشیه سود خالص"
        to={24}
        suffix="٪"
        color={NEON_PINK}
      />

      <NeonWord
        t={t}
        at={0.3}
        text="فروش، موجودی، سود؛"
        x="50%"
        y="124"
        size={38}
        color="#ffffff"
      />
      <NeonWord
        t={t}
        at={1.8}
        text="لحظه‌ای و شفاف."
        x="50%"
        y="174"
        size={32}
        color={NEON_GREEN}
        accent
      />
    </IsoStage>
  )
}

// ─── Scene 5 (30–38s): Multi-Branch Distributed Network Star Topography ───────

export function IsoMultiScene({ t, scene }: { t: number; scene: Scene }) {
  const spread = ease(clamp(progress(t, 0.6, 2.8)))
  const rooms = [
    { gx: 0, gy: 0, c: NEON_BLUE, main: true },
    { gx: -4.4, gy: -1.2, c: NEON_GREEN, main: false },
    { gx: 4.2, gy: 1.4, c: NEON_PINK, main: false },
    { gx: -0.6, gy: 4.6, c: WIRE, main: false },
  ]
  const beat = 0.5 + 0.5 * Math.sin(t * 3.2)

  return (
    <IsoStage
      scene={scene}
      t={t}
      label="// 05 — شبکه شعب"
      orbit={mix(3.5, -2.5, ease(clamp(progress(t, 0, 8))))}
    >
      <IsoFloor t={t} at={0} />
      {rooms.map((r, i) => {
        if (!r.main && spread <= 0.02) return null
        const s = r.main ? 1 : spread
        return (
          <div
            key={i}
            style={{ position: 'absolute', inset: 0, opacity: r.main ? 1 : clamp(spread * 1.4) }}
          >
            <IsoBlock t={t} at={0} gx={r.gx} gy={r.gy} w={1.6} d={1.6} h={0.9 * s} color={r.c} />
            {r.main && <NeonCore t={t} at={0} />}
          </div>
        )
      })}

      {/* Sync Pulses between Hub and Branches */}
      {rooms.slice(1).map((r, i) => (
        <div
          key={`l${i}`}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: clamp(spread * 1.2) * (0.5 + beat * 0.5),
          }}
        >
          <NeonLink
            t={t}
            at={0}
            from={[0, 0]}
            to={[r.gx + 0.8, r.gy + 0.8]}
            color={r.c}
            h1={0.9}
            h2={0.5}
          />
        </div>
      ))}

      <NeonWord t={t} at={0.6} text="هر شعبه،" x="50%" y="124" size={40} color="#ffffff" />
      <NeonWord t={t} at={1.8} text="یک نفس." x="50%" y="174" size={36} color={NEON_GREEN} accent />

      {/* Bottom Multi-Branch Banner */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 54,
          insetInlineStart: 44,
          width: 452,
          height: 48,
          borderRadius: 12,
          background: 'rgba(8,16,32,0.92)',
          border: '1.5px solid rgba(0,255,159,0.35)',
          boxShadow: '0 10px 28px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          zIndex: 45,
          opacity: clamp(pop(t, 2.6, 0.7) * 1.5),
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: NEON_GREEN }} />
        <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
          انتقال آنی اسناد و فاکتورها بین تمام فروشگاه‌ها بدون سرور
        </span>
      </div>
    </IsoStage>
  )
}

// ─── Scene 6 (38–45s): Brand Hexagonal Climax & High-Conversion Action Hub ────

export function IsoLogoScene({ t, scene }: { t: number; scene: Scene }) {
  void scene
  // Audio sync cues:
  // 0.4s: bigReveal
  // 2.0s: chime
  // 3.4s: ctaResolution
  const lockP = pop(t, 0.4, 0.8)
  const cardsP = pop(t, 1.2, 0.7)
  const chimeP = pop(t, 2.0, 0.5)

  return (
    <IsoStage scene={scene} t={t} label="// 06 — حسابچه" orbit={Math.sin(t * 0.4) * 0.6}>
      {/* 3D Isometric Hisabche Hub Emblem */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          insetInlineStart: '50%',
          transform: 'translateX(-50%)',
          width: 86,
          height: 86,
          borderRadius: 24,
          background: 'linear-gradient(145deg, #0e2040, #060e20)',
          border: `2px solid ${NEON_BLUE}`,
          boxShadow: `0 0 40px ${NEON_BLUE}66, inset 0 0 20px ${NEON_GREEN}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: clamp(lockP * 1.5),
          zIndex: 40,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${NEON_BLUE}, ${NEON_GREEN})`,
            boxShadow: `0 0 20px ${NEON_BLUE}`,
          }}
        />
      </div>

      {/* Brand Wordmark */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 280,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 66,
          fontWeight: 900,
          color: '#ffffff',
          textShadow: `0 0 46px ${NEON_BLUE}66`,
          opacity: clamp(lockP * 1.5),
          transform: `translateY(${mix(16, 0, lockP).toFixed(1)}px)`,
        }}
      >
        حسابچه
      </div>

      {/* Subtitle */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 376,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 18,
          fontWeight: 700,
          color: ISO_MUTED,
          opacity: clamp(lockP * 1.4),
        }}
      >
        یک شبکه یکپارچه برای مدیریت کامل فروش، انبار و شعب
      </div>

      {/* Two High-Conversion Action Cards (Disjoint: x: 44 & x: 280, w: 216, h: 140) */}
      <div
        style={{
          position: 'absolute',
          top: 480,
          insetInlineStart: 44,
          width: 216,
          height: 140,
          borderRadius: 20,
          background: 'linear-gradient(155deg, rgba(14,24,48,0.92), rgba(6,12,26,0.96))',
          border: `1.5px solid ${NEON_BLUE}66`,
          boxShadow: `0 16px 36px rgba(0,0,0,0.6), 0 0 ${chimeP * 24}px ${NEON_BLUE}44`,
          padding: '16px 14px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: clamp(cardsP * 1.5),
          transform: `translateY(${mix(18, 0, cardsP).toFixed(1)}px)`,
          zIndex: 40,
        }}
      >
        <span
          dir="rtl"
          style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', textAlign: 'center' }}
        >
          شروع رایگان
        </span>
        <span
          dir="rtl"
          style={{ fontSize: 12, fontWeight: 700, color: ISO_MUTED, textAlign: 'center' }}
        >
          ثبت‌نام آنلاین در ۲ دقیقه
        </span>
        <div
          style={{
            width: '100%',
            height: 38,
            borderRadius: 12,
            background: `${NEON_BLUE}22`,
            border: `1.5px solid ${NEON_BLUE}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 16px ${NEON_BLUE}44`,
          }}
        >
          <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: NEON_BLUE }}>
            نصب و راه‌اندازی
          </span>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 480,
          insetInlineStart: 280,
          width: 216,
          height: 140,
          borderRadius: 20,
          background: 'linear-gradient(155deg, rgba(14,24,48,0.92), rgba(6,12,26,0.96))',
          border: `1.5px solid ${NEON_GREEN}66`,
          boxShadow: `0 16px 36px rgba(0,0,0,0.6), 0 0 ${chimeP * 24}px ${NEON_GREEN}44`,
          padding: '16px 14px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: clamp(cardsP * 1.5),
          transform: `translateY(${mix(18, 0, cardsP).toFixed(1)}px)`,
          zIndex: 40,
        }}
      >
        <span
          dir="rtl"
          style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', textAlign: 'center' }}
        >
          دموی چندشعبه
        </span>
        <span
          dir="rtl"
          style={{ fontSize: 12, fontWeight: 700, color: ISO_MUTED, textAlign: 'center' }}
        >
          مشاوره رایگان استقرار
        </span>
        <div
          style={{
            width: '100%',
            height: 38,
            borderRadius: 12,
            background: `${NEON_GREEN}22`,
            border: `1.5px solid ${NEON_GREEN}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 16px ${NEON_GREEN}44`,
          }}
        >
          <span dir="rtl" style={{ fontSize: 15, fontWeight: 900, color: NEON_GREEN }}>
            رزرو جلسه
          </span>
        </div>
      </div>

      {/* Multi-platform Availability Footer */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          bottom: 50,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          textAlign: 'center',
          fontSize: 14,
          fontWeight: 800,
          color: ISO_MUTED,
          opacity: clamp(cardsP * 1.3),
        }}
      >
        وب · ویندوز · اندروید · همگام‌سازی ابری و کارکرد کاملاً آفلاین
      </div>
    </IsoStage>
  )
}
