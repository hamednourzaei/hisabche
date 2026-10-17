// ============================================
// Reel #56 — Continuous-Line Word-Synchronized Actors
//
// Studio-Grade Motion Architecture (Apple/Linear-Grade SaaS):
// - Fluid Spring Physics & Inertia (stiffness: 140, damping: 18)
// - Volumetric Glowing Bézier Wave with flowing ambient particle nodes
// - Isometric / 2.5D Layered Split View with dynamic Balance Scale Line
// - High-Contrast Numeric Odometer Roll (StudioOdometer)
// - Tactile Foley Audio Anchor (cardThock, cameraSwish, clockTickRapid)
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { clamp, ease, mix, progress, pulse, studioSpring, studioSpringEnter } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'
import { StudioOdometer } from '../ui/StudioOdometer'

interface R56ActorProps {
  t: number
  plan?: SentencePlan | undefined
}

/** Dispatches a `r56-*` actor id to its continuous-line visual component. */
export function Reel56LineActor({
  actor,
  t,
  plan,
}: {
  actor: string
  t: number
  plan?: SentencePlan | undefined
}) {
  if (actor === 'r56-hook-split') return <HookSplitActor t={t} plan={plan} />
  if (actor === 'r56-cost-waterfall') return <CostWaterfallActor t={t} plan={plan} />
  if (actor === 'r56-branch-autopsy') return <BranchAutopsyActor t={t} plan={plan} />
  if (actor === 'r56-truth-panel') return <TruthPanelActor t={t} plan={plan} />
  if (actor === 'r56-cta-loop') return <CtaLoopActor t={t} plan={plan} />
  return null
}

/** Scene-local start of the first word cue carrying this action. */
function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  return plan?.words.find((w) => w.action === action)?.start ?? fallback
}

/** Scene-local start of the first word cue with this exact token. */
function wordAt(plan: SentencePlan | undefined, word: string, fallback: number): number {
  return plan?.words.find((w) => w.word === word)?.start ?? fallback
}

/** Evaluates 2D coordinates along a cubic Bézier curve at parameter u in [0, 1]. */
function evalCubic(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  u: number,
): [number, number] {
  const v = 1 - u
  const vv = v * v
  const vvv = vv * v
  const uu = u * u
  const uuu = uu * u
  const x = vvv * p0[0] + 3 * vv * u * p1[0] + 3 * v * uu * p2[0] + uuu * p3[0]
  const y = vvv * p0[1] + 3 * vv * u * p1[1] + 3 * v * uu * p2[1] + uuu * p3[1]
  return [x, y]
}

// ─── 1. Hook Split: «۹۰۰ میلیون فروش؛ ولی یه شعبت ضرر می‌سازه!» ──────────────
function HookSplitActor({ t, plan }: R56ActorProps) {
  const countAt = cueAt(plan, 'combined-counter', 0.2)
  const lockAt = cueAt(plan, 'sales-lock', 1.3)
  const splitAt = cueAt(plan, 'branch-split', 2.75)
  const dipAt = cueAt(plan, 'below-zero-dip', 3.35)
  const badgeAt = cueAt(plan, 'loss-badge-pop', 3.75)
  const holdAt = plan?.sentenceEnding?.at ?? 3.25

  const countP = ease(progress(t, countAt, 1.2))
  const lockP = ease(progress(t, lockAt, 0.4))
  const splitP = ease(progress(t, splitAt, 0.8))
  const dipP = ease(progress(t, dipAt, 0.5))
  const badgeSpring = studioSpring(Math.max(0, t - badgeAt))
  const isHeld = t >= holdAt

  // Particle positions along the central and secondary Bézier streams
  const p0Trunk: [number, number] = [240, 24]
  const p1Trunk: [number, number] = [240, 80]
  const p2Trunk: [number, number] = [240, 110]
  const p3Trunk: [number, number] = [240, 150]

  const p0Red: [number, number] = [240, 150]
  const p1Red: [number, number] = [310, 210]
  const p2Red: [number, number] = [364, 270]
  const p3Red: [number, number] = [364, 360]

  const p0Dip: [number, number] = [364, 360]
  const p1Dip: [number, number] = [364, 400]
  const p2Dip: [number, number] = [364, 440]
  const p3Dip: [number, number] = [364, 475]

  const p0Green: [number, number] = [240, 150]
  const p1Green: [number, number] = [170, 210]
  const p2Green: [number, number] = [116, 270]
  const p3Green: [number, number] = [116, 380]

  // Dynamic particle coordinates
  const particles = [0.15, 0.38, 0.62, 0.85].map((offset, idx) => {
    const rawU = (t * 0.45 + offset) % 1
    let pt: [number, number] = [240, 24]
    let isRed = false

    if (rawU < 0.3) {
      pt = evalCubic(p0Trunk, p1Trunk, p2Trunk, p3Trunk, rawU / 0.3)
    } else if (idx % 2 === 0) {
      // Secondary healthy stream
      pt = evalCubic(p0Green, p1Green, p2Green, p3Green, (rawU - 0.3) / 0.7)
    } else {
      // Central losing stream
      isRed = t >= dipAt
      if (rawU < 0.65) {
        pt = evalCubic(p0Red, p1Red, p2Red, p3Red, (rawU - 0.3) / 0.35)
      } else {
        pt = evalCubic(p0Dip, p1Dip, p2Dip, p3Dip, (rawU - 0.65) / 0.35)
      }
    }
    return { x: pt[0], y: pt[1], isRed, opacity: countP > 0.1 ? 0.85 : 0 }
  })

  return (
    <div className={`r56-hook ${isHeld ? 'held' : ''}`}>
      {/* ── Volumetric Glowing Bézier Wave Canvas ── */}
      <svg
        className="r56-thread r56-thread-hook"
        viewBox="0 0 480 620"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <filter id="r56-volumetric-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="r56-cyan-stream" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
          </linearGradient>

          <linearGradient id="r56-dip-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#fb7185" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ff2a5f" stopOpacity="1" />
          </linearGradient>

          <linearGradient id="r56-drop-volume" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fb7185" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ff2a5f" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Volumetric drop area under the central branch crossing zero */}
        {dipP > 0.05 && (
          <path
            d="M 364 360 C 364 400 364 440 364 475 L 340 475 L 340 360 Z"
            fill="url(#r56-drop-volume)"
            opacity={dipP}
          />
        )}

        {/* 1. Trunk Stream (Top River) */}
        <path
          className="r56-wire-ambient"
          d="M 240 24 C 240 70 240 100 240 150"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - countP}
          stroke="url(#r56-cyan-stream)"
          strokeWidth={14}
          opacity={0.25}
          filter="url(#r56-volumetric-glow)"
          fill="none"
        />
        <path
          className="r56-wire-core"
          d="M 240 24 C 240 70 240 100 240 150"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - countP}
          stroke="#22d3ee"
          strokeWidth={3.8}
          strokeLinecap="round"
          fill="none"
        />
        <path
          className="r56-wire-specular"
          d="M 240 24 C 240 70 240 100 240 150"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - countP}
          stroke="#ffffff"
          strokeWidth={1.2}
          strokeLinecap="round"
          opacity={0.8}
          fill="none"
        />

        {/* 2. Secondary Branch Flow (Green/Cyan) */}
        <path
          className="r56-wire-ambient"
          d="M 240 150 C 170 210 116 270 116 380"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - splitP}
          stroke="#4ade80"
          strokeWidth={12}
          opacity={0.2}
          filter="url(#r56-volumetric-glow)"
          fill="none"
        />
        <path
          className="r56-wire-core"
          d="M 240 150 C 170 210 116 270 116 380"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - splitP}
          stroke="#4ade80"
          strokeWidth={3.5}
          strokeLinecap="round"
          fill="none"
        />

        {/* 3. Central Branch Flow (Volumetric Bézier Wave & Zero-Cross Dip) */}
        <path
          className="r56-wire-ambient"
          d="M 240 150 C 310 210 364 270 364 360"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - splitP}
          stroke="url(#r56-dip-gradient)"
          strokeWidth={14}
          opacity={0.25}
          filter="url(#r56-volumetric-glow)"
          fill="none"
        />
        <path
          className="r56-wire-core"
          d="M 240 150 C 310 210 364 270 364 360"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - splitP}
          stroke="url(#r56-dip-gradient)"
          strokeWidth={3.8}
          strokeLinecap="round"
          fill="none"
        />

        {/* Sharp Deep Dip below Zero line at Sec 03 */}
        <path
          className="r56-wire-ambient"
          d="M 364 360 C 364 400 364 440 364 475"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - dipP}
          stroke="#ff2a5f"
          strokeWidth={16}
          opacity={0.35}
          filter="url(#r56-volumetric-glow)"
          fill="none"
        />
        <path
          className="r56-wire-core"
          d="M 364 360 C 364 400 364 440 364 475"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - dipP}
          stroke="#ff2a5f"
          strokeWidth={4.2}
          strokeLinecap="round"
          fill="none"
        />

        {/* Zero Plane Indicator */}
        <g
          className={`r56-zero ${dipP >= 0.8 ? 'lit' : ''}`}
          style={{ opacity: Math.max(0.25, dipP) }}
        >
          <line className="r56-zero-line" x1="48" y1="410" x2="432" y2="410" />
          <text className="r56-zero-label" x="430" y="398">
            تراز صفر
          </text>
        </g>

        {/* Flowing ambient particle nodes */}
        {particles.map((p, i) => (
          <g key={i} opacity={p.opacity}>
            <circle
              cx={p.x}
              cy={p.y}
              r={p.isRed ? 6 : 4.5}
              fill={p.isRed ? '#ff2a5f' : '#22d3ee'}
              filter="url(#r56-volumetric-glow)"
            />
            <circle cx={p.x} cy={p.y} r={2} fill="#ffffff" />
          </g>
        ))}
      </svg>

      {/* ── Headline Block with Spring Entrance ── */}
      <div
        className="r56-top-headline"
        style={studioSpringEnter(t, countAt - 0.15, { y: 25, scale: 0.94 })}
      >
        <span className="r56-top-badge">کشف تلخ گزارش تجمیعی</span>
        <h2 className="r56-top-title">۹۰۰ میلیون فروش؛ یک شعبه زیر صفر!</h2>
      </div>

      {/* ── Hero Combined Sales Card with Odometer Roll ── */}
      <div
        className={`r56-sum-card ${t >= lockAt ? 'locked' : ''}`}
        style={studioSpringEnter(t, countAt, { y: 25, scale: 0.94 })}
      >
        <span className="r56-sum-label">فروش تجمیعی هر دو شعبه</span>
        <div className="r56-sum-figure">
          <StudioOdometer
            value={900}
            t={t}
            startAt={countAt}
            duration={1.1}
            tone={t >= lockAt ? 'cyan' : 'white'}
            unit="میلیون"
            fontSize={58}
          />
        </div>
        <span className="r56-sum-chip" style={{ opacity: lockP }}>
          ✓ ثبت جمعی · بدون تفکیک شعبه
        </span>
      </div>

      {/* ── Dual Branch Cards with Spring Inertia ── */}
      <div className="r56-branch-row">
        {/* Central Branch (Losing) */}
        <div
          className={`r56-branch-card central ${dipP > 0 ? 'dipping' : ''}`}
          style={studioSpringEnter(t, splitAt, { y: 25, scale: 0.94 })}
        >
          <span className="r56-branch-name">شعبه مرکزی</span>
          <span className="r56-branch-meta">فروش بالا · هزینه سنگین‌تر</span>
          <div
            className="r56-loss-badge"
            style={{
              opacity: clamp(progress(t, badgeAt, 0.15)),
              transform: `rotate(-5deg) scale(${mix(0.7, 1, badgeSpring)})`,
            }}
          >
            ضرر می‌سازه!
          </div>
        </div>

        {/* Secondary Branch (Healthy) */}
        <div
          className="r56-branch-card healthy"
          style={studioSpringEnter(t, splitAt + 0.1, { y: 25, scale: 0.94 })}
        >
          <span className="r56-branch-name">شعبه دوم</span>
          <span className="r56-branch-meta">سودده و کم‌هزینه</span>
        </div>
      </div>
    </div>
  )
}

// ─── 2. Cost Waterfall: «هزینه‌ها ۸۶۰ میلیون؛ فقط ۴۰ میلیون باقی می‌مونه!» ──
const FLOW_TOP = 900
const COST_GATES: Array<{ label: string; amount: number; after: number }> = [
  { label: 'بهای خرید کالا', amount: 630, after: 270 },
  { label: 'اجاره‌بهای شعب', amount: 130, after: 140 },
  { label: 'حقوق و دستمزد', amount: 80, after: 60 },
  { label: 'سایر هزینه‌های سربار', amount: 20, after: 40 },
]

function CostWaterfallActor({ t, plan }: R56ActorProps) {
  const gateAt = cueAt(plan, 'leak-gate', 0.3)
  const costAt = cueAt(plan, 'cost-counter', 1.1)
  const fadeAt = wordAt(plan, 'فقط', 2.55)
  const residueAt = cueAt(plan, 'residue-counter', 2.95)
  const holdAt = plan?.sentenceEnding?.at ?? 3.9

  const isFading = t >= fadeAt
  const isHeld = t >= holdAt

  return (
    <div className={`r56-waterfall ${isFading ? 'fading' : ''}`}>
      {/* ── Scene Headline ── */}
      <div
        className="r56-scene-headline"
        style={studioSpringEnter(t, gateAt - 0.15, { y: 25, scale: 0.94 })}
      >
        <span className="r56-scene-badge">نشت قطره‌ای سود</span>
        <h2 className="r56-scene-title">مسیر ۹۰۰ میلیون تا ته‌مانده سود</h2>
      </div>

      {/* ── Total Costs Banner with Odometer Roll ── */}
      <div className="r56-cost-total" style={studioSpringEnter(t, gateAt, { y: 20, scale: 0.96 })}>
        <span>جمع هزینه‌های پنهان و آشکار</span>
        <strong>
          <StudioOdometer
            value={860}
            t={t}
            startAt={costAt}
            duration={1.0}
            tone="red"
            unit="میلیون"
            fontSize={22}
          />
        </strong>
      </div>

      {/* ── Staggered Cinematic Cost Gates ── */}
      <div className="r56-flow">
        {/* Source Sales Banner */}
        <div
          className="r56-flow-source"
          style={studioSpringEnter(t, gateAt + 0.05, { y: 20, scale: 0.95 })}
        >
          <span className="r56-source-label">فروش کل ورودی</span>
          <span className="r56-source-value">
            {faNumber(FLOW_TOP)} <small>میلیون</small>
          </span>
        </div>

        {/* 4 Staggered Cost Leak Stations */}
        <div className="r56-gates-stack">
          {COST_GATES.map((gate, index) => {
            const revealAt = gateAt + 0.2 + index * 0.18
            const isRevealed = t >= revealAt
            const drainWidth = (gate.amount / FLOW_TOP) * 100

            return (
              <div
                key={gate.label}
                className="r56-flow-step"
                style={studioSpringEnter(t, revealAt, { y: 22, scale: 0.95 })}
              >
                <div className="r56-gate">
                  <span className="r56-gate-label">{gate.label}</span>
                  <span className="r56-gate-amount">
                    {faNumber(gate.amount)} <small>میلیون</small>
                  </span>
                </div>
                <div className="r56-gate-meter">
                  <span
                    className="r56-gate-drain"
                    style={{
                      width: isRevealed ? `${drainWidth}%` : '0%',
                      transition: 'width 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  />
                </div>
                <div className="r56-flow-junction">
                  <span className="r56-run-pill">مانده: {faNumber(gate.after)} میلیون</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── High-Contrast Residue Hero Card (۴۰ میلیون) ── */}
        <div
          className={`r56-residue ${isHeld ? 'held' : ''}`}
          style={studioSpringEnter(t, residueAt, { y: 28, scale: 0.92 })}
        >
          <span className="r56-residue-label">سود خالص باقی‌مانده برای شما</span>
          <div className="r56-residue-figure">
            <StudioOdometer
              value={40}
              t={t}
              startAt={residueAt}
              duration={0.9}
              tone="green"
              unit="میلیون"
              fontSize={54}
            />
          </div>
          <span className="r56-residue-chip">سود واقعی کل · قبل از کالبدشکافی شعب</span>
        </div>
      </div>
    </div>
  )
}

// ─── 3. Branch Autopsy: «شعبه دوم سود ۶۰؛ ولی مرکزی ۲۰ میلیون زیر صفره!» ────
const GREEN_COSTS = [
  { label: 'بهای خرید', value: 300 },
  { label: 'اجاره', value: 40 },
  { label: 'حقوق', value: 20 },
]

const RED_COSTS = [
  { label: 'بهای خرید', value: 330 },
  { label: 'اجاره مغازه', value: 90 },
  { label: 'حقوق پرسنل', value: 60 },
  { label: 'سربار و ضایعات', value: 20 },
]

function BranchAutopsyActor({ t, plan }: R56ActorProps) {
  const splitAt = cueAt(plan, 'dual-track-split', 0.3)
  const greenAt = cueAt(plan, 'green-profit-lock', 1.75)
  const focusAt = cueAt(plan, 'red-track-focus', 2.85)
  const lossAt = cueAt(plan, 'loss-counter', 3.5)
  const stampAt = cueAt(plan, 'loss-stamp', 4.8)
  const holdAt = plan?.sentenceEnding?.at ?? 4.3

  const isFocused = t >= focusAt
  const isStamped = t >= holdAt

  // Live Balance Scale tilt angle: 0deg -> -8.5deg tipping toward central branch
  const tiltElapsed = Math.max(0, t - focusAt)
  const tiltSpring = studioSpring(tiltElapsed)
  const tiltAngle = isFocused ? mix(0, -8.5, tiltSpring) : 0

  return (
    <div className={`r56-autopsy ${isStamped ? 'stamped' : ''}`}>
      {/* ── Scene Headline ── */}
      <div
        className="r56-scene-headline"
        style={studioSpringEnter(t, splitAt - 0.15, { y: 25, scale: 0.94 })}
      >
        <span className="r56-scene-badge">کالبدشکافی سود و زیان</span>
        <h2 className="r56-scene-title">کدوم شعبه داره واقعاً سود می‌سازه؟</h2>
      </div>

      {/* ── Live Central Equilibrium Scale Line ── */}
      <div
        className="r56-balance-scale-stage"
        style={studioSpringEnter(t, splitAt, { y: 20, scale: 0.96 })}
      >
        <svg className="r56-scale-svg" viewBox="0 0 440 44" preserveAspectRatio="none">
          <defs>
            <linearGradient id="r56-beam-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4ade80" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#94a3b8" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#fb7185" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* Tilting scale beam */}
          <g transform={`rotate(${tiltAngle}, 220, 20)`}>
            <line x1="32" y1="20" x2="408" y2="20" stroke="url(#r56-beam-grad)" strokeWidth="3" />
            {/* Emerald endpoint */}
            <circle cx="32" cy="20" r="7" fill="#4ade80" />
            <circle cx="32" cy="20" r="14" fill="#4ade80" opacity={0.25} />
            {/* Crimson endpoint */}
            <circle cx="408" cy="20" r="7" fill="#fb7185" />
            <circle cx="408" cy="20" r="14" fill="#fb7185" opacity={0.25} />
          </g>

          {/* Central fulcrum */}
          <polygon points="210,38 230,38 220,20" fill="rgba(148, 163, 184, 0.45)" />
          <circle cx="220" cy="20" r="5" fill="#22d3ee" />
        </svg>
      </div>

      {/* ── Isometric / 2.5D Layered Split View ── */}
      <div className="r56-split-perspective-grid">
        {/* Branch 2 (Profitable, Emerald Aura) */}
        <div
          className={`r56-card-25d green-branch-card ${isFocused ? 'dimmed' : ''}`}
          style={studioSpringEnter(t, splitAt + 0.08, { y: 25, scale: 0.94 })}
        >
          <div className="r56-track-top">
            <div className="r56-branch-title-wrap">
              <span className="r56-track-name">شعبه دوم</span>
              <span className="r56-track-sales">فروش: {faNumber(420)} م</span>
            </div>
            <div className={`r56-profit-pill green ${t >= greenAt ? 'lit' : ''}`}>
              <StudioOdometer
                value={60}
                t={t}
                startAt={greenAt}
                duration={0.8}
                tone="green"
                prefix="+ "
                unit="م سود"
                fontSize={16}
              />
            </div>
          </div>

          <div className="r56-track-costs">
            {GREEN_COSTS.map((cost) => (
              <span key={cost.label} className="r56-cost-chip green">
                {cost.label} {faNumber(cost.value)}
              </span>
            ))}
          </div>
        </div>

        {/* Central Branch (Losing, Crimson/Amber Aura) */}
        <div
          className={`r56-card-25d red-branch-card ${isFocused ? 'focused' : ''}`}
          style={studioSpringEnter(t, splitAt + 0.18, { y: 25, scale: 0.94 })}
        >
          <div className="r56-track-top">
            <div className="r56-branch-title-wrap">
              <span className="r56-track-name">شعبه مرکزی</span>
              <span className="r56-track-sales">فروش: {faNumber(480)} م</span>
            </div>
            <div className={`r56-profit-pill loss ${t >= lossAt ? 'lit' : ''}`}>
              <StudioOdometer
                value={20}
                t={t}
                startAt={lossAt}
                duration={0.8}
                tone="red"
                prefix="- "
                unit="م زیان"
                fontSize={16}
              />
            </div>
          </div>

          <div className="r56-track-costs">
            {RED_COSTS.map((cost) => (
              <span key={cost.label} className="r56-cost-chip red">
                {cost.label} {faNumber(cost.value)}
              </span>
            ))}
          </div>

          {/* Loss Stamp with Spring Physics */}
          <div
            className="r56-loss-stamp"
            style={{
              opacity: clamp(progress(t, stampAt, 0.14)),
              transform: `rotate(-6deg) scale(${mix(0.6, 1, studioSpring(Math.max(0, t - stampAt)))})`,
            }}
          >
            زیر صفر!
          </div>
        </div>
      </div>

      {/* ── Reconciliation Summary ── */}
      <div className="r56-recon" style={studioSpringEnter(t, greenAt, { y: 20, scale: 0.96 })}>
        <div className="r56-recon-row">
          <span className="r56-recon-tile green">سود شعبه دوم · {faNumber(60)} میلیون</span>
          <span className="r56-recon-tile red">زیان شعبه مرکزی · {faNumber(20)} میلیون</span>
        </div>
        <div className="r56-recon-total">سود واقعی کل · {faNumber(40)} میلیون</div>
      </div>
    </div>
  )
}

// ─── 4. Truth Panel: «حسابچه سود و ضرر هر شعبه رو جدا نشون می‌ده!» ────────────
function TruthPanelActor({ t, plan }: R56ActorProps) {
  const pnlAt = cueAt(plan, 'pnl-grid', 1.0)
  const flagAt = cueAt(plan, 'loss-flag', 1.7)
  const cardsAt = cueAt(plan, 'per-branch-cards', 2.75)
  const lockAt = cueAt(plan, 'insight-lock', 4.75)
  const holdAt = plan?.sentenceEnding?.at ?? 4.5

  const brandOpacity = Math.min(1, Math.max(0.2, t / 0.15))
  const isHeld = t >= holdAt

  return (
    <div className={`r56-truth ${isHeld ? 'held' : ''}`}>
      {/* ── Brand Entry Header ── */}
      <div className="brand-entry-header r56-brand" style={{ opacity: brandOpacity }}>
        <div className="brand-logo-circle">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2.2"
          >
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M7 8h10M7 12h7M7 16h9" />
          </svg>
        </div>
        <div className="brand-title-group">
          <span className="brand-name">حسابچه</span>
          <span className="brand-slogan">صورت سود و زیان تفکیکی هر شعبه، لحظه‌ای</span>
        </div>
      </div>

      {/* ── Segregated P&L Container with Spring Entrance ── */}
      <div className="r56-pnl-panel" style={studioSpringEnter(t, pnlAt, { y: 25, scale: 0.94 })}>
        <div className="r56-pnl-head">
          <span className="r56-pnl-title">صورت سود و زیان تفکیکی شعب</span>
          <span className="r56-pnl-live">هوشمند</span>
        </div>

        {/* Central Branch Row */}
        <div
          className={`r56-pnl-card central ${t >= flagAt ? 'flagged' : ''}`}
          style={studioSpringEnter(t, cardsAt, { y: 20, scale: 0.95 })}
        >
          <div className="r56-pnl-row-top">
            <span className="r56-pnl-name">شعبه مرکزی</span>
            <span className="r56-pnl-net loss">زیان {faNumber(20)} م</span>
          </div>
          <div className="r56-pnl-metrics">
            <span>فروش {faNumber(480)} م</span>
            <span>هزینه {faNumber(500)} م</span>
          </div>
        </div>

        {/* Secondary Branch Row */}
        <div
          className="r56-pnl-card second"
          style={studioSpringEnter(t, cardsAt + 0.15, { y: 20, scale: 0.95 })}
        >
          <div className="r56-pnl-row-top">
            <span className="r56-pnl-name">شعبه دوم</span>
            <span className="r56-pnl-net profit">سود {faNumber(60)} م</span>
          </div>
          <div className="r56-pnl-metrics">
            <span>فروش {faNumber(420)} م</span>
            <span>هزینه {faNumber(360)} م</span>
          </div>
        </div>
      </div>

      {/* ── Decisive Resolution Insight Box ── */}
      <div className="r56-insight" style={studioSpringEnter(t, lockAt, { y: 25, scale: 0.92 })}>
        <span className="r56-insight-check">✓</span>
        <div className="r56-insight-text">
          <strong>نشتی شعبه مرکزی لو رفت: ۲۰ میلیون زیان پنهان شناسایی شد!</strong>
          <span>نتیجه اصلاح: سود خالص واقعی کل از ۴۰ به ۶۰ میلیون افزایش می‌یابد.</span>
        </div>
      </div>
    </div>
  )
}

// ─── 5. CTA Loop: «سود هر شعبه رو همین حالا ببین.» ───────────────────────────
function CtaLoopActor({ t, plan }: R56ActorProps) {
  const tagAt = cueAt(plan, 'branch-tag', 1.05)
  const cardAt = wordAt(plan, 'حالا', 2.25)
  const orbitAt = cueAt(plan, 'cta-button-pulse', 2.75)

  const brandOpacity = Math.min(1, Math.max(0.2, t / 0.15))
  const orbitP = ease(progress(t, orbitAt, 1.0))
  const glow = pulse(t, orbitAt, orbitAt + 1.25, 0.85)

  return (
    <div className="cta-finish-container r56-cta">
      <div className="cta-brand-hero" style={{ opacity: brandOpacity }}>
        <div className="cta-logo-glow">
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2.2"
          >
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <path d="M7 8h10M7 12h6M7 16h9" />
          </svg>
        </div>
        <h2 className="cta-main-title">حسابچه</h2>
        <p className="cta-subtitle">سود و زیان هر شعبه، شفاف و لحظه‌ای</p>
      </div>

      <div className="r56-cta-pills" style={studioSpringEnter(t, tagAt, { y: 20, scale: 0.95 })}>
        <span className="r56-cta-pill">شعبه مرکزی</span>
        <span className="r56-cta-pill">شعبه دوم</span>
      </div>

      <div className="cta-action-stack">
        <div
          className="r56-orbit-wrap"
          style={studioSpringEnter(t, cardAt, { y: 24, scale: 0.94 })}
        >
          <svg
            className="r56-loop-thread"
            viewBox="0 0 480 150"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <ellipse
              className="r56-orbit"
              cx="240"
              cy="75"
              rx="170"
              ry="56"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - orbitP}
            />
          </svg>
          <div
            className="cta-action-card cyan-cta"
            style={{
              boxShadow: `0 0 ${mix(12, 38, glow)}px rgba(34, 211, 238, ${mix(0.28, 0.85, glow)})`,
            }}
          >
            <div className="cta-card-badge">گزارش تفکیکی هر شعبه</div>
            <div className="cta-card-action">شروع رایگان در: hisabche.com</div>
          </div>
        </div>

        <div className="cta-search-prompt">
          <span>در گوگل جستجو کنید: </span>
          <strong>حسابچه</strong>
        </div>
      </div>

      <div className="cta-web-footer">hisabche.com</div>
    </div>
  )
}
