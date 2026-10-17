// ============================================
// Reel #57 — Word-Synchronized Forensic Audit & Fraud Shield
//
// «فاکتور ۷۵ میلیونی دیروز کجاست؟ کی ویرایشش کرد؟»
//
// A high-stakes Cyber-Audit & Loss Prevention narrative on obsidian-cinematic canvas:
// 1. Hook (0.0–4.8s): An original 75M invoice is suddenly tampered down to 45M
//    at 21:42 without owner consent — «کی ویرایشش کرد؟» (stamp held from 3.4s).
// 2. Concern (4.8–10.2s): The 30M cash deficit is exposed as untracked slippage
//    sliding out of the register — held from 3.8s.
// 3. Problem (10.2–16.2s): In legacy Excel/paper books, rows can be deleted or
//    tampered silently with zero audit trail — held from 4.5s.
// 4. Solution (16.2–22.0s): Hisabche logs every keystroke, user role, timestamp,
//    and IP address with manager lock protection — held from 4.4s.
// 5. CTA (22.0–26.0s): Full anti-theft shield on the cash register — hisabche.com
//    — held from 2.6s.
// ============================================

import type { Reel } from '../engine/types'
import type { AlignmentLifecycleStatus, WordCue } from '../engine/speech-model'
import alignmentData from './alignments/reel-57-alignment.json'

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

export const reel57: Reel = {
  id: '57',
  title: 'فاکتور ۷۵ میلیونی دیروز کجاست؟ کی ویرایشش کرد؟',
  duration: 26.0,
  theme: 'cinematic-obsidian',
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'دستکاری فاکتورهای نقدی و ثبت تخفیف‌های غیرمجاز توسط پرسنل در غیاب مدیر بدون ثبت ردپا',
    oldWorkflow:
      'نرم‌افزار سنتی یا اکسل که هر کسی می‌تواند فاکتور ثبت‌شده را ویرایش یا پاک کند بدون لاگ امنیتی',
    friction:
      'کسری ۳۰ میلیونی دخل شبانه به دلیل تغییر بی‌پروای فاکتورها و ناتوانی صاحب فروشگاه در اثبات دستکاری',
    hisabcheAction:
      'ثبت تغییرناپذیر لاگ حسابرسی، قفل دسترسی ویرایش بدون تایید مدیر، و پیامک آنی تغییرات فاکتور',
    automatedResult:
      'شفافیت ۱۰۰ درصدی صندوق، صفر شدن سرقت پنهان و بازیابی کنترل کامل کارفرما بر هر تراکنش',
    businessOutcome:
      'آسودگی خاطر مدیر از امنیت کامل صندوق و پایان سوءاستفاده‌های خاموش در شیفت‌های کاری',
    emotionalPayoff:
      'احساس اقتدار، نظارت شفاف و اطمینان از اینکه حتی یک ریال بدون اجازه جابه‌جا نمی‌شود',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'forensic-audit-trail',
      'permission-lock-shield',
      'tamper-diff-inspector',
      'realtime-manager-alert',
      'vault-security-seal',
    ],
  },
  scenes: [
    // ── Scene 1: Hook (0.0s – 4.8s) — «فاکتور ۷۵ میلیونی دیروز کجاست؟ کی ویرایشش کرد؟»
    {
      start: 0.0,
      end: 4.8,
      vo: 'فاکتور ۷۵ میلیونی دیروز کجاست؟ کی ویرایشش کرد؟',
      spec: {
        kind: 'word-sync',
        actor: 'r57-forensic-hook',
        title: 'ردیابی فاکتور دستکاری‌شده',
      },
      sentence: {
        text: 'فاکتور ۷۵ میلیونی دیروز کجاست؟ کی ویرایشش کرد؟',
        intent: 'هوک اضطراب امنیتی و تغییر مشکوک مبلغ فاکتور نقدی',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(0, [
          {
            word: 'فاکتور',
            start: 0.2,
            end: 0.7,
            emphasis: true,
            action: 'invoice-enter',
            sound: 'cardThock',
          },
          {
            word: '۷۵',
            start: 0.8,
            end: 1.3,
            emphasis: true,
            action: 'original-odometer',
            sound: 'clockTickRapid',
          },
          { word: 'میلیونی', start: 1.4, end: 1.8 },
          { word: 'دیروز', start: 1.9, end: 2.3 },
          {
            word: 'کجاست؟',
            start: 2.4,
            end: 3.1,
            emphasis: true,
            action: 'tamper-alert',
            sound: 'cameraSwish',
          },
          { word: 'کی', start: 3.2, end: 3.5 },
          {
            word: 'ویرایشش',
            start: 3.6,
            end: 4.0,
            emphasis: true,
            action: 'diff-highlight',
            sound: 'cardThock',
          },
          {
            word: 'کرد؟',
            start: 4.1,
            end: 4.5,
            emphasis: true,
            action: 'fraud-stamp',
            sound: 'cardThock',
          },
        ]),
        sentenceEnding: { at: 3.4, action: 'fraud-hold', sound: 'softTransition' },
      },
    },

    // ── Scene 2: Tension (4.8s – 10.2s) — «۳۰ میلیون پول نقد گم شد؛ بدون اینکه متوجه بشی!»
    {
      start: 4.8,
      end: 10.2,
      vo: '۳۰ میلیون پول نقد گم شد؛ بدون اینکه متوجه بشی!',
      spec: {
        kind: 'word-sync',
        actor: 'r57-cash-gap',
        title: 'نشتی مخفیانه پول نقد صندوق',
      },
      sentence: {
        text: '۳۰ میلیون پول نقد گم شد؛ بدون اینکه متوجه بشی!',
        intent: 'تشدید فاجعه کسری دخل شبانه به دلیل ویرایش بی‌مجوز',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(1, [
          {
            word: '۳۰',
            start: 0.3,
            end: 0.9,
            emphasis: true,
            action: 'gap-counter',
            sound: 'clockTickRapid',
          },
          { word: 'میلیون', start: 1.0, end: 1.4 },
          { word: 'پول', start: 1.5, end: 1.8 },
          {
            word: 'نقد',
            start: 1.9,
            end: 2.3,
            emphasis: true,
            action: 'cash-drain',
            sound: 'cameraSwish',
          },
          { word: 'گم', start: 2.4, end: 2.8 },
          {
            word: 'شد؛',
            start: 2.9,
            end: 3.3,
            emphasis: true,
            action: 'cash-lock',
            sound: 'cardThock',
          },
          { word: 'بدون', start: 3.4, end: 3.7 },
          { word: 'اینکه', start: 3.8, end: 4.1 },
          {
            word: 'متوجه',
            start: 4.2,
            end: 4.6,
            emphasis: true,
            action: 'stealth-reveal',
            sound: 'cardThock',
          },
          {
            word: 'بشی!',
            start: 4.7,
            end: 5.2,
            emphasis: true,
            action: 'leak-badge',
            sound: 'cardThock',
          },
        ]),
        sentenceEnding: { at: 3.8, action: 'gap-hold', sound: 'softTransition' },
      },
    },

    // ── Scene 3: Problem (10.2s – 16.2s) — «تو اکسل هیچ ردی نیست؛ فاکتور بی‌صدا عوض می‌شه!»
    {
      start: 10.2,
      end: 16.2,
      vo: 'تو اکسل هیچ ردی نیست؛ فاکتور بی‌صدا عوض می‌شه!',
      spec: {
        kind: 'word-sync',
        actor: 'r57-legacy-vulnerability',
        title: 'آسیب‌پذیری دفاتر و سیستم‌های سنتی',
      },
      sentence: {
        text: 'تو اکسل هیچ ردی نیست؛ فاکتور بی‌صدا عوض می‌شه!',
        intent: 'نمایش ضعف ساختاری سیستم‌های بدون لاگ حسابرسی',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(2, [
          { word: 'تو', start: 0.3, end: 0.6 },
          {
            word: 'اکسل',
            start: 0.7,
            end: 1.2,
            emphasis: true,
            action: 'legacy-blur',
            sound: 'cameraSwish',
          },
          { word: 'هیچ', start: 1.3, end: 1.6 },
          {
            word: 'ردی',
            start: 1.7,
            end: 2.2,
            emphasis: true,
            action: 'ghost-line',
            sound: 'cardThock',
          },
          { word: 'نیست؛', start: 2.3, end: 2.8 },
          {
            word: 'فاکتور',
            start: 2.9,
            end: 3.3,
            emphasis: true,
            action: 'silent-swap',
            sound: 'cameraSwish',
          },
          { word: 'بی‌صدا', start: 3.4, end: 3.9 },
          {
            word: 'عوض',
            start: 4.0,
            end: 4.5,
            emphasis: true,
            action: 'audit-scan',
            sound: 'clockTickRapid',
          },
          {
            word: 'می‌شه!',
            start: 4.6,
            end: 5.2,
            emphasis: true,
            action: 'vulnerability-stamp',
            sound: 'cardThock',
          },
        ]),
        sentenceEnding: { at: 4.5, action: 'vulnerability-hold', sound: 'softTransition' },
      },
    },

    // ── Scene 4: Solution (16.2s – 22.0s) — «حسابچه لاگ هر تغییر رو با ساعت و اسم کاربر نگه می‌داره!»
    {
      start: 16.2,
      end: 22.0,
      vo: 'حسابچه لاگ هر تغییر رو با ساعت و اسم کاربر نگه می‌داره!',
      spec: {
        kind: 'word-sync',
        actor: 'r57-security-shield',
        title: 'سپر امنیتی و لاگ لحظه‌ای تغییرات',
      },
      sentence: {
        text: 'حسابچه لاگ هر تغییر رو با ساعت و اسم کاربر نگه می‌داره!',
        intent: 'معرفی راهکار مقتدر حسابچه در ردیابی هر ویرایش',
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
            word: 'لاگ',
            start: 0.95,
            end: 1.4,
            emphasis: true,
            action: 'audit-stream',
            sound: 'precisionSequence',
          },
          { word: 'هر', start: 1.5, end: 1.75 },
          {
            word: 'تغییر',
            start: 1.85,
            end: 2.3,
            emphasis: true,
            action: 'secure-badge',
            sound: 'cardThock',
          },
          { word: 'رو', start: 2.4, end: 2.55 },
          { word: 'با', start: 2.65, end: 2.85 },
          {
            word: 'ساعت',
            start: 2.95,
            end: 3.4,
            emphasis: true,
            action: 'timestamp-feed',
            sound: 'clockTickRapid',
          },
          { word: 'و', start: 3.5, end: 3.6 },
          {
            word: 'اسم',
            start: 3.7,
            end: 4.1,
            emphasis: true,
            action: 'user-permission-pill',
            sound: 'cardThock',
          },
          {
            word: 'کاربر',
            start: 4.2,
            end: 4.6,
            emphasis: true,
            action: 'shield-lock',
            sound: 'cardThock',
          },
          { word: 'نگه', start: 4.7, end: 5.0 },
          {
            word: 'می‌داره!',
            start: 5.1,
            end: 5.6,
            emphasis: true,
            action: 'audit-shield-lock',
            sound: 'precisionSequence',
          },
        ]),
        sentenceEnding: { at: 4.4, action: 'shield-hold', sound: 'softTransition' },
      },
    },

    // ── Scene 5: Final CTA (22.0s – 26.0s) — «صندوقت رو ضد سرقت کن؛ همین حالا در حسابچه.»
    {
      start: 22.0,
      end: 26.0,
      vo: 'صندوقت رو ضد سرقت کن؛ همین حالا در حسابچه.',
      spec: {
        kind: 'word-sync',
        actor: 'r57-cta-vault',
        title: 'شروع رایگان و قفل امنیتی صندوق',
      },
      sentence: {
        text: 'صندوقت رو ضد سرقت کن؛ همین حالا در حسابچه.',
        intent: 'دعوت به اقدام و فعال‌سازی رایگان سپر صندوق',
        alignmentStatus: lifecycleStatus,
        isProvisional,
        alignmentSource,
        confidence,
        words: getSceneWords(4, [
          {
            word: 'صندوقت',
            start: 0.2,
            end: 0.7,
            emphasis: true,
            action: 'pos-shield',
            sound: 'cameraSwish',
          },
          { word: 'رو', start: 0.8, end: 0.95 },
          {
            word: 'ضد',
            start: 1.05,
            end: 1.4,
            emphasis: true,
            action: 'armor-tag',
            sound: 'cardThock',
          },
          {
            word: 'سرقت',
            start: 1.5,
            end: 1.95,
            emphasis: true,
            action: 'armor-lock',
            sound: 'cardThock',
          },
          { word: 'کن؛', start: 2.05, end: 2.35 },
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
        sentenceEnding: { at: 2.6, action: 'cta-glow', sound: 'softTransition' },
      },
    },
  ],
}
