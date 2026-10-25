// src/creative/novelty-score.ts
import type { CreativeDNA, NoveltyResult } from './types'

const WEIGHTS: Record<string, number> = {
  narrativeGrammar: 0.25,
  hookMechanism: 0.2,
  visualMedium: 0.15,
  cameraLanguage: 0.1,
  editingRhythm: 0.1,
  soundLanguage: 0.1,
  surpriseMechanism: 0.1,
}

const AXES: (keyof CreativeDNA)[] = [
  'narrativeGrammar',
  'hookMechanism',
  'visualMedium',
  'cameraLanguage',
  'editingRhythm',
  'soundLanguage',
]

export function computeNovelty(
  candidate: CreativeDNA,
  previous: CreativeDNA[],
  windowSize = 20,
): NoveltyResult {
  const window = previous.slice(-windowSize)
  if (window.length === 0) {
    return { score: 1, passed: true, reasons: ['No previous reels to compare'], comparedWith: [] }
  }

  const comparedWith = window.map((p) => p.reelId)
  const reasons: string[] = []
  let totalScore = 0
  let compared = 0

  for (const prev of window) {
    let axisDiff = 0
    const axisReasons: string[] = []
    for (const axis of AXES) {
      const w = WEIGHTS[axis as string] ?? 0
      if (candidate[axis] !== prev[axis]) {
        axisDiff += w
      } else {
        axisReasons.push(`Same ${axis}: '${String(candidate[axis])}'`)
      }
    }
    // surpriseMechanism: simple string inequality
    if (candidate.surpriseMechanism !== prev.surpriseMechanism) {
      totalScore += WEIGHTS.surpriseMechanism
    } else {
      reasons.push(`Same surpriseMechanism`)
    }
    totalScore += axisDiff
    compared++
    if (axisReasons.length > 0) {
      reasons.push(`vs ${prev.reelId}: ${axisReasons.join(', ')}`)
    }
  }

  const avgScore = compared > 0 ? totalScore / compared : 1
  const score = Math.min(1, Math.max(0, avgScore))

  // Hard gate: at least 2 axes must differ from EVERY reel in the window
  let hardGatePassed = true
  for (const prev of window) {
    let diffCount = 0
    for (const axis of AXES) {
      if (candidate[axis] !== prev[axis]) diffCount++
    }
    if (candidate.surpriseMechanism !== prev.surpriseMechanism) diffCount++
    if (diffCount < 2) {
      hardGatePassed = false
      reasons.push(`Only ${diffCount} axis differs from ${prev.reelId} (need >=2)`)
    }
  }

  const passed = score >= 0.6 && hardGatePassed
  if (!passed && reasons.length === 0) reasons.push('Novelty below threshold')

  return { score: Math.round(score * 100) / 100, passed, reasons, comparedWith }
}
