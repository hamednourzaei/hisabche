// src/engine/motion-qa.ts
// Motion QA — meaning and coverage, not just "pixels changed".
//
// Four independent audits:
//   coverage — does every scene get a camera, a role, a primary motion?
//   semantic — does the metaphor match what the scene says and where it sits?
//   variety  — do two reels with different plans actually differ?
//   technical (DOM) — rendered by scripts/motion-qa.mjs, which feeds this module.
//
// A pass here is NOT a claim about visual beauty. Anything only a human eye can
// judge is reported UNVERIFIED, never PASS.

import { planReelMotion, type MotionPlan } from './motion-plan'
import type { Reel } from './types'

export type CheckStatus = 'PASS' | 'FAIL' | 'UNVERIFIED'

export type CheckCategory = 'technical' | 'coverage' | 'semantic' | 'variety'

export interface MotionCheck {
  id: string
  category: CheckCategory
  status: CheckStatus
  detail: string
}

const HOOK_METAPHORS: readonly string[] = ['warning-impact', 'silent-leak', 'rising-chart']
const UNKNOWN_REASON = 'content=unknown-value'

function check(
  id: string,
  category: CheckCategory,
  status: CheckStatus,
  detail: string,
): MotionCheck {
  return { id, category, status, detail }
}

// ─── Coverage: every scene must move ─────────────────────────────────────

// Every audit takes the plans as an argument so a test can feed a tampered plan
// and prove the check actually fails (a check that cannot fail is decoration).
export function auditCoverage(
  reel: Reel,
  plans: readonly MotionPlan[] = planReelMotion(reel),
): MotionCheck[] {
  const checks: MotionCheck[] = []

  const noCamera = plans.filter((p) => !(p.camera.to > p.camera.from))
  checks.push(
    check(
      'coverage.camera',
      'coverage',
      noCamera.length === 0 ? 'PASS' : 'FAIL',
      noCamera.length === 0
        ? `${plans.length}/${plans.length} scenes have a real push-in camera`
        : `no camera motion: ${noCamera.map((p) => p.sceneId).join(', ')}`,
    ),
  )

  const noPrimary = plans.filter((p) => !p.primaryMotion)
  checks.push(
    check(
      'coverage.primary-motion',
      'coverage',
      noPrimary.length === 0 ? 'PASS' : 'FAIL',
      noPrimary.length === 0
        ? 'every scene declares a primary motion'
        : `${noPrimary.length} scenes without primary motion`,
    ),
  )

  const hooks = plans.filter((p) => p.role === 'hook')
  const hookOk = hooks.every((p) => p.metaphor !== null && HOOK_METAPHORS.includes(p.metaphor))
  checks.push(
    check(
      'coverage.hook-metaphor',
      'coverage',
      hooks.length > 0 && hookOk ? 'PASS' : 'FAIL',
      hooks.length === 0
        ? 'reel has no hook scene'
        : `hook metaphors: ${hooks.map((p) => p.metaphor ?? 'none').join(', ')}`,
    ),
  )

  return checks
}

// ─── Semantic: the metaphor must mean what the scene says ─────────────────

export function auditSemantics(
  reel: Reel,
  plans: readonly MotionPlan[] = planReelMotion(reel),
): MotionCheck[] {
  const checks: MotionCheck[] = []

  const unknownPlans = plans.filter((p) => p.reason.includes(UNKNOWN_REASON))
  const unknownOk = unknownPlans.every(
    (p) => p.metaphor === 'question-shake' || p.secondaryMetaphor === 'question-shake',
  )
  checks.push(
    check(
      'semantic.unknown-value',
      'semantic',
      unknownOk ? 'PASS' : 'FAIL',
      unknownPlans.length === 0
        ? 'no unknown-value scene in this reel'
        : `${unknownPlans.length} unknown-value scenes, shake on ${unknownPlans.filter((p) => p.metaphor === 'question-shake' || p.secondaryMetaphor === 'question-shake').length}`,
    ),
  )

  const versus = reel.scenes
    .map((scene, i) => ({ scene, plan: plans[i]! }))
    .filter((x) => x.scene.spec.kind === 'versus')
  const versusOk = versus.every(
    (x) => x.plan.metaphor === 'opposition' || x.plan.metaphor === 'question-shake',
  )
  checks.push(
    check(
      'semantic.versus-opposition',
      'semantic',
      versus.length === 0 || versusOk ? 'PASS' : 'FAIL',
      versus.length === 0
        ? 'no versus scene in this reel'
        : `versus metaphors: ${versus.map((x) => x.plan.metaphor ?? 'none').join(', ')}`,
    ),
  )

  const ctas = plans.filter((p) => p.role === 'cta')
  const ctaOk = ctas.every((p) => p.metaphor === 'attention-ripple')
  checks.push(
    check(
      'semantic.cta-pulse',
      'semantic',
      ctas.length > 0 && ctaOk ? 'PASS' : 'FAIL',
      ctas.length === 0
        ? 'reel has no CTA scene'
        : `CTA metaphors: ${ctas.map((p) => p.metaphor ?? 'none').join(', ')}`,
    ),
  )

  const decorative = plans.filter((p) => p.role === 'context' && p.metaphor !== null)
  checks.push(
    check(
      'semantic.no-decorative',
      'semantic',
      decorative.length === 0 ? 'PASS' : 'FAIL',
      decorative.length === 0
        ? 'context scenes carry no decorative metaphor'
        : `unrelated metaphor on: ${decorative.map((p) => p.sceneId).join(', ')}`,
    ),
  )

  checks.push(
    check(
      'semantic.visual-quality',
      'semantic',
      'UNVERIFIED',
      'whether the metaphor reads as intended on screen needs a human frame review',
    ),
  )

  return checks
}

// ─── Variety: different reels must not execute the same motion path ───────

export interface ReelSignature {
  reelId: string
  steps: string[]
}

export function reelSignature(reel: Reel): ReelSignature {
  return {
    reelId: reel.id,
    steps: planReelMotion(reel).map(
      (p) =>
        `${p.role}:${p.metaphor ?? 'none'}:${p.transition}:${p.camera.from.toFixed(2)}-${p.camera.to.toFixed(2)}`,
    ),
  }
}

export function compareReels(
  a: Reel,
  b: Reel,
): {
  identical: boolean
  sharedRatio: number
  detail: string
} {
  const sa = reelSignature(a).steps
  const sb = reelSignature(b).steps
  const len = Math.max(sa.length, sb.length)
  let shared = 0
  for (let i = 0; i < len; i++) if (sa[i] === sb[i]) shared++
  const sharedRatio = len === 0 ? 0 : shared / len
  return {
    identical: sharedRatio === 1 && sa.length === sb.length,
    sharedRatio,
    detail: `${shared}/${len} motion steps identical`,
  }
}

export function auditVariety(
  reel: Reel,
  others: readonly Reel[],
  plans: readonly MotionPlan[] = planReelMotion(reel),
): MotionCheck[] {
  const checks: MotionCheck[] = []

  const transitions = new Set(plans.map((p) => p.transition))
  checks.push(
    check(
      'variety.transitions',
      'variety',
      reel.scenes.length < 4 || transitions.size >= 3 ? 'PASS' : 'FAIL',
      `${transitions.size} transition kinds across ${reel.scenes.length} scenes (${[...transitions].join(', ')})`,
    ),
  )

  const cameras = new Set(plans.map((p) => `${p.camera.from.toFixed(2)}-${p.camera.to.toFixed(2)}`))
  checks.push(
    check(
      'variety.camera-curves',
      'variety',
      cameras.size >= 2 ? 'PASS' : 'FAIL',
      `${cameras.size} distinct camera curves`,
    ),
  )

  const metaphors = new Set(
    plans.map((p) => `${p.metaphor ?? 'none'}+${p.secondaryMetaphor ?? 'none'}`),
  )
  checks.push(
    check(
      'variety.metaphors',
      'variety',
      metaphors.size >= 2 ? 'PASS' : 'FAIL',
      `${metaphors.size} distinct metaphor combinations`,
    ),
  )

  // Real comparison against archived reels: an identical plan sequence is a FAIL.
  const identical = others.filter((other) => compareReels(reel, other).identical)
  checks.push(
    check(
      'variety.vs-archive',
      'variety',
      identical.length === 0 ? 'PASS' : 'FAIL',
      identical.length === 0
        ? others.length === 0
          ? 'no archived reel available to compare (UNVERIFIED)'
          : `differs from ${others.length} archived reel(s): ${others.map((o) => compareReels(reel, o).detail).join(' | ')}`
        : `identical motion path to: ${identical.map((o) => o.id).join(', ')}`,
    ),
  )

  checks.push(
    check(
      'variety.editorial-feel',
      'variety',
      'UNVERIFIED',
      'whether the rhythm reads differently to a viewer needs a frame review',
    ),
  )

  return checks
}

// ─── Technical (plan side): boundaries and readability windows ────────────

export function auditPlanTechnical(
  reel: Reel,
  plans: readonly MotionPlan[] = planReelMotion(reel),
): MotionCheck[] {
  const checks: MotionCheck[] = []

  const badWindow = plans.filter((p) => {
    const duration = reel.scenes[plans.indexOf(p)]!.end - reel.scenes[plans.indexOf(p)]!.start
    return p.readabilityWindow[0] < 0 || p.readabilityWindow[1] > duration
  })
  checks.push(
    check(
      'technical.readability-window',
      'technical',
      badWindow.length === 0 ? 'PASS' : 'FAIL',
      badWindow.length === 0
        ? 'all readability windows inside their scene'
        : `outside scene: ${badWindow.map((p) => p.sceneId).join(', ')}`,
    ),
  )

  const staticTypography = plans.filter((p) => !p.typographyMotion.includes('breathing'))
  checks.push(
    check(
      'technical.typography-motion',
      'technical',
      staticTypography.length === 0 ? 'PASS' : 'FAIL',
      staticTypography.length === 0
        ? 'every scene declares post-entrance breathing'
        : `${staticTypography.length} scenes with static typography`,
    ),
  )

  checks.push(
    check(
      'technical.frame-bounds',
      'technical',
      'UNVERIFIED',
      'element overflow/overlap is measured from rendered frames by the DOM stage of this script',
    ),
  )

  return checks
}

export interface MotionAudit {
  checks: MotionCheck[]
  passed: number
  failed: number
  unverified: number
}

export function runPlanAudit(
  reel: Reel,
  archive: readonly Reel[] = [],
  plans: readonly MotionPlan[] = planReelMotion(reel),
): MotionAudit {
  const checks = [
    ...auditPlanTechnical(reel, plans),
    ...auditCoverage(reel, plans),
    ...auditSemantics(reel, plans),
    ...auditVariety(reel, archive, plans),
  ]
  return {
    checks,
    passed: checks.filter((c) => c.status === 'PASS').length,
    failed: checks.filter((c) => c.status === 'FAIL').length,
    unverified: checks.filter((c) => c.status === 'UNVERIFIED').length,
  }
}

export type { MotionPlan }
