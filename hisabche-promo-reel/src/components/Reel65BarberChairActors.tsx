// ============================================
// Reel #65 — «سه صندلی پر؛ اما شب فقط یک عدد می‌بینی»
//
// Template: STATION WALL (prompt library hp-018, end-of-shift reconciliation
// technique adapted to a salon). Every sounded word drives exactly one visual
// event: the chairs standing, the seats filling, the day's total landing, the
// handwriting, the calculator sum, the missing consumables slot, the live
// per-chair attribution, the consumable deduction, and the night close where
// one chair is red.
//
// Critical visual laws (Hard Rules 13-19):
// 1. Frame 0 is composed — chairs and cards exist from t = 0 (Rule 18).
// 2. Functional labels only; the spoken sentence never appears on stage
//    (Rule 14), and every label that appears persists to the scene end.
// 3. One unified 9:16 plane, no divider lines (Rule 16).
// 4. Numbers count monotonically — never blink, never wrap (Rule 1).
// 5. Every sounded word's action is read here by cueAt (Rule 13).
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { clamp, ease, mix, progress, pulse, studioSpringEnter } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

interface R65ActorProps {
  t: number
  plan?: SentencePlan
}

function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  return plan?.words.find((w) => w.action === action)?.start ?? fallback
}

/** The three stations of the salon — revenue per chair for the night. */
const STATIONS = [
  { digit: '۱', revenue: 4200000, consumable: 1000000, seat: 1 },
  { digit: '۲', revenue: 1920000, consumable: 2600000, seat: 0.78 },
  { digit: '۳', revenue: 3480000, consumable: 530000, seat: 0.9 },
]

/** ۹٬۶۰۰٬۰۰۰ − ۴٬۱۳۰٬۰۰۰ = ۵٬۴۷۰٬۰۰۰ */
const DAY_REVENUE = 9600000

function signedFa(value: number): string {
  return value < 0 ? `−${faNumber(-value)}` : faNumber(value)
}

// ─── 1. Scene 1: «سه صندلی همیشه پر؛ اما شب فقط یک عدد می‌بینی.» ────────────────
function ChairWallActor({ t, plan }: R65ActorProps) {
  const revealAt = cueAt(plan, 'chairs-reveal', 0.15)
  const fillAt = cueAt(plan, 'chairs-fill', 0.96)
  const totalAt = cueAt(plan, 'day-total-in', 1.36)
  const ledgerAt = cueAt(plan, 'ledger-open', 1.96)
  const numberAt = cueAt(plan, 'single-number', 2.96)
  const unknownAt = cueAt(plan, 'unknown-total', 3.18)

  const chairsPop = ease(clamp(progress(t, revealAt, 0.45)))
  const seatFill = ease(clamp(progress(t, fillAt, 0.55)))
  const totalP = ease(clamp(progress(t, totalAt, 0.5)))
  const bookOpen = clamp(progress(t, ledgerAt, 0.4))
  const revenue = mix(0, DAY_REVENUE, ease(clamp(progress(t, numberAt, 0.45))))
  const unknown = clamp(progress(t, unknownAt, 0.3))
  const alertShimmer = pulse(t, unknownAt, 999, 1.1)

  return (
    <div className="r65-stage">
      <div className="r65-center-anchor">
        {/* The wall of stations — already standing at frame 0 */}
        <div className="r65-chair-row">
          {STATIONS.map((station, i) => (
            <div
              key={station.digit}
              className="r65-chair"
              style={{
                opacity: mix(0.6, 1, chairsPop),
                transform: `translateY(${mix(18, 0, chairsPop)}px) scale(${mix(0.92, 1, chairsPop)})`,
                transitionDelay: `${i * 40}ms`,
              }}
            >
              <span className="r65-chair-back" />
              <span className="r65-chair-seat">
                <span
                  className="r65-seat-fill"
                  style={{ height: `${seatFill * station.seat * 100}%` }}
                />
              </span>
              <span className="r65-chair-digit">{station.digit}</span>
              <span className="r65-chair-meter">
                <span
                  className="r65-meter-fill"
                  style={{ width: `${seatFill * station.seat * 100}%` }}
                />
              </span>
            </div>
          ))}
        </div>

        {/* The single number the owner sees at night */}
        <div
          className="r65-total-card"
          style={{
            opacity: mix(0.35, 1, totalP),
            transform: `translateY(${mix(22, 0, totalP)}px)`,
          }}
        >
          <div className="r65-total-row">
            <span className="r65-total-label">فروش</span>
            <span className="r65-total-value">
              {t >= numberAt ? faNumber(Math.round(revenue)) : '— — —'}
            </span>
          </div>
          <div
            className="r65-total-row"
            style={{
              borderColor: `rgba(248, 113, 113, ${0.1 + unknown * 0.7})`,
              background: `rgba(127, 29, 29, ${unknown * 0.22})`,
            }}
          >
            <span className="r65-total-label">سود</span>
            <span className="r65-total-value" style={{ opacity: 0.55 + 0.45 * alertShimmer }}>
              {unknown > 0.35 ? '؟' : '— — —'}
            </span>
          </div>
        </div>

        {/* The ledger book opening under the total */}
        <div
          className="r65-ledger-flap"
          style={{
            opacity: bookOpen,
            transform: `rotateX(${mix(78, 0, bookOpen)}deg)`,
          }}
        />
      </div>
    </div>
  )
}

// ─── 2. Scene 2: «دفتر می‌نویسد… سهم محصولات مصرفی کجاست؟» ───────────────────────
function PaperDrawerActor({ t, plan }: R65ActorProps) {
  const noteAt = cueAt(plan, 'notebook-enter', 0.15)
  const writeAt = cueAt(plan, 'handwrite-row', 0.45)
  const tagAt = cueAt(plan, 'service-tag', 1.25)
  const calcAt = cueAt(plan, 'calculator-in', 1.98)
  const sumAt = cueAt(plan, 'sum-total', 2.6)
  const gapAt = cueAt(plan, 'consumables-gap', 3.1)
  const gapOpenAt = cueAt(plan, 'gap-slot-open', 3.35)
  const missingAt = cueAt(plan, 'missing-gap', 4.15)

  const CLIENT = 'مهدی'
  const SERVICE = 'خدمات'

  const typed = Math.round(mix(0, CLIENT.length, ease(clamp(progress(t, writeAt, 0.75)))))
  const tagP = ease(clamp(progress(t, tagAt, 0.4)))
  const calcP = ease(clamp(progress(t, calcAt, 0.45)))
  const sumP = ease(clamp(progress(t, sumAt, 0.5)))
  const gapP = ease(clamp(progress(t, gapAt, 0.45)))
  const gapOpen = ease(clamp(progress(t, gapOpenAt, 0.5)))
  const missing = clamp(progress(t, missingAt, 0.35))
  const keyP = [0.22, 0.5, 0.78].map((threshold) => (sumP > threshold ? 1 : 0))

  return (
    <div className="r65-stage">
      <div className="r65-center-anchor">
        {/* Handwritten notebook — the client line is written word by word */}
        <div className="r65-notebook" style={studioSpringEnter(t, noteAt, { y: 18, scale: 0.95 })}>
          <span className="r65-notebook-title">دفتر</span>
          <div className="r65-nb-line">
            <span className="r65-nb-hand">{CLIENT.slice(0, typed)}</span>
            <span
              className="r65-nb-tag"
              style={{
                opacity: tagP,
                transform: `translateX(${mix(-8, 0, tagP)}px)`,
              }}
            >
              {SERVICE}
            </span>
          </div>
          <span className="r65-nb-rule" />
          <span className="r65-nb-rule" />
        </div>

        {/* Calculator — the night's sum, and nothing else */}
        <div className="r65-calc" style={studioSpringEnter(t, calcAt, { y: 16, scale: 0.94 })}>
          <span className="r65-calc-label">ماشین‌حساب</span>
          <span className="r65-calc-screen" style={{ opacity: mix(0.4, 1, calcP) }}>
            {faNumber(Math.round(mix(0, DAY_REVENUE, sumP)))}
          </span>
          <span className="r65-calc-keys">
            {keyP.map((lit, i) => (
              <span key={i} className={lit ? 'r65-calc-key lit' : 'r65-calc-key'} />
            ))}
          </span>
        </div>

        {/* The slot that stays empty: the consumables share of that revenue */}
        <div
          className="r65-gap-slot"
          style={{
            opacity: mix(0.3, 1, gapP),
            borderColor: `rgba(240, 199, 94, ${0.25 + gapOpen * 0.45})`,
            boxShadow: `0 0 ${Math.round(missing * 24)}px rgba(248, 113, 113, ${missing * 0.4})`,
          }}
        >
          <span className="r65-gap-label">محصولات</span>
          <span className="r65-gap-empty">{gapOpen > 0.4 ? '؟' : '—'}</span>
        </div>
      </div>
    </div>
  )
}

// ─── 3. Scene 3: «هر خدمت همان لحظه روی صندلی خودش می‌نشیند.» ──────────────────
function LiveChairsActor({ t, plan }: R65ActorProps) {
  const brandAt = cueAt(plan, 'brand-chip-in', 0.32)
  const liveAt = cueAt(plan, 'chairs-live', 0.82)
  const serviceAt = cueAt(plan, 'service-tick', 1.02)
  const postAt = cueAt(plan, 'instant-post', 1.78)
  const ownAt = cueAt(plan, 'chair-attribution', 2.78)
  const subAt = cueAt(plan, 'consumable-subtract', 3.62)
  const rowAt = cueAt(plan, 'consumable-row', 3.95)
  const sepAt = cueAt(plan, 'separate-row', 4.3)
  const deductAt = cueAt(plan, 'cost-deduct', 4.7)

  const liveP = ease(clamp(progress(t, liveAt, 0.5)))
  const rowP = ease(clamp(progress(t, rowAt, 0.45)))
  const sepP = ease(clamp(progress(t, sepAt, 0.4)))
  const deduct = ease(clamp(progress(t, deductAt, 0.7)))
  const postGlow = clamp(progress(t, postAt, 0.4))

  return (
    <div className="r65-stage">
      <div className="r65-center-anchor">
        <span
          className="r65-brand-chip"
          style={studioSpringEnter(t, brandAt, { y: 10, scale: 0.86 })}
        >
          حسابچه
        </span>

        {/* Three live stations: every service lands on its own chair */}
        <div className="r65-chair-row">
          {STATIONS.map((station, i) => {
            const chairStart = serviceAt + i * 0.12
            const fill = ease(clamp(progress(t, chairStart, 1.3)))
            const own = clamp(progress(t, ownAt, 0.4))
            return (
              <div
                key={station.digit}
                className="r65-chair live"
                style={{
                  opacity: mix(0.45, 1, liveP),
                  transform: `translateY(${mix(14, 0, liveP)}px)`,
                  boxShadow: `0 0 ${Math.round(postGlow * own * 26)}px rgba(126, 240, 178, ${postGlow * own * 0.45})`,
                }}
              >
                <span className="r65-chair-back" />
                <span className="r65-chair-seat">
                  <span
                    className="r65-seat-fill"
                    style={{ height: `${fill * station.seat * 100}%` }}
                  />
                </span>
                <span className="r65-chair-digit">{station.digit}</span>
                <span className="r65-live-value">
                  {faNumber(Math.round(station.revenue * fill))}
                </span>
              </div>
            )
          })}
        </div>

        <span className="r65-service-tag" style={{ opacity: liveP }}>
          خدمت
        </span>

        {/* The consumables row — its chips stay, the cost bar only drops */}
        <div className="r65-cost-row" style={{ opacity: mix(0.25, 1, rowP) }}>
          <span className="r65-cost-label">مصرفی</span>
          <span className="r65-cost-chips">
            {STATIONS.map((station, i) => {
              const chipAt = subAt + i * 0.1
              const chipP = ease(clamp(progress(t, chipAt, 0.4)))
              const spent = mix(0, station.consumable, deduct)
              return (
                <span
                  key={station.digit}
                  className="r65-cost-chip"
                  style={{
                    opacity: chipP,
                    transform: `translateY(${mix(-10, 0, chipP)}px)`,
                  }}
                >
                  −{faNumber(Math.round(spent))}
                </span>
              )
            })}
          </span>
          <span className="r65-cost-track">
            <span
              className="r65-cost-drop"
              style={{
                height: `${(1 - deduct * sepP) * 100}%`,
              }}
            />
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── 4. Scene 4: «سود هر صندلی را جدا می‌بینی؛ یکیشان قرمز است.» ────────────────
function ChairProfitActor({ t, plan }: R65ActorProps) {
  const nightAt = cueAt(plan, 'night-close', 0.15)
  const bookAt = cueAt(plan, 'book-close', 1.08)
  const profitAt = cueAt(plan, 'profit-per-chair', 1.62)
  const splitAt = cueAt(plan, 'chair-values-split', 2.64)
  const negAt = cueAt(plan, 'chair-two-negative', 3.4)
  const redAt = cueAt(plan, 'red-flash', 3.75)
  const totalAt = cueAt(plan, 'total-profit-reveal', 4.05)

  const night = ease(clamp(progress(t, nightAt, 0.6)))
  const bookP = ease(clamp(progress(t, bookAt, 0.5)))
  const profitP = ease(clamp(progress(t, profitAt, 0.6)))
  const splitP = ease(clamp(progress(t, splitAt, 0.5)))
  const negative = clamp(progress(t, negAt, 0.35))
  const redFlash = pulse(t, redAt, 999, 0.7)
  const totalP = ease(clamp(progress(t, totalAt, 0.7)))

  const profits = STATIONS.map((station) => station.revenue - station.consumable)
  const totalProfit = profits.reduce((sum, value) => sum + value, 0)

  return (
    <div className="r65-stage">
      <div className="r65-night-veil" style={{ opacity: night * 0.55 }} />

      <div className="r65-center-anchor">
        {/* The book closes */}
        <span
          className="r65-book"
          style={{
            opacity: mix(0.3, 1, bookP),
            transform: `translateY(${mix(-12, 0, bookP)}px) scaleX(${mix(0.7, 1, bookP)})`,
          }}
        />

        {/* Profit of each station — chair 2 turns red and stays red */}
        <div className="r65-chair-row">
          {STATIONS.map((station, i) => {
            const chairStart = splitAt + i * 0.12
            const valueP = ease(clamp(progress(t, chairStart, 0.8)))
            const isRed = station.digit === '۲'
            const redState = isRed ? negative : 0
            const value = profits[i] ?? 0
            return (
              <div
                key={station.digit}
                className="r65-chair"
                style={{
                  opacity: mix(0.4, 1, profitP),
                  transform: `translateY(${mix(16, 0, profitP)}px) scale(${mix(0.94, 1, splitP)})`,
                  borderColor: isRed ? `rgba(248, 113, 113, ${0.25 + redState * 0.6})` : undefined,
                  background: isRed
                    ? `linear-gradient(180deg, rgba(60, 12, 12, ${redState * 0.9}), rgba(20, 6, 6, 0.95))`
                    : undefined,
                  boxShadow: isRed
                    ? `0 0 ${Math.round(redFlash * 34)}px rgba(248, 113, 113, ${redFlash * 0.45})`
                    : `0 0 ${Math.round(valueP * 18)}px rgba(126, 240, 178, ${valueP * 0.18})`,
                }}
              >
                <span className="r65-chair-back" />
                <span className="r65-chair-seat">
                  <span
                    className="r65-seat-fill"
                    style={{
                      height: `${valueP * (value > 0 ? 1 : 0.55) * 100}%`,
                      background:
                        value > 0 ? undefined : 'linear-gradient(180deg, #f87171, #7f1d1d)',
                    }}
                  />
                </span>
                <span className="r65-chair-digit">{station.digit}</span>
                <span
                  className="r65-live-value"
                  style={{ color: value >= 0 ? '#7ef0b2' : '#fca5a5' }}
                >
                  {signedFa(Math.round(value * valueP))}
                </span>
              </div>
            )
          })}
        </div>

        {/* The night's real profit */}
        <div
          className="r65-total-card profit"
          style={{
            opacity: mix(0.3, 1, totalP),
            boxShadow: `0 0 ${Math.round(totalP * 30)}px rgba(126, 240, 178, ${totalP * 0.32})`,
          }}
        >
          <span className="r65-total-label">سود</span>
          <span className="r65-total-value big">{faNumber(Math.round(totalProfit * totalP))}</span>
        </div>
      </div>
    </div>
  )
}

// ─── 5. Scene 5: «سودِ هر صندلی را ببین؛ شروع رایگان در حسابچه.» ─────────────────
function SalonCtaActor({ t, plan }: R65ActorProps) {
  const enterAt = cueAt(plan, 'cta-enter', 0.2)
  const echoAt = cueAt(plan, 'chair-echo', 0.72)
  const pulseAt = cueAt(plan, 'cta-pulse', 1.24)
  const buttonAt = cueAt(plan, 'cta-button-pulse', 2.12)
  const brandAt = cueAt(plan, 'brand-echo', 2.84)

  const echo = ease(clamp(progress(t, echoAt, 0.5)))
  const buttonPulse = pulse(t, buttonAt, 999, 1.3)
  const cardPulse = pulse(t, pulseAt, 999, 1.6)
  const brandGlow = clamp(progress(t, brandAt, 0.6))

  return (
    <div className="r65-stage">
      <div className="r65-cta-card" style={studioSpringEnter(t, enterAt, { y: 22 })}>
        {/* Three chairs answered in one line, then the ask */}
        <div className="r65-echo-row" style={{ opacity: echo }}>
          <span className="r65-echo-chip">۱</span>
          <span className="r65-echo-chip">۲</span>
          <span className="r65-echo-chip">۳</span>
        </div>

        <span
          className="r65-cta-brand"
          style={{
            boxShadow: `0 0 ${Math.round(brandGlow * 26)}px rgba(244, 212, 124, ${brandGlow * 0.5})`,
          }}
        >
          حسابچه
        </span>

        <span className="r65-cta-button" style={{ transform: `scale(${1 + buttonPulse * 0.045})` }}>
          شروع رایگان
        </span>

        <span
          className="r65-cta-url"
          style={{
            opacity: 0.75 + 0.25 * cardPulse,
            textShadow: `0 0 ${Math.round(brandGlow * 22)}px rgba(244, 212, 124, ${brandGlow * 0.9})`,
          }}
        >
          hisabche.com
        </span>
      </div>
    </div>
  )
}

// ─── Dispatcher (wired in WordDrivenStage by the `r65-` prefix) ─────────────────
export function Reel65BarberActor({
  actor,
  t,
  plan,
}: {
  actor: string
  t: number
  plan?: SentencePlan
}) {
  if (actor === 'r65-paper-drawer') return <PaperDrawerActor t={t} plan={plan} />
  if (actor === 'r65-live-chairs') return <LiveChairsActor t={t} plan={plan} />
  if (actor === 'r65-chair-profit') return <ChairProfitActor t={t} plan={plan} />
  if (actor === 'r65-cta-salon') return <SalonCtaActor t={t} plan={plan} />
  return <ChairWallActor t={t} plan={plan} />
}
