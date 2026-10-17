import type { Cue, Reel, Scene } from '../engine/types'
import {
  CinematicProductScene,
  ContinuousTransformScene,
  DaylightEditorialScene,
  FinancialIntelligenceScene,
  KineticManifestoScene,
  cinematicProductCues,
  continuousTransformCues,
  daylightEditorialCues,
  financialIntelligenceCues,
  kineticManifestoCues,
} from './creative'
import {
  DualPerspectiveDemoScene,
  FragmentedToolsDemoScene,
  OfflineSyncDemoScene,
  ProfitWaterfallDemoScene,
  WarehouseMovementDemoScene,
  dualPerspectiveDemoCues,
  fragmentedToolsDemoCues,
  offlineSyncDemoCues,
  profitWaterfallDemoCues,
  warehouseMovementDemoCues,
} from './customer'
import { Branch, Hook, Stagger, branchCues, hookCues, staggerCues } from './intro'
import {
  ChartScene,
  KineticScene,
  MockupScene,
  SplitScene,
  chartCues,
  kineticCues,
  mockupCues,
  splitCues,
} from './modern'
import {
  Cta,
  Day,
  Ledger,
  Pile,
  Queue,
  Versus,
  ctaCues,
  dayCues,
  ledgerCues,
  pileCues,
  queueCues,
  versusCues,
} from './story'
import { Bridge, Compare, Hub, bridgeCues, compareCues, hubCues } from './system'
import {
  TactileTrainScrollTemplate,
  ThermalReceiptPrinterTemplate,
  InfiniteSpatialBoardTemplate,
  VoxDocumentaryCollageTemplate,
  MinimalVectorPhilosophyTemplate,
  ChatPanicToCalmTemplate,
  LiquidGlassSpatialTemplate,
  KineticColorBlockTemplate,
  SplitScreenStopwatchTemplate,
  IsometricExplodedUiTemplate,
  ContinuousLineTravelerTemplate,
  SwissFinancialTerminalTemplate,
  PremiumMotionGraphicsTemplate,
} from '../templates'
import { WordDrivenStage } from '../components/WordDrivenStage'

/** The scene at its own local time. */
export function SceneView({ scene, t }: { scene: Scene; t: number }) {
  const spec = scene.spec
  switch (spec.kind) {
    case 'hook':
      return <Hook spec={spec} t={t} />
    case 'branch':
      return <Branch spec={spec} t={t} />
    case 'stagger':
      return <Stagger spec={spec} t={t} />
    case 'hub':
      return <Hub spec={spec} t={t} />
    case 'compare':
      return <Compare spec={spec} t={t} />
    case 'bridge':
      return <Bridge spec={spec} t={t} />
    case 'cta':
      return <Cta spec={spec} t={t} />
    case 'pile':
      return <Pile spec={spec} t={t} />
    case 'versus':
      return <Versus spec={spec} t={t} />
    case 'ledger':
      return <Ledger spec={spec} t={t} />
    case 'queue':
      return <Queue spec={spec} t={t} />
    case 'day':
      return <Day spec={spec} t={t} />
    case 'kinetic':
      return <KineticScene spec={spec} t={t} />
    case 'mockup':
      return <MockupScene spec={spec} t={t} />
    case 'chart':
      return <ChartScene spec={spec} t={t} />
    case 'split':
      return <SplitScene spec={spec} t={t} />
    case 'cinematic-product':
      return <CinematicProductScene spec={spec} t={t} />
    case 'kinetic-manifesto':
      return <KineticManifestoScene spec={spec} t={t} />
    case 'financial-intelligence':
      return <FinancialIntelligenceScene spec={spec} t={t} />
    case 'continuous-transform':
      return <ContinuousTransformScene spec={spec} t={t} />
    case 'daylight-editorial':
      return <DaylightEditorialScene spec={spec} t={t} />
    case 'offline-sync-demo':
      return <OfflineSyncDemoScene spec={spec} t={t} />
    case 'fragmented-tools-demo':
      return <FragmentedToolsDemoScene spec={spec} t={t} />
    case 'profit-waterfall-demo':
      return <ProfitWaterfallDemoScene spec={spec} t={t} />
    case 'warehouse-movement-demo':
      return <WarehouseMovementDemoScene spec={spec} t={t} />
    case 'dual-perspective-demo':
      return <DualPerspectiveDemoScene spec={spec} t={t} />
    case 'tactile-train':
      return <TactileTrainScrollTemplate t={t} totalDur={scene.end - scene.start} />
    case 'thermal-receipt':
      return <ThermalReceiptPrinterTemplate t={t} title={spec.title} />
    case 'infinite-spatial':
      return <InfiniteSpatialBoardTemplate t={t} title={spec.title} />
    case 'vox-documentary':
      return (
        <VoxDocumentaryCollageTemplate
          t={t}
          title={spec.title}
          headline={spec.headline}
          documentNumber={spec.documentNumber}
          badgeText={spec.badgeText}
          clippingTitle={spec.clippingTitle}
          clippingText={spec.clippingText}
          dark={spec.dark}
        />
      )
    case 'minimal-vector':
      return <MinimalVectorPhilosophyTemplate t={t} title={spec.title} />
    case 'chat-panic':
      return <ChatPanicToCalmTemplate t={t} title={spec.title} />
    case 'liquid-glass':
      return <LiquidGlassSpatialTemplate t={t} title={spec.title} />
    case 'kinetic-color':
      return <KineticColorBlockTemplate t={t} />
    case 'split-stopwatch':
      return (
        <SplitScreenStopwatchTemplate
          t={t}
          topTitle={spec.topTitle}
          topSub={spec.topSub}
          topBody={spec.topBody}
          topFooter={spec.topFooter}
          bottomTitle={spec.bottomTitle}
          bottomSub={spec.bottomSub}
          bottomBody={spec.bottomBody}
          bottomFooter={spec.bottomFooter}
          finishAt={spec.finishAt}
        />
      )
    case 'isometric-exploded':
      return <IsometricExplodedUiTemplate t={t} title={spec.title} />
    case 'continuous-line':
      return <ContinuousLineTravelerTemplate t={t} title={spec.title} />
    case 'swiss-terminal':
      return <SwissFinancialTerminalTemplate t={t} title={spec.title} />
    case 'premium-motion':
      return (
        <PremiumMotionGraphicsTemplate
          t={t}
          title={spec.title}
          subtitle={spec.subtitle}
          kicker={spec.kicker}
          statValue={spec.statValue}
          statLabel={spec.statLabel}
          contrastValue={spec.contrastValue}
          contrastLabel={spec.contrastLabel}
          badge={spec.badge}
        />
      )
    case 'bespoke': {
      const CustomComponent = spec.component
      return <CustomComponent t={t} scene={scene} />
    }
    case 'word-sync': {
      if (spec.component) {
        const CustomComponent = spec.component
        return <CustomComponent t={t} scene={scene} />
      }
      return <WordDrivenStage t={t} scene={scene} />
    }
  }
}

function sceneCues(scene: Scene): Cue[] {
  const spec = scene.spec
  const baseCues: Cue[] = (() => {
    switch (spec.kind) {
      case 'hook':
        return hookCues(spec)
      case 'branch':
        return branchCues()
      case 'stagger':
        return staggerCues(spec)
      case 'hub':
        return hubCues(spec)
      case 'compare':
        return compareCues(spec)
      case 'bridge':
        return bridgeCues()
      case 'cta':
        return ctaCues(spec)
      case 'pile':
        return pileCues(spec)
      case 'versus':
        return versusCues(spec)
      case 'ledger':
        return ledgerCues(spec)
      case 'queue':
        return queueCues(spec)
      case 'day':
        return dayCues(spec)
      case 'kinetic':
        return kineticCues(spec)
      case 'mockup':
        return mockupCues(spec)
      case 'chart':
        return chartCues(spec)
      case 'split':
        return splitCues(spec)
      case 'cinematic-product':
        return cinematicProductCues(spec)
      case 'kinetic-manifesto':
        return kineticManifestoCues(spec)
      case 'financial-intelligence':
        return financialIntelligenceCues()
      case 'continuous-transform':
        return continuousTransformCues(spec)
      case 'daylight-editorial':
        return daylightEditorialCues()
      case 'offline-sync-demo':
        return offlineSyncDemoCues(spec)
      case 'fragmented-tools-demo':
        return fragmentedToolsDemoCues(spec)
      case 'profit-waterfall-demo':
        return profitWaterfallDemoCues()
      case 'warehouse-movement-demo':
        return warehouseMovementDemoCues(spec)
      case 'dual-perspective-demo':
        return dualPerspectiveDemoCues(spec)
      case 'tactile-train':
        return [
          { at: 0.2, kind: 'cameraSwish' },
          { at: 0.8, kind: 'markerScribble' },
          { at: 1.4, kind: 'paperTear' },
          { at: 2.2, kind: 'cameraSwish' },
          { at: 3.5, kind: 'clockTickRapid' },
        ]
      case 'thermal-receipt':
        return [
          { at: 0.2, kind: 'receiptPrint' },
          { at: 1.2, kind: 'receiptPrint' },
          { at: 2.8, kind: 'alert' },
          { at: 3.6, kind: 'cash' },
        ]
      case 'infinite-spatial':
        return [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.2, kind: 'dataFlow' },
          { at: 2.6, kind: 'sync' },
          { at: 4.0, kind: 'precisionSequence' },
        ]
      case 'vox-documentary':
        return [
          { at: 0.2, kind: 'paperRustle' },
          { at: 0.8, kind: 'markerScribble' },
          { at: 1.4, kind: 'impact' },
        ]
      case 'minimal-vector':
        return [
          { at: 0.4, kind: 'tick' },
          { at: 1.8, kind: 'softTransition' },
          { at: 3.0, kind: 'chime' },
        ]
      case 'chat-panic':
        return [
          { at: 0.2, kind: 'chatPop' },
          { at: 0.8, kind: 'chatPop' },
          { at: 1.4, kind: 'alert' },
          { at: 2.6, kind: 'whoosh' },
          { at: 3.2, kind: 'successResolution' },
        ]
      case 'liquid-glass':
        return [
          { at: 0.3, kind: 'cinematicReveal' },
          { at: 1.5, kind: 'bigReveal' },
          { at: 3.0, kind: 'chime' },
        ]
      case 'kinetic-color':
        return [
          { at: 0.1, kind: 'titleHit' },
          { at: 1.8, kind: 'impact' },
          { at: 3.6, kind: 'sync' },
        ]
      case 'split-stopwatch':
        return [
          { at: 0.2, kind: 'clockTickRapid' },
          { at: 1.5, kind: 'alert' },
          { at: 3.0, kind: 'cash' },
        ]
      case 'isometric-exploded':
        return [
          { at: 0.4, kind: 'whoosh' },
          { at: 1.2, kind: 'dataFlow' },
          { at: 2.2, kind: 'precisionSequence' },
        ]
      case 'continuous-line':
        return [
          { at: 0.3, kind: 'whoosh' },
          { at: 1.8, kind: 'sync' },
          { at: 3.2, kind: 'ctaResolution' },
        ]
      case 'swiss-terminal':
        return [
          { at: 0.4, kind: 'tick' },
          { at: 1.2, kind: 'precisionSequence' },
          { at: 1.8, kind: 'financialMilestone' },
        ]
      case 'premium-motion':
        return [
          { at: 0.1, kind: 'titleHit' },
          { at: 0.5, kind: 'whoosh' },
          { at: 1.2, kind: 'impact' },
          { at: 2.4, kind: 'precisionSequence' },
          { at: 3.2, kind: 'chime' },
        ]
      case 'bespoke':
        return spec.cues ?? []
      case 'word-sync':
        return spec.cues ?? []
    }
  })()

  // Collect word-level and sentence-ending acoustic cues if defined
  const speechCues: Cue[] = []
  const plan = scene.sentence ?? (spec.kind === 'word-sync' ? spec.sentencePlan : undefined)
  if (plan) {
    for (const w of plan.words) {
      if (w.sound) speechCues.push({ at: w.start, kind: w.sound })
    }
    if (plan.sentenceEnding?.sound) {
      speechCues.push({ at: plan.sentenceEnding.at, kind: plan.sentenceEnding.sound })
    }
  }

  return [...baseCues, ...speechCues].sort((a, b) => a.at - b.at)
}

/** Every sound of a reel, on the reel's clock, in order. A cue past its scene's end is dropped. */
export function reelCues(reel: Reel): Cue[] {
  return reel.scenes
    .flatMap((scene) =>
      sceneCues(scene)
        .map((cue) => ({ ...cue, at: scene.start + cue.at }))
        .filter((cue) => cue.at < scene.end),
    )
    .sort((a, b) => a.at - b.at)
}
