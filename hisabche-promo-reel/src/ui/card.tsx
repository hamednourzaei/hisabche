// ============================================
// Card primitives — rebuilt as motion-graphic plates, not glass bento tiles.
// Exported API (TONE, Card, Badge) is frozen; only the visual language changed.
// Rules: 22, 26, 28, 53, 98.
// ============================================

import type { CSSProperties, ReactNode } from 'react'

import type { Tone } from '../engine/types'
import { ACCENT, MATERIAL } from './art-direction'
import { Icon } from './icons'

/** Back-compat palette name. Values come from the single art-direction source. */
export const TONE: Record<Tone, { solid: string; soft: string; glow: string }> = {
  cyan: ACCENT.cyan,
  purple: ACCENT.purple,
  red: ACCENT.red,
  green: ACCENT.green,
}

/**
 * A plate: the product fragment sits on an obsidian field with one accent
 * rule on the leading edge. No backdrop-blur, no 24px glass radius, no
 * omnidirectional neon — those read as a website card, not a film frame.
 */
export function Card({
  tone = 'cyan',
  glow = 1,
  style,
  className = '',
  children,
}: {
  tone?: Tone
  glow?: number
  style?: CSSProperties
  className?: string
  children: ReactNode
}) {
  const c = TONE[tone]
  const edge = Math.min(1, Math.max(0, glow))
  return (
    <div
      className={`card ${className}`}
      data-mg-plate={tone}
      style={{
        position: 'relative',
        boxSizing: 'border-box',
        background: MATERIAL.panel,
        border: `1px solid ${MATERIAL.panelEdge}`,
        borderInlineStart: `3px solid ${c.solid}`,
        borderRadius: 0,
        backdropFilter: 'none',
        boxShadow: `0 24px 48px rgba(0,0,0,0.55), inset 0 0 0 1px ${c.soft}`,
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* a single restrained accent wash, never a full neon halo */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          insetInlineStart: 0,
          top: 0,
          bottom: 0,
          width: 2,
          background: c.solid,
          opacity: 0.25 + 0.5 * edge,
          pointerEvents: 'none',
        }}
      />
      {children}
    </div>
  )
}

/** A role marker: square, hairline ring, one glyph. Not a glowing pill. */
export function Badge({
  icon,
  tone = 'cyan',
  size = 54,
}: {
  icon: string
  tone?: Tone
  size?: number
}) {
  const c = TONE[tone]
  return (
    <div
      className="badge"
      data-mg-marker={tone}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: c.soft,
        border: `1px solid ${c.solid}`,
        color: c.solid,
        boxShadow: `0 6px 18px rgba(0,0,0,0.45), inset 0 0 0 3px ${MATERIAL.void}`,
        transform: 'rotate(-2deg)',
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.44)} />
    </div>
  )
}
