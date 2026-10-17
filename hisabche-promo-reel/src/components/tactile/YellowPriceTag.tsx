import React from 'react'
import { clamp, ease, progress } from '../../engine/math'

export interface YellowPriceTagProps {
  text: string
  sub?: string
  t?: number
  startAt?: number
  rotation?: number
  scale?: number
  showString?: boolean
  style?: React.CSSProperties
  className?: string
}

/**
 * Iconic Yellow Price Tag (#F6B91E) with punch hole ring and trailing black string.
 */
export const YellowPriceTag: React.FC<YellowPriceTagProps> = ({
  text,
  sub,
  t = 1,
  startAt = 0,
  rotation = 2,
  scale = 1,
  showString = true,
  style,
  className = '',
}) => {
  const p = ease(clamp(progress(t, startAt, 0.4)))

  return (
    <div
      className={`yellow-price-tag-wrap ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        transform: `rotate(${rotation}deg) scale(${scale * (0.8 + 0.2 * p)})`,
        opacity: p,
        filter: 'drop-shadow(0 10px 20px rgba(18, 29, 53, 0.16))',
        ...style,
      }}
    >
      {/* Trailing Curved String SVG */}
      {showString && (
        <svg
          viewBox="0 0 60 70"
          style={{
            position: 'absolute',
            top: -55,
            right: 18,
            width: 60,
            height: 70,
            overflow: 'visible',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <path
            d="M 12 65 C 10 35, 45 30, 38 4 C 36 -6, 24 10, 22 18"
            fill="none"
            stroke="rgba(255, 255, 255, 0.45)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* Main Tag Body */}
      <div
        style={{
          position: 'relative',
          background: '#F6B91E',
          color: '#121D35',
          padding: '12px 24px 12px 32px',
          borderRadius: '8px 16px 16px 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          border: '1.5px solid rgba(18, 29, 53, 0.2)',
          clipPath: 'polygon(18px 0%, 100% 0%, 100% 100%, 18px 100%, 0% 50%)',
          zIndex: 2,
        }}
      >
        {/* Punched Hole */}
        <div
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#070a12',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.6)',
          }}
        />

        <span
          style={{
            fontSize: 21,
            fontWeight: 900,
            letterSpacing: '-0.02em',
            direction: 'rtl',
            whiteSpace: 'nowrap',
          }}
        >
          {text}
        </span>
        {sub && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              opacity: 0.85,
              direction: 'rtl',
            }}
          >
            {sub}
          </span>
        )}
      </div>
    </div>
  )
}
