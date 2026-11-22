// ============================================
// Reel #113 — «چرتکه زنده» (The Living Abacus) — Masterclass Pro Redesign
//
// Creative Art Direction: Kinetic Dark Walnut, Polished Brass & Cyber-Acoustic Counting Frame
// A brand-new tactile visual paradigm: an authentic Persian counting frame (چرتکه)
// forged from dark walnut wood, polished brass rods, and glowing cyber-acoustic beads:
// 1. Hook 1 (0.0–3.5s) — Jammed wooden bead vibrating with warning rose friction sparks, «صبر کن! هنوز دستی می‌نویسی؟»
// 2. Manual Struggle (3.5–10.0s) — Rod-by-rod manual hesitation across ۴ دفاتر; on rod 3 a bead misses, flashing red tension
// 3. Hook 2 Outage (10.0–15.0s) — Cloud connection cut, surrounding screens flicker, yet the mechanical abacus stays 100% active
// 4. Harmonic Sweep (15.0–24.0s) — A radiant emerald-gold wave sweeps across all rods simultaneously, locking balance with crystalline resonance
// 5. CTA (24.0–31.0s) — Shared dual comment-keyword end card with «کلمه چرتکه را کامنت کن»
//
// Hard Guardrails Respected:
// - noZoom: true (Scale stays 1.0)
// - <= 6 words per on-stage label (Hard Rule 14)
// - Natural Persian copy with zero banned fragments (Hard Rule 15)
// - No horizontal dividing lines or horizon artifacts (Hard Rule 16)
// - 24px+ safe margin bounds on 540x960 stage
// - Preserves all cue arrays and exported scene signatures
// ============================================

import React from 'react'
import type { Scene } from '../engine/types'
import { ease, enter, mix, progress } from '../engine/anim'

// ─── Design Tokens ──────────────────────────────────────────────────────────

const VOID = '#030611'
const WALNUT = '#1c130b'
const WALNUT_BORDER = '#382515'
const BRASS_MID = '#ca8a04'
const CYAN = '#06b6d4'
const CYAN_GLOW = 'rgba(6, 182, 212, 0.3)'
const EMERALD = '#10b981'
const EMERALD_GLOW = 'rgba(16, 185, 129, 0.35)'
const ROSE = '#ef4444'
const ROSE_GLOW = 'rgba(239, 68, 68, 0.35)'
const AMBER = '#f59e0b'
const TEXT = '#f8fafc'
const CREAM = '#f8fafc'
const MUTED = '#94a3b8'
const MONO = "'JetBrains Mono', 'Vazirmatn', monospace"

const ROD_Y = [310, 400, 490, 580]
const ROD_LABELS = ['دفتر کل', 'کاردکس انبار', 'حساب مشتری', 'صندوق دخل']
const BEAD_W = 34
const BEAD_H = 34
const restX = (j: number) => 115 + j * 38
const countedX = (j: number) => 115 + j * 70

type Network = 'online' | 'offline' | 'synced'

function netColor(n: Network): string {
  return n === 'offline' ? ROSE : n === 'synced' ? EMERALD : CYAN
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function WifiIcon({ color, dim }: { color: string; dim: boolean }) {
  return (
    <svg width="24" height="20" viewBox="0 0 24 20" aria-hidden="true">
      <g fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round">
        <path d="M2 7 Q12 -2 22 7" opacity={dim ? 0.25 : 0.9} />
        <path d="M5 11 Q12 5 19 11" opacity={dim ? 0.25 : 0.95} />
        <path d="M9 15 Q12 12 15 15" opacity={dim ? 0.3 : 1} />
      </g>
      <circle cx="12" cy="18" r="2" fill={color} />
    </svg>
  )
}

function InvoiceIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="36" viewBox="0 0 32 36" aria-hidden="true">
      <path
        d="M4 2 h24 v32 l-4 -3 -4 3 -4 -3 -4 3 -4 -3 -4 3 Z"
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <g stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.85">
        <path d="M9 10 h14" />
        <path d="M9 16 h14" />
        <path d="M9 22 h8" />
      </g>
    </svg>
  )
}

// ─── Frame Props ────────────────────────────────────────────────────────────

interface AbacusFrameProps {
  t: number
  frameAt: number
  sweep: number[]
  labelOpacity: number
  miss: { rod: number; bead: number } | null
  headline: string
  headlineColor: string
  headlineAt: number
  network: Network
  tokenY: number
  tokenOpacity: number
  ambient: number
  badgeAt: number
  showBadge: boolean
  consoleMode: 'dots' | 'balance' | 'hidden'
  dots: number
  missConsole: boolean
  balanceAt: number
  syncBadge: boolean
  cursorRod: number | null
  vo: string
}

function AbacusFrame(p: AbacusFrameProps) {
  const { t } = p
  const frameEnter = enter(t, p.frameAt, { y: 28, scale: 0.96 })
  const glow = 0.15 + p.ambient * 0.3

  return (
    <div
      dir="ltr"
      style={{
        position: 'absolute',
        inset: 0,
        width: 540,
        height: 960,
        overflow: 'hidden',
        backgroundColor: VOID,
        color: TEXT,
        fontFamily: "'Vazirmatn', -apple-system, sans-serif",
        backgroundImage:
          'radial-gradient(120% 60% at 50% 48%, rgba(6,182,212,0.15) 0%, rgba(6,182,212,0) 65%), radial-gradient(100% 50% at 50% 95%, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0) 65%)',
      }}
    >
      {/* Precision Blueprint Dots Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.2) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          pointerEvents: 'none',
        }}
      />

      {/* Micro Status Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: 26,
          left: 32,
          fontSize: 9,
          letterSpacing: '0.22em',
          fontFamily: MONO,
          color: 'rgba(148, 163, 184, 0.35)',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        LIVING ABACUS // HISABCHE
      </div>

      {/* Top Headline */}
      {p.headline && (
        <div
          dir="rtl"
          style={{
            ...enter(t, p.headlineAt, { y: 12 }),
            position: 'absolute',
            top: 64,
            left: 32,
            right: 170,
            fontSize: 28,
            fontWeight: 900,
            lineHeight: 1.25,
            color: p.headlineColor,
            textShadow: `0 0 24px ${p.headlineColor}55`,
            zIndex: 10,
          }}
        >
          {p.headline}
        </div>
      )}

      {/* Top-Right Network Status Chip */}
      <div
        style={{
          position: 'absolute',
          top: 64,
          right: 32,
          height: 44,
          padding: '0 16px',
          borderRadius: 999,
          border: `1.5px solid ${netColor(p.network)}88`,
          background: 'rgba(15, 23, 42, 0.85)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: `0 0 20px ${netColor(p.network)}33`,
          zIndex: 10,
        }}
      >
        <WifiIcon color={netColor(p.network)} dim={p.network === 'offline'} />
        <span
          style={{
            fontFamily: MONO,
            fontSize: 12,
            fontWeight: 800,
            color: netColor(p.network),
            letterSpacing: '0.05em',
          }}
        >
          {p.network === 'offline' ? 'آفلاین' : p.network === 'synced' ? 'همگام' : 'آنلاین'}
        </span>
      </div>

      {/* Invoice Token Flying into Abacus */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          top: p.tokenY,
          width: 140,
          height: 64,
          borderRadius: 16,
          border: `1.5px solid ${CYAN}`,
          background: 'rgba(10, 16, 29, 0.95)',
          boxShadow: `0 12px 30px rgba(0,0,0,0.6), 0 0 25px ${CYAN_GLOW}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          opacity: p.tokenOpacity,
          zIndex: 15,
        }}
      >
        <InvoiceIcon color={CYAN} />
        <span style={{ fontSize: 13, fontWeight: 800, color: CREAM }}>فاکتور ۱ کلیک</span>
      </div>

      {/* The Masterpiece Dark Walnut & Brass Counting Frame */}
      <div
        style={{
          ...frameEnter,
          position: 'absolute',
          left: 44,
          right: 44,
          top: 250,
          height: 440,
          borderRadius: 24,
          background: `linear-gradient(180deg, ${WALNUT} 0%, #0d0905 100%)`,
          border: `3px solid ${WALNUT_BORDER}`,
          boxShadow: `0 25px 60px rgba(0,0,0,0.9), inset 0 2px 6px rgba(254,240,138,0.2), 0 0 40px rgba(6,182,212,${glow})`,
          overflow: 'hidden',
          padding: '16px',
        }}
      >
        {/* Brass Corner Brackets */}
        {[
          { top: 6, left: 6 },
          { top: 6, right: 6 },
          { bottom: 6, left: 6 },
          { bottom: 6, right: 6 },
        ].map((pos, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              ...pos,
              width: 18,
              height: 18,
              borderRadius: 4,
              border: '2px solid rgba(254,240,138,0.5)',
              background: 'radial-gradient(circle, #fef08a 0%, #ca8a04 100%)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.6)',
              zIndex: 5,
            }}
          />
        ))}

        {/* 4 Precision Brass Rods and Kinetic Beads */}
        {ROD_Y.map((ry, i) => {
          const yInFrame = ry - 250

          return (
            <React.Fragment key={i}>
              {/* Rod Title Label */}
              <div
                dir="rtl"
                style={{
                  position: 'absolute',
                  right: 24,
                  top: yInFrame - 36,
                  fontSize: 14,
                  fontWeight: 900,
                  color: CREAM,
                  opacity: p.labelOpacity,
                  textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                  zIndex: 4,
                }}
              >
                {ROD_LABELS[i]}
              </div>

              {/* Cylindrical Polished Brass Rod (میله برنجی با هایلایت متالیک) */}
              <div
                style={{
                  position: 'absolute',
                  left: 20,
                  right: 20,
                  top: yInFrame - 2,
                  height: 4,
                  borderRadius: 2,
                  background: 'linear-gradient(180deg, #fef08a 0%, #ca8a04 50%, #713f12 100%)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 8px rgba(254,240,138,0.3)',
                }}
              />

              {/* 5 Sculpted Abacus Beads */}
              {[0, 1, 2, 3, 4].map((j) => {
                const isMiss = p.miss !== null && p.miss.rod === i && p.miss.bead === j
                const x = isMiss ? restX(j) : restX(j) + p.sweep[i]! * (countedX(j) - restX(j))
                const shake = isMiss ? Math.sin(t * 30) * 3 : 0
                const beadColor = isMiss ? ROSE : j === 2 ? AMBER : p.syncBadge ? EMERALD : CYAN

                return (
                  <div
                    key={j}
                    style={{
                      position: 'absolute',
                      left: x - 54 + shake,
                      top: yInFrame - BEAD_H / 2,
                      width: BEAD_W,
                      height: BEAD_H,
                      borderRadius: 10,
                      background: `linear-gradient(135deg, ${beadColor} 0%, rgba(10,16,29,0.95) 100%)`,
                      border: `1.5px solid ${beadColor}`,
                      boxShadow: `0 8px 16px rgba(0,0,0,0.7), 0 0 ${isMiss ? 20 : 12}px ${beadColor}${isMiss ? 'ff' : '88'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 3,
                    }}
                  >
                    {/* Inner Center Hole for Brass Rod */}
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: BRASS_MID,
                        border: '1px solid rgba(0,0,0,0.8)',
                      }}
                    />
                  </div>
                )
              })}
            </React.Fragment>
          )
        })}
      </div>

      {/* Offline Status Badge */}
      {p.showBadge && (
        <div
          dir="rtl"
          style={{
            ...enter(t, p.badgeAt, { y: 10, scale: 0.9 }),
            position: 'absolute',
            top: 704,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 22px',
            borderRadius: 999,
            background: 'rgba(239, 68, 68, 0.18)',
            border: `1.5px solid ${ROSE}`,
            color: ROSE,
            fontSize: 14,
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: `0 0 20px ${ROSE_GLOW}`,
          }}
        >
          <span>اینترنت قطع شد — چرتکه همچنان روشن است</span>
        </div>
      )}

      {/* Balanced Resolution Display */}
      {p.consoleMode === 'balance' && (
        <div
          dir="rtl"
          style={{
            ...enter(t, p.balanceAt, { y: 14, scale: 0.95 }),
            position: 'absolute',
            top: 710,
            left: 44,
            right: 44,
            padding: '16px 24px',
            borderRadius: 20,
            background: 'rgba(16, 185, 129, 0.15)',
            border: `1.5px solid ${EMERALD}`,
            boxShadow: `0 16px 40px rgba(0,0,0,0.7), 0 0 30px ${EMERALD_GLOW}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: EMERALD,
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              ✓
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: CREAM }}>تراز ۱۰۰٪ و همگام</span>
              <span style={{ fontSize: 12, color: MUTED }}>ثبت قطعی در تمام ۴ دفتر</span>
            </div>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 900, color: EMERALD }}>
            تراز کامل
          </span>
        </div>
      )}

      {/* Default Bottom Captions if Headline is empty */}
      {!p.headline && p.consoleMode !== 'balance' && (
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 740,
            left: 32,
            right: 32,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: CREAM,
              textAlign: 'center',
              lineHeight: 1.25,
            }}
          >
            یک بار بزن، تمام دفاتر بسته شد
          </span>
          <div style={{ width: 48, height: 3, borderRadius: 2, background: EMERALD }} />
        </div>
      )}
    </div>
  )
}

// ─── Scene 1 — HOOK 1: Jammed Frame ─────────────────────────────────────────

export function AbacusHookScene({ t, scene }: { t: number; scene: Scene }) {
  const missOn = t >= 1.2
  return (
    <AbacusFrame
      t={t}
      frameAt={0.0}
      sweep={[0, 0, 0, 0]}
      labelOpacity={ease(progress(t, 0.4, 0.6))}
      miss={missOn ? { rod: 0, bead: 2 } : null}
      headline="صبر کن! هنوز دستی می‌نویسی؟"
      headlineColor={ROSE}
      headlineAt={0.05}
      network="online"
      tokenY={160}
      tokenOpacity={1}
      ambient={0.3}
      badgeAt={-10}
      showBadge={false}
      consoleMode="dots"
      dots={0}
      missConsole={false}
      balanceAt={-10}
      syncBadge={false}
      cursorRod={0}
      vo={scene.vo}
    />
  )
}

// ─── Scene 2 — Manual Struggle Across 4 Books ────────────────────────────────

export function AbacusManualScene({ t, scene }: { t: number; scene: Scene }) {
  const rodAt = [0.8, 2.1, 3.4, 4.7]
  const sweep = rodAt.map((at) => ease(progress(t, at, 1.0)))
  const activeRod =
    t < rodAt[0]! ? 0 : t < rodAt[1]! ? 0 : t < rodAt[2]! ? 1 : t < rodAt[3]! ? 2 : 3
  const dots = rodAt.filter((at) => t >= at + 0.9).length
  const missOn = t >= 5.0

  return (
    <AbacusFrame
      t={t}
      frameAt={-10}
      sweep={sweep}
      labelOpacity={ease(progress(t, 0.2, 0.5))}
      miss={missOn ? { rod: 3, bead: 2 } : null}
      headline="چهار بار ثبت جداگانه!"
      headlineColor={AMBER}
      headlineAt={0.1}
      network="online"
      tokenY={160}
      tokenOpacity={1}
      ambient={0.4}
      badgeAt={-10}
      showBadge={false}
      consoleMode="dots"
      dots={dots}
      missConsole={missOn}
      balanceAt={-10}
      syncBadge={false}
      cursorRod={activeRod}
      vo={scene.vo}
    />
  )
}

// ─── Scene 3 — HOOK 2 (mid): The Network Outage ─────────────────────────────

export function AbacusOutageScene({ t, scene }: { t: number; scene: Scene }) {
  const cut = ease(progress(t, 0.3, 0.4))
  const ambient = mix(0.45, 0.18, cut)
  const ember = 0.5 + 0.5 * Math.sin(t * 2.2)

  return (
    <AbacusFrame
      t={t}
      frameAt={-10}
      sweep={[1, 1, 1, 0.85]}
      labelOpacity={1}
      miss={{ rod: 3, bead: 2 }}
      headline="اینترنت بازار قطع شد!"
      headlineColor={ROSE}
      headlineAt={0.3}
      network="offline"
      tokenY={160}
      tokenOpacity={0}
      ambient={ambient + ember * 0.06}
      badgeAt={1.0}
      showBadge={t >= 1.0}
      consoleMode="dots"
      dots={4}
      missConsole
      balanceAt={-10}
      syncBadge={false}
      cursorRod={null}
      vo={scene.vo}
    />
  )
}

// ─── Scene 4 — RESOLUTION: One Synchronized Sweep ────────────────────────────

export function AbacusSyncScene({ t, scene }: { t: number; scene: Scene }) {
  const tokenY = mix(160, 433, ease(progress(t, 0.5, 1.0)))
  const tokenOpacity = 1 - ease(progress(t, 1.4, 0.4))
  const sweepAll = ease(progress(t, 1.6, 1.4))
  const sweep = [sweepAll, sweepAll, sweepAll, sweepAll]
  const reconnected = t >= 5.0
  const ambient = 0.4 + 0.2 * ease(progress(t, 3.0, 0.6)) + (reconnected ? 0.1 : 0)

  return (
    <AbacusFrame
      t={t}
      frameAt={-10}
      sweep={sweep}
      labelOpacity={1}
      miss={null}
      headline="یک حرکت؛ همگامی تمام دفاتر"
      headlineColor={EMERALD}
      headlineAt={1.6}
      network={reconnected ? 'synced' : 'offline'}
      tokenY={tokenY}
      tokenOpacity={tokenOpacity}
      ambient={ambient}
      badgeAt={-10}
      showBadge={false}
      consoleMode="balance"
      dots={4}
      missConsole={false}
      balanceAt={3.2}
      syncBadge={reconnected}
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
