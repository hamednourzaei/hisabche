import React from 'react'
import { clamp, ease, progress } from '../engine/math'

export interface ChatPanicToCalmProps {
  t: number
  title?: string
  style?: React.CSSProperties
  className?: string
}

/**
 * Chat Panic to Calm Template (`chat-panic-to-calm`)
 * Rapid-fire incoming stress messages from staff/customers stacking up,
 * then swiped away into a single calm unified Hisabche dashboard.
 */
export const ChatPanicToCalmTemplate: React.FC<ChatPanicToCalmProps> = ({
  t,
  title = 'پایان هرج‌ومرج پیام‌ها و استرس روزمره',
  style,
  className = '',
}) => {
  const swipeP = ease(clamp(progress(t, 2.6, 0.7)))

  const messages = [
    {
      sender: 'انباردار سوله',
      text: 'حاجی موجودی کد ۱۰۴ تموم شد! بار جدید کجاست؟',
      time: '۱۰:۱۴',
      color: '#ef4444',
      at: 0.2,
    },
    {
      sender: 'فروشنده شعبه بازار',
      text: 'مشتری پای صندوقه، حساب قبلیش چقدر بود؟ نسیه بدم؟',
      time: '۱۰:۱۵',
      color: '#f59e0b',
      at: 0.8,
    },
    {
      sender: 'حسابدار دفتر',
      text: 'فاکتورهای دیروز ارسال نشده؛ تراز بانک بسته نمی‌شه!',
      time: '۱۰:۱۶',
      color: '#dc2626',
      at: 1.4,
    },
  ]

  return (
    <div
      className={`chat-panic-template ${className}`}
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        overflow: 'hidden',
        background: '#0b0f19',
        color: '#ffffff',
        direction: 'rtl',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '50px 20px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 28, zIndex: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#f43f5e', letterSpacing: '0.08em' }}>
          بحران ارتباطات سنتی
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{title}</div>
      </div>

      {/* Chaotic Message Stack (Swipes left when Hisabche takes over) */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          transform: `translateX(${-swipeP * 560}px)`,
          opacity: 1 - swipeP,
          transition: 'none',
        }}
      >
        {messages.map((m, idx) => {
          const msgP = ease(clamp(progress(t, m.at, 0.35)))
          return (
            <div
              key={idx}
              style={{
                background: 'rgba(30, 41, 59, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRight: `4px solid ${m.color}`,
                borderRadius: 16,
                padding: '14px 18px',
                boxShadow: '0 10px 24px rgba(0,0,0,0.4)',
                transform: `scale(${0.85 + 0.15 * msgP}) translateY(${(1 - msgP) * 20}px)`,
                opacity: msgP,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: m.color }}>{m.sender}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{m.time}</span>
              </div>
              <div style={{ fontSize: 14, color: '#f1f5f9', lineHeight: 1.5 }}>{m.text}</div>
            </div>
          )
        })}
      </div>

      {/* Unified Calm Hisabche Dashboard Screen */}
      <div
        style={{
          position: 'absolute',
          top: 180,
          width: 480,
          background: 'rgba(15, 23, 42, 0.96)',
          border: '1.5px solid #22d3ee',
          borderRadius: 24,
          padding: '24px 22px',
          boxShadow: '0 0 50px rgba(34, 211, 238, 0.25)',
          backdropFilter: 'blur(20px)',
          transform: `translateX(${(1 - swipeP) * 560}px)`,
          opacity: swipeP,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: 12,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 900, color: '#22d3ee' }}>
            پاسخ خودکار در حسابچه
          </span>
          <span
            style={{
              fontSize: 12,
              background: 'rgba(34, 197, 94, 0.18)',
              color: '#4ade80',
              padding: '3px 8px',
              borderRadius: 6,
              fontWeight: 800,
            }}
          >
            همه‌چیز مرتب است
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              color: '#cbd5e1',
            }}
          >
            <span style={{ color: '#4ade80', fontWeight: 900 }}>✓</span>
            <span>موجودی کد ۱۰۴: ۲۴ کارتن در انبار شماره ۲</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              color: '#cbd5e1',
            }}
          >
            <span style={{ color: '#4ade80', fontWeight: 900 }}>✓</span>
            <span>مانده مشتری: ۴۲ میلیون تومان (سقف اعتبار مجاز)</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              color: '#4ade80',
              fontWeight: 800,
            }}
          >
            <span>✓</span>
            <span>تراز بانکی لحظه‌ای بدون یک ریال مغایرت</span>
          </div>
        </div>
      </div>
    </div>
  )
}
