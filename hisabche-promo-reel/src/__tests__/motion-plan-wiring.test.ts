// ============================================
// Motion Plan → real render path.
//
// These tests exist because the Motion Plan is only worth anything if it
// changes what is actually painted. Each one reads the SSR output of the SAME
// SceneView the exporter uses — no mocks, no parallel renderer.
//
//   1. the plan is deterministic and content/role driven
//   2. SceneView consumes it (camera curve, metaphor layer, data attributes)
//   3. the motion setting changes the rendered frame
//   4. every scene of every reel pushes the camera in (template migration)
//   5. text is never frozen after entrance
//   6. Motion QA FAILs when a metaphor or camera is removed
// ============================================

import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DEFAULT_MOTION_CONFIG } from '../engine/motion-config'
import { planReelMotion, planSceneMotion } from '../engine/motion-plan'
import { runPlanAudit } from '../engine/motion-qa'
import type { MotionPlan } from '../engine/motion-plan'
import type { Reel, Scene } from '../engine/types'
import { reel75 } from '../reels/reel-75-profit-or-loss'
import { REELS } from '../reels'
import { reelCues, SceneView } from '../scenes'
import { KineticWords } from '../ui/motion-primitives'

const render = (scene: Scene, t: number, scenes: readonly Scene[] = reel75.scenes) =>
  renderToString(React.createElement(SceneView, { scene, t, scenes }))

const scaleOf = (html: string): number | null => {
  const m = html.match(/scale\(([\d.]+)\)/)
  return m ? Number(m[1]) : null
}

const HOOK_METAPHORS = ['warning-impact', 'silent-leak', 'rising-chart']

describe('motion plan — deterministic and narrative-driven', () => {
  it('produces the same plan twice for the same reel (no randomness)', () => {
    expect(planReelMotion(reel75)).toEqual(planReelMotion(reel75))
  })

  it('gives reel-75 a hook impact metaphor, a versus opposition, a payoff transform and a CTA ripple', () => {
    const plans = planReelMotion(reel75)
    expect(plans).toHaveLength(reel75.scenes.length)

    expect(plans[0]!.role).toBe('hook')
    expect(HOOK_METAPHORS).toContain(plans[0]!.metaphor)

    const versus = plans.find((p) => p.sceneId.startsWith('versus-'))!
    expect(versus.metaphor).toBe('opposition')

    const payoff = plans.find((p) => p.role === 'payoff')!
    expect(payoff.metaphor).toBe('transformation')

    const cta = plans.find((p) => p.role === 'cta')!
    expect(cta.metaphor).toBe('attention-ripple')
  })

  it('marks every unknown-value scene for a shake (نامعلوم is not zero)', () => {
    const unknown = planReelMotion(reel75).filter((p) => p.reason.includes('content=unknown-value'))
    expect(unknown.length).toBeGreaterThan(0)
    for (const plan of unknown) {
      expect(
        plan.metaphor === 'question-shake' || plan.secondaryMetaphor === 'question-shake',
      ).toBe(true)
    }
  })

  it('labels a lone SceneView by kind, not as a hook', () => {
    const mockup = reel75.scenes.find((s: Scene) => s.spec.kind === 'mockup')!
    expect(planSceneMotion(mockup).role).toBe('evidence')
    expect(planSceneMotion(mockup).camera.to).toBeGreaterThan(planSceneMotion(mockup).camera.from)
  })
})

describe('SceneView consumes the plan (real render path)', () => {
  it('renders the planned metaphor and camera attributes into the DOM', () => {
    for (const scene of reel75.scenes) {
      const plan = planSceneMotion(scene, reel75.scenes)
      const html = render(scene, 0.5)
      expect(html).toContain(`data-motion-role="${plan.role}"`)
      expect(html).toContain(`data-motion-intensity="${plan.intensity}"`)
      expect(html).toContain(`data-metaphor="${plan.metaphor ?? 'none'}"`)
      if (plan.secondaryMetaphor) {
        expect(html).toContain(`data-metaphor-secondary="${plan.secondaryMetaphor}"`)
      }
    }
  })

  it('moves the camera between the first and last frame of every scene', () => {
    for (const scene of reel75.scenes) {
      const dur = scene.end - scene.start
      const start = scaleOf(render(scene, 0.05))
      const end = scaleOf(render(scene, dur - 0.05))
      expect(start).not.toBeNull()
      expect(end).not.toBeNull()
      expect(end!).toBeGreaterThan(start!)
    }
  })

  it('changes the rendered frame when motion intensity changes', () => {
    const scene = reel75.scenes[0]!
    const original = DEFAULT_MOTION_CONFIG.motionIntensity
    try {
      DEFAULT_MOTION_CONFIG.motionIntensity = 'subtle'
      const subtlePlan = planSceneMotion(scene, reel75.scenes)
      const subtle = render(scene, 2)
      DEFAULT_MOTION_CONFIG.motionIntensity = 'high'
      const highPlan = planSceneMotion(scene, reel75.scenes)
      const high = render(scene, 2)

      expect(highPlan.camera.to).toBeGreaterThan(subtlePlan.camera.to)
      expect(scaleOf(high)).toBeGreaterThan(scaleOf(subtle)!)
      expect(high).toContain('data-motion-intensity="high"')
      expect(subtle).toContain('data-motion-intensity="subtle"')
    } finally {
      DEFAULT_MOTION_CONFIG.motionIntensity = original
    }
  })

  it('pushes into the product UI while the unknown value stays legible', () => {
    const mockup = reel75.scenes.find((s: Scene) => s.spec.kind === 'mockup')!
    const html = render(mockup, 4)
    expect(html).toContain('data-ui-camera="push-in"')
    expect(html).toContain('نامعلوم')
    // the shot really moves: the window scale differs a second later
    expect(render(mockup, 3)).not.toBe(render(mockup, 6))
  })
})

describe('no scene is a static slide after entrance', () => {
  it('KineticWords keeps breathing after the words have landed', () => {
    const props = {
      words: ['سود', 'واقعی', 'را', 'بشناس.'],
      startAt: 0.8,
      gap: 0.4,
      tone: 'green' as const,
    }
    const at30 = renderToString(React.createElement(KineticWords, { ...props, t: 3.0 }))
    const at34 = renderToString(React.createElement(KineticWords, { ...props, t: 3.4 }))
    expect(at30).not.toBe(at34)
  })

  it('every reel-75 scene paints a different frame 0.4s after its entrance', () => {
    for (const scene of reel75.scenes) {
      const dur = scene.end - scene.start
      const t1 = Math.max(2.5, dur * 0.6)
      const t2 = Math.min(t1 + 0.4, dur - 0.05)
      expect(render(scene, t1)).not.toBe(render(scene, t2))
    }
  })
})

describe('template migration coverage', () => {
  it('gives every scene of every reel a push-in camera, a primary motion and breathing type', () => {
    expect(REELS.length).toBeGreaterThan(50)
    for (const reel of REELS) {
      const plans = planReelMotion(reel)
      expect(plans).toHaveLength(reel.scenes.length)
      for (const plan of plans) {
        if (!reel.noZoom) {
          expect(plan.camera.to).toBeGreaterThan(plan.camera.from)
        } else {
          expect(plan.camera.to).toBe(plan.camera.from)
        }
        expect(plan.primaryMotion.length).toBeGreaterThan(0)
        expect(plan.typographyMotion).toContain('breathing')
      }
    }
  })
})

describe('motion QA can actually fail', () => {
  const tamper = (mutate: (plans: MotionPlan[]) => void) => {
    const plans = planReelMotion(reel75).map((p) => ({ ...p, camera: { ...p.camera } }))
    mutate(plans)
    return runPlanAudit(reel75, [], plans)
  }

  it('FAILs when a scene has no camera movement', () => {
    const audit = tamper((plans) => {
      plans[0]!.camera = { from: 1, to: 1, panX: 0, panY: 0 }
    })
    expect(audit.checks.find((c) => c.id === 'coverage.camera')!.status).toBe('FAIL')
  })

  it('FAILs when the hook loses its metaphor', () => {
    const audit = tamper((plans) => {
      plans[0]!.metaphor = null
      plans[0]!.secondaryMetaphor = null
    })
    expect(audit.checks.find((c) => c.id === 'coverage.hook-metaphor')!.status).toBe('FAIL')
  })

  it('FAILs when an unknown value loses its shake', () => {
    const audit = tamper((plans) => {
      for (const plan of plans) {
        if (plan.reason.includes('content=unknown-value')) {
          plan.metaphor = 'warning-impact'
          plan.secondaryMetaphor = null
        }
      }
    })
    expect(audit.checks.find((c) => c.id === 'semantic.unknown-value')!.status).toBe('FAIL')
  })

  it('passes the untampered reel with no FAIL rows', () => {
    const audit = runPlanAudit(reel75, REELS.filter((r) => Number(r.id) < 75).slice(-3))
    expect(audit.failed).toBe(0)
    expect(audit.checks.every((c) => c.status !== 'FAIL')).toBe(true)
  })
})

describe('plan sound events reach the exported cue list', () => {
  const impactReel: Reel = {
    id: 'plan-cue-test',
    title: 'plan cue test',
    duration: 8,
    scenes: [
      { start: 0, end: 5, spec: { kind: 'hook', lines: ['صبر کن!'] }, vo: '' },
      {
        start: 5,
        end: 8,
        spec: { kind: 'kinetic', headline: 'شروع', words: ['شروع'], sub: '' },
        vo: '',
      },
    ],
  }

  it('an impact hook declares an impact transient and reelCues carries it', () => {
    const plan = planSceneMotion(impactReel.scenes[0]!, impactReel.scenes)
    expect(plan.metaphor).toBe('warning-impact')
    expect(plan.soundEvents).toContainEqual({ at: 0.25, kind: 'impact' })
    expect(reelCues(impactReel)).toContainEqual({ at: 0.25, kind: 'impact' })
  })

  it('does not duplicate a cue the scene already schedules at the same moment', () => {
    const cues = reelCues(impactReel).filter(
      (c) => c.kind === 'impact' && Math.abs(c.at - 0.25) < 0.35,
    )
    expect(cues).toHaveLength(1)
  })
})
