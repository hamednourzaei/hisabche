import React from 'react'
import { clamp, ease, progress } from '../engine/math'

export interface ContinuousLineTravelerProps {
  t: number
  title?: string
  style?: React.CSSProperties
  className?: string
}

/**
 * Continuous Line Traveler Template (`continuous-line-traveler`)
 * A single glowing unbroken SVG line navigates through story stages,
 * drawing the problem, warehouse inventory, profit curve, and the final CTA.
 */
export const ContinuousLineTravelerTemplate: React.FC<ContinuousLineTravelerProps> = ({
  t,
  title = 'مسیر بی‌وقفه جریان نقدینگی',
  style,
  className = '',
}) => {
  const lineP = ease(clamp(progress(t, 0.2, 3.8)))
  const totalLength = 1600
  const dashOffset = totalLength * (1 - lineP)

  return (
    <div
      className={`continuous-line-template ${className}`}
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        overflow: 'hidden',
        background: '#040711',
        color: '#ffffff',
        direction: 'rtl',
        ...style,
      }}
    >
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 10,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.12em' }}>
          ره‌گیری زنجیره ارزش
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{title}</div>
      </div>

      {/* The Single Continuous Unbroken Thread SVG */}
      <svg
        viewBox="0 0 540 960"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
      >
        <defs>
          <linearGradient id="traveler-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
          <filter id="traveler-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <path
          d="M 270 140 C 380 140, 420 220, 270 260 C 120 300, 100 390, 270 410 C 440 430, 420 540, 270 580 C 100 620, 180 740, 270 780 C 360 820, 400 860, 270 870 C 180 870, 180 910, 270 910"
          fill="none"
          stroke="url(#traveler-grad)"
          strokeWidth={4.5}
          strokeDasharray={totalLength}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          filter="url(#traveler-glow)"
        />
      </svg>

      {/* Floating Story Station Markers along the Line */}
      <div
        style={{
          position: 'absolute',
          top: 240,
          left: 40,
          background: 'rgba(15, 23, 42, 0.85)',
          padding: '8px 16px',
          borderRadius: 12,
          border: '1px solid #38bdf8',
          fontSize: 13,
          fontWeight: 800,
          opacity: clamp(progress(t, 0.8, 0.3)),
        }}
      >
        ۱. خرید و قیمت تمام‌شده
      </div>

      <div
        style={{
          position: 'absolute',
          top: 400,
          right: 40,
          background: 'rgba(15, 23, 42, 0.85)',
          padding: '8px 16px',
          borderRadius: 12,
          border: '1px solid #22d3ee',
          fontSize: 13,
          fontWeight: 800,
          opacity: clamp(progress(t, 1.8, 0.3)),
        }}
      >
        ۲. گردش انبار و ضایعات
      </div>

      <div
        style={{
          position: 'absolute',
          top: 760,
          left: 50,
          background: 'rgba(15, 23, 42, 0.85)',
          padding: '8px 16px',
          borderRadius: 12,
          border: '1px solid #4ade80',
          fontSize: 13,
          fontWeight: 800,
          opacity: clamp(progress(t, 2.8, 0.3)),
        }}
      >
        ۳. سود خالص و تراز بانک
      </div>
    </div>
  )
}
