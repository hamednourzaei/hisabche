// src/ui/tech-pipeline.tsx
// High-tech pipeline stepper header & kinetic word-emphasis box inspired by test.mp4 reference

import React, { type CSSProperties } from 'react'

export interface TechPipelineHeaderProps {
  currentStep: number // 1 to 5
  deployCount?: string
  style?: CSSProperties
}

const STEPS = [
  { id: 1, label: 'تسک‌ها' },
  { id: 2, label: 'نظارت' },
  { id: 3, label: 'لینک زنده' },
  { id: 4, label: '۶ ماژول' },
  { id: 5, label: 'اکانت تست' },
]

export function TechPipelineHeader({
  currentStep,
  deployCount = '۲,۷۰۷,۴۰۲ ثبت',
  style,
}: TechPipelineHeaderProps) {
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        top: 24,
        insetInlineStart: 24,
        insetInlineEnd: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 60,
        pointerEvents: 'none',
        ...style,
      }}
    >
      {/* Steps Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 14px',
          borderRadius: 999,
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {STEPS.map((step) => {
          const isActive = step.id === currentStep
          const isDone = step.id < currentStep
          return (
            <div
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10,
                fontWeight: isActive ? 900 : 700,
                color: isActive ? '#38bdf8' : isDone ? '#10b981' : '#64748b',
                transition: 'all 0.3s ease',
              }}
            >
              <div
                style={{
                  width: isActive ? 8 : 5,
                  height: isActive ? 8 : 5,
                  borderRadius: 4,
                  background: isActive ? '#38bdf8' : isDone ? '#10b981' : '#475569',
                  boxShadow: isActive ? '0 0 10px #38bdf8' : 'none',
                }}
              />
              <span>{step.label}</span>
            </div>
          )
        })}
      </div>

      {/* Deploy / Action Counter Pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          borderRadius: 999,
          background: 'rgba(2, 132, 199, 0.14)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          color: '#e0f2fe',
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        <span style={{ color: '#38bdf8' }}>▲</span>
        <span>{deployCount}</span>
      </div>
    </div>
  )
}

/**
 * Word emphasis box with 4 corner anchor dots (just like Firecracker / Vercel video reference).
 */
export function KineticWordBox({
  children,
  color = '#38bdf8',
  style,
}: {
  children: React.ReactNode
  color?: string
  style?: CSSProperties
}) {
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        padding: '2px 8px',
        margin: '0 4px',
        border: `1.5px solid ${color}`,
        borderRadius: 4,
        background: `${color}15`,
        color: '#ffffff',
        fontWeight: 900,
        ...style,
      }}
    >
      {/* 4 Corner Anchor Dots */}
      <span
        style={{
          position: 'absolute',
          top: -3,
          left: -3,
          width: 6,
          height: 6,
          borderRadius: 3,
          background: '#ffffff',
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      <span
        style={{
          position: 'absolute',
          top: -3,
          right: -3,
          width: 6,
          height: 6,
          borderRadius: 3,
          background: '#ffffff',
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      <span
        style={{
          position: 'absolute',
          bottom: -3,
          left: -3,
          width: 6,
          height: 6,
          borderRadius: 3,
          background: '#ffffff',
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      <span
        style={{
          position: 'absolute',
          bottom: -3,
          right: -3,
          width: 6,
          height: 6,
          borderRadius: 3,
          background: '#ffffff',
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      {children}
    </span>
  )
}
