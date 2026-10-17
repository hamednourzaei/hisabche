// ============================================
// Reel #56 — Word-Synchronized, Sentence-Driven Motion Graphics
//
// «دو شعبه داری؛ ولی کدوم یکی داره ضرر می‌سازه؟»
//
// A single unbroken glowing money-thread is the protagonist of the reel
// (continuous-line-traveler language on a kinetic-manifesto canvas):
// 1. Hook (0.0–4.6s): the thread splits into two branches; the combined sales
//    counter locks at 900M, then the central branch dips red across the zero
//    line — «ضرر می‌سازه!» (reveal 1.5s before the scene ends).
// 2. Concern (4.6–10.0s): the thread thins through four cost gates (630 + 130
//    + 80 + 20 = 860) until only a 40M residue survives — held from 3.9s.
// 3. Problem (10.0–16.0s): two parallel tracks under a dashed zero line; the
//    second branch stays green at +60 while the central branch crosses below
//    zero at −20 (dip + stamp held for the last 1.5s).
// 4. Solution (16.0–22.0s): brand anchored from t = 0; two branch P&L cards
//    split the truth, the 20M leak is flagged and the thread re-merges into
//    the final net-count up to 60M.
// 5. CTA (22.0–26.0s): the thread closes into an orbit around the cyan CTA
//    button — «حسابچه» / hisabche.com — held from 2.8s.
//
// Every figure is plain formatted (faNumber) with no hardcoded currency name.
// ============================================

import type { Reel } from '../engine/types'
import type { AlignmentLifecycleStatus, WordCue } from '../engine/speech-model'
import alignmentData from './alignments/reel-56-alignment.json'

function getSceneWords(sceneIndex: number, defaultWords: WordCue[]): WordCue[] {
  const alignedScene = alignmentData.scenes[sceneIndex]
  if (!alignedScene || !Array.isArray(alignedScene.words)) return defaultWords
  return defaultWords.map((defWord) => {
    const alignedWord = alignedScene.words.find((aw) => aw.word === defWord.word)
    if (!alignedWord) return defWord
    return {
      ...defWord,
      start: alignedWord.start,
      end: alignedWord.end,
      confidence: alignedWord.confidence,
    }
  })
}

const lifecycleStatus = alignmentData.alignmentStatus as AlignmentLifecycleStatus
const isProvisional = alignmentData.isProvisional
const alignmentSource = alignmentData.alignmentSource as
  | 'cadence-model'
  | 'whisper-asr'
  | 'whisper-ctc'
  | 'manual-operator-review'
  | 'external-unverified'
  | 'diagnostic-audio-only'
  | 'forced-aligner'
  | undefined
const confidence = alignmentData.confidence

export const reel56: Reel = {
  id: '56',
  title: 'دو شعبه داری؛ ولی کدوم یکی داره ضرر می‌سازه؟',
  duration: 26.0,
  theme: 'kinetic-manifesto',
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'دو شعبه با یک گزارش جمعی؛ فروش بالا دیده می‌شود اما ضرر پنهان یک شعبه هیچ‌وقت معلوم نمی‌شود',
    oldWorkflow:
      'نگاه به فروش تجمیعی هر دو شعبه و دفتر واحد بدون صورت سود و زیان جداگانه برای هر شعبه',
    friction:
      'شعبه مرکزی با فروش بالاتر، به دلیل اجاره و هزینه‌های سنگین‌تر ۲۰ میلیون زیر صفر است و کسی خبر ندارد',
    hisabcheAction:
      'گزارش لحظه‌ای سود و زیان هر شعبه با کسر خودکار بهای کالا، اجاره، حقوق و سایر هزینه‌ها',
    automatedResult:
      'شناسایی شعبه زیان‌ده، لو رفتن نشتی ۲۰ میلیونی و رساندن سود واقعی کل از ۴۰ به ۶۰ میلیون',
    businessOutcome:
      'تصمیم درست درباره اجاره، تخفیف و هزینه‌های هر شعبه و پایان خاموش کردن زیان پنهان',
    emotionalPayoff:
      'آرامش خاطر از دانستن اینکه کدام شعبه سود می‌سازد و کدام یک دارد سرمایه را می‌خورد',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'word-synchronized-choreography',
      'continuous-thread-tracing',
      'branch-zero-line-split',
      'leak-fray-detection',
      'loopback-cta-orbit',
    ],
  },
  scenes: [
    // ── Scene 1: Hook (0.0s – 4.6s) — «۹۰۰ میلیون فروش؛ ولی یه شعبت ضرر می‌سازه!»
    {
      start: 0.0,
      end: 4.6,
      vo: '۹۰۰ میلیون فروش؛ ولی یه شعبت ضرر می‌سازه!',
      spec: {
        kind: 'word-sync',
        actor: 'r56-hook-split',
        title: 'شکاف دو شعبه',
      },
      sentence: {
        text: '۹۰۰ میلیون فروش؛ ولی یه شعبت ضرر می‌سازه!',
        intent: 'هوک کشف ناخوشایند / فروش جمعی بالا در برابر ضرر پنهان یک شعبه',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(0, [
          {
            word: '۹۰۰',
            start: 0.2,
            end: 0.75,
            emphasis: true,
            action: 'combined-counter',
            sound: 'clockTickRapid',
          },
          { word: 'میلیون', start: 0.85, end: 1.2 },
          {
            word: 'فروش؛',
            start: 1.3,
            end: 1.85,
            emphasis: true,
            action: 'sales-lock',
            sound: 'cardThock',
          },
          { word: 'ولی', start: 2.05, end: 2.35 },
          { word: 'یه', start: 2.45, end: 2.7 },
          {
            word: 'شعبت',
            start: 2.75,
            end: 3.3,
            emphasis: true,
            action: 'branch-split',
            sound: 'cameraSwish',
          },
          {
            word: 'ضرر',
            start: 3.35,
            end: 3.7,
            emphasis: true,
            action: 'below-zero-dip',
            sound: 'cameraSwish',
          },
          {
            word: 'می‌سازه!',
            start: 3.75,
            end: 4.2,
            emphasis: true,
            action: 'loss-badge-pop',
            sound: 'cardThock',
          },
        ]),
        sentenceEnding: { at: 3.25, action: 'loss-hold', sound: 'softTransition' },
      },
    },

    // ── Scene 2: Escalation (4.6s – 10.0s) — «هزینه‌ها ۸۶۰ میلیون؛ فقط ۴۰ میلیون باقی می‌مونه!»
    {
      start: 4.6,
      end: 10.0,
      vo: 'هزینه‌ها ۸۶۰ میلیون؛ فقط ۴۰ میلیون باقی می‌مونه!',
      spec: {
        kind: 'word-sync',
        actor: 'r56-cost-waterfall',
        title: 'نشت هزینه‌ها در مسیر پول',
      },
      sentence: {
        text: 'هزینه‌ها ۸۶۰ میلیون؛ فقط ۴۰ میلیون باقی می‌مونه!',
        intent: 'تشدید تنش / کسر هزینه‌ها از فروش و ماندن ته‌مانده ناچیز',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(1, [
          {
            word: 'هزینه‌ها',
            start: 0.3,
            end: 0.95,
            emphasis: true,
            action: 'leak-gate',
            sound: 'cardThock',
          },
          {
            word: '۸۶۰',
            start: 1.1,
            end: 1.7,
            emphasis: true,
            action: 'cost-counter',
            sound: 'clockTickRapid',
          },
          { word: 'میلیون؛', start: 1.8, end: 2.25 },
          { word: 'فقط', start: 2.55, end: 2.85 },
          {
            word: '۴۰',
            start: 2.95,
            end: 3.45,
            emphasis: true,
            action: 'residue-counter',
            sound: 'financialMilestone',
          },
          { word: 'میلیون', start: 3.55, end: 3.95 },
          { word: 'باقی', start: 4.05, end: 4.35 },
          {
            word: 'می‌مونه!',
            start: 4.45,
            end: 5.0,
            emphasis: true,
            action: 'residue-hold',
            sound: 'cardThock',
          },
        ]),
        sentenceEnding: { at: 3.9, action: 'residue-freeze', sound: 'softTransition' },
      },
    },

    // ── Scene 3: Problem (10.0s – 16.0s) — «شعبه دوم سود ۶۰؛ ولی مرکزی ۲۰ میلیون زیر صفره!»
    {
      start: 10.0,
      end: 16.0,
      vo: 'شعبه دوم سود ۶۰؛ ولی مرکزی ۲۰ میلیون زیر صفره!',
      spec: {
        kind: 'word-sync',
        actor: 'r56-branch-autopsy',
        title: 'کالبدشکافی دو شعبه',
      },
      sentence: {
        text: 'شعبه دوم سود ۶۰؛ ولی مرکزی ۲۰ میلیون زیر صفره!',
        intent: 'آشکارسازی ریشه‌ای تفاوت هزینه‌ها میان دو شعبه',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(2, [
          { word: 'شعبه', start: 0.3, end: 0.75, action: 'dual-track-split', sound: 'cameraSwish' },
          { word: 'دوم', start: 0.85, end: 1.2 },
          { word: 'سود', start: 1.3, end: 1.65, emphasis: true },
          {
            word: '۶۰؛',
            start: 1.75,
            end: 2.25,
            emphasis: true,
            action: 'green-profit-lock',
            sound: 'financialMilestone',
          },
          { word: 'ولی', start: 2.45, end: 2.75 },
          {
            word: 'مرکزی',
            start: 2.85,
            end: 3.4,
            emphasis: true,
            action: 'red-track-focus',
            sound: 'cardThock',
          },
          {
            word: '۲۰',
            start: 3.5,
            end: 3.95,
            emphasis: true,
            action: 'loss-counter',
            sound: 'clockTickRapid',
          },
          { word: 'میلیون', start: 4.05, end: 4.35 },
          {
            word: 'زیر',
            start: 4.4,
            end: 4.7,
            emphasis: true,
            action: 'below-zero-dip',
            sound: 'cameraSwish',
          },
          {
            word: 'صفره!',
            start: 4.8,
            end: 5.35,
            emphasis: true,
            action: 'loss-stamp',
            sound: 'cardThock',
          },
        ]),
        sentenceEnding: { at: 4.3, action: 'loss-hold', sound: 'softTransition' },
      },
    },

    // ── Scene 4: Resolution (16.0s – 22.0s) — «حسابچه سود و ضرر هر شعبه رو جدا نشون می‌ده!»
    {
      start: 16.0,
      end: 22.0,
      vo: 'حسابچه سود و ضرر هر شعبه رو جدا نشون می‌ده!',
      spec: {
        kind: 'word-sync',
        actor: 'r56-truth-panel',
        title: 'گزارش جداگانه سود و زیان هر شعبه',
      },
      sentence: {
        text: 'حسابچه سود و ضرر هر شعبه رو جدا نشون می‌ده!',
        intent: 'راهکار یکپارچه و شفاف‌سازی سود و زیان شعبه‌به‌شعبه',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(3, [
          {
            word: 'حسابچه',
            start: 0.25,
            end: 0.85,
            emphasis: true,
            action: 'brand-anchor',
            sound: 'cinematicReveal',
          },
          { word: 'سود', start: 1.0, end: 1.4, action: 'pnl-grid', sound: 'precisionSequence' },
          { word: 'و', start: 1.5, end: 1.6 },
          {
            word: 'ضرر',
            start: 1.7,
            end: 2.15,
            emphasis: true,
            action: 'loss-flag',
            sound: 'cardThock',
          },
          { word: 'هر', start: 2.35, end: 2.65 },
          {
            word: 'شعبه',
            start: 2.75,
            end: 3.25,
            emphasis: true,
            action: 'per-branch-cards',
            sound: 'cardThock',
          },
          { word: 'رو', start: 3.35, end: 3.5 },
          {
            word: 'جدا',
            start: 3.6,
            end: 4.1,
            emphasis: true,
            action: 'branch-separation',
            sound: 'dataFlow',
          },
          { word: 'نشون', start: 4.2, end: 4.65 },
          {
            word: 'می‌ده!',
            start: 4.75,
            end: 5.3,
            emphasis: true,
            action: 'insight-lock',
            sound: 'successResolution',
          },
        ]),
        sentenceEnding: { at: 4.5, action: 'insight-hold', sound: 'softTransition' },
      },
    },

    // ── Scene 5: Final CTA (22.0s – 26.0s) — «سود هر شعبه رو همین حالا ببین.»
    {
      start: 22.0,
      end: 26.0,
      vo: 'سود هر شعبه رو همین حالا ببین.',
      spec: {
        kind: 'word-sync',
        actor: 'r56-cta-loop',
        title: 'شروع رایگان گزارش شعبه‌ای در حسابچه',
      },
      sentence: {
        text: 'سود هر شعبه رو همین حالا ببین.',
        intent: 'دعوت مستقیم به اقدام و دیدن گزارش شعبه‌ای',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(4, [
          { word: 'سود', start: 0.2, end: 0.6, emphasis: true, sound: 'cameraSwish' },
          { word: 'هر', start: 0.7, end: 0.95 },
          {
            word: 'شعبه',
            start: 1.05,
            end: 1.5,
            emphasis: true,
            action: 'branch-tag',
            sound: 'cardThock',
          },
          { word: 'رو', start: 1.6, end: 1.75 },
          { word: 'همین', start: 1.85, end: 2.15 },
          { word: 'حالا', start: 2.25, end: 2.65, emphasis: true, sound: 'cardThock' },
          {
            word: 'ببین.',
            start: 2.75,
            end: 3.3,
            emphasis: true,
            action: 'cta-button-pulse',
            sound: 'ctaResolution',
          },
        ]),
        sentenceEnding: { at: 2.8, action: 'cta-glow', sound: 'softTransition' },
      },
    },
  ],
}
