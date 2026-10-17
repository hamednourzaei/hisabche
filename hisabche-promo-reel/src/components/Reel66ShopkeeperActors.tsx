// ============================================
// Reel #66 — «یک شخصیت از حسابچه می‌گوید: کاسب خواربار و لوازم خانگی»
//
// Visual Actors: Zero Clutter · One Focal Stage · Pure Bazaar Persian
//
// Permanent Guardrails (Hard Rules 13-17):
// 1. One Focal Stage: exactly ONE dominant centered visual (Y in [42%, 58%]).
// 2. Zero duplicated narration: spoken dialogue lives exclusively in subtitles.
// 3. Strict text budget: <= 6 words per label on-stage.
// 4. Zero center divider line artifacts.
// 5. Authentic Persian: natural grocery shop terminology.
// 6. AV Sync Law: every sounded word has an action, read via cueAt.
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { clamp, ease, mix, progress, studioSpringEnter } from '../engine/anim'

interface R66ActorProps {
  t: number
  plan?: SentencePlan | undefined
}

/** Dispatches an `r66-*` actor id to its visual component. */
export function Reel66ShopkeeperActor({
  actor,
  t,
  plan,
}: {
  actor: string
  t: number
  plan?: SentencePlan | undefined
}) {
  if (actor === 'r66-hook-paper-to-card') return <HookPaperToCardActor t={t} plan={plan} />
  if (actor === 'r66-invoice-quad-split') return <InvoiceQuadSplitActor t={t} plan={plan} />
  if (actor === 'r66-receivables-timeline') return <ReceivablesTimelineActor t={t} plan={plan} />
  if (actor === 'r66-offline-cloud-sync') return <OfflineCloudSyncActor t={t} plan={plan} />
  if (actor === 'r66-unified-dashboard-cta') return <UnifiedDashboardCtaActor t={t} plan={plan} />
  return null
}

function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  return plan?.words.find((w) => w.action === action)?.start ?? fallback
}

// ─── 1. Beat A: کوه کاغذ و فاکتور به کارت شیشه‌ای هوشمند ───────────────────
function HookPaperToCardActor({ t, plan }: R66ActorProps) {
  const pileAt = cueAt(plan, 'pile-paper-reveal', 0.2)
  const calcAt = cueAt(plan, 'calc-overwhelm', 1.8)
  const profitAt = cueAt(plan, 'profit-question', 2.7)
  const swirlAt = cueAt(plan, 'card-reform-swirl', 4.7)
  const floatAt = cueAt(plan, 'card-phone-float', 5.3)

  const isSwirled = t >= swirlAt
  const swirlProgress = clamp(progress(t, swirlAt, 0.6))
  const floatSpring = studioSpringEnter(t, floatAt, { y: 24 })

  return (
    <div className="r66-stage">
      <div className="r66-center-anchor">
        {!isSwirled ? (
          <div className="r66-paper-stack" style={studioSpringEnter(t, pileAt, { y: 32 })}>
            <div className="r66-card-header">
              <span className="r66-dot amber" />
              <span className="r66-title">دفتر حساب روزانه</span>
            </div>
            <div className="r66-receipt-pile">
              <div className="r66-paper-leaf leaf-1">
                <span>فاکتور خرید روغن</span>
                <span className="r66-num">۴۵۰٬۰۰۰ ریال</span>
              </div>
              {t >= calcAt && (
                <div className="r66-paper-leaf leaf-2">
                  <span>جمع فاکتورهای نامعلوم</span>
                  <span className="r66-num">؟!</span>
                </div>
              )}
            </div>
            {t >= profitAt && (
              <div className="r66-unknown-pill">
                <span className="r66-badge-red">سود خالص نامعلوم</span>
              </div>
            )}
          </div>
        ) : (
          <div
            className="r66-glowing-card"
            style={{
              ...floatSpring,
              opacity: swirlProgress,
              transform: `${floatSpring.transform ?? ''} scale(${mix(0.85, 1, ease(swirlProgress))})`,
            }}
          >
            <div className="r66-card-header">
              <span className="r66-dot emerald" />
              <span className="r66-title">کارت هوشمند حسابچه</span>
            </div>
            <div className="r66-stat-hero">
              <span className="r66-val">سود دقیق لحظه‌ای</span>
              <span className="r66-badge-green">محاسبه خودکار سیستم</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 2. Beat B: انشعاب یک فاکتور به چهار ارکان خودکار ───────────────────────
function InvoiceQuadSplitActor({ t, plan }: R66ActorProps) {
  const tapAt = cueAt(plan, 'invoice-tap-fly', 0.45)
  const shelfAt = cueAt(plan, 'shelf-stock-split', 2.15)
  const drawerAt = cueAt(plan, 'cash-drawer-split', 2.8)
  const customerAt = cueAt(plan, 'customer-card-split', 3.85)
  const ledgerAt = cueAt(plan, 'ledger-book-split', 4.65)
  const sparkAt = cueAt(plan, 'quad-sync-spark', 5.65)

  const isSparked = t >= sparkAt

  return (
    <div className="r66-stage">
      <div className="r66-center-anchor" style={studioSpringEnter(t, tapAt, { y: 20 })}>
        {/* Main Source Invoice */}
        <div className="r66-source-invoice">
          <div className="r66-card-header">
            <span className="r66-dot emerald" />
            <span className="r66-title">فاکتور فروش شماره ۱۰۸</span>
          </div>
          <div className="r66-invoice-amt">
            <span>مبلغ: ۶۸۰٬۰۰۰ ریال</span>
          </div>
        </div>

        {/* 4 Destination Cards Grid */}
        <div className="r66-quad-grid">
          {t >= shelfAt && (
            <div className="r66-mini-node" style={studioSpringEnter(t, shelfAt, { y: 15 })}>
              <span className="r66-icon-tag">📦</span>
              <div className="r66-node-info">
                <span className="r66-node-lbl">انبار و قفسه</span>
                <span className="r66-node-val">کسر ۲ کارتن</span>
              </div>
            </div>
          )}

          {t >= drawerAt && (
            <div className="r66-mini-node" style={studioSpringEnter(t, drawerAt, { y: 15 })}>
              <span className="r66-icon-tag">💰</span>
              <div className="r66-node-info">
                <span className="r66-node-lbl">صندوق فروشگاه</span>
                <span className="r66-node-val">شارژ وجه نقد</span>
              </div>
            </div>
          )}

          {t >= customerAt && (
            <div className="r66-mini-node" style={studioSpringEnter(t, customerAt, { y: 15 })}>
              <span className="r66-icon-tag">👤</span>
              <div className="r66-node-info">
                <span className="r66-node-lbl">حساب مشتری</span>
                <span className="r66-node-val">ثبت مانده نسیه</span>
              </div>
            </div>
          )}

          {t >= ledgerAt && (
            <div className="r66-mini-node" style={studioSpringEnter(t, ledgerAt, { y: 15 })}>
              <span className="r66-icon-tag">📖</span>
              <div className="r66-node-info">
                <span className="r66-node-lbl">دفتر حسابداری</span>
                <span className="r66-node-val">ثبت سند دوبل</span>
              </div>
            </div>
          )}
        </div>

        {isSparked && (
          <div className="r66-sync-badge-pill">
            <span className="r66-dot green" />
            <span className="r66-sync-text">همگام‌سازی چهارگانه انجام شد</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 3. Beat C: تایم‌لاین مانده نسیه و گردش حساب مشتری ───────────────────────
function ReceivablesTimelineActor({ t, plan }: R66ActorProps) {
  const cardAt = cueAt(plan, 'customer-card-open', 0.2)
  const timelineAt = cueAt(plan, 'timeline-reveal', 1.95)
  const invoiceAt = cueAt(plan, 'invoice-chip-add', 2.95)
  const paymentAt = cueAt(plan, 'payment-chip-drop', 3.95)
  const drainAt = cueAt(plan, 'balance-bar-drain', 5.15)

  const drainP = clamp(progress(t, drainAt, 0.7))

  return (
    <div className="r66-stage">
      <div className="r66-center-anchor" style={studioSpringEnter(t, cardAt, { y: 24 })}>
        {/* Customer Header */}
        <div className="r66-customer-header">
          <div className="r66-card-header">
            <span className="r66-dot cyan" />
            <span className="r66-title">گردش حساب علی رضایی</span>
          </div>
          <span className="r66-badge-cyan">نسیه مشتری با یک نگاه</span>
        </div>

        {/* Timeline chips */}
        {t >= timelineAt && (
          <div className="r66-chips-stream">
            {t >= invoiceAt && (
              <div className="r66-chip buy" style={studioSpringEnter(t, invoiceAt, { y: 12 })}>
                <span className="r66-chip-tag">فاکتور خرید</span>
                <span className="r66-chip-val">+۵۰۰٬۰۰۰ ریال</span>
              </div>
            )}
            {t >= paymentAt && (
              <div className="r66-chip pay" style={studioSpringEnter(t, paymentAt, { y: 12 })}>
                <span className="r66-chip-tag">واریز نقدی</span>
                <span className="r66-chip-val">-۳۰۰٬۰۰۰ ریال</span>
              </div>
            )}
          </div>
        )}

        {/* Balance Drain Bar */}
        <div className="r66-balance-box">
          <div className="r66-balance-labels">
            <span className="r66-balance-title">مانده حساب نهایی</span>
            <span className="r66-balance-num">
              {t >= drainAt ? '۲۰۰٬۰۰۰ ریال' : '۵۰۰٬۰۰۰ ریال'}
            </span>
          </div>
          <div className="r66-progress-track">
            <div
              className="r66-progress-fill"
              style={{
                width: `${mix(100, 40, ease(drainP))}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 4. Beat D: کار آفلاین هنگام قطع اینترنت و سینک ابری ───────────────────
function OfflineCloudSyncActor({ t, plan }: R66ActorProps) {
  const breakAt = cueAt(plan, 'wifi-break-flicker', 0.2)
  const keepAt = cueAt(plan, 'offline-sale-keep', 1.75)
  const queueAt = cueAt(plan, 'queue-stack-up', 2.15)
  const reconnectAt = cueAt(plan, 'wifi-reconnect-green', 3.3)
  const waveAt = cueAt(plan, 'cloud-stream-wave', 4.85)
  const completeAt = cueAt(plan, 'cloud-sync-complete', 5.35)

  const isReconnected = t >= reconnectAt
  const isComplete = t >= completeAt

  return (
    <div className="r66-stage">
      <div className="r66-center-anchor" style={studioSpringEnter(t, breakAt, { y: 22 })}>
        {/* Network Status Pill */}
        <div className="r66-network-status">
          <span className={`r66-dot ${isReconnected ? 'emerald' : 'red'}`} />
          <span className="r66-network-text">
            {isReconnected ? 'اینترنت متصل شد' : 'وضعیت شبکه: بدون اینترنت'}
          </span>
        </div>

        {/* Active POS Offline Queue */}
        {t >= keepAt && (
          <div className="r66-queue-board">
            <div className="r66-queue-head">
              <span className="r66-title">صندوق فروش فعال پای پیشخوان</span>
            </div>
            {t >= queueAt && (
              <div className="r66-queue-stack">
                <div className="r66-queue-item">فاکتور ۱: روغن و برنج</div>
                <div className="r66-queue-item">فاکتور ۲: قند و چای</div>
                <div className="r66-queue-item">فاکتور ۳: شوینده خانگی</div>
              </div>
            )}
          </div>
        )}

        {/* Cloud Wave Sync Indicator */}
        {t >= waveAt && (
          <div
            className={`r66-cloud-indicator ${isComplete ? 'synced' : 'syncing'}`}
            style={studioSpringEnter(t, waveAt, { y: 10 })}
          >
            <span className="r66-cloud-icon">☁️</span>
            <span className="r66-cloud-status">
              {isComplete ? 'همه فاکتورها ذخیره شدند' : 'در حال همگام‌سازی با سرور'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 5. Beat E: یکپارچگی در داشبورد جامع و دعوت به اقدام ──────────────────
function UnifiedDashboardCtaActor({ t, plan }: R66ActorProps) {
  const convergeAt = cueAt(plan, 'cards-converge-dash', 0.25)
  const dashAt = cueAt(plan, 'dashboard-reveal', 1.65)
  const btnAt = cueAt(plan, 'cta-button-enter', 3.0)
  const sparkAt = cueAt(plan, 'cta-spark-shine', 3.45)

  const isBtnActive = t >= btnAt
  const isSparked = t >= sparkAt

  return (
    <div className="r66-stage">
      <div className="r66-center-anchor" style={studioSpringEnter(t, convergeAt, { y: 24 })}>
        {/* Clean Unified Dashboard */}
        {t >= dashAt && (
          <div className="r66-dashboard-card" style={studioSpringEnter(t, dashAt, { y: 16 })}>
            <div className="r66-card-header">
              <span className="r66-dot emerald" />
              <span className="r66-title">داشبورد دخل و سود</span>
            </div>
            <div className="r66-kpi-row">
              <div className="r66-kpi-block">
                <span className="r66-kpi-lbl">سود خالص امروز</span>
                <span className="r66-kpi-num green">۱٬۴۲۰٬۰۰۰ ریال</span>
              </div>
              <div className="r66-kpi-block">
                <span className="r66-kpi-lbl">فروش کل روز</span>
                <span className="r66-kpi-num">۵٬۸۰۰٬۰۰۰ ریال</span>
              </div>
            </div>
          </div>
        )}

        {/* CTA Conversion Box */}
        {isBtnActive && (
          <div className="r66-cta-container" style={studioSpringEnter(t, btnAt, { y: 18 })}>
            <div className={`r66-cta-button ${isSparked ? 'sparkle' : ''}`}>
              <span className="r66-cta-bold">شروع رایگان پای صندوق</span>
              <span className="r66-cta-domain">hisabche.com</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
