// ============================================
// Reel 96 — «مانده‌ی بانک با مانده‌ی دفاتر نمی‌خواند» (L2.22 of docs/100-VIDEO-PLAN.md) · 35 s
//
// A one-gap lesson on a chalkboard: bank 900, books 1٬000, gap 100 — money the books know about
// and the bank has not seen yet; 900 + 100 = 1٬000. Every figure is labelled «نمونه» (illustrative).
// The one real shot is the product's own page «مغایرت‌گیری بانکی»: «مانده‌ی بانک / مانده‌ی دفاتر /
// اختلاف», and suggestions a person confirms one by one — «تأیید گروهی وجود ندارد».
// Silent edition (no recorded voice yet): the text on the board is the content, ≤ 6 words at a time.
//
// ⚠️ `bank-reconciliation.mp4` is a real recording by the owner, outside the repository
// (docs/CAPTURE-MANIFEST.md). Missing → the export refuses (PRODUCT_CAPTURE).
// Blueprint: docs/scenarios/L2.22-bank-gap-in-chalk.md
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  BOARD,
  BankScene,
  BooksScene,
  CHALK,
  CauseScene,
  GapScene,
  RuleScene,
  ShareScene,
} from '../scenes/bank-lesson'
import { sequence, total } from './shared'

export const REEL_96_CAPTURE = {
  file: 'bank-reconciliation.mp4',
  route: '/accounting?tab=treasury',
  label: 'مغایرت‌گیری بانکی',
  screenState:
    'The page «مغایرت‌گیری بانکی» with an imported statement: the summary «مانده‌ی بانک / مانده‌ی دفاتر / اختلاف», then a suggestion in «پیشنهادهای تطبیق» confirmed with «تأیید این تطبیق». Test data only; ≥ 7 s.',
} as const

const bespoke = (component: typeof BankScene, cues: Cue[]) =>
  ({ kind: 'bespoke', theme: 'financial-intelligence', component, cues }) as const

const scenes = sequence(
  [
    // 1 (0–4s) — frame 0 is already the figure.
    {
      dur: 4,
      spec: bespoke(BankScene, [
        { at: 0.1, kind: 'pop' },
        { at: 0.5, kind: 'markerScribble' },
      ]),
      vo: '',
    },
    // 2 (4–9s) — the books' balance.
    {
      dur: 5,
      spec: bespoke(BooksScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.4, kind: 'markerScribble' },
        { at: 0.95, kind: 'pop' },
      ]),
      vo: '',
    },
    // 3 (9–15s) — the gap.
    {
      dur: 6,
      spec: bespoke(GapScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.25, kind: 'markerScribble' },
        { at: 1.55, kind: 'markerScribble' },
        { at: 3.0, kind: 'insightReveal' },
      ]),
      vo: '',
    },
    // 4 (15–21s) — what the gap is.
    {
      dur: 6,
      spec: bespoke(CauseScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.25, kind: 'markerScribble' },
        { at: 1.25, kind: 'markerScribble' },
        { at: 3.25, kind: 'pop' },
      ]),
      vo: '',
    },
    // 5 (21–28s) — the product's own page.
    {
      dur: 7,
      spec: {
        kind: 'product-capture',
        theme: 'financial-intelligence',
        file: REEL_96_CAPTURE.file,
        route: REEL_96_CAPTURE.route,
        label: REEL_96_CAPTURE.label,
        screenState: REEL_96_CAPTURE.screenState,
        stage: { background: BOARD, ink: CHALK },
      },
      vo: '',
    },
    // 6 (28–32s) — the rule.
    {
      dur: 4,
      spec: bespoke(RuleScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.25, kind: 'markerScribble' },
        { at: 1.15, kind: 'markerScribble' },
        { at: 3.05, kind: 'pop' },
      ]),
      vo: '',
    },
    // 7 (32–35s) — the ask; the last half second is frame 0 again.
    {
      dur: 3,
      spec: bespoke(ShareScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.12, kind: 'pop' },
      ]),
      vo: '',
    },
  ],
  { noZoom: true },
)

export const reel96: Reel = {
  id: '96',
  title: 'مانده‌ی بانک با مانده‌ی دفاتر نمی‌خواند',
  duration: total(scenes),
  scenes,
  theme: 'financial-intelligence',
  musicMood: 'calm',
  noZoom: true,
}
