// src/creative/creative-director.ts
import type { CreativeConcept, CreativeDNA } from './types'
import { computeNovelty } from './novelty-score'
import { NARRATIVE_GRAMMARS } from '../data/narrative-grammars'

const HOOKS: CreativeDNA['hookMechanism'][] = [
  'contrarian',
  'specific-metric',
  'micro-disaster',
  'visual-shock',
  'profit-leak',
  'cold-open',
  'question',
  'comedy',
]

const MEDIUMS: CreativeDNA['visualMedium'][] = [
  'typography',
  'screenRecording',
  'realProductUI',
  'documentary',
  'physicalMetaphor',
  'mixedMedia',
  '2dMotion',
]

const RHYTHMS: CreativeDNA['editingRhythm'][] = [
  'rapid-cuts',
  'slow-build',
  'single-take',
  'staccato',
  'breathing',
]

const SOUNDS: CreativeDNA['soundLanguage'][] = [
  'minimal',
  'cinematic',
  'tactile-foley',
  'silence-heavy',
  'rhythmic-urgency',
]

const CAMERAS: CreativeDNA['cameraLanguage'][] = [
  'static',
  'slow-drift',
  'kinetic-zoom',
  'handheld',
  'none',
]

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

function baseDNA(
  idea: string,
): Omit<
  CreativeDNA,
  | 'narrativeGrammar'
  | 'hookMechanism'
  | 'visualMedium'
  | 'cameraLanguage'
  | 'editingRhythm'
  | 'soundLanguage'
> {
  return {
    reelId: 'draft',
    audience: 'business owner',
    businessProblem: idea,
    creativeHypothesis: `Test whether the idea resonates as a ${pick(['contrarian', 'documentary', 'data-led'], idea.length)} angle`,
    realityLevel: 'grounded',
    humorLevel: 0,
    tensionLevel: 2,
    productExposure: 'briefProof',
    humanPresence: 'voiceOnly',
    surpriseMechanism: 'unexpected cost reveal',
    emotionalArc: 'curiosity -> dread -> relief',
    creativeMoments: ['single-focal-hold', 'hard-cut-reveal'],
    noveltyClaim: 'TBD',
    primaryCTA: 'شروع رایگان',
    aspectRatios: ['9:16'],
    localization: 'fa-IR',
    artDirection: 'financial-intelligence',
    layoutTopology: 'data-flow-matrix',
    themeName: 'financial-intelligence',
  }
}

export function generateConcepts(
  idea: string,
  previousDNAs: CreativeDNA[],
  count = 3,
): CreativeConcept[] {
  const concepts: CreativeConcept[] = []
  const grammars = NARRATIVE_GRAMMARS.map((g) => g.id)
  let attempts = 0
  const maxAttempts = count * 20

  while (concepts.length < count && attempts < maxAttempts) {
    attempts++
    const seed = attempts + previousDNAs.length * 7
    const dna: CreativeDNA = {
      ...baseDNA(idea),
      narrativeGrammar: pick(grammars, seed) as CreativeDNA['narrativeGrammar'],
      hookMechanism: pick(HOOKS, seed + 1),
      visualMedium: pick(MEDIUMS, seed + 2),
      cameraLanguage: pick(CAMERAS, seed + 3),
      editingRhythm: pick(RHYTHMS, seed + 4),
      soundLanguage: pick(SOUNDS, seed + 5),
    }
    const novelty = computeNovelty(dna, previousDNAs)
    if (novelty.passed) {
      concepts.push({
        id: `concept-${concepts.length + 1}`,
        title: `${dna.hookMechanism} / ${dna.narrativeGrammar} / ${dna.visualMedium}`,
        dna: {
          ...dna,
          noveltyClaim: `Novelty score ${novelty.score} vs ${novelty.comparedWith.length} previous reels`,
        },
        rationale: novelty.reasons.slice(0, 2).join('; ') || 'passed novelty gate',
      })
    }
  }

  if (concepts.length === 0) {
    throw new Error(
      'No concept passed novelty gate. Idea may be too narrow or previous reels too similar.',
    )
  }
  return concepts
}
