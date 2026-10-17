import React from 'react'
import { clamp, ease, progress } from '../engine/math'

export interface SwissFinancialTerminalProps {
  t: number
  title?: string
  style?: React.CSSProperties
  className?: string
}

/**
 * Swiss Financial Terminal Template (`swiss-financial-terminal`)
 * Bloomberg/Stripe architectural data grid, tabular rolling odometer numbers,
 * cashflow waterfall bars, and live double-entry debit/credit equilibrium.
 */
export const SwissFinancialTerminalTemplate: React.FC<SwissFinancialTerminalProps> = ({
  t,
  title = 'ترازنامه مالی با دقت بانک مرکزی',
  style,
  className = '',
}) => {
  const tableP = ease(clamp(progress(t, 0.4, 0.8)))
  const balanceP = ease(clamp(progress(t, 1.6, 0.8)))

  const rows = [
    { code: '۱۰۱', title: 'موجودی صندوق و بانک', debit: '۸۵٬۲۰۰٬۰۰۰', credit: '—' },
    { code: '۱۰۲', title: 'حساب‌های دریافتی (طلب بازار)', debit: '۱۴۲٬۰۰۰٬۰۰۰', credit: '—' },
    { code: '۲۰۱', title: 'حساب‌های پرداختی (چک خرید)', debit: '—', credit: '۱۱۵٬۰۰۰٬۰۰۰' },
    { code: '۳۰۱', title: 'سرمایه اولیه و سود انباشته', debit: '—', credit: '۱۱۲٬۲۰۰٬۰۰۰' },
  ]

  return (
    <div
      className={`swiss-terminal-template ${className}`}
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        overflow: 'hidden',
        background: '#0a0d14',
        color: '#f8fafc',
        direction: 'rtl',
        display: 'flex',
        flexDirection: 'column',
        padding: '50px 24px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Top Header */}
      <div
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.15)',
          paddingBottom: 16,
          marginBottom: 28,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8' }}>
            ترمینال استاندارد دفترداری دوطرفه
          </span>
          <span
            style={{
              fontSize: 11,
              background: '#1e293b',
              color: '#94a3b8',
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            ISO 9001
          </span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{title}</div>
      </div>

      {/* Tabular Ledger Matrix */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1.5px solid rgba(255,255,255,0.12)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 16px 36px rgba(0,0,0,0.5)',
          opacity: tableP,
        }}
      >
        {/* Table Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '50px 1.8fr 1.2fr 1.2fr',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.04)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            fontSize: 12,
            fontWeight: 800,
            color: '#94a3b8',
          }}
        >
          <span>کد</span>
          <span>شرح حساب</span>
          <span style={{ textAlign: 'center' }}>بدهکار</span>
          <span style={{ textAlign: 'center' }}>بستانکار</span>
        </div>

        {/* Table Rows */}
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '50px 1.8fr 1.2fr 1.2fr',
              padding: '12px 16px',
              borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              fontSize: 13,
              fontWeight: 700,
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#64748b' }}>{r.code}</span>
            <span>{r.title}</span>
            <span
              style={{
                textAlign: 'center',
                direction: 'ltr',
                color: r.debit !== '—' ? '#38bdf8' : '#64748b',
              }}
            >
              {r.debit}
            </span>
            <span
              style={{
                textAlign: 'center',
                direction: 'ltr',
                color: r.credit !== '—' ? '#f43f5e' : '#64748b',
              }}
            >
              {r.credit}
            </span>
          </div>
        ))}
      </div>

      {/* Double-Entry Equilibrium Scale Badge */}
      <div
        style={{
          marginTop: 30,
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1.5px solid #22c55e',
          borderRadius: 16,
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: balanceP,
        }}
      >
        <div>
          <div style={{ fontSize: 13, color: '#4ade80', fontWeight: 800 }}>تراز قطعی دفتر کل:</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', marginTop: 2 }}>
            ۲۲۷٬۲۰۰٬۰۰۰ = ۲۲۷٬۲۰۰٬۰۰۰
          </div>
        </div>
        <div
          style={{
            background: '#22c55e',
            color: '#052e16',
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          ✓ بدون مغایرت
        </div>
      </div>
    </div>
  )
}
