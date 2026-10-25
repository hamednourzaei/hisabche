// ============================================
// Creative Reference Engine — permanent registry types
// Rule file: .claude/reel-plugin/creative-reference-engine.md
//
// Every entry is a real, personally-opened and personally-analyzed source.
// Never register a URL or a claim from memory — nothing enters this array
// unless the reference was actually found, opened and analyzed.
// ============================================

export type CreativeReferenceCategory =
  | 'ui'
  | 'motion'
  | 'typography'
  | 'transition'
  | 'composition'
  | 'product'
  | 'commercial'
  | 'saas'
  | 'explainer'

export type CreativeReference = {
  id: string
  source: string
  url: string
  category: CreativeReferenceCategory
  visualMechanism: string
  composition: string
  camera: string
  motion: string
  typography: string
  timing: string
  colorStrategy: string
  reusablePattern: string
  license?: string | undefined
  notes: string
}

export type CreativeDNA = {
  referenceId: string
  composition: string
  visualMechanism: string
  camera: {
    movement: string
    framing: string
  }
  motion: {
    entrance: string
    interaction: string
    exit: string
  }
  typography: string
  pacing: string
  colorTreatment: string
  adaptation: {
    copy: string
    brand: string
    product: string
    timing: string
  }
}

/**
 * Permanent, append-only registry of creative references. Registering a real
 * reference is required before any new Component/Transition (NO NEW UI /
 * NO NEW TRANSITION policies) and before any final render.
 */
export const CREATIVE_REFERENCES: CreativeReference[] = []
