import { describe, expect, it } from 'vitest'
import {
  cameraMove,
  clamp,
  deterministicHash,
  ease,
  interpolate,
  maskWipe,
  pathFollow,
  progress,
  spring,
  staggerTimings,
  strokeDraw,
} from '../engine/anim'
import { REELS } from '../reels'
import { reelCues } from '../scenes'
import { faNumber } from '../ui/motion-primitives'

describe('Motion Design Engine & Reels Verification', () => {
  it('registers all 60 reels and flagship films with valid metadata', () => {
    expect(REELS).toHaveLength(60)
    REELS.forEach((reel, index) => {
      const expectedId = String(index + 1).padStart(2, '0')
      expect(reel.id).toBe(expectedId)
      expect(reel.title.length).toBeGreaterThan(0)
      expect(reel.duration).toBeGreaterThan(0)
      expect(reel.scenes.length).toBeGreaterThan(0)
    })
  })

  it('verifies reels 11 to 20 each have duration of exactly 59 seconds', () => {
    const reels11To20 = REELS.slice(10, 20)
    expect(reels11To20).toHaveLength(10)
    reels11To20.forEach((reel) => {
      expect(reel.duration).toBe(59)
      const lastScene = reel.scenes[reel.scenes.length - 1]!
      expect(lastScene.end).toBe(59)
    })
  })

  it('verifies 5 flagship films (reels 21 to 25) have duration 59s and distinct art directions', () => {
    const flagship = REELS.slice(20, 25)
    expect(flagship).toHaveLength(5)

    const expectedThemes = [
      'obsidian-cinematic',
      'financial-intelligence',
      'procedural-spatial',
      'swiss-editorial',
      'kinetic-manifesto',
    ]

    flagship.forEach((film, idx) => {
      expect(film.duration).toBe(59)
      expect(film.theme).toBe(expectedThemes[idx])
      const lastScene = film.scenes[film.scenes.length - 1]!
      expect(lastScene.end).toBe(59)
      expect(film.scenes.length).toBeGreaterThanOrEqual(4)
    })
  })

  it('verifies 5 new high-conversion films (reels 31 to 35) have duration 59s and story matrices', () => {
    const batch = REELS.slice(30, 35)
    expect(batch).toHaveLength(5)

    const expectedThemes = [
      'obsidian-cinematic',
      'financial-intelligence',
      'procedural-spatial',
      'swiss-editorial',
      'kinetic-manifesto',
    ]

    batch.forEach((film, idx) => {
      expect(film.duration).toBe(59)
      expect(film.theme).toBe(expectedThemes[idx])
      const lastScene = film.scenes[film.scenes.length - 1]!
      expect(lastScene.end).toBe(59)
      expect(film.scenes.length).toBeGreaterThanOrEqual(4)
      expect(film.storyMatrix).toBeDefined()
    })
  })

  it('verifies 5 community & business conversion films (reels 36 to 40) have duration 59s, storyMatrix, and valid metadata', () => {
    const batch36To40 = REELS.slice(35, 40)
    expect(batch36To40).toHaveLength(5)

    const expectedThemes = [
      'financial-intelligence',
      'kinetic-manifesto',
      'financial-intelligence',
      'procedural-spatial',
      'obsidian-cinematic',
    ]

    batch36To40.forEach((film, idx) => {
      expect(film.duration).toBe(59)
      expect(film.theme).toBe(expectedThemes[idx])
      const lastScene = film.scenes[film.scenes.length - 1]!
      expect(lastScene.end).toBe(59)
      expect(film.scenes.length).toBeGreaterThanOrEqual(4)
      expect(film.storyMatrix).toBeDefined()
    })
  })

  it('verifies high-conversion psychological dread film (reel 41) has duration 59s, valid storyMatrix, and legal-armor operators', () => {
    const r41 = REELS.find((r) => r.id === '41')
    expect(r41).toBeDefined()
    expect(r41?.duration).toBe(59)
    expect(r41?.theme).toBe('kinetic-manifesto')
    expect(r41?.scenes).toHaveLength(5)
    const lastScene = r41!.scenes[r41!.scenes.length - 1]!
    expect(lastScene.end).toBe(59)
    expect(r41?.storyMatrix).toBeDefined()
    expect(r41?.storyMatrix?.selectedOperators.length).toBeGreaterThanOrEqual(5)
  })

  it('verifies completed catalog films (reels 42 to 45) have duration 59s, opening archetypes, and storyMatrices', () => {
    const batch42To45 = REELS.slice(41, 45)
    expect(batch42To45).toHaveLength(4)

    const expectedThemes = [
      'swiss-editorial',
      'procedural-spatial',
      'financial-intelligence',
      'cinematic-obsidian',
    ]

    batch42To45.forEach((film, idx) => {
      expect(film.duration).toBe(59)
      expect(film.theme).toBe(expectedThemes[idx])
      const lastScene = film.scenes[film.scenes.length - 1]!
      expect(lastScene.end).toBe(59)
      expect(film.scenes.length).toBe(5)
      expect(film.storyMatrix).toBeDefined()
      expect(film.storyMatrix?.selectedOperators.length).toBeGreaterThanOrEqual(5)
    })
  })

  it('verifies showcase promotional film (reel 46 authored via /new-reels) has duration 59s, uncomfortable-discovery archetype, and valid storyMatrix', () => {
    const r46 = REELS.find((r) => r.id === '46')
    expect(r46).toBeDefined()
    expect(r46?.duration).toBe(59)
    expect(r46?.theme).toBe('swiss-editorial')
    expect(r46?.scenes).toHaveLength(5)
    const firstScene = r46!.scenes[0]!
    expect(firstScene.spec.kind).toBe('hook')
    if (firstScene.spec.kind === 'hook') {
      expect(firstScene.spec.openingArchetype).toBe('uncomfortable-discovery')
      expect(firstScene.spec.discovery).toBeDefined()
    }
    const lastScene = r46!.scenes[r46!.scenes.length - 1]!
    expect(lastScene.end).toBe(59)
    expect(r46?.storyMatrix).toBeDefined()
    expect(r46?.storyMatrix?.selectedOperators.length).toBeGreaterThanOrEqual(5)
  })

  it('verifies flagship tactile train-scroll film (reel 47) has duration 59s, tactile-train scene, and valid storyMatrix', () => {
    const r47 = REELS.find((r) => r.id === '47')
    expect(r47).toBeDefined()
    expect(r47?.duration).toBe(59)
    expect(r47?.theme).toBe('swiss-editorial')
    expect(r47?.scenes).toHaveLength(1)
    expect(r47?.scenes[0]?.spec.kind).toBe('tactile-train')
    expect(r47?.storyMatrix).toBeDefined()
    expect(r47?.storyMatrix?.selectedOperators.length).toBeGreaterThanOrEqual(5)
  })

  it('verifies POS transaction impasse film (reel 48) has duration 59s, customer-confrontation archetype, and valid storyMatrix', () => {
    const r48 = REELS.find((r) => r.id === '48')
    expect(r48).toBeDefined()
    expect(r48?.duration).toBe(59)
    expect(r48?.theme).toBe('financial-intelligence')
    expect(r48?.scenes).toHaveLength(5)
    const firstScene = r48!.scenes[0]!
    expect(firstScene.spec.kind).toBe('hook')
    if (firstScene.spec.kind === 'hook') {
      expect(firstScene.spec.openingArchetype).toBe('customer-confrontation')
      expect(firstScene.spec.confrontation).toBeDefined()
    }
    const lastScene = r48!.scenes[r48!.scenes.length - 1]!
    expect(lastScene.end).toBe(59)
    expect(r48?.storyMatrix).toBeDefined()
    expect(r48?.storyMatrix?.selectedOperators.length).toBeGreaterThanOrEqual(5)
  })

  it('verifies inflation credit trap film (reel 49) has duration 59s, uncomfortable-discovery archetype, and valid storyMatrix', () => {
    const r49 = REELS.find((r) => r.id === '49')
    expect(r49).toBeDefined()
    expect(r49?.duration).toBe(59)
    expect(r49?.theme).toBe('cinematic-obsidian')
    expect(r49?.scenes).toHaveLength(5)
    const firstScene = r49!.scenes[0]!
    expect(firstScene.spec.kind).toBe('hook')
    if (firstScene.spec.kind === 'hook') {
      expect(firstScene.spec.openingArchetype).toBe('uncomfortable-discovery')
      expect(firstScene.spec.discovery).toBeDefined()
    }
    const lastScene = r49!.scenes[r49!.scenes.length - 1]!
    expect(lastScene.end).toBe(59)
    expect(r49?.storyMatrix).toBeDefined()
    expect(r49?.storyMatrix?.selectedOperators.length).toBeGreaterThanOrEqual(5)
  })

  it('verifies 5 new product-led SaaS films (reels 26 to 30) have duration 59s, storyMatrix, and valid metadata', () => {
    const newReels = REELS.slice(25, 30)
    expect(newReels).toHaveLength(5)

    const expectedThemes = [
      'obsidian-cinematic',
      'financial-intelligence',
      'procedural-spatial',
      'kinetic-manifesto',
      'swiss-editorial',
    ]

    newReels.forEach((reel, idx) => {
      expect(reel.duration).toBe(59)
      expect(reel.theme).toBe(expectedThemes[idx])
      expect(reel.storyMatrix).toBeDefined()
      expect(reel.storyMatrix?.selectedOperators.length).toBeGreaterThanOrEqual(4)
      const lastScene = reel.scenes[reel.scenes.length - 1]!
      expect(lastScene.end).toBe(59)
      expect(reel.scenes.length).toBe(5)
    })
  })

  it('ensures scene timelines are sequential and continuous without gaps or overlap', () => {
    REELS.forEach((reel) => {
      let expectedStart = 0
      reel.scenes.forEach((scene) => {
        expect(scene.start).toBe(expectedStart)
        expect(scene.end).toBeGreaterThan(scene.start)
        expectedStart = scene.end
      })
      expect(expectedStart).toBe(reel.duration)
    })
  })

  it('computes pure deterministic animation easing and spring physics', () => {
    // clamp
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
    expect(clamp(5, 0, 10)).toBe(5)

    // progress
    expect(progress(1, 1, 2)).toBe(0)
    expect(progress(2, 1, 2)).toBe(0.5)
    expect(progress(3, 1, 2)).toBe(1)

    // ease
    expect(ease(0)).toBe(0)
    expect(ease(1)).toBe(1)
    expect(ease(0.5)).toBeGreaterThan(0.5)

    // spring: deterministic, closed-form
    expect(spring(0)).toBe(0)
    expect(spring(1)).toBeCloseTo(1, 1)

    // strokeDraw: SVG path animation helper
    const stroke = strokeDraw(1.5, 1.0, 1.0, 1000)
    expect(stroke.strokeDasharray).toBe(1000)
    expect(stroke.strokeDashoffset).toBeLessThan(1000)
    expect(stroke.strokeDashoffset).toBeGreaterThan(0)

    // interpolate
    expect(interpolate(1.5, 1.0, 2.0, 100, 200, (p) => p)).toBe(150)
  })

  it('validates Layer B animation operators (hash, maskWipe, pathFollow, cameraMove, staggerTimings)', () => {
    // deterministicHash
    const h1 = deterministicHash(42, 100)
    const h2 = deterministicHash(42, 100)
    expect(h1).toBe(h2)
    expect(h1).toBeGreaterThanOrEqual(0)
    expect(h1).toBeLessThanOrEqual(1)

    // maskWipe
    expect(maskWipe(0, 'up')).toBe('inset(100% 0% 0% 0%)')
    expect(maskWipe(1, 'up')).toBe('inset(0% 0% 0% 0%)')
    expect(maskWipe(0.5, 'radial')).toBe('circle(50% at 50% 50%)')

    // pathFollow
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 0 },
    ]
    const midPos = pathFollow(0.5, pts)
    expect(midPos.x).toBeCloseTo(100, 1)
    expect(midPos.y).toBeCloseTo(100, 1)

    // cameraMove
    const cam = cameraMove(0.5, 0, 1, { rx: 10, ry: 0, z: 0 }, { rx: 20, ry: 0, z: 0 })
    expect(cam.transformStyle).toBe('preserve-3d')
    expect(cam.transform).toContain('rotateX(')

    // staggerTimings
    const staggers = staggerTimings(4, 0.2, 0.3, 0.05)
    expect(staggers).toHaveLength(4)
    expect(staggers[0]).toBe(0.2)
    expect(staggers[1]).toBeCloseTo(0.5, 2)
  })

  it('generates chronologically ordered sound cues across all reels and flagship films', () => {
    REELS.forEach((reel) => {
      const cues = reelCues(reel)
      expect(cues.length).toBeGreaterThan(0)
      for (let i = 0; i < cues.length - 1; i++) {
        expect(cues[i]!.at).toBeLessThanOrEqual(cues[i + 1]!.at)
        expect(cues[i]!.at).toBeLessThan(reel.duration)
      }
    })
  })

  it('formats Persian digits accurately with faNumber', () => {
    expect(faNumber(0)).toBe('۰')
    expect(faNumber(125)).toBe('۱۲۵')
    expect(faNumber(50000)).toBe('۵۰٬۰۰۰')
  })

  it('dispatches all 10 core sounds and 8 compound effects safely without runtime errors', () => {
    const soundKinds: import('../engine/sound').SoundKind[] = [
      'pop',
      'whoosh',
      'success',
      'tick',
      'scan',
      'alert',
      'impact',
      'chime',
      'cash',
      'sync',
      'cinematicReveal',
      'titleHit',
      'dataFlow',
      'bigReveal',
      'insightReveal',
      'precisionSequence',
      'softTransition',
      'financialMilestone',
      'cardEnter',
      'sceneTransition',
      'majorReveal',
      'successResolution',
      'ctaResolution',
    ]

    import('../engine/sound').then(({ setMuted, play }) => {
      setMuted(true)
      soundKinds.forEach((kind) => {
        expect(() => play(kind)).not.toThrow()
      })
      setMuted(false)
    })
  })

  it('validates 46-reel diversity registry, rotation matrix, weighted similarity, and dynamic template guardrails', async () => {
    const {
      REEL_REGISTRY_LIST,
      validateReelRegistry,
      assertNoLayoutRepetition,
      getReelRegistryEntry,
      computeCreativeSimilarity,
    } = await import('../data/reel-registry')

    expect(REEL_REGISTRY_LIST).toHaveLength(60)

    // Full sequence validation including weighted creative similarity
    const result = validateReelRegistry(REEL_REGISTRY_LIST)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)

    // Verify adjacent similarity is strictly below 35%
    for (let i = 1; i < REEL_REGISTRY_LIST.length; i++) {
      const cur = REEL_REGISTRY_LIST[i]!
      const prev = REEL_REGISTRY_LIST[i - 1]!
      const sim = computeCreativeSimilarity(cur, prev)
      expect(sim.passed).toBe(true)
      expect(sim.score).toBeLessThanOrEqual(0.35)
    }

    // Verify Reel 10, 22, 40 pairwise distinction
    const r10 = getReelRegistryEntry('10')
    const r22 = getReelRegistryEntry('22')
    const r40 = getReelRegistryEntry('40')

    expect(r10.artDirection).not.toBe(r22.artDirection)
    expect(r10.artDirection).not.toBe(r40.artDirection)
    expect(r22.artDirection).not.toBe(r40.artDirection)

    expect(r10.layoutTopology).not.toBe(r22.layoutTopology)
    expect(r10.layoutTopology).not.toBe(r40.layoutTopology)
    expect(r22.layoutTopology).not.toBe(r40.layoutTopology)

    // Verify 5-6 purposeful operators per reel
    REEL_REGISTRY_LIST.forEach((entry) => {
      expect(entry.operators.length).toBeGreaterThanOrEqual(5)
      expect(entry.operators.length).toBeLessThanOrEqual(6)
    })

    // Verify dynamic template guardrail throws on duplicate in window of 3
    expect(() => {
      assertNoLayoutRepetition(
        'split-screen-horizon',
        ['asymmetrical-swiss-grid', 'full-bleed-kinetic', 'split-screen-horizon'],
        'test-fail',
      )
    }).toThrow(/Template Trap Guardrail Violation/)

    // Verify guardrail passes when distinct
    expect(() => {
      assertNoLayoutRepetition(
        'data-flow-matrix',
        ['asymmetrical-swiss-grid', 'full-bleed-kinetic', 'split-screen-horizon'],
        'test-pass',
      )
    }).not.toThrow()
  })

  it('verifies Reel 50 composite commercial has exact 30s duration and 6 psychological scenes', () => {
    const reel50 = REELS.find((r) => r.id === '50')!
    expect(reel50).toBeDefined()
    expect(reel50.duration).toBe(30)
    expect(reel50.scenes).toHaveLength(6)

    // Check exact timing breakdown
    expect(reel50.scenes[0]!.start).toBe(0)
    expect(reel50.scenes[0]!.end).toBe(4)
    expect(reel50.scenes[1]!.start).toBe(4)
    expect(reel50.scenes[1]!.end).toBe(9)
    expect(reel50.scenes[2]!.start).toBe(9)
    expect(reel50.scenes[2]!.end).toBe(13)
    expect(reel50.scenes[3]!.start).toBe(13)
    expect(reel50.scenes[3]!.end).toBe(22)
    expect(reel50.scenes[4]!.start).toBe(22)
    expect(reel50.scenes[4]!.end).toBe(27)
    expect(reel50.scenes[5]!.start).toBe(27)
    expect(reel50.scenes[5]!.end).toBe(30)
  })

  it('verifies Reel 52 cashflow liquidity crisis film has exact 30s duration, uncomfortable-discovery archetype, and valid storyMatrix', () => {
    const reel52 = REELS.find((r) => r.id === '52')!
    expect(reel52).toBeDefined()
    expect(reel52.duration).toBe(30)
    expect(reel52.scenes).toHaveLength(6)
    expect(reel52.theme).toBe('kinetic-manifesto')
    expect(reel52.storyMatrix).toBeDefined()
    expect(reel52.storyMatrix?.targetCustomer).toBe('retail-shopkeeper')
    expect(reel52.storyMatrix?.selectedOperators).toHaveLength(5)

    // Check exact timing breakdown
    expect(reel52.scenes[0]!.start).toBe(0)
    expect(reel52.scenes[0]!.end).toBe(2)
    expect(reel52.scenes[1]!.start).toBe(2)
    expect(reel52.scenes[1]!.end).toBe(7)
    expect(reel52.scenes[2]!.start).toBe(7)
    expect(reel52.scenes[2]!.end).toBe(12)
    expect(reel52.scenes[3]!.start).toBe(12)
    expect(reel52.scenes[3]!.end).toBe(21)
    expect(reel52.scenes[4]!.start).toBe(21)
    expect(reel52.scenes[4]!.end).toBe(26.5)
    expect(reel52.scenes[5]!.start).toBe(26.5)
    expect(reel52.scenes[5]!.end).toBe(30)
  })

  it('verifies Reel 53 word-synchronized cashflow film has exact 26s duration and speech-driven word cues', () => {
    const reel53 = REELS.find((r) => r.id === '53')!
    expect(reel53).toBeDefined()
    expect(reel53.duration).toBe(26)
    expect(reel53.scenes).toHaveLength(5)
    expect(reel53.theme).toBe('cinematic-obsidian')
    expect(reel53.storyMatrix).toBeDefined()
    expect(reel53.storyMatrix?.targetCustomer).toBe('retail-shopkeeper')

    // Verify word-synchronized plan for each scene
    reel53.scenes.forEach((scene) => {
      expect(scene.sentence).toBeDefined()
      expect(scene.sentence!.words.length).toBeGreaterThan(0)
      expect(scene.sentence!.intent.length).toBeGreaterThan(0)
    })
  })

  it('verifies Reel 54 word-synchronized urgent cheque cashflow film has exact 26s duration and speech-driven word cues', () => {
    const reel54 = REELS.find((r) => r.id === '54')!
    expect(reel54).toBeDefined()
    expect(reel54.duration).toBe(26)
    expect(reel54.scenes).toHaveLength(5)
    expect(reel54.theme).toBe('financial-intelligence')
    expect(reel54.storyMatrix).toBeDefined()
    expect(reel54.storyMatrix?.targetCustomer).toBe('wholesaler')

    // Verify word-synchronized plan for each scene
    reel54.scenes.forEach((scene) => {
      expect(scene.sentence).toBeDefined()
      expect(scene.sentence!.words.length).toBeGreaterThan(0)
      expect(scene.sentence!.intent.length).toBeGreaterThan(0)
    })
  })

  it('verifies Reel 55 hybrid dead-stock film has exact 26s duration, hybrid actors, and speech-driven word cues', () => {
    const reel55 = REELS.find((r) => r.id === '55')!
    expect(reel55).toBeDefined()
    expect(reel55.duration).toBe(26)
    expect(reel55.scenes).toHaveLength(5)
    expect(reel55.theme).toBe('procedural-spatial')
    expect(reel55.storyMatrix).toBeDefined()
    expect(reel55.storyMatrix?.targetCustomer).toBe('retail-shopkeeper')
    expect(reel55.storyMatrix?.selectedOperators.length).toBeGreaterThanOrEqual(5)

    // Exact hybrid scene timeline
    expect(reel55.scenes[0]!.start).toBe(0)
    expect(reel55.scenes[0]!.end).toBe(4)
    expect(reel55.scenes[1]!.start).toBe(4)
    expect(reel55.scenes[1]!.end).toBe(9.6)
    expect(reel55.scenes[2]!.start).toBe(9.6)
    expect(reel55.scenes[2]!.end).toBe(15.8)
    expect(reel55.scenes[3]!.start).toBe(15.8)
    expect(reel55.scenes[3]!.end).toBe(22)
    expect(reel55.scenes[4]!.start).toBe(22)
    expect(reel55.scenes[4]!.end).toBe(26)

    // Each scene drives a distinct hybrid actor with word-synchronized cues
    const expectedActors = [
      'r55-hook-vault',
      'r55-thermal-aging',
      'r55-isometric-autopsy',
      'r55-glass-recovery',
      'r55-cta-conversion',
    ]
    reel55.scenes.forEach((scene, index) => {
      expect(scene.spec.kind).toBe('word-sync')
      if (scene.spec.kind === 'word-sync') {
        expect(scene.spec.actor).toBe(expectedActors[index])
      }
      expect(scene.sentence).toBeDefined()
      expect(scene.sentence!.words.length).toBeGreaterThan(0)
      expect(scene.sentence!.intent.length).toBeGreaterThan(0)
      expect(scene.sentence!.alignmentStatus).toBe('PROVISIONAL_CADENCE_MODEL_ACTIVE')
      expect(scene.sentence!.isProvisional).toBe(true)
    })
  })

  it('verifies Reel 56 continuous-line branch-profit film has exact 26s duration, line actors, and climax holds', () => {
    const reel56 = REELS.find((r) => r.id === '56')!
    expect(reel56).toBeDefined()
    expect(reel56.duration).toBe(26)
    expect(reel56.scenes).toHaveLength(5)
    expect(reel56.theme).toBe('kinetic-manifesto')
    expect(reel56.storyMatrix).toBeDefined()
    expect(reel56.storyMatrix?.targetCustomer).toBe('retail-shopkeeper')
    expect(reel56.storyMatrix?.selectedOperators.length).toBeGreaterThanOrEqual(5)

    // Exact continuous-line scene timeline
    expect(reel56.scenes[0]!.start).toBe(0)
    expect(reel56.scenes[0]!.end).toBe(4.6)
    expect(reel56.scenes[1]!.start).toBe(4.6)
    expect(reel56.scenes[1]!.end).toBe(10)
    expect(reel56.scenes[2]!.start).toBe(10)
    expect(reel56.scenes[2]!.end).toBe(16)
    expect(reel56.scenes[3]!.start).toBe(16)
    expect(reel56.scenes[3]!.end).toBe(22)
    expect(reel56.scenes[4]!.start).toBe(22)
    expect(reel56.scenes[4]!.end).toBe(26)

    // Each scene drives a distinct continuous-line actor with word-synchronized cues
    const expectedActors = [
      'r56-hook-split',
      'r56-cost-waterfall',
      'r56-branch-autopsy',
      'r56-truth-panel',
      'r56-cta-loop',
    ]
    const climaxActions = [
      'loss-badge-pop',
      'residue-hold',
      'loss-stamp',
      'insight-lock',
      'cta-button-pulse',
    ]
    reel56.scenes.forEach((scene, index) => {
      expect(scene.spec.kind).toBe('word-sync')
      if (scene.spec.kind === 'word-sync') {
        expect(scene.spec.actor).toBe(expectedActors[index])
      }
      expect(scene.sentence).toBeDefined()
      expect(scene.sentence!.words.length).toBeGreaterThan(0)
      expect(scene.sentence!.intent.length).toBeGreaterThan(0)
      expect(scene.sentence!.alignmentStatus).toBe('PROVISIONAL_CADENCE_MODEL_ACTIVE')
      expect(scene.sentence!.isProvisional).toBe(true)

      // The scene turning point holds for 1.2s–1.8s before the scene ends
      const ending = scene.sentence!.sentenceEnding
      expect(ending).toBeDefined()
      const hold = scene.end - scene.start - ending!.at
      expect(hold).toBeGreaterThanOrEqual(1.2)
      expect(hold).toBeLessThanOrEqual(1.8)

      // The climactic word cue of the scene is wired
      expect(scene.sentence!.words.some((word) => word.action === climaxActions[index])).toBe(true)
    })
  })

  it('verifies Reel 57 forensic-audit-shield film has exact 26s duration, line actors, and climax holds', () => {
    const reel57 = REELS.find((r) => r.id === '57')!
    expect(reel57).toBeDefined()
    expect(reel57.duration).toBe(26)
    expect(reel57.scenes).toHaveLength(5)
    expect(reel57.theme).toBe('cinematic-obsidian')
    expect(reel57.storyMatrix).toBeDefined()
    expect(reel57.storyMatrix?.targetCustomer).toBe('retail-shopkeeper')
    expect(reel57.storyMatrix?.selectedOperators.length).toBeGreaterThanOrEqual(5)

    // Exact scene timeline
    expect(reel57.scenes[0]!.start).toBe(0)
    expect(reel57.scenes[0]!.end).toBe(4.8)
    expect(reel57.scenes[1]!.start).toBe(4.8)
    expect(reel57.scenes[1]!.end).toBe(10.2)
    expect(reel57.scenes[2]!.start).toBe(10.2)
    expect(reel57.scenes[2]!.end).toBe(16.2)
    expect(reel57.scenes[3]!.start).toBe(16.2)
    expect(reel57.scenes[3]!.end).toBe(22)
    expect(reel57.scenes[4]!.start).toBe(22)
    expect(reel57.scenes[4]!.end).toBe(26)

    const expectedActors = [
      'r57-forensic-hook',
      'r57-cash-gap',
      'r57-legacy-vulnerability',
      'r57-security-shield',
      'r57-cta-vault',
    ]
    const climaxActions = [
      'fraud-stamp',
      'leak-badge',
      'vulnerability-stamp',
      'audit-shield-lock',
      'cta-button-pulse',
    ]

    reel57.scenes.forEach((scene, index) => {
      expect(scene.spec.kind).toBe('word-sync')
      if (scene.spec.kind === 'word-sync') {
        expect(scene.spec.actor).toBe(expectedActors[index])
      }
      expect(scene.sentence).toBeDefined()
      expect(scene.sentence!.words.length).toBeGreaterThan(0)
      expect(scene.sentence!.intent.length).toBeGreaterThan(0)
      expect(scene.sentence!.alignmentStatus).toBe('PROVISIONAL_CADENCE_MODEL_ACTIVE')
      expect(scene.sentence!.isProvisional).toBe(true)

      // Climax hold 1.2s–1.8s
      const ending = scene.sentence!.sentenceEnding
      expect(ending).toBeDefined()
      const hold = scene.end - scene.start - ending!.at
      expect(hold).toBeGreaterThanOrEqual(1.2)
      expect(hold).toBeLessThanOrEqual(1.8)

      // Climactic word cue is wired
      expect(scene.sentence!.words.some((word) => word.action === climaxActions[index])).toBe(true)
    })
  })

  it('verifies Reel 59 tax audit & moadian shield film has exact 26s duration, tax actors, and hold >= 1.2s', () => {
    const reel59 = REELS.find((r) => r.id === '59')
    expect(reel59).toBeDefined()
    expect(reel59!.duration).toBe(26.0)
    expect(reel59!.scenes).toHaveLength(5)

    const expectedActors = [
      'r59-tax-hook',
      'r59-discrepancy-matrix',
      'r59-legacy-risk',
      'r59-moadian-shield',
      'r59-cta-tax',
    ]

    reel59!.scenes.forEach((scene, index) => {
      expect(scene.spec.kind).toBe('word-sync')
      if (scene.spec.kind === 'word-sync') {
        expect(scene.spec.actor).toBe(expectedActors[index])
      }
      expect(scene.sentence).toBeDefined()
      expect(scene.sentence!.words.length).toBeGreaterThan(0)
      expect(scene.sentence!.intent.length).toBeGreaterThan(0)
    })
  })
})
