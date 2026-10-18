// ============================================
// Reel #68 — «دزد دخلت کیه وقتی نه دزدی شده و نه فروشت کمه؟»
//
// Motion Design Showreel: Dynamic Visual Craft · Masterclass Polish
//
// Permanent Guardrails (Hard Rules 13-19):
// 1. One Focal Stage: centered in Y in [42%, 58%].
// 2. Zero duplicated narration: dialogue lives in subtitles.
// 3. Strict text budget: <= 6 words per label.
// 4. Zero center divider line artifacts (clean of any dividing line classes).
// 5. Authentic Persian: natural bazaar terms.
// 6. AV Sync Law: every sounded word has an action, read via cueAt.
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { clamp, ease, mix, progress, studioSpringEnter } from '../engine/anim'

interface R68ActorProps {
  t: number
  plan?: SentencePlan | undefined
}

/** Dispatches an `r68-*` actor id to its visual component. */
export function Reel68ShowreelActor({
  actor,
  t,
  plan,
}: {
  actor: string
  t: number
  plan?: SentencePlan | undefined
}) {
  if (actor === 'r68-hook-till-arrest') return <HookTillArrestActor t={t} plan={plan} />
  if (actor === 'r68-exploded-cogs-leak') return <ExplodedCogsLeakActor t={t} plan={plan} />
  if (actor === 'r68-quantum-sync-conduit') return <QuantumSyncConduitActor t={t} plan={plan} />
  if (actor === 'r68-luminous-resolution-cta')
    return <LuminousResolutionCtaActor t={t} plan={plan} />
  return null
}

function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  return plan?.words.find((w) => w.action === action)?.start ?? fallback
}

// ─── 1. Beat A: شلیک قلاب، جهش کنتور فروش و معمای دخل خالی ─────────────────
function HookTillArrestActor({ t, plan }: R68ActorProps) {
  const vaultAt = cueAt(plan, 'till-vault-slam', 0.35)
  const surgeAt = cueAt(plan, 'sales-meter-surge', 1.75)
  const drainAt = cueAt(plan, 'drain-leak-pulse', 3.1)
  const freezeAt = cueAt(plan, 'question-impact-freeze', 3.45)

  const surgeP = clamp(progress(t, surgeAt, 0.9))
  const isDraining = t >= drainAt
  const isFrozen = t >= freezeAt

  return (
    <div className="r68-stage">
      <div className="r68-center-anchor" style={studioSpringEnter(t, vaultAt, { y: 26 })}>
        {/* Core Till Vault Card */}
        <div className={`r68-vault-card ${isFrozen ? 'shock-freeze' : ''}`}>
          <div className="r68-card-head">
            <span className="r68-dot gold" />
            <span className="r68-head-title">صندوق فروشگاه مرکزی</span>
            <span className="r68-badge-tag">نبض زنده</span>
          </div>

          {/* Sales Meter */}
          <div className="r68-sales-meter">
            <span className="r68-meter-label">فروش کل روز</span>
            <span className="r68-meter-val">
              {t >= surgeAt
                ? `${mix(120, 850, ease(surgeP)).toFixed(0)}٬۰۰۰٬۰۰۰ ریال`
                : '۱۲۰٬۰۰۰٬۰۰۰ ریال'}
            </span>
          </div>

          {/* Mystery Drain Pill */}
          {isDraining && (
            <div className="r68-drain-alert" style={studioSpringEnter(t, drainAt, { y: 14 })}>
              <span className="r68-alert-icon">⚠️</span>
              <div className="r68-drain-text">
                <span className="r68-drain-title">کسری دخل نامعلوم</span>
                <span className="r68-drain-num">موجودی: صفر!</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 2. Beat B: کالبدشکافی سه‌بعدی لایه‌های هزینه و سود کاغذی ─────────────
function ExplodedCogsLeakActor({ t, plan }: R68ActorProps) {
  const paperAt = cueAt(plan, 'paper-profit-card', 0.35)
  const explodeAt = cueAt(plan, 'layer-explode-split', 1.3)
  const sliceAt = cueAt(plan, 'hidden-costs-slice', 2.25)
  const flashAt = cueAt(plan, 'danger-gap-flash', 2.75)
  const dropAt = cueAt(plan, 'margin-drain-drop', 3.15)

  const isExploded = t >= explodeAt
  const isFlashing = t >= flashAt
  const isDropped = t >= dropAt

  return (
    <div className="r68-stage">
      <div className="r68-center-anchor" style={studioSpringEnter(t, paperAt, { y: 24 })}>
        <div className="r68-exploded-container">
          {/* Top Layer: Apparent Paper Profit */}
          <div className="r68-layer paper-layer" style={studioSpringEnter(t, paperAt, { y: 12 })}>
            <div className="r68-layer-row">
              <span className="r68-layer-title">سود کاغذی فاکتورها</span>
              <span className="r68-num green">+۲۴۰٬۰۰۰٬۰۰۰ ریال</span>
            </div>
          </div>

          {/* Middle Exploded Layer: Hidden Scrap & COGS */}
          {isExploded && (
            <div
              className={`r68-layer cogs-layer ${isFlashing ? 'danger-pulse' : ''}`}
              style={studioSpringEnter(t, explodeAt, { y: 16 })}
            >
              <div className="r68-layer-row">
                <span className="r68-layer-title">بهای تمام‌شده و ضایعات</span>
                <span className="r68-num red">-۱۹۵٬۰۰۰٬۰۰۰ ریال</span>
              </div>
            </div>
          )}

          {/* Bottom Sliced Layer: Uncalculated Leaks */}
          {t >= sliceAt && (
            <div className="r68-layer leak-layer" style={studioSpringEnter(t, sliceAt, { y: 16 })}>
              <div className="r68-layer-row">
                <span className="r68-layer-title">نشتی هزینه‌های پنهان</span>
                <span className="r68-num amber">-۴۵٬۰۰۰٬۰۰۰ ریال</span>
              </div>
            </div>
          )}

          {/* Real Result Badge */}
          {isDropped && (
            <div className="r68-verdict-pill" style={studioSpringEnter(t, dropAt, { y: 10 })}>
              <span className="r68-verdict-text">سود خالص واقعی: صفر ریال!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 3. Beat C: کانال همزمانی کوانتومی انبار، صندوق و سود ──────────────────
function QuantumSyncConduitActor({ t, plan }: R68ActorProps) {
  const coreAt = cueAt(plan, 'conduit-core-ignite', 0.3)
  const bulletAt = cueAt(plan, 'invoice-bullet-pulse', 1.05)
  const nodeLockAt = cueAt(plan, 'quad-node-lock', 1.55)
  const cashAt = cueAt(plan, 'cash-balance-snap', 2.3)
  const tickerAt = cueAt(plan, 'real-profit-ticker', 2.85)
  const sparkAt = cueAt(plan, 'full-equilibrium-spark', 3.65)

  const isSparked = t >= sparkAt

  return (
    <div className="r68-stage">
      <div className="r68-center-anchor" style={studioSpringEnter(t, coreAt, { y: 22 })}>
        {/* Core Quantum Engine Hub */}
        <div className="r68-conduit-hub">
          <div className="r68-card-head">
            <span className="r68-dot cyan" />
            <span className="r68-head-title">موتور همگام‌سازی لحظه‌ای</span>
          </div>

          {/* Invoice Stream Pulse */}
          {t >= bulletAt && (
            <div className="r68-stream-pill" style={studioSpringEnter(t, bulletAt, { y: 10 })}>
              <span className="r68-bullet-dot" />
              <span className="r68-bullet-text">صدور یک فاکتور فروش</span>
            </div>
          )}

          {/* Synchronized 3-Node Matrix */}
          {t >= nodeLockAt && (
            <div className="r68-nodes-row">
              <div className="r68-node-card">
                <span className="r68-node-icon">📦</span>
                <span className="r68-node-text">کسر انبار</span>
              </div>

              {t >= cashAt && (
                <div
                  className="r68-node-card active"
                  style={studioSpringEnter(t, cashAt, { y: 8 })}
                >
                  <span className="r68-node-icon">💰</span>
                  <span className="r68-node-text">شارژ صندوق</span>
                </div>
              )}

              {t >= tickerAt && (
                <div
                  className="r68-node-card green"
                  style={studioSpringEnter(t, tickerAt, { y: 8 })}
                >
                  <span className="r68-node-icon">📈</span>
                  <span className="r68-node-text">سود واقعی</span>
                </div>
              )}
            </div>
          )}

          {/* Spark Equilibrium Indicator */}
          {isSparked && (
            <div className="r68-spark-pill">
              <span className="r68-spark-glow" />
              <span className="r68-spark-text">انبار، صندوق و سود هماهنگ</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 4. Beat D: فرود باشکوه شو‌ریل و دعوت به اقدام نهایی ────────────────────
function LuminousResolutionCtaActor({ t, plan }: R68ActorProps) {
  const shockAt = cueAt(plan, 'cta-heartbeat-shock', 0.2)
  const btnAt = cueAt(plan, 'cta-button-ignite', 1.6)
  const bloomAt = cueAt(plan, 'cta-emerald-bloom', 1.95)
  const brandAt = cueAt(plan, 'brand-aurora-glow', 2.65)

  const isBtnActive = t >= btnAt
  const isBloomed = t >= bloomAt

  return (
    <div className="r68-stage">
      <div className="r68-center-anchor" style={studioSpringEnter(t, shockAt, { y: 24 })}>
        {/* Heartbeat Resolution Card */}
        <div className="r68-cta-card">
          <div className="r68-card-head">
            <span className="r68-dot emerald" />
            <span className="r68-head-title">نبض شفاف دخل شما</span>
          </div>

          <div className="r68-cta-kpi">
            <span className="r68-cta-lbl">سود خالص قطعی</span>
            <span className="r68-cta-num">همگام با هر فاکتور</span>
          </div>

          {/* Luminous CTA Button */}
          {isBtnActive && (
            <div
              className={`r68-cta-btn ${isBloomed ? 'bloom-glow' : ''}`}
              style={studioSpringEnter(t, btnAt, { y: 16 })}
            >
              <span className="r68-btn-bold">شروع رایگان پای صندوق</span>
              <span className="r68-btn-sub">hisabche.com</span>
            </div>
          )}

          {t >= brandAt && (
            <div className="r68-brand-tag" style={studioSpringEnter(t, brandAt, { y: 8 })}>
              <span>حسابداری ابری و ویندوز حسابچه</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
