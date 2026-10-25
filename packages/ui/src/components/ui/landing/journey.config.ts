// packages/ui/src/components/ui/landing/journey.config.ts
//
// SINGLE SOURCE OF TRUTH for the 3D Landing Page Journey (v2 Spec).
//
// Governs:
//   1. 7 narrative beats (Beat 0: Printer, Beats 1-5: Stations, Beat 6: The Core Burst).
//   2. Timing & phase boundaries along scroll progress p in [0, 1].
//   3. Camera authored shots, viewport framing limits, and occlusion margins.
//   4. Analytics taxonomy events and schemas.
//   5. Device quality tiers (S, A, B, C, D) and performance budgets.

import { JOURNEY_INDUSTRIES, type IndustrySign } from './journey/journey-industries'

export { JOURNEY_INDUSTRIES, type IndustrySign }

/* ═══════════════════════════════════════════════════════════════════════════
   1. Beats & Stations
   ═══════════════════════════════════════════════════════════════════════════ */

export const JOURNEY_BEAT_IDS = [
  'beat-0',
  'beat-1',
  'beat-2',
  'beat-3',
  'beat-4',
  'beat-5',
  'beat-6',
] as const

export type JourneyBeatId = (typeof JOURNEY_BEAT_IDS)[number]

/** Exactly 7 narrative beats per v2 spec Section 2. */
export const JOURNEY_BEAT_COUNT = 7

/** The 5 operational stations a sale passes through, in order. */
export const JOURNEY_STATIONS = ['pay', 'cash', 'stock', 'post', 'report'] as const
export type JourneyStationId = (typeof JOURNEY_STATIONS)[number]

/** Height of one narrative beat in dynamic viewport units (dvh). */
export const BEAT_HEIGHT_DVH = 150

export interface BeatDefinition {
  beat: number
  id: JourneyBeatId
  type: 'hero' | 'station' | 'core'
  stationId: JourneyStationId | null
  titleKey: string
  descKey: string
}

export const JOURNEY_BEATS: readonly BeatDefinition[] = [
  {
    beat: 0,
    id: 'beat-0',
    type: 'hero',
    stationId: null,
    titleKey: 'landing.headline',
    descKey: 'landing.journey.printing',
  },
  {
    beat: 1,
    id: 'beat-1',
    type: 'station',
    stationId: 'pay',
    titleKey: 'landing.system.step.pay.title',
    descKey: 'landing.system.step.pay.desc',
  },
  {
    beat: 2,
    id: 'beat-2',
    type: 'station',
    stationId: 'cash',
    titleKey: 'landing.system.step.cash.title',
    descKey: 'landing.system.step.cash.desc',
  },
  {
    beat: 3,
    id: 'beat-3',
    type: 'station',
    stationId: 'stock',
    titleKey: 'landing.system.step.stock.title',
    descKey: 'landing.system.step.stock.desc',
  },
  {
    beat: 4,
    id: 'beat-4',
    type: 'station',
    stationId: 'post',
    titleKey: 'landing.system.step.post.title',
    descKey: 'landing.system.step.post.desc',
  },
  {
    beat: 5,
    id: 'beat-5',
    type: 'station',
    stationId: 'report',
    titleKey: 'landing.system.step.report.title',
    descKey: 'landing.system.step.report.desc',
  },
  {
    beat: 6,
    id: 'beat-6',
    type: 'core',
    stationId: null,
    titleKey: 'landing.journey.ready',
    descKey: 'landing.journey.readySub',
  },
] as const

/* ═══════════════════════════════════════════════════════════════════════════
   2. Phase Thresholds (Pure Functions of Beat Progress)
   ═══════════════════════════════════════════════════════════════════════════ */

export const GATE_AT = 0.22
export const ARRIVE_AT = 0.46
export const ENTER_AT = 0.5
export const RECORDED_AT = 0.68
export const LEAVE_AT = 0.8

/** In the finale beat: the core bursts, and once it has, the invitation appears. */
export const BURST_AT = 0.42
export const FINALE_AT = 0.8

/** On the way to this station the connection drops into offline mode. */
export const OFFLINE_ON_THE_WAY_TO: JourneyStationId = 'stock'
export const OFFLINE_AT = 0.04

export type JourneyPhase =
  'approaching' | 'gate-opening' | 'arrived' | 'handoff' | 'speaking' | 'leaving'

export type LinkState = 'online' | 'offline' | 'restoring'
export type GateState = 'closed' | 'open' | 'passed'
export type ZoneState = 'visited' | 'current' | 'upcoming'

/* ═══════════════════════════════════════════════════════════════════════════
   3. Camera Choreography & Authored Shots
   ═══════════════════════════════════════════════════════════════════════════ */

export type ShotMove = 'craneDown' | 'trackSide' | 'lowPush' | 'arc' | 'pullBackReveal'

export interface Shot {
  move: ShotMove
  /** Degrees toward the road side of the station (negative: from the wall side). */
  yaw: number
  /** Degrees above the subject; eye level stays small. */
  pitch: number
  /** Distance in meters before framing calculation. */
  distance: number
}

export const OPENING_SHOT: Shot = { move: 'craneDown', yaw: 10, pitch: 6, distance: 9 }

export const STATION_SHOTS: Record<JourneyStationId, Shot> = {
  pay: { move: 'trackSide', yaw: 34, pitch: 3, distance: 9.5 },
  cash: { move: 'lowPush', yaw: 18, pitch: -3, distance: 9 },
  stock: { move: 'arc', yaw: 30, pitch: 2, distance: 10 },
  post: { move: 'craneDown', yaw: 26, pitch: 4, distance: 9.5 },
  report: { move: 'pullBackReveal', yaw: 12, pitch: 0, distance: 9.5 },
}

export const CORE_SHOT: Shot = { move: 'pullBackReveal', yaw: 0, pitch: -0.4, distance: 11.5 }

export const PORTRAIT_YAW_LIMIT = 15
export const CRANE_FROM = 15

/* ═══════════════════════════════════════════════════════════════════════════
   4. Quality Tiers & Performance Budgets
   ═══════════════════════════════════════════════════════════════════════════ */

export type QualityTier = 'S' | 'A' | 'B' | 'C' | 'D'

export interface QualityTierConfig {
  tier: QualityTier
  targetFps: number
  maxPixelRatio: number
  shadows: boolean
  softShadows: boolean
  pmrem: boolean
  antialias: boolean
  maxSparks: number
  cullStationRange: number
}

export const QUALITY_TIER_CONFIGS: Record<QualityTier, QualityTierConfig> = {
  S: {
    tier: 'S',
    targetFps: 60,
    maxPixelRatio: 2.0,
    shadows: true,
    softShadows: true,
    pmrem: true,
    antialias: true,
    maxSparks: 420,
    cullStationRange: 1,
  },
  A: {
    tier: 'A',
    targetFps: 60,
    maxPixelRatio: 1.75,
    shadows: true,
    softShadows: false,
    pmrem: true,
    antialias: true,
    maxSparks: 300,
    cullStationRange: 1,
  },
  B: {
    tier: 'B',
    targetFps: 60,
    maxPixelRatio: 1.5,
    shadows: false,
    softShadows: false,
    pmrem: false,
    antialias: true,
    maxSparks: 200,
    cullStationRange: 1,
  },
  C: {
    tier: 'C',
    targetFps: 30,
    maxPixelRatio: 1.25,
    shadows: false,
    softShadows: false,
    pmrem: false,
    antialias: false,
    maxSparks: 120,
    cullStationRange: 1,
  },
  D: {
    tier: 'D',
    targetFps: 30,
    maxPixelRatio: 1.0,
    shadows: false,
    softShadows: false,
    pmrem: false,
    antialias: false,
    maxSparks: 0,
    cullStationRange: 0,
  },
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. Analytics Taxonomy
   ═══════════════════════════════════════════════════════════════════════════ */

export const JOURNEY_ANALYTICS_EVENTS = {
  VIEW_HERO: 'journey_view_hero',
  BEAT_REACHED: 'journey_beat_reached',
  OFFLINE_SIM_VIEWED: 'journey_offline_sim_viewed',
  CORE_BURST_COMPLETED: 'journey_core_burst_completed',
  CTA_CLICKED: 'journey_cta_clicked',
  SKIP_CLICKED: 'journey_skip_clicked',
  PERFORMANCE_TIER: 'journey_performance_tier',
} as const

export type JourneyAnalyticsEventName =
  (typeof JOURNEY_ANALYTICS_EVENTS)[keyof typeof JOURNEY_ANALYTICS_EVENTS]

export interface JourneyAnalyticsPayloads {
  [JOURNEY_ANALYTICS_EVENTS.VIEW_HERO]: { locale: string }
  [JOURNEY_ANALYTICS_EVENTS.BEAT_REACHED]: { beat: number; beatId: JourneyBeatId; progress: number }
  [JOURNEY_ANALYTICS_EVENTS.OFFLINE_SIM_VIEWED]: { state: LinkState }
  [JOURNEY_ANALYTICS_EVENTS.CORE_BURST_COMPLETED]: { timeToCompleteMs?: number }
  [JOURNEY_ANALYTICS_EVENTS.CTA_CLICKED]: {
    location: 'hero' | 'header' | 'finale' | 'footer'
    href: string
  }
  [JOURNEY_ANALYTICS_EVENTS.SKIP_CLICKED]: { fromBeat: number }
  [JOURNEY_ANALYTICS_EVENTS.PERFORMANCE_TIER]: {
    tier: QualityTier
    fps: number
    droppedFrames: number
    deviceMemory?: number | undefined
    hardwareConcurrency?: number | undefined
  }
}
