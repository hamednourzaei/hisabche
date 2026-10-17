// ============================================
// Reel #63 — «گرم و مظنه و اجرت؛ قیمت این گردنبند چنده؟»
//
// Template: SWISS FINANCIAL TERMINAL (prompt library hp-016).
// Goldsmith scenario: a customer asks the price of a necklace at the display
// case while the gram rate moves. Every sounded word drives one visual event:
// the case, the rate ticker, the scale needle, the gram readout, the rate
// lock on the invoice, and the split of chain / stone / making wage.
//
// Critical visual laws:
// 1. Center of gravity strictly in the 42%-58% central frame.
// 2. Numbers NEVER blink or flicker (stable continuous odometer/hold).
// 3. Subtitle overlay floats at bottom without squeezing content.
// 4. Climax hold >= 1.2s, CTA hold >= 3.5s with hisabche.com.
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { clamp, ease, mix, progress, pulse, studioSpringEnter } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

interface R63ActorProps {
  t: number
  plan?: SentencePlan | undefined
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const faDigit = (d: string): string => FA_DIGITS[Number(d)] ?? d
/** Gram readout with 3 Persian decimals: 3.25 -> «۳٫۲۵۰» */
const faGram = (n: number): string => n.toFixed(3).replace(/\d/g, faDigit).replace('.', '٫')

export function Reel63GoldsmithActor({
  actor,
  t,
  plan,
}: {
  actor: string
  t: number
  plan?: SentencePlan | undefined
}) {
  if (actor === 'r63-goldsmith-hook') return <GoldsmithHookActor t={t} plan={plan} />
  if (actor === 'r63-manual-math') return <ManualMathActor t={t} plan={plan} />
  if (actor === 'r63-gram-lock') return <GramLockActor t={t} plan={plan} />
  if (actor === 'r63-labor-profit') return <LaborProfitActor t={t} plan={plan} />
  if (actor === 'r63-cta-gold') return <GoldCtaActor t={t} plan={plan} />
  return null
}

function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  return plan?.words.find((w) => w.action === action)?.start ?? fallback
}

const MARKET_RATES = ['۴۸٬۲۰۰٬۰۰۰', '۴۸٬۹۵۰٬۰۰۰', '۴۹٬۴۰۰٬۰۰۰']
const FALLBACK_RATE = '۴۹٬۴۰۰٬۰۰۰'

// ─── 1. Scene 1: «قیمت این گردنبند چنده؟ مظنه امروز چند شد؟» ────────────────
function GoldsmithHookActor({ t, plan }: R63ActorProps) {
  const askAt = cueAt(plan, 'price-question', 0.2)
  const necklaceAt = cueAt(plan, 'necklace-reveal', 0.75)
  const freezeAt = cueAt(plan, 'counter-freeze', 1.3)
  const tickerAt = cueAt(plan, 'rate-ticker-spin', 1.9)
  const swingAt = cueAt(plan, 'needle-swing', 3.1)

  // The world is already laid out at t=0 (Hard Rule 18): motion arrives into a composed frame.
  const askP = ease(clamp(progress(t, askAt, 0.4)))
  const caseSettle = ease(clamp(progress(t, 0, 0.5)))
  const necklacePop = mix(0.72, 1, ease(clamp(progress(t, necklaceAt, 0.5))))
  const caseGlow = clamp(progress(t, freezeAt, 0.4))
  const tickSlot = Math.max(0, Math.floor((t - tickerAt) / 0.32)) % MARKET_RATES.length
  const rateText = t >= tickerAt ? (MARKET_RATES[tickSlot] ?? FALLBACK_RATE) : '— — —'
  const needleAngle = mix(-16, 9, ease(clamp(progress(t, swingAt, 0.7))))
  const readoutText = t >= freezeAt ? '؟ ؟ ؟' : '— — —'
  const readoutShimmer = pulse(t, freezeAt, 999, 0.9)

  return (
    <div className="r63-stage">
      <div className="r63-center-anchor">
        {/* Upper zone — the market outside */}
        <div className="r63-market-zone">
          <div
            className="r63-case"
            style={{
              transform: `scale(${mix(0.94, 1, caseSettle)})`,
              opacity: mix(0.55, 1, caseSettle),
              boxShadow: `0 0 ${Math.round(caseGlow * 44)}px rgba(212, 175, 55, ${0.25 + caseGlow * 0.4})`,
            }}
          >
            <div className="r63-case-glass" />
            <div className="r63-necklace" style={{ transform: `scale(${necklacePop})` }}>
              <span className="r63-necklace-band" />
              <span className="r63-necklace-stone" />
            </div>
          </div>

          <div
            className="r63-rate-chip"
            style={{
              boxShadow: `0 0 ${Math.round(askP * 14)}px rgba(240, 199, 94, ${askP * 0.35})`,
            }}
          >
            <span className="r63-rate-label">مظنه امروز</span>
            <span className="r63-rate-ticker">{rateText}</span>
          </div>
        </div>

        {/* Lower zone — the ledger side */}
        <div className="r63-ledger-zone">
          <div className="r63-scale-dial">
            <span className="r63-scale-ticks" />
            <span className="r63-scale-needle" style={{ transform: `rotate(${needleAngle}deg)` }} />
            <span className="r63-scale-readout" style={{ opacity: 0.55 + 0.45 * readoutShimmer }}>
              {readoutText}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 2. Scene 2: «مظنه، عیار، وزن و اجرت؛ یه محاسبه اشتباه، سود می‌پره.» ────
function ManualMathActor({ t, plan }: R63ActorProps) {
  const slipAt = cueAt(plan, 'paper-slip', 0.2)
  const karatAt = cueAt(plan, 'karat-stamp', 0.65)
  const weightsAt = cueAt(plan, 'weights-scatter', 1.05)
  const laborAt = cueAt(plan, 'labor-scribble', 1.55)
  const calcAt = cueAt(plan, 'calculator-tap', 2.25)
  const wrongAt = cueAt(plan, 'wrong-strike', 2.75)
  const bleedAt = cueAt(plan, 'profit-bleed', 3.4)
  const badgeAt = cueAt(plan, 'loss-badge', 3.75)

  const scatterX = mix(20, 0, ease(clamp(progress(t, weightsAt, 0.5))))
  const wrongP = ease(clamp(progress(t, wrongAt, 0.4)))
  const bleedP = ease(clamp(progress(t, bleedAt, 0.8)))
  const screenValue = t >= wrongAt ? '۴۹٬۶۰۰٬۰۰۰' : '۵۱٬۸۰۰٬۰۰۰'
  const slotP = clamp(progress(t, calcAt, 0.6))
  const lossP = ease(clamp(progress(t, badgeAt, 0.5)))

  return (
    <div className="r63-stage">
      <div className="r63-center-anchor" style={studioSpringEnter(t, slipAt, { y: 22 })}>
        {/* Handwritten rate slip */}
        <div className="r63-slip">
          <span className="r63-slip-title">دفتر</span>
          <span className="r63-slip-rate">۴۸٬۲۰۰٬۰۰۰</span>
        </div>

        {/* Four manual variables pop in, one per cue */}
        <div className="r63-token-row">
          <span
            className="r63-token r63-token-gold"
            style={studioSpringEnter(t, slipAt, { y: 12, scale: 0.9 })}
          >
            مظنه
          </span>
          <span
            className="r63-token r63-token-cyan"
            style={studioSpringEnter(t, karatAt, { y: 12, scale: 0.9 })}
          >
            عیار
          </span>
          <span
            className="r63-token r63-token-amber"
            style={{
              ...studioSpringEnter(t, weightsAt, { y: 12, scale: 0.9 }),
              marginInlineStart: `${scatterX}px`,
            }}
          >
            وزن
          </span>
          <span
            className="r63-token r63-token-violet"
            style={studioSpringEnter(t, laborAt, { y: 12, scale: 0.9 })}
          >
            اجرت
          </span>
        </div>

        <div className="r63-calc-wrap">
          {/* Hand calculator */}
          <div className="r63-calc">
            <div
              className="r63-calc-screen"
              style={{ borderColor: `rgba(248, 113, 113, ${0.2 + wrongP * 0.8})` }}
            >
              {screenValue}
            </div>
            <div className="r63-calc-keys">
              <span className={slotP > 0.2 ? 'r63-calc-key lit' : 'r63-calc-key'} />
              <span className={slotP > 0.5 ? 'r63-calc-key lit' : 'r63-calc-key'} />
              <span className={slotP > 0.8 ? 'r63-calc-key lit' : 'r63-calc-key'} />
            </div>
            {wrongP > 0 && (
              <span className="r63-wrong-x" style={{ opacity: wrongP }}>
                ✕
              </span>
            )}
          </div>

          {/* Profit bar bleeding away — the frame reddens with the loss (loss-badge cue) */}
          <div
            className="r63-bleed-wrap"
            style={{
              borderColor: `rgba(248, 113, 113, ${0.12 + lossP * 0.5})`,
              boxShadow: `0 0 ${Math.round(lossP * 26)}px rgba(248, 113, 113, ${lossP * 0.4})`,
            }}
          >
            <div
              className="r63-profit-bar"
              style={{
                height: `${mix(100, 34, bleedP)}%`,
                background:
                  bleedP > 0.5
                    ? 'linear-gradient(180deg, #f87171, #b91c1c)'
                    : 'linear-gradient(180deg, #fbbf24, #d97706)',
              }}
            />
            <span className="r63-token r63-token-gold r63-bar-label">سود</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 3. Scene 3: «تو حسابچه طلا به گرم ثبت می‌شه؛ نرخ روز هم روی فاکتور قفل می‌شه.» ─
function GramLockActor({ t, plan }: R63ActorProps) {
  const brandAt = cueAt(plan, 'brand-reveal', 0.35)
  const goldAt = cueAt(plan, 'gold-enter', 0.95)
  const readoutAt = cueAt(plan, 'scale-readout', 1.45)
  const pinAt = cueAt(plan, 'weight-pin', 1.9)
  const settleAt = cueAt(plan, 'readout-settle', 2.2)
  const boardAt = cueAt(plan, 'rate-board', 2.75)
  const dayAt = cueAt(plan, 'day-rate-fill', 3.1)
  const invoiceAt = cueAt(plan, 'invoice-enter', 3.75)
  const lockAt = cueAt(plan, 'rate-lock', 4.25)

  const grams = mix(0, 3.25, ease(clamp(progress(t, readoutAt, 1.1))))
  const goldP = ease(clamp(progress(t, goldAt, 0.5)))
  const settleGlow = clamp(progress(t, settleAt, 0.4))
  const fillP = ease(clamp(progress(t, dayAt, 0.7)))
  const lockPop = mix(0.6, 1, ease(clamp(progress(t, lockAt, 0.45))))

  // Measured weight dots: they land once and stay stacked (Hard Rule 18 — no popping churn).
  const particles = [0, 1, 2, 3].map((i) => {
    const born = pinAt + i * 0.08
    return {
      opacity: clamp(progress(t, born, 0.2)),
      y: mix(-10, 12 + i * 9, ease(clamp(progress(t, born, 0.55)))),
    }
  })

  return (
    <div className="r63-stage">
      <div className="r63-center-anchor" style={studioSpringEnter(t, brandAt, { y: 24 })}>
        {/* Brand + metal unit */}
        <div className="r63-brand-row">
          <span className="r63-brand-chip">حسابچه</span>
        </div>

        {/* Day rate board */}
        <div className="r63-rate-board" style={studioSpringEnter(t, boardAt, { y: 14 })}>
          <span className="r63-rate-board-value">۴۹٬۴۰۰٬۰۰۰</span>
          <span className="r63-rate-board-fill" style={{ width: `${fillP * 100}%` }} />
        </div>

        {/* Digital gram scale */}
        <div className="r63-gram-scale">
          <div
            className="r63-gram-screen"
            style={{
              borderColor: `rgba(212, 175, 55, ${0.25 + settleGlow * 0.65})`,
            }}
          >
            <span
              className="r63-gram-value"
              style={{
                textShadow: `0 0 ${Math.round(goldP * 16)}px rgba(244, 212, 124, ${0.15 + 0.55 * goldP})`,
              }}
            >
              {faGram(grams)}
            </span>
            <span className="r63-gram-unit">گرم</span>
          </div>
          <div className="r63-weight-dots">
            {particles.map((p, i) => (
              <span
                key={i}
                className="r63-wdot"
                style={{ opacity: p.opacity, transform: `translateY(${p.y}px)` }}
              />
            ))}
          </div>
        </div>

        {/* Invoice with the frozen day rate */}
        <div className="r63-invoice-card" style={studioSpringEnter(t, invoiceAt, { y: 16 })}>
          <div className="r63-inv-row">
            <span className="r63-inv-label">وزن</span>
            <span className="r63-inv-value">{faGram(grams)}</span>
          </div>
          <div className="r63-inv-row">
            <span className="r63-inv-label">نرخ روز</span>
            {t >= lockAt ? (
              <span className="r63-inv-value ok">
                ۴۹٬۴۰۰٬۰۰۰{' '}
                <span className="r63-lock-icon" style={{ transform: `scale(${lockPop})` }}>
                  🔒
                </span>
              </span>
            ) : (
              <span className="r63-inv-value">— — —</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 4. Scene 4: «اجرت، سنگ و زنجیر جدا ثبت می‌شن؛ سود واقعی هر فاکتور معلومه.» ─
function LaborProfitActor({ t, plan }: R63ActorProps) {
  const laborAt = cueAt(plan, 'labor-chip', 0.2)
  const stoneAt = cueAt(plan, 'stone-chip', 0.65)
  const chainAt = cueAt(plan, 'chain-chip', 1.15)
  const splitAt = cueAt(plan, 'components-split', 1.65)
  const booksAt = cueAt(plan, 'books-entry', 2.0)
  const profitAt = cueAt(plan, 'profit-row', 2.85)
  const marginAt = cueAt(plan, 'margin-hl', 3.25)
  const invAt = cueAt(plan, 'invoice-lock', 3.9)
  const climaxAt = cueAt(plan, 'climax-hold', 4.35)

  const splitP = ease(clamp(progress(t, splitAt, 0.9)))
  const profitVal = mix(0, 5100000, ease(clamp(progress(t, profitAt, 0.9))))
  const marginHL = t >= marginAt
  const climaxGlow = ease(clamp(progress(t, climaxAt, 0.6)))

  return (
    <div className="r63-stage">
      <div className="r63-center-anchor" style={studioSpringEnter(t, laborAt, { y: 24 })}>
        {/* Exploded necklace rack: chain / stone / making wage */}
        <div className="r63-explode-rack">
          <div
            className="r63-part-slot"
            style={{ transform: `translate(${mix(6, 34, splitP)}px, ${mix(4, -10, splitP)}px)` }}
          >
            <div
              className="r63-part-chip r63-part-chain"
              style={studioSpringEnter(t, chainAt, { y: 10, scale: 0.9 })}
            >
              <span className="r63-part-icon">◯◯</span>
              <span className="r63-part-name">زنجیر</span>
              <span className="r63-part-price">۲٬۹۰۰٬۰۰۰</span>
            </div>
          </div>

          <div
            className="r63-part-slot"
            style={{ transform: `translate(0px, ${mix(2, -26, splitP)}px)` }}
          >
            <div
              className="r63-part-chip r63-part-stone"
              style={studioSpringEnter(t, stoneAt, { y: 10, scale: 0.9 })}
            >
              <span className="r63-part-icon">◆</span>
              <span className="r63-part-name">سنگ</span>
              <span className="r63-part-price">۱٬۴۰۰٬۰۰۰</span>
            </div>
          </div>

          <div
            className="r63-part-slot"
            style={{ transform: `translate(${mix(-6, -34, splitP)}px, ${mix(4, -10, splitP)}px)` }}
          >
            <div
              className="r63-part-chip r63-part-labor"
              style={studioSpringEnter(t, laborAt, { y: 10, scale: 0.9 })}
            >
              <span className="r63-part-icon">✎</span>
              <span className="r63-part-name">اجرت ساخت</span>
              <span className="r63-part-price">۲٬۱۰۰٬۰۰۰</span>
            </div>
          </div>
        </div>

        {/* Profit card */}
        <div className="r63-profit-card" style={studioSpringEnter(t, booksAt, { y: 16 })}>
          <div className={marginHL ? 'r63-prow hl' : 'r63-prow'}>
            <span className="r63-prow-label">تفاضل نرخ</span>
            <span className="r63-prow-val">۳٬۰۰۰٬۰۰۰</span>
          </div>
          <div className="r63-prow">
            <span className="r63-prow-label">اجرت ساخت</span>
            <span className="r63-prow-val">۲٬۱۰۰٬۰۰۰</span>
          </div>
          <div
            className="r63-ptotal"
            style={{
              boxShadow: `0 0 ${Math.round(climaxGlow * 30)}px rgba(126, 240, 178, ${climaxGlow * 0.35})`,
            }}
          >
            <span className="r63-ptotal-label">سود این قطعه</span>
            <span className="r63-ptotal-val">{faNumber(profitVal)}</span>
          </div>
          <span className="r63-invoice-chip" style={studioSpringEnter(t, invAt, { y: 10 })}>
            فاکتور ۱۲۸ ثبت شد
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── 5. Scene 5: «زرگریت رو مجهز کن؛ شروع رایگان در hisabche.com» ──────────
function GoldCtaActor({ t, plan }: R63ActorProps) {
  const enterAt = cueAt(plan, 'cta-enter', 0.2)
  const pulseAt = cueAt(plan, 'cta-pulse', 1.6)
  const urlAt = cueAt(plan, 'url-glow', 2.65)

  const buttonPulse = pulse(t, pulseAt, 999, 1.4)
  const urlGlow = clamp(progress(t, urlAt, 0.6))

  return (
    <div className="r63-stage">
      <div className="r63-cta-card" style={studioSpringEnter(t, enterAt, { y: 26 })}>
        <span className="r63-cta-brand">حسابچه</span>
        <span className="r63-cta-button" style={{ transform: `scale(${1 + buttonPulse * 0.045})` }}>
          شروع رایگان
        </span>
        <span
          className="r63-cta-url"
          style={{
            textShadow: `0 0 ${Math.round(urlGlow * 22)}px rgba(212, 175, 55, ${urlGlow * 0.9})`,
          }}
        >
          hisabche.com
        </span>
      </div>
    </div>
  )
}
