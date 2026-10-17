import React from 'react'
import { clamp, ease, progress } from '../engine/math'

export interface LiquidGlassSpatialProps {
  t: number
  title?: string
  style?: React.CSSProperties
  className?: string
}

/**
 * Liquid Glass & 2.5D Spatial Depth Template (`liquid-glass-spatial`)
 * Apple 2026 style frosted liquid glass panels with specular rim highlights,
 * elevation shadows, and smooth 3D perspective tilts.
 */
export const LiquidGlassSpatialTemplate: React.FC<LiquidGlassSpatialProps> = ({
  t,
  title = 'شفافیت مطلق دارایی و سود',
  style,
  className = '',
}) => {
  const enterP = ease(clamp(progress(t, 0.2, 0.8)))
  const tiltAngleX = Math.sin(t * 1.5) * 8
  const tiltAngleY = Math.cos(t * 1.2) * 10

  return (
    <div
      className={`liquid-glass-template ${className}`}
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #030712 85%)',
        color: '#ffffff',
        direction: 'rtl',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '60px 24px',
        boxSizing: 'border-box',
        perspective: 1200,
        ...style,
      }}
    >
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 35, zIndex: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#a5b4fc', letterSpacing: '0.12em' }}>
          فناوری طراحی مدرن ۲۰۲۶
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>{title}</div>
      </div>

      {/* Floating 2.5D Frosted Glass Panel */}
      <div
        style={{
          width: 440,
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: 28,
          padding: '30px 26px',
          border: '1.5px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
          backdropFilter: 'blur(28px)',
          transform: `rotateX(${tiltAngleX}deg) rotateY(${tiltAngleY}deg) scale(${0.85 + 0.15 * enterP})`,
          opacity: enterP,
          transition: 'transform 0.1s linear',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 18, fontWeight: 900 }}>داشبورد اجرایی حسابچه</span>
          <span style={{ fontSize: 13, color: '#38bdf8', fontWeight: 800 }}>تراز برخط</span>
        </div>

        <div
          style={{
            height: 1,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.2), transparent)',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
            سود خالص واقعی این ماه:
          </span>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#4ade80' }}>۸۴٬۵۰۰٬۰۰۰ تومان</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
            ارزش کل دارایی انبار:
          </span>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#38bdf8' }}>۶۲۰٬۰۰۰٬۰۰۰ تومان</span>
        </div>
      </div>
    </div>
  )
}
