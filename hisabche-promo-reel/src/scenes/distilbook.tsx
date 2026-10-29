// ============================================
// DistilBook Art Direction (Reel 85) — World-Class SaaS Motion
// Fractional Cryogenic Distillation & Precision Analytical Ledger
//
// Palette: Dark Obsidian (#08090f), Laser Emerald (#00FF9F),
// Electric Cyan (#00B4FF), Radical Magenta (#FF4D9E), Amber (#FFB800)
// High-depth 3D perspective, zero hold-frame overlap,
// strict physical container-local coordinates, no comic characters.
// ============================================

import type { CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, mix, progress, spring, deterministicHash } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

export const DARK = '#08090f'
export const NEON_GREEN = '#00FF9F'
export const NEON_BLUE = '#00B4FF'
export const NEON_PINK = '#FF4D9E'
const NEON_AMBER = '#FFB800'
export const PAPER_WHITE = '#ffffff'
const BORDER_GLASS = 'rgba(255, 255, 255, 0.08)'

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

/** Root Dark Stage: Strictly LTR pinned to avoid RTL mirror flip */
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
        background: 'radial-gradient(circle at 50% 25%, #111524 0%, #08090f 75%, #040508 100%)',
        overflow: 'hidden',
        color: '#ffffff',
        direction: 'ltr',
      }}
    >
      {/* Precision grid background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage:
            'linear-gradient(rgba(0, 255, 159, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 180, 255, 0.4) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* Top HUD */}
      <div
        style={{
          ...MONO,
          position: 'absolute',
          top: 24,
          left: 28,
          fontSize: 12,
          letterSpacing: '0.12em',
          color: NEON_BLUE,
          opacity: 0.8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: NEON_GREEN,
            boxShadow: `0 0 10px ${NEON_GREEN}`,
          }}
        />
        {label}
      </div>
      <div
        style={{
          ...MONO,
          position: 'absolute',
          top: 24,
          right: 28,
          fontSize: 12,
          color: 'rgba(255, 255, 255, 0.5)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <Timecode t={scene.start + t} />
      </div>

      {children}
    </div>
  )
}

/** 3D perspective wrapper */
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

/** Smooth spring helper */
function pop(t: number, at: number, dur = 0.5): number {
  return spring(clamp(progress(t, at, at + dur)) * 1.12)
}

/** Floating 3D paper shards */
function PaperShard({
  t,
  at,
  dx,
  dy,
  dz,
  rx,
  ry,
  rz,
  w = 140,
  h = 180,
  delay = 0,
  glowColor = NEON_PINK,
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
  glowColor?: string
}) {
  const p = ease(clamp(progress(t, at + delay, at + delay + 1.2)))
  const sway = Math.sin((t - at) * 1.2 + dy * 0.02) * 6
  const s = mix(0.4, 1, p)
  return (
    <div
      style={{
        position: 'absolute',
        top: mix(700, dy, p),
        left: `calc(50% + ${dx + sway}px)`,
        width: w * s,
        height: h * s,
        marginLeft: -(w * s) / 2,
        transform: `translateZ(${dz}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`,
        transformStyle: 'preserve-3d',
        opacity: clamp(p * 1.6),
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(145deg, rgba(22, 26, 38, 0.95), rgba(12, 14, 22, 0.98))',
          borderRadius: 12,
          border: `1px solid ${glowColor}`,
          boxShadow: `0 20px 50px rgba(0,0,0,0.8), 0 0 25px ${glowColor}22`,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div
          style={{ height: 8, width: '70%', background: glowColor, borderRadius: 4, opacity: 0.8 }}
        />
        <div
          style={{ height: 6, width: '45%', background: 'rgba(255,255,255,0.2)', borderRadius: 3 }}
        />
        <div
          style={{ height: 6, width: '85%', background: 'rgba(255,255,255,0.15)', borderRadius: 3 }}
        />
        <div
          style={{
            ...MONO,
            fontSize: 10,
            color: glowColor,
            marginTop: 'auto',
            textAlign: 'right',
            opacity: 0.9,
          }}
        >
          {faNumber(1250000)}
        </div>
      </div>
    </div>
  )
}

/** Precision Concentric Data Ring */
function DataRing({
  t,
  at,
  cx,
  cy,
  radius,
  color,
  count = 24,
}: {
  t: number
  at: number
  cx: number
  cy: number
  radius: number
  color: string
  count?: number
}) {
  const p = ease(clamp(progress(t, at, at + 1.2)))
  return (
    <div
      style={{
        position: 'absolute',
        top: cy - radius * p,
        left: cx - radius * p,
        width: radius * 2 * p,
        height: radius * 2 * p,
        border: `1.5px dashed ${color}`,
        borderRadius: '50%',
        opacity: clamp(p * 1.5),
        boxShadow: `0 0 ${25 * p}px ${color}33`,
        transform: `rotate(${t * 30}deg)`,
        transformOrigin: 'center center',
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2
        const px = Math.cos(angle) * radius * p
        const py = Math.sin(angle) * radius * p
        const bright = deterministicHash(i, 85) > 0.6 ? 1 : 0.3
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 3.5,
              height: 3.5,
              background: color,
              borderRadius: '50%',
              boxShadow: `0 0 8px ${color}`,
              transform: `translate(${px}px, ${py}px) translate(-50%, -50%)`,
              opacity: bright,
            }}
          />
        )
      })}
    </div>
  )
}

// ─── Scene 1 — Chaos: Frame-0 Visual Arrest & Confusion ──────────────────

const CHAOS_PAPERS = [
  { dx: -180, dy: 380, dz: -50, rx: 14, ry: -10, rz: -12, delay: 0.0, glowColor: NEON_PINK },
  { dx: 180, dy: 350, dz: 40, rx: -10, ry: 15, rz: 10, delay: 0.1, glowColor: NEON_AMBER },
  { dx: -130, dy: 540, dz: 80, rx: 8, ry: -8, rz: -16, delay: 0.2, glowColor: NEON_PINK },
  { dx: 140, dy: 590, dz: -30, rx: -14, ry: 12, rz: 12, delay: 0.3, glowColor: NEON_AMBER },
  { dx: -70, dy: 460, dz: 100, rx: 12, ry: -5, rz: -8, delay: 0.15, glowColor: NEON_PINK },
  { dx: 90, dy: 490, dz: -40, rx: -8, ry: 10, rz: 8, delay: 0.25, glowColor: NEON_AMBER },
]

export function DistilChaosScene({ t, scene }: { t: number; scene: Scene }) {
  const p1 = pop(t, 0.2)
  const p2 = pop(t, 0.9)
  const p3 = pop(t, 1.8)
  const shake = t < 1.2 ? Math.sin(t * 40) * (1.2 - t) * 6 : 0

  return (
    <DarkStage scene={scene} t={t} label="// 01 · آشفتگی دفاتر سنتی">
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${shake}px, ${shake * 0.5}px)`,
        }}
      >
        <Stage3D>
          {CHAOS_PAPERS.map((paper, i) => (
            <PaperShard key={i} t={t} at={paper.delay} {...paper} />
          ))}
        </Stage3D>

        {/* Top Typographic Cluster (Zero overlap, strictly pinned at top 140..290) */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 130,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 34,
              fontWeight: 900,
              color: '#ffffff',
              opacity: clamp(p1 * 1.5),
              transform: `scale(${mix(0.8, 1, p1).toFixed(3)})`,
            }}
          >
            فروختی…
          </div>

          <div
            style={{
              fontSize: 34,
              fontWeight: 900,
              color: 'rgba(255,255,255,0.7)',
              opacity: clamp(p2 * 1.5),
              transform: `scale(${mix(0.8, 1, p2).toFixed(3)})`,
            }}
          >
            خرج کردی…
          </div>

          <div
            style={{
              fontSize: 38,
              fontWeight: 900,
              color: '#ffffff',
              background: `linear-gradient(135deg, ${NEON_PINK}, #D60065)`,
              padding: '8px 28px',
              borderRadius: 16,
              boxShadow: `0 0 35px ${NEON_PINK}66`,
              opacity: clamp(p3 * 1.5),
              transform: `scale(${mix(0.7, 1, p3).toFixed(3)})`,
            }}
          >
            ولی آخرش چقدر موند؟
          </div>
        </div>

        {/* Central Anomaly Beacon */}
        <div
          style={{
            position: 'absolute',
            top: 730,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(255, 77, 158, 0.12)',
            border: `1px solid ${NEON_PINK}`,
            borderRadius: 30,
            padding: '10px 24px',
            opacity: clamp(p3 * 1.2),
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: NEON_PINK,
              boxShadow: `0 0 15px ${NEON_PINK}`,
            }}
          />
          <span style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }} dir="rtl">
            سود واقعی زیر انبوه فاکتور پنهان است
          </span>
        </div>
      </div>
    </DarkStage>
  )
}

// ─── Scene 2 — Freeze & Laser Condenser: Fractional Distillation ─────────

export function DistilFreezeScene({ t, scene }: { t: number; scene: Scene }) {
  const flash = ease(clamp(progress(t, 0.2, 0.7)))
  const columnsP = ease(clamp(progress(t, 0.8, 2.2)))
  const logoP = pop(t, 2.3)

  return (
    <DarkStage scene={scene} t={t} label="// 02 · تقطیر و استخراج هوشمند">
      {/* Central Cryogenic Distillation Core */}
      <DataRing t={t} at={0.4} cx={270} cy={350} radius={130} color={NEON_BLUE} />
      <DataRing t={t} at={0.6} cx={270} cy={350} radius={190} color={NEON_GREEN} />
      <DataRing t={t} at={0.8} cx={270} cy={350} radius={240} color={NEON_PINK} />

      {/* Volumetric center burst */}
      <div
        style={{
          position: 'absolute',
          top: 350,
          left: 270,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: `0 0 ${mix(10, 80, flash)}px ${mix(0, 40, flash)}px ${NEON_BLUE}`,
          transform: 'translate(-50%, -50%)',
          opacity: flash,
        }}
      />

      {/* 3 Fractional Vertical Columns (Left to Right) */}
      <div
        style={{
          position: 'absolute',
          top: 180,
          left: 54,
          right: 54,
          height: 340,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          pointerEvents: 'none',
        }}
      >
        {/* Column 1: Gross Sales */}
        <div
          style={{
            width: 120,
            height: mix(0, 310, columnsP),
            background: `linear-gradient(to top, ${NEON_GREEN}33, ${NEON_GREEN}05)`,
            border: `1.5px solid ${NEON_GREEN}`,
            borderRadius: '16px 16px 6px 6px',
            boxShadow: `0 0 25px ${NEON_GREEN}44`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: 12,
            opacity: columnsP,
          }}
        >
          <div
            dir="rtl"
            style={{ fontSize: 13, fontWeight: 900, color: NEON_GREEN, marginBottom: 4 }}
          >
            فروش کل
          </div>
          <div style={{ ...MONO, fontSize: 13, fontWeight: 800, color: '#ffffff' }}>
            {faNumber(12850000)}
          </div>
        </div>

        {/* Column 2: Cost of Sales */}
        <div
          style={{
            width: 120,
            height: mix(0, 220, columnsP),
            background: `linear-gradient(to top, ${NEON_PINK}33, ${NEON_PINK}05)`,
            border: `1.5px solid ${NEON_PINK}`,
            borderRadius: '16px 16px 6px 6px',
            boxShadow: `0 0 25px ${NEON_PINK}44`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: 12,
            opacity: columnsP,
          }}
        >
          <div
            dir="rtl"
            style={{ fontSize: 13, fontWeight: 900, color: NEON_PINK, marginBottom: 4 }}
          >
            بهای تمام‌شده
          </div>
          <div style={{ ...MONO, fontSize: 13, fontWeight: 800, color: '#ffffff' }}>
            {faNumber(7610000)}
          </div>
        </div>

        {/* Column 3: Pure Net Profit */}
        <div
          style={{
            width: 140,
            height: mix(0, 360, columnsP),
            background: `linear-gradient(to top, ${NEON_BLUE}44, ${NEON_BLUE}08)`,
            border: `2px solid ${NEON_BLUE}`,
            borderRadius: '16px 16px 6px 6px',
            boxShadow: `0 0 35px ${NEON_BLUE}66`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: 12,
            opacity: columnsP,
          }}
        >
          <div
            dir="rtl"
            style={{ fontSize: 14, fontWeight: 900, color: NEON_BLUE, marginBottom: 4 }}
          >
            سود خالص
          </div>
          <div style={{ ...MONO, fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
            {faNumber(5240000)}
          </div>
        </div>
      </div>

      {/* Brand Lockup Below (Guaranteed safe band 600..820) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 600,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          opacity: clamp(logoP * 1.5),
          transform: `scale(${mix(0.85, 1, logoP).toFixed(3)})`,
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.02em',
          }}
        >
          حسابچه
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: NEON_GREEN,
            background: 'rgba(0, 255, 159, 0.1)',
            border: `1px solid ${NEON_GREEN}44`,
            borderRadius: 24,
            padding: '6px 22px',
          }}
        >
          تبدیل داده خام به هوش مالی زنده
        </div>
      </div>
    </DarkStage>
  )
}

// ─── Scene 3 — Clean 3D Metric Cards (2x2 Disjoint Grid) ─────────────────

interface MetricCardProps {
  label: string
  val: string
  sub: string
  color: string
  x: number
  y: number
  t: number
  at: number
}

function MetricCard({ label, val, sub, color, x, y, t, at }: MetricCardProps) {
  const p = pop(t, at, 0.6)
  const countP = ease(clamp(progress(t, at + 0.2, at + 1.2)))
  const isPercent = val.includes('٪')
  const rawNum = Number(val.replace(/[^0-9]/g, ''))

  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: x,
        width: 226,
        height: 184,
        background: 'linear-gradient(145deg, #101422, #0a0d16)',
        borderRadius: 20,
        border: `1.5px solid ${color}`,
        boxShadow: `0 20px 45px rgba(0,0,0,0.7), 0 0 25px ${color}22`,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        opacity: clamp(p * 1.6),
        transform: `translateY(${mix(40, 0, p).toFixed(1)}px) scale(${mix(0.85, 1, p).toFixed(3)})`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 10px ${color}`,
          }}
        />
        <span dir="rtl" style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>
          {label}
        </span>
      </div>

      <div
        style={{
          ...MONO,
          fontSize: isPercent ? 36 : 28,
          fontWeight: 900,
          color: color,
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'right',
          lineHeight: 1.1,
        }}
      >
        {isPercent ? `+${faNumber(24)}٪` : faNumber(Math.round(rawNum * countP))}
      </div>

      <div
        dir="rtl"
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.45)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: 8,
        }}
      >
        {sub}
      </div>
    </div>
  )
}

export function DistilCardsScene({ t, scene }: { t: number; scene: Scene }) {
  const summaryP = pop(t, 1.4)

  return (
    <DarkStage scene={scene} t={t} label="// 03 · ترازنامه چهارگانه شفاف">
      {/* 2x2 Guaranteed Disjoint Grid:
          Col 1: left 34, w 226 (spans 34..260)
          Col 2: left 280, w 226 (spans 280..506)
          Row 1: top 180, h 184 (spans 180..364)
          Row 2: top 394, h 184 (spans 394..578)
          Safe Gap: 20px horizontally, 30px vertically
      */}
      <MetricCard
        label="فروش امروز"
        val="۱۲٬۸۵۰٬۰۰۰"
        sub="۳۸ تراکنش موفق"
        color={NEON_GREEN}
        x={34}
        y={180}
        t={t}
        at={0.2}
      />
      <MetricCard
        label="موجودی کالا"
        val="۳۴۸"
        sub="اقلام در انبار مرکزی"
        color={NEON_BLUE}
        x={280}
        y={180}
        t={t}
        at={0.4}
      />
      <MetricCard
        label="حاشیه سود"
        val="+۲۴٪"
        sub="سود خالص خالص"
        color={NEON_PINK}
        x={34}
        y={394}
        t={t}
        at={0.6}
      />
      <MetricCard
        label="مطالبات معوق"
        val="۸٬۴۰۰٬۰۰۰"
        sub="وصولی در سررسید"
        color={NEON_AMBER}
        x={280}
        y={394}
        t={t}
        at={0.8}
      />

      {/* Disjoint Bottom Ledger Bar (top 630..760) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 630,
          left: 34,
          right: 34,
          background: 'rgba(16, 20, 34, 0.9)',
          border: `1.5px solid ${BORDER_GLASS}`,
          borderRadius: 20,
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          opacity: clamp(summaryP * 1.5),
          transform: `translateY(${mix(30, 0, summaryP).toFixed(1)}px)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: `${NEON_GREEN}22`,
              border: `1px solid ${NEON_GREEN}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              color: NEON_GREEN,
            }}
          >
            ✓
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
              ترازنامه لحظه‌ای همگام
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
              تمامی دفاتر بدون خطای انطباق تراز شدند
            </div>
          </div>
        </div>
        <div
          style={{
            ...MONO,
            fontSize: 12,
            background: `${NEON_GREEN}22`,
            color: NEON_GREEN,
            padding: '4px 12px',
            borderRadius: 8,
            fontWeight: 800,
          }}
        >
          BALANCED
        </div>
      </div>
    </DarkStage>
  )
}

// ─── Scene 4 — Titanium Mobile Cockpit: Local Coordinate System ──────────

export function DistilPhoneScene({ t, scene }: { t: number; scene: Scene }) {
  const phoneP = pop(t, 0.2, 0.8)
  const counterP = ease(clamp(progress(t, 1.2, 2.8)))
  const alertP = pop(t, 3.2, 0.6)
  const mathP = pop(t, 5.0, 0.6)
  const syncP = pop(t, 7.2, 0.6)

  return (
    <DarkStage scene={scene} t={t} label="// 04 · کاک‌پیت موبایل حسابچه">
      {/* Mobile Frame: strictly local coordinates (Defect Law #8) */}
      <div
        style={{
          position: 'absolute',
          top: 130,
          left: 100,
          width: 340,
          height: 680,
          background: '#0c0f18',
          border: '4px solid #222738',
          borderRadius: 48,
          boxShadow: `0 40px 100px rgba(0,0,0,0.9), 0 0 50px ${NEON_BLUE}22`,
          overflow: 'hidden',
          opacity: clamp(phoneP * 1.5),
          transform: `translateY(${mix(60, 0, phoneP).toFixed(1)}px)`,
          direction: 'ltr',
        }}
      >
        {/* Notch / Speaker bar */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 90,
            height: 6,
            background: '#1a1f30',
            borderRadius: 4,
          }}
        />

        {/* Local App Header (top: 36, h: 44) */}
        <div
          style={{
            position: 'absolute',
            top: 36,
            left: 20,
            right: 20,
            height: 44,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              ...MONO,
              fontSize: 11,
              background: `${NEON_GREEN}22`,
              color: NEON_GREEN,
              border: `1px solid ${NEON_GREEN}`,
              borderRadius: 6,
              padding: '3px 8px',
              fontWeight: 800,
            }}
          >
            LIVE SYNC
          </span>
          <span dir="rtl" style={{ fontSize: 18, fontWeight: 900, color: '#ffffff' }}>
            داشبورد زنده
          </span>
        </div>

        {/* Card 1: Real-time Sales Counter (top: 96, h: 140) */}
        <div
          style={{
            position: 'absolute',
            top: 96,
            left: 20,
            right: 20,
            height: 140,
            background: 'linear-gradient(145deg, #131826, #0e121e)',
            border: `1.5px solid ${NEON_BLUE}`,
            borderRadius: 22,
            padding: 16,
            boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 25px ${NEON_BLUE}22`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ ...MONO, fontSize: 11, color: NEON_BLUE }}>TODAY REVENUE</span>
            <span dir="rtl" style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
              فروش لحظه‌ای
            </span>
          </div>

          <div
            style={{
              ...MONO,
              fontSize: 34,
              fontWeight: 900,
              color: '#ffffff',
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {faNumber(Math.round(12850000 * counterP))}
          </div>

          {/* Micro sparkline bar */}
          <div
            style={{
              height: 6,
              width: '100%',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${counterP * 100}%`,
                background: `linear-gradient(90deg, ${NEON_BLUE}, ${NEON_GREEN})`,
              }}
            />
          </div>
        </div>

        {/* Card 2: Low Stock Warning (top: 252, h: 84) */}
        <div
          style={{
            position: 'absolute',
            top: 252,
            left: 20,
            right: 20,
            height: 84,
            background: 'linear-gradient(145deg, rgba(255, 184, 0, 0.12), #141720)',
            border: `1.5px solid ${NEON_AMBER}`,
            borderRadius: 18,
            padding: 14,
            opacity: clamp(alertP * 1.5),
            transform: `scale(${mix(0.85, 1, alertP).toFixed(3)})`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `${NEON_AMBER}22`,
              border: `1px solid ${NEON_AMBER}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: NEON_AMBER,
              fontSize: 16,
              fontWeight: 900,
            }}
          >
            !
          </div>
          <div dir="rtl" style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: NEON_AMBER }}>
              هشدار موجودی حداقل
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
              کالای استاندارد کد ۱۰۱ (کمتر از ۵ عدد)
            </div>
          </div>
        </div>

        {/* Card 3: Exact Net Profit Equation (top: 352, h: 120) */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 352,
            left: 20,
            right: 20,
            height: 120,
            background: 'linear-gradient(145deg, #111624, #0a0d16)',
            border: `1.5px solid ${NEON_GREEN}`,
            borderRadius: 20,
            padding: 14,
            opacity: clamp(mathP * 1.5),
            transform: `scale(${mix(0.85, 1, mathP).toFixed(3)})`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>
            محاسبه قطعی سود عملیاتی:
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              ...MONO,
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            <span style={{ color: NEON_GREEN }}>{faNumber(12850000)}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>−</span>
            <span style={{ color: NEON_PINK }}>{faNumber(7610000)}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>=</span>
            <span
              style={{
                color: '#ffffff',
                background: `${NEON_GREEN}33`,
                padding: '3px 8px',
                borderRadius: 6,
              }}
            >
              {faNumber(5240000)}
            </span>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: NEON_GREEN, textAlign: 'left' }}>
            سود قطعی +۲۴٪ تایید شد
          </div>
        </div>

        {/* Card 4: Double Entry Auto Settle (top: 488, h: 80) */}
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 488,
            left: 20,
            right: 20,
            height: 80,
            background: 'rgba(0, 255, 159, 0.08)',
            border: `1.5px solid ${NEON_GREEN}`,
            borderRadius: 18,
            padding: 14,
            opacity: clamp(syncP * 1.5),
            transform: `translateY(${mix(20, 0, syncP).toFixed(1)}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: NEON_GREEN,
              color: '#08090f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 16,
            }}
          >
            ✓
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>
              ثبت سند دوبل حسابداری
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
              همگام‌سازی لحظه‌ای با انبار و دفاتر
            </div>
          </div>
        </div>

        {/* Cockpit Home Indicator Bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 120,
            height: 4,
            background: 'rgba(255,255,255,0.25)',
            borderRadius: 2,
          }}
        />
      </div>
    </DarkStage>
  )
}

// ─── Scene 5 — Dual Phase Transformation & Laser Sweep Blade ─────────────

export function DistilSplitScene({ t, scene }: { t: number; scene: Scene }) {
  const sweep = ease(clamp(progress(t, 0.6, 2.8)))
  const bladeX = mix(40, 500, sweep)

  const textP1 = pop(t, 1.4)
  const textP2 = pop(t, 2.0)

  return (
    <DarkStage scene={scene} t={t} label="// 05 · انتقال از سردرگمی به نظم">
      {/* Left Chamber: Old Chaos (0 to bladeX) */}
      <div
        style={{
          position: 'absolute',
          top: 160,
          left: 40,
          width: Math.max(0, bladeX - 40),
          height: 480,
          background: 'linear-gradient(135deg, rgba(255, 77, 158, 0.08), rgba(20, 10, 16, 0.95))',
          borderRadius: '24px 0 0 24px',
          border: '1.5px solid rgba(255, 77, 158, 0.3)',
          borderRight: 'none',
          overflow: 'hidden',
          padding: 24,
        }}
      >
        <div
          dir="rtl"
          style={{ fontSize: 18, fontWeight: 900, color: NEON_PINK, marginBottom: 16 }}
        >
          دفاتر دستی و نامنظم
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: 0.5 }}>
          {['کسری نامعلوم دخل', 'خطای دستی محاسبه انبار', 'گم شدن فاکتور نسیه'].map((item, idx) => (
            <div
              key={idx}
              dir="rtl"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px dashed rgba(255, 77, 158, 0.4)',
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 13,
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              ✕ {item}
            </div>
          ))}
        </div>
      </div>

      {/* Right Chamber: Hisabche Precision (bladeX to 500) */}
      <div
        style={{
          position: 'absolute',
          top: 160,
          left: bladeX,
          width: Math.max(0, 500 - bladeX),
          height: 480,
          background: 'linear-gradient(135deg, rgba(0, 255, 159, 0.08), rgba(10, 20, 16, 0.95))',
          borderRadius: '0 24px 24px 0',
          border: '1.5px solid rgba(0, 255, 159, 0.4)',
          borderLeft: 'none',
          overflow: 'hidden',
          padding: 24,
        }}
      >
        <div
          dir="rtl"
          style={{ fontSize: 18, fontWeight: 900, color: NEON_GREEN, marginBottom: 16 }}
        >
          نظم هوشمند حسابچه
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'سود خالص قطعی:', val: '+۲۴٪' },
            { label: 'انبار خودکار:', val: '۳۴۸ قلم' },
            { label: 'ثبت دوبل لحظه‌ای:', val: 'تراز ۱۰۰٪' },
          ].map((item, idx) => (
            <div
              key={idx}
              dir="rtl"
              style={{
                background: 'rgba(0, 255, 159, 0.06)',
                border: '1px solid rgba(0, 255, 159, 0.3)',
                borderRadius: 12,
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                fontWeight: 800,
                color: '#ffffff',
              }}
            >
              <span>{item.label}</span>
              <span style={{ color: NEON_GREEN, ...MONO }}>{item.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Travelling Photonic Laser Blade */}
      <div
        style={{
          position: 'absolute',
          top: 140,
          left: bladeX - 2,
          width: 4,
          height: 520,
          background: `linear-gradient(to bottom, transparent, ${NEON_BLUE}, #ffffff, ${NEON_GREEN}, transparent)`,
          boxShadow: `0 0 25px 8px ${NEON_BLUE}88, 0 0 40px 12px ${NEON_GREEN}66`,
          borderRadius: 2,
        }}
      />

      {/* Safe Typographic Anchor Below (y: 690..840) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 690,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 34,
            fontWeight: 900,
            color: '#ffffff',
            opacity: clamp(textP1 * 1.5),
            transform: `scale(${mix(0.8, 1, textP1).toFixed(3)})`,
          }}
        >
          کمتر حدس بزن…
        </div>

        <div
          style={{
            fontSize: 36,
            fontWeight: 900,
            color: '#08090f',
            background: `linear-gradient(135deg, ${NEON_GREEN}, ${NEON_BLUE})`,
            padding: '8px 36px',
            borderRadius: 18,
            boxShadow: `0 0 35px ${NEON_GREEN}66`,
            opacity: clamp(textP2 * 1.5),
            transform: `scale(${mix(0.8, 1, textP2).toFixed(3)})`,
          }}
        >
          بیشتر مطمئن باش!
        </div>
      </div>
    </DarkStage>
  )
}

// ─── Scene 6 — Architectural Brand Monolith & CTA ────────────────────────

export function DistilLogoScene({ t, scene }: { t: number; scene: Scene }) {
  const monolithP = pop(t, 0.3, 0.8)
  const barsP = ease(clamp(progress(t, 0.6, 1.8)))
  const ctaP = pop(t, 2.2, 0.7)

  return (
    <DarkStage scene={scene} t={t} label="// 06 · حسابچه هوشمند">
      {/* Volumetric Center Monolith */}
      <div
        style={{
          position: 'absolute',
          top: 240,
          left: '50%',
          transform: `translateX(-50%) scale(${mix(0.8, 1, monolithP).toFixed(3)})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: clamp(monolithP * 1.6),
        }}
      >
        {/* 3 Prismatic Neon Trinity Bars */}
        <div style={{ display: 'flex', gap: 14, height: 120, alignItems: 'center' }}>
          <div
            style={{
              width: 14,
              height: mix(0, 110, barsP),
              background: NEON_GREEN,
              borderRadius: 7,
              boxShadow: `0 0 25px ${NEON_GREEN}`,
            }}
          />
          <div
            style={{
              width: 14,
              height: mix(0, 140, barsP),
              background: NEON_BLUE,
              borderRadius: 7,
              boxShadow: `0 0 30px ${NEON_BLUE}`,
            }}
          />
          <div
            style={{
              width: 14,
              height: mix(0, 95, barsP),
              background: NEON_PINK,
              borderRadius: 7,
              boxShadow: `0 0 25px ${NEON_PINK}`,
            }}
          />
        </div>

        {/* Master Brand Name */}
        <div
          dir="rtl"
          style={{
            fontSize: 68,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            marginTop: 20,
            textShadow: '0 10px 40px rgba(0,0,0,0.8)',
          }}
        >
          حسابچه
        </div>

        {/* Specular underline */}
        <div
          style={{
            width: mix(0, 240, barsP),
            height: 4,
            background: `linear-gradient(90deg, ${NEON_GREEN}, ${NEON_BLUE}, ${NEON_PINK})`,
            borderRadius: 2,
            boxShadow: '0 0 15px rgba(255,255,255,0.8)',
            marginTop: 8,
          }}
        />

        <div
          style={{
            ...MONO,
            fontSize: 13,
            letterSpacing: '0.22em',
            color: 'rgba(255,255,255,0.6)',
            marginTop: 14,
          }}
        >
          FINANCIAL PRECISION · CLOUD ERP
        </div>
      </div>

      {/* Slogan */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 570,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 24,
          fontWeight: 800,
          color: 'rgba(255,255,255,0.9)',
          opacity: clamp(monolithP * 1.4),
        }}
      >
        وقتی عددها بالاخره معنی پیدا می‌کنند.
      </div>

      {/* Tactile Primary Action Call (bottom 160..240) */}
      <div
        style={{
          position: 'absolute',
          bottom: 150,
          left: '50%',
          transform: `translateX(-50%) scale(${mix(0.8, 1, ctaP).toFixed(3)})`,
          opacity: clamp(ctaP * 1.5),
        }}
      >
        <div
          dir="rtl"
          style={{
            background: `linear-gradient(135deg, ${NEON_GREEN}, #00CC7E)`,
            color: '#08090f',
            fontSize: 32,
            fontWeight: 900,
            padding: '16px 64px',
            borderRadius: 24,
            boxShadow: `0 20px 60px ${NEON_GREEN}55, 0 0 30px ${NEON_GREEN}44`,
            border: '2px solid #ffffff',
            whiteSpace: 'nowrap',
          }}
        >
          شروع رایگان
        </div>
      </div>
    </DarkStage>
  )
}
