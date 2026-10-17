import type { CSSProperties, ReactNode } from 'react'
import { clamp, mix, studioSpring } from '../engine/anim'

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

export interface StudioOdometerProps {
  value: number
  t: number
  startAt: number
  duration?: number
  tone?: 'cyan' | 'green' | 'red' | 'purple' | 'amber' | 'white'
  unit?: ReactNode
  prefix?: ReactNode
  className?: string
  style?: CSSProperties
  fontSize?: number | string
  lockedGlow?: boolean
}

const TONE_COLORS = {
  cyan: {
    color: '#22d3ee',
    glow: 'rgba(34, 211, 238, 0.65)',
    border: 'rgba(34, 211, 238, 0.4)',
  },
  green: {
    color: '#4ade80',
    glow: 'rgba(74, 222, 128, 0.65)',
    border: 'rgba(74, 222, 128, 0.4)',
  },
  red: {
    color: '#fb7185',
    glow: 'rgba(251, 113, 133, 0.75)',
    border: 'rgba(251, 113, 133, 0.4)',
  },
  purple: {
    color: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.65)',
    border: 'rgba(192, 132, 252, 0.4)',
  },
  amber: {
    color: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.65)',
    border: 'rgba(251, 191, 36, 0.4)',
  },
  white: {
    color: '#ffffff',
    glow: 'rgba(255, 255, 255, 0.55)',
    border: 'rgba(255, 255, 255, 0.3)',
  },
}

/** Formats an absolute number to Persian digits with separator if needed. */
function toFaDigits(val: number): string {
  return new Intl.NumberFormat('fa-IR').format(Math.abs(Math.round(val)))
}

// Extended strip with 2 full cycles (20 items) ensures monotonic sliding without modulo wrapping
const EXTENDED_PERSIAN_DIGITS = [...PERSIAN_DIGITS, ...PERSIAN_DIGITS]

/**
 * Studio-grade mechanical odometer slot-roll with spring physics.
 * Pure function of time (t), deterministic, scrub-safe, and zero layout shift.
 * Guaranteed zero flicker: no modulo wrapping, no binary mask pops, no opacity strobing.
 */
export function StudioOdometer({
  value,
  t,
  startAt,
  duration = 0.9,
  tone = 'cyan',
  unit,
  prefix,
  className = '',
  style,
  fontSize,
  lockedGlow = true,
}: StudioOdometerProps) {
  const elapsed = Math.max(0, t - startAt)

  const toneConfig = TONE_COLORS[tone]
  const targetStr = toFaDigits(value)
  const chars = targetStr.split('')

  // Stable glow once introduced
  const textShadow = lockedGlow ? `0 0 16px ${toneConfig.glow}` : undefined

  return (
    <div
      className={`studio-odometer-wrap ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '4px',
        direction: 'rtl',
        fontVariantNumeric: 'tabular-nums',
        textWrap: 'balance',
        fontSize: fontSize ?? undefined,
        lineHeight: 1,
        color: toneConfig.color,
        textShadow,
        ...style,
      }}
    >
      {prefix && <span className="odometer-prefix">{prefix}</span>}

      <div
        className="odometer-digits-track"
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          direction: 'ltr', // LTR keeps digit place-values ordered correctly for strip alignment
          overflow: 'hidden',
          lineHeight: 1,
        }}
      >
        {chars.map((char, index) => {
          const digitIndex = PERSIAN_DIGITS.indexOf(char)
          if (digitIndex === -1) {
            // Non-digit character (separator, decimal point, etc.) - continuously readable at full opacity
            return (
              <span key={index} className="odometer-sep" style={{ opacity: 1 }}>
                {char}
              </span>
            )
          }

          // Digit slot: rolls monotonically to target with studio spring physics and column stagger
          const colDelay = (chars.length - 1 - index) * 0.05
          const colElapsed = Math.max(0, elapsed - colDelay)
          const s = clamp(studioSpring(colElapsed * (1 / duration)))

          // Target is in the second cycle (index 10 + digitIndex)
          // Steps smoothly from 0 to target without modulo wrapping: ZERO flicker, ZERO strobe!
          const targetStep = 10 + digitIndex
          const currentStep = mix(0, targetStep, s)

          return (
            <span
              key={index}
              className="odometer-digit-slot"
              style={{
                display: 'inline-block',
                position: 'relative',
                height: '1.08em',
                overflow: 'hidden',
                verticalAlign: 'bottom',
              }}
            >
              <span
                className="odometer-digit-strip"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  transform: `translateY(-${(currentStep / EXTENDED_PERSIAN_DIGITS.length) * 100}%)`,
                  willChange: 'transform',
                }}
              >
                {EXTENDED_PERSIAN_DIGITS.map((pDigit, pIdx) => (
                  <span
                    key={pIdx}
                    style={{
                      height: '1.08em',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {pDigit}
                  </span>
                ))}
              </span>
            </span>
          )
        })}
      </div>

      {unit && (
        <span
          className="odometer-unit"
          style={{
            fontSize: '0.35em',
            fontWeight: 800,
            opacity: 0.9,
            marginInlineStart: '6px',
            alignSelf: 'flex-end',
            color: 'inherit',
          }}
        >
          {unit}
        </span>
      )}
    </div>
  )
}
