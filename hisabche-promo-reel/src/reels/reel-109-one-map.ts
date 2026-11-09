// ============================================
// Reel #109 — «نقشه‌ی یکپارچه‌ی کسب‌وکار» (The One Workspace)
//
// Topic: the market's need for one comprehensive business workspace —
// از جامع، به حسابچه. The film speaks the product's own visual language
// (graphite glass, hairlines, mono digits, one indigo accent) instead of a
// metaphor, so every beat is a real UI state the owner recognises.
//
// Art direction: cinematic-obsidian product surfaces / data-flow-matrix.
// Distinct from 107 (hollow blueprint), 108 (radar telemetry) and 104–106
// (lanes, plates, rope): here the canvas holds the product itself.
//
// Guardrails honoured: no camera zoom (noZoom), no decorative divider,
// ≤ 6 on-stage words, 24px+ safe margins, dark theme, deterministic math,
// no currency names, no claim beyond the documented five-record invoice.
// No voiceover file yet: PROVISIONAL_CADENCE_MODEL_ACTIVE.
// ============================================

import type { Cue, Reel } from '../engine/types'
import { sequence, total } from './shared'
import {
  BrandCurtainScene,
  FourAnswersScene,
  InvoiceFanoutScene,
  MergeToOneScene,
  OneScreenScene,
  SystemMapScene,
} from '../scenes/one-map'

const theme = 'financial-intelligence' as const

const scenes = sequence(
  [
    // 1 (0.00–5.50) — the same question gets four different answers
    {
      dur: 5.5,
      spec: {
        kind: 'bespoke',
        theme,
        component: FourAnswersScene,
        cues: [
          { at: 0.05, kind: 'titleHit' },
          { at: 0.16, kind: 'pop' },
          { at: 0.28, kind: 'pop' },
          { at: 0.4, kind: 'pop' },
          { at: 0.52, kind: 'pop' },
          { at: 4.3, kind: 'alert' },
        ] as Cue[],
      },
      vo: 'چهار جا، چهار جواب؛ سود این ماه من چقدره؟',
    },

    // 2 (5.50–12.00) — the four answers fold into one surface
    {
      dur: 6.5,
      spec: {
        kind: 'bespoke',
        theme,
        component: MergeToOneScene,
        cues: [
          { at: 0.12, kind: 'whoosh' },
          { at: 1.15, kind: 'majorReveal' },
          { at: 2.0, kind: 'chime' },
          { at: 3.0, kind: 'sync' },
        ] as Cue[],
      },
      vo: 'همه‌شون که یه جا جمع بشن، جواب یکی می‌شه.',
    },

    // 3 (12.00–19.00) — one invoice row, five records at once
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme,
        component: InvoiceFanoutScene,
        cues: [
          { at: 0.15, kind: 'cardEnter' },
          { at: 1.0, kind: 'cardThock' },
          { at: 1.28, kind: 'tick' },
          { at: 1.42, kind: 'tick' },
          { at: 1.56, kind: 'tick' },
          { at: 1.7, kind: 'tick' },
          { at: 1.84, kind: 'tick' },
          { at: 2.0, kind: 'success' },
        ] as Cue[],
      },
      vo: 'یه فاکتور بزنی؛ پنج سند هم‌زمان می‌خوره.',
    },

    // 4 (19.00–26.00) — the five records are one connected system
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme,
        component: SystemMapScene,
        cues: [
          { at: 0.3, kind: 'dataFlow' },
          { at: 0.9, kind: 'precisionSequence' },
          { at: 3.0, kind: 'insightReveal' },
          { at: 4.6, kind: 'sync' },
        ] as Cue[],
      },
      vo: 'این پنج تا از هم جدا نیستن؛ یه سیستم کار می‌کنن.',
    },

    // 5 (26.00–33.00) — the whole business on one screen
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme,
        component: OneScreenScene,
        cues: [
          { at: 0.1, kind: 'softTransition' },
          { at: 0.4, kind: 'cardEnter' },
          { at: 1.5, kind: 'dataFlow' },
          { at: 2.4, kind: 'financialMilestone' },
          { at: 3.0, kind: 'tick' },
        ] as Cue[],
      },
      vo: 'حالا کل کسب‌وکار، روی یه صفحه.',
    },

    // 6 (33.00–42.00) — the quiet brand curtain; CTA holds ≥ 3.0s
    {
      dur: 9,
      spec: {
        kind: 'bespoke',
        theme,
        component: BrandCurtainScene,
        cues: [
          { at: 0.1, kind: 'softTransition' },
          { at: 0.45, kind: 'cinematicReveal' },
          { at: 2.45, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'از جامع، به حسابچه؛ همین امروز شروع کن.',
    },
  ],
  { noZoom: true },
)

export const reel109: Reel = {
  id: '109',
  title: 'نقشه‌ی یکپارچه‌ی کسب‌وکار — از جامع به حسابچه',
  duration: total(scenes),
  theme,
  noZoom: true,
  musicMood: 'uplifting',
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'یک سؤال ساده — سود این ماه — چهار جواب مختلف دارد؛ هر ابزار یک عدد می‌دهد.',
    oldWorkflow: 'اکسل، دفتر، کاغذ و یادداشت گوشی؛ چهار جا، چهار عدد.',
    friction: 'تا وقتی عددها از یک جا نیایند، هیچ‌کدام قابل تصمیم نیستند.',
    hisabcheAction:
      'چهار جواب در یک سطح جمع می‌شوند و یک عدد می‌ماند؛ یک فاکتور با یک کلیک پنج سند می‌نویسد.',
    automatedResult: 'انبار، صندوق، دفتر، طلب و سود همان لحظه ثبت می‌شوند و به هم وصل‌اند.',
    businessOutcome: 'کل کسب‌وکار روی یک صفحه، زنده و قابل تصمیم.',
    emotionalPayoff: 'عدد واحد، آرامش واحد.',
    cta: 'از جامع، به حسابچه — hisabche.com',
    selectedOperators: [
      'FourDisagreeingAnswers',
      'AnswerMergeSurface',
      'InvoiceConfirmFanout',
      'SystemMapPulse',
      'OneWorkspaceScreen',
      'QuietBrandCurtain',
    ],
  },
  scenes,
}
