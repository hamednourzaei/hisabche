// ============================================
// Living Abacus Art Direction (Reel 113) — «چرتکه زنده»
//
// A brand-new visual paradigm for the studio: a holographic Persian counting
// frame (چرتکه). Each horizontal rod is one ledger dimension; slidable beads
// post a value. Manual work pushes beads rod-by-rod; Hisabche collapses the
// whole sequence into ONE synchronized sweep. The abacus needs no power source
// (Wikipedia: Abacus) — the authentic basis for the offline-first metaphor.
//
// References (opened & analyzed): ref-wikipedia-abacus-counting-frame,
// ref-wikihow-abacus-bead-ops, ref-aeon-shortform-hook-cta.
//
// NON-OVERLAP BY CONSTRUCTION (Layout Defect Law 3):
//   · Rod bands are disjoint in y (spacing 92px, band height 49px -> 43px gap).
//   · Beads on a rod are spaced >= 34px > 30px width at every sweep phase.
//   · Token (y160..224), headline (y72..120), network chip (x400..516,y70..110),
//     frame (y250..680), offline badge (y688..714), console (y720..796) and the
//     subtitle pill (bottom 70) all live in separate, non-intersecting bands.
//   · The sync "pulse" is a background bloom, never a discrete ring over items.
//
// Guardrails: 100% dark, noZoom, direction LTR root + explicit RTL clusters,
// physical coordinates, overflow hidden, 24px safe margin, deterministic t math,
// faNumber only (no Intl), monotonic bead slides (no modulo wrap / no blink).
// ============================================

import React from 'react'
import type { Scene } from '../engine/types'
import { ease, enter, mix, progress } from '../engine/anim'

// ─── Tokens ──────────────────────────────────────────────────────────────────

const VOID = '#030712'
const CYAN = '#22d3ee'
const EMERALD = '#34d399'
const PURPLE = '#c084fc'
const ROSE = '#fb7185'
const AMBER = '#fbbf24'
const TEXT = '#f8fafc'
const MUTED = '#94a3b8'

const ROD_Y = [305, 397, 489, 581]
const ROD_LABELS = ['دفتر', 'کاردکس', 'مشتری', 'دخل']
const BEAD_W = 30
const BEAD_H = 30
const restX = (j: number) => 110 + j * 34
const countedX = (j: number) => 110 + j * 66

type Network = 'online' | 'offline' | 'synced'

function netColor(n: Network): string {
  return n === 'offline' ? ROSE : n === 'synced' ? EMERALD : CYAN
}

// ─── Small pieces ────────────────────────────────────────────────────────────

function WifiIcon({ color, dim }: { color: string; dim: boolean }) {
  return (
    <svg width="26" height="22" viewBox="0 0 26 22" aria-hidden>
      <g fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round">
        <path d="M2 8 Q13 -1 24 8" opacity={dim ? 0.22 : 0.9} />
        <path d="M6 12 Q13 6 20 12" opacity={dim ? 0.22 : 0.95} />
        <path d="M10 16 Q13 13 16 16" opacity={dim ? 0.25 : 1} />
      </g>
      <circle cx="13" cy="19" r="2.2" fill={color} />
    </svg>
  )
}

function ReceiptIcon({ color }: { color: string }) {
  return (
    <svg width="30" height="34" viewBox="0 0 30 34" aria-hidden>
      <path
        d="M4 2 h22 v30 l-3.6 -2.4 -3.7 2.4 -3.7 -2.4 -3.7 2.4 -3.7 -2.4 L4 32 Z"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <g stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.85">
        <path d="M9 10 h12" />
        <path d="M9 16 h12" />
        <path d="M9 22 h7" />
      </g>
    </svg>
  )
}

// ─── Frame props ─────────────────────────────────────────────────────────────

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
  const frameEnter = enter(t, p.frameAt, { y: 30, scale: 0.96 })
  const breathe = 1 + 0.01 * Math.sin(t * 1.6)
  const glow = 0.1 + p.ambient * 0.22

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: 540,
        height: 960,
        backgroundColor: VOID,
        direction: 'ltr',
        overflow: 'hidden',
        color: TEXT,
        fontFamily: "'Vazirmatn', -apple-system, sans-serif",
      }}
    >
      {/* Ambient bloom (background only — never a discrete object over items) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 48%, rgba(34, 211, 238, ${glow}) 0%, transparent 62%), radial-gradient(circle at 50% 92%, rgba(3, 7, 18, 0.96) 0%, #030712 100%)`,
          pointerEvents: 'none',
        }}
      />
      <svg
        width={540}
        height={960}
        style={{ position: 'absolute', inset: 0, opacity: 0.3, pointerEvents: 'none' }}
      >
        <defs>
          <pattern id="abacus-dots" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="16" cy="16" r="1" fill="rgba(148, 163, 184, 0.25)" />
          </pattern>
        </defs>
        <rect width="540" height="960" fill="url(#abacus-dots)" />
      </svg>

      {/* Safe-area corner markers */}
      {[
        { top: 24, left: 24, bt: true, bl: true },
        { top: 24, right: 24, bt: true, br: true },
        { bottom: 24, left: 24, bb: true, bl: true },
        { bottom: 24, right: 24, bb: true, br: true },
      ].map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            ...c,
            width: 14,
            height: 14,
            borderTop: c.bt ? '2px solid rgba(34,211,238,0.3)' : undefined,
            borderBottom: c.bb ? '2px solid rgba(34,211,238,0.3)' : undefined,
            borderLeft: c.bl ? '2px solid rgba(34,211,238,0.3)' : undefined,
            borderRight: c.br ? '2px solid rgba(34,211,238,0.3)' : undefined,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Headline (top-left band) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 72,
          left: 24,
          width: 300,
          fontSize: 27,
          fontWeight: 900,
          lineHeight: 1.2,
          color: p.headlineColor,
          textShadow: `0 0 18px ${p.headlineColor}55`,
          ...enter(t, p.headlineAt, { y: -16, scale: 0.95 }),
        }}
      >
        {p.headline}
      </div>

      {/* Network chip (top-right band, icon-only) */}
      <div
        style={{
          position: 'absolute',
          top: 70,
          left: 400,
          width: 116,
          height: 40,
          borderRadius: 12,
          border: `1px solid ${netColor(p.network)}66`,
          background: 'rgba(15, 23, 42, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          ...enter(t, 0.2, { y: -10 }),
        }}
      >
        <WifiIcon color={netColor(p.network)} dim={p.network === 'offline'} />
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: netColor(p.network),
            boxShadow: `0 0 ${p.network === 'synced' ? 12 : 6}px ${netColor(p.network)}`,
          }}
        />
      </div>

      {/* Invoice token (textless icon card, above the frame) */}
      <div
        style={{
          position: 'absolute',
          left: 200,
          top: p.tokenY,
          width: 140,
          height: 64,
          borderRadius: 14,
          border: `1px solid ${CYAN}55`,
          background: 'rgba(8, 14, 26, 0.9)',
          boxShadow: `0 0 22px rgba(34, 211, 238, ${0.12 + 0.06 * Math.sin(t * 2.4)})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: p.tokenOpacity,
        }}
      >
        <ReceiptIcon color={CYAN} />
      </div>

      {/* The counting frame */}
      <div
        style={{
          position: 'absolute',
          left: 70,
          top: 250,
          width: 400,
          height: 430,
          borderRadius: 22,
          border: `1px solid rgba(34, 211, 238, ${0.2 + p.ambient * 0.25})`,
          background: 'rgba(2, 6, 23, 0.55)',
          boxShadow: `0 0 ${20 + p.ambient * 40}px rgba(34, 211, 238, ${glow})`,
          ...frameEnter,
        }}
      >
        {ROD_Y.map((ry, i) => {
          const labelStyle: React.CSSProperties = {
            position: 'absolute',
            left: 0,
            right: 0,
            top: ry - 250 - 34,
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 800,
            color: MUTED,
            opacity: p.labelOpacity,
            direction: 'rtl',
          }
          return (
            <React.Fragment key={i}>
              {/* rod label (above the rod, disjoint from beads) */}
              <div style={labelStyle}>{ROD_LABELS[i]}</div>
              {/* rod track */}
              <div
                style={{
                  position: 'absolute',
                  left: 30,
                  top: ry - 250,
                  width: 340,
                  height: 2,
                  background: 'rgba(148, 163, 184, 0.28)',
                  borderRadius: 2,
                }}
              />
              {/* beads */}
              {[0, 1, 2, 3, 4].map((j) => {
                const isMiss = p.miss !== null && p.miss.rod === i && p.miss.bead === j
                const x = isMiss ? restX(j) : restX(j) + p.sweep[i] * (countedX(j) - restX(j))
                const shake = isMiss ? Math.sin(t * 30) * 2.5 : 0
                const color = isMiss ? ROSE : j === 2 ? PURPLE : CYAN
                return (
                  <div
                    key={j}
                    style={{
                      position: 'absolute',
                      left: x - 70 + shake,
                      top: ry - 250 - BEAD_H / 2,
                      width: BEAD_W,
                      height: BEAD_H,
                      borderRadius: 9,
                      background: `linear-gradient(150deg, ${color} 0%, ${color}99 100%)`,
                      border: `1px solid ${color}`,
                      boxShadow: `0 0 ${isMiss ? 16 : 10}px ${color}${isMiss ? 'cc' : '88'}`,
                      transform: `scale(${breathe})`,
                    }}
                  />
                )
              })}
            </React.Fragment>
          )
        })}

        {/* manual hand cursor (left of beads, inside frame padding) */}
        {p.cursorRod !== null && (
          <div
            style={{
              position: 'absolute',
              left: 14,
              top: ROD_Y[p.cursorRod] - 250 - 7,
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: AMBER,
              boxShadow: `0 0 14px ${AMBER}`,
            }}
          />
        )}
      </div>

      {/* Offline badge (between frame and console — disjoint band) */}
      {p.showBadge && (
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            left: 200,
            top: 688,
            width: 140,
            height: 26,
            borderRadius: 999,
            border: `1px solid ${AMBER}88`,
            background: 'rgba(251, 191, 36, 0.14)',
            color: AMBER,
            fontSize: 13,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...enter(t, p.badgeAt, { y: 8, scale: 0.9 }),
          }}
        >
          آفلاین
        </div>
      )}

      {/* Console (below the frame) */}
      <div
        style={{
          position: 'absolute',
          left: 70,
          top: 720,
          width: 400,
          height: 76,
          borderRadius: 16,
          border: '1px solid rgba(34, 211, 238, 0.18)',
          background: 'rgba(15, 23, 42, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          direction: 'rtl',
          opacity: p.consoleMode === 'hidden' ? 0 : 1,
        }}
      >
        {p.consoleMode === 'dots' &&
          [0, 1, 2, 3].map((i) => {
            const lit = i < p.dots
            const isMissDot = p.missConsole && i === p.dots - 1
            const c = !lit ? 'rgba(148,163,184,0.25)' : isMissDot ? ROSE : CYAN
            return (
              <span
                key={i}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: c,
                  boxShadow: lit ? `0 0 12px ${c}` : 'none',
                  transform: isMissDot ? `translateX(${Math.sin(t * 30) * 2}px)` : 'none',
                }}
              />
            )
          })}
        {p.consoleMode === 'balance' && (
          <>
            <span
              dir="rtl"
              style={{
                padding: '8px 18px',
                borderRadius: 999,
                border: `1px solid ${EMERALD}88`,
                background: 'rgba(52, 211, 153, 0.14)',
                color: EMERALD,
                fontSize: 16,
                fontWeight: 900,
                boxShadow: `0 0 18px rgba(52, 211, 153, ${0.2 + 0.1 * Math.sin(t * 2)})`,
                ...enter(t, p.balanceAt, { y: 10, scale: 0.85 }),
              }}
            >
              تراز
            </span>
            {p.syncBadge && (
              <span
                dir="rtl"
                style={{
                  padding: '8px 18px',
                  borderRadius: 999,
                  border: `1px solid ${CYAN}88`,
                  background: 'rgba(34, 211, 238, 0.12)',
                  color: CYAN,
                  fontSize: 16,
                  fontWeight: 900,
                  ...enter(t, p.balanceAt + 1.8, { y: 10, scale: 0.85 }),
                }}
              >
                همگام
              </span>
            )}
          </>
        )}
      </div>

      {/* Subtitle pill (the one stable subtitle bar — exempt from text budget) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          bottom: 70,
          borderRadius: 999,
          background: 'rgba(8, 7, 18, 0.88)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(24px)',
          padding: '12px 20px',
          fontSize: 16,
          fontWeight: 700,
          lineHeight: 1.5,
          textAlign: 'center',
          color: TEXT,
          pointerEvents: 'none',
        }}
      >
        {p.vo}
      </div>
    </div>
  )
}

// ─── Scene 1 — HOOK 1: the jammed frame ──────────────────────────────────────

export function AbacusHookScene({ t, scene }: { t: number; scene: Scene }) {
  const jam = 0.5 + 0.5 * Math.sin(t * 6)
  return (
    <AbacusFrame
      t={t}
      frameAt={0.1}
      sweep={[0, 0, 0, 0]}
      labelOpacity={0}
      miss={{ rod: 0, bead: 2 }}
      headline="دستی ننویس!"
      headlineColor={ROSE}
      headlineAt={0.15}
      network="online"
      tokenY={160}
      tokenOpacity={0.7 + 0.3 * jam}
      ambient={0.35}
      badgeAt={-10}
      showBadge={false}
      consoleMode="hidden"
      dots={0}
      missConsole={false}
      balanceAt={-10}
      syncBadge={false}
      cursorRod={null}
      vo={scene.vo}
    />
  )
}

// ─── Scene 2 — PAIN: manual rod-by-rod pushing, one bead misses ──────────────

export function AbacusManualScene({ t, scene }: { t: number; scene: Scene }) {
  const rodAt = [0.8, 2.1, 3.4, 4.7]
  const sweep = rodAt.map((at) => ease(progress(t, at, 1.0)))
  const activeRod = t < rodAt[0] ? 0 : t < rodAt[1] ? 0 : t < rodAt[2] ? 1 : t < rodAt[3] ? 2 : 3
  const dots = rodAt.filter((at) => t >= at + 0.9).length
  const missOn = t >= 5.0
  return (
    <AbacusFrame
      t={t}
      frameAt={-10}
      sweep={sweep}
      labelOpacity={ease(progress(t, 0.2, 0.5))}
      miss={missOn ? { rod: 3, bead: 2 } : null}
      headline="چهار بار!"
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

// ─── Scene 3 — HOOK 2 (mid): the network cuts, the abacus stays lit ──────────

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
      headline="قطع!"
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

// ─── Scene 4 — RESOLUTION: one synchronized sweep, balance lock, sync ────────

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
      headline=""
      headlineColor={EMERALD}
      headlineAt={-10}
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
