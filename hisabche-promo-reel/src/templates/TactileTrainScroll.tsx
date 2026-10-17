import React from 'react'
import { VerticalTrainCanvas, type TrainStation } from '../components/tactile/VerticalTrainCanvas'
import {
  YellowPriceTag,
  StrikethroughPaperTag,
  TapedNavyCard,
  TornPaperStrip,
  LinedNotebookSheet,
  FastSpinClock,
  HandDrawnLoop,
  MarkerUnderline,
} from '../components/tactile'

export interface TactileTrainScrollProps {
  t: number
  totalDur?: number
  stations?: TrainStation[]
  style?: React.CSSProperties
  className?: string
}

/**
 * Flagship Tactile Train-Scroll Template Component
 * Features infinite vertical canvas, station-to-station camera gliding,
 * tactile paper primitives, and macro zoom-out overview.
 */
export const TactileTrainScrollTemplate: React.FC<TactileTrainScrollProps> = ({
  t,
  totalDur = 59,
  stations,
  style,
  className = '',
}) => {
  // Default stations demonstrating the full 7-beat Hisabche commercial arc
  const defaultStations: TrainStation[] = [
    // Station 1: The Hook (y = 0)
    {
      id: 'station-1',
      title: 'حسابداری دقیق با حسابچه',
      y: 0,
      startAt: 0,
      dur: 8,
      render: (st) => (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1.5px solid rgba(255, 255, 255, 0.18)',
              borderRadius: 16,
              padding: '6px 16px',
              fontSize: 13,
              fontWeight: 800,
              color: '#f8fafc',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            }}
          >
            سیستم عامل شفافیت کسب‌وکار
          </div>

          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: '#f8fafc',
              lineHeight: 1.5,
              maxWidth: 440,
            }}
          >
            حسابداری دقیق کسب‌وکار با <span style={{ color: '#38bdf8' }}>Hisabche</span>
          </div>

          <HandDrawnLoop t={st} startAt={0.4} color="#F6B91E">
            <YellowPriceTag
              text="صفر ریال خطا و مغایرت"
              sub="تضمین انضباط مالی"
              t={st}
              startAt={0.2}
            />
          </HandDrawnLoop>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              marginTop: 12,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>بدون نیاز به:</span>
            <div style={{ display: 'flex', gap: 12 }}>
              <StrikethroughPaperTag
                label="دفتر نسیه کاغذی"
                t={st}
                startAt={0.8}
                strikeAt={1.4}
                rotation={-2}
              />
              <StrikethroughPaperTag
                label="اکسل‌های پیچیده"
                t={st}
                startAt={1.1}
                strikeAt={1.7}
                rotation={2}
              />
            </div>
          </div>
        </div>
      ),
    },

    // Station 2: The Core Principle (y = 960)
    {
      id: 'station-2',
      title: 'یه اصل مهم',
      y: 960,
      startAt: 8,
      dur: 9,
      render: (st) => (
        <TapedNavyCard label="یه اصل مهم بازاری" t={st} startAt={0.2} rotation={-1.5}>
          <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.6, textAlign: 'center' }}>
            <MarkerUnderline t={st} startAt={0.6}>
              <span style={{ color: '#F6B91E' }}>دقیق بدون</span>
            </MarkerUnderline>{' '}
            امروز پول و جنست کجاست!
          </div>
          <div
            style={{
              fontSize: 14,
              color: '#94a3b8',
              marginTop: 14,
              lineHeight: 1.7,
              textAlign: 'center',
            }}
          >
            کاسب وقتی آرامش داره که بدونه هر ریال بدهی و طلبش کجای بازاره.
          </div>
        </TapedNavyCard>
      ),
    },

    // Station 3: Three Vital Pillars (y = 1920)
    {
      id: 'station-3',
      title: 'سه بخش حیاتی',
      y: 1920,
      startAt: 17,
      dur: 10,
      render: (st) => (
        <LinedNotebookSheet
          title="۳ بخش حیاتی هر کسب‌وکار ایرانی:"
          t={st}
          startAt={0.2}
          lines={[
            { text: 'فاکتور فروش و وصولی کارتخوان', checked: true, highlight: true },
            { text: 'کاردکس لحظه‌ای و موجودی انبار', checked: true },
            { text: 'صندوق، چک صیادی و مانده نسیه', checked: true, highlight: true },
          ]}
        />
      ),
    },

    // Station 4: Instant Multi-Action UI (y = 2880)
    {
      id: 'station-4',
      title: 'ثبت یک‌کلیکه',
      y: 2880,
      startAt: 27,
      dur: 10,
      render: (st) => (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            width: '100%',
          }}
        >
          <TornPaperStrip text="«فقط یک فاکتور بزن؛ بقیه‌ش با حسابچه»" t={st} startAt={0.2} />
          <div
            style={{
              background: 'rgba(18, 26, 42, 0.92)',
              border: '1.5px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 18,
              padding: '20px 24px',
              width: '90%',
              boxShadow: '0 14px 30px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900, color: '#f8fafc' }}>
              عملیات خودکار در پس‌زمینه:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['ثبت سند دوطرفه', 'کسر از کاردکس', 'به‌روزرسانی طلب مشتری', 'تراز بانک'].map(
                (item, i) => (
                  <span
                    key={i}
                    style={{
                      background: 'rgba(30, 41, 59, 0.9)',
                      color: '#38bdf8',
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    ✓ {item}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      ),
    },

    // Station 5: Rapid Setup & Fast Clock (y = 3840)
    {
      id: 'station-5',
      title: 'راه‌اندازی فوری',
      y: 3840,
      startAt: 37,
      dur: 11,
      render: (st) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <FastSpinClock t={st} startAt={0.2} badgeText="راه‌اندازی در ۳ دقیقه" />
          <TapedNavyCard label="بدون نیاز به آموزش حسابداری" t={st} startAt={0.5} rotation={1.5}>
            <div style={{ fontSize: 17, fontWeight: 800, textAlign: 'center', lineHeight: 1.6 }}>
              از گوشی، تبلت یا ویندوز، حتی بدون اینترنت فاکتور بزن و سینک شو!
            </div>
          </TapedNavyCard>
        </div>
      ),
    },

    // Station 6: Final High-Conversion CTA (y = 4800)
    {
      id: 'station-6',
      title: 'شروع با حسابچه',
      y: 4800,
      startAt: 48,
      dur: 11,
      render: (st) => (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 22,
            textAlign: 'center',
          }}
        >
          <TornPaperStrip text="لینک شروع رایگان رو برات می‌فرستم ✈️" t={st} startAt={0.2} />
          <div style={{ fontSize: 26, fontWeight: 900, color: '#f8fafc', lineHeight: 1.5 }}>
            <MarkerUnderline t={st} startAt={0.5}>
              <span>فالو کن</span>
            </MarkerUnderline>{' '}
            و همین الان کامنت کن:
          </div>

          <HandDrawnLoop t={st} startAt={0.8} color="#F6B91E">
            <div
              style={{
                background: '#F6B91E',
                color: '#121D35',
                padding: '16px 36px',
                borderRadius: 16,
                fontSize: 32,
                fontWeight: 900,
                border: '2px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                transform: 'rotate(-2deg)',
              }}
            >
              حسابچه
            </div>
          </HandDrawnLoop>
        </div>
      ),
    },
  ]

  const activeStations = stations && stations.length > 0 ? stations : defaultStations

  return (
    <VerticalTrainCanvas
      stations={activeStations}
      t={t}
      totalDur={totalDur}
      style={style}
      className={className}
    />
  )
}
