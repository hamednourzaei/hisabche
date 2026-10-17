import React from 'react'
import { clamp, ease, progress } from '../../engine/math'

export interface KineticSwitchTextProps {
  words: {
    text: string
    highlight?: boolean
    switchedTo?: string
    switchAt?: number
    bold?: boolean
  }[]
  t?: number
  startAt?: number
  gap?: number
  fontSize?: number
  lineHeight?: number
  style?: React.CSSProperties
  className?: string
}

/**
 * Kinetic Switch Text supporting spoken word emphasis, bold popping,
 * and vertical slot-switching from one word to another.
 */
export const KineticSwitchText: React.FC<KineticSwitchTextProps> = ({
  words,
  t = 1,
  startAt = 0,
  gap = 0.2,
  fontSize = 32,
  lineHeight = 1.5,
  style,
  className = '',
}) => {
  return (
    <div
      className={`kinetic-switch-text-wrap ${className}`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px 12px',
        direction: 'rtl',
        fontSize,
        lineHeight,
        color: '#121D35',
        ...style,
      }}
    >
      {words.map((item, idx) => {
        const wordT = startAt + idx * gap
        const enterP = ease(clamp(progress(t, wordT, 0.25)))
        const isSwitched = item.switchedTo && item.switchAt !== undefined && t >= item.switchAt
        const switchP =
          item.switchAt !== undefined ? ease(clamp(progress(t, item.switchAt, 0.22))) : 0

        const activeText = isSwitched ? item.switchedTo : item.text
        const isHighlighted = item.highlight || (isSwitched && switchP > 0.5)

        return (
          <span
            key={idx}
            style={{
              position: 'relative',
              display: 'inline-block',
              fontWeight: item.bold || isHighlighted ? 900 : 700,
              color: isHighlighted ? '#121D35' : '#121D35',
              background: isHighlighted ? 'rgba(246, 185, 30, 0.35)' : 'transparent',
              padding: isHighlighted ? '2px 8px' : '0 2px',
              borderRadius: 6,
              transform: `scale(${0.7 + 0.3 * enterP + (isHighlighted ? 0.06 : 0)})`,
              opacity: enterP,
              transition: 'background 0.2s ease, transform 0.2s ease',
            }}
          >
            {activeText}
          </span>
        )
      })}
    </div>
  )
}
