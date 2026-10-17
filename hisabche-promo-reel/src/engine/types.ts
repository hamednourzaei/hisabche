import type { SoundKind } from './sound'
import type { SentencePlan } from './speech-model'

export type { SentencePlan, WordCue, SentenceEnding } from './speech-model'

export type Tone = 'cyan' | 'purple' | 'red' | 'green'

export type ThemeName =
  | 'dark-neon'
  | 'light-editorial'
  | 'midnight-gold'
  | 'cyber-emerald'
  | 'obsidian-cinematic'
  | 'cinematic-obsidian'
  | 'swiss-editorial'
  | 'alabaster-daylight'
  | 'kinetic-manifesto'
  | 'procedural-spatial'
  | 'financial-intelligence'

/** A card with an icon: icons are named, see `icons.tsx`. */
export interface IconCard {
  icon: string
  title: string
  sub?: string
  tone?: Tone
}

export type Mark = 'yes' | 'no' | 'part'

export type OpeningArchetype =
  | 'immediate-consequence'
  | 'uncomfortable-discovery'
  | 'customer-confrontation'
  | 'visual-pattern-interrupt'
  | 'quiet-dread'
  | 'deadline-pressure'

/**
 * One scene of a reel. `start`/`end` are seconds on the reel's clock; the
 * scene's component receives its own local time (0 at `start`).
 */
export type SceneSpec =
  | {
      kind: 'hook'
      theme?: ThemeName
      openingArchetype?: OpeningArchetype
      label?: string
      lines: string[]
      cards?: IconCard[]
      consequence?: {
        alertBanner: string
        stoppedAction: string
        lossMetric?: string
      }
      discovery?: {
        surfaceMetric: { label: string; value: string }
        hiddenReality: { label: string; value: string }
        discrepancyNote: string
      }
      confrontation?: {
        speaker: string
        dialogue: string
        fadedEvidence: string
      }
      interrupt?: {
        colossalHeadline: string
        subHeadline?: string
        shatteredTool: string
      }
      quietDread?: {
        isolatedFact: string
        unsettlingDetail: string
        heartbeatBpm?: number
      }
      deadline?: {
        targetTime: string
        countdownLabel: string
        unresolvedGap: string
      }
    }
  | {
      kind: 'branch'
      theme?: ThemeName
      cards: [IconCard, IconCard]
      question: string
      answer: string
      badge: string
    }
  | {
      kind: 'stagger'
      theme?: ThemeName
      title: string
      header: [string, string]
      rows: { icon: string; text: string }[]
      interval?: number
      tone?: Tone
    }
  | {
      kind: 'hub'
      theme?: ThemeName
      title: string
      core: string
      coreSub: string
      nodes: { icon: string; label: string }[]
    }
  | {
      kind: 'compare'
      theme?: ThemeName
      title: string
      columns: [string, string, string, string]
      rows: { label: string; marks: [Mark, Mark, Mark] }[]
      interval?: number
    }
  | {
      kind: 'bridge'
      theme?: ThemeName
      title: string
      left: IconCard
      right: IconCard
      merged: string
      caption: string
      summaries: [Summary, Summary]
    }
  | {
      kind: 'cta'
      theme?: ThemeName
      tagline: string
      boxes: [CtaBox, CtaBox]
      /** Seconds (local) the second box takes over. */
      switchAt: number
    }
  | {
      kind: 'pile'
      theme?: ThemeName
      title: string
      papers: { icon: string; label: string }[]
      counter: string
      merge: string
    }
  | {
      kind: 'versus'
      theme?: ThemeName
      title: string
      left: { label: string; value: string; tone: Tone }
      right: { label: string; value: string; tone: Tone }
      verdict: string
    }
  | {
      kind: 'ledger'
      theme?: ThemeName
      title: string
      name: string
      lines: { label: string; amount: string }[]
      balanceFrom: number
      balanceTo: number
      unit: string
      footer: string
    }
  | {
      kind: 'queue'
      theme?: ThemeName
      title: string
      offlineLabel: string
      items: string[]
      syncedLabel: string
      /** Local second the connection comes back. */
      reconnectAt: number
    }
  | {
      kind: 'day'
      theme?: ThemeName
      title: string
      moments: { time: string; icon: string; text: string }[]
      interval?: number
    }
  | {
      kind: 'kinetic'
      theme?: ThemeName
      headline: string
      words: string[]
      sub?: string
      tone?: Tone
    }
  | {
      kind: 'mockup'
      theme?: ThemeName
      device: 'window' | 'phone'
      title: string
      subtitle?: string
      screen: {
        type: 'pos' | 'invoice' | 'dashboard' | 'sync'
        header: string
        items: { name: string; qty?: string; price: string; badge?: string }[]
        totalLabel?: string
        totalValue?: string
      }
      toast?: { icon: string; text: string; time: number }
      cursor?: { x: number; y: number; clickAt: number }
    }
  | {
      kind: 'chart'
      theme?: ThemeName
      title: string
      chartType: 'area' | 'bar'
      kpis: { label: string; value: number; unit: string; trend?: string; tone?: Tone }[]
      data: { label: string; value: number }[]
    }
  | {
      kind: 'split'
      theme?: ThemeName
      title: string
      left: { title: string; subtitle?: string; points: string[]; tone: Tone }
      right: { title: string; subtitle?: string; points: string[]; tone: Tone }
      dividerLabel?: string
    }
  | {
      kind: 'cinematic-product'
      theme?: ThemeName
      title: string
      subtitle?: string
      floatingBadge?: string
      layers: { title: string; desc: string; icon: string; tone?: Tone; z?: number }[]
    }
  | {
      kind: 'kinetic-manifesto'
      theme?: ThemeName
      headline: string[]
      subheadline?: string
      statements: string[]
      accentTone?: Tone
    }
  | {
      kind: 'financial-intelligence'
      theme?: ThemeName
      title: string
      revenue: number
      cogs: number
      grossProfit: number
      verdict: string
    }
  | {
      kind: 'continuous-transform'
      theme?: ThemeName
      title: string
      subtitle?: string
      stages: { at: number; label: string; sub: string }[]
      tone?: Tone
    }
  | {
      kind: 'daylight-editorial'
      theme?: ThemeName
      category: string
      headline: string
      points: { label: string; value: string }[]
      quote?: string
    }
  | {
      kind: 'offline-sync-demo'
      theme?: ThemeName
      title: string
      subtitle?: string
      reconnectAt?: number
      syncCompleteAt?: number
    }
  | {
      kind: 'fragmented-tools-demo'
      theme?: ThemeName
      title: string
      convergeAt?: number
    }
  | {
      kind: 'profit-waterfall-demo'
      theme?: ThemeName
      title: string
      grossRevenue?: number
      cogs?: number
      expenses?: number
    }
  | {
      kind: 'warehouse-movement-demo'
      theme?: ThemeName
      title: string
      transitAt?: number
      arriveAt?: number
    }
  | {
      kind: 'dual-perspective-demo'
      theme?: ThemeName
      title: string
      saleAt?: number
      journalAt?: number
    }
  // 12 Viral Short-Form Template Scene Archetypes
  | {
      kind: 'tactile-train'
      theme?: ThemeName
      title?: string
    }
  | {
      kind: 'thermal-receipt'
      theme?: ThemeName
      title?: string
    }
  | {
      kind: 'infinite-spatial'
      theme?: ThemeName
      title?: string
    }
  | {
      kind: 'vox-documentary'
      theme?: ThemeName
      title?: string
      headline?: string
      documentNumber?: string
      badgeText?: string
      clippingTitle?: string
      clippingText?: string
      dark?: boolean
    }
  | {
      kind: 'minimal-vector'
      theme?: ThemeName
      title?: string
    }
  | {
      kind: 'chat-panic'
      theme?: ThemeName
      title?: string
    }
  | {
      kind: 'liquid-glass'
      theme?: ThemeName
      title?: string
    }
  | {
      kind: 'kinetic-color'
      theme?: ThemeName
    }
  | {
      kind: 'split-stopwatch'
      theme?: ThemeName
      topTitle?: string
      topSub?: string
      topBody?: string
      topFooter?: string
      bottomTitle?: string
      bottomSub?: string
      bottomBody?: string
      bottomFooter?: string
      finishAt?: number
    }
  | {
      kind: 'isometric-exploded'
      theme?: ThemeName
      title?: string
    }
  | {
      kind: 'continuous-line'
      theme?: ThemeName
      title?: string
    }
  | {
      kind: 'swiss-terminal'
      theme?: ThemeName
      title?: string
    }
  | {
      kind: 'premium-motion'
      theme?: ThemeName
      title?: string
      subtitle?: string
      kicker?: string
      statValue?: string
      statLabel?: string
      contrastValue?: string
      contrastLabel?: string
      badge?: string
    }
  | {
      kind: 'bespoke'
      theme?: ThemeName
      component: React.ComponentType<{ t: number; scene: Scene }>
      cues?: Cue[]
    }
  | {
      kind: 'word-sync'
      theme?: ThemeName
      title?: string
      sentencePlan?: SentencePlan
      actor?:
        | 'hook-sales'
        | 'broken-chart'
        | 'leak-cards'
        | 'unified-dashboard'
        | 'cta-finish'
        | 'cheque-countdown'
        | 'capital-trap'
        | 'overdue-cards'
        | 'sms-settlement'
        | 'cta-conversion-54'
        | (string & {})
      component?: React.ComponentType<{ t: number; scene: Scene }>
      cues?: Cue[]
    }

export interface Summary {
  question: string
  answer: string
  tone: Tone
  icons: string[]
}

export interface CtaBox {
  lead: string
  action: string
  word: string
  tone: Tone
}

export interface Scene {
  start: number
  end: number
  spec: SceneSpec
  /** What the voice says during this scene (teleprompter). */
  vo: string
  /** Word-synchronized speech timing, visual actions, and acoustic events. */
  sentence?: SentencePlan
}

export interface SaaSStoryMatrix {
  targetCustomer:
    'retail-shopkeeper' | 'wholesaler' | 'workshop-producer' | 'services' | 'accountant'
  customerPain: string
  oldWorkflow: string
  friction: string
  hisabcheAction: string
  automatedResult: string
  businessOutcome: string
  emotionalPayoff: string
  cta: string
  selectedOperators: string[]
}

export type MusicMood = 'calm' | 'tense' | 'uplifting'

export interface Reel {
  id: string
  title: string
  duration: number
  scenes: Scene[]
  theme?: ThemeName
  storyMatrix?: SaaSStoryMatrix
  musicMood?: MusicMood
}

export interface Cue {
  at: number
  kind: SoundKind
}

export interface SceneProps {
  frame: number
  fps: number
  isActive: boolean
}

export interface RenderEngineConfig {
  width: number
  height: number
  fps: number
  durationInFrames: number
}

export interface ReelRegistryItem {
  id: string
  title: string
  durationSeconds: number
  component?: React.ComponentType<SceneProps>
}
