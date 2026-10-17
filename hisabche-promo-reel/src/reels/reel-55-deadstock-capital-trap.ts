// ============================================
// Reel #55 — Word-Synchronized, Sentence-Driven Motion Graphics
//
// «انبارت پره، ولی جیبت خالیه!»
//
// Hybrid visual languages, each scene a different studio template family:
// 1. Hook (0.0–4.0s): kinetic-color full-bleed — «انبارت» stuffs the rack, «جیبت خالیه!» slams a zero-cash stamp (held at opacity 1 from 2.4s).
// 2. Concern (4.0–9.6s): thermal-receipt — the dead-stock receipt prints, «سرمایه» counts to 400M, «خوابه!» climbs the aging meter (climax 1.7s before end).
// 3. Problem (9.6–15.8s): isometric-exploded — the shelf autopsies into 5 layers along Z, «می‌خوره!» slams the locked-capital stamp (1.4s hold).
// 4. Solution (15.8–22.0s): liquid-glass × swiss-terminal — brand anchored from t=0, «پیدا» scans the dead-stock report, «پول» frees 400M (1.7s hold).
// 5. CTA (22.0–26.0s): conversion — «انبارت» tags the live inventory and «کن.» pulses the free-start button.
// ============================================

import type { Reel } from '../engine/types'
import type { AlignmentLifecycleStatus, WordCue } from '../engine/speech-model'
import alignmentData from './alignments/reel-55-alignment.json'

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

export const reel55: Reel = {
  id: '55',
  title: 'سناریوی کلمه‌به‌کلمه: انبارت پره، ولی جیبت خالیه!',
  duration: 26.0,
  theme: 'procedural-spatial',
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'انبار پر از کالا، اما حساب بانکی خالی و سرمایه قفل‌شده در قفسه‌ها',
    oldWorkflow: 'خرید بر اساس حدس و تجربه، بدون کاردکس نقطه‌ای و بدون شناسایی کالای بی‌حرکت',
    friction: 'خواب ۴۰۰ میلیون سرمایه در کالای بی‌روند و بی‌پولی برای خرید بعدی',
    hisabcheAction:
      'کاردکس لحظه‌ای، گزارش کالای راکد و نقطه سفارش هوشمند برای برگرداندن سرمایه به چرخه نقدی',
    automatedResult: 'شناسایی خودکار کالای بی‌حرکت، اولویت‌بندی تخفیف و آزادسازی سرمایه قفل‌شده',
    businessOutcome: 'گردش سریع‌تر سرمایه، خرید هوشمند بر اساس تقاضا و پر شدن جریان نقدینگی',
    emotionalPayoff: 'آرامش خاطر از تبدیل انبار سنگین به پول و کنترل کامل سرمایه در گردش',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'word-synchronized-choreography',
      'thermal-deadstock-audit',
      'isometric-layer-autopsy',
      'liquid-glass-terminal',
      'tactile-zero-gauge',
    ],
  },
  scenes: [
    // ── Scene 1: Hook (0.0s – 4.0s) — «انبارت پره، ولی جیبت خالیه!»
    {
      start: 0.0,
      end: 4.0,
      vo: 'انبارت پره، ولی جیبت خالیه!',
      spec: {
        kind: 'word-sync',
        actor: 'r55-hook-vault',
        title: 'انبار پر و جیب خالی',
      },
      sentence: {
        text: 'انبارت پره، ولی جیبت خالیه!',
        intent: 'هوک بصری / تناقض انبار پر و نقدینگی صفر',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(0, [
          {
            word: 'انبارت',
            start: 0.2,
            end: 0.75,
            emphasis: true,
            action: 'shelf-stuff',
            sound: 'impact',
          },
          {
            word: 'پره،',
            start: 0.8,
            end: 1.25,
            emphasis: true,
            action: 'shelf-overflow',
            sound: 'paperRustle',
          },
          { word: 'ولی', start: 1.35, end: 1.6 },
          {
            word: 'جیبت',
            start: 1.65,
            end: 2.2,
            emphasis: true,
            action: 'pocket-zero',
            sound: 'alert',
          },
          {
            word: 'خالیه!',
            start: 2.4,
            end: 3.1,
            emphasis: true,
            action: 'pocket-slam',
            sound: 'impact',
          },
        ]),
        sentenceEnding: { at: 2.5, action: 'hook-freeze', sound: 'tick' },
      },
    },

    // ── Scene 2: Escalation (4.0s – 9.6s) — «چهارصد میلیون سرمایه، توی قفسه‌ها خوابه!»
    {
      start: 4.0,
      end: 9.6,
      vo: 'چهارصد میلیون سرمایه، توی قفسه‌ها خوابه!',
      spec: {
        kind: 'word-sync',
        actor: 'r55-thermal-aging',
        title: 'رسید حرارتی سرمایه راکد',
      },
      sentence: {
        text: 'چهارصد میلیون سرمایه، توی قفسه‌ها خوابه!',
        intent: 'عددسازی و تشدید خواب سرمایه در انبار',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(1, [
          {
            word: 'چهارصد',
            start: 0.3,
            end: 0.95,
            emphasis: true,
            action: 'receipt-print',
            sound: 'receiptPrint',
          },
          { word: 'میلیون', start: 1.05, end: 1.5 },
          {
            word: 'سرمایه،',
            start: 1.6,
            end: 2.35,
            emphasis: true,
            action: 'capital-counter',
            sound: 'impact',
          },
          { word: 'توی', start: 2.5, end: 2.8 },
          {
            word: 'قفسه‌ها',
            start: 2.9,
            end: 3.7,
            emphasis: true,
            action: 'shelf-highlight',
            sound: 'paperRustle',
          },
          {
            word: 'خوابه!',
            start: 3.9,
            end: 4.7,
            emphasis: true,
            action: 'aging-climb',
            sound: 'alert',
          },
        ]),
        sentenceEnding: { at: 4.0, action: 'aging-hold', sound: 'softTransition' },
      },
    },

    // ── Scene 3: Problem (9.6s – 15.8s) — «کالای بی‌حرکت، ته انبار داره خاک می‌خوره!»
    {
      start: 9.6,
      end: 15.8,
      vo: 'کالای بی‌حرکت، ته انبار داره خاک می‌خوره!',
      spec: {
        kind: 'word-sync',
        actor: 'r55-isometric-autopsy',
        title: 'کالبدشکافی لایه‌های انبار',
      },
      sentence: {
        text: 'کالای بی‌حرکت، ته انبار داره خاک می‌خوره!',
        intent: 'آشکارسازی ساختاری علت رکود کالا',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(2, [
          {
            word: 'کالای',
            start: 0.3,
            end: 0.9,
            emphasis: true,
            action: 'explode-start',
            sound: 'whoosh',
          },
          {
            word: 'بی‌حرکت،',
            start: 1.0,
            end: 1.9,
            emphasis: true,
            action: 'freeze-flag',
            sound: 'alert',
          },
          { word: 'ته', start: 2.0, end: 2.4 },
          {
            word: 'انبار',
            start: 2.5,
            end: 3.3,
            emphasis: true,
            action: 'layer-separate',
            sound: 'dataFlow',
          },
          { word: 'داره', start: 3.5, end: 3.9 },
          {
            word: 'خاک',
            start: 4.0,
            end: 4.7,
            emphasis: true,
            action: 'dust-settle',
            sound: 'paperRustle',
          },
          {
            word: 'می‌خوره!',
            start: 4.8,
            end: 5.6,
            emphasis: true,
            action: 'locked-capital-slam',
            sound: 'impact',
          },
        ]),
        sentenceEnding: { at: 5.0, action: 'autopsy-hold', sound: 'softTransition' },
      },
    },

    // ── Scene 4: Resolution (15.8s – 22.0s) — «حسابچه کالای راکد رو پیدا می‌کنه و به پول برمی‌گردونه.»
    {
      start: 15.8,
      end: 22.0,
      vo: 'حسابچه کالای راکد رو پیدا می‌کنه و به پول برمی‌گردونه.',
      spec: {
        kind: 'word-sync',
        actor: 'r55-glass-recovery',
        title: 'آزادسازی سرمایه راکد با حسابچه',
      },
      sentence: {
        text: 'حسابچه کالای راکد رو پیدا می‌کنه و به پول برمی‌گردونه.',
        intent: 'راهکار یکپارچه و بازگشت سرمایه به چرخه نقدی',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(3, [
          {
            word: 'حسابچه',
            start: 0.2,
            end: 0.8,
            emphasis: true,
            action: 'brand-anchor',
            sound: 'cinematicReveal',
          },
          {
            word: 'کالای',
            start: 0.9,
            end: 1.5,
            emphasis: true,
            action: 'glass-terminal',
            sound: 'precisionSequence',
          },
          { word: 'راکد', start: 1.6, end: 2.2, emphasis: true },
          { word: 'رو', start: 2.3, end: 2.5 },
          {
            word: 'پیدا',
            start: 2.6,
            end: 3.1,
            emphasis: true,
            action: 'report-scan',
            sound: 'scan',
          },
          { word: 'می‌کنه', start: 3.2, end: 3.8 },
          { word: 'و', start: 3.9, end: 4.05 },
          { word: 'به', start: 4.1, end: 4.3 },
          {
            word: 'پول',
            start: 4.5,
            end: 5.05,
            emphasis: true,
            action: 'cash-conversion',
            sound: 'financialMilestone',
          },
          {
            word: 'برمی‌گردونه.',
            start: 5.15,
            end: 6.0,
            emphasis: true,
            action: 'recovery-lock',
            sound: 'successResolution',
          },
        ]),
        sentenceEnding: { at: 4.6, action: 'recovery-lock-hold', sound: 'success' },
      },
    },

    // ── Scene 5: Final CTA (22.0s – 26.0s) — «همین حالا انبارت رو در حسابچه پاک‌سازی کن.»
    {
      start: 22.0,
      end: 26.0,
      vo: 'همین حالا انبارت رو در حسابچه پاک‌سازی کن.',
      spec: {
        kind: 'word-sync',
        actor: 'r55-cta-conversion',
        title: 'شروع رایگان پاک‌سازی انبار در حسابچه',
      },
      sentence: {
        text: 'همین حالا انبارت رو در حسابچه پاک‌سازی کن.',
        intent: 'دعوت مستقیم به اقدام و شروع بدون ریسک',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(4, [
          { word: 'همین', start: 0.2, end: 0.45 },
          { word: 'حالا', start: 0.5, end: 0.8, emphasis: true, sound: 'cardEnter' },
          {
            word: 'انبارت',
            start: 0.85,
            end: 1.3,
            emphasis: true,
            action: 'inventory-tag',
            sound: 'whoosh',
          },
          { word: 'رو', start: 1.35, end: 1.5 },
          { word: 'در', start: 1.55, end: 1.7 },
          {
            word: 'حسابچه',
            start: 1.75,
            end: 2.3,
            emphasis: true,
            action: 'brand-glow',
            sound: 'titleHit',
          },
          { word: 'پاک‌سازی', start: 2.35, end: 2.7, emphasis: true },
          {
            word: 'کن.',
            start: 2.75,
            end: 3.3,
            emphasis: true,
            action: 'cta-button-pulse',
            sound: 'ctaResolution',
          },
        ]),
        sentenceEnding: { at: 2.85, action: 'cta-glow', sound: 'chime' },
      },
    },
  ],
}
