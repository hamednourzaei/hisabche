// src/components/tactile/SafeSaaSCard.tsx
// Rebuilt: the old version used Tailwind utility classes that do not exist in
// this Vite project (no Tailwind pipeline) plus framer-motion's wall-clock
// animation — both were website-template footprints. This is now a pure,
// scrub-safe plate drawn from the shared art-direction tokens.
// Rules: 21-29, 33, 51-57, 98, 99.

import type { CSSProperties, ReactNode } from 'react'

import { ease, progress } from '../../engine/math'
import { ACCENT, MATERIAL } from '../../ui/art-direction'

interface SafeSaaSCardProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  variant?: 'cyan' | 'purple' | 'emerald' | 'amber'
  align?: 'left' | 'right' | 'center'
  delay?: number
}

const VARIANT = {
  cyan: ACCENT.cyan,
  purple: ACCENT.purple,
  emerald: ACCENT.green,
  amber: ACCENT.amber,
} as const

export const SafeSaaSCard = ({
  title,
  subtitle,
  icon,
  variant = 'cyan',
  delay = 0,
}: SafeSaaSCardProps) => {
  const c = VARIANT[variant]
  const enter = ease(progress(1 + delay, delay, 0.5))
  return (
    <div
      data-mg-safe-plate
      style={
        {
          width: '100%',
          maxWidth: '92%',
          margin: '0 auto',
          boxSizing: 'border-box',
          overflow: 'hidden',
          background: MATERIAL.panel,
          border: `1px solid ${MATERIAL.panelEdge}`,
          borderInlineStart: `3px solid ${c.solid}`,
          padding: 16,
          opacity: enter,
          transform: `translate3d(0, ${((1 - enter) * 16).toFixed(2)}px, 0)`,
          boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
        } as CSSProperties
      }
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {icon && <div style={{ flexShrink: 0, color: c.solid }}>{icon}</div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4
            style={
              {
                margin: '0 0 6px',
                color: MATERIAL.ink,
                fontSize: 18,
                fontWeight: 800,
                lineHeight: 1.45,
                textWrap: 'balance',
              } as CSSProperties
            }
          >
            {title}
          </h4>
          {subtitle && (
            <p
              style={
                {
                  margin: 0,
                  color: MATERIAL.muted,
                  fontSize: 14,
                  lineHeight: 1.7,
                  textWrap: 'pretty',
                } as CSSProperties
              }
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
