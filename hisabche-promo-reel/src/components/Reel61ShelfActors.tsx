// ============================================
// Reel #61 — «اون کارتن کجاست؟»
//
// Refactored Motion Engine: Zero Clutter · One Focal Stage · Real Persian
//
// Visual Laws & Guardrails:
// 1. One Focal Stage: exactly ONE dominant centered visual ($Y \in [42%, 58%]$).
// 2. Zero duplicated narration: spoken dialogue lives exclusively in the subtitle system.
// 3. Strict text budget: default to zero decorative text; maximum 6 words on stage.
// 4. Zero green line / divider artifacts: completely unified 9:16 coordinate canvas.
// 5. Authentic Persian: natural bazaar terminology, zero broken fragments.
// 6. AV Sync Law: every sounded word has an action, read via cueAt.
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { clamp, ease, mix, progress, pulse, studioSpringEnter } from '../engine/anim'

interface R61ActorProps {
  t: number
  plan?: SentencePlan | undefined
}

/** Dispatches an `r61-*` actor id to its visual component. */
export function Reel61ShelfActor({
  actor,
  t,
  plan,
}: {
  actor: string
  t: number
  plan?: SentencePlan | undefined
}) {
  if (actor === 'r61-call-hook') return <CallHookActor t={t} plan={plan} />
  if (actor === 'r61-waiting') return <WaitingActor t={t} plan={plan} />
  if (actor === 'r61-one-head') return <OneHeadActor t={t} plan={plan} />
  if (actor === 'r61-shelf-page') return <ShelfPageActor t={t} plan={plan} />
  if (actor === 'r61-cta') return <CtaActor t={t} plan={plan} />
  return null
}

function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  return plan?.words.find((w) => w.action === action)?.start ?? fallback
}

// ─── 1. Beat A: «ده دقیقه پشت تلفن داد می‌زنی: اون کارتن کجاست؟» ─────────────
// Phone call interface with waveform morphing into a carton outline + question mark
function CallHookActor({ t, plan }: R61ActorProps) {
  const ringAt = cueAt(plan, 'call-ring', 0.2)
  const shoutAt = cueAt(plan, 'shout-wave', 1.38)
  const askAt = cueAt(plan, 'where-hit', 3.21)

  const shoutEnergy =
    clamp(progress(t, shoutAt, 0.25)) * (1 + 0.4 * pulse(t, shoutAt, shoutAt + 0.6, 1))
  const morphP = ease(clamp(progress(t, askAt, 0.5)))
  const shake = t >= shoutAt && t < shoutAt + 0.3 ? Math.sin((t - shoutAt) * 60) * 3 : 0

  const waveBars = 22

  return (
    <div className="r61-stage">
      <div
        className="r61-center-anchor"
        style={{
          ...studioSpringEnter(t, ringAt, { y: 20 }),
          transform: `translate(${shake}px, 0)`,
        }}
      >
        {/* Compact Phone Call Header Pill (4 words) */}
        <div className="r61-call-pill">
          <span className="r61-call-dot" />
          <span className="r61-call-meta">تماس با انبار · ۱۰:۰۰</span>
        </div>

        {/* Central Audio Waveform that morphs into a Carton Box Outline */}
        <div className="r61-waveform-box">
          {/* Waveform bars (visible before morph) */}
          <div
            className="r61-bars-row"
            style={{
              opacity: 1 - morphP,
              transform: `scale(${1 - morphP * 0.2})`,
            }}
          >
            {Array.from({ length: waveBars }, (_, i) => {
              const h =
                Math.abs(Math.sin(t * 9 + i * 0.6) * 0.6 + Math.sin(t * 22 + i * 1.8) * 0.4) *
                shoutEnergy
              return <span key={i} className="r61-wbar" style={{ height: `${10 + h * 64}px` }} />
            })}
          </div>

          {/* SVG Cardboard Carton Outline (reveals at where-hit) */}
          <div
            className="r61-carton-outline-wrap"
            style={{
              opacity: morphP,
              transform: `scale(${mix(0.85, 1.0, morphP)})`,
            }}
          >
            <svg viewBox="0 0 160 140" className="r61-carton-svg">
              <path
                d="M 20 40 L 80 15 L 140 40 L 80 65 Z"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              <path
                d="M 20 40 L 20 110 L 80 135 L 80 65 Z"
                fill="none"
                stroke="#d97706"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              <path
                d="M 140 40 L 140 110 L 80 135 L 80 65 Z"
                fill="none"
                stroke="#b45309"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              <line x1="80" y1="15" x2="80" y2="40" stroke="#f59e0b" strokeWidth="2.5" />
            </svg>

            {/* Kinetic Amber Question Mark emerging from carton */}
            <div
              className="r61-question-glyph"
              style={studioSpringEnter(t, askAt + 0.15, { scale: 0.8, y: 12 })}
            >
              ؟
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 2. Beat B: «مشتری پای خط معطله؛ انباردار بین قفسه‌ها می‌گرده.» ─────────────
// Warehouse rack with carton silhouettes and a sweeping searchlight beam
function WaitingActor({ t, plan }: R61ActorProps) {
  const customerAt = cueAt(plan, 'customer-hold', 0.2)
  const aislesAt = cueAt(plan, 'aisle-search', 2.09)

  const seconds = Math.floor(mix(0, 47, clamp(progress(t, customerAt, 3.8))))
  const sweep = Math.sin(Math.max(0, t - aislesAt) * 2.8)

  return (
    <div className="r61-stage">
      <div className="r61-center-anchor" style={studioSpringEnter(t, customerAt, { y: 22 })}>
        {/* Customer Waiting Timer Pill (3 words) */}
        <div className="r61-wait-pill">
          <span className="r61-wait-label">انتظار مشتری:</span>
          <span className="r61-wait-timer">
            ۰۰:{new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: 2 }).format(seconds)}
          </span>
        </div>

        {/* 3D Multi-Tier Warehouse Rack Mockup */}
        <div className="r61-warehouse-rack">
          {/* Sweeping searchlight cone */}
          <div
            className="r61-search-cone"
            style={{
              opacity: clamp(progress(t, aislesAt, 0.3)),
              transform: `translateX(${sweep * 110}px) rotate(${sweep * 16}deg)`,
            }}
          />

          {/* Shelf Tiers */}
          {[1, 2, 3].map((tier) => (
            <div key={tier} className="r61-rack-shelf">
              <div className="r61-shelf-rail" />
              <div className="r61-shelf-boxes">
                <div className="r61-box filled" />
                <div className="r61-box filled" />
                {tier === 2 ? (
                  <div className="r61-box empty-slot">
                    <span className="r61-slot-q">؟</span>
                  </div>
                ) : (
                  <div className="r61-box filled" />
                )}
                <div className="r61-box filled" />
              </div>
            </div>
          ))}

          {/* Single minimal rack aisle indicator (2 words) */}
          <div className="r61-rack-meta">
            <span>انبار اصلی · راهرو B</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 3. Beat C: The Memory Problem ─────────────────────────────────────────
// Carton on pallet with a pinned note that detaches and drifts, carton turns gray
function OneHeadActor({ t, plan }: R61ActorProps) {
  const noteAt = cueAt(plan, 'memory-note', 0.2)
  const strikeAt = cueAt(plan, 'absent-strike', 3.39)
  const lostAt = cueAt(plan, 'cargo-lost', 4.04)

  const strikeP = clamp(progress(t, strikeAt, 0.3))
  const detachP = ease(clamp(progress(t, strikeAt + 0.15, 0.7)))
  const lostP = ease(clamp(progress(t, lostAt, 0.5)))

  return (
    <div className="r61-stage">
      <div className="r61-center-anchor" style={studioSpringEnter(t, noteAt, { y: 22 })}>
        <div className="r61-carton-pallet-wrap">
          {/* The Physical Carton (Dims & Grays out when note detaches) */}
          <div
            className={`r61-pallet-carton${lostP > 0.5 ? ' lost' : ''}`}
            style={{
              filter: `grayscale(${lostP * 0.9}) brightness(${1 - lostP * 0.35})`,
            }}
          >
            <div className="r61-carton-top-tape" />
            <div className="r61-carton-brand-mark">روغن ۱۶L</div>
          </div>

          {/* Wooden Pallet Base */}
          <div className="r61-wooden-pallet">
            <span />
            <span />
            <span />
          </div>

          {/* Handwritten Note that detaches and drifts away */}
          <div
            className="r61-sticky-note"
            style={{
              opacity: 1 - detachP * 0.9,
              transform: `translate(${detachP * 60}px, ${-detachP * 80}px) rotate(${mix(-6, 22, detachP)}deg) scale(${1 - detachP * 0.3})`,
            }}
          >
            <div className="r61-note-pin" />
            <span className="r61-note-title">یادداشت انباردار</span>
            <span className="r61-note-desc">قفسه دست رحیمه</span>
            {/* Red marker diagonal strike */}
            <div className="r61-marker-strike" style={{ transform: `scaleX(${strikeP})` }} />
          </div>

          {/* Visual Lost Question Halo (no clumsy text badge) */}
          {lostP > 0.2 && (
            <div
              className="r61-lost-halo"
              style={{
                opacity: lostP,
                transform: `scale(${mix(0.8, 1.0, lostP)})`,
              }}
            >
              ؟
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 4. Beat D: «حسابچه روی صفحه‌ی کالا می‌گه کدوم انبار و کدوم قفسه؛ جابه‌جا کردی، همون‌جا عوضش کن.»
// Sleek Hisabche Product & Shelf View: Carton moves smoothly B-04 -> C-02
function ShelfPageActor({ t, plan }: R61ActorProps) {
  const brandAt = cueAt(plan, 'brand-rise', 0.2)
  const warehouseAt = cueAt(plan, 'warehouse-row', 2.5)
  const shelfAt = cueAt(plan, 'shelf-light', 3.32)
  const moveAt = cueAt(plan, 'shelf-move', 5.14)

  const isMoved = t >= moveAt + 0.3
  const moveP = ease(clamp(progress(t, moveAt, 0.45)))

  return (
    <div className="r61-stage">
      <div className="r61-center-anchor" style={studioSpringEnter(t, brandAt, { y: 22 })}>
        {/* Structured Hisabche Product Card */}
        <div className="r61-clean-product-card">
          {/* Header Badge (3 words) */}
          <div className="r61-emerald-pill">
            <span className="r61-pill-dot" />
            <span>حسابچه · مکان کالا</span>
          </div>

          {/* Product Title (3 words) */}
          <h3 className="r61-clean-title">روغن مایع ۱۶ لیتری</h3>

          {/* Warehouse Row (2 words) */}
          <div className="r61-clean-row" style={studioSpringEnter(t, warehouseAt, { y: 14 })}>
            <span className="r61-row-key">انبار</span>
            <span className="r61-row-val">انبار مرکزی</span>
          </div>

          {/* Interactive Shelf Location with Slide / Flip */}
          <div
            className={`r61-clean-row shelf-focus${t >= shelfAt ? ' active' : ''}`}
            style={studioSpringEnter(t, shelfAt, { y: 14 })}
          >
            <span className="r61-row-key">قفسه</span>

            <div className="r61-shelf-display">
              <span
                className="r61-shelf-badge"
                style={{
                  transform: `rotateX(${Math.sin(moveP * Math.PI) * 90}deg)`,
                }}
              >
                {isMoved ? 'C-02' : 'B-04'}
              </span>

              {isMoved && (
                <span
                  className="r61-check-tag"
                  style={studioSpringEnter(t, moveAt + 0.35, { scale: 0.9 })}
                >
                  ✓ ثبت شد
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 5. Beat E: Final CTA ───────────────────────────────────────────────────
// Clean, centered Hisabche brand card with 4+ second readable hold
function CtaActor({ t, plan }: R61ActorProps) {
  const cardAt = cueAt(plan, 'cta-card', 0.2)
  const pulseAt = cueAt(plan, 'cta-pulse', 2.65)
  const isPulsing = pulse(t, pulseAt, pulseAt + 1.2, 0.8)

  return (
    <div className="r61-stage">
      <div className="r61-center-anchor" style={studioSpringEnter(t, cardAt, { y: 24 })}>
        <div
          className="r61-clean-cta-card"
          style={{
            boxShadow: `0 0 ${20 + isPulsing * 35}px rgba(52, 211, 153, ${0.2 + isPulsing * 0.35})`,
          }}
        >
          {/* Brand Wordmark */}
          <div className="r61-cta-brand">حسابچه</div>

          {/* Value Prop (4 words) */}
          <p className="r61-cta-prop">مدیریت دقیق انبار و قفسه‌ها</p>

          {/* Action Button (2 words) */}
          <div
            className="r61-cta-button"
            style={studioSpringEnter(t, pulseAt - 0.2, { scale: 0.94 })}
          >
            شروع رایگان
          </div>

          {/* Clear Official Domain */}
          <div className="r61-cta-domain">hisabche.com</div>
        </div>
      </div>
    </div>
  )
}
