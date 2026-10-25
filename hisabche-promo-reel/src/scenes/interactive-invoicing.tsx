// src/scenes/interactive-invoicing.tsx
// =============================================================================
// Reel 101 — «فاکتور جادویی و انبار زنده» (Interactive Invoicing & Auto-Stock Sync)
// Dedicated Scene System for Reel 101
// Theme: Obsidian Dark + Emerald Border #10b981 + Interactive Spreadsheet-Style UI
// Features: Full-Body 3D Female VRM Presenter with Contrapposto, Hip Sway & Lip Sync.
//
// 100% Full-Canvas 540x960 Composition. Zero Empty Bottoms. Zero Stepped Typography.
// =============================================================================

import React from 'react'
import type { Scene } from '../engine/types'
import { clamp, mix, progress } from '../engine/anim'
import { VrmAvatar } from '../avatars/vrm-avatar'
import { cardFx, stagePunch, stageShake } from './card-motion'
import {
  ACTS_CTA_101,
  ACTS_INTERACTIVE_INVOICE,
  ACTS_INVENTORY_SYNC,
  ACTS_LOST_DEAL_CHAOS,
  ACTS_SPREADSHEET_ERROR,
} from './tech-explainer-acts'
import { faNumber } from '../ui/motion-primitives'

const BG_OBSIDIAN = '#07090e'
const TEXT_MUTED = '#94a3b8'
const ACCENT_EMERALD = '#10b981'
const ACCENT_CYAN = '#38bdf8'
const ACCENT_RED = '#ef4444'
const ACCENT_AMBER = '#f59e0b'

/** Sleek Topbar for Reel 101 */
function InvoicingTopbar({
  tag = 'سیستم صدور فاکتور آنلاین',
  badge = '۱۰ ثانیه تا ارسال',
  badgeColor = ACCENT_EMERALD,
}: {
  tag?: string
  badge?: string
  badgeColor?: string
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 36,
        left: 28,
        right: 28,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 40,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: badgeColor,
            boxShadow: `0 0 10px ${badgeColor}`,
          }}
        />
        <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 800, color: '#e2e8f0' }}>
          {tag}
        </span>
      </div>
      <div
        style={{
          padding: '4px 12px',
          borderRadius: 20,
          background: `${badgeColor}18`,
          border: `1px solid ${badgeColor}66`,
          color: badgeColor,
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        ● {badge}
      </div>
    </div>
  )
}

/** Stage container for Reel 101 */
export function InvoiceStage({
  scene,
  t,
  cameraX = 0,
  cameraY = 0,
  shakes,
  punches,
  children,
}: {
  scene: Scene
  t: number
  cameraX?: number
  cameraY?: number
  shakes?: readonly number[]
  punches?: readonly number[]
  children: React.ReactNode
}) {
  void scene
  const shake = stageShake(t, shakes)
  const punch = stagePunch(t, punches)

  return (
    <div
      style={{
        position: 'relative',
        width: 540,
        height: 960,
        direction: 'ltr',
        background: BG_OBSIDIAN,
        overflow: 'hidden',
        color: '#ffffff',
        fontFamily: 'Vazirmatn, sans-serif',
        transform: `translate(${(-cameraX + shake.x).toFixed(1)}px, ${(-cameraY + shake.y).toFixed(1)}px) scale(${punch.toFixed(3)})`,
        transformOrigin: 'center center',
      }}
    >
      {/* Background Lighting Gradients (Emerald & Cyan) */}
      <div
        style={{
          position: 'absolute',
          inset: -40,
          backgroundImage:
            'radial-gradient(circle at 50% 16%, rgba(16, 185, 129, 0.16), transparent 60%), radial-gradient(circle at 80% 80%, rgba(56, 189, 248, 0.1), transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: -40,
          opacity: 0.05,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }}
      />

      {children}

      {/* Global Minimalist Tech Footer Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 24,
          right: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 9.5,
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.4)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: 8,
          zIndex: 50,
        }}
      >
        <span>HISABCHE.INVOICE // SMART_COMMERCE</span>
        <span>LIVE STOCK & LEDGER</span>
        <span>V4.2</span>
      </div>
    </div>
  )
}

/**
 * Scene 1 (0.00–7.20s): پریدن مشتری در زمان انتظار برای پیش‌فاکتور
 */
export function InvoiceLostDealScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.5))
  const stampAt = 3.5
  const hasStamped = t >= stampAt

  const timerRatio = clamp(progress(t, 1.4, 3.5))
  const elapsedMinutes = Math.floor(mix(5, 32, timerRatio))
  const tempRatio = 1 - clamp(progress(t, 1.4, 3.5))

  return (
    <InvoiceStage scene={scene} t={t} shakes={[3.5]} punches={[0.1, 3.5]}>
      <InvoicingTopbar
        tag="INVOICE DELAY WARNING"
        badge="مشتری در انتظار"
        badgeColor={ACCENT_RED}
      />

      {/* Bold Top Headline */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 80,
          left: 24,
          right: 24,
          textAlign: 'center',
          opacity: enter,
          zIndex: 35,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1.3 }}>
          پریدن مشتری در صف <span style={{ color: ACCENT_RED }}>انتظار پیش‌فاکتور!</span>
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: TEXT_MUTED,
            marginTop: 8,
            marginInline: 'auto',
            maxWidth: 440,
          }}
        >
          نیم ساعت تاخیر در صدور پیش‌فاکتور = دو دستی تقدیم مشتری آماده به رقیب
        </p>
      </div>

      {/* Center Hero: Burning Lead Card (y=175 to y=520) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 175,
          left: 45,
          right: 45,
          padding: '22px 24px',
          borderRadius: 22,
          background: hasStamped
            ? 'linear-gradient(145deg, rgba(20, 20, 24, 0.98), rgba(12, 12, 14, 0.98))'
            : 'linear-gradient(145deg, rgba(17, 24, 39, 0.96), rgba(11, 15, 25, 0.98))',
          border: hasStamped
            ? '2px solid rgba(239, 68, 68, 0.8)'
            : '1.5px solid rgba(255, 255, 255, 0.12)',
          boxShadow: hasStamped
            ? '0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(239, 68, 68, 0.35)'
            : '0 25px 60px rgba(0,0,0,0.7)',
          transform: hasStamped ? 'rotate(-1deg) scale(0.98)' : 'none',
          transition: 'transform 0.2s ease',
          zIndex: 20,
          ...cardFx(t, { at: 0.1, enter: 'drop', float: 2 }),
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>👤</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
                مشتری جدید: سفارش عمده
              </div>
              <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>شرکت بازرگانی پارس</div>
            </div>
          </div>
          <div
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              fontSize: 11,
              fontWeight: 800,
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            ⏳ منتظر پیش‌فاکتور
          </div>
        </div>

        <div
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            marginBottom: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>
              📦 ۵۰ عدد کالای تجاری کد ۱۰۱
            </div>
            <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
              مبلغ تقریبی معامله: ۴۵,۰۰۰,۰۰۰ تومان
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20 }}>{tempRatio > 0.4 ? '🔥' : '❄️'}</div>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: tempRatio > 0.4 ? '#f59e0b' : '#38bdf8',
              }}
            >
              {tempRatio > 0.4 ? 'داغ و آماده' : 'منصرف شد'}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              fontWeight: 800,
              marginBottom: 6,
            }}
          >
            <span style={{ color: '#ef4444' }}>⏱️ زمان انتظار مشتری:</span>
            <span style={{ color: '#f87171', fontFamily: 'monospace' }}>
              {faNumber(elapsedMinutes)}:۰۰ دقیقه گذشت!
            </span>
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 5,
              background: 'rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.round(timerRatio * 100)}%`,
                background:
                  timerRatio < 0.4
                    ? '#10b981'
                    : timerRatio < 0.75
                      ? '#f59e0b'
                      : 'linear-gradient(90deg, #f59e0b, #ef4444)',
                boxShadow: timerRatio > 0.5 ? '0 0 12px rgba(239, 68, 68, 0.6)' : 'none',
              }}
            />
          </div>
        </div>

        {hasStamped && (
          <div
            style={{
              position: 'absolute',
              top: '32%',
              left: '12%',
              right: '12%',
              padding: '14px 16px',
              borderRadius: 14,
              background: 'rgba(220, 38, 38, 0.95)',
              border: '3px dashed #ffffff',
              boxShadow: '0 0 40px rgba(239, 68, 68, 0.8)',
              transform: 'rotate(-7deg) scale(1.05)',
              textAlign: 'center',
              zIndex: 50,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900, color: '#ffffff' }}>❌ خرید از رقیب!</div>
            <div style={{ fontSize: 11, color: '#fee2e2', marginTop: 3 }}>
              ۴۵,۰۰۰,۰۰۰ تومان سود پرید!
            </div>
          </div>
        )}
      </div>

      {/* Bottom Active Zone: Lost Opportunity Metrics & 3D Presenter (y=545 to y=890) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 545,
          left: 45,
          right: 45,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 30,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: '14px 10px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 10.5, color: TEXT_MUTED }}>سود سوخت‌شده</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: ACCENT_RED, marginTop: 4 }}>
              -۴۵ میلیون
            </div>
          </div>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: '14px 10px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 10.5, color: TEXT_MUTED }}>تاخیر در صدور</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: ACCENT_AMBER, marginTop: 4 }}>
              ۳۲ دقیقه
            </div>
          </div>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: '14px 10px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 10.5, color: TEXT_MUTED }}>نتیجه معامله</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#f8fafc', marginTop: 4 }}>
              واگذاری به رقیب
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.65)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 14,
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: '#fecdd3', fontWeight: 800 }}>
            ⚠️ هشدار فروش: هر ۱۰ دقیقه تاخیر در پیش‌فاکتور = ریزش ۳۵٪ مشتریان داغ
          </span>
          <span
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 4,
              background: ACCENT_RED,
              color: '#fff',
              fontWeight: 900,
            }}
          >
            CRITICAL
          </span>
        </div>
      </div>

      {/* Full-Body 3D Female VRM Presenter with Contrapposto Allure */}
      <VrmAvatar
        t={t}
        crop="full"
        x={180}
        y={560}
        width={180}
        height={380}
        acts={ACTS_LOST_DEAL_CHAOS}
      />
    </InvoiceStage>
  )
}

/**
 * Scene 2 (7.20–14.40s): خطای فرمول‌های اکسل و فروختن جنس ناموجود در انبار
 */
export function InvoiceSpreadsheetErrorScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.5))
  const alertAt = 2.1
  const showAlert = t >= alertAt
  const glitch = showAlert ? ((Math.sin(t * 28) + 1) / 2) * 4 - 2 : 0

  return (
    <InvoiceStage scene={scene} t={t} shakes={[2.1]} punches={[0.3, 2.1]}>
      <InvoicingTopbar
        tag="EXCEL SPREADSHEET DISASTER"
        badge="خطای فرمول و انبار"
        badgeColor={ACCENT_RED}
      />

      {/* Bold Top Headline */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 80,
          left: 24,
          right: 24,
          textAlign: 'center',
          opacity: enter,
          zIndex: 35,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1.3 }}>
          فاجعه فرمول‌های اکسل و <span style={{ color: ACCENT_RED }}>کسری پنهان انبار</span>
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: TEXT_MUTED,
            marginTop: 8,
            marginInline: 'auto',
            maxWidth: 440,
          }}
        >
          خطای محاسباتی در شلوغی و فروختن جنسی که اصلاً در انبار موجود نیست!
        </p>
      </div>

      {/* Center Hero: Cluttered Excel Spreadsheet UI (y=175 to y=520) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 175,
          left: 45,
          right: 45,
          borderRadius: 20,
          background: 'rgba(15, 23, 42, 0.96)',
          border: showAlert
            ? '2px solid rgba(239, 68, 68, 0.85)'
            : '1.5px solid rgba(255, 255, 255, 0.1)',
          boxShadow: showAlert
            ? '0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(239, 68, 68, 0.3)'
            : '0 25px 60px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          transform: `translateX(${glitch.toFixed(1)}px)`,
          zIndex: 20,
          ...cardFx(t, { at: 0.3, enter: 'drop', float: 2 }),
        }}
      >
        <div
          style={{
            height: 34,
            padding: '0 14px',
            background: '#107c41',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            fontWeight: 800,
            color: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📊</span>
            <span>Factor_Final_2026_Edit4.xlsx</span>
          </div>
          <span style={{ fontSize: 10, opacity: 0.85 }}>اکسل دستی سنتی</span>
        </div>

        <div style={{ padding: '12px 14px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr',
              gap: 6,
              padding: '8px 10px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 800,
              color: TEXT_MUTED,
              marginBottom: 8,
            }}
          >
            <span>شرح کالا</span>
            <span style={{ textAlign: 'center' }}>تعداد</span>
            <span style={{ textAlign: 'center' }}>قیمت</span>
            <span style={{ textAlign: 'center' }}>جمع کل</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr',
              gap: 6,
              padding: '8px 10px',
              background: showAlert ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.02)',
              border: showAlert ? '1px solid #ef4444' : '1px solid transparent',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            <span style={{ color: '#f1f5f9' }}>کالای تجاری ۱۰۱</span>
            <span style={{ textAlign: 'center', color: '#f59e0b' }}>۵ عدد</span>
            <span style={{ textAlign: 'center', color: TEXT_MUTED }}>۸,۵۰۰,۰۰۰</span>
            <span style={{ textAlign: 'center', color: '#38bdf8' }}>۴۲,۵۰۰,۰۰۰</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1.2fr 1.2fr',
              gap: 6,
              padding: '8px 10px',
              background: 'rgba(239, 68, 68, 0.12)',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 800,
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#cbd5e1' }}>تخفیف و جمع نهایی:</span>
            <span style={{ textAlign: 'center', color: TEXT_MUTED }}>—</span>
            <span style={{ textAlign: 'center', color: TEXT_MUTED }}>خطا</span>
            <span
              style={{
                textAlign: 'center',
                padding: '3px 6px',
                borderRadius: 4,
                background: '#dc2626',
                color: '#ffffff',
                fontFamily: 'monospace',
                fontSize: 12,
                boxShadow: '0 0 10px rgba(220, 38, 38, 0.8)',
              }}
            >
              #VALUE!
            </span>
          </div>
        </div>

        {showAlert && (
          <div
            style={{
              margin: '8px 14px 14px',
              padding: '12px 16px',
              borderRadius: 12,
              background:
                'linear-gradient(90deg, rgba(220, 38, 38, 0.95), rgba(185, 28, 28, 0.95))',
              border: '1.5px solid #fecaca',
              boxShadow: '0 8px 24px rgba(220, 38, 38, 0.6)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 24 }}>🚨</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>
                هشدار بحرانی: موجودی واقعی ۰ عدد!
              </div>
              <div style={{ fontSize: 11, color: '#fee2e2', marginTop: 2 }}>
                شما ۵ عدد فروختید اما کالا در انبار نیست! پول هم واریز شده!
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Active Zone: Discrepancy Diagnostics (y=545 to y=890) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 545,
          left: 45,
          right: 45,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 30,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 16,
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>موجودی در نرم‌افزار</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: ACCENT_AMBER, marginTop: 4 }}>
              ۵ عدد در اکسل
            </div>
            <div style={{ fontSize: 10, color: '#fcd34d', marginTop: 2 }}>ثبت کاذب و فرضی</div>
          </div>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 16,
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>موجودی واقعی قفسه</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: ACCENT_RED, marginTop: 4 }}>
              ۰ عدد (عدم موجودی)
            </div>
            <div style={{ fontSize: 10, color: '#fca5a5', marginTop: 2 }}>آبروریزی نزد خریدار</div>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.65)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 14,
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: '#fecdd3', fontWeight: 800 }}>
            ⚠️ خطای اکسل سنتی: ناهماهنگی بین انبار فیزیکی و فاکتور فروش
          </span>
          <span
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 4,
              background: ACCENT_RED,
              color: '#fff',
              fontWeight: 900,
            }}
          >
            DESYNC
          </span>
        </div>
      </div>

      <VrmAvatar
        t={t}
        crop="full"
        x={180}
        y={560}
        width={180}
        height={380}
        acts={ACTS_SPREADSHEET_ERROR}
      />
    </InvoiceStage>
  )
}

/**
 * Scene 3 (14.40–25.20s): رابط کاربری مدرن و جدول فاکتور تعاملی حسابچه
 */
export function InvoiceInteractiveGridScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.2, 0.6))
  const selected = t >= 1.9
  const stockSynced = t >= 4.8
  const linkSent = t >= 8.5

  const calcProgress = clamp(progress(t, 1.9, 3.2))
  const totalPrice = Math.round(mix(0, 42075000, calcProgress))

  return (
    <InvoiceStage scene={scene} t={t} punches={[1.9, 4.8, 8.5]}>
      <InvoicingTopbar
        tag="HISABCHE SMART INVOICE"
        badge="صدور در ۱۰ ثانیه"
        badgeColor={ACCENT_EMERALD}
      />

      {/* Bold Top Headline */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 80,
          left: 24,
          right: 24,
          textAlign: 'center',
          opacity: enter,
          zIndex: 35,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1.3 }}>
          صدور پیش‌فاکتور در <span style={{ color: ACCENT_EMERALD }}>کمتر از ۱۰ ثانیه!</span>
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: TEXT_MUTED,
            marginTop: 8,
            marginInline: 'auto',
            maxWidth: 440,
          }}
        >
          کالا را انتخاب کن؛ قیمت، تخفیف و مالیات خودکار حساب و لینک به خریدار ارسال می‌شود
        </p>
      </div>

      {/* Center Hero: Interactive Hisabche Invoice UI (y=175 to y=520) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 175,
          left: 45,
          right: 45,
          borderRadius: 22,
          background: 'linear-gradient(145deg, rgba(16, 24, 40, 0.98), rgba(9, 14, 26, 0.98))',
          border: '1.5px solid rgba(16, 185, 129, 0.6)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(16, 185, 129, 0.25)',
          padding: '18px 20px',
          zIndex: 20,
          ...cardFx(t, { at: 0.2, enter: 'rise', float: 1.5 }),
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>
              پیش‌فاکتور هوشمند شماره ۱۰۴۲
            </span>
          </div>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 6,
              background: '#059669',
              color: '#fff',
              fontSize: 10.5,
              fontWeight: 800,
            }}
          >
            آنلاین و متصل به انبار
          </span>
        </div>

        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: selected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            border: selected ? '1.5px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            transition: 'all 0.3s ease',
          }}
        >
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#f1f5f9' }}>
              {selected ? '✅ کالای تجاری کد ۱۰۱ (انتخاب شد)' : '🔍 در حال جستجوی کالا...'}
            </div>
            <div style={{ fontSize: 10.5, color: TEXT_MUTED, marginTop: 2 }}>
              {selected ? 'قیمت پایه: ۸,۵۰۰,۰۰۰ • ۵ عدد' : 'کد کالا یا بارکد را وارد کنید'}
            </div>
          </div>
          {stockSynced && (
            <div
              style={{
                padding: '3px 8px',
                borderRadius: 6,
                background: '#10b981',
                color: '#000',
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              موجودی زنده: ۴۲ عدد
            </div>
          )}
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 10.5, color: TEXT_MUTED }}>مبلغ نهایی با تخفیف ۵٪:</div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: ACCENT_EMERALD,
                fontFamily: 'monospace',
                marginTop: 2,
              }}
            >
              {faNumber(totalPrice)} تومان
            </div>
          </div>
          {linkSent && (
            <div
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                background: '#0284c7',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 800,
                boxShadow: '0 0 15px rgba(2, 132, 199, 0.6)',
              }}
            >
              📲 پیامک به مشتری رفت!
            </div>
          )}
        </div>
      </div>

      {/* Bottom Active Zone: Auto-Invoice Stats (y=545 to y=890) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 545,
          left: 45,
          right: 45,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 30,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: 16,
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>سرعت آماده‌سازی فاکتور</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: ACCENT_EMERALD, marginTop: 4 }}>
              ۱۰ <span style={{ fontSize: 14 }}>ثانیه</span>
            </div>
            <div style={{ fontSize: 10, color: '#86efac', marginTop: 2 }}>
              محاسبه آنی تخفیف و مالیات
            </div>
          </div>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: 16,
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>روش پرداخت خریدار</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: ACCENT_CYAN, marginTop: 4 }}>
              درگاه آنلاین
            </div>
            <div style={{ fontSize: 10, color: '#a5f3fc', marginTop: 2 }}>
              لینک مستقیم روی موبایل
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.65)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 14,
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: '#f8fafc', fontWeight: 800 }}>
            ⚡ اتصال مستقیم پیش‌فاکتور به انبارداری و ثبت سند خودکار دریافت
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT_EMERALD }}>AUTO_SYNC</span>
        </div>
      </div>

      <VrmAvatar
        t={t}
        crop="full"
        x={180}
        y={560}
        width={180}
        height={380}
        acts={ACTS_INTERACTIVE_INVOICE}
      />
    </InvoiceStage>
  )
}

/**
 * Scene 4 (25.20–34.60s): اتوماسیون پشت‌صحنه: کسر آنی از انبار و آپدیت تراز مالی
 */
export function InvoiceInventorySyncScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.5))
  const isDeducted = t >= 2.8
  const stockCount = Math.round(mix(42, 37, clamp(progress(t, 2.0, 3.2))))

  return (
    <InvoiceStage scene={scene} t={t} punches={[0.4, 2.8, 6.5]}>
      <InvoicingTopbar
        tag="INSTANT STOCK DEDUCTION"
        badge="انبارداری هوشمند"
        badgeColor={ACCENT_EMERALD}
      />

      {/* Bold Top Headline */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 80,
          left: 24,
          right: 24,
          textAlign: 'center',
          opacity: enter,
          zIndex: 35,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1.3 }}>
          کسر خودکار موجودی انبار و <span style={{ color: ACCENT_EMERALD }}>ثبت آنی کاردکس</span>
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: TEXT_MUTED,
            marginTop: 8,
            marginInline: 'auto',
            maxWidth: 440,
          }}
        >
          به محض تایید فاکتور، ۵ عدد از انبار کسر، سود خالص محاسبه و موعد بدهی ثبت می‌شود
        </p>
      </div>

      {/* Center Hero: Pipeline Sync Card (y=175 to y=520) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 175,
          left: 45,
          right: 45,
          borderRadius: 22,
          background: 'linear-gradient(145deg, rgba(16, 24, 40, 0.98), rgba(9, 14, 26, 0.98))',
          border: '1.5px solid rgba(56, 189, 248, 0.5)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(56, 189, 248, 0.25)',
          padding: '20px 22px',
          zIndex: 20,
          ...cardFx(t, { at: 0.4, enter: 'rise', float: 1.5 }),
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>
            📦 وضعیت کاردکس انبار مرکزی
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: isDeducted ? ACCENT_EMERALD : ACCENT_AMBER,
            }}
          >
            {isDeducted ? 'کسر ۵ عدد قطعی شد ✅' : 'در انتظار تایید'}
          </span>
        </div>

        <div
          style={{
            padding: '14px 16px',
            borderRadius: 14,
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>
              کالای تجاری کد ۱۰۱
            </div>
            <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
              خروج از انبار مرکزی • حواله ۱۰۴۲
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10.5, color: TEXT_MUTED }}>موجودی جدید:</div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                color: isDeducted ? ACCENT_EMERALD : '#ffffff',
                fontFamily: 'monospace',
              }}
            >
              {faNumber(stockCount)} عدد
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <div style={{ fontSize: 10.5, color: TEXT_MUTED }}>سود خالص معامله:</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: ACCENT_EMERALD, marginTop: 2 }}>
              +۷,۵۰۰,۰۰۰ تومان
            </div>
          </div>
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            <div style={{ fontSize: 10.5, color: TEXT_MUTED }}>ثبت در دفتر بدهکاران:</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: ACCENT_CYAN, marginTop: 2 }}>
              سررسید ۱۵ روزه
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Active Zone: Kardex Ledger Details (y=545 to y=890) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 545,
          left: 45,
          right: 45,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          zIndex: 30,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: 16,
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>دقت هماهنگی انبار</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: ACCENT_EMERALD, marginTop: 4 }}>
              ۱۰۰٪ بلادرنگ
            </div>
            <div style={{ fontSize: 10, color: '#86efac', marginTop: 2 }}>
              بدون نیاز به انبارگردانی دستی
            </div>
          </div>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: 16,
              padding: '16px 18px',
            }}
          >
            <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>سند دوبل مالی</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: ACCENT_CYAN, marginTop: 4 }}>
              خودکار صادر شد
            </div>
            <div style={{ fontSize: 10, color: '#a5f3fc', marginTop: 2 }}>
              پایان روزانه دفتر حساب
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.65)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 14,
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: '#f8fafc', fontWeight: 800 }}>
            🛡️ کاردکس زنده: ثبت دقیق تاریخ، ساعت و مشخصات فرد صادرکننده حواله
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT_EMERALD }}>
            AUDIT_VERIFIED
          </span>
        </div>
      </div>

      <VrmAvatar
        t={t}
        crop="full"
        x={180}
        y={560}
        width={180}
        height={380}
        acts={ACTS_INVENTORY_SYNC}
      />
    </InvoiceStage>
  )
}

/**
 * Scene 5 (34.60–41.20s): دعوت به اقدام (CTA)
 */
export function InvoiceCtaScene({ t, scene }: { t: number; scene: Scene }) {
  const enter = clamp(progress(t, 0.1, 0.5))
  const pulse = Math.sin(t * 6) * 0.04

  return (
    <InvoiceStage scene={scene} t={t} punches={[2.0, 4.6]}>
      <InvoicingTopbar
        tag="FREE SMART SANDBOX"
        badge="تست رایگان فاکتور"
        badgeColor={ACCENT_EMERALD}
      />

      {/* Bold Top Headline */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 80,
          left: 24,
          right: 24,
          textAlign: 'center',
          opacity: enter,
          zIndex: 35,
        }}
      >
        <h1 style={{ fontSize: 29, fontWeight: 900, margin: 0, color: '#ffffff', lineHeight: 1.3 }}>
          فروش آسان و بی‌دردسر با <span style={{ color: ACCENT_EMERALD }}>حسابچه</span>
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: TEXT_MUTED,
            marginTop: 8,
            marginInline: 'auto',
            maxWidth: 440,
          }}
        >
          همین حالا کلمه «حسابچه» را در دایرکت بفرست تا ساندباکس اختصاصی برات باز بشه
        </p>
      </div>

      {/* Center Hero: Interactive Solution Showcase (y=175 to y=520) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 175,
          left: 45,
          right: 45,
          height: 330,
          borderRadius: 24,
          background: 'linear-gradient(145deg, rgba(16, 24, 40, 0.98), rgba(9, 14, 26, 0.98))',
          border: '2px solid rgba(16, 185, 129, 0.7)',
          boxShadow: '0 30px 70px rgba(0,0,0,0.85), 0 0 45px rgba(16, 185, 129, 0.3)',
          padding: '24px 22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 25,
        }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#a7f3d0' }}>
              ⚡ HISABCHE SMART INVOICE
            </span>
            <span
              style={{
                fontSize: 12,
                padding: '3px 10px',
                borderRadius: 6,
                background: '#10b981',
                color: '#000',
                fontWeight: 900,
              }}
            >
              فعال‌سازی آنی
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: TEXT_MUTED, marginTop: 4 }}>
            نسخه تجاری ابری و آفلاین
          </div>
        </div>

        <div style={{ margin: '14px 0' }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', marginBottom: 4 }}>
            فاکتور آنلاین • انبار زنده • دریافت سریع پول
          </div>
          <div style={{ fontSize: 11.5, color: '#cbd5e1', lineHeight: 1.5 }}>
            دیگر هیچ مشتری آماده خریدی را به خاطر تاخیر پیش‌فاکتور به رقبا واگذار نکنید
          </div>
        </div>

        <div
          style={{
            padding: '12px 18px',
            borderRadius: 12,
            background: 'linear-gradient(90deg, #10b981, #059669)',
            color: '#ffffff',
            textAlign: 'center',
            fontSize: 13.5,
            fontWeight: 900,
            letterSpacing: 0.5,
            boxShadow: '0 0 25px rgba(16, 185, 129, 0.5)',
          }}
        >
          شروع رایگان با یک پیام — hisabche.com 🚀
        </div>
      </div>

      {/* Bottom Active Zone: Massive CTA Button & Perks (y=535 to y=890) */}
      <div
        dir="rtl"
        style={{
          position: 'absolute',
          top: 535,
          left: 45,
          right: 45,
          textAlign: 'center',
          zIndex: 35,
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderRadius: 22,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#ffffff',
            fontSize: 22,
            fontWeight: 900,
            boxShadow: '0 20px 50px rgba(16, 185, 129, 0.45)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            transform: `scale(${1 + pulse})`,
            transition: 'transform 0.1s ease',
          }}
        >
          <span>ارسال کلمه</span>
          <span
            style={{
              background: '#020617',
              color: '#10b981',
              padding: '4px 14px',
              borderRadius: 10,
              fontSize: 24,
              fontWeight: 900,
            }}
          >
            «حسابچه»
          </span>
          <span>در دایرکت</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginTop: 18,
          }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 12,
              padding: '10px 6px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ fontSize: 13 }}>⏱️</div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
              صدور ۱۰ ثانیه‌ای
            </div>
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 12,
              padding: '10px 6px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ fontSize: 13 }}>📦</div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
              انبار زنده
            </div>
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 12,
              padding: '10px 6px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ fontSize: 13 }}>💳</div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#f8fafc', marginTop: 4 }}>
              لینک پرداخت
            </div>
          </div>
        </div>
      </div>

      <VrmAvatar t={t} crop="full" x={180} y={560} width={180} height={380} acts={ACTS_CTA_101} />
    </InvoiceStage>
  )
}
