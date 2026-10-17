// ============================================
// Hisabche Motion Design Studio — High-Level Creative Scenes
// Flagship Scene implementations demonstrating:
// 1. Cinematic 3D Product (Obsidian)
// 2. Kinetic Typography Manifesto
// 3. Living Financial Intelligence Flow
// 4. Continuous Morphing Object Transformation
// 5. Swiss Daylight Editorial Showcase
// ============================================

import { clamp, ease, enter, mix, progress, spring } from '../engine/anim'
import type { Cue, SceneSpec } from '../engine/types'
import { TONE } from '../ui/card'
import {
  ContinuousMorphShape,
  DaylightEditorialCanvas,
  FinancialIntelligenceFlow,
  GeometricBlueprint,
  KineticMaskHeadline,
  ParallaxLayer,
  PerspectiveStage,
  ProceduralNetwork,
} from '../ui/creative-primitives'
import { Icon } from '../ui/icons'
import { Rich } from '../ui/rich'

type Spec<K extends SceneSpec['kind']> = Extract<SceneSpec, { kind: K }>

// ─── 1. Cinematic 3D Product Scene ───────────────────────────────────────

export function CinematicProductScene({ spec, t }: { spec: Spec<'cinematic-product'>; t: number }) {
  return (
    <div className="scene cinematic-scene">
      {/* Dynamic Background Grid and Ambient Light */}
      <GeometricBlueprint t={t} accentColor="#22d3ee" />

      {/* Title with Mask Reveal */}
      <div className="title-block" style={{ top: 75, insetInline: 24, zIndex: 20 }}>
        <div className="title xl" style={enter(t, 0.1, { y: -20 })}>
          <Rich text={spec.title} />
        </div>
        {spec.subtitle && (
          <div className="subtitle" style={enter(t, 0.35, { y: -10 })}>
            {spec.subtitle}
          </div>
        )}
      </div>

      {/* 3D Perspective Stage */}
      <PerspectiveStage
        t={t}
        camera={{ rx: 16, ry: -14, z: -80 }}
        target={{ rx: 4, ry: 0, z: 20 }}
        dur={9}
        style={{ position: 'absolute', top: 220, insetInline: 20, height: 600 }}
      >
        {/* Floating Structural Layer Behind */}
        <ParallaxLayer z={-120} opacity={0.4}>
          <div className="cinematic-backdrop-ring" />
        </ParallaxLayer>

        {/* 3D Dimensional Staggered Layers */}
        {spec.layers.map((layer, idx) => {
          const at = 0.8 + idx * 0.45
          const s = spring(t - at)
          const p = progress(t, at, 0.4)
          const zDepth = (layer.z ?? 0) + (idx - 1) * 60
          const tone = layer.tone ?? 'cyan'
          const c = TONE[tone]

          return (
            <ParallaxLayer
              key={idx}
              z={zDepth * s}
              style={{
                top: 80 + idx * 140,
                insetInline: 20,
                opacity: clamp(p),
                transform: `translateZ(${zDepth * s}px) translateY(${(1 - s) * 40}px)`,
              }}
            >
              <div
                className="cinematic-sculptural-plate"
                style={{
                  borderColor: `${c.solid}66`,
                  boxShadow: `0 14px 40px rgba(0,0,0,0.7), 0 0 25px ${c.glow}`,
                }}
              >
                <div className="plate-icon" style={{ color: c.solid }}>
                  <Icon name={layer.icon} size={28} />
                </div>
                <div className="plate-info">
                  <div className="plate-title" style={{ color: '#fff' }}>
                    {layer.title}
                  </div>
                  <div className="plate-desc">{layer.desc}</div>
                </div>
              </div>
            </ParallaxLayer>
          )
        })}
      </PerspectiveStage>

      {/* Floating Verification Badge */}
      {spec.floatingBadge && (
        <div
          className="cinematic-floating-badge"
          style={{ top: 820, insetInline: 40, ...enter(t, 2.2, { scale: 0.6, y: 30 }) }}
        >
          <Icon name="shield" size={20} />
          <span>{spec.floatingBadge}</span>
        </div>
      )}
    </div>
  )
}

export const cinematicProductCues = (spec: Spec<'cinematic-product'>): Cue[] => [
  { at: 0.2, kind: 'whoosh' },
  { at: 0.8, kind: 'impact' },
  ...spec.layers.map((_, i) => ({ at: 0.8 + i * 0.45, kind: 'tick' as const })),
  { at: 2.2, kind: 'success' },
]

// ─── 2. Kinetic Typography Manifesto ──────────────────────────────────────

export function KineticManifestoScene({ spec, t }: { spec: Spec<'kinetic-manifesto'>; t: number }) {
  const accent = spec.accentTone ?? 'cyan'
  const c = TONE[accent]

  return (
    <div className="scene kinetic-manifesto-scene">
      {/* Background Animated Vector Network */}
      <ProceduralNetwork t={t} nodeCount={14} tone={accent} />

      {/* Giant Foreground Kinetic Headline */}
      <div className="manifesto-header-wrap" style={{ top: 80, insetInline: 24 }}>
        <KineticMaskHeadline
          lines={spec.headline}
          t={t}
          startAt={0.2}
          interval={0.4}
          direction="up"
        />
        {spec.subheadline && (
          <div
            className="manifesto-subheadline"
            style={{ ...enter(t, 0.2 + spec.headline.length * 0.4, { y: 15 }), color: c.solid }}
          >
            {spec.subheadline}
          </div>
        )}
      </div>

      {/* Rhythmic Statement Blocks */}
      <div className="manifesto-statements-wrap" style={{ top: 380, insetInline: 24 }}>
        {spec.statements.map((stmt, i) => {
          const at = 1.4 + i * 0.55
          const s = spring(t - at)
          const p = progress(t, at, 0.3)
          return (
            <div
              key={i}
              className="manifesto-statement-row"
              style={{
                opacity: clamp(p),
                transform: `translateX(${(1 - s) * -30}px) scale(${mix(0.9, 1, s)})`,
              }}
            >
              <span className="statement-number" style={{ color: c.solid }}>
                0{i + 1}
              </span>
              <span className="statement-text">
                <Rich text={stmt} />
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const kineticManifestoCues = (spec: Spec<'kinetic-manifesto'>): Cue[] => [
  { at: 0.2, kind: 'whoosh' },
  ...spec.headline.map((_, i) => ({ at: 0.2 + i * 0.4, kind: 'pop' as const })),
  ...spec.statements.map((_, i) => ({ at: 1.4 + i * 0.55, kind: 'tick' as const })),
  { at: 1.4 + spec.statements.length * 0.55 + 0.2, kind: 'impact' },
]

// ─── 3. Living Financial Intelligence Flow ────────────────────────────────

export function FinancialIntelligenceScene({
  spec,
  t,
}: {
  spec: Spec<'financial-intelligence'>
  t: number
}) {
  return (
    <div className="scene financial-intelligence-scene">
      {/* Background Precision Grid */}
      <GeometricBlueprint t={t} accentColor="#4ade80" />

      {/* Title */}
      <div className="title-block" style={{ top: 80, insetInline: 24 }}>
        <div className="title" style={enter(t, 0.1, { y: -15 })}>
          <Rich text={spec.title} />
        </div>
      </div>

      {/* Living Flow Graphic */}
      <div style={{ position: 'absolute', top: 200, insetInline: 20 }}>
        <FinancialIntelligenceFlow
          revenue={spec.revenue}
          cogs={spec.cogs}
          grossProfit={spec.grossProfit}
          t={t}
        />
      </div>

      {/* Bottom Business Insight Verdict */}
      <div
        className="financial-verdict-box"
        style={{
          position: 'absolute',
          top: 690,
          insetInline: 24,
          ...enter(t, 2.5, { y: 25, scale: 0.94 }),
        }}
      >
        <Icon name="trend" size={24} />
        <span className="verdict-text">
          <Rich text={spec.verdict} />
        </span>
      </div>
    </div>
  )
}

export const financialIntelligenceCues = (): Cue[] => [
  { at: 0.2, kind: 'whoosh' },
  { at: 0.5, kind: 'sync' },
  { at: 1.4, kind: 'tick' },
  { at: 2.2, kind: 'cash' },
  { at: 2.7, kind: 'success' },
]

// ─── 4. Continuous Morph Shape Transformation ────────────────────────────

export function ContinuousTransformScene({
  spec,
  t,
}: {
  spec: Spec<'continuous-transform'>
  t: number
}) {
  const tone = spec.tone ?? 'cyan'

  return (
    <div className="scene continuous-transform-scene">
      {/* Title Header */}
      <div className="title-block" style={{ top: 75, insetInline: 24 }}>
        <div className="title" style={enter(t, 0.1, { y: -15 })}>
          <Rich text={spec.title} />
        </div>
        {spec.subtitle && (
          <div className="subtitle" style={enter(t, 0.35)}>
            {spec.subtitle}
          </div>
        )}
      </div>

      {/* Centerpiece Continuous Morphing Geometry */}
      <div
        style={{
          position: 'absolute',
          top: 220,
          insetInline: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <ContinuousMorphShape t={t} size={300} tone={tone} />
      </div>

      {/* Synchronized Stage Indicators */}
      <div className="transform-stages-list" style={{ top: 580, insetInline: 24 }}>
        {spec.stages.map((stg, i) => {
          const isActive =
            t >= stg.at && (i === spec.stages.length - 1 || t < spec.stages[i + 1]!.at)
          const p = ease(progress(t, stg.at, 0.4))
          return (
            <div
              key={i}
              className={`transform-stage-item ${isActive ? 'active' : ''}`}
              style={{
                opacity: clamp(p * (isActive ? 1 : 0.45)),
                transform: `translateX(${mix(20, 0, p)}px)`,
              }}
            >
              <div className="stage-dot" />
              <div className="stage-content">
                <div className="stage-label">{stg.label}</div>
                <div className="stage-sub">{stg.sub}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const continuousTransformCues = (spec: Spec<'continuous-transform'>): Cue[] => [
  { at: 0.2, kind: 'whoosh' },
  ...spec.stages.map((s) => ({ at: s.at, kind: 'scan' as const })),
  { at: spec.stages[spec.stages.length - 1]?.at ?? 12, kind: 'chime' },
]

// ─── 5. Swiss Daylight Editorial Showcase ─────────────────────────────────

export function DaylightEditorialScene({
  spec,
  t,
}: {
  spec: Spec<'daylight-editorial'>
  t: number
}) {
  return (
    <div className="scene daylight-scene">
      <div style={{ position: 'absolute', top: 60, insetInline: 20 }}>
        <DaylightEditorialCanvas
          headline={spec.headline}
          category={spec.category}
          points={spec.points}
          t={t}
        />
      </div>

      {spec.quote && (
        <div
          className="daylight-editorial-quote"
          style={{ top: 760, insetInline: 30, ...enter(t, 2.2, { y: 20 }) }}
        >
          «{spec.quote}»
        </div>
      )}
    </div>
  )
}

export const daylightEditorialCues = (): Cue[] => [
  { at: 0.2, kind: 'whoosh' },
  { at: 0.8, kind: 'tick' },
  { at: 1.4, kind: 'tick' },
  { at: 2.2, kind: 'success' },
]
