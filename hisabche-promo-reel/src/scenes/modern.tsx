// ============================================
// Modern, high-production motion scenes:
// kinetic typography, desktop/mobile UI mockups,
// animated financial charts, split-screen comparisons.
// ============================================

import { enter } from '../engine/anim'
import type { Cue, SceneSpec } from '../engine/types'
import { Card, TONE } from '../ui/card'
import { Icon } from '../ui/icons'
import {
  AreaChartSvg,
  BadgeToast,
  BarChartSvg,
  CountUp,
  DesktopWindow,
  InteractiveCursor,
  KineticWords,
  PhoneMockup,
} from '../ui/motion-primitives'
import { Rich } from '../ui/rich'

type Spec<K extends SceneSpec['kind']> = Extract<SceneSpec, { kind: K }>

// ─── 1. Kinetic Typography Scene ─────────────────────────────────────────

export function KineticScene({ spec, t }: { spec: Spec<'kinetic'>; t: number }) {
  const tone = spec.tone ?? 'cyan'
  return (
    <div className="scene kinetic-scene">
      <div className="kinetic-headline" style={enter(t, 0.2, { y: -20, scale: 0.95 })}>
        <Rich text={spec.headline} />
      </div>
      <KineticWords words={spec.words} t={t} startAt={0.8} gap={0.4} tone={tone} />
      {spec.sub && (
        <div
          className="kinetic-sub"
          style={enter(t, 0.8 + spec.words.length * 0.4 + 0.3, { y: 20 })}
        >
          <Rich text={spec.sub} />
        </div>
      )}
    </div>
  )
}

export const kineticCues = (spec: Spec<'kinetic'>): Cue[] => [
  { at: 0.1, kind: 'whoosh' },
  ...spec.words.map((_, i) => ({
    at: 0.8 + i * 0.4,
    kind: i === spec.words.length - 1 ? ('impact' as const) : ('tick' as const),
  })),
  { at: 0.8 + spec.words.length * 0.4 + 0.3, kind: 'chime' },
]

// ─── 2. Product UI Mockup Scene (Desktop / Mobile) ───────────────────────

export function MockupScene({ spec, t }: { spec: Spec<'mockup'>; t: number }) {
  return (
    <div className="scene mockup-scene">
      <div className="title-block" style={{ top: 70 }}>
        <div className="title" style={enter(t, 0.1, { y: -15 })}>
          <Rich text={spec.title} />
        </div>
        {spec.subtitle && (
          <div className="subtitle" style={enter(t, 0.3, { y: 10 })}>
            <Rich text={spec.subtitle} />
          </div>
        )}
      </div>

      <div className="mockup-container" style={{ top: 190 }}>
        {spec.device === 'window' ? (
          <DesktopWindow
            title={spec.screen.header}
            header={spec.screen.header}
            items={spec.screen.items}
            totalLabel={spec.screen.totalLabel}
            totalValue={spec.screen.totalValue}
            t={t}
            startAt={0.5}
            tone="cyan"
          />
        ) : (
          <PhoneMockup
            title={spec.screen.header}
            items={spec.screen.items}
            totalLabel={spec.screen.totalLabel}
            totalValue={spec.screen.totalValue}
            t={t}
            startAt={0.5}
            tone="cyan"
          />
        )}
      </div>

      {spec.toast && (
        <div style={{ position: 'absolute', top: 750, insetInline: 30 }}>
          <BadgeToast
            icon={spec.toast.icon}
            text={spec.toast.text}
            t={t}
            at={spec.toast.time}
            tone="green"
          />
        </div>
      )}

      {spec.cursor && (
        <InteractiveCursor
          t={t}
          x={spec.cursor.x}
          y={spec.cursor.y}
          clickAt={spec.cursor.clickAt}
        />
      )}
    </div>
  )
}

export const mockupCues = (spec: Spec<'mockup'>): Cue[] => [
  { at: 0.4, kind: 'whoosh' },
  { at: 1.0, kind: 'scan' },
  ...spec.screen.items.map((_, i) => ({ at: 1.2 + i * 0.25, kind: 'tick' as const })),
  ...(spec.toast ? [{ at: spec.toast.time, kind: 'cash' as const }] : []),
]

// ─── 3. Financial Data Chart Scene ───────────────────────────────────────

export function ChartScene({ spec, t }: { spec: Spec<'chart'>; t: number }) {
  return (
    <div className="scene chart-scene">
      <div className="title-block" style={{ top: 70 }}>
        <div className="title" style={enter(t, 0.1, { y: -15 })}>
          <Rich text={spec.title} />
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="chart-kpis-row" style={{ top: 170 }}>
        {spec.kpis.map((kpi, i) => (
          <Card
            key={i}
            tone={kpi.tone ?? 'cyan'}
            glow={0.5}
            className="kpi-mini-card"
            style={enter(t, 0.4 + i * 0.25, { y: 25 })}
          >
            <span className="kpi-label">{kpi.label}</span>
            <CountUp
              from={0}
              to={kpi.value}
              unit={kpi.unit}
              t={t}
              startAt={0.6 + i * 0.25}
              dur={1.5}
              className="kpi-value"
            />
            {kpi.trend && <span className="kpi-trend">{kpi.trend}</span>}
          </Card>
        ))}
      </div>

      {/* Main Chart Graphic */}
      <div className="chart-card-wrap" style={{ top: 380 }}>
        <Card tone="purple" glow={0.6} className="chart-main-card" style={enter(t, 0.9, { y: 40 })}>
          <div className="chart-header">
            <span className="chart-legend">
              <span className="legend-dot cyan" /> روند سود و فروش در حسابچه
            </span>
            <span className="chart-period">ماهانه</span>
          </div>
          {spec.chartType === 'area' ? (
            <AreaChartSvg data={spec.data} t={t} startAt={1.2} dur={1.6} tone="cyan" />
          ) : (
            <BarChartSvg data={spec.data} t={t} startAt={1.2} gap={0.18} tone="cyan" />
          )}
        </Card>
      </div>
    </div>
  )
}

export const chartCues = (spec: Spec<'chart'>): Cue[] => [
  { at: 0.3, kind: 'whoosh' },
  ...spec.kpis.map((_, i) => ({ at: 0.5 + i * 0.25, kind: 'tick' as const })),
  { at: 1.2, kind: 'sync' },
  { at: 2.8, kind: 'chime' },
]

// ─── 4. Split-Screen Comparison Scene ────────────────────────────────────

export function SplitScene({ spec, t }: { spec: Spec<'split'>; t: number }) {
  const divider = spec.dividerLabel || 'در برابر'
  return (
    <div className="scene split-scene">
      <div className="title-block" style={{ top: 60, insetInline: 20 }}>
        <div className="title" style={enter(t, 0.1, { y: -15 })}>
          <Rich text={spec.title} />
        </div>
      </div>

      <div className="split-stack-wrap" style={{ top: 160, insetInline: 20 }}>
        {/* Top Side (Traditional / Red) */}
        <Card
          tone={spec.left.tone}
          glow={0.4}
          className="split-card-row top-card"
          style={enter(t, 0.5, { y: 25 })}
        >
          <div className="split-row-header">
            <span className="split-header" style={{ color: TONE[spec.left.tone].solid }}>
              {spec.left.title}
            </span>
            {spec.left.subtitle && <span className="split-sub">{spec.left.subtitle}</span>}
          </div>
          <div className="split-points-horizontal">
            {spec.left.points.map((pt, i) => (
              <div key={i} className="split-pt-row" style={enter(t, 0.7 + i * 0.25, { x: -15 })}>
                <div className="split-icon-badge red">
                  <Icon name="trash" size={14} />
                </div>
                <span>{pt}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Persian Divider Badge */}
        <div className="split-divider-badge" style={enter(t, 0.8, { scale: 0.7, y: 0 })}>
          <span>{divider}</span>
        </div>

        {/* Bottom Side (Hisabche / Cyan) */}
        <Card
          tone={spec.right.tone}
          glow={0.7}
          className="split-card-row bottom-card"
          style={enter(t, 1.0, { y: 25 })}
        >
          <div className="split-row-header">
            <span className="split-header" style={{ color: TONE[spec.right.tone].solid }}>
              {spec.right.title}
            </span>
            {spec.right.subtitle && <span className="split-sub">{spec.right.subtitle}</span>}
          </div>
          <div className="split-points-horizontal">
            {spec.right.points.map((pt, i) => (
              <div key={i} className="split-pt-row" style={enter(t, 1.3 + i * 0.25, { x: 15 })}>
                <div className="split-icon-badge cyan">
                  <Icon name="check" size={14} />
                </div>
                <span>{pt}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

export const splitCues = (spec: Spec<'split'>): Cue[] => [
  { at: 0.4, kind: 'whoosh' },
  { at: 0.6, kind: 'alert' },
  ...spec.left.points.map((_, i) => ({ at: 0.8 + i * 0.3, kind: 'tick' as const })),
  { at: 1.0, kind: 'sync' },
  ...spec.right.points.map((_, i) => ({ at: 1.4 + i * 0.3, kind: 'tick' as const })),
  { at: 1.4 + spec.right.points.length * 0.3 + 0.1, kind: 'chime' },
]
