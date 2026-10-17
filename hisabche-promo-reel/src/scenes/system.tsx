// Hub, compare and bridge — what Hisabche is made of.

import { enter, ease, leave, mix, progress, spring } from '../engine/anim'
import type { Cue, Mark, SceneSpec } from '../engine/types'
import { Badge, Card, TONE } from '../ui/card'
import { Icon } from '../ui/icons'
import { Rich } from '../ui/rich'

type Spec<K extends SceneSpec['kind']> = Extract<SceneSpec, { kind: K }>

// ─── Hub ─────────────────────────────────────────────────────────────────

const HUB = { title: 0.1, core: 0.5, nodes: 1.1, gap: 0.45, line: 0.35 }
const CX = 270
const CY = 520
const R = 190
const R_CORE = 76

export function Hub({ spec, t }: { spec: Spec<'hub'>; t: number }) {
  const n = spec.nodes.length
  const corePop = spring(t - HUB.core)
  const allNodesReady = t >= HUB.nodes + (n - 1) * HUB.gap + HUB.line

  return (
    <div className="scene">
      <div className="title-block" style={{ top: 90 }}>
        <div className="title" style={enter(t, HUB.title)}>
          <Rich text={spec.title} />
        </div>
      </div>
      <svg className="overlay" viewBox="0 0 540 960" style={{ pointerEvents: 'none' }}>
        {/* Core occluding dark disc to prevent background grid lines from blending into core text */}
        <circle cx={CX} cy={CY} r={R_CORE} fill="#090812" fillOpacity={0.98} />

        {/* Outer concentric ripple waves radiating away from core perimeter */}
        {[1, 2, 3].map((ring) => {
          const phase = (((t * 0.5 + ring / 3) % 1) + 1) % 1
          return (
            <circle
              key={ring}
              cx={CX}
              cy={CY}
              r={R_CORE + 4 + phase * 65}
              fill="none"
              stroke="#a855f7"
              strokeOpacity={(1 - phase) * 0.35 * Math.min(1, corePop)}
              strokeWidth={1.5}
            />
          )
        })}

        {/* Radial connector lines starting strictly from the outer boundary of the core */}
        {spec.nodes.map((_, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2
          const x1 = CX + Math.cos(angle) * R_CORE
          const y1 = CY + Math.sin(angle) * R_CORE
          const x2 = CX + Math.cos(angle) * R
          const y2 = CY + Math.sin(angle) * R
          const draw = ease(progress(t, HUB.nodes + i * HUB.gap, HUB.line))
          const currentX = x1 + (x2 - x1) * draw
          const currentY = y1 + (y2 - y1) * draw

          // Secondary motion: traveling data pulses along the lines during holds
          const pulsePhase = (((t * 0.65 + i * 0.25) % 1) + 1) % 1
          const pulseX = mix(x1, x2, pulsePhase)
          const pulseY = mix(y1, y2, pulsePhase)

          return (
            <g key={i}>
              <line
                x1={x1}
                y1={y1}
                x2={currentX}
                y2={currentY}
                stroke={i % 2 ? '#c084fc' : '#22d3ee'}
                strokeWidth={2}
                strokeOpacity={0.85}
                style={{ filter: `drop-shadow(0 0 4px ${i % 2 ? '#c084fc' : '#22d3ee'})` }}
              />
              {allNodesReady && (
                <circle
                  cx={pulseX}
                  cy={pulseY}
                  r={3.5}
                  fill={i % 2 ? '#c084fc' : '#22d3ee'}
                  opacity={mix(0.2, 0.95, Math.sin(pulsePhase * Math.PI))}
                  style={{ filter: `drop-shadow(0 0 6px ${i % 2 ? '#c084fc' : '#22d3ee'})` }}
                />
              )}
            </g>
          )
        })}
      </svg>

      {/* Central Hub Core with strong dark backdrop blur and solid depth */}
      <div
        className="hub-core"
        style={{
          left: CX - R_CORE,
          top: CY - R_CORE,
          width: R_CORE * 2,
          height: R_CORE * 2,
          opacity: Math.min(1, corePop),
          transform: `scale(${0.6 + 0.4 * corePop})`,
        }}
      >
        <div className="hub-core-title">{spec.core}</div>
        <div className="hub-core-sub">{spec.coreSub}</div>
      </div>

      {/* Satellite Nodes with readable labels */}
      {spec.nodes.map((node, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2
        const x = CX + Math.cos(angle) * R
        const y = CY + Math.sin(angle) * R
        const tone = i % 2 ? 'purple' : 'cyan'
        const isTop = Math.sin(angle) < -0.4
        const nodeIdle = allNodesReady ? Math.sin(t * 2.5 + i * 1.5) * 0.03 : 0

        return (
          <div
            key={i}
            className="hub-node"
            style={{
              left: x - 60,
              top: isTop ? y - 64 : y - 38,
              width: 120,
              flexDirection: isTop ? 'column-reverse' : 'column',
              transform: `scale(${1 + nodeIdle})`,
              ...enter(t, HUB.nodes + i * HUB.gap + HUB.line - 0.05, { y: 0, scale: 0.4 }),
            }}
          >
            <span
              className="hub-node-icon"
              style={{
                color: TONE[tone].solid,
                borderColor: TONE[tone].solid + 'aa',
                boxShadow: `0 0 16px ${TONE[tone].glow}`,
                background: 'rgba(12, 10, 24, 0.95)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Icon name={node.icon} size={20} />
            </span>
            <span
              className="hub-node-label"
              style={{
                background: 'rgba(8, 9, 15, 0.94)',
                padding: '4px 10px',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(10px)',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5)',
              }}
            >
              {node.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export const hubCues = (spec: Spec<'hub'>): Cue[] => [
  { at: HUB.core, kind: 'sync' },
  ...spec.nodes.map((_, i) => ({
    at: HUB.nodes + i * HUB.gap + HUB.line - 0.05,
    kind: i === spec.nodes.length - 1 ? ('chime' as const) : ('tick' as const),
  })),
]

// ─── Compare ─────────────────────────────────────────────────────────────

const COMPARE = { title: 0.1, table: 0.4, header: 0.7, rows: 1.1 }

function MarkCell({ mark, ours }: { mark: Mark; ours: boolean }) {
  if (mark === 'no') return <span className="mark-no">—</span>
  if (mark === 'part') return <span className="mark-part">نیمه</span>
  return <span className={ours ? 'mark-yes ours' : 'mark-yes'}>✓</span>
}

export function Compare({ spec, t }: { spec: Spec<'compare'>; t: number }) {
  const gap = spec.interval ?? 0.45
  const verdictAt = COMPARE.rows + spec.rows.length * gap + 0.3

  return (
    <div className="scene">
      <div className="title-block" style={{ top: 80 }}>
        <div className="title" style={enter(t, COMPARE.title)}>
          <Rich text={spec.title} />
        </div>
      </div>
      <Card
        tone="purple"
        glow={0.6}
        className="table"
        style={{ top: 175, padding: '16px 18px', ...enter(t, COMPARE.table, { y: 50 }) }}
      >
        <div className="trow thead" style={enter(t, COMPARE.header, { y: 10 })}>
          <span className="tcell tcell-label">{spec.columns[0]}</span>
          <span className="tcell muted">{spec.columns[1]}</span>
          <span className="tcell muted">{spec.columns[2]}</span>
          <span className="tcell hl-gradient strong ours-col-head">{spec.columns[3]}</span>
        </div>
        {spec.rows.map((row, i) => (
          <div key={i} className="trow" style={enter(t, COMPARE.rows + i * gap, { y: 18, x: 20 })}>
            <span className="tcell tcell-label">{row.label}</span>
            <span className="tcell">
              <MarkCell mark={row.marks[0]} ours={false} />
            </span>
            <span className="tcell">
              <MarkCell mark={row.marks[1]} ours={false} />
            </span>
            <span className="tcell ours-cell">
              <MarkCell mark={row.marks[2]} ours />
            </span>
          </div>
        ))}
      </Card>

      {/* Dynamic Verdict Card Transformation (Eliminates dead space in Scene 4) */}
      <div
        style={{
          position: 'absolute',
          top: 615,
          insetInline: 22,
          padding: '14px 18px',
          borderRadius: 16,
          background: 'rgba(10, 14, 22, 0.88)',
          border: '1.5px solid rgba(34, 211, 238, 0.35)',
          boxShadow: '0 14px 40px rgba(0, 0, 0, 0.7), 0 0 25px rgba(34, 211, 238, 0.15)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          ...enter(t, verdictAt, { y: 25, scale: 0.95 }),
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'rgba(34, 211, 238, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#22d3ee',
            flexShrink: 0,
          }}
        >
          <Icon name="shield" size={20} />
        </div>
        <div style={{ textAlign: 'start' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#f8fafc' }}>
            <Rich text="[c:شفافیت قطعی موجودی]: صفر شدن ۱۰۰٪ مغایرت در انبارگردانی" />
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
            ثبت لحظه‌ای کاردکس با حواله انتقال دوطرفه و تراز دفاتر مالی
          </div>
        </div>
      </div>
    </div>
  )
}

export const compareCues = (spec: Spec<'compare'>): Cue[] => [
  { at: COMPARE.table, kind: 'whoosh' },
  ...spec.rows.map((_, i) => ({
    at: COMPARE.rows + i * (spec.interval ?? 0.45),
    kind: 'tick' as const,
  })),
  { at: COMPARE.rows + spec.rows.length * (spec.interval ?? 0.45) + 0.2, kind: 'chime' },
]

// ─── Bridge ──────────────────────────────────────────────────────────────

const BRIDGE = {
  title: 0.1,
  left: 0.4,
  right: 0.6,
  line: 1.2,
  merge: 2.2,
  caption: 3.0,
  partB: 4.0,
  sum: 4.4,
  sumGap: 0.6,
}

export function Bridge({ spec, t }: { spec: Spec<'bridge'>; t: number }) {
  const line = ease(progress(t, BRIDGE.line, 0.8))
  const merge = ease(progress(t, BRIDGE.merge, 0.6))
  const partA = leave(t, BRIDGE.partB, 0.4)
  return (
    <div className="scene">
      <div style={{ opacity: partA }}>
        <div className="title-block" style={{ top: 120 }}>
          <div className="title" style={enter(t, BRIDGE.title)}>
            <Rich text={spec.title} />
          </div>
        </div>
        {(['right', 'left'] as const).map((side, i) => {
          const card = spec[side]
          const x = side === 'right' ? mix(330, 200, merge) : mix(70, 200, merge)
          return (
            <Card
              key={side}
              tone={card.tone}
              className="mini"
              style={{
                left: x,
                top: 380,
                opacity: (1 - merge) * Number(enter(t, i ? BRIDGE.left : BRIDGE.right).opacity),
              }}
            >
              <Badge icon={card.icon} tone={card.tone} size={46} />
              <div className="card-title small">{card.title}</div>
            </Card>
          )
        })}
        <svg className="overlay" viewBox="0 0 540 960">
          <line
            x1={210}
            y1={445}
            x2={210 + 120 * line}
            y2={445}
            stroke="url(#bridge-grad)"
            strokeWidth={4}
            opacity={1 - merge}
            style={{ filter: 'drop-shadow(0 0 8px #22d3ee)' }}
          />
          <defs>
            <linearGradient id="bridge-grad">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
        </svg>
        <Card
          tone="cyan"
          className="merged"
          style={{ top: 370, ...enter(t, BRIDGE.merge + 0.4, { scale: 0.5, y: 0 }) }}
        >
          <span className="hl-gradient merged-title">{spec.merged}</span>
        </Card>
        <div className="title-block" style={{ top: 600 }}>
          <div className="subtitle" style={enter(t, BRIDGE.caption)}>
            {spec.caption}
          </div>
        </div>
      </div>
      {t >= BRIDGE.partB
        ? spec.summaries.map((sum, i) => (
            <Card
              key={i}
              tone={sum.tone}
              className="summary"
              style={{ top: 230 + i * 260, ...enter(t, BRIDGE.sum + i * BRIDGE.sumGap, { y: 50 }) }}
            >
              <div className="summary-text">
                <div className="muted">{sum.question}</div>
                <div className="summary-answer" style={{ color: TONE[sum.tone].solid }}>
                  {sum.answer}
                </div>
              </div>
              <div className="summary-icons">
                {sum.icons.map((icon, k) => (
                  <span
                    key={k}
                    style={enter(t, BRIDGE.sum + i * BRIDGE.sumGap + 0.3 + k * 0.15, { y: 12 })}
                  >
                    <Badge icon={icon} tone={sum.tone} size={40} />
                  </span>
                ))}
              </div>
            </Card>
          ))
        : null}
    </div>
  )
}

export const bridgeCues = (): Cue[] => [
  { at: BRIDGE.line, kind: 'whoosh' },
  { at: BRIDGE.merge + 0.4, kind: 'sync' },
  { at: BRIDGE.partB, kind: 'whoosh' },
  { at: BRIDGE.sum, kind: 'tick' },
  { at: BRIDGE.sum + BRIDGE.sumGap, kind: 'chime' },
]
