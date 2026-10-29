// ============================================
// Reel 98 — «کدام فروش راکد ماند؟» (L3.05 of docs/100-VIDEO-PLAN.md) · 35 s
//
// A list on a lamp-lit desk, every row lit; months pass and the rows go quiet one by one; the
// question — «کسی پیگیری کرد؟». Then the one real thing: the product's tab «پیگیری و کمپین» with its
// sections «پیگیری فروش» and «فرصت‌های راکد». No claim about what a follow-up recovers.
// Silent edition: no recorded voice yet; ≤ 6 words on stage at a time.
//
// ⚠️ `customers-outreach.mp4` is a real recording by the owner, outside the repository
// (docs/CAPTURE-MANIFEST.md). Missing → the export refuses (PRODUCT_CAPTURE).
// Blueprint: docs/scenarios/L3.05-which-sale-went-quiet.md
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  AskScene,
  LinkScene,
  ListScene,
  OUTREACH_CAPTURE,
  OutreachRadarScene,
  ProductWordsScene,
  QuietScene,
} from '../scenes/quiet-customers'
import { sequence, total } from './shared'

export const REEL_98_CAPTURE = {
  ...OUTREACH_CAPTURE,
  label: 'فرصت‌های راکد',
  screenState:
    'The customers page, tab «پیگیری و کمپین»: the sections «پیگیری فروش» and «فرصت‌های راکد», with at least one stale opportunity listed. Test data only; ≥ 9 s.',
} as const

const scene = (component: typeof ListScene, cues: Cue[]) =>
  ({ kind: 'bespoke', theme: 'midnight-gold', component, cues }) as const

const scenes = sequence(
  [
    // 1 (0–5s) — the list; frame 0 is every row lit.
    {
      dur: 5,
      spec: scene(ListScene, [
        { at: 0.6, kind: 'paperRustle' },
        { at: 0.75, kind: 'pop' },
      ]),
      vo: 'کدام مشتری وفادار مغازه، بی‌صدا و بدون هیچ هشداری از چرخهٔ خرید خارج شد؟',
    },
    // 2 (5–11s) — months pass: the rows go quiet.
    {
      dur: 6,
      spec: scene(QuietScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.35, kind: 'pop' },
        { at: 1.5, kind: 'paperRustle' },
        { at: 3.0, kind: 'paperRustle' },
      ]),
      vo: 'ماه‌ها گذشت و سفارش‌ها یکی پس از دیگری متوقف شدند، بدون این‌که متوجه رفتنشان شوید.',
    },
    // 3 (11–15s) — the question.
    {
      dur: 4,
      spec: scene(AskScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.3, kind: 'pop' },
      ]),
      vo: 'آیا کسی پیگیری کرد؟ شش مشتری قدیمی رفتند، چون هیچ سیستمی این سکوت را یادآوری نکرد.',
    },
    // 4 (15–24s) — the product's own tab.
    {
      dur: 9,
      spec: scene(OutreachRadarScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.5, kind: 'precisionSequence' },
        { at: 3.2, kind: 'chime' },
      ]),
      vo: 'در حسابچه، فرصت‌های راکد قبل از اینکه بسوزند شناسایی شده و پیگیری مناسب پیشنهاد می‌شود.',
    },
    // 5 (24–31s) — its three names.
    {
      dur: 7,
      spec: scene(ProductWordsScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.35, kind: 'pop' },
        { at: 1.45, kind: 'pop' },
        { at: 2.55, kind: 'pop' },
      ]),
      vo: 'پیگیری و کمپین، رصد فرصت‌های راکد و احیای فروش؛ سه ابزار برای پایان دادن به مرگ خاموش مشتریان.',
    },
    // 6 (31–35s) — the ask; the last half second is the list again.
    {
      dur: 4,
      spec: scene(LinkScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.12, kind: 'pop' },
      ]),
      vo: 'حسابچه؛ نگذار مشتریان قدیمی بی‌صدا ناپدید شوند. همین حالا رایگان شروع کن.',
    },
  ],
  { noZoom: true },
)

export const reel98: Reel = {
  id: '98',
  title: 'کدام فروش راکد ماند؟',
  duration: total(scenes),
  scenes,
  theme: 'midnight-gold',
  musicMood: 'calm',
  noZoom: true,
}
