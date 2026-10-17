import React from 'react'
import { clamp, ease, progress } from '../../engine/math'

export interface TapedNavyCardProps {
  children?: React.ReactNode
  label?: string
  t?: number
  startAt?: number
  rotation?: number
  width?: number | string
  style?: React.CSSProperties
  className?: string
}

/**
 * Deep Navy Card (#121D35) taped with a translucent masking tape strip at the top.
 */
export const TapedNavyCard: React.FC<TapedNavyCardProps> = ({
  children,
  label,
  t = 1,
  startAt = 0,
  rotation = -1.8,
  width = 460,
  style,
  className = '',
}) => {
  const p = ease(clamp(progress(t, startAt, 0.45)))

  return (
    <div
      className={`taped-navy-card-wrap ${className}`}
      style={{
        position: 'relative',
        width,
        maxWidth: '92%',
        margin: '0 auto',
        transform: `rotate(${rotation}deg) scale(${0.85 + 0.15 * p})`,
        opacity: p,
        filter: 'drop-shadow(0 16px 36px rgba(18, 29, 53, 0.28))',
        ...style,
      }}
    >
      {/* Top Masking Tape Strip */}
      <div
        style={{
          position: 'absolute',
          top: -14,
          left: '50%',
          transform: 'translateX(-50%) rotate(1deg)',
          width: 110,
          height: 30,
          background: 'rgba(255, 255, 255, 0.68)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          borderLeft: '2px dashed rgba(20, 25, 38, 0.12)',
          borderRight: '2px dashed rgba(20, 25, 38, 0.12)',
          zIndex: 4,
          pointerEvents: 'none',
          backdropFilter: 'blur(3px)',
        }}
      />

      {/* Main Card Body */}
      <div
        style={{
          position: 'relative',
          background: '#121D35',
          borderRadius: 20,
          padding: '28px 24px 24px',
          color: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          direction: 'rtl',
          zIndex: 2,
        }}
      >
        {label && (
          <div
            style={{
              display: 'inline-block',
              background: '#F6B91E',
              color: '#121D35',
              padding: '4px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 800,
              marginBottom: 14,
              letterSpacing: '0.02em',
            }}
          >
            {label}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
