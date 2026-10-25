// src/data/creative-moments.ts
// Bank of creative moments. Each reel must use >= 2 that were NOT used in the last 3 reels.

export type CreativeMoment = {
  id: string
  name: string
  description: string
  category: 'visual' | 'narrative' | 'audio' | 'typography' | 'interaction'
}

export const CREATIVE_MOMENTS: CreativeMoment[] = [
  {
    id: 'number-shatters',
    name: 'Number shatters',
    description: 'A large number breaks apart on screen.',
    category: 'visual',
  },
  {
    id: 'two-screens-merge',
    name: 'Two screens merge',
    description: 'Two UI panels slide together and fuse.',
    category: 'visual',
  },
  {
    id: 'light-from-point',
    name: 'Light from a point',
    description: 'A single point of light expands to reveal the scene.',
    category: 'visual',
  },
  {
    id: 'text-slides-rtl',
    name: 'Text slides RTL',
    description: 'Text enters from right to left with momentum.',
    category: 'typography',
  },
  {
    id: 'silence-beat',
    name: 'Silence beat',
    description: 'A deliberate pause with no motion or sound.',
    category: 'audio',
  },
  {
    id: 'hard-cut-reveal',
    name: 'Hard cut reveal',
    description: 'Abrupt cut to a contrasting image.',
    category: 'visual',
  },
  {
    id: 'freeze-frame',
    name: 'Freeze frame',
    description: 'Motion stops on a single frame for emphasis.',
    category: 'visual',
  },
  {
    id: 'cursor-proof',
    name: 'Cursor proof',
    description: 'A real cursor performs an action on real UI.',
    category: 'interaction',
  },
  {
    id: 'countdown-to-zero',
    name: 'Countdown to zero',
    description: 'A balance or counter animates to zero.',
    category: 'visual',
  },
  {
    id: 'paper-pile',
    name: 'Paper pile',
    description: 'Physical papers stack up then collapse.',
    category: 'visual',
  },
  {
    id: 'number-flip',
    name: 'Number flip',
    description: 'An odometer-style number flips to a new value.',
    category: 'typography',
  },
  {
    id: 'whisper-text',
    name: 'Whisper text',
    description: 'Small text appears quietly then grows.',
    category: 'typography',
  },
  {
    id: 'single-word-punch',
    name: 'Single word punch',
    description: 'One word fills the screen with impact.',
    category: 'typography',
  },
  {
    id: 'split-verdict',
    name: 'Split verdict',
    description: 'Screen splits into two contrasting outcomes.',
    category: 'visual',
  },
  {
    id: 'reverse-timeline',
    name: 'Reverse timeline',
    description: 'Events play backwards to reveal cause.',
    category: 'narrative',
  },
  {
    id: 'documentary-timestamp',
    name: 'Documentary timestamp',
    description: 'A timestamp anchors a real moment.',
    category: 'narrative',
  },
  {
    id: 'confession-line',
    name: 'Confession line',
    description: 'A single honest admission line.',
    category: 'narrative',
  },
  {
    id: 'comedy-pause',
    name: 'Comedy pause',
    description: 'A deliberate awkward pause for humor.',
    category: 'narrative',
  },
  {
    id: 'product-as-hero',
    name: 'Product as hero',
    description: 'The product itself is the visual centerpiece.',
    category: 'visual',
  },
  {
    id: 'data-breath',
    name: 'Data breath',
    description: 'Numbers gently pulse like breathing.',
    category: 'visual',
  },
  {
    id: 'before-after-wipe',
    name: 'Before/after wipe',
    description: 'A wipe transition reveals before vs after.',
    category: 'visual',
  },
  {
    id: 'negative-space-reveal',
    name: 'Negative space reveal',
    description: 'Empty space forms a shape or word.',
    category: 'visual',
  },
  {
    id: 'sound-as-signal',
    name: 'Sound as signal',
    description: 'A sound cue carries the meaning.',
    category: 'audio',
  },
  {
    id: 'no-music-beat',
    name: 'No-music beat',
    description: 'A beat with no music, only ambient.',
    category: 'audio',
  },
  {
    id: 'chat-bubble-cascade',
    name: 'Chat bubble cascade',
    description: 'Messages stack rapidly then resolve.',
    category: 'visual',
  },
  {
    id: 'receipt-unroll',
    name: 'Receipt unroll',
    description: 'A receipt unrolls from a printer.',
    category: 'visual',
  },
  {
    id: 'day-timeline',
    name: 'Day timeline',
    description: 'A 24-hour timeline of moments.',
    category: 'narrative',
  },
  {
    id: 'objection-then-answer',
    name: 'Objection then answer',
    description: 'Raise an objection, then answer it.',
    category: 'narrative',
  },
  {
    id: 'contrast-scale',
    name: 'Contrast scale',
    description: 'Two values shown at wildly different scales.',
    category: 'visual',
  },
  {
    id: 'single-focal-hold',
    name: 'Single focal hold',
    description: 'One element holds attention for 3+ seconds.',
    category: 'visual',
  },
]

export function validateCreativeMoments(moments: string[], previousMoments: string[][]): boolean {
  const newOnes = moments.filter((m) => !previousMoments.flat().includes(m))
  return newOnes.length >= 2
}

export function getMoment(id: string): CreativeMoment | undefined {
  return CREATIVE_MOMENTS.find((m) => m.id === id)
}
