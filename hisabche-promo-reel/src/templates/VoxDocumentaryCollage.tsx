import React from 'react'
import { clamp, ease, progress } from '../engine/math'

export interface VoxDocumentaryCollageProps {
  t: number
  title?: string
  headline?: string
  documentNumber?: string
  badgeText?: string
  clippingTitle?: string
  clippingText?: string
  dark?: boolean
  style?: React.CSSProperties
  className?: string
}

/**
 * Vox Documentary Cut-Out Collage Template (`vox-documentary-collage`)
 * Editorial archival newspaper aesthetic, stepped stop-motion feel,
 * fluorescent highlighter sweep, and paper clipping cards.
 */
export const VoxDocumentaryCollageTemplate: React.FC<VoxDocumentaryCollageProps> = ({
  t,
  title = 'پرونده ویژه: فرار نقدینگی در بازار',
  headline = 'چرا ۵۳٪ از کسب‌وکارهای سنتی در سال سوم تعطیل می‌شوند؟',
  documentNumber = 'گزارش تحلیلی بازار · شماره ۲۴۸',
  badgeText = 'مستند تجاری',
  clippingTitle = 'سند شماره ۱: ناپدید شدن سود در دفتر کاغذی',
  clippingText = 'بررسی فاکتورهای دستی نشان می‌دهد ۷۴٪ مغایرت‌های مالی ناشی از فراموش شدن ثبت تخفیف‌ها و نسیه‌هاست.',
  dark = true,
  style,
  className = '',
}) => {
  // Stepped 12fps quantization for authentic editorial stop-motion feel
  const steppedT = Math.floor(t * 12) / 12
  const p1 = ease(clamp(progress(steppedT, 0.2, 0.4)))
  const highlightP = ease(clamp(progress(steppedT, 0.8, 0.5)))
  const cardP = ease(clamp(progress(steppedT, 1.4, 0.3)))

  const isDark = dark !== false

  return (
    <div
      className={`vox-documentary-template ${className}`}
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        overflow: 'hidden',
        background: isDark ? '#0c1017' : '#EAE6DF',
        color: isDark ? '#f8fafc' : '#1c1917',
        direction: 'rtl',
        padding: '50px 24px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Archival Halftone & Grain */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: isDark
            ? 'radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)'
            : 'radial-gradient(rgba(28, 25, 23, 0.08) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          opacity: isDark ? 0.4 : 0.6,
          pointerEvents: 'none',
        }}
      />

      {/* Editorial Header Ribbon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.18)' : '2px solid #1c1917',
          paddingBottom: 10,
          marginBottom: 30,
          opacity: p1,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: '0.04em',
            color: isDark ? '#cbd5e1' : '#1c1917',
          }}
        >
          {documentNumber}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            background: isDark ? 'rgba(239, 68, 68, 0.25)' : '#1c1917',
            color: isDark ? '#fca5a5' : '#ffffff',
            border: isDark ? '1px solid rgba(239, 68, 68, 0.5)' : 'none',
            padding: '3px 9px',
            borderRadius: 4,
          }}
        >
          {badgeText}
        </span>
      </div>

      {/* Main Massive Headline */}
      <div style={{ position: 'relative', marginBottom: 35 }}>
        <div
          style={{
            fontSize: 26,
            fontWeight: 900,
            lineHeight: 1.45,
            color: isDark ? '#ffffff' : '#1c1917',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.6,
            color: isDark ? '#cbd5e1' : '#44403c',
            marginTop: 16,
            position: 'relative',
            display: 'inline-block',
          }}
        >
          {headline}
          {/* Fluorescent Yellow Highlighter Sweep */}
          <span
            style={{
              position: 'absolute',
              bottom: 2,
              right: 0,
              width: `${highlightP * 100}%`,
              height: 14,
              background: isDark ? 'rgba(234, 179, 8, 0.45)' : 'rgba(250, 204, 21, 0.55)',
              boxShadow: isDark ? '0 0 12px rgba(234, 179, 8, 0.3)' : 'none',
              zIndex: -1,
            }}
          />
        </div>
      </div>

      {/* Cut-Out Photo & Document Clipping */}
      <div
        style={{
          position: 'relative',
          background: isDark ? '#161d2b' : '#ffffff',
          padding: 18,
          borderRadius: 8,
          boxShadow: isDark ? '0 16px 36px rgba(0,0,0,0.6)' : '0 12px 28px rgba(0,0,0,0.12)',
          transform: 'rotate(-1.5deg)',
          border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.15)',
          opacity: cardP,
        }}
      >
        {/* Transparent Tape Strip */}
        <div
          style={{
            position: 'absolute',
            top: -12,
            right: 40,
            width: 80,
            height: 24,
            background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          }}
        />
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: '#ef4444',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#ef4444',
            }}
          />
          {clippingTitle}
        </div>
        <div style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#57534e', lineHeight: 1.65 }}>
          {clippingText}
        </div>
      </div>
    </div>
  )
}
