import React from 'react'
import { clamp, ease, progress } from '../../engine/math'

export interface FastSpinClockProps {
  badgeText?: string
  t?: number
  startAt?: number
  spinSpeed?: number
  size?: number
  style?: React.CSSProperties
  className?: string
}

/**
 * Fast-Spinning Analog Clock with Persian numerals and a yellow duration pill
 * indicating time-saving and lightning-fast setup.
 */
export const FastSpinClock: React.FC<FastSpinClockProps> = ({
  badgeText = 'راه‌اندازی در ۳ دقیقه',
  t = 1,
  startAt = 0,
  spinSpeed = 4,
  size = 140,
  style,
  className = '',
}) => {
  const enterP = ease(clamp(progress(t, startAt, 0.4)))
  const localT = Math.max(0, t - startAt)

  // Fast spinning hands
  const secondAngle = (localT * 360 * spinSpeed) % 360
  const minuteAngle = (localT * 60 * spinSpeed * 0.25) % 360
  const hourAngle = (localT * 30 * spinSpeed * 0.1) % 360

  const r = size / 2
  const cx = r
  const cy = r

  // Persian numerals 1 to 12
  const faNumerals = ['۱۲', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹', '۱۰', '۱۱']

  return (
    <div
      className={`fast-spin-clock-wrap ${className}`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        transform: `scale(${0.8 + 0.2 * enterP})`,
        opacity: enterP,
        ...style,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: '#0d131f',
          border: '4px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5)',
          position: 'relative',
        }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Dial Hour Markers */}
          {faNumerals.map((num, i) => {
            const angle = (i * 30 - 90) * (Math.PI / 180)
            const numR = r - 16
            const nx = cx + numR * Math.cos(angle)
            const ny = cy + numR * Math.sin(angle)
            return (
              <text
                key={i}
                x={nx}
                y={ny}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={size > 120 ? 10 : 8}
                fontWeight={800}
                fill="#f8fafc"
              >
                {num}
              </text>
            )
          })}

          {/* Hour Hand */}
          <line
            x1={cx}
            y1={cy}
            x2={cx + r * 0.45 * Math.cos(((hourAngle - 90) * Math.PI) / 180)}
            y2={cy + r * 0.45 * Math.sin(((hourAngle - 90) * Math.PI) / 180)}
            stroke="#f8fafc"
            strokeWidth={3.5}
            strokeLinecap="round"
          />

          {/* Minute Hand */}
          <line
            x1={cx}
            y1={cy}
            x2={cx + r * 0.65 * Math.cos(((minuteAngle - 90) * Math.PI) / 180)}
            y2={cy + r * 0.65 * Math.sin(((minuteAngle - 90) * Math.PI) / 180)}
            stroke="#f8fafc"
            strokeWidth={2.5}
            strokeLinecap="round"
          />

          {/* Yellow Second Hand */}
          <line
            x1={cx}
            y1={cy}
            x2={cx + r * 0.78 * Math.cos(((secondAngle - 90) * Math.PI) / 180)}
            y2={cy + r * 0.78 * Math.sin(((secondAngle - 90) * Math.PI) / 180)}
            stroke="#F6B91E"
            strokeWidth={2}
            strokeLinecap="round"
          />

          {/* Center Pinion */}
          <circle cx={cx} cy={cy} r={4} fill="#F6B91E" stroke="#ffffff" strokeWidth={1.5} />
        </svg>
      </div>

      {badgeText && (
        <div
          style={{
            background: '#F6B91E',
            color: '#121D35',
            padding: '6px 14px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 800,
            boxShadow: '0 4px 12px rgba(18, 29, 53, 0.1)',
            whiteSpace: 'nowrap',
          }}
        >
          {badgeText}
        </div>
      )}
    </div>
  )
}
