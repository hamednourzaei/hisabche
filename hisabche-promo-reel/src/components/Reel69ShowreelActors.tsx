// ============================================
// Reel #69 — یک فاکتور، پنج کار (character-led explainer)
//
// Six beats, one dithered character, one focal stage each:
//   r69-invoice-hook   one invoice, «۱ = ۵»
//   r69-line-cards     a product, a service and a weighed item on one invoice
//   r69-cash-credit    the line price, then half cash, half credit
//   r69-day-rate       a dollar invoice keeps that day's rate on it
//   r69-five-jobs      climax — stock, till, ledger, customer balance, profit
//   r69-brand-outro    «حساب» + «چه»
//
// Every number is one invoice's: a gearbox at 30,000,000 AFN bought at
// 20,000,000 — so the stock drops by one, the till takes the cash half, the
// customer owes the other half, and the profit is 10,000,000. Nothing on screen
// is a feature حسابچه does not have.
//
// Every time comes from the scene's own words via cueAt (AV sync law); the
// fallback is only what the stage draws before a plan exists.
// ============================================

import type { ReactNode } from 'react'

import type { SentencePlan } from '../engine/speech-model'
import { clamp, ease, mix, progress, studioSpringEnter } from '../engine/anim'

interface R69Props {
  t: number
  plan?: SentencePlan | undefined
}

const fa = new Intl.NumberFormat('fa-IR')
const n = (value: number) => fa.format(value)

export function Reel69ShowreelActor({
  actor,
  t,
  plan,
}: {
  actor: string
  t: number
  plan?: SentencePlan | undefined
}) {
  if (actor === 'r69-invoice-hook') return <InvoiceHook t={t} plan={plan} />
  if (actor === 'r69-line-cards') return <LineCards t={t} plan={plan} />
  if (actor === 'r69-cash-credit') return <CashCredit t={t} plan={plan} />
  if (actor === 'r69-day-rate') return <DayRate t={t} plan={plan} />
  if (actor === 'r69-five-jobs') return <FiveJobs t={t} plan={plan} />
  if (actor === 'r69-brand-outro') return <BrandOutro t={t} plan={plan} />
  return null
}

function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  return plan?.words.find((w) => w.action === action)?.start ?? fallback
}

/** The stage every beat stands on: background, dither patterns, grid. */
function Stage({
  theme = 'white',
  className = '',
  children,
}: {
  theme?: 'white' | 'blue'
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={`r69-stage ${theme === 'blue' ? 'r69-blue-panel-theme' : 'r69-white-theme'} ${className}`}
    >
      <DitherDefs />
      <div className={`r69-grid-bg ${theme === 'blue' ? 'dark' : ''}`} />
      {children}
    </div>
  )
}

/** Shown from `at` on, sprung in from the given side. */
function Enter({
  t,
  at,
  from,
  className,
  children,
}: {
  t: number
  at: number
  from: { x?: number; y?: number }
  className: string
  children: ReactNode
}) {
  if (t < at) return null
  return (
    <div className={className} style={studioSpringEnter(t, at, from)}>
      {children}
    </div>
  )
}

// ─── Dither patterns & the character ────────────────────────────────────────

function DitherDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
      <defs>
        <pattern id="r69-dither-blue" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="2" height="2" fill="#0056B3" fillOpacity="0.45" />
          <rect x="2" y="2" width="2" height="2" fill="#0056B3" fillOpacity="0.45" />
        </pattern>
        <pattern id="r69-dither-dark" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="2" height="2" fill="#111827" fillOpacity="0.35" />
          <rect x="2" y="2" width="2" height="2" fill="#111827" fillOpacity="0.35" />
        </pattern>
      </defs>
    </svg>
  )
}

function DitheredCharacter({
  t,
  scale = 1,
  lookingAt = 'center',
}: {
  t: number
  scale?: number
  lookingAt?: 'left' | 'right' | 'center'
}) {
  const bob = Math.sin(t * 6) * 4
  const tilt = Math.sin(t * 3.5) * 2.5
  const eye = lookingAt === 'left' ? -3 : lookingAt === 'right' ? 3 : 0
  const body =
    'M32 110 C32 95 48 88 70 88 C92 88 108 95 108 110 L114 156 C114 158 112 160 110 160 L30 160 C28 160 26 158 26 156 Z'
  const hair =
    'M36 50 C36 28 50 20 70 20 C90 20 104 28 104 50 C104 42 98 34 88 34 C80 34 76 38 70 38 C64 38 60 34 52 34 C42 34 36 42 36 50 Z'

  return (
    <div
      className="r69-character-rig"
      style={{
        transform: `translateY(${bob}px) rotate(${tilt}deg) scale(${scale})`,
        transformOrigin: 'bottom center',
      }}
    >
      <svg width="140" height="170" viewBox="0 0 140 170" fill="none">
        <ellipse cx="70" cy="162" rx="36" ry="6" fill="rgba(0,0,0,0.06)" />
        <path d={body} fill="#0056B3" />
        <path d={body} fill="url(#r69-dither-dark)" />
        <path d="M62 98 L60 126" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M78 98 L80 126" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="70" cy="56" r="32" fill="#FDE68A" />
        <path d="M44 68 C50 82 90 82 96 68 C88 86 52 86 44 68 Z" fill="url(#r69-dither-dark)" />
        <path d={hair} fill="#1F2937" />
        <path d={hair} fill="url(#r69-dither-blue)" />
        <circle cx={58 + eye} cy="54" r="4.5" fill="#111827" />
        <circle cx={82 + eye} cy="54" r="4.5" fill="#111827" />
        <circle cx={59.5 + eye} cy="52.5" r="1.5" fill="#ffffff" />
        <circle cx={83.5 + eye} cy="52.5" r="1.5" fill="#ffffff" />
        <circle cx="50" cy="62" r="5" fill="#F87171" fillOpacity="0.45" />
        <circle cx="90" cy="62" r="5" fill="#F87171" fillOpacity="0.45" />
        <path
          d="M62 64 Q70 73 78 64"
          stroke="#111827"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  )
}

// ─── Beat 1: one invoice, five jobs ─────────────────────────────────────────
function InvoiceHook({ t, plan }: R69Props) {
  const popAt = cueAt(plan, 'char-pop-in', 0.35)
  const invoiceAt = cueAt(plan, 'invoice-in', 0.85)
  const fiveAt = cueAt(plan, 'five-tag-in', 1.6)

  return (
    <Stage>
      <div className="r69-beat1-layout">
        <div className="r69-left-column">
          <Enter t={t} at={fiveAt} from={{ y: 12 }} className="r69-creator-tag">
            ۱ فاکتور = ۵ کار
          </Enter>
          <Enter t={t} at={invoiceAt} from={{ y: 18 }} className="r69-headline">
            فاکتور
          </Enter>
        </div>
        <Enter t={t} at={popAt} from={{ y: 24 }} className="r69-right-column">
          <DitheredCharacter t={t} scale={1.15} lookingAt="right" />
        </Enter>
      </div>
    </Stage>
  )
}

// ─── Beat 2: a product, a service and a weighed item on one invoice ─────────
const LINES = [
  { action: 'card-product-in', fallback: 0.2, icon: '⚙️', name: 'گیربوکس', kind: 'کالا' },
  { action: 'card-service-in', fallback: 0.95, icon: '🔧', name: 'نصب', kind: 'خدمت' },
  { action: 'card-weight-in', fallback: 2.15, icon: '⚖️', name: 'روغن', kind: 'وزنی' },
] as const

function LineCards({ t, plan }: R69Props) {
  const panelP = clamp(progress(t, 0, 0.4))
  const mergeAt = cueAt(plan, 'cards-merge', 3.2)
  // «هر سه»: the three cards draw together into one invoice.
  const merge = ease(clamp(progress(t, mergeAt, 0.45)))

  return (
    <Stage theme="blue">
      <div
        className="r69-blue-canvas"
        style={{ transform: `translateY(${mix(60, 0, ease(panelP))}px)`, opacity: panelP }}
      >
        <div className="r69-split-stage">
          <div className="r69-cards-column" style={{ gap: `${mix(14, 4, merge)}px` }}>
            {LINES.map((line) => (
              <Enter
                key={line.action}
                t={t}
                at={cueAt(plan, line.action, line.fallback)}
                from={{ x: 30 }}
                className="r69-product-card"
              >
                <div className="r69-card-icon dither-icon">{line.icon}</div>
                <div className="r69-card-info">
                  <span className="r69-card-title">{line.name}</span>
                  <span className="r69-card-price">{line.kind}</span>
                </div>
              </Enter>
            ))}
          </div>
          <div className="r69-character-side">
            <DitheredCharacter t={t} scale={1.05} lookingAt="right" />
          </div>
        </div>
      </div>
    </Stage>
  )
}

// ─── Beat 3: the line price, half cash, half credit ─────────────────────────
function CashCredit({ t, plan }: R69Props) {
  const invoiceAt = cueAt(plan, 'invoice-slide-in', 0.2)
  const priceAt = cueAt(plan, 'line-price-in', 2.1)
  const shrinkAt = cueAt(plan, 'char-shrink-float', 3.0)
  const cashAt = cueAt(plan, 'cash-pill-in', 3.35)
  const creditAt = cueAt(plan, 'credit-pill-in', 4.45)
  const shrink = t >= shrinkAt ? ease(clamp(progress(t, shrinkAt, 0.4))) : 0

  return (
    <Stage>
      <div className="r69-checkout-stage">
        <div className="r69-checkout-card" style={studioSpringEnter(t, invoiceAt, { x: 30 })}>
          <div className="r69-checkout-header">
            <span className="r69-badge-live">فاکتور فروش</span>
          </div>
          <div className="r69-item-row">
            <span className="r69-item-name">گیربوکس اتوماتیک</span>
            {t >= priceAt ? <span className="r69-pill-price">{n(30_000_000)}</span> : null}
          </div>
          <Enter t={t} at={cashAt} from={{ y: 12 }} className="r69-tax-row">
            <span className="r69-tax-label">نقد</span>
            <span className="r69-tax-val">{n(15_000_000)}</span>
          </Enter>
          <Enter t={t} at={creditAt} from={{ y: 12 }} className="r69-tax-row">
            <span className="r69-tax-label">نسیه</span>
            <span className="r69-tax-val">{n(15_000_000)}</span>
          </Enter>
        </div>
        <div
          className="r69-character-float"
          style={{ transform: `translate(-20px, ${mix(0, -20, shrink)}px)` }}
        >
          <DitheredCharacter t={t} scale={mix(1, 0.75, shrink)} lookingAt="right" />
        </div>
      </div>
    </Stage>
  )
}

// ─── Beat 4: a dollar invoice keeps that day's rate ─────────────────────────
function DayRate({ t, plan }: R69Props) {
  const dollarAt = cueAt(plan, 'dollar-note-in', 0.6)
  const rateAt = cueAt(plan, 'rate-lock-in', 1.8)
  const dateAt = cueAt(plan, 'rate-date-in', 2.45)
  const bounceAt = cueAt(plan, 'char-smile-bounce', 3.5)

  return (
    <Stage>
      <div className="r69-checkout-stage">
        <div className="r69-checkout-card expanded">
          <div className="r69-item-row compact">
            <span className="r69-item-name">گیربوکس اتوماتیک</span>
            <span className="r69-pill-price">$ {n(400)}</span>
          </div>
          <Enter t={t} at={dollarAt} from={{ y: 14 }} className="r69-upsell-box">
            <div className="r69-upsell-header">
              <span className="r69-upsell-title">ارز فاکتور: دالر</span>
            </div>
          </Enter>
          <Enter t={t} at={rateAt} from={{ y: 10 }} className="r69-tax-row">
            <span className="r69-tax-label">🔒 ۱ دالر</span>
            <span className="r69-tax-val">{n(75)} افغانی</span>
          </Enter>
          <Enter t={t} at={dateAt} from={{ y: 8 }} className="r69-item-sub">
            ۲۶ مهر
          </Enter>
        </div>
        <div
          className="r69-character-float"
          style={{ transform: `translate(-20px, ${t >= bounceAt ? -28 : -20}px)` }}
        >
          <DitheredCharacter t={t} scale={0.78} lookingAt="right" />
        </div>
      </div>
    </Stage>
  )
}

// ─── Beat 5 (climax): five jobs land around the character ───────────────────
const JOBS = [
  {
    action: 'panel-stock-in',
    fallback: 0.2,
    place: 'top-left',
    label: 'انبار',
    value: `− ${n(1)}`,
  },
  {
    action: 'panel-till-in',
    fallback: 1.35,
    place: 'top-right',
    label: 'صندوق',
    value: `+ ${n(15_000_000)}`,
  },
  { action: 'panel-ledger-in', fallback: 2.5, place: 'mid-right', label: 'دفتر کل', value: '✓' },
  {
    action: 'panel-credit-in',
    fallback: 3.7,
    place: 'bottom-left',
    label: 'طلب مشتری',
    value: n(15_000_000),
  },
] as const

function FiveJobs({ t, plan }: R69Props) {
  const profitAt = cueAt(plan, 'panel-profit-in', 5.1)
  return (
    <Stage>
      <div className="r69-multi-split-stage">
        <div className="r69-center-character">
          <DitheredCharacter t={t} scale={0.65} />
        </div>
        <div className="r69-floating-panels">
          {JOBS.map((job) => (
            <Enter
              key={job.action}
              t={t}
              at={cueAt(plan, job.action, job.fallback)}
              from={{ y: job.place.startsWith('top') ? -20 : 20 }}
              className={`r69-mini-card ${job.place}`}
            >
              <span className="r69-mini-tag">{job.label}</span>
              <span className="r69-mini-title">{job.value}</span>
            </Enter>
          ))}
          <Enter t={t} at={profitAt} from={{ y: 20 }} className="r69-revenue-banner bottom-right">
            <span className="r69-rev-label">سود</span>
            <span className="r69-rev-num">{n(10_000_000)}</span>
          </Enter>
        </div>
      </div>
    </Stage>
  )
}

// ─── Beat 6: «حساب» + «چه» ──────────────────────────────────────────────────
function BrandOutro({ t, plan }: R69Props) {
  const hesabAt = cueAt(plan, 'brand-hesab-in', 0.2)
  const cheAt = cueAt(plan, 'brand-che-lock', 1.1)
  return (
    <Stage className="outro">
      <div className="r69-brand-center">
        {/* ⚠️ ONE text node once it locks: «حساب» and «چه» in two spans would
            break the join between ب and چ (Persian glyphs never split across
            DOM nodes). «حساب» alone first, then the whole word replaces it. */}
        <div className="r69-logo-assembly">
          {t < cheAt ? (
            <Enter t={t} at={hesabAt} from={{ x: 25 }} className="r69-logo-part pockets">
              حساب
            </Enter>
          ) : (
            <Enter t={t} at={cheAt} from={{ x: -12 }} className="r69-logo-part flow">
              حسابچه
            </Enter>
          )}
        </div>
        <Enter t={t} at={cheAt + 0.15} from={{ y: 10 }} className="r69-outro-sub">
          <span dir="ltr">hisabche.com</span>
        </Enter>
      </div>
    </Stage>
  )
}
