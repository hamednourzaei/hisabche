// ============================================
// Reel #69 — Pocketsflow Creator E-Commerce Explainer
//
// Dynamic 15-second character-led motion graphics explainer
// showcasing: product listings, checkout, upsells, subscription management.
//
// Hard Rules 14-19:
// 1. One Focal Stage per beat with zero clutter.
// 2. Strict text budget: <= 6 words per label.
// 3. Clean of any dividing line classes.
// 4. AV Sync Law: every sounded word has an action read via cueAt.
// 5. Deterministic animations driven purely by scene time t.
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { clamp, ease, mix, progress, studioSpringEnter } from '../engine/anim'

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
  if (actor === 'r69-creator-hook') return <CreatorHook t={t} plan={plan} />
  if (actor === 'r69-product-cards') return <ProductCards t={t} plan={plan} />
  if (actor === 'r69-checkout-flow') return <CheckoutFlow t={t} plan={plan} />
  if (actor === 'r69-upsell-tax') return <UpsellTax t={t} plan={plan} />
  if (actor === 'r69-multi-panel-split') return <MultiPanelSplit t={t} plan={plan} />
  if (actor === 'r69-brand-outro') return <BrandOutro t={t} plan={plan} />
  return null
}

function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  return plan?.words.find((w) => w.action === action)?.start ?? fallback
}

// ─── Dither Patterns & Animated Character Component ─────────────────────────

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
        <pattern id="r69-dither-white" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="2" height="2" fill="#ffffff" fillOpacity="0.55" />
          <rect x="2" y="2" width="2" height="2" fill="#ffffff" fillOpacity="0.55" />
        </pattern>
      </defs>
    </svg>
  )
}

function DitheredCharacter({
  t,
  scale = 1,
  lookingAt = 'center',
  isSmiling = true,
}: {
  t: number
  scale?: number
  lookingAt?: 'left' | 'right' | 'center'
  isSmiling?: boolean
}) {
  const bob = Math.sin(t * 6) * 4
  const tilt = Math.sin(t * 3.5) * 2.5
  const eyeOffset = lookingAt === 'left' ? -3 : lookingAt === 'right' ? 3 : 0

  return (
    <div
      className="r69-character-rig"
      style={{
        transform: `translateY(${bob}px) rotate(${tilt}deg) scale(${scale})`,
        transformOrigin: 'bottom center',
      }}
    >
      <svg width="140" height="170" viewBox="0 0 140 170" fill="none">
        {/* Shadow base */}
        <ellipse cx="70" cy="162" rx="36" ry="6" fill="rgba(0,0,0,0.06)" />

        {/* Torso / Hoodie */}
        <path
          d="M32 110 C32 95 48 88 70 88 C92 88 108 95 108 110 L114 156 C114 158 112 160 110 160 L30 160 C28 160 26 158 26 156 Z"
          fill="#0056B3"
        />
        {/* Dither Texture on Hoodie */}
        <path
          d="M32 110 C32 95 48 88 70 88 C92 88 108 95 108 110 L114 156 C114 158 112 160 110 160 L30 160 C28 160 26 158 26 156 Z"
          fill="url(#r69-dither-dark)"
        />
        {/* Hoodie Strings */}
        <path d="M62 98 L60 126" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M78 98 L80 126" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />

        {/* Head */}
        <circle cx="70" cy="56" r="32" fill="#FDE68A" />
        {/* Dither Shading on Head */}
        <path d="M44 68 C50 82 90 82 96 68 C88 86 52 86 44 68 Z" fill="url(#r69-dither-dark)" />

        {/* Retro Pixel/Dither Hair */}
        <path
          d="M36 50 C36 28 50 20 70 20 C90 20 104 28 104 50 C104 42 98 34 88 34 C80 34 76 38 70 38 C64 38 60 34 52 34 C42 34 36 42 36 50 Z"
          fill="#1F2937"
        />
        <path
          d="M36 50 C36 28 50 20 70 20 C90 20 104 28 104 50 C104 42 98 34 88 34 C80 34 76 38 70 38 C64 38 60 34 52 34 C42 34 36 42 36 50 Z"
          fill="url(#r69-dither-blue)"
        />

        {/* Eyes */}
        <circle cx={58 + eyeOffset} cy="54" r="4.5" fill="#111827" />
        <circle cx={82 + eyeOffset} cy="54" r="4.5" fill="#111827" />
        <circle cx={59.5 + eyeOffset} cy="52.5" r="1.5" fill="#ffffff" />
        <circle cx={83.5 + eyeOffset} cy="52.5" r="1.5" fill="#ffffff" />

        {/* Cheeks with dither glow */}
        <circle cx="50" cy="62" r="5" fill="#F87171" fillOpacity="0.45" />
        <circle cx="90" cy="62" r="5" fill="#F87171" fillOpacity="0.45" />

        {/* Smile */}
        {isSmiling ? (
          <path
            d="M62 64 Q70 73 78 64"
            stroke="#111827"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <path
            d="M63 66 Q70 68 77 66"
            stroke="#111827"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </svg>
    </div>
  )
}

// ─── Beat 1 (0.0 - 1.5s): Hook — White Screen & Character ───────────────────
function CreatorHook({ t, plan }: R69Props) {
  const popAt = cueAt(plan, 'char-pop-in', 0.15)
  const gotAt = cueAt(plan, 'got-something-in', 0.45)
  const tagAt = cueAt(plan, 'creators-tag-in', 1.05)

  return (
    <div className="r69-stage r69-white-theme">
      <DitherDefs />
      <div className="r69-grid-bg" />

      <div className="r69-beat1-layout">
        {/* Left Side: Typography */}
        <div className="r69-left-column">
          {t >= tagAt && (
            <div className="r69-creator-tag" style={studioSpringEnter(t, tagAt, { y: 12 })}>
              // for creators
            </div>
          )}
          {t >= gotAt && (
            <h1 className="r69-headline" style={studioSpringEnter(t, gotAt, { y: 18 })}>
              Got something
            </h1>
          )}
        </div>

        {/* Right Side: Dithered Character */}
        {t >= popAt && (
          <div className="r69-right-column" style={studioSpringEnter(t, popAt, { y: 24 })}>
            <DitheredCharacter t={t} scale={1.15} lookingAt="left" isSmiling={true} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Beat 2 (1.5 - 4.5s): Product Cards Slide on Blue UI Panel ──────────────
function ProductCards({ t, plan }: R69Props) {
  const panelAt = cueAt(plan, 'blue-panel-slide', 0.15)
  const card1At = cueAt(plan, 'card-courses-in', 0.55)
  const card2At = cueAt(plan, 'card-ebooks-in', 1.35)
  const card3At = cueAt(plan, 'card-apps-in', 2.15)

  const panelP = clamp(progress(t, panelAt, 0.4))
  const panelSlide = mix(60, 0, ease(panelP))

  return (
    <div className="r69-stage r69-blue-panel-theme">
      <DitherDefs />
      <div className="r69-grid-bg dark" />

      {/* Main Blue UI Canvas Panel */}
      <div
        className="r69-blue-canvas"
        style={{
          transform: `translateY(${panelSlide}px)`,
          opacity: panelP,
        }}
      >
        <div className="r69-split-stage">
          {/* Left: Product Cards Cascade */}
          <div className="r69-cards-column">
            {t >= card1At && (
              <div className="r69-product-card" style={studioSpringEnter(t, card1At, { x: 30 })}>
                <div className="r69-card-icon dither-icon">🎓</div>
                <div className="r69-card-info">
                  <span className="r69-card-title">Courses</span>
                  <span className="r69-card-price">$149.00</span>
                </div>
              </div>
            )}

            {t >= card2At && (
              <div className="r69-product-card" style={studioSpringEnter(t, card2At, { x: 30 })}>
                <div className="r69-card-icon dither-icon">📚</div>
                <div className="r69-card-info">
                  <span className="r69-card-title">Ebooks</span>
                  <span className="r69-card-price">$29.00</span>
                </div>
              </div>
            )}

            {t >= card3At && (
              <div className="r69-product-card" style={studioSpringEnter(t, card3At, { x: 30 })}>
                <div className="r69-card-icon dither-icon">⚡</div>
                <div className="r69-card-info">
                  <span className="r69-card-title">Apps</span>
                  <span className="r69-card-price">$49.00</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Character Observing */}
          <div className="r69-character-side">
            <DitheredCharacter t={t} scale={1.05} lookingAt="left" isSmiling={true} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Beat 3 (4.5 - 7.5s): Checkout Screen & Apple Pay ───────────────────────
function CheckoutFlow({ t, plan }: R69Props) {
  const checkoutAt = cueAt(plan, 'checkout-slide-in', 0.15)
  const priceAt = cueAt(plan, 'course-price-tag', 0.85)
  const shrinkAt = cueAt(plan, 'char-shrink-float', 1.35)
  const payAt = cueAt(plan, 'apple-pay-pulse', 1.85)
  const snapAt = cueAt(plan, 'pay-btn-snap', 2.25)

  const isShrunk = t >= shrinkAt
  const charScale = isShrunk ? mix(1.0, 0.75, ease(clamp(progress(t, shrinkAt, 0.4)))) : 1.0

  return (
    <div className="r69-stage r69-white-theme">
      <DitherDefs />
      <div className="r69-grid-bg" />

      <div className="r69-checkout-stage">
        {/* Left: Clean Checkout UI Mockup */}
        <div className="r69-checkout-card" style={studioSpringEnter(t, checkoutAt, { x: -30 })}>
          <div className="r69-checkout-header">
            <span className="r69-badge-live">Checkout</span>
            <span className="r69-step-tag">Step 1 of 2</span>
          </div>

          {/* Design Course Line Item */}
          <div className="r69-item-row">
            <div className="r69-item-detail">
              <span className="r69-item-name">Design Course $149.00</span>
              <span className="r69-item-sub">Instant digital access</span>
            </div>
            {t >= priceAt && <span className="r69-pill-price">Active</span>}
          </div>

          {/* Apple Pay Button */}
          {t >= payAt && (
            <div
              className={`r69-apple-pay-btn ${t >= snapAt ? 'pulse-click' : ''}`}
              style={studioSpringEnter(t, payAt, { y: 12 })}
            >
              <svg
                width="18"
                height="22"
                viewBox="0 0 170 170"
                fill="#ffffff"
                style={{ flexShrink: 0 }}
              >
                <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.74-11.64-14.1-6.19-9.78-10.7-20.67-13.53-32.65-2.83-11.98-4.25-23.08-4.25-33.3 0-14.79 3.73-26.85 11.19-36.19 7.46-9.33 16.9-14.07 28.32-14.2 4.46 0 9.4 1.14 14.82 3.42 5.42 2.28 9.07 3.48 10.95 3.61 2.39-.26 6.33-1.6 11.82-4.02 5.49-2.42 10.4-3.53 14.75-3.33 12.06.66 21.64 4.88 28.74 12.67-10.43 6.33-15.54 15.03-15.33 26.1.22 8.7 3.51 15.86 9.88 21.48 6.37 5.62 14.05 8.94 23.03 9.96-2.5 7.41-5.75 15.11-9.76 23.1zM119.22 31.84c0-7.07 2.61-13.79 7.84-20.15 5.22-6.36 11.75-10.45 19.58-12.28.65 1.52.98 3.18.98 4.97 0 7.07-2.69 13.88-8.08 20.43-5.38 6.56-11.95 10.47-19.7 11.74-.22-1.53-.42-3.1-.62-4.71z" />
              </svg>
              <span className="r69-pay-text">Pay $149.00</span>
            </div>
          )}
        </div>

        {/* Right: Floating Scaled Character */}
        <div
          className="r69-character-float"
          style={{
            transform: `translate(20px, ${isShrunk ? -20 : 0}px)`,
          }}
        >
          <DitheredCharacter t={t} scale={charScale} lookingAt="left" isSmiling={true} />
        </div>
      </div>
    </div>
  )
}

// ─── Beat 4 (7.5 - 10.5s): Checkout Updates with Upsell & Tax ───────────────
function UpsellTax({ t, plan }: R69Props) {
  const upsellAt = cueAt(plan, 'upsell-card-snap', 0.15)
  const priceAt = cueAt(plan, 'upsell-price-snap', 0.95)
  const taxAt = cueAt(plan, 'vat-tax-ticker', 1.7)
  const bounceAt = cueAt(plan, 'char-smile-bounce', 2.2)

  const isBounced = t >= bounceAt

  return (
    <div className="r69-stage r69-white-theme">
      <DitherDefs />
      <div className="r69-grid-bg" />

      <div className="r69-checkout-stage">
        {/* Updated Checkout Screen */}
        <div className="r69-checkout-card expanded">
          <div className="r69-item-row compact">
            <span className="r69-item-name">Design Course $149.00</span>
            <span className="r69-pill-price">$149.00</span>
          </div>

          {/* Upsell Offer Box */}
          {t >= upsellAt && (
            <div className="r69-upsell-box" style={studioSpringEnter(t, upsellAt, { y: 14 })}>
              <div className="r69-upsell-header">
                <span className="r69-sparkle">✨</span>
                <span className="r69-upsell-title">Workbook upsell $19.00</span>
              </div>
              <div className="r69-upsell-actions">
                <button className="r69-add-btn">Add the workbook</button>
                {t >= priceAt && <span className="r69-upsell-cost">+$19.00</span>}
              </div>
            </div>
          )}

          {/* Tax / VAT Section */}
          {t >= taxAt && (
            <div className="r69-tax-row" style={studioSpringEnter(t, taxAt, { y: 10 })}>
              <span className="r69-tax-label">Tax - VAT 20% $33.60</span>
              <span className="r69-tax-val">$33.60</span>
            </div>
          )}
        </div>

        {/* Character Smiling in Place */}
        <div
          className="r69-character-float"
          style={{
            transform: `translate(20px, ${isBounced ? -28 : -20}px)`,
          }}
        >
          <DitheredCharacter t={t} scale={0.78} lookingAt="left" isSmiling={true} />
        </div>
      </div>
    </div>
  )
}

// ─── Beat 5 (10.5 - 13.5s): Multi-Panel Split & Metrics Explosion ───────────
function MultiPanelSplit({ t, plan }: R69Props) {
  const explodeAt = cueAt(plan, 'multi-panel-explode', 0.15)
  const pillAt = cueAt(plan, 'workbook-add-pill', 0.55)
  const subAt = cueAt(plan, 'sub-tier-snap', 1.05)
  const vatAt = cueAt(plan, 'vat-tags-spread', 1.65)
  const revAt = cueAt(plan, 'revenue-counter-surge', 2.15)

  return (
    <div className="r69-stage r69-white-theme">
      <DitherDefs />
      <div className="r69-grid-bg" />

      <div className="r69-multi-split-stage">
        {/* Central Floating Character */}
        <div className="r69-center-character">
          <DitheredCharacter t={t} scale={0.65} lookingAt="center" isSmiling={true} />
        </div>

        {/* Surrounding Modular Panels */}
        {t >= explodeAt && (
          <div className="r69-floating-panels">
            {/* Panel 1: Workbook Upsell */}
            <div
              className="r69-mini-card top-left"
              style={studioSpringEnter(t, explodeAt, { y: -20 })}
            >
              <span className="r69-mini-tag">Upsell</span>
              <span className="r69-mini-title">Workbook upsell $19.00</span>
            </div>

            {/* Panel 2: Tax - VAT */}
            <div
              className="r69-mini-card top-right"
              style={studioSpringEnter(t, explodeAt + 0.1, { y: -20 })}
            >
              <span className="r69-mini-tag blue">Auto-Tax</span>
              <span className="r69-mini-title">Tax - VAT 20% $33.60</span>
            </div>

            {/* Panel 3: Add Workbook Action */}
            {t >= pillAt && (
              <div
                className="r69-pill-action mid-left"
                style={studioSpringEnter(t, pillAt, { x: -20 })}
              >
                <span>Add the workbook</span>
              </div>
            )}

            {/* Panel 4: Coaching Call */}
            <div
              className="r69-mini-card mid-right"
              style={studioSpringEnter(t, explodeAt + 0.2, { x: 20 })}
            >
              <span className="r69-mini-title">1:1 coaching call $99</span>
            </div>

            {/* Panel 5: Subscriptions */}
            {t >= subAt && (
              <div
                className="r69-sub-card bottom-left"
                style={studioSpringEnter(t, subAt, { y: 20 })}
              >
                <span className="r69-sub-price">$9 / month</span>
                <span className="r69-sub-sub">Recurring revenue</span>
              </div>
            )}

            {/* Panel 6: Global VAT Cluster */}
            {t >= vatAt && (
              <div
                className="r69-vat-cluster bottom-center"
                style={studioSpringEnter(t, vatAt, { y: 15 })}
              >
                <span className="r69-vat-chip">EU VAT</span>
                <span className="r69-vat-chip">UK VAT</span>
                <span className="r69-vat-chip">US sales tax</span>
              </div>
            )}

            {/* Panel 7: Giant Revenue Total */}
            {t >= revAt && (
              <div
                className="r69-revenue-banner bottom-right"
                style={studioSpringEnter(t, revAt, { y: 20 })}
              >
                <span className="r69-rev-label">Net Sales</span>
                <span className="r69-rev-num">$12,480.00</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Beat 6 (13.5 - 15.0s): White Screen Outro & Pocketsflow Assembly ────────
function BrandOutro({ t, plan }: R69Props) {
  const pocketsAt = cueAt(plan, 'pockets-in', 0.15)
  const flowAt = cueAt(plan, 'flow-slide-lock', 0.65)

  const isPockets = t >= pocketsAt
  const isFlow = t >= flowAt

  return (
    <div className="r69-stage r69-white-theme outro">
      <DitherDefs />
      <div className="r69-grid-bg" />

      <div className="r69-brand-center">
        <div className="r69-logo-assembly">
          {/* "Pockets" animates in from left, fading in first */}
          {isPockets && (
            <span
              className="r69-logo-part pockets"
              style={studioSpringEnter(t, pocketsAt, { x: -25 })}
            >
              Pockets
            </span>
          )}

          {/* "flow" slides in from right */}
          {isFlow && (
            <span className="r69-logo-part flow" style={studioSpringEnter(t, flowAt, { x: 25 })}>
              flow
            </span>
          )}
        </div>

        {isFlow && (
          <div className="r69-outro-sub" style={studioSpringEnter(t, flowAt + 0.15, { y: 10 })}>
            <span>The creator commerce engine</span>
          </div>
        )}
      </div>
    </div>
  )
}
