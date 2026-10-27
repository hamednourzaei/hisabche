// ============================================
// Reel 107 — «شکل نیاز» (The Shape of the Need)
//
// This film sells the NEED for ERP/CRM, not a number. There is not a single
// digit on screen for the whole 42 seconds.
//
// Frame 0 is a merchant's shop already drawn as a hollow blueprint — counter,
// shelves, and one empty dashed slot where the answer should be. Then the
// second branch opens and the shop splits into two islands that never talk.
// A customer walks out and nobody can say why. Then the SAME blueprint is
// built solid: one surface, one line, four nodes answering in order.
//
// Own architecture: hollow outline → solid build. Nothing shared with
// 104 (lanes), 105 (plates) or 106 (rope).
//
// Governance:
// - one focal stage per scene, subtitle is the only spoken text
// - no divider line, no zoom (noZoom: true), nothing within 24px of the edge
// - not one number on stage; the argument is the need, never arithmetic
// - audio is cue-based on the bespoke scenes (no word-sync claims)
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  BuiltSolidScene,
  CustomerLeavesScene,
  EmptySlotScene,
  NeedCtaScene,
  OneLineScene,
  TwoHalvesScene,
} from '../scenes/need-blueprint'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 (0.00–7.00s) — Frame 0: a hollow shop with one empty slot
    {
      dur: 7.0,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: EmptySlotScene,
        cues: [
          { at: 0.05, kind: 'markerScribble' },
          { at: 1.45, kind: 'alert' },
          { at: 2.3, kind: 'tick' },
        ] as Cue[],
      },
      vo: 'همه‌چیز سر جایش است، جز همان یک چیزی که باید همه را به هم وصل کند.',
    },

    // 2 (7.00–14.00s) — The second branch: two islands, not one shop
    {
      dur: 7.0,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: TwoHalvesScene,
        cues: [
          { at: 0.1, kind: 'softTransition' },
          { at: 0.35, kind: 'cardEnter' },
          { at: 1.3, kind: 'cardEnter' },
          { at: 3.1, kind: 'alert' },
        ] as Cue[],
      },
      vo: 'شعبه دوم که باز شد، دو جزیره شد؛ نه یک مغازه.',
    },

    // 3 (14.00–21.00s) — The customer walks away and nobody knows why
    {
      dur: 7.0,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: CustomerLeavesScene,
        cues: [
          { at: 0.15, kind: 'sceneTransition' },
          { at: 1.1, kind: 'whoosh' },
          { at: 2.7, kind: 'impact' },
          { at: 4.3, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'مشتری رفت و هیچ‌کس نفهمید چرا. کسی نپرسید، جایی ثبت نشد.',
    },

    // 4 (21.00–28.50s) — The same blueprint, built solid
    {
      dur: 7.5,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: BuiltSolidScene,
        cues: [
          { at: 0.15, kind: 'cinematicReveal' },
          { at: 1.25, kind: 'pop' },
          { at: 1.95, kind: 'pop' },
          { at: 2.65, kind: 'success' },
          { at: 3.6, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'حسابچه همان نقشه را می‌سازد: یک سطح، یک دفتر، و یک جای مشخص برای هر چیز.',
    },

    // 5 (28.50–35.50s) — One line answers the questions, in order
    {
      dur: 7.0,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: OneLineScene,
        cues: [
          { at: 0.1, kind: 'softTransition' },
          { at: 0.85, kind: 'dataFlow' },
          { at: 1.55, kind: 'tick' },
          { at: 2.25, kind: 'tick' },
          { at: 2.95, kind: 'sync' },
          { at: 3.7, kind: 'precisionSequence' },
        ] as Cue[],
      },
      vo: 'انبار، صندوق، طلب و دفتر از یک مسیر حرف می‌زنند؛ نه چهار دفتر جدا.',
    },

    // 6 (35.50–42.00s) — End card
    {
      dur: 6.5,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: NeedCtaScene,
        cues: [
          { at: 0.15, kind: 'chime' },
          { at: 2.2, kind: 'pop' },
          { at: 3.0, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'حسابچه؛ همان چیزی که مغازه‌ات کم دارد. همین حالا رایگان شروع کن.',
    },
  ],
  { noZoom: true },
)

export const reel107: Reel = {
  id: '107',
  title: 'شکل نیاز — حسابچه چه چیزی را کامل می‌کند',
  duration: total(scenes),
  scenes,
  theme: 'financial-intelligence',
  musicMood: 'tense',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'مغازه کار می‌کند، ولی هیچ‌کدام از بخش‌هایش به هم وصل نیست؛ و هیچ‌جا ثبت نمی‌شود که چه چیزی کم است.',
    oldWorkflow:
      'دفتر کاغذی برای نسیه، ذهن برای قفسه، و هیچ جای مشخصی برای این‌که مشتری چرا برنگشت.',
    friction:
      'با باز شدن شعبه دوم، مغازه به دو جزیره تبدیل می‌شود؛ و کسی نمی‌فهمد مشتری کجا را ترک کرد.',
    hisabcheAction:
      'همان نقشه را می‌سازد: یک سطح واحد، یک دفتر، و یک مسیر که انبار و صندوق و طلب و دفتر را به هم می‌بندد.',
    automatedResult:
      'هر بخش جای مشخص خودش را دارد و پرسش‌ها به‌ترتیب از همان یک مسیر جواب می‌گیرند.',
    businessOutcome:
      'مغازه از چند جزیره به یک سیستم واحد تبدیل می‌شود؛ پایه‌ی همان ERP و CRM که کار روزمره لازم دارد.',
    emotionalPayoff: 'این حس که جای خالی مغازه بالأخره پر شده است.',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'HollowBlueprintReveal',
      'TwoIslandSplit',
      'UnrecordedExit',
      'SolidBuildFill',
      'SinglePathNodes',
      'RingMarkClose',
    ],
  },
}
