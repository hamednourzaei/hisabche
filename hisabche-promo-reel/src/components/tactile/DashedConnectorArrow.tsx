import React from 'react'
import { clamp, ease, progress } from '../../engine/math'

export interface DashedConnectorArrowProps {
  x1: number
  y1: number
  x2: number
  y2: number
  curveOffset?: number
  strokeColor?: string
  t?: number
  startAt?: number
  dur?: number
  arrowSize?: number
  className?: string
}

/**
 * Animated Dashed Bezier Arrow leading the viewer's eye downward
 * between vertical train stations on the tactile canvas.
 */
export const DashedConnectorArrow: React.FC<DashedConnectorArrowProps> = ({
  x1,
  y1,
  x2,
  y2,
  curveOffset = 60,
  strokeColor = '#121D35',
  t = 1,
  startAt = 0,
  dur = 0.8,
  arrowSize = 14,
  className = '',
}) => {
  const p = ease(clamp(progress(t, startAt, dur)))

  // Control points for organic cubic bezier
  const midY = (y1 + y2) / 2
  const cp1x = x1 + curveOffset
  const cp1y = midY - 20
  const cp2x = x2 - curveOffset * 0.7
  const cp2y = midY + 20

  const pathD = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`

  // Approximate total length for smooth dash offset reveal
  const dx = x2 - x1
  const dy = y2 - y1
  const approxLen = Math.sqrt(dx * dx + dy * dy) * 1.25
  const dashOffset = approxLen * (1 - p)

  // Arrowhead rotation angle based on end tangent
  const angleRad = Math.atan2(y2 - cp2y, x2 - cp2x)
  const angleDeg = (angleRad * 180) / Math.PI

  return (
    <svg
      className={`dashed-connector-arrow ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <defs>
        <marker
          id={`arrowhead-${x1}-${y1}-${x2}-${y2}`}
          viewBox="0 0 16 16"
          refX="8"
          refY="8"
          markerWidth={arrowSize}
          markerHeight={arrowSize}
          orient="auto"
        >
          <path
            d="M 2 3 L 14 8 L 2 13 L 5 8 Z"
            fill={strokeColor}
            opacity={p > 0.85 ? clamp((p - 0.85) / 0.15) : 0}
          />
        </marker>
      </defs>

      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={3}
        strokeDasharray="10 8"
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        opacity={clamp(p * 2)}
      />

      {/* Hand-drawn arrowhead at terminal tip */}
      {p > 0.8 && (
        <g
          transform={`translate(${x2}, ${y2}) rotate(${angleDeg}) scale(${p > 0.9 ? 1 : (p - 0.8) * 10})`}
          opacity={clamp((p - 0.8) / 0.2)}
        >
          <path
            d="M -12 -7 L 0 0 L -12 7 L -9 0 Z"
            fill={strokeColor}
            stroke={strokeColor}
            strokeWidth={1}
            strokeLinejoin="round"
          />
        </g>
      )}
    </svg>
  )
}
