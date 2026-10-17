import React from 'react'
import { clamp, ease, progress } from '../../engine/math'

export interface AudioWaveformPillProps {
  t?: number
  startAt?: number
  barCount?: number
  width?: number | string
  style?: React.CSSProperties
  className?: string
}

/**
 * Audio Waveform Pill with 35 dynamic vertical bars and a highlighted yellow active center zone.
 */
export const AudioWaveformPill: React.FC<AudioWaveformPillProps> = ({
  t = 1,
  startAt = 0,
  barCount = 35,
  width = 280,
  style,
  className = '',
}) => {
  const enterP = ease(clamp(progress(t, startAt, 0.35)))
  const localT = Math.max(0, t - startAt)

  const bars = Array.from({ length: barCount }, (_, i) => {
    // Distance from center for bell-curve active region
    const centerNorm = Math.abs(i - barCount / 2) / (barCount / 2)
    const isCenter = centerNorm < 0.35

    // Multi-harmonic deterministic pulse height (zero Math.random)
    const pulse1 = Math.sin(localT * 6 + i * 0.4)
    const pulse2 = Math.cos(localT * 9 - i * 0.3)
    const rawH = 6 + (pulse1 * 0.5 + pulse2 * 0.5 + 1) * 10 * (1 - centerNorm * 0.5)
    const h = Math.max(4, Math.min(26, rawH))

    return {
      h,
      color: isCenter ? '#F6B91E' : '#121D35',
      opacity: isCenter ? 1 : 0.65,
    }
  })

  return (
    <div
      className={`audio-waveform-pill-wrap ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 18px',
        background: '#ffffff',
        borderRadius: 999,
        border: '1.5px solid rgba(18, 29, 53, 0.15)',
        boxShadow: '0 8px 24px rgba(18, 29, 53, 0.1)',
        width,
        height: 44,
        boxSizing: 'border-box',
        transform: `scale(${0.8 + 0.2 * enterP})`,
        opacity: enterP,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          height: '100%',
          width: '100%',
          justifyContent: 'center',
        }}
      >
        {bars.map((b, idx) => (
          <div
            key={idx}
            style={{
              width: 3,
              height: b.h,
              borderRadius: 2,
              background: b.color,
              opacity: b.opacity,
              transition: 'height 0.05s linear',
            }}
          />
        ))}
      </div>
    </div>
  )
}
