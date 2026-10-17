import React from 'react'
import { clamp, ease, progress } from '../../engine/math'

export interface TornPaperStripProps {
  children?: React.ReactNode
  text?: string
  t?: number
  startAt?: number
  rotation?: number
  width?: number | string
  style?: React.CSSProperties
  className?: string
}

/**
 * White Paper Strip with procedural torn jagged edges and organic paper drop shadow.
 */
export const TornPaperStrip: React.FC<TornPaperStripProps> = ({
  children,
  text,
  t = 1,
  startAt = 0,
  rotation = 0.8,
  width = '90%',
  style,
  className = '',
}) => {
  const p = ease(clamp(progress(t, startAt, 0.4)))

  return (
    <div
      className={`torn-paper-strip-wrap ${className}`}
      style={{
        position: 'relative',
        width,
        margin: '0 auto',
        transform: `rotate(${rotation}deg) scaleX(${0.6 + 0.4 * p}) scaleY(${0.9 + 0.1 * p})`,
        opacity: p,
        filter: 'drop-shadow(0 12px 24px rgba(0, 0, 0, 0.45))',
        ...style,
      }}
    >
      <div
        style={{
          position: 'relative',
          background: 'rgba(24, 33, 49, 0.96)',
          color: '#f8fafc',
          padding: '16px 28px',
          direction: 'rtl',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          // Torn paper jagged teeth on left and right edges
          clipPath:
            'polygon(0% 0%, 100% 0%, 98% 12%, 100% 25%, 98% 38%, 100% 50%, 97% 62%, 100% 75%, 98% 88%, 100% 100%, 0% 100%, 2% 88%, 0% 75%, 3% 62%, 0% 50%, 2% 38%, 0% 25%, 2% 12%)',
          textAlign: 'center',
          fontSize: 18,
          fontWeight: 800,
          lineHeight: 1.6,
        }}
      >
        {text ? <span>{text}</span> : children}
      </div>
    </div>
  )
}
