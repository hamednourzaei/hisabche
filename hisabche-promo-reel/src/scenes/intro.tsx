// Hook, branch and stagger — the opening scenes.

import { enter, ease, mix, progress, spring } from '../engine/anim'
import type { Cue, SceneSpec } from '../engine/types'
import { Badge, Card, TONE } from '../ui/card'
import { Icon } from '../ui/icons'
import { Rich } from '../ui/rich'

type Spec<K extends SceneSpec['kind']> = Extract<SceneSpec, { kind: K }>

// ─── Hook ────────────────────────────────────────────────────────────────

const HOOK = { label: 0.1, line: 0.3, lineGap: 0.35, cards: 0.8, cardGap: 0.2 }

export function Hook({ spec, t }: { spec: Spec<'hook'>; t: number }) {
  const archetype = spec.openingArchetype

  // 1. Immediate Consequence (فاجعه در لحظه وقوع)
  if (archetype === 'immediate-consequence') {
    return (
      <div className="scene opening-immediate-consequence">
        {/* Active Emergency Freeze Header */}
        <div
          style={{
            position: 'absolute',
            top: 50,
            insetInline: 24,
            padding: '12px 18px',
            borderRadius: 14,
            background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.25), rgba(185, 28, 28, 0.15))',
            border: '1.5px solid rgba(239, 68, 68, 0.6)',
            boxShadow: '0 0 30px rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            ...enter(t, 0, { y: -20 }),
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#ef4444',
                boxShadow: '0 0 12px #ef4444',
                display: 'inline-block',
                transform: `scale(${1 + 0.15 * Math.sin(t * 8)})`,
              }}
            />
            <span
              style={{ fontSize: 14, fontWeight: 800, color: '#fecaca', letterSpacing: '0.02em' }}
            >
              {spec.consequence?.alertBanner ?? 'توقف عملیات پای صندوق'}
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#f87171',
              background: 'rgba(0,0,0,0.4)',
              padding: '4px 8px',
              borderRadius: 6,
            }}
          >
            بحران لحظه‌ای
          </span>
        </div>

        {/* Stopped Action Hero Card */}
        <div
          style={{
            position: 'absolute',
            top: 130,
            insetInline: 24,
            padding: '24px 20px',
            borderRadius: 20,
            background: 'rgba(15, 12, 28, 0.95)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
            ...enter(t, 0.2, { scale: 0.95, y: 30 }),
          }}
        >
          <div style={{ fontSize: 12, color: '#fca5a5', fontWeight: 600, marginBottom: 8 }}>
            نقطه شکست عملیاتی:
          </div>
          <div style={{ fontSize: 18, color: '#fef2f2', fontWeight: 800, lineHeight: 1.6 }}>
            {spec.consequence?.stoppedAction ??
              'قطع ارتباط پایانه با پایگاه مرکزی و تعلیق تسویه مشتری'}
          </div>
        </div>

        {/* Dynamic Shock Headline */}
        <div className="title-block" style={{ top: 320, insetInline: 24 }}>
          {spec.lines.map((line, i) => (
            <div key={i} className={i === 0 ? 'title xl' : 'title'} style={enter(t, 0.5 + i * 0.3)}>
              <Rich text={line} />
            </div>
          ))}
        </div>

        {/* Loss Metric Counter Footer */}
        <div
          style={{
            position: 'absolute',
            top: 660,
            insetInline: 24,
            padding: '18px 20px',
            borderRadius: 18,
            background: 'rgba(20, 16, 35, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            ...enter(t, 1.2, { y: 30 }),
          }}
        >
          <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', fontWeight: 600 }}>
            زیان انباشته تا این ثانیه:
          </span>
          <span style={{ fontSize: 15, fontWeight: 900, color: '#f87171' }}>
            {spec.consequence?.lossMetric ?? 'تلف شدن اعتماد و ایجاد صف معترض'}
          </span>
        </div>
      </div>
    )
  }

  // 2. Uncomfortable Discovery (کشف مغایرت تلخ)
  if (archetype === 'uncomfortable-discovery') {
    const isCracked = t >= 0.4
    const fractureProgress = ease(progress(t, 0.4, 0.4))
    const pulseMotion = 1 + 0.015 * Math.sin(t * 6)
    return (
      <div
        className="scene opening-uncomfortable-discovery"
        style={{ transform: `scale(${pulseMotion})` }}
      >
        {/* Surface Calm Hero Metric - Immediate Frame 0 */}
        <div
          style={{
            position: 'absolute',
            top: 60,
            insetInline: 24,
            padding: '20px 24px',
            borderRadius: 20,
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1.5px solid rgba(34, 211, 238, 0.4)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            ...enter(t, 0, { y: -20 }),
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: 'rgba(148, 163, 184, 0.9)',
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            {spec.discovery?.surfaceMetric.label ?? 'دخل و فروش ثبت‌شده پای صندوق'}
          </div>
          <div
            style={{ fontSize: 32, fontWeight: 900, color: '#38bdf8', letterSpacing: '-0.02em' }}
          >
            {spec.discovery?.surfaceMetric.value ?? '۸۵٬۰۰۰٬۰۰۰ تومان'}
          </div>
          <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 700, marginTop: 4 }}>
            ظاهر امر: فروش موفق و پررونق روزانه
          </div>
        </div>

        {/* Dynamic Shock Narrative Headline */}
        <div className="title-block" style={{ top: 220, insetInline: 24 }}>
          {spec.lines.map((line, i) => (
            <div
              key={i}
              className={i === 0 ? 'title xl' : 'title'}
              style={enter(t, 0.15 + i * 0.2)}
            >
              <Rich text={line} />
            </div>
          ))}
        </div>

        {/* The X-Ray Fissure & Hidden Reality Reveal */}
        <div
          style={{
            position: 'absolute',
            top: 450,
            insetInline: 24,
            padding: '22px 24px',
            borderRadius: 20,
            background: 'rgba(30, 10, 20, 0.95)',
            border: `2px solid ${isCracked ? 'rgba(244, 63, 94, 0.85)' : 'rgba(255,255,255,0.08)'}`,
            boxShadow: isCracked ? '0 0 35px rgba(244, 63, 94, 0.4)' : 'none',
            transform: `scale(${isCracked ? 1 + 0.03 * (1 - fractureProgress) : 0.96})`,
            transition: 'border 0.2s ease, transform 0.2s ease',
            ...enter(t, 0.4, { y: 35 }),
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 13, color: '#f87171', fontWeight: 800 }}>
              {spec.discovery?.hiddenReality.label ?? 'سود واقعی پس از احتساب بهای جایگزینی'}
            </span>
            <span
              style={{
                fontSize: 11,
                color: '#fca5a5',
                background: 'rgba(239, 68, 68, 0.25)',
                padding: '2px 8px',
                borderRadius: 4,
                fontWeight: 700,
              }}
            >
              واقعیت پنهان
            </span>
          </div>
          <div
            style={{ fontSize: 30, fontWeight: 900, color: '#fb7185', letterSpacing: '-0.01em' }}
          >
            {spec.discovery?.hiddenReality.value ?? 'منفی ۴٬۲۰۰٬۰۰۰ تومان!'}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(254, 202, 202, 0.85)',
              fontWeight: 600,
              marginTop: 8,
              lineHeight: 1.6,
            }}
          >
            {spec.discovery?.discrepancyNote ??
              'فروش با قیمت قدیم در تورم جدید یعنی آب رفتن سرمایه اصلی.'}
          </div>
        </div>
      </div>
    )
  }

  // 3. Customer Confrontation (روبه‌رو شدن با مشتری یا طلبکار)
  if (archetype === 'customer-confrontation') {
    return (
      <div className="scene opening-customer-confrontation">
        {/* Tension Dialogue Bubble */}
        <div
          style={{
            position: 'absolute',
            top: 70,
            insetInline: 24,
            padding: '20px 22px',
            borderRadius: '24px 24px 6px 24px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(15, 12, 28, 0.95))',
            border: '1.5px solid rgba(239, 68, 68, 0.5)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
            ...enter(t, 0.2, { scale: 0.9, y: -20 }),
          }}
        >
          <div style={{ fontSize: 12, color: '#fca5a5', fontWeight: 700, marginBottom: 6 }}>
            {spec.confrontation?.speaker ?? 'مشتری قدیمی پای تسویه حساب نسیه:'}
          </div>
          <div style={{ fontSize: 19, fontWeight: 900, color: '#ffffff', lineHeight: 1.7 }}>
            {spec.confrontation?.dialogue ??
              '«من همچین خریدی نداشتم حاجی! فاکتور معتبرت با امضای من کو؟»'}
          </div>
        </div>

        {/* Faded Unreadable Thermal Paper Receipt Simulation */}
        <div
          style={{
            position: 'absolute',
            top: 250,
            insetInline: 40,
            padding: '18px 20px',
            borderRadius: 14,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px dashed rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(10px)',
            ...enter(t, 0.7, { y: 30 }),
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.4)',
              textAlign: 'center',
              marginBottom: 8,
              letterSpacing: '0.1em',
            }}
          >
            رسید کاغذی پوز (جوهر حرارتی محوشده)
          </div>
          <div
            style={{
              height: 6,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 3,
              marginBottom: 8,
              opacity: 0.4,
            }}
          />
          <div
            style={{
              height: 6,
              width: '70%',
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 3,
              marginBottom: 12,
              opacity: 0.3,
            }}
          />
          <div style={{ fontSize: 12, color: '#fb7185', fontWeight: 800, textAlign: 'center' }}>
            {spec.confrontation?.fadedEvidence ??
              'کاغذ سفید شده، فاقد هرگونه وجاهت قانونی در دادگاه و حل اختلاف!'}
          </div>
        </div>

        {/* Main Headline */}
        <div className="title-block" style={{ top: 430, insetInline: 24 }}>
          {spec.lines.map((line, i) => (
            <div key={i} className={i === 0 ? 'title xl' : 'title'} style={enter(t, 1.2 + i * 0.3)}>
              <Rich text={line} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 4. Visual Pattern Interrupt (شوک بصری و شکست ساختار)
  if (archetype === 'visual-pattern-interrupt') {
    return (
      <div className="scene opening-visual-pattern-interrupt" style={{ padding: '0 24px' }}>
        {/* Giant Colossal Typography Filling 80%+ of Canvas */}
        <div style={{ position: 'absolute', top: 90, insetInline: 24 }}>
          <div
            style={{
              fontSize: 14,
              letterSpacing: '0.3em',
              color: '#38bdf8',
              fontWeight: 800,
              marginBottom: 16,
              ...enter(t, 0, { y: -15 }),
            }}
          >
            هشدار سیستمی بازار
          </div>
          <div
            style={{
              fontSize: 38,
              fontWeight: 900,
              lineHeight: 1.3,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              ...enter(t, 0.15, { scale: 0.9, y: 30 }),
            }}
          >
            {spec.interrupt?.colossalHeadline ?? spec.lines[0] ?? 'توقف سنتی'}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#f43f5e',
              marginTop: 14,
              lineHeight: 1.5,
              ...enter(t, 0.4, { y: 20 }),
            }}
          >
            {spec.interrupt?.subHeadline ??
              spec.lines[1] ??
              'روش‌های قدیمی پاسخگوی بازار امروز نیست!'}
          </div>
        </div>

        {/* Shattered Tool Indicator */}
        <div
          style={{
            position: 'absolute',
            top: 480,
            insetInline: 24,
            padding: '24px 20px',
            borderRadius: 20,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            ...enter(t, 0.8, { y: 40 }),
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f43f5e',
              fontSize: 24,
            }}
          >
            ⚡
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>شکست روش‌های سنتی</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
              {spec.interrupt?.shatteredTool ?? 'دفتر دست‌نویس و خطای انسانی غیرقابل جبران'}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 5. Quiet Dread (دلهره خاموش و جزئیات نگران‌کننده)
  if (archetype === 'quiet-dread') {
    const pulse = 0.5 + 0.5 * Math.sin(t * 3)
    return (
      <div
        className="scene opening-quiet-dread"
        style={{
          background: 'radial-gradient(circle at 50% 30%, rgba(30, 20, 50, 0.4), transparent 70%)',
        }}
      >
        {/* Single Focused Spotlight Detail */}
        <div
          style={{
            position: 'absolute',
            top: 100,
            insetInline: 28,
            padding: '30px 24px',
            borderRadius: 24,
            background: 'rgba(10, 8, 20, 0.95)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            boxShadow: `0 0 ${20 + pulse * 20}px rgba(168, 85, 247, 0.15)`,
            textAlign: 'center',
            ...enter(t, 0.4, { scale: 0.95, y: -20 }),
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'rgba(168, 85, 247, 0.8)',
              letterSpacing: '0.2em',
              fontWeight: 800,
              marginBottom: 12,
            }}
          >
            موعد حیاتی
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#f3e8ff', marginBottom: 10 }}>
            {spec.quietDread?.isolatedFact ?? 'سررسید چک: فردا ساعت ۱۱:۰۰'}
          </div>
          <div style={{ fontSize: 13, color: '#fca5a5', fontWeight: 700 }}>
            {spec.quietDread?.unsettlingDetail ?? 'موجودی حساب: ناکافی | طلب‌های وصول‌نشده: نامشخص'}
          </div>
        </div>

        {/* Minimal Tension Headline */}
        <div className="title-block" style={{ top: 350, insetInline: 24 }}>
          {spec.lines.map((line, i) => (
            <div key={i} className={i === 0 ? 'title xl' : 'title'} style={enter(t, 1.2 + i * 0.4)}>
              <Rich text={line} />
            </div>
          ))}
        </div>

        {/* Low Frequency Rhythm Bar */}
        <div
          style={{
            position: 'absolute',
            top: 680,
            insetInline: 40,
            height: 4,
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${(t / 7) * 100}%`,
              background: 'linear-gradient(90deg, #a855f7, #ef4444)',
            }}
          />
        </div>
      </div>
    )
  }

  // 6. Deadline Pressure (فشار زمان و ساعت صفر)
  if (archetype === 'deadline-pressure') {
    const angle = (t * 60) % 360
    return (
      <div className="scene opening-deadline-pressure">
        {/* Radial Deadline Clock & Timer Arc */}
        <div
          style={{
            position: 'absolute',
            top: 60,
            insetInline: 24,
            padding: '20px 22px',
            borderRadius: 22,
            background: 'rgba(15, 20, 35, 0.95)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            boxShadow: '0 20px 45px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            ...enter(t, 0.1, { y: -20 }),
          }}
        >
          <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="#f59e0b"
                strokeWidth="4"
                fill="none"
                strokeDasharray="175.9"
                strokeDashoffset={175.9 * (1 - Math.min(1, t / 7))}
                transform="rotate(-90 32 32)"
              />
              <line
                x1="32"
                y1="32"
                x2={32 + 20 * Math.cos((angle - 90) * (Math.PI / 180))}
                y2={32 + 20 * Math.sin((angle - 90) * (Math.PI / 180))}
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 800 }}>
              {spec.deadline?.countdownLabel ?? 'شمارش معکوس تسویه'}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', marginTop: 2 }}>
              {spec.deadline?.targetTime ?? 'ساعت ۱۲:۰۰ ظهر'}
            </div>
            <div style={{ fontSize: 11, color: '#fca5a5', fontWeight: 600, marginTop: 4 }}>
              {spec.deadline?.unresolvedGap ?? 'مهلت پاس کردن چک در بانک'}
            </div>
          </div>
        </div>

        {/* Deadline Urgency Headline */}
        <div className="title-block" style={{ top: 260, insetInline: 24 }}>
          {spec.lines.map((line, i) => (
            <div key={i} className={i === 0 ? 'title xl' : 'title'} style={enter(t, 0.6 + i * 0.3)}>
              <Rich text={line} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Default Standard Hook
  return (
    <div className="scene">
      {spec.label ? (
        <div className="label" style={enter(t, HOOK.label, { y: -10 })}>
          {spec.label}
        </div>
      ) : null}
      <div className="title-block" style={{ top: 150 }}>
        {spec.lines.map((line, i) => (
          <div
            key={i}
            className={i === 0 ? 'title xl' : 'title'}
            style={enter(t, HOOK.line + i * HOOK.lineGap)}
          >
            <Rich text={line} />
          </div>
        ))}
      </div>
      {spec.cards ? (
        <>
          <div className="row-cards" style={{ top: 430 }}>
            {spec.cards.map((card, i) => (
              <Card
                key={i}
                tone={card.tone}
                className="square"
                style={enter(t, HOOK.cards + i * HOOK.cardGap, { y: 40 })}
              >
                <Badge icon={card.icon} tone={card.tone} size={64} />
                <div className="card-title">{card.title}</div>
                {card.sub ? <div className="card-sub">{card.sub}</div> : null}
              </Card>
            ))}
          </div>

          {/* Living Contextual Grounding Baseline */}
          <div
            style={{
              position: 'absolute',
              top: 730,
              insetInline: 36,
              padding: '12px 20px',
              borderRadius: 999,
              background: 'rgba(12, 14, 24, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              ...enter(t, HOOK.cards + spec.cards.length * HOOK.cardGap + 0.15, { y: 20 }),
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: spec.cards.some((c) => c.tone === 'red') ? '#f43f5e' : '#22d3ee',
                boxShadow: spec.cards.some((c) => c.tone === 'red')
                  ? '0 0 10px #f43f5e'
                  : '0 0 10px #22d3ee',
              }}
            />
            <span style={{ fontSize: 13, color: 'rgba(241, 245, 249, 0.85)', fontWeight: 600 }}>
              {spec.cards.some((c) => c.tone === 'red')
                ? 'هشدار مغایرت: ناترازی عملیاتی نیازمند تطبیق سیستمی'
                : 'پایش مستمر چرخه حسابداری و انبار در بستر یکپارچه'}
            </span>
          </div>
        </>
      ) : null}
    </div>
  )
}

export const hookCues = (spec: Spec<'hook'>): Cue[] => {
  const archetype = spec.openingArchetype

  if (archetype === 'immediate-consequence') {
    return [
      { at: 0, kind: 'impact' },
      { at: 0.7, kind: 'alert' },
    ]
  }

  if (archetype === 'uncomfortable-discovery') {
    return [
      { at: 0, kind: 'softTransition' },
      { at: 0.9, kind: 'insightReveal' },
      { at: 1.6, kind: 'alert' },
    ]
  }

  if (archetype === 'customer-confrontation') {
    return [
      { at: 0.2, kind: 'titleHit' },
      { at: 1.1, kind: 'alert' },
      { at: 1.8, kind: 'pop' },
    ]
  }

  if (archetype === 'visual-pattern-interrupt') {
    return [
      { at: 0, kind: 'titleHit' },
      { at: 0.5, kind: 'whoosh' },
      { at: 1.2, kind: 'precisionSequence' },
    ]
  }

  if (archetype === 'quiet-dread') {
    return [
      { at: 0.8, kind: 'tick' },
      { at: 1.6, kind: 'tick' },
      { at: 2.4, kind: 'impact' },
    ]
  }

  if (archetype === 'deadline-pressure') {
    return [
      { at: 0.2, kind: 'tick' },
      { at: 0.6, kind: 'tick' },
      { at: 1.0, kind: 'tick' },
      { at: 1.4, kind: 'tick' },
      { at: 1.8, kind: 'whoosh' },
    ]
  }

  return [
    { at: 0, kind: 'whoosh' },
    ...(spec.cards ?? []).map((c, i) => ({
      at: HOOK.cards + i * HOOK.cardGap,
      kind: c.tone === 'red' ? ('alert' as const) : ('pop' as const),
    })),
  ]
}

// ─── Branch ──────────────────────────────────────────────────────────────

const BRANCH = {
  shrink: 0,
  dot: 0.5,
  draw: 0.7,
  drawDur: 0.9,
  question: 1.8,
  answer: 2.2,
  badge: 2.5,
}

export function Branch({ spec, t }: { spec: Spec<'branch'>; t: number }) {
  const shrink = ease(progress(t, BRANCH.shrink, 0.7))
  const draw = ease(progress(t, BRANCH.draw, BRANCH.drawDur))
  // The cards from the hook, moved up and scaled to 0.85.
  const top = mix(430, 200, shrink)
  const scale = mix(1, 0.85, shrink)
  return (
    <div className="scene">
      <div className="row-cards" style={{ top, transform: `scale(${scale})` }}>
        {spec.cards.map((card, i) => (
          <Card key={i} tone={card.tone} className="square">
            <Badge icon={card.icon} tone={card.tone} size={64} />
            <div className="card-title">{card.title}</div>
            {card.sub ? <div className="card-sub">{card.sub}</div> : null}
          </Card>
        ))}
      </div>
      <svg className="overlay" viewBox="0 0 540 960">
        <defs>
          <linearGradient id="branch-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <linearGradient id="branch-grad-p" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
          <marker id="tip-c" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="#22d3ee" />
          </marker>
          <marker id="tip-p" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="#c084fc" />
          </marker>
        </defs>
        {/* RTL: the first card is on the right. */}
        <path
          d="M270 600 C 270 500, 400 480, 400 400"
          stroke="url(#branch-grad)"
          strokeWidth={3}
          fill="none"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={1 - draw}
          markerEnd={draw > 0.97 ? 'url(#tip-c)' : undefined}
          style={{ filter: 'drop-shadow(0 0 6px #22d3ee)' }}
        />
        <path
          d="M270 600 C 270 500, 140 480, 140 400"
          stroke="url(#branch-grad-p)"
          strokeWidth={3}
          fill="none"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={1 - draw}
          markerEnd={draw > 0.97 ? 'url(#tip-p)' : undefined}
          style={{ filter: 'drop-shadow(0 0 6px #c084fc)' }}
        />
        <circle
          cx={270}
          cy={600}
          r={7 * spring(t - BRANCH.dot)}
          fill="#fff"
          style={{ filter: 'drop-shadow(0 0 10px #fff)' }}
        />
      </svg>
      <Card
        tone="cyan"
        className="hero-badge"
        style={{ top: 470, ...enter(t, BRANCH.badge, { scale: 0.6, y: 0 }) }}
      >
        <Rich text={spec.badge} />
      </Card>
      <div className="title-block" style={{ top: 660 }}>
        <div className="title xl" style={enter(t, BRANCH.question)}>
          {spec.question}
        </div>
        <div className="title hl-gradient" style={enter(t, BRANCH.answer)}>
          {spec.answer}
        </div>
      </div>
    </div>
  )
}

export const branchCues = (): Cue[] => [
  { at: BRANCH.draw, kind: 'whoosh' },
  { at: BRANCH.question, kind: 'tick' },
  { at: BRANCH.badge, kind: 'chime' },
]

// ─── Stagger ─────────────────────────────────────────────────────────────

const STAGGER = { title: 0.1, card: 0.4, rows: 1.0 }

export function Stagger({ spec, t }: { spec: Spec<'stagger'>; t: number }) {
  const gap = spec.interval ?? 0.6
  const tone = spec.tone ?? 'cyan'
  return (
    <div className="scene">
      <div className="title-block" style={{ top: 90 }}>
        <div className="title" style={enter(t, STAGGER.title)}>
          <Rich text={spec.title} />
        </div>
      </div>
      <Card tone={tone} className="big" style={{ top: 210, ...enter(t, STAGGER.card, { y: 60 }) }}>
        <div className="big-header">
          <span className="muted">{spec.header[1]}</span>
          <span style={{ color: TONE[tone].solid, fontWeight: 800 }}>{spec.header[0]}</span>
        </div>
        <div className="rows">
          {spec.rows.map((row, i) => (
            <div key={i} className="row" style={enter(t, STAGGER.rows + i * gap, { y: 30 })}>
              <span
                className="row-icon"
                style={{ color: TONE[tone].solid, background: TONE[tone].soft }}
              >
                <Icon name={row.icon} size={20} />
              </span>
              <span>{row.text}</span>
            </div>
          ))}
        </div>
        {t >= STAGGER.rows + spec.rows.length * gap && (
          <div
            style={{
              marginTop: 14,
              padding: '8px 14px',
              borderRadius: 12,
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.45)',
              boxShadow: '0 0 16px rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              ...enter(t, STAGGER.rows + spec.rows.length * gap + 0.1, { y: 12, scale: 0.9 }),
            }}
          >
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center' }}>
              <Icon name="check" size={16} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#a7f3d0' }}>
              ثبت خودکار و آنی در تمام بخش‌ها
            </span>
          </div>
        )}
      </Card>
    </div>
  )
}

export const staggerCues = (spec: Spec<'stagger'>): Cue[] => [
  { at: 0, kind: 'whoosh' },
  ...spec.rows.map((_, i) => ({
    at: STAGGER.rows + i * (spec.interval ?? 0.6),
    kind: 'tick' as const,
  })),
  { at: STAGGER.rows + spec.rows.length * (spec.interval ?? 0.6) + 0.1, kind: 'success' },
]
