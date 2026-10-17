// ============================================
// Reel #58 — Word-Synchronized Offline POS & Blackout Resilience
//
// «قطع اینترنت و ۴۰ مشتری در صف؛ دخل متوقف شد؟»
// ============================================

import type { Reel } from '../engine/types'
import type { AlignmentLifecycleStatus, WordCue } from '../engine/speech-model'
import alignmentData from './alignments/reel-58-alignment.json'

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

export const reel58: Reel = {
  id: '58',
  title: 'قطع اینترنت و ۴۰ مشتری در صف؛ دخل متوقف شد؟',
  duration: 26.0,
  theme: 'procedural-spatial',
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'قطع اینترنت در شلوغی فروشگاه و قفل شدن صندوق پرداخت و فرار مشتریان',
    oldWorkflow: 'نرم‌افزار ابری وابسته به اینترنت یا کشوی پول سنتی بدون صدور فاکتور',
    friction: 'توقف کامل فروش و مغایرت دخل در زمان قطعی شبکه بانکی و اینترنت',
    hisabcheAction: 'موتور آفلاین بومی حسابچه با ذخیره ابری و همگام‌سازی خودکار در پس‌زمینه',
    automatedResult: 'صدور فاکتور زیر ۲ ثانیه در حالت کاملاً آفلاین و سینک بدون تداخل',
    businessOutcome: 'تداوم ۱۰۰٪ دخل در هر شرایط بدون صف و استرس قطعی اینترنت',
    emotionalPayoff: 'آرامش خاطر کامل در اوج شلوغی و قطعی‌های ناگهانی',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'OfflineResilienceEngine',
      'InstantSyncQueue',
      'LocalVaultStorage',
      'ZeroBlackoutPos',
    ],
  },
  scenes: [
    {
      start: 0.0,
      end: 4.6,
      vo: 'اینترنت قطع شد و ۴۰ مشتری عصبانی در صف موندن!',
      spec: {
        kind: 'word-sync',
        actor: 'r57-forensic-hook',
        title: 'بحران قطعی اینترنت در فروشگاه',
      },
      sentence: {
        text: 'اینترنت قطع شد و ۴۰ مشتری عصبانی در صف موندن!',
        intent: 'هوک اضطراری بحران قطعی شبکه در صندوق',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(0, [
          {
            word: 'اینترنت',
            start: 0.2,
            end: 0.7,
            emphasis: true,
            action: 'network-down',
            sound: 'cameraSwish',
          },
          {
            word: 'قطع',
            start: 0.8,
            end: 1.2,
            emphasis: true,
            action: 'offline-stamp',
            sound: 'cardThock',
          },
          { word: 'شد', start: 1.3, end: 1.5 },
          { word: 'و', start: 1.6, end: 1.7 },
          {
            word: '۴۰',
            start: 1.8,
            end: 2.3,
            emphasis: true,
            action: 'customer-queue',
            sound: 'clockTickRapid',
          },
          { word: 'مشتری', start: 2.4, end: 2.8 },
          { word: 'عصبانی', start: 2.9, end: 3.4, emphasis: true },
          { word: 'در', start: 3.5, end: 3.6 },
          {
            word: 'صف',
            start: 3.7,
            end: 4.0,
            emphasis: true,
            action: 'queue-freeze',
            sound: 'cardThock',
          },
          { word: 'موندن!', start: 4.1, end: 4.5, emphasis: true },
        ]),
        sentenceEnding: { at: 3.2, action: 'alarm-freeze', sound: 'softTransition' },
      },
    },
    {
      start: 4.6,
      end: 10.0,
      vo: 'نرم‌افزار ابری قفل کرد و حتی یه فاکتور صادر نمی‌شه!',
      spec: {
        kind: 'word-sync',
        actor: 'r57-cash-gap',
        title: 'قفل شدن صندوق ابری',
      },
      sentence: {
        text: 'نرم‌افزار ابری قفل کرد و حتی یه فاکتور صادر نمی‌شه!',
        intent: 'تشدید فاجعه وابستگی نرم‌افزار به وب',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(1, [
          { word: 'نرم‌افزار', start: 0.3, end: 0.8 },
          {
            word: 'ابری',
            start: 0.9,
            end: 1.3,
            emphasis: true,
            action: 'cloud-freeze',
            sound: 'cardThock',
          },
          {
            word: 'قفل',
            start: 1.4,
            end: 1.8,
            emphasis: true,
            action: 'lock-alarm',
            sound: 'cameraSwish',
          },
          { word: 'کرد', start: 1.9, end: 2.1 },
          { word: 'و', start: 2.2, end: 2.3 },
          { word: 'حتی', start: 2.4, end: 2.7 },
          { word: 'یه', start: 2.8, end: 3.0 },
          {
            word: 'فاکتور',
            start: 3.1,
            end: 3.6,
            emphasis: true,
            action: 'invoice-block',
            sound: 'cardThock',
          },
          { word: 'صادر', start: 3.7, end: 4.1 },
          {
            word: 'نمی‌شه!',
            start: 4.2,
            end: 4.8,
            emphasis: true,
            action: 'stamp-blocked',
            sound: 'cardThock',
          },
        ]),
        sentenceEnding: { at: 3.6, action: 'block-hold', sound: 'softTransition' },
      },
    },
    {
      start: 10.0,
      end: 15.6,
      vo: 'فروشگاه‌های سنتی تو قطعی برق و نت کاملاً فلج می‌شن!',
      spec: {
        kind: 'word-sync',
        actor: 'r57-legacy-vulnerability',
        title: 'فلج شدن کامل سیستم‌های سنتی',
      },
      sentence: {
        text: 'فروشگاه‌های سنتی تو قطعی برق و نت کاملاً فلج می‌شن!',
        intent: 'مقایسه عواقب در سیستم‌های بدون پایگاه داده محلی',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(2, [
          { word: 'فروشگاه‌های', start: 0.3, end: 0.9 },
          {
            word: 'سنتی',
            start: 1.0,
            end: 1.5,
            emphasis: true,
            action: 'legacy-blackout',
            sound: 'cameraSwish',
          },
          { word: 'تو', start: 1.6, end: 1.8 },
          { word: 'قطعی', start: 1.9, end: 2.3, emphasis: true },
          { word: 'برق', start: 2.4, end: 2.8 },
          { word: 'و', start: 2.9, end: 3.0 },
          { word: 'نت', start: 3.1, end: 3.5, emphasis: true },
          { word: 'کاملاً', start: 3.6, end: 4.0 },
          {
            word: 'فلج',
            start: 4.1,
            end: 4.6,
            emphasis: true,
            action: 'paralysis-stamp',
            sound: 'cardThock',
          },
          { word: 'می‌شن!', start: 4.7, end: 5.2, emphasis: true },
        ]),
        sentenceEnding: { at: 4.3, action: 'paralysis-hold', sound: 'softTransition' },
      },
    },
    {
      start: 15.6,
      end: 21.6,
      vo: 'حسابچه آفلاین کار می‌کنه و به محض اتصال همگام می‌شه!',
      spec: {
        kind: 'word-sync',
        actor: 'r57-security-shield',
        title: 'فناوری آفلاین-اول حسابچه',
      },
      sentence: {
        text: 'حسابچه آفلاین کار می‌کنه و به محض اتصال همگام می‌شه!',
        intent: 'معرفی راهکار مقتدر معماری آفلاین-اول حسابچه',
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
          {
            word: 'آفلاین',
            start: 0.95,
            end: 1.5,
            emphasis: true,
            action: 'offline-engine',
            sound: 'precisionSequence',
          },
          { word: 'کار', start: 1.6, end: 1.9 },
          { word: 'می‌کنه', start: 2.0, end: 2.4 },
          { word: 'و', start: 2.5, end: 2.6 },
          { word: 'به', start: 2.7, end: 2.9 },
          { word: 'محض', start: 3.0, end: 3.3 },
          {
            word: 'اتصال',
            start: 3.4,
            end: 3.9,
            emphasis: true,
            action: 'instant-sync',
            sound: 'precisionSequence',
          },
          {
            word: 'همگام',
            start: 4.0,
            end: 4.5,
            emphasis: true,
            action: 'sync-success',
            sound: 'cardThock',
          },
          { word: 'می‌شه!', start: 4.6, end: 5.2, emphasis: true },
        ]),
        sentenceEnding: { at: 4.2, action: 'sync-hold', sound: 'softTransition' },
      },
    },
    {
      start: 21.6,
      end: 26.0,
      vo: 'صندوق کسب‌وکارت رو پایدار کن؛ همین حالا در حسابچه.',
      spec: {
        kind: 'word-sync',
        actor: 'r57-cta-vault',
        title: 'پایداری همیشگی صندوق در حسابچه',
      },
      sentence: {
        text: 'صندوق کسب‌وکارت رو پایدار کن؛ همین حالا در حسابچه.',
        intent: 'دعوت به اقدام و فعال‌سازی رایگان صندوق پایدار',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(4, [
          {
            word: 'صندوق',
            start: 0.2,
            end: 0.6,
            emphasis: true,
            action: 'pos-shield',
            sound: 'cameraSwish',
          },
          { word: 'کسب‌وکارت', start: 0.7, end: 1.2 },
          { word: 'رو', start: 1.3, end: 1.45 },
          {
            word: 'پایدار',
            start: 1.55,
            end: 2.0,
            emphasis: true,
            action: 'stable-tag',
            sound: 'cardThock',
          },
          { word: 'کن؛', start: 2.1, end: 2.35 },
          { word: 'همین', start: 2.45, end: 2.7 },
          {
            word: 'حالا',
            start: 2.75,
            end: 3.1,
            emphasis: true,
            action: 'cta-button-pulse',
            sound: 'ctaResolution',
          },
          { word: 'در', start: 3.15, end: 3.3 },
          {
            word: 'حسابچه.',
            start: 3.35,
            end: 3.8,
            emphasis: true,
            action: 'brand-finish',
            sound: 'cardThock',
          },
        ]),
        sentenceEnding: { at: 2.5, action: 'cta-glow', sound: 'softTransition' },
      },
    },
  ],
}
