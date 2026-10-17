import React from 'react'
import { clamp, ease, progress } from '../engine/math'

export interface IsometricExplodedUiProps {
  t: number
  title?: string
  style?: React.CSSProperties
  className?: string
}

/**
 * 3D Isometric UI Exploded View Template (`isometric-exploded-ui`)
 * Single invoice tilts into 45-degree isometric perspective and separates
 * along the Z-axis into 5 suspended operational layers.
 */
export const IsometricExplodedUiTemplate: React.FC<IsometricExplodedUiProps> = ({
  t,
  title = 'قدرت موتور زیر پوست یک فاکتور ساده',
  style,
  className = '',
}) => {
  const explodeP = ease(clamp(progress(t, 0.8, 1.4)))

  const layers = [
    { name: 'فاکتور فروش چاپی', desc: 'سند رسمی مشتری', color: '#38bdf8' },
    { name: 'کاردکس موجودی انبار', desc: 'کسر لحظه‌ای مواد اولیه', color: '#a855f7' },
    { name: 'دریافت و پرداخت صندوق', desc: 'تطبیق فیش پوز', color: '#22c55e' },
    { name: 'پرونده اعتباری مشتری', desc: 'سقف نسیه و سابقه', color: '#eab308' },
    { name: 'سند دفتر کل دوبل', desc: 'تراز اتوماتیک بدهکار/بستانکار', color: '#f43f5e' },
  ]

  return (
    <div
      className={`isometric-exploded-template ${className}`}
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        overflow: 'hidden',
        background: '#090d18',
        color: '#ffffff',
        direction: 'rtl',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '50px 24px',
        boxSizing: 'border-box',
        perspective: 1200,
        ...style,
      }}
    >
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 20, zIndex: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.1em' }}>
          مهندسی عمیق حسابداری
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{title}</div>
      </div>

      {/* 3D Isometric Exploded Layer Stack */}
      <div
        style={{
          position: 'relative',
          width: 380,
          height: 520,
          margin: 'auto 0',
          transformStyle: 'preserve-3d',
          transform: 'rotateX(55deg) rotateZ(-35deg)',
          transition: 'none',
        }}
      >
        {layers.map((layer, idx) => {
          const zOffset = idx * 75 * explodeP
          return (
            <div
              key={idx}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.88)',
                border: `2px solid ${layer.color}`,
                borderRadius: 20,
                boxShadow: `0 20px 40px rgba(0,0,0,0.6), 0 0 25px ${layer.color}44`,
                padding: '24px 22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transform: `translateZ(${zOffset}px)`,
                backdropFilter: 'blur(12px)',
                transition: 'none',
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontSize: 18, fontWeight: 900, color: layer.color }}>
                  لایه {idx + 1}: {layer.name}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    background: 'rgba(255,255,255,0.1)',
                    padding: '2px 8px',
                    borderRadius: 6,
                  }}
                >
                  خودکار
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>{layer.desc}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
