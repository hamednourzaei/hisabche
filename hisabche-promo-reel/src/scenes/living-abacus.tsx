// ============================================
// Reel #113 — «چرتکه زنده» (The Living Abacus) — Tactile Artisan Studio Redesign
//
// Creative Art Direction:
// Sunlit Travertine Desk, Hand-Planed Walnut & Turned Brass Counting Frame,
// Lathe-Carved Ceramic & Gemstone Beads, Cotton Paper Ledger & Wax Seal.
// Built as layered physical SVG craft with procedural wood/stone grain, cast shadows,
// gobo window daylight, and natural twilight outage contrast — zero SaaS dark-box UI.
//
// Scenes (exact timing preserved):
// 1. Hook 1 (0.0–3.5s)   — Jammed crimson agate bead vibrating with friction sparks
// 2. Manual (3.5–10.0s)  — Brass stylus pushing rods 1..4; bead snags + ink mismatch
// 3. Outage (10.0–15.0s) — Studio twilight cut, dial snaps offline, abacus glows warm
// 4. Sync   (15.0–24.0s) — Paper ticket drops into slot, single emerald sweep + seal
// 5. CTA    (24.0–31.0s) — Shared dual comment-keyword end card
//
// Guardrails:
// - noZoom: true (Root scale stays 1.0)
// - <= 6 words per on-stage label
// - Deterministic clock `t` only (no Math.random, no wall-clock timers)
// - Bottom subtitle safe zone y: 785..960 kept clear of critical labels
// ============================================

import type { CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, enter, mix, progress, strokeDraw, studioSpring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

// ─── Tactile Material Palette ────────────────────────────────────────────────

const INK_ESPRESSO = '#1f1610'
const INK_IVORY = '#faf3e6'
const INK_CRIMSON = '#be123c'
const INK_CORAL = '#fda4af'
const INK_SIENNA = '#9a3412'
const INK_EMERALD = '#047857'
const INK_JADE = '#34d399'
const INK_MUTED_DAY = '#6b5b4b'
const INK_MUTED_NIGHT = '#cbd5e1'

const ROD_Y = [318, 404, 490, 576] as const
const ROD_LABELS = ['دفتر کل', 'کاردکس انبار', 'حساب مشتری', 'صندوق دخل'] as const

// Disjoint horizontal rest/counted ranges inside inner cavity (x: 64..476)
const restX = (j: number) => 98 + j * 34
const countedX = (j: number) => 294 + j * 34

type NetworkState = 'online' | 'offline' | 'synced'
type BeadMaterial = 'boxwood' | 'turquoise' | 'carnelian' | 'emerald' | 'crimson'

// ─── Color Interpolation Helpers ─────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return [r, g, b]
}

function lerpColor(dayHex: string, nightHex: string, tMix: number): string {
  const p = clamp(tMix)
  const [r1, g1, b1] = hexToRgb(dayHex)
  const [r2, g2, b2] = hexToRgb(nightHex)
  const r = Math.round(r1 + (r2 - r1) * p)
  const g = Math.round(g1 + (g2 - g1) * p)
  const b = Math.round(b1 + (b2 - b1) * p)
  return `rgb(${r}, ${g}, ${b})`
}

// ─── Deterministic Dust Motes Along Light Beam ───────────────────────────────

const DUST_MOTES = [
  { bx: 88, by: 165, r: 1.8, sx: 11, sy: 7, sp: 0.9, ph: 0.4 },
  { bx: 152, by: 205, r: 1.3, sx: 8, sy: 9, sp: 0.7, ph: 1.7 },
  { bx: 214, by: 185, r: 2.1, sx: 13, sy: 6, sp: 1.1, ph: 2.6 },
  { bx: 318, by: 215, r: 1.5, sx: 9, sy: 10, sp: 0.85, ph: 0.9 },
  { bx: 126, by: 360, r: 1.6, sx: 10, sy: 8, sp: 0.65, ph: 3.1 },
  { bx: 410, by: 295, r: 1.4, sx: 7, sy: 11, sp: 0.95, ph: 2.2 },
  { bx: 195, by: 540, r: 1.9, sx: 12, sy: 7, sp: 0.75, ph: 4.0 },
  { bx: 356, by: 620, r: 1.5, sx: 9, sy: 9, sp: 0.8, ph: 1.3 },
  { bx: 446, by: 470, r: 1.7, sx: 8, sy: 6, sp: 1.05, ph: 2.9 },
  { bx: 94, by: 675, r: 1.4, sx: 10, sy: 8, sp: 0.6, ph: 0.2 },
] as const

// ─── SVG Material Defs (Wood Grain, Stone Paper, Ceramic Beads, Brass) ───────

function StudioSvgDefs() {
  return (
    <defs>
      {/* Subtle natural limestone/cotton-paper grain */}
      <filter id="la-stone-grain" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.65"
          numOctaves="3"
          seed="17"
          result="noise"
        />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0.24  0 0 0 0 0.19  0 0 0 0 0.14  0 0 0 0.08 0"
        />
      </filter>

      {/* Organic walnut wood grain stretched horizontally */}
      <filter id="la-wood-grain-h" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.014 0.19"
          numOctaves="3"
          seed="42"
          result="woodNoise"
        />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0.14  0 0 0 0 0.07  0 0 0 0 0.03  0 0 0 0.34 0"
        />
      </filter>

      {/* Vertical wood grain for side stiles */}
      <filter id="la-wood-grain-v" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.19 0.014"
          numOctaves="3"
          seed="29"
          result="woodNoiseV"
        />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0.14  0 0 0 0 0.07  0 0 0 0 0.03  0 0 0 0.34 0"
        />
      </filter>

      {/* Soft physical drop shadows */}
      <filter id="la-frame-shadow" x="-12%" y="-12%" width="130%" height="130%">
        <feDropShadow dx="10" dy="18" stdDeviation="14" floodColor="#180f07" floodOpacity="0.42" />
        <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#180f07" floodOpacity="0.28" />
      </filter>

      <filter id="la-paper-shadow" x="-15%" y="-15%" width="135%" height="135%">
        <feDropShadow dx="4" dy="8" stdDeviation="7" floodColor="#23170b" floodOpacity="0.22" />
      </filter>

      <filter id="la-soft-gobo" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="24" />
      </filter>

      {/* Walnut rail gradients */}
      <linearGradient id="la-walnut-top" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8d5d38" />
        <stop offset="22%" stopColor="#6b4223" />
        <stop offset="78%" stopColor="#462812" />
        <stop offset="100%" stopColor="#2a1609" />
      </linearGradient>

      <linearGradient id="la-walnut-side" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#845531" />
        <stop offset="30%" stopColor="#5e381c" />
        <stop offset="80%" stopColor="#3e2310" />
        <stop offset="100%" stopColor="#241307" />
      </linearGradient>

      {/* Brushed Champagne Brass */}
      <linearGradient id="la-brass-v" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7a5719" />
        <stop offset="24%" stopColor="#e6bf65" />
        <stop offset="44%" stopColor="#fff7d6" />
        <stop offset="70%" stopColor="#b98628" />
        <stop offset="100%" stopColor="#4c330a" />
      </linearGradient>

      <linearGradient id="la-brass-plate" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f3d485" />
        <stop offset="45%" stopColor="#c99738" />
        <stop offset="100%" stopColor="#7d5616" />
      </linearGradient>

      {/* Recessed interior shadow lips */}
      <linearGradient id="la-recess-top" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(26, 15, 7, 0.34)" />
        <stop offset="100%" stopColor="rgba(26, 15, 7, 0)" />
      </linearGradient>
      <linearGradient id="la-recess-left" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="rgba(26, 15, 7, 0.28)" />
        <stop offset="100%" stopColor="rgba(26, 15, 7, 0)" />
      </linearGradient>

      {/* Lathe-turned Bead Material Shaders */}
      <radialGradient id="la-bead-boxwood" cx="35%" cy="28%" r="72%">
        <stop offset="0%" stopColor="#fff9ec" />
        <stop offset="28%" stopColor="#e8d2ad" />
        <stop offset="72%" stopColor="#b58d58" />
        <stop offset="100%" stopColor="#5e401e" />
      </radialGradient>

      <radialGradient id="la-bead-turquoise" cx="35%" cy="28%" r="72%">
        <stop offset="0%" stopColor="#cffafe" />
        <stop offset="26%" stopColor="#22b8cf" />
        <stop offset="70%" stopColor="#0b7285" />
        <stop offset="100%" stopColor="#083344" />
      </radialGradient>

      <radialGradient id="la-bead-carnelian" cx="35%" cy="28%" r="72%">
        <stop offset="0%" stopColor="#fef3c7" />
        <stop offset="26%" stopColor="#f59e0b" />
        <stop offset="72%" stopColor="#b45309" />
        <stop offset="100%" stopColor="#582106" />
      </radialGradient>

      <radialGradient id="la-bead-emerald" cx="35%" cy="28%" r="72%">
        <stop offset="0%" stopColor="#d1fae5" />
        <stop offset="26%" stopColor="#10b981" />
        <stop offset="72%" stopColor="#047857" />
        <stop offset="100%" stopColor="#022c22" />
      </radialGradient>

      <radialGradient id="la-bead-crimson" cx="35%" cy="28%" r="72%">
        <stop offset="0%" stopColor="#ffe4e6" />
        <stop offset="26%" stopColor="#f43f5e" />
        <stop offset="70%" stopColor="#be123c" />
        <stop offset="100%" stopColor="#4c0519" />
      </radialGradient>

      {/* Warm paper & seal */}
      <linearGradient id="la-cotton-paper" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fcf8ee" />
        <stop offset="65%" stopColor="#f2e8d4" />
        <stop offset="100%" stopColor="#e2d3b5" />
      </linearGradient>

      <radialGradient id="la-wax-emerald" cx="38%" cy="32%" r="68%">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="55%" stopColor="#059669" />
        <stop offset="100%" stopColor="#064e3b" />
      </radialGradient>

      {/* Clip path for invoice slip sliding into top walnut slot */}
      <clipPath id="la-slot-clip">
        <rect x="0" y="0" width="540" height="252" />
      </clipPath>
    </defs>
  )
}

// ─── Sculpted Lathe-Turned Abacus Bead ───────────────────────────────────────

function SculptedBead({
  cx,
  cy,
  material,
  tiltDeg,
  isJammed,
  t,
}: {
  cx: number
  cy: number
  material: BeadMaterial
  tiltDeg: number
  isJammed: boolean
  t: number
}) {
  const fillId = `url(#la-bead-${material})`
  // Custom sculpted bicone-barrel bead profile centered at (0, 0), width 28, height 34
  const bodyPath =
    'M -8 -16.5 C -13.5 -13.5 -15 -5 -15 0 C -15 5 -13.5 13.5 -8 16.5 C -3 17.5 3 17.5 8 16.5 C 13.5 13.5 15 5 15 0 C 15 -5 13.5 -13.5 8 -16.5 C 3 -17.5 -3 -17.5 -8 -16.5 Z'

  const sparkBurst = isJammed ? 0.5 + 0.5 * Math.sin(t * 28) : 0

  return (
    <g transform={`translate(${cx.toFixed(2)}, ${cy.toFixed(2)}) rotate(${tiltDeg.toFixed(2)})`}>
      {/* Cast contact shadow onto recessed linen backplate */}
      <ellipse cx="3.5" cy="19.5" rx="13.5" ry="4.2" fill="rgba(22, 13, 6, 0.28)" />

      {/* Left & right brass collar washers hugging the rod */}
      <rect x="-16.8" y="-3.8" width="2.8" height="7.6" rx="1.2" fill="url(#la-brass-v)" />
      <rect x="14.0" y="-3.8" width="2.8" height="7.6" rx="1.2" fill="url(#la-brass-v)" />

      {/* Jammed heat aura + radial mechanical sparks */}
      {isJammed && (
        <g>
          <circle
            cx="0"
            cy="0"
            r={22 + sparkBurst * 4}
            fill="rgba(225, 29, 72, 0.16)"
            stroke="rgba(244, 63, 94, 0.55)"
            strokeWidth="1.2"
          />
          {[0, 1, 2, 3, 4].map((k) => {
            const ang = -0.9 + k * 0.45 + Math.sin(t * 18 + k) * 0.18
            const d1 = 19 + ((t * 42 + k * 5) % 10)
            const d2 = d1 + 6
            return (
              <line
                key={k}
                x1={Math.cos(ang) * d1}
                y1={Math.sin(ang) * d1 - 12}
                x2={Math.cos(ang) * d2}
                y2={Math.sin(ang) * d2 - 15}
                stroke={k % 2 === 0 ? '#fbbf24' : '#fb7185'}
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity={0.45 + sparkBurst * 0.5}
              />
            )
          })}
        </g>
      )}

      {/* Lathe-carved bead body */}
      <path d={bodyPath} fill={fillId} stroke="rgba(24, 14, 7, 0.42)" strokeWidth="0.9" />

      {/* Subtle turned equatorial groove line */}
      <path
        d="M -14.4 0.5 Q 0 3.2 14.4 0.5"
        fill="none"
        stroke="rgba(255, 255, 255, 0.22)"
        strokeWidth="0.9"
      />
      <path
        d="M -14.2 -0.6 Q 0 2.0 14.2 -0.6"
        fill="none"
        stroke="rgba(20, 10, 4, 0.22)"
        strokeWidth="0.7"
      />

      {/* Glossy upper-left studio catchlight */}
      <path
        d="M -9.5 -11.5 C -11.5 -8.5 -11.8 -4.5 -10.4 -2.2 C -9.2 -3.8 -8.0 -7.5 -5.8 -10.8 Z"
        fill="rgba(255, 255, 255, 0.52)"
      />
    </g>
  )
}

// ─── Engraved Brass Corner Gusset Plate ──────────────────────────────────────

function BrassCornerEscutcheon({
  x,
  y,
  rot,
  screwAngle,
}: {
  x: number
  y: number
  rot: number
  screwAngle: number
}) {
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rot})`}>
      <path
        d="M 0 0 L 28 0 L 28 8 L 12 8 L 8 12 L 8 28 L 0 28 Z"
        fill="url(#la-brass-plate)"
        stroke="rgba(54, 34, 8, 0.65)"
        strokeWidth="0.9"
      />
      <circle cx="5.5" cy="5.5" r="2.6" fill="#714c12" stroke="#fef08a" strokeWidth="0.6" />
      <line
        x1={5.5 - Math.cos(screwAngle) * 1.9}
        y1={5.5 - Math.sin(screwAngle) * 1.9}
        x2={5.5 + Math.cos(screwAngle) * 1.9}
        y2={5.5 + Math.sin(screwAngle) * 1.9}
        stroke="#271605"
        strokeWidth="0.9"
      />
      <circle cx="22.5" cy="4.0" r="1.7" fill="#714c12" />
      <circle cx="4.0" cy="22.5" r="1.7" fill="#714c12" />
    </g>
  )
}

// ─── Analog Brass Telegraph / Signal Gauge (Top-Right) ───────────────────────

function AnalogSignalGauge({
  network,
  t,
  outageMix,
}: {
  network: NetworkState
  t: number
  outageMix: number
}) {
  // Needle angles: offline = -46 deg (left), online = 0 deg (center), synced = +46 deg (right)
  const targetAngle = network === 'offline' ? -46 : network === 'synced' ? 46 : 0
  const needleJolt = network === 'offline' ? Math.sin(t * 24) * 1.6 * clamp(1 - t * 0.4) : 0
  const angle = targetAngle + needleJolt

  const label = network === 'offline' ? 'قطع' : network === 'synced' ? 'همگام' : 'آنلاین'
  const accent = network === 'offline' ? '#e11d48' : network === 'synced' ? '#059669' : '#0284c7'
  const dialFace = lerpColor('#fbf6ea', '#1e2631', outageMix * 0.85)
  const labelColor = network === 'offline' && outageMix > 0.4 ? '#fda4af' : accent

  return (
    <g transform="translate(454, 82)">
      {/* Subtle desk shadow behind gauge */}
      <circle cx="3" cy="6" r="34" fill="rgba(22, 13, 6, 0.24)" />

      {/* Knurled Brass Outer Bezel */}
      <circle cx="0" cy="0" r="34" fill="url(#la-brass-plate)" stroke="#4c3208" strokeWidth="1.2" />
      <circle cx="0" cy="0" r="29" fill="#3a250a" />
      <circle cx="0" cy="0" r="27" fill={dialFace} />

      {/* Engraved Gauge Arc & Ticks */}
      <path
        d="M -18 -5 A 20 20 0 0 1 18 -5"
        fill="none"
        stroke={outageMix > 0.5 ? 'rgba(226,232,240,0.28)' : 'rgba(55,40,25,0.25)'}
        strokeWidth="1.4"
      />
      {[-46, -23, 0, 23, 46].map((deg, idx) => {
        const rad = ((deg - 90) * Math.PI) / 180
        const r1 = 17
        const r2 = idx === 0 || idx === 2 || idx === 4 ? 22 : 20
        return (
          <line
            key={deg}
            x1={Math.cos(rad) * r1}
            y1={Math.sin(rad) * r1 + 6}
            x2={Math.cos(rad) * r2}
            y2={Math.sin(rad) * r2 + 6}
            stroke={idx === 0 ? '#e11d48' : idx === 4 ? '#10b981' : '#8b7355'}
            strokeWidth={idx === 0 || idx === 4 ? '1.8' : '1.1'}
            strokeLinecap="round"
          />
        )
      })}

      {/* Spark when wire cuts in Scene 3 */}
      {network === 'offline' && t >= 0.28 && t <= 0.72 && (
        <g opacity={1 - progress(t, 0.35, 0.35)}>
          <path
            d="M -28 -24 L -36 -31 L -31 -21 L -40 -22"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="-33" cy="-26" r="2.2" fill="#fb7185" />
        </g>
      )}

      {/* Pivoting Steel Needle */}
      <g transform={`translate(0, 6) rotate(${angle.toFixed(2)})`}>
        <path d="M -2.2 4 L 0 -20 L 2.2 4 Z" fill={accent} />
        <circle
          cx="0"
          cy="0"
          r="4"
          fill="url(#la-brass-plate)"
          stroke="#2b1b06"
          strokeWidth="0.9"
        />
      </g>

      {/* Enamel Status Text inside lower dial */}
      <text
        x="0"
        y="20"
        textAnchor="middle"
        fill={labelColor}
        fontSize="10.5"
        fontWeight="900"
        fontFamily="'Vazirmatn', sans-serif"
      >
        {label}
      </text>

      {/* Convex Glass Reflection Glare */}
      <path
        d="M -20 -13 A 23 23 0 0 1 18 -16 A 26 20 0 0 0 -20 -13 Z"
        fill="rgba(255, 255, 255, 0.38)"
      />
    </g>
  )
}

// ─── Cotton Paper Invoice Ticket (Scene 1, 2, 4) ─────────────────────────────

function PaperInvoiceTicket({
  x,
  y,
  tiltDeg,
  opacity,
  t,
  drawAt,
}: {
  x: number
  y: number
  tiltDeg: number
  opacity: number
  t: number
  drawAt: number
}) {
  if (opacity <= 0.01) return null
  const inkLine1 = strokeDraw(t, drawAt, 0.45, 58)
  const inkLine2 = strokeDraw(t, drawAt + 0.14, 0.45, 44)

  // Serrated cotton receipt slip centered at (x, y)
  const slipPath =
    'M -72 -26 L -60 -29 L -48 -26 L -36 -29 L -24 -26 L -12 -29 L 0 -26 L 12 -29 L 24 -26 L 36 -29 L 48 -26 L 60 -29 L 72 -26 L 72 26 L 60 29 L 48 26 L 36 29 L 24 26 L 12 29 L 0 26 L -12 29 L -24 26 L -36 29 L -48 26 L -60 29 L -72 26 Z'

  return (
    <g
      transform={`translate(${x.toFixed(2)}, ${y.toFixed(2)}) rotate(${tiltDeg.toFixed(2)})`}
      opacity={opacity}
      filter="url(#la-paper-shadow)"
    >
      <path d={slipPath} fill="url(#la-cotton-paper)" stroke="#c7b595" strokeWidth="1" />

      {/* Delicate ink emblem stamp on right */}
      <circle cx="44" cy="0" r="14" fill="none" stroke="#0f766e" strokeWidth="1.5" opacity="0.85" />
      <path
        d="M 38 0 L 42 4 L 50 -5"
        fill="none"
        stroke="#0f766e"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Crisp Persian label + handwritten ink squiggle lines */}
      <text
        x="18"
        y="-4"
        textAnchor="end"
        fill={INK_ESPRESSO}
        fontSize="13.5"
        fontWeight="900"
        fontFamily="'Vazirmatn', sans-serif"
      >
        فاکتور ۱ کلیک
      </text>
      <line
        x1="-54"
        y1="8"
        x2="14"
        y2="8"
        stroke="#8d785f"
        strokeWidth="1.6"
        strokeLinecap="round"
        {...inkLine1}
      />
      <line
        x1="-38"
        y1="15"
        x2="14"
        y2="15"
        stroke="#b09b80"
        strokeWidth="1.3"
        strokeLinecap="round"
        {...inkLine2}
      />
    </g>
  )
}

// ─── Artisan Rosewood & Brass Stylus (Scene 2 Manual Entry) ──────────────────

function ArtisanStylus({ x, y, recoil }: { x: number; y: number; recoil: number }) {
  return (
    <g transform={`translate(${(x + recoil).toFixed(2)}, ${(y - 8).toFixed(2)}) rotate(-26)`}>
      {/* Soft cast shadow beneath stylus */}
      <path
        d="M 4 6 L 78 6 L 82 12 L 6 12 Z"
        fill="rgba(22, 13, 6, 0.25)"
        transform="translate(4, 14)"
      />
      {/* Turned rosewood handle */}
      <path
        d="M 22 -5.5 L 92 -7 C 96 -7 98 -4 98 0 C 98 4 96 7 92 7 L 22 5.5 Z"
        fill="#4c2313"
        stroke="#271007"
        strokeWidth="0.9"
      />
      {/* Highlight strip on rosewood */}
      <line x1="25" y1="-2.5" x2="90" y2="-3.5" stroke="rgba(255,215,180,0.28)" strokeWidth="1.6" />
      {/* Turned brass ferrule & nib tip */}
      <path
        d="M 0 0 L 22 -5.5 L 22 5.5 Z"
        fill="url(#la-brass-plate)"
        stroke="#4c3208"
        strokeWidth="0.8"
      />
      <circle cx="0.8" cy="0" r="1.8" fill="#1e1309" />
    </g>
  )
}

// ─── Lower Tactile Props (Scene 2 Tally Slip, Scene 3 Ribbon, Scene 4 Balance Card) ───

function ManualTallySlip({ dots, missOn, t }: { dots: number; missOn: boolean; t: number }) {
  const slipReveal = ease(progress(t, 0.25, 0.45))
  const slipY = mix(14, 0, slipReveal)
  return (
    <g
      transform={`translate(270, ${(724 + slipY).toFixed(2)}) rotate(-0.8)`}
      opacity={slipReveal}
      filter="url(#la-paper-shadow)"
    >
      <rect
        x="-168"
        y="-28"
        width="336"
        height="56"
        rx="4"
        fill="url(#la-cotton-paper)"
        stroke="#c6b594"
        strokeWidth="1"
      />
      {/* 4 hand-ruled check boxes for the 4 books */}
      {[0, 1, 2, 3].map((idx) => {
        const bx = 114 - idx * 76
        const checked = idx < dots && !(missOn && idx === 3)
        const isError = missOn && idx === 3
        return (
          <g key={idx} transform={`translate(${bx}, 0)`}>
            <rect
              x="-24"
              y="-15"
              width="48"
              height="30"
              rx="3"
              fill={isError ? 'rgba(225,29,72,0.08)' : 'rgba(139,115,85,0.07)'}
              stroke={isError ? INK_CRIMSON : '#b5a284'}
              strokeWidth={isError ? '1.6' : '1'}
            />
            <text
              x="12"
              y="5"
              textAnchor="middle"
              fill={isError ? INK_CRIMSON : '#6b5b4b'}
              fontSize="12"
              fontWeight="800"
              fontFamily="'Vazirmatn', sans-serif"
            >
              {faNumber(idx + 1)}
            </text>
            {checked && (
              <path
                d="M -14 0 L -9 5 L -1 -6"
                fill="none"
                stroke={INK_EMERALD}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {isError && (
              <g stroke={INK_CRIMSON} strokeWidth="2.4" strokeLinecap="round">
                <line x1="-13" y1="-5" x2="-3" y2="5" />
                <line x1="-3" y1="-5" x2="-13" y2="5" />
              </g>
            )}
          </g>
        )
      })}
    </g>
  )
}

function OutageEditorialBookmark({ t, badgeAt }: { t: number; badgeAt: number }) {
  const reveal = ease(progress(t, badgeAt, 0.45))
  if (reveal <= 0.01) return null
  const dy = mix(12, 0, reveal)

  return (
    <g transform={`translate(270, ${(722 + dy).toFixed(2)})`} opacity={reveal}>
      {/* Hand-cut dark walnut & brass pinned bookmark strip */}
      <path
        d="M -182 -22 L 182 -22 L 173 0 L 182 22 L -182 22 L -173 0 Z"
        fill="rgba(34, 24, 16, 0.94)"
        stroke="rgba(217, 164, 65, 0.55)"
        strokeWidth="1.2"
        filter="url(#la-paper-shadow)"
      />
      <circle cx="-158" cy="0" r="3" fill="#d9a441" />
      <circle cx="158" cy="0" r="3" fill="#d9a441" />
      <text
        x="0"
        y="5.5"
        textAnchor="middle"
        fill="#fef3c7"
        fontSize="14.5"
        fontWeight="900"
        fontFamily="'Vazirmatn', sans-serif"
      >
        اینترنت قطع؛ چرتکه روشن است
      </text>
    </g>
  )
}

function SyncedWaxBalanceCard({ t, balanceAt }: { t: number; balanceAt: number }) {
  const cardP = ease(progress(t, balanceAt - 0.15, 0.45))
  if (cardP <= 0.01) return null
  const cardY = mix(18, 0, cardP)

  const sealSpin = studioSpring(t - balanceAt)
  const sealScale = mix(1.42, 1.0, sealSpin)
  const sealOpacity = clamp(progress(t, balanceAt, 0.16))

  return (
    <g
      transform={`translate(270, ${(724 + cardY).toFixed(2)})`}
      opacity={cardP}
      filter="url(#la-paper-shadow)"
    >
      {/* Cotton-rag balance verification card */}
      <path
        d="M -212 -32 L 212 -32 L 212 32 L -212 32 Z"
        fill="url(#la-cotton-paper)"
        stroke="#c5b393"
        strokeWidth="1.1"
      />
      <rect
        x="-205"
        y="-25"
        width="410"
        height="50"
        fill="none"
        stroke="rgba(139, 115, 85, 0.25)"
        strokeWidth="0.9"
      />

      {/* Right-aligned RTL text */}
      <text
        x="190"
        y="-4"
        textAnchor="end"
        fill={INK_ESPRESSO}
        fontSize="16"
        fontWeight="900"
        fontFamily="'Vazirmatn', sans-serif"
      >
        تراز ۱۰۰٪ و همگام
      </text>
      <text
        x="190"
        y="17"
        textAnchor="end"
        fill={INK_MUTED_DAY}
        fontSize="12"
        fontWeight="700"
        fontFamily="'Vazirmatn', sans-serif"
      >
        ثبت قطعی در تمام ۴ دفتر
      </text>

      {/* Pressed Emerald Wax Stamp Seal on Left */}
      <g transform={`translate(-158, 0) scale(${sealScale.toFixed(3)})`} opacity={sealOpacity}>
        <circle
          cx="0"
          cy="0"
          r="24"
          fill="url(#la-wax-emerald)"
          stroke="#064e3b"
          strokeWidth="1.2"
        />
        <circle
          cx="0"
          cy="0"
          r="19.5"
          fill="none"
          stroke="rgba(209, 250, 229, 0.55)"
          strokeWidth="1"
          strokeDasharray="2.5 2"
        />
        <path
          d="M -7 0.5 L -2 5.5 L 8 -6"
          fill="none"
          stroke="#ecfdf5"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Crisp embossed seal tag */}
      <text
        x="-120"
        y="5"
        textAnchor="start"
        fill={INK_EMERALD}
        fontSize="13.5"
        fontWeight="900"
        fontFamily="'Vazirmatn', sans-serif"
      >
        تراز کامل
      </text>
    </g>
  )
}

// ─── Main Living Abacus Stage ────────────────────────────────────────────────

interface AbacusFrameProps {
  t: number
  frameAt: number
  sweep: number[]
  manualStagger: boolean
  labelOpacity: number
  miss: { rod: number; bead: number } | null
  headline: string
  headlineTone: 'alert' | 'manual' | 'outage' | 'sync'
  headlineAt: number
  network: NetworkState
  tokenY: number
  tokenOpacity: number
  tokenTilt: number
  outageMix: number
  ambient: number
  badgeAt: number
  showBadge: boolean
  consoleMode: 'tally' | 'balance' | 'hidden'
  dots: number
  missConsole: boolean
  balanceAt: number
  syncBadge: boolean
  harmonicSweepP: number
  cursorRod: number | null
  vo: string
}

function AbacusFrame(p: AbacusFrameProps) {
  const { t, outageMix } = p
  void p.vo
  void p.ambient

  // Entrance motion for Scene 1 (Frame 0 starts crisp and grounded, subtle slide settle)
  const frameEnter = enter(t, p.frameAt, { y: 18, scale: 0.98 })

  // Surface colors interpolated smoothly between sunlit travertine and twilight slate
  const bgTop = lerpColor('#f2ece0', '#181e26', outageMix)
  const bgMid = lerpColor('#e7decb', '#12171e', outageMix)
  const bgBot = lerpColor('#d9cdb6', '#0b0e13', outageMix)
  const recessBg = lerpColor('#e5dac4', '#261f18', outageMix * 0.85)
  const ledgerPaperFill = lerpColor('#f7f0e2', '#26211a', outageMix * 0.88)

  // Headline contrast color calibrated to desk background
  const headlineColor =
    p.headlineTone === 'outage'
      ? INK_CORAL
      : p.headlineTone === 'alert'
        ? outageMix > 0.5
          ? INK_CORAL
          : INK_CRIMSON
        : p.headlineTone === 'manual'
          ? INK_SIENNA
          : INK_EMERALD

  const subInkColor = outageMix > 0.5 ? INK_MUTED_NIGHT : INK_MUTED_DAY
  const headlineStyle: CSSProperties = enter(t, p.headlineAt, { y: 10, scale: 0.98 })
  const headlineBrush = strokeDraw(t, p.headlineAt + 0.15, 0.5, 160)

  // Active stylus positioning in Scene 2
  const activeRod = p.cursorRod
  const activeRodSweep = activeRod !== null ? (p.sweep[activeRod] ?? 0) : 0
  const stylusRecoil = p.miss && activeRod === p.miss.rod ? Math.sin(t * 28) * 5 - 12 : 0
  const stylusX = mix(restX(4) + 18, countedX(4) + 18, activeRodSweep)

  return (
    <div
      dir="ltr"
      style={{
        position: 'absolute',
        inset: 0,
        width: 540,
        height: 960,
        overflow: 'hidden',
        backgroundColor: bgMid,
        fontFamily: "'Vazirmatn', -apple-system, sans-serif",
      }}
    >
      {/* Full-Bleed Architectural Studio & Tactile Craft SVG Canvas */}
      <svg
        viewBox="0 0 540 960"
        width="540"
        height="960"
        style={{ position: 'absolute', inset: 0, display: 'block' }}
        aria-hidden="true"
      >
        <StudioSvgDefs />

        {/* Layer 1: Architectural Travertine / Dusk Desk Gradient */}
        <linearGradient id="la-desk-grad" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor={bgTop} />
          <stop offset="52%" stopColor={bgMid} />
          <stop offset="100%" stopColor={bgBot} />
        </linearGradient>
        <rect x="0" y="0" width="540" height="960" fill="url(#la-desk-grad)" />

        {/* Subtle Stone/Cotton Procedural Grain */}
        <rect x="0" y="0" width="540" height="960" filter="url(#la-stone-grain)" opacity="0.9" />

        {/* Layer 2: Sunlit Window Gobo Shafts (Fade down during outage) */}
        <g opacity={(1 - outageMix * 0.85) * 0.52} filter="url(#la-soft-gobo)">
          <polygon
            points="-40,-20 220,-20 480,760 190,760"
            fill="rgba(255, 250, 236, 0.72)"
            transform={`translate(${(Math.sin(t * 0.4) * 6).toFixed(2)}, 0)`}
          />
          <polygon points="280,-20 430,-20 580,520 430,520" fill="rgba(255, 246, 224, 0.42)" />
        </g>

        {/* Independent Warm Lantern Spotlight Keeping the Abacus Alive in Scene 3 */}
        <radialGradient id="la-lantern-pool" cx="50%" cy="48%" r="46%">
          <stop
            offset="0%"
            stopColor={`rgba(251, 191, 36, ${(0.06 + outageMix * 0.22).toFixed(3)})`}
          />
          <stop
            offset="55%"
            stopColor={`rgba(217, 119, 6, ${(0.02 + outageMix * 0.1).toFixed(3)})`}
          />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
        </radialGradient>
        <rect x="0" y="140" width="540" height="620" fill="url(#la-lantern-pool)" />

        {/* Layer 3: Angled Cotton Ledger Sheet Resting Under Lower-Right of Abacus */}
        <g
          transform="translate(316, 515) rotate(-3.2)"
          filter="url(#la-paper-shadow)"
          opacity={1 - outageMix * 0.15}
        >
          <path
            d="M -185 -195 L 188 -193 L 191 196 L -182 199 Z"
            fill={ledgerPaperFill}
            stroke={outageMix > 0.5 ? 'rgba(217,164,65,0.22)' : 'rgba(166,142,108,0.45)'}
            strokeWidth="1"
          />
          {/* Subtle hand-ruled ledger margin columns on paper */}
          {[-145, -105, -65, -25, 15, 55, 95, 135, 165].map((ly) => (
            <line
              key={ly}
              x1="-166"
              y1={ly}
              x2="168"
              y2={ly}
              stroke={outageMix > 0.5 ? 'rgba(255,240,210,0.08)' : 'rgba(139,115,85,0.16)'}
              strokeWidth="0.9"
            />
          ))}
          <line
            x1="126"
            y1="-185"
            x2="126"
            y2="188"
            stroke="rgba(190, 18, 60, 0.24)"
            strokeWidth="1.2"
          />
          {/* Folio corner stamp */}
          <text
            x="156"
            y="180"
            textAnchor="end"
            fill={subInkColor}
            opacity="0.45"
            fontSize="10"
            fontWeight="700"
            fontFamily="'Vazirmatn', sans-serif"
          >
            دفتر شماره ۴
          </text>
        </g>

        {/* Layer 4: Paper Invoice Ticket (Clipped cleanly into Top Rail Intake Slot in Scene 4) */}
        <g clipPath={p.tokenY > 205 ? 'url(#la-slot-clip)' : undefined}>
          <PaperInvoiceTicket
            x={270}
            y={p.tokenY}
            tiltDeg={p.tokenTilt}
            opacity={p.tokenOpacity}
            t={t}
            drawAt={0.1}
          />
        </g>

        {/* Hand-inked curved leader dash from invoice slip to abacus in Scene 1 */}
        {p.tokenOpacity > 0.7 && p.tokenY < 185 && !p.syncBadge && (
          <path
            d="M 270 198 C 270 214, 270 226, 270 240"
            fill="none"
            stroke={outageMix > 0.5 ? 'rgba(255,240,210,0.4)' : 'rgba(15, 118, 110, 0.55)'}
            strokeWidth="1.6"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
        )}

        {/* Layer 5: Handcrafted Cedar/Walnut & Brass Counting Frame */}
        <g
          style={{
            opacity: frameEnter.opacity,
            transform: frameEnter.transform,
            transformOrigin: '270px 455px',
          }}
        >
          {/* Physical multi-layered drop shadow on desk */}
          <rect
            x="40"
            y="246"
            width="460"
            height="420"
            rx="8"
            fill="#241408"
            filter="url(#la-frame-shadow)"
          />

          {/* Recessed Ivory/Umber Interior Pocket */}
          <rect x="64" y="270" width="412" height="372" fill={recessBg} />

          {/* Inner cavity shadow cast by top & left wooden frame walls */}
          <rect x="64" y="270" width="412" height="16" fill="url(#la-recess-top)" />
          <rect x="64" y="270" width="14" height="372" fill="url(#la-recess-left)" />

          {/* Subtle Harmonic Wave Light Wash Across Cavity (Scene 4 Sweep) */}
          {p.harmonicSweepP > 0 && p.harmonicSweepP < 1 && (
            <rect
              x={mix(50, 440, p.harmonicSweepP)}
              y="270"
              width="52"
              height="372"
              fill="rgba(16, 185, 129, 0.16)"
              filter="url(#la-soft-gobo)"
            />
          )}

          {/* 4 Turned Brass Rods, Cast Shadows, Plaques & Sculpted Beads */}
          {ROD_Y.map((ry, i) => {
            const rawSweep = p.sweep[i] ?? 0
            return (
              <g key={i}>
                {/* Parallel shadow cast onto recessed backplate beneath rod */}
                <rect x="64" y={ry + 7} width="412" height="3.5" fill="rgba(22, 13, 6, 0.22)" />

                {/* Drilled side socket recesses */}
                <circle cx="64" cy={ry} r="4.5" fill="#1a0e05" />
                <circle cx="476" cy={ry} r="4.5" fill="#1a0e05" />

                {/* Cylindrical Turned Brass Rod */}
                <rect x="62" y={ry - 2.6} width="416" height="5.2" fill="url(#la-brass-v)" />

                {/* Engraved Bronze & Ivory Nameplate Strictly Above Bead Band */}
                <g transform={`translate(405, ${ry - 30})`} opacity={p.labelOpacity}>
                  <rect
                    x="-62"
                    y="-9.5"
                    width="124"
                    height="19"
                    rx="3"
                    fill="#26180d"
                    stroke="#b98628"
                    strokeWidth="0.9"
                  />
                  <circle cx="-55" cy="0" r="1.4" fill="#e6bf65" />
                  <circle cx="55" cy="0" r="1.4" fill="#e6bf65" />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill={INK_IVORY}
                    fontSize="11.5"
                    fontWeight="800"
                    fontFamily="'Vazirmatn', sans-serif"
                  >
                    {ROD_LABELS[i]}
                  </text>
                </g>

                {/* 5 Lathe-Turned Ceramic/Wood/Gemstone Beads */}
                {[0, 1, 2, 3, 4].map((j) => {
                  const isMiss = p.miss !== null && p.miss.rod === i && p.miss.bead === j

                  // Slight manual thumb-push cascade when manualStagger is active
                  const beadSweep = p.manualStagger
                    ? clamp((rawSweep - (4 - j) * 0.05) / 0.8)
                    : rawSweep
                  const easedSweep = ease(beadSweep)

                  const shake = isMiss ? Math.sin(t * 36) * 2.6 : 0
                  const cx = isMiss ? restX(j) + shake : mix(restX(j), countedX(j), easedSweep)

                  // Subtle physical momentum pitch while bead is moving
                  const velBell = Math.sin(Math.PI * easedSweep)
                  const tiltDeg = isMiss ? Math.sin(t * 24) * 3.5 : -velBell * 5.2

                  const material: BeadMaterial = isMiss
                    ? 'crimson'
                    : p.harmonicSweepP > 0.15 && easedSweep > 0.35
                      ? 'emerald'
                      : j === 2
                        ? 'carnelian'
                        : j % 2 === 1
                          ? 'turquoise'
                          : 'boxwood'

                  return (
                    <SculptedBead
                      key={j}
                      cx={cx}
                      cy={ry}
                      material={material}
                      tiltDeg={tiltDeg}
                      isJammed={isMiss}
                      t={t}
                    />
                  )
                })}
              </g>
            )
          })}

          {/* Artisan Stylus Pushing Rods in Scene 2 */}
          {activeRod !== null && (
            <ArtisanStylus x={stylusX} y={ROD_Y[activeRod]!} recoil={stylusRecoil} />
          )}

          {/* Miter-Joined Hand-Planed Walnut Frame Rails */}
          {/* Top Rail */}
          <polygon
            points="40,246 500,246 476,270 64,270"
            fill="url(#la-walnut-top)"
            stroke="#2a1609"
            strokeWidth="1"
          />
          <polygon
            points="40,246 500,246 476,270 64,270"
            filter="url(#la-wood-grain-h)"
            opacity="0.7"
          />
          {/* Top Rail Brass Ticket Intake Slot */}
          <rect
            x="210"
            y="251"
            width="120"
            height="5.5"
            rx="2"
            fill="#140a04"
            stroke="url(#la-brass-plate)"
            strokeWidth="1"
          />

          {/* Bottom Rail */}
          <polygon
            points="64,642 476,642 500,666 40,666"
            fill="url(#la-walnut-top)"
            stroke="#2a1609"
            strokeWidth="1"
          />
          <polygon
            points="64,642 476,642 500,666 40,666"
            filter="url(#la-wood-grain-h)"
            opacity="0.7"
          />

          {/* Left Stile */}
          <polygon
            points="40,246 64,270 64,642 40,666"
            fill="url(#la-walnut-side)"
            stroke="#2a1609"
            strokeWidth="1"
          />
          <polygon
            points="40,246 64,270 64,642 40,666"
            filter="url(#la-wood-grain-v)"
            opacity="0.7"
          />

          {/* Right Stile */}
          <polygon
            points="476,270 500,246 500,666 476,642"
            fill="url(#la-walnut-side)"
            stroke="#2a1609"
            strokeWidth="1"
          />
          <polygon
            points="476,270 500,246 500,666 476,642"
            filter="url(#la-wood-grain-v)"
            opacity="0.7"
          />

          {/* Top-Left Warm Studio Key-Light Edge Highlight */}
          <polyline
            points="41,664 41,247 498,247"
            fill="none"
            stroke="rgba(255, 226, 180, 0.36)"
            strokeWidth="1.4"
          />

          {/* 4 Ornate Chiseled Brass Corner Gussets */}
          <BrassCornerEscutcheon x={40} y={246} rot={0} screwAngle={0.4} />
          <BrassCornerEscutcheon x={500} y={246} rot={90} screwAngle={1.2} />
          <BrassCornerEscutcheon x={500} y={666} rot={180} screwAngle={2.1} />
          <BrassCornerEscutcheon x={40} y={666} rot={270} screwAngle={0.8} />
        </g>

        {/* Layer 6: Analog Telegraph Signal Gauge (Top-Right) */}
        <AnalogSignalGauge network={p.network} t={t} outageMix={outageMix} />

        {/* Layer 7: Lower Tactile Artifact Zone (Strictly y: 684..768, above subtitles) */}
        {p.consoleMode === 'tally' && (
          <ManualTallySlip dots={p.dots} missOn={p.missConsole} t={t} />
        )}
        {p.showBadge && <OutageEditorialBookmark t={t} badgeAt={p.badgeAt} />}
        {p.consoleMode === 'balance' && <SyncedWaxBalanceCard t={t} balanceAt={p.balanceAt} />}

        {/* Layer 8: Floating Warm Studio Dust Motes */}
        <g opacity={0.42 - outageMix * 0.22}>
          {DUST_MOTES.map((m, idx) => {
            const dx = Math.sin(t * m.sp + m.ph) * m.sx
            const dy = Math.cos(t * m.sp * 0.8 + m.ph) * m.sy
            return (
              <circle
                key={idx}
                cx={(m.bx + dx).toFixed(2)}
                cy={(m.by + dy).toFixed(2)}
                r={m.r}
                fill="#fffbeb"
              />
            )
          })}
        </g>

        {/* Subtle Editorial Brush Accent Line Under Headline */}
        {p.headline && (
          <line
            x1="210"
            y1="138"
            x2="365"
            y2="138"
            stroke={headlineColor}
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity="0.55"
            {...headlineBrush}
          />
        )}
      </svg>

      {/* Top Editorial Persian Headline (Crisp HTML Typography for Perfect HarfBuzz Shaping) */}
      {p.headline && (
        <div
          dir="rtl"
          style={{
            ...headlineStyle,
            position: 'absolute',
            top: 52,
            left: 32,
            right: 146,
            fontSize: 27,
            fontWeight: 900,
            lineHeight: 1.28,
            color: headlineColor,
            letterSpacing: '-0.01em',
            textShadow:
              outageMix > 0.5
                ? '0 2px 14px rgba(0, 0, 0, 0.65)'
                : '0 1px 0 rgba(255, 255, 255, 0.65)',
            zIndex: 10,
          }}
        >
          {p.headline}
        </div>
      )}

      {/* Fallback Headline if Empty */}
      {!p.headline && p.consoleMode !== 'balance' && (
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 706,
            left: 36,
            right: 36,
            textAlign: 'center',
            fontSize: 24,
            fontWeight: 900,
            color: outageMix > 0.5 ? INK_IVORY : INK_ESPRESSO,
          }}
        >
          یک بار بزن؛ تمام دفاتر تراز
        </div>
      )}
    </div>
  )
}

// ─── Scene 1 — HOOK 1: Jammed Frame (0.0–3.5s) ───────────────────────────────

export function AbacusHookScene({ t, scene }: { t: number; scene: Scene }) {
  const missOn = t >= 1.2
  return (
    <AbacusFrame
      t={t}
      frameAt={0.0}
      sweep={[0, 0, 0, 0]}
      manualStagger={false}
      labelOpacity={ease(progress(t, 0.35, 0.55))}
      miss={missOn ? { rod: 0, bead: 2 } : null}
      headline="صبر کن! هنوز دستی می‌نویسی؟"
      headlineTone="alert"
      headlineAt={0.05}
      network="online"
      tokenY={154}
      tokenOpacity={1}
      tokenTilt={-1.8}
      outageMix={0}
      ambient={0.3}
      badgeAt={-10}
      showBadge={false}
      consoleMode="hidden"
      dots={0}
      missConsole={false}
      balanceAt={-10}
      syncBadge={false}
      harmonicSweepP={0}
      cursorRod={null}
      vo={scene.vo}
    />
  )
}

// ─── Scene 2 — Manual Struggle Across 4 Books (3.5–10.0s) ─────────────────────

export function AbacusManualScene({ t, scene }: { t: number; scene: Scene }) {
  const rodAt = [0.8, 2.1, 3.4, 4.7]
  const sweep = rodAt.map((at) => ease(progress(t, at, 1.0)))
  const activeRod = t < rodAt[1]! ? 0 : t < rodAt[2]! ? 1 : t < rodAt[3]! ? 2 : 3
  const dots = rodAt.filter((at) => t >= at + 0.85).length
  const missOn = t >= 5.0

  return (
    <AbacusFrame
      t={t}
      frameAt={-10}
      sweep={sweep}
      manualStagger
      labelOpacity={ease(progress(t, 0.15, 0.4))}
      miss={missOn ? { rod: 3, bead: 2 } : null}
      headline="چهار بار ثبت جداگانه!"
      headlineTone="manual"
      headlineAt={0.1}
      network="online"
      tokenY={154}
      tokenOpacity={0.95}
      tokenTilt={-1.5}
      outageMix={0}
      ambient={0.4}
      badgeAt={-10}
      showBadge={false}
      consoleMode="tally"
      dots={dots}
      missConsole={missOn}
      balanceAt={-10}
      syncBadge={false}
      harmonicSweepP={0}
      cursorRod={activeRod}
      vo={scene.vo}
    />
  )
}

// ─── Scene 3 — HOOK 2 (mid): The Network Outage (10.0–15.0s) ─────────────────

export function AbacusOutageScene({ t, scene }: { t: number; scene: Scene }) {
  const outageMix = ease(progress(t, 0.28, 0.45))
  const ember = 0.5 + 0.5 * Math.sin(t * 2.2)

  return (
    <AbacusFrame
      t={t}
      frameAt={-10}
      sweep={[1, 1, 1, 0.82]}
      manualStagger={false}
      labelOpacity={1}
      miss={{ rod: 3, bead: 2 }}
      headline="اینترنت بازار قطع شد!"
      headlineTone="outage"
      headlineAt={0.3}
      network="offline"
      tokenY={154}
      tokenOpacity={0}
      tokenTilt={0}
      outageMix={outageMix}
      ambient={mix(0.45, 0.18, outageMix) + ember * 0.06}
      badgeAt={1.0}
      showBadge={t >= 1.0}
      consoleMode="hidden"
      dots={4}
      missConsole
      balanceAt={-10}
      syncBadge={false}
      harmonicSweepP={0}
      cursorRod={null}
      vo={scene.vo}
    />
  )
}

// ─── Scene 4 — RESOLUTION: One Synchronized Sweep (15.0–24.0s) ────────────────

export function AbacusSyncScene({ t, scene }: { t: number; scene: Scene }) {
  const dropP = ease(progress(t, 0.5, 0.9))
  const tokenY = mix(154, 272, dropP)
  const tokenTilt = mix(-3.5, 0, dropP)
  const tokenOpacity = 1 - ease(progress(t, 1.3, 0.35))

  const sweepAll = ease(progress(t, 1.6, 1.35))
  const sweep = [sweepAll, sweepAll, sweepAll, sweepAll]
  const reconnected = t >= 5.0

  // Smoothly return from twilight slate back into bright warm sunlit studio
  const outageMix = 1 - ease(progress(t, 1.6, 1.2))

  return (
    <AbacusFrame
      t={t}
      frameAt={-10}
      sweep={sweep}
      manualStagger={false}
      labelOpacity={1}
      miss={null}
      headline="یک حرکت؛ همگامی تمام دفاتر"
      headlineTone="sync"
      headlineAt={1.6}
      network={reconnected ? 'synced' : 'offline'}
      tokenY={tokenY}
      tokenOpacity={tokenOpacity}
      tokenTilt={tokenTilt}
      outageMix={outageMix}
      ambient={0.4 + 0.25 * ease(progress(t, 2.8, 0.7))}
      badgeAt={-10}
      showBadge={false}
      consoleMode="balance"
      dots={4}
      missConsole={false}
      balanceAt={3.2}
      syncBadge={reconnected}
      harmonicSweepP={progress(t, 1.55, 1.5)}
      cursorRod={null}
      vo={scene.vo}
    />
  )
}

// ─── Cues (deterministic, per scene local time) ──────────────────────────────

export const abacusHookCues = [
  { at: 0.0, kind: 'titleHit' as const },
  { at: 0.5, kind: 'whoosh' as const },
  { at: 1.2, kind: 'alert' as const },
]

export const abacusManualCues = [
  { at: 0.1, kind: 'whoosh' as const },
  { at: 0.8, kind: 'tick' as const },
  { at: 2.1, kind: 'tick' as const },
  { at: 3.4, kind: 'tick' as const },
  { at: 4.7, kind: 'tick' as const },
  { at: 5.0, kind: 'alert' as const },
  { at: 5.2, kind: 'impact' as const },
]

export const abacusOutageCues = [
  { at: 0.3, kind: 'alert' as const },
  { at: 0.6, kind: 'impact' as const },
  { at: 1.5, kind: 'tick' as const },
  { at: 2.5, kind: 'tick' as const },
  { at: 3.5, kind: 'softTransition' as const },
]

export const abacusSyncCues = [
  { at: 0.5, kind: 'whoosh' as const },
  { at: 1.6, kind: 'dataFlow' as const },
  { at: 3.2, kind: 'success' as const },
  { at: 5.0, kind: 'sync' as const },
  { at: 5.6, kind: 'chime' as const },
  { at: 7.0, kind: 'financialMilestone' as const },
]
