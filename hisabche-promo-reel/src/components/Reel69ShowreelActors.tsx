// ============================================
// Reel #69 — «۱۰۰٪ کسب‌وکارت رقم است؛ همه‌ش یک‌جا»
//
// Digital showreel actors. One focal stage per scene, ≤ 6 on-stage words
// (functional labels only). The narration lives only in the subtitle.
// Every number is a pure faNumber digit — no currency names.
// AV Sync Law: every sounded word's action is read here with cueAt.
// One master timeline: every transform is a pure function of scene time t.
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { clamp, ease, mix, progress, studioSpringEnter } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

interface R69Props {
  t: number
  plan?: SentencePlan | undefined
}

export function Reel69ShowreelActor({
  actor,
  t,
  plan,
}: {
  actor: string
  t: number
  plan?: SentencePlan | undefined
}) {
  if (actor === 'r69-digit-freeze') return <DigitFreeze t={t} plan={plan} />
  if (actor === 'r69-price-tiers') return <PriceTiers t={t} plan={plan} />
  if (actor === 'r69-team-shift') return <TeamShift t={t} plan={plan} />
  if (actor === 'r69-offline-counter') return <OfflineCounter t={t} plan={plan} />
  if (actor === 'r69-converged-cta') return <ConvergedCta t={t} plan={plan} />
  return null
}

function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  return plan?.words.find((w) => w.action === action)?.start ?? fallback
}

// ─── 1. The digit wall freezes and resolves into ۱۰۰٪ ──────────────────────
const WALL_DIGITS = [
  3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6, 2, 6, 4, 3, 3, 8, 3, 2, 7, 9, 5, 0,
  2, 8, 8, 4, 1, 9, 7, 1, 1, 8, 0, 2, 1, 9, 9, 7, 8, 3, 7, 4, 0, 5, 3, 6, 2, 9, 4, 6, 0, 2, 8, 5, 4,
  8, 2, 7, 3, 6, 9, 8, 5, 1, 4, 2, 7, 3, 9, 6, 2, 8, 5, 0, 7, 1, 4, 6, 3, 5, 9, 2, 8, 0, 4, 7, 6, 1,
]

function DigitFreeze({ t, plan }: R69Props) {
  const freezeAt = cueAt(plan, 'digit-freeze', 0.2)
  const dimAt = cueAt(plan, 'digit-dim', 1.33)
  const gatherAt = cueAt(plan, 'islands-gather', 2.51)
  const lockAt = cueAt(plan, 'one-place-lock', 2.83)
  const frozen = ease(clamp(progress(t, freezeAt, 0.3)))
  const dim = ease(clamp(progress(t, dimAt, 0.5)))
  const lock = ease(clamp(progress(t, gatherAt, 0.4)))
  const blast = ease(clamp(progress(t, lockAt, 0.5)))

  return (
    <div className="r69-stage">
      <div
        className="r69-digit-grid"
        style={{
          transform: `scale(${mix(1.14, 1, frozen)}) translateY(${mix(28, 0, frozen)}px)`,
          opacity: mix(1, 0.22, dim),
          filter: `blur(${mix(0, 1.5, lock)}px)`,
        }}
      >
        {WALL_DIGITS.map((digit, i) => {
          // Deterministic drift; it dies the instant the wall freezes.
          const drift = frozen > 0.02 ? 0 : Math.sin(i * 1.7 + t * 2.2) * 4
          return (
            <span
              key={i}
              className="r69-cell"
              style={{
                opacity: mix(0.85, 0.35, (i % 3) / 3),
                transform: `translateY(${drift}px)`,
              }}
            >
              {faNumber(digit)}
            </span>
          )
        })}
      </div>
      <div className="r69-freeze-anchor">
        <div
          className="r69-percent"
          style={{
            ...studioSpringEnter(t, lockAt, { y: 46, scale: 0.7 }),
            textShadow: `0 0 ${mix(0, 90, blast)}px rgba(192,132,252,${mix(0, 0.5, blast)})`,
          }}
        >
          ۱۰۰٪
        </div>
        <div className="r69-freeze-tag" style={{ opacity: mix(0, 1, dim) }}>
          رقم
        </div>
      </div>
    </div>
  )
}

// ─── 2. Price lists: the invoice line priced by its customer's tier ────────
const TIERS = [
  { label: 'عمده', price: '۱٬۹۸۰' },
  { label: 'خرده', price: '۲٬۶۰۰' },
  { label: 'همکار', price: '۲٬۲۵۰' },
]

function PriceTiers({ t, plan }: R69Props) {
  const fanAt = cueAt(plan, 'tier-fan', 0.2)
  const litAt = cueAt(plan, 'tier-tag-lit', 1.03)
  const flipAt = cueAt(plan, 'tier-flip', 2.48)
  const lockAt = cueAt(plan, 'line-price-lock', 2.88)
  const activeIndex = flipAt <= t ? 1 : 0
  const active = TIERS[activeIndex] ?? TIERS[0]
  const lock = ease(clamp(progress(t, lockAt, 0.4)))

  return (
    <div className="r69-stage">
      <div className="r69-price-anchor">
        <div className="r69-invoice-line" style={studioSpringEnter(t, fanAt, { y: 34 })}>
          <span className="r69-line-name">کالای بازرگانی ۱۰۱</span>
          <span
            className="r69-line-price"
            style={{
              textShadow: `0 0 ${mix(0, 32, lock)}px rgba(74,222,128,${mix(0, 0.5, lock)})`,
            }}
          >
            {active.price}
          </span>
        </div>
        <div className="r69-tier-row">
          {TIERS.map((tier, i) => (
            <div
              key={tier.label}
              className={`r69-tier ${i === activeIndex ? 'is-live' : ''}`}
              style={{
                ...studioSpringEnter(t, fanAt + i * 0.14, { y: 26 }),
                boxShadow:
                  i === activeIndex
                    ? `0 0 ${mix(0, 30, lock)}px rgba(34,211,238,${mix(0, 0.55, lock)})`
                    : undefined,
              }}
            >
              <span className="r69-tier-label">{tier.label}</span>
              <span className="r69-tier-price">{tier.price}</span>
            </div>
          ))}
        </div>
        <div
          className={`r69-customer-tag ${litAt <= t ? 'is-lit' : ''}`}
          style={studioSpringEnter(t, litAt, { y: 18 })}
        >
          فهرست قیمت مشتری
        </div>
      </div>
    </div>
  )
}

// ─── 3. Team shifts: attendance digits collect themselves ──────────────────
const SHIFTS = [
  { in: '۰۸:۰۰', out: '۱۷:۰۰', hours: '۹' },
  { in: '۰۸:۳۰', out: '۱۶:۳۰', hours: '۸' },
  { in: '۱۰:۰۰', out: '۱۹:۰۰', hours: '۹' },
  { in: '۱۵:۰۰', out: '۲۲:۰۰', hours: '۷' },
  { in: '۰۹:۰۰', out: '۱۸:۰۰', hours: '۹' },
]

function TeamShift({ t, plan }: R69Props) {
  const dotsAt = cueAt(plan, 'team-dots-in', 0.2)
  const stampAt = cueAt(plan, 'clockin-stamp', 0.71)
  const rowsAt = cueAt(plan, 'shift-rows-ready', 2.38)
  const countAt = cueAt(plan, 'hours-count', 3.08)
  const count = ease(clamp(progress(t, countAt, 0.6)))
  const stamp = ease(clamp(progress(t, stampAt, 0.4)))

  return (
    <div className="r69-stage">
      <div className="r69-team-anchor">
        <div className="r69-team-dots">
          {SHIFTS.map((_, i) => (
            <div
              key={i}
              className="r69-dot"
              style={{ ...studioSpringEnter(t, dotsAt + i * 0.09, { y: 14 }), opacity: stamp }}
            />
          ))}
        </div>
        <div className="r69-attendance-column">
          {SHIFTS.map((shift, i) => (
            <div
              key={i}
              className="r69-attendance-row"
              style={{
                ...studioSpringEnter(t, rowsAt + i * 0.07, { x: 30 }),
                opacity: ease(clamp(progress(t, stampAt + i * 0.11, 0.45))),
              }}
            >
              <span className="r69-att-time">{shift.in}</span>
              <span className="r69-att-arrow">→</span>
              <span className="r69-att-time">{shift.out}</span>
              <span className="r69-att-hours">{shift.hours}</span>
            </div>
          ))}
        </div>
        <div
          className="r69-shift-total"
          style={{
            ...studioSpringEnter(t, countAt, { y: 20 }),
            textShadow: `0 0 ${mix(0, 30, count)}px rgba(192,132,252,${mix(0, 0.45, count)})`,
          }}
        >
          <span className="r69-shift-total-label">شیفت هفتگی</span>
          <span className="r69-shift-total-value">۴۲ ساعت</span>
        </div>
      </div>
    </div>
  )
}

// ─── 4. Offline proof: the counter never stops ─────────────────────────────
function OfflineCounter({ t, plan }: R69Props) {
  const cutAt = cueAt(plan, 'net-cut', 0.15)
  const holdsAt = cueAt(plan, 'counter-holds', 0.61)
  const climbAt = cueAt(plan, 'counter-climb', 1.45)
  const flushAt = cueAt(plan, 'queue-flush', 2.1)
  const syncAt = cueAt(plan, 'sync-sweep', 2.5)
  const cut = ease(clamp(progress(t, cutAt, 0.25)))
  const sync = ease(clamp(progress(t, flushAt, 0.6)))

  // Monotonic: the odometer only climbs, never blinks.
  const base = 41
  const climbed = Math.round(ease(clamp(progress(t, climbAt, 0.5))) * 3)
  const sales = base + climbed

  return (
    <div className="r69-stage">
      <div className={`r69-net ${cutAt <= t ? 'is-cut' : ''}`}>
        <span className="r69-net-bar" />
        <span className="r69-net-label">آفلاین</span>
      </div>
      <div className="r69-counter-anchor">
        <div
          className="r69-counter"
          style={{
            ...studioSpringEnter(t, holdsAt, { y: 18 }),
            boxShadow: `0 0 ${mix(0, 26, cut)}px rgba(251,113,133,${mix(0.25, 0.5, cut)})`,
          }}
        >
          <span className="r69-counter-label">فاکتور آفلاین</span>
          <span className="r69-counter-value">{faNumber(sales)}</span>
        </div>
        <div
          className={`r69-sync-line ${syncAt <= t ? 'is-live' : ''}`}
          style={{ opacity: mix(0.25, 1, sync) }}
        >
          <span className="r69-sync-pill">سینک</span>
          <span className="r69-sync-dot" style={{ transform: `scale(${mix(0.6, 1, sync)})` }} />
        </div>
      </div>
    </div>
  )
}

// ─── 5. Every island converges; the CTA holds ──────────────────────────────
const CTA_ISLANDS = [
  { label: 'پیشخوان', value: '۱۲۸٬۴۰۰' },
  { label: 'کارگاه', value: '۳۴' },
  { label: 'فهرست قیمت', value: '۳' },
  { label: 'شیفت', value: '۴۲' },
]

function ConvergedCta({ t, plan }: R69Props) {
  const shopAt = cueAt(plan, 'island-shop-merge', 0.35)
  const workshopAt = cueAt(plan, 'island-workshop-merge', 1.11)
  const convergeAt = cueAt(plan, 'islands-converge', 1.73)
  const brandAt = cueAt(plan, 'brand-lock', 2.03)
  const buttonAt = cueAt(plan, 'cta-button', 2.9)
  const converge = ease(clamp(progress(t, convergeAt, 0.6)))

  return (
    <div className="r69-stage">
      <div className="r69-cta-backdrop" style={{ opacity: mix(1, 0.22, converge) }}>
        {CTA_ISLANDS.map((island, i) => {
          const at = i < 2 ? shopAt : workshopAt
          const gather = ease(clamp(progress(t, convergeAt + i * 0.06, 0.55)))
          return (
            <div
              key={island.label}
              className="r69-cta-island"
              style={{
                ...studioSpringEnter(t, at, { y: 34 }),
                transform: `translate(${mix(34, 0, gather)}px, ${mix(22, -10, converge)}px) rotate(${mix(0, 6, gather)}deg)`,
              }}
            >
              <span className="r69-island-label">{island.label}</span>
              <span className="r69-island-value">{island.value}</span>
            </div>
          )
        })}
      </div>
      <div className="r69-cta-card" style={studioSpringEnter(t, brandAt, { y: 30 })}>
        <span className="r69-cta-brand">حسابچه</span>
        <span
          className="r69-cta-button"
          style={studioSpringEnter(t, buttonAt, { y: 14, scale: 0.9 })}
        >
          شروع رایگان
        </span>
        <span className="r69-cta-url">hisabche.com</span>
      </div>
    </div>
  )
}
