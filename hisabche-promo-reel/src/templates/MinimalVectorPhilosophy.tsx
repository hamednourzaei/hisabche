import React from 'react'
import { clamp, ease, mix, progress } from '../engine/math'

export interface MinimalVectorPhilosophyProps {
  t: number
  title?: string
  subtitle?: string
  style?: React.CSSProperties
  className?: string
}

/**
 * Minimal Vector Philosophy Template (`minimal-vector-philosophy`)
 * Dan Koe style stark pitch-black canvas with pure geometric vector lines
 * transitioning from chaotic entanglement to perfect mathematical symmetry.
 */
export const MinimalVectorPhilosophyTemplate: React.FC<MinimalVectorPhilosophyProps> = ({
  t,
  title = 'پیچیدگی در برابر وضوح',
  subtitle = 'کسب‌وکار شما نیاز به شلوغی ندارد؛ نیاز به نظم دارد.',
  style,
  className = '',
}) => {
  const alignP = ease(clamp(progress(t, 1.8, 1.4)))

  // 12 concentric orbital nodes transitioning from chaotic offsets to perfect concentric circles
  const nodeCount = 8
  const cx = 270
  const cy = 480

  return (
    <div
      className={`minimal-vector-template ${className}`}
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        overflow: 'hidden',
        background: '#000000',
        color: '#ffffff',
        direction: 'rtl',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '60px 24px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Title */}
      <div style={{ textAlign: 'center', zIndex: 10, marginBottom: 20 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.15em',
          }}
        >
          فلسفه کنترل مالی
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, marginTop: 8 }}>{title}</div>
      </div>

      {/* Main Vector Geometric Choreography */}
      <svg
        viewBox="0 0 540 540"
        width={420}
        height={420}
        style={{ overflow: 'visible', margin: 'auto 0' }}
      >
        {/* Chaotic -> Concentric Orbit Rings */}
        {Array.from({ length: 4 }).map((_, rIdx) => {
          const targetR = 50 + rIdx * 40
          const chaosR = targetR + Math.sin(rIdx * 2) * 35 * (1 - alignP)
          const rx = mix(chaosR, targetR, alignP)
          const ry = mix(chaosR * 0.8, targetR, alignP)
          return (
            <ellipse
              key={rIdx}
              cx={cx}
              cy={cy}
              rx={rx}
              ry={ry}
              fill="none"
              stroke="#ffffff"
              strokeWidth={1}
              strokeDasharray={alignP > 0.8 ? 'none' : '4 4'}
              opacity={0.3 + 0.4 * alignP}
            />
          )
        })}

        {/* Dynamic Nodes */}
        {Array.from({ length: nodeCount }).map((_, i) => {
          const angle = (i / nodeCount) * Math.PI * 2
          const chaosX = cx + Math.cos(angle * 1.5) * 120 + Math.sin(i) * 40
          const chaosY = cy + Math.sin(angle * 1.5) * 120 - Math.cos(i) * 40
          const orderX = cx + Math.cos(angle) * 130
          const orderY = cy + Math.sin(angle) * 130

          const curX = mix(chaosX, orderX, alignP)
          const curY = mix(chaosY, orderY, alignP)

          return (
            <g key={i}>
              <line
                x1={cx}
                y1={cy}
                x2={curX}
                y2={curY}
                stroke="#ffffff"
                strokeWidth={0.8}
                opacity={0.25}
              />
              <circle cx={curX} cy={curY} r={4} fill={alignP > 0.8 ? '#22d3ee' : '#ffffff'} />
            </g>
          )
        })}

        {/* Center Kernel */}
        <circle cx={cx} cy={cy} r={9} fill="#ffffff" />
        {alignP > 0.7 && (
          <circle
            cx={cx}
            cy={cy}
            r={18}
            fill="none"
            stroke="#22d3ee"
            strokeWidth={1.5}
            opacity={alignP}
          />
        )}
      </svg>

      {/* Subtitle Message */}
      <div
        style={{
          textAlign: 'center',
          fontSize: 16,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.75)',
          lineHeight: 1.7,
          maxWidth: 380,
          zIndex: 10,
        }}
      >
        {subtitle}
      </div>
    </div>
  )
}
