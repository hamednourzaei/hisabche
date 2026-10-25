// ============================================
// DistilBook art direction (reel 85) — cinematic 3D commercial:
// dark navy-black background, floating 3D paper documents with thickness
// and soft reflections, glowing neon green-blue-pink vertical logo bars,
// clean kinetic typography, smooth camera movements, particle data rings,
// elegant depth of field, octane-quality lighting, highly polished SaaS aesthetic.
// ============================================

import type { CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, mix, progress, spring, deterministicHash } from '../engine/anim'
import { HalftoneCharacter } from './paper-pocket'
import { faNumber } from '../ui/motion-primitives'

export const DARK = '#0a0a12'
export const NEON_GREEN = '#00FF9F'
export const NEON_BLUE = '#00B4FF'
export const NEON_PINK = '#FF4D9E'
export const PAPER_WHITE = '#ffffff'

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
  const mm = Math.floor(frames / (30 * 60))
  const ff = frames % 30
  return (
    <span style={MONO}>
      {pad2(mm)}:{pad2(ss)}:{pad2(ff)}
    </span>
  )
}

/** Dark canvas: covers the engine backdrop, carries neon HUD. */
export function DarkStage({
  scene,
  t,
  label,
  children,
}: {
  scene: Scene
  t: number
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: DARK,
        overflow: 'hidden',
        color: '#ffffff',
      }}
    >
      {/* subtle particle field */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.06,
          backgroundImage:
            'radial-gradient(#00FF9F 0.6px, transparent 0.6px), radial-gradient(#00B4FF 0.6px, transparent 0.6px), radial-gradient(#FF4D9E 0.6px, transparent 0.6px)',
          backgroundSize: '22px 22px, 30px 30px, 38px 38px',
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
      {children}
    </div>
  )
}

/** 3D stage: perspective container for floating paper objects. */
function Stage3D({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        perspective: 1200,
        transformStyle: 'preserve-3d',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** Spring pop: 0 before `at`, overshoots, settles at 1. */
function pop(t: number, at: number, dur = 0.5): number {
  return spring(clamp(progress(t, at, at + dur)) * 1.15)
}

/** Soft pulse 0..1, period seconds, only while t inside [from, to]. */
function pulse(t: number, from: number, to: number, period = 1.4): number {
  if (t < from || t > to) return 0
  return 0.5 - 0.5 * Math.cos(((t - from) / period) * Math.PI * 2)
}

/** Floating 3D paper sheet with thickness, reflection, and text lines. */
function PaperSheet({
  t,
  at,
  dx,
  dy,
  dz,
  rx,
  ry,
  rz,
  w = 170,
  h = 230,
  delay = 0,
}: {
  t: number
  at: number
  dx: number
  dy: number
  dz: number
  rx: number
  ry: number
  rz: number
  w?: number
  h?: number
  delay?: number
}) {
  const p = ease(clamp(progress(t, at + (delay || 0), 1.4)))
  const sway = Math.cos((t - at) * 0.9 + dy * 0.01) * 4
  const s = mix(0.35, 1, p)
  const rot = mix(12, 0, p)
  return (
    <div
      style={{
        position: 'absolute',
        top: mix(620, dy, p),
        insetInlineStart: `calc(50% + ${dx + sway}px)`,
        width: w * s,
        height: h * s,
        marginLeft: -(w * s) / 2,
        transform: `translateZ(${dz}px) rotateX(${mix(rx, rx + rot, p)}deg) rotateY(${mix(ry, ry + rot, p)}deg) rotateZ(${rz}deg)`,
        transformStyle: 'preserve-3d',
        opacity: clamp(p * 1.5),
      }}
    >
      {/* back thickness */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#161624',
          borderRadius: 10,
          boxShadow: 'inset 1px 1px 4px rgba(0,0,0,0.6)',
        }}
      />
      {/* front paper */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: PAPER_WHITE,
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.35)',
          boxShadow: '0 24px 70px rgba(0,0,0,0.7), 0 0 40px rgba(0,255,159,0.12)',
        }}
      />
      {/* reflection highlight */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          insetInlineStart: 0,
          width: '45%',
          height: '55%',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.7), transparent)',
          borderRadius: '10px 0 0 0',
          pointerEvents: 'none',
          opacity: 0.8,
        }}
      />
      {/* text lines on paper */}
      <div
        style={{
          position: 'absolute',
          inset: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
          color: '#161624',
          fontSize: 12,
          fontWeight: 800,
          opacity: clamp(p * 1.3),
        }}
      >
        <div style={{ height: 9, width: '65%', background: '#161624', borderRadius: 4 }} />
        <div style={{ height: 7, width: '45%', background: '#161624', borderRadius: 4 }} />
        <div style={{ height: 9, width: '80%', background: '#161624', borderRadius: 4 }} />
        <div style={{ height: 7, width: '55%', background: '#161624', borderRadius: 4 }} />
      </div>
    </div>
  )
}

/** Neon vertical bar for the logo lockup. */
function NeonBar({
  t,
  at,
  x,
  color,
  height = 320,
  width = 12,
}: {
  t: number
  at: number
  x: number
  color: string
  height?: number
  width?: number
}) {
  const p = ease(clamp(progress(t, at, 0.9)))
  const g = pulse(t, at, 7)
  return (
    <div
      style={{
        position: 'absolute',
        top: mix(700, 320 - height / 2, p),
        insetInlineStart: `calc(50% + ${x}px)`,
        width,
        height: height * p,
        background: color,
        boxShadow: `0 0 ${18 + g * 32}px ${color}, 0 0 ${40 + g * 45}px ${color}`,
        borderRadius: width / 2,
        opacity: clamp(p * 1.7),
        filter: 'blur(1px)',
        transform: `scaleY(${p})`,
        transformOrigin: 'bottom center',
      }}
    />
  )
}

/** Data ring: rotating circular particle ring. */
function DataRing({
  t,
  at,
  cx,
  cy,
  radius,
  color,
  count = 28,
}: {
  t: number
  at: number
  cx: number
  cy: number
  radius: number
  color: string
  count?: number
}) {
  const p = ease(clamp(progress(t, at, 1.6)))
  return (
    <div
      style={{
        position: 'absolute',
        top: cy - radius * p,
        insetInlineStart: cx - radius * p,
        width: radius * 2 * p,
        height: radius * 2 * p,
        border: `2px solid ${color}`,
        borderRadius: '50%',
        opacity: clamp(p * 1.6),
        boxShadow: `0 0 ${35 * p}px ${color}`,
        transform: `rotate(${t * 35}deg)`,
        transformOrigin: 'center center',
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2 + t * 0.6
        const px = Math.cos(angle) * radius * p
        const py = Math.sin(angle) * radius * p
        const bright = deterministicHash(i, 97) > 0.55 ? 1 : 0.35
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              insetInlineStart: '50%',
              width: 4,
              height: 4,
              background: color,
              borderRadius: '50%',
              boxShadow: `0 0 ${9 * bright}px ${color}`,
              transform: `translate(${px}px, ${py}px) translate(-50%, -50%)`,
              opacity: bright,
            }}
          />
        )
      })}
    </div>
  )
}

/** Kinetic word: appears with spring pop, optional accent pill. */
function KineticWord({
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
  x: string | number
  y: string | number
  size?: number
  color?: string
  accent?: boolean
}) {
  const p = pop(t, at)
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        insetInlineStart: x,
        transform: `translate(-50%, -50%) scale(${mix(0.35, 1, p).toFixed(3)})`,
        opacity: clamp(p * 1.6),
        fontSize: size,
        fontWeight: 900,
        color: accent ? color : PAPER_WHITE,
        background: accent ? color : 'transparent',
        padding: accent ? '5px 16px' : 0,
        borderRadius: accent ? 12 : 0,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        boxShadow: accent ? `0 0 20px ${color}` : 'none',
      }}
    >
      {text}
    </div>
  )
}

/** Value card: big number with label, floating in 3D. */
function ValueCard({
  t,
  at,
  dx,
  dy,
  dz,
  rx,
  ry,
  label,
  value,
  color,
  delay = 0,
}: {
  t: number
  at: number
  dx: number
  dy: number
  dz: number
  rx: number
  ry: number
  label: string
  value: string
  color: string
  delay?: number
}) {
  const p = pop(t, at + (delay || 0), 0.7)
  const float = Math.sin((t - at) * 1.1 + dx * 0.015) * 5
  const count = mix(
    0,
    Number(value.replace(/[^0-9]/g, '')),
    ease(clamp(progress(t, at + 0.3 + (delay || 0), 1.6))),
  )
  return (
    <div
      style={{
        position: 'absolute',
        top: mix(700, dy, p),
        insetInlineStart: `calc(50% + ${dx + float}px)`,
        width: 210,
        marginLeft: -105,
        transform: `translateZ(${dz}px) rotateX(${mix(rx, rx - 8, p)}deg) rotateY(${mix(ry, ry + 6, p)}deg)`,
        transformStyle: 'preserve-3d',
        opacity: clamp(p * 1.8),
      }}
    >
      <div
        style={{
          background: PAPER_WHITE,
          borderRadius: 18,
          boxShadow: `0 30px 80px rgba(0,0,0,0.7), 0 0 45px ${color}`,
          border: `2px solid ${color}`,
          padding: '18px 22px',
          transformStyle: 'preserve-3d',
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: color,
            marginBottom: 6,
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </div>
        <div
          style={{
            ...MONO,
            fontSize: 34,
            fontWeight: 900,
            color: '#0a0a12',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}
        >
          {value.includes('%')
            ? faNumber(Number(value.replace('%', ''))) + '%'
            : faNumber(Math.round(count))}
        </div>
      </div>
    </div>
  )
}

// ─── Scene 1 — Chaos: flying papers, overwhelmed character ───────────────

const CHAOS_PAPERS = [
  { dx: -190, dy: 260, dz: -60, rx: 15, ry: -12, rz: -8, delay: 0.0 },
  { dx: 190, dy: 220, dz: 40, rx: -10, ry: 14, rz: 6, delay: 0.12 },
  { dx: -120, dy: 420, dz: 90, rx: 8, ry: -6, rz: -14, delay: 0.24 },
  { dx: 130, dy: 470, dz: -30, rx: -12, ry: 10, rz: 9, delay: 0.36 },
  { dx: -210, dy: 610, dz: 20, rx: 6, ry: -8, rz: -4, delay: 0.48 },
  { dx: 210, dy: 560, dz: -70, rx: -8, ry: 6, rz: 12, delay: 0.6 },
  { dx: -60, dy: 380, dz: 110, rx: 14, ry: -4, rz: -10, delay: 0.1 },
  { dx: 80, dy: 430, dz: -50, rx: -6, ry: 12, rz: 7, delay: 0.22 },
]

export function DistilChaosScene({ t, scene }: { t: number; scene: Scene }) {
  return (
    <DarkStage scene={scene} t={t} label="// 01 — اشغال">
      <Stage3D>
        {CHAOS_PAPERS.map((paper, i) => (
          <PaperSheet key={i} t={t} at={paper.delay} {...paper} />
        ))}
      </Stage3D>
      <HalftoneCharacter
        t={t}
        mood="worried"
        scale={1.15}
        style={{
          position: 'absolute',
          bottom: 110,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          margin: '0 auto',
          transform: `translateY(${Math.sin(t * 10) * 6}px) scale(${mix(0.6, 1, pop(t, 0.05, 0.8)).toFixed(3)})`,
        }}
      />
      <KineticWord t={t} at={0.25} text="فروختی…" x="50%" y="300" size={38} accent={false} />
      <KineticWord t={t} at={0.95} text="خرج کردی…" x="50%" y="356" size={38} accent={false} />
      <KineticWord
        t={t}
        at={1.65}
        text="چقدر موند؟"
        x="50%"
        y="412"
        size={42}
        accent={true}
        color={NEON_PINK}
      />
    </DarkStage>
  )
}

// ─── Scene 2 — Freeze & rings: data rings + neon logo bars ───────────────

export function DistilFreezeScene({ t, scene }: { t: number; scene: Scene }) {
  return (
    <DarkStage scene={scene} t={t} label="// 02 — تجمید">
      {/* frozen papers dimmed */}
      <Stage3D>
        {CHAOS_PAPERS.map((paper, i) => (
          <PaperSheet
            key={i}
            t={t}
            at={0}
            dx={paper.dx}
            dy={paper.dy}
            dz={paper.dz}
            rx={paper.rx}
            ry={paper.ry}
            rz={paper.rz}
            delay={0}
          />
        ))}
      </Stage3D>
      {/* central bright light */}
      <div
        style={{
          position: 'absolute',
          top: 320,
          insetInlineStart: '50%',
          width: 0,
          height: 0,
          background: '#ffffff',
          borderRadius: '50%',
          transform: `translate(-50%, -50%) scale(${mix(0, 220, ease(clamp(progress(t, 0.5, 1.2)))).toFixed(0)})`,
          boxShadow: `0 0 ${mix(0, 200, ease(clamp(progress(t, 0.5, 1.2))))}px #ffffff`,
          opacity: ease(clamp(progress(t, 0.5, 1.2))),
        }}
      />
      {/* data rings */}
      <DataRing t={t} at={0.9} cx={270} cy={320} radius={140} color={NEON_BLUE} />
      <DataRing t={t} at={1.1} cx={270} cy={320} radius={200} color={NEON_GREEN} />
      <DataRing t={t} at={1.3} cx={270} cy={320} radius={260} color={NEON_PINK} />
      {/* neon bars */}
      <NeonBar t={t} at={1.5} x={-46} color={NEON_GREEN} />
      <NeonBar t={t} at={1.7} x={0} color={NEON_BLUE} />
      <NeonBar t={t} at={1.9} x={46} color={NEON_PINK} />
      {/* logo text */}
      <KineticWord
        t={t}
        at={2.4}
        text="حسابچه"
        x="50%"
        y="540"
        size={64}
        accent={true}
        color={NEON_GREEN}
      />
    </DarkStage>
  )
}

// ─── Scene 3 — Clean cards: four organized 3D value cards ────────────────

export function DistilCardsScene({ t, scene }: { t: number; scene: Scene }) {
  return (
    <DarkStage scene={scene} t={t} label="// 03 — düzen">
      <Stage3D>
        <ValueCard
          t={t}
          at={0.2}
          dx={-180}
          dy={-60}
          dz={20}
          rx={-8}
          ry={6}
          label="فروش امروز"
          value="۱۲٬۸۵۰٬۰۰۰"
          color={NEON_GREEN}
          delay={0}
        />
        <ValueCard
          t={t}
          at={0.45}
          dx={180}
          dy={-60}
          dz={-40}
          rx={6}
          ry={-8}
          label="موجودی انبار"
          value="۳۴۸"
          color={NEON_BLUE}
          delay={0}
        />
        <ValueCard
          t={t}
          at={0.7}
          dx={-180}
          dy={140}
          dz={60}
          rx={-6}
          ry={4}
          label="سود خالص"
          value="+۲۴٪"
          color={NEON_PINK}
          delay={0}
        />
        <ValueCard
          t={t}
          at={0.95}
          dx={180}
          dy={140}
          dz={-80}
          rx={8}
          ry={-6}
          label="بدهکاران"
          value="۸٬۴۰۰٬۰۰۰"
          color={NEON_GREEN}
          delay={0}
        />
      </Stage3D>
      <HalftoneCharacter
        t={t}
        mood="happy"
        scale={0.95}
        style={{
          position: 'absolute',
          bottom: 100,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          margin: '0 auto',
          opacity: clamp(progress(t, 1.5, 2.2)),
        }}
      />
    </DarkStage>
  )
}

// ─── Scene 4 — Phone mockup: dashboard, live counters, alerts ────────────

export function DistilPhoneScene({ t, scene }: { t: number; scene: Scene }) {
  const phoneUp = pop(t, 0.15, 0.8)
  const counterP = ease(clamp(progress(t, 1.4, 3.0)))
  const alertP = pop(t, 3.2, 0.6)
  return (
    <DarkStage scene={scene} t={t} label="// 04 — تابلو">
      {/* phone mockup */}
      <div
        style={{
          position: 'absolute',
          top: mix(660, 300, phoneUp),
          insetInlineStart: '50%',
          marginLeft: -136,
          width: 272,
          height: 520,
          background: '#161624',
          border: `4px solid #0a0a12`,
          borderRadius: 44,
          boxShadow: `0 40px 120px rgba(0,0,0,0.8), 0 0 60px ${NEON_BLUE}`,
          transform: `translateY(${mix(100, 0, phoneUp).toFixed(1)}px) rotate(${mix(8, 0, phoneUp).toFixed(1)}deg)`,
          opacity: clamp(phoneUp * 1.8),
          padding: '26px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 22, fontWeight: 900 }}>تابلو</span>
          <span
            style={{
              ...MONO,
              fontSize: 12,
              background: NEON_GREEN,
              color: '#0a0a12',
              borderRadius: 8,
              padding: '3px 10px',
              fontWeight: 800,
            }}
          >
            LIVE
          </span>
        </div>
        {/* live counter */}
        <div
          style={{
            background: PAPER_WHITE,
            borderRadius: 16,
            padding: '16px 20px',
            border: `2px solid ${NEON_BLUE}`,
            boxShadow: `0 0 30px ${NEON_BLUE}`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: NEON_BLUE, marginBottom: 6 }}>
            فروش لحظه‌ای
          </div>
          <div
            style={{
              ...MONO,
              fontSize: 40,
              fontWeight: 900,
              color: '#0a0a12',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {faNumber(Math.round(12850000 * counterP))}
          </div>
        </div>
        {/* low stock alert */}
        <div
          style={{
            background: NEON_PINK,
            borderRadius: 14,
            padding: '12px 18px',
            opacity: alertP,
            transform: `scale(${mix(0.5, 1, alertP).toFixed(3)})`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: PAPER_WHITE,
              fontSize: 15,
              fontWeight: 800,
            }}
          >
            <span style={{ width: 10, height: 10, background: PAPER_WHITE, borderRadius: '50%' }} />
            <span>انبار پایین: کالای مصرفی کد ۳۰۳</span>
          </div>
        </div>
        {/* profit line */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: PAPER_WHITE,
            fontSize: 14,
            fontWeight: 700,
            opacity: clamp(progress(t, 4.0, 5.2)),
          }}
        >
          <span style={{ color: NEON_GREEN }}>۱۲٬۸۵۰٬۰۰۰</span>
          <span style={{ color: '#666677' }}>−</span>
          <span style={{ color: NEON_PINK }}>۷٬۶۱۰٬۰۰۰</span>
          <span style={{ color: NEON_BLUE }}> = ۵٬۲۴۰٬۰۰۰ سود</span>
        </div>
      </div>
    </DarkStage>
  )
}

// ─── Scene 5 — Split screen: chaos left, clean right, sweep line ─────────

export function DistilSplitScene({ t, scene }: { t: number; scene: Scene }) {
  const sweep = ease(clamp(progress(t, 0.8, 2.6)))
  return (
    <DarkStage scene={scene} t={t} label="// 05 — تقسیم">
      {/* left: chaotic papers (dimmed) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.45,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
        }}
      />
      {CHAOS_PAPERS.map((paper, i) => (
        <PaperSheet
          key={i}
          t={t}
          at={0}
          dx={paper.dx - 180}
          dy={paper.dy}
          dz={paper.dz}
          rx={paper.rx}
          ry={paper.ry}
          rz={paper.rz}
          delay={0}
          w={140}
          h={180}
        />
      ))}
      {/* right: clean dashboard card */}
      <div
        style={{
          position: 'absolute',
          top: 420,
          insetInlineStart: `calc(50% + 90px)`,
          width: 260,
          height: 340,
          background: PAPER_WHITE,
          borderRadius: 24,
          boxShadow: `0 40px 120px rgba(0,0,0,0.5)`,
          border: `2px solid ${NEON_GREEN}`,
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          opacity: clamp(progress(t, 0.5, 1.4)) * 0.95,
          transform: `translateX(${mix(-40, 0, ease(clamp(progress(t, 0.5, 1.4)))).toFixed(1)}px)`,
        }}
      >
        {['فروش:', 'انبار:', 'سود:'].map((label, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            <span style={{ color: '#161624' }}>{label}</span>
            <span style={{ color: NEON_GREEN, ...MONO, fontWeight: 900 }}>
              {i === 0 ? '۱۲٬۸۵۰٬۰۰۰' : i === 1 ? '۳۴۸' : '+۲۴٪'}
            </span>
          </div>
        ))}
      </div>
      {/* sweep line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          insetInlineStart: `calc(50% + ${mix(-270, 0, sweep)}px)`,
          width: 4,
          background: `linear-gradient(to bottom, ${NEON_PINK}, ${NEON_BLUE}, ${NEON_GREEN})`,
          boxShadow: `0 0 40px #ffffff`,
          transform: `scaleY(${mix(0, 1, sweep)})`,
          opacity: clamp(sweep * 1.4),
        }}
      />
      {/* text */}
      <KineticWord
        t={t}
        at={1.6}
        text="کمتر"
        x="50%"
        y="780"
        size={40}
        accent={true}
        color={NEON_PINK}
      />
      <KineticWord t={t} at={2.1} text="حدس بزن." x="50%" y="830" size={40} accent={false} />
      <KineticWord
        t={t}
        at={2.7}
        text="بیشتر"
        x="50%"
        y="880"
        size={40}
        accent={true}
        color={NEON_GREEN}
      />
      <KineticWord t={t} at={3.2} text="بدون." x="50%" y="930" size={40} accent={false} />
    </DarkStage>
  )
}

// ─── Scene 6 — Logo converge: final lockup + CTA ─────────────────────────

export function DistilLogoScene({ t, scene }: { t: number; scene: Scene }) {
  const converge = ease(clamp(progress(t, 0.4, 1.8)))
  const mark = pop(t, 1.0)
  const cta = clamp(progress(t, 2.6, 0.8))
  return (
    <DarkStage scene={scene} t={t} label="// 06 — accumulating">
      {/* converging elements */}
      <div
        style={{
          position: 'absolute',
          top: mix(400, 340, converge),
          insetInlineStart: '50%',
          transform: `translate(-50%, -50%) scale(${mix(0.2, 1, converge).toFixed(3)})`,
          opacity: clamp(converge * 1.5),
          display: 'flex',
          gap: 14,
          justifyContent: 'center',
        }}
      >
        <NeonBar t={t} at={0} x={-40} color={NEON_GREEN} height={160} />
        <NeonBar t={t} at={0.15} x={0} color={NEON_BLUE} height={160} />
        <NeonBar t={t} at={0.3} x={40} color={NEON_PINK} height={160} />
      </div>
      {/* logo */}
      <div
        style={{
          position: 'absolute',
          top: 380,
          insetInlineStart: '50%',
          transform: `translate(-50%, -50%) scale(${mix(0.3, 1, mark).toFixed(3)})`,
          opacity: clamp(mark * 1.8),
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 900, letterSpacing: '-0.02em' }}>حسابچه</div>
        <div
          style={{
            width: `${mix(0, 240, mark).toFixed(0)}px`,
            height: 8,
            background: `linear-gradient(to right, ${NEON_GREEN}, ${NEON_BLUE}, ${NEON_PINK})`,
            borderRadius: 6,
            margin: '18px auto 0',
            boxShadow: `0 0 40px #ffffff`,
            opacity: mark,
          }}
        />
        <div
          style={{
            ...MONO,
            marginTop: 20,
            fontSize: 16,
            letterSpacing: '0.2em',
            opacity: mark * 0.8,
          }}
        >
          CLOUD · SIMPLE · FAST
        </div>
      </div>
      {/* final text */}
      <KineticWord
        t={t}
        at={1.4}
        text="حسابچه؛"
        x="50%"
        y="560"
        size={36}
        accent={true}
        color={NEON_GREEN}
      />
      <KineticWord
        t={t}
        at={2.0}
        text="عددها معنی پیدا می‌کنن."
        x="50%"
        y="610"
        size={32}
        accent={false}
      />
      {/* CTA */}
      <div
        style={{
          position: 'absolute',
          bottom: 130,
          insetInlineStart: '50%',
          transform: `translate(-50%, -50%) scale(${mix(0.2, 1, cta).toFixed(3)}) rotate(${mix(-8, 0, cta).toFixed(1)}deg)`,
          opacity: cta,
        }}
      >
        <div
          style={{
            background: NEON_BLUE,
            color: PAPER_WHITE,
            fontSize: 34,
            fontWeight: 900,
            padding: '14px 60px',
            borderRadius: 26,
            boxShadow: `0 0 40px ${NEON_BLUE}, 12px 12px 0 #0a0a12`,
            border: `2px solid #0a0a12`,
          }}
        >
          شروع کن
        </div>
      </div>
    </DarkStage>
  )
}
