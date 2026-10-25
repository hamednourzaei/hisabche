// src/data/narrative-grammars.ts

export type NarrativeGrammarDef = {
  id: string
  name: string
  description: string
  sceneOrder: string[]
  example: string
}

export const NARRATIVE_GRAMMARS: NarrativeGrammarDef[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Hook -> Problem -> Cause -> Solution -> CTA',
    sceneOrder: ['hook', 'problem', 'cause', 'solution', 'compare', 'cta'],
    example: 'Standard product pitch',
  },
  {
    id: 'inverted',
    name: 'Inverted',
    description: 'Outcome -> Why -> Comparison -> Hook -> CTA',
    sceneOrder: ['outcome', 'why', 'comparison', 'hook', 'cta'],
    example: 'Show result first, then explain',
  },
  {
    id: 'story',
    name: 'Story',
    description: 'Character -> Crisis -> Discovery -> Solution -> CTA',
    sceneOrder: ['character', 'crisis', 'discovery', 'solution', 'cta'],
    example: 'Human-centered narrative',
  },
  {
    id: 'interrogative',
    name: 'Interrogative',
    description: 'Question -> Question -> Question -> Answer -> CTA',
    sceneOrder: ['question', 'question', 'question', 'answer', 'cta'],
    example: 'Build curiosity through questions',
  },
  {
    id: 'pov',
    name: 'POV',
    description: 'First-person, no narrator',
    sceneOrder: ['pov-hook', 'tension', 'reveal', 'product', 'cta'],
    example: 'Viewer is the protagonist',
  },
  {
    id: 'documentary',
    name: 'Documentary',
    description: 'Fake doc, timestamps, voiceover',
    sceneOrder: ['timestamp', 'event', 'voiceover', 'product', 'cta'],
    example: 'Documentary style',
  },
  {
    id: 'comedy',
    name: 'Comedy',
    description: 'Setup -> tension -> silence -> punchline',
    sceneOrder: ['setup', 'tension', 'silence', 'punchline', 'cta'],
    example: 'Humor-driven',
  },
  {
    id: 'pure-ui',
    name: 'Pure UI',
    description: 'Only product, cursor, data',
    sceneOrder: ['hook', 'screen-recording', 'data-change', 'outcome', 'cta'],
    example: 'Product does the talking',
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Visual metaphor, no cards',
    sceneOrder: ['visual-metaphor', 'tension', 'reveal', 'product', 'cta'],
    example: 'Metaphor-driven',
  },
]

export function getGrammar(id: string): NarrativeGrammarDef | undefined {
  return NARRATIVE_GRAMMARS.find((g) => g.id === id)
}

export function grammarsDiffer(a: string, b: string): boolean {
  return a !== b
}
