// ============================================
// Reel #61 — «اون کارتن کجاست؟»
//
// Template: SPLIT HORIZON. One line divides the frame across all five scenes:
// above it the phone call (a red waveform of shouting), below it the calm
// shelf card. In scenes 1–3 the call owns the frame; in scene 4 the horizon
// rises and the product page pushes the call off screen.
//
// Product truth (checked in code, 17 Oct): the product page lists each
// warehouse that holds the product and the shelf it sits on
// (`GET /api/products/:id/storage-locations`), and the shelf can be changed
// right there (`useMoveProductPlacement`). No shelf barcode, no worker routing.
//
// AV sync law: every sounded word carries an action, and that action's time
// is read here with `cueAt` — the sound and its visual event share one clock.
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { clamp, mix, progress, pulse, studioSpring, studioSpringEnter } from '../engine/anim'

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

/**
 * The shouting on the line, drawn as bars. Deterministic: each bar's height is
 * a sum of sines of `t`, so a frame always looks the same. `energy` 0 → flat.
 */
function Waveform({ t, energy, tone }: { t: number; energy: number; tone: 'red' | 'green' }) {
  const bars = 28
  return (
    <div className={`r61-wave ${tone}`}>
      {Array.from({ length: bars }, (_, i) => {
        const h =
          Math.abs(Math.sin(t * 9 + i * 0.7) * 0.6 + Math.sin(t * 23 + i * 1.9) * 0.4) * energy
        return <span key={i} style={{ height: `${8 + h * 62}px` }} />
      })}
    </div>
  )
}

/** The divide between the call and the calm. `at` is the share of the frame the call owns. */
function Horizon({ share }: { share: number }) {
  return <div className="r61-horizon" style={{ top: `${share * 100}%` }} />
}

function ShelfTag({ code, dim }: { code: string; dim?: boolean | undefined }) {
  return <span className={`r61-shelf-tag${dim ? ' dim' : ''}`}>{code}</span>
}

// ─── 1. «ده دقیقه پشت تلفن داد می‌زنی: اون کارتن کجاست؟» ──────────────────────
function CallHookActor({ t, plan }: R61ActorProps) {
  const ringAt = cueAt(plan, 'call-ring', 0.2)
  const shoutAt = cueAt(plan, 'shout-wave', 1.9)
  const askAt = cueAt(plan, 'where-hit', 3.1)
  const energy = clamp(progress(t, shoutAt, 0.25)) * (1 + 0.4 * pulse(t, askAt, askAt + 0.6, 1))
  const shake = t >= shoutAt && t < shoutAt + 0.3 ? Math.sin((t - shoutAt) * 70) * 4 : 0

  return (
    <div className="r61-stage">
      <Horizon share={0.62} />
      <div className="r61-top">
        <div
          className="r61-call"
          style={{ ...studioSpringEnter(t, ringAt, { y: -20 }), translate: `${shake}px 0` }}
        >
          <span className="r61-badge red">تماس با انبار · ۱۰:۰۰ دقیقه</span>
          <Waveform t={t} energy={energy} tone="red" />
        </div>
        <h2 className="r61-shout" style={studioSpringEnter(t, askAt, { y: 16, scale: 0.88 })}>
          اون کارتن <span className="r61-hl-red">کجاست؟</span>
        </h2>
      </div>
      <div className="r61-bottom">
        <div
          className="r61-calm-ghost"
          style={{ opacity: mix(0, 0.5, clamp(progress(t, askAt + 0.3, 0.6))) }}
        >
          راه دیگری هم هست…
        </div>
      </div>
    </div>
  )
}

// ─── 2. «مشتری پای خط معطله؛ انباردار بین قفسه‌ها می‌گرده.» ─────────────────────
function WaitingActor({ t, plan }: R61ActorProps) {
  const customerAt = cueAt(plan, 'customer-hold', 0.3)
  const aislesAt = cueAt(plan, 'aisle-search', 2.4)
  const seconds = Math.floor(mix(0, 47, clamp(progress(t, customerAt, 4.2))))
  // The searcher's torch sweeps the aisles and finds nothing.
  const sweep = Math.sin(Math.max(0, t - aislesAt) * 2.6)

  return (
    <div className="r61-stage">
      <Horizon share={0.62} />
      <div className="r61-top">
        <Waveform t={t} energy={0.55} tone="red" />
        <div className="r61-card" style={studioSpringEnter(t, customerAt, { y: 22 })}>
          <span className="r61-muted">مشتری پشت خط</span>
          <span className="r61-timer">
            ۰۰:{new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: 2 }).format(seconds)}
          </span>
        </div>
      </div>
      <div className="r61-bottom">
        <div className="r61-aisles" style={studioSpringEnter(t, aislesAt, { y: 24 })}>
          {['A', 'B', 'C', 'D'].map((aisle, i) => (
            <div key={aisle} className="r61-aisle">
              <span className="r61-aisle-name">راهرو {aisle}</span>
              {[1, 2, 3].map((n) => (
                <ShelfTag key={n} code={`${aisle}-0${n}`} dim />
              ))}
              <span
                className="r61-torch"
                style={{
                  opacity:
                    clamp(1 - Math.abs(sweep * 1.5 - (i - 1.5))) *
                    clamp(progress(t, aislesAt, 0.3)),
                }}
              />
            </div>
          ))}
        </div>
        <span className="r61-question" style={studioSpringEnter(t, aislesAt + 1.2, { y: 10 })}>
          روغن کجاست؟
        </span>
      </div>
    </div>
  )
}

// ─── 3. «آدرس قفسه فقط تو ذهن یک نفره؛ اون نباشه، بار گم.» ─────────────────────
function OneHeadActor({ t, plan }: R61ActorProps) {
  const noteAt = cueAt(plan, 'memory-note', 0.3)
  const strikeAt = cueAt(plan, 'absent-strike', 2.6)
  const lostAt = cueAt(plan, 'cargo-lost', 3.7)
  const strike = clamp(progress(t, strikeAt, 0.35))
  const drift = clamp(progress(t, lostAt, 0.9))

  return (
    <div className="r61-stage">
      <Horizon share={0.62} />
      <div className="r61-top">
        <div
          className="r61-note"
          style={{ ...studioSpringEnter(t, noteAt, { y: 20 }), rotate: '-3deg' }}
        >
          <span className="r61-note-head">آدرس بار</span>
          <span className="r61-note-body">«دست چپ، پشت گونی‌ها… فقط رحیم می‌دونه»</span>
          <span className="r61-strike" style={{ transform: `scaleX(${strike})` }} />
        </div>
        <span className="r61-absent" style={studioSpringEnter(t, strikeAt, { y: 12, scale: 0.9 })}>
          رحیم امروز نیامده
        </span>
      </div>
      <div className="r61-bottom">
        <div
          className="r61-carton"
          style={{
            opacity: 1 - drift * 0.85,
            transform: `translateY(${drift * 40}px) rotate(${drift * 14}deg) scale(${1 - drift * 0.3})`,
          }}
        >
          ۲۰ کارتن روغن
        </div>
        <span className="r61-hl-red" style={{ opacity: clamp(progress(t, lostAt + 0.3, 0.3)) }}>
          بار گم
        </span>
      </div>
    </div>
  )
}

// ─── 4. «حسابچه روی صفحه‌ی کالا می‌گه کدوم انبار و کدوم قفسه؛ جابه‌جا کردی، همون‌جا عوضش کن.» ─
function ShelfPageActor({ t, plan }: R61ActorProps) {
  const brandAt = cueAt(plan, 'brand-rise', 0.2)
  const warehouseAt = cueAt(plan, 'warehouse-row', 1.9)
  const shelfAt = cueAt(plan, 'shelf-light', 2.9)
  const moveAt = cueAt(plan, 'shelf-move', 4.6)
  // The horizon rises: the call is pushed off the top of the frame.
  const share = mix(0.62, 0, studioSpring(Math.max(0, t - brandAt) * 0.8))
  const moved = t >= moveAt + 0.25
  const flip = clamp(progress(t, moveAt, 0.35))

  return (
    <div className="r61-stage">
      <Horizon share={share} />
      <div className="r61-top" style={{ height: `${share * 100}%`, opacity: share / 0.62 }}>
        <Waveform t={t} energy={share} tone="red" />
      </div>
      <div className="r61-bottom r61-calm" style={{ top: `${share * 100}%` }}>
        <span className="r61-badge green" style={studioSpringEnter(t, brandAt, { y: 14 })}>
          حسابچه · صفحه‌ی کالا
        </span>
        <div className="r61-product" style={studioSpringEnter(t, brandAt + 0.3, { y: 26 })}>
          <div className="r61-product-head">
            <span className="r61-product-name">روغن آشپزی ۱۶ لیتری</span>
            <span className="r61-muted">موجودی ۲۰ کارتن</span>
          </div>
          <div className="r61-loc-row" style={studioSpringEnter(t, warehouseAt, { y: 16 })}>
            <span className="r61-muted">انبار</span>
            <span className="r61-loc-value">انبار مرکزی</span>
          </div>
          <div
            className={`r61-loc-row shelf${t >= shelfAt ? ' lit' : ''}`}
            style={studioSpringEnter(t, shelfAt, { y: 16 })}
          >
            <span className="r61-muted">قفسه</span>
            <span
              className="r61-loc-flip"
              style={{ transform: `rotateX(${Math.sin(flip * Math.PI) * 80}deg)` }}
            >
              <ShelfTag code={moved ? 'C-02' : 'B-04'} />
            </span>
          </div>
          <div className="r61-move" style={studioSpringEnter(t, moveAt - 0.2, { y: 12 })}>
            {moved ? 'جابه‌جا شد: B-04 ← C-02' : 'تغییر قفسه'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 5. «بار رو بی‌تلفن پیدا کن؛ شروع رایگان در حسابچه.» ────────────────────────
function CtaActor({ t, plan }: R61ActorProps) {
  const cardAt = cueAt(plan, 'cta-card', 0.3)
  const pulseAt = cueAt(plan, 'cta-pulse', 2.2)
  const glow = pulse(t, pulseAt, pulseAt + 1.6, 0.9)

  return (
    <div className="r61-stage">
      <div className="r61-bottom r61-calm" style={{ top: 0 }}>
        <h2 className="r61-cta-title" style={studioSpringEnter(t, cardAt - 0.1, { y: 16 })}>
          بار رو <span className="r61-hl-green">بی‌تلفن</span> پیدا کن
        </h2>
        <div
          className="r61-cta-card"
          style={{
            ...studioSpringEnter(t, cardAt, { y: 26, scale: 0.92 }),
            boxShadow: `0 0 ${24 + glow * 40}px rgba(52, 211, 153, ${0.25 + glow * 0.35})`,
          }}
        >
          <span className="r61-muted">انبار و قفسه‌ی هر کالا، روی صفحه‌ی همان کالا</span>
          <span className="r61-cta-action">شروع رایگان</span>
          <span className="r61-cta-url">hisabche.com</span>
        </div>
      </div>
    </div>
  )
}
