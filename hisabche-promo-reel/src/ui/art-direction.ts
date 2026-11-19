// ============================================
// Hisabche Motion Studio — single art-direction source for UI primitives.
//
// This module replaces the "website template" vocabulary (glass bento cards,
// browser chrome, neon dashboards) with motion-graphics materials: a fixed
// obsidian stage, one accent family, a restrained paper medium, deterministic
// numerals, and transform/opacity-only motion.
//
// Rules encoded here: MOTION_GRAPHICS_UI_RULES.md §§21-29, 33, 66, 99.
// ============================================

import type { CSSProperties } from 'react'

/** The only accent family. No component may introduce its own hex literals. */
export const ACCENT = {
  cyan: { solid: '#22d3ee', soft: 'rgba(34,211,238,0.14)', glow: 'rgba(34,211,238,0.28)' },
  purple: { solid: '#c084fc', soft: 'rgba(192,132,252,0.14)', glow: 'rgba(192,132,252,0.28)' },
  red: { solid: '#fb7185', soft: 'rgba(251,113,133,0.14)', glow: 'rgba(251,113,133,0.30)' },
  green: { solid: '#4ade80', soft: 'rgba(74,222,128,0.14)', glow: 'rgba(74,222,128,0.28)' },
  amber: { solid: '#f6b91e', soft: 'rgba(246,185,30,0.14)', glow: 'rgba(246,185,30,0.28)' },
} as const

export type AccentName = keyof typeof ACCENT

/** Stage / paper materials. Everything else is an accent on top of these. */
export const MATERIAL = {
  void: '#050609',
  panel: '#0b0e14',
  panelEdge: 'rgba(255,255,255,0.10)',
  ink: '#f4f6fb',
  muted: '#94a3b8',
  paper: '#ece5d6',
  paperEdge: '#d6cdb8',
  paperInk: '#121d35',
} as const

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const

/**
 * Deterministic Persian-Indic digits. Intl.NumberFormat('fa-IR') emits Latin
 * digits with Western commas on hosts without full-ICU data; this char-map
 * never does. Rule 16/66 / layout-defect-laws band 6.
 */
export function faNumber(n: number): string {
  const rounded = Math.round(n)
  const sign = rounded < 0 ? '−' : ''
  const grouped = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, '٬')
  return sign + grouped.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)] ?? d)
}

/** Static grain tile. Animated filters are banned; ≤0.35 keeps type legible. */
export function grain(opacity = 0.22): CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    opacity,
    mixBlendMode: 'soft-light',
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
    backgroundSize: '160px 160px',
  }
}

/** The LTR-pinned stage root. Persian clusters opt into dir="rtl" themselves. */
export function stage(): CSSProperties {
  return {
    position: 'relative',
    direction: 'ltr',
    overflow: 'hidden',
    boxSizing: 'border-box',
    color: MATERIAL.ink,
    transform: 'none',
  }
}

/** Transform/opacity-only entrance. Rule 33. */
export function reveal(t: number, at: number, dur = 0.45): CSSProperties {
  const raw = Math.max(0, Math.min(1, (t - at) / dur))
  const p = 1 - Math.pow(1 - raw, 3)
  return {
    opacity: p,
    transform: `translate3d(0, ${((1 - p) * 20).toFixed(2)}px, 0)`,
    willChange: 'transform, opacity',
  }
}

/** Deterministic stroke draw. Rule 33 / 40. */
export function draw(t: number, at: number, dur: number, length: number): CSSProperties {
  const raw = Math.max(0, Math.min(1, (t - at) / dur))
  const p = 1 - Math.pow(1 - raw, 3)
  return {
    strokeDasharray: length,
    strokeDashoffset: length * (1 - p),
    opacity: raw > 0 ? 1 : 0,
  }
}

/** A cropped product fragment — never full browser chrome. Rule 51-57. */
export function fragment(tone: AccentName = 'cyan'): CSSProperties {
  const c = ACCENT[tone]
  return {
    position: 'relative',
    background: MATERIAL.panel,
    border: `1px solid ${c.soft}`,
    borderInlineStart: `2px solid ${c.solid}`,
    borderRadius: 2,
    overflow: 'hidden',
    boxSizing: 'border-box',
    boxShadow: `0 16px 40px rgba(0,0,0,0.55)`,
  }
}

/** One-line caption plate. Not a glass card, not a bento tile. */
export function plate(tone: AccentName = 'cyan'): CSSProperties {
  const c = ACCENT[tone]
  return {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 6,
    padding: '2px 0',
    borderBottom: `1px solid ${c.soft}`,
    color: MATERIAL.muted,
    direction: 'rtl',
  }
}
