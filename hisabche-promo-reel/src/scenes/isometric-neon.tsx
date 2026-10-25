// ============================================
// Isometric Neon Diorama (reel 86) — dark SaaS commercial.
//
// Distinct from reel 85 (DistilBook): no floating papers, no phone mockup,
// no split-screen. Instead the owner's shop is rendered as a glowing 3D
// ISOMETRIC WIREFRAME ROOM that constructs itself station by station, with
// neon data-streams routing through a central Hisabche core. Dark obsidian
// background, neon green/blue/pink data lines, kinetic typography, 2.5D
// layering + slow virtual-camera orbit — polished fintech aesthetic.
// ============================================

import type { CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, mix, progress, spring, deterministicHash } from '../engine/anim'
import { HalftoneCharacter } from './paper-pocket'
import { faNumber } from '../ui/motion-primitives'

export const VOID = '#04060c'
export const NEON_GREEN = '#00FF9F'
export const NEON_BLUE = '#00B4FF'
export const NEON_PINK = '#FF4D9E'
export const WIRE = '#6f7dff'

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

// ─── Isometric projection ───────────────────────────────────────────────

const OX = 270
const OY = 500
const UX = 34 // screen-x per grid-x unit
const UY = 17 // screen-y per grid-x+gy unit
const UZ = 30 // screen-y lift per height unit

/** 2:1 isometric projection of a grid point at height h. */
function iso(gx: number, gy: number, h = 0): { x: number; y: number } {
  return { x: OX + (gx - gy) * UX, y: OY + (gx + gy) * UY - h * UZ }
}

// ─── Stage ──────────────────────────────────────────────────────────────

/** Dark obsidian canvas: floor grid, vignette, HUD. No horizon divider. */
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
        background: `radial-gradient(120% 80% at 50% 42%, #0a1020 0%, ${VOID} 62%)`,
        overflow: 'hidden',
        color: '#ffffff',
      }}
    >
      {/* corner glow */}
      <div
        style={{
          position: 'absolute',
          top: -160,
          insetInlineStart: -120,
          width: 380,
          height: 380,
          background: `radial-gradient(circle, ${NEON_BLUE}22, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -180,
          insetInlineEnd: -140,
          width: 420,
          height: 420,
          background: `radial-gradient(circle, ${NEON_PINK}1e, transparent 70%)`,
        }}
      />
      {/* HUD */}
      <div
        style={{
          ...MONO,
          position: 'absolute',
          top: 26,
          insetInlineStart: 28,
          fontSize: 14,
          letterSpacing: '0.08em',
          opacity: 0.6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          ...MONO,
          position: 'absolute',
          top: 26,
          insetInlineEnd: 28,
          fontSize: 14,
          opacity: 0.6,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <Timecode t={scene.start + t} />
      </div>
      <div
        style={{
          ...MONO,
          position: 'absolute',
          bottom: 26,
          insetInlineEnd: 28,
          fontSize: 12,
          letterSpacing: '0.18em',
          opacity: 0.4,
        }}
      >
        HISABCHE
      </div>
      {/* isometric room, slow virtual-camera orbit */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `rotate(${orbit.toFixed(3)}deg) scale(${(1 + Math.sin(t * 0.25) * 0.012).toFixed(4)})`,
          transformOrigin: '50% 46%',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ─── Isometric floor: diamond grid (two diagonal line families) ─────────

const GRID_N = 4 // grid spans -4..4 on both axes

function IsoFloor({ t, at }: { t: number; at: number }) {
  const lines: React.ReactNode[] = []
  const reveal = ease(clamp(progress(t, at, 1.1)))
  const extent = Math.round(reveal * GRID_N)
  for (let i = -extent; i <= extent; i++) {
    const a = iso(-GRID_N, i)
    const b = iso(GRID_N, i)
    const c = iso(i, -GRID_N)
    const d = iso(i, GRID_N)
    const bright = 0.1 + 0.14 * (1 - Math.abs(i) / (GRID_N + 1))
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
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden
    >
      {lines}
    </svg>
  )
}

// ─── Isometric wireframe block: 3 visible faces, neon edges ─────────────

function facePath(pts: { x: number; y: number }[]): string {
  return `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')} Z`
}

/** A wireframe box rising from the floor. `w`,`d` footprint; `h` height. */
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
  const p = spring(clamp(progress(t, local, local + 0.9)))
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
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* soft ground glow */}
      <div
        style={{
          position: 'absolute',
          top: ground.y - 26,
          insetInlineStart: ground.x - 60,
          width: 120,
          height: 52,
          background: `radial-gradient(ellipse, ${color}30, transparent 70%)`,
          opacity: p,
        }}
      />
      <svg
        width={540}
        height={960}
        viewBox="0 0 540 960"
        style={{ position: 'absolute', inset: 0 }}
        aria-hidden
      >
        {/* translucent faces */}
        <path d={facePath(left)} fill={`${color}14`} />
        <path d={facePath(right)} fill={`${color}0d`} />
        <path d={facePath(top)} fill={`${color}26`} />
        {/* neon edges */}
        <path d={facePath(top)} fill="none" stroke={color} strokeWidth={2.2} opacity={0.95} />
        <path d={facePath(left)} fill="none" stroke={color} strokeWidth={1.6} opacity={0.7} />
        <path d={facePath(right)} fill="none" stroke={color} strokeWidth={1.6} opacity={0.5} />
      </svg>
      {/* floating label */}
      {label && (
        <div
          style={{
            position: 'absolute',
            top: cap.y - 30,
            left: cap.x,
            transform: 'translateX(-50%)',
            fontSize: 15,
            fontWeight: 800,
            color,
            textShadow: `0 0 12px ${color}`,
            whiteSpace: 'nowrap',
            opacity: clamp(p * 1.4),
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}

// ─── Neon data link: line between two grid points + traveling pulse ─────

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
  // traveling pulse dot (quadratic bezier at parameter u)
  const u = ((t * 0.55 + deterministicHash(Math.round(from[0] * 7 + to[1]), 13)) % 1) * draw
  const px = (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * mid.x + u * u * b.x
  const py = (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * mid.y + u * u * b.y
  return (
    <svg
      width={540}
      height={960}
      viewBox="0 0 540 960"
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden
    >
      <path d={d} fill="none" stroke={color} strokeWidth={2} opacity={0.55} strokeDasharray="6 7" />
      <circle cx={px} cy={py} r={4} fill={color} opacity={0.95} />
      <circle cx={px} cy={py} r={9} fill={`${color}55`} />
    </svg>
  )
}

// ─── Central Hisabche core: pulsing hexagonal prism ─────────────────────

export function NeonCore({ t, at }: { t: number; at: number }) {
  const p = spring(clamp(progress(t, at, at + 1.0)))
  if (p <= 0.001) return null
  const c = iso(0, 0, 0.9)
  const pulse = 0.5 + 0.5 * Math.sin((t - at) * 2.4)
  const r = 40 * p
  return (
    <div
      style={{
        position: 'absolute',
        top: c.y,
        left: c.x,
        transform: `translate(-50%,-50%) scale(${p.toFixed(3)})`,
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
      <svg
        width={r * 2.6}
        height={r * 2.6}
        viewBox="0 0 100 100"
        style={{ display: 'block' }}
        aria-hidden
      >
        <polygon
          points="50,4 92,27 92,73 50,96 8,73 8,27"
          fill={`${NEON_BLUE}1f`}
          stroke={NEON_BLUE}
          strokeWidth={3}
        />
        <polygon
          points="50,22 76,37 76,63 50,78 24,63 24,37"
          fill={`${NEON_GREEN}26`}
          stroke={NEON_GREEN}
          strokeWidth={2}
          opacity={0.6 + pulse * 0.4}
        />
      </svg>
    </div>
  )
}

// ─── Floating holographic KPI: scanlines + count-up ─────────────────────

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
  const count = ease(clamp(progress(t, local + 0.3, local + 2.0)))
  return (
    <div
      style={{
        position: 'absolute',
        top: pos.y + float,
        left: pos.x,
        transform: `translate(-50%,-50%) perspective(600px) rotateX(${mix(14, 6, p).toFixed(1)}deg) scale(${mix(0.6, 1, p).toFixed(3)})`,
        opacity: clamp(p * 1.5),
        background: 'linear-gradient(150deg, rgba(12,20,38,0.92), rgba(6,10,20,0.82))',
        border: `1.5px solid ${color}`,
        borderRadius: 14,
        padding: '12px 18px',
        boxShadow: `0 0 28px ${color}55, inset 0 0 22px ${color}14`,
        minWidth: 128,
        backdropFilter: 'blur(3px)',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, color, letterSpacing: '0.03em' }}>{label}</div>
      <div
        style={{
          ...MONO,
          fontSize: 30,
          fontWeight: 900,
          color: '#ffffff',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.15,
        }}
      >
        {faNumber(Math.round(to * count))}
        {suffix}
      </div>
      {/* scanline */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          background: `repeating-linear-gradient(0deg, ${color}0d 0 1px, transparent 1px 4px)`,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

// ─── Kinetic word: spring pop, optional accent pill, stays on stage ─────

export function NeonWord({
  t,
  at,
  text,
  x,
  y,
  size = 34,
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
  // RTL frame: `insetInlineStart` would resolve to the physical right edge and
  // drift the centered word off the left border. Pin a physical `left` so the
  // -50% translate stays direction-agnostic.
  const left = typeof x === 'number' ? `${x}px` : x
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left,
        transform: `translate(-50%,-50%) scale(${mix(0.5, 1, p).toFixed(3)})`,
        opacity: clamp(p * 1.5),
        fontSize: size,
        fontWeight: 900,
        color: accent ? '#04060c' : color,
        background: accent ? color : 'transparent',
        padding: accent ? '5px 16px' : 0,
        borderRadius: accent ? 12 : 0,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        boxShadow: accent ? `0 0 22px ${color}` : 'none',
        textShadow: accent ? 'none' : `0 0 14px ${color}88`,
      }}
    >
      {text}
    </div>
  )
}

// ═══ Scenes ═════════════════════════════════════════════════════════════

// ─── 1 — Hook: lone counter drops onto the dark grid, stations blink out of sync ──

export function IsoHookScene({ t, scene }: { t: number; scene: Scene }) {
  const glitch = Math.sin(t * 22) > 0.2 ? 1 : 0
  return (
    <IsoStage scene={scene} t={t} label="// 01 — شبکه" orbit={Math.sin(t * 0.5) * 0.6}>
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
      {/* out-of-sync blinking satellites */}
      {[
        { gx: 2.4, gy: -1.6, c: NEON_PINK, l: 'قفسه', ph: 0 },
        { gx: -2.6, gy: 1.4, c: NEON_GREEN, l: 'صندوق', ph: 1.7 },
      ].map((s, i) => {
        const blink = 0.35 + 0.65 * (Math.sin((t + s.ph) * 7) > 0 ? 1 : 0)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: blink * clamp(progress(t, 0.5, 1.0)),
            }}
          >
            <IsoBlock
              t={t}
              at={0.5}
              gx={s.gx}
              gy={s.gy}
              w={1.2}
              d={1.2}
              h={0.8}
              color={s.c}
              label={s.l}
            />
          </div>
        )
      })}
      <HalftoneCharacter
        t={t}
        mood="worried"
        scale={0.62}
        style={{
          position: 'absolute',
          top: iso(0, 0, 0).y - 210,
          insetInlineStart: iso(0, 0, 0).x + 6,
          transform: `translateX(-50%) translateY(${glitch ? 1 : 0}px)`,
        }}
      />
      <NeonWord t={t} at={0.35} text="مغازه‌ات" x="50%" y="150" size={40} color={NEON_BLUE} />
      <NeonWord t={t} at={1.15} text="زنده‌ست؛" x="50%" y="205" size={40} color="#ffffff" />
      <NeonWord t={t} at={2.0} text="ولی هیچ‌کدوم" x="50%" y="262" size={34} color="#ffffff" />
      <NeonWord
        t={t}
        at={2.75}
        text="همدیگه رو نمی‌بینن."
        x="50%"
        y="315"
        size={30}
        color={NEON_PINK}
        accent
      />
    </IsoStage>
  )
}

// ─── 2 — Build: stations rise, data lines tangle ────────────────────────

export function IsoBuildScene({ t, scene }: { t: number; scene: Scene }) {
  return (
    <IsoStage
      scene={scene}
      t={t}
      label="// 02 — ساخت"
      orbit={mix(0, 2.5, ease(clamp(progress(t, 0, 6))))}
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
        label="قفسه"
        delay={0.5}
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
        delay={1.0}
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
        label="دفتر"
        delay={1.5}
      />
      {/* tangled links (crossing, unresolved) */}
      <NeonLink
        t={t}
        at={2.2}
        from={[0, 0]}
        to={[2.8, -1.1]}
        color={NEON_PINK}
        h1={0.6}
        h2={0.5}
        bend={-26}
      />
      <NeonLink
        t={t}
        at={2.5}
        from={[0, 0]}
        to={[-1.7, 2.2]}
        color={NEON_GREEN}
        h1={0.6}
        h2={0.5}
        bend={30}
      />
      <NeonLink
        t={t}
        at={2.8}
        from={[2.8, -1.1]}
        to={[-1.7, 2.2]}
        color={NEON_PINK}
        h1={0.5}
        h2={0.5}
        bend={-34}
      />
      <NeonWord t={t} at={0.6} text="هر ایستگاه" x="50%" y="150" size={38} color="#ffffff" />
      <NeonWord
        t={t}
        at={1.5}
        text="جداگانه کار می‌کنه."
        x="50%"
        y="203"
        size={32}
        color={NEON_PINK}
        accent
      />
    </IsoStage>
  )
}

// ─── 3 — Core: Hisabche descends, tangles snap straight ─────────────────

export function IsoCoreScene({ t, scene }: { t: number; scene: Scene }) {
  const snap = ease(clamp(progress(t, 1.6, 2.4)))
  return (
    <IsoStage
      scene={scene}
      t={t}
      label="// 03 — هسته"
      orbit={mix(2.5, -1.5, ease(clamp(progress(t, 0, 8))))}
    >
      <IsoFloor t={t} at={0} />
      <IsoBlock t={t} at={0} gx={-1} gy={-1} w={2} d={2} h={1.1} color={NEON_BLUE} />
      <IsoBlock t={t} at={0} gx={2.2} gy={-1.8} w={1.3} d={1.3} h={0.9} color={NEON_PINK} />
      <IsoBlock t={t} at={0} gx={-2.4} gy={1.6} w={1.3} d={1.3} h={0.9} color={NEON_GREEN} />
      <IsoBlock t={t} at={0} gx={1.6} gy={2.2} w={1.1} d={1.1} h={0.7} color={WIRE} />
      <NeonCore t={t} at={0.4} />
      {/* straight routed links through the core */}
      <NeonLink t={t} at={1.6} from={[0, 0]} to={[2.8, -1.1]} color={NEON_PINK} h1={0.9} h2={0.5} />
      <NeonLink
        t={t}
        at={1.9}
        from={[0, 0]}
        to={[-1.7, 2.2]}
        color={NEON_GREEN}
        h1={0.9}
        h2={0.5}
      />
      <NeonLink t={t} at={2.2} from={[0, 0]} to={[2.1, 2.7]} color={WIRE} h1={0.9} h2={0.4} />
      {/* snap flash */}
      <div
        style={{
          position: 'absolute',
          top: iso(0, 0, 0.9).y,
          insetInlineStart: iso(0, 0, 0.9).x,
          width: 8,
          height: 8,
          transform: 'translate(-50%,-50%)',
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: `0 0 ${60 * snap}px ${40 * snap}px ${NEON_BLUE}`,
          opacity: clamp(snap * (1.6 - snap)),
        }}
      />
      <NeonWord t={t} at={1.2} text="یک هسته." x="50%" y="150" size={44} color={NEON_BLUE} accent />
      <NeonWord
        t={t}
        at={2.4}
        text="همه‌چیز به هم وصل میشه."
        x="50%"
        y="205"
        size={30}
        color="#ffffff"
      />
    </IsoStage>
  )
}

// ─── 4 — Live: KPI holograms orbit the room, character calm ─────────────

export function IsoLiveScene({ t, scene }: { t: number; scene: Scene }) {
  return (
    <IsoStage
      scene={scene}
      t={t}
      label="// 04 — زنده"
      orbit={mix(-1.5, 4, ease(clamp(progress(t, 0, 10))))}
    >
      <IsoFloor t={t} at={0} />
      <IsoBlock t={t} at={0} gx={-1} gy={-1} w={2} d={2} h={1.1} color={NEON_BLUE} />
      <IsoBlock t={t} at={0} gx={2.2} gy={-1.8} w={1.3} d={1.3} h={0.9} color={NEON_PINK} />
      <IsoBlock t={t} at={0} gx={-2.4} gy={1.6} w={1.3} d={1.3} h={0.9} color={NEON_GREEN} />
      <NeonCore t={t} at={0} />
      <NeonLink t={t} at={0} from={[0, 0]} to={[2.8, -1.1]} color={NEON_PINK} h1={0.9} h2={0.5} />
      <NeonLink t={t} at={0} from={[0, 0]} to={[-1.7, 2.2]} color={NEON_GREEN} h1={0.9} h2={0.5} />
      <KpiHolo
        t={t}
        at={0.4}
        gx={-2.9}
        gy={-2.4}
        z={2.6}
        label="فروش امروز"
        to={12850000}
        color={NEON_GREEN}
      />
      <KpiHolo
        t={t}
        at={1.4}
        gx={3.0}
        gy={-2.2}
        z={2.9}
        label="موجودی"
        to={348}
        color={NEON_BLUE}
        delay={0}
      />
      <KpiHolo
        t={t}
        at={2.4}
        gx={0.2}
        gy={3.4}
        z={3.2}
        label="سود خالص"
        to={24}
        suffix="٪"
        color={NEON_PINK}
        delay={0}
      />
      <HalftoneCharacter
        t={t}
        mood="happy"
        phone
        scale={0.6}
        style={{
          position: 'absolute',
          top: iso(0, 0, 0).y - 200,
          insetInlineStart: iso(0, 0, 0).x + 30,
          transform: 'translateX(-50%)',
        }}
      />
    </IsoStage>
  )
}

// ─── 5 — Multi-branch: one room multiplies into a synced grid ───────────

export function IsoMultiScene({ t, scene }: { t: number; scene: Scene }) {
  const spread = ease(clamp(progress(t, 0.6, 3.0)))
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
      label="// 05 — شعبه"
      orbit={mix(4, -3, ease(clamp(progress(t, 0, 8))))}
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
      {/* sync pulses from core to each branch */}
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
      <NeonWord t={t} at={0.8} text="هر شعبه" x="50%" y="150" size={40} color="#ffffff" />
      <NeonWord t={t} at={1.8} text="یک نفس." x="50%" y="205" size={40} color={NEON_GREEN} accent />
    </IsoStage>
  )
}

// ─── 6 — Logo: diorama condenses into the Hisabche lockup + CTA ─────────

export function IsoLogoScene({ t, scene }: { t: number; scene: Scene }) {
  const mark = spring(clamp(progress(t, 0.5, 1.6)))
  const cta = ease(clamp(progress(t, 2.6, 3.4)))
  const barsIn = clamp(progress(t, 0.2, 1.0))
  return (
    <IsoStage scene={scene} t={t} label="// 06 — حسابچه" orbit={Math.sin(t * 0.4) * 0.8}>
      {/* converging neon bars */}
      <div
        style={{
          position: 'absolute',
          top: 330,
          insetInlineStart: '50%',
          transform: 'translate(-50%,-50%)',
          display: 'flex',
          gap: 16,
          alignItems: 'flex-end',
          height: 150,
        }}
      >
        {[
          { c: NEON_GREEN, h: 120 },
          { c: NEON_BLUE, h: 150 },
          { c: NEON_PINK, h: 96 },
        ].map((b, i) => (
          <div
            key={i}
            style={{
              width: 16,
              height: b.h * barsIn,
              background: b.c,
              borderRadius: 8,
              boxShadow: `0 0 ${24 + beat(t, i) * 20}px ${b.c}`,
              transformOrigin: 'bottom center',
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 470,
          insetInlineStart: '50%',
          transform: `translate(-50%,-50%) scale(${mix(0.5, 1, mark).toFixed(3)})`,
          opacity: clamp(mark * 1.6),
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 76, fontWeight: 900, letterSpacing: '-0.02em' }}>حسابچه</div>
        <div
          style={{
            width: mix(0, 260, mark),
            height: 6,
            borderRadius: 6,
            margin: '16px auto 0',
            background: `linear-gradient(90deg, ${NEON_GREEN}, ${NEON_BLUE}, ${NEON_PINK})`,
            boxShadow: `0 0 30px ${NEON_BLUE}`,
            opacity: mark,
          }}
        />
        <div
          style={{
            ...MONO,
            marginTop: 16,
            fontSize: 15,
            letterSpacing: '0.2em',
            opacity: mark * 0.75,
          }}
        >
          ONE GRID · EVERY BRANCH
        </div>
      </div>
      <NeonWord t={t} at={1.5} text="وقتی شبکه‌ات" x="50%" y="640" size={32} color="#ffffff" />
      <NeonWord t={t} at={2.2} text="یکی میشه،" x="50%" y="690" size={32} color={NEON_BLUE} />
      <NeonWord
        t={t}
        at={3.0}
        text="تصمیم هم ساده میشه."
        x="50%"
        y="742"
        size={28}
        color={NEON_GREEN}
        accent
      />
      {/* CTA */}
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          insetInlineStart: '50%',
          transform: `translate(-50%,-50%) scale(${mix(0.3, 1, cta).toFixed(3)})`,
          opacity: cta,
        }}
      >
        <div
          style={{
            background: NEON_GREEN,
            color: '#04060c',
            fontSize: 32,
            fontWeight: 900,
            padding: '13px 56px',
            borderRadius: 26,
            border: '2px solid #04060c',
            boxShadow: `0 0 38px ${NEON_GREEN}, 10px 10px 0 #04060c00`,
          }}
        >
          شروع کن
        </div>
      </div>
    </IsoStage>
  )
}

/** Per-bar glow beat for the logo lockup. */
function beat(t: number, i: number): number {
  return 0.5 + 0.5 * Math.sin(t * 2.6 + i * 1.9)
}
