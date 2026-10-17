import React from 'react'
import { clamp, ease, progress } from '../../engine/math'

export interface StrikethroughPaperTagProps {
  label: string
  t?: number
  startAt?: number
  strikeAt?: number
  rotation?: number
  strikeColor?: string
  style?: React.CSSProperties
  className?: string
}

/**
 * Paper badge representing legacy friction workflows that gets aggressively slashed
 * with an animated hand-drawn strike-through stroke.
 */
export const StrikethroughPaperTag: React.FC<StrikethroughPaperTagProps> = ({
  label,
  t = 1,
  startAt = 0,
  strikeAt = 0.4,
  rotation = -2.5,
  strikeColor = '#ef4444',
  style,
  className = '',
}) => {
  const enterP = ease(clamp(progress(t, startAt, 0.35)))
  const strikeP = ease(clamp(progress(t, strikeAt, 0.28)))

  return (
    <div
      className={`strikethrough-paper-tag ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 18px',
        background: 'rgba(24, 32, 47, 0.95)',
        border: '1.5px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
        boxShadow: '0 8px 18px rgba(0, 0, 0, 0.4)',
        color: '#f8fafc',
        fontSize: 15,
        fontWeight: 700,
        direction: 'rtl',
        transform: `rotate(${rotation}deg) scale(${0.7 + 0.3 * enterP})`,
        opacity: enterP,
        ...style,
      }}
    >
      <span style={{ position: 'relative', zIndex: 1 }}>{label}</span>

      {/* Animated Black Marker Strikethrough Slash */}
      <svg
        viewBox="0 0 100 20"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          top: '30%',
          left: '-6%',
          width: '112%',
          height: 18,
          zIndex: 3,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        <path
          d="M 2 14 Q 50 4, 98 8"
          fill="none"
          stroke={strikeColor}
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeDasharray={120}
          strokeDashoffset={120 * (1 - strikeP)}
          opacity={0.92}
        />
        {/* Secondary slight jagged back-slash for authentic marker feel */}
        {strikeP > 0.5 && (
          <path
            d="M 88 10 Q 52 14, 12 12"
            fill="none"
            stroke={strikeColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={120}
            strokeDashoffset={120 * (1 - (strikeP - 0.5) * 2)}
            opacity={0.7}
          />
        )}
      </svg>
    </div>
  )
}
