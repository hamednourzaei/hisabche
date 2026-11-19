// src/ui/tech-pipeline.tsx
// Pipeline stepper & kinetic word mark — rebuilt from frosted web pills to
// film-grade hairline instrumentation. API is frozen.
// Rules: 22, 33, 52, 58, 98.

import type { CSSProperties } from 'react'

import { ACCENT, MATERIAL } from './art-direction'

export interface TechPipelineHeaderProps {
  currentStep: number
  deployCount?: string
  style?: CSSProperties
}

const STEPS = [
  { id: 1, label: 'تسکها' },
  { id: 2, label: 'نظارت' },
  { id: 3, label: 'لینک زنده' },
  { id: 4, label: '۶ ماژول' },
  { id: 5, label: 'اکانت تست' },
]

export function TechPipelineHeader({
  currentStep,
  deployCount = '۲٬۷۰۷٬۴۰۲ ثبت',
  style,
}: TechPipelineHeaderProps) {
  return (
    <div
      dir="rtl"
      data-mg-instrument
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingBottom: 6,
          borderBottom: `1px solid ${MATERIAL.panelEdge}`,
        }}
      >
        {STEPS.map((step) => {
          const active = step.id === currentStep
          const done = step.id < currentStep
          const color = active ? ACCENT.cyan.solid : done ? ACCENT.green.solid : MATERIAL.muted
          return (
            <div
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10,
                fontWeight: active ? 900 : 700,
                color,
                opacity: active || done ? 1 : 0.55,
              }}
            >
              <span
                style={{
                  width: active ? 7 : 5,
                  height: active ? 7 : 5,
                  background: color,
                  display: 'inline-block',
                  transform: 'rotate(45deg)',
                }}
              />
              <span>{step.label}</span>
            </div>
          )
        })}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          color: MATERIAL.ink,
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        <span style={{ color: ACCENT.cyan.solid }}>▲</span>
        <span>{deployCount}</span>
      </div>
    </div>
  )
}

/** Word emphasis with four corner registration ticks — a film mark, not a UI chip. */
export function KineticWordBox({
  children,
  color = ACCENT.cyan.solid,
  style,
}: {
  children: React.ReactNode
  color?: string
  style?: CSSProperties
}) {
  const tick = (top: number, left: number): CSSProperties => ({
    position: 'absolute',
    top,
    left,
    width: 5,
    height: 5,
    borderTop: `1px solid ${color}`,
    borderLeft: `1px solid ${color}`,
  })
  return (
    <span
      data-mg-registration
      style={{
        position: 'relative',
        display: 'inline-block',
        padding: '2px 8px',
        margin: '0 4px',
        border: `1px solid ${color}`,
        color: MATERIAL.ink,
        fontWeight: 900,
        ...style,
      }}
    >
      <span aria-hidden style={tick(-3, -3)} />
      <span
        aria-hidden
        style={{ ...tick(-3, -3), left: 'auto', right: -3, transform: 'scaleX(-1)' }}
      />
      <span
        aria-hidden
        style={{ ...tick(-3, -3), top: 'auto', bottom: -3, transform: 'scaleY(-1)' }}
      />
      <span
        aria-hidden
        style={{
          ...tick(-3, -3),
          top: 'auto',
          bottom: -3,
          left: 'auto',
          right: -3,
          transform: 'scale(-1, -1)',
        }}
      />
      {children}
    </span>
  )
}
