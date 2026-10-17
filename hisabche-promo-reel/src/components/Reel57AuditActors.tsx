// ============================================
// Reel #57 — Word-Synchronized Forensic Audit & Fraud Shield Actors
//
// Studio-Grade Motion Architecture (Apple/Linear-Grade SaaS):
// - Cyber-Audit Dark Glass & Neon Amber/Rose/Cyan Glows
// - Forensic Invoice Diff Inspector (Tamper Slicing & Price Drop)
// - Real-time Holographic Audit Log Stream
// - High-Contrast Numeric Odometer Roll (StudioOdometer)
// - Zero Jank, Frame-Deterministic Spring Physics
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { clamp, ease, mix, progress, pulse, studioSpring, studioSpringEnter } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'
import { StudioOdometer } from '../ui/StudioOdometer'

interface R57ActorProps {
  t: number
  plan?: SentencePlan | undefined
}

/** Dispatches a `r57-*` actor id to its visual component. */
export function Reel57AuditActor({
  actor,
  t,
  plan,
}: {
  actor: string
  t: number
  plan?: SentencePlan | undefined
}) {
  if (actor === 'r57-forensic-hook') return <ForensicHookActor t={t} plan={plan} />
  if (actor === 'r57-cash-gap') return <CashGapActor t={t} plan={plan} />
  if (actor === 'r57-legacy-vulnerability') return <LegacyVulnerabilityActor t={t} plan={plan} />
  if (actor === 'r57-security-shield') return <SecurityShieldActor t={t} plan={plan} />
  if (actor === 'r57-cta-vault') return <CtaVaultActor t={t} plan={plan} />
  return null
}

/** Scene-local start of the first word cue carrying this action. */
function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  return plan?.words.find((w) => w.action === action)?.start ?? fallback
}

// ─── 1. Forensic Hook: «فاکتور ۷۵ میلیونی دیروز کجاست؟ کی ویرایشش کرد؟» ──────
function ForensicHookActor({ t, plan }: R57ActorProps) {
  const enterAt = cueAt(plan, 'invoice-enter', 0.2)
  const countAt = cueAt(plan, 'original-odometer', 0.8)
  const tamperAt = cueAt(plan, 'tamper-alert', 2.4)
  const diffAt = cueAt(plan, 'diff-highlight', 3.6)
  const stampAt = cueAt(plan, 'fraud-stamp', 4.1)
  const holdAt = plan?.sentenceEnding?.at ?? 3.4

  const isTampered = t >= tamperAt
  const isHeld = t >= holdAt
  const slashP = ease(progress(t, tamperAt, 0.35))
  const stampSpring = studioSpring(Math.max(0, t - stampAt))

  return (
    <div className={`r57-hook ${isHeld ? 'held' : ''}`}>
      {/* ── Headline Block ── */}
      <div
        className="r57-headline"
        style={studioSpringEnter(t, enterAt - 0.15, { y: 25, scale: 0.94 })}
      >
        <span className="r57-badge amber">ردیابی تخلفات صندوق</span>
        <h2 className="r57-title">فاکتور ۷۵ میلیونی دیروز غیب شد!</h2>
      </div>

      {/* ── Forensic Invoice Card with Tamper Slicing ── */}
      <div
        className={`r57-invoice-card ${isTampered ? 'tampered' : ''}`}
        style={studioSpringEnter(t, enterAt, { y: 25, scale: 0.94 })}
      >
        <div className="r57-invoice-header">
          <div className="r57-invoice-id">
            <span className="r57-pill">فاکتور #۱۰۸۲</span>
            <span className="r57-time">ساعت ۱۹:۱۵ · پرداخت نقد</span>
          </div>
          <span className={`r57-status-badge ${isTampered ? 'alert' : 'verified'}`}>
            {isTampered ? 'دستکاری مشکوک' : 'ثبت اولیه'}
          </span>
        </div>

        {/* Amount Comparison Area */}
        <div className="r57-amount-arena">
          <div className="r57-amount-col original">
            <span className="r57-amount-label">مبلغ پرداخت‌شده مشتری</span>
            <div className="r57-price-row">
              <StudioOdometer
                value={75}
                t={t}
                startAt={countAt}
                duration={0.9}
                tone="cyan"
                unit="میلیون"
                fontSize={44}
              />
            </div>
            {/* Red Strike-Through Slash */}
            {isTampered && (
              <span
                className="r57-slash-line"
                style={{
                  width: `${slashP * 100}%`,
                }}
              />
            )}
          </div>

          {/* Tampered Drop Result */}
          {isTampered && (
            <div
              className="r57-amount-col altered"
              style={studioSpringEnter(t, diffAt, { y: 15, scale: 0.92 })}
            >
              <span className="r57-amount-label red">مبلغ اصلاح‌شده در سیستم</span>
              <div className="r57-price-row">
                <StudioOdometer
                  value={45}
                  t={t}
                  startAt={diffAt}
                  duration={0.8}
                  tone="red"
                  unit="میلیون"
                  fontSize={44}
                />
              </div>
            </div>
          )}
        </div>

        {/* Forensic Discrepancy Footnote */}
        <div className="r57-invoice-footer">
          <span>
            اختلاف کسری دخل: <strong>{faNumber(30)} میلیون تومان</strong>
          </span>
          <span className="r57-user-tag">ویرایش در غیاب مدیر</span>
        </div>

        {/* Climax Stamp: ویرایش مشکوک! */}
        <div
          className="r57-stamp red-stamp"
          style={{
            opacity: clamp(progress(t, stampAt, 0.12)),
            transform: `rotate(-7deg) scale(${mix(0.65, 1, stampSpring)})`,
          }}
        >
          ویرایش بدون مجوز!
        </div>
      </div>
    </div>
  )
}

// ─── 2. Cash Gap: «۳۰ میلیون پول نقد گم شد؛ بدون اینکه متوجه بشی!» ───────────
function CashGapActor({ t, plan }: R57ActorProps) {
  const gapAt = cueAt(plan, 'gap-counter', 0.3)
  const drainAt = cueAt(plan, 'cash-drain', 1.9)
  const lockAt = cueAt(plan, 'cash-lock', 2.9)
  const stealthAt = cueAt(plan, 'stealth-reveal', 4.2)
  const holdAt = plan?.sentenceEnding?.at ?? 3.8

  const isHeld = t >= holdAt
  const drainP = ease(progress(t, drainAt, 0.7))

  return (
    <div className={`r57-gap ${isHeld ? 'held' : ''}`}>
      {/* ── Headline Block ── */}
      <div
        className="r57-headline"
        style={studioSpringEnter(t, gapAt - 0.15, { y: 25, scale: 0.94 })}
      >
        <span className="r57-badge red">کسری مخفیانه صندوق</span>
        <h2 className="r57-title">۳۰ میلیون کسری، بدون هیچ صدا!</h2>
      </div>

      {/* ── Discrepancy Visual Matrix ── */}
      <div className="r57-gap-card" style={studioSpringEnter(t, gapAt, { y: 25, scale: 0.94 })}>
        <div className="r57-gap-hero">
          <span className="r57-gap-title">کسری دخل ناشی از تغییر فاکتور</span>
          <div className="r57-gap-figure">
            <StudioOdometer
              value={30}
              t={t}
              startAt={gapAt}
              duration={1.0}
              tone="red"
              unit="میلیون"
              fontSize={54}
            />
          </div>
          <span className="r57-gap-sub">پول نقد از مشتری گرفته شد، ولی سند عوض شد</span>
        </div>

        {/* Visual Cash Flow Drainage */}
        <div className="r57-cash-meter-box">
          <div className="r57-meter-row">
            <span>دریافت نقدی: ۷۵ م</span>
            <span>ثبت نهایی: ۴۵ م</span>
          </div>
          <div className="r57-meter-track">
            <div
              className="r57-meter-bar"
              style={{
                width: `${mix(100, 60, drainP)}%`,
                background: 'linear-gradient(90deg, #ff2a5f, #fb7185)',
              }}
            />
          </div>
          <div className="r57-leak-pill" style={{ opacity: clamp(progress(t, lockAt, 0.3)) }}>
            ۳۰ میلیون نشتی پنهان
          </div>
        </div>

        {/* Stealth Warning */}
        <div
          className="r57-stealth-box"
          style={studioSpringEnter(t, stealthAt, { y: 15, scale: 0.95 })}
        >
          <span className="r57-lock-icon">⚠️</span>
          <span>در سیستم‌های سنتی، این اختلاف هیچ‌وقت مشخص نمی‌شود!</span>
        </div>
      </div>
    </div>
  )
}

// ─── 3. Legacy Vulnerability: «تو اکسل هیچ ردی نیست؛ فاکتور بی‌صدا عوض می‌شه!» ─
function LegacyVulnerabilityActor({ t, plan }: R57ActorProps) {
  const blurAt = cueAt(plan, 'legacy-blur', 0.7)
  const ghostAt = cueAt(plan, 'ghost-line', 1.7)
  const swapAt = cueAt(plan, 'silent-swap', 2.9)
  const scanAt = cueAt(plan, 'audit-scan', 4.0)
  const stampAt = cueAt(plan, 'vulnerability-stamp', 4.6)
  const holdAt = plan?.sentenceEnding?.at ?? 4.5

  const isHeld = t >= holdAt
  const scanP = ease(progress(t, scanAt, 0.8))
  const stampSpring = studioSpring(Math.max(0, t - stampAt))

  return (
    <div className={`r57-legacy ${isHeld ? 'held' : ''}`}>
      {/* ── Headline Block ── */}
      <div
        className="r57-headline"
        style={studioSpringEnter(t, blurAt - 0.15, { y: 25, scale: 0.94 })}
      >
        <span className="r57-badge red">نبود ردیابی امنیتی</span>
        <h2 className="r57-title">اکسل و سیستم سنتی: سرقت بدون ردپا!</h2>
      </div>

      {/* ── Vulnerable Sheet Simulator ── */}
      <div
        className="r57-legacy-sheet"
        style={studioSpringEnter(t, blurAt, { y: 25, scale: 0.94 })}
      >
        <div className="r57-sheet-header">
          <span>دفتر حساب سنتی / فایل اکسل</span>
          <span className="r57-sheet-warn">بدون قفل امنیتی</span>
        </div>

        {/* Laser Scanner sweeping across vulnerable rows */}
        <div
          className="r57-scanner-line"
          style={{
            top: `${scanP * 100}%`,
            opacity: t >= scanAt ? 0.9 : 0,
          }}
        />

        <div className="r57-sheet-rows">
          <div className="r57-sheet-row">
            <span>فاکتور ۱۰۸۰</span>
            <span>۱۸:۳۰</span>
            <span>۱۲٬۰۰۰٬۰۰۰</span>
            <span className="ok">عادی</span>
          </div>
          <div className="r57-sheet-row">
            <span>فاکتور ۱۰۸۱</span>
            <span>۱۹:۰۰</span>
            <span>۳۴٬۰۰۰٬۰۰۰</span>
            <span className="ok">عادی</span>
          </div>
          {/* Tampered / Ghost Row */}
          <div
            className={`r57-sheet-row ghost ${t >= ghostAt ? 'active' : ''}`}
            style={{
              opacity: t >= swapAt ? 0.45 : 1,
            }}
          >
            <span>فاکتور ۱۰۸۲</span>
            <span>۲۱:۴۲</span>
            <span className="strike">۷۵٬۰۰۰٬۰۰۰</span>
            <span className="red">۴۵٬۰۰۰٬۰۰۰</span>
          </div>
          <div className="r57-sheet-row">
            <span>فاکتور ۱۰۸۳</span>
            <span>۲۲:۱۰</span>
            <span>۸٬۰۰۰٬۰۰۰</span>
            <span className="ok">عادی</span>
          </div>
        </div>

        <div className="r57-sheet-alert">
          ❌ هیچ سابقه‌ای از اینکه چه کسی فاکتور را ویرایش کرد وجود ندارد!
        </div>

        {/* Vulnerability Stamp */}
        <div
          className="r57-stamp red-stamp"
          style={{
            opacity: clamp(progress(t, stampAt, 0.14)),
            transform: `rotate(-5deg) scale(${mix(0.65, 1, stampSpring)})`,
          }}
        >
          غیرقابل رهگیری!
        </div>
      </div>
    </div>
  )
}

// ─── 4. Security Shield: «حسابچه لاگ هر تغییر رو با ساعت و اسم کاربر نگه می‌داره!» ─
const AUDIT_LOGS = [
  {
    time: '۱۹:۱۵:۰۲',
    user: 'صندوق‌دار ۱',
    event: 'صدور فاکتور نقدی #۱۰۸۲ (۷۵ م)',
    status: 'ثبت شد',
    tone: 'green',
  },
  {
    time: '۲۱:۴۲:۱۹',
    user: 'کاربر شیفت شب',
    event: 'تلاش برای ویرایش مبلغ به ۴۵ م',
    status: 'مسدود شد',
    tone: 'red',
  },
  {
    time: '۲۱:۴۲:۲۰',
    user: 'سیستم امنیتی',
    event: 'ارسال هشدار آنی به موبایل مدیر',
    status: 'تایید الزامی',
    tone: 'amber',
  },
]

function SecurityShieldActor({ t, plan }: R57ActorProps) {
  const brandAt = cueAt(plan, 'brand-anchor', 0.25)
  const streamAt = cueAt(plan, 'audit-stream', 0.95)
  const secureAt = cueAt(plan, 'secure-badge', 1.85)
  const lockAt = cueAt(plan, 'audit-shield-lock', 5.1)
  const holdAt = plan?.sentenceEnding?.at ?? 4.4

  const isHeld = t >= holdAt
  const brandOpacity = Math.min(1, Math.max(0.2, t / 0.15))

  return (
    <div className={`r57-shield ${isHeld ? 'held' : ''}`}>
      {/* ── Brand Entry Header ── */}
      <div
        className="brand-entry-header r57-brand"
        style={{ ...studioSpringEnter(t, brandAt, { y: 15, scale: 0.96 }), opacity: brandOpacity }}
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
          <span className="brand-slogan">سپر امنیتی صندوق و لاگ غیرقابل دستکاری</span>
        </div>
      </div>

      {/* ── Realtime Audit Log Feed ── */}
      <div
        className="r57-audit-panel"
        style={studioSpringEnter(t, streamAt, { y: 25, scale: 0.94 })}
      >
        <div className="r57-audit-head">
          <div className="r57-audit-badge">
            <span className="pulse-dot-cyan" />
            لاگ تغییرات فاکتورها (Audit Trail)
          </div>
          <span className="r57-head-sub">غیرقابل پاک شدن</span>
        </div>

        <div className="r57-audit-list">
          {AUDIT_LOGS.map((log, index) => {
            const rowAt = streamAt + 0.3 + index * 0.4
            return (
              <div
                key={log.time}
                className={`r57-log-row ${log.tone}`}
                style={studioSpringEnter(t, rowAt, { y: 18, scale: 0.95 })}
              >
                <div className="r57-log-meta">
                  <span className="r57-log-time">{log.time}</span>
                  <span className="r57-log-user">{log.user}</span>
                </div>
                <div className="r57-log-event">{log.event}</div>
                <span className={`r57-log-status ${log.tone}`}>{log.status}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Protection Shield Footnote ── */}
      <div
        className={`r57-shield-box ${t >= lockAt ? 'locked' : ''}`}
        style={studioSpringEnter(t, secureAt, { y: 20, scale: 0.94 })}
      >
        <span className="r57-shield-icon">🛡️</span>
        <div className="r57-shield-text">
          <strong>قفل دو مرحله‌ای مدیر فعال است</strong>
          <span>هیچ فاکتوری بدون رمز اختصاصی شما حذف یا ویرایش نمی‌شود.</span>
        </div>
      </div>
    </div>
  )
}

// ─── 5. CTA Vault: «صندوقت رو ضد سرقت کن؛ همین حالا در حسابچه.» ─────────────
function CtaVaultActor({ t, plan }: R57ActorProps) {
  const shieldAt = cueAt(plan, 'pos-shield', 0.2)
  const cardEnterAt = 0.3
  const pulseAt = cueAt(plan, 'cta-button-pulse', 2.75)
  const brandOpacity = Math.min(1, Math.max(0.2, t / 0.15))
  const glow = pulse(t, pulseAt, pulseAt + 1.25, 0.85)

  return (
    <div className="cta-finish-container r57-cta">
      <div className="cta-brand-hero" style={{ opacity: brandOpacity }}>
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
        <p className="cta-subtitle">صندوق ضد سرقت، نظارت کامل لحظه‌ای</p>
      </div>

      <div
        className="r57-cta-badges"
        style={studioSpringEnter(t, shieldAt, { y: 20, scale: 0.95 })}
      >
        <span className="r57-cta-badge">✓ لاگ هر کلیک و تغییر</span>
        <span className="r57-cta-badge">✓ سطوح دسترسی پیشرفته</span>
      </div>

      <div className="cta-action-stack">
        <div
          className="cta-action-card cyan-cta"
          style={{
            ...studioSpringEnter(t, cardEnterAt, { y: 24, scale: 0.94 }),
            boxShadow: `0 0 ${mix(12, 38, glow)}px rgba(34, 211, 238, ${mix(0.28, 0.85, glow)})`,
          }}
        >
          <div className="cta-card-badge">امنیت ۱۰۰٪ دخل و فاکتورها</div>
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
