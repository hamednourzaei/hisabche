import React from 'react'
import { clamp, ease, mix, progress } from '../engine/math'

export interface InfiniteSpatialBoardProps {
  t: number
  title?: string
  style?: React.CSSProperties
  className?: string
}

/**
 * Infinite Spatial Board Template (`infinite-spatial-board`)
 * Camera glides in 2D space across Warehouse, POS, Factory, and Central Ledger
 * on a high-craft engineering grid connected by live bezier conduits.
 */
export const InfiniteSpatialBoardTemplate: React.FC<InfiniteSpatialBoardProps> = ({
  t,
  title = 'نقشه یکپارچه کسب‌وکار شما',
  style,
  className = '',
}) => {
  // 4 camera focal beats: (0-1.5s: Warehouse, 1.5-3.0s: POS, 3.0-4.5s: Factory, 4.5s+: Macro Overview)
  const p1 = ease(clamp(progress(t, 1.2, 0.6)))
  const p2 = ease(clamp(progress(t, 2.6, 0.6)))
  const pOverview = ease(clamp(progress(t, 4.0, 0.8)))

  // Target camera coordinates (X, Y, Scale)
  const camX = mix(mix(-140, 140, p1), mix(140, 0, pOverview), pOverview > 0 ? 1 : p2)
  const camY = mix(mix(-100, 100, p1), mix(100, 0, pOverview), pOverview > 0 ? 1 : p2)
  const camScale = mix(1.15, 0.62, pOverview)

  const nodes = [
    { name: 'انبار مرکزی', desc: 'موجودی لحظه‌ای', x: 120, y: 180, color: '#38bdf8' },
    { name: 'صندوق و فروش', desc: 'وصولی کارتخوان', x: 420, y: 220, color: '#22c55e' },
    { name: 'کارگاه تولیدی', desc: 'فرمولاسیون BOM', x: 160, y: 480, color: '#a855f7' },
    { name: 'دفتر کل و سود', desc: 'تراز نهایی لحظه‌ای', x: 400, y: 520, color: '#eab308' },
  ]

  return (
    <div
      className={`infinite-spatial-board ${className}`}
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        overflow: 'hidden',
        background: '#090d16',
        direction: 'rtl',
        ...style,
      }}
    >
      {/* Top Header */}
      <div
        style={{
          position: 'absolute',
          top: 50,
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 10,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.08em' }}>
          مدیریت چندشعبه‌ای و متمرکز
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', marginTop: 4 }}>{title}</div>
      </div>

      {/* Camera Plane Container */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: '270px 480px',
          transform: `translate(${camX}px, ${camY}px) scale(${camScale})`,
          transition: 'none',
        }}
      >
        {/* Infinite Grid Background */}
        <div
          style={{
            position: 'absolute',
            inset: -400,
            backgroundImage:
              'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Live SVG Conduits connecting nodes */}
        <svg
          viewBox="0 0 540 960"
          style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
        >
          <path
            d="M 120 180 C 270 200, 270 200, 420 220"
            fill="none"
            stroke="rgba(56, 189, 248, 0.6)"
            strokeWidth={3}
            strokeDasharray="8 6"
          />
          <path
            d="M 120 180 C 140 330, 140 330, 160 480"
            fill="none"
            stroke="rgba(168, 85, 247, 0.6)"
            strokeWidth={3}
            strokeDasharray="8 6"
          />
          <path
            d="M 420 220 C 410 370, 410 370, 400 520"
            fill="none"
            stroke="rgba(34, 197, 94, 0.6)"
            strokeWidth={3}
            strokeDasharray="8 6"
          />
          <path
            d="M 160 480 C 280 500, 280 500, 400 520"
            fill="none"
            stroke="rgba(234, 179, 8, 0.6)"
            strokeWidth={3}
            strokeDasharray="8 6"
          />
        </svg>

        {/* Spatial Node Cards */}
        {nodes.map((node, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: node.x - 70,
              top: node.y - 45,
              width: 140,
              background: 'rgba(15, 23, 42, 0.92)',
              border: `1.5px solid ${node.color}`,
              borderRadius: 14,
              padding: '12px 14px',
              boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 16px ${node.color}33`,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>{node.name}</div>
            <div style={{ fontSize: 11, color: node.color, marginTop: 4, fontWeight: 700 }}>
              {node.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
