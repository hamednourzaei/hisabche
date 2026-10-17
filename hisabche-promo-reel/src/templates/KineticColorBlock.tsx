import React from 'react'

export interface KineticColorBlockProps {
  t: number
  style?: React.CSSProperties
  className?: string
}

/**
 * Kinetic Color-Block Inversion Template (`kinetic-color-block`)
 * Spotify Wrapped style full-bleed typography where the entire background
 * and text colors hard-invert across high-energy rhythmic beats.
 */
export const KineticColorBlockTemplate: React.FC<KineticColorBlockProps> = ({
  t,
  style,
  className = '',
}) => {
  // 3 color phases: (0-1.8s: Acid Yellow, 1.8-3.6s: Deep Navy, 3.6s+: Emerald)
  let bg = '#F6B91E'
  let text = '#121D35'
  let lead = 'فروش بالا داری؟'
  let punch = 'اما آخر ماه دخلت خالیه؟'

  if (t >= 1.8 && t < 3.6) {
    bg = '#121D35'
    text = '#ffffff'
    lead = 'مشکل فروش نیست!'
    punch = 'عدم کنترل بهای تمام‌شده‌ست.'
  } else if (t >= 3.6) {
    bg = '#10b981'
    text = '#022c22'
    lead = 'حسابچه در ۳ ثانیه'
    punch = 'سود هر فاکتور را قفل می‌کند.'
  }

  return (
    <div
      className={`kinetic-color-block ${className}`}
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        overflow: 'hidden',
        background: bg,
        color: text,
        direction: 'rtl',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 40px',
        boxSizing: 'border-box',
        transition: 'background 0.12s ease-out, color 0.12s ease-out',
        ...style,
      }}
    >
      <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.3, marginBottom: 20 }}>{lead}</div>
      <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.25, letterSpacing: '-0.02em' }}>
        {punch}
      </div>
    </div>
  )
}
