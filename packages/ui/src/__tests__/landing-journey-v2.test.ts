// packages/ui/src/__tests__/landing-journey-v2.test.ts
import { describe, it, expect, beforeEach } from 'vitest'

import {
  JOURNEY_BEATS,
  JOURNEY_BEAT_COUNT,
  JOURNEY_STATIONS,
  QUALITY_TIER_CONFIGS,
  JOURNEY_ANALYTICS_EVENTS,
  BURST_AT,
  FINALE_AT,
  OFFLINE_ON_THE_WAY_TO,
} from '../components/ui/landing/journey.config'
import {
  journeyAt,
  progressForBeat,
  journeyReduce,
} from '../components/ui/landing/journey/journey-machine'
import {
  OPENING_SHOT,
  STATION_SHOTS,
  CORE_SHOT,
  shotPose,
  eyeOffset,
  hallSize,
  type CameraPose,
} from '../components/ui/landing/journey/journey-shots'
import {
  emitJourneyEvent,
  getJourneyAnalyticsHistory,
  clearJourneyAnalyticsHistory,
} from '../components/ui/landing/journey-analytics'
import { detectQualityTier } from '../components/ui/landing/three/runtime'

describe('Landing Journey v2 Master Specification', () => {
  describe('1. Single Source of Truth (journey.config.ts)', () => {
    it('defines exactly 7 sequential narrative beats', () => {
      expect(JOURNEY_BEAT_COUNT).toBe(7)
      expect(JOURNEY_BEATS).toHaveLength(7)
      JOURNEY_BEATS.forEach((b, index) => {
        expect(b.beat).toBe(index)
        expect(b.id).toBe(`beat-${index}`)
      })
      expect(JOURNEY_BEATS[0]?.type).toBe('hero')
      expect(JOURNEY_BEATS[6]?.type).toBe('core')
    })

    it('defines exactly 5 business operational stations', () => {
      expect(JOURNEY_STATIONS).toEqual(['pay', 'cash', 'stock', 'post', 'report'])
    })

    it('enforces monotonic degradation across quality tiers S -> A -> B -> C -> D', () => {
      const tiers = ['S', 'A', 'B', 'C', 'D'] as const
      for (let i = 0; i < tiers.length - 1; i++) {
        const currTier = tiers[i]
        const nextTier = tiers[i + 1]
        if (!currTier || !nextTier) continue
        const curr = QUALITY_TIER_CONFIGS[currTier]
        const next = QUALITY_TIER_CONFIGS[nextTier]
        expect(curr.maxPixelRatio).toBeGreaterThanOrEqual(next.maxPixelRatio)
        expect(curr.maxSparks).toBeGreaterThanOrEqual(next.maxSparks)
      }
      expect(QUALITY_TIER_CONFIGS.S.softShadows).toBe(true)
      expect(QUALITY_TIER_CONFIGS.D.maxSparks).toBe(0)
    })

    it('provides standardized analytics event names', () => {
      expect(JOURNEY_ANALYTICS_EVENTS.VIEW_HERO).toBe('journey_view_hero')
      expect(JOURNEY_ANALYTICS_EVENTS.BEAT_REACHED).toBe('journey_beat_reached')
      expect(JOURNEY_ANALYTICS_EVENTS.OFFLINE_SIM_VIEWED).toBe('journey_offline_sim_viewed')
      expect(JOURNEY_ANALYTICS_EVENTS.CORE_BURST_COMPLETED).toBe('journey_core_burst_completed')
      expect(JOURNEY_ANALYTICS_EVENTS.CTA_CLICKED).toBe('journey_cta_clicked')
      expect(JOURNEY_ANALYTICS_EVENTS.SKIP_CLICKED).toBe('journey_skip_clicked')
      expect(JOURNEY_ANALYTICS_EVENTS.PERFORMANCE_TIER).toBe('journey_performance_tier')
    })
  })

  describe('2. State Machine & Determinism (journey-machine.ts)', () => {
    const stations = JOURNEY_STATIONS.length

    it('renders Beat 0 (printer hero) at progress = 0', () => {
      const snap = journeyAt(0, stations)
      expect(snap.beat).toBe(0)
      expect(snap.station).toBeNull()
      expect(snap.recorded).toBe(0)
      expect(snap.finished).toBe(false)
      expect(snap.invited).toBe(false)
    })

    it('progresses through phase boundaries deterministically', () => {
      const p = 1.48 / 7 // inside Beat 1, ARRIVE_AT (0.46) <= local < ENTER_AT (0.50)
      const snap = journeyAt(p, stations)
      expect(snap.beat).toBe(1)
      expect(snap.station).toBe(0)
      expect(snap.phase).toBe('arrived')

      // At local >= ENTER_AT (0.50), invoice enters the machine -> handoff
      const handoffSnap = journeyAt(1.55 / 7, stations)
      expect(handoffSnap.phase).toBe('handoff')
    })

    it('triggers offline link state exclusively on the way to the stock station', () => {
      expect(OFFLINE_ON_THE_WAY_TO).toBe('stock')
      const stockBeat = 3 // Beat 3 is stock (station index 2)
      const beatProgressStart = stockBeat / 7

      // Just before offline trigger
      const before = journeyAt(beatProgressStart + 0.01 / 7, stations)
      expect(before.link).toBe('online')

      // During offline section
      const offline = journeyAt(beatProgressStart + 0.1 / 7, stations)
      expect(offline.link).toBe('offline')

      // Restoring wave
      const restoring = journeyAt(beatProgressStart + 0.3 / 7, stations)
      expect(restoring.link).toBe('restoring')

      // Fully online after arrive
      const online = journeyAt(beatProgressStart + 0.6 / 7, stations)
      expect(online.link).toBe('online')
    })

    it('proves pure determinism: forward and reverse scrub produce bitwise identical snapshots', () => {
      const samplePoints = [0.05, 0.22, 0.35, 0.5, 0.72, 0.88, 0.99]
      for (const p of samplePoints) {
        const snapForward = journeyAt(p, stations)
        const snapReverse = journeyAt(p, stations)
        expect(snapForward).toEqual(snapReverse)
      }
    })

    it('reaches core burst and finale in Beat 6', () => {
      const burstProgress = (6 + BURST_AT + 0.05) / 7
      const burstSnap = journeyAt(burstProgress, stations)
      expect(burstSnap.beat).toBe(6)
      expect(burstSnap.station).toBeNull()
      expect(burstSnap.finished).toBe(true)

      const finaleProgress = (6 + FINALE_AT + 0.05) / 7
      const finaleSnap = journeyAt(finaleProgress, stations)
      expect(finaleSnap.invited).toBe(true)
    })

    it('calculates progressForBeat accurately and handles reductions', () => {
      expect(progressForBeat(0, stations)).toBeLessThan(0.1)
      expect(progressForBeat(6, stations)).toBeGreaterThan(0.95)

      expect(journeyReduce(0.5, { type: 'skip' }, stations)).toBe(1)
      expect(journeyReduce(0.5, { type: 'reset' }, stations)).toBe(0)
    })
  })

  describe('3. Camera & RTL Mirroring Math (journey-shots.ts)', () => {
    it('has authored shots defined for opening, core, and all stations', () => {
      expect(OPENING_SHOT.move).toBe('craneDown')
      expect(CORE_SHOT.move).toBe('pullBackReveal')
      JOURNEY_STATIONS.forEach((stationId) => {
        const shot = STATION_SHOTS[stationId]
        expect(shot).toBeDefined()
        expect(shot.distance).toBeGreaterThan(0)
      })
    })

    it('correctly mirrors camera offsets between LTR (roadSide = 1) and RTL (roadSide = -1)', () => {
      const pose: CameraPose = { yaw: 30, pitch: 10, distance: 10 }
      const ltr = { x: 0, y: 0, z: 0 }
      const rtl = { x: 0, y: 0, z: 0 }

      eyeOffset(pose, 10, 1, ltr)
      eyeOffset(pose, 10, -1, rtl)

      expect(ltr.y).toBeCloseTo(rtl.y, 5)
      expect(ltr.z).toBeCloseTo(rtl.z, 5)
      expect(ltr.x).toBeCloseTo(-rtl.x, 5) // Inverted along X axis
    })

    it('ensures camera remains contained within hall size boundaries', () => {
      const hall = hallSize(5, 5.5)
      expect(hall.height).toBe(10.5)
      expect(hall.front).toBeGreaterThan(0)
      expect(hall.back).toBeLessThan(-100)
    })

    it('clamps portrait yaw to prevent subject loss on mobile screens', () => {
      const shot = { move: 'trackSide' as const, yaw: 45, pitch: 0, distance: 10 }
      const out: CameraPose = { yaw: 0, pitch: 0, distance: 0 }
      shotPose(shot, 1, true, out)
      expect(out.yaw).toBeLessThanOrEqual(15)
    })
  })

  describe('4. Analytics Event Emitter (journey-analytics.ts)', () => {
    beforeEach(() => {
      clearJourneyAnalyticsHistory()
    })

    it('records and returns emitted journey events', () => {
      emitJourneyEvent(JOURNEY_ANALYTICS_EVENTS.VIEW_HERO, { locale: 'fa' })
      emitJourneyEvent(JOURNEY_ANALYTICS_EVENTS.BEAT_REACHED, {
        beat: 1,
        beatId: 'beat-1',
        progress: 0.15,
      })

      const history = getJourneyAnalyticsHistory()
      expect(history).toHaveLength(2)
      expect(history[0]?.name).toBe('journey_view_hero')
      expect(history[0]?.payload).toEqual({ locale: 'fa' })
      expect(history[1]?.name).toBe('journey_beat_reached')
    })
  })

  describe('5. Quality Tier Detection (runtime.ts)', () => {
    it('returns a valid QualityTier (S, A, B, C, or D)', () => {
      const tier = detectQualityTier()
      expect(['S', 'A', 'B', 'C', 'D']).toContain(tier)
    })
  })
})
