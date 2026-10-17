import React from 'react'
import { clamp, ease, progress } from '../../engine/math'

export interface HandDrawnLoopProps {
  children?: React.ReactNode
  color?: string
  strokeWidth?: number
  t?: number
  startAt?: number
  dur?: number
  padding?: number
  style?: React.CSSProperties
  className?: string
}

/**
 * Hand-Drawn SVG Loop / Circle that draws rapidly around key Persian terms and badges.
 */
export const HandDrawnLoop: React.FC<HandDrawnLoopProps> = ({
  children,
  color = '#F6B91E',
  strokeWidth = 3,
  t = 1,
  startAt = 0,
  dur = 0.45,
  padding = 10,
  style,
  className = '',
}) => {
  const p = ease(clamp(progress(t, startAt, dur)))
  const totalLength = 320
  const dashOffset = totalLength * (1 - p)

  return (
    <span
      className={`hand-drawn-loop-wrap ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${padding}px`,
        ...style,
      }}
    >
      <span style={{ position: 'relative', zIndex: 2 }}>{children}</span>
      <svg
        viewBox="0 0 120 60"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          inset: -4,
          width: 'calc(100% + 8px)',
          height: 'calc(100% + 8px)',
          zIndex: 3,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        {/* Hand-drawn double loop path */}
        <path
          d="M 12 32 C 14 12, 106 8, 108 30 C 110 48, 18 54, 8 32 C 4 16, 85 14, 114 26"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={totalLength}
          strokeDashoffset={dashOffset}
          opacity={clamp(p * 2.5)}
        />
      </svg>
    </span>
  )
}
