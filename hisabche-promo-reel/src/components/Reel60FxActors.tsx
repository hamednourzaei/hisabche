// ============================================
// Reel #60 — «دالر بالا رفت؛ ۴٬۰۰۰ افغانی کجا رفت؟»
//
// One invoice, one set of numbers, held across all five scenes:
//   1,000 USD invoiced at 70  → 70,000 AFN receivable (frozen on the invoice)
//   paid later at 74          → 74,000 AFN in the till
//   difference                →  4,000 AFN exchange gain (its own ledger line)
//
// Every claim is the product's real behaviour: an invoice in another currency
// carries its rate (and is refused without one), payment is valued at the
// day's rate, and the difference is booked to «سود و زیان تسعیر».
//
// Hard rules: numbers never blink (introduce → hold → strike/transform),
// physical motion (springs, slides, strike-through), optical centre 45–55%,
// CTA card in at 0.3s with a long full-opacity hold.
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { clamp, mix, progress, pulse, studioSpring, studioSpringEnter } from '../engine/anim'
import { StudioOdometer } from '../ui/StudioOdometer'

interface R60ActorProps {
  t: number
  plan?: SentencePlan | undefined
}

/** Dispatches an `r60-*` actor id to its visual component. */
export function Reel60FxActor({
  actor,
  t,
  plan,
}: {
  actor: string
  t: number
  plan?: SentencePlan | undefined
}) {
  if (actor === 'r60-rate-hook') return <RateHookActor t={t} plan={plan} />
  if (actor === 'r60-mismatch') return <MismatchActor t={t} plan={plan} />
  if (actor === 'r60-overwritten-rate') return <OverwrittenRateActor t={t} plan={plan} />
  if (actor === 'r60-fx-lock') return <FxLockActor t={t} plan={plan} />
  if (actor === 'r60-cta') return <CtaActor t={t} plan={plan} />
  return null
}

function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  return plan?.words.find((w) => w.action === action)?.start ?? fallback
}

/** A rate that slides 70 → 74 monotonically: no modulo, no blink. */
function RateTicker({
  t,
  from,
  to,
  at,
  dur,
}: {
  t: number
  from: number
  to: number
  at: number
  dur: number
}) {
  const p = clamp(progress(t, at, dur))
  const value = Math.round(mix(from, to, p) * 10) / 10
  return (
    <span className="r60-ticker-value">
      {new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(value)}
    </span>
  )
}

// ─── 1. Hook: «فاکتور هزار دالری دیروز؛ امروز چند افغانی می‌ارزه؟» ────────────
function RateHookActor({ t, plan }: R60ActorProps) {
  const invoiceAt = cueAt(plan, 'invoice-enter', 0.25)
  const rateAt = cueAt(plan, 'rate-climb', 2.2)
  const questionAt = cueAt(plan, 'question-hold', 3.2)

  return (
    <div className="scene-optical-center r60-scene">
      <div className="r60-headline" style={studioSpringEnter(t, invoiceAt - 0.15, { y: 18 })}>
        <span className="r60-badge amber">نرخ دالر امروز</span>
        <h2 className="r60-title">
          فاکتور دیروز، <span className="r60-hl-amber">نرخ امروز</span>
        </h2>
      </div>

      <div className="r60-card" style={studioSpringEnter(t, invoiceAt, { y: 26 })}>
        <div className="r60-card-row">
          <span className="r60-muted">فاکتور فروش · دیروز</span>
          <span className="r60-pill cyan">دالر</span>
        </div>
        <div className="r60-big">
          <StudioOdometer
            value={1000}
            t={t}
            startAt={invoiceAt + 0.2}
            duration={0.9}
            tone="white"
            unit="دالر"
            fontSize={46}
          />
        </div>
      </div>

      <div className="r60-card r60-ticker" style={studioSpringEnter(t, rateAt - 0.1, { y: 26 })}>
        <span className="r60-muted">هر دالر</span>
        <RateTicker t={t} from={70} to={74} at={rateAt} dur={1.0} />
        <span className="r60-muted">افغانی</span>
        <span
          className="r60-arrow-up"
          style={{
            transform: `translateY(${mix(10, 0, studioSpring(Math.max(0, t - rateAt)))}px)`,
            opacity: clamp(progress(t, rateAt, 0.2)),
          }}
        >
          ▲
        </span>
      </div>

      <div className="r60-question" style={studioSpringEnter(t, questionAt, { y: 14, scale: 0.9 })}>
        حالا چند افغانی می‌ارزه؟
      </div>
    </div>
  )
}

// ─── 2. «دفترت می‌گه هفتاد هزار؛ صندوقت هفتاد و چهار هزار!» ──────────────────
function MismatchActor({ t, plan }: R60ActorProps) {
  const bookAt = cueAt(plan, 'book-card', 0.4)
  const tillAt = cueAt(plan, 'till-card', 1.9)
  const diffAt = cueAt(plan, 'diff-alert', 3.0)
  const shake =
    t >= diffAt && t < diffAt + 0.35
      ? Math.sin((t - diffAt) * 60) * 3 * (1 - (t - diffAt) / 0.35)
      : 0

  return (
    <div className="scene-optical-center r60-scene">
      <div className="r60-headline" style={studioSpringEnter(t, bookAt - 0.2, { y: 18 })}>
        <span className="r60-badge red">مغایرت حساب</span>
        <h2 className="r60-title">دو عدد برای یک فاکتور</h2>
      </div>

      <div className="r60-card" style={studioSpringEnter(t, bookAt, { x: 40, y: 0 })}>
        <div className="r60-card-row">
          <span className="r60-muted">طلب در دفتر · نرخ ۷۰</span>
        </div>
        <StudioOdometer
          value={70000}
          t={t}
          startAt={bookAt + 0.15}
          duration={0.9}
          tone="cyan"
          unit="افغانی"
          fontSize={40}
        />
      </div>

      <div className="r60-card" style={studioSpringEnter(t, tillAt, { x: -40, y: 0 })}>
        <div className="r60-card-row">
          <span className="r60-muted">پول در صندوق · نرخ ۷۴</span>
        </div>
        <StudioOdometer
          value={74000}
          t={t}
          startAt={tillAt + 0.15}
          duration={0.9}
          tone="green"
          unit="افغانی"
          fontSize={40}
        />
      </div>

      <div
        className="r60-card r60-diff red"
        style={{
          ...studioSpringEnter(t, diffAt, { y: 20, scale: 0.9 }),
          translate: `${shake}px 0`,
        }}
      >
        <span>اختلاف</span>
        <StudioOdometer
          value={4000}
          t={t}
          startAt={diffAt + 0.1}
          duration={0.7}
          tone="red"
          unit="افغانی"
          fontSize={34}
        />
        <span className="r60-muted">کجا ثبت شد؟</span>
      </div>
    </div>
  )
}

// ─── 3. «تو اکسل نرخ رو عوض می‌کنی؛ نرخ فاکتور پاک می‌شه و اختلاف گم.» ───────
function OverwrittenRateActor({ t, plan }: R60ActorProps) {
  const sheetAt = cueAt(plan, 'sheet-enter', 0.3)
  const overwriteAt = cueAt(plan, 'overwrite', 1.7)
  const lostAt = cueAt(plan, 'diff-lost', 3.4)
  const strike = clamp(progress(t, overwriteAt, 0.45))
  const newRate = studioSpring(Math.max(0, t - (overwriteAt + 0.35)))
  const drift = clamp(progress(t, lostAt, 0.9))

  return (
    <div className="scene-optical-center r60-scene">
      <div className="r60-headline" style={studioSpringEnter(t, sheetAt - 0.15, { y: 18 })}>
        <span className="r60-badge amber">ریشه‌ی مشکل</span>
        <h2 className="r60-title">اکسل نرخ دیروز را نگه نمی‌دارد</h2>
      </div>

      <div className="r60-card r60-sheet" style={studioSpringEnter(t, sheetAt, { y: 26 })}>
        <div className="r60-sheet-head">
          <span>مشتری</span>
          <span>دالر</span>
          <span>نرخ</span>
          <span>افغانی</span>
        </div>
        <div className="r60-sheet-row">
          <span>نوری</span>
          <span>۱٬۰۰۰</span>
          <span className="r60-rate-cell">
            <span className="r60-old-rate">
              ۷۰
              <span className="r60-strike" style={{ transform: `scaleX(${strike})` }} />
            </span>
            <span
              className="r60-new-rate"
              style={{
                opacity: clamp(newRate * 1.4),
                transform: `translateY(${mix(10, 0, newRate)}px)`,
              }}
            >
              ۷۴
            </span>
          </span>
          <span>۷۴٬۰۰۰</span>
        </div>
      </div>

      <div
        className="r60-card r60-lost"
        style={{
          ...studioSpringEnter(t, lostAt, { y: 16, scale: 0.92 }),
          // The difference visibly drifts out of the books — it never blinks.
          translate: `${mix(0, -26, drift)}px ${mix(0, 8, drift)}px`,
        }}
      >
        <span className="r60-hl-red">۴٬۰۰۰ افغانی</span>
        <span className="r60-muted">نه سود، نه زیان — هیچ‌جا ثبت نشد</span>
      </div>
    </div>
  )
}

// ─── 4. «حسابچه نرخ فاکتور رو نگه می‌داره و چهار هزار رو سود تسعیر ثبت می‌کنه.»
function FxLockActor({ t, plan }: R60ActorProps) {
  const brandAt = cueAt(plan, 'brand-anchor', 0.25)
  const lockAt = cueAt(plan, 'rate-lock', 1.3)
  const journalAt = cueAt(plan, 'journal-post', 2.9)
  const gainAt = cueAt(plan, 'fx-gain', 3.7)
  const lock = studioSpring(Math.max(0, t - lockAt))

  const lines: Array<{
    side: string
    account: string
    amount: number
    at: number
    tone: 'cyan' | 'green' | 'purple'
  }> = [
    { side: 'بدهکار', account: 'صندوق', amount: 74000, at: journalAt, tone: 'green' },
    { side: 'بستانکار', account: 'طلب از نوری', amount: 70000, at: journalAt + 0.35, tone: 'cyan' },
    { side: 'بستانکار', account: 'سود و زیان تسعیر ارز', amount: 4000, at: gainAt, tone: 'purple' },
  ]

  return (
    <div className="scene-optical-center r60-scene">
      <div className="r60-headline" style={studioSpringEnter(t, brandAt, { y: 18 })}>
        <span className="r60-badge cyan">حسابچه</span>
        <h2 className="r60-title">
          نرخ فاکتور <span className="r60-hl-cyan">قفل</span>، اختلاف{' '}
          <span className="r60-hl-purple">ثبت</span>
        </h2>
      </div>

      <div className="r60-card r60-locked" style={studioSpringEnter(t, brandAt + 0.2, { y: 24 })}>
        <div className="r60-card-row">
          <span>فاکتور ۱٬۰۰۰ دالر</span>
          <span
            className="r60-lock"
            style={{
              transform: `scale(${mix(0.4, 1, lock)}) rotate(${mix(-25, 0, lock)}deg)`,
              opacity: clamp(lock * 1.5),
            }}
          >
            🔒 نرخ ۷۰
          </span>
        </div>
        <div className="r60-card-row r60-muted">
          <span>پرداخت امروز</span>
          <span>نرخ ۷۴</span>
        </div>
      </div>

      <div
        className="r60-card r60-journal"
        style={studioSpringEnter(t, journalAt - 0.15, { y: 24 })}
      >
        <div className="r60-journal-title">سند دفتر کل — خودکار</div>
        {lines.map((line) => (
          <div
            key={line.account}
            className="r60-journal-row"
            style={studioSpringEnter(t, line.at, { x: 30, y: 0 })}
          >
            <span className="r60-side">{line.side}</span>
            <span className="r60-account">{line.account}</span>
            <StudioOdometer
              value={line.amount}
              t={t}
              startAt={line.at + 0.1}
              duration={0.6}
              tone={line.tone}
              fontSize={20}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 5. CTA: «حسابت به ارز خودت؛ شروع رایگان در حسابچه.» ─────────────────────
function CtaActor({ t, plan }: R60ActorProps) {
  // Hard Rule 5: the card is in at 0.3s and stays fully readable to the end.
  const cardAt = cueAt(plan, 'cta-card', 0.3)
  const pulseAt = cueAt(plan, 'cta-pulse', 2.4)
  const glow = pulse(t, pulseAt, pulseAt + 1.6, 0.9)

  return (
    <div className="scene-optical-center r60-scene">
      <div className="r60-headline" style={studioSpringEnter(t, 0.15, { y: 16 })}>
        <span className="r60-badge cyan">دالر · افغانی · طلای گرمی</span>
        <h2 className="r60-title">حسابت، به ارز خودت</h2>
      </div>

      <div
        className="r60-card r60-cta"
        style={{
          ...studioSpringEnter(t, cardAt, { y: 26, scale: 0.92 }),
          boxShadow: `0 0 ${24 + 26 * glow}px rgba(34, 211, 238, ${0.25 + 0.3 * glow}), 0 20px 48px rgba(0,0,0,0.7)`,
        }}
      >
        <div className="r60-cta-lines">
          <span>✓ نرخ روز روی هر فاکتور ارزی</span>
          <span>✓ سود و زیان تسعیر، جدا و روشن</span>
          <span>✓ فاکتور ارزی بدون نرخ ثبت نمی‌شود</span>
        </div>
        <div className="r60-cta-button">شروع رایگان</div>
        <div className="r60-url">hisabche.com</div>
      </div>
    </div>
  )
}
