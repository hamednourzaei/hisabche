// ============================================
// Reel #62 — «زایش فاکتور از دل پرینتر حرارتی»
//
// Template: THERMAL RECEIPT CASCADE (prompt library hp-011).
// High-craft retail POS scenario:
// A busy retail counter where cash register receipt prints, line items
// automatically spawn journal entries, stock deductions, and till balance.
//
// Critical visual laws:
// 1. Center of gravity strictly in the 42%-58% central frame.
// 2. Numbers NEVER blink or flicker (stable continuous odometer/hold).
// 3. Subtitle overlay floats at bottom without squeezing content.
// 4. Climax hold >= 1.5s, CTA hold >= 3.5s with hisabche.com.
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { clamp, ease, mix, progress, studioSpringEnter } from '../engine/anim'

interface R62ActorProps {
  t: number
  plan?: SentencePlan | undefined
}

export function Reel62ReceiptActor({
  actor,
  t,
  plan,
}: {
  actor: string
  t: number
  plan?: SentencePlan | undefined
}) {
  if (actor === 'r62-printer-hook') return <PrinterHookActor t={t} plan={plan} />
  if (actor === 'r62-night-manual') return <NightManualActor t={t} plan={plan} />
  if (actor === 'r62-hisabche-split') return <HisabcheSplitActor t={t} plan={plan} />
  if (actor === 'r62-balance-lock') return <BalanceLockActor t={t} plan={plan} />
  if (actor === 'r62-cta') return <CtaActor t={t} plan={plan} />
  return null
}

function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  return plan?.words.find((w) => w.action === action)?.start ?? fallback
}

// ─── 1. Scene 1: «پای صندوق صف کشیدن؛ فیش که پرینت شد، کار تمومه؟» ─────────────
function PrinterHookActor({ t, plan }: R62ActorProps) {
  const enterAt = cueAt(plan, 'pos-focus', 0.2)
  const feedAt = cueAt(plan, 'receipt-feed', 1.6)
  const buzzAt = cueAt(plan, 'printer-buzz', 2.2)
  const strikeAt = cueAt(plan, 'hook-strike', 3.2)

  const feedP = ease(clamp(progress(t, feedAt, 1.4)))
  const receiptHeight = mix(40, 260, feedP)

  return (
    <div className="r62-stage">
      <div className="r62-center-anchor" style={studioSpringEnter(t, enterAt, { y: 24 })}>
        {/* Machine Hardware Slot */}
        <div className="r62-printer-slot">
          <div className="r62-slot-cutout" />
          <div
            className="r62-slot-indicator"
            style={{ opacity: clamp(progress(t, buzzAt, 0.3)) }}
          />
        </div>

        {/* Unrolling Paper Receipt */}
        <div
          className="r62-receipt-paper"
          style={{
            height: `${receiptHeight}px`,
            maxHeight: '260px',
          }}
        >
          <div className="r62-receipt-header">
            <span className="r62-store-name">هایپرمارکت میلاد</span>
            <span className="r62-receipt-date">۱۴۰۵/۰۷/۲۶ — ۱۸:۴۲</span>
          </div>
          <div className="r62-receipt-divider" />
          <div className="r62-receipt-lines">
            <div className="r62-line-item">
              <span className="r62-item-name">روغن مایع پخت‌وپز ۳ لیتری</span>
              <span className="r62-item-qty">۲ عدد</span>
              <span className="r62-item-price">۴۵۰٬۰۰۰</span>
            </div>
            <div className="r62-line-item">
              <span className="r62-item-name">برنج طارم درجه یک ۵ کیلویی</span>
              <span className="r62-item-qty">۱ کیسه</span>
              <span className="r62-item-price">۱٬۲۰۰٬۰۰۰</span>
            </div>
          </div>
          <div className="r62-receipt-divider dashed" />
          <div className="r62-receipt-total">
            <span>جمع کل فاکتور:</span>
            <strong>۱٬۶۵۰٬۰۰۰ تومان</strong>
          </div>
        </div>

        {/* High-Tension Headline */}
        <div
          className="r62-hook-headline"
          style={studioSpringEnter(t, strikeAt, { y: 16, scale: 0.9 })}
        >
          فیش پرینت شد؛ <span className="r62-hl-cyan">کار تمومه؟</span>
        </div>
      </div>
    </div>
  )
}

// ─── 2. Scene 2: «در سیستم‌های سنتی، آخر شب تازه باید بشینی تک‌تک فاکتورها رو دستی وارد کنی.» ─
function NightManualActor({ t, plan }: R62ActorProps) {
  const enterAt = cueAt(plan, 'night-fall', 0.2)
  const manualAt = cueAt(plan, 'manual-entry', 1.8)
  const stampAt = cueAt(plan, 'error-badge', 2.8)

  return (
    <div className="r62-stage">
      <div className="r62-center-anchor" style={studioSpringEnter(t, enterAt, { y: 20 })}>
        {/* Torn Paper Sheet with Red Discrepancy Stamp */}
        <div className="r62-torn-sheet">
          <div className="r62-torn-header">
            <span className="r62-torn-title">دفتر ورود دستی فاکتورها</span>
            <span className="r62-torn-time">ساعت ۲۳:۴۵ شب</span>
          </div>

          <div className="r62-manual-rows">
            <div className="r62-mrow">
              <span>فاکتور شماره ۱۱۸ — روغن ۳ لیتری</span>
              <span className="r62-tag-pending">ثبت‌نشده در انبار</span>
            </div>
            <div className="r62-mrow">
              <span>فاکتور شماره ۱۱۹ — برنج ۵ کیلویی</span>
              <span className="r62-tag-pending">مغایرت موجودی</span>
            </div>
            <div className="r62-mrow">
              <span>مانده دخل شبانه</span>
              <span className="r62-tag-error">کسری نامشخص</span>
            </div>
          </div>

          {/* Heavy Warning Stamp */}
          <div
            className="r62-stamp-badge"
            style={studioSpringEnter(t, stampAt, { y: 12, scale: 0.86 })}
          >
            ورود دستی = ساعت‌ها معطلی و مغایرت دخل
          </div>
        </div>

        <div className="r62-sub-caption" style={studioSpringEnter(t, manualAt, { y: 14 })}>
          خستگی کارگران و خطای ثبت انسانی در اکسل
        </div>
      </div>
    </div>
  )
}

// ─── 3. Scene 3: «اما در حسابچه، همین که فیش بیرون میاد، انبار کسر میشه و دخل شارژ میشه.» ──
function HisabcheSplitActor({ t, plan }: R62ActorProps) {
  const brandAt = cueAt(plan, 'hisabche-brand', 0.2)
  const expandAt = cueAt(plan, 'receipt-expand', 1.2)
  const deductAt = cueAt(plan, 'stock-deduct', 1.8)
  const chargeAt = cueAt(plan, 'cash-charge', 2.2)

  return (
    <div className="r62-stage">
      <div className="r62-center-anchor">
        <div className="r62-brand-hero-badge" style={studioSpringEnter(t, brandAt, { y: 14 })}>
          قدرت یکپارچگی حسابچه در لحظه صدور فاکتور
        </div>

        {/* 4 Interactive Live Action Cards in Grid */}
        <div className="r62-quad-cards" style={studioSpringEnter(t, expandAt, { y: 22 })}>
          <div className="r62-quad-card emerald" style={studioSpringEnter(t, deductAt, { y: 14 })}>
            <div className="r62-qc-icon">📦</div>
            <div className="r62-qc-body">
              <span className="r62-qc-label">انبار مرکزی</span>
              <strong className="r62-qc-val">-۲ قوطی روغن | -۱ کیسه برنج</strong>
              <span className="r62-qc-sub">کسر آنی موجودی قفسه</span>
            </div>
          </div>

          <div className="r62-quad-card cyan" style={studioSpringEnter(t, chargeAt, { y: 16 })}>
            <div className="r62-qc-icon">💳</div>
            <div className="r62-qc-body">
              <span className="r62-qc-label">دخل صندوق</span>
              <strong className="r62-qc-val">+۱٬۶۵۰٬۰۰۰ تومان</strong>
              <span className="r62-qc-sub">واریز به معین کارتخوان</span>
            </div>
          </div>

          <div className="r62-quad-card amber">
            <div className="r62-qc-icon">🪙</div>
            <div className="r62-qc-body">
              <span className="r62-qc-label">برگشت پول خرد</span>
              <strong className="r62-qc-val">۵۰٬۰۰۰ تومان</strong>
              <span className="r62-qc-sub">محاسبه دقیق باقیمانده</span>
            </div>
          </div>

          <div className="r62-quad-card blue">
            <div className="r62-qc-icon">⚖️</div>
            <div className="r62-qc-body">
              <span className="r62-qc-label">سند حسابداری</span>
              <strong className="r62-qc-val">ثبت دوطرفه دوبل</strong>
              <span className="r62-qc-sub">بدون معطلی آخر شب</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 4. Scene 4: «سند حسابداری دوطرفه خودکار بسته شد؛ بدون یک ریال اختلاف دخل.» ───────────────
function BalanceLockActor({ t, plan }: R62ActorProps) {
  const enterAt = cueAt(plan, 'ledger-seal', 0.2)
  const lockAt = cueAt(plan, 'balance-lock', 1.2)
  const zeroAt = cueAt(plan, 'zero-diff', 1.8)
  const holdAt = cueAt(plan, 'climax-hold', 2.4)

  return (
    <div className="r62-stage">
      <div className="r62-center-anchor" style={studioSpringEnter(t, enterAt, { y: 24 })}>
        {/* Master Ledger Balance Certificate */}
        <div className="r62-ledger-shield">
          <div className="r62-shield-top">
            <span className="r62-shield-title">تراز آزمایشی فروش روزانه</span>
            <span className="r62-shield-tag">سند خودکار شماره ۵۴۲</span>
          </div>

          <div className="r62-balance-comparison">
            <div className="r62-bcol">
              <span className="r62-bcol-label">گردش بدهکار</span>
              <strong className="r62-bcol-num">۱٬۶۵۰٬۰۰۰ تومان</strong>
            </div>
            <div className="r62-bscale-symbol">⚖️</div>
            <div className="r62-bcol">
              <span className="r62-bcol-label">گردش بستانکار</span>
              <strong className="r62-bcol-num">۱٬۶۵۰٬۰۰۰ تومان</strong>
            </div>
          </div>

          {/* Equilibrium Lock Seal */}
          <div
            className="r62-equilibrium-lock"
            style={studioSpringEnter(t, lockAt, { scale: 0.92, y: 10 })}
          >
            <div className="r62-lock-check">✓</div>
            <div className="r62-lock-text">
              <strong>موازنه قطعی — بدون مغایرت</strong>
              <span style={{ opacity: clamp(progress(t, zeroAt, 0.4)) }}>
                اختلاف دخل پای صندوق: ۰ ریال
              </span>
            </div>
          </div>
        </div>

        {/* Stable Climax Hold Badge */}
        <div className="r62-stable-hold-pill" style={studioSpringEnter(t, holdAt, { y: 12 })}>
          آسودگی کامل مدیر فروشگاه در بستن شیفت
        </div>
      </div>
    </div>
  )
}

// ─── 5. Scene 5: «همین حالا فروشگاهت رو مجهز کن. شروع رایگان در hisabche.com» ─────────────────
function CtaActor({ t, plan }: R62ActorProps) {
  const enterAt = cueAt(plan, 'cta-enter', 0.2)
  const buttonAt = cueAt(plan, 'cta-button-pulse', 1.8)
  const urlAt = cueAt(plan, 'url-glow', 2.6)

  return (
    <div className="r62-stage">
      <div className="r62-center-anchor" style={studioSpringEnter(t, enterAt, { y: 24 })}>
        <div className="r62-cta-card">
          <div className="r62-cta-badge">ویژه فروشگاه‌ها و خرده‌فروشی‌های پیشخوان</div>

          <h2 className="r62-cta-headline">
            فروشگاهت رو به <span className="r62-hl-cyan">حسابچه</span> مجهز کن
          </h2>

          <p className="r62-cta-subtext">
            ثبت سریع فاکتور پای صندوق · کسر آنی انبار · بدون مغایرت دخل
          </p>

          <div className="r62-cta-btn" style={studioSpringEnter(t, buttonAt, { scale: 0.95 })}>
            شروع رایگان
          </div>

          <div className="r62-cta-domain" style={studioSpringEnter(t, urlAt, { y: 8 })}>
            hisabche.com
          </div>
        </div>
      </div>
    </div>
  )
}
