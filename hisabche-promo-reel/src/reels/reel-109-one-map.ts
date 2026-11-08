// ============================================
// Reel #109 — «نقشه‌ی یکپارچه‌ی کسب‌وکار» (The One Map of the Business)
//
// Topic: the owner's need for one comprehensive business-management
// software — از جامع، به حسابچه — market-stitched without any AI-slop
// framing: every beat is a market-true consequence, never a product pitch.
//
// Art direction: Brass Compass Observatory (procedural-spatial, ink + brass
// + patina) — new to the studio; the last three reels were character-rig,
// paper-galaxy and sonar-radar languages.
//
// The five-record claim (one invoice → انبار، صندوق، دفتر، طلب، سود) is the
// product truth documented in docs/prompt-library/README.md §3. Camerawork
// is zoom-free (noZoom), every scene holds its climax ≥ 1.2s, and the CTA
// holds ≥ 3.0s at full opacity. No voiceover file yet:
// PROVISIONAL_CADENCE_MODEL_ACTIVE.
// ============================================

import type { Cue, Reel } from '../engine/types'
import { sequence, total } from './shared'
import {
  ConstellationMapScene,
  CurtainBrandScene,
  FragmentVacuumScene,
  InvoiceStampsScene,
  NeedleScene,
  ToolToppleScene,
} from '../scenes/one-map'

const theme = 'financial-intelligence' as const

const scenes = sequence(
  [
    // 1 (0.00–5.50) — a brass compass pulled by four duties at once
    {
      dur: 5.5,
      spec: {
        kind: 'bespoke',
        theme,
        component: NeedleScene,
        cues: [
          { at: 0.05, kind: 'titleHit' },
          { at: 0.25, kind: 'typewriterClick' },
          { at: 0.85, kind: 'typewriterClick' },
          { at: 1.45, kind: 'typewriterClick' },
          { at: 2.05, kind: 'typewriterClick' },
          { at: 4.2, kind: 'alert' },
        ] as Cue[],
      },
      vo: 'فروش، انبار، نسیه، حقوق؛ سوزن قطب‌نما کدوم سمت بره؟',
    },

    // 2 (5.50–12.00) — the old trio topples and is stamped obsolete
    {
      dur: 6.5,
      spec: {
        kind: 'bespoke',
        theme,
        component: ToolToppleScene,
        cues: [
          { at: 1.1, kind: 'impact' },
          { at: 1.65, kind: 'typewriterClick' },
          { at: 2.25, kind: 'impact' },
          { at: 2.8, kind: 'typewriterClick' },
          { at: 3.4, kind: 'impact' },
          { at: 3.95, kind: 'typewriterClick' },
        ] as Cue[],
      },
      vo: 'اکسل، دفتر، کاغذ؛ هر سه‌تا با هم نمی‌خونن.',
    },

    // 3 (12.00–19.00) — scattered fragments vacuum into one brick
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme,
        component: FragmentVacuumScene,
        cues: [
          { at: 0.7, kind: 'whoosh' },
          { at: 1.7, kind: 'whoosh' },
          { at: 2.7, kind: 'whoosh' },
          { at: 3.9, kind: 'majorReveal' },
          { at: 4.06, kind: 'success' },
        ] as Cue[],
      },
      vo: 'ارقام و قلم‌ها رو یکجا کن؛ همه‌چیز روشن می‌شه.',
    },

    // 4 (19.00–26.00) — one invoice, five simultaneous records
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme,
        component: InvoiceStampsScene,
        cues: [
          { at: 0.25, kind: 'cardThock' },
          { at: 1.1, kind: 'impact' },
          { at: 1.95, kind: 'cardThock' },
          { at: 2.8, kind: 'impact' },
          { at: 3.65, kind: 'cardThock' },
          { at: 4.5, kind: 'cash' },
        ] as Cue[],
      },
      vo: 'یه فاکتور بزنی؛ پنج سند هم‌زمان می‌خوره.',
    },

    // 5 (26.00–33.00) — the five records become one map
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme,
        component: ConstellationMapScene,
        cues: [
          { at: 0.3, kind: 'dataFlow' },
          { at: 1.2, kind: 'precisionSequence' },
          { at: 3.0, kind: 'insightReveal' },
          { at: 5.2, kind: 'sync' },
        ] as Cue[],
      },
      vo: 'شاخه‌ها به هم وصالن؛ نقشه‌ی کامل، یکجا.',
    },

    // 6 (33.00–42.00) — the quiet brand curtain; CTA holds ≥ 3.0s
    {
      dur: 9,
      spec: {
        kind: 'bespoke',
        theme,
        component: CurtainBrandScene,
        cues: [
          { at: 0.1, kind: 'softTransition' },
          { at: 0.6, kind: 'cinematicReveal' },
          { at: 2.7, kind: 'ctaResolution' },
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
  musicMood: 'tense',
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'مدیر کسب‌وکار задачаها را در چهار جا دنبال می‌کند (فروش، انبار، نسیه، حقوق) و هیچ عدد یکپارچه‌ای ندارد.',
    oldWorkflow: 'اکسل + دفتر دستی + برگه‌های کاغذی؛ هر سه‌تا با هم نمی‌خوانند.',
    friction: 'پراکندگی داده — پاسخ به یک سؤال ساده سه دفتر را زیر و رو می‌کند.',
    hisabcheAction: 'یکجا کردن دادهها روی یک بوم؛ یک فاکتور هم‌زمان پنج سند را شروع می‌کند.',
    automatedResult: 'انبار، صندوق، دفتر، طلب مشتری و سود در همان لحظه ثبت می‌شوند.',
    businessOutcome: 'نقشه‌ی کامل کسب‌وکار، یکجا — تصمیم بدون زیر و رو کردن سه دفتر.',
    emotionalPayoff: 'سوزن قطب‌نما بالاخره یک سمت می‌ایستد؛ آرامش یکجایی.',
    cta: 'از جامع، به حسابچه — hisabche.com',
    selectedOperators: [
      'BrassNeedleTension',
      'ToolToppleTrio',
      'FragmentVacuumFunnel',
      'InvoiceStampQuintet',
      'BazaarConstellationHub',
      'QuietBrandCurtain',
    ],
  },
  scenes,
}
