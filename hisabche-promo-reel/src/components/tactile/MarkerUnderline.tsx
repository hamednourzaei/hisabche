import React from 'react'
import { clamp, ease, progress } from '../../engine/math'

export interface MarkerUnderlineProps {
  children?: React.ReactNode
  color?: string
  height?: number
  t?: number
  startAt?: number
  dur?: number
  thickness?: number
  style?: React.CSSProperties
  className?: string
}

/**
 * Animated Felt-Tip Marker Underline (#F6B91E) that sweeps smoothly under key Persian words.
 */
export const MarkerUnderline: React.FC<MarkerUnderlineProps> = ({
  children,
  color = '#F6B91E',
  height = 10,
  t = 1,
  startAt = 0,
  dur = 0.35,
  thickness = 8,
  style,
  className = '',
}) => {
  const p = ease(clamp(progress(t, startAt, dur)))

  return (
    <span
      className={`marker-underline-wrap ${className}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        ...style,
      }}
    >
      <span style={{ position: 'relative', zIndex: 2 }}>{children}</span>
      <svg
        viewBox="0 0 100 20"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          bottom: -4,
          left: '-4%',
          width: '108%',
          height: height + 6,
          zIndex: 1,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        <path
          d="M 2 12 Q 28 6, 52 13 T 98 10"
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={110}
          strokeDashoffset={110 * (1 - p)}
          opacity={0.88}
          style={{
            mixBlendMode: 'multiply',
          }}
        />
      </svg>
    </span>
  )
}
