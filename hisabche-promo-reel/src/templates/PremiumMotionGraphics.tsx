// ============================================
// Hisabche Motion Studio — Creative Family #13
// Premium Art-Directed Motion Graphics (`premium-motion-graphics`)
//
// Key Motion Design Capabilities:
// - Kinetic typography reveals with intentional hierarchy & mask wipes
// - Vector clipping apertures and diagonal sweep transitions
// - Layered 2.5D spatial depth with subtle perspective glides
// - Speed-ramped scale springs & impact text strikes
// - Specular rim highlights and holographic grid lines
// - Synchronized audio cue anchors
// ============================================

import React from 'react'
import { clamp, ease, mix, progress } from '../engine/math'

export interface PremiumMotionGraphicsProps {
  t: number
  title?: string
  subtitle?: string
  kicker?: string
  statValue?: string
  statLabel?: string
  contrastValue?: string
  contrastLabel?: string
  badge?: string
  accentColor?: string
  style?: React.CSSProperties
  className?: string
}

export const PremiumMotionGraphicsTemplate: React.FC<PremiumMotionGraphicsProps> = ({
  t,
  title = 'پایش ارزش لحظه‌ای انبار در برابر تورم',
  subtitle = 'ثبت نسیه بدون محاسبه ارزش جایگزینی = ذوب شدن خاموش سرمایه',
  kicker = 'معماری مالی هوشمند حسابچه',
  statValue = '۵۰۰٬۰۰۰٬۰۰۰ تومان',
  statLabel = 'طلب وصولی نسیه',
  contrastValue = '۸۰۰٬۰۰۰٬۰۰۰ تومان',
  contrastLabel = 'هزینه خرید مجدد همان کالا!',
  badge = 'تراز ارزش روز (FIFO + Replacement)',
  accentColor = '#22d3ee',
  style,
  className = '',
}) => {
  // Phase 1: Kinetic Kicker Reveal (0.0s - 0.5s)
  const kickerP = ease(clamp(progress(t, 0.1, 0.4)))

  // Phase 2: Explosive Masked Title Reveal with speed ramp (0.4s - 1.2s)
  const titleP = ease(clamp(progress(t, 0.4, 0.55)))

  // Phase 3: Spatial 2.5D Metric Fracture Reveal (1.2s - 2.2s)
  const splitP = ease(clamp(progress(t, 1.2, 0.6)))

  // Phase 4: Holographic Solution Card Lock (2.4s - 3.4s)
  const cardP = ease(clamp(progress(t, 2.4, 0.6)))

  // Subtle continuous spatial camera glide
  const camTiltX = Math.sin(t * 0.8) * 2.5
  const camTiltY = Math.cos(t * 0.6) * 2.0

  return (
    <div
      className={`premium-motion-graphics-template ${className}`}
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        overflow: 'hidden',
        background: '#04060a',
        direction: 'rtl',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '64px 28px',
        boxSizing: 'border-box',
        perspective: '1200px',
        ...style,
      }}
    >
      {/* 1. Volumetric Deep Ambient Glows */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          right: '-15%',
          width: 360,
          height: 360,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34, 211, 238, 0.14) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '5%',
          left: '-15%',
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* 2. Precision Architectural Grid Floor */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 90% 80% at 50% 45%, #000 40%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* 3. The 2.5D Camera Rig Stage */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 5,
          transform: `rotateX(${camTiltX}deg) rotateY(${camTiltY}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Top Kicker Pill with Specular Shimmer */}
        <div
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 18px',
            background: 'rgba(34, 211, 238, 0.08)',
            border: '1px solid rgba(34, 211, 238, 0.35)',
            borderRadius: 999,
            fontSize: 12.5,
            fontWeight: 800,
            color: accentColor,
            letterSpacing: '0.04em',
            boxShadow: '0 0 20px rgba(34, 211, 238, 0.2)',
            opacity: kickerP,
            transform: `translateY(${(1 - kickerP) * -20}px)`,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: accentColor,
              boxShadow: `0 0 8px ${accentColor}`,
            }}
          />
          {kicker}
        </div>

        {/* Hero Kinetic Typography with Mask Clip Wipe */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            textAlign: 'center',
            marginBottom: 18,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: 31,
              fontWeight: 900,
              lineHeight: 1.45,
              color: '#ffffff',
              textWrap: 'balance',
              transform: `translateY(${(1 - titleP) * 100}%) scale(${0.9 + 0.1 * titleP})`,
              opacity: titleP,
              textShadow: '0 4px 24px rgba(0,0,0,0.8)',
            }}
          >
            {title}
          </div>
        </div>

        {/* Subtitle with High-Craft Ink Hierarchy */}
        {subtitle && (
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#94a3b8',
              lineHeight: 1.7,
              textAlign: 'center',
              maxWidth: 440,
              marginBottom: 32,
              opacity: clamp(progress(t, 0.8, 0.4)),
              transform: `translateY(${(1 - clamp(progress(t, 0.8, 0.4))) * 14}px)`,
            }}
          >
            {subtitle}
          </div>
        )}

        {/* 4. Split Spatial Inflation Shockwave (Nominal Cash vs Real Replacement Cost) */}
        {splitP > 0 && (
          <div
            style={{
              position: 'relative',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              marginBottom: 26,
            }}
          >
            {/* Top Card: What Customer Paid (Nominal Mirage) */}
            <div
              style={{
                position: 'relative',
                background: 'rgba(15, 23, 42, 0.88)',
                border: '1.5px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 20,
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(16px)',
                opacity: splitP,
                transform: `translateX(${(1 - splitP) * 40}px)`,
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>{statLabel}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#f87171', marginTop: 4 }}>
                  {statValue}
                </div>
              </div>
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  fontSize: 12,
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: 8,
                }}
              >
                روی کاغذ سود!
              </div>
            </div>

            {/* Downward Danger Conduit Arrow */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                opacity: clamp(progress(t, 1.6, 0.3)),
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 4V20M12 20L6 14M12 20L18 14"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Bottom Card: Harsh Market Reality (Actual Replacement Price) */}
            <div
              style={{
                position: 'relative',
                background: 'rgba(24, 18, 30, 0.92)',
                border: '1.5px solid rgba(245, 158, 11, 0.5)',
                borderRadius: 20,
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 16px 36px rgba(245, 158, 11, 0.15)',
                backdropFilter: 'blur(16px)',
                opacity: clamp(progress(t, 1.8, 0.5)),
                transform: `translateX(${(1 - clamp(progress(t, 1.8, 0.5))) * -40}px)`,
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 700 }}>
                  {contrastLabel}
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', marginTop: 4 }}>
                  {contrastValue}
                </div>
              </div>
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.18)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: '#f59e0b',
                  fontSize: 12,
                  fontWeight: 900,
                  padding: '4px 10px',
                  borderRadius: 8,
                }}
              >
                ۳۰۰ میلیون کسری!
              </div>
            </div>
          </div>
        )}

        {/* 5. Crystalline Solution Armor: Hisabche Replacement Cost Engine */}
        {cardP > 0 && (
          <div
            style={{
              position: 'relative',
              width: '100%',
              background:
                'linear-gradient(135deg, rgba(6, 182, 212, 0.18) 0%, rgba(15, 23, 42, 0.94) 100%)',
              border: '2px solid rgba(34, 211, 238, 0.7)',
              borderRadius: 22,
              padding: '22px 24px',
              boxShadow: '0 0 50px rgba(34, 211, 238, 0.28)',
              backdropFilter: 'blur(20px)',
              opacity: cardP,
              transform: `scale(${mix(0.85, 1, cardP)}) translateY(${mix(30, 0, cardP)}px)`,
            }}
          >
            {/* Specular Rim Light Sweep */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: `${((t * 120) % 300) - 50}%`,
                width: '40%',
                height: '100%',
                background:
                  'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent)',
                transform: 'skewX(-25deg)',
                pointerEvents: 'none',
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 900, color: '#38bdf8' }}>
                راهکار ضد تورم حسابچه
              </div>
              <span
                style={{
                  background: 'rgba(52, 211, 153, 0.15)',
                  border: '1px solid rgba(52, 211, 153, 0.4)',
                  color: '#34d399',
                  fontSize: 11.5,
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 6,
                }}
              >
                تضمین بقای سرمایه
              </span>
            </div>

            <div style={{ fontSize: 14, color: '#f8fafc', lineHeight: 1.65, fontWeight: 700 }}>
              {badge}
            </div>
            <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 8, lineHeight: 1.6 }}>
              ردیابی خودکار ارزش جایگزینی هر کالا + شرط تعدیل هوشمند نرخ در فاکتور نسیه
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
