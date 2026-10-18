// ============================================
// Reel #67 — «همین برنج رو دیروز به همسایه‌ات ارزون‌تر دادی؟»
//
// One focal stage per scene, ≤ 6 on-stage words (functional labels only:
// product, price, list name). The narration lives only in the subtitle.
// AV Sync Law: every sounded word's action is read here with cueAt.
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { clamp, ease, mix, progress, studioSpringEnter } from '../engine/anim'

interface R67Props {
  t: number
  plan?: SentencePlan | undefined
}

export function Reel67PriceListActor({
  actor,
  t,
  plan,
}: {
  actor: string
  t: number
  plan?: SentencePlan | undefined
}) {
  if (actor === 'r67-twin-receipts') return <TwinReceipts t={t} plan={plan} />
  if (actor === 'r67-flicker-tag') return <FlickerTag t={t} plan={plan} />
  if (actor === 'r67-loss-scale') return <LossScale t={t} plan={plan} />
  if (actor === 'r67-price-list-deck') return <PriceListDeck t={t} plan={plan} />
  if (actor === 'r67-auto-priced-line') return <AutoPricedLine t={t} plan={plan} />
  if (actor === 'r67-cta-tag') return <CtaTag t={t} plan={plan} />
  return null
}

function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  return plan?.words.find((w) => w.action === action)?.start ?? fallback
}

// ─── 1. Two receipts, one sack, two prices ─────────────────────────────────
function TwinReceipts({ t, plan }: R67Props) {
  const sackAt = cueAt(plan, 'sack-drop', 0.5)
  const yesterdayAt = cueAt(plan, 'receipt-yesterday', 1.15)
  const lowAt = cueAt(plan, 'price-low-stamp', 2.45)
  const todayAt = cueAt(plan, 'receipt-today', 4.35)
  const gapAt = cueAt(plan, 'price-gap-alert', 4.7)
  const gap = ease(progress(t, gapAt, 0.35))

  return (
    <div className="r67-stage">
      <div className="r67-anchor">
        <div className="r67-sack" style={studioSpringEnter(t, sackAt, { y: -40 })}>
          <span className="r67-sack-name">برنج ۲۵ کیلو</span>
        </div>
        <div className="r67-receipt-row">
          {t >= yesterdayAt && (
            <div className="r67-receipt" style={studioSpringEnter(t, yesterdayAt, { y: 30 })}>
              <span className="r67-receipt-day">دیروز</span>
              <span className={`r67-price ${t >= lowAt ? 'is-low' : ''}`}>۱٬۹۵۰</span>
            </div>
          )}
          {t >= todayAt && (
            <div
              className="r67-receipt is-today"
              style={{
                ...studioSpringEnter(t, todayAt, { y: 30 }),
                boxShadow: `0 0 ${mix(0, 36, gap)}px rgba(251,113,133,${mix(0, 0.55, gap)})`,
              }}
            >
              <span className="r67-receipt-day">امروز</span>
              <span className="r67-price is-high">۲٬۱۰۰</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 2. A price tag that only lives in the owner's head ────────────────────
const SPOKEN_PRICES = ['۲٬۰۰۰', '۲٬۱۵۰', '۱٬۹۰۰', '۲٬۰۵۰']

function FlickerTag({ t, plan }: R67Props) {
  const wholesaleAt = cueAt(plan, 'tag-wholesale', 0.55)
  const retailAt = cueAt(plan, 'tag-retail', 1.1)
  const fadeAt = cueAt(plan, 'tag-fade-head', 2.1)
  const boyAt = cueAt(plan, 'boy-arrives', 3.5)
  const spinAt = cueAt(plan, 'tag-spin-numbers', 4.9)

  const faded = ease(progress(t, fadeAt, 0.6))
  // Monotonic travel through the spoken prices: no wrap, no blink.
  const step = clamp((t - spinAt) / 0.45, 0, SPOKEN_PRICES.length - 1)

  return (
    <div className="r67-stage">
      <div className="r67-anchor">
        <div
          className="r67-tag-pair"
          style={{ opacity: mix(1, 0.18, faded), filter: `blur(${mix(0, 6, faded)}px)` }}
        >
          {t >= wholesaleAt && (
            <div className="r67-tag" style={studioSpringEnter(t, wholesaleAt, { x: 30, y: 0 })}>
              <span>عمده</span>
            </div>
          )}
          {t >= retailAt && (
            <div className="r67-tag" style={studioSpringEnter(t, retailAt, { x: -30, y: 0 })}>
              <span>خرده</span>
            </div>
          )}
        </div>
        {t >= boyAt && (
          <div className="r67-quote" style={studioSpringEnter(t, boyAt, { y: 30 })}>
            <span className="r67-quote-label">شاگرد</span>
            <div className="r67-odometer">
              <div
                className="r67-odometer-reel"
                style={{ transform: `translateY(${-step * 64}px)` }}
              >
                {SPOKEN_PRICES.map((price) => (
                  <span key={price} className="r67-odometer-cell">
                    {price}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 3. Profit or customer: both pans lose ─────────────────────────────────
function LossScale({ t, plan }: R67Props) {
  const dropAt = cueAt(plan, 'scale-drop', 0.8)
  const profitAt = cueAt(plan, 'profit-pan-sink', 2.2)
  const leaveAt = cueAt(plan, 'customer-pan-leave', 3.6)

  const tilt =
    mix(0, 9, ease(progress(t, profitAt, 0.5))) - mix(0, 18, ease(progress(t, leaveAt, 0.5)))
  const coinFall = ease(progress(t, profitAt, 0.7))
  const leave = ease(progress(t, leaveAt, 0.6))

  return (
    <div className="r67-stage">
      <div className="r67-anchor" style={studioSpringEnter(t, dropAt, { y: -50, scale: 0.9 })}>
        <div className="r67-scale">
          <div className="r67-beam" style={{ transform: `rotate(${tilt}deg)` }}>
            <div className="r67-pan">
              <span className="r67-pan-label">سود</span>
              <span
                className="r67-coin"
                style={{ transform: `translateY(${coinFall * 120}px)`, opacity: 1 - coinFall }}
              />
            </div>
            <div className="r67-pan">
              <span className="r67-pan-label">مشتری</span>
              <span
                className="r67-person"
                style={{ transform: `translateX(${leave * -140}px)`, opacity: 1 - leave }}
              />
            </div>
          </div>
          <div className="r67-post" />
        </div>
      </div>
    </div>
  )
}

// ─── 4. Each customer on a price list ──────────────────────────────────────
const LISTS = [
  { action: 'list-wholesale', name: 'عمده', price: '۱٬۹۵۰', fallback: 3.9 },
  { action: 'list-retail', name: 'خرده', price: '۲٬۱۰۰', fallback: 4.6 },
  { action: 'list-colleague', name: 'همکار', price: '۱٬۹۰۰', fallback: 5.3 },
]

function PriceListDeck({ t, plan }: R67Props) {
  const riseAt = cueAt(plan, 'deck-rise', 0.4)
  const spreadAt = cueAt(plan, 'deck-spread', 1.75)
  const spread = ease(progress(t, spreadAt, 0.6))

  return (
    <div className="r67-stage">
      <div className="r67-anchor" style={studioSpringEnter(t, riseAt, { y: 40 })}>
        <div className="r67-deck">
          {LISTS.map((list, index) => {
            const at = cueAt(plan, list.action, list.fallback)
            const lit = ease(progress(t, at, 0.3))
            return (
              <div
                key={list.name}
                className="r67-list-card"
                style={{
                  transform: `translateY(${mix(index * -10, (index - 1) * 104, spread)}px) scale(${mix(1, 1.04, lit)})`,
                  borderColor: `rgba(250,204,21,${mix(0.2, 0.9, lit)})`,
                }}
              >
                <span className="r67-list-name">{list.name}</span>
                <span className="r67-list-price" style={{ opacity: lit }}>
                  {list.price}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── 5. Pick the customer, the line prices itself ──────────────────────────
function AutoPricedLine({ t, plan }: R67Props) {
  const pickAt = cueAt(plan, 'customer-pick', 0.5)
  const lineAt = cueAt(plan, 'invoice-line-in', 2.2)
  const fillAt = cueAt(plan, 'price-fill', 3.0)
  const badgeAt = cueAt(plan, 'list-badge', 3.75)
  const lockAt = cueAt(plan, 'line-locked', 4.35)
  const typed = 'حاجی رحیم'
  const chars = Math.round(clamp((t - pickAt) / 0.6) * typed.length)
  const locked = ease(progress(t, lockAt, 0.4))

  return (
    <div className="r67-stage">
      <div className="r67-anchor">
        <div
          className="r67-invoice"
          style={{
            ...studioSpringEnter(t, pickAt - 0.3, { y: 30 }),
            boxShadow: `0 0 ${mix(0, 40, locked)}px rgba(74,222,128,${mix(0, 0.45, locked)})`,
          }}
        >
          <div className="r67-field">{typed.slice(0, chars)}</div>
          {t >= lineAt && (
            <div className="r67-line" style={studioSpringEnter(t, lineAt, { y: 20 })}>
              <span>برنج ۲۵ کیلو</span>
              <span className="r67-line-price" style={{ opacity: ease(progress(t, fillAt, 0.3)) }}>
                ۱٬۹۵۰
              </span>
            </div>
          )}
          {t >= badgeAt && (
            <span className="r67-badge" style={studioSpringEnter(t, badgeAt, { y: 10 })}>
              عمده
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 6. CTA ────────────────────────────────────────────────────────────────
function CtaTag({ t, plan }: R67Props) {
  const swingAt = cueAt(plan, 'cta-tag-swing', 0.25)
  const writtenAt = cueAt(plan, 'cta-tag-written', 1.5)
  const buttonAt = cueAt(plan, 'cta-button', 2.4)
  const brandAt = cueAt(plan, 'cta-brand', 3.45)
  const swing = Math.sin(Math.max(0, t - swingAt) * 3) * mix(8, 0, clamp((t - swingAt) / 2))

  return (
    <div className="r67-stage">
      <div className="r67-anchor">
        <div
          className="r67-cta-tag"
          style={{ ...studioSpringEnter(t, swingAt, { y: -60 }), rotate: `${swing}deg` }}
        >
          <span
            className="r67-cta-ink"
            style={{ clipPath: `inset(0 0 0 ${100 - ease(progress(t, writtenAt, 0.5)) * 100}%)` }}
          >
            یک قیمت، همیشه
          </span>
        </div>
        {t >= buttonAt && (
          <div className="r67-cta-button" style={studioSpringEnter(t, buttonAt, { y: 24 })}>
            شروع رایگان
          </div>
        )}
        {t >= brandAt && (
          <div className="r67-cta-brand" style={studioSpringEnter(t, brandAt, { y: 16 })}>
            hisabche.com
          </div>
        )}
      </div>
    </div>
  )
}
