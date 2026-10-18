// ============================================
// Hisabche Studio — WordDrivenStage Component
//
// Sentence-driven, word-synchronized reactive stage.
// Directly implements narrative cause-and-effect where
// every spoken word moves the visual story forward.
// ============================================

import type { Scene } from '../engine/types'
import type { SentencePlan } from '../engine/speech-model'
import { ease, spring, progress, mix } from '../engine/anim'
import { WordSyncTeleprompter } from '../ui/WordSyncTeleprompter'
import { Reel55HybridActor } from './Reel55HybridActors'
import { Reel56LineActor } from './Reel56LineActors'
import { Reel57AuditActor } from './Reel57AuditActors'
import { Reel59TaxActor } from './Reel59TaxActors'
import { Reel60FxActor } from './Reel60FxActors'
import { Reel61ShelfActor } from './Reel61ShelfActors'
import { Reel62ReceiptActor } from './Reel62ReceiptActors'
import { Reel63GoldsmithActor } from './Reel63GoldsmithActors'
import { Reel64CogsActor } from './Reel64CogsActors'
import { Reel65BarberActor } from './Reel65BarberChairActors'
import { Reel66ShopkeeperActor } from './Reel66ShopkeeperActors'
import { Reel67PriceListActor } from './Reel67PriceListActors'
import { Reel68ShowreelActor } from './Reel68ShowreelActors'
import { Reel69ShowreelActor } from './Reel69ShowreelActors'
import { faNumber } from '../ui/motion-primitives'

interface WordDrivenStageProps {
  t: number
  scene: Scene
}

export function WordDrivenStage({ t, scene }: WordDrivenStageProps) {
  const spec = scene.spec
  const plan = scene.sentence ?? (spec.kind === 'word-sync' ? spec.sentencePlan : undefined)
  const actor = spec.kind === 'word-sync' ? spec.actor : 'hook-sales'

  return (
    <div className="scene word-driven-stage" data-actor={actor}>
      {/* ── Visual Actor Canvas ── */}
      <div className="word-driven-canvas">
        {actor === 'hook-sales' && <HookSalesActor t={t} plan={plan} />}
        {actor === 'broken-chart' && <BrokenChartActor t={t} plan={plan} />}
        {actor === 'leak-cards' && <LeakCardsActor t={t} plan={plan} />}
        {actor === 'unified-dashboard' && <UnifiedDashboardActor t={t} plan={plan} />}
        {actor === 'cta-finish' && <CtaFinishActor t={t} plan={plan} />}
        {actor === 'cheque-countdown' && <ChequeCountdownActor t={t} plan={plan} />}
        {actor === 'capital-trap' && <CapitalTrapActor t={t} plan={plan} />}
        {actor === 'overdue-cards' && <OverdueCardsActor t={t} plan={plan} />}
        {actor === 'sms-settlement' && <SmsSettlementActor t={t} plan={plan} />}
        {actor === 'cta-conversion-54' && <CtaConversion54Actor t={t} plan={plan} />}
        {actor?.startsWith('r55-') && <Reel55HybridActor actor={actor} t={t} plan={plan} />}
        {actor?.startsWith('r56-') && <Reel56LineActor actor={actor} t={t} plan={plan} />}
        {actor?.startsWith('r57-') && <Reel57AuditActor actor={actor} t={t} plan={plan} />}
        {actor?.startsWith('r59-') && <Reel59TaxActor actor={actor} t={t} plan={plan} />}
        {actor?.startsWith('r60-') && <Reel60FxActor actor={actor} t={t} plan={plan} />}
        {actor?.startsWith('r61-') && <Reel61ShelfActor actor={actor} t={t} plan={plan} />}
        {actor?.startsWith('r62-') && <Reel62ReceiptActor actor={actor} t={t} plan={plan} />}
        {actor?.startsWith('r63-') && <Reel63GoldsmithActor actor={actor} t={t} plan={plan} />}
        {actor?.startsWith('r64-') && <Reel64CogsActor actor={actor} t={t} plan={plan} />}
        {actor?.startsWith('r65-') && <Reel65BarberActor actor={actor} t={t} plan={plan} />}
        {actor?.startsWith('r66-') && <Reel66ShopkeeperActor actor={actor} t={t} plan={plan} />}
        {actor?.startsWith('r67-') && <Reel67PriceListActor actor={actor} t={t} plan={plan} />}
        {actor?.startsWith('r68-') && <Reel68ShowreelActor actor={actor} t={t} plan={plan} />}
        {actor?.startsWith('r69-') && <Reel69ShowreelActor actor={actor} t={t} plan={plan} />}
      </div>

      {/* ── Synchronized Live Teleprompter / Subtitles (Clean Caption Bar) ── */}
      {plan && <WordSyncTeleprompter sentence={plan} t={t} showMetadata={false} />}
    </div>
  )
}

// ─── 1. Hook Sales Actor: «فروشت زیاده…» ─────────────────────────────────────
function HookSalesActor({ t, plan }: { t: number; plan?: SentencePlan }) {
  // Word 1: «فروشت» -> Card enters with strong impact at exact word timestamp
  const enterAt =
    plan?.words.find((w) => w.action === 'sales-slam')?.start ?? plan?.words[0]?.start ?? 0.2
  const enterSpring = spring(t - enterAt)
  const scale = mix(0.85, 1, enterSpring)
  const opacity = progress(t, enterAt, 0.2)

  // Word 2: «زیاده…» -> Number counts up rapidly to 300 Million
  const surgeCue = plan?.words.find((w) => w.action === 'count-surge')
  const countStart = surgeCue?.start ?? 0.6
  const countEnd = surgeCue?.end ?? 2.0
  const countDuration = Math.max(0.4, countEnd - countStart)
  const countProgress = ease(progress(t, countStart, countDuration))
  const salesValue = mix(0, 300000000, countProgress)

  // Sentence ending «…» -> Sudden freeze
  const freezeAt = plan?.sentenceEnding?.at ?? 2.4
  const isFrozen = t >= freezeAt

  return (
    <div
      className="sales-hook-card"
      style={{
        opacity,
        transform: `translateY(${mix(40, 0, enterSpring)}px) scale(${scale})`,
      }}
    >
      <div className="badge-row">
        <span className="live-pulse-badge">
          <span className="pulse-dot" />
          ثبت فاکتورهای ماه جاری
        </span>
        <span className="retail-label">فروشگاه نمونه</span>
      </div>

      <div className="sales-hero-figure">
        <div className="sales-amount-display">
          <span className="digits">{faNumber(salesValue)}</span>
          <span className="currency-unit">تومان</span>
        </div>
      </div>

      {/* Growth Progress Bar */}
      <div className="sales-growth-meter">
        <div
          className="growth-fill"
          style={{
            width: `${countProgress * 100}%`,
            transition: isFrozen ? 'none' : 'width 0.1s linear',
          }}
        />
      </div>

      <div className="sales-footer-status">
        <span className="status-highlight">
          {isFrozen ? '⏸ توقف ناگهانی در اوج فروش!' : 'در حال ثبت رکوردهای روزانه…'}
        </span>
      </div>
    </div>
  )
}

// ─── 2. Broken Chart Actor: «اما آخر ماه نمی‌دونی پولت کجا رفته!» ───────────
function BrokenChartActor({ t, plan }: { t: number; plan?: SentencePlan }) {
  // Word «اما» -> Growth chart fractures with alert crack
  const crackAt =
    plan?.words.find((w) => w.action === 'chart-crack')?.start ?? plan?.words[0]?.start ?? 0.2
  const crackSpring = spring(t - crackAt)
  const crackProgress = ease(progress(t, crackAt, 0.8))

  // Word «پولت» -> Bank balance collapses from 300M to 2M
  const collapseAt = plan?.words.find((w) => w.action === 'money-collapse')?.start ?? 1.6
  const collapseProgress = ease(progress(t, collapseAt, 1.0))
  const bankBalance = mix(300000000, 2000000, collapseProgress)

  // Word «کجا رفته!» -> Screen reveals massive question mark
  const questionAt = plan?.words.find((w) => w.action === 'question-reveal')?.start ?? 2.8
  const questionSpring = spring(t - questionAt)
  const showQuestion = t >= questionAt

  return (
    <div
      className="broken-chart-card"
      style={{
        transform: `scale(${mix(0.96, 1, crackSpring)})`,
      }}
    >
      <div className="chart-header">
        <span className="danger-alert-pill">⚠️ بحران نقدینگی پنهان</span>
        <span className="date-tag">پایان ماه</span>
      </div>

      {/* The Fracturing Graph */}
      <div className="fracture-graph-container">
        <svg viewBox="0 0 400 140" className="fracture-svg">
          {/* Base Growth Line */}
          <path
            d="M 10 110 Q 120 100 200 40 T 390 20"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="3.5"
            strokeDasharray={collapseProgress > 0.3 ? '6 6' : 'none'}
            opacity={1 - collapseProgress * 0.6}
          />
          {/* Red Fracture Crack */}
          {t >= crackAt && (
            <path
              d="M 180 10 L 205 50 L 195 85 L 220 130"
              fill="none"
              stroke="#fb7185"
              strokeWidth="4"
              strokeDasharray="200"
              strokeDashoffset={200 * (1 - crackProgress)}
            />
          )}
        </svg>
      </div>

      {/* Bank Balance Box */}
      <div className="bank-balance-box">
        <div className="bb-label">موجودی واقعی حساب بانکی:</div>
        <div className="bb-value">
          <span className="bb-digits">{faNumber(bankBalance)}</span>
          <span className="bb-unit">تومان</span>
        </div>
      </div>

      {/* Question Reveal */}
      {showQuestion && (
        <div
          className="question-reveal-box"
          style={{
            transform: `scale(${mix(0.6, 1, questionSpring)})`,
            opacity: progress(t, questionAt, 0.2),
          }}
        >
          <div className="big-question-mark">؟</div>
          <div className="question-text">۲۹۸ میلیون تومان سود و پولت کجاست؟</div>
        </div>
      )}
    </div>
  )
}

// ─── 3. Leak Cards Actor: «انبار، طلب مشتری‌ها، خرج‌ها…» ───────────────────
function LeakCardsActor({ t, plan }: { t: number; plan?: SentencePlan }) {
  // Word «انبار»
  const card1At =
    plan?.words.find((w) => w.action === 'inventory-drop')?.start ?? plan?.words[0]?.start ?? 0.3
  const card1Spring = spring(t - card1At)
  const showCard1 = t >= card1At

  // Word «طلب مشتری‌ها»
  const card2At = plan?.words.find((w) => w.action === 'debt-stack')?.start ?? 2.0
  const card2Spring = spring(t - card2At)
  const showCard2 = t >= card2At

  // Word «خرج‌ها…»
  const card3At = plan?.words.find((w) => w.action === 'expense-slide')?.start ?? 3.8
  const card3Spring = spring(t - card3At)
  const showCard3 = t >= card3At

  return (
    <div className="leak-cards-container">
      <div className="leak-cards-title">محل قفل‌شدن پول‌های پنهان:</div>

      {/* Card 1: انبار */}
      {showCard1 && (
        <div
          className="leak-item-card amber-leak"
          style={{
            transform: `translateY(${mix(30, 0, card1Spring)}px) scale(${mix(0.9, 1, card1Spring)})`,
            opacity: progress(t, card1At, 0.25),
          }}
        >
          <div className="leak-badge amber">📦 انبار و سرمایه راکد</div>
          <div className="leak-headline">۵۰ میلیون تومان کالا در قفسه</div>
          <div className="leak-sub">خواب سرمایه و اقلام ناموجود در سیستم</div>
        </div>
      )}

      {/* Card 2: طلب مشتری‌ها */}
      {showCard2 && (
        <div
          className="leak-item-card rose-leak"
          style={{
            transform: `translateY(${mix(30, 0, card2Spring)}px) scale(${mix(0.9, 1, card2Spring)})`,
            opacity: progress(t, card2At, 0.25),
          }}
        >
          <div className="leak-badge rose">👥 طلب مشتری‌ها (نسیه بازار)</div>
          <div className="leak-headline">۲۳۰ میلیون تومان طلب معوق</div>
          <div className="leak-sub">فروش رفته اما پولش در دست مشتریان قفل شده است!</div>
        </div>
      )}

      {/* Card 3: خرج‌ها */}
      {showCard3 && (
        <div
          className="leak-item-card purple-leak"
          style={{
            transform: `translateY(${mix(30, 0, card3Spring)}px) scale(${mix(0.9, 1, card3Spring)})`,
            opacity: progress(t, card3At, 0.25),
          }}
        >
          <div className="leak-badge purple">🧾 خرج‌ها و هزینه‌های جاری</div>
          <div className="leak-headline">۱۸ میلیون تومان کرایه و خرج روزمره</div>
          <div className="leak-sub">هزینه‌های ریزی که در هیچ دفتری نوشته نشدند</div>
        </div>
      )}
    </div>
  )
}

// ─── 4. Unified Dashboard Actor: «حسابچه کمک می‌کنه همه‌چیز رو یکجا ببینی.» ───
function UnifiedDashboardActor({ t, plan }: { t: number; plan?: SentencePlan }) {
  // Word «حسابچه» -> Brand identity emblem enters
  const brandAt =
    plan?.words.find((w) => w.action === 'brand-reveal')?.start ?? plan?.words[0]?.start ?? 0.3
  const brandSpring = spring(t - brandAt)

  // Word «همه‌چیز رو» -> Scattered elements begin pulling together
  const convergeAt = plan?.words.find((w) => w.action === 'converge-start')?.start ?? 2.4
  const lockAt = plan?.words.find((w) => w.action === 'dashboard-lock')?.start ?? 3.8
  const convergeDuration = Math.max(0.5, lockAt - convergeAt)
  const convergeProgress = ease(progress(t, convergeAt, convergeDuration))

  // Word «یکجا» -> Dashboard locks into grid
  const lockSpring = spring(t - lockAt)
  const isLocked = t >= lockAt

  return (
    <div className="unified-dashboard-container">
      {/* Brand Header */}
      <div
        className="brand-entry-header"
        style={{
          transform: `translateY(${mix(-20, 0, brandSpring)}px)`,
          opacity: progress(t, brandAt, 0.25),
        }}
      >
        <div className="brand-logo-circle">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2.2"
          >
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M7 8h10M7 12h7M7 16h9" />
          </svg>
        </div>
        <div className="brand-title-group">
          <span className="brand-name">حسابچه</span>
          <span className="brand-slogan">داشبورد یکپارچه مدیریت کسب‌وکار</span>
        </div>
      </div>

      {/* Unified 3-Part Metric Grid */}
      <div
        className={`dashboard-grid ${isLocked ? 'locked-state' : 'converging-state'}`}
        style={{
          transform: `scale(${mix(0.92, 1, lockSpring)})`,
          opacity: progress(t, Math.max(0.5, brandAt + 0.5), 0.4),
          gap: `${mix(20, 12, convergeProgress)}px`,
        }}
      >
        <div className="dashboard-metric-tile bank-tile">
          <div className="tile-top">
            <span className="tile-label">موجودی نقد و بانک</span>
            <span className="tile-tag green">تسویه آنی</span>
          </div>
          <div className="tile-number">۲,۰۰۰,۰۰۰ تومان</div>
          <div className="tile-detail">تطبیق خودکار با کارت‌خوان</div>
        </div>

        <div className="dashboard-metric-tile debt-tile">
          <div className="tile-top">
            <span className="tile-label">مطالبات بازار</span>
            <span className="tile-tag cyan">ردیابی پیامکی</span>
          </div>
          <div className="tile-number">۲۳۰,۰۰۰,۰۰۰ تومان</div>
          <div className="tile-detail">یادآوری خودکار قبل از سررسید</div>
        </div>

        <div className="dashboard-metric-tile inv-tile">
          <div className="tile-top">
            <span className="tile-label">کاردکس انبار</span>
            <span className="tile-tag purple">پایش لحظه‌ای</span>
          </div>
          <div className="tile-number">۵۰,۰۰۰,۰۰۰ تومان</div>
          <div className="tile-detail">هشدار اتمام موجودی و نقطه سفارش</div>
        </div>
      </div>

      {/* Final Clarity Banner */}
      {isLocked && (
        <div
          className="clarity-guarantee-banner"
          style={{
            transform: `translateY(${mix(15, 0, lockSpring)}px)`,
            opacity: progress(t, lockAt, 0.3),
          }}
        >
          <span className="check-icon">✓</span>
          <span>همه اطلاعات در یک صفحه، همیشه در دسترس و شفاف</span>
        </div>
      )}
    </div>
  )
}

// ─── 5. CTA Finish Actor: «همین حالا دخل و حسابت رو در حسابچه شفاف کن.» ────
function CtaFinishActor({ t, plan }: { t: number; plan?: SentencePlan }) {
  const enterAt = plan?.words[0]?.start ?? 0.2
  const secondaryCue = plan?.words.find((w) => w.word.includes('حسابچه'))
  const secondaryAt = secondaryCue?.start ?? 1.8

  const enterSpring = spring(t - enterAt)
  const card2Spring = spring(t - secondaryAt)

  return (
    <div
      className="cta-finish-container"
      style={{
        transform: `translateY(${mix(20, 0, enterSpring)}px)`,
        opacity: progress(t, enterAt, 0.3),
      }}
    >
      <div className="cta-brand-hero">
        <div className="cta-logo-glow">
          <svg
            width="42"
            height="42"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <path d="M7 8h10M7 12h6M7 16h9" />
          </svg>
        </div>
        <h2 className="cta-main-title">Hisabche</h2>
        <p className="cta-subtitle">پایان قفل شدن پول و کنترل کامل دخل</p>
      </div>

      <div className="cta-action-stack">
        <div className="cta-action-card cyan-cta">
          <div className="cta-card-badge">شروع سریع و بدون ریسک</div>
          <div className="cta-card-action">شروع رایگان در: hisabche.com</div>
        </div>

        {t >= secondaryAt && (
          <div
            className="cta-action-card purple-cta"
            style={{
              transform: `translateY(${mix(20, 0, card2Spring)}px)`,
              opacity: progress(t, secondaryAt, 0.3),
            }}
          >
            <div className="cta-card-badge">نرم‌افزار حسابداری و مطالبات بازار</div>
            <div className="cta-card-action">همین حالا سرچ کن: حسابچه</div>
          </div>
        )}
      </div>

      <div className="cta-web-footer">hisabche.com</div>
    </div>
  )
}

// ─── 6. Cheque Countdown Actor (Reel 54 Hook): «ساعت ۱۲ ظهر چکت برگشت می‌خوره!» ───
function ChequeCountdownActor({ t, plan }: { t: number; plan?: SentencePlan }) {
  // Word «۱۲»: clock ticks down towards 12:00:00
  const clockCue = plan?.words.find((w) => w.action === 'clock-countdown')
  const clockAt = clockCue?.start ?? 0.7
  const isClockActive = t >= clockAt

  // Time calculations: count down cleanly from 11:59:57 to 12:00:00 (strictly no negative numbers)
  const clockProgress = ease(progress(t, clockAt, 1.2))
  const secRemaining = Math.max(0, Math.min(3, Math.round(mix(3, 0, clockProgress))))
  let clockText = '۱۲:۰۰:۰۰'
  if (secRemaining > 0) {
    const sec = 60 - secRemaining
    clockText = `۱۱:۵۹:${faNumber(sec)}`
  }

  // Word «چکت»: Sayadi purple cheque card enters with spring
  const chequeCue = plan?.words.find((w) => w.action === 'cheque-reveal')
  const chequeAt = chequeCue?.start ?? 1.5
  const chequeSpring = spring(t - chequeAt)
  const showCheque = t >= chequeAt

  // Word «می‌خوره!»: REJECT / کسری موجودی stamp slams down with tactile micro-shake
  const stampCue = plan?.words.find((w) => w.action === 'stamp-reject')
  const stampAt = stampCue?.start ?? 2.0
  const stampSpring = spring(t - stampAt)
  const isRejected = t >= stampAt
  const stampElapsed = t - stampAt
  const shakeX =
    isRejected && stampElapsed >= 0 && stampElapsed < 0.45
      ? Math.sin(stampElapsed * 45) * Math.max(0, 1 - stampElapsed / 0.45) * 8
      : 0

  // Sentence ending alarm freeze
  const freezeAt = plan?.sentenceEnding?.at ?? 2.8
  const isFrozen = t >= freezeAt

  return (
    <div className={`cheque-countdown-container ${isRejected ? 'alarm-active' : ''}`}>
      {/* Urgent Alert Banner */}
      <div className="alarm-top-banner">
        <span className="alarm-pulse-dot" />
        <span className="alarm-banner-title">⚠️ هشدار اضطراری سررسید بانکی</span>
        <span className="alarm-time-tag">امروز ۱۲:۰۰</span>
      </div>

      {/* Countdown Clock Face */}
      <div className={`countdown-clock-card ${isClockActive ? 'ticking' : ''}`}>
        <div className="clock-label">زمان باقیمانده تا تسویه سامانه صیاد:</div>
        <div className="clock-digits-row">
          <span className="clock-icon">⏰</span>
          <span className="clock-digits">{clockText}</span>
          <span className="clock-zone">ظهر</span>
        </div>
      </div>

      {/* Realistic Sayadi Purple Cheque with Slam Micro-Shake */}
      {showCheque && (
        <div
          className={`sayadi-cheque-card ${isRejected ? 'cheque-rejected' : ''}`}
          style={{
            transform: `translateY(${mix(30, 0, chequeSpring)}px) translateX(${shakeX}px) scale(${mix(0.92, 1, chequeSpring)})`,
            opacity: progress(t, chequeAt, 0.2),
          }}
        >
          <div className="cheque-header">
            <div className="cheque-logo-badge">
              <span className="sayadi-badge-icon">🏛️</span>
              <span className="sayadi-badge-text">چک صیادی بنفش</span>
            </div>
            <div className="cheque-id-code">شناسه: ۷۲۹۴-۰۱۸۳</div>
          </div>

          <div className="cheque-amount-row">
            <span className="cheque-amount-label">مبلغ چک:</span>
            <span className="cheque-amount-digits">{faNumber(600000000)}</span>
            <span className="cheque-unit">تومان</span>
          </div>

          <div className="cheque-payee-row">
            <span className="cheque-payee-label">در وجه:</span>
            <span className="cheque-payee-name">شرکت بازرگانی پارس (خرید عمده)</span>
          </div>

          <div className="cheque-balance-warning">
            <span className="cb-label">موجودی حساب متصل:</span>
            <span className="cb-amount">{faNumber(1400000)} تومان</span>
            <span className="cb-gap">⚠️ کسری: ۵۹۸٫۶ میلیون!</span>
          </div>

          {/* Holographic Rejection Stamp Slam */}
          {isRejected && (
            <div
              className="reject-slam-stamp"
              style={{
                transform: `rotate(-12deg) scale(${mix(2.4, 1, stampSpring)})`,
                opacity: progress(t, stampAt, 0.12),
              }}
            >
              <div className="stamp-inner">
                <span className="stamp-title">برگشت خورد ❌</span>
                <span className="stamp-reason">کسری موجودی حساب</span>
              </div>
            </div>
          )}
        </div>
      )}

      {isFrozen && (
        <div className="freeze-dread-badge">⏸ مسدودی آنی حساب‌ها و ابطال دسته‌چک صیادی!</div>
      )}
    </div>
  )
}

// ─── 7. Capital Trap Actor (Reel 54 Scene 2): «فروشت عالی بوده؛ اما ۴۳۰ میلیون...» ───
function CapitalTrapActor({ t, plan }: { t: number; plan?: SentencePlan }) {
  // Top headline enters at scene start
  const headlineAt = plan?.words[0]?.start ?? 0.1
  const headlineSpring = spring(t - headlineAt)

  // Word «فروشت»: Sales card enters
  const salesCue = plan?.words.find((w) => w.action === 'sales-sparkle')
  const salesAt = salesCue?.start ?? 0.2
  const salesSpring = spring(t - salesAt)

  // Word «اما»: Graph/Card cracks
  const crackCue = plan?.words.find((w) => w.action === 'crack-alert')
  const crackAt = crackCue?.start ?? 1.5
  const isCracked = t >= crackAt
  const crackSpring = spring(t - crackAt)

  // Word «۴۳۰ میلیون»: Trapped capital metric surge
  const trappedCue = plan?.words.find((w) => w.action === 'trapped-counter')
  const trappedAt = trappedCue?.start ?? 2.0
  const trappedProgress = ease(progress(t, trappedAt, 0.8))
  const trappedValue = mix(0, 430000000, trappedProgress)

  // Word «مشتری‌ها» / «خاک می‌خوره!»: Aging spiderweb indicator
  const agingCue = plan?.words.find((w) => w.action === 'spiderweb-trap')
  const agingAt = agingCue?.start ?? 4.7
  const showAging = t >= agingAt

  return (
    <div className={`capital-trap-container ${isCracked ? 'cracked-state' : ''}`}>
      {/* Bold Top Headline — Fills Upper Zone */}
      <div
        className="scene-top-headline"
        style={{
          transform: `translateY(${mix(-20, 0, headlineSpring)}px)`,
          opacity: progress(t, headlineAt, 0.2),
        }}
      >
        <span className="headline-badge">⚠️ تناقض مهلک کسب‌وکار</span>
        <h2 className="headline-text">فروش بالا روی کاغذ؛ اما حساب بانکی خالی!</h2>
      </div>

      {/* Top Sales Metric (Scaled up) */}
      <div
        className="sales-achievement-card"
        style={{
          transform: `translateY(${mix(20, 0, salesSpring)}px) scale(${mix(0.95, 1, salesSpring)})`,
          opacity: progress(t, salesAt, 0.25),
        }}
      >
        <div className="sac-header">
          <span className="sac-tag-green">✓ عملکرد فروش ماه</span>
          <span className="sac-label">فاکتورهای صادرشده</span>
        </div>
        <div className="sac-amount">
          <span className="digits">{faNumber(430000000)}</span>
          <span className="unit">تومان</span>
        </div>
        <div className="sac-footer">فروش عالی و خارج شدن اجناس از قفسه‌ها</div>
      </div>

      {/* Downward Drain Arrow Connector */}
      {isCracked && (
        <div className="capital-drain-arrow-connector">
          <svg width="32" height="42" viewBox="0 0 32 42" fill="none">
            <path
              d="M16 2 L16 32 M8 24 L16 32 L24 24"
              stroke="#fb7185"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="drain-label">تخلیه نقدینگی و قفل شدن در بازار</span>
        </div>
      )}

      {/* The Dilemma / Trapped Capital Meter */}
      {isCracked && (
        <div
          className="trapped-capital-card"
          style={{
            transform: `scale(${mix(0.92, 1, crackSpring)})`,
            opacity: progress(t, crackAt, 0.2),
          }}
        >
          <div className="tcc-header">
            <span className="danger-pill">⚠️ سرمایه قفل‌شده در دست خریداران</span>
          </div>

          <div className="tcc-counter-row">
            <span className="tcc-label">طلب وصول‌نشده:</span>
            <span className="tcc-amount">{faNumber(trappedValue)} تومان</span>
          </div>

          {/* Lock Meter Bar */}
          <div className="trapped-meter-track">
            <div className="trapped-meter-fill" style={{ width: `${trappedProgress * 100}%` }} />
          </div>

          {showAging && (
            <div className="dust-aging-notice">
              <span className="spider-icon">🕸️</span>
              <span>خواب سرمایه در بازار؛ بدون حتی ۱ ریال نقدینگی در بانک!</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 8. Overdue Cards Actor (Reel 54 Scene 3): «نه سررسید نسیه‌ها مشخصه...» ───
function OverdueCardsActor({ t, plan }: { t: number; plan?: SentencePlan }) {
  const headerAt = plan?.words[0]?.start ?? 0.1
  const headerSpring = spring(t - headerAt)

  // Card 1: حاج قاسم
  const c1Cue = plan?.words.find((w) => w.action === 'card-iron-bazaar')
  const c1At = c1Cue?.start ?? 1.3
  const c1Spring = spring(t - c1At)
  const showC1 = t >= c1At

  // Card 2: پخش البرز
  const c2Cue = plan?.words.find((w) => w.action === 'card-alborz')
  const c2At = c2Cue?.start ?? 3.6
  const c2Spring = spring(t - c2At)
  const showC2 = t >= c2At

  // Card 3: فروشگاه سبلان
  const c3Cue = plan?.words.find((w) => w.action === 'card-sabalan')
  const c3At = c3Cue?.start ?? 5.15
  const c3Spring = spring(t - c3At)
  const showC3 = t >= c3At

  return (
    <div className="overdue-cards-container">
      {/* Prominent Top Header — Upper Zone Positioning */}
      <div
        className="overdue-top-header"
        style={{
          transform: `translateY(${mix(-15, 0, headerSpring)}px)`,
          opacity: progress(t, headerAt, 0.2),
        }}
      >
        <div className="occ-title-badge">
          <span className="occ-title-dot" />
          <span className="occ-title">دفتر نسیه سنتی و بدهکاران بلاتکلیف:</span>
        </div>
        <span className="occ-total-tag">۴۳۰ میلیون معوق</span>
      </div>

      {/* Card 1 */}
      {showC1 && (
        <div
          className="overdue-debt-card red-warning"
          style={{
            transform: `translateY(${mix(25, 0, c1Spring)}px) scale(${mix(0.94, 1, c1Spring)})`,
            opacity: progress(t, c1At, 0.2),
          }}
        >
          <div className="odc-top">
            <span className="odc-name">حاج قاسم - بنکداری بازار</span>
            <span className="odc-aging-pill red">۶۲ روز تاخیر! ⚠️</span>
          </div>
          <div className="odc-amount-row">
            <span className="odc-amount">{faNumber(185000000)} تومان</span>
            <span className="odc-note">آخرین تماس: پیگیری نشد</span>
          </div>
        </div>
      )}

      {/* Card 2 */}
      {showC2 && (
        <div
          className="overdue-debt-card amber-warning"
          style={{
            transform: `translateY(${mix(25, 0, c2Spring)}px) scale(${mix(0.94, 1, c2Spring)})`,
            opacity: progress(t, c2At, 0.2),
          }}
        >
          <div className="odc-top">
            <span className="odc-name">پخش سراسری البرز</span>
            <span className="odc-aging-pill amber">۳۵ روز گذشته ⏳</span>
          </div>
          <div className="odc-amount-row">
            <span className="odc-amount">{faNumber(145000000)} تومان</span>
            <span className="odc-note">«فراموش کردیم، شنبه واریز می‌کنیم»</span>
          </div>
        </div>
      )}

      {/* Card 3 */}
      {showC3 && (
        <div
          className="overdue-debt-card purple-warning"
          style={{
            transform: `translateY(${mix(25, 0, c3Spring)}px) scale(${mix(0.94, 1, c3Spring)})`,
            opacity: progress(t, c3At, 0.2),
          }}
        >
          <div className="odc-top">
            <span className="odc-name">فروشگاه سبلان</span>
            <span className="odc-aging-pill purple">ثبت دستی / دفتری 📝</span>
          </div>
          <div className="odc-amount-row">
            <span className="odc-amount">{faNumber(100000000)} تومان</span>
            <span className="odc-note">مبلغ در سررسید فاکتور مشخص نیست!</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 9. SMS & Settlement Actor (Reel 54 Scene 4): «حسابچه با یادآور پیامکی...» ─
function SmsSettlementActor({ t, plan }: { t: number; plan?: SentencePlan }) {
  // Brand anchor ALWAYS visible from t = 0
  const brandSpring = spring(t)

  // SMS Dispatch
  const smsCue = plan?.words.find((w) => w.action === 'sms-dispatch')
  const smsAt = smsCue?.start ?? 1.8
  const smsSpring = spring(t - smsAt)
  const showSms = t >= smsAt

  // Maturity calculation / راس‌گیری
  const calcCue = plan?.words.find((w) => w.action === 'maturity-calc')
  const calcAt = calcCue?.start ?? 3.2
  const calcSpring = spring(t - calcAt)
  const showCalc = t >= calcAt

  // Cards turn green
  const greenCue = plan?.words.find((w) => w.action === 'cards-settle-green')
  const greenAt = greenCue?.start ?? 4.4
  const isSettled = t >= greenAt

  // Cheque cleared gold/emerald stamp
  const goldCue = plan?.words.find((w) => w.action === 'cheque-cleared-gold')
  const goldAt = goldCue?.start ?? 5.0
  const goldSpring = spring(t - goldAt)
  const isCleared = t >= goldAt

  return (
    <div className="sms-settlement-container">
      {/* Brand Header — Anchored at Top from t = 0 */}
      <div
        className="brand-entry-header anchored-top"
        style={{
          transform: `translateY(${mix(-15, 0, brandSpring)}px)`,
          opacity: Math.min(1, Math.max(0.2, t / 0.15)),
        }}
      >
        <div className="brand-logo-circle">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2.2"
          >
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M7 8h10M7 12h7M7 16h9" />
          </svg>
        </div>
        <div className="brand-title-group">
          <span className="brand-name">حسابچه</span>
          <span className="brand-slogan">سامانه خودکار وصول مطالبات و راس‌گیری</span>
        </div>
      </div>

      {/* SMS Reminder Notification */}
      {showSms && (
        <div
          className="sms-dispatch-card"
          style={{
            transform: `translateY(${mix(20, 0, smsSpring)}px)`,
            opacity: progress(t, smsAt, 0.2),
          }}
        >
          <div className="sms-header">
            <span className="sms-tag">📱 پیامک خودکار یادآوری سررسید</span>
            <span className="sms-delivered">ارسال شد ✓✓</span>
          </div>
          <div className="sms-body">
            «مشتری گرامی، سررسید فاکتور شما امروز است. لینک پرداخت امن و آنلاین:...»
          </div>
        </div>
      )}

      {/* Advanced Maturity Engine (راس‌گیری) */}
      {showCalc && (
        <div
          className="maturity-calc-card"
          style={{
            transform: `scale(${mix(0.95, 1, calcSpring)})`,
            opacity: progress(t, calcAt, 0.2),
          }}
        >
          <div className="mcc-title">⚡ موتور راس‌گیری هوشمند حسابچه:</div>
          <div className="mcc-formula">راس وزنی ۳ فاکتور = تسویه امروز قبل از ۱۲:۰۰ ظهر</div>
          <div className={`mcc-result ${isSettled ? 'settled-glow' : ''}`}>
            {isSettled
              ? '✓ ۴۳۰,۰۰۰,۰۰۰ تومان وصول و به بانک واریز شد!'
              : 'در حال هماهنگی سررسیدها…'}
          </div>
        </div>
      )}

      {/* Cheque Status Cleared with Emerald Glow Pulse */}
      {isCleared && (
        <div
          className="cheque-cleared-banner emerald-pulse"
          style={{
            transform: `scale(${mix(0.85, 1, goldSpring)})`,
            opacity: progress(t, goldAt, 0.2),
          }}
        >
          <span className="gold-check">✓</span>
          <div className="gold-text">
            <strong>چک ۶۰۰ میلیون تومانی در موعد ۱۲:۰۰ پاس شد!</strong>
            <span>اعتبار تجاری در بازار کاملاً حفظ شد</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 10. CTA Conversion Actor (Reel 54 Scene 5): «همین حالا نسیه‌هات رو...» ────
function CtaConversion54Actor({ t, plan }: { t: number; plan?: SentencePlan }) {
  const enterAt = plan?.words[0]?.start ?? 0.2
  const buttonCue = plan?.words.find((w) => w.action === 'cta-button-pulse')
  const buttonAt = buttonCue?.start ?? 3.8

  const enterSpring = spring(t - enterAt)
  const buttonSpring = spring(t - buttonAt)

  return (
    <div
      className="cta-finish-container reel54-cta"
      style={{
        transform: `translateY(${mix(20, 0, enterSpring)}px)`,
        opacity: progress(t, enterAt, 0.3),
      }}
    >
      <div className="cta-brand-hero">
        <div className="cta-logo-glow">
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2.2"
          >
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <path d="M7 8h10M7 12h6M7 16h9" />
          </svg>
        </div>
        <h2 className="cta-main-title">حسابچه</h2>
        <p className="cta-subtitle">پایان چک‌های برگشتی و وصول خودکار مطالبات بازار</p>
      </div>

      <div className="cta-feature-checklist">
        <div className="cfc-item">✓ یادآور خودکار پیامکی به بدهکاران</div>
        <div className="cfc-item">✓ راس‌گیری پیشرفته چک‌ها و فاکتورها</div>
        <div className="cfc-item">✓ هشدار موعد سررسید قبل از ساعت ۱۲</div>
      </div>

      <div className="cta-action-stack">
        <div
          className="cta-action-card cyan-cta"
          style={{
            transform: `scale(${mix(0.96, 1, buttonSpring)})`,
          }}
        >
          <div className="cta-card-badge">شروع سریع و بدون هزینه اولیه</div>
          <div className="cta-card-action">شروع رایگان در: hisabche.com</div>
        </div>

        <div className="cta-search-prompt">
          <span>در گوگل جستجو کنید: </span>
          <strong>حسابچه</strong>
        </div>
      </div>

      <div className="cta-web-footer">hisabche.com</div>
    </div>
  )
}
