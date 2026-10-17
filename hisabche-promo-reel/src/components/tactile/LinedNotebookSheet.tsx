import React from 'react'
import { clamp, ease, progress } from '../../engine/math'

export interface NotebookLineItem {
  text: string
  sub?: string
  checked?: boolean
  highlight?: boolean
}

export interface LinedNotebookSheetProps {
  title?: string
  lines: NotebookLineItem[]
  t?: number
  startAt?: number
  rotation?: number
  width?: number | string
  style?: React.CSSProperties
  className?: string
}

/**
 * Realistic Ruled Lined Notebook Sheet with right-hand margin line,
 * top tape, and animated line-by-line reveal.
 */
export const LinedNotebookSheet: React.FC<LinedNotebookSheetProps> = ({
  title,
  lines,
  t = 1,
  startAt = 0,
  rotation = 1.2,
  width = 460,
  style,
  className = '',
}) => {
  const p = ease(clamp(progress(t, startAt, 0.45)))

  return (
    <div
      className={`lined-notebook-sheet-wrap ${className}`}
      style={{
        position: 'relative',
        width,
        maxWidth: '92%',
        margin: '0 auto',
        transform: `rotate(${rotation}deg) scale(${0.85 + 0.15 * p})`,
        opacity: p,
        filter: 'drop-shadow(0 18px 38px rgba(0, 0, 0, 0.45))',
        ...style,
      }}
    >
      {/* Top Tape */}
      <div
        style={{
          position: 'absolute',
          top: -12,
          right: '25%',
          width: 90,
          height: 26,
          background: 'rgba(255, 255, 255, 0.15)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          zIndex: 4,
          transform: 'rotate(-2deg)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Main Lined Paper Body */}
      <div
        style={{
          position: 'relative',
          background: '#0d131f',
          borderRadius: 12,
          padding: '24px 28px 24px 20px',
          color: '#f8fafc',
          direction: 'rtl',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backgroundImage:
            'repeating-linear-gradient(transparent, transparent 35px, rgba(255, 255, 255, 0.06) 36px)',
          backgroundPosition: '0 40px',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* Right Red/Yellow Margin Line (RTL Notebook) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 48,
            width: 2,
            background: 'rgba(246, 185, 30, 0.55)',
            zIndex: 1,
          }}
        />

        {title && (
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              marginBottom: 16,
              color: '#f8fafc',
              paddingRight: 32,
              position: 'relative',
              zIndex: 2,
            }}
          >
            {title}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            position: 'relative',
            zIndex: 2,
          }}
        >
          {lines.map((line, idx) => {
            const lineP = ease(clamp(progress(t, startAt + 0.2 + idx * 0.18, 0.3)))
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 28,
                  paddingRight: 32,
                  opacity: lineP,
                  transform: `translateX(${(1 - lineP) * 15}px)`,
                }}
              >
                {/* Checkmark or Bullet */}
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    background: line.checked ? '#F6B91E' : 'rgba(255, 255, 255, 0.08)',
                    border: line.checked
                      ? '1.5px solid #F6B91E'
                      : '1.5px solid rgba(255, 255, 255, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 900,
                    color: line.checked ? '#121D35' : '#f8fafc',
                    flexShrink: 0,
                  }}
                >
                  {line.checked ? '✓' : ''}
                </div>

                <div style={{ flex: 1 }}>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: line.highlight ? 800 : 600,
                      color: line.highlight ? '#f8fafc' : '#cbd5e1',
                      background: line.highlight ? 'rgba(246, 185, 30, 0.22)' : 'transparent',
                      padding: line.highlight ? '2px 6px' : 0,
                      borderRadius: 4,
                    }}
                  >
                    {line.text}
                  </span>
                  {line.sub && (
                    <span style={{ fontSize: 12, color: '#94a3b8', marginRight: 8 }}>
                      ({line.sub})
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
