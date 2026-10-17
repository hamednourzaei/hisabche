// ============================================
// Reel #64 — «کوری بهای تمام‌شده کارگاه»
//
// Motion Engine: Zero Clutter · One Focal Stage · Real Persian
//
// Guardrails:
// 1. One Focal Stage: exactly ONE dominant centered visual (Y in [42%, 58%]).
// 2. Zero duplicated narration: spoken dialogue lives exclusively in subtitles.
// 3. Strict text budget: <= 6 words per label on-stage.
// 4. Zero green line / divider artifacts.
// 5. Authentic Persian: natural bazaar/workshop terminology.
// 6. AV Sync Law: every sounded word has an action, read via cueAt.
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { clamp, ease, mix, progress, pulse, studioSpringEnter } from '../engine/anim'

interface R64ActorProps {
  t: number
  plan?: SentencePlan | undefined
}

/** Dispatches an `r64-*` actor id to its visual component. */
export function Reel64CogsActor({
  actor,
  t,
  plan,
}: {
  actor: string
  t: number
  plan?: SentencePlan | undefined
}) {
  if (actor === 'r64-hook') return <HookActor t={t} plan={plan} />
  if (actor === 'r64-guess-leak') return <GuessLeakActor t={t} plan={plan} />
  if (actor === 'r64-cogs-breakdown') return <CogsBreakdownActor t={t} plan={plan} />
  if (actor === 'r64-bom-solution') return <BomSolutionActor t={t} plan={plan} />
  if (actor === 'r64-cta') return <CtaActor t={t} plan={plan} />
  return null
}

function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  return plan?.words.find((w) => w.action === action)?.start ?? fallback
}

// ─── 1. Beat A: «تولیدت رکورد زد؛ ولی چرا حسابت آخر ماه خالیه؟» ─────────────
function HookActor({ t, plan }: R64ActorProps) {
  const stampAt = cueAt(plan, 'record-stamp', 0.2)
  const walletAt = cueAt(plan, 'empty-wallet', 2.13)

  const walletEnter = clamp(progress(t, walletAt, 0.45))
  const isWalletActive = t >= walletAt

  return (
    <div className="r64-stage">
      <div className="r64-center-anchor" style={studioSpringEnter(t, stampAt, { y: 28 })}>
        {/* Record Badge */}
        <div className="r64-hero-badge">
          <div className="r64-badge-header">
            <span className="r64-glow-dot amber" />
            <span className="r64-badge-title">کارگاه تولیدی البرز</span>
          </div>
          <div className="r64-metric-row">
            <span className="r64-metric-val">۱۰۰ عدد</span>
            <span className="r64-metric-lbl">تیراژ ماهانه</span>
          </div>
        </div>

        {/* Empty Wallet Alarm Card */}
        {isWalletActive && (
          <div
            className="r64-alarm-pill"
            style={{
              opacity: walletEnter,
              transform: `translateY(${mix(16, 0, ease(walletEnter))}px)`,
            }}
          >
            <span className="r64-alarm-icon">⚠️</span>
            <div className="r64-alarm-text">
              <span className="r64-alarm-title">موجودی دخل پای کرکره</span>
              <span className="r64-alarm-num">۰ ریال!</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 2. Beat B: «چون قیمت فروش رو حسی بستی، نه با بهای تمام‌شده.» ───────────
function GuessLeakActor({ t, plan }: R64ActorProps) {
  const tagAt = cueAt(plan, 'guess-tag', 0.53)
  const fractureAt = cueAt(plan, 'tag-fracture', 3.03)

  const isFractured = t >= fractureAt
  const fractureP = clamp(progress(t, fractureAt, 0.35))
  const shake = t >= fractureAt && t < fractureAt + 0.3 ? Math.sin((t - fractureAt) * 50) * 4 : 0

  return (
    <div className="r64-stage">
      <div
        className="r64-center-anchor"
        style={{
          ...studioSpringEnter(t, tagAt, { y: 22 }),
          transform: `translateY(${shake}px)`,
        }}
      >
        <div className={`r64-price-tag ${isFractured ? 'fractured' : ''}`}>
          <div className="r64-tag-ribbon">برچسب قیمت دستی</div>
          <div className="r64-tag-price">
            <span className="r64-tag-amount">۶۰۰٬۰۰۰</span>
            <span className="r64-tag-unit">تومان</span>
          </div>
          <div className="r64-tag-sub">قیمت بر مبنای حدس</div>

          {isFractured && (
            <div
              className="r64-tag-strike"
              style={{
                opacity: fractureP,
                transform: `scale(${mix(0.8, 1, ease(fractureP))}) rotate(-6deg)`,
              }}
            >
              خطای برآورد حسی
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 3. Beat C: «چسب، یراق و ضایعات رو ندیدی؛ کارگاه با ضرر می‌فروخت!» ───────
function CogsBreakdownActor({ t, plan }: R64ActorProps) {
  const pillAt = cueAt(plan, 'glue-scrap-pill', 0.25)
  const strikeAt = cueAt(plan, 'loss-strike', 3.43)

  const stackEnter = clamp(progress(t, pillAt, 0.4))
  const isLoss = t >= strikeAt
  const lossP = clamp(progress(t, strikeAt, 0.35))

  return (
    <div className="r64-stage">
      <div className="r64-center-anchor" style={studioSpringEnter(t, pillAt, { y: 24 })}>
        <div className="r64-breakdown-card">
          <div className="r64-card-headline">
            <span>شکست هزینه‌های واقعی</span>
            <span className="r64-card-chip red">محاسبه نشده</span>
          </div>

          <div className="r64-cost-stack" style={{ opacity: stackEnter }}>
            <div className="r64-cost-row">
              <span className="r64-cost-name">چوب راش</span>
              <span className="r64-cost-val">۴۰۰٬۰۰۰ ت</span>
            </div>
            <div className="r64-cost-row">
              <span className="r64-cost-name">یراق، چسب و رنگ</span>
              <span className="r64-cost-val">۱۰۰٬۰۰۰ ت</span>
            </div>
            <div className="r64-cost-row warning">
              <span className="r64-cost-name">ضایعات و اسقاط</span>
              <span className="r64-cost-val">۱۵۰٬۰۰۰ ت</span>
            </div>
          </div>

          <div className="r64-total-row">
            <span>بهای تمام‌شده واقعی:</span>
            <span className="r64-total-val">۶۵۰٬۰۰۰ تومان</span>
          </div>

          {isLoss && (
            <div
              className="r64-loss-alert"
              style={{
                opacity: lossP,
                transform: `scale(${mix(0.85, 1, ease(lossP))})`,
              }}
            >
              <span>❌ زیان در هر صندلی:</span>
              <span className="r64-loss-num">۵۰٬۰۰۰- تومان</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 4. Beat D: «تو فرمول ساخت حسابچه، بهای هر قطعه دقیق محاسبه میشه.» ───────
function BomSolutionActor({ t, plan }: R64ActorProps) {
  const bomAt = cueAt(plan, 'bom-assembly', 0.43)
  const marginAt = cueAt(plan, 'margin-confirm', 2.93)

  const isConfirmed = t >= marginAt
  const confirmP = clamp(progress(t, marginAt, 0.35))

  return (
    <div className="r64-stage">
      <div className="r64-center-anchor" style={studioSpringEnter(t, bomAt, { y: 22 })}>
        <div className="r64-solution-card">
          <div className="r64-solution-top">
            <span className="r64-app-pill">حسابچه · فرمول ساخت (BOM)</span>
          </div>

          <div className="r64-product-title">صندلی غذاخوری مدل راش</div>

          <div className="r64-pricing-matrix">
            <div className="r64-matrix-box">
              <span className="r64-box-label">بهای تمام‌شده</span>
              <span className="r64-box-val">۶۵۰٬۰۰۰ ت</span>
            </div>
            <div className="r64-matrix-arrow">←</div>
            <div className="r64-matrix-box primary">
              <span className="r64-box-label">نرخ فروش مصوب</span>
              <span className="r64-box-val">۸۵۰٬۰۰۰ ت</span>
            </div>
          </div>

          {isConfirmed && (
            <div
              className="r64-margin-badge"
              style={{
                opacity: confirmP,
                transform: `translateY(${mix(10, 0, ease(confirmP))}px)`,
              }}
            >
              <span className="r64-check-glyph">✓</span>
              <span>۲۰۰٬۰۰۰ تومان سود قطعی تضمین شد</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 5. Beat E: «سود واقعی کارگاهت رو حساب کن؛ شروع رایگان در حسابچه.» ───────
function CtaActor({ t, plan }: R64ActorProps) {
  const cardAt = cueAt(plan, 'cta-card', 0.2)
  const pulseAt = cueAt(plan, 'cta-pulse', 2.7)
  const isPulsing = pulse(t, pulseAt, pulseAt + 1.2, 0.8)

  return (
    <div className="r64-stage">
      <div className="r64-center-anchor" style={studioSpringEnter(t, cardAt, { y: 24 })}>
        <div
          className="r64-cta-card"
          style={{
            boxShadow: isPulsing
              ? '0 0 50px rgba(16, 185, 129, 0.45), 0 20px 40px rgba(0,0,0,0.6)'
              : '0 20px 40px rgba(0,0,0,0.6)',
          }}
        >
          <div className="r64-cta-brand">حسابچه</div>
          <div className="r64-cta-sub">فرمول ساخت و محاسبه سود واقعی</div>

          <div
            className="r64-cta-btn"
            style={{
              transform: isPulsing ? 'scale(1.04)' : 'scale(1)',
              background: isPulsing
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            }}
          >
            <span>شروع رایگان</span>
          </div>

          <div className="r64-cta-domain">hisabche.com</div>
        </div>
      </div>
    </div>
  )
}
