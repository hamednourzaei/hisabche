// ============================================
// Reel #55 — Hybrid Word-Synchronized Actors
//
// Blends five studio visual languages into a single word-driven reel:
//   kinetic-color  ·  thermal-receipt  ·  isometric-exploded
//   liquid-glass / swiss-terminal     ·  cta-conversion
//
// Every state change is a pure function of the scene-local clock and the
// SentencePlan word cues. Nothing reads wall-clock time, so the stage stays
// frame-deterministic and scrub-safe.
// ============================================

import type { SentencePlan } from '../engine/speech-model'
import { ease, mix, progress, spring } from '../engine/anim'
import { faNumber } from '../ui/motion-primitives'

interface R55ActorProps {
  t: number
  plan?: SentencePlan | undefined
}

/** Dispatches a `r55-*` actor id to its hybrid visual component. */
export function Reel55HybridActor({
  actor,
  t,
  plan,
}: {
  actor: string
  t: number
  plan?: SentencePlan | undefined
}) {
  if (actor === 'r55-hook-vault') return <HookVaultActor t={t} plan={plan} />
  if (actor === 'r55-thermal-aging') return <ThermalAgingActor t={t} plan={plan} />
  if (actor === 'r55-isometric-autopsy') return <IsometricAutopsyActor t={t} plan={plan} />
  if (actor === 'r55-glass-recovery') return <GlassRecoveryActor t={t} plan={plan} />
  if (actor === 'r55-cta-conversion') return <CtaConversionActor t={t} plan={plan} />
  return null
}

/** Start time (scene-local) of the word cue carrying `action`, or a fallback. */
function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  return plan?.words.find((w) => w.action === action)?.start ?? fallback
}

// ─── 1. Hook Vault (kinetic-color × full-bleed): «انبارت پره» ───────────────
function HookVaultActor({ t, plan }: R55ActorProps) {
  const stuffAt = cueAt(plan, 'shelf-stuff', 0.2)
  const overflowAt = cueAt(plan, 'shelf-overflow', 0.8)
  const pocketAt = cueAt(plan, 'pocket-zero', 1.65)
  const slamAt = cueAt(plan, 'pocket-slam', 2.4)

  const overflowSpring = spring(t - overflowAt)
  const pocketP = ease(progress(t, pocketAt, 0.5))
  const slamSpring = spring(t - slamAt)
  const slamP = progress(t, slamAt, 0.12)
  const isSlammed = t >= slamAt

  const crateCount = 8

  return (
    <div className={`r55-hook ${isSlammed ? 'slammed' : ''}`}>
      <div className="r55-hook-headline">
        <span className="r55-hook-line r55-hook-line-a">انبارت پره</span>
        <span className={`r55-hook-line r55-hook-line-b ${isSlammed ? 'lit' : ''}`}>
          ولی جیبت خالیه!
        </span>
      </div>

      <div
        className="r55-rack"
        style={{ transform: `scale(${mix(0.94, 1, Math.min(1, overflowSpring))})` }}
      >
        {Array.from({ length: crateCount }).map((_, i) => (
          <div
            key={i}
            className="r55-crate"
            style={{ opacity: progress(t, stuffAt + i * 0.05, 0.3) }}
          />
        ))}
        <div className="r55-rack-tag">کالای بی‌حرکت</div>
      </div>

      <div className="r55-pocket">
        <div className="r55-pocket-head">
          <span className="r55-pocket-label">موجودی نقد</span>
          <span className={`r55-pocket-value ${pocketP >= 1 ? 'zero' : ''}`}>{faNumber(0)}</span>
        </div>
        <div className="r55-pocket-track">
          <div className="r55-pocket-fill" style={{ width: `${mix(100, 0, pocketP)}%` }} />
        </div>
      </div>

      {isSlammed && (
        <div
          className="r55-slam"
          style={{
            transform: `rotate(-6deg) scale(${mix(2.2, 1, slamSpring)})`,
            opacity: slamP,
          }}
        >
          جیبت خالیه!
        </div>
      )}
    </div>
  )
}

// ─── 2. Thermal Aging (thermal-receipt × shelf): «چهارصد میلیون سرمایه» ─────
function ThermalAgingActor({ t, plan }: R55ActorProps) {
  const printAt = cueAt(plan, 'receipt-print', 0.3)
  const countAt = cueAt(plan, 'capital-counter', 1.6)
  const shelfAt = cueAt(plan, 'shelf-highlight', 2.9)
  const agingAt = cueAt(plan, 'aging-climb', 3.9)

  const printP = ease(progress(t, printAt, 1.6))
  const countP = ease(progress(t, countAt, 1.0))
  const capital = mix(0, 400000000, countP)
  const shelfOn = t >= shelfAt
  const agingP = ease(progress(t, agingAt, 0.8))
  const agingDays = Math.round(mix(0, 120, agingP))

  const rows = [
    'کالای بازرگانی کد ۱۰۱',
    'محصول استاندارد کد ۲۰۲',
    'کالای مصرفی کد ۳۰۳',
    'کالای بازرگانی کد ۱۰۴',
    'محصول استاندارد کد ۲۰۵',
  ]
  const visibleRows = Math.max(0, Math.min(rows.length, Math.floor(printP * (rows.length + 1))))

  return (
    <div className="r55-aging">
      <div className="r55-scene-headline">
        <span className="r55-scene-badge">سرمایه خواب در قفسه</span>
        <h2 className="r55-scene-title">چهارصد میلیون سرمایه، توی قفسه‌ها خوابه!</h2>
      </div>

      <div className="r55-receipt">
        <div className="r55-receipt-slot" />
        <div className="r55-receipt-paper" style={{ transform: `scaleY(${mix(0.05, 1, printP)})` }}>
          <div className="r55-receipt-head">گزارش گردش کالا</div>
          {rows.map((row, i) => (
            <div
              key={row}
              className={`r55-receipt-row ${shelfOn ? 'flagged' : ''}`}
              style={{ opacity: i < visibleRows ? 1 : 0 }}
            >
              <span className="r55-row-label">{row}</span>
              <span className="r55-row-aging">بیش از ۹۰ روز</span>
            </div>
          ))}
          <div className="r55-receipt-total">
            <span>سرمایه قفل‌شده</span>
            <span className="r55-total-value">{faNumber(capital)}</span>
          </div>
        </div>
      </div>

      <div className="r55-aging-meter">
        <span className="r55-aging-label">میانگین عمر موجودی</span>
        <span className="r55-aging-days">{faNumber(agingDays)} روز</span>
        <div className="r55-aging-track">
          <div className="r55-aging-fill" style={{ width: `${agingP * 100}%` }} />
        </div>
      </div>
    </div>
  )
}

// ─── 3. Isometric Autopsy (isometric-exploded): «کالای بی‌حرکت» ─────────────
function IsometricAutopsyActor({ t, plan }: R55ActorProps) {
  const explodeAt = cueAt(plan, 'explode-start', 0.3)
  const freezeAt = cueAt(plan, 'freeze-flag', 1.0)
  const layersAt = cueAt(plan, 'layer-separate', 2.5)
  const dustAt = cueAt(plan, 'dust-settle', 4.0)
  const slamAt = cueAt(plan, 'locked-capital-slam', 4.8)

  const explodeP = ease(progress(t, explodeAt, 1.4))
  const layersP = ease(progress(t, layersAt, 1.0))
  const dustP = ease(progress(t, dustAt, 0.6))
  const frozen = t >= freezeAt
  const slamSpring = spring(t - slamAt)
  const isSlammed = t >= slamAt

  const layers = [
    'لایه ۱ · قفسه فوقانی',
    'لایه ۲ · قفسه میانی',
    'لایه ۳ · قفسه پایین',
    'لایه ۴ · پالت کنار',
    'لایه ۵ · ته انبار',
  ]

  return (
    <div className={`r55-autopsy ${isSlammed ? 'locked' : ''}`}>
      <div className="r55-scene-headline">
        <span className="r55-scene-badge">کالبدشکافی انبار</span>
        <h2 className="r55-scene-title">کالای بی‌حرکت، ته انبار داره خاک می‌خوره!</h2>
      </div>

      <div className="r55-iso-stage">
        <div
          className="r55-iso-rig"
          style={{
            transform: `rotateX(58deg) rotateZ(-42deg) scale(${mix(0.9, 1, explodeP)})`,
          }}
        >
          {layers.map((label, i) => (
            <div
              key={label}
              className="r55-iso-layer"
              style={{
                transform: `translateZ(${i * 30 * layersP}px)`,
                opacity: progress(t, layersAt + i * 0.08, 0.35),
              }}
            >
              <span className="r55-iso-index">{faNumber(i + 1)}</span>
            </div>
          ))}
        </div>
        <div className="r55-iso-shadow" style={{ opacity: mix(0.1, 0.5, explodeP) }} />
        {frozen && (
          <div className="r55-iso-callouts">
            {layers.map((label, i) => (
              <div
                key={label}
                className="r55-iso-callout"
                style={{ opacity: progress(t, freezeAt + i * 0.06, 0.3) }}
              >
                {label}
              </div>
            ))}
          </div>
        )}
      </div>

      {dustP > 0 && (
        <div className="r55-dust" style={{ opacity: dustP }}>
          خاک‌خوردگی و رکود کامل گردش کالا
        </div>
      )}

      {isSlammed && (
        <div
          className="r55-locked-stamp"
          style={{
            transform: `rotate(-5deg) scale(${mix(2.0, 1, slamSpring)})`,
            opacity: progress(t, slamAt, 0.12),
          }}
        >
          سرمایه قفل‌شده
        </div>
      )}
    </div>
  )
}

// ─── 4. Glass Recovery (liquid-glass × swiss-terminal): «حسابچه…» ───────────
function GlassRecoveryActor({ t, plan }: R55ActorProps) {
  const brandAt = cueAt(plan, 'brand-anchor', 0.2)
  const terminalAt = cueAt(plan, 'glass-terminal', 0.9)
  const scanAt = cueAt(plan, 'report-scan', 2.6)
  const cashAt = cueAt(plan, 'cash-conversion', 4.5)
  const lockAt = cueAt(plan, 'recovery-lock', 5.15)

  const brandSpring = spring(t - brandAt)
  const terminalP = ease(progress(t, terminalAt, 0.8))
  const scanP = ease(progress(t, scanAt, 1.0))
  const cashP = ease(progress(t, cashAt, 0.8))
  const lockSpring = spring(t - lockAt)
  const isLocked = t >= lockAt
  const freed = mix(0, 400000000, cashP)

  return (
    <div className="r55-recovery">
      <div
        className="brand-entry-header r55-brand"
        style={{
          transform: `translateY(${mix(-16, 0, brandSpring)}px)`,
          opacity: progress(t, brandAt, 0.25),
        }}
      >
        <div className="brand-logo-circle">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2.2"
          >
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M7 8h10M7 12h7M7 16h9" />
          </svg>
        </div>
        <div className="brand-title-group">
          <span className="brand-name">حسابچه</span>
          <span className="brand-slogan">کاردکس لحظه‌ای و آزادسازی سرمایه راکد</span>
        </div>
      </div>

      <div
        className="r55-glass-panel"
        style={{
          transform: `scale(${mix(0.94, 1, terminalP)})`,
          opacity: progress(t, terminalAt, 0.3),
        }}
      >
        <div className="r55-glass-head">
          <span className="r55-glass-tag">گزارش کالای راکد</span>
          <span className="r55-glass-scan">{isLocked ? 'اسکن کامل ✓' : 'در حال اسکن…'}</span>
        </div>
        <div className="r55-scan-track">
          <div className="r55-scan-fill" style={{ width: `${scanP * 100}%` }} />
        </div>
        <div className="r55-terminal-grid">
          <div className="r55-term-cell">
            <span className="r55-term-label">اقلام راکد</span>
            <span className="r55-term-value">{faNumber(Math.round(mix(0, 14, scanP)))}</span>
          </div>
          <div className="r55-term-cell highlight">
            <span className="r55-term-label">سرمایه آزادشده</span>
            <span className="r55-term-value">{faNumber(freed)}</span>
          </div>
        </div>
      </div>

      {isLocked && (
        <div
          className="r55-recovery-banner"
          style={{
            transform: `scale(${mix(0.85, 1, lockSpring)})`,
            opacity: progress(t, lockAt, 0.2),
          }}
        >
          <span className="r55-recovery-check">✓</span>
          <div className="r55-recovery-text">
            <strong>سرمایه قفل‌شده دوباره نقد شد!</strong>
            <span>اولویت‌بندی تخفیف و نقطه سفارش هوشمند</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 5. CTA Conversion: «همین حالا انبارت رو…» ──────────────────────────────
function CtaConversionActor({ t, plan }: R55ActorProps) {
  const enterAt = plan?.words[0]?.start ?? 0.2
  const tagAt = cueAt(plan, 'inventory-tag', 0.85)
  const buttonAt = cueAt(plan, 'cta-button-pulse', 2.75)

  const enterSpring = spring(t - enterAt)
  const tagSpring = spring(t - tagAt)
  const buttonSpring = spring(t - buttonAt)

  return (
    <div
      className="cta-finish-container r55-cta"
      style={{
        transform: `translateY(${mix(20, 0, enterSpring)}px)`,
        opacity: progress(t, enterAt, 0.3),
      }}
    >
      <div className="cta-brand-hero">
        <div className="cta-logo-glow">
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2.2"
          >
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <path d="M7 8h10M7 12h6M7 16h9" />
          </svg>
        </div>
        <h2 className="cta-main-title">حسابچه</h2>
        <p className="cta-subtitle">پایان خواب سرمایه در قفسه‌های انبار</p>
      </div>

      <div
        className="r55-stock-tag"
        style={{
          transform: `translateY(${mix(18, 0, tagSpring)}px)`,
          opacity: progress(t, tagAt, 0.25),
        }}
      >
        <span className="r55-stock-tag-icon">📦</span>
        <span>انبار تو، روی کاردکس لحظه‌ای حسابچه</span>
      </div>

      <div className="cta-action-stack">
        <div
          className="cta-action-card cyan-cta"
          style={{ transform: `scale(${mix(0.96, 1, buttonSpring)})` }}
        >
          <div className="cta-card-badge">شروع رایگان و بدون هزینه اولیه</div>
          <div className="cta-card-action">شروع رایگان در: hisabche.com</div>
        </div>

        <div className="cta-search-prompt">
          <span>در گوگل جستجو کنید: </span>
          <strong>حسابچه</strong>
        </div>
      </div>

      <div className="cta-web-footer">hisabche.com</div>
    </div>
  )
}
