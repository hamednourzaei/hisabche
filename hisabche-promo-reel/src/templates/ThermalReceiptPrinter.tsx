import React from 'react'
import { clamp, ease, progress } from '../engine/math'

export interface ThermalReceiptPrinterProps {
  t: number
  title?: string
  subtitle?: string
  style?: React.CSSProperties
  className?: string
}

/**
 * Thermal Receipt Printer Template (`thermal-receipt-scroll`)
 * Realistic POS receipt unrolling vertically with printed line items,
 * red discrepancy alert, and transformation into a digital Hisabche invoice.
 */
export const ThermalReceiptPrinterTemplate: React.FC<ThermalReceiptPrinterProps> = ({
  t,
  title = 'فاکتور کاغذی در برابر فاکتور هوشمند',
  style,
  className = '',
}) => {
  const rollP = ease(clamp(progress(t, 0.2, 2.5)))
  const errorP = ease(clamp(progress(t, 2.8, 0.4)))
  const digitalP = ease(clamp(progress(t, 3.6, 0.8)))

  const items = [
    { name: 'روغن موتور اسپیشال ۴ لیتری', qty: '۳ عدد', price: '۲٬۴۰۰٬۰۰۰' },
    { name: 'فیلتر هوا هیوندای اصلی', qty: '۲ عدد', price: '۹۰۰٬۰۰۰' },
    { name: 'لنت ترمز جلو سرامیکی', qty: '۱ دست', price: '۳٬۲۰۰٬۰۰۰' },
    { name: 'تخفیف دستی ثبت‌نشده', qty: '-', price: '- ۴۵۰٬۰۰۰', error: true },
    { name: 'کسری ناشناخته انبار', qty: 'نامشخص', price: '- ۸۵۰٬۰۰۰', error: true },
  ]

  return (
    <div
      className={`thermal-receipt-template ${className}`}
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        overflow: 'hidden',
        background: '#0a0d14',
        direction: 'rtl',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '50px 24px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 24, zIndex: 5 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.1em' }}>
          ثبت فروش در لحظه
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', marginTop: 4 }}>{title}</div>
      </div>

      {/* Top POS Machine Slot */}
      <div
        style={{
          width: 380,
          height: 18,
          background: '#1e293b',
          borderRadius: 9,
          border: '2px solid rgba(255,255,255,0.1)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.8), inset 0 2px 4px rgba(0,0,0,0.9)',
          zIndex: 4,
          position: 'relative',
        }}
      />

      {/* Paper Receipt Unrolling Downwards */}
      <div
        style={{
          position: 'relative',
          width: 340,
          background: '#f8fafc',
          color: '#0f172a',
          borderRadius: '0 0 6px 6px',
          boxShadow: '0 20px 45px rgba(0,0,0,0.5)',
          maxHeight: 560 * rollP,
          overflow: 'hidden',
          transition: 'none',
          padding: '20px 18px',
          boxSizing: 'border-box',
          fontFamily: 'monospace, Tahoma, sans-serif',
          zIndex: 3,
        }}
      >
        <div
          style={{
            textAlign: 'center',
            borderBottom: '1px dashed #cbd5e1',
            paddingBottom: 10,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 900 }}>فروشگاه مرکزی قطعات یدکی</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            فیش کارتخوان شماره ۹۸۲۲
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it, idx) => {
            const itemP = clamp(progress(t, 0.4 + idx * 0.4, 0.2))
            const isAlert = it.error && errorP > 0.5
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                  opacity: itemP,
                  background: isAlert ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                  padding: isAlert ? '2px 6px' : 0,
                  borderRadius: 4,
                  color: isAlert ? '#dc2626' : '#0f172a',
                  fontWeight: isAlert ? 800 : 600,
                }}
              >
                <span>{it.name}</span>
                <span style={{ direction: 'ltr' }}>{it.price}</span>
              </div>
            )
          })}
        </div>

        {/* Paper jagged bottom edge */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 8,
            background:
              'linear-gradient(45deg, transparent 33.333%, #0a0d14 33.333%, #0a0d14 66.667%, transparent 66.667%), linear-gradient(-45deg, transparent 33.333%, #0a0d14 33.333%, #0a0d14 66.667%, transparent 66.667%)',
            backgroundSize: '12px 12px',
          }}
        />
      </div>

      {/* Digital Hisabche Solution Card Overlay */}
      {digitalP > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 480,
            width: 440,
            background: 'rgba(15, 23, 42, 0.94)',
            border: '1.5px solid #22d3ee',
            borderRadius: 20,
            padding: '22px 24px',
            boxShadow: '0 0 40px rgba(34, 211, 238, 0.35)',
            backdropFilter: 'blur(16px)',
            zIndex: 6,
            transform: `scale(${0.8 + 0.2 * digitalP})`,
            opacity: digitalP,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 900, color: '#22d3ee' }}>
              فاکتور دیجیتال حسابچه
            </span>
            <span
              style={{
                fontSize: 12,
                background: 'rgba(34, 211, 238, 0.15)',
                color: '#22d3ee',
                padding: '3px 8px',
                borderRadius: 6,
              }}
            >
              تراز آنی
            </span>
          </div>
          <div style={{ fontSize: 14, color: '#e2e8f0', lineHeight: 1.6 }}>
            محاسبه خودکار بهای تمام‌شده + کسر آنی انبار + سود خالص شفاف
          </div>
        </div>
      )}
    </div>
  )
}
