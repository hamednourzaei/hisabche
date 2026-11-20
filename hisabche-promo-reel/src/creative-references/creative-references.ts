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
export const CREATIVE_REFERENCES: CreativeReference[] = [
  {
    id: 'ref-square-offline-payments',
    source: 'Square Support Center — Process offline payments',
    url: 'https://squareup.com/help/us/en/article/7777-process-card-payments-with-offline-mode',
    category: 'product',
    visualMechanism:
      'Offline-state banner + pending transaction queue + automatic upload on reconnect',
    composition:
      'Top notification banner with a reconnect countdown; the checkout task continues unchanged; pending items accumulate in transaction history',
    camera: 'Static product UI, no camera move; state changes in place',
    motion:
      'Banner appears on disconnect; pending payments queue; on reconnect a confirmation notification fires and the queue uploads automatically',
    typography:
      'Functional system labels and short status words (pending / processing), high legibility',
    timing:
      'Event-driven: disconnect -> banner; reconnect -> auto upload -> confirmation; no manual step required',
    colorStrategy:
      'Neutral product surface with one warning accent for offline and a success accent for the upload',
    reusablePattern:
      'Show the crisis as a state banner, keep the core selling task running, then flush the queued items to success on reconnect',
    license: 'Mechanism analysis only (first-party documentation)',
    notes:
      'Opened and analyzed this session. Confirms offline POS keeps accepting payments during an outage and auto-syncs on reconnect — the exact mechanism behind OfflineSyncIndicator. No UI invented; mechanism reused.',
  },
  {
    id: 'ref-aeon-shortform-hook-cta',
    source: 'Project Aeon — A Guide to Short Form Video Marketing That Actually Works',
    url: 'https://project-aeon.com/blogs/short-form-video-marketing',
    category: 'commercial',
    visualMechanism:
      'Scroll-stopping opening line + on-screen text for mute viewers + explicit comment-keyword CTA',
    composition:
      'Vertical 9:16; hook in the first seconds; on-screen text carries the message; end card asks a pointed question',
    camera: 'n/a (editorial guidance, not a single film)',
    motion:
      'Recommends animating a quote or surprising stat as kinetic typography for shareable text video',
    typography: 'Bold readable on-screen text; captions that hook and hold',
    timing:
      'Split-second opening decision; CTA at the end; reply to comments within the first hour to boost reach',
    colorStrategy: 'Platform-native, high contrast for mute viewing',
    reusablePattern:
      'Open in medias res with a pointed line; animate a surprising stat as kinetic type; close with a specific comment-keyword CTA',
    license: 'Technique only (public blog)',
    notes:
      'Opened and analyzed this session. Backs hook-1 pattern interrupt, the kinetic mid-hook, and the dual comment-keyword CTA. Cites ~92% mute mobile viewing -> on-screen text is mandatory.',
  },
  {
    id: 'ref-linear-dark-product-craft',
    source: 'Linear — homepage product development system',
    url: 'https://linear.app',
    category: 'saas',
    visualMechanism:
      'Dark high-craft product UI; staggered issue rows with status badges; dense functional labels',
    composition:
      'Centered dark stage; list rows of icon + short label + status; minimal decorative text',
    camera: 'Static framing; motion lives in row state transitions, not the camera',
    motion: 'Rows stagger in; status badges update in place; speed-first micro-interactions',
    typography: 'Tight sans, functional one-to-two-word labels, numeric ids, strong hierarchy',
    timing: 'Fast and purposeful; each row is a discrete beat',
    colorStrategy: 'Near-black canvas, restrained accent per status, zero neon clutter',
    reusablePattern:
      'Stagger a short list of functional rows with icons and status; keep labels to one or two words; one unified dark canvas',
    license: 'Mechanism analysis only (public marketing site)',
    notes:
      'Opened and analyzed this session. Backs the Stagger manual-rewrite list and the dark functional-label typography. Mechanism only; no snapshot reused.',
  },
  {
    id: 'ref-wikipedia-abacus-counting-frame',
    source: 'Wikipedia — Abacus',
    url: 'https://en.wikipedia.org/wiki/Abacus',
    category: 'composition',
    visualMechanism:
      'Counting frame: a 2D array of slidable beads on rods; each rod is one place/dimension; beads moved toward a beam are counted',
    composition:
      'Parallel rods in a frame; beads disjoint along each rod; the Russian schoty is oriented vertically with horizontal wires; middle beads a different colour to aid reading',
    camera: 'Static frontal view of the frame; no camera move',
    motion:
      'Beads slide monotonically along their rod to a counted position; a quick shake clears all beads back to rest',
    typography: 'Place-value labels under each rod; minimal',
    timing: 'Discrete bead moves; one operation can propagate across rods',
    colorStrategy: 'Neutral frame; two bead colours to aid reading (middle beads accent)',
    reusablePattern:
      'Represent each ledger dimension as a rod; slide beads to post a value; one event can drive all rods together; the frame needs no power source (offline-native)',
    license: 'CC BY-SA (text); mechanism analysis only',
    notes:
      'Opened and analyzed this session. Facts used: beads-on-rods counting frame, each rod a place, schoty horizontal wires moved left to count, middle-bead accent colour, and that the abacus requires no electric power source — the authentic basis for the offline-first metaphor. Persian چرتکه attested since ~600 BC (Achaemenid).',
  },
  {
    id: 'ref-wikihow-abacus-bead-ops',
    source: 'wikiHow — How to Use an Abacus',
    url: 'https://www.wikihow.com/Use-an-Abacus',
    category: 'explainer',
    visualMechanism:
      'Step-by-step bead manipulation: push beads to the beam to count, column place values, 4/5 exchange, carry across columns',
    composition:
      'Columns with upper (5) and lower (1) decks; beads start at rest and move to the centre beam to count',
    camera: 'Static instructional framing',
    motion:
      'Thumb/index pushes beads up or down; sequential column operations left-to-right; a carry propagates to the next column',
    typography: 'Numbered steps and place-value labels',
    timing: 'One discrete push per bead; operations sequence across columns',
    colorStrategy: 'Instructional high contrast',
    reusablePattern:
      'Manual counting is a sequence of discrete bead pushes (one per column) — the visual of tedious manual re-entry; automation collapses the whole sequence into one synchronized sweep',
    license: 'Mechanism analysis only (public instructional article)',
    notes:
      'Opened and analyzed this session. Backs the manual rod-by-rod bead pushing (pain scene) versus the single synchronized sweep (resolution scene).',
  },
]
