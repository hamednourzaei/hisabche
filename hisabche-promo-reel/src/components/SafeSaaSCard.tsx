// src/components/SafeSaaSCard.tsx
import React from 'react'
import { motion } from 'framer-motion'

export interface SafeSaaSCardProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  variant?: 'cyan' | 'purple' | 'emerald' | 'amber'
  align?: 'left' | 'right' | 'center'
  delay?: number
  className?: string
  style?: React.CSSProperties
}

export const SafeSaaSCard: React.FC<SafeSaaSCardProps> = ({
  title,
  subtitle,
  icon,
  variant = 'cyan',
  delay = 0,
  className = '',
  style,
}) => {
  // Professional SaaS color palettes with controlled ambient glow borders
  const variantStyles = {
    cyan: 'border-cyan-500/30 bg-[#110f20]/80 shadow-[0_0_25px_rgba(6,182,212,0.15)] text-cyan-300',
    purple:
      'border-purple-500/30 bg-[#110f20]/80 shadow-[0_0_25px_rgba(168,85,247,0.15)] text-purple-300',
    emerald:
      'border-emerald-500/30 bg-[#110f20]/80 shadow-[0_0_25px_rgba(16,185,129,0.15)] text-emerald-300',
    amber:
      'border-amber-500/30 bg-[#110f20]/80 shadow-[0_0_25px_rgba(245,158,11,0.15)] text-amber-300',
  }

  const borderColors = {
    cyan: 'rgba(6, 182, 212, 0.35)',
    purple: 'rgba(168, 85, 247, 0.35)',
    emerald: 'rgba(16, 185, 129, 0.35)',
    amber: 'rgba(245, 158, 11, 0.35)',
  }

  const glowShadows = {
    cyan: '0 0 25px rgba(6, 182, 212, 0.15)',
    purple: '0 0 25px rgba(168, 85, 247, 0.15)',
    emerald: '0 0 25px rgba(16, 185, 129, 0.15)',
    amber: '0 0 25px rgba(245, 158, 11, 0.15)',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.22, 1, 0.36, 1], // Exponential Out studio velocity curve
      }}
      className={`relative w-full max-w-[92%] mx-auto rounded-2xl border p-5 backdrop-blur-xl transition-all duration-300 ${variantStyles[variant]} ${className}`}
      style={{
        width: '100%',
        maxWidth: '92%',
        margin: '0 auto',
        borderRadius: 16,
        padding: 20,
        boxSizing: 'border-box',
        overflow: 'hidden', // Decisive protection against mobile canvas overflow
        background: 'rgba(17, 15, 32, 0.85)',
        border: `1.5px solid ${borderColors[variant]}`,
        boxShadow: glowShadows[variant],
        backdropFilter: 'blur(16px)',
        position: 'relative',
        ...style,
      }}
    >
      <div
        className="flex items-start gap-4"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 16,
          direction: 'rtl',
        }}
      >
        {icon && (
          <div
            className="flex-shrink-0 p-2.5 rounded-xl bg-white/5 border border-white/10"
            style={{
              flexShrink: 0,
              padding: 10,
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0" style={{ flex: 1, minWidth: 0 }}>
          {/* Title with automatic balance and orphan protection */}
          <h4
            className="text-white font-bold text-lg leading-snug tracking-tight mb-1.5"
            style={{
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 18,
              lineHeight: 1.45,
              margin: '0 0 6px 0',
              textWrap: 'balance',
            }}
          >
            {title}
          </h4>
          {subtitle && (
            <p
              className="text-slate-300 text-sm leading-relaxed font-normal opacity-90"
              style={{
                color: '#cbd5e1',
                fontSize: 14,
                lineHeight: 1.65,
                fontWeight: 500,
                margin: 0,
                opacity: 0.9,
                textWrap: 'pretty',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
