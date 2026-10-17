import React from 'react'
import { clamp, ease, progress } from '../engine/math'

export interface SplitScreenStopwatchProps {
  t: number
  style?: React.CSSProperties
  className?: string
  topTitle?: string
  topSub?: string
  topBody?: string
  topFooter?: string
  bottomTitle?: string
  bottomSub?: string
  bottomBody?: string
  bottomFooter?: string
  finishAt?: number
}

/**
 * Split-Screen Stopwatch Workflow Race Template (`split-screen-stopwatch`)
 * Live top-vs-bottom workflow race contrasting the slow manual struggle
 * against lightning-fast Hisabche 3-second automated completion.
 */
export const SplitScreenStopwatchTemplate: React.FC<SplitScreenStopwatchProps> = ({
  t,
  style,
  className = '',
  topTitle = 'روش دستی و اکسل',
  topSub = '⏳ ۲۵ دقیقه اتلاف وقت',
  topBody = 'باز کردن فایل اکسل ⬅️ ثبت دستی ⬅️ رفتن به انبار ⬅️ محاسبه کسری ⬅️ مغایرت پایان روز!',
  topFooter = 'همچنان در حال محاسبه...',
  bottomTitle = 'سیستم هوشمند حسابچه',
  bottomSub,
  bottomBody = 'یک کلیک روی «ثبت فاکتور» ⬅️ کسر خودکار از انبار + ثبت سند دوطرفه + به‌روزرسانی کاردکس!',
  bottomFooter,
  finishAt = 3.0,
}) => {
  // Millisecond timer calculations
  const hisabcheSec = Math.min(finishAt, t)
  const isHisabcheDone = t >= finishAt
  const hisabcheDoneP = ease(clamp(progress(t, finishAt, 0.4)))
  const pulseMotion = 1 + 0.012 * Math.sin(t * 5)

  const resolvedBottomSub = bottomSub ?? (isHisabcheDone ? '✓ تکمیل ۱۰۰٪' : 'در حال پردازش...')
  const resolvedBottomFooter =
    bottomFooter ??
    (isHisabcheDone ? `انجام شد در ${finishAt.toFixed(0)} ثانیه!` : 'در حال تحلیل مطالبات...')

  return (
    <div
      className={`split-stopwatch-template ${className}`}
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        overflow: 'hidden',
        background: '#090d16',
        direction: 'rtl',
        display: 'flex',
        flexDirection: 'column',
        transform: `scale(${pulseMotion})`,
        ...style,
      }}
    >
      {/* Top Half: Legacy Excel / Payment Crisis Pressure */}
      <div
        style={{
          flex: 1,
          background: 'rgba(239, 68, 68, 0.09)',
          borderBottom: '2px solid rgba(255,255,255,0.15)',
          padding: '40px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 17, fontWeight: 900, color: '#f87171' }}>{topTitle}</span>
          <span style={{ fontSize: 14, color: '#fca5a5', fontWeight: 800 }}>{topSub}</span>
        </div>

        <div style={{ fontSize: 21, fontWeight: 800, color: '#fef2f2', lineHeight: 1.6 }}>
          {topBody}
        </div>

        <div style={{ fontSize: 13, color: '#f87171', fontWeight: 700 }}>{topFooter}</div>
      </div>

      {/* Center Stopwatch Divider */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: isHisabcheDone ? '#10b981' : '#1e293b',
          color: isHisabcheDone ? '#ffffff' : '#f8fafc',
          padding: '10px 26px',
          borderRadius: 999,
          border: '2px solid #ffffff',
          boxShadow: isHisabcheDone
            ? '0 0 30px rgba(16, 185, 129, 0.6)'
            : '0 0 25px rgba(0,0,0,0.8)',
          fontSize: 17,
          fontWeight: 900,
          zIndex: 10,
          whiteSpace: 'nowrap',
          direction: 'ltr',
          transition: 'background 0.2s, box-shadow 0.2s',
        }}
      >
        ⏱️ {hisabcheSec.toFixed(1)}s
      </div>

      {/* Bottom Half: Hisabche Instant Automation & Resolution */}
      <div
        style={{
          flex: 1,
          background: isHisabcheDone ? 'rgba(16, 185, 129, 0.14)' : 'rgba(34, 211, 238, 0.08)',
          padding: '40px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{ fontSize: 17, fontWeight: 900, color: isHisabcheDone ? '#34d399' : '#38bdf8' }}
          >
            {bottomTitle}
          </span>
          <span
            style={{ fontSize: 14, color: isHisabcheDone ? '#34d399' : '#38bdf8', fontWeight: 800 }}
          >
            {resolvedBottomSub}
          </span>
        </div>

        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: isHisabcheDone ? '#6ee7b7' : '#e0f2fe',
            lineHeight: 1.5,
            transform: `scale(${1 + 0.04 * hisabcheDoneP})`,
          }}
        >
          {bottomBody}
        </div>

        <div style={{ fontSize: 14, color: '#34d399', fontWeight: 800 }}>
          {resolvedBottomFooter}
        </div>
      </div>
    </div>
  )
}
