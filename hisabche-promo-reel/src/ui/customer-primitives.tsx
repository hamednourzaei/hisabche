// ============================================
// Hisabche Motion Design Studio — Customer Conversion Primitives
// Human-centered, product-grounded visual metaphors:
// 1. OfflineSyncIndicator (Local-First Resilience & Sync Wave)
// 2. FragmentedToolsMetaphor (Chaos to Unified Engine Convergence)
// 3. ProfitWaterfallBreakdown (Financial Truth: Revenue vs Net Margin)
// 4. WarehouseNodeMovement (Multi-Branch Procedural Logistics)
// 5. DualPerspectiveWorkflow (Seller Simplicity vs Double-Entry Depth)
//
// STRICT DARK OBSIDIAN THEME ONLY (#0A0C10, #10141D, #161B26)
// Zero external dependencies. Deterministic pure functions of time.
// ============================================

import type { CSSProperties } from 'react'
import { clamp, ease, mix, progress, pulse, spring } from '../engine/anim'
import { Icon } from './icons'
import { Rich } from './rich'

export const faNumber = (n: number): string => new Intl.NumberFormat('fa-IR').format(Math.round(n))

// ─────────────────────────────────────────────────────────────────────────────
// 1. OfflineSyncIndicator
// ─────────────────────────────────────────────────────────────────────────────

export interface OfflineSyncIndicatorProps {
  t: number
  startAt?: number
  reconnectAt?: number
  syncCompleteAt?: number
  className?: string
  style?: CSSProperties
}

export function OfflineSyncIndicator({
  t,
  startAt = 0.2,
  reconnectAt = 2.6,
  syncCompleteAt = 4.2,
  className = '',
  style,
}: OfflineSyncIndicatorProps) {
  const isOffline = t < reconnectAt
  const isSyncing = t >= reconnectAt && t < syncCompleteAt
  const isSynced = t >= syncCompleteAt

  // Animation values
  const enterProgress = ease(progress(t, startAt, 0.6))
  const syncProgress = clamp(progress(t, reconnectAt, Math.max(0.01, syncCompleteAt - reconnectAt)))
  const offlinePulse = pulse(t, startAt, reconnectAt, 1.2)
  const syncSpin = ((t - reconnectAt) * 360) % 360
  const successSpring = spring(Math.max(0, t - syncCompleteAt))

  // Radar wave propagation
  const wave1 = (t >= reconnectAt ? (t - reconnectAt) % 1.5 : 0) / 1.5
  const wave2 = (t >= reconnectAt + 0.4 ? (t - (reconnectAt + 0.4)) % 1.5 : 0) / 1.5
  const wave3 = (t >= reconnectAt + 0.8 ? (t - (reconnectAt + 0.8)) % 1.5 : 0) / 1.5

  const transactions = [
    {
      id: 'INV-1042',
      title: 'فاکتور فروش #۱۰۴۲',
      customer: 'مشتری حقوقی (کد ۱۰۴)',
      amount: 24500,
      syncTime: reconnectAt + 0.2,
    },
    {
      id: 'REC-0581',
      title: 'رسید دریافت وجه #۵۸۱',
      customer: 'دریافت نقدی از باجه',
      amount: 15000,
      syncTime: reconnectAt + 0.7,
    },
    {
      id: 'OUT-0309',
      title: 'حواله خروج انبار #۳۰۹',
      customer: 'تحویل اقلام بازرگانی',
      amount: 8200,
      syncTime: reconnectAt + 1.2,
    },
  ]

  return (
    <div
      className={`customer-primitive-card offline-sync-container ${className}`}
      style={{
        background: 'linear-gradient(180deg, #10141D 0%, #0A0C10 100%)',
        border: `1px solid ${
          isSynced
            ? 'rgba(16, 185, 129, 0.35)'
            : isSyncing
              ? 'rgba(34, 211, 238, 0.35)'
              : 'rgba(251, 113, 133, 0.3)'
        }`,
        boxShadow: `0 16px 40px rgba(0, 0, 0, 0.6), 0 0 30px ${
          isSynced
            ? 'rgba(16, 185, 129, 0.15)'
            : isSyncing
              ? 'rgba(34, 211, 238, 0.15)'
              : 'rgba(251, 113, 133, 0.12)'
        }`,
        borderRadius: 20,
        padding: 20,
        color: '#f8fafc',
        position: 'relative',
        overflow: 'hidden',
        opacity: enterProgress,
        transform: `translateY(${mix(24, 0, enterProgress)}px)`,
        ...style,
      }}
    >
      {/* Ambient background glow */}
      <div
        style={{
          position: 'absolute',
          top: -60,
          right: -60,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: isSynced
            ? 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%)'
            : isSyncing
              ? 'radial-gradient(circle, rgba(34,211,238,0.18) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(251,113,133,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Connection Status Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Status Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '7px 14px',
            borderRadius: 999,
            background: isSynced
              ? 'rgba(16, 185, 129, 0.12)'
              : isSyncing
                ? 'rgba(34, 211, 238, 0.12)'
                : 'rgba(251, 113, 133, 0.12)',
            border: `1px solid ${
              isSynced
                ? 'rgba(16, 185, 129, 0.4)'
                : isSyncing
                  ? 'rgba(34, 211, 238, 0.4)'
                  : 'rgba(251, 113, 133, 0.4)'
            }`,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {isOffline && (
            <>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#fb7185',
                  boxShadow: `0 0 ${8 + offlinePulse * 8}px #fb7185`,
                }}
              />
              <Icon name="offline" size={16} color="#fb7185" />
              <span>
                <Rich text="[r:قطع اینترنت] · حالت آفلاین فعال" />
              </span>
            </>
          )}

          {isSyncing && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  transform: `rotate(${syncSpin}deg)`,
                }}
              >
                <Icon name="sync" size={16} color="#22d3ee" />
              </div>
              <span>
                <Rich text="[c:اتصال برقرار شد] · در حال همگام‌سازی..." />
              </span>
            </>
          )}

          {isSynced && (
            <>
              <div style={{ transform: `scale(${successSpring})` }}>
                <Icon name="check" size={16} color="#34d399" />
              </div>
              <span>
                <Rich text="[w:آنلاین] · [g:همگام‌سازی کامل شد ✓]" />
              </span>
            </>
          )}
        </div>

        {/* Sync percentage / state indicator */}
        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
          {isOffline && (
            <span style={{ color: '#fbbf24' }}>
              <Rich text="ذخیره محلی [w:SQLite]" />
            </span>
          )}
          {isSyncing && (
            <span style={{ color: '#22d3ee' }}>{faNumber(syncProgress * 100)}٪ ارسال شده</span>
          )}
          {isSynced && (
            <span style={{ color: '#34d399' }}>
              <Rich text="[w:صفر مغایرت] سرور" />
            </span>
          )}
        </div>
      </div>

      {/* Sync Wave Visualizer (When Reconnecting & Syncing) */}
      <div
        style={{
          position: 'relative',
          height: 38,
          marginBottom: 14,
          borderRadius: 10,
          background: 'rgba(14, 18, 27, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, zIndex: 2 }}>
          <Icon name="shield" size={16} color="#22d3ee" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
            <Rich text="ذخیره امن روی دستگاه: [c:۳ تراکنش در صف]" />
          </span>
        </div>

        {/* Sync Progress Bar */}
        <div
          style={{
            position: 'absolute',
            insetBlock: 0,
            right: 0,
            width: `${isSynced ? 100 : isSyncing ? syncProgress * 100 : 0}%`,
            background: isSynced
              ? 'linear-gradient(90deg, rgba(16,185,129,0.1), rgba(16,185,129,0.3))'
              : 'linear-gradient(90deg, rgba(34,211,238,0.1), rgba(34,211,238,0.3))',
            transition: 'width 0.1s linear',
            borderLeft: isSyncing ? '2px solid #22d3ee' : isSynced ? '2px solid #34d399' : 'none',
          }}
        />

        {/* Concentric radar rings during sync */}
        {isSyncing && (
          <svg
            style={{
              position: 'absolute',
              right: 20,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 120,
              height: 38,
              pointerEvents: 'none',
            }}
          >
            <circle
              cx="60"
              cy="19"
              r={mix(4, 50, wave1)}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="1.5"
              strokeOpacity={1 - wave1}
            />
            {t >= reconnectAt + 0.4 && (
              <circle
                cx="60"
                cy="19"
                r={mix(4, 50, wave2)}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="1.5"
                strokeOpacity={1 - wave2}
              />
            )}
            {t >= reconnectAt + 0.8 && (
              <circle
                cx="60"
                cy="19"
                r={mix(4, 50, wave3)}
                fill="none"
                stroke="#34d399"
                strokeWidth="1.5"
                strokeOpacity={1 - wave3}
              />
            )}
          </svg>
        )}

        <div style={{ zIndex: 2, fontSize: 11, color: isSynced ? '#34d399' : '#94a3b8' }}>
          {isOffline && 'آماده ارسال خودکار'}
          {isSyncing && 'در حال آپلود صف...'}
          {isSynced && 'تأیید سرور ✓'}
        </div>
      </div>

      {/* Transaction Queue Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {transactions.map((tx, idx) => {
          const cardEnter = ease(progress(t, startAt + 0.1 + idx * 0.12, 0.4))
          const itemSynced = t >= tx.syncTime
          const itemSyncing = t >= reconnectAt && !itemSynced
          const cardSpring = spring(Math.max(0, t - tx.syncTime))

          return (
            <div
              key={tx.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 12,
                background: itemSynced
                  ? 'rgba(16, 185, 129, 0.08)'
                  : itemSyncing
                    ? 'rgba(34, 211, 238, 0.08)'
                    : 'rgba(22, 27, 38, 0.7)',
                border: `1px solid ${
                  itemSynced
                    ? 'rgba(16, 185, 129, 0.3)'
                    : itemSyncing
                      ? 'rgba(34, 211, 238, 0.3)'
                      : 'rgba(255, 255, 255, 0.06)'
                }`,
                opacity: cardEnter,
                transform: `translateX(${mix(16, 0, cardEnter)}px)`,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Item Details */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: itemSynced
                      ? 'rgba(16, 185, 129, 0.16)'
                      : itemSyncing
                        ? 'rgba(34, 211, 238, 0.16)'
                        : 'rgba(245, 158, 11, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: itemSynced ? '#34d399' : itemSyncing ? '#22d3ee' : '#fbbf24',
                    transform: itemSynced ? `scale(${mix(0.85, 1, cardSpring)})` : 'none',
                  }}
                >
                  <Icon name={itemSynced ? 'check' : itemSyncing ? 'sync' : 'drive'} size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
                    <Rich text={tx.title} />
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{tx.customer}</div>
                </div>
              </div>

              {/* Amount & Status Tag */}
              <div style={{ textAlign: 'left', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', direction: 'ltr' }}>
                  {faNumber(tx.amount)}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    marginTop: 2,
                    color: itemSynced ? '#34d399' : itemSyncing ? '#22d3ee' : '#fbbf24',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {itemSynced ? 'ثبت در ابر ✓' : itemSyncing ? 'ارسال...' : 'ذخیره در دستگاه'}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer Reliability Assurance */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 10,
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 10,
          color: '#64748b',
          gap: 8,
        }}
      >
        <span style={{ whiteSpace: 'nowrap' }}>
          <Rich text="[c:معماری آفلاین-اول:] ثبت بدون توقف" />
        </span>
        <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: 10, whiteSpace: 'nowrap' }}>
          پایگاه داده محلی SQLite
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FragmentedToolsMetaphor
// ─────────────────────────────────────────────────────────────────────────────

export interface FragmentedToolsMetaphorProps {
  t: number
  startAt?: number
  convergeAt?: number
  className?: string
  style?: CSSProperties
}

export function FragmentedToolsMetaphor({
  t,
  startAt = 0.2,
  convergeAt = 2.8,
  className = '',
  style,
}: FragmentedToolsMetaphorProps) {
  const enterP = ease(progress(t, startAt, 0.6))
  const convergeP = ease(progress(t, convergeAt, 1.2))
  const isConverged = t >= convergeAt
  const warningFlicker = pulse(t, startAt, convergeAt, 0.9)
  const unifiedSpring = spring(Math.max(0, t - convergeAt))

  return (
    <div
      className={`customer-primitive-card fragmented-tools-container ${className}`}
      style={{
        background: '#0A0C10',
        borderRadius: 22,
        padding: 22,
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.7)',
        position: 'relative',
        overflow: 'hidden',
        color: '#f8fafc',
        opacity: enterP,
        transform: `translateY(${mix(20, 0, enterP)}px)`,
        ...style,
      }}
    >
      {/* Background ambient gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: isConverged
            ? 'radial-gradient(circle at 50% 85%, rgba(34,211,238,0.12) 0%, transparent 60%)'
            : 'radial-gradient(circle at 50% 20%, rgba(251,113,133,0.08) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      {/* Header Tag */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 999,
            background: isConverged ? 'rgba(34, 211, 238, 0.1)' : 'rgba(251, 113, 133, 0.12)',
            border: `1px solid ${isConverged ? 'rgba(34, 211, 238, 0.3)' : 'rgba(251, 113, 133, 0.3)'}`,
            fontSize: 11,
            fontWeight: 800,
            color: isConverged ? '#22d3ee' : '#fb7185',
            marginBottom: 6,
          }}
        >
          {isConverged ? (
            <Rich text="[c:یکپارچگی هوشمند] · پایان خطاهای دستی" />
          ) : (
            <Rich text="[r:دردسر ابزارهای پراکنده] · ناهماهنگی دائمی" />
          )}
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#f8fafc' }}>
          {isConverged ? (
            <Rich text="[g:اتصال تمام بخش‌ها به یک هسته واحد]" />
          ) : (
            <Rich text="دفتر، اکسل و دخل جدا از هم بودند..." />
          )}
        </div>
      </div>

      {/* Top 3 Fragmented Islands */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          position: 'relative',
          zIndex: 2,
          opacity: mix(1, 0.45, convergeP),
          filter: isConverged ? 'grayscale(0.4)' : 'none',
        }}
      >
        {/* Island 1: دفتر کاغذی خط‌خورده */}
        <div
          style={{
            background: '#141822',
            border: `1px solid ${isConverged ? 'rgba(255,255,255,0.06)' : 'rgba(251,113,133,0.3)'}`,
            borderRadius: 14,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fb7185' }}>
            <Icon name="notebook" size={14} />
            <span style={{ fontSize: 11, fontWeight: 800 }}>دفتر کاغذی</span>
          </div>
          <div
            style={{
              fontSize: 11,
              textDecoration: 'line-through',
              color: '#94a3b8',
              direction: 'ltr',
              textAlign: 'right',
            }}
          >
            ۴۵٬۰۰۰ <s>خطا</s>
          </div>
          <div style={{ fontSize: 10, color: '#fb7185', fontWeight: 700 }}>
            <Rich text="[r:خطای جمع دستی]" />
          </div>
        </div>

        {/* Island 2: فایل اکسل نامنظم */}
        <div
          style={{
            background: '#141822',
            border: `1px solid ${isConverged ? 'rgba(255,255,255,0.06)' : 'rgba(245,158,11,0.3)'}`,
            borderRadius: 14,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fbbf24' }}>
            <Icon name="sheet" size={14} />
            <span style={{ fontSize: 11, fontWeight: 800 }}>فایل اکسل</span>
          </div>
          <div style={{ fontSize: 10, color: '#f87171', direction: 'ltr', fontWeight: 800 }}>
            #VALUE!
          </div>
          <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700 }}>
            <Rich text="فرمول شکسته" />
          </div>
        </div>

        {/* Island 3: صندوق دخل دستی */}
        <div
          style={{
            background: '#141822',
            border: `1px solid ${isConverged ? 'rgba(255,255,255,0.06)' : 'rgba(251,113,133,0.3)'}`,
            borderRadius: 14,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fb7185' }}>
            <Icon name="wallet" size={14} />
            <span style={{ fontSize: 11, fontWeight: 800 }}>صندوق دخل</span>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', direction: 'ltr', textAlign: 'right' }}>
            -۲٬۴۰۰
          </div>
          <div style={{ fontSize: 10, color: '#fb7185', fontWeight: 700 }}>
            <Rich text="[r:کسری صندوق]" />
          </div>
        </div>
      </div>

      {/* Dynamic SVG Converging Vector Canvas */}
      <div style={{ position: 'relative', height: 74, margin: '4px 0' }}>
        <svg
          viewBox="0 0 320 80"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="converge-stream" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fb7185" stopOpacity={1 - convergeP} />
              <stop offset="50%" stopColor="#22d3ee" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={1} />
            </linearGradient>
          </defs>

          {/* Left Stream: Notebook -> Center Hub */}
          <path
            d="M 54 4 C 54 45, 160 30, 160 76"
            fill="none"
            stroke={isConverged ? 'url(#converge-stream)' : '#fb7185'}
            strokeWidth={isConverged ? 2.5 : 1.2}
            strokeDasharray={isConverged ? 'none' : '4 4'}
            strokeOpacity={isConverged ? 0.9 : 0.4 + warningFlicker * 0.3}
          />

          {/* Middle Stream: Excel -> Center Hub */}
          <path
            d="M 160 4 L 160 76"
            fill="none"
            stroke={isConverged ? 'url(#converge-stream)' : '#f59e0b'}
            strokeWidth={isConverged ? 2.5 : 1.2}
            strokeDasharray={isConverged ? 'none' : '4 4'}
            strokeOpacity={isConverged ? 0.9 : 0.4 + warningFlicker * 0.3}
          />

          {/* Right Stream: Cash Drawer -> Center Hub */}
          <path
            d="M 266 4 C 266 45, 160 30, 160 76"
            fill="none"
            stroke={isConverged ? 'url(#converge-stream)' : '#fb7185'}
            strokeWidth={isConverged ? 2.5 : 1.2}
            strokeDasharray={isConverged ? 'none' : '4 4'}
            strokeOpacity={isConverged ? 0.9 : 0.4 + warningFlicker * 0.3}
          />

          {/* Flowing particle packets when converged */}
          {isConverged && (
            <>
              <circle
                cx={mix(54, 160, (t * 1.4) % 1)}
                cy={mix(4, 76, (t * 1.4) % 1)}
                r="3.5"
                fill="#22d3ee"
                filter="drop-shadow(0 0 6px #22d3ee)"
              />
              <circle
                cx="160"
                cy={mix(4, 76, ((t + 0.3) * 1.4) % 1)}
                r="3.5"
                fill="#34d399"
                filter="drop-shadow(0 0 6px #34d399)"
              />
              <circle
                cx={mix(266, 160, ((t + 0.6) * 1.4) % 1)}
                cy={mix(4, 76, ((t + 0.6) * 1.4) % 1)}
                r="3.5"
                fill="#22d3ee"
                filter="drop-shadow(0 0 6px #22d3ee)"
              />
            </>
          )}
        </svg>
      </div>

      {/* Unified Hisabche Engine (Target Card) */}
      <div
        style={{
          background: 'linear-gradient(180deg, #161B26 0%, #0E121A 100%)',
          borderRadius: 16,
          padding: 16,
          border: `1px solid ${isConverged ? 'rgba(34, 211, 238, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
          boxShadow: isConverged
            ? '0 0 30px rgba(34, 211, 238, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            : 'none',
          transform: isConverged ? `scale(${mix(0.96, 1, unifiedSpring)})` : 'scale(0.96)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(34, 211, 238, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#22d3ee',
              }}
            >
              <Icon name="sparkles" size={16} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
                <Rich text="[c:هسته یکپارچه حسابچه]" />
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>یک پایگاه داده · یک سند حسابداری</div>
            </div>
          </div>

          <div
            style={{
              padding: '4px 10px',
              borderRadius: 8,
              background: isConverged ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${isConverged ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
              fontSize: 11,
              fontWeight: 700,
              color: isConverged ? '#34d399' : '#94a3b8',
            }}
          >
            {isConverged ? 'تراز لحظه‌ای ۱۰۰٪ ✓' : 'در انتظار اتصال'}
          </div>
        </div>

        {/* 3 Synchronized Metres */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div
            style={{
              background: 'rgba(10, 12, 16, 0.6)',
              padding: 8,
              borderRadius: 10,
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            <div style={{ fontSize: 10, color: '#94a3b8' }}>انبار</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#22d3ee' }}>همگام با فروش</div>
          </div>
          <div
            style={{
              background: 'rgba(10, 12, 16, 0.6)',
              padding: 8,
              borderRadius: 10,
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            <div style={{ fontSize: 10, color: '#94a3b8' }}>صندوق</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#34d399' }}>صفر مغایرت</div>
          </div>
          <div
            style={{
              background: 'rgba(10, 12, 16, 0.6)',
              padding: 8,
              borderRadius: 10,
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            <div style={{ fontSize: 10, color: '#94a3b8' }}>سود خالص</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#c084fc' }}>محاسبه واقعی</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ProfitWaterfallBreakdown
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfitWaterfallBreakdownProps {
  t: number
  startAt?: number
  grossRevenue?: number
  cogs?: number
  opex?: number
  currency?: string
  className?: string
  style?: CSSProperties
}

export function ProfitWaterfallBreakdown({
  t,
  startAt = 0.2,
  grossRevenue = 280000,
  cogs = 180000,
  opex = 35000,
  currency = '',
  className = '',
  style,
}: ProfitWaterfallBreakdownProps) {
  const netProfit = grossRevenue - cogs - opex // 65,000

  // Staggered timing for waterfall steps
  const t1 = startAt + 0.1 // Gross revenue
  const t2 = startAt + 1.2 // COGS (FIFO)
  const t3 = startAt + 2.2 // Operating expenses
  const t4 = startAt + 3.2 // True Net Profit

  const pEnter = ease(progress(t, startAt, 0.5))
  const p1 = ease(progress(t, t1, 0.7))
  const p2 = ease(progress(t, t2, 0.7))
  const p3 = ease(progress(t, t3, 0.7))
  const p4 = ease(progress(t, t4, 0.8))

  const curRev = mix(0, grossRevenue, p1)
  const curCogs = mix(0, cogs, p2)
  const curOpex = mix(0, opex, p3)
  const curProfit = mix(0, netProfit, p4)

  const cogsPct = Math.round((cogs / grossRevenue) * 100)
  const opexPct = Math.round((opex / grossRevenue) * 100)
  const profitPct = Math.round((netProfit / grossRevenue) * 100)

  // Chart heights normalized to 150px
  const maxH = 150
  const hRev = maxH
  const hCogs = (cogs / grossRevenue) * maxH // ~96.4px
  const hOpex = (opex / grossRevenue) * maxH // ~18.75px
  const hProfit = (netProfit / grossRevenue) * maxH // ~34.8px

  return (
    <div
      className={`customer-primitive-card profit-waterfall-container ${className}`}
      style={{
        background: 'linear-gradient(180deg, #10141D 0%, #0A0C10 100%)',
        borderRadius: 22,
        padding: 22,
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.65)',
        color: '#f8fafc',
        position: 'relative',
        overflow: 'hidden',
        opacity: pEnter,
        transform: `translateY(${mix(20, 0, pEnter)}px)`,
        ...style,
      }}
    >
      {/* Top Insight Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{ fontSize: 11, fontWeight: 800, color: '#22d3ee', textTransform: 'uppercase' }}
          >
            <Rich text="[c:واقعیت مالی کسب‌وکار]" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#f8fafc', marginTop: 2 }}>
            <Rich text="تفاوت فروش دخل با [g:سود خالص واقعی]" />
          </div>
        </div>

        <div
          style={{
            padding: '5px 12px',
            borderRadius: 999,
            background: 'rgba(34, 211, 238, 0.1)',
            border: '1px solid rgba(34, 211, 238, 0.3)',
            fontSize: 11,
            fontWeight: 800,
            color: '#22d3ee',
          }}
        >
          روش لایه‌ای FIFO
        </div>
      </div>

      {/* Waterfall Graphic Canvas */}
      <div
        style={{
          position: 'relative',
          height: maxH + 70,
          background: 'rgba(14, 18, 27, 0.6)',
          borderRadius: 16,
          padding: '16px 12px 10px',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          alignItems: 'flex-end',
        }}
      >
        {/* Bottom Baseline Grid Line */}
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            left: 12,
            right: 12,
            height: 1,
            background: 'rgba(255, 255, 255, 0.1)',
            pointerEvents: 'none',
          }}
        />

        {/* 1. Gross Revenue Pillar (Grows bottom-to-top) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            height: '100%',
            justifyContent: 'flex-end',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#22d3ee',
              marginBottom: 4,
              direction: 'ltr',
            }}
          >
            +{faNumber(curRev)}
          </div>
          <div
            style={{
              width: '100%',
              height: hRev * p1,
              borderRadius: '8px 8px 4px 4px',
              background: 'linear-gradient(180deg, #22d3ee 0%, rgba(34, 211, 238, 0.3) 100%)',
              boxShadow: '0 0 16px rgba(34, 211, 238, 0.25)',
              transition: 'height 0.1s linear',
            }}
          />
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginTop: 6 }}>
            فروش کل
          </div>
        </div>

        {/* 2. COGS (FIFO) Pillar (Grows bottom-to-top) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            height: '100%',
            justifyContent: 'flex-end',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#fb7185',
              marginBottom: 4,
              direction: 'ltr',
            }}
          >
            -{faNumber(curCogs)}
          </div>
          <div
            style={{
              width: '100%',
              height: hCogs * p2,
              borderRadius: '8px 8px 4px 4px',
              background: 'linear-gradient(180deg, #fb7185 0%, rgba(251, 113, 133, 0.35) 100%)',
              boxShadow: '0 0 14px rgba(251, 113, 133, 0.25)',
              transition: 'height 0.1s linear',
            }}
          />
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fb7185', marginTop: 6 }}>
            بهای خرید ({faNumber(cogsPct)}٪)
          </div>
        </div>

        {/* 3. Operating Expenses Pillar (Grows bottom-to-top) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            height: '100%',
            justifyContent: 'flex-end',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#fbbf24',
              marginBottom: 4,
              direction: 'ltr',
            }}
          >
            -{faNumber(curOpex)}
          </div>
          <div
            style={{
              width: '100%',
              height: hOpex * p3,
              borderRadius: '8px 8px 4px 4px',
              background: 'linear-gradient(180deg, #f59e0b 0%, rgba(245, 158, 11, 0.35) 100%)',
              boxShadow: '0 0 14px rgba(245, 158, 11, 0.25)',
              transition: 'height 0.1s linear',
            }}
          />
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', marginTop: 6 }}>
            هزینه‌ها ({faNumber(opexPct)}٪)
          </div>
        </div>

        {/* 4. True Net Profit Pillar (Grows bottom-to-top) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            height: '100%',
            justifyContent: 'flex-end',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: '#34d399',
              marginBottom: 4,
              direction: 'ltr',
              transform: `scale(${mix(0.8, 1, p4)})`,
            }}
          >
            +{faNumber(curProfit)}
          </div>
          <div
            style={{
              width: '100%',
              height: hProfit * p4,
              borderRadius: '8px 8px 4px 4px',
              background: 'linear-gradient(180deg, #34d399 0%, rgba(16, 185, 129, 0.4) 100%)',
              boxShadow: '0 0 24px rgba(52, 211, 153, 0.45)',
              border: '1px solid rgba(52, 211, 153, 0.6)',
              transition: 'height 0.1s linear',
            }}
          />
          <div style={{ fontSize: 10, fontWeight: 800, color: '#34d399', marginTop: 6 }}>
            سود واقعی ({faNumber(profitPct)}٪)
          </div>
        </div>
      </div>

      {/* Summary Row */}
      <div
        style={{
          marginTop: 14,
          padding: '12px 14px',
          borderRadius: 12,
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="trend" size={16} color="#34d399" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
            <Rich text="سود خالص واقعی شما: [g:۶۵٬۰۰۰]" />
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>
          از {faNumber(grossRevenue)}
          {currency ? ` ${currency}` : ''} فروش کل
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. WarehouseNodeMovement
// ─────────────────────────────────────────────────────────────────────────────

export interface WarehouseNodeMovementProps {
  t: number
  startAt?: number
  transferStartAt?: number
  transferArriveAt?: number
  initialCentralStock?: number
  initialShopStock?: number
  initialBranchStock?: number
  transferQuantity?: number
  itemTitle?: string
  className?: string
  style?: CSSProperties
}

export function WarehouseNodeMovement({
  t,
  startAt = 0.2,
  transferStartAt = 1.4,
  transferArriveAt = 3.6,
  initialCentralStock = 1200,
  initialShopStock = 150,
  initialBranchStock = 400,
  transferQuantity = 250,
  itemTitle = 'کالای انبارداری (کد A-104)',
  className = '',
  style,
}: WarehouseNodeMovementProps) {
  // Transferred splits: 100 to shop, 150 to branch = 250 total
  const shopTransfer = 100
  const branchTransfer = 150

  const enterP = ease(progress(t, startAt, 0.5))
  const transferP = ease(
    progress(t, transferStartAt, Math.max(0.01, transferArriveAt - transferStartAt)),
  )
  const isTransferring = t >= transferStartAt && t < transferArriveAt
  const isArrived = t >= transferArriveAt
  const arriveSpring = spring(Math.max(0, t - transferArriveAt))

  // Live stock counts
  const centralStock = mix(initialCentralStock, initialCentralStock - transferQuantity, transferP)
  const shopStock = mix(initialShopStock, initialShopStock + shopTransfer, transferP)
  const branchStock = mix(initialBranchStock, initialBranchStock + branchTransfer, transferP)

  return (
    <div
      className={`customer-primitive-card warehouse-node-container ${className}`}
      style={{
        background: '#0A0C10',
        borderRadius: 22,
        padding: 22,
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.7)',
        color: '#f8fafc',
        position: 'relative',
        overflow: 'hidden',
        opacity: enterP,
        transform: `translateY(${mix(20, 0, enterP)}px)`,
        ...style,
      }}
    >
      {/* Background Circuit Grid Lines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 80% 50%, rgba(34, 211, 238, 0.08) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      {/* Header Item & Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div>
          <div
            style={{ fontSize: 11, fontWeight: 800, color: '#22d3ee', textTransform: 'uppercase' }}
          >
            <Rich text="[c:مدیریت هوشمند چندانباره]" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#f8fafc', marginTop: 2 }}>
            <Rich text={`کالا: [w:${itemTitle}]`} />
          </div>
        </div>

        {/* Transfer Status Pill */}
        <div
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            background: isArrived
              ? 'rgba(16, 185, 129, 0.15)'
              : isTransferring
                ? 'rgba(245, 158, 11, 0.15)'
                : 'rgba(255, 255, 255, 0.06)',
            border: `1px solid ${
              isArrived
                ? 'rgba(16, 185, 129, 0.4)'
                : isTransferring
                  ? 'rgba(245, 158, 11, 0.4)'
                  : 'rgba(255, 255, 255, 0.08)'
            }`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 800,
            color: isArrived ? '#34d399' : isTransferring ? '#fbbf24' : '#94a3b8',
          }}
        >
          {isArrived && (
            <>
              <Icon name="check" size={14} color="#34d399" />
              <span>
                <Rich text="تأیید وصول شد ✓" />
              </span>
            </>
          )}
          {isTransferring && (
            <>
              <Icon name="truck" size={14} color="#fbbf24" />
              <span>
                <Rich text="در حال ترانزیت..." />
              </span>
            </>
          )}
          {!isTransferring && !isArrived && (
            <>
              <Icon name="boxes" size={14} color="#94a3b8" />
              <span>آماده حواله</span>
            </>
          )}
        </div>
      </div>

      {/* Procedural Node Map (Interactive Canvas) */}
      <div
        style={{
          position: 'relative',
          height: 240,
          background: 'rgba(14, 18, 27, 0.7)',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* SVG Connecting Tracks */}
        <svg
          viewBox="0 0 380 240"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
          }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="track-flow" x1="100%" y1="50%" x2="0%" y2="50%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>

          {/* Track 1: Central (right) -> Shop Front (top left) */}
          <path
            d="M 275 120 C 190 120, 190 52, 95 52"
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="3"
          />
          <path
            d="M 275 120 C 190 120, 190 52, 95 52"
            fill="none"
            stroke="url(#track-flow)"
            strokeWidth="3"
            strokeDasharray="6 6"
            strokeDashoffset={-t * 24}
            opacity={isTransferring ? 1 : 0.25}
          />

          {/* Track 2: Central (right) -> Branch (bottom left) */}
          <path
            d="M 275 120 C 190 120, 190 188, 95 188"
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="3"
          />
          <path
            d="M 275 120 C 190 120, 190 188, 95 188"
            fill="none"
            stroke="url(#track-flow)"
            strokeWidth="3"
            strokeDasharray="6 6"
            strokeDashoffset={-t * 24}
            opacity={isTransferring ? 1 : 0.25}
          />

          {/* Traveling Freight Capsules */}
          {isTransferring && (
            <>
              {/* Capsule 1 to Shop */}
              <g transform={`translate(${mix(275, 95, transferP)}, ${mix(120, 52, transferP)})`}>
                <circle r="12" fill="#10141D" stroke="#22d3ee" strokeWidth="2" />
                <circle r="4" fill="#22d3ee" />
              </g>

              {/* Capsule 2 to Branch */}
              <g transform={`translate(${mix(275, 95, transferP)}, ${mix(120, 188, transferP)})`}>
                <circle r="12" fill="#10141D" stroke="#34d399" strokeWidth="2" />
                <circle r="4" fill="#34d399" />
              </g>
            </>
          )}
        </svg>

        {/* Central Warehouse Node (Right side, Persian source) */}
        <div
          style={{
            position: 'absolute',
            right: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 110,
            background: 'rgba(22, 27, 38, 0.95)',
            border: '1px solid rgba(34, 211, 238, 0.4)',
            boxShadow: '0 0 20px rgba(34, 211, 238, 0.15)',
            borderRadius: 14,
            padding: '10px 8px',
            textAlign: 'center',
            zIndex: 3,
          }}
        >
          <div
            style={{ color: '#22d3ee', display: 'flex', justifyContent: 'center', marginBottom: 2 }}
          >
            <Icon name="boxes" size={18} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#f1f5f9' }}>انبار مرکزی</div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 900,
              color: '#22d3ee',
              marginTop: 2,
              direction: 'ltr',
            }}
          >
            {faNumber(centralStock)}
          </div>
          {isTransferring && (
            <div style={{ fontSize: 9, color: '#fb7185', fontWeight: 800 }}>
              -{faNumber(transferQuantity)} حواله
            </div>
          )}
        </div>

        {/* Destination 1: Shop Front (Top Left) - firmly at top: 12px */}
        <div
          style={{
            position: 'absolute',
            left: 14,
            top: 12,
            width: 105,
            background: 'rgba(22, 27, 38, 0.95)',
            border: `1px solid ${isArrived ? 'rgba(52, 211, 153, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: 14,
            padding: '7px 6px',
            textAlign: 'center',
            zIndex: 3,
            transform: isArrived ? `scale(${mix(0.96, 1, arriveSpring)})` : 'scale(0.96)',
          }}
        >
          <div
            style={{
              color: isArrived ? '#34d399' : '#94a3b8',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Icon name="store" size={15} />
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#f1f5f9' }}>ویترین فروشگاه</div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 900,
              color: isArrived ? '#34d399' : '#f8fafc',
              direction: 'ltr',
            }}
          >
            {faNumber(shopStock)}
          </div>
          {isArrived && (
            <div style={{ fontSize: 9, color: '#34d399', fontWeight: 800 }}>
              +{faNumber(shopTransfer)} وصول
            </div>
          )}
        </div>

        {/* Destination 2: Branch (Bottom Left) - firmly at bottom: 12px */}
        <div
          style={{
            position: 'absolute',
            left: 14,
            bottom: 12,
            width: 105,
            background: 'rgba(22, 27, 38, 0.95)',
            border: `1px solid ${isArrived ? 'rgba(52, 211, 153, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: 14,
            padding: '7px 6px',
            textAlign: 'center',
            zIndex: 3,
            transform: isArrived ? `scale(${mix(0.96, 1, arriveSpring)})` : 'scale(0.96)',
          }}
        >
          <div
            style={{
              color: isArrived ? '#34d399' : '#94a3b8',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Icon name="truck" size={15} />
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#f1f5f9' }}>شعبه منطقه</div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 900,
              color: isArrived ? '#34d399' : '#f8fafc',
              direction: 'ltr',
            }}
          >
            {faNumber(branchStock)}
          </div>
          {isArrived && (
            <div style={{ fontSize: 9, color: '#34d399', fontWeight: 800 }}>
              +{faNumber(branchTransfer)} وصول
            </div>
          )}
        </div>
      </div>

      {/* Footer Audit Assurance */}
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          color: '#64748b',
        }}
      >
        <span>
          <Rich text="[c:کاردکس آنلاین:] صفر خطای انتقال کالا بین شعب" />
        </span>
        <span style={{ color: '#94a3b8', fontWeight: 700 }}>سند حواله اتوماتیک</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DualPerspectiveWorkflow
// ─────────────────────────────────────────────────────────────────────────────

export interface DualPerspectiveWorkflowProps {
  t: number
  startAt?: number
  click1At?: number
  click2At?: number
  journalPostAt?: number
  saleAmount?: number
  costAmount?: number
  className?: string
  style?: CSSProperties
}

export function DualPerspectiveWorkflow({
  t,
  startAt = 0.2,
  click1At = 1.0,
  click2At = 2.0,
  journalPostAt = 2.8,
  saleAmount = 24500,
  costAmount = 16200,
  className = '',
  style,
}: DualPerspectiveWorkflowProps) {
  const enterP = ease(progress(t, startAt, 0.5))
  const step1Active = t >= click1At
  const step2Active = t >= click2At
  const journalActive = t >= journalPostAt

  const bridgeBeamP = ease(progress(t, click2At, 0.8))
  const journalSpring = spring(Math.max(0, t - journalPostAt))

  return (
    <div
      className={`customer-primitive-card dual-perspective-container ${className}`}
      style={{
        background: '#0A0C10',
        borderRadius: 22,
        padding: 22,
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.7)',
        color: '#f8fafc',
        position: 'relative',
        overflow: 'hidden',
        opacity: enterP,
        transform: `translateY(${mix(20, 0, enterP)}px)`,
        ...style,
      }}
    >
      {/* Header Tag */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 999,
            background: 'rgba(34, 211, 238, 0.1)',
            border: '1px solid rgba(34, 211, 238, 0.3)',
            fontSize: 11,
            fontWeight: 800,
            color: '#22d3ee',
            marginBottom: 6,
          }}
        >
          <Rich text="هم‌زمانی هوشمند · [w:۲ کلیک در دخل] = [g:سند ۴ سطری حسابداری]" />
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#f8fafc' }}>
          <Rich text="سادگی برای فروشنده · [p:دقت استاندارد برای حسابدار]" />
        </div>
      </div>

      {/* Split Comparison Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
          position: 'relative',
        }}
      >
        {/* Dynamic Beam between Columns */}
        {step2Active && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: '#22d3ee',
              boxShadow: '0 0 20px #22d3ee',
              opacity: bridgeBeamP,
              zIndex: 10,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Column Left: دیدگاه فروشنده (صندوقدار) */}
        <div
          style={{
            background: 'linear-gradient(180deg, #10141D 0%, #141A24 100%)',
            borderRadius: 16,
            padding: 14,
            border: `1px solid ${step2Active ? 'rgba(34, 211, 238, 0.4)' : 'rgba(255, 255, 255, 0.06)'}`,
            boxShadow: step2Active ? '0 0 20px rgba(34, 211, 238, 0.15)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#22d3ee' }}>
            <Icon name="user" size={16} />
            <span style={{ fontSize: 12, fontWeight: 800 }}>دیدگاه فروشنده (ساده)</span>
          </div>

          {/* Step 1: انتخاب کالا */}
          <div
            style={{
              background: step1Active ? 'rgba(34, 211, 238, 0.12)' : 'rgba(22, 27, 38, 0.6)',
              border: `1px solid ${step1Active ? 'rgba(34, 211, 238, 0.4)' : 'rgba(255, 255, 255, 0.04)'}`,
              borderRadius: 10,
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="barcode" size={14} color={step1Active ? '#22d3ee' : '#94a3b8'} />
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc' }}>
                <Rich text="۱. انتخاب کالا" />
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#34d399', fontWeight: 800 }}>
              {step1Active ? '✓ انتخاب شد' : 'اسکن بارکد'}
            </div>
          </div>

          {/* Step 2: ثبت فاکتور */}
          <div
            style={{
              background: step2Active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(22, 27, 38, 0.6)',
              border: `1px solid ${step2Active ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.04)'}`,
              borderRadius: 10,
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="receipt" size={14} color={step2Active ? '#34d399' : '#94a3b8'} />
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc' }}>
                <Rich text="۲. چاپ فاکتور" />
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#34d399', fontWeight: 800 }}>
              {step2Active ? '✓ صادر شد' : 'دکمه ثبت'}
            </div>
          </div>

          {/* Seller Feedback */}
          <div
            style={{
              marginTop: 'auto',
              padding: '6px 8px',
              borderRadius: 8,
              background: 'rgba(10, 12, 16, 0.6)',
              fontSize: 10,
              color: '#94a3b8',
              lineHeight: 1.4,
            }}
          >
            <Rich text="[w:فروشنده:] «من فقط فاکتور زدم و پول رو گرفتم!»" />
          </div>
        </div>

        {/* Column Right: دیدگاه حسابدار (دفتر کل دوبل) */}
        <div
          style={{
            background: 'linear-gradient(180deg, #121020 0%, #161426 100%)',
            borderRadius: 16,
            padding: 14,
            border: `1px solid ${journalActive ? 'rgba(192, 132, 252, 0.4)' : 'rgba(255, 255, 255, 0.06)'}`,
            boxShadow: journalActive ? '0 0 20px rgba(192, 132, 252, 0.15)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            transform: journalActive ? `scale(${mix(0.96, 1, journalSpring)})` : 'scale(0.96)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c084fc' }}>
            <Icon name="scale" size={16} />
            <span style={{ fontSize: 12, fontWeight: 800 }}>دیدگاه حسابدار (دوبل)</span>
          </div>

          {/* Auto-Journal 4 Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Row 1: بدهکار صندوق */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                padding: '4px 6px',
                borderRadius: 6,
                background: journalActive
                  ? 'rgba(34, 211, 238, 0.08)'
                  : 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <span style={{ color: '#e2e8f0' }}>بدهکار: صندوق دخل</span>
              <span style={{ color: '#22d3ee', fontWeight: 700, direction: 'ltr' }}>
                +{faNumber(saleAmount)}
              </span>
            </div>

            {/* Row 2: بستانکار درآمد فروش */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                padding: '4px 6px',
                borderRadius: 6,
                background: journalActive
                  ? 'rgba(16, 185, 129, 0.08)'
                  : 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <span style={{ color: '#e2e8f0' }}>بستانکار: درآمد فروش</span>
              <span style={{ color: '#34d399', fontWeight: 700, direction: 'ltr' }}>
                +{faNumber(saleAmount)}
              </span>
            </div>

            {/* Row 3: بدهکار بهای تمام شده */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                padding: '4px 6px',
                borderRadius: 6,
                background: journalActive
                  ? 'rgba(251, 113, 133, 0.08)'
                  : 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <span style={{ color: '#e2e8f0' }}>بدهکار: بهای تمام‌شده</span>
              <span style={{ color: '#fb7185', fontWeight: 700, direction: 'ltr' }}>
                +{faNumber(costAmount)}
              </span>
            </div>

            {/* Row 4: بستانکار موجودی کالا */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                padding: '4px 6px',
                borderRadius: 6,
                background: journalActive
                  ? 'rgba(245, 158, 11, 0.08)'
                  : 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <span style={{ color: '#e2e8f0' }}>بستانکار: موجودی کالا</span>
              <span style={{ color: '#fbbf24', fontWeight: 700, direction: 'ltr' }}>
                -{faNumber(costAmount)}
              </span>
            </div>
          </div>

          {/* Accountant Balance Pill */}
          <div
            style={{
              marginTop: 'auto',
              padding: '5px 8px',
              borderRadius: 8,
              background: journalActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${journalActive ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.06)'}`,
              fontSize: 10,
              fontWeight: 800,
              color: journalActive ? '#34d399' : '#94a3b8',
              textAlign: 'center',
            }}
          >
            {journalActive ? 'سند تراز شد (بدون ورود دستی) ✓' : 'در انتظار فاکتور'}
          </div>
        </div>
      </div>
    </div>
  )
}
