// ============================================
// Reel #59 — Word-Synchronized Tax Audit & Moadian Shield Actors
//
// Studio-Grade Motion Architecture (Apple/Linear-Grade SaaS):
// - Hard Rule 1: Zero blinking numbers, continuous readability
// - Hard Rule 2: Physical motion (spring entrances, clip reveals, tactile stamps)
// - Hard Rule 3: Visual continuity between tax penalty and official compliance
// - Hard Rule 4: 9:16 safe composition, optical vertical centering (Y: 45%-55%)
// - Hard Rule 5: CTA entered at t=0.3s with >= 3.8s readable full-opacity hold
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { clamp, mix, progress, pulse, studioSpring, studioSpringEnter } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'
import { StudioOdometer } from '../ui/StudioOdometer'

interface R59ActorProps {
  t: number
  plan?: SentencePlan | undefined
}

/** Dispatches a `r59-*` actor id to its visual component. */
export function Reel59TaxActor({
  actor,
  t,
  plan,
}: {
  actor: string
  t: number
  plan?: SentencePlan | undefined
}) {
  if (actor === 'r59-tax-hook') return <TaxHookActor t={t} plan={plan} />
  if (actor === 'r59-discrepancy-matrix') return <DiscrepancyMatrixActor t={t} plan={plan} />
  if (actor === 'r59-legacy-risk') return <LegacyRiskActor t={t} plan={plan} />
  if (actor === 'r59-moadian-shield') return <MoadianShieldActor t={t} plan={plan} />
  if (actor === 'r59-cta-tax') return <CtaTaxActor t={t} plan={plan} />
  return null
}

function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  return plan?.words.find((w) => w.action === action)?.start ?? fallback
}

// ─── 1. Tax Hook: «برگ تشخیص مالیات ۱۸۰ میلیونی رسید؛ چرا دفاتر رد شد؟» ───────
function TaxHookActor({ t, plan }: R59ActorProps) {
  const enterAt = cueAt(plan, 'tax-notice-enter', 0.2)
  const penaltyAt = cueAt(plan, 'penalty-odometer', 1.0)
  const stampAt = cueAt(plan, 'reject-stamp', 3.8)
  const stampSpring = studioSpring(Math.max(0, t - stampAt))

  return (
    <div className="scene-optical-center r59-scene">
      {/* ── Headline Block (Title Zone: Y ~ 20%) ── */}
      <div
        className="r59-headline"
        style={studioSpringEnter(t, enterAt - 0.15, { y: 20, scale: 0.94 })}
      >
        <span className="r59-badge red">هشدار ممیزی مالیاتی</span>
        <h2 className="r59-title">برگ تشخیص مالیات ۱۸۰ میلیونی!</h2>
      </div>

      {/* ── Official Assessment Card (Primary Visual Zone: Optical Center) ── */}
      <div
        className="r59-card r59-tax-card"
        style={studioSpringEnter(t, enterAt, { y: 25, scale: 0.94 })}
      >
        <div className="r59-card-header">
          <div className="r59-header-text">
            <span className="r59-card-id">برگ تشخیص سازمان امور مالیاتی</span>
            <span className="r59-card-meta">شماره پرونده: ۷۸۲/۱۴۰۵ · ممیزی عملکرد</span>
          </div>
          <span className="r59-status-pill red">رد دفاتر قانونی</span>
        </div>

        {/* Big Penalty Amount Row - Rock-Solid StudioOdometer */}
        <div className="r59-penalty-box">
          <span className="r59-penalty-label">مبلغ مالیات تشخیصی و جرایم کتمان</span>
          <div className="r59-penalty-val">
            <StudioOdometer
              value={180}
              t={t}
              startAt={penaltyAt}
              duration={1.0}
              tone="red"
              unit="میلیون"
              fontSize={50}
            />
          </div>
        </div>

        {/* Reason Footnote */}
        <div className="r59-card-footer">
          <span>
            علت تشخیص علی‌الرأس: <strong>عدم تطابق با سامانه مودیان</strong>
          </span>
          <span className="r59-tag-warn">ماده ۱۹۲ ق.م.م</span>
        </div>

        {/* Tactile Red Stamp Slam */}
        {t >= stampAt && (
          <div
            className="r59-stamp red-stamp"
            style={{
              transform: `rotate(-8deg) scale(${mix(0.65, 1, stampSpring)})`,
              opacity: clamp(progress(t, stampAt, 0.1)),
            }}
          >
            دفاتر غیرقابل قبول!
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 2. Discrepancy Matrix: «چون فاکتورهای دستی با سامانه مودیان مغایرت داشت!» ─
function DiscrepancyMatrixActor({ t, plan }: R59ActorProps) {
  const diffAt = cueAt(plan, 'paper-diff', 0.5)
  const moadianAt = cueAt(plan, 'moadian-portal', 1.8)
  const alertAt = cueAt(plan, 'discrepancy-alert', 2.8)

  return (
    <div className="scene-optical-center r59-scene">
      <div
        className="r59-headline"
        style={studioSpringEnter(t, diffAt - 0.15, { y: 20, scale: 0.94 })}
      >
        <span className="r59-badge amber">مغایرت سامانه‌ای</span>
        <h2 className="r59-title">فاکتور دستی در برابر سامانه مودیان</h2>
      </div>

      <div
        className="r59-card r59-matrix-card"
        style={studioSpringEnter(t, diffAt, { y: 25, scale: 0.94 })}
      >
        <div className="r59-matrix-grid">
          {/* Column 1: Store manual invoices */}
          <div className="r59-matrix-col manual">
            <span className="r59-col-title">دفتر دستی فروشگاه</span>
            <div className="r59-col-number">
              <StudioOdometer
                value={45}
                t={t}
                startAt={diffAt}
                duration={0.8}
                tone="amber"
                unit="فاکتور صادرشده"
                fontSize={32}
              />
            </div>
            <span className="r59-col-note">فقط روی کاغذ ثبت شد</span>
          </div>

          {/* Column 2: Moadian Portal recorded */}
          <div
            className="r59-matrix-col moadian"
            style={studioSpringEnter(t, moadianAt, { y: 15, scale: 0.95 })}
          >
            <span className="r59-col-title">ثبت‌شده در مودیان</span>
            <div className="r59-col-number">
              <span className="r59-zero-badge">۰ فاکتور!</span>
            </div>
            <span className="r59-col-note red">کتمان درآمد تلقی شد</span>
          </div>
        </div>

        {/* Discrepancy Alert */}
        <div
          className="r59-alert-bar"
          style={studioSpringEnter(t, alertAt, { y: 15, scale: 0.95 })}
        >
          <span className="r59-alert-icon">⚠️</span>
          <span>۴۵ فاکتور ارسال‌نشده = جریمه غیرقابل بخشودگی!</span>
        </div>
      </div>
    </div>
  )
}

// ─── 3. Legacy Risk: «اکسل و نرم‌افزار قدیمی کد رهگیری مالیاتی تولید نمی‌کنه!» ──
function LegacyRiskActor({ t, plan }: R59ActorProps) {
  const excelAt = cueAt(plan, 'excel-vulnerable', 0.5)
  const taxIdAt = cueAt(plan, 'tax-id-missing', 2.2)
  const strikeAt = cueAt(plan, 'penalty-strike', 3.8)
  const stampSpring = studioSpring(Math.max(0, t - strikeAt))

  return (
    <div className="scene-optical-center r59-scene">
      <div
        className="r59-headline"
        style={studioSpringEnter(t, excelAt - 0.15, { y: 20, scale: 0.94 })}
      >
        <span className="r59-badge red">نقص فنی نرم‌افزار قدیمی</span>
        <h2 className="r59-title">اکسل کد رهگیری مودیان ندارد!</h2>
      </div>

      <div
        className="r59-card r59-legacy-card"
        style={studioSpringEnter(t, excelAt, { y: 25, scale: 0.94 })}
      >
        <div className="r59-legacy-sheet">
          <div className="r59-sheet-bar">
            <span>سیستم سنتی / فایل اکسل</span>
            <span className="r59-missing-tag">فاقد توکن مالیاتی</span>
          </div>

          <div className="r59-sheet-items">
            <div className="r59-sheet-item">
              <span>فاکتور #۵۴۰۱</span>
              <span className="red">❌ بدون کد ۲۲ رقمی</span>
            </div>
            <div className="r59-sheet-item">
              <span>فاکتور #۵۴۰۲</span>
              <span className="red">❌ بدون کلید عمومی حافظه</span>
            </div>
            <div className="r59-sheet-item">
              <span>فاکتور #۵۴۰۳</span>
              <span className="red">❌ رد سیستمی در کارپوشه</span>
            </div>
          </div>
        </div>

        <div
          className="r59-strike-box"
          style={studioSpringEnter(t, taxIdAt, { y: 15, scale: 0.95 })}
        >
          <span>
            نرخ جریمه: <strong>۱۰٪ کل فروش ابرازشده</strong>
          </span>
        </div>

        {t >= strikeAt && (
          <div
            className="r59-stamp red-stamp"
            style={{
              transform: `rotate(-6deg) scale(${mix(0.65, 1, stampSpring)})`,
              opacity: clamp(progress(t, strikeAt, 0.1)),
            }}
          >
            جریمه سنگین قطعی!
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 4. Moadian Shield: «حسابچه با یک کلیک فاکتور رو به سامانه مودیان می‌فرسته!» ─
function MoadianShieldActor({ t, plan }: R59ActorProps) {
  const brandAt = cueAt(plan, 'brand-anchor', 0.25)
  const clickAt = cueAt(plan, 'one-click-transmit', 1.2)
  const shieldAt = cueAt(plan, 'moadian-shield', 2.8)
  const verifiedAt = cueAt(plan, 'verified-stamp', 3.8)
  const stampSpring = studioSpring(Math.max(0, t - verifiedAt))

  return (
    <div className="scene-optical-center r59-scene">
      {/* ── Brand Entry ── */}
      <div
        className="brand-entry-header r59-brand"
        style={studioSpringEnter(t, brandAt, { y: 18, scale: 0.96 })}
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
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div className="brand-title-group">
          <span className="brand-name">حسابچه</span>
          <span className="brand-slogan">اتصال مستقیم به سامانه مودیان و کارپوشه مالیاتی</span>
        </div>
      </div>

      {/* ── Official Compliance Panel ── */}
      <div
        className="r59-card r59-solution-card"
        style={studioSpringEnter(t, clickAt, { y: 25, scale: 0.94 })}
      >
        <div className="r59-solution-header">
          <span className="r59-status-pill green">✓ ارسال خودکار و بلادرنگ</span>
          <span className="r59-fiscal-id">کد ۲۲ رقمی منحصربفرد تولید شد</span>
        </div>

        <div className="r59-compliance-row">
          <div className="r59-comp-stat">
            <span className="r59-stat-label">وضعیت کارپوشه:</span>
            <strong className="green">تایید نهایی مودیان</strong>
          </div>
          <div className="r59-comp-stat">
            <span className="r59-stat-label">جریمه مالیاتی:</span>
            <strong className="green">{faNumber(0)} ریال</strong>
          </div>
        </div>

        <div
          className="r59-shield-footnote"
          style={studioSpringEnter(t, shieldAt, { y: 15, scale: 0.95 })}
        >
          <span>🛡️ معافیت‌های قانونی و ماده ۱۳۱ به صورت خودکار اعمال شد</span>
        </div>

        {t >= verifiedAt && (
          <div
            className="r59-stamp emerald-stamp"
            style={{
              transform: `rotate(-5deg) scale(${mix(0.65, 1, stampSpring)})`,
              opacity: clamp(progress(t, verifiedAt, 0.1)),
            }}
          >
            تایید رسمی دارایی ✓
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 5. CTA Tax: «دفاترت رو تاییدیه دارایی کن؛ همین حالا در حسابچه.» ──────────
function CtaTaxActor({ t, plan }: R59ActorProps) {
  // Hard Rule 5: CTA card enters early at t=0.3s (giving >= 3.8s readable hold)
  const cardEnterAt = 0.3
  const badgeAt = cueAt(plan, 'moafiyat-badge', 1.0)
  const pulseAt = cueAt(plan, 'cta-button-pulse', 2.75)
  const glow = pulse(t, pulseAt, pulseAt + 1.25, 0.85)

  return (
    <div className="scene-optical-center r59-scene r59-cta-wrap">
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
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <h2 className="cta-main-title">حسابچه</h2>
        <p className="cta-subtitle">سپر مالیاتی هوشمند، آرامش خاطر مودیان</p>
      </div>

      <div className="r59-cta-badges" style={studioSpringEnter(t, badgeAt, { y: 18, scale: 0.95 })}>
        <span className="r59-cta-badge">✓ صدور فاکتور الکترونیک نوع ۱ و ۲</span>
        <span className="r59-cta-badge">✓ صفر ریال جریمه ممیزی</span>
      </div>

      <div className="cta-action-stack">
        <div
          className="cta-action-card cyan-cta"
          style={{
            ...studioSpringEnter(t, cardEnterAt, { y: 22, scale: 0.94 }),
            boxShadow: `0 0 ${mix(12, 38, glow)}px rgba(34, 211, 238, ${mix(0.28, 0.85, glow)})`,
          }}
        >
          <div className="cta-card-badge">تاییدیه ۱۰۰٪ سامانه مودیان</div>
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
