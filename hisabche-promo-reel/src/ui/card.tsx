import type { CSSProperties, ReactNode } from 'react'

import type { Tone } from '../engine/types'
import { Icon } from './icons'

export const TONE: Record<Tone, { solid: string; soft: string; glow: string }> = {
  cyan: { solid: '#22d3ee', soft: 'rgba(6,182,212,0.16)', glow: 'rgba(6,182,212,0.28)' },
  purple: { solid: '#c084fc', soft: 'rgba(168,85,247,0.16)', glow: 'rgba(168,85,247,0.28)' },
  red: { solid: '#fb7185', soft: 'rgba(244,63,94,0.16)', glow: 'rgba(244,63,94,0.28)' },
  green: { solid: '#4ade80', soft: 'rgba(34,197,94,0.16)', glow: 'rgba(34,197,94,0.28)' },
}

/** The glass bento card. `glow` 0..1 scales the neon. */
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
  return (
    <div
      className={`card ${className}`}
      style={{
        borderColor:
          c.solid +
          Math.round(40 + 140 * glow)
            .toString(16)
            .padStart(2, '0'),
        boxShadow: `0 0 ${10 + 22 * glow}px ${c.glow.replace('0.28', String(0.08 + 0.2 * glow))}, inset 0 1px 0 rgba(255,255,255,0.05)`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** A round glowing badge with an icon. */
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
      style={{
        width: size,
        height: size,
        background: c.soft,
        boxShadow: `0 0 18px ${c.glow}`,
        border: `1px solid ${c.solid}66`,
        color: c.solid,
      }}
    >
      <Icon name={icon} size={size * 0.46} />
    </div>
  )
}
