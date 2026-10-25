// ============================================
// Reel 94 — «سه سؤال درباره‌ی تاریخ انقضا» (L1.09 of docs/100-VIDEO-PLAN.md) · 33 s
//
// No narration: the text is the content, so there is no subtitle bar and nothing is said twice.
// Three short questions on paper — each answered by one cut of the SAME real recording of the
// product's page «انقضا و بچ» (expiry.* in the app's catalogue):
//   ۱ کدام کالا نزدیک انقضاست؟   → the states «منقضی / نزدیک انقضا / سالم»
//   ۲ چند روز مانده؟              → the column «روز باقی‌مانده»
//   ۳ ارزش کالای منقضی چقدر؟      → the card «ارزش کالای منقضی» («در ترازنامه هست، قابل فروش نیست»)
// then the three in one line, and the ask. The last half second is frame 0 again.
//
// The page is not covered by any earlier reel (reel 79 mentions an expiry alarm in passing); see
// docs/OVERLAP-AUDIT.md. Each shot is a `product-capture` scene: a real recording made by the owner,
// kept OUTSIDE the repository (scripts/product-capture.mjs). Until it exists the preview says so and
// the export refuses this reel (blockedBy: 'PRODUCT_CAPTURE'). There is no stand-in.
//
// Why 33 s (owner: every reel > 30 s, docs/RUNTIME-AUDIT.md): the length is the three proofs and
// the recap — nothing is held or slowed to reach it.
// Blueprint and rationale: docs/scenarios/L1.09-three-questions-about-expiry.md
// ============================================

import type { Cue, Reel, SceneSpec } from '../engine/types'
import {
  QuestionOneScene,
  QuestionThreeScene,
  QuestionTwoScene,
  RecapScene,
  SaveScene,
  ThreeHookScene,
} from '../scenes/three-questions'
import { sequence, total } from './shared'

/**
 * The recording this reel shows (one file, three cuts): the product page, and for each cut the
 * second it starts at, the product's own label, and the state the screen must show.
 * Named once here; `scripts/capture-manifest.mjs` lists it for the owner.
 */
export const REEL_94_CAPTURE = {
  file: 'expiry-batches.mp4',
  route: '/expiry',
  cuts: {
    near: {
      trimStart: 0,
      label: 'نزدیک انقضا',
      screenState:
        'The page «انقضا و بچ» with batches in different states: «منقضی», «نزدیک انقضا», «سالم» all visible (0–5 s of the recording).',
    },
    days: {
      trimStart: 5,
      label: 'روز باقی‌مانده',
      screenState:
        'The same page, the column «روز باقی‌مانده» in view for at least three batches (5–10 s of the recording).',
    },
    value: {
      trimStart: 10,
      label: 'ارزش کالای منقضی',
      screenState:
        'The same page, the card «ارزش کالای منقضی» with its line «در ترازنامه هست، قابل فروش نیست» (10–15 s of the recording). Test data only; the whole recording ≥ 15 s.',
    },
  },
} as const

const whooshThenPops = (): Cue[] => [
  { at: 0.02, kind: 'whoosh' },
  { at: 0.14, kind: 'pop' },
  { at: 0.48, kind: 'pop' },
]

const capture = (
  cut: (typeof REEL_94_CAPTURE.cuts)[keyof typeof REEL_94_CAPTURE.cuts],
): SceneSpec => ({
  kind: 'product-capture',
  theme: 'paper-pocket',
  file: REEL_94_CAPTURE.file,
  route: REEL_94_CAPTURE.route,
  trimStart: cut.trimStart,
  label: cut.label,
  screenState: cut.screenState,
  // The paper of the question scenes, so the proof sits on the same stage.
  stage: { background: '#f2efe6', ink: '#16150f' },
})

const scenes = sequence(
  [
    // 1 (0–3s) — frame 0 is already the number three; then «about the expiry date».
    {
      dur: 3,
      spec: {
        kind: 'bespoke',
        theme: 'paper-pocket',
        component: ThreeHookScene,
        cues: [
          { at: 0.1, kind: 'pop' },
          { at: 1.5, kind: 'pop' },
        ] as Cue[],
      },
      vo: '',
    },
    // 2 (3–6s) question one · (6–11s) its proof.
    {
      dur: 3,
      spec: {
        kind: 'bespoke',
        theme: 'paper-pocket',
        component: QuestionOneScene,
        cues: whooshThenPops(),
      },
      vo: '',
    },
    { dur: 5, spec: capture(REEL_94_CAPTURE.cuts.near), vo: '' },
    // 3 (11–14s) question two · (14–19s) its proof.
    {
      dur: 3,
      spec: {
        kind: 'bespoke',
        theme: 'paper-pocket',
        component: QuestionTwoScene,
        cues: whooshThenPops(),
      },
      vo: '',
    },
    { dur: 5, spec: capture(REEL_94_CAPTURE.cuts.days), vo: '' },
    // 4 (19–22s) question three · (22–27s) its proof.
    {
      dur: 3,
      spec: {
        kind: 'bespoke',
        theme: 'paper-pocket',
        component: QuestionThreeScene,
        cues: whooshThenPops(),
      },
      vo: '',
    },
    { dur: 5, spec: capture(REEL_94_CAPTURE.cuts.value), vo: '' },
    // 5 (27–30s) — the three answers in one line.
    {
      dur: 3,
      spec: {
        kind: 'bespoke',
        theme: 'paper-pocket',
        component: RecapScene,
        cues: [
          { at: 0.02, kind: 'whoosh' },
          { at: 0.2, kind: 'pop' },
          { at: 0.65, kind: 'pop' },
          { at: 1.1, kind: 'pop' },
        ] as Cue[],
      },
      vo: '',
    },
    // 6 (30–33s) — the ask; the last half second is frame 0 again, so the reel loops.
    {
      dur: 3,
      spec: {
        kind: 'bespoke',
        theme: 'paper-pocket',
        component: SaveScene,
        cues: [
          { at: 0.02, kind: 'whoosh' },
          { at: 0.1, kind: 'pop' },
        ] as Cue[],
      },
      vo: '',
    },
  ],
  { noZoom: true },
)

export const reel94: Reel = {
  id: '94',
  title: 'سه سؤال درباره‌ی تاریخ انقضا',
  duration: total(scenes),
  scenes,
  theme: 'paper-pocket',
  musicMood: 'calm',
  noZoom: true,
}
