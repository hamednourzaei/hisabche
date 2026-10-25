// src/creative/types.ts
// Creative DNA — the identity of a reel's creative decision.
// This is the contract between the creative layer and the renderer.
// The renderer executes; the creative layer decides.

export type NarrativeGrammar =
  | 'classic' // Hook -> Problem -> Cause -> Solution -> CTA
  | 'inverted' // Outcome -> Why -> Comparison -> Hook -> CTA
  | 'story' // Character -> Crisis -> Discovery -> Solution -> CTA
  | 'interrogative' // Question -> Question -> Question -> Answer -> CTA
  | 'pov' // First-person, no narrator
  | 'documentary' // Fake doc, timestamps, voiceover
  | 'comedy' // Setup -> tension -> silence -> punchline
  | 'pure-ui' // Only product, cursor, data
  | 'cinematic' // Visual metaphor, no cards

export type HookMechanism =
  | 'visual-shock'
  | 'contrarian'
  | 'specific-metric'
  | 'micro-disaster'
  | 'profit-leak'
  | 'role-paradox'
  | 'stop-doing-this'
  | 'binary-dilemma'
  | 'cold-open'
  | 'comedy'
  | 'documentary'
  | 'question'

export type VisualMedium =
  | 'realProductUI'
  | 'screenRecording'
  | 'typography'
  | '2dMotion'
  | '3d'
  | 'liveAction'
  | 'ugcStyle'
  | 'documentary'
  | 'mixedMedia'
  | 'illustration'
  | 'physicalMetaphor'
  | 'other'

export type CameraLanguage =
  'static' | 'slow-drift' | 'kinetic-zoom' | 'handheld' | 'orbit' | 'none'

export type EditingRhythm = 'slow-build' | 'rapid-cuts' | 'single-take' | 'staccato' | 'breathing'

export type SoundLanguage =
  'cinematic' | 'tactile-foley' | 'minimal' | 'rhythmic-urgency' | 'silence-heavy'

export type RealityLevel = 'abstract' | 'stylized' | 'grounded' | 'realFootage'

export type HumanPresence = 'none' | 'voiceOnly' | 'hands' | 'character' | 'interview' | 'onCamera'

export type ProductExposure = 'none' | 'briefProof' | 'mainSubject' | 'continuousDemo'

export type CreativeDNA = {
  reelId: string
  audience: string
  businessProblem: string
  creativeHypothesis: string
  narrativeGrammar: NarrativeGrammar
  hookMechanism: HookMechanism
  visualMedium: VisualMedium
  cameraLanguage: CameraLanguage
  editingRhythm: EditingRhythm
  soundLanguage: SoundLanguage
  realityLevel: RealityLevel
  humorLevel: 0 | 1 | 2 | 3
  tensionLevel: 0 | 1 | 2 | 3
  productExposure: ProductExposure
  humanPresence: HumanPresence
  surpriseMechanism: string
  emotionalArc: string
  creativeMoments: string[]
  noveltyClaim: string
  primaryCTA?: string
  aspectRatios: string[]
  localization: 'fa-IR' | 'fa-AF' | 'neutral' | 'multiVariant'
  artDirection: string
  layoutTopology: string
  themeName: string
}

export type CreativeConcept = {
  id: string
  title: string
  dna: CreativeDNA
  rationale: string
}

export type NoveltyResult = {
  score: number
  passed: boolean
  reasons: string[]
  comparedWith: string[]
}

export type CreativeQAResult = {
  passed: boolean
  scores: {
    hookSurprise: number
    noveltyMoment: number
    endingDifference: number
  }
  reasons: string[]
}
